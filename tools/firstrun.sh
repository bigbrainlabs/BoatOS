#!/bin/bash
# BoatOS First Boot Script
# Liest /boot/firmware/wlan.txt und konfiguriert WiFi via NetworkManager

WLAN_CONF="/boot/firmware/wlan.txt"
LOG="/var/log/boatos-firstrun.log"

exec >> "$LOG" 2>&1
echo "=== BoatOS firstrun.sh $(date) ==="

if [ -f "$WLAN_CONF" ]; then
    SSID=$(grep -m1 "^SSID=" "$WLAN_CONF" | cut -d= -f2-)
    PASSWORD=$(grep -m1 "^PASSWORD=" "$WLAN_CONF" | cut -d= -f2-)
    COUNTRY=$(grep -m1 "^COUNTRY=" "$WLAN_CONF" | cut -d= -f2-)
    COUNTRY=${COUNTRY:-DE}

    if [ -n "$SSID" ] && [ -n "$PASSWORD" ]; then
        echo "Konfiguriere WiFi: $SSID (Land: $COUNTRY)"
        # Ländercode setzen
        iw reg set "$COUNTRY" 2>/dev/null || true
        # WiFi verbinden (NM legt Profil an und speichert Credentials)
        nmcli device wifi connect "$SSID" password "$PASSWORD" 2>&1
        echo "WiFi-Konfiguration abgeschlossen."
    else
        echo "WARNUNG: SSID oder PASSWORD in wlan.txt leer — WiFi nicht konfiguriert."
    fi

    # wlan.txt löschen (enthält Passwort im Klartext)
    rm -f "$WLAN_CONF"
    echo "wlan.txt gelöscht."
else
    echo "Keine wlan.txt gefunden — WiFi-Konfiguration übersprungen."
fi

# Script aus cmdline.txt austragen (läuft nur einmal)
sed -i 's| systemd\.run=/boot/firmware/firstrun\.sh||g' /boot/firmware/cmdline.txt
rm -f /boot/firmware/firstrun.sh
echo "firstrun.sh abgeschlossen und entfernt."
