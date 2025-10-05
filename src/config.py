"""Configuration management for SiteOps Safety MVP."""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import yaml
from pydantic import BaseModel, Field


class ProximityConfig(BaseModel):
    """Proximity detection configuration."""

    pixel_threshold: float = 200.0  # Pixel distance threshold for "too close"
    min_duration_s: float = 2.0
    cooldown_s: float = 5.0


class FallConfig(BaseModel):
    """Fall detection configuration."""

    enabled: bool = True
    min_duration_s: float = 1.5
    aspect_ratio_threshold: float = 1.5


class ClassConfig(BaseModel):
    """Object class configuration."""

    person: int = 0
    vehicle_labels: List[str] = Field(default_factory=lambda: ["truck", "car", "bus"])


class TrackingConfig(BaseModel):
    """Tracking algorithm configuration."""

    max_age: int = 30
    min_hits: int = 3
    iou_threshold: float = 0.3


class OverlayConfig(BaseModel):
    """Overlay visualization configuration."""

    show_depth: bool = True
    show_fps: bool = True
    show_ids: bool = True
    depth_thumbnail_size: int = 200


class Settings(BaseModel):
    """Main application settings."""

    video_source: Union[int, str] = 0
    width: int = 1280
    height: int = 720
    target_fps: int = 20
    device: str = "cpu"

    proximity: ProximityConfig = Field(default_factory=ProximityConfig)
    fall: FallConfig = Field(default_factory=FallConfig)
    classes: ClassConfig = Field(default_factory=ClassConfig)
    tracking: TrackingConfig = Field(default_factory=TrackingConfig)
    overlay: OverlayConfig = Field(default_factory=OverlayConfig)


class Config:
    """Global configuration manager."""

    def __init__(self, config_path: Optional[Path] = None):
        """
        Initialize configuration.

        Args:
            config_path: Path to settings.yaml file
        """
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "settings.yaml"

        self.config_path = config_path
        self.settings = self._load_settings()

    def _load_settings(self) -> Settings:
        """Load settings from YAML file."""
        if not self.config_path.exists():
            # Return defaults if file doesn't exist
            return Settings()

        with open(self.config_path, "r") as f:
            data = yaml.safe_load(f)

        return Settings(**data)

    def save(self) -> None:
        """Save current settings to file."""
        self.config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.config_path, "w") as f:
            yaml.dump(self.settings.model_dump(), f, default_flow_style=False)

    @property
    def base_path(self) -> Path:
        """Return base project path."""
        return self.config_path.parent.parent

    def get_calibration(self) -> Dict[str, Any]:
        """Load camera calibration data."""
        calib_path = self.base_path / "config" / "calibration.json"
        if not calib_path.exists():
            return {"calibrated": False}

        with open(calib_path, "r") as f:
            return json.load(f)

    def save_calibration(self, data: Dict[str, Any]) -> None:
        """Save camera calibration data."""
        calib_path = self.base_path / "config" / "calibration.json"
        calib_path.parent.mkdir(parents=True, exist_ok=True)
        with open(calib_path, "w") as f:
            json.dump(data, f, indent=2)


# Global config instance
_config: Optional[Config] = None


def get_config() -> Config:
    """Get or create global config instance."""
    global _config
    if _config is None:
        _config = Config()
    return _config
