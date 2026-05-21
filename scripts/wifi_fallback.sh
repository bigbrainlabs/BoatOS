#!/bin/bash
# BoatOS WiFi Fallback — startet Hotspot wenn kein Netzwerk verfügbar

HOTSPOT_CON="BoatOS-Hotspot"
HOTSPOT_SSID="BoatOS-Setup"
HOTSPOT_PASS="boatos1234"
STARTUP_GRACE=90
CHECK_INTERVAL=15
RECONNECT_GRACE=45

IFACE=$(nmcli -t -f DEVICE,TYPE device 2>/dev/null | grep ':wifi$' | head -1 | cut -d: -f1)
IFACE=${IFACE:-wlan0}

_real_connected() {
    nmcli -t -f NAME,DEVICE,STATE con show --active 2>/dev/null \
        | grep ":${IFACE}:activated" \
        | grep -qv "^${HOTSPOT_CON}:"
}

_hotspot_up() {
    nmcli -t -f NAME,DEVICE,STATE con show --active 2>/dev/null \
        | grep -q "^${HOTSPOT_CON}:${IFACE}:activated"
}

_ensure_profile() {
    nmcli con show "$HOTSPOT_CON" &>/dev/null && return 0
    nmcli connection add \
        type wifi ifname "$IFACE" con-name "$HOTSPOT_CON" autoconnect no \
        ssid "$HOTSPOT_SSID" \
        "802-11-wireless.mode" ap \
        "802-11-wireless.band" bg \
        ipv4.method shared \
        ipv4.addresses "192.168.4.1/24" \
        wifi-sec.key-mgmt wpa-psk \
        "wifi-sec.psk" "$HOTSPOT_PASS" 2>/dev/null
}

logger -t wifi-fallback "Gestartet auf ${IFACE}, warte ${STARTUP_GRACE}s..."
sleep "$STARTUP_GRACE"

disconnected_for=0

while true; do
    if _real_connected; then
        disconnected_for=0
        if _hotspot_up; then
            nmcli connection down "$HOTSPOT_CON" 2>/dev/null || true
            logger -t wifi-fallback "Hotspot gestoppt — mit Netzwerk verbunden"
        fi
    else
        disconnected_for=$((disconnected_for + CHECK_INTERVAL))
        if [ "$disconnected_for" -ge "$RECONNECT_GRACE" ] && ! _hotspot_up; then
            _ensure_profile
            nmcli connection up "$HOTSPOT_CON" 2>/dev/null && \
                logger -t wifi-fallback "Hotspot '${HOTSPOT_SSID}' gestartet (kein Netzwerk)"
        fi
    fi
    sleep "$CHECK_INTERVAL"
done
