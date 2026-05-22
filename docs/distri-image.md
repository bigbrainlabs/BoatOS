# BoatOS Distribution Image

> **Aktuelle Version: v1.5.11** — `boatos_distri_20260514_final.img.gz` (15 GB, flashbar auf ≥ 32 GB)
> 📥 **Download:** [archive.org/details/boatos-distri-image](https://archive.org/details/boatos-distri-image)

## Idee

Ein fertiges, flashbares Raspberry Pi Image das sofort einsatzbereit ist —
inklusive OSRM-Routing, Kartendaten und allen Diensten. Kein manuelles
Installieren und Konfigurieren nötig.

## Architektur im fertigen Image

```
Pi Boot
  └─ systemd
       ├─ signalk.service         GPS / NMEA (Port 3000)
       ├─ mosquitto.service       MQTT Sensor-Broker (Port 1883)
       ├─ boatos.service          Backend API + WebSocket (Port 8000)
       ├─ tileserver.service      Martin Vektorkacheln (Port 8081)
       ├─ osrm.service            Wasserweg-Routing IPv4-only (Port 5000)
       ├─ nginx                   Deck Web-Frontend HTTPS (Port 80/443)
       └─ lightdm                 Helm Flutter-App (Touchscreen, Framebuffer)
```

- **Helm** (flutter-pi): native Touchscreen-App, kein X11/Wayland nötig
- **Deck** (nginx + Web-Frontend): für Zugriff von Handy / Laptop via Browser

## Inhalt des Images

- Raspberry Pi OS Bookworm 64-bit (`aarch64`)
- BoatOS Code (`~/BoatOS/`) — aktueller Stand
- `~/BoatOS/flutter_app/app.so` — vorkompiliertes Helm-Binary (ARM64)
- OSRM Routing-Graphen (`~/BoatOS/data/osrm/`) — fertig verarbeitet, Wasserstraßen Deutschland
- `~/BoatOS/maps/germany.mbtiles` — Vektorkarten für Martin Tile Server
- Alle Systemdienste vorkonfiguriert (siehe Architektur oben)
- flutter-pi installiert (`/usr/local/bin/flutter-pi`)
- lightdm + Autologin auf Benutzer `arielle`
- SignalK + Node.js installiert
- Mosquitto MQTT Broker konfiguriert

## Was bereinigt wird (vor Veröffentlichung)

**Persönliche Daten:**
- `data/settings.json` → Template mit Platzhaltern (AIS-Key, MQTT-Credentials leer)
- `data/crew.json` → gelöscht
- `data/logbook/` → gelöscht
- `data/fuel.json` → gelöscht
- `~/.ssh/` → gelöscht
- `~/.bash_history` → gelöscht
- `~/.gitconfig` → generisch

**Netzwerk:**
- WiFi-Passwörter (`/etc/NetworkManager/system-connections/`) → gelöscht
- Hostname → generisch (`boatos`)

**SignalK:**
- `~/.signalk/settings.json` → Beispielkonfig mit `/dev/ttyUSB0` @ 4800 baud (BU-353N5)

## First-Boot-Script

Beim ersten Start fragt ein Script interaktiv nach:
- WiFi SSID + Passwort
- AIS Stream API-Key (optional)
- Benutzername (Standard: `arielle`)
- GPS-Device (`/dev/ttyUSB0` oder `/dev/ttyACM0`) + Baudrate

Trägt alles automatisch ein und startet die Dienste neu.

## Workflow zur Image-Erstellung

```bash
# ── Schritt 1: Pi bereinigen ──────────────────────────────────────────────
# Auf dem Pi als Benutzer arielle:
rm -rf ~/.ssh ~/.bash_history
rm -f ~/BoatOS/data/crew.json ~/BoatOS/data/fuel.json
rm -rf ~/BoatOS/data/logbook/*
# settings.json auf Template zurücksetzen (AIS-Key leeren)
sudo rm -f /etc/NetworkManager/system-connections/*
sudo hostnamectl set-hostname boatos

# ── Schritt 2: Image erstellen ────────────────────────────────────────────
# Auf dem Entwicklungs-PC (SD-Karte eingelegt):
sudo dd if=/dev/sdX bs=4M status=progress | gzip > boatos_raw.img.gz

# ── Schritt 3: pishrink ───────────────────────────────────────────────────
# pishrink verkleinert das Image auf die tatsächlich genutzten Blöcke
gunzip boatos_raw.img.gz
sudo pishrink.sh boatos_raw.img boatos_distri.img
gzip -9 boatos_distri.img
# Ergebnis: boatos_distri.img.gz (~8–12 GB)

# ── Schritt 4: Upload + Release ───────────────────────────────────────────
# Cloud-Hosting (Hetzner Object Storage / Cloudflare R2 / etc.)
# Download-Link in README.md eintragen
```

## Flashen (Endnutzer)

```bash
# Mit Raspberry Pi Imager: "Custom Image" → boatos_distri.img.gz auswählen
# Oder manuell:
gunzip -c boatos_distri.img.gz | sudo dd of=/dev/sdX bs=4M status=progress
```

## Hosting

Das Image (~8–12 GB komprimiert) wird in der Cloud gehostet — zu groß für GitHub.
Download-Link wird im Haupt-README verlinkt.

## Status

- [ ] First-Boot-Script schreiben
- [ ] Bereinigungsscript schreiben
- [ ] Helm-Binary (app.so) in Image einbetten + testen
- [ ] Distri-Image erstellen und testen (frisches Flash → Kiosk startet)
- [ ] Cloud-Hosting einrichten
- [ ] README-Link eintragen
