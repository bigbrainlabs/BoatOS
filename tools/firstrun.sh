#!/bin/bash
# BoatOS First Boot Script
# Liest /boot/firmware/wlan.txt und richtet WiFi über NetworkManager ein.
#
# Dieses Script läuft sehr früh (systemd.run= aus cmdline.txt) — u.U. BEVOR
# NetworkManager verbindungsbereit ist. Ein sofortiges "nmcli device wifi
# connect" schlägt dann fehl, und weil das Script wlan.txt danach löscht, war
# die Konfiguration für immer weg. Deshalb schreiben wir ein PERSISTENTES
# NM-Keyfile-Profil (autoconnect): NM verbindet automatisch, sobald das WLAN in
# Reichweite ist — unabhängig vom Boot-Timing.

WLAN_CONF="/boot/firmware/wlan.txt"
LOG="/var/log/boatos-firstrun.log"

exec >> "$LOG" 2>&1
echo "=== BoatOS firstrun.sh $(date) ==="

# Whitespace + CRLF entfernen (wlan.txt wird oft unter Windows editiert → \r!)
trim() { printf '%s' "$1" | tr -d '\r' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//'; }

if [ -f "$WLAN_CONF" ]; then
    SSID=$(trim "$(grep -m1 '^SSID=' "$WLAN_CONF" | cut -d= -f2-)")
    PASSWORD=$(trim "$(grep -m1 '^PASSWORD=' "$WLAN_CONF" | cut -d= -f2-)")
    COUNTRY=$(trim "$(grep -m1 '^COUNTRY=' "$WLAN_CONF" | cut -d= -f2-)")
    COUNTRY=${COUNTRY:-DE}

    if [ -n "$SSID" ] && [ -n "$PASSWORD" ]; then
        echo "Konfiguriere WiFi: '$SSID' (Land: $COUNTRY)"

        # 1) Regulatory-Domain setzen + Funk entsperren. Bookworm blockt WLAN,
        #    bis ein Land gesetzt ist (raspi-config erledigt das RPi-konform).
        raspi-config nonint do_wifi_country "$COUNTRY" 2>/dev/null || true
        iw reg set "$COUNTRY" 2>/dev/null || true
        rfkill unblock wifi 2>/dev/null || true

        # 2) Persistentes NetworkManager-Keyfile-Profil (autoconnect). NM
        #    verbindet damit selbstständig, sobald das Netz erreichbar ist —
        #    auch wenn NM zum firstrun-Zeitpunkt noch gar nicht lief.
        PROFILE_DIR="/etc/NetworkManager/system-connections"
        PROFILE="$PROFILE_DIR/boatos-wifi.nmconnection"
        UUID=$(cat /proc/sys/kernel/random/uuid 2>/dev/null)
        mkdir -p "$PROFILE_DIR"
        {
            echo "[connection]"
            echo "id=boatos-wifi"
            [ -n "$UUID" ] && echo "uuid=$UUID"
            echo "type=wifi"
            echo "autoconnect=true"
            echo "autoconnect-priority=10"
            echo ""
            echo "[wifi]"
            echo "mode=infrastructure"
            echo "ssid=$SSID"
            echo ""
            echo "[wifi-security]"
            echo "key-mgmt=wpa-psk"
            echo "psk=$PASSWORD"
            echo ""
            echo "[ipv4]"
            echo "method=auto"
            echo ""
            echo "[ipv6]"
            echo "method=auto"
        } > "$PROFILE"
        chmod 600 "$PROFILE"
        chown root:root "$PROFILE"
        echo "NM-Profil geschrieben: $PROFILE"

        # 3) Falls NM bereits läuft: einlesen + sofort verbinden (best effort).
        #    Sonst greift autoconnect automatisch, sobald NM startet.
        if systemctl is-active --quiet NetworkManager; then
            nmcli connection reload 2>/dev/null || true
            nmcli connection up boatos-wifi 2>/dev/null || true
        fi
        echo "WiFi-Konfiguration abgeschlossen (Profil persistent, autoconnect)."
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
