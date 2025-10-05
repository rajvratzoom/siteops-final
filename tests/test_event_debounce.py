"""Tests for event debouncing and alert management."""

import json
import time
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from src.alerts import AlertManager
from src.proximity import ProximityWarning


@pytest.fixture
def temp_log_dir():
    """Create temporary log directory."""
    with TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def alert_manager(temp_log_dir):
    """Create alert manager with temporary log directory."""
    manager = AlertManager(temp_log_dir)
    yield manager
    manager.close()


def test_alert_logging(alert_manager, temp_log_dir):
    """Test that alerts are logged to NDJSON file."""
    warning = ProximityWarning(
        person_id=1,
        vehicle_id=2,
        proximity_score=0.85,
        duration_s=2.5,
        timestamp=time.time(),
        person_center=(640, 360),
        vehicle_center=(700, 380),
    )

    alert_manager.emit_proximity_warning(warning, frame_number=100)

    # Check that log file exists and contains event
    log_file = temp_log_dir / "events.ndjson"
    assert log_file.exists(), "Log file should be created"

    with open(log_file, "r") as f:
        lines = f.readlines()
        assert len(lines) == 1, "Should have one event logged"

        event = json.loads(lines[0])
        assert event["type"] == "ProximityWarning"
        assert event["person_id"] == 1
        assert event["vehicle_id"] == 2


def test_fall_event_logging(alert_manager, temp_log_dir):
    """Test fall event logging."""
    alert_manager.emit_fall_event(
        person_id=5,
        location=(500, 400),
        frame_number=200,
        confidence=0.95,
    )

    log_file = temp_log_dir / "events.ndjson"
    with open(log_file, "r") as f:
        lines = f.readlines()
        event = json.loads(lines[0])
        assert event["type"] == "PersonDown"
        assert event["person_id"] == 5


def test_recent_events_cache(alert_manager):
    """Test that recent events are cached."""
    # Emit multiple events
    for i in range(5):
        warning = ProximityWarning(
            person_id=i,
            vehicle_id=10,
            proximity_score=0.8,
            duration_s=2.0,
            timestamp=time.time(),
            person_center=(640, 360),
            vehicle_center=(700, 380),
        )
        alert_manager.emit_proximity_warning(warning, frame_number=i)

    recent = alert_manager.get_recent_events(limit=3)
    assert len(recent) == 3, "Should return only requested number of recent events"


def test_event_ordering(alert_manager):
    """Test that events are ordered chronologically."""
    # Emit events with delays
    for i in range(3):
        warning = ProximityWarning(
            person_id=i,
            vehicle_id=10,
            proximity_score=0.8,
            duration_s=2.0,
            timestamp=time.time(),
            person_center=(640, 360),
            vehicle_center=(700, 380),
        )
        alert_manager.emit_proximity_warning(warning, frame_number=i)
        time.sleep(0.01)

    recent = alert_manager.get_recent_events(limit=10)
    assert len(recent) == 3

    # Check that events are in order
    for i in range(len(recent) - 1):
        time1 = recent[i]["timestamp"]
        time2 = recent[i + 1]["timestamp"]
        assert time1 <= time2, "Events should be in chronological order"


def test_multiple_event_types(alert_manager):
    """Test logging different event types."""
    # Proximity warning
    warning = ProximityWarning(
        person_id=1,
        vehicle_id=2,
        proximity_score=0.85,
        duration_s=2.5,
        timestamp=time.time(),
        person_center=(640, 360),
        vehicle_center=(700, 380),
    )
    alert_manager.emit_proximity_warning(warning, frame_number=100)

    # Fall event
    alert_manager.emit_fall_event(
        person_id=3,
        location=(500, 400),
        frame_number=150,
    )

    recent = alert_manager.get_recent_events(limit=10)
    assert len(recent) == 2
    assert recent[0]["type"] == "ProximityWarning"
    assert recent[1]["type"] == "PersonDown"


def test_ndjson_format(alert_manager, temp_log_dir):
    """Test that log file is valid NDJSON format."""
    # Emit multiple events
    for i in range(3):
        warning = ProximityWarning(
            person_id=i,
            vehicle_id=10,
            proximity_score=0.8,
            duration_s=2.0,
            timestamp=time.time(),
            person_center=(640, 360),
            vehicle_center=(700, 380),
        )
        alert_manager.emit_proximity_warning(warning, frame_number=i)

    # Verify each line is valid JSON
    log_file = temp_log_dir / "events.ndjson"
    with open(log_file, "r") as f:
        for line in f:
            try:
                json.loads(line)
            except json.JSONDecodeError:
                pytest.fail(f"Invalid JSON line: {line}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
