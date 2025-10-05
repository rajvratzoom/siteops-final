import { GoogleGenerativeAI } from '@google/generative-ai';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const DEFAULT_SITE_ID = process.env.NEXT_PUBLIC_DEFAULT_SITE_ID!;

// Fetch comprehensive site data
async function fetchSiteData() {
  const [people, alerts, tickets, machines] = await Promise.all([
    supabase.from('people').select('*').eq('site_id', DEFAULT_SITE_ID),
    supabase.from('alerts').select('*').eq('site_id', DEFAULT_SITE_ID).order('created_at', { ascending: false }).limit(50),
    supabase.from('tickets').select('*').eq('site_id', DEFAULT_SITE_ID).order('created_at', { ascending: false }),
    supabase.from('machines').select('*').eq('site_id', DEFAULT_SITE_ID),
  ]);

  return {
    people: people.data || [],
    alerts: alerts.data || [],
    tickets: tickets.data || [],
    machines: machines.data || [],
  };
}

// Build comprehensive system prompt for site analysis
function buildAgentPrompt(data: any) {
  const alertsByType = data.alerts.reduce((acc: any, alert: any) => {
    acc[alert.type] = (acc[alert.type] || 0) + 1;
    return acc;
  }, {});

  const ticketsByStatus = data.tickets.reduce((acc: any, ticket: any) => {
    acc[ticket.status] = (acc[ticket.status] || 0) + 1;
    return acc;
  }, {});

  const ticketsByPriority = data.tickets.reduce((acc: any, ticket: any) => {
    acc[ticket.priority || 'Normal'] = (acc[ticket.priority || 'Normal'] || 0) + 1;
    return acc;
  }, {});

  return `You are the SiteOps Site Agent, an AI monitoring system for construction site safety and operations.

CURRENT SITE DATA:

**Workforce (${data.people.length} people):**
${data.people.map((p: any) => `- ${p.name} (${p.role || 'Worker'}) - Status: ${p.status || 'Unknown'}`).join('\n')}

**Safety Alerts (${data.alerts.length} total):**
Alert Breakdown:
${Object.entries(alertsByType).map(([type, count]) => `- ${type}: ${count}`).join('\n')}

Recent Alerts:
${data.alerts.slice(0, 10).map((a: any) => `- ${a.type} at ${new Date(a.created_at).toLocaleString()}`).join('\n')}

**Tickets (${data.tickets.length} total):**
By Status:
${Object.entries(ticketsByStatus).map(([status, count]) => `- ${status}: ${count}`).join('\n')}

By Priority:
${Object.entries(ticketsByPriority).map(([priority, count]) => `- ${priority}: ${count}`).join('\n')}

Recent Tickets:
${data.tickets.slice(0, 10).map((t: any) => `- [${t.priority || 'Normal'}] ${t.title} (${t.status})`).join('\n')}

**Equipment (${data.machines.length} machines):**
${data.machines.map((m: any) => `- ${m.name} (${m.type || 'Equipment'}) - Status: ${m.status || 'Unknown'}`).join('\n')}

YOUR TASK:
Analyze the current site status and provide:

1. **Overall Site Status** - Brief summary of current operations
2. **Safety Concerns** - Any patterns or issues in alerts
3. **Workforce Status** - Worker availability and status
4. **Priority Actions** - Top 3-5 actions that should be taken
5. **Recommended Tickets** - Suggest 2-3 new tickets if needed (with title, description, priority)

Format your response clearly with sections. Be concise but actionable.`;
}

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: 'Gemini API key not configured' 
      }, { status: 500 });
    }

    // Fetch all site data
    const siteData = await fetchSiteData();

    if (action === 'analyze') {
      // Generate AI analysis
      const prompt = buildAgentPrompt(siteData);
      const model = genAI.getGenerativeModel({ 
        model: 'gemini-2.5-flash',
      });

      const result = await model.generateContent(prompt);
      const response = result.response;
      const analysis = response.text();

      return NextResponse.json({ 
        analysis,
        data: siteData,
        timestamp: new Date().toISOString(),
      });
    }

    // Return raw data for dashboard
    return NextResponse.json({ 
      data: siteData,
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error('Site Agent API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to process site agent request' 
    }, { status: 500 });
  }
}
