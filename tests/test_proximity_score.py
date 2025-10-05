"""Unit tests for proximity scoring logic."""

import numpy as np
import pytest

from src.proximity import ProximityAnalyzer
from src.tracking import TrackedObject


@pytest.fixture
def analyzer():
    """Create a proximity analyzer for testing."""
    return ProximityAnalyzer(
        score_threshold=0.75,
        min_duration_s=2.0,
        cooldown_s=5.0,
        alpha=0.6,
        beta=0.4,
        image_width=1280,
        image_height=720,
    )


@pytest.fixture
def depth_map():
    """Create a mock depth map."""
    return np.ones((720, 1280), dtype=np.float32) * 0.5


def create_tracked_object(
    track_id: int,
    center: tuple,
    bbox_size: tuple = (100, 100),
    class_name: str = "person",
) -> TrackedObject:
    """Helper to create TrackedObject."""
    cx, cy = center
    w, h = bbox_size
    bbox = np.array([cx - w/2, cy - h/2, cx + w/2, cy + h/2])

    return TrackedObject(
        track_id=track_id,
        bbox_xyxy=bbox,
        confidence=0.9,
        class_id=0,
        class_name=class_name,
        center=center,
    )


def test_proximity_score_close_objects(analyzer, depth_map):
    """Test that close objects get high proximity score."""
    person = create_tracked_object(1, (640, 360))
    vehicle = create_tracked_object(2, (700, 380), class_name="truck")

    # Set high depth (close) for both objects
    x1, y1, x2, y2 = person.bbox_xyxy.astype(int)
    depth_map[y1:y2, x1:x2] = 0.9

    x1, y1, x2, y2 = vehicle.bbox_xyxy.astype(int)
    depth_map[y1:y2, x1:x2] = 0.9

    score = analyzer.compute_proximity_score(person, vehicle, depth_map)

    assert score > 0.7, "Close objects should have high proximity score"


def test_proximity_score_far_objects(analyzer, depth_map):
    """Test that far objects get low proximity score."""
    person = create_tracked_object(1, (100, 100))
    vehicle = create_tracked_object(2, (1100, 600), class_name="truck")

    # Set low depth (far) for both objects
    depth_map[:, :] = 0.1

    score = analyzer.compute_proximity_score(person, vehicle, depth_map)

    assert score < 0.4, "Far objects should have low proximity score"


def test_proximity_score_range(analyzer, depth_map):
    """Test that proximity score is in valid range [0, 1]."""
    person = create_tracked_object(1, (640, 360))
    vehicle = create_tracked_object(2, (700, 380), class_name="truck")

    score = analyzer.compute_proximity_score(person, vehicle, depth_map)

    assert 0.0 <= score <= 1.0, "Proximity score must be in [0, 1]"


def test_warning_threshold_timing(analyzer, depth_map):
    """Test that warnings are generated after threshold duration."""
    person = create_tracked_object(1, (640, 360))
    vehicle = create_tracked_object(2, (700, 380), class_name="truck")

    # Make them very close
    depth_map[:, :] = 0.9

    # First update - no warning yet
    warnings = analyzer.update([person], [vehicle], depth_map, current_time=0.0)
    assert len(warnings) == 0, "No warning before threshold duration"

    # Second update after threshold - should warn
    warnings = analyzer.update([person], [vehicle], depth_map, current_time=2.5)
    assert len(warnings) == 1, "Warning should be generated after threshold duration"


def test_warning_cooldown(analyzer, depth_map):
    """Test that warnings respect cooldown period."""
    person = create_tracked_object(1, (640, 360))
    vehicle = create_tracked_object(2, (700, 380), class_name="truck")

    depth_map[:, :] = 0.9

    # Generate first warning
    analyzer.update([person], [vehicle], depth_map, current_time=0.0)
    warnings = analyzer.update([person], [vehicle], depth_map, current_time=2.5)
    assert len(warnings) == 1, "First warning"

    # Try to generate another warning immediately
    warnings = analyzer.update([person], [vehicle], depth_map, current_time=3.0)
    assert len(warnings) == 0, "Should not generate warning during cooldown"

    # After cooldown period
    warnings = analyzer.update([person], [vehicle], depth_map, current_time=8.0)
    assert len(warnings) == 1, "Should generate warning after cooldown"


def test_multiple_pairs(analyzer, depth_map):
    """Test tracking multiple person-vehicle pairs."""
    person1 = create_tracked_object(1, (400, 360))
    person2 = create_tracked_object(2, (800, 360))
    vehicle = create_tracked_object(10, (700, 380), class_name="truck")

    depth_map[:, :] = 0.9

    # Update with multiple people
    warnings = analyzer.update([person1, person2], [vehicle], depth_map, current_time=0.0)
    assert len(warnings) == 0

    # After threshold
    warnings = analyzer.update([person1, person2], [vehicle], depth_map, current_time=2.5)
    assert len(warnings) == 2, "Should warn for both people"


def test_state_cleanup(analyzer, depth_map):
    """Test that old states are cleaned up."""
    person = create_tracked_object(1, (640, 360))
    vehicle = create_tracked_object(2, (700, 380), class_name="truck")

    depth_map[:, :] = 0.9

    # Create state
    analyzer.update([person], [vehicle], depth_map, current_time=0.0)
    assert len(analyzer.states) == 1

    # Update without objects - state should be cleaned
    analyzer.update([], [], depth_map, current_time=1.0)
    assert len(analyzer.states) == 0, "States should be cleaned when objects disappear"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
