# BoatOS Remote Control & Tablet-Helm

Remote-Control-Lösung für BoatOS mit Tablet-Fernbedienung und Helm-Modus.

## Konzept

Das Tablet kann in zwei Modi verwendet werden:
1. **Remote-Modus**: Tablet steuert das Haupt-Display am Armaturenbrett
2. **Helm-Modus**: Tablet zeigt BoatOS eigenständig (zweiter Bildschirm für Außensteuerstand)

## Architektur

```
┌─────────────────┐              ┌──────────────────────┐
│   Tablet        │              │   Raspberry Pi       │
│                 │              │                      │
│  ┌───────────┐  │   WiFi       │  ┌────────────────┐  │
│  │ Browser   │──┼──────────────┼─>│ nginx (80/443) │  │
│  │           │  │              │  └────────────────┘  │
│  └───────────┘  │              │                      │
│                 │   WebSocket  │  ┌────────────────┐  │
│  ┌───────────┐  │              │  │ Remote Server  │  │
│  │ /remote   │──┼──────────────┼─>│  (Port 8080)   │  │
│  │ Touch UI  │  │              │  └────────────────┘  │
│  └───────────┘  │              │         │            │
└─────────────────┘              │         v            │
                                 │  ┌────────────────┐  │
                                 │  │ Virtual Input  │  │
                                 │  │ (uinput)       │  │
                                 │  └────────────────┘  │
                                 │         │            │
                                 │         v            │
                                 │  ┌────────────────┐  │
                                 │  │ X11/Wayland    │  │
                                 │  │ Display        │  │
                                 │  └────────────────┘  │
                                 └──────────────────────┘
```

## Komponenten

### 1. WebSocket Server (Python)
- **Datei**: `backend/remote_control_server.py`
- **Port**: 8080
- **Funktion**: Empfängt Touch-Events vom Tablet, generiert virtuelle Input-Events
- **Technologie**: `websockets`, `python-evdev`

### 2. Virtual Input Handler (Python)
- **Datei**: `backend/virtual_input.py`
- **Funktion**: Erstellt virtuelles Touch-Device über `/dev/uinput`
- **Technologie**: `python-evdev`, `UInput`

### 3. Remote Control Frontend
- **Datei**: `frontend/remote.html`
- **Funktion**: Touch-Interface für Tablet
- **Features**:
  - Virtual Touchpad (sendet relative Koordinaten)
  - Mode-Toggle (Remote ↔ Helm)
  - Connection Status
  - Haptic Feedback

### 4. nginx Konfiguration
- **Datei**: `/etc/nginx/sites-available/boatos`
- **Routes**:
  - `/` → BoatOS Frontend
  - `/remote` → Remote Control Interface
  - `/ws` → WebSocket Proxy zu Port 8080

### 5. Systemd Service
- **Datei**: `/etc/systemd/system/boatos-remote.service`
- **Funktion**: Startet Remote-Control-Server automatisch beim Boot

## Implementierungsschritte

### Phase 1: Backend Setup
1. Python-Dependencies installieren:
   - `websockets`
   - `python-evdev` (bereits installiert)

2. Virtual Input Handler implementieren
   - Erstellt `/dev/uinput` Device
   - Emuliert Touch-Events

3. WebSocket-Server implementieren
   - Empfängt Touch-Koordinaten
   - Validiert Input
   - Leitet an Virtual Input weiter

### Phase 2: Frontend Entwicklung
1. Remote Control Interface erstellen
   - Responsive Design für Tablets
   - Touch-Tracking mit Pointer Events
   - WebSocket-Client
   - Mode-Switch Button

2. Connection Management
   - Auto-Reconnect bei Verbindungsabbruch
   - Connection Status Anzeige
   - Error Handling

### Phase 3: Integration
1. nginx Konfiguration anpassen
   - WebSocket Proxy einrichten
   - `/remote` Route hinzufügen

2. Systemd Service konfigurieren
   - Auto-Start aktivieren
   - Restart on Failure

3. Berechtigungen setzen
   - User `arielle` zu Gruppe `input` hinzufügen
   - uinput Berechtigungen konfigurieren

### Phase 4: Testing & Deployment
1. Lokale Tests
2. Deployment auf Pi
3. End-to-End Tests mit Tablet
4. Performance-Optimierung

## Features

### Remote-Modus
- ✅ Virtual Touchpad sendet relative Bewegungen
- ✅ Tap = Click
- ✅ Long-Press = Right-Click
- ✅ Two-Finger = Scroll
- ✅ Pinch = Zoom

### Helm-Modus
- ✅ Lädt BoatOS-Frontend direkt
- ✅ Unabhängige Instanz vom Haupt-Display
- ✅ Vollständige Funktionalität

### Zusatzfeatures (Optional)
- ⬜ Schnellzugriff-Buttons (Zoom, Route, Wetter)
- ⬜ Virtuelle Tastatur
- ⬜ Gamepad-Modus (Pfeiltasten)
- ⬜ Multi-Touch-Gesten
- ⬜ Vibration-Feedback

## Technische Details

### Touch-Event-Protokoll (WebSocket)
```json
{
  "type": "touch",
  "action": "move|down|up",
  "x": 0.5,
  "y": 0.5,
  "timestamp": 1234567890
}
```

### Virtual Input Device Specs
- Device Name: "BoatOS Remote Touch"
- Vendor: 0x0001 (Generic)
- Product: 0x0001
- Capabilities: ABS_X, ABS_Y, BTN_TOUCH
- Resolution: 1920x1200 (matching main display)

## Sicherheit

- ✅ Nur lokales Netzwerk (192.168.2.x)
- ✅ Keine Authentifizierung nötig (privates Boot-Netzwerk)
- ⬜ Optional: Basic Auth für zusätzliche Sicherheit

## Performance

- Latenz Ziel: < 50ms
- Touch-Sampling: 60 Hz
- WebSocket Ping: alle 30s (Keep-Alive)

## Troubleshooting

### Remote funktioniert nicht
1. WebSocket-Server läuft? `systemctl status boatos-remote`
2. Port 8080 erreichbar? `curl http://192.168.2.222:8080/health`
3. uinput verfügbar? `ls -la /dev/uinput`

### Touch ungenau
1. Koordinaten-Mapping prüfen
2. Display-Auflösung korrekt?
3. Tablet-Orientation gesperrt?

### Connection Drops
1. WiFi-Signal prüfen
2. WebSocket-Timeout erhöhen
3. Auto-Reconnect aktiviert?

## Zukünftige Erweiterungen

1. **Mehrere Clients**: Mehrere Tablets gleichzeitig
2. **Bluetooth-Modus**: BT statt WiFi für geringere Latenz
3. **Voice Control**: Sprachsteuerung über Tablet
4. **PWA**: Installierbare Progressive Web App
5. **Offline-Modus**: Cached Karten im Helm-Modus

## Dateien

```
BoatOS/
├── backend/
│   ├── remote_control_server.py    # WebSocket Server
│   ├── virtual_input.py            # Virtual Input Handler
│   └── requirements.txt            # Python Dependencies
├── frontend/
│   ├── remote.html                 # Remote Control UI
│   ├── remote.css                  # Styling
│   └── remote.js                   # Touch Handling & WebSocket
├── deploy/
│   ├── boatos-remote.service       # Systemd Service
│   └── nginx-remote.conf           # nginx Config Snippet
└── REMOTE_CONTROL.md               # Diese Datei
```

## Entwicklungs-Workflow

1. Lokal entwickeln in `BoatOS/`
2. Testen mit Python local server
3. Deploy auf Pi:
   ```bash
   scp -i ~/.ssh/id_rsa_boatos -r backend/ arielle@192.168.2.222:~/BoatOS/
   scp -i ~/.ssh/id_rsa_boatos -r frontend/remote.* arielle@192.168.2.222:~/BoatOS/frontend/
   ```
4. Service neu starten:
   ```bash
   ssh -i ~/.ssh/id_rsa_boatos arielle@192.168.2.222 'sudo systemctl restart boatos-remote'
   ```

## Status

- [x] Konzept erstellt
- [ ] Backend entwickelt
- [ ] Frontend entwickelt
- [ ] Integration abgeschlossen
- [ ] Deployed und getestet
