"""Object detection module using YOLO."""

from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np
from rich.console import Console
from ultralytics import YOLO

console = Console()


@dataclass
class Detection:
    """Single object detection."""

    bbox_xyxy: np.ndarray  # [x1, y1, x2, y2]
    confidence: float
    class_id: int
    class_name: str
    track_id: Optional[int] = None


class ObjectDetector:
    """YOLO-based object detector."""

    # COCO class IDs
    PERSON_CLASS = 0
    VEHICLE_CLASSES = {
        2: "car",
        3: "motorcycle",
        5: "bus",
        7: "truck",
        1: "bicycle",  # Sometimes useful proxy
    }

    def __init__(
        self,
        model_name: str = "yolov8n.pt",
        device: str = "cpu",
        conf_threshold: float = 0.25,
        iou_threshold: float = 0.45,
        imgsz: int = 640,
    ):
        """
        Initialize YOLO detector.

        Args:
            model_name: YOLO model name or path
            device: Device to run on ('cpu' or 'cuda')
            conf_threshold: Confidence threshold for detections
            iou_threshold: IOU threshold for NMS (lower = more detections kept)
            imgsz: Image size for inference (larger = better for distant objects)
        """
        self.model_name = model_name
        self.device = device
        self.conf_threshold = conf_threshold
        self.iou_threshold = iou_threshold
        self.imgsz = imgsz

        console.print(f"[cyan]Loading YOLO model: {model_name} on {device}...[/cyan]")
        self.model = YOLO(model_name)
        self.model.to(device)
        console.print("[green]YOLO model loaded successfully[/green]")

    def detect(self, frame: np.ndarray) -> Tuple[List[Detection], List[Detection]]:
        """
        Detect objects in frame.

        Args:
            frame: Input image (BGR format)

        Returns:
            Tuple of (person_detections, vehicle_detections)
        """
        # Run inference with aggressive settings
        results = self.model(
            frame, 
            conf=self.conf_threshold, 
            iou=self.iou_threshold,
            imgsz=self.imgsz,
            verbose=False
        )[0]

        people = []
        vehicles = []

        # Parse detections
        for box in results.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])
            bbox = box.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2]

            # Classify as person or vehicle
            if class_id == self.PERSON_CLASS:
                det = Detection(
                    bbox_xyxy=bbox,
                    confidence=confidence,
                    class_id=class_id,
                    class_name="person",
                )
                people.append(det)

            elif class_id in self.VEHICLE_CLASSES:
                class_name = self.VEHICLE_CLASSES[class_id]
                det = Detection(
                    bbox_xyxy=bbox,
                    confidence=confidence,
                    class_id=class_id,
                    class_name=class_name,
                )
                vehicles.append(det)

        return people, vehicles

    def get_bbox_center(self, bbox: np.ndarray) -> Tuple[float, float]:
        """
        Get center point of bounding box.

        Args:
            bbox: Bounding box [x1, y1, x2, y2]

        Returns:
            Tuple of (center_x, center_y)
        """
        return ((bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2)

    def get_bbox_area(self, bbox: np.ndarray) -> float:
        """
        Calculate bounding box area.

        Args:
            bbox: Bounding box [x1, y1, x2, y2]

        Returns:
            Area in pixels
        """
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        return width * height

    def get_bbox_aspect_ratio(self, bbox: np.ndarray) -> float:
        """
        Calculate height/width aspect ratio.

        Args:
            bbox: Bounding box [x1, y1, x2, y2]

        Returns:
            Aspect ratio (height/width)
        """
        width = bbox[2] - bbox[0]
        height = bbox[3] - bbox[1]
        if width > 0:
            return height / width
        return 0.0
