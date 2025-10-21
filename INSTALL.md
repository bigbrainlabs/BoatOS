# BoatOS Installation Guide

## 🚀 Schnellstart (Empfohlen)

Für eine vollautomatische Installation mit allen Features:

```bash
cd /home/$(whoami)
git clone https://github.com/yourusername/BoatOS.git
cd BoatOS
chmod +x install.sh
./install.sh
```

Das Installations-Skript richtet automatisch ein:
- ✅ SignalK Server (GPS/NMEA Integration)
- ✅ MQTT Broker (Mosquitto für Sensordaten)
- ✅ BoatOS Backend (FastAPI mit allen Services)
- ✅ Nginx Reverse Proxy mit SSL
- ✅ OSRM Waterway Routing (ARM64)
- ✅ Alle Datenverzeichnisse (Logbook, Charts, Crew, etc.)

**Nach der Installation:** Abmelden und wieder anmelden (für dialout-Gruppe).

---

## Systemanforderungen

- **Betriebssystem**: Debian/Ubuntu basiert (getestet auf Debian 12 Bookworm)
- **Hardware**: Raspberry Pi 4/5 oder vergleichbar (min. 2GB RAM, 4GB empfohlen)
- **Speicher**: Min. 16GB SD-Karte (32GB empfohlen für Karten-Cache)
- **GPS**: USB GPS-Empfänger (z.B. U-blox, wird als /dev/ttyACM* erkannt)
- **Netzwerk**: WiFi oder Ethernet
- **Optional**: Touchscreen (7" oder größer für optimale Bedienung)

## Abhängigkeiten

> **Hinweis:** Bei Verwendung des `install.sh` Skripts werden alle Abhängigkeiten automatisch installiert.

### 1. System-Pakete installieren

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx git curl \
  gdal-bin python3-gdal openssl mosquitto mosquitto-clients sqlite3
```

Installierte Komponenten:
- **Python 3.9+**: Backend Runtime
- **Nginx**: Webserver & Reverse Proxy
- **GDAL**: Geospatial Data Abstraction Library (für Kartenkonvertierung)
- **Mosquitto**: MQTT Broker für Sensordaten
- **SQLite3**: Datenbank für Schleusen, Logbook, etc.
- **OpenSSL**: SSL-Zertifikate

### 2. Node.js für SignalK installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. SignalK Server installieren

SignalK ist ein Open-Source Marine Data Server, der GPS und andere Sensordaten verwaltet.

```bash
# SignalK als normaler Benutzer installieren
sudo npm install -g --unsafe-perm signalk-server

# SignalK Service erstellen
sudo tee /etc/systemd/system/signalk.service > /dev/null << 'SIGNALK'
[Unit]
Description=SignalK Server
After=network.target

[Service]
Type=simple
User=
WorkingDirectory=/home/
ExecStart=/usr/bin/signalk-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SIGNALK

# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable signalk
sudo systemctl start signalk
```

SignalK läuft standardmäßig auf Port 3000: http://localhost:3000

### 4. SignalK GPS-Verbindung konfigurieren

Nach der Installation muss SignalK mit dem GPS-Modul verbunden werden:

1. GPS-Device identifizieren:
   ```bash
   ls -la /dev/ttyACM*
   ```

2. Benutzer zur dialout-Gruppe hinzufügen:
   ```bash
   sudo usermod -a -G dialout 
   ```

3. SignalK Konfiguration bearbeiten (`~/.signalk/settings.json`):
   ```json
   {
     interfaces: {},
     ssl: false,
     pipedProviders: [
       {
         id: gps,
         pipeElements: [
           {
             type: providers/simple,
             options: {
               type: NMEA0183,
               subOptions: {
                 type: serial,
                 device: /dev/ttyACM1,
                 baudrate: 9600
               },
               logging: false,
               providerId: gps,
               suppress0183event: false
             }
           }
         ],
         enabled: true
       }
     ],
     security: {
       strategy: ./tokensecurity
     }
   }
   ```

4. SignalK neu starten:
   ```bash
   sudo systemctl restart signalk
   ```

## BoatOS Installation

### 1. Repository klonen

```bash
cd /home/
git clone https://github.com/yourusername/BoatOS.git
cd BoatOS
```

### 2. Backend einrichten

```bash
cd backend

# Python Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate

# Abhängigkeiten installieren
pip install -r requirements.txt
```

**requirements.txt** sollte enthalten:
```
fastapi==0.118.0
uvicorn[standard]==0.37.0
paho-mqtt==2.1.0
httpx==0.28.1
pynmea2==1.19.0
beautifulsoup4==4.14.2
lxml
pyproj
aiohttp==3.10.11
requests==2.32.5
python-multipart==0.0.20
networkx==3.2.1
pyroutelib3>=2.0.0
reportlab>=4.0.0
websockets>=12.0
```

**Was diese Pakete bieten:**
- **FastAPI/Uvicorn**: Modernes async Web-Framework
- **paho-mqtt**: MQTT Client für Sensordaten
- **httpx/aiohttp/requests**: HTTP Clients für APIs (SignalK, Weather, etc.)
- **pynmea2**: NMEA GPS-Daten Parser
- **beautifulsoup4/lxml**: Web Scraping (ELWIS Charts, etc.)
- **pyproj**: Koordinaten-Transformationen
- **networkx/pyroutelib3**: Routing-Algorithmen
- **reportlab**: PDF Generation (Logbook Export)
- **websockets**: AIS Stream WebSocket Client

### 3. BoatOS Systemd Service erstellen

```bash
sudo tee /etc/systemd/system/boatos.service > /dev/null << 'BOATOS'
[Unit]
Description=BoatOS Backend API
After=network.target signalk.service
Requires=signalk.service

[Service]
Type=simple
User=
WorkingDirectory=/home//BoatOS/backend
ExecStart=/home//BoatOS/backend/venv/bin/python app/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
BOATOS

# Platzhalter ersetzen
sudo sed -i s/$USER//g /etc/systemd/system/boatos.service

# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable boatos
sudo systemctl start boatos
```

### 4. Nginx für Frontend konfigurieren

```bash
sudo tee /etc/nginx/sites-available/boatos > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        root /home//BoatOS/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
    }

    # SignalK Proxy (optional)
    location /signalk/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
NGINX

# Platzhalter ersetzen
sudo sed -i s/$USER//g /etc/nginx/sites-available/boatos

# Site aktivieren
sudo ln -sf /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx neu starten
sudo nginx -t
sudo systemctl restart nginx
```

## Konfiguration

### Backend Konfiguration

Die wichtigsten Einstellungen in `backend/app/main.py`:

- **SignalK URL**: Standardmäßig `http://localhost:3000`
- **MQTT Server**: Falls gewünscht für externe Sensoren
- **OpenWeatherMap API Key**: Für Wetterdaten

### Frontend Konfiguration

Die Frontend-Dateien in `frontend/`:
- `index.html` - Haupt-UI
- `app.js` - Hauptlogik
- `i18n.js` - Übersetzungen (DE/EN)
- `style.css` - Styling

## Dienste verwalten

```bash
# Status prüfen
sudo systemctl status signalk
sudo systemctl status boatos
sudo systemctl status nginx

# Logs anzeigen
sudo journalctl -u signalk -f
sudo journalctl -u boatos -f

# Dienste neu starten
sudo systemctl restart signalk
sudo systemctl restart boatos
sudo systemctl restart nginx
```

## Zugriff

Nach erfolgreicher Installation:

- **BoatOS UI**: https://your-pi-ip/ (mit SSL)
- **SignalK Dashboard**: http://your-pi-ip:3000/
- **Backend API**: http://your-pi-ip/api/sensors
- **MQTT Broker**: mqtt://your-pi-ip:1883/

## Features & Module

Nach der Installation sind folgende Features verfügbar:

### 🎨 Dashboard & UI
- **Drag & Drop Editor**: Visueller Dashboard-Builder mit SortableJS
- **Touch-optimiert**: Gestensteuerung für Tablets/Smartphones
- **Undo/Redo**: Vollständige History (Strg+Z)
- **Responsive**: Automatische Anpassung an Bildschirmgröße

### 🧭 Navigation
- **GPS Tracking**: Live-Position via SignalK
- **AIS Integration**: Schiffsverfolgung (AISStream WebSocket)
- **Waterway Routing**: Elbe, Kanäle mit OSRM + PyRouteLib3
- **Offline Maps**: OpenStreetMap + ELWIS ENC Charts

### 📊 Sensoren & Daten
- **MQTT Broker**: Mosquitto für beliebige Sensoren
- **SignalK Integration**: NMEA0183/NMEA2000 Daten
- **Dynamic Topics**: Auto-Discovery von MQTT Topics
- **Sensor Dashboard**: Live-Visualisierung

### 📖 Logbuch & Management
- **Digitales Logbuch**: Automatische Trip-Aufzeichnung
- **PDF Export**: Professionelle Reports (ReportLab)
- **Crew Management**: Personen, Rollen, Zertifikate
- **Fuel Tracking**: Tankungen, Verbrauch, Statistiken

### 🌊 Marine Data
- **Pegel Online**: Echtzeit-Wasserstände (WSV API)
- **Schleusen-Datenbank**: Öffnungszeiten, Dimensionen (SQLite)
- **Wetter-Warnungen**: DWD Alerts via BrightSky API
- **Strömungsdaten**: Water Current Service

### 📦 Datenverzeichnisse
- `data/charts/` - Offline Seekarten (MBTiles, GeoJSON)
- `data/layouts/` - Dashboard-Konfigurationen
- `data/logbook/` - Trip-Daten & Sessions
- `data/crew/` - Crew-Member Informationen
- `data/fuel/` - Tankungen & Statistiken
- `data/locks/` - Schleusen-Datenbank (SQLite)
- `data/osrm/` - Routing-Engine Daten

## Fehlerbehebung

### GPS wird nicht erkannt

```bash
# GPS Device prüfen
ls -la /dev/ttyACM*
dmesg | grep -i gps

# Direkt vom GPS lesen (Strg+C zum Beenden)
cat /dev/ttyACM1

# Benutzerrechte prüfen
groups   # sollte dialout enthalten

# Falls nicht, hinzufügen und neu anmelden:
sudo usermod -a -G dialout 
```

### SignalK empfängt keine GPS-Daten

```bash
# SignalK Logs prüfen
sudo journalctl -u signalk -n 50

# SignalK API testen
curl http://localhost:3000/signalk/v1/api/
```

### BoatOS zeigt keine GPS-Daten

```bash
# Backend Logs prüfen
sudo journalctl -u boatos -n 50

# API testen
curl http://localhost:8000/api/sensors
```

### MQTT Broker funktioniert nicht

```bash
# Mosquitto Status prüfen
sudo systemctl status mosquitto

# Mosquitto Logs
sudo journalctl -u mosquitto -n 50

# MQTT Topics live überwachen
mosquitto_sub -h localhost -t '#' -v

# Test-Nachricht senden
mosquitto_pub -h localhost -t 'test/topic' -m 'Hello MQTT'
```

### Dashboard wird nicht geladen / alte Version

```bash
# Browser-Cache leeren
# Chrome/Firefox: Strg+Shift+R oder Strg+F5

# Nginx Cache leeren
sudo rm -rf /var/cache/nginx/*
sudo systemctl restart nginx

# BoatOS neu starten
sudo systemctl restart boatos
```

## Updates

### Automatisches Update (Empfohlen)

```bash
cd /home/$(whoami)/BoatOS
./scripts/update.sh
```

Das Update-Skript:
- Pullt neueste Änderungen von Git
- Aktualisiert Python Dependencies
- Updated Frontend Cache Busting
- Startet alle Services neu
- Prüft Service-Status

### Manuelles Update

```bash
cd /home/$(whoami)/BoatOS
git pull

# Backend Dependencies aktualisieren
cd backend
source venv/bin/activate
pip install --upgrade -r requirements.txt

# Services neu starten
sudo systemctl restart boatos
sudo systemctl restart nginx

# Browser-Cache leeren: Strg+Shift+R
```

## Deinstallation

```bash
# Services stoppen und deaktivieren
sudo systemctl stop boatos signalk mosquitto osrm 2>/dev/null
sudo systemctl disable boatos signalk osrm 2>/dev/null

# Service-Dateien entfernen
sudo rm -f /etc/systemd/system/boatos.service
sudo rm -f /etc/systemd/system/signalk.service
sudo rm -f /etc/systemd/system/osrm.service
sudo systemctl daemon-reload

# Nginx-Konfiguration entfernen
sudo rm -f /etc/nginx/sites-enabled/boatos
sudo rm -f /etc/nginx/sites-available/boatos
sudo systemctl restart nginx

# BoatOS Dateien entfernen
rm -rf /home/$(whoami)/BoatOS
rm -rf /home/$(whoami)/.signalk
rm -rf /home/$(whoami)/osrm_regions
rm -rf /home/$(whoami)/osrm-backend

# Optional: Mosquitto deinstallieren (falls nicht anderweitig genutzt)
# sudo apt remove --purge mosquitto mosquitto-clients

# Optional: SignalK deinstallieren
# sudo npm uninstall -g signalk-server
```

---

## 📚 Weitere Ressourcen

- **GitHub Repository**: https://github.com/yourusername/BoatOS
- **Issues & Support**: https://github.com/yourusername/BoatOS/issues
- **SignalK Dokumentation**: https://signalk.org/
- **MQTT/Mosquitto**: https://mosquitto.org/
- **OSRM Routing**: http://project-osrm.org/
- **Leaflet Maps**: https://leafletjs.com/

## 🤝 Beitragen

Contributions sind willkommen! Siehe [CONTRIBUTING.md](CONTRIBUTING.md) für Details.

## 📄 Lizenz

MIT License - Siehe [LICENSE](LICENSE) für Details.
