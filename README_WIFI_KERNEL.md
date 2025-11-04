# WiFi und Kernel-Konfiguration für BoatOS

## Problem: 2.4GHz WiFi funktioniert nicht mit Kernel 6.12

**Symptome:**
- Debian Trixie (Testing) mit Kernel 6.12.47+ hat einen Bug im brcmfmac WiFi-Treiber
- 2.4GHz WiFi-Verbindungen schlagen fehl mit `status_code=16` (Unsupported capability)
- 5GHz WiFi funktioniert einwandfrei
- Problem: Regulatory Domain bleibt bei "country 99: DFS-UNSET" statt "DE"

**Lösung: Kernel 6.1 Installation**

### 1. Bookworm Repository hinzufügen

```bash
echo "deb http://archive.raspberrypi.com/debian bookworm main" | sudo tee /etc/apt/sources.list.d/bookworm.list
sudo apt-get update
```

### 2. Kernel 6.1 installieren

```bash
sudo apt-get install -y linux-image-6.1.0-rpi8-rpi-v8
```

### 3. Kernel in Boot-Partition kopieren

```bash
sudo cp /boot/vmlinuz-6.1.0-rpi8-rpi-v8 /boot/firmware/kernel8-6.1.img
sudo cp /boot/initrd.img-6.1.0-rpi8-rpi-v8 /boot/firmware/initramfs8-6.1
```

### 4. Boot-Konfiguration anpassen

In `/boot/firmware/config.txt` am Ende hinzufügen:

```
# Use Kernel 6.1 for 2.4GHz WiFi compatibility
kernel=kernel8-6.1.img
initramfs initramfs8-6.1 followkernel
```

### 5. System neu starten

```bash
sudo reboot
```

### 6. Kernel-Version prüfen

Nach dem Neustart:

```bash
uname -r
# Sollte ausgeben: 6.1.0-rpi8-rpi-v8
```

## DHCP-Konfiguration für optimales Routing

### dhcpcd Optimierungen

In `/etc/dhcpcd.conf` am Ende hinzufügen:

```
# Optimized settings for BoatOS
# Prefer eth0 over wlan0 for routing
interface eth0
  metric 100

interface wlan0
  metric 300
  # Faster DHCP retry
  reboot 10
  timeout 30

# Don't wait for IPv4LL (169.254.x.x) on interfaces
noipv4ll
```

**Routing-Priorität:**
- eth0 (Ethernet): Metric 100 → Hauptverbindung
- wlan0 (WiFi): Metric 300 → Fallback

Nach der Änderung:

```bash
sudo systemctl restart dhcpcd
```

## WiFi-Konfiguration mit wpa_supplicant

### Standard-Konfiguration

Konfigurationsdatei: `/etc/wpa_supplicant/wpa_supplicant-wlan0.conf`

```
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=DE

network={
    ssid="DEIN_NETZWERK"
    psk="DEIN_PASSWORT"
    key_mgmt=WPA-PSK
    scan_ssid=1
    priority=100
}
```

**WICHTIG:** Diese Datei enthält sensible Daten und sollte NICHT ins Git!

### Service aktivieren

```bash
sudo systemctl enable wpa_supplicant@wlan0
sudo systemctl start wpa_supplicant@wlan0
```

## Status und Diagnose

### WiFi-Verbindung prüfen

```bash
# Interface-Status
sudo iw dev wlan0 info

# Regulatorische Domain prüfen
iw reg get

# Verbindungsstatus
sudo wpa_cli -i wlan0 status

# IP-Adresse prüfen
ip addr show wlan0

# Routing-Tabelle
ip route
```

### DHCP-Status

```bash
# dhcpcd Status
systemctl status dhcpcd

# dhcpcd Logs
sudo journalctl -u dhcpcd -n 50
```

### WiFi-Signalstärke und -Qualität

```bash
# Signal-Info
sudo iw dev wlan0 link

# Scan für verfügbare Netzwerke
sudo iw dev wlan0 scan | grep -E "(SSID|signal|freq)"
```

## Bekannte Probleme und Lösungen

### Problem: status_code=16 Fehler

**Ursache:** Kernel 6.12 brcmfmac Treiber-Bug
**Lösung:** Downgrade auf Kernel 6.1 (siehe oben)

### Problem: Link-Local IP (169.254.x.x)

**Ursache:** DHCP-Server nicht erreichbar oder zu langsam
**Lösung:**
- dhcpcd Konfiguration mit `noipv4ll` (siehe oben)
- WiFi-Signalstärke prüfen
- Router DHCP-Dienst prüfen

### Problem: WiFi verbindet, aber kein Internet

**Lösung:**

```bash
# DNS prüfen
cat /etc/resolv.conf

# Routing prüfen
ip route

# Ping Gateway
ping 192.168.2.1

# Ping Internet
ping 8.8.8.8
```

## Weitere Informationen

- **GitHub Issue:** Debian Trixie 2.4GHz WiFi Bug ist bekannt
- **Kernel 6.1:** Wird von Debian Bookworm verwendet und ist stabil
- **brcmfmac:** Broadcom FullMAC WiFi-Treiber für Raspberry Pi
- **Regulatory Domain:** DE (Deutschland) muss für 2.4GHz Channel 1-13 gesetzt sein
