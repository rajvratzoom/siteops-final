"""Proximity analysis and warning generation."""

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np

from .tracking import TrackedObject


@dataclass
class ProximityState:
    """State of a person-vehicle proximity relationship."""

    person_id: int
    vehicle_id: int
    first_close_time: Optional[float] = None
    last_close_time: Optional[float] = None
    accumulated_duration: float = 0.0
    is_alerted: bool = False
    last_alert_time: Optional[float] = None


@dataclass
class ProximityWarning:
    """Proximity warning event."""

    person_id: int
    vehicle_id: int
    proximity_score: float
    duration_s: float
    timestamp: float
    person_center: Tuple[float, float]
    vehicle_center: Tuple[float, float]


class ProximityAnalyzer:
    """Analyzes proximity between people and vehicles."""

    def __init__(
        self,
        pixel_threshold: float = 400.0,
        min_duration_s: float = 1.0,
        cooldown_s: float = 1.0,
    ):
        """
        Initialize proximity analyzer.

        Args:
            pixel_threshold: Pixel distance threshold for "too close"
            min_duration_s: Minimum duration to trigger warning
            cooldown_s: Cooldown period between warnings for same pair
        """
        self.pixel_threshold = pixel_threshold
        self.min_duration_s = min_duration_s
        self.cooldown_s = cooldown_s

        # Track state for each person-vehicle pair
        self.states: Dict[Tuple[int, int], ProximityState] = {}

    def compute_pixel_distance(
        self,
        person: TrackedObject,
        vehicle: TrackedObject,
    ) -> float:
        """
        Compute pixel distance between person and vehicle centers.

        Args:
            person: Tracked person
            vehicle: Tracked vehicle

        Returns:
            Pixel distance between centers
        """
        px, py = person.center
        vx, vy = vehicle.center
        pixel_dist = np.sqrt((px - vx) ** 2 + (py - vy) ** 2)
        return float(pixel_dist)

    def _get_bbox_depth(self, depth_map: np.ndarray, bbox: np.ndarray) -> float:
        """Get average depth within bbox."""
        x1, y1, x2, y2 = bbox.astype(int)
        h, w = depth_map.shape

        x1 = max(0, min(x1, w - 1))
        x2 = max(0, min(x2, w - 1))
        y1 = max(0, min(y1, h - 1))
        y2 = max(0, min(y2, h - 1))

        if x2 <= x1 or y2 <= y1:
            return 0.0

        region = depth_map[y1:y2, x1:x2]
        if region.size == 0:
            return 0.0

        return float(np.mean(region))

    def update(
        self,
        people: List[TrackedObject],
        vehicles: List[TrackedObject],
        depth_map: np.ndarray,
        current_time: float,
    ) -> List[ProximityWarning]:
        """
        Update proximity states and generate warnings.

        Args:
            people: List of tracked people
            vehicles: List of tracked vehicles
            depth_map: Current depth map (unused now)
            current_time: Current timestamp

        Returns:
            List of new warnings
        """
        warnings = []
        active_pairs = set()

        # Check all person-vehicle pairs
        for person in people:
            for vehicle in vehicles:
                pair_key = (person.track_id, vehicle.track_id)
                active_pairs.add(pair_key)

                # Compute pixel distance
                pixel_dist = self.compute_pixel_distance(person, vehicle)

                # Get or create state
                if pair_key not in self.states:
                    self.states[pair_key] = ProximityState(
                        person_id=person.track_id,
                        vehicle_id=vehicle.track_id,
                    )

                state = self.states[pair_key]

                # Update state based on proximity (too close if pixel distance < threshold)
                if pixel_dist <= self.pixel_threshold:
                    # Objects are close
                    if state.first_close_time is None:
                        state.first_close_time = current_time

                    state.last_close_time = current_time

                    # Update duration
                    duration = current_time - state.first_close_time

                    # Check if warning should be triggered
                    if duration >= self.min_duration_s:
                        # Check cooldown
                        can_alert = True
                        if state.last_alert_time is not None:
                            time_since_alert = current_time - state.last_alert_time
                            if time_since_alert < self.cooldown_s:
                                can_alert = False

                        if can_alert:
                            # Generate warning
                            warning = ProximityWarning(
                                person_id=person.track_id,
                                vehicle_id=vehicle.track_id,
                                proximity_score=pixel_dist,  # Now stores pixel distance
                                duration_s=duration,
                                timestamp=current_time,
                                person_center=person.center,
                                vehicle_center=vehicle.center,
                            )
                            warnings.append(warning)

                            state.is_alerted = True
                            state.last_alert_time = current_time

                else:
                    # Objects not close - reset state
                    state.first_close_time = None
                    state.last_close_time = None
                    state.is_alerted = False

        # Clean up old states
        keys_to_remove = [k for k in self.states.keys() if k not in active_pairs]
        for key in keys_to_remove:
            del self.states[key]

        return warnings

    def get_close_pairs(self) -> List[Tuple[int, int, float]]:
        """
        Get currently close person-vehicle pairs.

        Returns:
            List of (person_id, vehicle_id, duration) tuples
        """
        close_pairs = []
        current_time = time.monotonic()

        for state in self.states.values():
            if state.first_close_time is not None:
                duration = current_time - state.first_close_time
                close_pairs.append((state.person_id, state.vehicle_id, duration))

        return close_pairs
