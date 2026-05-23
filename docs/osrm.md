# OSRM einrichten (Offline-Routing auf Wasserstraßen)

BoatOS nutzt [OSRM](https://project-osrm.org/) für Wasserweg-Routing — schnell (<100 ms), vollständig offline, mit einem eigenen Wasserwege-Profil. Ohne OSRM fällt das Routing auf direkte Luftlinie zurück.

---

## Übersicht

```
OSM-Rohdaten (.osm.pbf)
    └─ osrm-extract (waterway.lua)
    └─ osrm-partition
    └─ osrm-customize
         └─ osrm-routed (Port 5000) → BoatOS Routing
```

---

## Schritt 1 — OSRM bauen (aus Quellcode)

Fertige ARM64-Binaries gibt es nicht — OSRM muss auf dem Pi selbst gebaut werden. Das dauert ca. 30–60 Minuten.

```bash
sudo apt install -y build-essential git cmake pkg-config \
  libbz2-dev libxml2-dev libzip-dev libboost-all-dev \
  lua5.2 liblua5.2-dev libtbb-dev

cd ~
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install
```

Binaries landen in `/usr/local/bin/`: `osrm-extract`, `osrm-partition`, `osrm-customize`, `osrm-routed`.

---

## Schritt 2 — Wasserweg-Profil einrichten

Das Standard-OSRM-Profil routet auf Straßen. BoatOS braucht ein Wasserwege-Profil das nur `waterway=*`-Kanten nutzt.

```bash
# Profil in OSRM ablegen
cp ~/BoatOS/backend/app/waterway.lua ~/osrm-backend/profiles/waterway.lua
```

> Das Profil `waterway.lua` liegt im BoatOS-Repo unter `backend/app/`. Es enthält Gewichtungen für Schleusen, Kanäle und Flüsse.

---

## Schritt 3 — OSM-Daten herunterladen

```bash
mkdir -p ~/osrm_data
cd ~/osrm_data

# Deutschland gesamt (~4 GB)
wget https://download.geofabrik.de/europe/germany-latest.osm.pbf

# Oder ein Bundesland für Tests (z.B. Sachsen-Anhalt ~110 MB)
# wget https://download.geofabrik.de/europe/germany/sachsen-anhalt-latest.osm.pbf
```

---

## Schritt 4 — Routing-Graph erstellen

```bash
cd ~/osrm_data

# 1. Extrahieren (~10–20 Min. für Deutschland)
osrm-extract -p ~/osrm-backend/profiles/waterway.lua germany-latest.osm.pbf

# 2. Partitionieren
osrm-partition germany-latest.osrm

# 3. Anpassen
osrm-customize germany-latest.osrm

# Fertige Dateien in BoatOS-Datenverzeichnis kopieren
mkdir -p ~/BoatOS/data/osrm
cp germany-latest.osrm* ~/BoatOS/data/osrm/
```

### Einzelne Bundesländer (empfohlen für Test-Pi)

Das Skript `scripts/extract_regions.sh` automatisiert Download + Extraktion für alle deutschen Bundesländer:

```bash
# Interaktiv — Menü zeigt alle Bundesländer
bash ~/BoatOS/scripts/extract_regions.sh

# Direkt ein Bundesland
bash ~/BoatOS/scripts/extract_regions.sh sachsen-anhalt

# Alle Bundesländer auf einmal
bash ~/BoatOS/scripts/extract_regions.sh all
```

---

## Schritt 5 — Systemd-Service einrichten

```bash
sudo nano /etc/systemd/system/osrm.service
```

Inhalt:

```ini
[Unit]
Description=OSRM Waterway Routing
After=network.target

[Service]
Type=simple
User=arielle
ExecStart=/usr/local/bin/osrm-routed \
  --algorithm=MLD \
  --port 5000 \
  /home/arielle/BoatOS/data/osrm/germany-latest.osrm
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=osrm

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now osrm.service

# Status prüfen
sudo systemctl status osrm.service
```

> **Wichtig:** OSRM bindet nur an IPv4 (`127.0.0.1:5000`). Das Backend nutzt explizit `127.0.0.1` statt `localhost` um IPv6-Auflösung zu vermeiden.

---

## Routing testen

```bash
# Testroute: Magdeburg → Berlin (Elbe/Havel)
curl "http://127.0.0.1:5000/route/v1/driving/11.6167,52.1205;13.4050,52.5200?overview=full&geometries=geojson"
# Erwartet: JSON mit "code":"Ok" und einer Route entlang der Wasserstraßen
```

---

## Region wechseln

Im laufenden Betrieb kann die aktive Region über die BoatOS-API gewechselt werden — ohne SSH:

**Deck:** Einstellungen → Navigation → OSRM-Region  
**API:** `POST /api/routing/switch-region` mit `{"region": "sachsen-anhalt"}`

Das Backend stoppt `osrm-routed`, startet ihn mit der neuen Region neu und wartet auf Health-Check.

---

## Mehrere Regionen gleichzeitig

OSRM kann nur eine Region pro Prozess laden. Für mehrstufige Reisen (z.B. Hamburg → Berlin → Dresden) alle betroffenen Bundesländer zusammenführen:

```bash
# osmium muss installiert sein
sudo apt install -y osmium-tool

osmium merge \
  ~/osrm_data/niedersachsen-latest.osm.pbf \
  ~/osrm_data/hamburg-latest.osm.pbf \
  ~/osrm_data/schleswig-holstein-latest.osm.pbf \
  -o ~/osrm_data/nordwest.osm.pbf

# Dann nordwest.osm.pbf extrahieren wie in Schritt 4
```

---

## Häufige Probleme

| Problem | Lösung |
|---|---|
| `osrm-routed` startet nicht | `systemctl status osrm` — Pfad zur `.osrm`-Datei prüfen |
| Routing liefert Luftlinie | OSRM nicht erreichbar oder außerhalb geladener Region — `curl http://127.0.0.1:5000/...` testen |
| `distance=0` in Antwort | Koordinaten außerhalb der geladenen Kartendaten |
| Build bricht ab (OOM) | Swap vergrößern (s. tileserver.md) oder cross-kompilieren auf PC |
| `NoSegment` Fehler | Wegpunkt liegt nicht auf einer Wasserstraße — OSRM snapped automatisch zum nächsten Knoten |
