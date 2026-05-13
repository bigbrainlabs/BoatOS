#!/bin/bash
set -e

echo "BoatOS Installation Script"
echo "=========================="
echo ""

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

error()   { echo -e "${RED}Fehler: $1${NC}"; exit 1; }
success() { echo -e "${GREEN}OK: $1${NC}"; }
info()    { echo -e "${YELLOW}Info: $1${NC}"; }

[ "$EUID" -eq 0 ] && error "Bitte fuehre dieses Skript NICHT als root aus!"

INSTALL_USER=$(whoami)
INSTALL_DIR="/home/$INSTALL_USER/BoatOS"

echo "Benutzer:  $INSTALL_USER"
echo "Verzeichnis: $INSTALL_DIR"
echo ""

[ -d "$INSTALL_DIR" ] || error "BoatOS-Verzeichnis nicht gefunden: $INSTALL_DIR"

# ── 1. System-Pakete ────────────────────────────────────────────────────────
info "Installiere System-Pakete..."
sudo apt update
sudo apt install -y \
  python3 python3-pip python3-venv \
  nginx git curl \
  mosquitto mosquitto-clients \
  sqlite3 openssl \
  gdal-bin python3-gdal \
  || error "System-Pakete konnten nicht installiert werden"
success "System-Pakete installiert"

# ── 2. Benutzergruppen ──────────────────────────────────────────────────────
info "Fuege $INSTALL_USER zur dialout-Gruppe hinzu (GPS-Zugriff)..."
sudo usermod -a -G dialout "$INSTALL_USER"
success "Benutzer zur dialout-Gruppe hinzugefuegt"

# ── 3. Node.js & SignalK ───────────────────────────────────────────────────
info "Installiere Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs || error "Node.js Installation fehlgeschlagen"
fi
success "Node.js: $(node --version)"

info "Installiere SignalK Server..."
if ! command -v signalk-server &> /dev/null; then
    sudo npm install -g --unsafe-perm signalk-server || error "SignalK Installation fehlgeschlagen"
fi
success "SignalK installiert"

info "Erstelle SignalK Service..."
sudo tee /etc/systemd/system/signalk.service > /dev/null << SIGNALK
[Unit]
Description=SignalK Server
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=/home/$INSTALL_USER
ExecStart=/usr/bin/signalk-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SIGNALK

sudo systemctl daemon-reload
sudo systemctl enable signalk
success "SignalK Service erstellt"

# ── 4. MQTT Broker ─────────────────────────────────────────────────────────
info "Konfiguriere Mosquitto MQTT Broker..."
sudo tee /etc/mosquitto/conf.d/boatos.conf > /dev/null << MQTT
listener 1883
allow_anonymous true
MQTT

sudo systemctl enable mosquitto
sudo systemctl restart mosquitto
success "Mosquitto MQTT konfiguriert und gestartet"

# ── 5. Python Backend ──────────────────────────────────────────────────────
info "Richte Python Backend ein..."
cd "$INSTALL_DIR/backend"
if [ ! -d "venv" ]; then
    # --system-site-packages fuer GDAL Python-Bindings benoetigt
    python3 -m venv --system-site-packages venv || error "venv konnte nicht erstellt werden"
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt || error "Python-Abhaengigkeiten konnten nicht installiert werden"
success "Backend eingerichtet"

# ── 6. Datenverzeichnisse ──────────────────────────────────────────────────
info "Erstelle Datenverzeichnisse..."
mkdir -p "$INSTALL_DIR/data/charts"
mkdir -p "$INSTALL_DIR/data/enc_downloads"
mkdir -p "$INSTALL_DIR/data/osrm"
mkdir -p "$INSTALL_DIR/data/layouts"
mkdir -p "$INSTALL_DIR/data/logbook"
mkdir -p "$INSTALL_DIR/data/crew"
mkdir -p "$INSTALL_DIR/data/fuel"
mkdir -p "$INSTALL_DIR/data/locks"
mkdir -p "$INSTALL_DIR/maps"
touch "$INSTALL_DIR/data/.gitkeep"
chmod -R 755 "$INSTALL_DIR/data" "$INSTALL_DIR/maps"
success "Datenverzeichnisse erstellt (inkl. maps/ fuer MBTiles)"

# ── 7. .env Konfiguration ──────────────────────────────────────────────────
if [ ! -f "$INSTALL_DIR/.env" ]; then
    info "Erstelle .env Konfigurationsdatei..."
    cp "$INSTALL_DIR/.env.example" "$INSTALL_DIR/.env"
    success ".env erstellt"
else
    info ".env existiert bereits"
fi

# ── 8. BoatOS Backend Service ──────────────────────────────────────────────
info "Erstelle BoatOS Backend Service..."
sudo tee /etc/systemd/system/boatos.service > /dev/null << BOATOS
[Unit]
Description=BoatOS Backend API
After=network.target signalk.service mosquitto.service

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$INSTALL_DIR/backend
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/backend/venv/bin/python app/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
BOATOS

sudo systemctl daemon-reload
sudo systemctl enable boatos
success "BoatOS Backend Service erstellt"

# ── 9. Martin Tile Server ──────────────────────────────────────────────────
info "Installiere Martin Tile Server..."
if ! command -v martin &> /dev/null; then
    MARTIN_URL="https://github.com/maplibre/martin/releases/latest/download/martin-aarch64-unknown-linux-musl.tar.gz"
    cd /tmp
    curl -L "$MARTIN_URL" -o martin.tar.gz || error "Martin Download fehlgeschlagen"
    tar -xzf martin.tar.gz
    sudo mv martin /usr/local/bin/
    rm martin.tar.gz
    success "Martin installiert"
else
    success "Martin bereits installiert"
fi

info "Erstelle Martin Tile Server Service..."
sudo tee /etc/systemd/system/tileserver.service > /dev/null << TILESERVER
[Unit]
Description=Martin Vector Tile Server
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
ExecStart=/usr/local/bin/martin --listen-addresses 0.0.0.0:8081 $INSTALL_DIR/maps/
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
TILESERVER

sudo systemctl daemon-reload
sudo systemctl enable tileserver
success "Martin Tile Server Service erstellt"
info "MBTiles-Dateien nach $INSTALL_DIR/maps/ kopieren, dann: sudo systemctl start tileserver"

# ── 10. OSRM Routing ───────────────────────────────────────────────────────
# OSRM laeuft IPv4-only auf Port 5000 — in Settings immer 127.0.0.1 statt localhost verwenden
if [ "$(uname -m)" = "aarch64" ] && [ -f "$INSTALL_DIR/osrm-binaries/osrm-arm64-binaries.tar.gz" ]; then
    info "Installiere vorkompilierte OSRM ARM64 Binaries..."
    cd /tmp
    tar xzf "$INSTALL_DIR/osrm-binaries/osrm-arm64-binaries.tar.gz"
    sudo mv osrm-routed osrm-extract osrm-partition osrm-customize /usr/local/bin/
    sudo chmod +x /usr/local/bin/osrm-*
    success "OSRM Binaries installiert"

    # Waterway-Profil
    if [ ! -d "$HOME/osrm-backend" ]; then
        info "Clone OSRM Backend fuer Profile..."
        cd "$HOME"
        git clone https://github.com/Project-OSRM/osrm-backend.git || error "OSRM Backend Clone fehlgeschlagen"
    fi
    cp "$INSTALL_DIR/backend/app/waterway_balanced_v2.lua" "$HOME/osrm-backend/profiles/waterway_balanced.lua"
    success "Waterway-Profil kopiert"

    # Daten verarbeiten falls vorhanden
    mkdir -p "$HOME/osrm_regions"
    cd "$HOME/osrm_regions"
    if [ -f "$INSTALL_DIR/data/osrm/germany-waterways.osm.pbf" ]; then
        cp "$INSTALL_DIR/data/osrm/germany-waterways.osm.pbf" .
    fi

    if [ -f "germany-waterways.osm.pbf" ]; then
        info "Verarbeite OSRM-Daten (kann einige Minuten dauern)..."
        osrm-extract -p "$HOME/osrm-backend/profiles/waterway_balanced.lua" germany-waterways.osm.pbf \
            || error "OSRM Extract fehlgeschlagen"
        osrm-partition germany-waterways.osrm || error "OSRM Partition fehlgeschlagen"
        osrm-customize germany-waterways.osrm || error "OSRM Customize fehlgeschlagen"
        cp germany-waterways.osrm* "$INSTALL_DIR/data/osrm/"
        success "OSRM-Daten verarbeitet"
    else
        info "germany-waterways.osm.pbf nicht gefunden — OSRM-Daten manuell vorbereiten (siehe INSTALL.md)"
    fi

    info "Erstelle OSRM Service..."
    sudo tee /etc/systemd/system/osrm.service > /dev/null << OSRM
[Unit]
Description=OSRM Routing Engine
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$INSTALL_DIR/data/osrm
ExecStart=/usr/local/bin/osrm-routed --algorithm=MLD $INSTALL_DIR/data/osrm/germany-waterways.osrm --port 5000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
OSRM

    sudo systemctl daemon-reload
    sudo systemctl enable osrm
    success "OSRM Service erstellt"
else
    info "OSRM: Keine vorkompilierten Binaries gefunden."
    info "       Alternativen: Docker-Image oder offizielles Binary (siehe INSTALL.md Abschnitt 5)."
fi

# ── 11. SSL-Zertifikat ─────────────────────────────────────────────────────
info "Erstelle selbstsigniertes SSL-Zertifikat..."
if [ ! -f "/etc/ssl/certs/boatos-selfsigned.crt" ]; then
    sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/ssl/private/boatos-selfsigned.key \
        -out /etc/ssl/certs/boatos-selfsigned.crt \
        -subj "/C=DE/ST=State/L=City/O=BoatOS/CN=$(hostname -I | awk '{print $1}')" \
        || error "SSL-Zertifikat konnte nicht erstellt werden"
    success "SSL-Zertifikat erstellt"
else
    info "SSL-Zertifikat existiert bereits"
fi

# ── 12. Nginx ──────────────────────────────────────────────────────────────
info "Konfiguriere Nginx..."
sudo tee /etc/nginx/sites-available/boatos > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate /etc/ssl/certs/boatos-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/boatos-selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    client_max_body_size 2G;
    client_body_timeout 300s;
    proxy_read_timeout 300s;

    # Frontend — HTML/JS kein Cache, CSS/Bilder 1h
    location / {
        root /home/INSTALL_USER_PLACEHOLDER/BoatOS/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;

        location ~* \.(html|js)$ {
            add_header Cache-Control "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0";
            add_header Pragma "no-cache";
            add_header Expires "0";
            etag off;
        }

        location ~* \.(jpg|jpeg|png|gif|ico|svg|woff|woff2|ttf|eot|css)$ {
            expires 1h;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 2G;
        client_body_timeout 300s;
        proxy_read_timeout 300s;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 3600s;
    }

    # SignalK Proxy
    location /signalk/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
NGINX

sudo sed -i "s/INSTALL_USER_PLACEHOLDER/$INSTALL_USER/g" /etc/nginx/sites-available/boatos
sudo ln -sf /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t || error "Nginx-Konfiguration fehlerhaft"
success "Nginx konfiguriert"

# ── 13. Services starten ───────────────────────────────────────────────────
info "Starte Services..."
sudo systemctl start mosquitto
sudo systemctl start signalk
sudo systemctl start boatos
sudo systemctl restart nginx
success "Kerndienste gestartet (Mosquitto, SignalK, BoatOS, Nginx)"

# Tileserver nur starten wenn MBTiles vorhanden
if ls "$INSTALL_DIR/maps/"*.mbtiles &> /dev/null; then
    sudo systemctl start tileserver
    success "Martin Tile Server gestartet"
else
    info "Tileserver nicht gestartet — keine MBTiles in $INSTALL_DIR/maps/ gefunden"
fi

# OSRM nur starten wenn Daten vorhanden
if systemctl list-unit-files | grep -q "^osrm.service"; then
    if [ -f "$INSTALL_DIR/data/osrm/germany-waterways.osrm" ]; then
        sudo systemctl start osrm
        success "OSRM Routing gestartet"
    else
        info "OSRM Service erstellt, aber Daten fehlen noch"
        info "Nach Datenvorbereitung starten: sudo systemctl start osrm"
    fi
fi

# ── Abschlussmeldung ───────────────────────────────────────────────────────
echo ""
echo "=========================="
echo -e "${GREEN}BoatOS erfolgreich installiert!${NC}"
echo ""
echo "Zugriff:"
echo "  Deck (Web-Frontend): https://$(hostname -I | awk '{print $1}')/"
echo "  SignalK:             http://$(hostname -I | awk '{print $1}'):3000/"
echo "  Martin Tile Server:  http://$(hostname -I | awk '{print $1}'):8081/catalog"
echo "  MQTT:                mqtt://$(hostname -I | awk '{print $1}'):1883/"
echo ""
echo -e "${YELLOW}Selbstsigniertes SSL-Zertifikat — Browser-Warnung ignorieren${NC}"
echo ""
echo "Naechste Schritte:"
echo "  1. GPS-Device pruefen:     ls -la /dev/ttyUSB* /dev/ttyACM*"
echo "  2. SignalK GPS konfigurieren (~/.signalk/settings.json, siehe INSTALL.md)"
echo "     BU-353N5: /dev/ttyUSB0 @ 4800 baud"
echo "     GPS-Maus: /dev/ttyACM0 @ 9600 baud"
echo "  3. SignalK neu starten:    sudo systemctl restart signalk"
echo "  4. MBTiles nach $INSTALL_DIR/maps/ kopieren"
echo "  5. Tileserver starten:     sudo systemctl start tileserver"
echo ""
echo "Helm (Flutter-App) — Build auf Entwicklungs-PC:"
echo "  flutterpi_tool build --arch=arm64 --cpu=pi4 --release"
echo "  scp build/flutter-pi/pi4-64/app.so $INSTALL_USER@<pi-ip>:$INSTALL_DIR/flutter_app/app.so"
echo "  sudo systemctl restart lightdm"
echo ""
echo "Status pruefen:"
echo "  sudo systemctl status boatos tileserver signalk mosquitto nginx"
echo ""
echo -e "${YELLOW}WICHTIG: Abmelden und neu anmelden damit die dialout-Gruppe wirksam wird!${NC}"
