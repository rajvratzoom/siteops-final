# Gemini AI Assistant Setup Guide

The SiteOps platform now includes an AI-powered chatbot that can answer questions about your construction site using RAG (Retrieval-Augmented Generation).

## Features

✅ **Floating Chat Widget** - Always accessible on all pages (bottom-right corner)  
✅ **Dedicated Chat Page** - Full-screen chat experience at `/chat`  
✅ **RAG Context** - Fetches relevant data from Supabase based on your query  
✅ **Real-time Data** - Access to people, alerts, tickets, and machines  
✅ **Smart Queries** - Ask natural language questions like:
  - "Who is active on the worksite now?"
  - "What is Lara doing now?"
  - "List all high priority tickets"
  - "Any recent safety alerts?"
  - "Show me all active machines"

## Setup Instructions

### 1. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Get API Key"** or **"Create API Key"**
4. Copy the API key (starts with `AIza...`)

### 2. Add to Environment Variables

Add the following line to your `web/.env.local` file:

```env
GEMINI_API_KEY=your-api-key-here
```

Your complete `.env.local` should look like:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
NEXT_PUBLIC_DEFAULT_SITE_ID=your-site-uuid-here
GEMINI_API_KEY=your-gemini-api-key-here
```

### 3. Restart the Dev Server

```bash
cd web
# Kill existing server
pkill -f "next dev"

# Restart
npm run dev
```

### 4. Test the Assistant

**Option 1: Floating Widget**
- Open any page in the web app
- Look for the blue chat icon in the bottom-right corner
- Click to open the chat widget
- Try asking: "Who is active on site?"

**Option 2: Full Chat Page**
- Navigate to `/chat` or click "AI Assistant" in the sidebar
- Use the suggested queries or type your own question

## How It Works

### RAG (Retrieval-Augmented Generation)

The chatbot uses RAG to provide accurate, up-to-date answers:

1. **User asks a question** → "Who is active on the worksite?"
2. **Context Fetching** → System queries Supabase for relevant data (people, alerts, tickets, machines)
3. **Prompt Building** → Combines user question + fetched data into a system prompt
4. **Gemini Response** → Gemini generates an answer based on the real data
5. **User receives answer** → "Currently, there are 3 active workers: John Doe (Foreman), Jane Smith (Worker)..."

### Smart Context Detection

The system automatically fetches relevant data based on keywords in your query:

| Keywords | Data Fetched |
|----------|--------------|
| people, worker, active, who | People/Workforce data |
| alert, warning, incident, safety | Recent alerts |
| ticket, task, priority, epic | Tickets and tasks |
| machine, equipment, vehicle | Machines/Equipment |

### Example Queries

**People & Workforce:**
- "Who is currently working on site?"
- "What is John's status?"
- "How many workers are active?"
- "List all foremen"

**Safety & Alerts:**
- "Any recent safety incidents?"
- "Show me proximity warnings from today"
- "What alerts do we have?"

**Tickets & Tasks:**
- "List all high priority tickets"
- "What tasks are overdue?"
- "Show me open epics"
- "Any critical issues?"

**Equipment:**
- "What machines are active?"
- "Show me all excavators"
- "Which equipment needs maintenance?"

**General:**
- "Give me a site summary"
- "What's happening on site right now?"
- "Any issues I should know about?"

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Query                           │
│              "Who is active on site?"                   │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              API Route (/api/chat)                      │
│  1. Parse query for keywords                            │
│  2. Fetch relevant context from Supabase                │
│  3. Build system prompt with data                       │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  Supabase Database                      │
│  • People (status, role, assignments)                   │
│  • Alerts (type, timestamp, details)                    │
│  • Tickets (priority, status, type)                     │
│  • Machines (type, status, location)                    │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Gemini 1.5 Flash                           │
│  • Receives system prompt + user query                  │
│  • Generates contextual response                        │
│  • Returns formatted answer                             │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                    User Interface                       │
│  • Chat Widget (floating)                               │
│  • Chat Page (full-screen)                              │
│  • Real-time message display                            │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### POST /api/chat

**Request:**
```json
{
  "message": "Who is active on site?",
  "history": [
    { "role": "user", "content": "Previous message" },
    { "role": "assistant", "content": "Previous response" }
  ]
}
```

**Response:**
```json
{
  "response": "Currently, there are 3 active workers: John Doe (Foreman - Working), Jane Smith (Worker - Working), Bob Johnson (Engineer - Working).",
  "context": {
    "peopleCount": 3,
    "alertsCount": 0,
    "ticketsCount": 5,
    "machinesCount": 2
  }
}
```

## Customization

### Modify System Prompt

Edit `/web/src/app/api/chat/route.ts` → `buildSystemPrompt()` function to customize the AI's personality and behavior.

### Add More Context

Edit `/web/src/app/api/chat/route.ts` → `fetchContext()` function to add more data sources (e.g., weather, schedules, permits).

### Change Model

Replace `gemini-1.5-flash` with `gemini-1.5-pro` for better quality (slower, more expensive):

```typescript
const model = genAI.getGenerativeModel({ 
  model: 'gemini-1.5-pro',
  systemInstruction: systemPrompt,
});
```

## Troubleshooting

### "Gemini API key not configured"

- Make sure `GEMINI_API_KEY` is in your `.env.local` file
- Restart the dev server after adding the key
- Check that the key starts with `AIza`

### "Failed to process chat message"

- Check your internet connection
- Verify the API key is valid (not expired)
- Check the browser console for detailed error messages

### Slow responses

- Gemini 1.5 Flash is optimized for speed
- If still slow, check your internet connection
- Consider caching common queries

### Inaccurate responses

- Make sure your Supabase data is up-to-date
- Check that the Site ID is correctly configured
- Review the context being fetched in the API logs

## Future Enhancements

- [ ] Chat history persistence to Supabase
- [ ] Voice input/output
- [ ] Image analysis (upload site photos)
- [ ] Proactive alerts ("I noticed 3 high-priority tickets...")
- [ ] Multi-language support
- [ ] Integration with ticketing (create tickets via chat)
- [ ] Calendar integration (schedule tasks via chat)

## Cost Considerations

**Gemini 1.5 Flash Pricing** (as of 2024):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- Free tier: 15 requests per minute

**Typical Usage:**
- Average query: ~500 input tokens + ~200 output tokens
- Cost per query: ~$0.0001 (very cheap!)
- 10,000 queries/month: ~$1

## Security Notes

- Never commit your `GEMINI_API_KEY` to version control
- Use environment variables for all sensitive keys
- Consider rate limiting in production
- Implement user authentication before deploying

---

**Status**: ✅ Fully Functional  
**Model**: Gemini 1.5 Flash  
**Features**: RAG, Real-time Data, Floating Widget, Full Chat Page
