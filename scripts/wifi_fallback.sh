#!/bin/bash
# BoatOS WiFi Fallback — startet Hotspot wenn kein Netzwerk verfügbar

HOTSPOT_CON="BoatOS-Hotspot"
HOTSPOT_SSID="BoatOS-Setup"
HOTSPOT_PASS="boatos1234"
STARTUP_GRACE=90
CHECK_INTERVAL=15
RECONNECT_GRACE=30
LOCK_FILE="/tmp/boatos_wifi_connecting"

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

_start_hotspot() {
    # Nicht stören wenn API gerade verbindet
    if [ -f "$LOCK_FILE" ]; then
        logger -t wifi-fallback "API verbindet gerade — Hotspot-Start pausiert"
        return 0
    fi
    _ensure_profile
    # Alten Hotspot-Zustand bereinigen (verhindert dnsmasq-Reste)
    nmcli connection down "$HOTSPOT_CON" 2>/dev/null || true
    # Interface force-disconnect: beendet NM-Reconnect-Loops die das Interface blockieren
    nmcli device disconnect "$IFACE" 2>/dev/null || true
    sleep 2
    if nmcli connection up "$HOTSPOT_CON" 2>/dev/null; then
        logger -t wifi-fallback "Hotspot '${HOTSPOT_SSID}' aktiv auf 192.168.4.1"
    else
        logger -t wifi-fallback "FEHLER: Hotspot-Start fehlgeschlagen — nächster Versuch in ${CHECK_INTERVAL}s"
    fi
}

logger -t wifi-fallback "Gestartet auf ${IFACE}, warte ${STARTUP_GRACE}s..."
sleep "$STARTUP_GRACE"

disconnected_for=0

while true; do
    # Timer einfrieren solange API verbindet — nicht dazwischenfunken
    if [ -f "$LOCK_FILE" ]; then
        disconnected_for=0
        sleep "$CHECK_INTERVAL"
        continue
    fi

    if _real_connected; then
        disconnected_for=0
        if _hotspot_up; then
            nmcli connection down "$HOTSPOT_CON" 2>/dev/null || true
            logger -t wifi-fallback "Hotspot gestoppt — WLAN verbunden"
        fi
    else
        disconnected_for=$((disconnected_for + CHECK_INTERVAL))
        logger -t wifi-fallback "WLAN getrennt seit ${disconnected_for}s (Schwelle: ${RECONNECT_GRACE}s)"
        if [ "$disconnected_for" -ge "$RECONNECT_GRACE" ] && ! _hotspot_up; then
            _start_hotspot
        fi
    fi
    sleep "$CHECK_INTERVAL"
done
