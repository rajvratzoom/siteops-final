"""Fall detection module with duration tracking and state management."""

import time
from typing import Dict, List, Set, Tuple

import numpy as np
from rich.console import Console

console = Console()


class FallState:
    """State tracker for a person's fall detection."""

    def __init__(self, person_id: int, timestamp: float):
        """
        Initialize fall state.

        Args:
            person_id: Unique person track ID
            timestamp: When the fall state was first detected
        """
        self.person_id = person_id
        self.first_detected = timestamp
        self.last_detected = timestamp
        self.duration = 0.0
        self.alerted = False
        self.last_alert_time = 0.0

    def update(self, timestamp: float) -> float:
        """
        Update the fall state.

        Args:
            timestamp: Current timestamp

        Returns:
            Duration in seconds
        """
        self.last_detected = timestamp
        self.duration = timestamp - self.first_detected
        return self.duration


class FallDetector:
    """
    Fall detection with duration tracking and debouncing.

    Detects when a person has fallen (lying down) based on bounding box
    aspect ratio and maintains state to ensure alerts are only triggered
    after a minimum duration.
    """

    def __init__(
        self,
        aspect_ratio_threshold: float = 1.5,
        min_duration_s: float = 1.5,
        cooldown_s: float = 10.0,
    ):
        """
        Initialize fall detector.

        Args:
            aspect_ratio_threshold: Height/width ratio below this suggests horizontal pose (lying down)
            min_duration_s: Minimum duration before triggering alert
            cooldown_s: Cooldown period before re-alerting for same person
        """
        self.aspect_ratio_threshold = aspect_ratio_threshold
        self.min_duration_s = min_duration_s
        self.cooldown_s = cooldown_s

        # Track fall states by person ID
        self.fall_states: Dict[int, FallState] = {}

        console.print(
            f"[cyan]FallDetector initialized: aspect_ratio_threshold={aspect_ratio_threshold:.2f}, "
            f"min_duration={min_duration_s:.1f}s, cooldown={cooldown_s:.1f}s[/cyan]"
        )

    def update(
        self,
        tracked_people: List,
        timestamp: float,
    ) -> Tuple[Set[int], List[Tuple[int, Tuple[float, float], float]]]:
        """
        Update fall detection for all tracked people.

        Args:
            tracked_people: List of tracked person objects with bbox_xyxy and center
            timestamp: Current timestamp in seconds

        Returns:
            Tuple of:
                - Set of person IDs currently fallen
                - List of (person_id, location, duration) tuples for new fall alerts
        """
        currently_fallen = set()
        new_alerts = []

        # Track which people are currently in a fallen pose
        for person in tracked_people:
            bbox = person.bbox_xyxy
            width = bbox[2] - bbox[0]
            height = bbox[3] - bbox[1]

            if width > 0:
                aspect_ratio = height / width

                # Check if person is in a horizontal/lying position
                # Lower aspect ratio = more horizontal (wider than tall)
                if aspect_ratio < (1.0 / self.aspect_ratio_threshold):
                    person_id = person.track_id
                    currently_fallen.add(person_id)

                    # Update or create fall state
                    if person_id not in self.fall_states:
                        self.fall_states[person_id] = FallState(person_id, timestamp)
                        console.print(
                            f"[yellow]Person #{person_id} detected in fallen pose "
                            f"(aspect ratio: {aspect_ratio:.2f})[/yellow]"
                        )
                    else:
                        state = self.fall_states[person_id]
                        state.update(timestamp)

                        # Check if we should trigger an alert
                        if not state.alerted and state.duration >= self.min_duration_s:
                            # Check cooldown
                            time_since_last_alert = timestamp - state.last_alert_time
                            if time_since_last_alert >= self.cooldown_s:
                                state.alerted = True
                                state.last_alert_time = timestamp
                                new_alerts.append(
                                    (person_id, person.center, state.duration)
                                )
                                console.print(
                                    f"[red]⚠️  FALL ALERT: Person #{person_id} has been down for "
                                    f"{state.duration:.1f}s[/red]"
                                )

        # Clean up states for people no longer in fallen pose
        to_remove = []
        for person_id in self.fall_states:
            if person_id not in currently_fallen:
                state = self.fall_states[person_id]
                if state.alerted:
                    # Keep alerted states for a while (for cooldown)
                    if (timestamp - state.last_detected) > self.cooldown_s:
                        to_remove.append(person_id)
                        console.print(
                            f"[green]Person #{person_id} recovered from fall[/green]"
                        )
                else:
                    # Remove non-alerted states immediately
                    to_remove.append(person_id)

        for person_id in to_remove:
            del self.fall_states[person_id]

        return currently_fallen, new_alerts

    def get_active_states(self) -> Dict[int, FallState]:
        """Get all active fall states."""
        return self.fall_states.copy()

    def reset(self):
        """Reset all fall detection state."""
        self.fall_states.clear()
        console.print("[cyan]Fall detection state reset[/cyan]")
