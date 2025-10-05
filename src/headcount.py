"""Headcount monitoring and mismatch detection."""

import time
from collections import Counter
from typing import List
from rich.console import Console

console = Console()


class HeadcountMonitor:
    """Monitors detected people count and alerts on mismatches."""

    def __init__(
        self,
        expected_active_count: int = 0,
        check_interval_s: float = 300.0,  # 5 minutes
        sample_window_s: float = 300.0,    # 5 minutes
    ):
        """
        Initialize headcount monitor.

        Args:
            expected_active_count: Expected number of active people on site
            check_interval_s: How often to check for mismatches (seconds)
            sample_window_s: Window size for calculating mode (seconds)
        """
        self.expected_active_count = expected_active_count
        self.check_interval_s = check_interval_s
        self.sample_window_s = sample_window_s

        # Track counts over time: [(timestamp, count), ...]
        self.count_history: List[tuple] = []
        
        # Last check time
        self.last_check_time = time.monotonic()
        
        # Last alert time (for throttling)
        self.last_alert_time = 0.0
        self.alert_cooldown_s = 600.0  # 10 minutes between repeat alerts

    def set_expected_count(self, count: int) -> None:
        """
        Update expected active people count.

        Args:
            count: New expected count
        """
        old_count = self.expected_active_count
        self.expected_active_count = count
        if old_count != count:
            console.print(
                f"[yellow]Expected headcount updated:[/yellow] {old_count} → {count}"
            )

    def record_count(self, count: int, timestamp: float) -> None:
        """
        Record the current detected people count.

        Args:
            count: Number of people detected
            timestamp: Current time (monotonic)
        """
        self.count_history.append((timestamp, count))

        # Clean up old entries outside the sample window
        cutoff_time = timestamp - self.sample_window_s
        self.count_history = [
            (t, c) for t, c in self.count_history if t >= cutoff_time
        ]

    def should_check(self, current_time: float) -> bool:
        """
        Check if it's time to perform a headcount check.

        Args:
            current_time: Current time (monotonic)

        Returns:
            True if check interval has elapsed
        """
        return (current_time - self.last_check_time) >= self.check_interval_s

    def check_headcount(self, current_time: float) -> tuple:
        """
        Check for headcount mismatch and return alert info if needed.

        Args:
            current_time: Current time (monotonic)

        Returns:
            Tuple of (has_mismatch, detected_count, mode_count, expected_count)
        """
        self.last_check_time = current_time

        if not self.count_history:
            return False, 0, 0, self.expected_active_count

        # Calculate mode (most frequent count)
        counts = [c for _, c in self.count_history]
        if not counts:
            return False, 0, 0, self.expected_active_count

        mode_count = Counter(counts).most_common(1)[0][0]
        current_count = counts[-1] if counts else 0

        # Check for mismatch
        has_mismatch = mode_count != self.expected_active_count

        # Apply cooldown for repeat alerts
        if has_mismatch:
            time_since_last_alert = current_time - self.last_alert_time
            if time_since_last_alert < self.alert_cooldown_s:
                console.print(
                    f"[dim]Headcount mismatch detected but in cooldown period "
                    f"({time_since_last_alert:.0f}s / {self.alert_cooldown_s:.0f}s)[/dim]"
                )
                return False, current_count, mode_count, self.expected_active_count

            self.last_alert_time = current_time

        return has_mismatch, current_count, mode_count, self.expected_active_count

    def get_stats(self) -> dict:
        """
        Get current monitoring statistics.

        Returns:
            Dictionary with stats
        """
        if not self.count_history:
            return {
                "expected": self.expected_active_count,
                "current": 0,
                "mode": 0,
                "samples": 0,
                "window_minutes": self.sample_window_s / 60.0,
            }

        counts = [c for _, c in self.count_history]
        mode_count = Counter(counts).most_common(1)[0][0] if counts else 0

        return {
            "expected": self.expected_active_count,
            "current": counts[-1] if counts else 0,
            "mode": mode_count,
            "samples": len(counts),
            "window_minutes": self.sample_window_s / 60.0,
        }
