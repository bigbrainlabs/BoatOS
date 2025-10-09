# BoatOS

Ein modernes Marine-Navigationssystem für Raspberry Pi mit GPS, Kartendarstellung und Wetterdaten.

![BoatOS](https://via.placeholder.com/800x400?text=BoatOS)

## Features

- 🗺️ **Interaktive Seekarten** mit OpenSeaMap und anderen Kartenebenen
- 📡 **GPS-Integration** über SignalK Server
- 🌦️ **Wetter-Informationen** mit Vorhersage
- 🛤️ **Routen-Planung** und Wegpunkte
- 📓 **Logbuch** mit Track-Aufzeichnung
- 🌍 **Mehrsprachig** (Deutsch/English)
- 📊 **Sensor-Dashboard** für Geschwindigkeit, Kurs, Tiefe
- 🔄 **Echtzeit-Updates** via WebSocket
- 📱 **Responsive Design** für Desktop und Mobile

## Technologie-Stack

### Backend
- **FastAPI** - Moderne Python API
- **SignalK** - Marine Data Server für GPS und Sensoren
- **MQTT** - Für externe Sensor-Anbindung
- **httpx** - Async HTTP Client

### Frontend
- **Leaflet.js** - Interaktive Karten
- **Vanilla JavaScript** - Keine Frameworks, schnell und effizient
- **WebSocket** - Echtzeit-Datenübertragung
- **CSS Grid/Flexbox** - Modernes Responsive Layout

### Datenquellen
- **OpenSeaMap** - Nautische Karten
- **OpenStreetMap** - Basiskarten
- **OpenWeatherMap** - Wetterdaten
- **SignalK** - GPS und Sensordaten

## Systemanforderungen

- Raspberry Pi 4 oder höher (min. 2GB RAM)
- Debian/Ubuntu basiertes OS
- USB GPS-Empfänger
- Internet-Verbindung für Karten und Wetter

## Schnellstart

1. Repository klonen:
   ```bash
   git clone https://github.com/yourusername/BoatOS.git
   cd BoatOS
   ```

2. Installations-Skript ausführen:
   ```bash
   ./install.sh
   ```

3. GPS konfigurieren (siehe INSTALL.md)

4. System neu starten oder abmelden/anmelden

5. Browser öffnen: http://your-pi-ip/

Detaillierte Anleitung: [INSTALL.md](INSTALL.md)

## Architektur

```
┌─────────────────────────────────────────┐
│           Nginx (Port 80)               │
│  ┌──────────┐  ┌──────────┐            │
│  │ Frontend │  │ SignalK  │            │
│  │   HTML   │  │  Proxy   │            │
│  └────┬─────┘  └────┬─────┘            │
└───────┼────────────┼──────────────────┘
        │            │
        ▼            ▼
┌─────────────┐  ┌──────────────────┐
│   BoatOS    │  │ SignalK Server   │
│   Backend   │◄─┤  (Port 3000)     │
│  (Port 8000)│  │                  │
└──────┬──────┘  └────────┬─────────┘
       │                  │
       ▼                  ▼
  ┌─────────┐      ┌──────────────┐
  │  MQTT   │      │  GPS Module  │
  │ Sensors │      │  /dev/ttyACM*│
  └─────────┘      └──────────────┘
```

## Verzeichnisstruktur

```
BoatOS/
├── backend/              # FastAPI Backend
│   ├── app/
│   │   ├── main.py      # Haupt-API
│   │   └── gps_service.py
│   ├── requirements.txt
│   └── venv/
├── frontend/            # Web-Frontend
│   ├── index.html      # Haupt-UI
│   ├── app.js          # Hauptlogik
│   ├── i18n.js         # Übersetzungen
│   ├── style.css       # Styling
│   └── assets/
├── data/               # Daten (Wegpunkte, Routen, etc.)
├── INSTALL.md          # Installations-Anleitung
├── README.md           # Diese Datei
└── install.sh          # Installations-Skript
```

## Konfiguration

### Backend (backend/app/main.py)
- SignalK URL
- OpenWeatherMap API Key
- MQTT Broker Einstellungen

### Frontend (frontend/app.js)
- Karten-Ebenen
- Standardposition
- API-Endpoints

## API Dokumentation

Nach der Installation verfügbar unter: http://your-pi-ip/docs

Wichtige Endpoints:
- `GET /api/sensors` - Alle Sensordaten (GPS, Speed, Depth, etc.)
- `GET /api/gps` - GPS-Daten
- `GET /api/weather` - Wetterdaten
- `GET /api/waypoints` - Wegpunkte
- `POST /api/waypoints` - Wegpunkt hinzufügen
- `WS /ws` - WebSocket für Echtzeit-Updates

## Entwicklung

### Backend entwickeln

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0
```

### Frontend entwickeln

Einfach die Dateien in `frontend/` bearbeiten und im Browser neu laden.

## Troubleshooting

Siehe [INSTALL.md](INSTALL.md#fehlerbehebung)

## Roadmap

- [ ] AIS-Integration
- [ ] Anker-Alarm
- [ ] Tide-Vorhersagen
- [ ] Offline-Karten
- [ ] Mobile App
- [ ] Autopilot-Integration

## Lizenz

MIT License - siehe LICENSE Datei

## Beiträge

Pull Requests sind willkommen! Für größere Änderungen bitte zuerst ein Issue öffnen.

## Autoren

- Entwickelt mit Unterstützung von Claude Code (Anthropic)

## Danksagungen

- SignalK Community
- OpenSeaMap Projekt
- Leaflet.js Entwickler
- FastAPI Framework
