#!/bin/bash
set -e

echo "🚢 BoatOS Installation Script"
echo "============================="
echo ""

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Funktionen
error() {
    echo -e "${RED}❌ Fehler: $1${NC}"
    exit 1
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Benutzer prüfen
if [ "$EUID" -eq 0 ]; then
   error "Bitte führe dieses Skript NICHT als root aus!"
fi

INSTALL_USER=$(whoami)
INSTALL_DIR="/home/$INSTALL_USER/BoatOS"

echo "Installation als Benutzer: $INSTALL_USER"
echo "Installationsverzeichnis: $INSTALL_DIR"
echo ""

# System-Pakete installieren
info "Installiere System-Pakete..."
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx git curl gdal-bin python3-gdal openssl || error "System-Pakete konnten nicht installiert werden"
success "System-Pakete installiert (inkl. GDAL für Kartenkonvertierung)"

# Node.js für SignalK installieren
info "Installiere Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs || error "Node.js Installation fehlgeschlagen"
fi
success "Node.js installiert: $(node --version)"

# SignalK installieren
info "Installiere SignalK Server..."
if ! command -v signalk-server &> /dev/null; then
    sudo npm install -g --unsafe-perm signalk-server || error "SignalK Installation fehlgeschlagen"
fi
success "SignalK installiert"

# SignalK Service erstellen
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

# GPS Berechtigungen
info "Füge Benutzer zur dialout-Gruppe hinzu..."
sudo usermod -a -G dialout $INSTALL_USER
success "Benutzer zur dialout-Gruppe hinzugefügt"

# BoatOS Repository klonen (falls nicht vorhanden)
if [ ! -d "$INSTALL_DIR" ]; then
    info "BoatOS Verzeichnis nicht gefunden. Bitte stelle sicher, dass BoatOS unter $INSTALL_DIR liegt."
    error "BoatOS Verzeichnis fehlt"
fi

# Backend einrichten
info "Richte Backend ein..."
cd $INSTALL_DIR/backend

if [ ! -d "venv" ]; then
    # Use --system-site-packages to access GDAL Python bindings
    python3 -m venv --system-site-packages venv || error "Virtual Environment konnte nicht erstellt werden"
    success "Virtual Environment mit System-Paketen erstellt (für GDAL)"
fi

source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt || error "Python-Abhängigkeiten konnten nicht installiert werden"
success "Backend eingerichtet"

# Datenverzeichnisse erstellen
info "Erstelle Datenverzeichnisse..."
mkdir -p $INSTALL_DIR/data/charts
mkdir -p $INSTALL_DIR/data/enc_downloads
mkdir -p $INSTALL_DIR/data/osrm
touch $INSTALL_DIR/data/.gitkeep
success "Datenverzeichnisse erstellt"

# Waterway Routing Setup
info "Waterway Routing wird konfiguriert..."
info "Installiert:"
info "  ✅ PyRouteLib3 (Overpass API Routing - funktioniert sofort)"
info ""

# Install pre-compiled OSRM binaries (ARM64 only)
if [ "$(uname -m)" = "aarch64" ]; then
    if [ -f "$INSTALL_DIR/osrm-binaries/osrm-arm64-binaries.tar.gz" ]; then
        info "Installiere vorkompilierte OSRM ARM64 Binaries..."
        cd /tmp
        tar xzf "$INSTALL_DIR/osrm-binaries/osrm-arm64-binaries.tar.gz"
        sudo mv osrm-routed osrm-extract osrm-partition osrm-customize /usr/local/bin/
        sudo chmod +x /usr/local/bin/osrm-*
        success "OSRM Binaries installiert"

        # Clone OSRM Backend for profiles
        if [ ! -d "$HOME/osrm-backend" ]; then
            info "Clone OSRM Backend Repository für Profiles..."
            cd $HOME
            git clone https://github.com/Project-OSRM/osrm-backend.git || error "OSRM Backend Clone fehlgeschlagen"
            success "OSRM Backend gecloned"
        fi

        # Copy waterway profile
        info "Kopiere Waterway Profile..."
        cp "$INSTALL_DIR/profiles/waterway_working.lua" "$HOME/osrm-backend/profiles/waterway.lua"
        success "Waterway Profile installiert"

        # Download Sachsen-Anhalt OSM data as default (for Elbe testing)
        info "Lade Sachsen-Anhalt OSM Daten herunter (für Elbe-Tests)..."
        mkdir -p "$HOME/osrm_regions"
        cd "$HOME/osrm_regions"

        if [ ! -f "sachsen-anhalt-latest.osm.pbf" ]; then
            wget -q --show-progress https://download.geofabrik.de/europe/germany/sachsen-anhalt-latest.osm.pbf || error "OSM Download fehlgeschlagen"
            success "Sachsen-Anhalt OSM Daten heruntergeladen"
        fi

        # Extract OSRM data with waterway profile
        info "Extrahiere OSRM Waterway-Daten (kann einige Minuten dauern)..."
        osrm-extract -p "$HOME/osrm-backend/profiles/waterway.lua" sachsen-anhalt-latest.osm.pbf || error "OSRM Extract fehlgeschlagen"
        osrm-partition sachsen-anhalt-latest.osrm || error "OSRM Partition fehlgeschlagen"
        osrm-customize sachsen-anhalt-latest.osrm || error "OSRM Customize fehlgeschlagen"

        # Copy OSRM data to BoatOS data directory
        cp sachsen-anhalt-latest.osrm* "$INSTALL_DIR/data/osrm/"
        success "OSRM Waterway-Daten extrahiert"

        # Create OSRM Service
        info "Erstelle OSRM Service..."
        sudo tee /etc/systemd/system/osrm.service > /dev/null << OSRM
[Unit]
Description=OSRM Routing Engine
After=network.target

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$INSTALL_DIR/data/osrm
ExecStart=/usr/local/bin/osrm-routed --algorithm=MLD $INSTALL_DIR/data/osrm/sachsen-anhalt-latest.osrm --port 5000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
OSRM

        sudo systemctl daemon-reload
        sudo systemctl enable osrm
        success "OSRM Service erstellt"

        info "  🚀 OSRM Server konfiguriert für Waterway-Routing"
        info "     - Region: Sachsen-Anhalt (Elbe)"
        info "     - Weitere Bundesländer können mit dem extract-Skript hinzugefügt werden"
    else
        info "Optional für bessere Performance:"
        info "  🚀 OSRM Server (lokales, schnelles Routing)"
        info "     - Erfordert: OSM PBF Datei + Kompilierung von OSRM"
        info "     - Siehe: https://github.com/Project-OSRM/osrm-backend"
    fi
else
    info "Optional für bessere Performance:"
    info "  🚀 OSRM Server (lokales, schnelles Routing)"
    info "     - Erfordert: OSM PBF Datei + Kompilierung von OSRM"
    info "     - Nur für ARM64/64-bit OS verfügbar"
fi
success "Waterway Routing konfiguriert (PyRouteLib3 + OSRM)"

# BoatOS Service erstellen
info "Erstelle BoatOS Service..."
sudo tee /etc/systemd/system/boatos.service > /dev/null << BOATOS
[Unit]
Description=BoatOS Backend API
After=network.target signalk.service
Requires=signalk.service

[Service]
Type=simple
User=$INSTALL_USER
WorkingDirectory=$INSTALL_DIR/backend
ExecStart=$INSTALL_DIR/backend/venv/bin/python app/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
BOATOS

sudo systemctl daemon-reload
sudo systemctl enable boatos
success "BoatOS Service erstellt"

# SSL-Zertifikat erstellen
info "Erstelle selbstsigniertes SSL-Zertifikat..."
if [ ! -f "/etc/ssl/certs/boatos-selfsigned.crt" ]; then
    sudo openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
        -keyout /etc/ssl/private/boatos-selfsigned.key \
        -out /etc/ssl/certs/boatos-selfsigned.crt \
        -subj "/C=DE/ST=State/L=City/O=BoatOS/CN=$(hostname -I | awk '{print $1}')" || error "SSL-Zertifikat konnte nicht erstellt werden"
    success "SSL-Zertifikat erstellt"
else
    info "SSL-Zertifikat existiert bereits"
fi

# Nginx konfigurieren
info "Konfiguriere Nginx..."
sudo tee /etc/nginx/sites-available/boatos > /dev/null << 'NGINX'
# HTTP Server - Redirect to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl;
    server_name _;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/boatos-selfsigned.crt;
    ssl_certificate_key /etc/ssl/private/boatos-selfsigned.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    # Allow large file uploads for chart files
    client_max_body_size 2G;
    client_body_timeout 300s;
    proxy_read_timeout 300s;

    # Frontend
    location / {
        root /home/INSTALL_USER_PLACEHOLDER/BoatOS/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;

        # Large uploads for chart files
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
    }

    # Charts directory - CRITICAL: trailing slash prevents matching /charts.js
    location /charts/ {
        alias /home/INSTALL_USER_PLACEHOLDER/BoatOS/data/charts;
        autoindex off;
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

# Replace placeholder with actual user
sudo sed -i "s/INSTALL_USER_PLACEHOLDER/$INSTALL_USER/g" /etc/nginx/sites-available/boatos

sudo ln -sf /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t || error "Nginx-Konfiguration ist fehlerhaft"
success "Nginx konfiguriert"

# Services starten
info "Starte Services..."
sudo systemctl start signalk
sudo systemctl start boatos
sudo systemctl restart nginx

# Start OSRM if available
if systemctl list-unit-files | grep -q osrm.service; then
    sudo systemctl start osrm
    success "OSRM Service gestartet"
fi

success "Services gestartet"

echo ""
echo "============================="
echo -e "${GREEN}🎉 BoatOS erfolgreich installiert!${NC}"
echo ""
echo "Zugriff:"
echo "  - BoatOS UI: https://$(hostname -I | awk '{print $1}')/"
echo "  - SignalK:   http://$(hostname -I | awk '{print $1}'):3000/"
echo ""
echo -e "${YELLOW}⚠️  Hinweis: Selbstsigniertes SSL-Zertifikat - Browser-Warnung ignorieren${NC}"
echo ""
echo "Nächste Schritte:"
echo "  1. GPS-Device identifizieren: ls -la /dev/ttyACM*"
echo "  2. SignalK GPS konfigurieren (siehe INSTALL.md)"
echo "  3. SignalK neu starten: sudo systemctl restart signalk"
echo "  4. BoatOS neu starten: sudo systemctl restart boatos"
echo ""
if systemctl list-unit-files | grep -q osrm.service; then
echo "OSRM Waterway Routing:"
echo "  - Status: sudo systemctl status osrm"
echo "  - Weitere Bundesländer hinzufügen: siehe scripts/extract_regions.sh"
echo ""
fi
echo "Status prüfen:"
echo "  sudo systemctl status signalk"
echo "  sudo systemctl status boatos"
if systemctl list-unit-files | grep -q osrm.service; then
echo "  sudo systemctl status osrm"
fi
echo ""
echo -e "${YELLOW}⚠️  WICHTIG: Bitte melde dich ab und wieder an, damit die dialout-Gruppe wirksam wird!${NC}"
