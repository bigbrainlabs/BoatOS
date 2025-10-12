# OSRM ARM64 Binaries für BoatOS

Dieses Verzeichnis enthält vorkompilierte OSRM-Binaries für ARM64 (aarch64) Systeme wie Raspberry Pi 4/5.

## Enthaltene Dateien

- `osrm-arm64-binaries.tar.gz` - Neueste Version (Symlink)
- `osrm-arm64-binaries-YYYYMMDD.tar.gz` - Datierte Versionen

## Inhalt des Archives

```
/usr/local/bin/osrm-routed     (4.1 MB) - OSRM Routing Server
/usr/local/bin/osrm-extract    (4.6 MB) - OSM Data Extractor
/usr/local/bin/osrm-partition  (838 KB) - Graph Partitioner
/usr/local/bin/osrm-customize  (1.4 MB) - Graph Customizer
```

**Total**: ~11 MB unkomprimiert, ~3.6 MB komprimiert

## Installation

Die Binaries werden automatisch vom install.sh Script installiert:

```bash
cd BoatOS
./install.sh
```

### Manuelle Installation

```bash
cd /tmp
tar xzf osrm-arm64-binaries.tar.gz
sudo mv osrm-routed osrm-extract osrm-partition osrm-customize /usr/local/bin/
sudo chmod +x /usr/local/bin/osrm-*
```

## Voraussetzungen

- **Architektur**: ARM64 (aarch64)
- **OS**: Linux (Debian/Ubuntu/Raspberry Pi OS 64-bit)
- **Libraries**:
  - libtbb (Threading Building Blocks)
  - libboost (1.74+)
  - zlib

Die Abhängigkeiten werden von install.sh automatisch installiert.

## Build-Info

- **Compiled on**: Raspberry Pi 5 (ARM Cortex-A76)
- **OS**: Raspberry Pi OS 64-bit (Debian Bookworm)
- **OSRM Version**: Latest from https://github.com/Project-OSRM/osrm-backend
- **Compiler**: GCC 12.2.0
- **Build Type**: Release (optimized)

## Verwendung

### OSRM Server starten

```bash
# Mit systemd (automatisch nach Installation)
sudo systemctl start osrm

# Manuell
osrm-routed --algorithm=MLD /path/to/data.osrm --port 5000
```

### OSM Daten extrahieren

```bash
# Mit Waterway Profile
osrm-extract -p profiles/waterway.lua region.osm.pbf
osrm-partition region.osrm
osrm-customize region.osrm
```

## OSRM Waterway Daten

Vorkompilierte OSRM-Daten für deutsche Wasserstraßen sind **NICHT** im Git-Repository enthalten (zu groß: 378 MB komprimiert / 5.4 GB unkomprimiert).

### Daten Download

Die OSRM-Daten können mit dem extract_regions.sh Script erstellt werden:

```bash
./scripts/extract_regions.sh all
```

Oder einzelne Bundesländer:

```bash
./scripts/extract_regions.sh sachsen-anhalt
./scripts/extract_regions.sh niedersachsen
./scripts/extract_regions.sh mecklenburg-vorpommern
```

### Verfügbare Regionen

Alle 16 deutschen Bundesländer:
- Baden-Württemberg, Bayern, Berlin, Brandenburg
- Bremen, Hamburg, Hessen, Mecklenburg-Vorpommern
- Niedersachsen, Nordrhein-Westfalen, Rheinland-Pfalz
- Saarland, Sachsen, Sachsen-Anhalt
- Schleswig-Holstein, Thüringen

## Troubleshooting

### "osrm-routed: command not found"

```bash
# Check if binary exists
ls -la /usr/local/bin/osrm-*

# Add to PATH if needed
export PATH=$PATH:/usr/local/bin
```

### "error while loading shared libraries"

```bash
# Install missing dependencies
sudo apt install -y libtbb2 libboost-all-dev zlib1g
```

### Re-compile from source

Wenn die Binaries nicht kompatibel sind:

```bash
cd ~
git clone https://github.com/Project-OSRM/osrm-backend.git
cd osrm-backend
mkdir build && cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
make -j$(nproc)
sudo make install
```

## Links

- OSRM Backend: https://github.com/Project-OSRM/osrm-backend
- OSRM Docs: http://project-osrm.org/
- BoatOS: https://github.com/bigbrainlabs/BoatOS
