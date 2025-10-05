# SiteOps - Supabase Setup Guide

This guide will walk you through setting up Supabase for the SiteOps platform.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in:
   - **Name**: `siteops-platform`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your location
4. Click "Create new project" and wait ~2 minutes

## 2. Run Database Schema

1. In your Supabase project dashboard, go to **SQL Editor**
2. Click "New Query"
3. Copy the entire contents of `supabase_schema.sql`
4. Paste into the SQL editor
5. Click **Run** (or press Cmd+Enter / Ctrl+Enter)
6. Verify success - you should see "Success. No rows returned"

This creates all tables:
- ✅ Sites
- ✅ People (workforce)
- ✅ Machines/Vehicles
- ✅ Cameras
- ✅ Tickets (Initiatives, Epics, Tasks)
- ✅ Alerts/Events
- ✅ Audit log
- ✅ Sample seed data

## 3. Get API Keys

1. Go to **Settings** → **API**
2. Copy these values:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon public** key: `eyJhbG...` (long string)
   - **service_role** key: `eyJhbG...` (different long string)

## 4. Configure Environment

1. In your project root, create `.env` file:
```bash
cp env.example .env
```

2. Edit `.env` and add your keys:
```env
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-key-here
SUPABASE_SERVICE_KEY=your-service-role-key-here
DEFAULT_SITE_ID=copy-site-id-from-step-5
```

## 5. Get Your Site ID

1. In Supabase dashboard, go to **Table Editor** → **sites**
2. You should see "Demo Construction Site" created by seed data
3. Copy the `id` column value (UUID format: `12345678-1234-...`)
4. Paste it as `DEFAULT_SITE_ID` in your `.env` file

## 6. Install Dependencies

```bash
# Activate virtual environment
source .venv/bin/activate

# Install new dependencies
pip install supabase python-dotenv
```

## 7. Test Connection

Run the CV system:
```bash
python -m src.main --expected-people 2
```

You should see:
```
✓ Supabase connected
Headcount monitoring enabled: expecting 2 people (5-minute intervals)
```

## 8. Verify Data Flow

### Check Alerts

1. Let the CV system run and detect some events
2. In Supabase dashboard, go to **Table Editor** → **alerts**
3. You should see new rows appearing with:
   - `type`: `ProximityWarning`, `PersonDown`, or `HeadcountMismatch`
   - `site_id`: Your site UUID
   - `created_at`: Recent timestamp

### Check People

1. Go to **Table Editor** → **people**
2. You should see:
   - "John Doe" (Foreman, status: Working)
   - "Jane Smith" (Worker, status: Working)

### Check Machines

1. Go to **Table Editor** → **machines**
2. You should see:
   - "Excavator #1" (type: excavator, status: Active)

## 9. Row Level Security (RLS) - Production

For production, enable RLS:

```sql
-- Enable RLS on all tables
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Example policy: Users can only see their site's data
CREATE POLICY "Users can view own site" ON sites
  FOR SELECT
  USING (auth.jwt() ->> 'site_id' = id::text);

CREATE POLICY "Users can view own site people" ON people
  FOR SELECT
  USING (site_id IN (
    SELECT id FROM sites WHERE auth.jwt() ->> 'site_id' = id::text
  ));
```

## 10. Real-time Subscriptions (Optional)

Enable real-time updates for alerts:

1. Go to **Database** → **Replication**
2. Under "supabase_realtime", enable replication for:
   - ✅ alerts
   - ✅ tickets
   - ✅ ticket_comments

This allows the web UI to receive live updates!

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CV System (Python)                       │
│  ┌──────────┐  ┌─────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Camera   │→ │ Detection│→│ Tracking │→│ Headcount│   │
│  │ Pipeline │  │ (YOLO)   │ │(ByteTrack)│ │ Monitor  │   │
│  └──────────┘  └─────────┘  └──────────┘  └──────────┘   │
│         │             │             │             │         │
│         └─────────────┴─────────────┴─────────────┘         │
│                       │                                      │
│                ┌──────▼───────┐                             │
│                │ Alert Manager│                             │
│                └──────┬───────┘                             │
│                       │                                      │
│                       │ Push events                          │
│                       ▼                                      │
│              ┌─────────────────┐                            │
│              │ Supabase Client │                            │
│              └────────┬────────┘                            │
└───────────────────────┼─────────────────────────────────────┘
                        │
                        │ HTTPS / PostgreSQL
                        ▼
              ┌──────────────────┐
              │    SUPABASE      │
              │                  │
              │  ┌────────────┐  │
              │  │ PostgreSQL │  │
              │  ├────────────┤  │
              │  │ Auth       │  │
              │  ├────────────┤  │
              │  │ Storage    │  │
              │  ├────────────┤  │
              │  │ Realtime   │  │
              │  └────────────┘  │
              └────────┬─────────┘
                       │
                       │ REST API / WebSocket
                       ▼
              ┌──────────────────┐
              │   Web Frontend   │
              │  (React/Next.js) │
              │                  │
              │  - Alerts Feed   │
              │  - People Dir    │
              │  - Ticketing     │
              │  - Dashboard     │
              └──────────────────┘
```

## Troubleshooting

### "Supabase not configured"
- Check `.env` file exists
- Verify `SUPABASE_URL` and `SUPABASE_KEY` are set
- Restart the Python app

### "Failed to connect to Supabase"
- Check your internet connection
- Verify the URL is correct (no trailing slash)
- Check the API key hasn't expired

### "No data showing in tables"
- Verify the CV system is running
- Check console for error messages
- Go to Supabase Dashboard → Logs → Postgres Logs

### Permission errors
- Make sure you're using the `service_role` key for server-side operations
- For client-side (web UI), use the `anon` key with RLS policies

## Next Steps

1. **Build Web Frontend**: React/Next.js app that:
   - Displays live alerts feed
   - Shows people directory
   - Manages tickets
   - Real-time updates via Supabase subscriptions

2. **Add Authentication**: 
   - Supabase Auth for user login
   - Role-based access (Admin, PM, HSE, Worker)

3. **Mobile App**:
   - React Native with Supabase client
   - Push notifications for critical alerts

4. **Advanced Features**:
   - File uploads (method statements, photos) to Supabase Storage
   - PDF generation for reports
   - Shift scheduling & rostering
   - Cost tracking integration
