#!/bin/bash
# BoatOS System Update — wird vom Backend (/api/system/update) aufgerufen.
set -euo pipefail

REPO_DIR=/home/boatos/BoatOS
GITHUB_REPO=bigbrainlabs/BoatOS
GITHUB_URL=https://github.com/$GITHUB_REPO.git
APP_SO=$REPO_DIR/flutter_app/app.so

log() { echo "[$(date '+%H:%M:%S')] $*"; }

log "=== BoatOS Update gestartet ==="

# 1. Code via GitHub-Tarball aktualisieren (kein Git-State nötig)
log "[1/6] Prüfe neueste Version..."
cd "$REPO_DIR"

LATEST_TAG=$(curl -sf --max-time 15 \
    "https://api.github.com/repos/$GITHUB_REPO/git/refs/tags" | \
    python3 -c "
import sys, json, re
try:
    refs = json.load(sys.stdin)
    tags = [r['ref'].split('/')[-1] for r in refs
            if r['ref'].startswith('refs/tags/v') and not r['ref'].endswith('{}')]
    def sv(t):
        m = re.match(r'v(\d+)\.(\d+)\.(\d+)', t)
        return (int(m.group(1)), int(m.group(2)), int(m.group(3))) if m else (0,0,0)
    print(sorted(tags, key=sv)[-1])
except: pass
" 2>/dev/null || echo "")

if [ -z "$LATEST_TAG" ]; then
    log "       Konnte neueste Version nicht ermitteln — überspringe Code-Update"
else
    log "       Lade $LATEST_TAG von GitHub..."
    ARCHIVE_URL="https://github.com/$GITHUB_REPO/archive/refs/tags/$LATEST_TAG.tar.gz"
    if curl -sfL --max-time 120 -o /tmp/boatos_update.tar.gz "$ARCHIVE_URL"; then
        tar -xzf /tmp/boatos_update.tar.gz --strip-components=1 -C "$REPO_DIR"
        rm -f /tmp/boatos_update.tar.gz
        printf '%s\n' "$LATEST_TAG" > "$REPO_DIR/VERSION"
        log "       Code aktualisiert auf $LATEST_TAG"
    else
        log "       Download fehlgeschlagen — überspringe Code-Update"
    fi
fi

# 2. Python dependencies (venv nutzen um Bookworm-Systemschutz zu umgehen)
log "[2/6] Aktualisiere Python-Abhängigkeiten..."
VENV="$REPO_DIR/backend/venv"
if [ -d "$VENV" ]; then
    "$VENV/bin/pip" install -q -r "$REPO_DIR/backend/requirements.txt"
    log "       Fertig (venv)"
else
    pip install -q --break-system-packages -r "$REPO_DIR/backend/requirements.txt" 2>/dev/null || \
    pip install -q -r "$REPO_DIR/backend/requirements.txt" 2>/dev/null || true
    log "       Fertig (system pip)"
fi

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

# 4a. Display-Detection Service (Helm Auto-Start)
log "[4a] Installiere Display-Detection Service..."
sudo cp "$REPO_DIR/scripts/boatos-detect-display.sh" /usr/local/bin/boatos-detect-display.sh
sudo chmod +x /usr/local/bin/boatos-detect-display.sh
sudo cp "$REPO_DIR/scripts/boatos-detect-display.service" /etc/systemd/system/boatos-detect-display.service
sudo mkdir -p /etc/systemd/system/lightdm.service.d
sudo cp "$REPO_DIR/scripts/lightdm-helm-condition.conf" /etc/systemd/system/lightdm.service.d/helm-condition.conf
# sudoers: allow lightdm start/stop + detect-display restart for backend
echo "boatos ALL=(ALL) NOPASSWD: /bin/systemctl start lightdm, /bin/systemctl stop lightdm, /bin/systemctl restart boatos-detect-display" | \
    sudo tee /etc/sudoers.d/boatos-lightdm > /dev/null
sudo chmod 440 /etc/sudoers.d/boatos-lightdm
sudo systemctl daemon-reload
sudo systemctl enable boatos-detect-display.service
log "       Display-Detection aktiv"

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
