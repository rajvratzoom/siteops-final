"""Multi-object tracking using SORT/ByteTrack via supervision."""

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import supervision as sv
from supervision import Detections

from .detection import Detection


@dataclass
class TrackedObject:
    """Tracked object with stable ID."""

    track_id: int
    bbox_xyxy: np.ndarray
    confidence: float
    class_id: int
    class_name: str
    center: Tuple[float, float]


class ObjectTracker:
    """Multi-object tracker wrapper using supervision library."""

    def __init__(
        self,
        max_age: int = 30,
        min_hits: int = 3,
        iou_threshold: float = 0.3,
    ):
        """
        Initialize object tracker.

        Args:
            max_age: Maximum frames to keep track without detection
            min_hits: Minimum hits to establish track
            iou_threshold: IOU threshold for matching
        """
        # Create separate trackers for people and vehicles
        self.person_tracker = sv.ByteTrack(
            track_activation_threshold=0.25,
            lost_track_buffer=max_age,
            minimum_matching_threshold=iou_threshold,
            frame_rate=30,
        )

        self.vehicle_tracker = sv.ByteTrack(
            track_activation_threshold=0.25,
            lost_track_buffer=max_age,
            minimum_matching_threshold=iou_threshold,
            frame_rate=30,
        )

    def track_people(self, detections: List[Detection]) -> List[TrackedObject]:
        """
        Track person detections.

        Args:
            detections: List of person detections

        Returns:
            List of tracked people with stable IDs
        """
        return self._track_objects(detections, self.person_tracker)

    def track_vehicles(self, detections: List[Detection]) -> List[TrackedObject]:
        """
        Track vehicle detections.

        Args:
            detections: List of vehicle detections

        Returns:
            List of tracked vehicles with stable IDs
        """
        return self._track_objects(detections, self.vehicle_tracker)

    def _track_objects(
        self,
        detections: List[Detection],
        tracker: sv.ByteTrack,
    ) -> List[TrackedObject]:
        """
        Internal tracking logic.

        Args:
            detections: List of detections
            tracker: ByteTrack tracker instance

        Returns:
            List of tracked objects
        """
        if not detections:
            # Update tracker with empty detections
            empty_det = Detections.empty()
            tracker.update_with_detections(empty_det)
            return []

        # Convert to supervision Detections format
        xyxy = np.array([det.bbox_xyxy for det in detections])
        confidence = np.array([det.confidence for det in detections])
        class_id = np.array([det.class_id for det in detections])

        sv_detections = Detections(
            xyxy=xyxy,
            confidence=confidence,
            class_id=class_id,
        )

        # Update tracker
        tracked = tracker.update_with_detections(sv_detections)

        # Convert back to our format
        tracked_objects = []
        for i in range(len(tracked)):
            if tracked.tracker_id is None:
                continue

            track_id = tracked.tracker_id[i]
            if track_id < 0:  # Invalid track
                continue

            bbox = tracked.xyxy[i]
            center_x = (bbox[0] + bbox[2]) / 2
            center_y = (bbox[1] + bbox[3]) / 2

            obj = TrackedObject(
                track_id=int(track_id),
                bbox_xyxy=bbox,
                confidence=float(tracked.confidence[i]),
                class_id=int(tracked.class_id[i]),
                class_name=detections[min(i, len(detections) - 1)].class_name,
                center=(center_x, center_y),
            )
            tracked_objects.append(obj)

        return tracked_objects
