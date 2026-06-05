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

**[⬇️ Download v1.6.1 (archive.org, ~15 GB)](https://archive.org/download/boatos-distri-image/boatos_v1.6.1.img.gz)**

### Schritt 2 — SD-Karte flashen

1. Raspberry Pi Imager öffnen
2. **"Choose OS"** → **"Use custom"** → heruntergeladene `.img.gz` auswählen
3. **"Choose Storage"** → deine SD-Karte auswählen
4. **"Write"** → warten bis fertig

> **Hinweis:** Die WLAN-Einstellungen im Zahnrad-Icon (⚙️) des Pi Imagers funktionieren mit dem BoatOS-Image **nicht** — WLAN wird im nächsten Schritt direkt auf der SD-Karte konfiguriert.

### Schritt 3 — WLAN auf der SD-Karte eintragen

Nach dem Flashen erscheint die Boot-Partition der SD-Karte als normales Laufwerk auf dem PC/Mac. Dort liegt eine Datei namens `wlan.txt`:

1. `wlan.txt` mit einem Texteditor öffnen
2. SSID und Passwort eintragen:
   ```
   SSID=DeinNetzwerkname
   PASSWORD=DeinPasswort
   COUNTRY=DE
   ```
3. Speichern, SD-Karte sicher auswerfen

Beim ersten Boot liest BoatOS diese Datei automatisch ein, verbindet sich mit dem WLAN und löscht `wlan.txt` danach (Passwort wird nicht dauerhaft auf der Boot-Partition gespeichert).

> Kein WLAN verfügbar? SD-Karte ohne `wlan.txt`-Eintrag starten — BoatOS ist dann per Ethernet (`https://boatos.local`) erreichbar. WLAN lässt sich jederzeit über **Deck → Einstellungen → WLAN** nachkonfigurieren.

### Schritt 4 — Einschalten

SD-Karte in den Pi, Strom anlegen. Beim ersten Start dauert es ~60 Sekunden bis alle Dienste laufen.

### Schritt 5 — Deck aufrufen

Im Browser (Handy, Tablet oder Laptop im gleichen WLAN):

```
https://boatos.local
```

> Zertifikatswarnung einfach wegklicken — das Zertifikat ist selbst-signiert.

Falls `boatos.local` nicht funktioniert (Windows ohne Bonjour): IP-Adresse des Pi im Router nachschauen.

### ⚠️ Sicherheit — Standard-Passwörter ändern

Das Image wird mit öffentlich bekannten Standard-Passwörtern ausgeliefert. **Ändere diese vor dem ersten Einsatz in einem Hafen oder Netzwerk mit anderen Personen:**

| Zugang | Standard-Passwort | Ändern unter |
|---|---|---|
| SSH-Login (`boatos`) | `boatos123` | `passwd` per SSH |
| Hotspot WLAN | `boatos1234` | Deck/Helm → Einstellungen → WLAN → Hotspot |

Solange der Pi nur im eigenen Heimnetz läuft, ist das Risiko überschaubar. An öffentlichen Liegeplätzen oder in Marinas sind Standard-Passwörter ein echtes Sicherheitsproblem.

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

**Tileserver** (Karten) und **OSRM** (Routing) sind für vollständige Offline-Navigation nötig — siehe [tileserver.md](tileserver.md) und [osrm.md](osrm.md).

> **Online-Betrieb ohne Tileserver:** Das Satellitenbild (ESRI) und die nautischen Overlays (OpenSeaMap) laden aus dem Internet. Die Basiskarte (Flüsse, Straßen, Küsten) und das OSRM-Routing funktionieren **nur lokal** — ohne Tileserver/OSRM erscheint nur ein grauer Hintergrund, kein Routing.

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
