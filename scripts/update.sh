#!/bin/bash
# BoatOS System Update — wird vom Backend (/api/system/update) aufgerufen.
set -euo pipefail

REPO_DIR=/home/arielle/BoatOS
GITHUB_REPO=bigbrainlabs/BoatOS
GITHUB_URL=https://github.com/$GITHUB_REPO.git
APP_SO=$REPO_DIR/flutter_app/app.so

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "=== BoatOS Update gestartet ==="

# 1. Git initialisieren falls kein Repo vorhanden
log "[1/5] Prüfe Git-Repository..."
cd "$REPO_DIR"
if [ ! -d ".git" ]; then
    log "       Kein Git-Repo gefunden — initialisiere..."
    git init -q
    git remote add origin "$GITHUB_URL"
    log "       Git initialisiert"
fi
git fetch origin -q --tags
git reset --hard origin/main -q
log "       Code aktualisiert"

# 2. Python dependencies
log "[2/5] Aktualisiere Python-Abhängigkeiten..."
pip install -q -r backend/requirements.txt
log "       Fertig"

# 3. Download latest app.so from GitHub Releases
log "[3/5] Lade aktuelle Helm-App (app.so)..."
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

# 4. Ensure Mosquitto accepts external connections
log "[4/6] Konfiguriere Mosquitto (externe Verbindungen)..."
MOSQ_CONF=/etc/mosquitto/conf.d/boatos.conf
if ! grep -q "listener 1883 0.0.0.0" "$MOSQ_CONF" 2>/dev/null; then
    printf "listener 1883 0.0.0.0\nallow_anonymous true\n" | sudo tee "$MOSQ_CONF" > /dev/null
    sudo systemctl restart mosquitto || true
    log "       Mosquitto konfiguriert"
else
    log "       Bereits konfiguriert — überspringe"
fi

# 5. Restart backend services
log "[5/6] Starte Backend-Services neu..."
sudo systemctl restart boatos.service boatos-remote.service
log "       Services neu gestartet"

# 6. Reboot
log "[6/6] Update abgeschlossen — Neustart in 3 Sekunden..."
log "=== Fertig ==="
sleep 3
sudo /sbin/reboot
