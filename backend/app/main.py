"""BoatOS Backend - FastAPI Server with Logbook & Charts"""
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, BackgroundTasks, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, FileResponse
from fastapi.staticfiles import StaticFiles
import asyncio, json, websockets, os, shutil, zipfile, subprocess
from datetime import datetime
from typing import List, Dict, Any
import paho.mqtt.client as mqtt
from math import radians, sin, cos, sqrt, atan2
import aiohttp
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import gps_service
import logbook_storage
import pdf_export
from ais_service import ais_service
from waterway_infrastructure import waterway_infrastructure
from pegelonline import pegelonline
from water_current import water_current_service

app = FastAPI(title="BoatOS API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Charts directory
CHARTS_DIR = Path("/home/arielle/BoatOS/data/charts")
CHARTS_DIR.mkdir(parents=True, exist_ok=True)

# Mount charts directory for static serving
app.mount("/charts", StaticFiles(directory=str(CHARTS_DIR)), name="charts")

active_connections: List[WebSocket] = []
sensor_data: Dict[str, Any] = {"gps": {"lat": 0, "lon": 0, "satellites": 0, "altitude": 0, "course": 0}, "speed": 0, "heading": 0, "depth": 0, "wind": {"speed": 0, "direction": 0}, "engine": {"rpm": 0, "temp": 0, "oil_pressure": 0}, "battery": {"voltage": 0, "current": 0}}
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
OPENWEATHER_API_KEY = "bfe93865949cf3e87b49a29c13a526c4"
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
            await asyncio.sleep(0.5)
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
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)

        # Apply AIS settings
        if 'ais' in settings:
            provider = settings['ais'].get('provider', 'aishub')
            api_key = settings['ais'].get('apiKey', '')
            ais_service.configure(provider=provider, api_key=api_key)

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
    if lang != weather_data.get("lang", "de"):
        asyncio.create_task(fetch_weather_once(lang))
    return weather_data

async def fetch_weather_once(lang: str = "de"):
    """Fetch weather data once with specified language"""
    global weather_data
    try:
        lat = sensor_data["gps"]["lat"]
        lon = sensor_data["gps"]["lon"]
        # Use fallback location if GPS not available (Albertkanal area)
        if lat == 0 or lon == 0 or lat is None or lon is None:
            lat, lon = 50.833, 5.663

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
async def start_track_recording():
    global track_recording, current_track
    track_recording = True
    current_track = []
    current_session_entries.clear()  # Clear session on new start

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
        "notes": "Fahrt gestartet"
    }
    current_session_entries.append(entry)

    return {"status": "started", "timestamp": datetime.now().isoformat(), "entry": entry}

@app.post("/api/track/stop")
async def stop_track_recording():
    global track_recording
    track_recording = False
    if len(current_track) > 0:
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
        
        # Save complete trip with all session entries
        trip = {
            "id": len(completed_trips) + 1,
            "trip_start": current_session_entries[0]["timestamp"] if current_session_entries else None,
            "trip_end": entry["timestamp"],
            "entries": current_session_entries.copy(),
            "track_data": current_track.copy(),
            "distance": entry.get("distance"),
            "duration": entry.get("duration"),
            "points": entry.get("points")
        }
        logbook_storage.save_logbook_entry(trip)
        completed_trips.append(trip)
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
    if len(current_track) < 2:
        return "0:00"
    start = datetime.fromisoformat(current_track[0]["timestamp"])
    end = datetime.fromisoformat(current_track[-1]["timestamp"])
    duration = end - start
    hours = duration.seconds // 3600
    minutes = (duration.seconds % 3600) // 60
    return f"{hours}:{minutes:02d}"

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
def on_mqtt_message(client, userdata, msg):
    topic, payload = msg.topic, msg.payload.decode()
    try:
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
            sensor_data["engine"].update(json.loads(payload)

)
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
        client.subscribe("boat/#")
        client.loop_start()
        print("✅ MQTT connected (boat/#)")
    except Exception as e:
        print(f"⚠️ MQTT connection failed: {e}")

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
    osrm_url = "http://localhost:5000"
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

    # Try to initialize PyRouteLib as fallback
    try:
        from pyroutelib_routing import PyRouteLibRouter
        pyroutelib_router = PyRouteLibRouter(osm_file=osm_file if osm_file and Path(osm_file).exists() else None)
        print(f"✅ PyRouteLib router initialized (fallback)")
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

                    # Get boat speed from boat_data or use default
                    boat_speed_kmh = 15  # Default cruise speed
                    if boat_data:
                        # Try to get cruise speed from settings
                        try:
                            with open("data/settings.json", 'r') as f:
                                settings = json.load(f)
                                boat_speed_kmh = settings.get('boat', {}).get('cruise_speed', 15)
                        except:
                            pass

                    adjusted_duration_h, current_info = water_current_service.adjust_route_duration(
                        route_geometry, distance_km, boat_speed_kmh
                    )

                    if current_info:
                        route["properties"]["duration_adjusted_h"] = adjusted_duration_h
                        route["properties"]["current_adjustment"] = current_info
                        print(f"🌊 Route duration adjusted for currents: {adjusted_duration_h:.2f}h")

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

# ==================== STARTUP ====================
@app.on_event("startup")
async def startup_event():
    asyncio.create_task(signalk_listener())
    asyncio.create_task(track_recording_loop())
    asyncio.create_task(fetch_weather())
    asyncio.create_task(gps_service.read_gps_from_signalk())  # Start GPS service from SignalK
    mqtt_client_init()
    load_chart_layers()
    init_waterway_router()

    # Load settings and configure services
    try:
        with open("data/settings.json", 'r') as f:
            settings = json.load(f)

            # Configure AIS
            if 'ais' in settings:
                provider = settings['ais'].get('provider', 'aisstream')
                api_key = settings['ais'].get('apiKey', '')
                ais_service.configure(provider=provider, api_key=api_key)

                # Start AISStream WebSocket if configured
                if ais_service.provider == 'aisstream' and ais_service.enabled:
                    asyncio.create_task(ais_service.start_aisstream_websocket())

            # Configure Water Current service
            if 'waterCurrent' in settings:
                water_current_service.configure(settings['waterCurrent'])
    except FileNotFoundError:
        print("⚠️ No settings file found, services not configured")

    print("🚢 BoatOS Backend started!")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
