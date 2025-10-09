# BoatOS Schnellstart-Anleitung

## Installation in 5 Minuten

### 1. Archiv entpacken

```bash
# Archiv auf den Raspberry Pi kopieren
scp BoatOS-install-20251009.tar.gz pi@your-pi-ip:/home/pi/

# Auf dem Raspberry Pi:
cd /home/pi
tar -xzf BoatOS-install-20251009.tar.gz
cd BoatOS
```

### 2. Installation ausführen

```bash
./install.sh
```

Das Skript installiert automatisch:
- ✅ Node.js
- ✅ SignalK Server
- ✅ Python Virtual Environment
- ✅ Alle Python-Abhängigkeiten
- ✅ Nginx Webserver
- ✅ Systemd Services

### 3. GPS konfigurieren

GPS-Device finden:
```bash
ls -la /dev/ttyACM*
```

SignalK Konfiguration bearbeiten:
```bash
nano ~/.signalk/settings.json
```

Füge hinzu (oder passe an):
```json
{
  "interfaces": {},
  "ssl": false,
  "pipedProviders": [
    {
      "id": "gps",
      "pipeElements": [
        {
          "type": "providers/simple",
          "options": {
            "type": "NMEA0183",
            "subOptions": {
              "type": "serial",
              "device": "/dev/ttyACM1",
              "baudrate": 9600
            },
            "logging": false,
            "providerId": "gps",
            "suppress0183event": false
          }
        }
      ],
      "enabled": true
    }
  ],
  "security": {
    "strategy": "./tokensecurity"
  }
}
```

Services neu starten:
```bash
sudo systemctl restart signalk
sudo systemctl restart boatos
```

### 4. Ab-/Anmelden

Wichtig für dialout-Gruppe:
```bash
exit
# Oder:
logout
```

Dann wieder anmelden.

### 5. BoatOS öffnen

Browser öffnen und eingeben:
```
http://192.168.x.x/
```
(Ersetze mit der IP deines Raspberry Pi)

## Fertig! 🎉

Du solltest jetzt:
- ✅ Eine Karte sehen
- ✅ Deine GPS-Position sehen (nach ein paar Minuten)
- ✅ Wetterdaten sehen
- ✅ GPS-Details öffnen können

## Probleme?

### GPS wird nicht erkannt
```bash
# GPS-Daten direkt lesen (Strg+C zum Beenden)
cat /dev/ttyACM1

# Sollte NMEA-Sätze wie ,... zeigen
```

### SignalK-Logs prüfen
```bash
sudo journalctl -u signalk -n 50
```

### BoatOS-Logs prüfen
```bash
sudo journalctl -u boatos -n 50
```

### Service-Status prüfen
```bash
sudo systemctl status signalk
sudo systemctl status boatos
sudo systemctl status nginx
```

## Weitere Hilfe

Siehe [INSTALL.md](INSTALL.md) für detaillierte Anleitung.
