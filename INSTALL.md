# BoatOS Installation Guide

## Systemanforderungen

- **Betriebssystem**: Debian/Ubuntu basiert (getestet auf Debian 12)
- **Hardware**: Raspberry Pi 4 oder vergleichbar (min. 2GB RAM)
- **GPS**: USB GPS-Empfänger (z.B. U-blox, wird als /dev/ttyACM* erkannt)
- **Netzwerk**: WiFi oder Ethernet

## Abhängigkeiten

### 1. System-Pakete installieren

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv nginx git curl
```

### 2. Node.js für SignalK installieren

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. SignalK Server installieren

SignalK ist ein Open-Source Marine Data Server, der GPS und andere Sensordaten verwaltet.

```bash
# SignalK als normaler Benutzer installieren
sudo npm install -g --unsafe-perm signalk-server

# SignalK Service erstellen
sudo tee /etc/systemd/system/signalk.service > /dev/null << 'SIGNALK'
[Unit]
Description=SignalK Server
After=network.target

[Service]
Type=simple
User=
WorkingDirectory=/home/
ExecStart=/usr/bin/signalk-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SIGNALK

# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable signalk
sudo systemctl start signalk
```

SignalK läuft standardmäßig auf Port 3000: http://localhost:3000

### 4. SignalK GPS-Verbindung konfigurieren

Nach der Installation muss SignalK mit dem GPS-Modul verbunden werden:

1. GPS-Device identifizieren:
   ```bash
   ls -la /dev/ttyACM*
   ```

2. Benutzer zur dialout-Gruppe hinzufügen:
   ```bash
   sudo usermod -a -G dialout 
   ```

3. SignalK Konfiguration bearbeiten (`~/.signalk/settings.json`):
   ```json
   {
     interfaces: {},
     ssl: false,
     pipedProviders: [
       {
         id: gps,
         pipeElements: [
           {
             type: providers/simple,
             options: {
               type: NMEA0183,
               subOptions: {
                 type: serial,
                 device: /dev/ttyACM1,
                 baudrate: 9600
               },
               logging: false,
               providerId: gps,
               suppress0183event: false
             }
           }
         ],
         enabled: true
       }
     ],
     security: {
       strategy: ./tokensecurity
     }
   }
   ```

4. SignalK neu starten:
   ```bash
   sudo systemctl restart signalk
   ```

## BoatOS Installation

### 1. Repository klonen

```bash
cd /home/
git clone https://github.com/yourusername/BoatOS.git
cd BoatOS
```

### 2. Backend einrichten

```bash
cd backend

# Python Virtual Environment erstellen
python3 -m venv venv
source venv/bin/activate

# Abhängigkeiten installieren
pip install -r requirements.txt
```

**requirements.txt** sollte enthalten:
```
fastapi
uvicorn[standard]
paho-mqtt
httpx
pynmea2
beautifulsoup4
lxml
pyproj
```

### 3. BoatOS Systemd Service erstellen

```bash
sudo tee /etc/systemd/system/boatos.service > /dev/null << 'BOATOS'
[Unit]
Description=BoatOS Backend API
After=network.target signalk.service
Requires=signalk.service

[Service]
Type=simple
User=
WorkingDirectory=/home//BoatOS/backend
ExecStart=/home//BoatOS/backend/venv/bin/python app/main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
BOATOS

# Platzhalter ersetzen
sudo sed -i s/$USER//g /etc/systemd/system/boatos.service

# Service aktivieren und starten
sudo systemctl daemon-reload
sudo systemctl enable boatos
sudo systemctl start boatos
```

### 4. Nginx für Frontend konfigurieren

```bash
sudo tee /etc/nginx/sites-available/boatos > /dev/null << 'NGINX'
server {
    listen 80;
    server_name _;

    # Frontend
    location / {
        root /home//BoatOS/frontend;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection upgrade;
        proxy_set_header Host $host;
    }

    # SignalK Proxy (optional)
    location /signalk/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
    }
}
NGINX

# Platzhalter ersetzen
sudo sed -i s/$USER//g /etc/nginx/sites-available/boatos

# Site aktivieren
sudo ln -sf /etc/nginx/sites-available/boatos /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Nginx neu starten
sudo nginx -t
sudo systemctl restart nginx
```

## Konfiguration

### Backend Konfiguration

Die wichtigsten Einstellungen in `backend/app/main.py`:

- **SignalK URL**: Standardmäßig `http://localhost:3000`
- **MQTT Server**: Falls gewünscht für externe Sensoren
- **OpenWeatherMap API Key**: Für Wetterdaten

### Frontend Konfiguration

Die Frontend-Dateien in `frontend/`:
- `index.html` - Haupt-UI
- `app.js` - Hauptlogik
- `i18n.js` - Übersetzungen (DE/EN)
- `style.css` - Styling

## Dienste verwalten

```bash
# Status prüfen
sudo systemctl status signalk
sudo systemctl status boatos
sudo systemctl status nginx

# Logs anzeigen
sudo journalctl -u signalk -f
sudo journalctl -u boatos -f

# Dienste neu starten
sudo systemctl restart signalk
sudo systemctl restart boatos
sudo systemctl restart nginx
```

## Zugriff

Nach erfolgreicher Installation:

- **BoatOS UI**: http://your-pi-ip/
- **SignalK Dashboard**: http://your-pi-ip:3000/
- **Backend API**: http://your-pi-ip/api/sensors

## Fehlerbehebung

### GPS wird nicht erkannt

```bash
# GPS Device prüfen
ls -la /dev/ttyACM*
dmesg | grep -i gps

# Direkt vom GPS lesen (Strg+C zum Beenden)
cat /dev/ttyACM1

# Benutzerrechte prüfen
groups   # sollte dialout enthalten

# Falls nicht, hinzufügen und neu anmelden:
sudo usermod -a -G dialout 
```

### SignalK empfängt keine GPS-Daten

```bash
# SignalK Logs prüfen
sudo journalctl -u signalk -n 50

# SignalK API testen
curl http://localhost:3000/signalk/v1/api/
```

### BoatOS zeigt keine GPS-Daten

```bash
# Backend Logs prüfen
sudo journalctl -u boatos -n 50

# API testen
curl http://localhost:8000/api/sensors
```

## Updates

```bash
cd /home//BoatOS
git pull

# Backend neu starten
sudo systemctl restart boatos

# Frontend wird automatisch von Nginx bereitgestellt
```

## Deinstallation

```bash
# Services stoppen und deaktivieren
sudo systemctl stop boatos signalk
sudo systemctl disable boatos signalk

# Service-Dateien entfernen
sudo rm /etc/systemd/system/boatos.service
sudo rm /etc/systemd/system/signalk.service
sudo systemctl daemon-reload

# Nginx-Konfiguration entfernen
sudo rm /etc/nginx/sites-enabled/boatos
sudo rm /etc/nginx/sites-available/boatos
sudo systemctl restart nginx

# BoatOS Dateien entfernen
rm -rf /home//BoatOS
rm -rf /home//.signalk

# SignalK deinstallieren
sudo npm uninstall -g signalk-server
```
