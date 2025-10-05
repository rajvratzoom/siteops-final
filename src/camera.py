"""Camera capture module for video input."""

import time
from typing import Generator, Optional, Tuple, Union

import cv2
import numpy as np
from rich.console import Console

console = Console()


class Camera:
    """Video capture handler with OpenCV."""

    def __init__(
        self,
        source: Union[int, str] = 0,
        width: int = 1280,
        height: int = 720,
        fps: int = 20,
    ):
        """
        Initialize camera capture.

        Args:
            source: Camera index or video file path
            width: Frame width
            height: Frame height
            fps: Target frames per second
        """
        self.source = source
        self.width = width
        self.height = height
        self.target_fps = fps
        self.cap: Optional[cv2.VideoCapture] = None
        self.frame_count = 0
        self.start_time = time.monotonic()

    def open(self) -> bool:
        """
        Open video capture device.

        Returns:
            True if successful
        """
        self.cap = cv2.VideoCapture(self.source)
        if not self.cap.isOpened():
            console.print(f"[red]Failed to open camera source: {self.source}[/red]")
            return False

        # Set resolution
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.height)
        self.cap.set(cv2.CAP_PROP_FPS, self.target_fps)

        # Verify settings
        actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        actual_fps = int(self.cap.get(cv2.CAP_PROP_FPS))

        console.print(f"[green]Camera opened:[/green] {actual_width}x{actual_height} @ {actual_fps} FPS")
        return True

    def read(self) -> Tuple[bool, Optional[np.ndarray], float]:
        """
        Read a single frame.

        Returns:
            Tuple of (success, frame, timestamp)
        """
        if self.cap is None:
            return False, None, 0.0

        ret, frame = self.cap.read()
        timestamp = time.monotonic()

        if ret:
            self.frame_count += 1

        return ret, frame, timestamp

    def frames(self) -> Generator[Tuple[np.ndarray, float, int], None, None]:
        """
        Generate frames from camera.

        Yields:
            Tuple of (frame, timestamp, frame_number)
        """
        if not self.open():
            return

        try:
            while True:
                ret, frame, timestamp = self.read()
                if not ret:
                    console.print("[yellow]End of video stream[/yellow]")
                    break

                yield frame, timestamp, self.frame_count

        except KeyboardInterrupt:
            console.print("\n[yellow]Camera capture interrupted by user[/yellow]")

        finally:
            self.release()

    def release(self) -> None:
        """Release camera resources."""
        if self.cap is not None:
            self.cap.release()
            self.cap = None
            console.print("[green]Camera released[/green]")

    def get_fps(self) -> float:
        """
        Calculate actual FPS.

        Returns:
            Current frames per second
        """
        elapsed = time.monotonic() - self.start_time
        if elapsed > 0:
            return self.frame_count / elapsed
        return 0.0

    def __enter__(self):
        """Context manager entry."""
        self.open()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.release()
