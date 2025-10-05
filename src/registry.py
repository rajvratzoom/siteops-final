"""Vehicle registry management."""

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from rich.console import Console

console = Console()


@dataclass
class VehicleEntry:
    """Vehicle registry entry."""

    id: int
    label: str
    status: str  # active, idle, off_site
    last_seen: Optional[str] = None
    location: Optional[Tuple[float, float]] = None


class VehicleRegistry:
    """Manages vehicle registry."""

    def __init__(self, registry_path: Path):
        """
        Initialize vehicle registry.

        Args:
            registry_path: Path to vehicles.json file
        """
        self.registry_path = registry_path
        self.vehicles: Dict[int, VehicleEntry] = {}
        self.label_to_id: Dict[str, List[int]] = {}
        self.next_id = 1000  # Start runtime IDs at 1000

        self._load_registry()

    def _load_registry(self) -> None:
        """Load registry from JSON file."""
        if not self.registry_path.exists():
            console.print(f"[yellow]Registry not found: {self.registry_path}[/yellow]")
            return

        try:
            with open(self.registry_path, "r") as f:
                data = json.load(f)

            for item in data:
                entry = VehicleEntry(
                    id=item["id"],
                    label=item["label"],
                    status=item["status"],
                    last_seen=item.get("last_seen"),
                    location=item.get("location"),
                )
                self.vehicles[entry.id] = entry

                # Build label index
                if entry.label not in self.label_to_id:
                    self.label_to_id[entry.label] = []
                self.label_to_id[entry.label].append(entry.id)

            # Update next_id
            if self.vehicles:
                self.next_id = max(self.vehicles.keys()) + 1

            console.print(f"[green]Loaded {len(self.vehicles)} vehicles from registry[/green]")

        except Exception as e:
            console.print(f"[red]Error loading registry: {e}[/red]")

    def save_registry(self) -> None:
        """Save registry to JSON file."""
        try:
            data = []
            for vehicle in self.vehicles.values():
                data.append({
                    "id": vehicle.id,
                    "label": vehicle.label,
                    "status": vehicle.status,
                    "last_seen": vehicle.last_seen,
                    "location": vehicle.location,
                })

            self.registry_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.registry_path, "w") as f:
                json.dump(data, f, indent=2)

        except Exception as e:
            console.print(f"[red]Error saving registry: {e}[/red]")

    def match_vehicle(
        self,
        label: str,
        location: Tuple[float, float],
    ) -> int:
        """
        Match detected vehicle to registry entry.

        Args:
            label: Vehicle class label (truck, car, etc.)
            location: Current location (x, y)

        Returns:
            Vehicle ID
        """
        # Try to find existing vehicle with this label
        if label in self.label_to_id:
            candidates = self.label_to_id[label]

            # Find closest by last known location
            best_id = None
            best_dist = float("inf")

            for vid in candidates:
                vehicle = self.vehicles[vid]
                if vehicle.location is not None:
                    dist = (
                        (location[0] - vehicle.location[0]) ** 2 +
                        (location[1] - vehicle.location[1]) ** 2
                    ) ** 0.5

                    if dist < best_dist:
                        best_dist = dist
                        best_id = vid

            if best_id is not None and best_dist < 500:  # Threshold in pixels
                # Update existing entry
                self.update_vehicle(best_id, location)
                return best_id

        # Create new runtime entry
        new_id = self.next_id
        self.next_id += 1

        entry = VehicleEntry(
            id=new_id,
            label=label,
            status="active",
            last_seen=datetime.now().isoformat(),
            location=location,
        )

        self.vehicles[new_id] = entry

        if label not in self.label_to_id:
            self.label_to_id[label] = []
        self.label_to_id[label].append(new_id)

        console.print(f"[cyan]New vehicle detected: {label} (ID: {new_id})[/cyan]")

        return new_id

    def update_vehicle(
        self,
        vehicle_id: int,
        location: Optional[Tuple[float, float]] = None,
    ) -> None:
        """
        Update vehicle entry.

        Args:
            vehicle_id: Vehicle ID
            location: New location
        """
        if vehicle_id in self.vehicles:
            vehicle = self.vehicles[vehicle_id]
            vehicle.last_seen = datetime.now().isoformat()
            if location is not None:
                vehicle.location = location

    def get_vehicle(self, vehicle_id: int) -> Optional[VehicleEntry]:
        """Get vehicle by ID."""
        return self.vehicles.get(vehicle_id)

    def get_all_vehicles(self) -> List[VehicleEntry]:
        """Get all registered vehicles."""
        return list(self.vehicles.values())
