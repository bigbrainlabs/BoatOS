#!/bin/bash
# Detect connected display via DRM/KMS — runs before lightdm at boot.
# Creates /run/boatos/has-display if a display is connected AND Helm is not
# manually disabled. lightdm uses ConditionPathExists on this file.

mkdir -p /run/boatos
rm -f /run/boatos/has-display

# Manual override: user explicitly disabled Helm via Deck
[ -f /home/boatos/.boatos_helm_disabled ] && exit 0

# Check DRM connectors for any connected display (HDMI, DSI, DP, ...)
for status_file in /sys/class/drm/card*-*/status; do
    [ -f "$status_file" ] || continue
    if [ "$(cat "$status_file" 2>/dev/null)" = "connected" ]; then
        touch /run/boatos/has-display
        exit 0
    fi
done

exit 0
