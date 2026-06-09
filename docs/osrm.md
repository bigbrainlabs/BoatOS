# Setting up OSRM (Offline routing on waterways)

BoatOS uses [OSRM](https://project-osrm.org/) for waterway routing — fast (<100 ms), fully offline, with a dedicated waterway profile. Without OSRM, routing falls back to a straight line.

---

## Overview

```
OSM raw data (.osm.pbf)
    └─ osrm-extract (waterway.lua)
    └─ osrm-partition
    └─ osrm-customize
         └─ osrm-routed (port 5000) → BoatOS routing
```

---

## Step 1 — Build OSRM (from source)

Pre-built ARM64 binaries are not available — OSRM must be compiled on the Pi itself. This takes approximately 30–60 minutes.

```bash
sudo apt install -y build-essential git cmake pkg-config \
  libbz2-dev libxml2-dev libzip-dev libboost-all-dev \
  lua5.2 liblua5.2-dev libtbb-dev

cd ~
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install
```

Binaries are installed to `/usr/local/bin/`: `osrm-extract`, `osrm-partition`, `osrm-customize`, `osrm-routed`.

---

## Step 2 — Set up the waterway profile

The default OSRM profile routes on roads. BoatOS needs a waterway profile that only uses `waterway=*` edges.

```bash
# Copy the profile into the OSRM directory
cp ~/BoatOS/backend/app/waterway.lua ~/osrm-backend/profiles/waterway.lua
```

> The `waterway.lua` profile lives in the BoatOS repo at `backend/app/`. It contains weights for locks, canals, and rivers.

---

## Step 3 — Download OSM data

```bash
mkdir -p ~/osrm_data
cd ~/osrm_data

# All of Germany (~4 GB)
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf

# Or a single state for testing (e.g. Saxony-Anhalt ~110 MB)
# wget https://download.geofabrik.de/europe/germany/sachsen-anhalt-latest.osm.pbf
```

---

## Step 4 — Build the routing graph

```bash
cd ~/osrm_data

# 1. Extract (~10–20 min for Germany)
osrm-extract -p ~/osrm-backend/profiles/waterway.lua germany-latest.osm.pbf

# 2. Partition
osrm-partition germany-latest.osrm

# 3. Customize
osrm-customize germany-latest.osrm

# Copy the finished files to the BoatOS data directory
mkdir -p ~/BoatOS/data/osrm
cp germany-latest.osrm* ~/BoatOS/data/osrm/
```

### Individual states (recommended for a test Pi)

The script `scripts/extract_regions.sh` automates download + extraction for all German states:

```bash
# Interactive — menu shows all states
bash ~/BoatOS/scripts/extract_regions.sh

# Directly specify a state
bash ~/BoatOS/scripts/extract_regions.sh sachsen-anhalt

# All states at once
bash ~/BoatOS/scripts/extract_regions.sh all
```

---

## Step 5 — Set up the systemd service

```bash
sudo nano /etc/systemd/system/osrm.service
```

Contents:

```ini
[Unit]
Description=OSRM Waterway Routing
After=network.target

[Service]
Type=simple
User=boatos
ExecStart=/usr/local/bin/osrm-routed \
  --algorithm=MLD \
  --port 5000 \
  /home/boatos/BoatOS/data/osrm/germany-latest.osrm
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=osrm

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now osrm.service

# Check status
sudo systemctl status osrm.service
```

> **Important:** OSRM binds to IPv4 only (`127.0.0.1:5000`). The backend explicitly uses `127.0.0.1` instead of `localhost` to avoid IPv6 resolution.

---

## Test routing

```bash
# Test route: Magdeburg → Berlin (Elbe/Havel)
curl "http://127.0.0.1:5000/route/v1/driving/11.6167,52.1205;13.4050,52.5200?overview=full&geometries=geojson"
# Expected: JSON with "code":"Ok" and a route along the waterways
```

---

## Switch region

The active region can be changed via the BoatOS API at runtime — no SSH required:

**Deck:** Settings → Navigation → OSRM region  
**API:** `POST /api/routing/switch-region` with `{"region": "sachsen-anhalt"}`

The backend stops `osrm-routed`, restarts it with the new region, and waits for a health check.

---

## Multiple regions simultaneously

OSRM can only load one region per process. For multi-stage trips (e.g. Hamburg → Berlin → Dresden), merge all affected states first:

```bash
# osmium must be installed
sudo apt install -y osmium-tool

osmium merge \
  ~/osrm_data/niedersachsen-latest.osm.pbf \
  ~/osrm_data/hamburg-latest.osm.pbf \
  ~/osrm_data/schleswig-holstein-latest.osm.pbf \
  -o ~/osrm_data/nordwest.osm.pbf

# Then extract nordwest.osm.pbf as in step 4
```

---

## Common problems

| Problem | Solution |
|---|---|
| `osrm-routed` won't start | `systemctl status osrm` — check the path to the `.osrm` file |
| Routing returns a straight line | OSRM not reachable or destination is outside the loaded region — test with `curl http://127.0.0.1:5000/...` |
| `distance=0` in response | Coordinates are outside the loaded map data |
| Build fails (OOM) | Increase swap (see tileserver.md) or cross-compile on a PC |
| `NoSegment` error | Waypoint is not on a waterway — OSRM snaps automatically to the nearest node |
