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
| Marina & anchorage POIs | Configurable POI database (OpenSeaMap import), region-independent | Map |
| Tidal integration | Tide curves, automatic ETA adjustment for tidal sections | Data, Routing |

---

## Delivered — 3D chart & route weather (in the beta branch)

| Feature | Description | Category |
|---------|-------------|----------|
| 3D / look-ahead chart view (Deck) | Tilted head-up perspective of the fairway ahead (camera pitch + COG-follow, target zoom), on the existing IENC vector data | Map |
| Real 3D seamarks (Deck) | Buoys/beacons as true 3D objects via three.js + MapLibre custom layer, data-driven from IENC (`TOPSHP`/`COLOUR`/`CATCAM`). Performance verified on the target Pi. Expansion: see v1.9 | Map |
| Route weather usable offline | `/api/weather/route` serves the forecast along the route (at each ETA), with a file cache → usable without internet. **GRIB is not needed for this** — the original GRIB item is thereby done | Data |
| Logbook export (PDF) | Trip report as PDF (`pdf_export.py`, `GET /api/trip/pdf/{id}`), reachable from the logbook | UX |

---

## v1.9 — Offline-First

| Feature | Description | Category |
|---------|-------------|----------|
| Weather alerts | **Backend already exists** (`weather_alerts` module, `/api/weather/alerts` + `/cached`) — serves official warnings. Missing: the UI for it, plus the decision whether user-configurable thresholds (storm, strong wind, visibility) should be added | Safety |
| Weather overlay on map | Wind arrows along the route, colour-coded by intensity. Currently there is only a DOM panel (`route-weather-overlay`), nothing on the map itself | Map |
| Helm map engine for 3D perspective | `flutter_map` (^8.1.1) is 2D (rotation only, no pitch) — a 3D view on the Helm needs switching to a MapLibre-native Flutter engine (GPU); check flutter-pi resources. Without the switch the Helm stays head-up 2D | Map, Platform |
| 3D seamarks — expansion & fine-tuning | Building on the real 3D buoys (three.js + MapLibre custom layer, IALA/S-57 from `TOPSHP`/`COLOUR`, `js/buoy3d.js`): more `TOPSHP` codes, beacons as poles instead of buoys, lights (sectors), `notmrk` as 3D signboards, click popups on 3D objects; fine-tuning of lighting/anti-aliasing, size & visibility (zoom thresholds), cardinal topmark orientation | Map |

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
