# OSRM Waterway Routing Data

Die vorkompilierten OSRM-Daten für deutsche Wasserstraßen sind **nicht** im Git-Repository enthalten (zu groß: 378 MB komprimiert / 5.4 GB unkomprimiert).

## Option 1: Daten selbst erstellen (Empfohlen)

Verwende das Extract-Script um die Daten frisch zu erstellen:

```bash
# Alle Bundesländer
./scripts/extract_regions.sh all

# Einzelne Regionen
./scripts/extract_regions.sh sachsen-anhalt
./scripts/extract_regions.sh niedersachsen
./scripts/extract_regions.sh brandenburg
```

**Voraussetzungen:**
- OSRM Binaries installiert (siehe `osrm-binaries/README.md`)
- Waterway Profile vorhanden (`profiles/waterway_working.lua`)
- Genug Speicherplatz (~10 GB temporär)
- Zeit: ~2-4 Stunden für alle Bundesländer

**Vorteile:**
- Immer aktuelle OSM-Daten
- Nur benötigte Regionen
- Keine großen Downloads

## Option 2: Backup von anderem System kopieren

Wenn du bereits eine Installation mit OSRM-Daten hast:

```bash
# Auf dem Quell-System (z.B. arielle)
cd ~/BoatOS/data
tar -czf osrm_backup_$(date +%Y%m%d).tar.gz osrm/*.osrm*

# Auf dem Ziel-System
scp user@source-system:~/BoatOS/data/osrm_backup_*.tar.gz ~/
cd ~/BoatOS/data
tar -xzf ~/osrm_backup_*.tar.gz
```

## Option 3: Download vorgefertigtes Backup

*(Optional: Kann auf Cloud-Storage hochgeladen werden)*

Download-Link: [Noch nicht verfügbar]

```bash
# Download
wget https://example.com/osrm_bundeslaender_waterway.tar.gz

# Extract
cd ~/BoatOS/data
tar -xzf ~/osrm_bundeslaender_waterway.tar.gz
```

## Enthaltene Regionen

Die vollständige OSRM-Daten-Sammlung enthält alle 16 deutschen Bundesländer:

- **Norddeutschland**: Hamburg, Bremen, Niedersachsen, Schleswig-Holstein, Mecklenburg-Vorpommern
- **Ostdeutschland**: Berlin, Brandenburg, Sachsen, Sachsen-Anhalt, Thüringen
- **Westdeutschland**: Nordrhein-Westfalen, Rheinland-Pfalz, Saarland, Hessen
- **Süddeutschland**: Baden-Württemberg, Bayern

## Benötigte Regionen

Welche Regionen du brauchst, hängt von deinem Fahrtgebiet ab:

### Elbe-Havel Kanal
- Sachsen-Anhalt ✅
- Brandenburg ✅
- Berlin (optional)

### Mittellandkanal
- Niedersachsen ✅
- Nordrhein-Westfalen ✅
- Sachsen-Anhalt ✅

### Rhein-Main
- Hessen ✅
- Rheinland-Pfalz ✅
- Nordrhein-Westfalen ✅

### Oder-Havel-Kanal
- Brandenburg ✅
- Berlin ✅

### Nord-Ostsee-Kanal
- Schleswig-Holstein ✅

### Müritz / Mecklenburgische Seenplatte
- Mecklenburg-Vorpommern ✅
- Brandenburg ✅

## OSRM Service konfigurieren

Nach der Daten-Extraktion muss der OSRM-Service auf die richtige Region konfiguriert werden:

```bash
# Service stoppen
sudo systemctl stop osrm

# Service-Konfiguration bearbeiten
sudo nano /etc/systemd/system/osrm.service
```

Ändere die ExecStart-Zeile:
```ini
ExecStart=/usr/local/bin/osrm-routed --algorithm=MLD /home/USER/BoatOS/data/osrm/REGION-latest.osrm --port 5000
```

Beispiele:
- `/home/arielle/BoatOS/data/osrm/sachsen-anhalt-latest.osrm` (Elbe)
- `/home/arielle/BoatOS/data/osrm/niedersachsen-latest.osrm` (Mittellandkanal)
- `/home/arielle/BoatOS/data/osrm/brandenburg-latest.osrm` (Oder-Havel)

```bash
# Service neu laden und starten
sudo systemctl daemon-reload
sudo systemctl start osrm

# Status prüfen
sudo systemctl status osrm
```

## Speicherplatz

### Unkomprimierte Größen (pro Region)

| Region | Größe | Hauptwasserstraßen |
|--------|-------|-------------------|
| Sachsen-Anhalt | ~340 MB | Elbe, Saale |
| Niedersachsen | ~1.2 GB | Mittellandkanal, Weser, Ems |
| Brandenburg | ~820 MB | Havel, Oder-Havel-Kanal, Spree |
| Nordrhein-Westfalen | ~1.8 GB | Rhein, Wesel-Datteln-Kanal |
| Mecklenburg-Vorpommern | ~680 MB | Müritz-Elde, Peene, Warnow |
| Bayern | ~1.4 GB | Donau, Main-Donau-Kanal, Main |
| Baden-Württemberg | ~1.1 GB | Rhein, Neckar |

**Total (alle 16 Bundesländer)**: ~5.4 GB unkomprimiert

### Backup-Größen

- **Komprimiert (tar.gz)**: ~378 MB (alle Bundesländer)
- **Unkomprimiert**: ~5.4 GB (alle Bundesländer)

## Troubleshooting

### OSRM-Service startet nicht

```bash
# Logs anzeigen
sudo journalctl -u osrm -n 50

# Häufige Fehler:
# - "Cannot open file": Falscher Pfad in osrm.service
# - "Permission denied": sudo chown arielle:arielle ~/BoatOS/data/osrm/*
```

### Routing gibt keine Ergebnisse

- Prüfe ob die Route in der aktiven Region liegt
- Teste OSRM direkt: `curl "http://localhost:5000/route/v1/driving/11.6167,52.1205;11.6267,52.1305"`
- Aktiviere passende Region für dein Fahrtgebiet

### Zu wenig Speicherplatz

```bash
# Nur benötigte Regionen extrahieren
./scripts/extract_regions.sh sachsen-anhalt niedersachsen

# Alte PBF-Dateien löschen
rm ~/osrm_regions/*.osm.pbf

# Temporäre Dateien löschen
rm ~/osrm_regions/*.osrm.{edges,geometry,icd,mldgr,etc}
```

## Updates

OSM-Daten ändern sich ständig (neue Wasserstraßen, Updates). Empfehlung:

- **Regelmäßig aktualisieren**: Alle 3-6 Monate
- **Nach größeren OSM-Änderungen**: Neue Kanäle, Schleusen
- **Vor Törnbeginn**: Sicherstellen, dass aktuelle Daten vorhanden

```bash
# Re-extract bestimmte Region
./scripts/extract_regions.sh sachsen-anhalt

# Service neu starten
sudo systemctl restart osrm
```

## Links

- **OSM Data Download**: https://download.geofabrik.de/europe/germany/
- **OSRM Backend**: https://github.com/Project-OSRM/osrm-backend
- **Waterway Profile**: `profiles/waterway_working.lua`
- **Extract Script**: `scripts/extract_regions.sh`
