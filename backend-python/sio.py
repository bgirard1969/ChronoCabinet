import socketio

sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins="*")


async def emit_event(event: str, data: dict = None):
    """Emit a Socket.IO event to all connected clients."""
    await sio.emit(event, data or {})
