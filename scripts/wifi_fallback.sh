#!/bin/bash
# BoatOS WiFi Fallback — Power Save deaktivieren + Hotspot-Profil sicherstellen
# Kein automatischer Hotspot-Start — manuell per App starten

HOTSPOT_CON="BoatOS-Hotspot"
HOTSPOT_SSID="BoatOS-Setup"
HOTSPOT_PASS="boatos1234"

IFACE=$(nmcli -t -f DEVICE,TYPE device 2>/dev/null | grep ':wifi$' | head -1 | cut -d: -f1)
IFACE=${IFACE:-wlan0}

# Power Management deaktivieren — verhindert BCM43xx-Spontanabbrüche
iw dev "$IFACE" set power_save off 2>/dev/null || true
logger -t wifi-fallback "Power Management deaktiviert auf ${IFACE}"

# Hotspot-Profil anlegen falls noch nicht vorhanden
if ! nmcli con show "$HOTSPOT_CON" &>/dev/null; then
    nmcli connection add \
        type wifi ifname "$IFACE" con-name "$HOTSPOT_CON" autoconnect no \
        ssid "$HOTSPOT_SSID" \
        "802-11-wireless.mode" ap \
        "802-11-wireless.band" bg \
        ipv4.method shared \
        ipv4.addresses "192.168.4.1/24" \
        wifi-sec.key-mgmt wpa-psk \
        "wifi-sec.psk" "$HOTSPOT_PASS" 2>/dev/null \
        && logger -t wifi-fallback "Hotspot-Profil angelegt" \
        || logger -t wifi-fallback "WARNUNG: Hotspot-Profil konnte nicht angelegt werden"
fi

logger -t wifi-fallback "Bereit — kein Auto-Hotspot, manuell per App starten"
