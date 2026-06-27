# BoatOS Installation

There are two ways: the pre-built **image** (recommended for beginners) or **manual installation** from the repository (for advanced users).

---

## Option 1 — Flash the pre-built image (recommended)

Everything is pre-configured: services, maps, routing, Flutter app. Flash, power on, done.

### Requirements

- Raspberry Pi 4 (2 GB RAM or more)
- SD card ≥ 32 GB (Class 10 / A1)
- [Raspberry Pi Imager](https://www.raspberrypi.com/software/) on your PC/Mac

### Step 1 — Download the image

**[⬇️ Download v1.6.2 (archive.org, ~7.5 GB)](https://archive.org/download/boatos-distri-image/boatos_v1.6.2.img.gz)**

### Step 2 — Flash the SD card

1. Open Raspberry Pi Imager
2. **"Choose OS"** → **"Use custom"** → select the downloaded `.img.gz`
3. **"Choose Storage"** → select your SD card
4. **"Write"** → wait until finished

> **Note:** The WiFi settings in the gear icon (⚙️) of Pi Imager do **not** work with the BoatOS image — WiFi is configured in the next step directly on the SD card.

### Step 3 — Set up WiFi on the SD card

After flashing, the boot partition of the SD card appears as a normal drive on your PC/Mac. It contains a file called `wlan.txt`:

1. Open `wlan.txt` with a text editor
2. Enter your SSID and password:
   ```
   SSID=YourNetworkName
   PASSWORD=YourPassword
   COUNTRY=DE
   ```
3. Save, safely eject the SD card

On first boot, BoatOS reads this file automatically, connects to WiFi, and deletes `wlan.txt` afterwards (the password is not stored permanently on the boot partition).

> No WiFi available? Boot without a `wlan.txt` entry — BoatOS will then be reachable via Ethernet (`https://boatos.local`). WiFi can be configured at any time via **Deck → Settings → WiFi**.

### Step 4 — Power on

Insert the SD card into the Pi, apply power. On first boot it takes ~60 seconds until all services are running.

### Step 5 — Open Deck

In a browser (phone, tablet, or laptop on the same network):

```
https://boatos.local
```

> Just dismiss the certificate warning — the certificate is self-signed.

If `boatos.local` doesn't work (Windows without Bonjour): check the Pi's IP address in your router.

### ⚠️ Security — Change default passwords

The image ships with publicly known default passwords. **Change these before first use in a marina or any network with other people:**

| Access | Default password | Where to change |
|---|---|---|
| SSH login (`boatos`) | `boatos123` | `passwd` via SSH |
| Hotspot WiFi | `boatos1234` | Deck/Helm → Settings → WiFi → Hotspot |

As long as the Pi runs only on your home network the risk is manageable. At public moorings or marinas, default passwords are a real security problem.

---

## Option 2 — Manual installation from the repository

For users who want to set up a fresh Raspberry Pi OS and install BoatOS manually.

### Requirements

- Raspberry Pi 3, 4, 5 or Zero 2W with **Raspberry Pi OS Bookworm 64-bit** (Lite is sufficient)
- SSH access or keyboard/monitor connected to the Pi
- Internet connection on the Pi

### Step 1 — Clone the repository

```bash
cd ~
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS
```

### Step 2 — Run the install script

```bash
chmod +x install.sh
./install.sh
```

The script installs and configures everything automatically:

- System packages (Python, Node.js 20, nginx, Mosquitto, GDAL, sqlite3, openssl)
- Python backend with virtualenv + all dependencies
- SignalK Server (GPS, via npm)
- Martin vector tile server (offline maps, Port 8081)
- OSRM routing engine (if pre-compiled ARM64 binaries are present)
- Self-signed SSL certificate
- nginx with HTTPS + API proxy
- All systemd services (`boatos`, `signalk`, `tileserver`, `mosquitto`)

> **Log out and back in** after the script finishes — the `dialout` group membership (for GPS access) only takes effect after a fresh login.

### Step 3 — Set up Helm (Flutter touchscreen app)

Helm runs as a Wayland kiosk via `flutter-pi`. This step is done on your **development PC**, not the Pi.

**Build on your PC:**

```bash
flutterpi_tool build --arch=arm64 --cpu=generic --release
```

Build output: `build/flutter-pi/aarch64-generic/`

**Deploy to the Pi:**

```bash
scp build/flutter-pi/aarch64-generic/app.so boatos@boatos.local:~/BoatOS/flutter_app/app.so
ssh boatos@boatos.local "sudo systemctl restart lightdm"
```

For the first deployment (or after a Flutter version bump), also copy the full asset bundle:

```bash
scp -r build/flutter-pi/aarch64-generic/{assets,fonts,shaders,packages,AssetManifest.*,FontManifest.json,icudtl.dat} \
  boatos@boatos.local:~/BoatOS/flutter_app/
```

> See [v2-flutter-pi.md](v2-flutter-pi.md) for how to install `flutter-pi` and `flutterpi_tool` on the Pi and your PC.

### Step 4 — Configure GPS

In SignalK, set up your GPS device:

- **BU-353N5**: `/dev/ttyUSB0` @ 4800 baud
- **GPS mouse**: `/dev/ttyACM0` @ 9600 baud

Edit `~/.signalk/settings.json` or use the SignalK web UI at `http://boatos.local:3000`, then restart:

```bash
sudo systemctl restart signalk
```

### Step 5 — Add offline maps (optional)

Copy your MBTiles files (created with the [MBTiles Creator](https://github.com/bigbrainlabs/BoatOS/releases)) into `~/BoatOS/maps/`, then start the tile server:

```bash
sudo systemctl start tileserver
```

**Tileserver** (maps) and **OSRM** (routing) are required for full offline navigation — see [tileserver.md](tileserver.md) and [osrm.md](osrm.md).

> **Online operation without tileserver:** The satellite image (ESRI) and nautical overlays (OpenSeaMap) load from the internet. The base map (rivers, roads, coastlines) and OSRM routing work **only locally** — without tileserver/OSRM you will see only a grey background and no routing.

### Step 6 — First start

```bash
sudo systemctl restart boatos.service
sudo systemctl restart nginx
sudo reboot
```

After reboot: open `https://boatos.local` in your browser.

---

## Common problems

| Problem | Solution |
|---|---|
| `boatos.local` not reachable | Check the IP address in your router, or use `https://<IP>` directly |
| Certificate warning in browser | Confirm / "Continue anyway" — this is expected |
| Helm shows login screen | `sudo systemctl restart lightdm` via SSH |
| Backend not responding | `sudo systemctl status boatos.service` — check logs |
| No GPS | Check SignalK: `sudo systemctl status signalk` |
