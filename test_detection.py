#!/usr/bin/env python3
"""Quick test script to check truck detection capabilities."""

import cv2
import numpy as np
from src.detection import ObjectDetector
from rich.console import Console

console = Console()


def test_yolo_classes():
    """Check what classes YOLO can detect."""
    console.print("\n[cyan]YOLOv8 Vehicle Classes:[/cyan]")
    
    vehicle_classes = {
        2: "car",
        3: "motorcycle", 
        5: "bus",
        7: "truck",
        1: "bicycle",
    }
    
    for class_id, name in vehicle_classes.items():
        console.print(f"  • Class {class_id}: {name}")
    
    console.print("\n[green]✓ All these vehicles will be detected![/green]\n")


def test_camera_detection():
    """Test detection on live camera."""
    console.print("[cyan]Testing live camera detection...[/cyan]")
    console.print("Point your camera at:")
    console.print("  • Toy vehicles")
    console.print("  • Pictures of trucks/cars on your phone")
    console.print("  • Vehicle images on your screen")
    console.print("\nPress 'q' to quit\n")
    
    # Initialize detector
    detector = ObjectDetector(model_name="yolov8n.pt", device="cpu")
    
    # Open camera
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        console.print("[red]Camera not accessible. Grant permissions in System Settings.[/red]")
        return
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        # Detect objects
        people, vehicles = detector.detect(frame)
        
        # Draw detections
        for person in people:
            x1, y1, x2, y2 = person.bbox_xyxy.astype(int)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, f"Person {person.confidence:.2f}", 
                       (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        for vehicle in vehicles:
            x1, y1, x2, y2 = vehicle.bbox_xyxy.astype(int)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
            label = f"{vehicle.class_name.upper()} {vehicle.confidence:.2f}"
            cv2.putText(frame, label, 
                       (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 0), 2)
            
            # Print to console
            console.print(f"[green]✓ Detected {vehicle.class_name}![/green] Confidence: {vehicle.confidence:.2%}")
        
        # Show counts
        info = f"People: {len(people)} | Vehicles: {len(vehicles)}"
        cv2.putText(frame, info, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        cv2.imshow("Truck Detection Test (press Q to quit)", frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break
    
    cap.release()
    cv2.destroyAllWindows()
    console.print("\n[green]Test complete![/green]")


def main():
    """Run detection tests."""
    console.print("\n[bold cyan]🚛 Truck Detection Test[/bold cyan]\n")
    
    # Show available classes
    test_yolo_classes()
    
    # Ask user what to test
    console.print("Choose test:")
    console.print("  1. Test with live camera")
    console.print("  2. Just show detected classes (no camera)")
    
    try:
        choice = input("\nEnter choice (1 or 2): ").strip()
        
        if choice == "1":
            test_camera_detection()
        elif choice == "2":
            console.print("\n[green]YOLO can detect: car, truck, bus, motorcycle, bicycle[/green]")
            console.print("[yellow]Run the full app to test: python -m src.main[/yellow]\n")
        else:
            console.print("[yellow]Invalid choice. Run script again.[/yellow]")
            
    except KeyboardInterrupt:
        console.print("\n[yellow]Cancelled[/yellow]")


if __name__ == "__main__":
    main()
