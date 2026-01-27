"""BoatOS Backend - FastAPI Server with Logbook & Charts"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import asyncio, json, websockets, os, shutil, zipfile, subprocess, re
from datetime import datetime
from typing import List, Dict, Any
import paho.mqtt.client as mqtt
from math import radians, sin, cos, sqrt, atan2
import aiohttp
import requests
from bs4 import BeautifulSoup
from pathlib import Path
from dotenv import load_dotenv
import gps_service
import logbook_storage
import pdf_export
from ais_service import ais_service
from waterway_infrastructure import waterway_infrastructure
from pegelonline import pegelonline
from water_current import water_current_service
import crew_management
import fuel_tracking
import statistics
import weather_alerts
import locks_storage
import dashboard_dsl

# Load environment variables from .env file (one level up from backend/)
dotenv_path = Path(__file__).resolve().parent.parent.parent / ".env"
load_dotenv(dotenv_path=dotenv_path)

app = FastAPI(title="BoatOS API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Charts directory
CHARTS_DIR = Path("/home/arielle/BoatOS/data/charts")
CHARTS_DIR.mkdir(parents=True, exist_ok=True)

# Mount charts directory for static serving
app.mount("/charts", StaticFiles(directory=str(CHARTS_DIR)), name="charts")

active_connections: List[WebSocket] = []
sensor_data: Dict[str, Any] = {"gps": {"lat": 0, "lon": 0, "satellites": 0, "altitude": 0, "course": 0}, "speed": 0, "heading": 0, "depth": 0, "wind": {"speed": 0, "direction": 0}, "engine": {"rpm": 0, "temp": 0, "oil_pressure": 0}, "battery": {"voltage": 0, "current": 0}, "bilge": {"temperature": 0, "humidity": 0}}
sensor_timestamps: Dict[str, float] = {}  # Track last update time for each sensor/topic
topic_values: Dict[str, str] = {}  # Store actual MQTT payload values for each topic
known_topics: Dict[str, Dict[str, Any]] = {}  # Persistent storage of all known topics with their last known values
routes, waypoints = {}, []
# Current session entries (cleared on stop)
current_session_entries = []
# Completed trips loaded from disk
completed_trips = logbook_storage.load_logbook_entries()
current_track = []
track_recording = False
track_paused = False
weather_data: Dict[str, Any] = {}
gps_module_data: Dict[str, Any] = {}
chart_layers: List[Dict[str, Any]] = []

# OpenWeatherMap API Configuration
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OPENWEATHER_BASE_URL = "https://api.openweathermap.org/data/2.5"

# ELWIS ENC Download Configuration
ELWIS_BASE_URL = "https://www.elwis.de"
IENC_URL = "https://www.elwis.de/DE/dynamisch/IENC/"

# ==================== WEBSOCKET ====================
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    gps_service.websocket_clients.add(websocket)  # Register with GPS service
    try:
        while True:
            gps_status = gps_service.get_gps_status()
            sensor_data["gps"] = gps_status
            await websocket.send_json(sensor_data)
            await asyncio.sleep(1.0)  # Reduced from 0.5s to 1s for better performance
    except WebSocketDisconnect:
        active_connections.remove(websocket)
        gps_service.websocket_clients.discard(websocket)  # Unregister from GPS service

# ==================== REST API ====================
@app.get("/")
async def root():
    return {"name": "BoatOS", "version": "1.0.0", "status": "running", "timestamp": datetime.now().isoformat()}

@app.get("/api/sensors")
async def get_sensors():
    gps_status = gps_service.get_gps_status()
    sensor_data["gps"] = gps_status
    return sensor_data

# ==================== SENSOR HELPERS ====================
def get_icon_for_topic(topic_name: str) -> str:
    """Return an appropriate icon emoji based on topic keywords"""
    topic_lower = topic_name.lower()

    # Navigation & Position
    if any(keyword in topic_lower for keyword in ['gps', 'position', 'location', 'latitude', 'longitude', 'navigation']):
        return "🧭"

    # Temperature
    if any(keyword in topic_lower for keyword in ['temperature', 'temp', 'thermo']):
        return "🌡️"

    # Humidity
    if 'humidity' in topic_lower or 'humid' in topic_lower:
        return "💧"

    # Battery & Power
    if any(keyword in topic_lower for keyword in ['battery', 'voltage', 'current', 'power', 'charge']):
        return "🔋"

    # Engine & Motor
    if any(keyword in topic_lower for keyword in ['engine', 'motor', 'rpm']):
        return "🔧"

    # Wind
    if 'wind' in topic_lower:
        return "💨"

    # Depth & Sonar
    if any(keyword in topic_lower for keyword in ['depth', 'sonar', 'echo']):
        return "📏"

    # Pressure
    if 'pressure' in topic_lower:
        return "⏲️"

    # Light & Illumination
    if any(keyword in topic_lower for keyword in ['light', 'lux', 'brightness']):
        return "💡"

    # Water & Bilge
    if any(keyword in topic_lower for keyword in ['bilge', 'water', 'leak']):
        return "🌊"

    # Heater
    if 'heater' in topic_lower or 'heating' in topic_lower:
        return "♨️"

    # Fuel
    if 'fuel' in topic_lower:
        return "⛽"

    # Speed
    if 'speed' in topic_lower:
        return "🚤"

    # Status & Online/Offline
    if any(keyword in topic_lower for keyword in ['online', 'status', 'state']):
        return "📡"

    # Default
    return "📊"

def generate_sensor_name(topic_base: str) -> str:
    """Generate a readable sensor name from topic structure"""
    # Remove common prefixes
    name = topic_base
    for prefix in ['arielle/', 'boat/', 'boatos/', 'home/', 'sensor/']:
        if name.startswith(prefix):
            name = name[len(prefix):]

    # Split by '/' and capitalize each part
    parts = name.split('/')

    # Capitalize and clean each part
    cleaned_parts = []
    for part in parts:
        # Replace underscores with spaces
        part = part.replace('_', ' ')
        # Capitalize
        part = part.title()
        cleaned_parts.append(part)

    # Join with › separator
    return ' › '.join(cleaned_parts)

@app.get("/api/sensors/list")
async def get_sensors_list():
    """Get a structured list of all detected sensors with their status - fully dynamic from MQTT topics"""
    import time
    current_time = time.time()

    # Load sensor aliases from settings
    sensor_aliases = {}
    settings_file = "data/settings.json"
    try:
        with open(settings_file, 'r') as f:
            settings = json.load(f)
            sensor_aliases = settings.get("sensor_aliases", {})
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # Group all topics by base name (e.g., "arielle/bilge/thermo/temperature" → "arielle/bilge/thermo")
    # Use both sensor_timestamps (current) and known_topics (historical) to show ALL topics
    grouped_sensors = {}

    # First, process all known topics (including historical ones)
    for topic, info in known_topics.items():
        last_seen = info.get("last_seen", 0)
        age_seconds = current_time - last_seen

        # Determine base name (everything before the last '/')
        if '/' in topic:
            base_name = topic.rsplit('/', 1)[0]
            subtopic = topic.rsplit('/', 1)[1]
        else:
            base_name = topic
            subtopic = "value"

        if base_name not in grouped_sensors:
            grouped_sensors[base_name] = {
                "values": {},
                "topics": [],
                "last_update": last_seen,
                "age_seconds": age_seconds
            }

        grouped_sensors[base_name]["topics"].append(topic)

        # Use last known value from known_topics
        last_value = info.get("last_value", "")
        grouped_sensors[base_name]["values"][subtopic] = last_value

        # Update last_update to the most recent
        if last_seen > grouped_sensors[base_name]["last_update"]:
            grouped_sensors[base_name]["last_update"] = last_seen
            grouped_sensors[base_name]["age_seconds"] = age_seconds

    # Then, update with current values from sensor_timestamps (overrides old values if newer)
    for topic, timestamp in sensor_timestamps.items():
        age_seconds = current_time - timestamp

        # Determine base name (everything before the last '/')
        if '/' in topic:
            base_name = topic.rsplit('/', 1)[0]
            subtopic = topic.rsplit('/', 1)[1]
        else:
            base_name = topic
            subtopic = "value"

        if base_name not in grouped_sensors:
            grouped_sensors[base_name] = {
                "values": {},
                "topics": [],
                "last_update": timestamp,
                "age_seconds": age_seconds
            }

        if topic not in grouped_sensors[base_name]["topics"]:
            grouped_sensors[base_name]["topics"].append(topic)

        # Store actual value from topic_values instead of placeholder
        actual_value = topic_values.get(topic, "")
        grouped_sensors[base_name]["values"][subtopic] = actual_value

        # Update last_update to the most recent
        if timestamp > grouped_sensors[base_name]["last_update"]:
            grouped_sensors[base_name]["last_update"] = timestamp
            grouped_sensors[base_name]["age_seconds"] = age_seconds

    # Build sensors list
    sensors_list = []
    for base_name, info in grouped_sensors.items():
        age_minutes = info["age_seconds"] / 60

        # Determine status based on age
        if age_minutes < 5:
            status = "online"
        elif age_minutes < 60:
            status = "standby"
        else:
            status = "offline"

        # Get icon based on topic keywords
        icon = get_icon_for_topic(base_name)

        # Generate readable name or use alias
        has_alias = base_name in sensor_aliases
        if has_alias:
            sensor_name = sensor_aliases[base_name]
        else:
            sensor_name = generate_sensor_name(base_name)

        # Determine type based on icon/topic
        sensor_type = "unknown"
        if icon == "🧭":
            sensor_type = "navigation"
        elif icon in ["🌡️", "💧", "🌊"]:
            sensor_type = "environment"
        elif icon in ["🔋", "⚡"]:
            sensor_type = "electrical"
        elif icon in ["🔧", "⚙️"]:
            sensor_type = "propulsion"

        sensors_list.append({
            "id": base_name.replace('/', '_'),
            "name": sensor_name,
            "type": sensor_type,
            "status": status,
            "values": info["values"],
            "topics": info["topics"],
            "icon": icon,
            "age_minutes": round(age_minutes, 1),
            "has_alias": has_alias,
            "base_name": base_name
        })

    # Sort sensors by name
    sensors_list.sort(key=lambda s: s["name"])

    return {
        "total": len(sensors_list),
        "online": sum(1 for s in sensors_list if s["status"] == "online"),
        "offline": sum(1 for s in sensors_list if s["status"] == "offline"),
        "standby": sum(1 for s in sensors_list if s["status"] == "standby"),
        "sensors": sensors_list
    }

@app.get("/api/gps")
async def get_gps():
    return gps_service.get_gps_status()


@app.get("/api/settings")
async def get_settings():
    """Get user settings"""
    # Try to load from file
    settings_file = "data/settings.json"
    try:
        with open(settings_file, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        return {}

@app.post("/api/settings")
async def save_settings(settings: Dict[str, Any]):
    """Save user settings"""
    settings_file = "data/settings.json"
    try:
        # Load existing settings to preserve dashboard_layout
        existing_settings = {}
        try:
            with open(settings_file, 'r') as f:
                existing_settings = json.load(f)
        except FileNotFoundError:
            pass

        # Merge new settings with existing, preserving dashboard_layout if not provided
        if 'dashboard_layout' in existing_settings and 'dashboard_layout' not in settings:
            settings['dashboard_layout'] = existing_settings['dashboard_layout']

        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)

        # Apply AIS settings
        if 'ais' in settings:
            provider = settings['ais'].get('provider', 'aishub')
            enabled = settings["ais"].get("enabled", False)
            api_key = settings['ais'].get('apiKey', '')
            ais_service.configure(provider=provider, api_key=api_key, enabled=enabled)

        # Apply Routing settings
        if 'routing' in settings:
            init_waterway_router()  # Reinitialize router with new API key

        # Apply Water Current settings
        if 'waterCurrent' in settings:
            water_current_service.configure(settings['waterCurrent'])

        # Generate dynamic Lua profile if boat data is present
        if 'boat' in settings:
            boat = settings['boat']
            if boat.get('draft', 0) > 0 or boat.get('height', 0) > 0 or boat.get('beam', 0) > 0:
                await generate_lua_profile(boat)

        return {"status": "success", "message": "Settings saved"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# ==================== DASHBOARD LAYOUT ====================
@app.get("/api/dashboard/layout")
async def get_dashboard_layout():
    """Get dashboard layout DSL"""
    settings_file = "data/settings.json"
    try:
        with open(settings_file, 'r') as f:
            settings = json.load(f)
            layout_dsl = settings.get("dashboard_layout", "")

            # If empty, return default layout
            if not layout_dsl:
                layout_dsl = dashboard_dsl.get_default_layout()

            return {"layout": layout_dsl}
    except FileNotFoundError:
        # Return default layout if no settings file
        return {"layout": dashboard_dsl.get_default_layout()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/dashboard/layout")
async def save_dashboard_layout(data: Dict[str, Any]):
    """Save dashboard layout DSL"""
    settings_file = "data/settings.json"
    try:
        layout_dsl = data.get("layout", "")

        # Load existing settings
        settings = {}
        try:
            with open(settings_file, 'r') as f:
                settings = json.load(f)
        except FileNotFoundError:
            pass

        # Update dashboard_layout
        settings["dashboard_layout"] = layout_dsl

        # Save settings
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)

        return {"status": "success", "message": "Dashboard layout saved"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/api/dashboard/parse")
async def parse_dashboard_layout(data: Dict[str, Any]):
    """Parse DSL and return structured layout for preview"""
    try:
        layout_dsl = data.get("layout", "")
        parsed = dashboard_dsl.parse_dashboard_dsl(layout_dsl)
        return parsed
    except Exception as e:
        return {"status": "error", "message": str(e), "errors": [str(e)]}

@app.post("/api/mqtt/test")
async def test_mqtt_connection(mqtt_config: Dict[str, Any]):
    """Test MQTT broker connection"""
    try:
        import paho.mqtt.client as mqtt

        host = mqtt_config.get('host', 'localhost')
        port = mqtt_config.get('port', 1883)
        username = mqtt_config.get('username', '')
        password = mqtt_config.get('password', '')

        # Create a test client
        test_client = mqtt.Client(client_id="boatos_connection_test")

        # Set credentials if provided
        if username and password:
            test_client.username_pw_set(username, password)

        # Connection result
        connection_successful = False
        connection_error = None

        def on_connect(client, userdata, flags, rc):
            nonlocal connection_successful, connection_error
            if rc == 0:
                connection_successful = True
            else:
                connection_error = f"Connection failed with code {rc}"

        test_client.on_connect = on_connect

        # Try to connect with timeout
        test_client.connect(host, port, keepalive=10)
        test_client.loop_start()

        # Wait for connection result (max 5 seconds)
        import time
        for _ in range(50):  # 50 * 0.1s = 5s timeout
            if connection_successful or connection_error:
                break
            time.sleep(0.1)

        test_client.loop_stop()
        test_client.disconnect()

        if connection_successful:
            return {"status": "success", "message": "MQTT connection successful"}
        else:
            return {"status": "error", "message": connection_error or "Connection timeout"}

    except Exception as e:
        return {"status": "error", "message": f"Connection failed: {str(e)}"}

@app.get("/api/mqtt/topics")
async def get_mqtt_topics():
    """Get all MQTT topics with their last update timestamps"""
    import time
    current_time = time.time()

    topics_info = []
    for topic, timestamp in sensor_timestamps.items():
        age_seconds = current_time - timestamp
        topics_info.append({
            "topic": topic,
            "last_update": timestamp,
            "age_seconds": age_seconds,
            "age_minutes": age_seconds / 60
        })

    # Sort by age (oldest first)
    topics_info.sort(key=lambda x: x["age_seconds"], reverse=True)

    return {
        "total": len(topics_info),
        "topics": topics_info
    }

@app.post("/api/mqtt/cleanup")
async def cleanup_old_topics(max_age_minutes: int = 60):
    """Remove topics that haven't been updated in X minutes"""
    import time
    current_time = time.time()
    max_age_seconds = max_age_minutes * 60

    topics_to_remove = []
    for topic, timestamp in list(sensor_timestamps.items()):
        age = current_time - timestamp
        if age > max_age_seconds:
            topics_to_remove.append(topic)
            del sensor_timestamps[topic]

    return {
        "status": "success",
        "removed": len(topics_to_remove),
        "topics_removed": topics_to_remove,
        "remaining": len(sensor_timestamps)
    }

@app.get("/api/waypoints")
async def get_waypoints():
    return waypoints

@app.post("/api/waypoints")
async def add_waypoint(waypoint: Dict[str, Any]):
    waypoint["id"] = len(waypoints) + 1
    waypoint["timestamp"] = datetime.now().isoformat()
    waypoints.append(waypoint)
    return waypoint

@app.delete("/api/waypoints/{waypoint_id}")
async def delete_waypoint(waypoint_id: int):
    global waypoints
    waypoints = [w for w in waypoints if w["id"] != waypoint_id]
    return {"status": "deleted"}

@app.get("/api/routes")
async def get_routes():
    return routes

@app.post("/api/routes")
async def save_route(route: Dict[str, Any]):
    route_id = route.get("name", f"route_{len(routes)+1}")
    routes[route_id] = route
    return {"status": "saved"}

# ==================== FAVORITES ====================

def load_favorites():
    """Load favorites from data/favorites.json"""
    favorites_file = "data/favorites.json"
    if os.path.exists(favorites_file):
        try:
            with open(favorites_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return data.get('favorites', [])
        except Exception as e:
            print(f"❌ Error loading favorites: {e}")
            return []
    return []

def save_favorites(favorites_list):
    """Save favorites to data/favorites.json"""
    favorites_file = "data/favorites.json"
    try:
        with open(favorites_file, 'w', encoding='utf-8') as f:
            json.dump({'favorites': favorites_list}, f, indent=2, ensure_ascii=False)
        return True
    except Exception as e:
        print(f"❌ Error saving favorites: {e}")
        return False

@app.get("/api/favorites")
async def get_favorites():
    """Get all favorites"""
    return {"favorites": load_favorites()}

@app.post("/api/favorites")
async def add_favorite(favorite: Dict[str, Any]):
    """Add a new favorite"""
    import uuid
    favorites_list = load_favorites()

    # Generate unique ID
    favorite['id'] = str(uuid.uuid4())
    favorite['created'] = datetime.now().isoformat()
    favorite['modified'] = datetime.now().isoformat()

    # Validate required fields
    if 'name' not in favorite or 'lat' not in favorite or 'lon' not in favorite:
        return {"status": "error", "message": "Missing required fields: name, lat, lon"}

    # Default category if not provided
    if 'category' not in favorite:
        favorite['category'] = 'other'

    favorites_list.append(favorite)

    if save_favorites(favorites_list):
        return {"status": "success", "favorite": favorite}
    else:
        return {"status": "error", "message": "Failed to save favorite"}

@app.put("/api/favorites/{favorite_id}")
async def update_favorite(favorite_id: str, favorite: Dict[str, Any]):
    """Update an existing favorite"""
    favorites_list = load_favorites()

    # Find favorite by ID
    for i, fav in enumerate(favorites_list):
        if fav.get('id') == favorite_id:
            # Update fields
            favorite['id'] = favorite_id
            favorite['created'] = fav.get('created', datetime.now().isoformat())
            favorite['modified'] = datetime.now().isoformat()
            favorites_list[i] = favorite

            if save_favorites(favorites_list):
                return {"status": "success", "favorite": favorite}
            else:
                return {"status": "error", "message": "Failed to save favorite"}

    return {"status": "error", "message": "Favorite not found"}

@app.delete("/api/favorites/{favorite_id}")
async def delete_favorite(favorite_id: str):
    """Delete a favorite"""
    favorites_list = load_favorites()
    original_count = len(favorites_list)

    # Filter out the favorite to delete
    favorites_list = [fav for fav in favorites_list if fav.get('id') != favorite_id]

    if len(favorites_list) < original_count:
        if save_favorites(favorites_list):
            return {"status": "success", "message": "Favorite deleted"}
        else:
            return {"status": "error", "message": "Failed to save after deletion"}
    else:
        return {"status": "error", "message": "Favorite not found"}

@app.get("/api/favorites/categories")
async def get_favorite_categories():
    """Get list of available favorite categories"""
    return {
        "categories": [
            {"id": "marina", "name": "Marina", "icon": "⚓"},
            {"id": "anchorage", "name": "Ankerplatz", "icon": "🔱"},
            {"id": "fuel", "name": "Tankstelle", "icon": "⛽"},
            {"id": "lock", "name": "Schleuse", "icon": "🚧"},
            {"id": "bridge", "name": "Brücke", "icon": "🌉"},
            {"id": "restaurant", "name": "Restaurant", "icon": "🍽️"},
            {"id": "shop", "name": "Geschäft", "icon": "🏪"},
            {"id": "other", "name": "Sonstiges", "icon": "📍"}
        ]
    }

# ==================== AIS ====================
@app.get("/api/ais/vessels")
async def get_ais_vessels(lat_min: float, lon_min: float, lat_max: float, lon_max: float):
    """Get AIS vessels in bounding box"""
    vessels = await ais_service.fetch_vessels(lat_min, lon_min, lat_max, lon_max)
    return {"vessels": vessels, "count": len(vessels)}

# ==================== WATERWAY INFRASTRUCTURE ====================
@app.get("/api/infrastructure")
async def get_infrastructure(lat_min: float, lon_min: float, lat_max: float, lon_max: float,
                            types: str = "lock,bridge,harbor,weir,dam"):
    """
    Get waterway infrastructure POIs from OpenStreetMap

    Parameters:
    - lat_min, lon_min, lat_max, lon_max: Bounding box
    - types: Comma-separated list of types (lock, bridge, harbor, weir, dam)

    Returns:
    - List of infrastructure POIs with details
    """
    type_list = [t.strip() for t in types.split(',') if t.strip()]
    pois = waterway_infrastructure.fetch_infrastructure(lat_min, lon_min, lat_max, lon_max, type_list)
    return {"pois": pois, "count": len(pois)}

# ==================== WATER LEVEL GAUGES (PEGELONLINE) ====================
@app.get("/api/gauges")
async def get_water_level_gauges(lat_min: float, lon_min: float, lat_max: float, lon_max: float):
    """
    Get water level gauges from PEGELONLINE (German waterways)

    Parameters:
    - lat_min, lon_min, lat_max, lon_max: Bounding box

    Returns:
    - List of gauge stations with current water levels
    """
    gauges = pegelonline.fetch_gauges(lat_min, lon_min, lat_max, lon_max)
    return {"gauges": gauges, "count": len(gauges)}

# ==================== LOCKS (SCHLEUSEN) ====================
@app.get("/api/locks")
async def get_locks():
    """
    Get all locks (Schleusen)

    Returns:
    - List of all locks with details
    """
    locks = locks_storage.load_locks()
    return {"locks": locks, "count": len(locks)}

@app.get("/api/locks/nearby")
async def get_nearby_locks(lat: float, lon: float, radius: float = 50):
    """
    Get locks near a location

    Parameters:
    - lat, lon: Center position
    - radius: Search radius in km (default: 50)

    Returns:
    - List of locks within radius
    """
    locks = locks_storage.get_locks_nearby(lat, lon, radius)
    return {"locks": locks, "count": len(locks)}

@app.get("/api/locks/bounds")
async def get_locks_in_bounds(lat_min: float, lon_min: float, lat_max: float, lon_max: float):
    """
    Get locks within geographic bounds (for map display)

    Parameters:
    - lat_min, lon_min, lat_max, lon_max: Bounding box

    Returns:
    - List of locks in bounding box
    """
    locks = locks_storage.get_locks_in_bounds(lat_min, lon_min, lat_max, lon_max)
    return {"locks": locks, "count": len(locks)}

@app.get("/api/locks/waterway/{waterway}")
async def get_locks_by_waterway(waterway: str):
    """
    Get locks on a specific waterway

    Parameters:
    - waterway: Waterway name (e.g., "Elbe", "Havel")

    Returns:
    - List of locks on waterway, sorted by river_km
    """
    locks = locks_storage.get_locks_by_waterway(waterway)
    return {"locks": locks, "count": len(locks), "waterway": waterway}

@app.post("/api/locks/import-osm")
async def import_locks_from_osm():
    """Import locks from OpenStreetMap"""
    try:
        script_path = Path(__file__).parent.parent / 'import_locks.py'
        result = subprocess.run(['python', str(script_path)], capture_output=True, text=True, timeout=300)
        if result.returncode == 0:
            import re
            imported = int(re.search(r'(\d+)\s+new', result.stdout, re.I).group(1)) if re.search(r'(\d+)\s+new', result.stdout, re.I) else 0
            return {"success": True, "imported": imported}
        return {"success": False, "error": result.stderr or "Import failed"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/locks/enrich")
async def enrich_locks_data():
    """Enrich locks with VHF and contact data"""
    try:
        script_path = Path(__file__).parent.parent / 'enrich_locks_data.py'
        result = subprocess.run(['python', str(script_path)], capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            import re
            vhf = re.search(r'VHF.*?(\d+\.?\d*%)', result.stdout, re.I).group(1) if re.search(r'VHF.*?(\d+\.?\d*%)', result.stdout, re.I) else "0%"
            return {"success": True, "vhf_coverage": vhf}
        return {"success": False, "error": result.stderr or "Enrichment failed"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/locks/quality")
async def check_locks_quality():
    """Get locks database quality statistics"""
    try:
        script_path = Path(__file__).parent.parent / 'check_locks_quality.py'
        result = subprocess.run(['python', str(script_path)], capture_output=True, text=True, timeout=60)
        if result.returncode == 0:
            import re
            output = result.stdout
            total = int(re.search(r'Total.*?(\d+)', output, re.I).group(1)) if re.search(r'Total.*?(\d+)', output, re.I) else 0
            vhf = re.search(r'VHF.*?(\d+)/(\d+).*?\((\d+\.?\d*%)\)', output, re.I)
            phone = re.search(r'Phone.*?(\d+)/(\d+).*?\((\d+\.?\d*%)\)', output, re.I)
            email = re.search(r'E-?mail.*?(\d+)/(\d+).*?\((\d+\.?\d*%)\)', output, re.I)
            return {
                "success": True, "total": total,
                "vhf_count": int(vhf.group(1)) if vhf else 0, "vhf_percentage": vhf.group(3) if vhf else "0%",
                "phone_count": int(phone.group(1)) if phone else 0, "phone_percentage": phone.group(3) if phone else "0%",
                "email_count": int(email.group(1)) if email else 0, "email_percentage": email.group(3) if email else "0%",
                "top_waterways": []
            }
        return {"success": False, "error": result.stderr or "Quality check failed"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/locks/verify-positions")
async def verify_locks_positions():
    """Verify and fix lock positions against OpenStreetMap (takes ~2 minutes)"""
    try:
        # Import the function directly to use it with silent mode
        import sys
        sys.path.append(str(Path(__file__).parent.parent))
        from check_lock_positions import check_lock_positions

        # Run verification with auto-fix and silent mode
        result = check_lock_positions(auto_fix=True, distance_threshold=500, silent=True)

        return {
            "success": True,
            "checked": result['checked'],
            "fixed": result['fixed'],
            "avg_distance_fixed": result['avg_distance_fixed'],
            "issues": result['issues']
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/locks/{lock_id}")
async def get_lock_details(lock_id: int):
    """
    Get details for a specific lock

    Parameters:
    - lock_id: Lock ID

    Returns:
    - Lock details including opening hours, contact info, etc.
    """
    lock = locks_storage.get_lock(lock_id)
    if not lock:
        return {"error": "Lock not found"}
    return lock

@app.get("/api/locks/{lock_id}/status")
async def get_lock_status(lock_id: int):
    """
    Check if lock is currently open

    Parameters:
    - lock_id: Lock ID

    Returns:
    - is_open: bool
    - reason: str (open/closed reason)
    - opens_at/closes_at: next opening/closing time
    """
    status = locks_storage.is_lock_open(lock_id)
    return status

@app.post("/api/locks")
async def create_lock(lock_data: Dict[str, Any]):
    """
    Add a new lock to database

    Request body: {
        "name": str (required),
        "waterway": str (required),
        "lat": float (required),
        "lon": float (required),
        "river_km": float,
        "phone": str,
        "vhf_channel": str,
        "email": str,
        "website": str,
        "opening_hours": dict,
        "break_times": list,
        "max_length": float,
        "max_width": float,
        "max_draft": float,
        "max_height": float,
        "avg_duration": int,
        "notes": str,
        "facilities": list
    }
    """
    try:
        lock_id = locks_storage.add_lock(lock_data)
        return {"status": "success", "lock_id": lock_id}
    except Exception as e:
        return {"error": str(e)}

@app.put("/api/locks/{lock_id}")
async def update_lock(lock_id: int, lock_data: Dict[str, Any]):
    """Update lock information"""
    success = locks_storage.update_lock(lock_id, lock_data)
    if success:
        return {"status": "success", "lock_id": lock_id}
    return {"error": "Lock not found"}

@app.delete("/api/locks/{lock_id}")
async def delete_lock(lock_id: int):
    """Delete a lock"""
    success = locks_storage.delete_lock(lock_id)
    return {"status": "deleted" if success else "not_found"}

@app.post("/api/locks/{lock_id}/notify")
async def notify_lock(lock_id: int, request: Dict[str, Any]):
    """
    Prepare lock notification (email/SMS template)
    Phase 1: Returns email template data

    Parameters:
    - lock_id: Lock ID
    - request: {
        "boat_name": str,
        "eta": str (ISO datetime),
        "crew_count": int,
        "boat_length": float,
        "boat_beam": float
      }

    Returns:
    - Email template with pre-filled data
    """
    lock = locks_storage.get_lock(lock_id)
    if not lock:
        return {"error": "Lock not found"}

    # Load boat data from settings if not provided
    boat_name = request.get("boat_name", "")
    boat_length = request.get("boat_length", 0)
    boat_beam = request.get("boat_beam", 0)
    crew_count = request.get("crew_count", 2)
    eta = request.get("eta", datetime.now().isoformat())

    try:
        with open("data/settings.json", 'r') as f:
            settings = json.load(f)
            boat = settings.get('boat', {})
            if not boat_name:
                boat_name = boat.get('name', '')
            if not boat_length:
                boat_length = boat.get('length', 0)
            if not boat_beam:
                boat_beam = boat.get('beam', 0)
    except:
        pass

    # Format ETA
    try:
        eta_dt = datetime.fromisoformat(eta.replace('Z', '+00:00'))
        eta_formatted = eta_dt.strftime("%d.%m.%Y um %H:%M Uhr")
    except:
        eta_formatted = eta

    # Create email template
    subject = f"Schleusenanmeldung - {boat_name} - {lock['name']}"
    body = f"""Guten Tag,

hiermit melde ich mich für die Schleuse {lock['name']} an:

Boot: {boat_name}
Länge: {boat_length} m
Breite: {boat_beam} m
Crew: {crew_count} Personen
Voraussichtliche Ankunft: {eta_formatted}

Mit freundlichen Grüßen
"""

    return {
        "lock": lock,
        "email": {
            "to": lock.get('email', ''),
            "subject": subject,
            "body": body
        },
        "phone": lock.get('phone', ''),
        "vhf": lock.get('vhf_channel', '')
    }

# ==================== CHARTS ====================
@app.get("/api/charts")
async def get_charts():
    """List all available chart layers"""
    load_chart_layers()
    return chart_layers

@app.post("/api/charts/upload")
async def upload_chart(files: List[UploadFile] = File(...), name: str = "", layer_type: str = "tiles"):
    """
    Upload chart overlay (single file or directory)
    Supported types:
    - tiles: Directory with tile structure (z/x/y.png) or ZIP
    - kap: BSB/KAP nautical charts (will be converted to tiles)
    - enc: Inland ENC (.000 files, S-57 format) (will be converted to tiles)
    - mbtiles: MBTiles file
    - image: Single GeoTIFF or georeferenced image
    """
    try:
        # Determine chart name
        first_file = files[0]
        chart_name = name or first_file.filename.split('.')[0].split('/')[0]
        chart_id = f"chart_{len(chart_layers) + 1}"
        chart_path = CHARTS_DIR / chart_id
        chart_path.mkdir(parents=True, exist_ok=True)

        # Save all uploaded files
        kap_files = []
        enc_files = []
        for file in files:
            # Preserve directory structure from webkitRelativePath
            file_path = chart_path / file.filename
            file_path.parent.mkdir(parents=True, exist_ok=True)

            with open(file_path, "wb") as buffer:
                content = await file.read()
                buffer.write(content)

            if file.filename.endswith('.kap'):
                kap_files.append(file_path)
            elif file.filename.endswith('.000'):
                enc_files.append(file_path)

        # Process KAP files if present
        if kap_files and layer_type == 'kap':
            print(f"📊 Converting {len(kap_files)} KAP file(s) to tiles...")
            tiles_path = chart_path / "tiles"
            tiles_path.mkdir(exist_ok=True)

            for kap_file in kap_files:
                try:
                    import subprocess
                    # Convert KAP to VRT
                    vrt_file = kap_file.with_suffix('.vrt')
                    subprocess.run(['/usr/bin/gdal_translate', '-of', 'VRT', str(kap_file), str(vrt_file)], check=True)

                    # Expand palette to RGBA (required for gdal2tiles)
                    rgba_vrt = kap_file.parent / f"{kap_file.stem}_rgba.vrt"
                    subprocess.run(['/usr/bin/gdal_translate', '-of', 'VRT', '-expand', 'rgba', str(vrt_file), str(rgba_vrt)], check=True)

                    # Generate tiles using gdal2tiles
                    subprocess.run([
                        '/usr/bin/gdal2tiles.py',
                        '-z', '0-18',
                        '--processes=4',
                        str(rgba_vrt),
                        str(tiles_path)
                    ], check=True)

                    print(f"✅ Converted {kap_file.name} to tiles")
                except Exception as e:
                    print(f"⚠️ KAP conversion failed for {kap_file.name}: {e}")

            layer_type = 'tiles'  # Change type to tiles after conversion

        # Process Inland ENC files if present
        if enc_files and layer_type == 'enc':
            print(f"📊 Converting {len(enc_files)} Inland ENC file(s) to tiles...")
            tiles_path = chart_path / "tiles"
            tiles_path.mkdir(exist_ok=True)

            for enc_file in enc_files:
                try:
                    import subprocess
                    # Convert S-57 ENC to GeoTIFF
                    geotiff_file = enc_file.with_suffix('.tif')

                    # Use ogr2ogr to convert S-57 to shapefile first, then rasterize
                    # Or use direct GDAL rendering of S-57
                    subprocess.run([
                        '/usr/bin/gdal_rasterize',
                        '-of', 'GTiff',
                        '-tr', '0.0001', '0.0001',  # Resolution
                        '-a_srs', 'EPSG:4326',
                        str(enc_file),
                        str(geotiff_file)
                    ], check=True)

                    # Convert GeoTIFF to tiles
                    subprocess.run([
                        '/usr/bin/gdal2tiles.py',
                        '-z', '0-18',
                        '--processes=4',
                        str(geotiff_file),
                        str(tiles_path)
                    ], check=True)

                    print(f"✅ Converted {enc_file.name} to tiles")
                except Exception as e:
                    print(f"⚠️ ENC conversion failed for {enc_file.name}: {e}")
                    # Try alternative: serve as vector tiles via ogr2ogr
                    try:
                        geojson_file = enc_file.with_suffix('.geojson')
                        subprocess.run([
                            '/usr/bin/ogr2ogr',
                            '-f', 'GeoJSON',
                            str(geojson_file),
                            str(enc_file)
                        ], check=True)
                        print(f"✅ Converted {enc_file.name} to GeoJSON (alternative)")
                    except Exception as e2:
                        print(f"⚠️ GeoJSON conversion also failed: {e2}")

            layer_type = 'tiles'  # Change type to tiles after conversion

        # Handle ZIP extraction
        zip_files = list(chart_path.glob('*.zip'))
        if zip_files:
            import zipfile
            for zip_file in zip_files:
                with zipfile.ZipFile(zip_file, 'r') as zip_ref:
                    zip_ref.extractall(chart_path)
                os.remove(zip_file)

        # Create layer metadata
        layer = {
            "id": chart_id,
            "name": chart_name,
            "type": layer_type,
            "path": str(chart_path),
            "url": f"/charts/{chart_id}",
            "enabled": True,
            "uploaded": datetime.now().isoformat()
        }

        chart_layers.append(layer)
        save_chart_metadata()

        print(f"✅ Chart uploaded: {chart_name} ({layer_type})")
        return layer

    except Exception as e:
        print(f"❌ Chart upload failed: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.delete("/api/charts/{chart_id}")
async def delete_chart(chart_id: str):
    """Delete a chart layer"""
    global chart_layers
    chart = next((c for c in chart_layers if c["id"] == chart_id), None)

    if chart:
        # Delete files
        chart_path = Path(chart["path"])
        if chart_path.exists():
            shutil.rmtree(chart_path)

        # Remove from list
        chart_layers = [c for c in chart_layers if c["id"] != chart_id]
        save_chart_metadata()

        return {"status": "deleted"}

    return {"error": "Chart not found"}

@app.patch("/api/charts/{chart_id}")
async def toggle_chart(chart_id: str, enabled: bool):
    """Toggle chart visibility and convert ENC if needed"""
    chart = next((c for c in chart_layers if c["id"] == chart_id), None)

    if not chart:
        return {"error": "Chart not found"}

    # If enabling an unconverted ENC chart, convert it first
    if enabled and chart["type"] == "enc" and not chart.get("converted", False):
        return {"status": "needs_conversion", "chart": chart}

    chart["enabled"] = enabled
    save_chart_metadata()
    return chart

@app.post("/api/charts/{chart_id}/convert")
async def convert_enc_chart(chart_id: str, background_tasks: BackgroundTasks):
    """Convert ENC chart to tiles"""
    chart = next((c for c in chart_layers if c["id"] == chart_id), None)

    if not chart:
        return {"error": "Chart not found"}

    if chart["type"] != "enc":
        return {"error": "Only ENC charts need conversion"}

    # Start conversion in background
    background_tasks.add_task(convert_enc_to_tiles, chart)

    return {"status": "conversion_started", "chart": chart}

def convert_enc_to_tiles(chart: dict):
    """Convert ENC .000 files to rendered PNG tiles using Python"""
    try:
        from osgeo import ogr, osr
        from PIL import Image, ImageDraw, ImageFont
        import math

        chart_path = Path(chart["path"])
        enc_files = list(chart_path.rglob("*.000"))

        if not enc_files:
            print(f"❌ No ENC files found in {chart_path}")
            return

        print(f"🔄 Rendering {len(enc_files)} ENC file(s) to tiles...")
        tiles_dir = chart_path / "tiles"
        tiles_dir.mkdir(exist_ok=True)

        # Helper functions for tile math
        def deg2num(lat_deg, lon_deg, zoom):
            lat_rad = math.radians(lat_deg)
            n = 2.0 ** zoom
            xtile = int((lon_deg + 180.0) / 360.0 * n)
            ytile = int((1.0 - math.asinh(math.tan(lat_rad)) / math.pi) / 2.0 * n)
            return (xtile, ytile)

        def num2deg(xtile, ytile, zoom):
            n = 2.0 ** zoom
            lon_deg = xtile / n * 360.0 - 180.0
            lat_rad = math.atan(math.sinh(math.pi * (1 - 2 * ytile / n)))
            lat_deg = math.degrees(lat_rad)
            return (lat_deg, lon_deg)

        # ENC S-57 layer styling (maritime colors)
        def get_layer_style(layer_name):
            """Return (fill_color, outline_color, width) for each layer type"""
            styles = {
                # Water areas
                'DEPARE': ((170, 211, 223, 150), (120, 180, 200, 200), 1),  # Depth areas - light blue
                'DRGARE': ((180, 220, 255, 120), (100, 150, 255, 200), 2),  # Dredged areas - blue
                'RIVERS': ((170, 211, 223, 180), (120, 180, 200, 220), 1),  # Rivers - light blue

                # Land areas
                'LNDARE': ((242, 230, 191, 200), (210, 180, 140, 255), 1),  # Land - beige
                'BUAARE': ((230, 220, 210, 180), (200, 180, 160, 255), 1),  # Built-up areas - gray-beige

                # Navigation aids
                'BOYLAT': (None, (255, 0, 255, 255), 3),     # Lateral buoys - magenta
                'BOYCAR': (None, (255, 255, 0, 255), 3),     # Cardinal buoys - yellow
                'BOYISD': (None, (255, 165, 0, 255), 3),     # Isolated danger - orange
                'BOYSAW': (None, (255, 0, 0, 255), 3),       # Safe water - red
                'BOYSPP': (None, (0, 255, 0, 255), 3),       # Special purpose - green
                'BCNLAT': (None, (255, 0, 255, 255), 2),     # Beacon lateral - magenta
                'BCNCAR': (None, (255, 255, 0, 255), 2),     # Beacon cardinal - yellow
                'LIGHTS': (None, (255, 255, 0, 255), 4),     # Lights - yellow

                # Depth contours
                'DEPCNT': (None, (120, 180, 200, 180), 1),   # Depth contour - blue lines

                # Obstructions
                'OBSTRN': (None, (255, 100, 100, 200), 2),   # Obstructions - red
                'UWTROC': (None, (255, 50, 50, 200), 2),     # Underwater rocks - dark red
                'WRECKS': ((139, 69, 19, 150), (100, 50, 10, 255), 2),  # Wrecks - brown

                # Fairways and channels
                'FAIRWY': ((200, 255, 200, 100), (100, 200, 100, 180), 2),  # Fairways - light green
                'NAVLNE': (None, (255, 0, 255, 200), 2),     # Navigation lines - magenta
                'CTNARE': ((255, 240, 200, 120), (200, 150, 100, 200), 2),  # Caution areas - yellow

                # Bridges and cables
                'BRIDGE': (None, (100, 100, 100, 255), 3),   # Bridges - gray
                'CBLARE': (None, (150, 150, 0, 200), 1),     # Cable areas - dark yellow

                # Default for unknown layers
                'DEFAULT': (None, (150, 150, 150, 180), 1),
            }
            return styles.get(layer_name, styles['DEFAULT'])

        # Step 1: Read all ENC features and get bounds
        all_features = []
        min_lat, min_lon, max_lat, max_lon = 90, 180, -90, -180

        for i, enc_file in enumerate(enc_files):
            print(f"  [{i+1}/{len(enc_files)}] Reading {enc_file.name}...")
            try:
                ds = ogr.Open(str(enc_file))
                if not ds:
                    continue

                for layer_idx in range(ds.GetLayerCount()):
                    try:
                        layer = ds.GetLayerByIndex(layer_idx)
                        if not layer:
                            continue
                        layer_name = layer.GetName()

                        # Skip metadata layers
                        if layer_name in ['DSID', 'DSPM']:
                            continue

                        # Reset reading to start
                        layer.ResetReading()

                        while True:
                            try:
                                feature = layer.GetNextFeature()
                                if not feature:
                                    break

                                geom = feature.GetGeometryRef()
                                if not geom:
                                    continue

                                # Get feature type and properties
                                feat_data = {
                                    'layer': layer_name,
                                    'geom': geom.Clone(),
                                    'type': geom.GetGeometryName(),
                                    'style': get_layer_style(layer_name)
                                }
                                all_features.append(feat_data)

                                # Update bounds
                                env = geom.GetEnvelope()
                                min_lon = min(min_lon, env[0])
                                max_lon = max(max_lon, env[1])
                                min_lat = min(min_lat, env[2])
                                max_lat = max(max_lat, env[3])
                            except Exception as feat_err:
                                # Skip features that can't be read (GDAL S-57 issues)
                                continue
                    except Exception as layer_err:
                        print(f"    ⚠️ Error reading layer {layer_idx}: {layer_err}")
                        continue

                ds = None
            except Exception as e:
                print(f"    ⚠️ Error reading {enc_file.name}: {e}")

        if not all_features:
            print(f"❌ No features found in ENC files")
            chart["converted"] = False
            save_chart_metadata()
            return

        print(f"📊 Found {len(all_features)} features, bounds: ({min_lat:.4f},{min_lon:.4f}) to ({max_lat:.4f},{max_lon:.4f})")

        # Sort features by rendering order (polygons first, then lines, then points)
        feature_order = {'POLYGON': 0, 'MULTIPOLYGON': 0, 'LINESTRING': 1, 'MULTILINESTRING': 1, 'POINT': 2, 'MULTIPOINT': 2}
        all_features.sort(key=lambda f: feature_order.get(f['type'], 3))

        # Step 2: Generate tiles for zoom levels 10-14
        tile_count = 0
        for zoom in range(10, 15):
            min_x, min_y = deg2num(max_lat, min_lon, zoom)
            max_x, max_y = deg2num(min_lat, max_lon, zoom)

            print(f"  Zoom {zoom}: tiles ({min_x},{min_y}) to ({max_x},{max_y})")

            for x in range(min_x, max_x + 1):
                for y in range(min_y, max_y + 1):
                    # Create tile image
                    tile_img = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
                    draw = ImageDraw.Draw(tile_img)

                    # Get tile bounds
                    north, west = num2deg(x, y, zoom)
                    south, east = num2deg(x + 1, y + 1, zoom)

                    def geo_to_pixel(lon, lat):
                        """Convert geographic coordinates to pixel coordinates"""
                        px = int((lon - west) / (east - west) * 256)
                        py = int((north - lat) / (north - south) * 256)
                        return (px, py)

                    # Draw features that intersect tile
                    for feat in all_features:
                        geom = feat['geom']
                        env = geom.GetEnvelope()

                        # Check if geometry intersects tile
                        if env[0] > east or env[1] < west or env[2] > north or env[3] < south:
                            continue

                        fill_color, outline_color, width = feat['style']
                        geom_type = geom.GetGeometryName()

                        try:
                            # POLYGONS - Fill and outline
                            if geom_type in ['POLYGON', 'MULTIPOLYGON']:
                                if geom_type == 'MULTIPOLYGON':
                                    geom_list = [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())]
                                else:
                                    geom_list = [geom]

                                for poly in geom_list:
                                    if poly.GetGeometryName() != 'POLYGON':
                                        continue
                                    # Get exterior ring
                                    ring = poly.GetGeometryRef(0)
                                    if ring:
                                        coords = [geo_to_pixel(ring.GetPoint(i)[0], ring.GetPoint(i)[1])
                                                 for i in range(ring.GetPointCount())]
                                        if len(coords) > 2:
                                            if fill_color:
                                                draw.polygon(coords, fill=fill_color, outline=outline_color, width=width)
                                            else:
                                                draw.polygon(coords, outline=outline_color, width=width)

                            # LINES - Draw lines
                            elif geom_type in ['LINESTRING', 'MULTILINESTRING']:
                                if geom_type == 'MULTILINESTRING':
                                    geom_list = [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())]
                                else:
                                    geom_list = [geom]

                                for line in geom_list:
                                    if line.GetGeometryName() != 'LINESTRING':
                                        continue
                                    coords = [geo_to_pixel(line.GetPoint(i)[0], line.GetPoint(i)[1])
                                             for i in range(line.GetPointCount())]
                                    if len(coords) > 1:
                                        draw.line(coords, fill=outline_color, width=width)

                            # POINTS - Draw circles/markers
                            elif geom_type in ['POINT', 'MULTIPOINT']:
                                if geom_type == 'MULTIPOINT':
                                    geom_list = [geom.GetGeometryRef(i) for i in range(geom.GetGeometryCount())]
                                else:
                                    geom_list = [geom]

                                for point in geom_list:
                                    if point.GetGeometryName() != 'POINT':
                                        continue
                                    lon, lat, _ = point.GetPoint(0)
                                    px, py = geo_to_pixel(lon, lat)
                                    radius = width + 2
                                    draw.ellipse([px-radius, py-radius, px+radius, py+radius],
                                               fill=outline_color, outline=(0, 0, 0, 255))

                        except Exception as e:
                            # Skip features that can't be drawn
                            pass

                    # Save tile if not empty
                    if tile_img.getbbox():
                        tile_dir = tiles_dir / str(zoom) / str(x)
                        tile_dir.mkdir(parents=True, exist_ok=True)
                        tile_path = tile_dir / f"{y}.png"
                        tile_img.save(tile_path, 'PNG')
                        tile_count += 1

        print(f"✅ Generated {tile_count} tiles!")

        # Update metadata - find the actual chart in chart_layers
        for i, c in enumerate(chart_layers):
            if c.get("id") == chart["id"]:
                chart_layers[i]["converted"] = True
                chart_layers[i]["enabled"] = True
                break
        save_chart_metadata()

    except Exception as e:
        print(f"❌ ENC tile rendering error: {e}")
        import traceback
        traceback.print_exc()
        # Update metadata - find the actual chart in chart_layers
        for i, c in enumerate(chart_layers):
            if c.get("id") == chart["id"]:
                chart_layers[i]["converted"] = False
                break
        save_chart_metadata()

def load_chart_layers():
    """Load chart metadata from disk"""
    global chart_layers
    metadata_file = CHARTS_DIR / "layers.json"

    if metadata_file.exists():
        with open(metadata_file, 'r') as f:
            chart_layers = json.load(f)
    else:
        chart_layers = []

    # Auto-detect converted status for ENC charts based on tiles directory
    for chart in chart_layers:
        if chart.get("type") == "enc":
            chart_path = Path(chart.get("path", ""))
            tiles_dir = chart_path / "tiles"
            # If tiles directory exists with actual tiles, mark as converted
            if tiles_dir.exists() and any(tiles_dir.rglob("*.png")):
                chart["converted"] = True
                print(f"✅ Auto-detected tiles for {chart.get('name', chart.get('id'))}")

def save_chart_metadata():
    """Save chart metadata to disk"""
    metadata_file = CHARTS_DIR / "layers.json"
    with open(metadata_file, 'w') as f:
        json.dump(chart_layers, f, indent=2)

# ==================== ENC DOWNLOAD (ELWIS) ====================
@app.get("/api/enc/catalog")
async def get_enc_catalog():
    """Get list of available ENC waterways from ELWIS"""
    try:
        response = requests.get(IENC_URL, timeout=10)
        soup = BeautifulSoup(response.text, "html.parser")

        waterways = []
        for link in soup.find_all("a", href=True):
            if "Download?file=" in link["href"]:
                name = link.text.strip()
                if name:
                    # Check if already downloaded
                    safe_name = name.replace("/", "_").replace(" ", "_").replace("(", "").replace(")", "")
                    chart_id = f"enc_{safe_name}"
                    downloaded = any(c.get("id") == chart_id for c in chart_layers)

                    waterways.append({
                        "id": safe_name,
                        "name": name,
                        "filename": safe_name + ".000",
                        "url": ELWIS_BASE_URL + link["href"] if not link["href"].startswith("http") else link["href"],
                        "downloaded": downloaded
                    })

        print(f"📊 ENC Catalog: {len(waterways)} waterways")
        return waterways
    except Exception as e:
        print(f"❌ ENC Catalog error: {e}")
        import traceback
        traceback.print_exc()
        return []

@app.post("/api/enc/download")
async def download_enc(request: Request):
    """
    Download ENC charts from ELWIS using 3-step process:
    1. Fetch download page HTML from Download?file= URL
    2. Extract File: link from HTML
    3. Download ZIP, extract .000 files, convert to GeoJSON
    """
    waterways = await request.json()
    results = {"success": 0, "failed": 0, "total": len(waterways), "details": []}

    for waterway in waterways:
        try:
            waterway_name = waterway.get("name", "Unknown")
            download_page_url = waterway.get("url", "")

            if not download_page_url:
                results["failed"] += 1
                results["details"].append({"name": waterway_name, "status": "failed", "error": "No URL provided"})
                continue

            print(f"📥 Processing {waterway_name}...")

            # Step 1: Fetch the download page HTML
            print(f"  Step 1: Fetching download page from {download_page_url}")
            page_response = requests.get(download_page_url, timeout=30)
            page_response.raise_for_status()

            # Step 2: Parse HTML to extract File: link
            print(f"  Step 2: Parsing HTML to find File: link")
            soup = BeautifulSoup(page_response.content, 'html.parser')

            # Find link containing "File:"
            file_link = None
            for link in soup.find_all('a', href=True):
                if 'File:' in link['href'] or '/Inland/IENC/' in link['href']:
                    file_link = link['href']
                    break

            if not file_link:
                results["failed"] += 1
                results["details"].append({"name": waterway_name, "status": "failed", "error": "File link not found in HTML"})
                print(f"  ❌ No File: link found")
                continue

            # Build full ZIP URL
            if not file_link.startswith('http'):
                zip_url = ELWIS_BASE_URL + file_link
            else:
                zip_url = file_link

            print(f"  Step 3: Downloading ZIP from {zip_url}")

            # Step 3: Download the ZIP file
            zip_response = requests.get(zip_url, timeout=60, stream=True)
            zip_response.raise_for_status()

            # Create chart directory
            chart_id = f"enc_{len(chart_layers) + 1}"
            chart_path = CHARTS_DIR / chart_id
            chart_path.mkdir(parents=True, exist_ok=True)

            # Save ZIP file
            zip_file_path = chart_path / f"{waterway_name}.zip"
            with open(zip_file_path, 'wb') as f:
                for chunk in zip_response.iter_content(chunk_size=8192):
                    f.write(chunk)

            print(f"  Step 4: Extracting ZIP file")

            # Step 4: Extract ZIP file
            with zipfile.ZipFile(zip_file_path, 'r') as zip_ref:
                zip_ref.extractall(chart_path)

            # Remove ZIP after extraction
            os.remove(zip_file_path)

            # Step 5: Find all .000 files (ENC catalog files)
            enc_files = list(chart_path.rglob("*.000"))

            if not enc_files:
                results["failed"] += 1
                results["details"].append({"name": waterway_name, "status": "failed", "error": "No .000 files found in ZIP"})
                print(f"  ❌ No .000 files found")
                # Clean up
                shutil.rmtree(chart_path)
                continue

            print(f"  Step 5: Converting {len(enc_files)} .000 file(s) to GeoJSON")

            # Step 6: Convert first .000 file to GeoJSON
            geojson_files = []
            for enc_file in enc_files:
                try:
                    geojson_file = enc_file.with_suffix('.geojson')

                    # Use ogr2ogr to convert S-57 ENC to GeoJSON
                    result = subprocess.run([
                        'ogr2ogr',
                        '-f', 'GeoJSON',
                        str(geojson_file),
                        str(enc_file)
                    ], capture_output=True, text=True, timeout=60)

                    if result.returncode == 0:
                        geojson_files.append(geojson_file)
                        print(f"  ✅ Converted {enc_file.name} to GeoJSON")
                    else:
                        print(f"  ⚠️ Failed to convert {enc_file.name}: {result.stderr}")

                except Exception as e:
                    print(f"  ⚠️ Conversion error for {enc_file.name}: {e}")

            # Step 7: Create chart layer metadata
            # Note: GeoJSON conversion may fail due to S-57 multi-layer format
            # We store the .000 files anyway for future ENC viewer support
            layer = {
                "id": chart_id,
                "name": waterway_name,
                "type": "enc",
                "path": str(chart_path),
                "url": f"/charts/{chart_id}",
                "enabled": False,  # Disabled by default until ENC viewer is implemented
                "uploaded": datetime.now().isoformat(),
                "enc_files": len(enc_files),
                "geojson_files": len(geojson_files),
                "converted": len(geojson_files) > 0
            }

            chart_layers.append(layer)
            save_chart_metadata()

            results["success"] += 1
            results["details"].append({"name": waterway_name, "status": "success", "files": len(enc_files)})
            print(f"  ✅ Successfully imported {waterway_name}")

        except requests.exceptions.RequestException as e:
            results["failed"] += 1
            results["details"].append({"name": waterway.get("name", "Unknown"), "status": "failed", "error": f"Network error: {str(e)}"})
            print(f"  ❌ Network error: {e}")

        except Exception as e:
            results["failed"] += 1
            results["details"].append({"name": waterway.get("name", "Unknown"), "status": "failed", "error": str(e)})
            print(f"  ❌ Error: {e}")
            import traceback
            traceback.print_exc()

    return results

# ==================== WEATHER ====================
@app.get("/api/weather")
async def get_weather(lang: str = "de"):
    """Get weather data with optional language parameter (de/en)"""
    # If weather_data is empty or language changed, fetch it
    if not weather_data or lang != weather_data.get("lang", "de"):
        await fetch_weather_once(lang)
    return weather_data

async def fetch_weather_once(lang: str = "de"):
    """Fetch weather data once with specified language"""
    global weather_data
    try:
        lat = sensor_data["gps"]["lat"]
        lon = sensor_data["gps"]["lon"]
        # Use fallback location if GPS not available (Aken/Elbe)
        if lat == 0 or lon == 0 or lat is None or lon is None:
            lat, lon = 51.855, 12.046

        async with aiohttp.ClientSession() as session:
            current_url = f"{OPENWEATHER_BASE_URL}/weather?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang={lang}"
            async with session.get(current_url) as resp:
                if resp.status == 200:
                    current = await resp.json()

                    forecast_url = f"{OPENWEATHER_BASE_URL}/forecast?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric&lang={lang}"
                    async with session.get(forecast_url) as fresp:
                        if fresp.status == 200:
                            forecast = await fresp.json()

                            weather_data = {
                                "lang": lang,
                                "current": {
                                    "temp": round(current["main"]["temp"], 1),
                                    "feels_like": round(current["main"]["feels_like"], 1),
                                    "pressure": current["main"]["pressure"],
                                    "humidity": current["main"]["humidity"],
                                    "description": current["weather"][0]["description"],
                                    "icon": current["weather"][0]["icon"],
                                    "wind_speed": round(current["wind"]["speed"] * 1.94384, 1),
                                    "wind_deg": current["wind"].get("direction", 0),
                                    "clouds": current["clouds"]["all"],
                                    "visibility": current.get("visibility", 0) / 1852,
                                    "timestamp": datetime.fromtimestamp(current["dt"]).isoformat()
                                },
                                "forecast": []
                            }

                            for i in range(0, min(24, len(forecast["list"])), 8):
                                f = forecast["list"][i]
                                weather_data["forecast"].append({
                                    "date": f["dt_txt"].split(" ")[0],
                                    "temp": round(f["main"]["temp"], 1),
                                    "description": f["weather"][0]["description"],
                                    "icon": f["weather"][0]["icon"],
                                    "wind_speed": round(f["wind"]["speed"] * 1.94384, 1),
                                    "wind_deg": f["wind"].get("deg", 0)
                                })

                            print(f"✅ Weather updated ({lang}): {weather_data['current']['temp']}°C, {weather_data['current']['description']}")
                else:
                    print(f"⚠️ Weather API error: {resp.status}")
    except Exception as e:
        print(f"⚠️ Weather fetch error: {e}")

async def fetch_weather():
    """Periodic weather fetch loop"""
    while True:
        await fetch_weather_once("de")
        await asyncio.sleep(1800)

# ==================== WEATHER ALERTS (DWD) ====================
@app.get("/api/weather/alerts")
async def get_weather_alerts():
    """Get current weather alerts from DWD via Bright Sky API"""
    try:
        lat = sensor_data["gps"]["lat"]
        lon = sensor_data["gps"]["lon"]

        # Use fallback location if GPS not available (Aken/Elbe)
        if lat == 0 or lon == 0 or lat is None or lon is None:
            lat, lon = 51.855, 12.046

        alerts_data = await weather_alerts.fetch_weather_alerts(lat, lon)

        # Format alerts for UI
        formatted_alerts = [
            weather_alerts.format_alert_for_ui(alert)
            for alert in alerts_data.get("alerts", [])
        ]

        return {
            "alerts": formatted_alerts,
            "count": len(formatted_alerts),
            "last_updated": alerts_data.get("last_updated"),
            "location": alerts_data.get("location")
        }
    except Exception as e:
        print(f"❌ Weather alerts endpoint error: {e}")
        return {"alerts": [], "count": 0, "error": str(e)}

@app.get("/api/weather/alerts/cached")
async def get_cached_weather_alerts():
    """Get cached weather alerts without making a new API call"""
    try:
        cached = weather_alerts.get_cached_alerts()

        # Format cached alerts for UI
        formatted_alerts = [
            weather_alerts.format_alert_for_ui(alert)
            for alert in cached.get("alerts", [])
        ]

        return {
            "alerts": formatted_alerts,
            "count": len(formatted_alerts),
            "last_updated": cached.get("last_updated"),
            "location": cached.get("location")
        }
    except Exception as e:
        print(f"❌ Cached weather alerts error: {e}")
        return {"alerts": [], "count": 0, "error": str(e)}

async def fetch_weather_alerts_periodic():
    """Periodic weather alerts fetch loop (every 10 minutes)"""
    while True:
        try:
            lat = sensor_data["gps"]["lat"]
            lon = sensor_data["gps"]["lon"]

            # Use fallback location if GPS not available
            if lat == 0 or lon == 0 or lat is None or lon is None:
                lat, lon = 51.855, 12.046

            await weather_alerts.fetch_weather_alerts(lat, lon)
        except Exception as e:
            print(f"⚠️ Periodic weather alerts fetch error: {e}")

        await asyncio.sleep(600)  # 10 minutes

# ==================== LOGBOOK ====================
@app.get("/api/logbook")
async def get_logbook():
    return current_session_entries

@app.get("/api/logbook/trips")
async def get_trips():
    """Get all completed trips"""
    return completed_trips

@app.get("/api/logbook/trip/{trip_id}")
async def get_trip_details(trip_id: int):
    """Get details for a specific trip including all entries"""
    trip = logbook_storage.get_logbook_entry(trip_id)
    if not trip:
        return {"error": "Trip not found"}
    return trip

@app.post("/api/logbook")
async def add_logbook_entry(entry: Dict[str, Any]):
    """Add a manual logbook entry"""
    entry["id"] = len(current_session_entries) + 1
    entry["timestamp"] = datetime.now().isoformat()

    # Add current position if not provided
    if "position" not in entry:
        entry["position"] = {
            "lat": sensor_data["gps"]["lat"],
            "lon": sensor_data["gps"]["lon"]
        }

    # Add current weather if requested and not provided
    if entry.get("include_weather", False) and "weather" not in entry:
        entry["weather"] = {
            "temp": weather_data.get("current", {}).get("temp"),
            "description": weather_data.get("current", {}).get("description"),
            "wind_speed": weather_data.get("current", {}).get("wind_speed"),
            "wind_deg": weather_data.get("current", {}).get("wind_deg")
        } if weather_data else None

    current_session_entries.append(entry)
    return entry

@app.delete("/api/logbook/{entry_id}")
async def delete_logbook_entry(entry_id: int):
    """Delete a logbook entry"""
    global current_session_entries, completed_trips
    
    # Delete from memory lists
    current_session_entries = [e for e in current_session_entries if e["id"] != entry_id]
    completed_trips = [e for e in completed_trips if e["id"] != entry_id]
    
    # Delete from persistent storage
    success = logbook_storage.delete_logbook_entry(entry_id)
    
    return {"status": "deleted" if success else "not_found", "id": entry_id}


@app.get("/api/track/status")
async def get_track_status():
    return {"recording": track_recording, "paused": track_paused, "points": len(current_track), "distance": calculate_track_distance()}

@app.post("/api/track/start")
async def start_track_recording(request: Dict[str, Any] = None):
    global track_recording, current_track
    track_recording = True
    current_track = []
    current_session_entries.clear()  # Clear session on new start

    # Get crew_ids from request if provided
    crew_ids = []
    if request:
        crew_ids = request.get("crew_ids", [])

    # Create automatic logbook entry for trip start with weather
    entry = {
        "id": len(current_session_entries) + 1,
        "type": "trip_start",
        "timestamp": datetime.now().isoformat(),
        "position": {
            "lat": sensor_data["gps"]["lat"],
            "lon": sensor_data["gps"]["lon"]
        },
        "weather": {
            "temp": weather_data.get("current", {}).get("temp"),
            "description": weather_data.get("current", {}).get("description"),
            "wind_speed": weather_data.get("current", {}).get("wind_speed"),
            "wind_deg": weather_data.get("current", {}).get("wind_deg")
        } if weather_data else None,
        "notes": "Fahrt gestartet",
        "crew_ids": crew_ids
    }
    current_session_entries.append(entry)

    return {"status": "started", "timestamp": datetime.now().isoformat(), "entry": entry}

@app.post("/api/track/stop")
async def stop_track_recording():
    global track_recording
    was_recording = track_recording
    track_recording = False

    # Speichere Trip nur wenn Aufzeichnung aktiv war
    if was_recording and len(current_session_entries) > 0:
        # Create trip_end entry with weather and statistics
        entry = {
            "id": len(current_session_entries) + 1,
            "type": "trip_end",
            "timestamp": datetime.now().isoformat(),
            "position": {
                "lat": sensor_data["gps"]["lat"],
                "lon": sensor_data["gps"]["lon"]
            },
            "weather": {
                "temp": weather_data.get("current", {}).get("temp"),
                "description": weather_data.get("current", {}).get("description"),
                "wind_speed": weather_data.get("current", {}).get("wind_speed"),
                "wind_deg": weather_data.get("current", {}).get("wind_deg")
            } if weather_data else None,
            "points": len(current_track),
            "distance": calculate_track_distance(),
            "duration": calculate_track_duration(),
            "track_data": current_track.copy(),
            "notes": f"Fahrt beendet - {calculate_track_distance()} NM"
        }
        current_session_entries.append(entry)

        # Get crew_ids from trip_start entry
        crew_ids = []
        if current_session_entries:
            for e in current_session_entries:
                if e.get("type") == "trip_start" and "crew_ids" in e:
                    crew_ids = e["crew_ids"]
                    break

        # Save complete trip with all session entries
        trip = {
            "id": len(completed_trips) + 1,
            "trip_start": current_session_entries[0]["timestamp"] if current_session_entries else None,
            "trip_end": entry["timestamp"],
            "entries": current_session_entries.copy(),
            "track_data": current_track.copy(),
            "distance": entry.get("distance"),
            "duration": entry.get("duration"),
            "points": entry.get("points"),
            "crew_ids": crew_ids
        }
        logbook_storage.save_logbook_entry(trip)
        completed_trips.append(trip)

        # Increment trip counter for each crew member
        if crew_ids:
            for crew_id in crew_ids:
                crew_management.increment_crew_trips(crew_id)

        current_session_entries.clear()  # Clear session after saving
        return entry
    return {"status": "stopped", "points": 0}

@app.post("/api/track/pause")
async def pause_track_recording():
    global track_paused
    if not track_recording:
        return {"error": "No active recording"}
    
    track_paused = True
    
    # Create logbook entry for pause
    entry = {
        "id": len(current_session_entries) + 1,
        "type": "trip_pause",
        "timestamp": datetime.now().isoformat(),
        "position": {
            "lat": sensor_data["gps"]["lat"],
            "lon": sensor_data["gps"]["lon"]
        },
        "notes": "Aufzeichnung pausiert"
    }
    current_session_entries.append(entry)
    
    return {"status": "paused", "timestamp": datetime.now().isoformat(), "entry": entry}

@app.post("/api/track/resume")
async def resume_track_recording():
    global track_paused
    if not track_recording:
        return {"error": "No active recording"}
    
    track_paused = False
    
    # Create logbook entry for resume
    entry = {
        "id": len(current_session_entries) + 1,
        "type": "trip_resume",
        "timestamp": datetime.now().isoformat(),
        "position": {
            "lat": sensor_data["gps"]["lat"],
            "lon": sensor_data["gps"]["lon"]
        },
        "notes": "Aufzeichnung fortgesetzt"
    }
    current_session_entries.append(entry)
    
    return {"status": "resumed", "timestamp": datetime.now().isoformat(), "entry": entry}

@app.get("/api/track/current")
async def get_current_track():
    return {"recording": track_recording, "points": current_track}

@app.get("/api/track/export/{entry_id}")
async def export_track_gpx(entry_id: int):
    entry = next((e for e in current_session_entries if e["id"] == entry_id), None)
    if not entry or "track_data" not in entry:
        return {"error": "Track not found"}
    gpx = generate_gpx(entry["track_data"], entry["timestamp"])
    return Response(content=gpx, media_type="application/gpx+xml",
                    headers={"Content-Disposition": f"attachment; filename=track_{entry_id}.gpx"})


@app.get("/api/trip/pdf/{trip_id}")
async def export_trip_pdf(trip_id: int):
    """Export trip as PDF"""
    trip = logbook_storage.get_logbook_entry(trip_id)
    if not trip:
        return {"error": "Trip not found"}
    
    pdf_buffer = pdf_export.generate_trip_pdf(trip)
    
    from datetime import datetime
    start_date = datetime.fromisoformat(trip["trip_start"]).strftime("%Y-%m-%d")
    filename = f"logbuch_{start_date}.pdf"
    
    return Response(content=pdf_buffer.getvalue(),
                    media_type="application/pdf",
                    headers={"Content-Disposition": f"attachment; filename={filename}"})
def calculate_track_distance():
    if len(current_track) < 2:
        return 0
    distance = 0
    for i in range(1, len(current_track)):
        lat1, lon1 = current_track[i-1]["lat"], current_track[i-1]["lon"]
        lat2, lon2 = current_track[i]["lat"], current_track[i]["lon"]
        # Skip if any coordinate is None
        if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
            continue
        R = 3440.065
        dlat = radians(lat2 - lat1)
        dlon = radians(lon2 - lon1)
        a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
        c = 2 * atan2(sqrt(a), sqrt(1-a))
        distance += R * c
    return round(distance, 2)

def calculate_track_duration():
    # Versuche zuerst aus Session-Einträgen (trip_start bis jetzt)
    if current_session_entries:
        for entry in current_session_entries:
            if entry.get("type") == "trip_start":
                try:
                    start = datetime.fromisoformat(entry["timestamp"])
                    end = datetime.now()
                    duration = end - start
                    total_seconds = int(duration.total_seconds())
                    hours = total_seconds // 3600
                    minutes = (total_seconds % 3600) // 60
                    return f"{hours}:{minutes:02d}"
                except:
                    pass

    # Fallback: aus Track-Punkten
    if len(current_track) >= 2:
        try:
            start = datetime.fromisoformat(current_track[0]["timestamp"])
            end = datetime.fromisoformat(current_track[-1]["timestamp"])
            duration = end - start
            total_seconds = int(duration.total_seconds())
            hours = total_seconds // 3600
            minutes = (total_seconds % 3600) // 60
            return f"{hours}:{minutes:02d}"
        except:
            pass

    return "0:00"

def generate_gpx(track_data, timestamp):
    gpx = f"""<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BoatOS"><metadata><name>BoatOS Track</name><time>{timestamp}</time></metadata><trk><name>Track {timestamp}</name><trkseg>
"""
    for point in track_data:
        gpx += f'<trkpt lat="{point["lat"]}" lon="{point["lon"]}"><time>{point["timestamp"]}</time></trkpt>\n'
    gpx += "</trkseg></trk></gpx>"
    return gpx

# ==================== SIGNALK ====================
async def signalk_listener():
    uri = "ws://localhost:3000/signalk/v1/stream?subscribe=all"
    while True:
        try:
            async with websockets.connect(uri) as ws:
                print("✅ SignalK connected")
                async for message in ws:
                    data = json.loads(message)
                    if "updates" in data:
                        for update in data["updates"]:
                            if "values" in update:
                                for value in update["values"]:
                                    path, val = value.get("path"), value.get("value")
                                    if path == "navigation.position":
                                        sensor_data["gps"] = {"lat": val.get("latitude", 0), "lon": val.get("longitude", 0)}
                                    elif path == "navigation.speedOverGround":
                                        sensor_data["speed"] = round(val * 1.94384, 1) if val is not None else 0
                                    elif path == "navigation.headingTrue":
                                        sensor_data["heading"] = round(val * 180 / 3.14159, 0) if val is not None else 0
                                    elif path == "environment.depth.belowTransducer":
                                        sensor_data["depth"] = round(val, 1)
        except Exception as e:
            print(f"⚠️ SignalK: {e}")
            await asyncio.sleep(5)

# ==================== TRACK RECORDING ====================
async def track_recording_loop():
    global current_track
    while True:
        await asyncio.sleep(10)
        if track_recording and not track_paused and sensor_data["gps"]["lat"] != 0:
            point = {"lat": sensor_data["gps"]["lat"], "lon": sensor_data["gps"]["lon"],
                     "timestamp": datetime.now().isoformat(), "speed": sensor_data["speed"],
                     "heading": sensor_data["heading"]}
            current_track.append(point)

# ==================== MQTT ====================
def load_known_topics():
    """Load known topics from persistent storage"""
    global known_topics
    try:
        with open("data/known_topics.json", "r") as f:
            known_topics = json.load(f)
            print(f"✅ Loaded {len(known_topics)} known topics from storage")
    except (FileNotFoundError, json.JSONDecodeError):
        known_topics = {}
        print("📋 No known topics file found, starting fresh")

def save_known_topics():
    """Save known topics to persistent storage"""
    try:
        os.makedirs("data", exist_ok=True)
        with open("data/known_topics.json", "w") as f:
            json.dump(known_topics, f, indent=2)
    except Exception as e:
        print(f"⚠️ Failed to save known topics: {e}")

def on_mqtt_message(client, userdata, msg):
    topic, payload = msg.topic, msg.payload.decode()
    import time
    current_time = time.time()

    try:
        # Update timestamp for this topic
        sensor_timestamps[topic] = current_time
        # Store actual payload value
        topic_values[topic] = payload

        # Store in known_topics (persistent)
        if topic not in known_topics:
            known_topics[topic] = {}
        known_topics[topic] = {
            "last_value": payload,
            "last_seen": current_time,
            "first_seen": known_topics.get(topic, {}).get("first_seen", current_time)
        }

        # Save known topics every 10 messages (throttled)
        if len(sensor_timestamps) % 10 == 0:
            save_known_topics()

        if topic == "boat/gps/latitude":
            gps_module_data["latitude"] = float(payload)
            update_gps_from_module()
        elif topic == "boat/gps/longitude":
            gps_module_data["longitude"] = float(payload)
            update_gps_from_module()
        elif topic == "boat/gps/satellites":
            gps_module_data["satellites"] = int(payload)
            sensor_data["gps"]["satellites"] = int(payload)
        elif topic == "boat/gps/altitude":
            gps_module_data["altitude"] = float(payload)
            sensor_data["gps"]["altitude"] = float(payload)
        elif topic == "boat/gps/speed":
            gps_module_data["speed"] = float(payload)
            sensor_data["speed"] = float(payload)
        elif topic == "boat/gps/course":
            gps_module_data["course"] = float(payload)
            sensor_data["gps"]["course"] = float(payload)
            sensor_data["heading"] = float(payload)
        elif "heater" in topic:
            sensor_data["heater"] = json.loads(payload)
        elif "engine" in topic:
            sensor_data["engine"].update(json.loads(payload))
        # Bilge Sensor (ESPHome/Tasmota via MQTT)
        elif "thermo_3b8790" in topic and "temperature" in topic:
            sensor_data["bilge"]["temperature"] = float(payload)
        elif "thermo_3b8790" in topic and "humidity" in topic:
            sensor_data["bilge"]["humidity"] = float(payload)
    except Exception as e:
        print(f"⚠️ MQTT parse error ({topic}): {e}")

def update_gps_from_module():
    """Update GPS position from collected MQTT data"""
    if "latitude" in gps_module_data and "longitude" in gps_module_data:
        lat = gps_module_data["latitude"]
        lon = gps_module_data["longitude"]
        if lat != 0 and lon != 0:
            sensor_data["gps"]["lat"] = lat
            sensor_data["gps"]["lon"] = lon
            print(f"📍 GPS: {lat:.6f}, {lon:.6f} ({gps_module_data.get('satellites', 0)} sats)")

def mqtt_client_init():
    client = mqtt.Client()
    client.on_message = on_mqtt_message
    try:
        client.connect("localhost", 1883, 60)
        client.subscribe("#")  # Subscribe to all topics
        client.loop_start()
        print("✅ MQTT connected (all topics: #)")
    except Exception as e:
        print(f"⚠️ MQTT connection failed: {e}")

# ==================== MQTT PUBLISHER (Home Assistant Integration) ====================
mqtt_publisher_client = None

def mqtt_publisher_init():
    """Initialize MQTT publisher for Home Assistant integration"""
    global mqtt_publisher_client
    try:
        mqtt_publisher_client = mqtt.Client(client_id="boatos_publisher")
        mqtt_publisher_client.connect("localhost", 1883, 60)
        mqtt_publisher_client.loop_start()
        print("✅ MQTT Publisher connected for Home Assistant")

        # Send Home Assistant MQTT Discovery messages
        send_ha_discovery_messages()
    except Exception as e:
        print(f"⚠️ MQTT Publisher connection failed: {e}")

def send_ha_discovery_messages():
    """Send Home Assistant MQTT Discovery configuration for all sensors"""
    if not mqtt_publisher_client:
        return

    # Device info (shared across all sensors)
    device_info = {
        "identifiers": ["boatos_main"],
        "name": "BoatOS",
        "model": "BoatOS v1.0",
        "manufacturer": "BoatOS Project",
        "sw_version": "1.0.0"
    }

    # GPS Sensors
    sensors = [
        # GPS
        {
            "name": "GPS Latitude",
            "unique_id": "boatos_gps_lat",
            "state_topic": "boatos/gps/latitude",
            "unit_of_measurement": "°",
            "icon": "mdi:crosshairs-gps",
            "device_class": None,
            "value_template": "{{ value_json.lat }}"
        },
        {
            "name": "GPS Longitude",
            "unique_id": "boatos_gps_lon",
            "state_topic": "boatos/gps/longitude",
            "unit_of_measurement": "°",
            "icon": "mdi:crosshairs-gps",
            "device_class": None,
            "value_template": "{{ value_json.lon }}"
        },
        {
            "name": "GPS Position",
            "unique_id": "boatos_gps_position",
            "state_topic": "boatos/gps/position",
            "icon": "mdi:map-marker",
            "device_class": None,
            "value_template": "{{ value_json.lat }}, {{ value_json.lon }}"
        },
        {
            "name": "GPS Satellites",
            "unique_id": "boatos_gps_satellites",
            "state_topic": "boatos/gps/satellites",
            "icon": "mdi:satellite-variant",
            "device_class": None,
            "value_template": "{{ value }}"
        },
        {
            "name": "GPS Altitude",
            "unique_id": "boatos_gps_altitude",
            "state_topic": "boatos/gps/altitude",
            "unit_of_measurement": "m",
            "icon": "mdi:elevation-rise",
            "device_class": "distance",
            "value_template": "{{ value }}"
        },
        {
            "name": "GPS Course",
            "unique_id": "boatos_gps_course",
            "state_topic": "boatos/gps/course",
            "unit_of_measurement": "°",
            "icon": "mdi:compass",
            "device_class": None,
            "value_template": "{{ value }}"
        },

        # Navigation
        {
            "name": "Speed Over Ground",
            "unique_id": "boatos_speed",
            "state_topic": "boatos/navigation/speed",
            "unit_of_measurement": "kn",
            "icon": "mdi:speedometer",
            "device_class": "speed",
            "value_template": "{{ value }}"
        },
        {
            "name": "Heading",
            "unique_id": "boatos_heading",
            "state_topic": "boatos/navigation/heading",
            "unit_of_measurement": "°",
            "icon": "mdi:compass-outline",
            "device_class": None,
            "value_template": "{{ value }}"
        },
        {
            "name": "Water Depth",
            "unique_id": "boatos_depth",
            "state_topic": "boatos/navigation/depth",
            "unit_of_measurement": "m",
            "icon": "mdi:waves",
            "device_class": "distance",
            "value_template": "{{ value }}"
        },

        # Wind
        {
            "name": "Wind Speed",
            "unique_id": "boatos_wind_speed",
            "state_topic": "boatos/wind/speed",
            "unit_of_measurement": "kn",
            "icon": "mdi:weather-windy",
            "device_class": "wind_speed",
            "value_template": "{{ value }}"
        },
        {
            "name": "Wind Direction",
            "unique_id": "boatos_wind_direction",
            "state_topic": "boatos/wind/direction",
            "unit_of_measurement": "°",
            "icon": "mdi:windsock",
            "device_class": None,
            "value_template": "{{ value }}"
        },

        # Engine
        {
            "name": "Engine RPM",
            "unique_id": "boatos_engine_rpm",
            "state_topic": "boatos/engine/rpm",
            "unit_of_measurement": "RPM",
            "icon": "mdi:engine",
            "device_class": None,
            "value_template": "{{ value }}"
        },
        {
            "name": "Engine Temperature",
            "unique_id": "boatos_engine_temp",
            "state_topic": "boatos/engine/temperature",
            "unit_of_measurement": "°C",
            "icon": "mdi:thermometer",
            "device_class": "temperature",
            "value_template": "{{ value }}"
        },
        {
            "name": "Engine Oil Pressure",
            "unique_id": "boatos_engine_oil",
            "state_topic": "boatos/engine/oil_pressure",
            "unit_of_measurement": "bar",
            "icon": "mdi:oil",
            "device_class": "pressure",
            "value_template": "{{ value }}"
        },

        # Battery
        {
            "name": "Battery Voltage",
            "unique_id": "boatos_battery_voltage",
            "state_topic": "boatos/battery/voltage",
            "unit_of_measurement": "V",
            "icon": "mdi:battery",
            "device_class": "voltage",
            "value_template": "{{ value }}"
        },
        {
            "name": "Battery Current",
            "unique_id": "boatos_battery_current",
            "state_topic": "boatos/battery/current",
            "unit_of_measurement": "A",
            "icon": "mdi:current-dc",
            "device_class": "current",
            "value_template": "{{ value }}"
        },

        # Future sensors (placeholders)
        {
            "name": "Water Temperature",
            "unique_id": "boatos_water_temp",
            "state_topic": "boatos/environment/water_temperature",
            "unit_of_measurement": "°C",
            "icon": "mdi:thermometer-water",
            "device_class": "temperature",
            "value_template": "{{ value }}"
        },
        {
            "name": "Air Temperature",
            "unique_id": "boatos_air_temp",
            "state_topic": "boatos/environment/air_temperature",
            "unit_of_measurement": "°C",
            "icon": "mdi:thermometer",
            "device_class": "temperature",
            "value_template": "{{ value }}"
        },
        {
            "name": "Humidity",
            "unique_id": "boatos_humidity",
            "state_topic": "boatos/environment/humidity",
            "unit_of_measurement": "%",
            "icon": "mdi:water-percent",
            "device_class": "humidity",
            "value_template": "{{ value }}"
        },
        {
            "name": "Barometric Pressure",
            "unique_id": "boatos_pressure",
            "state_topic": "boatos/environment/pressure",
            "unit_of_measurement": "hPa",
            "icon": "mdi:gauge",
            "device_class": "atmospheric_pressure",
            "value_template": "{{ value }}"
        },
        {
            "name": "Fuel Level",
            "unique_id": "boatos_fuel_level",
            "state_topic": "boatos/tank/fuel_level",
            "unit_of_measurement": "%",
            "icon": "mdi:fuel",
            "device_class": None,
            "value_template": "{{ value }}"
        },
        {
            "name": "Fresh Water Level",
            "unique_id": "boatos_water_level",
            "state_topic": "boatos/tank/water_level",
            "unit_of_measurement": "%",
            "icon": "mdi:water",
            "device_class": None,
            "value_template": "{{ value }}"
        },
        {
            "name": "Bilge Level",
            "unique_id": "boatos_bilge_level",
            "state_topic": "boatos/tank/bilge_level",
            "unit_of_measurement": "%",
            "icon": "mdi:water-alert",
            "device_class": None,
            "value_template": "{{ value }}"
        },
    ]

    # Binary sensors
    binary_sensors = [
        {
            "name": "Track Recording Active",
            "unique_id": "boatos_track_recording",
            "state_topic": "boatos/status/track_recording",
            "icon": "mdi:record-rec",
            "device_class": None,
            "payload_on": "true",
            "payload_off": "false",
            "value_template": "{{ value }}"
        },
        {
            "name": "GPS Fix",
            "unique_id": "boatos_gps_fix",
            "state_topic": "boatos/status/gps_fix",
            "icon": "mdi:crosshairs-gps",
            "device_class": "connectivity",
            "payload_on": "true",
            "payload_off": "false",
            "value_template": "{{ value }}"
        },
        {
            "name": "Anchor Alarm",
            "unique_id": "boatos_anchor_alarm",
            "state_topic": "boatos/alarm/anchor",
            "icon": "mdi:anchor",
            "device_class": None,
            "payload_on": "true",
            "payload_off": "false",
            "value_template": "{{ value }}"
        },
        {
            "name": "Bilge Pump Active",
            "unique_id": "boatos_bilge_pump",
            "state_topic": "boatos/status/bilge_pump",
            "icon": "mdi:pump",
            "device_class": None,
            "payload_on": "true",
            "payload_off": "false",
            "value_template": "{{ value }}"
        },
    ]

    # Send discovery messages for sensors
    for sensor in sensors:
        config = {
            "name": sensor["name"],
            "unique_id": sensor["unique_id"],
            "state_topic": sensor["state_topic"],
            "icon": sensor["icon"],
            "device": device_info
        }

        if sensor.get("unit_of_measurement"):
            config["unit_of_measurement"] = sensor["unit_of_measurement"]
        if sensor.get("device_class"):
            config["device_class"] = sensor["device_class"]
        if sensor.get("value_template"):
            config["value_template"] = sensor["value_template"]

        topic = f"homeassistant/sensor/{sensor['unique_id']}/config"
        mqtt_publisher_client.publish(topic, json.dumps(config), retain=True)

    # Send discovery messages for binary sensors
    for sensor in binary_sensors:
        config = {
            "name": sensor["name"],
            "unique_id": sensor["unique_id"],
            "state_topic": sensor["state_topic"],
            "icon": sensor["icon"],
            "payload_on": sensor["payload_on"],
            "payload_off": sensor["payload_off"],
            "device": device_info
        }

        if sensor.get("device_class"):
            config["device_class"] = sensor["device_class"]
        if sensor.get("value_template"):
            config["value_template"] = sensor["value_template"]

        topic = f"homeassistant/binary_sensor/{sensor['unique_id']}/config"
        mqtt_publisher_client.publish(topic, json.dumps(config), retain=True)

    print("📡 Home Assistant MQTT Discovery messages sent")

async def publish_sensor_data():
    """Publish sensor data to MQTT every 2 seconds"""
    while True:
        try:
            if mqtt_publisher_client and mqtt_publisher_client.is_connected():
                # Get current GPS data
                gps_status = gps_service.get_gps_status()
                sensor_data["gps"] = gps_status

                # Publish GPS data
                mqtt_publisher_client.publish("boatos/gps/latitude", json.dumps({"lat": sensor_data["gps"]["lat"]}))
                mqtt_publisher_client.publish("boatos/gps/longitude", json.dumps({"lon": sensor_data["gps"]["lon"]}))
                mqtt_publisher_client.publish("boatos/gps/position", json.dumps({
                    "lat": sensor_data["gps"]["lat"],
                    "lon": sensor_data["gps"]["lon"]
                }))
                mqtt_publisher_client.publish("boatos/gps/satellites", str(sensor_data["gps"]["satellites"]))
                mqtt_publisher_client.publish("boatos/gps/altitude", str(sensor_data["gps"]["altitude"]))
                mqtt_publisher_client.publish("boatos/gps/course", str(sensor_data["gps"]["course"]))

                # Publish navigation data
                mqtt_publisher_client.publish("boatos/navigation/speed", str(sensor_data["speed"]))
                mqtt_publisher_client.publish("boatos/navigation/heading", str(sensor_data["heading"]))
                mqtt_publisher_client.publish("boatos/navigation/depth", str(sensor_data["depth"]))

                # Publish wind data
                mqtt_publisher_client.publish("boatos/wind/speed", str(sensor_data["wind"]["speed"]))
                mqtt_publisher_client.publish("boatos/wind/direction", str(sensor_data["wind"]["direction"]))

                # Publish engine data
                mqtt_publisher_client.publish("boatos/engine/rpm", str(sensor_data["engine"]["rpm"]))
                mqtt_publisher_client.publish("boatos/engine/temperature", str(sensor_data["engine"]["temp"]))
                mqtt_publisher_client.publish("boatos/engine/oil_pressure", str(sensor_data["engine"]["oil_pressure"]))

                # Publish battery data
                mqtt_publisher_client.publish("boatos/battery/voltage", str(sensor_data["battery"]["voltage"]))
                mqtt_publisher_client.publish("boatos/battery/current", str(sensor_data["battery"]["current"]))

                # Publish status data
                mqtt_publisher_client.publish("boatos/status/track_recording", "true" if track_recording else "false")
                mqtt_publisher_client.publish("boatos/status/gps_fix", "true" if sensor_data["gps"]["satellites"] >= 4 else "false")

                # Future sensors (publish 0/null if not available yet)
                mqtt_publisher_client.publish("boatos/environment/water_temperature", "0")
                mqtt_publisher_client.publish("boatos/environment/air_temperature", "0")
                mqtt_publisher_client.publish("boatos/environment/humidity", "0")
                mqtt_publisher_client.publish("boatos/environment/pressure", "0")
                mqtt_publisher_client.publish("boatos/tank/fuel_level", "0")
                mqtt_publisher_client.publish("boatos/tank/water_level", "0")
                mqtt_publisher_client.publish("boatos/tank/bilge_level", "0")
                mqtt_publisher_client.publish("boatos/alarm/anchor", "false")
                mqtt_publisher_client.publish("boatos/status/bilge_pump", "false")

        except Exception as e:
            print(f"⚠️ MQTT publish error: {e}")

        await asyncio.sleep(2)  # Publish every 2 seconds

# ==================== WATERWAY ROUTING ====================
osrm_router = None
pyroutelib_router = None

async def generate_lua_profile(boat: Dict[str, Any]):
    """
    Generate dynamic OSRM Lua profile from boat specifications

    Args:
        boat: Dict with draft (m), height (m), beam (m), etc.
    """
    try:
        # Extract boat specifications with safety margins
        draft = boat.get('draft', 1.5)
        height = boat.get('height', 2.5)
        beam = boat.get('beam', 2.0)

        # Add safety margins (20% for draft, 0.5m for height)
        min_depth = draft * 1.2 if draft > 0 else 1.5
        min_clearance = height + 0.5 if height > 0 else 2.5

        # Read base profile template
        template_path = Path("profiles/motorboat.lua")
        if not template_path.exists():
            print(f"⚠️ Base profile template not found at {template_path}")
            return

        with open(template_path, 'r', encoding='utf-8') as f:
            profile_content = f.read()

        # Replace depth and clearance values
        profile_content = profile_content.replace(
            'min_depth_meters          = 1.5',
            f'min_depth_meters          = {min_depth:.2f}'
        )
        profile_content = profile_content.replace(
            'min_clearance_meters      = 2.5',
            f'min_clearance_meters      = {min_clearance:.2f}'
        )

        # Add boat specifications as comments for documentation
        boat_info = f"""-- Generated from boat specifications:
-- Name: {boat.get('name', 'Unknown')}
-- Draft: {draft}m (routing requires {min_depth:.2f}m minimum depth)
-- Height: {height}m (routing requires {min_clearance:.2f}m minimum clearance)
-- Beam: {beam}m
-- Generated: {datetime.now().isoformat()}

"""
        profile_content = boat_info + profile_content

        # Write custom profile
        custom_profile_path = Path("profiles/motorboat_custom.lua")
        with open(custom_profile_path, 'w', encoding='utf-8') as f:
            f.write(profile_content)

        print(f"✅ Generated custom Lua profile: draft={draft}m → min_depth={min_depth:.2f}m, height={height}m → min_clearance={min_clearance:.2f}m")

        # TODO: Restart OSRM with new profile (requires system command)
        # For now, the profile will be used on next OSRM restart

    except Exception as e:
        print(f"❌ Lua profile generation error: {e}")
        import traceback
        traceback.print_exc()

def init_waterway_router():
    """
    Initialize waterway routers with fallback strategy:
    1. OSRM (fast, local server, best for waterways)
    2. PyRouteLib (Python-based OSM routing, slower but works)
    3. Direct line (Rhumbline fallback)
    """
    global osrm_router, pyroutelib_router

    # Load settings
    osrm_url = "http://127.0.0.1:5000"
    routing_provider = "osrm"  # Default
    osm_file = None

    try:
        with open("data/settings.json", 'r') as f:
            settings = json.load(f)
            routing_config = settings.get('routing', {})
            osrm_url = routing_config.get('osrmUrl', osrm_url)
            routing_provider = routing_config.get('provider', 'osrm')
            osm_file = routing_config.get('osmFile', '/home/arielle/osrm_data/germany-latest.osm.pbf')
    except:
        pass

    # Try to initialize OSRM
    try:
        from osrm_routing import OSRMRouter
        osrm_router = OSRMRouter(osrm_url=osrm_url)
        print(f"✅ OSRM router initialized ({osrm_url})")

        # Check OSRM health in background
        asyncio.create_task(osrm_router.check_health())
    except Exception as e:
        print(f"⚠️ OSRM router initialization failed: {e}")
        osrm_router = None

    # Try to initialize PyRouteLib as fallback (only with local OSM file - no Overpass API)
    try:
        from pyroutelib_routing import PyRouteLibRouter
        pyroutelib_router = PyRouteLibRouter(osm_file=osm_file if osm_file and Path(osm_file).exists() else None)
        if pyroutelib_router.enabled:
            print(f"✅ PyRouteLib router initialized (fallback)")
        else:
            print(f"ℹ️ PyRouteLib fallback not available (no local OSM file)")
    except Exception as e:
        print(f"⚠️ PyRouteLib router initialization failed: {e}")
        pyroutelib_router = None

@app.post("/api/route")
async def calculate_route(request: dict):
    """
    Calculate route through waypoints using multi-tier waterway routing

    Request body: {
        "waypoints": [[lon, lat], [lon, lat], ...],
        "boat_draft": float (optional, meters),
        "boat_height": float (optional, meters),
        "boat_beam": float (optional, meters)
    }

    Strategy (priority order):
    1. OSRM waterway routing (fast <100ms, local, follows waterways)
    2. PyRouteLib OSM routing (slow 5-30s, follows waterways via Overpass)
    3. Direct line (Rhumbline - instant fallback)

    Returns:
    - GeoJSON Feature with route geometry
    - Properties: distance_m, distance_nm, routing_type, locks, bridges
    """
    try:
        waypoints_raw = request.get("waypoints", [])

        if len(waypoints_raw) < 2:
            return {"error": "Need at least 2 waypoints"}

        # Convert to tuples (lon, lat)
        waypoints = [(float(wp[0]), float(wp[1])) for wp in waypoints_raw]

        # Extract boat data if provided
        boat_data = None
        if any(key in request for key in ["boat_draft", "boat_height", "boat_beam"]):
            boat_data = {
                "draft": request.get("boat_draft", 0),
                "height": request.get("boat_height", 0),
                "beam": request.get("boat_beam", 0)
            }

        # Strategy 1: Try OSRM (fastest, best)
        if osrm_router and osrm_router.enabled:
            try:
                print("🚀 Trying OSRM waterway routing...")
                route = await osrm_router.route(waypoints, boat_data)
                if route.get("properties", {}).get("routing_type") == "osrm":
                    # Adjust ETA based on water currents
                    route_geometry = route["geometry"]["coordinates"]
                    distance_km = route["properties"]["distance_m"] / 1000

                    # Get boat speed from settings or use default
                    boat_speed_kmh = 15  # Default cruise speed
                    try:
                        with open("data/settings.json", 'r') as f:
                            settings = json.load(f)
                            boat_settings = settings.get('boat', {})
                            # Try both camelCase (cruiseSpeed) and snake_case (cruise_speed)
                            boat_speed_kmh = boat_settings.get('cruiseSpeed') or boat_settings.get('cruise_speed') or 15
                    except Exception as e:
                        pass

                    adjusted_duration_h, current_info = water_current_service.adjust_route_duration(
                        route_geometry, distance_km, boat_speed_kmh
                    )

                    if current_info:
                        route["properties"]["duration_adjusted_h"] = adjusted_duration_h
                        route["properties"]["current_adjustment"] = current_info
                        print(f"🌊 Route duration adjusted for currents: {adjusted_duration_h:.2f}h")

                    # Find locks along the route
                    try:
                        locks_on_route = locks_storage.get_locks_on_route(route_geometry, buffer_meters=500)

                        # Filter out locks already provided by OSRM
                        osrm_locks = route["properties"].get("locks", [])
                        if locks_on_route and len(locks_on_route) > 0:
                            # Merge with OSRM locks, avoiding duplicates
                            route["properties"]["locks_from_db"] = locks_on_route

                            # Calculate total lock time and add to duration
                            total_lock_time_h = 0
                            for lock in locks_on_route:
                                lock_duration_min = lock.get('avg_duration', 15)  # Default 15 min
                                total_lock_time_h += lock_duration_min / 60

                            # Adjust duration for locks
                            if route["properties"].get("duration_adjusted_h"):
                                route["properties"]["duration_with_locks_h"] = route["properties"]["duration_adjusted_h"] + total_lock_time_h
                            else:
                                base_duration = route["properties"]["distance_nm"] / (boat_speed_kmh / 1.852)
                                route["properties"]["duration_with_locks_h"] = base_duration + total_lock_time_h

                            print(f"🔒 Found {len(locks_on_route)} locks on route (+{total_lock_time_h*60:.0f} min)")

                            # Check lock availability at arrival times
                            try:
                                # Use current time or provided departure time
                                departure_time = datetime.now()
                                if request.get("departure_time"):
                                    try:
                                        departure_time = datetime.fromisoformat(request["departure_time"])
                                    except:
                                        pass

                                lock_warnings = locks_storage.check_locks_availability(
                                    locks_on_route,
                                    departure_time,
                                    boat_speed_kmh
                                )

                                if lock_warnings:
                                    route["properties"]["lock_warnings"] = lock_warnings
                                    print(f"⚠️ {len(lock_warnings)} lock(s) will be closed at arrival time")
                                    for warning in lock_warnings:
                                        print(f"   - {warning['lock_name']}: arrives {warning['estimated_arrival_formatted']}, {warning['reason']}")
                            except Exception as e:
                                print(f"⚠️ Lock availability check error: {e}")

                    except Exception as e:
                        print(f"⚠️ Lock detection error: {e}")

                    return route
            except Exception as e:
                print(f"⚠️ OSRM routing failed: {e}")

        # Strategy 2: Try PyRouteLib (slower but follows waterways)
        if pyroutelib_router and pyroutelib_router.enabled:
            try:
                print("🚤 Trying PyRouteLib waterway routing...")
                route = await pyroutelib_router.route(waypoints)
                if route.get("properties", {}).get("routing_type") == "pyroutelib":
                    return route
            except Exception as e:
                print(f"⚠️ PyRouteLib routing failed: {e}")

        # Strategy 3: Direct line fallback
        print("📏 Using direct line routing (fallback)")
        from osrm_routing import OSRMRouter
        fallback = OSRMRouter()
        return fallback._direct_route(waypoints)

    except Exception as e:
        print(f"❌ Routing error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

# ==================== ROUTING REGIONS MANAGEMENT ====================
@app.get("/api/routing/regions")
async def get_available_regions():
    """
    Get list of available OSRM regions

    Returns:
        List of region names that are available for routing
    """
    osrm_dir = Path("/home/arielle/BoatOS/data/osrm")

    # Find all .osrm.properties files
    properties_files = list(osrm_dir.glob("*-latest.osrm.properties"))

    regions = []
    for prop_file in sorted(properties_files):
        region_name = prop_file.name.replace("-latest.osrm.properties", "")

        # Pretty names
        display_names = {
            "baden-wuerttemberg": "Baden-Württemberg",
            "bayern": "Bayern",
            "berlin": "Berlin",
            "brandenburg": "Brandenburg",
            "bremen": "Bremen",
            "hamburg": "Hamburg",
            "hessen": "Hessen",
            "mecklenburg-vorpommern": "Mecklenburg-Vorpommern",
            "niedersachsen": "Niedersachsen",
            "nordrhein-westfalen": "Nordrhein-Westfalen",
            "rheinland-pfalz": "Rheinland-Pfalz",
            "saarland": "Saarland",
            "sachsen": "Sachsen",
            "sachsen-anhalt": "Sachsen-Anhalt",
            "schleswig-holstein": "Schleswig-Holstein",
            "thueringen": "Thüringen",
            "germany": "Deutschland (komplett)",
            "elbe": "Elbe (Sachsen-Anhalt + Brandenburg + Sachsen)"
        }

        regions.append({
            "id": region_name,
            "name": display_names.get(region_name, region_name.replace("-", " ").title())
        })

    return {"regions": regions, "count": len(regions)}

@app.get("/api/routing/current-region")
async def get_current_region():
    """
    Get currently active OSRM region

    Returns:
        Currently loaded region name
    """
    try:
        # Check which osrm-routed process is running
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=5
        )

        for line in result.stdout.split('\n'):
            if 'osrm-routed' in line and '--algorithm=MLD' in line:
                # Extract filename from command line
                match = re.search(r'/([^/]+)-latest\.osrm', line)
                if match:
                    region = match.group(1)
                    return {"region": region, "running": True}

        return {"region": None, "running": False}
    except Exception as e:
        return {"error": str(e), "running": False}

@app.post("/api/routing/switch-region")
async def switch_region(request: dict):
    """
    Switch to a different OSRM region

    Request body: {
        "region": "region-name"  # e.g., "hamburg", "germany"
    }

    Returns:
        Status of the region switch
    """
    region = request.get("region")

    if not region:
        return {"success": False, "error": "Region name required"}

    # Check if region files exist (use .osrm.properties as indicator)
    osrm_properties = Path(f"/home/arielle/BoatOS/data/osrm/{region}-latest.osrm.properties")

    if not osrm_properties.exists():
        return {"success": False, "error": f"Region '{region}' not found"}

    # osrm-routed needs the base path without extension
    osrm_file = Path(f"/home/arielle/BoatOS/data/osrm/{region}-latest.osrm")

    try:
        # Kill current osrm-routed process
        subprocess.run(["pkill", "-9", "osrm-routed"], timeout=5)
        print(f"🛑 Stopped osrm-routed")

        # Wait a moment for process to fully terminate
        await asyncio.sleep(1)

        # Start new osrm-routed with selected region
        subprocess.Popen([
            "/usr/local/bin/osrm-routed",
            "--algorithm=MLD",
            str(osrm_file),
            "--port", "5000"
        ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

        print(f"✅ Started osrm-routed with region: {region}")

        # Wait for OSRM to start
        await asyncio.sleep(2)

        # Verify it started
        result = subprocess.run(
            ["ps", "aux"],
            capture_output=True,
            text=True,
            timeout=5
        )

        if 'osrm-routed' in result.stdout and region in result.stdout:
            return {
                "success": True,
                "region": region,
                "message": f"Successfully switched to region: {region}"
            }
        else:
            return {
                "success": False,
                "error": "OSRM failed to start with new region"
            }

    except Exception as e:
        return {"success": False, "error": str(e)}

# ==================== CREW MANAGEMENT ====================
@app.get("/api/crew")
async def get_crew():
    """Get all crew members"""
    return crew_management.load_crew()

@app.get("/api/crew/{crew_id}")
async def get_crew_member_by_id(crew_id: int):
    """Get a specific crew member by ID"""
    member = crew_management.get_crew_member(crew_id)
    if not member:
        return {"error": "Crew member not found"}
    return member

@app.post("/api/crew")
async def create_crew_member(request: dict):
    """
    Create a new crew member

    Request body: {
        "name": str (required),
        "role": str (optional, default "Crew"),
        "email": str (optional),
        "phone": str (optional)
    }
    """
    name = request.get("name")
    if not name:
        return {"error": "Name is required"}

    role = request.get("role", "Crew")
    email = request.get("email", "")
    phone = request.get("phone", "")

    member = crew_management.add_crew_member(name, role, email, phone)
    return member

@app.put("/api/crew/{crew_id}")
async def update_crew_member_by_id(crew_id: int, request: dict):
    """Update crew member information"""
    member = crew_management.update_crew_member(crew_id, request)
    if not member:
        return {"error": "Crew member not found"}
    return member

@app.delete("/api/crew/{crew_id}")
async def delete_crew_member_by_id(crew_id: int):
    """Delete a crew member"""
    success = crew_management.delete_crew_member(crew_id)
    return {"status": "deleted" if success else "not_found"}

@app.get("/api/crew/stats")
async def get_crew_statistics():
    """Get crew statistics"""
    return crew_management.get_crew_stats()

# ==================== FUEL TRACKING ====================
@app.get("/api/fuel")
async def get_fuel_entries():
    """Get all fuel entries"""
    return fuel_tracking.load_fuel_entries()

@app.get("/api/fuel/stats")
async def get_fuel_statistics(days: int = 30):
    """Get fuel statistics for the last N days"""
    return fuel_tracking.get_fuel_stats(days)

@app.get("/api/fuel/consumption")
async def get_fuel_consumption_stats():
    """Get fuel consumption statistics (L/NM, L/h, range, etc.)"""
    return fuel_tracking.get_consumption_stats()

@app.get("/api/fuel/consumption/trend")
async def get_fuel_consumption_trend(months: int = 6):
    """Get monthly fuel consumption trend"""
    return fuel_tracking.get_consumption_trend(months)

@app.get("/api/fuel/{fuel_id}")
async def get_fuel_entry_by_id(fuel_id: int):
    """Get a specific fuel entry by ID"""
    entry = fuel_tracking.get_fuel_entry(fuel_id)
    if not entry:
        return {"error": "Fuel entry not found"}
    return entry

@app.post("/api/fuel")
async def create_fuel_entry(request: dict):
    """
    Add a new fuel entry

    Request body: {
        "liters": float (required),
        "price_per_liter": float (required),
        "location": str (optional),
        "odometer": float (optional, NM or hours),
        "notes": str (optional),
        "position": {"lat": float, "lon": float} (optional)
    }
    """
    liters = request.get("liters")
    price_per_liter = request.get("price_per_liter")

    if liters is None or price_per_liter is None:
        return {"error": "liters and price_per_liter are required"}

    location = request.get("location", "")
    odometer = request.get("odometer", 0)
    notes = request.get("notes", "")
    position = request.get("position")

    # Use current GPS position if not provided
    if not position:
        position = {
            "lat": sensor_data["gps"]["lat"],
            "lon": sensor_data["gps"]["lon"]
        }

    entry = fuel_tracking.add_fuel_entry(
        liters=liters,
        price_per_liter=price_per_liter,
        location=location,
        odometer=odometer,
        notes=notes,
        position=position
    )
    return entry

@app.put("/api/fuel/{fuel_id}")
async def update_fuel_entry_by_id(fuel_id: int, request: dict):
    """Update fuel entry information"""
    entry = fuel_tracking.update_fuel_entry(fuel_id, request)
    if not entry:
        return {"error": "Fuel entry not found"}
    return entry

@app.delete("/api/fuel/{fuel_id}")
async def delete_fuel_entry_by_id(fuel_id: int):
    """Delete a fuel entry"""
    success = fuel_tracking.delete_fuel_entry(fuel_id)
    return {"status": "deleted" if success else "not_found"}

@app.get("/api/fuel/stats")
async def get_fuel_statistics(days: int = 30):
    """Get fuel statistics for the last N days"""
    return fuel_tracking.get_fuel_stats(days)

@app.get("/api/fuel/consumption")
async def get_fuel_consumption_stats():
    """Get fuel consumption statistics (L/NM, L/h, range, etc.)"""
    return fuel_tracking.get_consumption_stats()

@app.get("/api/fuel/consumption/trend")
async def get_fuel_consumption_trend(months: int = 6):
    """Get monthly fuel consumption trend"""
    return fuel_tracking.get_consumption_trend(months)

# ==================== STATISTICS ====================
@app.get("/api/statistics/trips")
async def get_trip_statistics(days: int = 365):
    """Get trip statistics for the last N days"""
    return statistics.get_trip_statistics(days)

@app.get("/api/statistics/monthly")
async def get_monthly_breakdown():
    """Get monthly breakdown of trips and distance"""
    return statistics.get_monthly_statistics()

@app.get("/api/statistics/dashboard")
async def get_dashboard_statistics():
    """Get complete dashboard summary with all statistics"""
    return statistics.get_dashboard_summary()

@app.get("/api/statistics/yearly")
async def get_yearly_comparison_stats():
    """Compare current year with previous year"""
    return statistics.get_yearly_comparison()

# ==================== DATA IMPORT/EXPORT ====================
@app.get("/api/data/export")
async def export_all_data():
    """
    Export all BoatOS data as JSON
    Includes: logbook trips, crew, fuel entries, and settings
    """
    try:
        export_data = {
            "export_date": datetime.now().isoformat(),
            "version": "1.0.0",
            "logbook": {
                "trips": logbook_storage.load_logbook_entries()
            },
            "crew": crew_management.load_crew(),
            "fuel": fuel_tracking.load_fuel_entries(),
            "settings": {}
        }

        # Load settings if available
        try:
            with open("data/settings.json", 'r') as f:
                export_data["settings"] = json.load(f)
        except FileNotFoundError:
            pass

        # Create JSON response
        json_data = json.dumps(export_data, indent=2, ensure_ascii=False)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"boatos_export_{timestamp}.json"

        return Response(
            content=json_data,
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        print(f"❌ Export error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}

@app.post("/api/data/import")
async def import_all_data(request: Request):
    """
    Import BoatOS data from JSON
    Accepts: logbook trips, crew, fuel entries, and settings
    """
    try:
        import_data = await request.json()

        results = {
            "status": "success",
            "imported": {
                "logbook_trips": 0,
                "crew_members": 0,
                "fuel_entries": 0,
                "settings": False
            },
            "errors": []
        }

        # Import logbook trips
        if "logbook" in import_data and "trips" in import_data["logbook"]:
            trips = import_data["logbook"]["trips"]
            for trip in trips:
                try:
                    logbook_storage.save_logbook_entry(trip)
                    results["imported"]["logbook_trips"] += 1
                except Exception as e:
                    results["errors"].append(f"Logbook trip {trip.get('id')}: {str(e)}")

            # Reload completed trips
            global completed_trips
            completed_trips = logbook_storage.load_logbook_entries()

        # Import crew
        if "crew" in import_data:
            crew_list = import_data["crew"]
            for member in crew_list:
                try:
                    # Add or update crew member
                    crew_management.add_crew_member(
                        name=member.get("name"),
                        role=member.get("role", "Crew"),
                        email=member.get("email", ""),
                        phone=member.get("phone", "")
                    )
                    results["imported"]["crew_members"] += 1
                except Exception as e:
                    results["errors"].append(f"Crew {member.get('name')}: {str(e)}")

        # Import fuel entries
        if "fuel" in import_data:
            fuel_list = import_data["fuel"]
            for entry in fuel_list:
                try:
                    fuel_tracking.add_fuel_entry(
                        liters=entry.get("liters"),
                        price_per_liter=entry.get("price_per_liter"),
                        location=entry.get("location", ""),
                        odometer=entry.get("odometer", 0),
                        notes=entry.get("notes", ""),
                        position=entry.get("position")
                    )
                    results["imported"]["fuel_entries"] += 1
                except Exception as e:
                    results["errors"].append(f"Fuel entry {entry.get('id')}: {str(e)}")

        # Import settings
        if "settings" in import_data and import_data["settings"]:
            try:
                with open("data/settings.json", 'w') as f:
                    json.dump(import_data["settings"], f, indent=2)
                results["imported"]["settings"] = True

                # Apply settings (AIS, routing, etc.)
                settings = import_data["settings"]
                if 'ais' in settings:
                    provider = settings['ais'].get('provider', 'aishub')
                    enabled = settings["ais"].get("enabled", False)
                    api_key = settings['ais'].get('apiKey', '')
                    ais_service.configure(provider=provider, api_key=api_key, enabled=enabled)

                if 'waterCurrent' in settings:
                    water_current_service.configure(settings['waterCurrent'])

            except Exception as e:
                results["errors"].append(f"Settings: {str(e)}")

        print(f"✅ Import completed: {results['imported']}")

        if results["errors"]:
            results["status"] = "partial"

        return results

    except Exception as e:
        print(f"❌ Import error: {e}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}

# ==================== ONSCREEN KEYBOARD ====================
@app.post("/api/keyboard/toggle")
async def toggle_onscreen_keyboard(action: str = "show"):
    """Toggle onscreen keyboard (onboard) for touch input"""
    try:
        if action == "show":
            # Check if onboard is already running
            check = subprocess.run(
                ["pgrep", "-x", "onboard"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )

            # Only start if not already running
            if check.returncode != 0:
                # Show onboard keyboard with full X11 environment
                env = os.environ.copy()
                env['DISPLAY'] = ':0'
                env['XAUTHORITY'] = '/home/arielle/.Xauthority'
                env['HOME'] = '/home/arielle'

                subprocess.Popen(
                    ["onboard", "--size", "1024x400"],
                    env=env,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True
                )
            return {"status": "success", "action": "shown"}
        elif action == "hide":
            # Hide onboard keyboard
            subprocess.run(
                ["pkill", "-9", "onboard"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            return {"status": "success", "action": "hidden"}
        else:
            return {"status": "error", "message": "Invalid action. Use 'show' or 'hide'"}
    except Exception as e:
        print(f"⚠️ Keyboard toggle error: {e}")
        return {"status": "error", "error": str(e)}

# ==================== STARTUP ====================
@app.on_event("startup")
async def startup_event():
    # asyncio.create_task(signalk_listener())  # DISABLED: Duplicate GPS reader, gps_service handles this
    asyncio.create_task(track_recording_loop())
    asyncio.create_task(fetch_weather())
    asyncio.create_task(fetch_weather_alerts_periodic())  # Start periodic weather alerts
    asyncio.create_task(gps_service.read_gps_from_signalk())  # Start GPS service from SignalK
    load_known_topics()  # Load persistent topic history
    mqtt_client_init()
    # mqtt_publisher_init()  # DISABLED: Home Assistant removed, no longer needed
    # asyncio.create_task(publish_sensor_data())  # DISABLED: Home Assistant removed, no longer needed
    load_chart_layers()
    init_waterway_router()

    # Load settings and configure services
    try:
        with open("data/settings.json", 'r') as f:
            settings = json.load(f)

            # Configure AIS
            if 'ais' in settings:
                enabled = settings["ais"].get("enabled", False)
                provider = settings['ais'].get('provider', 'aisstream')
                api_key = settings['ais'].get('apiKey', '')
                ais_service.configure(provider=provider, api_key=api_key, enabled=enabled)

                # Start AISStream WebSocket if configured
                if ais_service.provider == 'aisstream' and ais_service.enabled:
                    asyncio.create_task(ais_service.start_aisstream_websocket())

            # Configure Water Current service
            if 'waterCurrent' in settings:
                water_current_service.configure(settings['waterCurrent'])
    except FileNotFoundError:
        print("⚠️ No settings file found, services not configured")

    print("🚢 BoatOS Backend started!")

@app.on_event("shutdown")
async def shutdown_event():
    """Save known topics on shutdown"""
    save_known_topics()
    print("💾 Known topics saved on shutdown")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
