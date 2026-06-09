# Tileserver einrichten (Offline-Karten)

BoatOS nutzt [Martin](https://martin.maplibre.org/) als Tile-Server für Vektorkacheln. Die Basiskarte (Flüsse, Straßen, Küsten, Ortschaften) wird komplett lokal als `.mbtiles`-Datei bereitgestellt — kein Internet nötig.

> **Hinweis:** Ohne Tileserver fehlt die Basiskarte. Das Satellitenbild (ESRI) und OpenSeaMap-Overlays funktionieren weiterhin, solange Internet vorhanden ist.

---

## Übersicht

```
OSM-Rohdaten (.osm.pbf)
    └─ tilemaker → germany.mbtiles
                       └─ martin (Port 8081) → BoatOS Karte
                                               ↑
                          Backend-Tile-Proxy  ──┘
                          (/api/map/tiles)
                          liest mehrere .mbtiles
```

---

## Schritt 1 — Martin installieren

```bash
# Aktuelles Release von GitHub herunterladen (ARM64 für Pi)
MARTIN_VERSION="v0.14.4"
wget "https://github.com/maplibre/martin/releases/download/${MARTIN_VERSION}/martin-aarch64-unknown-linux-musl.tar.gz"
tar xzf martin-aarch64-unknown-linux-musl.tar.gz
sudo mv martin /usr/local/bin/martin
sudo chmod +x /usr/local/bin/martin

# Test
martin --version
```

---

## Schritt 2 — OSM-Rohdaten herunterladen

```bash
mkdir -p ~/osm_data
cd ~/osm_data

# Deutschland gesamt (~4 GB, dauert je nach Verbindung 15–30 Min.)
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf

# Alternativ: nur ein Bundesland (viel kleiner, schneller)
# wget https://download.geofabrik.de/europe/germany/sachsen-anhalt-latest.osm.pbf
```

---

## Schritt 3 — tilemaker installieren

[tilemaker](https://github.com/systemed/tilemaker) konvertiert OSM-Daten in MBTiles.

```bash
sudo apt install -y build-essential libboost-dev libboost-filesystem-dev \
  libboost-iostreams-dev libboost-program-options-dev libboost-system-dev \
  liblua5.1-dev libsqlite3-dev libshp-dev libprotobuf-dev protobuf-compiler \
  rapidjson-dev

cd ~
git clone https://github.com/systemed/tilemaker.git
cd tilemaker
mkdir build && cd build
cmake ..
make -j$(nproc)
sudo make install
```

---

## Schritt 4 — MBTiles erstellen

```bash
cd ~/tilemaker

# Küsten-Polygon herunterladen (nötig für Land/Wasser-Darstellung)
wget https://osmdata.openstreetmap.de/download/water-polygons-split-4326.zip
unzip water-polygons-split-4326.zip

# Konvertierung starten (~30–90 Min. je nach Region und Pi-Modell)
tilemaker \
  --input ~/osm_data/germany-latest.osm.pbf \
  --output ~/BoatOS/data/germany.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua

# Fertig: ~/BoatOS/data/germany.mbtiles (~1–3 GB)
```

> **Pi 4/5:** Der Prozess braucht ~1 GB RAM. Bei Pi 3 oder wenig RAM ggf. ein einzelnes Bundesland konvertieren.

---

## Schritt 5 — Systemd-Service einrichten

```bash
sudo cp ~/BoatOS/deploy/tileserver.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now tileserver.service

# Status prüfen
sudo systemctl status tileserver.service
```

Der Service startet Martin auf Port 8081 mit `~/BoatOS/data/germany.mbtiles`.

---

## Karte testen

```bash
# Tile-Proxy testen (muss {"ok":true,...} zurückgeben)
curl http://localhost:8000/api/map/tiles

# Kachelbeispiel direkt über Backend (z=10, x=548, y=337 = Mitteldeutschland)
curl -o /dev/null -w "%{http_code}" \
  "http://localhost:8000/api/map/tiles/10/548/337.pbf"
# Erwartet: 200
```

Danach `https://boatos.local` im Browser öffnen — die Karte sollte vollständig erscheinen.

---

## Nur ein Bundesland / kleinere Region

Für den Test-Pi oder Regattafahrten reicht oft ein Bundesland:

```bash
# Beispiel: Sachsen-Anhalt
wget https://download.geofabrik.de/europe/germany/sachsen-anhalt-latest.osm.pbf

tilemaker \
  --input ~/osm_data/sachsen-anhalt-latest.osm.pbf \
  --output ~/BoatOS/data/sachsen-anhalt.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua
```

Die Datei in `~/BoatOS/data/` ablegen — sie erscheint automatisch in den Karteneinstellungen.

---

## Mehrere Regionen / länderübergreifende Navigation

BoatOS kann mehrere `.mbtiles`-Dateien gleichzeitig nutzen. Der Backend-Tile-Proxy fragt beim Laden jeder Kachel alle aktiven Regionen der Reihe nach ab und gibt die erste gefundene zurück — geografisch nicht überlappende Regionen funktionieren damit nahtlos.

### Regionen aktivieren (UI)

**Einstellungen → Karte → Offline-Karten**

Alle `.mbtiles`-Dateien in `~/BoatOS/data/` werden automatisch erkannt und als Toggles angezeigt. Mehrere können gleichzeitig aktiv sein.

### Nachbarländer herunterladen

Alle Regionen sind bei [Geofabrik](https://download.geofabrik.de/) verfügbar:

| Region | URL |
|---|---|
| Niederlande | `https://download.geofabrik.de/europe/netherlands-latest.osm.pbf` |
| Belgien | `https://download.geofabrik.de/europe/belgium-latest.osm.pbf` |
| Frankreich | `https://download.geofabrik.de/europe/france-latest.osm.pbf` |
| Polen | `https://download.geofabrik.de/europe/poland-latest.osm.pbf` |
| Tschechien | `https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf` |
| Österreich | `https://download.geofabrik.de/europe/austria-latest.osm.pbf` |
| Schweiz | `https://download.geofabrik.de/europe/switzerland-latest.osm.pbf` |
| Dänemark | `https://download.geofabrik.de/europe/denmark-latest.osm.pbf` |

### Beispiel: Rhein-Route (Deutschland + Niederlande)

```bash
# Niederlande herunterladen (~900 MB)
wget -P ~/osm_data https://download.geofabrik.de/europe/netherlands-latest.osm.pbf

# MBTiles erstellen (~30–60 Min.)
cd ~/tilemaker
tilemaker \
  --input ~/osm_data/netherlands-latest.osm.pbf \
  --output ~/BoatOS/data/netherlands.mbtiles \
  --config resources/config-openmaptiles.json \
  --process resources/process-openmaptiles.lua
```

Danach in **Einstellungen → Karte → Offline-Karten** beide Regionen aktivieren — die Karte zeigt nahtlos Deutschland und die Niederlande.

### Reihenfolge

Die Reihenfolge der aktiven Regionen bestimmt, welche `.mbtiles` zuerst abgefragt wird. Standardmäßig gilt die alphabetische Reihenfolge. Für beste Performance die häufig genutzte Hauptregion zuerst aktivieren.

### Speicherplatz

| Region | OSM-PBF | MBTiles (ca.) |
|---|---|---|
| Deutschland | 4 GB | 3 GB |
| Niederlande | 900 MB | 700 MB |
| Belgien | 400 MB | 300 MB |
| Österreich | 700 MB | 550 MB |
| Frankreich | 4 GB | 3 GB |

> Die OSM-PBF-Dateien werden nach der Konvertierung nicht mehr benötigt und können gelöscht werden.

---

## Häufige Probleme

| Problem | Lösung |
|---|---|
| `martin: command not found` | Binary nicht in `/usr/local/bin` — Pfad prüfen |
| Karte erscheint grau | Tileserver nicht gestartet — `systemctl status tileserver` prüfen |
| `tilemaker` bricht mit OOM ab | Swap vergrößern: `sudo dphys-swapfile swapoff && sudo nano /etc/dphys-swapfile` → `CONF_SWAPSIZE=2048` |
| Port 8081 belegt | `sudo ss -tlnp | grep 8081` → anderen Prozess beenden |
| MBTiles-Datei zu groß | Nur benötigte Region konvertieren statt ganz Deutschland |
| Region erscheint nicht in Einstellungen | Datei liegt nicht in `~/BoatOS/data/` oder hat keine `.mbtiles`-Endung |
| Kacheln an Landesgrenzen fehlen | Beide Länder aktivieren — jede Kachel wird nur aus einer Datei geladen |
