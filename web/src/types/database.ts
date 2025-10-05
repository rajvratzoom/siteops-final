export interface Site {
  id: string;
  name: string;
  address: string | null;
  geo_bounds: any | null;
  time_zone: string;
  default_proximity_duration_s: number;
  default_proximity_threshold_px: number;
  default_alert_severity: string;
}

export interface Person {
  id: string;
  site_id: string | null;
  name: string;
  role: string | null;
  trade: string | null;
  company: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  status: string;
  status_note: string | null;
  status_updated_at: string | null;
  cv_track_id: number | null;
  cv_confidence: number | null;
  last_seen_at: string | null;
  permits: any | null;
  certifications: any | null;
  medical_docs: any | null;
  photo_url: string | null;
  shift_schedule: any | null;
  created_at: string;
  updated_at: string;
}

export interface Machine {
  id: string;
  site_id: string | null;
  label: string;
  type: string;
  asset_tag: string | null;
  owner_company: string | null;
  status: string;
  last_seen_at: string | null;
  last_known_x: number | null;
  last_known_y: number | null;
  last_known_depth: number | null;
  zone: string | null;
  operator_id: string | null;
  maintenance_docs: any | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  site_id: string | null;
  camera_id: string | null;
  type: string;
  severity: string;
  person_track_id: number | null;
  person_id: string | null;
  machine_id: string | null;
  location_x: number | null;
  location_y: number | null;
  location_depth: number | null;
  zone: string | null;
  duration_s: number | null;
  confidence: number | null;
  metadata: any | null;
  snapshot_url: string | null;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  linked_tickets: string[] | null;
  created_at: string;
}

export interface Ticket {
  id: string;
  site_id: string | null;
  type: string;
  parent_id: string | null;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  phase: string | null;
  discipline: string | null;
  cost_code: string | null;
  due_date: string | null;
  sla_target: string | null;
  assignees: string[] | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  blocked_by: string[] | null;
  blocking_reason: string | null;
}
