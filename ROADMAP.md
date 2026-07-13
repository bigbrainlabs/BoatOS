# BoatOS Roadmap

*Current: **v1.6.11** · As of July 2026*

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
