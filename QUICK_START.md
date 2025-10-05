# SiteOps MVP - Quick Start Guide

## 🚀 Your Complete Safety Monitoring System is Ready!

### ✅ What's Built

1. **Python CV System** - Real-time ML-powered safety detection
2. **Supabase Database** - PostgreSQL backend with all tables
3. **Next.js Web App** - Beautiful dashboard with full CRUD operations
4. **Live Camera Page** - Webcam integration with safety monitoring

---

## 🌐 Access Your Apps

### **Web Dashboard** (Already Running)
```
http://localhost:3001
```

### **Pages Available:**

- **Dashboard** (`/`) - Site overview with real-time stats
- **Camera** (`/camera`) - Live webcam feed with CV detection
- **People** (`/people`) - Manage workers (**+ Add Person** button)
- **Machines** (`/machines`) - Track equipment (**+ Add Machine** button)
- **Alerts** (`/alerts`) - View all safety events
- **Tickets** (`/tickets`) - Task management (**+ Create Ticket** button)

---

## 🧪 Testing the Full System

### Step 1: Run Python CV System
```bash
cd /Users/rajvratzoom/Desktop/Projects/siteops2
source .venv/bin/activate
python -m src.main --expected-people 2
```

**This will:**
- ✅ Open your webcam
- ✅ Detect people & vehicles (YOLO)
- ✅ Estimate depth (MiDaS)
- ✅ Track objects with IDs
- ✅ Detect proximity warnings (400px threshold)
- ✅ Detect falls (press `F` to test)
- ✅ Monitor headcount every 5 minutes
- ✅ Write alerts directly to Supabase

### Step 2: View in Web Dashboard
1. Open `http://localhost:3001`
2. Go to **Alerts** tab
3. Refresh to see new alerts from CV system

### Step 3: Test Camera Page
1. Go to `http://localhost:3001/camera`
2. Click **"Start Camera"** to access webcam
3. See simulated detection stats

---

## ➕ Adding Data

### Add a New Person
1. Go to **People** tab
2. Click **"Add Person"** button
3. Fill in details:
   - Name (required)
   - Role, Trade, Company
   - Phone, Email
   - Status: **Working** / On-Break / Off-Site / Sick-Leave
4. Click **"Add Person"**

**Note:** People with status "Working" count toward expected active headcount

### Add a New Machine
1. Go to **Machines** tab
2. Click **"Add Machine"** button
3. Fill in details:
   - Label (e.g., "Excavator #1")
   - Type: Truck / Excavator / Forklift / etc.
   - Asset Tag, Owner Company
   - Status: **Active** / Idle / Off-Site / Maintenance
4. Click **"Add Machine"**

### Create a New Ticket
1. Go to **Tickets** tab
2. Click **"Create Ticket"** button
3. Fill in details:
   - Type: Initiative / Epic / Task
   - Title, Description
   - Priority: Low / Medium / High / Critical
   - Status, Phase, Discipline
4. Click **"Create Ticket"**

---

## 🔑 Key Features

### Proximity Detection
- Detects when person is within **400 pixels** of a vehicle
- Must persist for **≥ 2 seconds** to trigger alert
- Writes `ProximityWarning` event to database

### Fall Detection
- Heuristic-based (aspect ratio < 1.5)
- Press `F` hotkey to simulate
- Writes `PersonDown` event to database
- **Red bounding box** appears on fallen person

### Headcount Monitoring
- Checks every **5 minutes**
- Compares detected count (mode) vs. expected active workers
- Writes `HeadcountMismatch` alert if different
- Configure in **People** tab (set status to "Working")

### Hotkeys (CV System)
- `V` - Toggle fake vehicle for testing
- `F` - Simulate person fall
- `R` - Toggle video recording
- `Q` - Quit

---

## 📊 Database Structure

All data is stored in **Supabase PostgreSQL**:

| Table | Purpose |
|-------|---------|
| `sites` | Site configuration & thresholds |
| `people` | Workers with status & contact info |
| `machines` | Vehicles with type, status, location |
| `alerts` | Safety events (Proximity, Fall, Headcount) |
| `tickets` | Tasks, Epics, Initiatives |
| `cameras` | Camera metadata (future) |
| `ticket_comments` | Ticket discussions (future) |

---

## 🎯 Example Workflow

### Scenario: New Worker Arrives

1. **Add Person** via web dashboard
   - Name: "John Doe"
   - Role: "Worker"
   - Company: "BuildCo"
   - Status: **"Working"** (counts toward headcount)

2. **Run CV System**
   ```bash
   python -m src.main --expected-people 3  # Now expecting 3 people
   ```

3. **CV System Monitors:**
   - Detects John via webcam
   - Tracks with persistent ID
   - Checks if he gets too close to vehicles
   - Verifies headcount every 5 minutes

4. **View Alerts** in web dashboard
   - Proximity warnings appear in real-time
   - Headcount mismatches trigger alerts

5. **Create Ticket** from alert
   - Go to Tickets tab
   - Create task: "Review proximity incident"
   - Assign, prioritize, track completion

---

## 🔧 Troubleshooting

### Web App Not Loading
```bash
# Make sure dev server is running on port 3001
cd web && npm run dev
```

### Database Errors
- Check `.env.local` has correct Supabase credentials
- Verify `supabase_schema.sql` was run in Supabase SQL editor

### Camera Not Working
- Grant browser camera permissions
- Check if webcam is being used by another app
- For Python CV system, ensure camera index is correct (usually 0)

### CV System Not Detecting
```bash
# Lower confidence threshold
python -m src.main --expected-people 2
# (Already set to 0.01 for ultra-sensitive detection)
```

---

## 📈 Next Steps

### Immediate Enhancements
- [ ] Integrate TensorFlow.js for browser-based ML
- [ ] Add real-time WebSocket updates (Supabase Realtime)
- [ ] User authentication & role-based access
- [ ] Ticket creation from alerts (one-click)
- [ ] Advanced filtering & search
- [ ] Charts & analytics
- [ ] Export/reporting functionality

### Production Deployment
- [ ] Deploy Next.js to **Vercel** (zero-config)
- [ ] Host Python CV system on cloud VM
- [ ] Set up multiple camera streams
- [ ] Configure email/SMS notifications
- [ ] Add camera calibration for accurate distance

---

## 📞 Support

For issues or questions:
1. Check browser console for errors
2. Check terminal output for Python errors
3. Verify Supabase connection in `.env.local`
4. Ensure all dependencies installed (`pip install -r requirements.txt`, `npm install`)

---

**🎉 You're all set! Happy monitoring!**

```bash
# Quick commands to remember:
cd /Users/rajvratzoom/Desktop/Projects/siteops2
source .venv/bin/activate
python -m src.main --expected-people 2

# Open web dashboard:
# http://localhost:3001
```
