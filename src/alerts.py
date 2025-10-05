"""Alert management and event logging."""

import json
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import orjson
from pydantic import BaseModel, Field
from rich.console import Console

from .proximity import ProximityWarning

console = Console()


class Event(BaseModel):
    """Base event model."""

    type: str
    timestamp: str
    frame: int


class ProximityEvent(Event):
    """Proximity warning event."""

    type: str = "ProximityWarning"
    person_id: int
    vehicle_id: int
    proximity_score: float
    duration_s: float
    person_center: Tuple[float, float]
    vehicle_center: Tuple[float, float]


class FallEvent(Event):
    """Person fall detection event."""

    type: str = "PersonDown"
    person_id: int
    location: Tuple[float, float]
    confidence: float = 1.0


class HeadcountMismatchEvent(Event):
    """Headcount mismatch alert event."""

    type: str = "HeadcountMismatch"
    detected_count: int
    expected_count: int
    mode_count: int  # Most frequent count over the period
    severity: str = "High"  # High severity for unauthorized access


class AlertManager:
    """Manages alerts and event logging."""

    def __init__(self, log_dir: Path):
        """
        Initialize alert manager.

        Args:
            log_dir: Directory for log files
        """
        self.log_dir = log_dir
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Create NDJSON log file
        self.log_file = self.log_dir / "events.ndjson"
        self.log_handle = open(self.log_file, "a")

        # Event subscribers (WebSocket connections)
        self.subscribers: List[Any] = []

        # Recent events cache
        self.recent_events: List[Dict[str, Any]] = []
        self.max_recent = 100

        console.print(f"[green]Alert manager initialized: {self.log_file}[/green]")

    def emit_proximity_warning(
        self,
        warning: ProximityWarning,
        frame_number: int,
    ) -> None:
        """
        Emit a proximity warning event.

        Args:
            warning: ProximityWarning object
            frame_number: Current frame number
        """
        event = ProximityEvent(
            timestamp=datetime.now().isoformat(),
            frame=frame_number,
            person_id=warning.person_id,
            vehicle_id=warning.vehicle_id,
            proximity_score=warning.proximity_score,
            duration_s=warning.duration_s,
            person_center=warning.person_center,
            vehicle_center=warning.vehicle_center,
        )

        self._log_event(event)
        console.print(
            f"[red]⚠ ALERT:[/red] Person #{warning.person_id} within proximity of "
            f"Vehicle #{warning.vehicle_id} for {warning.duration_s:.1f}s "
            f"(score: {warning.proximity_score:.2f})"
        )

    def emit_fall_event(
        self,
        person_id: int,
        location: Tuple[float, float],
        frame_number: int,
        confidence: float = 1.0,
    ) -> None:
        """
        Emit a person fall detection event.

        Args:
            person_id: Person track ID
            location: Location (x, y) in image
            frame_number: Current frame number
            confidence: Detection confidence
        """
        event = FallEvent(
            timestamp=datetime.now().isoformat(),
            frame=frame_number,
            person_id=person_id,
            location=location,
            confidence=confidence,
        )

        self._log_event(event)
        console.print(
            f"[red]🚨 ALERT:[/red] PersonDown #{person_id} at "
            f"{datetime.now().strftime('%H:%M:%S')} "
            f"(confidence: {confidence:.2f})"
        )

    def emit_headcount_mismatch(
        self,
        detected_count: int,
        expected_count: int,
        mode_count: int,
    ) -> None:
        """
        Emit headcount mismatch alert.

        Args:
            detected_count: Current detected people count
            expected_count: Expected active people on site
            mode_count: Most frequent count over monitoring period
        """
        event = HeadcountMismatchEvent(
            timestamp=datetime.now().isoformat(),
            detected_count=detected_count,
            expected_count=expected_count,
            mode_count=mode_count,
        )

        self._log_event(event)
        console.print(
            f"[red]🚨 HEADCOUNT ALERT:[/red] Expected {expected_count} people, "
            f"detected mode of {mode_count} (current: {detected_count}) at "
            f"{datetime.now().strftime('%H:%M:%S')}"
        )

    def _log_event(self, event: Event) -> None:
        """
        Log event to NDJSON file and notify subscribers.

        Args:
            event: Event to log
        """
        # Convert to dict
        event_dict = event.model_dump()

        # Write to NDJSON
        json_line = orjson.dumps(event_dict).decode("utf-8")
        self.log_handle.write(json_line + "\n")
        self.log_handle.flush()

        # Add to recent events
        self.recent_events.append(event_dict)
        if len(self.recent_events) > self.max_recent:
            self.recent_events.pop(0)

        # Notify subscribers (WebSocket)
        self._notify_subscribers(event_dict)

    def _notify_subscribers(self, event_dict: Dict[str, Any]) -> None:
        """
        Notify WebSocket subscribers of new event.

        Args:
            event_dict: Event dictionary
        """
        # This will be called by the main loop
        # Actual WebSocket sending happens in server.py
        pass

    def add_subscriber(self, subscriber: Any) -> None:
        """Add WebSocket subscriber."""
        self.subscribers.append(subscriber)

    def remove_subscriber(self, subscriber: Any) -> None:
        """Remove WebSocket subscriber."""
        if subscriber in self.subscribers:
            self.subscribers.remove(subscriber)

    def get_recent_events(self, limit: int = 20) -> List[Dict[str, Any]]:
        """
        Get recent events.

        Args:
            limit: Maximum number of events to return

        Returns:
            List of recent events
        """
        return self.recent_events[-limit:]

    def close(self) -> None:
        """Close log file."""
        if self.log_handle:
            self.log_handle.close()
            console.print("[green]Alert manager closed[/green]")
