#!/bin/bash
# OSRM Germany Processing Script
# Processes germany-latest.osm.pbf for waterway routing

set -e  # Exit on error

OSRM_DIR="/home/arielle/BoatOS/data/osrm"
PROFILE="/home/arielle/BoatOS/data/osrm/motorboat.lua"
INPUT_FILE="$OSRM_DIR/germany-latest.osm.pbf"
BASE_NAME="$OSRM_DIR/germany-latest"

echo "🇩🇪 Starting OSRM Germany processing..."
echo "📁 Input: $INPUT_FILE"
echo "⚙️ Profile: $PROFILE"
echo ""

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    echo "❌ Error: $INPUT_FILE not found!"
    exit 1
fi

# Check file size (should be ~3.6 GB)
FILE_SIZE=$(du -h "$INPUT_FILE" | cut -f1)
echo "📊 File size: $FILE_SIZE"
echo ""

# Step 1: Extract
echo "🔧 Step 1/3: Extracting waterways from OSM data..."
echo "   This will take ~5-8 minutes..."
/usr/local/bin/osrm-extract "$INPUT_FILE" -p "$PROFILE"

if [ $? -eq 0 ]; then
    echo "✅ Extract completed!"
else
    echo "❌ Extract failed!"
    exit 1
fi
echo ""

# Step 2: Partition
echo "🔧 Step 2/3: Partitioning graph (MLD algorithm)..."
echo "   This will take ~2-3 minutes..."
/usr/local/bin/osrm-partition "$BASE_NAME.osrm"

if [ $? -eq 0 ]; then
    echo "✅ Partition completed!"
else
    echo "❌ Partition failed!"
    exit 1
fi
echo ""

# Step 3: Customize
echo "🔧 Step 3/3: Customizing for motorboat profile..."
echo "   This will take ~1-2 minutes..."
/usr/local/bin/osrm-customize "$BASE_NAME.osrm"

if [ $? -eq 0 ]; then
    echo "✅ Customize completed!"
else
    echo "❌ Customize failed!"
    exit 1
fi
echo ""

# List generated files
echo "📦 Generated files:"
ls -lh "$BASE_NAME".osrm* | awk '{print "   " $9 " - " $5}'
echo ""

echo "🎉 OSRM Germany processing complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Open BoatOS Settings → Routing"
echo "   2. Select 'Deutschland (komplett)' from region dropdown"
echo "   3. Click 'Region wechseln'"
echo "   4. Ready for cross-Bundesland routing!"
