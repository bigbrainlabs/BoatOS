#!/bin/bash
# Deploy BoatOS Flutter app to Pi via flutter-pi
# Usage: ./deploy.sh

FLUTTERPI_TOOL="$LOCALAPPDATA/Pub/Cache/bin/flutterpi_tool.bat"
PI_HOST="arielle@192.168.2.222"
PI_KEY="$HOME/.ssh/id_rsa_boatos"
PI_DEST="/home/arielle/BoatOS/flutter_app"
BUILD_DIR="build/flutter-pi/pi4-64"

echo "==> Building for Pi4 ARM64 (release)..."
"$FLUTTERPI_TOOL" build --arch=arm64 --cpu=pi4 --release

echo "==> Deploying to Pi..."
ssh -i "$PI_KEY" "$PI_HOST" "mkdir -p $PI_DEST"
# Deploy flutter-pi release binary (version-matched to engine)
scp -i "$PI_KEY" "$BUILD_DIR/flutter-pi" "$PI_HOST:/home/arielle/flutter-pi-release"
ssh -i "$PI_KEY" "$PI_HOST" "chmod +x /home/arielle/flutter-pi-release"
# Deploy app bundle
scp -i "$PI_KEY" \
  "$BUILD_DIR/app.so" \
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

echo "==> Clearing tile cache and restarting BoatOS UI..."
ssh -i "$PI_KEY" "$PI_HOST" "rm -rf /tmp/.vector_map && sudo systemctl restart lightdm"

echo "==> Done."
