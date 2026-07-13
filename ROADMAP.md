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

| Feature | Description | Category |
|---------|-------------|----------|
| AIS collision warning | CPA/TCPA calculation — alert when collision course detected | Safety |
| Cross-track error alert (XTE) | Warning when the boat deviates from the planned course | Safety |
| Voice guidance (TTS) | "Waypoint in 500 m" — Web Speech API, optional | UX |
| Marina & anchorage POIs | Configurable POI database (OpenSeaMap import), region-independent | Map |
| Tidal integration | Tide curves, automatic ETA adjustment for tidal sections | Data, Routing |

---

## v1.9 — Offline-First

| Feature | Description | Category |
|---------|-------------|----------|
| Offline weather data (GRIB) | Download forecast for the active route and use without internet | Data |
| Weather alerts | Configurable thresholds for storms, strong winds, low visibility | Safety |
| Weather overlay on map | Wind arrows along the route, colour-coded by intensity | Map |
| Logbook export (PDF / HTML) | Trip report with track map — for insurance, records, archive | UX |
| Photos in logbook | Attach images to trip legs — stored locally on the Pi, no cloud upload | UX |
| 3D / look-ahead chart view (Deck) | Tilted head-up perspective of the fairway ahead (like professional inland ECDIS, e.g. Tresco Navigis) — camera pitch + COG-follow on the existing IENC vector data (MapLibre); buoys, km-marks, depth zones, sky layer | Map |
| Helm map engine for 3D perspective | `flutter_map` is 2D (rotation only, no pitch) — a 3D view on the Helm needs switching to a MapLibre-native Flutter engine (GPU); check flutter-pi resources. Without the switch the Helm stays head-up 2D | Map, Platform |

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

*Versioning scheme: `major.month.release` — increment only the last segment.*
