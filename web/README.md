# SiteOps Safety MVP - Web Dashboard

A Next.js 14 web application for managing construction site safety monitoring powered by ML-based computer vision.

## Features

### Core Pages

- **Dashboard** - Site overview with real-time stats, active people/machines, and recent alerts
- **People** - Manage workers, track active status, and configure expected headcount for monitoring
- **Machines** - Track vehicles and heavy equipment on site
- **Alerts** - View all safety events (Proximity Warnings, Person Down, Headcount Mismatch)
- **Tickets** - Manage safety tasks, initiatives, and epics

## Tech Stack

- **Next.js 14** - React framework with App Router and Server Components
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Beautiful, accessible UI components
- **Supabase** - PostgreSQL database with real-time capabilities
- **date-fns** - Date formatting and manipulation

## Setup

### Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Populated database (run `supabase_schema.sql` in your Supabase SQL editor)

### Environment Variables

Create a `.env.local` file in the `web/` directory:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_DEFAULT_SITE_ID=your_site_uuid_here
```

### Installation

```bash
cd web
npm install
npm run dev
```

The app will be available at **http://localhost:3000**

## Project Structure

```
web/
├── src/
│   ├── app/                 # Next.js 14 App Router pages
│   │   ├── page.tsx         # Dashboard
│   │   ├── people/          # People management
│   │   ├── machines/        # Machines tracking
│   │   ├── alerts/          # Alerts listing
│   │   └── tickets/         # Tickets management
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   └── nav.tsx          # Main navigation
│   ├── lib/
│   │   ├── supabase.ts      # Supabase client
│   │   └── utils.ts         # Utility functions
│   └── types/
│       └── database.ts      # TypeScript types for DB models
├── public/                  # Static assets
└── package.json
```

## Integration with CV System

The web app reads data from the same Supabase database that the Python CV system writes to:

1. **Run the CV system** (from project root):
   ```bash
   python -m src.main --expected-people 2
   ```

2. **Open the web dashboard**:
   ```
   http://localhost:3000
   ```

3. **Watch real-time updates**:
   - Alerts appear as they're detected
   - People and machine tracking updates
   - Headcount monitoring every 5 minutes

## Key Features

### Headcount Monitoring

The CV system checks every 5 minutes if the detected number of people matches the "Expected Active On Site" count from the People tab. Configure this by marking workers as expected active.

### Alert Types

- **Proximity Warning** - Person too close to vehicle (< 400px for > 2s)
- **Person Down** - Fall detection triggered
- **Headcount Mismatch** - Detected count ≠ expected count

### Database Integration

All data is stored in Supabase PostgreSQL:
- **sites** - Site configuration
- **people** - Workers and personnel
- **machines** - Vehicles and equipment
- **alerts** - Safety events from CV system
- **tickets** - Safety tasks and initiatives

## Development

### Adding New Features

1. Create new pages in `src/app/[feature]/page.tsx`
2. Add navigation items to `src/components/nav.tsx`
3. Define types in `src/types/database.ts`
4. Use Supabase client from `src/lib/supabase.ts`

### Building for Production

```bash
npm run build
npm start
```

### Deployment

Deploy to **Vercel** (recommended for Next.js):

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Make sure to add environment variables in Vercel project settings.

## Future Enhancements

- Real-time subscriptions for live updates (Supabase Realtime)
- User authentication and role-based access
- Ticket creation from alerts (one-click)
- Advanced filtering and search
- Charts and analytics dashboard
- Mobile-responsive improvements
- Export/reporting functionality

## License

MIT

## Support

For issues or questions, contact the development team.