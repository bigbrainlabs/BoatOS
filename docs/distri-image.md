# BoatOS Distribution Image

## Idee

Ein fertiges, flashbares Raspberry Pi Image das sofort einsatzbereit ist —
inklusive OSRM-Routing, Kartendaten und allen Diensten. Kein manuelles
Installieren und Konfigurieren nötig.

## Inhalt des Images

- Raspberry Pi OS (Bookworm, 64-bit)
- BoatOS Code (aktueller Stand)
- OSRM Routing-Graphen (alle Bundesländer + Wasserstraßen, fertig verarbeitet)
- `germany.mbtiles` (Vektorkarten für martin tile server)
- ENC Seekarten (`data/charts/`)
- Alle Systemdienste vorkonfiguriert (nginx, boatos, tileserver, OSRM)
- Chromium Kiosk-Setup (Wayland/labwc)
- First-Boot-Script (fragt nach WiFi, API-Keys)

## Was bereinigt wird (vor Veröffentlichung)

- `data/settings.json` → Template mit Platzhaltern
- `data/crew.json`, `data/logbook/`, `data/fuel.json` → gelöscht
- `~/.ssh/` → gelöscht
- WiFi-Passwörter (`/etc/NetworkManager/system-connections/`) → gelöscht
- Chromium-Profil → geleert
- `~/.bash_history` → gelöscht
- Git-Config → generisch

## First-Boot-Script

Beim ersten Start fragt ein Script interaktiv nach:
- WiFi SSID + Passwort
- AIS Stream API-Key
- (Optional) Hostname

Trägt alles automatisch ein und startet die Dienste.

## Hosting

Das Image (~8–12 GB komprimiert) wird in der Cloud gehostet (kein GitHub — zu groß).
Download-Link wird im Haupt-README verlinkt.

## Workflow zur Erstellung

```bash
# 1. Auf Pi: persönliche Daten bereinigen
# 2. dd + pishrink → boatos_distri.img.gz
# 3. Upload in Cloud
# 4. README-Link aktualisieren
```

## Status

- [ ] First-Boot-Script schreiben
- [ ] Bereinigungsscript schreiben
- [ ] Distri-Image erstellen und testen
- [ ] Cloud-Hosting einrichten
- [ ] README-Link eintragen
