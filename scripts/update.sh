#!/bin/bash
set -e

echo "🔄 BoatOS Update Script"
echo "======================="
echo ""

# Farben für Ausgabe
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
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

step() {
    echo -e "${BLUE}▶ $1${NC}"
}

# Benutzer prüfen
if [ "$EUID" -eq 0 ]; then
   error "Bitte führe dieses Skript NICHT als root aus!"
fi

INSTALL_USER=$(whoami)
INSTALL_DIR="/home/$INSTALL_USER/BoatOS"

# Prüfe ob BoatOS installiert ist
if [ ! -d "$INSTALL_DIR" ]; then
    error "BoatOS ist nicht installiert in $INSTALL_DIR"
fi

echo "Update für Benutzer: $INSTALL_USER"
echo "Installationsverzeichnis: $INSTALL_DIR"
echo ""

# 1. Git Pull
step "Aktualisiere BoatOS Repository..."
cd $INSTALL_DIR
git fetch origin
LOCAL=$(git rev-parse @)
REMOTE=$(git rev-parse @{u})

if [ $LOCAL = $REMOTE ]; then
    info "Repository ist bereits auf dem neuesten Stand"
else
    info "Neue Version verfügbar, aktualisiere..."
    git pull origin main || error "Git Pull fehlgeschlagen"
    success "Repository aktualisiert"
fi

# 2. Backend Dependencies
step "Aktualisiere Backend Dependencies..."
cd $INSTALL_DIR/backend
if [ -f "venv/bin/activate" ]; then
    source venv/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt || error "Backend Dependencies konnten nicht aktualisiert werden"
    success "Backend Dependencies aktualisiert"
else
    error "Virtual Environment nicht gefunden. Bitte führe install.sh aus."
fi

# 3. Frontend Cache Busting
step "Aktualisiere Frontend Cache Busting..."
cd $INSTALL_DIR/frontend
TIMESTAMP=$(date +%s)
if [ -f "index.html" ]; then
    # Update all script version tags to current timestamp
    sed -i "s/\\.js?v=[0-9]*/\\.js?v=$TIMESTAMP/g" index.html
    success "Frontend Cache Busting aktualisiert (v=$TIMESTAMP)"
fi

# 4. Services neu starten
step "Starte Services neu..."

# Stop services
info "Stoppe Services..."
sudo systemctl stop boatos
if systemctl list-unit-files | grep -q osrm.service; then
    sudo systemctl stop osrm
fi

# Start services
info "Starte Services..."
sudo systemctl start boatos
if systemctl list-unit-files | grep -q osrm.service; then
    sudo systemctl start osrm
fi

# Reload nginx (nur Config, kein Restart)
sudo nginx -t && sudo systemctl reload nginx

success "Services neu gestartet"

# 5. Status prüfen
step "Prüfe Service Status..."
sleep 2

if systemctl is-active --quiet signalk; then
    success "SignalK läuft"
else
    echo -e "${RED}❌ SignalK läuft nicht${NC}"
fi

if systemctl is-active --quiet boatos; then
    success "BoatOS Backend läuft"
else
    echo -e "${RED}❌ BoatOS Backend läuft nicht${NC}"
fi

if systemctl list-unit-files | grep -q osrm.service; then
    if systemctl is-active --quiet osrm; then
        success "OSRM läuft"
    else
        echo -e "${RED}❌ OSRM läuft nicht${NC}"
    fi
fi

if systemctl is-active --quiet nginx; then
    success "Nginx läuft"
else
    echo -e "${RED}❌ Nginx läuft nicht${NC}"
fi

echo ""
echo "============================="
echo -e "${GREEN}🎉 BoatOS erfolgreich aktualisiert!${NC}"
echo ""
echo "Änderungen in diesem Update:"
echo "  ✅ Location Search mit Nominatim"
echo "  ✅ Koordinaten-Eingabe (Decimal, DMS, DM)"
echo "  ✅ Verbessertes Auto-Follow (respektiert manuelle Interaktion)"
echo "  ✅ Such-Marker mit Popups"
echo ""
echo "Zugriff:"
echo "  - BoatOS UI: https://$(hostname -I | awk '{print $1}')/"
echo ""
echo -e "${YELLOW}⚠️  Browser Cache leeren: Strg+Shift+R (oder Strg+F5)${NC}"
echo ""
echo "Logs ansehen:"
echo "  sudo journalctl -u boatos -f"
echo "  sudo journalctl -u signalk -f"
if systemctl list-unit-files | grep -q osrm.service; then
echo "  sudo journalctl -u osrm -f"
fi
echo ""
