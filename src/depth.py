"""Depth estimation module using MiDaS or ZoeDepth."""

import torch
import numpy as np
import cv2
from typing import Optional
from rich.console import Console

console = Console()


class DepthEstimator:
    """Monocular depth estimation."""

    def __init__(
        self,
        model_type: str = "midas",
        device: str = "cpu",
    ):
        """
        Initialize depth estimator.

        Args:
            model_type: 'midas' or 'zoe' (ZoeDepth requires additional setup)
            device: Device to run on ('cpu' or 'cuda')
        """
        self.model_type = model_type
        self.device = device
        self.model = None
        self.transform = None

        console.print(f"[cyan]Loading {model_type.upper()} depth model on {device}...[/cyan]")
        self._load_model()
        console.print("[green]Depth model loaded successfully[/green]")

    def _load_model(self):
        """Load the depth estimation model."""
        if self.model_type == "midas":
            # Use MiDaS small model for faster inference
            self.model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
            self.transform = midas_transforms.small_transform

        elif self.model_type == "zoe":
            try:
                # Try to load ZoeDepth (requires: pip install zoedepth)
                # Note: ZoeDepth is built on MiDaS and requires additional dependencies
                import zoedepth
                self.model = torch.hub.load("isl-org/ZoeDepth", "ZoeD_NK", pretrained=True)
                # ZoeDepth uses similar transforms to MiDaS
                midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms")
                self.transform = midas_transforms.small_transform
            except Exception as e:
                console.print(f"[yellow]Failed to load ZoeDepth: {e}[/yellow]")
                console.print("[yellow]Falling back to MiDaS...[/yellow]")
                self.model_type = "midas"
                self._load_model()
                return

        self.model.to(self.device)
        self.model.eval()

    def infer_depth(self, frame: np.ndarray) -> np.ndarray:
        """
        Estimate depth map from RGB frame.

        Args:
            frame: Input image in BGR format (OpenCV)

        Returns:
            Normalized depth map (H, W) with values in [0, 1]
            where 0 = far, 1 = close
        """
        # Convert BGR to RGB
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Prepare input
        with torch.no_grad():
            input_batch = self.transform(img_rgb).to(self.device)
            prediction = self.model(input_batch)

            # Resize to original size
            prediction = torch.nn.functional.interpolate(
                prediction.unsqueeze(1),
                size=frame.shape[:2],
                mode="bicubic",
                align_corners=False,
            ).squeeze()

        depth_map = prediction.cpu().numpy()

        # Normalize to [0, 1] where higher values = closer
        # Invert so that close objects have high values
        depth_map = depth_map.max() - depth_map
        depth_min = depth_map.min()
        depth_max = depth_map.max()

        if depth_max - depth_min > 0:
            depth_map = (depth_map - depth_min) / (depth_max - depth_min)
        else:
            depth_map = np.zeros_like(depth_map)

        return depth_map.astype(np.float32)

    def get_bbox_depth(self, depth_map: np.ndarray, bbox: np.ndarray) -> float:
        """
        Get average depth within bounding box.

        Args:
            depth_map: Full depth map
            bbox: Bounding box [x1, y1, x2, y2]

        Returns:
            Mean depth value in [0, 1]
        """
        x1, y1, x2, y2 = bbox.astype(int)

        # Clip to image bounds
        h, w = depth_map.shape
        x1 = max(0, min(x1, w - 1))
        x2 = max(0, min(x2, w - 1))
        y1 = max(0, min(y1, h - 1))
        y2 = max(0, min(y2, h - 1))

        if x2 <= x1 or y2 <= y1:
            return 0.0

        # Extract region
        region = depth_map[y1:y2, x1:x2]

        if region.size == 0:
            return 0.0

        return float(np.mean(region))

    def visualize_depth(self, depth_map: np.ndarray) -> np.ndarray:
        """
        Create colorized depth visualization.

        Args:
            depth_map: Normalized depth map

        Returns:
            BGR image for display
        """
        # Apply colormap
        depth_colored = cv2.applyColorMap(
            (depth_map * 255).astype(np.uint8),
            cv2.COLORMAP_MAGMA
        )
        return depth_colored
