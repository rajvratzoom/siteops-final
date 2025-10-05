"""Supabase client and database operations."""

import os
from typing import Any, Dict, List, Optional
from datetime import datetime
from pathlib import Path

from supabase import create_client, Client
from dotenv import load_dotenv
from rich.console import Console

console = Console()

# Load environment variables
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(env_path)


class SupabaseClient:
    """Wrapper for Supabase operations."""

    def __init__(self):
        """Initialize Supabase client."""
        self.url = os.getenv("SUPABASE_URL")
        self.key = os.getenv("SUPABASE_KEY")
        self.service_key = os.getenv("SUPABASE_SERVICE_KEY")
        
        if not self.url or not self.key:
            console.print("[yellow]⚠️  Supabase not configured. Using local-only mode.[/yellow]")
            console.print("[dim]Create .env file with SUPABASE_URL and SUPABASE_KEY to enable database sync[/dim]")
            self.client = None
            self.enabled = False
            return
        
        try:
            self.client: Client = create_client(self.url, self.key)
            self.enabled = True
            console.print("[green]✓ Supabase connected[/green]")
        except Exception as e:
            console.print(f"[red]Failed to connect to Supabase: {e}[/red]")
            self.client = None
            self.enabled = False

    # ========================================================================
    # ALERTS
    # ========================================================================

    async def insert_alert(self, alert_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Insert a new alert into the database.

        Args:
            alert_data: Alert data dictionary

        Returns:
            Inserted alert or None if failed
        """
        if not self.enabled:
            return None

        try:
            result = self.client.table("alerts").insert(alert_data).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            console.print(f"[red]Failed to insert alert: {e}[/red]")
            return None

    async def get_recent_alerts(
        self, site_id: str, limit: int = 50
    ) -> List[Dict]:
        """Get recent alerts for a site."""
        if not self.enabled:
            return []

        try:
            result = (
                self.client.table("alerts")
                .select("*")
                .eq("site_id", site_id)
                .order("created_at", desc=True)
                .limit(limit)
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[red]Failed to fetch alerts: {e}[/red]")
            return []

    async def acknowledge_alert(
        self, alert_id: str, person_id: str
    ) -> bool:
        """Acknowledge an alert."""
        if not self.enabled:
            return False

        try:
            self.client.table("alerts").update({
                "acknowledged": True,
                "acknowledged_by": person_id,
                "acknowledged_at": datetime.utcnow().isoformat()
            }).eq("id", alert_id).execute()
            return True
        except Exception as e:
            console.print(f"[red]Failed to acknowledge alert: {e}[/red]")
            return False

    # ========================================================================
    # PEOPLE
    # ========================================================================

    async def get_active_people(self, site_id: str) -> List[Dict]:
        """Get all active people on site."""
        if not self.enabled:
            return []

        try:
            result = (
                self.client.table("people")
                .select("*")
                .eq("site_id", site_id)
                .eq("status", "Working")
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[red]Failed to fetch people: {e}[/red]")
            return []

    async def get_expected_headcount(self, site_id: str) -> int:
        """Get expected headcount (number of active people)."""
        people = await self.get_active_people(site_id)
        return len(people)

    async def update_person_last_seen(
        self, person_id: str, track_id: int, location: tuple
    ) -> bool:
        """Update person's last seen information."""
        if not self.enabled:
            return False

        try:
            self.client.table("people").update({
                "cv_track_id": track_id,
                "last_seen_at": datetime.utcnow().isoformat(),
            }).eq("id", person_id).execute()
            return True
        except Exception as e:
            console.print(f"[red]Failed to update person: {e}[/red]")
            return False

    # ========================================================================
    # MACHINES
    # ========================================================================

    async def get_machines(self, site_id: str) -> List[Dict]:
        """Get all machines for a site."""
        if not self.enabled:
            return []

        try:
            result = (
                self.client.table("machines")
                .select("*")
                .eq("site_id", site_id)
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[red]Failed to fetch machines: {e}[/red]")
            return []

    async def update_machine_location(
        self, machine_id: str, x: float, y: float, depth: float, zone: str
    ) -> bool:
        """Update machine location."""
        if not self.enabled:
            return False

        try:
            self.client.table("machines").update({
                "last_known_x": x,
                "last_known_y": y,
                "last_known_depth": depth,
                "zone": zone,
                "last_seen_at": datetime.utcnow().isoformat(),
                "status": "Active"
            }).eq("id", machine_id).execute()
            return True
        except Exception as e:
            console.print(f"[red]Failed to update machine: {e}[/red]")
            return False

    # ========================================================================
    # TICKETS
    # ========================================================================

    async def create_ticket_from_alert(
        self, 
        alert_id: str,
        site_id: str,
        title: str,
        description: str,
        priority: str = "High",
        created_by: Optional[str] = None
    ) -> Optional[Dict]:
        """Create a task ticket from an alert."""
        if not self.enabled:
            return None

        try:
            # Create ticket
            ticket_data = {
                "site_id": site_id,
                "type": "Task",
                "title": title,
                "description": description,
                "priority": priority,
                "status": "Backlog",
                "phase": "Construction",
                "discipline": "HSE",
                "created_by": created_by,
            }
            
            result = self.client.table("tickets").insert(ticket_data).execute()
            ticket = result.data[0] if result.data else None
            
            if ticket:
                # Link alert to ticket
                self.client.table("ticket_alert_links").insert({
                    "ticket_id": ticket["id"],
                    "alert_id": alert_id
                }).execute()
            
            return ticket
        except Exception as e:
            console.print(f"[red]Failed to create ticket: {e}[/red]")
            return None

    # ========================================================================
    # SITES
    # ========================================================================

    async def get_site_config(self, site_id: str) -> Optional[Dict]:
        """Get site configuration."""
        if not self.enabled:
            return None

        try:
            result = (
                self.client.table("sites")
                .select("*")
                .eq("id", site_id)
                .single()
                .execute()
            )
            return result.data
        except Exception as e:
            console.print(f"[red]Failed to fetch site config: {e}[/red]")
            return None


# Singleton instance
_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """Get or create Supabase client singleton."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client
