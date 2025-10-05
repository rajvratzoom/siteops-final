"""FastAPI server for WebSocket event streaming."""

import asyncio
from typing import List, Set

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from rich.console import Console

console = Console()

# Global event queue for broadcasting
event_queue: asyncio.Queue = asyncio.Queue()
active_connections: Set[WebSocket] = set()

app = FastAPI(title="SiteOps Safety API")


class ConnectionManager:
    """Manages WebSocket connections."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """Add new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        console.print(f"[green]WebSocket connected. Total: {len(self.active_connections)}[/green]")

    def disconnect(self, websocket: WebSocket):
        """Remove WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        console.print(f"[yellow]WebSocket disconnected. Total: {len(self.active_connections)}[/yellow]")

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        if not self.active_connections:
            return

        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                disconnected.append(connection)

        # Clean up disconnected clients
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@app.get("/")
async def root():
    """Root endpoint."""
    return {"status": "ok", "service": "SiteOps Safety API"}


@app.get("/healthz")
async def health():
    """Health check endpoint."""
    return {"status": "healthy", "connections": len(manager.active_connections)}


@app.get("/status")
async def status():
    """Status endpoint with recent events."""
    # This would integrate with AlertManager in production
    return {
        "status": "running",
        "websocket_connections": len(manager.active_connections),
        "recent_events": [],
    }


@app.websocket("/events")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for streaming events.

    Clients connect to ws://localhost:8000/events and receive
    JSON events in real-time.
    """
    await manager.connect(websocket)

    try:
        # Keep connection alive and receive events
        while True:
            # Wait for messages from client (ping/pong)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=1.0)
                # Echo back for testing
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # No message received, continue
                pass

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        console.print(f"[red]WebSocket error: {e}[/red]")
        manager.disconnect(websocket)


async def broadcast_event(event: dict):
    """
    Broadcast event to all WebSocket clients.

    This function is called from the main application loop.

    Args:
        event: Event dictionary to broadcast
    """
    await manager.broadcast(event)


# Export for external use
def get_broadcast_function():
    """Get the broadcast function for external use."""
    return broadcast_event


def get_manager():
    """Get the connection manager."""
    return manager
