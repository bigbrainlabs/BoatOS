"""
BoatOS GPS Service
Reads NMEA data from serial GPS and broadcasts via WebSocket
"""
import serial
import pynmea2
import asyncio
import json
from datetime import datetime

# Global GPS state
gps_data = {
    'lat': None,
    'lon': None,
    'speed': None,  # in knots
    'heading': None,  # in degrees
    'altitude': None,
    'satellites': 0,
    'fix': False,
    'timestamp': None,
    'raw_nmea': []
}

# WebSocket clients
websocket_clients = set()

async def read_gps(port='/dev/ttyACM0', baudrate=9600):
    """Read GPS data from serial port"""
    print(f"📡 Starting GPS reader on {port}")

    try:
        ser = serial.Serial(port, baudrate, timeout=1)
        print(f"✅ GPS port {port} opened successfully")

        while True:
            try:
                line = ser.readline().decode('ascii', errors='ignore').strip()
                if line.startswith('$'):
                    # Store raw NMEA for debugging
                    if len(gps_data['raw_nmea']) > 10:
                        gps_data['raw_nmea'].pop(0)
                    gps_data['raw_nmea'].append(line)

                    try:
                        msg = pynmea2.parse(line)

                        # Handle different NMEA sentence types
                        if isinstance(msg, pynmea2.types.talker.RMC):
                            # Recommended Minimum - position, speed, course
                            if msg.status == 'A':  # Valid fix
                                gps_data['lat'] = float(msg.latitude) if msg.latitude else None
                                gps_data['lon'] = float(msg.longitude) if msg.longitude else None
                                gps_data['speed'] = float(msg.spd_over_grnd) if msg.spd_over_grnd else None
                                gps_data['heading'] = float(msg.true_course) if msg.true_course else None
                                gps_data['fix'] = True
                                gps_data['timestamp'] = datetime.utcnow().isoformat()

                                # Broadcast to all WebSocket clients
                                await broadcast_gps_data()
                            else:
                                gps_data['fix'] = False

                        elif isinstance(msg, pynmea2.types.talker.GGA):
                            # Global Positioning System Fix Data
                            if msg.gps_qual > 0:  # Valid fix
                                gps_data['lat'] = float(msg.latitude) if msg.latitude else None
                                gps_data['lon'] = float(msg.longitude) if msg.longitude else None
                                gps_data['altitude'] = float(msg.altitude) if msg.altitude else None
                                gps_data['satellites'] = int(msg.num_sats) if msg.num_sats else 0
                                gps_data['fix'] = True

                        elif isinstance(msg, pynmea2.types.talker.VTG):
                            # Track Made Good and Ground Speed
                            if msg.spd_over_grnd_kts:
                                gps_data['speed'] = float(msg.spd_over_grnd_kts)
                            if msg.true_track:
                                gps_data['heading'] = float(msg.true_track)

                    except pynmea2.ParseError:
                        pass  # Ignore parse errors

            except Exception as e:
                print(f"⚠️ GPS read error: {e}")
                await asyncio.sleep(0.1)

            await asyncio.sleep(0)  # Yield control

    except serial.SerialException as e:
        print(f"❌ GPS serial error: {e}")
        print(f"⚠️ Make sure {port} is accessible and user is in dialout group")
    except Exception as e:
        print(f"❌ GPS service error: {e}")

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
            'speed': gps_data['speed'],
            'heading': gps_data['heading'],
            'altitude': gps_data['altitude'],
            'satellites': gps_data['satellites'],
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
        'lat': gps_data['lat'],
        'lon': gps_data['lon'],
        'speed': gps_data['speed'],
        'heading': gps_data['heading'],
        'altitude': gps_data['altitude'],
        'timestamp': gps_data['timestamp']
    }
