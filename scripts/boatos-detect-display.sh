#!/bin/bash
# Detect a connected TOUCHSCREEN before lightdm starts (headless-safe).
#
# Creates /run/boatos/has-display only if a touchscreen input device is present
# AND Helm is not manually disabled. lightdm gates Helm on this file via
# ConditionPathExists (see scripts/lightdm-helm-condition.conf).
#
# Why touchscreen and not "display connected": Helm is a touchscreen app. On a
# plain HDMI monitor without touch — or fully headless — it must NOT start.
# A touchscreen input device implies a usable panel; the DRM connector "status"
# is unreliable for DSI/DPI panels (they often report "unknown", not "connected").
#
# Runs Before=lightdm.service, so lightdm waits for this to finish first.

set -u

mkdir -p /run/boatos
rm -f /run/boatos/has-display

log() { echo "boatos-detect-display: $*" >&2; }   # captured by systemd journal

# ── Manual override: user disabled Helm via Deck (/api/system/helm) ──────────
BOATOS_USER=$(systemctl show boatos.service -p User --value 2>/dev/null)
[ -n "$BOATOS_USER" ] || BOATOS_USER=boatos
BOATOS_HOME=$(getent passwd "$BOATOS_USER" | cut -d: -f6)
if [ -n "$BOATOS_HOME" ] && [ -f "$BOATOS_HOME/.boatos_helm_disabled" ]; then
    log "Helm manually disabled — skipping."
    exit 0
fi

# Our own phone-remote uinput device (created by boatos-remote.service) also
# registers as a touchscreen. It runs even headless — so it MUST be excluded,
# otherwise a Pi without a physical panel would falsely pass and start Helm.
VIRTUAL_TOUCH_NAME="BoatOS Remote Touch"

# ── Touchscreen detection (generic: works for DSI / USB / I2C panels) ────────
# Relies on udev's ID_INPUT_TOUCHSCREEN (set for any ABS_MT device); physical
# panels often have vendor names without the word "touch" (e.g. "QDtech MPI1001"),
# so name matching alone is unreliable — udev is the source of truth here.
has_touchscreen() {
    local dev name
    for dev in /dev/input/event*; do
        [ -e "$dev" ] || continue
        name=$(cat "/sys/class/input/$(basename "$dev")/device/name" 2>/dev/null)
        [ "$name" = "$VIRTUAL_TOUCH_NAME" ] && continue   # skip our virtual remote
        if udevadm info --query=property --name="$dev" 2>/dev/null \
             | grep -q '^ID_INPUT_TOUCHSCREEN=1'; then
            return 0
        fi
    done
    return 1
}

# Let udev finish processing already-plugged devices first.
udevadm settle --timeout=10 2>/dev/null || true

# Bounded wait: USB/I2C touch controllers can enumerate slightly after boot.
# Exits immediately once a touchscreen appears; only a truly touch-less boot
# (headless or display-only) waits out the full window (~4s) before skipping.
for _i in $(seq 1 8); do
    if has_touchscreen; then
        touch /run/boatos/has-display
        log "Touchscreen detected — Helm enabled."
        exit 0
    fi
    sleep 0.5
done

log "No touchscreen detected — Helm skipped (headless-safe)."
exit 0
