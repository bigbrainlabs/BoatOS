# BoatOS Installation

Es gibt zwei Wege: das fertige **Image** (empfohlen für Einsteiger) oder die **manuelle Installation** aus dem Repository (für Fortgeschrittene).

---

## Weg 1 — Fertig-Image flashen (empfohlen)

Alles ist vorkonfiguriert: Dienste, Karten, Routing, Flutter-App. Flashen, einschalten, fertig.

### Voraussetzungen

- Raspberry Pi 4 (2 GB RAM oder mehr)
- SD-Karte ≥ 32 GB (Class 10 / A1)
- [Raspberry Pi Imager](https://www.raspberrypi.com/software/) auf deinem PC/Mac

### Schritt 1 — Image herunterladen

**[⬇️ Download v1.5.0 (archive.org, ~15 GB)](https://archive.org/details/boatos-distri-image)**

### Schritt 2 — SD-Karte flashen

1. Raspberry Pi Imager öffnen
2. **"Choose OS"** → **"Use custom"** → heruntergeladene `.img.gz` auswählen
3. **"Choose Storage"** → deine SD-Karte auswählen
4. **Zahnrad-Icon** (⚙️) öffnen:
   - **Hostname** setzen (z.B. `boatos`)
   - **SSH aktivieren** (Passwort-Auth)
   - **WLAN** eintragen (SSID + Passwort) — optional, kann auch später über die App konfiguriert werden
5. **"Write"** → warten bis fertig

### Schritt 3 — Einschalten

SD-Karte in den Pi, Strom anlegen. Beim ersten Start dauert es ~60 Sekunden bis alle Dienste laufen.

### Schritt 4 — Deck aufrufen

Im Browser (Handy, Tablet oder Laptop im gleichen WLAN):

```
https://boatos.local
```

> Zertifikatswarnung einfach wegklicken — das Zertifikat ist selbst-signiert.

Falls `boatos.local` nicht funktioniert (Windows ohne Bonjour): IP-Adresse des Pi im Router nachschauen.

### Schritt 5 — WLAN konfigurieren (falls noch nicht gemacht)

Über **Deck** → Einstellungen → WLAN oder direkt über den **Helm**-Touchscreen.  
Siehe [wlan-config.md](wlan-config.md).

---

## Weg 2 — Manuelle Installation aus dem Repository

Für Nutzer die ein frisches Raspberry Pi OS aufsetzen und BoatOS manuell installieren möchten.

### Voraussetzungen

- Raspberry Pi 4 mit **Raspberry Pi OS Bookworm 64-bit** (Lite reicht)
- SSH-Zugang oder Tastatur/Monitor am Pi
- Internetverbindung am Pi

### Schritt 1 — System vorbereiten

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git python3-pip python3-venv nginx nodejs npm \
  mosquitto mosquitto-clients lightdm
```

### Schritt 2 — Repository klonen

```bash
cd ~
git clone https://github.com/bigbrainlabs/BoatOS.git
cd BoatOS
```

### Schritt 3 — Backend einrichten

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Systemd-Service einrichten:

```bash
sudo cp scripts/boatos.service /etc/systemd/system/
sudo systemctl enable --now boatos.service
```

### Schritt 4 — Deck (Web-Frontend) einrichten

```bash
sudo cp scripts/nginx-boatos.conf /etc/nginx/sites-available/boatos
sudo ln -s /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### Schritt 5 — Helm (Flutter-App) einrichten

flutter-pi installieren:

```bash
sudo apt install -y libgl1-mesa-dev libgles2-mesa-dev libegl1-mesa-dev \
  libdrm-dev libgbm-dev fonts-noto-color-emoji
```

Vorkompiliertes Binary herunterladen oder selbst bauen (siehe [v2-flutter-pi.md](v2-flutter-pi.md)).

lightdm Autologin konfigurieren:

```bash
sudo raspi-config
# System Options → Boot / Auto Login → Desktop Autologin
```

Startscript einrichten:

```bash
cp scripts/boatos-v2.sh ~/boatos-v2.sh
chmod +x ~/boatos-v2.sh
# In ~/.config/labwc/autostart eintragen oder lightdm-Session konfigurieren
```

### Schritt 6 — Weitere Dienste

**SignalK** (GPS):

```bash
sudo npm install -g signalk-server
sudo systemctl enable --now signalk
```

**Mosquitto** (MQTT):

```bash
sudo systemctl enable --now mosquitto
```

**OSRM** (Routing) und **Tileserver** (Karten) sind optional und nur für vollständige Offline-Navigation nötig — Anleitung folgt.

### Schritt 7 — Erster Start

```bash
sudo systemctl restart boatos.service
sudo systemctl restart nginx
sudo reboot
```

Nach dem Neustart: `https://boatos.local` im Browser aufrufen.

---

## Häufige Probleme

| Problem | Lösung |
|---|---|
| `boatos.local` nicht erreichbar | IP-Adresse im Router nachschauen, oder `https://<IP>` direkt aufrufen |
| Zertifikatswarnung im Browser | Warnung bestätigen / "Trotzdem fortfahren" — das ist normal |
| Helm zeigt Login-Screen | `sudo systemctl restart lightdm` per SSH |
| Backend antwortet nicht | `sudo systemctl status boatos.service` — Logs prüfen |
| Kein GPS | SignalK prüfen: `sudo systemctl status signalk` |
