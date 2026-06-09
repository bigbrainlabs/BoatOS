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

- Raspberry Pi 4 with **Raspberry Pi OS Bookworm 64-bit** (Lite is sufficient)
- SSH access or keyboard/monitor connected to the Pi
- Internet connection on the Pi

### Step 1 — Prepare the system

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-pip python3-venv nginx nodejs npm \
  mosquitto mosquitto-clients lightdm
```

### Step 2 — Clone the repository

```bash
cd ~
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS
```

### Step 3 — Set up the backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Set up the systemd service:

```bash
sudo cp scripts/boatos.service /etc/systemd/system/
sudo systemctl enable --now boatos.service
```

### Step 4 — Set up Deck (web frontend)

```bash
sudo cp scripts/nginx-boatos.conf /etc/nginx/sites-available/boatos
sudo ln -s /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Step 5 — Set up Helm (Flutter app)

Install flutter-pi:

```bash
sudo apt install -y libgl1-mesa-dev libgles2-mesa-dev libegl1-mesa-dev \
  libdrm-dev libgbm-dev fonts-noto-color-emoji
```

Download the pre-compiled binary or build it yourself (see [v2-flutter-pi.md](v2-flutter-pi.md)).

Configure lightdm auto-login:

```bash
sudo raspi-config
# System Options → Boot / Auto Login → Desktop Autologin
```

Set up the start script:

```bash
cp scripts/boatos-v2.sh ~/boatos-v2.sh
chmod +x ~/boatos-v2.sh
# Add to ~/.config/labwc/autostart or configure the lightdm session
```

### Step 6 — Additional services

**SignalK** (GPS):

```bash
sudo npm install -g signalk-server
sudo systemctl enable --now signalk
```

**Mosquitto** (MQTT):

```bash
sudo systemctl enable --now mosquitto
```

**Tileserver** (maps) and **OSRM** (routing) are required for full offline navigation — see [tileserver.md](tileserver.md) and [osrm.md](osrm.md).

> **Online operation without tileserver:** The satellite image (ESRI) and nautical overlays (OpenSeaMap) load from the internet. The base map (rivers, roads, coastlines) and OSRM routing work **only locally** — without tileserver/OSRM you will see only a grey background and no routing.

### Step 7 — First start

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
