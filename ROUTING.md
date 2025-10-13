# Waterway Routing Documentation

## Overview

BoatOS provides advanced waterway routing optimized for motorboat navigation on European inland waterways. The routing engine uses OSRM with custom motorboat profiles that consider:

- Water depth restrictions
- Motorboat access permissions
- Bridge clearances
- Lock locations
- CEMT waterway classifications

## Routing Profiles

### Motorboat Profile (`motorboat.lua`)

**Requirements:**
- Minimum water depth: **1.5 meters**
- Minimum bridge clearance: **2.5 meters**
- Motorboat access: Required

**Supported Waterways:**
- ✅ Rivers (20 km/h)
- ✅ Canals (15 km/h)
- ✅ Fairways (25 km/h)
- ✅ Tidal channels (20 km/h)
- ❌ Streams (too shallow)
- ❌ Ditches (not navigable)

**Access Filtering:**
- **Allowed:** `motor_boat`, `motorboat`, `boat`, `vessel`, `commercial`
- **Blocked:** `no_motor`, `paddle`, `canoe`, `kayak`, `human`

**CEMT Classification:**
- Class I: Blocked (too small)
- Class II+: Allowed (suitable for motorboats)

## OSM Tags Considered

### Waterway Tags

| Tag | Description | Handled |
|-----|-------------|---------|
| `waterway=river` | River | ✅ 20 km/h |
| `waterway=canal` | Canal | ✅ 15 km/h |
| `waterway=fairway` | Fairway | ✅ 25 km/h |
| `waterway=lock_gate` | Lock | ✅ Marked |
| `depth=*` | Water depth (meters) | ✅ Min 1.5m |
| `maxdepth=*` | Maximum depth | ✅ Min 1.5m |
| `CEMT=*` | European waterway class | ✅ Class II+ |

### Access Tags

| Tag | Description | Effect |
|-----|-------------|--------|
| `motor=yes` | Motor allowed | ✅ Allowed |
| `motor=no` | No motors | ❌ Blocked |
| `motor_boat=yes` | Motorboat allowed | ✅ Allowed |
| `boat=no` | No boats | ❌ Blocked |
| `boat=private` | Private waterway | ❌ Blocked |

### Bridge Tags

| Tag | Description | Effect |
|-----|-------------|--------|
| `bridge=yes` | Bridge present | ✅ Checked |
| `maxheight=*` | Maximum height (meters) | ✅ Min 2.5m |
| `maxheight:physical=*` | Physical clearance | ✅ Min 2.5m |

### Speed & Restrictions

| Tag | Description | Effect |
|-----|-------------|--------|
| `maxspeed=*` | Speed limit (km/h) | ✅ Applied |
| `oneway=yes` | One-way waterway | ✅ Applied |
| `usage=commercial` | Commercial waterway | ✅ +10% priority |
| `usage=recreational` | Recreational use | ✅ Normal |

## Lock & Bridge Detection

The routing engine automatically detects:

**Locks:**
- `lock=yes`
- `waterway=lock_gate`
- Marked as barriers in routing
- Adds delay to route calculation

**Bridges:**
- `bridge=yes`
- Clearance checked against `maxheight` tags
- Routes blocked if clearance < 2.5m

## Routing API

### POST `/api/route`

**Request:**
```json
{
  "waypoints": [
    [lon1, lat1],
    [lon2, lat2],
    ...
  ],
  "profile": "motorboat",  // Optional: "motorboat" or "waterway"
  "boat_draft": 1.0,       // Optional: boat draft in meters
  "boat_height": 2.0       // Optional: boat height in meters
}
```

**Response:**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lon, lat], ...]
  },
  "properties": {
    "distance_m": 12500,
    "distance_nm": 6.75,
    "duration_s": 3000,
    "duration_h": 0.83,
    "waterway_routed": true,
    "routing_type": "osrm",
    "locks": [
      {
        "name": "Schleuse Magdeburg",
        "lat": 52.1234,
        "lon": 11.6234,
        "distance_from_start": 5000
      }
    ],
    "bridges": [
      {
        "name": "Elbebrücke",
        "lat": 52.2345,
        "lon": 11.7345,
        "clearance": 3.5,
        "distance_from_start": 8000
      }
    ]
  }
}
```

## OSRM Setup

### Extract Region with Motorboat Profile

```bash
cd ~/osrm_regions

# Extract with motorboat profile
osrm-extract -p ~/BoatOS/profiles/motorboat.lua sachsen-anhalt-latest.osm.pbf

# Partition
osrm-partition sachsen-anhalt-latest.osrm

# Customize
osrm-customize sachsen-anhalt-latest.osrm

# Start OSRM server
osrm-routed --algorithm=MLD sachsen-anhalt-latest.osrm --port 5000
```

### Multiple Profiles

You can run multiple OSRM instances for different boat types:

```bash
# Motorboat routing (port 5000)
osrm-routed --algorithm=MLD motorboat-region.osrm --port 5000 &

# General waterway routing (port 5001)
osrm-routed --algorithm=MLD waterway-region.osrm --port 5001 &
```

## Offline Routing

The OSRM-based routing works completely offline once the region data is extracted. To enable offline routing:

1. Download OSM PBF file for your region
2. Extract with motorboat profile
3. Keep OSRM server running locally
4. Routing requests stay local (no internet required)

**Advantages:**
- ⚡ Fast routing (< 100ms)
- 🔒 Privacy (no external requests)
- 📶 Works without internet
- 🎯 Optimized for waterways

## Live Routing

BoatOS automatically re-routes when:
- Boat deviates from planned route (> 100m)
- New waypoint added during navigation
- Routing settings changed (depth, clearance)

**Auto-rerouting triggers:**
- Distance from route > 100 meters
- Heading deviation > 45 degrees
- Manual waypoint addition

## Configuration

### Backend (`backend/app/main.py`)

```python
# OSRM Configuration
OSRM_URL = "http://localhost:5000"
OSRM_PROFILE = "motorboat"

# Boat specifications (can be user-configurable)
DEFAULT_BOAT_DRAFT = 1.0  # meters
DEFAULT_BOAT_HEIGHT = 2.0  # meters
DEFAULT_BOAT_BEAM = 2.5    # meters
```

### Frontend (Settings UI)

Users can configure:
- Boat draft (water depth)
- Boat height (bridge clearance)
- Boat beam (width)
- Routing preferences (fastest/shortest)
- Lock avoidance
- Auto-rerouting sensitivity

## Troubleshooting

### No Route Found

**Possible causes:**
1. Water depth too shallow for boat draft
2. Bridge clearance too low
3. No motorboat access on waterway
4. Waterway not in OSM database

**Solution:**
- Check boat specifications
- Try alternative start/end points
- Falls back to direct (air-line) routing

### Slow Routing

**Possible causes:**
1. OSRM server not running
2. Large region data file
3. Network latency

**Solution:**
- Check OSRM server status: `systemctl status osrm`
- Extract smaller region
- Use local OSRM instance

### Missing Locks/Bridges

**Possible causes:**
1. OSM data incomplete
2. Tags not properly formatted
3. Profile not considering tags

**Solution:**
- Contribute to OSM
- Update region extract
- Re-extract with updated profile

## Contributing

To improve waterway data:

1. **OpenStreetMap:** Add missing waterway tags
   - `depth=*` - Water depth in meters
   - `maxheight=*` - Bridge clearance
   - `lock=yes` - Lock locations
   - `motor_boat=yes/no` - Motorboat access

2. **Profile:** Enhance `motorboat.lua`
   - Add new waterway types
   - Adjust speed limits
   - Improve access filtering

3. **Backend:** Add features to `osrm_routing.py`
   - Extract lock/bridge data
   - Add route caching
   - Improve fallback logic

## References

- [OSRM Documentation](http://project-osrm.org/)
- [OpenStreetMap Waterway Tagging](https://wiki.openstreetmap.org/wiki/Waterways)
- [CEMT Classification](https://en.wikipedia.org/wiki/European_Conference_of_Ministers_of_Transport)
