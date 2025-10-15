# BoatOS Backend API Structure

## Overview
Main API file: `app/main.py` (2292 lines)

## Route Organization

### Core System
- `/` - API root & health check
- `/api/sensors` - Sensor data
- `/api/gps` - GPS status
- `/api/settings` - User settings (GET/POST)
- `/ws` - WebSocket for real-time data

### Locks Management (Schleusen) - Lines 203-483
**Base:** `/api/locks`

**Query Endpoints:**
- `GET /api/locks` - Get all locks
- `GET /api/locks/nearby?lat={lat}&lon={lon}&radius={radius}` - Locks near position
- `GET /api/locks/bounds?lat_min=...&lat_max=...&lon_min=...&lon_max=...` - Locks in bounds
- `GET /api/locks/waterway/{waterway}` - Locks on specific waterway
- `GET /api/locks/{lock_id}` - Lock details
- `GET /api/locks/{lock_id}/status` - Check if lock is open

**Management Endpoints:**
- `POST /api/locks` - Create new lock
- `PUT /api/locks/{lock_id}` - Update lock
- `DELETE /api/locks/{lock_id}` - Delete lock
- `POST /api/locks/import-osm` - Import from OpenStreetMap
- `POST /api/locks/enrich` - Enrich with VHF/contact data
- `GET /api/locks/quality` - Database quality stats
- `POST /api/locks/verify-positions` - Verify positions against OSM
- `POST /api/locks/{lock_id}/notify` - Prepare lock notification

### Charts & ENC Management - Lines 486-1177
**Base:** `/api/charts` & `/api/enc`

**Chart Endpoints:**
- `GET /api/charts` - List all chart layers
- `POST /api/charts/upload` - Upload chart (KAP/ENC/tiles)
- `DELETE /api/charts/{chart_id}` - Delete chart
- `PATCH /api/charts/{chart_id}?enabled={bool}` - Toggle chart visibility
- `POST /api/charts/{chart_id}/convert` - Convert ENC to tiles

**ENC Download Endpoints:**
- `GET /api/enc/catalog` - Get ELWIS ENC catalog
- `POST /api/enc/download` - Download ENC from ELWIS

### Weather - Lines 1178-1315
**Base:** `/api/weather`

- `GET /api/weather?lang={de|en}` - Current weather & forecast
- `GET /api/weather/alerts` - DWD weather alerts
- `GET /api/weather/alerts/cached` - Cached alerts

### Logbook & Track Recording - Lines 1317-1600
**Base:** `/api/logbook` & `/api/track`

**Logbook Endpoints:**
- `GET /api/logbook` - Current session entries
- `GET /api/logbook/trips` - Completed trips
- `GET /api/logbook/trip/{trip_id}` - Trip details
- `POST /api/logbook` - Add manual entry
- `DELETE /api/logbook/{entry_id}` - Delete entry

**Track Endpoints:**
- `GET /api/track/status` - Recording status
- `POST /api/track/start` - Start recording
- `POST /api/track/stop` - Stop recording & save trip
- `POST /api/track/pause` - Pause recording
- `POST /api/track/resume` - Resume recording
- `GET /api/track/current` - Current track points
- `GET /api/track/export/{entry_id}` - Export as GPX

**Export:**
- `GET /api/trip/pdf/{trip_id}` - Export trip as PDF

### Routes & OSRM - Lines 1601-1795
**Base:** `/api/route` & `/api/osrm`

- `GET /api/route` - All routes
- `POST /api/route` - Create route
- `DELETE /api/route/{route_id}` - Delete route
- `GET /api/route/{route_id}` - Route details
- `POST /api/route/{route_id}/navigate` - Start navigation
- `POST /api/osrm/route` - OSRM routing
- `GET /api/osrm/status` - OSRM server status

### AIS (Automatic Identification System) - Lines 1796-1815
**Base:** `/api/ais`

- `GET /api/ais/vessels` - Nearby vessels
- `GET /api/ais/status` - AIS receiver status

### Waterway Infrastructure - Lines 1816-1879
**Base:** `/api/waterway`

- `GET /api/waterway/bridges/nearby` - Nearby bridges
- `GET /api/waterway/markers` - Navigation markers
- `GET /api/waterway/infrastructure` - All infrastructure

### Water Levels (Pegel) - Lines 1880-1920
**Base:** `/api/pegel`

- `GET /api/pegel/nearby` - Nearby gauges
- `GET /api/pegel/{station_uuid}` - Gauge details
- `GET /api/pegel/waterway/{waterway}` - Gauges on waterway

### Water Current - Lines 1921-1936
**Base:** `/api/current`

- `GET /api/current?lat={lat}&lon={lon}` - Water current at position

### Crew Management - Lines 1937-2001
**Base:** `/api/crew`

- `GET /api/crew` - All crew members
- `POST /api/crew` - Add crew member
- `PUT /api/crew/{crew_id}` - Update crew member
- `DELETE /api/crew/{crew_id}` - Delete crew member
- `GET /api/crew/{crew_id}` - Crew details
- `GET /api/crew/{crew_id}/statistics` - Crew statistics

### Fuel Tracking - Lines 2002-2109
**Base:** `/api/fuel`

- `GET /api/fuel` - Fuel records
- `POST /api/fuel` - Add fuel record
- `DELETE /api/fuel/{record_id}` - Delete record
- `GET /api/fuel/consumption` - Consumption statistics
- `GET /api/fuel/stats` - Overall statistics

### Statistics & Analytics - Lines 2110-2168
**Base:** `/api/statistics`

- `GET /api/statistics/summary` - Overall summary
- `GET /api/statistics/trips` - Trip statistics
- `GET /api/statistics/monthly` - Monthly breakdown
- `GET /api/statistics/yearly` - Yearly overview
- `GET /api/statistics/dashboard` - Dashboard data

### Data Management - Lines 2169-2250
**Base:** `/api/data`

- `POST /api/data/export` - Export all data as JSON
- `POST /api/data/import` - Import data from JSON
- `GET /api/data/backup` - Create backup

## Startup Event - Line 2259
Background tasks initialization:
- GPS service
- Weather updates
- Weather alerts
- OSRM server check

## Helper Functions
- GPX generation
- Track calculations (distance, duration)
- PDF export

## Global State
All endpoints share global state variables:
- `sensor_data` - Real-time sensor readings
- `weather_data` - Weather information
- `current_track` - Active track recording
- `current_session_entries` - Current logbook session
- `completed_trips` - Saved trips
- `chart_layers` - Chart overlays
- `routes` & `waypoints` - Navigation
- `active_connections` - WebSocket clients

## Refactoring Notes
The file is large (2292 lines) but functionally organized. Future improvements could include:
1. Modular routers with dependency injection
2. Separate service layer for business logic
3. Database models with ORM
4. OpenAPI documentation enhancement

For now, the code is maintainable with clear section markers and logical grouping.
