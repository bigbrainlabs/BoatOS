#!/bin/bash
# Einmalig per SSH ausführen: sudo bash scripts/setup-sudoers.sh
# Richtet Sudo-Berechtigungen ein, die das BoatOS-Backend und update.sh benötigen.
set -euo pipefail

SUDOERS_FILE=/etc/sudoers.d/boatos-update

cat > "$SUDOERS_FILE" << 'EOF'
boatos ALL=(ALL) NOPASSWD: /bin/systemctl restart boatos.service
boatos ALL=(ALL) NOPASSWD: /bin/systemctl restart boatos-remote.service
boatos ALL=(ALL) NOPASSWD: /bin/systemctl restart mosquitto
boatos ALL=(ALL) NOPASSWD: /usr/bin/tee /etc/mosquitto/conf.d/boatos.conf
boatos ALL=(ALL) NOPASSWD: /sbin/reboot
boatos ALL=(ALL) NOPASSWD: /sbin/shutdown
EOF

chmod 440 "$SUDOERS_FILE"
echo "✅ Sudoers eingerichtet: $SUDOERS_FILE"

# Direkt Mosquitto konfigurieren
MOSQ_CONF=/etc/mosquitto/conf.d/boatos.conf
printf "listener 1883 0.0.0.0\nallow_anonymous true\n" > "$MOSQ_CONF"
systemctl restart mosquitto
echo "✅ Mosquitto konfiguriert — externe Verbindungen auf Port 1883 erlaubt"
