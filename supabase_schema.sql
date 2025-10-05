-- SiteOps Platform - Supabase Database Schema
-- This schema supports the full construction site management platform

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- For geo-coordinates

-- ============================================================================
-- SITES
-- ============================================================================

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT,
    geo_bounds JSONB, -- Polygon coordinates
    time_zone TEXT DEFAULT 'UTC',
    status TEXT DEFAULT 'Active', -- Active, Inactive, Completed
    
    -- Default safety thresholds
    proximity_threshold INTEGER DEFAULT 400, -- pixels
    proximity_duration_s FLOAT DEFAULT 2.0,
    headcount_check_interval_s FLOAT DEFAULT 300.0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PEOPLE / WORKFORCE
-- ============================================================================

CREATE TABLE people (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Basic info
    name TEXT NOT NULL,
    role TEXT, -- Foreman, Worker, Engineer, HSE, etc.
    trade TEXT, -- Carpenter, Electrician, Plumber, etc.
    company TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    
    -- Current status
    status TEXT DEFAULT 'Off-Site', -- Working, Sick-Leave, Off-Site, On-Break
    status_note TEXT,
    status_updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- CV tracking
    cv_track_id INTEGER, -- Optional mapping to CV tracker
    cv_confidence FLOAT,
    last_seen_at TIMESTAMPTZ,
    
    -- Documents & certifications
    permits JSONB, -- [{type, number, expiry}, ...]
    certifications JSONB,
    medical_docs JSONB, -- Restricted access
    
    -- Photo
    photo_url TEXT,
    
    -- Shift & availability
    shift_schedule JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_site ON people(site_id);
CREATE INDEX idx_people_status ON people(status);
CREATE INDEX idx_people_cv_track ON people(cv_track_id);

-- ============================================================================
-- MACHINES / VEHICLES
-- ============================================================================

CREATE TABLE machines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Basic info
    label TEXT NOT NULL, -- "Excavator #1", "Forklift A"
    type TEXT NOT NULL, -- truck, excavator, forklift, crane, etc.
    asset_tag TEXT,
    owner_company TEXT,
    
    -- Status & location
    status TEXT DEFAULT 'Idle', -- Active, Idle, Off-Site, Maintenance
    last_seen_at TIMESTAMPTZ,
    last_known_x FLOAT,
    last_known_y FLOAT,
    last_known_depth FLOAT,
    zone TEXT,
    
    -- Operator
    operator_id UUID REFERENCES people(id) ON DELETE SET NULL,
    
    -- Maintenance
    maintenance_docs JSONB,
    next_maintenance_due DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_machines_site ON machines(site_id);
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_machines_type ON machines(type);

-- ============================================================================
-- CAMERAS / SENSORS
-- ============================================================================

CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    name TEXT NOT NULL,
    source TEXT NOT NULL, -- URL, index, rtsp://
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Purpose & coverage
    purpose TEXT, -- Safety, Coverage
    zone TEXT,
    
    -- Health
    last_heartbeat TIMESTAMPTZ,
    status TEXT DEFAULT 'Unknown', -- Online, Offline, Error
    
    -- Calibration
    calibration_meta JSONB, -- Height, focal length, transform matrix
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cameras_site ON cameras(site_id);
CREATE INDEX idx_cameras_enabled ON cameras(enabled);

-- ============================================================================
-- TICKETS (Hierarchy: Initiative → Epic → Task)
-- ============================================================================

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    -- Type & hierarchy
    type TEXT NOT NULL, -- Initiative, Epic, Task
    parent_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    description TEXT, -- Rich text / Markdown
    
    -- Metadata
    priority TEXT DEFAULT 'Medium', -- Low, Medium, High, Critical
    status TEXT DEFAULT 'Backlog', -- Backlog, In-Progress, Blocked, Done
    
    -- Business tags
    phase TEXT, -- Design, Procurement, Construction, Commissioning
    discipline TEXT, -- Civil, MEP, HSE
    cost_code TEXT,
    due_date DATE,
    sla_target TIMESTAMPTZ,
    
    -- Assignments
    assignees UUID[], -- Array of people IDs
    
    -- Audit
    created_by UUID REFERENCES people(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Workflow
    blocked_by UUID[], -- Array of ticket IDs
    blocking_reason TEXT
);

CREATE INDEX idx_tickets_site ON tickets(site_id);
CREATE INDEX idx_tickets_type ON tickets(type);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_parent ON tickets(parent_id);
CREATE INDEX idx_tickets_priority ON tickets(priority);
CREATE INDEX idx_tickets_assignees ON tickets USING GIN(assignees);

-- ============================================================================
-- TICKET ATTACHMENTS
-- ============================================================================

CREATE TABLE ticket_attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    
    filename TEXT NOT NULL,
    file_url TEXT NOT NULL, -- Supabase storage URL
    file_type TEXT,
    file_size INTEGER,
    version INTEGER DEFAULT 1,
    
    uploaded_by UUID REFERENCES people(id) ON DELETE SET NULL,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attachments_ticket ON ticket_attachments(ticket_id);

-- ============================================================================
-- TICKET CHAT / COMMENTS
-- ============================================================================

CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    
    author_id UUID REFERENCES people(id) ON DELETE SET NULL,
    author_name TEXT, -- For bot messages
    is_bot BOOLEAN DEFAULT FALSE,
    
    content TEXT NOT NULL,
    mentions UUID[], -- Mentioned people/machine IDs
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_comments_created ON ticket_comments(created_at DESC);

-- ============================================================================
-- ALERTS / EVENTS
-- ============================================================================

CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    
    -- Event type
    type TEXT NOT NULL, -- ProximityWarning, PersonDown, HeadcountMismatch, PPEViolation, etc.
    severity TEXT DEFAULT 'Medium', -- Low, Medium, High, Critical
    
    -- Context
    person_track_id INTEGER,
    person_id UUID REFERENCES people(id) ON DELETE SET NULL, -- If mapped
    machine_id UUID REFERENCES machines(id) ON DELETE SET NULL,
    
    -- Location
    location_x FLOAT,
    location_y FLOAT,
    location_depth FLOAT,
    zone TEXT,
    
    -- Details
    duration_s FLOAT,
    confidence FLOAT,
    metadata JSONB, -- Type-specific data (proximity_score, detected_count, etc.)
    
    -- Snapshot
    snapshot_url TEXT, -- Reference to stored frame
    
    -- Workflow
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by UUID REFERENCES people(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    
    -- Ticket linkage
    linked_tickets UUID[],
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_site ON alerts(site_id);
CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_created ON alerts(created_at DESC);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_person ON alerts(person_id);
CREATE INDEX idx_alerts_machine ON alerts(machine_id);

-- ============================================================================
-- TICKET-ALERT LINKS (Many-to-Many)
-- ============================================================================

CREATE TABLE ticket_alert_links (
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (ticket_id, alert_id)
);

-- ============================================================================
-- AUDIT LOG
-- ============================================================================

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    
    actor_id UUID REFERENCES people(id) ON DELETE SET NULL,
    actor_name TEXT,
    
    action TEXT NOT NULL, -- created, updated, deleted, acknowledged, etc.
    resource_type TEXT NOT NULL, -- ticket, alert, person, machine, etc.
    resource_id UUID,
    
    details JSONB,
    ip_address TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_site ON audit_log(site_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_log(created_at DESC);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_people_updated_at BEFORE UPDATE ON people
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_machines_updated_at BEFORE UPDATE ON machines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cameras_updated_at BEFORE UPDATE ON cameras
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA (Sample Site)
-- ============================================================================

-- Insert sample site
INSERT INTO sites (name, address, time_zone) VALUES
('Demo Construction Site', '123 Builder St, Construction City', 'America/New_York');

-- Sample people
INSERT INTO people (site_id, name, role, trade, company, status) 
SELECT 
    id,
    'John Doe',
    'Foreman',
    'General',
    'ABC Construction',
    'Working'
FROM sites WHERE name = 'Demo Construction Site';

INSERT INTO people (site_id, name, role, trade, company, status) 
SELECT 
    id,
    'Jane Smith',
    'Worker',
    'Electrician',
    'ElectriCo',
    'Working'
FROM sites WHERE name = 'Demo Construction Site';

-- Sample machine
INSERT INTO machines (site_id, label, type, status) 
SELECT 
    id,
    'Excavator #1',
    'excavator',
    'Active'
FROM sites WHERE name = 'Demo Construction Site';
