"""Visualization overlay for video display."""

import cv2
import numpy as np
from typing import List, Optional, Tuple

from .tracking import TrackedObject
from .proximity import ProximityAnalyzer


class OverlayRenderer:
    """Renders visualization overlays on video frames."""

    def __init__(
        self,
        show_depth: bool = True,
        show_fps: bool = True,
        show_ids: bool = True,
        depth_thumbnail_size: int = 200,
    ):
        """
        Initialize overlay renderer.

        Args:
            show_depth: Show depth map thumbnail
            show_fps: Show FPS counter
            show_ids: Show track IDs
            depth_thumbnail_size: Size of depth thumbnail
        """
        self.show_depth = show_depth
        self.show_fps = show_fps
        self.show_ids = show_ids
        self.depth_thumbnail_size = depth_thumbnail_size

        # Colors (BGR)
        self.color_person = (0, 255, 0)  # Green
        self.color_vehicle = (255, 0, 0)  # Blue
        self.color_warning = (0, 0, 255)  # Red
        self.color_text = (255, 255, 255)  # White

    def render(
        self,
        frame: np.ndarray,
        people: List[TrackedObject],
        vehicles: List[TrackedObject],
        depth_map: Optional[np.ndarray] = None,
        proximity_analyzer: Optional[ProximityAnalyzer] = None,
        fps: float = 0.0,
        warnings: List[str] = None,
        fallen_person_ids: set = None,
    ) -> np.ndarray:
        """
        Render complete overlay on frame.

        Args:
            frame: Input frame
            people: List of tracked people
            vehicles: List of tracked vehicles
            depth_map: Optional depth map
            proximity_analyzer: Optional proximity analyzer for close pairs
            fps: Current FPS
            warnings: List of warning messages
            fallen_person_ids: Set of person IDs who are detected as fallen

        Returns:
            Frame with overlays
        """
        output = frame.copy()

        if fallen_person_ids is None:
            fallen_person_ids = set()

        # Get close pairs if analyzer available
        close_pairs = set()
        if proximity_analyzer is not None:
            pairs = proximity_analyzer.get_close_pairs()
            close_pairs = {(p_id, v_id) for p_id, v_id, _ in pairs}

        # Draw vehicles
        for vehicle in vehicles:
            self._draw_detection(
                output,
                vehicle,
                self.color_vehicle,
                label=f"Vehicle-{vehicle.class_name}",
            )

        # Draw people
        for person in people:
            # Check if person has fallen (HIGHEST PRIORITY - RED)
            is_fallen = person.track_id in fallen_person_ids
            
            # Check if person is in proximity warning (YELLOW/ORANGE)
            is_warning = any(person.track_id == p_id for p_id, v_id in close_pairs)
            
            # Determine color and label based on priority
            if is_fallen:
                color = (0, 0, 255)  # RED for fallen person
                label = "⚠️ PERSON DOWN"
                thickness = 4
            elif is_warning:
                color = self.color_warning  # Red for proximity warning
                label = "Person (TOO CLOSE)"
                thickness = 3
            else:
                color = self.color_person  # Green for normal
                label = "Person"
                thickness = 2

            self._draw_detection(
                output,
                person,
                color,
                label=label,
                thickness=thickness,
            )

        # Draw proximity lines and pixel distances
        if proximity_analyzer is not None:
            for person in people:
                for vehicle in vehicles:
                    # Compute pixel distance
                    pixel_dist = proximity_analyzer.compute_pixel_distance(person, vehicle)
                    
                    # Only draw if too close (within threshold)
                    if pixel_dist <= proximity_analyzer.pixel_threshold:
                        is_close = (person.track_id, vehicle.track_id) in close_pairs
                        self._draw_proximity_line(output, person, vehicle, pixel_dist, is_close)

        # Draw depth thumbnail
        if self.show_depth and depth_map is not None:
            self._draw_depth_thumbnail(output, depth_map)

        # Draw FPS
        if self.show_fps:
            self._draw_fps(output, fps)

        # Draw warnings banner
        if warnings:
            self._draw_warnings(output, warnings)

        return output

    def _draw_detection(
        self,
        frame: np.ndarray,
        obj: TrackedObject,
        color: Tuple[int, int, int],
        label: str,
        thickness: int = 2,
    ) -> None:
        """Draw bounding box and label for detection."""
        x1, y1, x2, y2 = obj.bbox_xyxy.astype(int)

        # Draw box
        cv2.rectangle(frame, (x1, y1), (x2, y2), color, thickness)

        # Draw label
        if self.show_ids:
            text = f"{label} #{obj.track_id}"
        else:
            text = label

        # Add confidence
        text += f" {obj.confidence:.2f}"

        # Text background
        (text_w, text_h), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(frame, (x1, y1 - text_h - 4), (x1 + text_w, y1), color, -1)

        # Text
        cv2.putText(
            frame,
            text,
            (x1, y1 - 2),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            self.color_text,
            1,
        )

    def _draw_proximity_line(
        self,
        frame: np.ndarray,
        person: TrackedObject,
        vehicle: TrackedObject,
        pixel_dist: float,
        is_close: bool,
    ) -> None:
        """Draw line between person and vehicle with pixel distance."""
        p_center = tuple(map(int, person.center))
        v_center = tuple(map(int, vehicle.center))

        # Color based on whether it's triggered warning
        line_color = self.color_warning if is_close else (0, 165, 255)  # Red if close, orange otherwise
        
        # Draw dashed line
        self._draw_dashed_line(frame, p_center, v_center, line_color, 2)

        # Draw pixel distance at midpoint
        mid_x = (p_center[0] + v_center[0]) // 2
        mid_y = (p_center[1] + v_center[1]) // 2
        
        # Pixel distance text
        distance_text = f"{int(pixel_dist)}px"
        (text_w, text_h), _ = cv2.getTextSize(distance_text, cv2.FONT_HERSHEY_SIMPLEX, 0.8, 2)
        
        # Background rectangle
        cv2.rectangle(
            frame,
            (mid_x - text_w // 2 - 8, mid_y - text_h - 5),
            (mid_x + text_w // 2 + 8, mid_y + 5),
            (0, 0, 0),
            -1,
        )
        
        # Pixel distance text
        cv2.putText(
            frame,
            distance_text,
            (mid_x - text_w // 2, mid_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.8,
            (255, 255, 255),  # White
            2,
        )
        
        # Draw warning circle around person if triggered
        if is_close:
            cv2.circle(frame, p_center, 30, self.color_warning, 2)

    def _draw_dashed_line(
        self,
        frame: np.ndarray,
        pt1: Tuple[int, int],
        pt2: Tuple[int, int],
        color: Tuple[int, int, int],
        thickness: int,
        dash_length: int = 10,
    ) -> None:
        """Draw a dashed line."""
        dist = np.sqrt((pt2[0] - pt1[0]) ** 2 + (pt2[1] - pt1[1]) ** 2)
        dashes = int(dist / dash_length)

        for i in range(0, dashes, 2):
            start = (
                int(pt1[0] + (pt2[0] - pt1[0]) * i / dashes),
                int(pt1[1] + (pt2[1] - pt1[1]) * i / dashes),
            )
            end = (
                int(pt1[0] + (pt2[0] - pt1[0]) * (i + 1) / dashes),
                int(pt1[1] + (pt2[1] - pt1[1]) * (i + 1) / dashes),
            )
            cv2.line(frame, start, end, color, thickness)

    def _draw_depth_thumbnail(self, frame: np.ndarray, depth_map: np.ndarray) -> None:
        """Draw depth map thumbnail in corner."""
        # Resize depth map
        h, w = depth_map.shape
        size = self.depth_thumbnail_size
        aspect = w / h
        thumb_w = size
        thumb_h = int(size / aspect)

        depth_colored = cv2.applyColorMap(
            (depth_map * 255).astype(np.uint8), cv2.COLORMAP_MAGMA
        )
        depth_thumb = cv2.resize(depth_colored, (thumb_w, thumb_h))

        # Position in top-right corner
        frame_h, frame_w = frame.shape[:2]
        x_offset = frame_w - thumb_w - 10
        y_offset = 10

        # Add border
        cv2.rectangle(
            frame,
            (x_offset - 2, y_offset - 2),
            (x_offset + thumb_w + 2, y_offset + thumb_h + 2),
            self.color_text,
            2,
        )

        # Overlay thumbnail
        frame[y_offset : y_offset + thumb_h, x_offset : x_offset + thumb_w] = depth_thumb

        # Label
        cv2.putText(
            frame,
            "Depth",
            (x_offset, y_offset - 5),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.5,
            self.color_text,
            1,
        )

    def _draw_fps(self, frame: np.ndarray, fps: float) -> None:
        """Draw FPS counter."""
        text = f"FPS: {fps:.1f}"
        cv2.putText(
            frame,
            text,
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            1.0,
            self.color_text,
            2,
        )

    def _draw_warnings(self, frame: np.ndarray, warnings: List[str]) -> None:
        """Draw warning banner at top."""
        if not warnings:
            return

        frame_h, frame_w = frame.shape[:2]

        # Red banner
        banner_height = 50 + (len(warnings) - 1) * 25
        overlay = frame.copy()
        cv2.rectangle(overlay, (0, 0), (frame_w, banner_height), (0, 0, 200), -1)
        cv2.addWeighted(overlay, 0.7, frame, 0.3, 0, frame)

        # Warning text
        y_pos = 35
        for warning in warnings:
            cv2.putText(
                frame,
                f"⚠ {warning}",
                (20, y_pos),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.8,
                self.color_text,
                2,
            )
            y_pos += 25
