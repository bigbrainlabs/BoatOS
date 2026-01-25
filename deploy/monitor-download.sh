#!/bin/bash
# Monitor OSM Europe download progress

DOWNLOAD_PATH="/home/arielle/maps/data/europe-latest.osm.pbf"
EXPECTED_SIZE_GB=30
CHECK_INTERVAL=300  # Check every 5 minutes

echo "🔍 Monitoring OSM Europe download..."
echo "Expected size: ~${EXPECTED_SIZE_GB}GB"
echo "Check interval: ${CHECK_INTERVAL}s"
echo ""

while true; do
    # Check if wget is still running
    if ! pgrep -f "wget.*europe-latest.osm.pbf" > /dev/null; then
        echo "❌ wget process not found - download may have stopped"

        # Check file size
        if [ -f "$DOWNLOAD_PATH" ]; then
            CURRENT_SIZE=$(du -h "$DOWNLOAD_PATH" | cut -f1)
            CURRENT_SIZE_GB=$(du -BG "$DOWNLOAD_PATH" | cut -f1 | sed 's/G//')

            if [ "$CURRENT_SIZE_GB" -ge "$EXPECTED_SIZE_GB" ]; then
                echo "✅ Download complete! Final size: $CURRENT_SIZE"
                echo ""
                echo "Next steps:"
                echo "1. Run Planetiler to generate tiles (2-4h)"
                echo "   cd /home/arielle/maps"
                echo "   java -Xmx8g -jar planetiler.jar --download --area=europe --output=tiles/europe.mbtiles"
                echo ""
                echo "2. Start tileserver service"
                echo "3. Update nginx configuration"
                echo "4. Deploy MapLibre GL frontend"
                exit 0
            else
                echo "⚠️  Download incomplete: $CURRENT_SIZE (expected ~${EXPECTED_SIZE_GB}GB)"
                exit 1
            fi
        else
            echo "❌ File not found: $DOWNLOAD_PATH"
            exit 1
        fi
    fi

    # Display current progress
    if [ -f "$DOWNLOAD_PATH" ]; then
        CURRENT_SIZE=$(du -h "$DOWNLOAD_PATH" | cut -f1)
        CURRENT_SIZE_GB=$(du -BG "$DOWNLOAD_PATH" | cut -f1 | sed 's/G//')
        PROGRESS=$((CURRENT_SIZE_GB * 100 / EXPECTED_SIZE_GB))

        echo "$(date '+%Y-%m-%d %H:%M:%S') - Progress: $CURRENT_SIZE / ~${EXPECTED_SIZE_GB}GB (${PROGRESS}%)"
    else
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Waiting for download to start..."
    fi

    sleep $CHECK_INTERVAL
done
