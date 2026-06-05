# Tileserver einrichten (Offline-Karten)

BoatOS nutzt [Martin](https://martin.maplibre.org/) als Tile-Server für Vektorkacheln. Die Basiskarte (Flüsse, Straßen, Küsten, Ortschaften) wird komplett lokal als `.mbtiles`-Datei bereitgestellt — kein Internet nötig.

> **Hinweis:** Ohne Tileserver fehlt die Basiskarte. Das Satellitenbild (ESRI) und OpenSeaMap-Overlays funktionieren weiterhin, solange Internet vorhanden ist.

---

## Übersicht

```
OSM-Rohdaten (.osm.pbf)
    └─ tilemaker → germany.mbtiles
                       └─ martin (Port 8081) → BoatOS Karte
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
# Tile-Anfrage direkt testen (muss JSON zurückgeben)
curl http://localhost:8081/catalog

# Kachelbeispiel (z=10, x=548, y=337 = Mitteldeutschland)
curl -o /dev/null -w "%{http_code}" \
  "http://localhost:8081/germany/10/548/337"
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

Dann den Service anpassen:

```bash
sudo systemctl edit tileserver.service
# ExecStart überschreiben:
# ExecStart=/usr/local/bin/martin --listen-addresses 0.0.0.0:8081 /home/boatos/BoatOS/data/sachsen-anhalt.mbtiles
sudo systemctl restart tileserver.service
```

---

## Häufige Probleme

| Problem | Lösung |
|---|---|
| `martin: command not found` | Binary nicht in `/usr/local/bin` — Pfad prüfen |
| Karte erscheint grau | tileserver nicht gestartet — `systemctl status tileserver` prüfen |
| `tilemaker` bricht mit OOM ab | Swap vergrößern: `sudo dphys-swapfile swapoff && sudo nano /etc/dphys-swapfile` → `CONF_SWAPSIZE=2048` |
| Port 8081 belegt | `sudo ss -tlnp | grep 8081` → anderen Prozess beenden |
| MBTiles-Datei zu groß | Nur benötigte Region konvertieren statt ganz Deutschland |
