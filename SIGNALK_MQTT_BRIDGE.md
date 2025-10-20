# SignalK to MQTT Bridge

Automatische Bridge, die SignalK-Daten in Echtzeit zu MQTT publiziert.

## Funktionsweise

Das Script `signalk_to_mqtt.py` verbindet sich mit dem SignalK WebSocket (`ws://localhost:3000/signalk/v1/stream`) und published alle empfangenen Daten zum MQTT Broker unter dem Topic-Prefix `boat/`.

### Beispiel-Transformationen

- `navigation.position` → `boat/navigation/position/latitude` + `boat/navigation/position/longitude`
- `navigation.speedOverGround` → `boat/navigation/speedOverGround`
- `navigation.gnss.satellites` → `boat/navigation/gnss/satellites`

## Installation

### Voraussetzungen

```bash
pip3 install paho-mqtt websockets --break-system-packages
```

### Service einrichten

1. Script kopieren:
```bash
sudo cp signalk_to_mqtt.py /home/arielle/BoatOS/
sudo chown arielle:arielle /home/arielle/BoatOS/signalk_to_mqtt.py
sudo chmod +x /home/arielle/BoatOS/signalk_to_mqtt.py
```

2. Service installieren:
```bash
sudo cp signalk-mqtt-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable signalk-mqtt-bridge
sudo systemctl start signalk-mqtt-bridge
```

3. Status prüfen:
```bash
sudo systemctl status signalk-mqtt-bridge
```

## Logs anzeigen

```bash
journalctl -u signalk-mqtt-bridge -f
```

## Integration mit BoatOS

Alle SignalK-Daten erscheinen automatisch im dynamischen Sensor-System von BoatOS:
- Werden unter `boat/` Topics gruppiert
- Erhalten automatisch passende Icons (🧭 für Navigation, etc.)
- Werden mit lesbaren Namen angezeigt ("Navigation › Gnss › Satellites")
- Können über das Settings-UI mit eigenen Alias-Namen versehen werden

## Troubleshooting

**Bridge läuft nicht:**
```bash
sudo systemctl restart signalk-mqtt-bridge
```

**SignalK nicht erreichbar:**
```bash
sudo systemctl status signalk
curl http://localhost:3000/signalk/v1/api/
```

**MQTT Broker nicht erreichbar:**
```bash
sudo systemctl status mosquitto
mosquitto_sub -h localhost -p 1883 -t 'boat/#'
```
