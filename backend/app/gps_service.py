"""
BoatOS GPS Service
Reads GPS data from SignalK server and broadcasts via WebSocket
"""
import asyncio
import json
from datetime import datetime
import httpx

# Global GPS state
gps_data = {
    'lat': None,
    'lon': None,
    'speed': None,  # in knots
    'heading': None,  # in degrees
    'altitude': None,
    'satellites': 0,
    'hdop': None,  # Horizontal Dilution of Precision
    'vdop': None,  # Vertical Dilution of Precision
    'fix': False,
    'timestamp': None
}

# WebSocket clients
websocket_clients = set()

async def read_gps_from_signalk(signalk_url='http://localhost:3000'):
    """Read GPS data from SignalK server"""
    print(f"📡 Starting GPS reader from SignalK at {signalk_url}")

    error_count = 0
    last_error_log = 0

    async with httpx.AsyncClient(timeout=5.0) as client:
        while True:
            try:
                # Fetch navigation data from SignalK
                response = await client.get(f"{signalk_url}/signalk/v1/api/")
                if response.status_code == 200:
                    data = response.json()
                    error_count = 0  # Reset error count on success

                    # Get vessel data (first vessel or self)
                    vessels = data.get('vessels', {})
                    self_key = data.get('self', '').replace('vessels.', '')

                    if self_key and self_key in vessels:
                        vessel = vessels[self_key]
                        nav = vessel.get('navigation', {})

                        # Position
                        position = nav.get('position', {}).get('value', {})
                        if position:
                            gps_data['lat'] = position.get('latitude')
                            gps_data['lon'] = position.get('longitude')
                            gps_data['altitude'] = position.get('altitude')

                        # Speed over ground (convert m/s to knots)
                        sog = nav.get('speedOverGround', {}).get('value')
                        if sog is not None:
                            gps_data['speed'] = sog * 1.94384  # m/s to knots

                        # Course over ground (convert radians to degrees)
                        cog = nav.get('courseOverGroundTrue', {}).get('value')
                        if cog is not None:
                            gps_data['heading'] = (cog * 180 / 3.14159265) % 360

                        # GNSS info
                        gnss = nav.get('gnss', {})
                        gps_data['satellites'] = gnss.get('satellites', {}).get('value', 0)

                        # HDOP and VDOP
                        gps_data['hdop'] = gnss.get('horizontalDilution', {}).get('value')
                        gps_data['vdop'] = gnss.get('verticalDilution', {}).get('value')

                        # Check if we have a valid fix
                        quality = gnss.get('methodQuality', {}).get('value', '')
                        gps_data['fix'] = 'Fix' in quality and gps_data['lat'] is not None

                        gps_data['timestamp'] = datetime.utcnow().isoformat()

                        # Broadcast to WebSocket clients if we have a fix
                        if gps_data['fix']:
                            await broadcast_gps_data()

            except httpx.TimeoutException:
                error_count += 1
                # Only log every 10th error to reduce spam
                if error_count % 10 == 1:
                    print(f"⚠️ SignalK timeout ({error_count} errors)")
            except Exception as e:
                error_count += 1
                # Only log every 10th error to reduce spam
                if error_count % 10 == 1:
                    print(f"⚠️ GPS read error from SignalK: {e} ({error_count} errors)")

            # Use longer sleep interval to reduce CPU load
            # If errors persist, back off even more
            if error_count > 5:
                await asyncio.sleep(10)  # Back off to 10s if repeated errors
            else:
                await asyncio.sleep(5)  # Poll every 5 seconds instead of 1s

async def broadcast_gps_data():
    """Broadcast GPS data to all connected WebSocket clients"""
    if not websocket_clients:
        return
    # Only broadcast if we have a GPS fix
    if not gps_data["fix"] or gps_data["lat"] is None:
        return

    data = {
        'type': 'gps_update',
        'data': {
            'lat': gps_data['lat'],
            'lon': gps_data['lon'],
            'speed': gps_data['speed'] or 0,
            'heading': gps_data['heading'] or 0,
            'altitude': gps_data['altitude'] or 0,
            'satellites': gps_data['satellites'],
            'hdop': gps_data['hdop'],
            'vdop': gps_data['vdop'],
            'fix': gps_data['fix'],
            'timestamp': gps_data['timestamp']
        }
    }

    message = json.dumps(data)

    # Send to all connected clients
    disconnected = set()
    for ws in websocket_clients:
        try:
            await ws.send_text(message)
        except Exception:
            disconnected.add(ws)

    # Remove disconnected clients
    websocket_clients.difference_update(disconnected)

def get_gps_status():
    """Get current GPS status"""
    return {
        'fix': gps_data['fix'],
        'satellites': gps_data['satellites'],
        'lat': gps_data['lat'] or 0,
        'lon': gps_data['lon'] or 0,
        'speed': gps_data['speed'] or 0,
        'heading': gps_data['heading'] or 0,
        'altitude': gps_data['altitude'] or 0,
        'hdop': gps_data['hdop'],
        'vdop': gps_data['vdop'],
        'timestamp': gps_data['timestamp']
    }
