"""Simple WebSocket client for testing event streaming."""

import asyncio
import json

import websockets


async def test_websocket_connection():
    """Test connection to WebSocket event stream."""
    uri = "ws://localhost:8000/events"

    print(f"Connecting to {uri}...")

    try:
        async with websockets.connect(uri) as websocket:
            print("✓ Connected successfully!")
            print("Listening for events (press Ctrl+C to stop)...\n")

            # Send ping
            await websocket.send("ping")
            response = await websocket.recv()
            print(f"Ping response: {response}\n")

            # Listen for events
            while True:
                message = await websocket.recv()
                try:
                    event = json.loads(message)
                    print(f"📨 Event received:")
                    print(f"   Type: {event.get('type')}")
                    print(f"   Timestamp: {event.get('timestamp')}")
                    if event.get('type') == 'ProximityWarning':
                        print(f"   Person #{event.get('person_id')} near Vehicle #{event.get('vehicle_id')}")
                        print(f"   Duration: {event.get('duration_s'):.1f}s")
                    print()
                except json.JSONDecodeError:
                    print(f"Raw message: {message}")

    except ConnectionRefusedError:
        print("✗ Connection refused. Make sure the server is running:")
        print("  uvicorn src.server:app --host 0.0.0.0 --port 8000")
    except Exception as e:
        print(f"✗ Error: {e}")


if __name__ == "__main__":
    print("=== SiteOps WebSocket Test Client ===\n")
    asyncio.run(test_websocket_connection())
