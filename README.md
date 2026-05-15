# ⚓ BoatOS

> **Modern Marine Navigation System — Open Source, Touch-Optimized, Offline-First**

Ein vollständiges Marine-Navigationssystem für Binnenschifffahrt und Küstennavigation. Gebaut für Raspberry Pi mit Touchscreen, läuft komplett offline, keine Abos, keine Cloud-Zwänge.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Raspberry%20Pi-red.svg)
![Python](https://img.shields.io/badge/python-3.9+-blue.svg)
![Flutter](https://img.shields.io/badge/flutter-3.x-blue.svg)
![Status](https://img.shields.io/badge/status-active-green.svg)

---

## 🌟 Highlights

- 🗺️ **Zwei UIs** — Deck (browser-based Web-Frontend) + Helm (native Flutter-App, flutter-pi)
- 🧭 **Binnengewässer-Routing** — OSRM-optimiert für Elbe, Kanäle & Schleusen
- 📡 **Live AIS** — Echtzeit-Schiffsverkehr (Europa), via AISStream.io
- ⚠️ **Wetter & Warnungen** — DWD API mit Unwetter-Alerts
- 📖 **Digitales Logbuch** — GPS-Tracks, Crew, Pegelstände, Export
- 🔌 **Sensor-Dashboard** — MQTT-Integration, DSL-konfigurierbares Layout, animierte Gauges
- 🛰️ **Satellitenkarten** — ESRI World Imagery mit Offline-Caching
- 👆 **Touch-optimiert** — Große Targets, kein 300ms-Delay, perfekt für unterwegs

---

## 📸 Screenshots

<!-- TODO: Add screenshots -->
```
Demos: Check Instagram @bigbrainlabs
```

---

## 🏗️ Architektur

```
┌──────────────────────────────────────────────────────────────────┐
│                        Raspberry Pi 4                            │
│                                                                  │
│   ┌──────────────────────┐   ┌──────────────────────────────┐   │
│   │   Deck Web-Frontend  │   │    Helm Flutter-App (flutter-pi)│  │
│   │   (Nginx + HTTPS)    │   │    Nativer Kiosk, lightdm    │   │
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
│   │  Martin Tile Server        │  Port 8081, lokale Vektorkarten│
│   │  OSRM Routing Server       │  Port 5000, Binnengewässer     │
│   └────────────────────────────┘                                │
└──────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features im Detail

### 🗺️ Karte & Navigation
- **Vektor-Seekarten** — OpenMapTiles via Martin (lokal, offline), Deck-Light-Style
- **Seemarken** — OpenSeaMap Overlay
- **Satellitenkarten** — ESRI World Imagery mit passivem + aktivem Offline-Caching (SW/Cache-API)
- **AIS** — Live Schiffsverkehr via AISStream.io, gefiltert auf Europa-Bounding-Box
- **Schleusen-Datenbank** — OSM-basiert, 300m-Deduplizierung, VHF/Zeiten/Maße
- **Pegeldaten** — PEGELONLINE API, live Wasserstände auf der Karte
- **Auto-Follow** — EMA-gefiltertes GPS, smooth Marker-Animation (α=0.35, ~4s ease-out)
- **Routing** — OSRM-Wasserwegrouting, Wegpunkte drag-and-drop, Routen speichern/laden
- **Routensimulation** — ×1–×1000 Geschwindigkeit, Speed-Slider, GPS-Blocking während Sim
- **Navigation** — Richtung & Distanz zum nächsten Wegpunkt, automatisches Vorschalten

### 📊 Dashboard
- **DSL-Layout** — Textbasierte Konfiguration (GRID, GAUGE, SENSOR, ROW)
- **Gauge-Stile** — arc180, arc270, arc360, bar — alle mit animierter Nadel (500ms ease-out)
- **SensorCards** — card, hero, compact — mit SHOW/HIDE-Filter, Status-LED
- **MQTT-Daten** — alle Sensor-Topics automatisch erkannt, String-Werte korrekt geparsed
- **Visual Editor** (Deck) — Drag & Drop, Undo/Redo, Bi-direktionale DSL-Sync

### 📖 Logbuch
- **GPS-Track-Recording** — Start/Stop, Pause, Pegelstände pro Track-Punkt
- **Crew Management** — Emoji-Avatare, Rollen (Skipper/Crew/Gast), Kontaktdaten
- **Archiv** — Alle Fahrten mit Detailansicht: Statistik, Track auf Karte, Wetter, Pegel, Sensoren
- **Pegel-Tracking** — Alle 15 min werden nächstgelegene Stationen mitgeschrieben
- **Logbuch-Einträge** — Manuell & automatisch (Fahrtstart/-ende mit Wetter-Snapshot)

### 🔌 Sensoren & MQTT
- **Auto-Discovery** — Alle MQTT-Topics werden automatisch erkannt und gespeichert
- **Persistent Topics** — `known_topics.json` — Sensordaten bleiben über Neustarts erhalten
- **MQTT Auto-Reconnect** — loop_forever()-Thread mit 5s Retry — überlebt Broker-Neustarts
- **GPS Synthetic Sensors** — Altitude, HDOP, Satelliten als Dashboard-Sensoren
- **SignalK Bridge** — GPS & Navigationsdaten über SignalK, konfigurierbar in Einstellungen

### 🌦️ Wetter & Umwelt
- **DWD Integration** — Deutscher Wetterdienst, automatisch nach Bootsposition
- **Unwetter-Warnungen** — Live Alerts mit Schweregrad, auf Karte
- **Pegeldaten** — PEGELONLINE, Tracking während der Fahrt für Flachwasseranalyse

---

## 📱 Deck vs Helm

| | Deck — Web-Frontend | Helm — Flutter-App |
|---|---|---|
| **Basis** | Vanilla JS, MapLibre GL | Flutter 3.x, flutter-pi |
| **Kiosk** | cog (WPE WebKit) | flutter-pi + lightdm |
| **Karten** | MapLibre GL JS v4.7.1 | flutter_map + vector_map_tiles |
| **Status** | ✅ Produktiv, aktiv | ✅ Produktiv, in Entwicklung |
| **Stärken** | Vollständiger Feature-Set, Visual Editor | Native Performance, animierte Gauges |

Beide UIs teilen dasselbe Backend und die gleiche REST/WebSocket-API.

---

## 🚀 Tech Stack

### Backend
- **FastAPI** — High-Performance Python API
- **paho-mqtt** — MQTT-Client mit Auto-Reconnect
- **SignalK** — Marine Data Server (GPS)
- **uvicorn** — ASGI Server

### Deck Frontend
- **Vanilla JavaScript** — ES Modules, kein Framework-Bloat
- **MapLibre GL JS** v4.7.1 — Vektorkarten (lokal)
- **WebSocket** — Echtzeit GPS & Sensordaten
- **Service Worker** — Offline-Caching (Karten, Satellitenkacheln)

### Helm Flutter-App
- **Flutter** 3.x + **flutter-pi** — Native ARM64 AOT-Build
- **flutter_map** — Interaktive Karten
- **vector_map_tiles** — Vektorkacheln aus lokalem Martin
- **provider** — State Management
- **web_socket_channel** — WebSocket-Verbindung zum Backend

### Infrastruktur
- **Nginx** — Reverse Proxy & SSL (Deck)
- **Martin** — Vektortile-Server (Port 8081)
- **OSRM** — Routing-Engine (Port 5000, IPv4-only)
- **Mosquitto** — MQTT Broker (Port 1883)
- **Raspberry Pi 4** — Hardware-Plattform

### Datenquellen
- **OpenSeaMap** — Seemarken-Overlay
- **OpenStreetMap / OMT** — Vektorkarten & Routing
- **ESRI World Imagery** — Satellitenkarten
- **DWD API** — Deutscher Wetterdienst
- **PEGELONLINE** — Wasserstandsdaten
- **AISStream.io** — Live AIS Schiffsdaten
- **SignalK** — Marine-Datenstandard

---

## 📋 Systemanforderungen

### Hardware
- **Raspberry Pi 4** (min. 2 GB RAM, 4 GB empfohlen)
- **GPS Empfänger** — USB, z. B. BU-353N5 (`/dev/ttyUSB0`, 4800 baud)
- **Touchscreen** — z. B. QDtech MPI1001 10.1" (1280×800)
- **SD Card** — Min. 32 GB
- **Optional** — ESP32/Arduino Sensorboard via MQTT

### Software
- **Raspberry Pi OS** Bookworm (64-bit)
- **Python** 3.9+
- **Node.js** (für SignalK)
- **Flutter SDK** + flutter-pi (nur für Helm-Build)

---

## 💾 Fertig-Image (empfohlen)

Das schnellste Setup — einfach flashen, fertig:

1. **Image herunterladen** (v1.5.0): [archive.org/details/boatos-distri-image](https://archive.org/details/boatos-distri-image) (~15 GB)
2. **Raspberry Pi Imager** öffnen → *Custom Image* → heruntergeladene Datei wählen
3. **Zahnrad-Menü** → WiFi + SSH konfigurieren
4. Flashen → Pi booten → Helm startet automatisch

> Mindestens 32 GB SD-Karte oder USB-SSD. Partition wird beim ersten Boot automatisch auf die volle Größe erweitert.

---

## ⚡ Schnellstart (manuelle Installation)

### 1. Repository klonen & installieren

```bash
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS
chmod +x install.sh
./install.sh
```

### 2. Deck aufrufen

```
https://<pi-ip>/
```

### 3. Helm bauen & deployen

```bash
# Auf dem Entwicklungs-PC (Flutter SDK + flutterpi_tool erforderlich):
cd flutter_app
flutterpi_tool build --arch=arm64 --cpu=pi4 --release

# Deploy auf Pi:
scp build/flutter-pi/pi4-64/app.so arielle@<pi-ip>:/home/arielle/BoatOS/flutter_app/app.so
ssh arielle@<pi-ip> "sudo systemctl restart lightdm"
```

Detaillierte Anleitung: [INSTALL.md](INSTALL.md)

---

## 📁 Verzeichnisstruktur

```
BoatOS/
├── backend/                    # FastAPI Backend
│   ├── app/
│   │   ├── main.py             # Haupt-API, WebSocket, MQTT
│   │   ├── gps_service.py      # GPS via SignalK
│   │   ├── logbook_storage.py  # Logbuch & Tracks
│   │   ├── locks_storage.py    # Schleusen-Datenbank
│   │   ├── crew_management.py  # Crew CRUD
│   │   ├── pegelonline.py      # Pegeldaten
│   │   ├── ais_service.py      # AIS via AISStream
│   │   └── ...
│   └── requirements.txt
├── frontend/                   # Deck Web-Frontend
│   ├── index.html
│   ├── js/
│   │   ├── main.js             # ES Module Entry
│   │   ├── map.js              # Karte, Marker, GPS-Smoothing
│   │   ├── navigation.js       # Routing & Simulation
│   │   ├── logbook.js          # Logbuch & Crew
│   │   ├── sensors.js          # GPS Fallbacks
│   │   ├── ais.js              # AIS-Schiffe
│   │   └── ...
│   ├── css/
│   └── sw.js                   # Service Worker (Offline-Caching)
├── flutter_app/                # Helm Native Flutter-App
│   ├── lib/
│   │   ├── main.dart
│   │   ├── screens/
│   │   │   ├── map_screen.dart       # Karte, GPS, Routing, Sim
│   │   │   ├── dashboard_screen.dart # DSL-Dashboard, Gauges
│   │   │   ├── logbook_screen.dart   # Logbuch, Crew, Archiv
│   │   │   └── settings_screen.dart
│   │   ├── widgets/
│   │   │   ├── gauge_widget.dart     # Animierte Gauges
│   │   │   └── route_planner.dart    # Wegpunkte, RoutePanel
│   │   └── services/
│   │       ├── websocket_service.dart
│   │       ├── settings_service.dart
│   │       └── logbook_service.dart
│   ├── assets/fonts/NotoColorEmoji.ttf
│   └── pubspec.yaml
├── data/                       # Laufzeitdaten (nicht im Repo)
│   ├── settings.json
│   ├── known_topics.json
│   └── crew.json
├── docs/
├── scripts/
├── INSTALL.md
├── DASHBOARD_DSL.md
└── README.md
```

---

## 🎯 Dashboard DSL

BoatOS nutzt eine eigene **Domain Specific Language** für Dashboards:

```
GRID 4

ROW main
GAUGE boot/sensoren/motor/drehzahl MAX 6000 UNIT "RPM" DECIMALS 0
GAUGE boot/sensoren/motor/oeldruck MAX 7 UNIT "Bar" STYLE bar DECIMALS 2
SENSOR boot/sensoren/batterie STYLE hero
SENSOR boot/sensoren/lage SIZE 2 STYLE hero
SENSOR boot/sensoren/tank/diesel SIZE 2
```

Gauge-Stile: `arc180`, `arc270` (Standard), `arc360`, `bar`
Sensor-Stile: `card` (Standard), `hero`, `compact`

Dokumentation: [DASHBOARD_DSL.md](DASHBOARD_DSL.md)

---

## 📡 API (Auswahl)

Vollständige Dokumentation: `http://<pi-ip>:8000/docs`

| Endpoint | Beschreibung |
|---|---|
| `WS /ws` | WebSocket — GPS, Sensoren, Echtzeit |
| `GET /api/sensors/list` | Alle MQTT-Sensoren mit Status & Werten |
| `GET /api/mqtt/topics` | Rohe MQTT-Topics mit Timestamps |
| `POST /api/route` | Route berechnen (OSRM) |
| `GET /api/locks/bounds` | Schleusen in Bounding Box |
| `GET /api/gauges` | Pegelstände in Bounding Box |
| `GET /api/ais/vessels` | AIS-Schiffe in Bounding Box |
| `GET /api/logbook/trips` | Alle Fahrten |
| `GET /api/logbook/trips/{id}` | Fahrt-Detail mit Track & Einträgen |
| `POST /api/logbook/start` | Fahrt starten |
| `POST /api/logbook/stop` | Fahrt beenden |
| `GET /api/crew` | Crew-Mitglieder |
| `GET /api/settings` | Systemeinstellungen |
| `GET /api/saved-routes` | Gespeicherte Routen |

---

## 🛠️ Entwicklung

### Backend (auf dem Pi oder lokal)

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Deck Frontend

```bash
# Kein Build nötig — Dateien direkt bearbeiten
# Browser: https://localhost/ (kiosk) oder https://<pi-ip>/
```

### Helm (Build auf dem Entwicklungs-PC)

```bash
cd flutter_app
# Build für Pi 4 (ARM64)
flutterpi_tool build --arch=arm64 --cpu=pi4 --release

# Deploy
scp build/flutter-pi/pi4-64/app.so arielle@<pi-ip>:/home/arielle/BoatOS/flutter_app/app.so
ssh arielle@<pi-ip> "sudo systemctl restart lightdm"
```

### MQTT Debugging

```bash
# Alle Topics live verfolgen
mosquitto_sub -h localhost -t '#' -v

# Testdaten senden
mosquitto_pub -h <pi-ip> -t 'boot/sensoren/motor/drehzahl' -m '2500'
```

---

## 🗺️ Roadmap

### ✅ Abgeschlossen
- GPS Integration (SignalK, USB, Phone-Fallback)
- Interaktive Vektorkarten (MapLibre / flutter_map, lokal)
- Wasserweg-Routing (OSRM)
- AIS Live-Schiffsverkehr
- Wetter-Warnungen (DWD)
- Digitales Logbuch mit Crew & Pegeltracking
- Dashboard DSL + Visual Editor (Deck)
- Animierte Gauge-Widgets (Helm)
- Schleusen-Datenbank (OSM)
- Satellitenkarten + Offline-Caching
- Routensimulation
- Smooth GPS-Marker (EMA + Interpolation)
- MQTT Auto-Reconnect

### 🚧 In Arbeit
- Helm Feature-Parität mit Deck
- ~~Verteilbares Pi-Image~~ ✅ [Fertig-Image verfügbar](https://archive.org/details/boatos-distri-image)

### 🔮 Geplant
- Anker-Alarm mit Geofencing
- Tide-Vorhersagen (BSH API)
- GPX Import/Export
- AIS Target CPA-Berechnung
- MOB (Man Over Board) Alert

---

## 🤝 Contributing

Pull Requests sind willkommen!

1. Fork → Branch → Commit → PR
2. Code Style: PEP8 (Python), Standard JS / Dart
3. Commit Messages: Conventional Commits
4. Bitte auf echter Pi-Hardware testen

---

## 🐛 Troubleshooting

### Backend startet nicht
```bash
sudo systemctl status boatos
sudo journalctl -u boatos -f
```

### GPS keine Daten
```bash
ls -la /dev/ttyUSB* /dev/ttyACM*
curl http://localhost:3000/signalk/v1/api/vessels/self/navigation/position
sudo systemctl status signalk
```

### MQTT Sensoren erscheinen nicht
```bash
sudo systemctl status mosquitto
mosquitto_sub -h localhost -t '#' -v
# Backend-Status:
curl http://localhost:8000/api/mqtt/topics
```

### Flutter-App startet nicht
```bash
sudo systemctl status lightdm
# Logs:
sudo journalctl -u lightdm -f
```

Mehr: [INSTALL.md](INSTALL.md)

---

## 📜 Lizenz

**MIT License** — frei nutzbar, modifizierbar, verteilbar. Copyright-Notice behalten.

---

## 👏 Credits

- **Entwicklung**: bigbrainlabs
- **AI-Pair-Programming**: Claude Code (Anthropic)
- **Karten**: OpenSeaMap, OpenStreetMap, ESRI
- **Daten**: DWD, PEGELONLINE, AISStream.io
- **Libraries**: FastAPI, flutter_map, MapLibre GL, SignalK, OSRM

---

<div align="center">

**Gebaut mit ❤️ für die Schifffahrt**

*Von Skippern, für Skipper*

[⬆ Nach oben](#-boatos)

</div>
