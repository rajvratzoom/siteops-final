"""Main application entry point with CLI."""

import asyncio
import sys
import time
from pathlib import Path
from typing import List, Optional, Tuple, Union

import cv2
import numpy as np
import typer
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from .alerts import AlertManager
from .camera import Camera
from .config import Config
from .depth import DepthEstimator
from .detection import ObjectDetector
from .fall_detection import FallDetector
from .headcount import HeadcountMonitor
from .overlay import OverlayRenderer
from .proximity import ProximityAnalyzer
from .registry import VehicleRegistry
from .tracking import ObjectTracker

console = Console()
app = typer.Typer()


class SafetyMonitor:
    """Main safety monitoring pipeline."""

    def __init__(
        self,
        video_source: Union[int, str] = 0,
        device: str = "cpu",
        depth_model: str = "midas",
        demo_fall: bool = False,
        record_path: Optional[str] = None,
        expected_people: int = 0,
    ):
        """
        Initialize safety monitor.

        Args:
            video_source: Camera index or video file
            device: Device for ML models ('cpu' or 'cuda')
            depth_model: Depth model type ('midas' or 'zoe')
            demo_fall: Enable fall detection demo
            record_path: Optional path to record video
            expected_people: Expected number of active people on site
        """
        # Load config
        self.config = Config()
        settings = self.config.settings

        # Override settings
        settings.video_source = video_source
        settings.device = device

        # Initialize components
        console.print("[cyan]Initializing SiteOps Safety Monitor...[/cyan]")

        self.camera = Camera(
            source=settings.video_source,
            width=settings.width,
            height=settings.height,
            fps=settings.target_fps,
        )

        self.detector = ObjectDetector(
            model_name="yolov8n.pt",
            device=settings.device,
            conf_threshold=0.01,  # Ultra-low confidence threshold
            iou_threshold=0.1,    # Very low IOU = keep more overlapping detections
            imgsz=1280,           # Larger image size = better for distant objects
        )

        self.depth_estimator = DepthEstimator(
            model_type=depth_model,
            device=settings.device,
        )

        self.tracker = ObjectTracker(
            max_age=settings.tracking.max_age,
            min_hits=settings.tracking.min_hits,
            iou_threshold=settings.tracking.iou_threshold,
        )

        self.proximity_analyzer = ProximityAnalyzer(
            pixel_threshold=settings.proximity.pixel_threshold,
            min_duration_s=settings.proximity.min_duration_s,
            cooldown_s=settings.proximity.cooldown_s,
        )

        self.overlay = OverlayRenderer(
            show_depth=settings.overlay.show_depth,
            show_fps=settings.overlay.show_fps,
            show_ids=settings.overlay.show_ids,
            depth_thumbnail_size=settings.overlay.depth_thumbnail_size,
        )

        # Alert manager
        log_dir = self.config.base_path / "logs"
        self.alert_manager = AlertManager(log_dir)

        # Vehicle registry
        registry_path = self.config.base_path / "data" / "vehicles.json"
        self.registry = VehicleRegistry(registry_path)

        # Headcount monitor
        self.headcount_monitor = HeadcountMonitor(
            expected_active_count=expected_people,
            check_interval_s=300.0,    # Check every 5 minutes
            sample_window_s=300.0,     # Use 5-minute window for mode calculation
        )
        if expected_people > 0:
            console.print(
                f"[cyan]Headcount monitoring enabled: expecting {expected_people} people (5-minute intervals)[/cyan]"
            )
        else:
            console.print("[dim]Headcount monitoring enabled (expected count: 0, set with --expected-people)[/dim]")

        # Fall detector
        self.fall_detector = FallDetector(
            aspect_ratio_threshold=settings.fall.aspect_ratio_threshold,
            min_duration_s=settings.fall.min_duration_s,
            cooldown_s=10.0,
        )

        # State
        self.demo_fall = demo_fall
        self.record_path = record_path
        self.video_writer = None
        self.running = False

        # Hotkey state
        self.fake_vehicle_bbox: Optional[np.ndarray] = None
        self.simulate_fall = False

        console.print("[green]✓ All components initialized[/green]")

    def run(self):
        """Run the main monitoring loop."""
        console.print("\n[bold green]Starting Safety Monitor[/bold green]")
        console.print("Hotkeys: [V] toggle fake vehicle | [F] simulate fall | [R] record | [Q] quit")
        console.print(f"Headcount: Expecting {self.headcount_monitor.expected_active_count} people, checking every 5 min\n")

        self.running = True
        fps_smoothing = 0.9
        current_fps = 0.0

        try:
            for frame, timestamp, frame_number in self.camera.frames():
                if not self.running:
                    break

                loop_start = time.time()

                # 1. Object detection
                people_det, vehicles_det = self.detector.detect(frame)
                
                # Debug: Print vehicle detections
                if vehicles_det:
                    for v in vehicles_det:
                        console.print(f"[cyan]🚛 Vehicle detected:[/cyan] {v.class_name} (confidence: {v.confidence:.2%})")

                # Add fake vehicle if hotkey pressed
                if self.fake_vehicle_bbox is not None:
                    from .detection import Detection
                    fake_vehicle = Detection(
                        bbox_xyxy=self.fake_vehicle_bbox,
                        confidence=0.99,
                        class_id=7,
                        class_name="truck",
                    )
                    vehicles_det.append(fake_vehicle)

                # 2. Depth estimation
                depth_map = self.depth_estimator.infer_depth(frame)

                # 3. Tracking
                tracked_people = self.tracker.track_people(people_det)
                tracked_vehicles = self.tracker.track_vehicles(vehicles_det)

                # 4. Proximity analysis
                warnings = self.proximity_analyzer.update(
                    tracked_people,
                    tracked_vehicles,
                    depth_map,
                    timestamp,
                )

                # 5. Fall detection (if enabled)
                fallen_person_ids = set()
                if self.demo_fall:
                    # Use the new FallDetector with duration tracking
                    fallen_person_ids, new_fall_alerts = self.fall_detector.update(
                        tracked_people,
                        timestamp,
                    )
                    # Emit alerts for newly detected falls
                    for person_id, location, duration in new_fall_alerts:
                        self.alert_manager.emit_fall_event(
                            person_id=person_id,
                            location=location,
                            frame_number=frame_number,
                            confidence=1.0,
                        )

                # Simulated fall (hotkey F)
                if self.simulate_fall and tracked_people:
                    person = tracked_people[0]
                    fallen_person_ids.add(person.track_id)
                    self.alert_manager.emit_fall_event(
                        person_id=person.track_id,
                        location=person.center,
                        frame_number=frame_number,
                        confidence=1.0,
                    )
                    self.simulate_fall = False

                # 6. Emit proximity warnings
                warning_messages = []
                for warning in warnings:
                    self.alert_manager.emit_proximity_warning(warning, frame_number)
                    warning_messages.append(
                        f"Person #{warning.person_id} near Vehicle #{warning.vehicle_id}"
                    )

                # Add fall warnings to messages
                for fallen_id in fallen_person_ids:
                    warning_messages.append(f"⚠️ PERSON DOWN #{fallen_id}")

                # Headcount monitoring
                people_count = len(tracked_people)
                current_time_monotonic = time.monotonic()
                self.headcount_monitor.record_count(people_count, current_time_monotonic)

                # Check for headcount mismatch every 5 minutes
                if self.headcount_monitor.should_check(current_time_monotonic):
                    has_mismatch, detected, mode, expected = self.headcount_monitor.check_headcount(
                        current_time_monotonic
                    )
                    if has_mismatch:
                        self.alert_manager.emit_headcount_mismatch(
                            detected_count=detected,
                            expected_count=expected,
                            mode_count=mode,
                        )
                        warning_messages.append(
                            f"⚠️ HEADCOUNT MISMATCH: Expected {expected}, Detected {mode}"
                        )

                # 7. Render overlay
                display_frame = self.overlay.render(
                    frame=frame,
                    people=tracked_people,
                    vehicles=tracked_vehicles,
                    depth_map=depth_map,
                    proximity_analyzer=self.proximity_analyzer,
                    fps=current_fps,
                    warnings=warning_messages,
                    fallen_person_ids=fallen_person_ids,
                )

                # 8. Display
                cv2.imshow("SiteOps Safety Monitor", display_frame)

                # 9. Record if enabled
                if self.video_writer is not None:
                    self.video_writer.write(display_frame)

                # Calculate FPS
                loop_time = time.time() - loop_start
                instant_fps = 1.0 / loop_time if loop_time > 0 else 0
                current_fps = fps_smoothing * current_fps + (1 - fps_smoothing) * instant_fps

                # Handle keyboard input
                key = cv2.waitKey(1) & 0xFF
                if not self._handle_keypress(key, frame):
                    break

        except KeyboardInterrupt:
            console.print("\n[yellow]Interrupted by user[/yellow]")

        finally:
            self._cleanup()

    def _handle_keypress(self, key: int, frame: np.ndarray) -> bool:
        """
        Handle keyboard input.

        Args:
            key: Key code
            frame: Current frame

        Returns:
            True to continue, False to quit
        """
        if key == ord("q") or key == 27:  # Q or ESC
            console.print("[yellow]Quitting...[/yellow]")
            return False

        elif key == ord("v"):
            # Toggle fake vehicle
            if self.fake_vehicle_bbox is None:
                # Create fake vehicle in center
                h, w = frame.shape[:2]
                cx, cy = w // 2, h // 2
                self.fake_vehicle_bbox = np.array([cx - 100, cy - 50, cx + 100, cy + 50])
                console.print("[cyan]Fake vehicle ON[/cyan]")
            else:
                self.fake_vehicle_bbox = None
                console.print("[cyan]Fake vehicle OFF[/cyan]")

        elif key == ord("f"):
            # Simulate fall
            self.simulate_fall = True
            console.print("[cyan]Simulating fall...[/cyan]")

        elif key == ord("r"):
            # Toggle recording
            if self.video_writer is None:
                self._start_recording(frame)
            else:
                self._stop_recording()

        return True

    def _start_recording(self, frame: np.ndarray):
        """Start video recording."""
        from datetime import datetime

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"run_{timestamp}.avi"
        filepath = self.config.base_path / "logs" / filename

        h, w = frame.shape[:2]
        fourcc = cv2.VideoWriter_fourcc(*"XVID")
        self.video_writer = cv2.VideoWriter(str(filepath), fourcc, 20.0, (w, h))

        console.print(f"[green]Recording started: {filepath}[/green]")

    def _stop_recording(self):
        """Stop video recording."""
        if self.video_writer is not None:
            self.video_writer.release()
            self.video_writer = None
            console.print("[yellow]Recording stopped[/yellow]")

    def _cleanup(self):
        """Clean up resources."""
        console.print("\n[cyan]Cleaning up...[/cyan]")

        self.camera.release()
        cv2.destroyAllWindows()

        if self.video_writer is not None:
            self.video_writer.release()

        self.alert_manager.close()
        self.registry.save_registry()

        console.print("[green]✓ Cleanup complete[/green]")


@app.command()
def main(
    video_source: str = typer.Option("0", "--video-source", help="Camera index or video file path"),
    device: str = typer.Option("cpu", "--device", help="Device: cpu or cuda"),
    depth: str = typer.Option("midas", "--depth", help="Depth model: midas or zoe"),
    demo_fall: bool = typer.Option(False, "--demo-fall", help="Enable fall detection demo"),
    record: Optional[str] = typer.Option(None, "--record", help="Record output to file"),
    calibrate: bool = typer.Option(False, "--calibrate", help="Run calibration mode"),
    expected_people: int = typer.Option(0, "--expected-people", help="Expected number of active people on site"),
):
    """
    SiteOps Safety Monitor - ML-powered construction site safety monitoring.

    Detects people and vehicles, estimates depth, tracks objects, and raises
    proximity warnings when people stay too close to machinery.
    
    Headcount monitoring: Checks every 5 minutes if detected people count matches expected active workers.
    """
    # Parse video source
    try:
        video_src = int(video_source)
    except ValueError:
        video_src = video_source

    if calibrate:
        console.print("[yellow]Calibration mode not yet implemented[/yellow]")
        console.print("Future: capture checkerboard or prompt for focal length")
        return

    # Create and run monitor
    monitor = SafetyMonitor(
        video_source=video_src,
        device=device,
        depth_model=depth,
        demo_fall=demo_fall,
        record_path=record,
        expected_people=expected_people,
    )

    monitor.run()


if __name__ == "__main__":
    app()
