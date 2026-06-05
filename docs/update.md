# Updating BoatOS

> **⚠️ Note for Image v1.5.21:** The update hangs on the first attempt. A one-time SSH workaround is required — see [Known Issues](#known-issues) below.

## Method 1 — Update Button (recommended)

The easiest way — no command line required.

When a new version is available, a notification banner appears automatically in **Deck** and **Helm**.

**Deck:** Settings → System section → **"Install Update"**  
**Helm:** Tap the amber banner in the navigation bar → Start update

The Pi downloads the new version, installs it, and restarts. The process takes 1–3 minutes depending on your internet connection.

---

## Method 2 — Manual via SSH

For technically experienced users or when the update button is not working.

### Connect

```bash
ssh boatos@boatos.local
# or with IP:
ssh boatos@<IP-address>
```

### Run update

```bash
cd ~/BoatOS
bash scripts/update.sh
```

The update script:
- Downloads the latest version from GitHub
- Updates backend dependencies
- Deploys the new Flutter binary (Helm)
- Restarts all services

### Check current version

```bash
cat ~/BoatOS/VERSION
```

Or in Deck: Settings → System → version display.

---

## Notes

- **Charts and routing data** are **not** overwritten by an update — your own map data is preserved.
- **Settings and logbook** are also preserved.
- If there are problems after an update: `sudo systemctl status boatos.service` shows the backend logs.

---

## Known Issues

### Update hangs at `[1/6]` — Image v1.5.21

The update script in the v1.5.21 image contains a bug that causes it to hang. One-time workaround: delete the script via SSH so it is automatically re-downloaded fresh from GitHub on the next update click.

**Requirement:** Pi and PC on the same network. Password: default password (if not changed, see [security note in the installation guide](installation.md#-security--change-default-passwords)).

**Windows (PowerShell):**
```powershell
ssh boatos@boatos.local "rm ~/BoatOS/scripts/update.sh"
```

**Linux / Mac:**
```bash
ssh boatos@boatos.local "rm ~/BoatOS/scripts/update.sh"
```

Then click **Settings → System → Start Update** in Deck. The update will now run through completely. This step is only needed once — from v1.6.2 onwards the update works directly.
