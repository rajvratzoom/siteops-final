# SiteOps Safety MVP - ML-Powered Construction Safety Monitoring

A real-time ML system for construction site safety that detects people and heavy machinery, estimates depth, tracks objects, and raises proximity warnings when workers stay too close to equipment for extended periods.

## Features

### Core Capabilities (MVP)

- **Live Camera Pipeline**: OpenCV-based capture at 720p, ~20 FPS
- **Object Detection**: YOLOv8 detects people and vehicles (trucks, cars, buses, etc.)
- **Monocular Depth Estimation**: MiDaS or ZoeDepth for relative depth mapping
- **Multi-Object Tracking**: ByteTrack provides stable IDs across frames
- **Proximity Analysis**: Pixel-based distance calculation with time-based warnings (400px threshold)
- **Headcount Monitoring**: Automatic detection of unauthorized personnel (checks every 5 minutes)
- **Fall Detection Demo**: Simple heuristic-based fall detection (aspect ratio)
- **Real-time Alerts**: Visual overlays + console logs + NDJSON logging
- **WebSocket Events**: Live event streaming via FastAPI for future UI integration
- **Vehicle Registry**: Track known vehicles and match detections

### Event Types

1. **ProximityWarning**: Person stays within 400 pixels of vehicle for ≥2s
2. **PersonDown**: Fall detection triggered (demo mode)
3. **HeadcountMismatch**: Detected people count doesn't match expected active workers (checked every 5 minutes)

## Architecture

```
siteops_safety_mvp/
├── src/
│   ├── config.py        # Configuration management
│   ├── camera.py        # OpenCV video capture
│   ├── detection.py     # YOLO object detection
│   ├── depth.py         # Depth estimation (MiDaS/ZoeDepth)
│   ├── tracking.py      # Multi-object tracking (ByteTrack)
│   ├── proximity.py     # Proximity analysis & warnings
│   ├── headcount.py     # Headcount monitoring & mismatch detection
│   ├── alerts.py        # Alert management & NDJSON logging
│   ├── overlay.py       # Visualization rendering
│   ├── registry.py      # Vehicle registry management
│   ├── server.py        # FastAPI + WebSocket server
│   └── main.py          # CLI entry point
├── config/
│   ├── settings.yaml    # Application settings
│   └── calibration.json # Camera calibration (optional)
├── data/
│   └── vehicles.json    # Vehicle registry
├── logs/
│   └── events.ndjson    # Event log (created on run)
└── tests/
    ├── test_proximity_score.py
    └── test_event_debounce.py
```

## Installation

### Prerequisites

- Python 3.9+
- macOS, Linux, or Windows
- Webcam or video file
- (Optional) CUDA-capable GPU for faster inference

### Setup

1. **Clone/Navigate to project directory**:
   ```bash
   cd /path/to/siteops2
   ```

2. **Create virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

   This will install:
   - YOLOv8 (ultralytics)
   - MiDaS depth estimation
   - ByteTrack tracking (via supervision)
   - FastAPI + WebSocket server
   - Rich CLI, Typer, Pydantic

4. **First run** (downloads models):
   ```bash
   python -m src.main
   ```

   On first run, models will be downloaded automatically:
   - YOLOv8n (~6MB)
   - MiDaS small (~20MB)

## Usage

### Basic Commands

**Run with default webcam**:
```bash
python -m src.main
```

**Run with specific camera**:
```bash
python -m src.main --video-source 1
```

**Run with video file**:
```bash
python -m src.main --video-source path/to/video.mp4
```

**Enable fall detection demo**:
```bash
python -m src.main --demo-fall
```

**Enable headcount monitoring** (e.g., expecting 5 workers):
```bash
python -m src.main --expected-people 5
```

**Use GPU (if available)**:
```bash
python -m src.main --device cuda
```

**Use ZoeDepth (better accuracy)**:
```bash
python -m src.main --depth zoe
```

### Interactive Hotkeys

While the application is running, press:

| Key | Action |
|-----|--------|
| `V` | Toggle fake vehicle bbox (for testing proximity logic) |
| `F` | Simulate fall detection |
| `R` | Start/stop recording to `logs/run_YYYYMMDD_HHMM.avi` |
| `Q` or `ESC` | Quit application |

### WebSocket Event Streaming

**Start the FastAPI server** (in a separate terminal):
```bash
source .venv/bin/activate
uvicorn src.server:app --host 0.0.0.0 --port 8000
```

**Connect to WebSocket**:
```bash
# Test with websocat (install: brew install websocat)
websocat ws://localhost:8000/events

# Or use JavaScript:
const ws = new WebSocket('ws://localhost:8000/events');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Event:', data);
};
```

**API Endpoints**:
- `GET /healthz` - Health check
- `GET /status` - Server status
- `WS /events` - Event stream (WebSocket)

### Event Log

All events are logged to `logs/events.ndjson` in NDJSON format:

```json
{"type": "ProximityWarning", "timestamp": "2025-10-04T14:32:10.123456", "frame": 1432, "person_id": 7, "vehicle_id": 3, "proximity_score": 0.83, "duration_s": 2.6, "person_center": [640.5, 360.2], "vehicle_center": [720.8, 380.5]}
{"type": "PersonDown", "timestamp": "2025-10-04T14:33:45.789012", "frame": 3021, "person_id": 5, "location": [500.0, 400.0], "confidence": 0.95}
```

## Configuration

Edit `config/settings.yaml` to customize:

```yaml
# Video settings
video_source: 0          # Camera index or file path
width: 1280
height: 720
target_fps: 20
device: "cpu"            # or "cuda"

# Proximity thresholds
proximity:
  score_threshold: 0.75  # 0-1, higher = closer required
  min_duration_s: 2.0    # Seconds before warning
  cooldown_s: 5.0        # Cooldown between warnings
  alpha: 0.6             # Depth weight
  beta: 0.4              # Pixel distance weight

# Fall detection
fall:
  enabled: true
  min_duration_s: 1.5
  aspect_ratio_threshold: 1.5

# Tracking
tracking:
  max_age: 30            # Frames to keep track without detection
  min_hits: 3            # Hits to establish track
  iou_threshold: 0.3
```

## Proximity Algorithm

The proximity score combines two components:

1. **Depth Component** (α = 0.6): Average depth of person and vehicle bboxes (higher depth = closer)
2. **Pixel Distance Component** (β = 0.4): 2D distance between bbox centers, normalized by image diagonal

```
proximity_score = α × depth_score + β × (1 - normalized_distance)
```

**Warning triggered when**:
- `proximity_score ≥ threshold` (default: 0.75)
- Maintained for ≥ `min_duration_s` (default: 2.0s)
- Respects `cooldown_s` (default: 5.0s) between repeated warnings

## Testing

**Run unit tests**:
```bash
pytest tests/ -v
```

**Run specific test**:
```bash
pytest tests/test_proximity_score.py -v
```

**Test coverage includes**:
- Proximity score calculation
- Warning threshold timing
- Cooldown debouncing
- Multi-pair tracking
- Event logging

## Performance

**Expected FPS** (on MacBook Pro M1, CPU):
- Detection (YOLOv8n): ~30 FPS
- Depth (MiDaS small): ~15 FPS
- Combined pipeline: ~12-15 FPS

**GPU acceleration** (CUDA):
- Combined pipeline: ~30-40 FPS

## Future Integration Points

The codebase includes TODOs marking integration points for planned features:

### 1. Ticketing Backend (Jira-style)
```python
# TODO: Create ticket on critical alerts
# - Initiative → Epic → Task hierarchy
# - Priority, assignees, attachments
# - Embedded chat (Gemini integration)
```

### 2. People Registry
```python
# TODO: Map track_id → person by name
# - Employee enrollment with face/gait
# - Status: working/sick leave
# - Permits, medical certs
# - Assigned tickets
```

### 3. Web UI
```python
# TODO: React/Vue frontend
# - Live camera feed
# - Real-time alerts dashboard
# - Historical event search
# - Camera admin (switch sources)
# - Vehicle/people registries
```

### 4. Gemini Chat Agent
```python
# TODO: Chatbot worker inside tickets
# - Answer safety questions
# - Retrieve SOPs
# - Escalate critical issues
```

## Troubleshooting

### Camera not opening
```bash
# List available cameras (macOS)
system_profiler SPCameraDataType

# Try different index
python -m src.main --video-source 1
```

### Low FPS
- Use CPU-optimized models: `--depth midas` (default)
- Reduce resolution in `config/settings.yaml`
- Enable GPU: `--device cuda` (requires CUDA)

### Model download fails
- Check internet connection
- Models download from:
  - YOLOv8: GitHub releases
  - MiDaS: Intel ISL PyTorch Hub

### Import errors
```bash
# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

## Development

**Code quality**:
```bash
# Format code
black src/ tests/

# Lint
ruff src/ tests/

# Type checking
mypy src/
```

**Add new event type**:
1. Define Pydantic model in `src/alerts.py`
2. Add emit method in `AlertManager`
3. Update WebSocket handler in `src/server.py`

## License

Proprietary - SiteOps Team

## Web Application

A full-featured web dashboard is available for managing sites, people, machines, alerts, and tickets.

### Quick Start

```bash
# Setup Supabase database (see SUPABASE_STORAGE_SETUP.md)
cd web
npm install
npm run dev
```

Visit http://localhost:3001 (or 3000 if available)

### Features

- **Dashboard**: Overview of site statistics and recent alerts
- **Camera**: Live browser-based object detection with fall detection and proximity warnings
- **People Management**: Track workers, status, and site assignments
- **Machines**: Register and monitor equipment
- **Alerts**: View safety alerts with screenshots (requires Supabase storage setup)
- **Tickets**: Manage initiatives, epics, and tasks (List/Board/Timeline views)

### Prerequisites

1. **Supabase Project**: Create a free account at [supabase.com](https://supabase.com)
2. **Database Setup**: Run `supabase_schema.sql` in your Supabase SQL Editor
3. **Storage Setup**: Create `alert-screenshots` bucket (see `SUPABASE_STORAGE_SETUP.md`)
4. **Environment**: Copy `.env.example` to `web/.env.local` and add your Supabase credentials

### Important: Alert Screenshots

For alert screenshots to display in the web app, you **must** set up the Supabase storage bucket:

📖 **See [SUPABASE_STORAGE_SETUP.md](SUPABASE_STORAGE_SETUP.md) for step-by-step instructions**

Without this setup, alerts will still be created but won't have screenshots attached.

## Acknowledgments

- **Ultralytics YOLOv8**: Object detection
- **Intel MiDaS**: Depth estimation
- **Roboflow Supervision**: ByteTrack implementation
- **FastAPI**: WebSocket server
- **Next.js 14**: Web application framework
- **Supabase**: Backend-as-a-Service (PostgreSQL + Storage + Auth)
- **TensorFlow.js**: Browser-based ML inference

---

**Status**: MVP Complete ✅ | Web Dashboard Complete ✅  
**Next Phase**: Gemini Integration + Advanced Analytics
