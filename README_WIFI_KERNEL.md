# WiFi und Kernel-Konfiguration für BoatOS

## Problem: 2.4GHz WiFi funktioniert nicht nach Neuinstallation

**Symptome:**
- Debian Trixie (Testing) mit Kernel 6.12.47+ hat einen Bug im brcmfmac WiFi-Treiber
- 2.4GHz WiFi-Verbindungen schlagen fehl mit `status_code=16` (Unsupported capability)
- 5GHz WiFi funktioniert einwandfrei
- Problem tritt auf trotz korrekter Regulatory Domain "DE"
- **Vor der Neuinstallation funktionierte alles!**

## ✅ Lösung: Kernel 6.1 + Firmware-Downgrade

**WICHTIG:** Die Lösung besteht aus **ZWEI Schritten**:
1. Kernel 6.1 Installation
2. **Firmware-Downgrade auf Bookworm-Version** (Dies ist der kritische Schritt!)

### Schritt 1: Bookworm Repository hinzufügen

```bash
echo "deb http://archive.raspberrypi.com/debian bookworm main" | sudo tee /etc/apt/sources.list.d/bookworm.list
sudo apt-get update
```

### Schritt 2: Kernel 6.1 installieren

```bash
sudo apt-get install -y linux-image-6.1.0-rpi8-rpi-v8
```

### Schritt 3: Kernel in Boot-Partition kopieren

```bash
sudo cp /boot/vmlinuz-6.1.0-rpi8-rpi-v8 /boot/firmware/kernel8-6.1.img
sudo cp /boot/initrd.img-6.1.0-rpi8-rpi-v8 /boot/firmware/initramfs8-6.1
```

### Schritt 4: Boot-Konfiguration anpassen

In `/boot/firmware/config.txt` am Ende hinzufügen:

```
# Use Kernel 6.1 for 2.4GHz WiFi compatibility
kernel=kernel8-6.1.img
initramfs initramfs8-6.1 followkernel
```

### Schritt 5: ⚠️ KRITISCH - Firmware-Downgrade

**Dies ist der wichtigste Schritt!**

```bash
# Firmware auf Bookworm-Version downgraden
sudo apt-get install --allow-downgrades -y firmware-brcm80211=1:20240709-2~bpo12+1+rpt4

# Firmware-Version prüfen
dpkg -l | grep firmware-brcm80211
# Sollte zeigen: 1:20240709-2~bpo12+1+rpt4
```

**Warum?** Die Trixie-Firmware (1:20241210-1+rpt3) von Dezember 2024 hat einen Bug. Die Bookworm-Firmware (Juli 2024) funktioniert einwandfrei.

### Schritt 6: System neu starten

```bash
sudo reboot
```

### Schritt 7: Kernel und Firmware prüfen

Nach dem Neustart:

```bash
# Kernel-Version prüfen
uname -r
# Sollte ausgeben: 6.1.0-rpi8-rpi-v8

# Firmware-Version prüfen
dpkg -l | grep firmware-brcm80211
# Sollte zeigen: 1:20240709-2~bpo12+1+rpt4
```

## WiFi-Konfiguration mit wpa_supplicant

### ⚠️ WICHTIGE REGELN

1. **NIEMALS `priority` Parameter verwenden** - verursacht Verbindungsprobleme!
2. **NIEMALS wpa_supplicant während Laufzeit neustarten** - funktioniert nur beim Boot!
3. **Nur komplette System-Reboots** für WiFi-Konfigurationsänderungen

### Einzelnes Netzwerk

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
}
```

### Mehrere Netzwerke (ohne priority!)

**Das erste Netzwerk in der Liste wird automatisch bevorzugt:**

```
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=DE

# Erstes Netzwerk wird bevorzugt
network={
    ssid="HAUPTNETZWERK"
    psk="passwort1"
    key_mgmt=WPA-PSK
    scan_ssid=1
}

# Zweites Netzwerk als Fallback
network={
    ssid="FALLBACK_NETZWERK"
    psk="passwort2"
    key_mgmt=WPA-PSK
    scan_ssid=1
}
```

**WICHTIG:**
- ❌ **KEINE `priority` Parameter verwenden!**
- ✅ **Reihenfolge der Netzwerke bestimmt Priorität**
- ⚠️ **Nach Änderungen: `sudo reboot` (NICHT wpa_supplicant restart!)**

### Service aktivieren

```bash
sudo systemctl enable wpa_supplicant@wlan0
sudo systemctl enable dhcpcd
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

## Status und Diagnose

### WiFi-Verbindung prüfen

```bash
# Interface-Status
sudo iw dev wlan0 info

# Regulatorische Domain prüfen
/usr/sbin/iw reg get

# Verbindungsstatus (wpa_state sollte COMPLETED sein)
sudo wpa_cli -i wlan0 status

# IP-Adresse prüfen
ip addr show wlan0

# Routing-Tabelle
ip route
```

### Erfolgreiche Verbindung erkennen

```bash
sudo wpa_cli -i wlan0 status
```

**Erfolg sieht so aus:**
```
wpa_state=COMPLETED
ssid=DEIN_NETZWERK
freq=2462
key_mgmt=WPA2-PSK
ip_address=192.168.x.x
```

**Problem:**
```
wpa_state=DISCONNECTED  # oder SCANNING
# Fehler in Logs: status_code=16
```

### DHCP-Status

```bash
# dhcpcd Status
systemctl status dhcpcd

# dhcpcd Logs
sudo journalctl -u dhcpcd -n 50
```

### wpa_supplicant Logs prüfen

```bash
# Letzte Logs prüfen
sudo journalctl -u wpa_supplicant@wlan0 -n 30

# Auf Fehler prüfen
sudo journalctl -u wpa_supplicant@wlan0 | grep "ASSOC-REJECT"
```

## Bekannte Probleme und Lösungen

### Problem: status_code=16 Fehler

**Ursache 1:** Falsche Firmware-Version (Trixie-Firmware hat Bug)
**Lösung:** Firmware-Downgrade auf Bookworm-Version (siehe oben)

**Ursache 2:** `priority` Parameter in wpa_supplicant.conf
**Lösung:** Alle `priority=` Zeilen entfernen, dann `sudo reboot`

**Ursache 3:** wpa_supplicant wurde während Laufzeit neugestartet
**Lösung:** Kompletter System-Reboot mit `sudo reboot`

### Problem: WiFi funktioniert nach Boot, aber nicht nach wpa_supplicant restart

**Ursache:** Bekannter Bug in Kombination Kernel 6.1 + Bookworm-Firmware
**Lösung:**
- ⚠️ **NIEMALS `sudo systemctl restart wpa_supplicant@wlan0` verwenden!**
- ✅ **Immer `sudo reboot` für WiFi-Änderungen**

### Problem: Link-Local IP (169.254.x.x)

**Ursache:** DHCP-Server nicht erreichbar oder zu langsam (oder eth0 hat bereits DHCP-Lease im gleichen Netzwerk)
**Lösung:**
- dhcpcd Konfiguration mit `noipv4ll` (siehe oben)
- WiFi-Signalstärke prüfen
- Router DHCP-Dienst prüfen
- **Normal wenn eth0 und wlan0 im selben Netzwerk** - wlan0 bekommt nur IP wenn eth0 nicht verbunden ist

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

## Fehlersuche Schritt-für-Schritt

### 1. Firmware-Version prüfen

```bash
dpkg -l | grep firmware-brcm80211
```

**Richtig:** `1:20240709-2~bpo12+1+rpt4` (Bookworm)
**Falsch:** `1:20241210-1+rpt3` (Trixie - hat Bug!)

### 2. Kernel-Version prüfen

```bash
uname -r
```

**Richtig:** `6.1.0-rpi8-rpi-v8`
**Falsch:** `6.12.*` (zu neu, hat Probleme)

### 3. wpa_supplicant.conf prüfen

```bash
cat /etc/wpa_supplicant/wpa_supplicant-wlan0.conf
```

**Prüfe:**
- ❌ Keine `priority=` Zeilen (entfernen!)
- ✅ `country=DE` ist gesetzt
- ✅ SSID und Passwort korrekt

### 4. WiFi-Status beim Boot prüfen

```bash
# Nach Reboot warten (mind. 60 Sekunden)
sudo wpa_cli -i wlan0 status

# Sollte zeigen:
# wpa_state=COMPLETED
# ssid=DEIN_NETZWERK
```

### 5. Logs nach Fehlern durchsuchen

```bash
# Status_code=16 Fehler suchen
sudo journalctl -u wpa_supplicant@wlan0 | grep "status_code=16"

# Wenn status_code=16 erscheint:
# → Firmware downgraden (siehe oben)
# → priority Parameter entfernen
# → Vollständiger Reboot
```

## Deployment-Checkliste

Vor dem Einsatz am Zielort prüfen:

- [ ] Kernel 6.1.0-rpi8-rpi-v8 installiert (`uname -r`)
- [ ] Firmware 1:20240709-2~bpo12+1+rpt4 installiert (`dpkg -l | grep firmware-brcm`)
- [ ] `/etc/wpa_supplicant/wpa_supplicant-wlan0.conf` korrekt konfiguriert
- [ ] KEINE `priority` Parameter in wpa_supplicant.conf
- [ ] wpa_supplicant@wlan0 Service enabled (`systemctl is-enabled wpa_supplicant@wlan0`)
- [ ] dhcpcd Service enabled (`systemctl is-enabled dhcpcd`)
- [ ] Test-Reboot durchgeführt und WiFi verbindet automatisch
- [ ] `sudo wpa_cli -i wlan0 status` zeigt `wpa_state=COMPLETED`

## Weitere Informationen

- **Root Cause:** Debian Trixie Firmware (Dezember 2024) hat einen Bug mit 2.4GHz WiFi
- **Lösung:** Downgrade auf Bookworm Firmware (Juli 2024) + Kernel 6.1
- **Kernel 6.1:** Stabile LTS-Version von Debian Bookworm
- **brcmfmac:** Broadcom FullMAC WiFi-Treiber für Raspberry Pi
- **Regulatory Domain:** DE (Deutschland) für 2.4GHz Kanal 1-13
- **priority Bug:** Verwendung von `priority` Parametern verursacht status_code=16 Fehler
- **wpa_supplicant Bug:** Restart während Laufzeit funktioniert nicht - nur Boot-Time-Verbindung ist stabil
