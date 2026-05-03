# BoatOS V2 — Native Touchscreen App (flutter-pi)

## Ziel

Die Touchscreen-UI auf dem Pi wird von Browser/Kiosk auf eine native Flutter-App migriert.
Der Browser-Frontend bleibt erhalten und dient ausschließlich für externen Zugriff (Handy, Laptop).

## Warum flutter-pi?

| | V1 (cog/WPE) | V2 (flutter-pi) |
|---|---|---|
| Stack | labwc → cog → JS-Engine | flutter-pi direkt |
| Desktop/Compositor | labwc (Wayland) | keiner |
| Display | Wayland surface | DRM/KMS direkt |
| Touch | libinput via Wayland | libinput direkt |
| RAM-Overhead | ~400–600 MB (Compositor + Browser) | ~80–150 MB |
| GPU | VideoCore via Browser | VideoCore via OpenGL ES direkt |
| Map | MapLibre GL JS (WebGL) | MapLibre Flutter SDK |
| Startzeit | ~15–25s | ~3–5s |

## Architektur V2

```
Pi Boot
  └─ systemd
       ├─ boatos.service          (Python API, Port 8000) — unverändert
       ├─ boatos-remote.service   (unverändert)
       ├─ tileserver.service      (martin, Port 8081) — unverändert
       ├─ signalk.service         (GPS, Port 3000) — unverändert
       └─ boatos-ui.service       (flutter-pi → native App)

Externe Geräte (Handy, Laptop)
  └─ Browser → nginx → frontend/ (HTML/JS) — unverändert
```

Der Python-Backend-Stack bleibt **komplett unverändert** — die Flutter-App ist nur ein neuer Client
der dieselben HTTP/WebSocket-APIs spricht.

## Technologie-Stack

- **flutter-pi**: https://github.com/ardera/flutter-pi
  - Läuft direkt auf DRM/KMS, kein Wayland/X11 nötig
  - Touch via libinput
  - GPU: OpenGL ES (VideoCore IV/VI)
- **Flutter**: Dart, cross-compiliert auf dem Entwicklungsrechner, deployed auf Pi
- **MapLibre Flutter SDK**: `flutter_map` + `vector_map_tiles` oder offizielles `maplibre_gl`
- **HTTP/WebSocket**: `http` + `web_socket_channel` Dart-Packages (kommuniziert mit Python-Backend)

## Migrations-Reihenfolge

### Phase 1 — Infrastruktur & Proof of Concept
- [ ] flutter-pi auf Pi installieren
- [ ] Hello-World Flutter-App cross-compilieren + auf Pi deployen
- [ ] Display (1280×800) + Touch (QDtech MPI1001) verifizieren
- [ ] systemd-Service `boatos-ui.service` aufsetzen (autostart beim Boot, kein labwc mehr)
- [ ] labwc/cog aus autostart entfernen

### Phase 2 — Kernfunktionen
- [ ] Map-View: MapLibre Flutter SDK, Vector Tiles von martin (Port 8081)
- [ ] OpenSeaMap + ENC Overlays
- [ ] Boot-Marker mit GPS (WebSocket → Python-Backend)
- [ ] GPS-Smoothing (EMA + Interpolation, analog zu map.js)
- [ ] Auto-Follow + Follow-Button

### Phase 3 — Navigation
- [ ] Waypoint-System (Tap auf Karte, Liste)
- [ ] Routing via OSRM (HTTP → Python-Backend)
- [ ] Route auf Karte anzeigen
- [ ] Routeninfo (Distanz, ETA, Wegpunkte)
- [ ] Simulations-Modus

### Phase 4 — Dashboard
- [ ] Gauge-Widgets (RPM, Geschwindigkeit, Tiefe, Temperatur, ...)
- [ ] Sensor-Anbindung via `/api/sensors` (HTTP polling oder WebSocket)
- [ ] Dashboard-Editor (Drag & Drop wie V1)

### Phase 5 — Logbuch & Settings
- [ ] Trip-Recording (Start/Stop, Track, Crew)
- [ ] Logbuch-Archiv (Karte + Statistiken)
- [ ] Pegel-Anzeige
- [ ] Settings-UI (GPS-Config, AIS-Key, etc.)

### Phase 6 — AIS & Extras
- [ ] AIS-Schiffe auf Karte
- [ ] Schleusen-Layer
- [ ] Satelliten-Imagery + Offline-Caching
- [ ] On-Screen-Keyboard (nur Pi, analog zu V1)

## Pi-Setup für flutter-pi

```bash
# flutter-pi dependencies
sudo apt install libdrm-dev libgbm-dev libgles2-mesa-dev \
                 libinput-dev libudev-dev libsystemd-dev \
                 libxkbcommon-dev

# flutter-pi bauen
git clone https://github.com/ardera/flutter-pi
cd flutter-pi && mkdir build && cd build
cmake .. && make -j4
sudo make install

# flutter_asset_bundle (cross-compile auf Entwicklungsrechner)
# flutter build bundle --target-platform linux-arm64
```

```ini
# /etc/systemd/system/boatos-ui.service
[Unit]
Description=BoatOS UI (flutter-pi)
After=network.target boatos.service

[Service]
User=arielle
ExecStart=/usr/local/bin/flutter-pi --release /home/arielle/BoatOS/flutter_app/build/flutter_assets
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

## Bekannte Einschränkungen / Risiken

- **MapLibre Flutter**: `maplibre_gl` nutzt intern maplibre-native (C++ via FFI) — muss für ARM64 kompiliert werden. Alternativ: `flutter_map` (pure Dart, raster tiles) als Fallback wenn maplibre_gl zu komplex.
- **Cross-Compile**: Flutter-App wird auf Windows/Linux cross-compiliert (`flutter build linux --target-platform linux-arm64`), dann per SCP auf Pi deployed.
- **GPU-Treiber**: Pi 4/5 hat V3D (OpenGL ES 3.1). flutter-pi unterstützt das nativ. Pi 3 (VideoCore IV) wäre OpenGL ES 2.0.
- **DRM-Zugriff**: User `arielle` muss in `video` + `render` Gruppe sein: `sudo usermod -aG video,render arielle`

## Was bleibt in V1 (Browser-Frontend)

- Kompletter HTML/CSS/JS-Stack in `frontend/`
- Erreichbar extern via nginx (HTTPS, Port 443)
- Alle Features bleiben funktionsfähig für Remote-Zugriff
- Wird parallel zu V2 weiter gepflegt (Bugfixes, kleine Features)

## Entwicklungs-Workflow

1. Flutter-App auf Windows/Linux entwickeln (Hot Reload via `flutter run`)
2. Für Pi: `flutter build bundle` → SCP nach `/home/arielle/BoatOS/flutter_app/`
3. `sudo systemctl restart boatos-ui` auf Pi
4. Kein Chromium-Cache-Problem mehr — native Binary

---

*Gestartet: 2026-04-28 — Pi kommt zurück → Phase 1 beginnt*
