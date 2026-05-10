# BoatOS — Installationsanleitung

## Überblick

BoatOS besteht aus mehreren Komponenten, die auf einem Raspberry Pi 4 zusammenarbeiten:

| Komponente | Port | Beschreibung |
|---|---|---|
| BoatOS Backend | 8000 | FastAPI, REST API + WebSocket |
| Martin Tile Server | 8081 | Lokale Vektorkacheln (Offline-Karten) |
| OSRM Routing | 5000 | Wasserweg-Routing (IPv4-only) |
| SignalK Server | 3000 | GPS / NMEA-Integration |
| Mosquitto MQTT | 1883 | Sensordaten-Broker |
| Nginx | 80/443 | Reverse Proxy für Deck Web-Frontend |

---

## Systemanforderungen

- **Hardware**: Raspberry Pi 4 (min. 2 GB RAM, 4 GB empfohlen)
- **OS**: Raspberry Pi OS Bookworm 64-bit (`aarch64`)
- **Speicher**: Min. 32 GB SD-Karte (Karten + OSRM-Daten benötigen ~15 GB)
- **GPS**: USB-Empfänger (z. B. BU-353N5 → `/dev/ttyUSB0`, 4800 baud)
- **Touchscreen**: z. B. QDtech MPI1001 10.1" (1280×800)

---

## 1. System-Pakete

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y \
  python3 python3-pip python3-venv \
  nginx git curl mosquitto mosquitto-clients \
  sqlite3 openssl \
  gdal-bin python3-gdal
```

Benutzer zur `dialout`-Gruppe hinzufügen (für GPS-Zugriff):
```bash
sudo usermod -a -G dialout $USER
# Abmelden und neu anmelden
```

---

## 2. Node.js & SignalK

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# SignalK Server
sudo npm install -g --unsafe-perm signalk-server
```

### SignalK Systemd-Service

```bash
sudo tee /etc/systemd/system/signalk.service > /dev/null << EOF
[Unit]
Description=SignalK Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME
ExecStart=/usr/bin/signalk-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable signalk
sudo systemctl start signalk
```

### GPS in SignalK konfigurieren

GPS-Device identifizieren:
```bash
ls -la /dev/ttyUSB* /dev/ttyACM*
```

SignalK-Konfiguration (`~/.signalk/settings.json`) — Beispiel für BU-353N5:
```json
{
  "pipedProviders": [
    {
      "id": "gps-usb",
      "pipeElements": [
        {
          "type": "providers/simple",
          "options": {
            "type": "NMEA0183",
            "subOptions": {
              "type": "serial",
              "device": "/dev/ttyUSB0",
              "baudrate": 4800
            }
          }
        }
      ],
      "enabled": true
    }
  ]
}
```

> **Hinweis**: Bei alten GPS-Mäusen (cdc_acm-Treiber) lautet das Device `/dev/ttyACM0` mit 9600 baud. Das BU-353N5 nutzt `/dev/ttyUSB0` mit 4800 baud.

GPS-Verbindung testen:
```bash
sudo systemctl restart signalk
curl http://localhost:3000/signalk/v1/api/vessels/self/navigation/position
```

---

## 3. BoatOS Repository

```bash
cd $HOME
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS
```

### Python-Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Backend Systemd-Service

```bash
sudo tee /etc/systemd/system/boatos.service > /dev/null << EOF
[Unit]
Description=BoatOS Backend API
After=network.target signalk.service mosquitto.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/BoatOS/backend
ExecStart=$HOME/BoatOS/backend/venv/bin/python app/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable boatos
sudo systemctl start boatos
```

Status prüfen:
```bash
sudo systemctl status boatos
curl http://localhost:8000/api/sensors/list
```

---

## 4. Martin Tile Server (Offline-Karten)

Martin stellt lokale Vektorkacheln aus MBTiles-Dateien bereit.

### Installation

```bash
# Aktuelles Release von https://github.com/maplibre/martin/releases
wget https://github.com/maplibre/martin/releases/latest/download/martin-aarch64-unknown-linux-musl.tar.gz
tar -xzf martin-aarch64-unknown-linux-musl.tar.gz
sudo mv martin /usr/local/bin/
```

### Karten-Dateien

BoatOS erwartet MBTiles-Dateien unter `$HOME/BoatOS/maps/`:
```
maps/
├── germany.mbtiles       # Deutschland (OpenMapTiles-Format)
├── waterways.mbtiles     # Optional: Wasserstraßen-Detail
└── ...
```

MBTiles beziehen (z. B. von [OpenMapTiles](https://openmaptiles.org/) oder [Protomaps](https://protomaps.com/)):
```bash
mkdir -p $HOME/BoatOS/maps
# MBTiles-Datei(en) hierhin kopieren
```

### Martin Systemd-Service

```bash
sudo tee /etc/systemd/system/tileserver.service > /dev/null << EOF
[Unit]
Description=Martin Vector Tile Server
After=network.target

[Service]
Type=simple
User=$USER
ExecStart=/usr/local/bin/martin --listen-addresses 0.0.0.0:8081 $HOME/BoatOS/maps/
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable tileserver
sudo systemctl start tileserver
```

Test:
```bash
curl http://localhost:8081/catalog
```

---

## 5. OSRM Routing Server

OSRM berechnet Wasserweg-Routen (Binnenschifffahrt). Läuft **IPv4-only** — kein `localhost`, immer `127.0.0.1`.

### Vorkompilierte Binaries

Für ARM64 (Pi 4) empfiehlt sich ein vorkompiliertes Binary oder Docker:

```bash
# Option A: Docker (einfacher)
docker run -t -i -p 5000:5000 -v $HOME/BoatOS/maps:/data \
  ghcr.io/project-osrm/osrm-backend \
  osrm-routed --algorithm mld /data/waterways.osrm

# Option B: Vorkompilierte Binary
# Siehe: https://github.com/Project-OSRM/osrm-backend/releases
```

### OSRM-Daten vorbereiten

```bash
# OSM-Daten für Wasserstraßen extrahieren (auf leistungsfähigerem Rechner empfohlen)
osrm-extract -p profiles/waterway.lua waterways.osm.pbf
osrm-partition waterways.osrm
osrm-customize waterways.osrm
```

Test:
```bash
curl "http://127.0.0.1:5000/route/v1/driving/12.046,51.855;12.1,51.9"
```

> **Wichtig**: In `backend/app/main.py` und Settings immer `http://127.0.0.1:5000` verwenden — Python löst `localhost` auf IPv6 auf, OSRM hört nur auf IPv4.

---

## 6. Deck — Web-Frontend (Nginx)

Das Web-Frontend wird über Nginx mit selbst-signiertem SSL-Zertifikat ausgeliefert.

### SSL-Zertifikat erstellen

```bash
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/boatos.key \
  -out /etc/nginx/ssl/boatos.crt \
  -subj "/CN=boatos.local"
```

### Nginx-Konfiguration

```bash
sudo tee /etc/nginx/sites-available/boatos > /dev/null << EOF
server {
    listen 80;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    ssl_certificate     /etc/nginx/ssl/boatos.crt;
    ssl_certificate_key /etc/nginx/ssl/boatos.key;

    # Frontend-Dateien
    location / {
        root $HOME/BoatOS/frontend;
        index index.html;
        add_header Cache-Control "no-store, no-cache";
    }

    # JS/CSS mit kurzem Cache
    location ~* \.(js|css)$ {
        root $HOME/BoatOS/frontend;
        add_header Cache-Control "public, max-age=3600";
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_read_timeout 60s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_read_timeout 3600s;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

Deck öffnen: `https://<pi-ip>/`

---

## 7. Helm — Flutter-App (flutter-pi)

Die native Flutter-App läuft über flutter-pi direkt auf dem Pi-Framebuffer (kein X11/Wayland nötig).

### flutter-pi installieren

```bash
# Abhängigkeiten
sudo apt install -y libgl1-mesa-dev libgles2-mesa-dev libegl1-mesa-dev \
  libdrm-dev libgbm-dev libinput-dev libudev-dev libsystemd-dev \
  libxkbcommon-dev

# flutter-pi bauen (oder vorkompiliertes Binary nutzen)
git clone https://github.com/ardera/flutter-pi.git
cd flutter-pi
mkdir build && cd build
cmake .. && make -j$(nproc)
sudo make install
```

### Flutter-App deployen

Der Build erfolgt auf dem Entwicklungs-PC (Flutter SDK + flutterpi_tool erforderlich):

```bash
# Auf dem Entwicklungs-PC:
cd flutter_app
dart pub global activate flutterpi_tool
flutterpi_tool build --arch=arm64 --cpu=pi4 --release

# Deploy auf den Pi:
scp build/flutter-pi/pi4-64/app.so user@<pi-ip>:/home/<user>/BoatOS/flutter_app/app.so
scp -r build/flutter-pi/pi4-64/assets user@<pi-ip>:/home/<user>/BoatOS/flutter_app/
```

### Kiosk via lightdm einrichten

```bash
sudo apt install -y lightdm

# Autologin konfigurieren
sudo tee /etc/lightdm/lightdm.conf > /dev/null << EOF
[SeatDefaults]
autologin-user=$USER
autologin-user-timeout=0
user-session=flutter-pi-session
EOF
```

Starter-Script erstellen:
```bash
mkdir -p $HOME/BoatOS/flutter_app

tee $HOME/start-boatos-flutter.sh > /dev/null << EOF
#!/bin/bash
cd $HOME/BoatOS/flutter_app
exec flutter-pi \
  --release \
  --input /dev/input/event0 \
  .
EOF
chmod +x $HOME/start-boatos-flutter.sh
```

> Nach Deployment: `sudo systemctl restart lightdm`

### Karten-Cache leeren (nach Updates)

```bash
rm -rf /tmp/.vector_map_cache 2>/dev/null || true
```

---

## 8. Einstellungen & API-Keys

### AIS (optional)

1. Account bei [AISStream.io](https://aisstream.io/) erstellen (kostenlos)
2. API Key in BoatOS-Einstellungen eintragen (Settings → AIS)

### Wetter (optional)

DWD-Warnungen funktionieren ohne Key. Für erweiterte Wetterdaten:
- Settings → Wetter → API Key eintragen

### Dashboard-Layout

Das Dashboard-Layout wird in den Settings als DSL-Text gespeichert. Beispiel:

```
GRID 4

ROW sensoren
GAUGE boot/sensoren/motor/drehzahl MAX 6000 UNIT "RPM" DECIMALS 0
GAUGE boot/sensoren/motor/oeldruck MAX 7 UNIT "Bar" STYLE bar DECIMALS 2
SENSOR boot/sensoren/batterie STYLE hero
SENSOR boot/sensoren/tank/diesel SIZE 2
```

Dokumentation: [DASHBOARD_DSL.md](DASHBOARD_DSL.md)

---

## Dienste verwalten

```bash
# Status aller Dienste
sudo systemctl status boatos tileserver signalk mosquitto nginx

# Logs verfolgen
sudo journalctl -u boatos -f
sudo journalctl -u tileserver -f
sudo journalctl -u signalk -f

# Alle Dienste neu starten
sudo systemctl restart boatos tileserver signalk
```

---

## Updates

```bash
cd $HOME/BoatOS
git pull

# Backend-Dependencies aktualisieren
cd backend
source venv/bin/activate
pip install --upgrade -r requirements.txt
cd ..

# Services neu starten
sudo systemctl restart boatos

# Helm: neuen Build deployen (auf Entwicklungs-PC)
# → scp + sudo systemctl restart lightdm
```

---

## Fehlerbehebung

### GPS keine Daten

```bash
ls -la /dev/ttyUSB* /dev/ttyACM*
groups                          # muss dialout enthalten
sudo systemctl status signalk
sudo journalctl -u signalk -n 30
curl http://localhost:3000/signalk/v1/api/vessels/self/navigation/position
```

### MQTT Sensoren erscheinen nicht

```bash
sudo systemctl status mosquitto
mosquitto_sub -h localhost -t '#' -v        # Topics live beobachten
curl http://localhost:8000/api/mqtt/topics  # Backend-Sicht
sudo systemctl restart boatos               # MQTT-Client neu verbinden
```

### Karten laden nicht

```bash
sudo systemctl status tileserver
curl http://localhost:8081/catalog
ls -lh $HOME/BoatOS/maps/*.mbtiles
```

### Routing funktioniert nicht

```bash
# OSRM hört nur auf IPv4!
curl "http://127.0.0.1:5000/route/v1/driving/12.046,51.855;12.1,51.9"
# NICHT: curl "http://localhost:5000/..."
```

### Helm startet nicht

```bash
sudo systemctl status lightdm
sudo journalctl -u lightdm -n 50
ls -la $HOME/BoatOS/flutter_app/app.so    # Binary vorhanden?
```

### Backend startet nicht

```bash
sudo journalctl -u boatos -n 50
# Manuell starten zum Debuggen:
cd $HOME/BoatOS/backend
source venv/bin/activate
python app/main.py
```

---

## Ressourcen

- **GitHub**: https://github.com/bigbrainlabs/BoatOS
- **Issues**: https://github.com/bigbrainlabs/BoatOS/issues
- **SignalK**: https://signalk.org/
- **flutter-pi**: https://github.com/ardera/flutter-pi
- **Martin Tileserver**: https://martin.maplibre.org/
- **OSRM**: https://project-osrm.org/
- **AISStream**: https://aisstream.io/
