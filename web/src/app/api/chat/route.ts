import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_SITE_ID = process.env.NEXT_PUBLIC_DEFAULT_SITE_ID!;

// RAG: Fetch relevant context based on query
async function fetchContext(query: string) {
  const lowerQuery = query.toLowerCase();
  const context: any = {
    people: [],
    alerts: [],
    tickets: [],
    machines: [],
  };

  // Fetch people if query mentions them
  if (lowerQuery.includes('people') || lowerQuery.includes('worker') || lowerQuery.includes('active') || lowerQuery.includes('who')) {
    const { data } = await supabase
      .from('people')
      .select('*')
      .eq('site_id', DEFAULT_SITE_ID)
      .order('created_at', { ascending: false })
      .limit(20);
    context.people = data || [];
  }

  // Fetch alerts if query mentions them
  if (lowerQuery.includes('alert') || lowerQuery.includes('warning') || lowerQuery.includes('incident') || lowerQuery.includes('safety')) {
    const { data } = await supabase
      .from('alerts')
      .select('*')
      .eq('site_id', DEFAULT_SITE_ID)
      .order('created_at', { ascending: false })
      .limit(10);
    context.alerts = data || [];
  }

  // Fetch tickets if query mentions them
  if (lowerQuery.includes('ticket') || lowerQuery.includes('task') || lowerQuery.includes('priority') || lowerQuery.includes('epic')) {
    const { data } = await supabase
      .from('tickets')
      .select('*')
      .eq('site_id', DEFAULT_SITE_ID)
      .order('created_at', { ascending: false })
      .limit(15);
    context.tickets = data || [];
  }

  // Fetch machines if query mentions them
  if (lowerQuery.includes('machine') || lowerQuery.includes('equipment') || lowerQuery.includes('vehicle')) {
    const { data } = await supabase
      .from('machines')
      .select('*')
      .eq('site_id', DEFAULT_SITE_ID)
      .order('created_at', { ascending: false })
      .limit(10);
    context.machines = data || [];
  }

  // If no specific context, fetch a summary of everything
  if (!context.people.length && !context.alerts.length && !context.tickets.length && !context.machines.length) {
    const [people, alerts, tickets, machines] = await Promise.all([
      supabase.from('people').select('*').eq('site_id', DEFAULT_SITE_ID).limit(5),
      supabase.from('alerts').select('*').eq('site_id', DEFAULT_SITE_ID).order('created_at', { ascending: false }).limit(3),
      supabase.from('tickets').select('*').eq('site_id', DEFAULT_SITE_ID).order('created_at', { ascending: false }).limit(5),
      supabase.from('machines').select('*').eq('site_id', DEFAULT_SITE_ID).limit(5),
    ]);
    context.people = people.data || [];
    context.alerts = alerts.data || [];
    context.tickets = tickets.data || [];
    context.machines = machines.data || [];
  }

  return context;
}

// Build system prompt with context
function buildSystemPrompt(context: any) {
  return `You are SiteOps AI Assistant, a helpful construction site management assistant. You have access to real-time data from the construction site.

Current Site Data:

**Active People (${context.people.length}):**
${context.people.map((p: any) => `- ${p.name} (${p.role || 'Worker'}) - Status: ${p.status || 'Unknown'} ${p.status_note ? '- ' + p.status_note : ''}`).join('\n')}

**Recent Alerts (${context.alerts.length}):**
${context.alerts.map((a: any) => `- ${a.type}: ${a.details || 'No details'} (${new Date(a.created_at).toLocaleString()})`).join('\n')}

**Active Tickets (${context.tickets.length}):**
${context.tickets.map((t: any) => `- [${t.priority || 'Normal'}] ${t.title} (${t.status}) - Type: ${t.type || 'Task'}`).join('\n')}

**Machines/Equipment (${context.machines.length}):**
${context.machines.map((m: any) => `- ${m.name} (${m.type || 'Equipment'}) - Status: ${m.status || 'Unknown'}`).join('\n')}

Your role:
- Answer questions about the construction site
- Provide summaries and insights
- Help with safety, workforce, and project management queries
- Be concise but informative
- If you don't have specific data, say so clearly

IMPORTANT FORMATTING RULES:
- Use simple, clean formatting
- Use numbered lists (1., 2., 3.) for sequential items
- Use bullet points (•) for non-sequential items
- Use **bold** for emphasis on important terms
- Keep responses conversational and easy to read
- Avoid markdown asterisks for bullet points
- Group related information together
- Add line breaks between sections for readability`;
}

export async function POST(req: NextRequest) {
  try {
    const { message, history = [] } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Check if Gemini API key is configured
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your .env.local file.' 
      }, { status: 500 });
    }

    // Fetch relevant context using RAG
    const context = await fetchContext(message);

    // Build system prompt with context
    const systemPrompt = buildSystemPrompt(context);

    // Initialize Gemini model
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    });

    // Build chat history - filter out initial assistant greeting if it's the only message
    let chatHistory = history
      .filter((msg: any) => !(history.length === 1 && msg.role === 'assistant'))
      .map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // Ensure history starts with user message if not empty
    if (chatHistory.length > 0 && chatHistory[0].role === 'model') {
      chatHistory = chatHistory.slice(1);
    }

    // Start chat
    const chat = model.startChat({
      history: chatHistory,
    });

    // Send message
    const result = await chat.sendMessage(message);
    const response = result.response;
    const text = response.text();

    return NextResponse.json({ 
      response: text,
      context: {
        peopleCount: context.people.length,
        alertsCount: context.alerts.length,
        ticketsCount: context.tickets.length,
        machinesCount: context.machines.length,
      }
    });

  } catch (error: any) {
    console.error('Chat API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process chat message' 
    }, { status: 500 });
  }
}
