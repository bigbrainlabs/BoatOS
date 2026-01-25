#!/usr/bin/env python3
"""
BoatOS Remote Control Server
WebSocket-Server der Touch-Events vom Tablet empfängt
und an das virtuelle Input-Device weiterleitet
"""
import asyncio
import websockets
import json
import logging
import subprocess
import base64
import os
import tempfile
from typing import Set
from virtual_input import VirtualTouchDevice

# Logging konfigurieren
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Globale Sets für verbundene Clients
connected_clients: Set[websockets.WebSocketServerProtocol] = set()

# Virtuelles Touch-Device
virtual_device = None

# Screenshot cache
screenshot_cache = None
screenshot_timestamp = 0
SCREENSHOT_CACHE_DURATION = 1.0  # Cache screenshot for 1 second


async def capture_screenshot():
    """Capture screenshot of the display"""
    global screenshot_cache, screenshot_timestamp

    # Return cached screenshot if recent enough
    current_time = asyncio.get_event_loop().time()
    if screenshot_cache and (current_time - screenshot_timestamp) < SCREENSHOT_CACHE_DURATION:
        logger.debug("Returning cached screenshot")
        return screenshot_cache

    logger.info("Capturing new screenshot...")
    try:
        # Create temp file path (grim will create the file)
        with tempfile.NamedTemporaryFile(suffix='.png', delete=True) as tmp_file:
            tmp_path = tmp_file.name
        # File is now deleted, just have the path

        # Use grim for Wayland screenshot - scale to 50% to reduce size
        screenshot_env = os.environ.copy()
        screenshot_env['WAYLAND_DISPLAY'] = 'wayland-0'
        screenshot_env['XDG_RUNTIME_DIR'] = '/run/user/1000'

        logger.info(f"Screenshot env: WAYLAND_DISPLAY={screenshot_env.get('WAYLAND_DISPLAY')}, XDG_RUNTIME_DIR={screenshot_env.get('XDG_RUNTIME_DIR')}")

        result = subprocess.run(
            ['grim', '-s', '0.5', tmp_path],
            capture_output=True,
            timeout=2,
            env=screenshot_env
        )

        # Log stderr for debugging
        if result.stderr:
            stderr_msg = result.stderr.decode().strip()
            if stderr_msg:
                logger.info(f"scrot stderr: {stderr_msg}")

        if result.returncode == 0 and os.path.exists(tmp_path):
            # Read and encode screenshot
            with open(tmp_path, 'rb') as f:
                screenshot_data = f.read()

            file_size = len(screenshot_data)
            logger.info(f"Screenshot captured: {file_size / 1024:.1f}KB")

            # Don't clean up yet if file is empty for debugging
            if file_size == 0:
                logger.error(f"Screenshot file is empty! Path: {tmp_path}")
                logger.error(f"scrot returncode: {result.returncode}")
                # Check if file exists and size
                if os.path.exists(tmp_path):
                    stat_info = os.stat(tmp_path)
                    logger.error(f"File stat: size={stat_info.st_size}, mode={oct(stat_info.st_mode)}")
                return None

            # Clean up
            os.unlink(tmp_path)

            # Encode as base64
            screenshot_base64 = base64.b64encode(screenshot_data).decode('utf-8')
            logger.info(f"Screenshot encoded: {len(screenshot_base64) / 1024:.1f}KB base64")

            # Update cache
            screenshot_cache = screenshot_base64
            screenshot_timestamp = current_time

            return screenshot_base64
        else:
            stderr_msg = result.stderr.decode() if result.stderr else 'Unknown error'
            logger.error(f"Screenshot failed (returncode {result.returncode}): {stderr_msg}")
            return None

    except subprocess.TimeoutExpired:
        logger.error("Screenshot timed out")
        return None
    except Exception as e:
        logger.error(f"Error capturing screenshot: {e}")
        return None
    finally:
        # Cleanup
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass


async def handle_touch_event(data: dict):
    """Verarbeitet Touch-Events und leitet sie an das virtuelle Device weiter"""
    global virtual_device

    if not virtual_device:
        logger.error("Virtual device not initialized")
        return

    try:
        event_type = data.get('type')
        action = data.get('action')

        if event_type != 'touch':
            logger.warning(f"Unknown event type: {event_type}")
            return

        # Koordinaten aus normalisierten Werten (0-1) in Pixel umrechnen
        norm_x = data.get('x', 0.5)
        norm_y = data.get('y', 0.5)

        x = int(norm_x * VirtualTouchDevice.SCREEN_WIDTH)
        y = int(norm_y * VirtualTouchDevice.SCREEN_HEIGHT)

        # Touch-Action ausführen
        if action == 'down':
            logger.info(f"Touch DOWN: norm({norm_x:.3f}, {norm_y:.3f}) -> px({x}, {y})")
            virtual_device.touch_down(x, y)
        elif action == 'move':
            logger.debug(f"Touch MOVE: norm({norm_x:.3f}, {norm_y:.3f}) -> px({x}, {y})")
            virtual_device.touch_move(x, y)
        elif action == 'up':
            logger.info(f"Touch UP")
            virtual_device.touch_up()
        else:
            logger.warning(f"Unknown touch action: {action}")

    except Exception as e:
        logger.error(f"Error handling touch event: {e}")


async def handle_client(websocket: websockets.WebSocketServerProtocol):
    """Behandelt einen verbundenen Client"""
    # Client registrieren
    connected_clients.add(websocket)
    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    logger.info(f"Client connected: {client_id} (Total: {len(connected_clients)})")

    try:
        # Willkommensnachricht senden
        await websocket.send(json.dumps({
            'type': 'welcome',
            'message': 'Connected to BoatOS Remote Control',
            'screen': {
                'width': VirtualTouchDevice.SCREEN_WIDTH,
                'height': VirtualTouchDevice.SCREEN_HEIGHT
            }
        }))

        # Nachrichten empfangen und verarbeiten
        async for message in websocket:
            try:
                data = json.loads(message)
                msg_type = data.get('type')

                if msg_type == 'touch':
                    await handle_touch_event(data)
                elif msg_type == 'request_screenshot':
                    logger.info(f"Screenshot requested by {client_id}")
                    # Capture and send screenshot
                    screenshot = await capture_screenshot()
                    if screenshot:
                        logger.info(f"Sending screenshot to {client_id} ({len(screenshot) / 1024:.1f}KB)")
                        await websocket.send(json.dumps({
                            'type': 'screenshot',
                            'data': screenshot
                        }))
                        logger.info(f"Screenshot sent to {client_id}")
                    else:
                        logger.error(f"Failed to capture screenshot for {client_id}")
                        await websocket.send(json.dumps({
                            'type': 'error',
                            'message': 'Failed to capture screenshot'
                        }))
                else:
                    logger.warning(f"Unknown message type from {client_id}: {msg_type}")

            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from {client_id}: {e}")
                await websocket.send(json.dumps({
                    'type': 'error',
                    'message': 'Invalid JSON'
                }))

            except Exception as e:
                logger.error(f"Error processing message from {client_id}: {e}")

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_id}")

    except Exception as e:
        logger.error(f"Error with client {client_id}: {e}")

    finally:
        # Client deregistrieren
        connected_clients.discard(websocket)
        logger.info(f"Client removed: {client_id} (Remaining: {len(connected_clients)})")


async def health_check(path, request_headers):
    """Health-Check Endpoint für nginx"""
    if path == "/health":
        return http.HTTPStatus.OK, [], b"OK\n"


async def main():
    """Hauptfunktion"""
    global virtual_device

    logger.info("Starting BoatOS Remote Control Server...")

    try:
        # Virtuelles Touch-Device erstellen
        logger.info("Creating virtual touch device...")
        virtual_device = VirtualTouchDevice()
        logger.info(f"Virtual device ready at: {virtual_device.device.device.path}")

        # WebSocket-Server starten
        host = "0.0.0.0"
        port = 8080

        logger.info(f"Starting WebSocket server on {host}:{port}")

        async with websockets.serve(
            handle_client,
            host,
            port,
            ping_interval=30,
            ping_timeout=10,
            max_size=1024 * 10  # 10KB max message size
        ):
            logger.info("Remote Control Server is running!")
            logger.info(f"Clients can connect to ws://<server-ip>:{port}")

            # Server läuft bis Ctrl+C
            await asyncio.Future()  # Run forever

    except KeyboardInterrupt:
        logger.info("Shutting down...")

    except Exception as e:
        logger.error(f"Server error: {e}")
        import traceback
        traceback.print_exc()

    finally:
        # Cleanup
        if virtual_device:
            virtual_device.close()
        logger.info("Server stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nShutdown requested by user")
