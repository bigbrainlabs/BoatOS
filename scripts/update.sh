#!/bin/bash
# BoatOS System Update — wird vom Backend (/api/system/update) aufgerufen.
set -euo pipefail

# Detect the real repo location from the running systemd service.
# This works even when the script is executed from a wrong/stale path
# (e.g. /home/boatos/BoatOS/scripts/) because the old backend used to
# download update.sh to a hardcoded path before running it.
_SERVICE_WD=$(systemctl show boatos.service -p WorkingDirectory --value 2>/dev/null | tr -d '[:space:]')
if [ -n "$_SERVICE_WD" ] && [ -d "${_SERVICE_WD%/backend}" ]; then
    REPO_DIR="${_SERVICE_WD%/backend}"
else
    REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
fi
GITHUB_REPO=bigbrainlabs/BoatOS
GITHUB_URL=https://github.com/$GITHUB_REPO.git
APP_SO=$REPO_DIR/flutter_app/app.so

log() { echo "[$(date '+%H:%M:%S')] $*"; }

CHANNEL="${BOATOS_CHANNEL:-stable}"
log "=== BoatOS Update gestartet (Kanal: $CHANNEL) ==="

# 1. Ziel-Release für den Kanal auflösen (Code-Tarball + app.so aus DEMSELBEN
#    Release). Stable = nur echte Releases; Beta = auch Prereleases.
#    Single-Quotes im Python-Block: $ bleibt literal (kein Bash-Expand);
#    der Kanal kommt über die geerbte Env-Variable BOATOS_CHANNEL.
log "[1/6] Prüfe neueste Version (Kanal: $CHANNEL)..."
cd "$REPO_DIR"

RESOLVED=$(curl -sf --max-time 15 \
    "https://api.github.com/repos/$GITHUB_REPO/releases?per_page=30" | \
    python3 -c '
import sys, json, re, os
def key(tag):
    m = re.match(r"v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.]+))?$", (tag or "").strip())
    if not m: return (-1,-1,-1,-1,())
    a,b,c = int(m.group(1)),int(m.group(2)),int(m.group(3))
    pre = m.group(4)
    if not pre: return (a,b,c,1,())
    ids = tuple((0,int(x)) if x.isdigit() else (1,x) for x in pre.split("."))
    return (a,b,c,0,ids)
try:
    rels = json.load(sys.stdin)
    ch = os.environ.get("BOATOS_CHANNEL","stable")
    cand = [r for r in rels if r.get("tag_name","").startswith("v")
            and not r.get("draft")
            and (ch=="beta" or not r.get("prerelease"))]
    if cand:
        best = max(cand, key=lambda r: key(r["tag_name"]))
        appso = next((a["browser_download_url"] for a in best.get("assets",[])
                      if a["name"]=="app.so"), "")
        print(best["tag_name"]); print(appso)
except Exception:
    pass
' 2>/dev/null || echo "")

TARGET_TAG=$(printf '%s' "$RESOLVED" | sed -n 1p)
APP_URL=$(printf '%s' "$RESOLVED" | sed -n 2p)

if [ -z "$TARGET_TAG" ]; then
    log "       Konnte kein Release für Kanal '$CHANNEL' ermitteln — überspringe Code-Update"
else
    log "       Lade $TARGET_TAG von GitHub..."
    ARCHIVE_URL="https://github.com/$GITHUB_REPO/archive/refs/tags/$TARGET_TAG.tar.gz"
    if curl -sfL --max-time 120 -o /tmp/boatos_update.tar.gz "$ARCHIVE_URL"; then
        tar -xzf /tmp/boatos_update.tar.gz --strip-components=1 -C "$REPO_DIR"
        rm -f /tmp/boatos_update.tar.gz
        printf '%s\n' "$TARGET_TAG" > "$REPO_DIR/VERSION"
        log "       Code aktualisiert auf $TARGET_TAG"
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

# 3. app.so aus DEMSELBEN Release wie der Code (in Schritt 1 aufgelöst)
log "[3/6] Lade Helm-App (app.so) für Kanal $CHANNEL..."
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

# 5a. Ensure nginx upload limit and timeouts are sufficient for large mbtiles uploads
log "[5a] Prüfe nginx-Konfiguration für Upload..."
NGINX_CONF=/etc/nginx/sites-available/boatos
if [ -f "$NGINX_CONF" ]; then
    # client_max_body_size — update if exists, add to server block if missing
    if grep -q "client_max_body_size" "$NGINX_CONF"; then
        sudo sed -i "s/client_max_body_size [^;]*/client_max_body_size 20G/g" "$NGINX_CONF"
    else
        sudo sed -i "/listen 443 ssl/a\\    client_max_body_size 20G;" "$NGINX_CONF"
    fi
    # proxy_read_timeout — update if exists, add after proxy_pass if missing
    if grep -q "proxy_read_timeout" "$NGINX_CONF"; then
        sudo sed -i "s/proxy_read_timeout [^;]*/proxy_read_timeout 600s/g" "$NGINX_CONF"
    else
        sudo sed -i "/proxy_pass http:\/\/localhost:8000/a\\        proxy_read_timeout 600s;" "$NGINX_CONF"
    fi
    # client_body_timeout — update if exists, add to server block if missing
    if grep -q "client_body_timeout" "$NGINX_CONF"; then
        sudo sed -i "s/client_body_timeout [^;]*/client_body_timeout 300s/g" "$NGINX_CONF"
    else
        sudo sed -i "/listen 443 ssl/a\\    client_body_timeout 300s;" "$NGINX_CONF"
    fi
    # Correct frontend root and charts alias paths to match current REPO_DIR
    sudo sed -i "s|root [^ ]*/BoatOS/frontend|root $REPO_DIR/frontend|g" "$NGINX_CONF"
    sudo sed -i "s|alias [^ ]*/BoatOS/data/charts|alias $REPO_DIR/data/charts|g" "$NGINX_CONF"
    log "       nginx client_max_body_size=20G, proxy_read_timeout=600s, client_body_timeout=300s, root=$REPO_DIR/frontend"
    sudo nginx -t 2>/dev/null && sudo systemctl reload nginx || log "       nginx reload fehlgeschlagen — Config prüfen"
else
    log "       nginx-Konfig nicht gefunden — überspringe"
fi

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
