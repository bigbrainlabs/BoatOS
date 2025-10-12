#!/bin/bash
# Script to extract additional German Bundesländer for OSRM waterway routing
set -e

echo "🚢 OSRM Waterway Region Extractor"
echo "=================================="
echo ""

OSRM_BACKEND="$HOME/osrm-backend"
OSRM_REGIONS="$HOME/osrm_regions"
BOATOS_DATA="$HOME/BoatOS/data/osrm"

# Check if OSRM is installed
if ! command -v osrm-extract &> /dev/null; then
    echo "❌ OSRM not found. Please run install.sh first."
    exit 1
fi

# Check if waterway profile exists
if [ ! -f "$OSRM_BACKEND/profiles/waterway.lua" ]; then
    echo "❌ Waterway profile not found at $OSRM_BACKEND/profiles/waterway.lua"
    exit 1
fi

# Available German regions
REGIONS=(
    "baden-wuerttemberg" "bayern" "berlin" "brandenburg"
    "bremen" "hamburg" "hessen" "mecklenburg-vorpommern"
    "niedersachsen" "nordrhein-westfalen" "rheinland-pfalz"
    "saarland" "sachsen" "sachsen-anhalt"
    "schleswig-holstein" "thueringen"
)

# Show menu if no argument provided
if [ $# -eq 0 ]; then
    echo "Verfügbare Regionen:"
    echo ""
    for i in "${!REGIONS[@]}"; do
        printf "  %2d) %s\n" $((i+1)) "${REGIONS[$i]}"
    done
    echo ""
    echo "  all) Alle Bundesländer extrahieren"
    echo ""
    read -p "Region auswählen (Nummer, Name oder 'all'): " selection

    if [ "$selection" = "all" ]; then
        SELECTED_REGIONS=("${REGIONS[@]}")
    elif [[ "$selection" =~ ^[0-9]+$ ]] && [ $selection -ge 1 ] && [ $selection -le ${#REGIONS[@]} ]; then
        SELECTED_REGIONS=("${REGIONS[$((selection-1))]}")
    else
        SELECTED_REGIONS=("$selection")
    fi
else
    if [ "$1" = "all" ]; then
        SELECTED_REGIONS=("${REGIONS[@]}")
    else
        SELECTED_REGIONS=("$@")
    fi
fi

# Create regions directory
mkdir -p "$OSRM_REGIONS"
cd "$OSRM_REGIONS"

echo ""
echo "Extracting ${#SELECTED_REGIONS[@]} region(s)..."
echo ""

for REGION in "${SELECTED_REGIONS[@]}"; do
    echo "=== Processing: $REGION ==="

    # Download if not exists
    if [ ! -f "${REGION}-latest.osm.pbf" ]; then
        echo "  [1/4] Downloading OSM data..."
        wget -q --show-progress "https://download.geofabrik.de/europe/germany/${REGION}-latest.osm.pbf"
    else
        echo "  [1/4] OSM data already downloaded"
    fi

    # Extract
    echo "  [2/4] Extracting with waterway profile..."
    osrm-extract -p "$OSRM_BACKEND/profiles/waterway.lua" "${REGION}-latest.osm.pbf"

    # Partition
    echo "  [3/4] Partitioning..."
    osrm-partition "${REGION}-latest.osrm"

    # Customize
    echo "  [4/4] Customizing..."
    osrm-customize "${REGION}-latest.osrm"

    echo "  ✅ $REGION complete!"
    echo ""
done

# Copy all to BoatOS data directory
echo "Copying OSRM data to $BOATOS_DATA..."
cp *.osrm* "$BOATOS_DATA/" 2>/dev/null || true

echo ""
echo "✅ Extraction complete!"
echo ""
echo "Total OSRM files: $(ls $BOATOS_DATA/*.osrm 2>/dev/null | wc -l)"
echo ""
echo "To switch regions, update the OSRM service:"
echo "  sudo systemctl stop osrm"
echo "  sudo nano /etc/systemd/system/osrm.service  # Change .osrm file"
echo "  sudo systemctl daemon-reload"
echo "  sudo systemctl start osrm"
