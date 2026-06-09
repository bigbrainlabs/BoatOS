# WiFi Configuration

BoatOS manages WiFi through the built-in WiFi manager — accessible in **Helm** (touchscreen) and **Deck** (browser).

---

## Connect to a network

### Via Helm (touchscreen)

1. Open the Settings tab → **WiFi**
2. Tap **"Scan networks"**
3. Tap the desired network
4. Enter the password (eye icon to reveal) → **"Connect"**

### Via Deck (browser)

1. Open `https://boatos.local` in your browser
2. Settings → **WiFi**
3. **"Scan networks"** → select network → enter password → Connect

---

## Manage saved networks

Networks you connect to are saved automatically. The Pi will reconnect automatically on the next boot.

**Forget a network:**
- Helm: open the WiFi sheet → tap **"Forget"** next to the saved network
- Deck: Settings → WiFi → saved network → **"Delete"**

---

## Hotspot

When no known WiFi is in range, the Pi can create its own hotspot. Other devices then connect directly to the Pi.

**Start hotspot:**
- Helm: open WiFi sheet → **"Start hotspot"**
- Deck: Settings → WiFi → **"📡 Start hotspot"**

**Hotspot credentials** are shown in the Helm overlay and the Deck banner:

| | |
|---|---|
| SSID | `BoatOS-Setup` |
| Password | `boatos1234` |
| IP (BoatOS) | `192.168.4.1` |

After connecting to the hotspot, open `https://192.168.4.1` in your browser.

> ⚠️ **Security note:** The hotspot password `boatos1234` is a publicly known default. Change it after initial setup under **Settings → WiFi → Hotspot password** before using BoatOS at a marina or any public mooring.

> **Note:** The hotspot runs on 2.4 GHz. In confined spaces (e.g. a marina) it may briefly interfere with other WiFi devices. Stop it when not in use.

**Stop hotspot:**
- Helm: tap the banner → **"Stop"**
- Deck: **"Stop"** button

---

## Restart the WiFi adapter

If you have connection problems (e.g. after a long journey without WiFi), the adapter can be re-initialized — without rebooting the Pi.

- Helm: open WiFi sheet → **↺ button** (top right in the header)
- Deck: Settings → WiFi → **"↺ Restart adapter"**

The process takes ~10 seconds. A new scan starts automatically afterwards.

---

## Common problems

| Problem | Solution |
|---|---|
| Connection always fails | Check the password (use the eye icon) — pay attention to upper/lower case |
| Pi doesn't reconnect automatically | Forget the network and reconnect |
| WiFi keeps dropping | Restart the adapter (↺ button) |
| Hotspot starts but connection fails | Set a static IP on the device: `192.168.4.2`, mask `255.255.255.0`, gateway `192.168.4.1` |
| `boatos.local` not reachable | Use the IP address directly — Windows requires Bonjour for mDNS |
