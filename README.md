# ⚓ BoatOS

> **Modern Marine Navigation System — Open Source, Touch-Optimized, Offline-First**

A complete marine navigation system for inland waterways and coastal navigation. Built for Raspberry Pi with touchscreen, runs completely offline, no subscriptions, no cloud lock-in.

<div align="center">

### 💾 Ready-to-Flash Image — flash it, start sailing

**[⬇️ Download v1.6.2 (~7.5 GB)](https://archive.org/download/boatos-distri-image/boatos_v1.6.2.img.gz)**

*balenaEtcher or Raspberry Pi Imager → select custom image → Flash → done*

</div>

---

## 🗺️ Offline Maps — Windows Tool for Non-Linux Users

> **No Linux, no terminal, no config files needed.**

The **BoatOS MBTiles Creator** is a standalone Windows app that downloads, converts, and uploads offline map tiles directly to your BoatOS Pi — one click per region.

<div align="center">

**[⬇️ Download BoatOS-MBTiles-Creator.exe](https://github.com/bigbrainlabs/BoatOS/releases/latest)**

</div>

**What it does:**
- Downloads OSM map data for any region (60+ countries and states pre-configured)
- Converts to `.mbtiles` using tilemaker (downloaded automatically on first run)
- Uploads the finished file directly to your Pi via WiFi — no USB stick, no SSH

**Supported regions include:** Germany (all 16 states), Netherlands, Belgium, France, Switzerland, Austria, Norway, Sweden, Denmark, Great Britain, Ireland, USA (state-level), Canada, and more.

→ Source & instructions: [`tools/mbtiles-creator/`](tools/mbtiles-creator/)  
→ Detailed docs: [docs/tileserver.md](docs/tileserver.md)

---

<div align="center">

> If you like this project: the books are the most direct way to support me — and an honest review on Amazon helps enormously to help others discover it. I appreciate every piece of feedback! 🙏

</div>

---

![License](https://img.shields.io/badge/license-GPL%20v3-blue.svg)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Flutter](https://img.shields.io/badge/flutter-3.x-blue.svg)
![Status](https://img.shields.io/badge/status-active-green.svg)

---

## 🌟 Highlights

> **No touchscreen required.** BoatOS runs fully through **Deck**, the browser-based web frontend — accessible from any phone, tablet, or laptop on the same network. The touchscreen with Helm is optional and turns the setup into a full helm station.

- 🗺️ **Two UIs** — Deck (browser-based web frontend) + Helm (native Flutter app, flutter-pi)
- 🧭 **Inland waterway routing** — OSRM-optimized for rivers, canals & locks
- 📡 **Live AIS** — Real-time vessel traffic (Europe) via AISStream.io
- ⚠️ **Weather & alerts** — DWD API with severe weather warnings
- 📖 **Digital logbook** — GPS tracks, crew, water levels, export
- 🔌 **Sensor dashboard** — MQTT integration, DSL-configurable layout, animated gauges
- 🛰️ **Satellite maps** — ESRI World Imagery with offline caching
- 👆 **Touch-optimized** — Large targets, no 300ms delay, perfect for on-the-water use

---

## 📸 Screenshots

<!-- TODO: Add screenshots -->
```
Demos: Check Instagram @bigbrainlabs
```

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Raspberry Pi 4                            │
│                                                                  │
│   ┌──────────────────────┐   ┌──────────────────────────────┐   │
│   │   Deck Web Frontend  │   │  Helm Flutter App (flutter-pi) │  │
│   │   (Nginx + HTTPS)    │   │  Native Kiosk, lightdm       │   │
│   └──────────┬───────────┘   └──────────────┬───────────────┘   │
│              │  HTTP/WS                      │  HTTP/WS          │
│              └─────────────┬─────────────────┘                  │
│                            ▼                                     │
│                  ┌─────────────────┐                            │
│                  │  BoatOS Backend │  FastAPI, Port 8000         │
│                  │   (main.py)     │  WebSocket, REST API        │
│                  └────┬──────┬─────┘                            │
│                       │      │                                   │
│          ┌────────────┘      └──────────────┐                   │
│          ▼                                  ▼                    │
│   ┌─────────────┐                  ┌─────────────────┐          │
│   │  Mosquitto  │◄── ESP32/Sensors │   SignalK       │          │
│   │   MQTT      │    (boot/+)      │   Port 3000     │          │
│   │  Port 1883  │                  │   GPS + NMEA    │          │
│   └─────────────┘                  └────────┬────────┘          │
│                                             │                    │
│                                    ┌────────▼────────┐          │
│                                    │   GPS Receiver  │          │
│                                    │  /dev/ttyUSB0   │          │
│                                    └─────────────────┘          │
│                                                                  │
│   ┌────────────────────────────┐                                │
│   │  Martin Tile Server        │  Port 8081, local vector maps  │
│   │  OSRM Routing Server       │  Port 5000, inland waterways   │
│   └────────────────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features in Detail

### 🗺️ Map & Navigation
- **Vector nautical charts** — OpenMapTiles via Martin (local, offline), Deck Light style
- **Sea marks** — OpenSeaMap overlay
- **Satellite maps** — ESRI World Imagery with passive + active offline caching (SW/Cache API)
- **AIS** — Live vessel traffic via AISStream.io, filtered to Europe bounding box
- **Lock database** — OSM-based, 300m deduplication, VHF/hours/dimensions
- **Water level data** — PEGELONLINE API, live water levels on the map
- **Auto-follow** — EMA-filtered GPS, smooth marker animation (α=0.35, ~4s ease-out)
- **Routing** — OSRM waterway routing, drag-and-drop waypoints, save/load routes
- **Route simulation** — ×1–×1000 speed, speed slider, GPS blocked during simulation
- **Navigation** — Bearing & distance to next waypoint, automatic advance

### 📊 Dashboard
- **DSL layout** — Text-based configuration (GRID, GAUGE, SENSOR, ROW)
- **Gauge styles** — arc180, arc270, arc360, bar — all with animated needle (500ms ease-out)
- **SensorCards** — card, hero, compact — with SHOW/HIDE filter, status LED
- **MQTT data** — all sensor topics auto-discovered, string values correctly parsed
- **Visual Editor** (Deck) — Drag & drop, undo/redo, bi-directional DSL sync

### 📖 Logbook
- **GPS track recording** — Start/stop, pause, water levels per track point
- **Crew management** — Emoji avatars, roles (Skipper/Crew/Guest), contact details
- **Archive** — All trips with detail view: stats, track on map, weather, water levels, sensors
- **Water level tracking** — Nearby stations recorded every 15 min
- **Logbook entries** — Manual & automatic (trip start/end with weather snapshot)

### 🔌 Sensors & MQTT
- **Auto-discovery** — All MQTT topics automatically detected and stored
- **Persistent topics** — `known_topics.json` — sensor data survives restarts
- **MQTT auto-reconnect** — loop_forever() thread with 5s retry — survives broker restarts
- **GPS synthetic sensors** — Altitude, HDOP, satellites as dashboard sensors
- **SignalK bridge** — GPS & navigation data via SignalK, configurable in settings

### 🌦️ Weather & Environment
- **DWD integration** — German Weather Service, automatically follows boat position
- **Severe weather alerts** — Live alerts with severity level, displayed on map
- **Water level data** — PEGELONLINE, tracked during trips for shallow-water analysis

---

## 📱 Deck vs Helm

| | Deck — Web Frontend | Helm — Flutter App |
|---|---|---|
| **Base** | Vanilla JS, MapLibre GL | Flutter 3.x, flutter-pi |
| **Kiosk** | cog (WPE WebKit) | flutter-pi + lightdm |
| **Maps** | MapLibre GL JS v4.7.1 | flutter_map + vector_map_tiles |
| **Status** | ✅ Production, active | ✅ Production, in development |
| **Strengths** | Full feature set, visual editor | Native performance, animated gauges |

Both UIs share the same backend and REST/WebSocket API.

---

## 🚀 Tech Stack

### Backend
- **FastAPI** — High-performance Python API
- **paho-mqtt** — MQTT client with auto-reconnect
- **SignalK** — Marine data server (GPS)
- **uvicorn** — ASGI server

### Deck Frontend
- **Vanilla JavaScript** — ES Modules, no framework bloat
- **MapLibre GL JS** v4.7.1 — Vector maps (local)
- **WebSocket** — Real-time GPS & sensor data
- **Service Worker** — Offline caching (maps, satellite tiles)

### Helm Flutter App
- **Flutter** 3.x + **flutter-pi** — Native ARM64 AOT build
- **flutter_map** — Interactive maps
- **vector_map_tiles** — Vector tiles from local Martin
- **provider** — State management
- **web_socket_channel** — WebSocket connection to backend

### Infrastructure
- **Nginx** — Reverse proxy & SSL (Deck)
- **Martin** — Vector tile server (Port 8081)
- **OSRM** — Routing engine (Port 5000, IPv4-only)
- **Mosquitto** — MQTT broker (Port 1883)
- **Raspberry Pi 4** — Hardware platform

### Data Sources
- **OpenSeaMap** — Sea marks overlay
- **OpenStreetMap / OMT** — Vector maps & routing
- **ESRI World Imagery** — Satellite maps
- **DWD API** — German Weather Service
- **PEGELONLINE** — Water level data
- **AISStream.io** — Live AIS vessel data
- **SignalK** — Marine data standard

---

## 📋 System Requirements

### Hardware
- **Raspberry Pi 4** (min. 2 GB RAM, 4 GB recommended)
- **GPS receiver** — USB, e.g. BU-353N5 (`/dev/ttyUSB0`, 4800 baud)
- **Touchscreen** — e.g. QDtech MPI1001 10.1" (1280×800)
- **SD card** — Min. 32 GB
- **Optional** — ESP32/Arduino sensor board via MQTT

### Software
- **Raspberry Pi OS** Bookworm (64-bit)
- **Python** 3.9+
- **Node.js** (for SignalK)
- **Flutter SDK** + flutter-pi (only needed for Helm build)

---

## 💾 Ready-to-Flash Image (recommended)

The fastest setup — just flash and go:

1. **Download image** (v1.6.2): [boatos_v1.6.2.img.gz](https://archive.org/download/boatos-distri-image/boatos_v1.6.2.img.gz) (~7.5 GB)
2. Open **balenaEtcher** or **Raspberry Pi Imager** → select custom image
3. Flash → boot Pi → Helm starts automatically

> Minimum 32 GB SD card or USB SSD. Partition is automatically expanded to full size on first boot.

---

## ⚡ Quick Start (manual installation)

### 1. Clone & install

```bash
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS
chmod +x install.sh
./install.sh
```

### 2. Open Deck

```
https://<pi-ip>/
```

### 3. Build & deploy Helm

```bash
# On the development PC (Flutter SDK + flutterpi_tool required):
cd flutter_app
flutterpi_tool build --arch=arm64 --cpu=pi4 --release

# Deploy to Pi:
scp build/flutter-pi/aarch64-generic/app.so boatos@<pi-ip>:/home/boatos/BoatOS/flutter_app/app.so
ssh boatos@<pi-ip> "sudo systemctl restart lightdm"
```

Full instructions: [docs/installation.md](docs/installation.md)

---

## 📁 Directory Structure

```
BoatOS/
├── backend/                    # FastAPI backend
│   ├── app/
│   │   ├── main.py             # Main API, WebSocket, MQTT
│   │   ├── gps_service.py      # GPS via SignalK
│   │   ├── logbook_storage.py  # Logbook & tracks
│   │   ├── locks_storage.py    # Lock database
│   │   ├── crew_management.py  # Crew CRUD
│   │   ├── pegelonline.py      # Water level data
│   │   ├── ais_service.py      # AIS via AISStream
│   │   └── ...
│   └── requirements.txt
├── frontend/                   # Deck web frontend
│   ├── index.html
│   ├── js/
│   │   ├── main.js             # ES module entry
│   │   ├── map.js              # Map, markers, GPS smoothing
│   │   ├── navigation.js       # Routing & simulation
│   │   ├── logbook.js          # Logbook & crew
│   │   ├── sensors.js          # GPS fallbacks
│   │   ├── ais.js              # AIS vessels
│   │   └── ...
│   ├── css/
│   └── sw.js                   # Service worker (offline caching)
├── flutter_app/                # Helm native Flutter app
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/
│   │   │   ├── map_screen.dart       # Map, GPS, routing, simulation
│   │   │   ├── dashboard_screen.dart # DSL dashboard, gauges
│   │   │   ├── logbook_screen.dart   # Logbook, crew, archive
│   │   │   └── settings_screen.dart
│   │   ├── widgets/
│   │   │   ├── gauge_widget.dart     # Animated gauges
│   │   │   └── route_planner.dart    # Waypoints, route panel
│   │   └── services/
│   │       ├── websocket_service.dart
│   │       ├── settings_service.dart
│   │       └── logbook_service.dart
│   ├── assets/fonts/NotoColorEmoji.ttf
│   └── pubspec.yaml
├── data/                       # Runtime data (not in repo)
│   ├── settings.json
│   ├── known_topics.json
│   └── crew.json
├── docs/
├── scripts/
├── DASHBOARD_DSL.md
└── README.md
```

---

## 🎯 Dashboard DSL

BoatOS uses its own **Domain Specific Language** for dashboards:

```
GRID 4

ROW main
GAUGE boot/sensoren/motor/drehzahl MAX 6000 UNIT "RPM" DECIMALS 0
GAUGE boot/sensoren/motor/oeldruck MAX 7 UNIT "Bar" STYLE bar DECIMALS 2
SENSOR boot/sensoren/batterie STYLE hero
SENSOR boot/sensoren/lage SIZE 2 STYLE hero
SENSOR boot/sensoren/tank/diesel SIZE 2
```

Gauge styles: `arc180`, `arc270` (default), `arc360`, `bar`  
Sensor styles: `card` (default), `hero`, `compact`

Documentation: [DASHBOARD_DSL.md](DASHBOARD_DSL.md)

---

## 📡 API (selection)

Full documentation: `http://<pi-ip>:8000/docs`

| Endpoint | Description |
|---|---|
| `WS /ws` | WebSocket — GPS, sensors, real-time |
| `GET /api/sensors/list` | All MQTT sensors with status & values |
| `GET /api/mqtt/topics` | Raw MQTT topics with timestamps |
| `POST /api/route` | Calculate route (OSRM) |
| `GET /api/locks/bounds` | Locks in bounding box |
| `GET /api/gauges` | Water level gauges in bounding box |
| `GET /api/ais/vessels` | AIS vessels in bounding box |
| `GET /api/logbook/trips` | All trips |
| `GET /api/logbook/trips/{id}` | Trip detail with track & entries |
| `POST /api/logbook/start` | Start trip |
| `POST /api/logbook/stop` | End trip |
| `GET /api/crew` | Crew members |
| `GET /api/settings` | System settings |
| `GET /api/saved-routes` | Saved routes |

---

## 🛠️ Development

### Backend (on Pi or locally)

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Deck Frontend

```bash
# No build needed — edit files directly
# Browser: https://localhost/ (kiosk) or https://<pi-ip>/
```

### Helm (build on development PC)

```bash
cd flutter_app
# Build for Pi 4 (ARM64)
flutterpi_tool build --arch=arm64 --cpu=pi4 --release

# Deploy
scp build/flutter-pi/aarch64-generic/app.so boatos@<pi-ip>:/home/boatos/BoatOS/flutter_app/app.so
ssh boatos@<pi-ip> "sudo systemctl restart lightdm"
```

### MQTT Debugging

```bash
# Follow all topics live
mosquitto_sub -h localhost -t '#' -v

# Send test data
mosquitto_pub -h <pi-ip> -t 'boot/sensoren/motor/drehzahl' -m '2500'
```

---

## 🗺️ Roadmap

### ✅ Done
- GPS integration (SignalK, USB, phone fallback)
- Interactive vector maps (MapLibre / flutter_map, local)
- Waterway routing (OSRM)
- AIS live vessel traffic
- Weather alerts (DWD)
- Digital logbook with crew & water level tracking
- Dashboard DSL + visual editor (Deck)
- Animated gauge widgets (Helm)
- Lock database (OSM)
- Satellite maps + offline caching
- Route simulation
- Smooth GPS marker (EMA + interpolation)
- MQTT auto-reconnect

### 🚧 In Progress
- Helm feature parity with Deck
- ~~Distributable Pi image~~ ✅ [Ready-to-flash image available](https://archive.org/download/boatos-distri-image/boatos_v1.6.2.img.gz)

### 🔮 Planned
- Anchor alarm with geofencing
- Tide predictions (BSH API)
- GPX import/export
- AIS target CPA calculation
- MOB (Man Over Board) alert

---

## 🤝 Contributing

Pull requests are welcome!

1. Fork → branch → commit → PR
2. Code style: PEP8 (Python), standard JS / Dart
3. Commit messages: Conventional Commits
4. Please test on real Pi hardware

---

## 🐛 Troubleshooting

### Backend won't start
```bash
sudo systemctl status boatos
sudo journalctl -u boatos -f
```

### GPS no data
```bash
ls -la /dev/ttyUSB* /dev/ttyACM*
curl http://localhost:3000/signalk/v1/api/vessels/self/navigation/position
sudo systemctl status signalk
```

### MQTT sensors not appearing
```bash
sudo systemctl status mosquitto
mosquitto_sub -h localhost -t '#' -v
# Backend status:
curl http://localhost:8000/api/mqtt/topics
```

### Flutter app won't start
```bash
sudo systemctl status lightdm
# Logs:
sudo journalctl -u lightdm -f
```

More: [docs/installation.md](docs/installation.md)

---

## 📜 License

BoatOS is open source and licensed under the **[GNU General Public License v3.0](LICENSE)**.

This means: you can freely use, study, and modify the code. Derivatives must also be released under GPL v3.

---

## 👏 Credits

- **Development**: bigbrainlabs
- **AI pair programming**: Claude Code (Anthropic)
- **Maps**: OpenSeaMap, OpenStreetMap, ESRI
- **Data**: DWD, PEGELONLINE, AISStream.io
- **Libraries**: FastAPI, flutter_map, MapLibre GL, SignalK, OSRM

---

## 🔗 Links

- 🌐 **Open Boat Projects**: [open-boat-projects.org/de/boatos](https://open-boat-projects.org/de/boatos/)
- 📦 **GitHub**: [github.com/bigbrainlabs/BoatOS](https://github.com/bigbrainlabs/BoatOS)
- 📖 **Book (🇩🇪)**: [Logbuch ohne Pose — Deutsch](https://www.amazon.de/dp/B0GLXGD8LB?binding=kindle_edition&ref_=saga_dp_ss_dsk_sdp)
- 📖 **Book (🇬🇧)**: [Logbuch ohne Pose — English](https://www.amazon.de/dp/B0GMD5JH28?binding=kindle_edition&ref_=saga_dp_ss_dsk_sdp)

---

<div align="center">

**Built with ❤️ for the water**

*By sailors, for sailors*

[⬆ Back to top](#-boatos)

</div>
