# Latest Features - SiteOps MVP

## 🆕 New Features Implemented

### 1️⃣ **Alert Acknowledgement System**

**Location:** Alerts Page (`/alerts`)

**Features:**
- ✅ **Acknowledge Button** - Click to dismiss alerts
- 🔄 **Auto-refresh** - Page updates after acknowledgement
- 👁️ **Only shows unacknowledged** alerts by default
- 📊 **Stats updated** - Unacknowledged count decreases
- 💾 **Saves to database** - Marks `acknowledged = true` with timestamp

**How to Use:**
1. Go to `/alerts`
2. See pending alerts with blue "Acknowledge" button
3. Click button to dismiss
4. Alert disappears from main view (still in database)

---

### 2️⃣ **Screenshot Capture at Breach Moment**

**Location:** Camera Page (`/camera`)

**How It Works:**
1. **Real-time detection** - TensorFlow.js detects people & vehicles
2. **Distance calculation** - Measures pixel distance between centers
3. **Threshold check** - When distance ≤ 400px:
   - 🔴 **Red line drawn** immediately
   - 📸 **Screenshot captured** at exact moment
   - 📤 **Uploads to Supabase Storage**
   - 💾 **Saves alert to database** with screenshot URL

**Technical Details:**
```javascript
// Capture happens IMMEDIATELY when breach detected
if (distance <= PROXIMITY_THRESHOLD) {
  const screenshot = await captureScreenshot(); // Captures current frame
  const url = await uploadScreenshot(screenshot);
  await saveAlertToDatabase(type, title, details, url);
}
```

**Screenshot Includes:**
- ✅ Video frame at breach moment
- ✅ Green boxes around people
- ✅ Blue boxes around vehicles
- ✅ Red proximity line with distance label
- ✅ Warning circle around person

---

### 3️⃣ **Multiple Ticket Views**

**Location:** Tickets Page (`/tickets`)

**Three View Modes:**

#### 📋 **List View** (Default)
- Traditional table layout
- Columns: Type, Title, Priority, Status, Created, Due Date
- Best for: Detailed overview, sorting, filtering

#### 📊 **Board View** (Kanban)
- 4 columns: Backlog, In Progress, Blocked, Done
- Card-based layout
- Shows: Type badge, priority, title, description, dates
- Best for: Visual workflow, status management

#### ⏱️ **Timeline View**
- Chronological display (newest first)
- Vertical timeline with dots
- Shows full details: phase, discipline, dates
- Best for: Project history, audit trail

**How to Switch:**
- Click view toggle buttons at top-right
- Views instantly update
- Selection persists during session

---

## 📸 Alert Screenshot Features

### **Automatic Capture Triggers:**

1. **Proximity Warning**
   - Person within 400px of vehicle
   - Captures: Person + vehicle with red line
   - Title: "Proximity Warning: Person near [vehicle type]"

2. **Headcount Mismatch** (every N minutes)
   - Mode count ≠ current count
   - Captures: Full camera view with all detections
   - Title: "Headcount Alert: Detected [N] people"

### **Screenshot Storage:**
- **Bucket:** `alert-screenshots` (Supabase Storage)
- **Format:** JPEG (90% quality)
- **Naming:** `alert_[timestamp]_[random].jpg`
- **Access:** Public URLs for easy viewing

### **Display on Alerts Page:**
- Thumbnail (96x64px) in table
- Click to open full image in new tab
- Hover for zoom effect (1.5x scale)
- Shows "No image" if screenshot failed

---

## 🎯 Complete Alert Workflow

### **1. Detection → Screenshot → Database**

```
Camera detects breach
  ↓
Captures screenshot (video + overlays)
  ↓
Uploads to Supabase Storage
  ↓
Saves alert to database:
  - type: "ProximityWarning"
  - severity: "High"
  - metadata: { distance_px, vehicle_type, confidence }
  - snapshot_url: "https://..."
  - created_at: timestamp
  - acknowledged: false
```

### **2. View → Acknowledge → Dismiss**

```
User opens Alerts page
  ↓
Sees alert with screenshot thumbnail
  ↓
Clicks "Acknowledge" button
  ↓
Database updated:
  - acknowledged: true
  - acknowledged_at: timestamp
  ↓
Alert disappears from main view
```

---

## 📊 Ticket View Comparison

| Feature | List View | Board View | Timeline View |
|---------|-----------|------------|---------------|
| **Layout** | Table | Kanban | Chronological |
| **Sorting** | ✅ | ❌ | ✅ (by date) |
| **Grouping** | ❌ | ✅ (by status) | ❌ |
| **Detail Level** | High | Medium | High |
| **Best For** | Data analysis | Workflow | History |
| **Mobile** | Poor | Good | Good |

---

## 🚀 Usage Examples

### **Test Alert System:**

1. **Open Camera:** `http://localhost:3001/camera`
2. **Set interval:** 1 minute (for quick testing)
3. **Start camera** and step into frame
4. **Show phone** (may detect as vehicle)
5. **Move close** - Red line + alert triggered
6. **Go to Alerts:** See your alert with screenshot
7. **Click Acknowledge** - Alert disappears

### **Test Ticket Views:**

1. **Create tickets:** Add 5-10 test tickets with different statuses
2. **List View:** See all tickets in table
3. **Board View:** Drag & drop workflow (visual)
4. **Timeline View:** See chronological history

---

## 🔧 Configuration

### **Monitoring Interval:**
- Default: 5 minutes
- Range: 1-60 minutes
- Location: Camera page top card
- Updates headcount check frequency

### **Proximity Threshold:**
- Current: 400 pixels
- Hardcoded in: `web/src/app/camera/page.tsx`
- To change: Edit `PROXIMITY_THRESHOLD` constant

### **Alert Cooldown:**
- Current: 10 seconds
- Prevents duplicate alerts
- Separate cooldown per alert type

---

## 📝 Database Schema

### **Alerts Table:**
```sql
alerts (
  id UUID,
  type TEXT,                    -- ProximityWarning, HeadcountMismatch
  severity TEXT,                -- Low, Medium, High, Critical
  metadata JSONB,               -- { distance_px, vehicle_type, etc }
  snapshot_url TEXT,            -- Screenshot URL
  acknowledged BOOLEAN,         -- True after acknowledgement
  acknowledged_at TIMESTAMPTZ,  -- When acknowledged
  created_at TIMESTAMPTZ        -- When alert created
)
```

### **Storage Bucket:**
```
alert-screenshots/
  ├── alert_1704826800000_abc123.jpg
  ├── alert_1704826900000_def456.jpg
  └── ...
```

---

## 🎨 UI Enhancements

### **Alerts Page:**
- Screenshot thumbnails in table
- Acknowledge button (blue)
- Auto-hides acknowledged alerts
- Hover zoom on images
- Click to open full size

### **Camera Page:**
- Monitoring interval input box
- Real-time detection counters
- Recent alerts sidebar
- Visual overlays (boxes, lines, labels)

### **Tickets Page:**
- View mode toggle (3 buttons)
- Stats cards (4 metrics)
- Responsive layouts
- Color-coded priorities
- Status badges

---

## 🐛 Troubleshooting

### **Screenshots Not Appearing?**
1. Check Supabase Storage bucket exists: `alert-screenshots`
2. Verify bucket is **public**
3. Check browser console for upload errors
4. Ensure `.env.local` has correct credentials

### **Alerts Not Dismissing?**
1. Check browser console for errors
2. Verify database connection
3. Refresh page manually
4. Check `acknowledged` column in database

### **Ticket Views Not Switching?**
1. Ensure JavaScript is enabled
2. Check browser console
3. Verify data is loading
4. Try hard refresh (Cmd+Shift+R)

---

## 📈 Future Enhancements

- [ ] Batch acknowledge multiple alerts
- [ ] Filter alerts by type/severity
- [ ] Export alerts to CSV/PDF
- [ ] Drag-and-drop in Board view
- [ ] Ticket assignment
- [ ] Comment threads on tickets
- [ ] Real-time WebSocket updates

---

**🎉 All systems ready! Test it now at `http://localhost:3001`**
