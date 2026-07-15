# BoatOS Roadmap

*Current: **v1.6.11** · As of July 2026*

---

## Delivered — Official nautical charts (IENC)

| Feature | Description | Category |
|---------|-------------|----------|
| ELWIS ENC pipeline | Download official Inland ENCs from the WSV catalog (background job with progress), convert S-57 → vector tiles; catalog cache survives ELWIS outages | Map, Data |
| IENC vector rendering | Depth areas, fairway, bridges/weirs/overhead cables with clearances, inland traffic signs (CEVNI), buoyage, kilometre marks — with click popups. Deck (MapLibre) and Helm (Flutter) | Map |
| Route hazard check | After routing, check against IENC data: bridges/cables too low vs. boat height, shallow areas vs. draft (with water-level correction via W−MNW), weirs — shown as markers + panel | Safety, Routing |
| Routing: flood-relief channels excluded | Flood-relief waterways and old river arms (e.g. Elbe-Umflutkanal at Magdeburg) are no longer routed over; explicitly permitted ones (Dahme-Umflutkanal) stay navigable | Routing |

---

## v1.8 — Safety & Comfort

### Delivered

| Feature | Description | Category |
|---------|-------------|----------|
| **Marina & anchorage POIs** | Harbours/marinas (OSM) and anchorages (OpenSeaMap seamarks) as teardrop pins on the map, with a detail popup (berths, VHF, services, depth). **Offline pre-import** every 48 h instead of a live query per map move → no rate-limiting, works without internet. Toggle in the map settings | Map |
| **Tides (MVP)** | Tide curve of the nearest gauge (PegelOnline): current level, trend (flood/ebb), last high/low water, SVG sparkline — follows the map centre. Measured; harmonic prediction see below | Data |

### Open

| Feature | Description | Category |
|---------|-------------|----------|
| AIS collision warning | CPA/TCPA calculation — alert when collision course detected | Safety |
| Cross-track error alert (XTE) | Warning when the boat deviates from the planned course | Safety |
| Tides — expansion | Harmonic **prediction** of high/low water (offline, from reference-port constants) + ETA adjustment via tidal current for tidal sections | Data, Routing |

---

## v1.9 — 3D chart & weather

The `v1.9.x-dev` development branch. The 3D chart view is the centrepiece of this
release — see the preview at the top of the [README](README.md).

### Delivered

| Feature | Description | Category |
|---------|-------------|----------|
| **3D / look-ahead chart view (Deck)** | Tilted head-up perspective of the fairway ahead: the camera follows the course (COG), you look where you are going, the boat sits in the lower half of the screen. Pitch adjustable via buttons (20–75°, remembered), target zoom depends on screen width (16.0 phone … 17.5 desktop). Built on the existing IENC vector data — no extra data needed | Map |
| **Real 3D seamarks (Deck)** | Buoys and beacons as true 3D objects (three.js + MapLibre custom layer), data-driven from the official IENC data (`_cls`/`COLOUR`/`TOPSHP`/`CATCAM`) — colours and topmarks come from the chart, not from an assumption. Performance verified on the target Pi. Expansion: see below | Map |
| Weather alerts | Official warnings (DWD via Bright Sky, default) or OpenWeather One Call 3.0 as an opt-in; plus a user-defined wind threshold. Badge in the top bar + panel; API key configurable (Settings → Weather) | Safety |
| Wind overlay on the map | Wind arrows along the route — at each waypoint the forecast for **that leg's ETA** — plus the current wind at the boat. Colour-coded by strength, click popup with gusts and the direction the wind comes from | Map |
| Position-aware weather | Weather and warnings follow the current position instead of a fixed one; refetched after 15 min or once you have moved 10 km | Data |
| Route weather usable offline | `/api/weather/route` serves the forecast along the route (at each ETA), with a file cache → usable without internet. **GRIB is not needed for this** — the original GRIB item is thereby done | Data |
| Logbook export (PDF) | Trip report as PDF (`pdf_export.py`, `GET /api/trip/pdf/{id}`), reachable from the logbook (also in `main` by now) | UX |

### Open

| Feature | Description | Category |
|---------|-------------|----------|
| 3D seamarks — expansion & fine-tuning | Building on the real 3D buoys (`js/buoy3d.js`): more `TOPSHP` codes, beacons as poles instead of buoys, lights (sectors), `notmrk` as 3D signboards, click popups on 3D objects; fine-tuning of lighting/anti-aliasing, size & visibility (zoom thresholds), cardinal topmark orientation | Map |
| Helm map engine for 3D perspective | `flutter_map` (^8.1.1) is 2D (rotation only, no pitch) — a 3D view on the Helm needs switching to a MapLibre-native Flutter engine (GPU); check flutter-pi resources. Without the switch the Helm stays head-up 2D | Map, Platform |

---

## v1.10 — Platform

| Feature | Description | Category |
|---------|-------------|----------|
| REST API v1 stable | Versioning, OpenAPI docs, deprecation policy | Platform |
| Plugin system | Event bus + plugin directory for external extensions without forking | Platform |
| CI/CD & automated releases | GitHub Actions builds image and release automatically | Platform |
| Backend test coverage | Pytest for routing logic, current calculation, lock scheduling | Platform |

---

## Backlog — Ideas & Future

| Feature | Description | Note |
|---------|-------------|------|
| Anchor watch | GPS drift alarm with configurable radius | |
| Depth sounder | Real-time depth via MQTT, warnings, depth log | requires hardware |
| Multi-route comparison | Compare options side by side — distance, locks, ETA | |
| NMEA 2000 | N2K bus integration for engine, tank, wind, depth | requires CAN bus hardware |
| Smartphone companion | Position, ETA, alerts as a PWA on your phone | |
| Autopilot integration | Course keeping, waypoint steering | requires hardware |
| Lock registration history | Status tracking: registered / confirmed / passed. Currently there is only a "register" button with no state | concept open |

---

*Versioning scheme: `major.features.bugfixes` — bump the middle segment for features, the last for bug fixes.*
