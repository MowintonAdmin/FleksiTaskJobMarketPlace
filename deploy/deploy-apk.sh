#!/bin/bash
# ============================================================
# FleksiTask — Build Flutter APK and upload to Hetzner server
# Usage: bash deploy/deploy-apk.sh <server-ip-or-host>
# Example: bash deploy/deploy-apk.sh root@46.224.200.76
# ============================================================
set -euo pipefail

SERVER=${1:-"root@46.224.200.76"}
APK_PATH="frontend/flutter/build/app/outputs/flutter-apk/app-release.apk"

echo ">>> Building Flutter release APK..."
cd frontend/flutter
flutter pub get
flutter build apk --release
cd ../..

echo ">>> Uploading APK to $SERVER..."
# Create the downloads directory inside the backend media volume via the container
ssh "$SERVER" "docker exec fleksitask-backend mkdir -p /app/media/downloads"

# Copy APK to server then into the container
scp "$APK_PATH" "${SERVER}:/tmp/fleksitask.apk"
ssh "$SERVER" "docker cp /tmp/fleksitask.apk fleksitask-backend:/app/media/downloads/fleksitask.apk && rm /tmp/fleksitask.apk"

echo ""
echo "✅ Done! APK available at: https://<your-domain>/media/downloads/fleksitask.apk"
echo "   Download button is already on the home page."
