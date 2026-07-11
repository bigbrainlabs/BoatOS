#!/bin/bash
# Deploy BoatOS Flutter app (Helm) to Pi via flutter-pi
# Usage: ./deploy.sh            → nur app.so (Code-Änderung, Regelfall)
#        ./deploy.sh --full     → app.so + Engine/Binary/Assets (Engine-Upgrade)
#
# System läuft unter User `boatos` (früher `arielle` — existiert nicht mehr).

FLUTTERPI_TOOL="$LOCALAPPDATA/Pub/Cache/bin/flutterpi_tool.bat"
PI_HOST="boatos@192.168.2.222"
PI_KEY="$HOME/.ssh/id_ed25519_boatos"
PI_DEST="/home/boatos/BoatOS/flutter_app"
BUILD_DIR="build/flutter-pi/aarch64-generic"

echo "==> Building for ARM64 generic (Pi3/Pi4/Pi5/Zero2W)..."
"$FLUTTERPI_TOOL" build --arch=arm64 --cpu=generic --release || { echo "Build FAILED"; exit 1; }

echo "==> Deploying app.so (Dart-Code) to Pi..."
ssh -i "$PI_KEY" "$PI_HOST" "mkdir -p $PI_DEST"
scp -i "$PI_KEY" "$BUILD_DIR/app.so" "$PI_HOST:$PI_DEST/"

if [ "$1" = "--full" ]; then
  echo "==> --full: Engine/Binary/Assets mitdeployen (nur bei Engine-Upgrade nötig)..."
  # ACHTUNG: flutter-pi-release nur deployen, wenn Helm NICHT läuft ('Text file busy').
  scp -i "$PI_KEY" "$BUILD_DIR/flutter-pi" "$PI_HOST:/home/boatos/flutter-pi-release" \
    && ssh -i "$PI_KEY" "$PI_HOST" "chmod +x /home/boatos/flutter-pi-release" \
    || echo "   (flutter-pi-Binary übersprungen — läuft evtl. gerade)"
  scp -i "$PI_KEY" \
    "$BUILD_DIR/icudtl.dat" \
    "$BUILD_DIR/libflutter_engine.so" \
    "$BUILD_DIR/AssetManifest.bin" \
    "$BUILD_DIR/AssetManifest.json" \
    "$BUILD_DIR/FontManifest.json" \
    "$PI_HOST:$PI_DEST/"
  scp -i "$PI_KEY" -r \
    "$BUILD_DIR/fonts" \
    "$BUILD_DIR/shaders" \
    "$BUILD_DIR/packages" \
    "$PI_HOST:$PI_DEST/"
fi

echo "==> Clearing tile cache and restarting Helm (lightdm)..."
ssh -i "$PI_KEY" "$PI_HOST" "rm -rf /tmp/.vector_map && sudo systemctl restart lightdm"

echo "==> Done."
