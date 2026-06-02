#!/bin/bash
# BoatOS System Update — wird vom Backend (/api/system/update) aufgerufen.
set -euo pipefail

REPO_DIR=/home/boatos/BoatOS
GITHUB_REPO=bigbrainlabs/BoatOS
GITHUB_URL=https://github.com/$GITHUB_REPO.git
APP_SO=$REPO_DIR/flutter_app/app.so

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "=== BoatOS Update gestartet ==="

# 1. Git initialisieren falls kein Repo vorhanden
log "[1/6] Prüfe Git-Repository..."
cd "$REPO_DIR"
if [ ! -d ".git" ]; then
    log "       Kein Git-Repo gefunden — initialisiere..."
    git init -q
    git remote add origin "$GITHUB_URL"
else
    git remote set-url origin "$GITHUB_URL" 2>/dev/null || true
fi
# --force --prune-tags damit Tags nach History-Rewrite korrekt aktualisiert werden
if ! git fetch origin -q --force --prune --prune-tags --tags 2>/dev/null; then
    log "       Fetch fehlgeschlagen (veraltetes Repo?) — re-initialisiere..."
    rm -rf .git
    git init -q
    git remote add origin "$GITHUB_URL"
    git fetch origin -q --force --tags
fi
LATEST_TAG=$(git tag --sort=-version:refname | grep -E '^v[0-9]+\.' | head -1)
if [ -n "$LATEST_TAG" ]; then
    git reset --hard "$LATEST_TAG" -q
    log "       Code aktualisiert auf Tag: $LATEST_TAG"
else
    git reset --hard origin/main -q
    log "       Kein Tag gefunden — Fallback auf main"
fi

# 2. Python dependencies
log "[2/6] Aktualisiere Python-Abhängigkeiten..."
pip install -q -r backend/requirements.txt
log "       Fertig"

# 3. Download latest app.so from GitHub Releases
log "[3/6] Lade aktuelle Helm-App (app.so)..."
RELEASE_JSON=$(curl -sf --max-time 15 \
    "https://api.github.com/repos/$GITHUB_REPO/releases/latest" || echo "{}")
APP_URL=$(echo "$RELEASE_JSON" | python3 -c \
    "import sys,json; d=json.load(sys.stdin); \
     print(next((a['browser_download_url'] for a in d.get('assets',[]) \
     if a['name']=='app.so'), ''))" 2>/dev/null || echo "")

if [ -n "$APP_URL" ]; then
    log "       Lade von: $APP_URL"
    curl -sfL --max-time 120 -o "${APP_SO}.tmp" "$APP_URL"
    mv "${APP_SO}.tmp" "$APP_SO"
    log "       app.so erfolgreich heruntergeladen"
else
    log "       Kein app.so im aktuellen Release — überspringe"
fi

# 4. WiFi Fallback Hotspot Service + Power Management
log "[4/6] Installiere WiFi-Fallback-Service + deaktiviere Power Management..."
SERVICE_SRC="$REPO_DIR/scripts/wifi-fallback.service"
SERVICE_DST="/etc/systemd/system/wifi-fallback.service"
# Pfad im Service an aktuellen REPO_DIR anpassen
sed "s|/home/boatos/BoatOS|$REPO_DIR|g" "$SERVICE_SRC" | sudo tee "$SERVICE_DST" > /dev/null
sudo chmod 644 "$SERVICE_DST"
sudo chmod +x "$REPO_DIR/scripts/wifi_fallback.sh"
sudo systemctl daemon-reload
sudo systemctl enable wifi-fallback.service
sudo systemctl restart wifi-fallback.service || true
log "       WiFi-Fallback aktiv"

# WiFi Power Management dauerhaft deaktivieren (BCM43xx schläft sich sonst weg)
sudo mkdir -p /etc/NetworkManager/conf.d
sudo cp "$REPO_DIR/scripts/wifi-powersave-off.conf" /etc/NetworkManager/conf.d/wifi-powersave-off.conf
IFACE=$(nmcli -t -f DEVICE,TYPE device 2>/dev/null | grep ':wifi$' | head -1 | cut -d: -f1 || echo wlan0)
sudo iw dev "${IFACE:-wlan0}" set power_save off 2>/dev/null || true
sudo systemctl reload NetworkManager 2>/dev/null || true
log "       WiFi Power Management deaktiviert"

# 5. Ensure Mosquitto accepts external connections
log "[5/6] Konfiguriere Mosquitto (externe Verbindungen)..."
MOSQ_CONF=/etc/mosquitto/conf.d/boatos.conf
if ! grep -q "listener 1883 0.0.0.0" "$MOSQ_CONF" 2>/dev/null; then
    printf "listener 1883 0.0.0.0\nallow_anonymous true\n" | sudo tee "$MOSQ_CONF" > /dev/null
    sudo systemctl restart mosquitto || true
    log "       Mosquitto konfiguriert"
else
    log "       Bereits konfiguriert — überspringe"
fi

# 6. Restart backend + reboot
log "[6/6] Starte Backend neu und reboote..."
sudo systemctl restart boatos.service boatos-remote.service || true
log "=== Fertig — Neustart in 3 Sekunden ==="
sleep 3
sudo /sbin/reboot
