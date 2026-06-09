# Setting up the Tileserver (Offline Maps)

BoatOS uses [Martin](https://martin.maplibre.org/) as a tile server for vector tiles. The base map (rivers, roads, coastlines, settlements) is served entirely from a local `.mbtiles` file — no internet required.

> **Note:** Without the tileserver the base map is unavailable. Satellite imagery (ESRI) and OpenSeaMap overlays still work as long as an internet connection is present.

---

## Overview

```
OSM raw data (.osm.pbf)
    └─ tilemaker → germany.mbtiles
                       └─ martin (port 8081) → BoatOS map
                                               ↑
                          Backend tile proxy  ──┘
                          (/api/map/tiles)
                          reads multiple .mbtiles
```

---

## Step 1 — Install Martin

```bash
# Download the latest release from GitHub (ARM64 for Pi)
MARTIN_VERSION="v0.14.4"
wget "https://github.com/maplibre/martin/releases/download/${MARTIN_VERSION}/martin-aarch64-unknown-linux-musl.tar.gz"
tar xzf martin-aarch64-unknown-linux-musl.tar.gz
sudo mv martin /usr/local/bin/martin
sudo chmod +x /usr/local/bin/martin

# Test
martin --version
```

---

## Step 2 — Download OSM raw data

```bash
mkdir -p ~/osm_data
cd ~/osm_data

# All of Germany (~4 GB, takes 15–30 min depending on connection)
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf

# Alternative: a single federal state (much smaller, faster)
# wget https://download.geofabrik.de/europe/germany/saxony-anhalt-latest.osm.pbf
```

---

## Step 3 — Install tilemaker

[tilemaker](https://github.com/systemed/tilemaker) converts OSM data into MBTiles.

```bash
sudo apt install -y build-essential libboost-dev libboost-filesystem-dev \
  libboost-iostreams-dev libboost-program-options-dev libboost-system-dev \
  liblua5.1-dev libsqlite3-dev libshp-dev libprotobuf-dev protobuf-compiler \
  rapidjson-dev

cd ~
git clone https://github.com/systemed/tilemaker.git
cd tilemaker
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
```

---

## Step 4 — Create MBTiles

```bash
cd ~/tilemaker

# Download coastline polygons (required for land/water rendering)
wget https://osmdata.openstreetmap.de/download/water-polygons-split-4326.zip
unzip water-polygons-split-4326.zip

# Start conversion (~30–90 min depending on region and Pi model)
tilemaker \
  --input ~/osm_data/germany-latest.osm.pbf \
  --output ~/BoatOS/data/germany.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua

# Result: ~/BoatOS/data/germany.mbtiles (~1–3 GB)
```

> **Pi 4/5:** The process requires ~1 GB RAM. On a Pi 3 or with limited RAM, convert a single federal state instead.

---

## Step 5 — Set up the systemd service

```bash
sudo cp ~/BoatOS/deploy/tileserver.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tileserver.service

# Check status
sudo systemctl status tileserver.service
```

The service starts Martin on port 8081 with `~/BoatOS/data/germany.mbtiles`.

---

## Test the map

```bash
# Test the tile proxy (should return {"ok":true,...})
curl http://localhost:8000/api/map/tiles

# Test a specific tile via backend (z=10, x=548, y=337 = central Germany)
curl -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/api/map/tiles/10/548/337.pbf"
# Expected: 200
```

Then open `https://boatos.local` in a browser — the map should appear fully rendered.

---

## Single federal state / smaller region

For a test Pi or regatta trips a single state is often sufficient:

```bash
# Example: Saxony-Anhalt
wget https://download.geofabrik.de/europe/germany/saxony-anhalt-latest.osm.pbf

tilemaker \
  --input ~/osm_data/saxony-anhalt-latest.osm.pbf \
  --output ~/BoatOS/data/saxony-anhalt.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua
```

Place the file in `~/BoatOS/data/` — it will appear automatically in the map settings.

---

## Multiple regions / cross-border navigation

BoatOS can use several `.mbtiles` files simultaneously. The backend tile proxy queries all active regions in order for each tile request and returns the first match — geographically non-overlapping regions work seamlessly.

### Activating regions (UI)

**Settings → Map → Offline Maps**

All `.mbtiles` files in `~/BoatOS/data/` are detected automatically and shown as toggles. Multiple regions can be active at the same time.

### Downloading neighbouring countries

All regions are available from [Geofabrik](https://download.geofabrik.de/):

| Region | URL |
|---|---|
| Netherlands | `https://download.geofabrik.de/europe/netherlands-latest.osm.pbf` |
| Belgium | `https://download.geofabrik.de/europe/belgium-latest.osm.pbf` |
| France | `https://download.geofabrik.de/europe/france-latest.osm.pbf` |
| Poland | `https://download.geofabrik.de/europe/poland-latest.osm.pbf` |
| Czech Republic | `https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf` |
| Austria | `https://download.geofabrik.de/europe/austria-latest.osm.pbf` |
| Switzerland | `https://download.geofabrik.de/europe/switzerland-latest.osm.pbf` |
| Denmark | `https://download.geofabrik.de/europe/denmark-latest.osm.pbf` |

### Example: Rhine route (Germany + Netherlands)

```bash
# Download Netherlands (~900 MB)
wget -P ~/osm_data https://download.geofabrik.de/europe/netherlands-latest.osm.pbf

# Create MBTiles (~30–60 min)
cd ~/tilemaker
tilemaker \
  --input ~/osm_data/netherlands-latest.osm.pbf \
  --output ~/BoatOS/data/netherlands.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua
```

Then enable both regions under **Settings → Map → Offline Maps** — the map will show Germany and the Netherlands seamlessly.

### Region order

The order in which active regions are queried is alphabetical by default. For best performance, ensure the most frequently used region is listed first.

### Disk space

| Region | OSM PBF | MBTiles (approx.) |
|---|---|---|
| Germany | 4 GB | 3 GB |
| Netherlands | 900 MB | 700 MB |
| Belgium | 400 MB | 300 MB |
| Austria | 700 MB | 550 MB |
| France | 4 GB | 3 GB |

> The OSM PBF files are no longer needed after conversion and can be deleted.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `martin: command not found` | Binary not in `/usr/local/bin` — check the path |
| Map appears grey | Tileserver not running — check `systemctl status tileserver` |
| `tilemaker` crashes with OOM | Increase swap: `sudo dphys-swapfile swapoff && sudo nano /etc/dphys-swapfile` → `CONF_SWAPSIZE=2048` |
| Port 8081 in use | `sudo ss -tlnp | grep 8081` — stop the conflicting process |
| MBTiles file too large | Convert only the required region instead of all of Germany |
| Region not shown in settings | File is not in `~/BoatOS/data/` or does not have a `.mbtiles` extension |
| Tiles missing at country borders | Enable both countries — each tile is loaded from exactly one file |
