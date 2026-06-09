# tilemaker einrichten

Alle drei Dateien müssen im selben Verzeichnis wie `creator.py` liegen.

## 1. tilemaker.exe

Releases-Seite: https://github.com/systemed/tilemaker/releases

- Neueste Version wählen
- Windows-ZIP herunterladen (z. B. `tilemaker-windows-amd64.zip`)
- `tilemaker.exe` aus dem ZIP in dieses Verzeichnis kopieren

## 2. Konfigurationsdateien

Aus dem tilemaker-Repository: https://github.com/systemed/tilemaker

Benötigte Dateien aus dem Ordner `resources/`:

- `config-openmaptiles.json`
- `process-openmaptiles.lua`

Beide Dateien ebenfalls in dieses Verzeichnis kopieren.

## 3. Water Polygons (automatisch)

Die Datei `water-polygons-split-4326.zip` wird beim ersten Start automatisch heruntergeladen
und in dieses Verzeichnis entpackt (~800 MB). Einmalig nötig.

## Verzeichnisstruktur danach

```
mbtiles-creator/
  creator.py
  requirements.txt
  tilemaker.exe
  config-openmaptiles.json
  process-openmaptiles.lua
  water-polygons-split-4326/   ← automatisch erstellt
  tmp/                          ← temporäre Dateien (PBF, mbtiles)
```
