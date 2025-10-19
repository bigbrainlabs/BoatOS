# SSH-Verbindung zum BoatOS Server

## Server Details
- **IP-Adresse**: 192.168.2.217
- **Benutzer**: arielle
- **SSH-Key**: ~/.ssh/rsa_arielle
- **Hostname**: boatos
- **OS**: Linux 6.12.47+rpt-rpi-2712 (Raspberry Pi, Debian, aarch64)
- **Home-Verzeichnis**: /home/arielle
- **BoatOS-Pfad**: /home/arielle/BoatOS
- **Disk Space**: 235GB total, ~38GB verwendet, ~187GB verfügbar

## Verbindungsmethoden

### Option 1: Über SSH-Config Alias (empfohlen)
```bash
ssh boatos-admin
```

oder

```bash
ssh arielle
```

### Option 2: Direkte Verbindung
```bash
ssh -i ~/.ssh/rsa_arielle arielle@192.168.2.217
```

## SSH-Config
Die SSH-Konfiguration befindet sich in `~/.ssh/config` und enthält folgende Einträge:

```
Host boatos-admin
  HostName 192.168.2.217
  User arielle
  IdentityFile ~/.ssh/rsa_arielle

Host arielle 192.168.2.217
  HostName 192.168.2.217
  User arielle
  IdentityFile ~/.ssh/rsa_arielle
```

## Verfügbare SSH-Keys
- `~/.ssh/rsa_arielle` - Private Key für arielle (3.4K)
- `~/.ssh/rsa_arielle.pub` - Public Key für arielle
- `~/.ssh/id_rsa_arielle` - Alternative Key (falls benötigt)
- `~/.ssh/claude_boatos` - Key für claude user

## BoatOS auf dem Server

Das BoatOS-Projekt befindet sich in `/home/arielle/BoatOS`:
```bash
# Zum BoatOS-Verzeichnis wechseln
ssh boatos-admin 'cd ~/BoatOS && ls -la'

# Docker-Container prüfen
ssh boatos-admin 'cd ~/BoatOS && docker-compose ps'

# Logs ansehen
ssh boatos-admin 'cd ~/BoatOS && docker-compose logs -f'
```

## Nützliche Befehle

### Verbindung testen
```bash
ssh boatos-admin 'echo "Connection successful!"'
```

### Systeminfo abrufen
```bash
ssh boatos-admin 'uname -a'
ssh boatos-admin 'df -h'
ssh boatos-admin 'free -h'
ssh boatos-admin 'uptime'
```

### System neu starten
```bash
# Neustart
ssh boatos-admin 'sudo reboot'

# Herunterfahren
ssh boatos-admin 'sudo shutdown -h now'
```

### Docker-Befehle
```bash
# Alle Container ansehen
ssh boatos-admin 'docker ps -a'

# BoatOS Container starten
ssh boatos-admin 'cd ~/BoatOS && docker-compose up -d'

# BoatOS Container stoppen
ssh boatos-admin 'cd ~/BoatOS && docker-compose down'

# Logs verfolgen
ssh boatos-admin 'cd ~/BoatOS && docker-compose logs -f --tail=100'
```

### Services prüfen
```bash
ssh boatos-admin 'systemctl status docker'
ssh boatos-admin 'sudo systemctl status boatos'
```

### Logs anzeigen
```bash
ssh boatos-admin 'journalctl -u docker -f'
```

### Dateien übertragen (SCP)
```bash
# Von lokal zum Server
scp -i ~/.ssh/rsa_arielle /local/file arielle@192.168.2.217:/remote/path

# Vom Server zu lokal
scp -i ~/.ssh/rsa_arielle arielle@192.168.2.217:/remote/file /local/path
```

## Berechtigungen prüfen
Der SSH-Key sollte die richtigen Berechtigungen haben:
```bash
chmod 600 ~/.ssh/rsa_arielle
chmod 644 ~/.ssh/rsa_arielle.pub
```

## Weitere Dokumentation

- **Boot Splash & Desktop Wallpaper**: Siehe [README_BOOT_SPLASH.md](README_BOOT_SPLASH.md)

## Troubleshooting

### Permission denied
Prüfen Sie:
- Sind die Key-Berechtigungen korrekt? (600 für private keys)
- Ist der richtige Public Key auf dem Server hinterlegt?

### Host key verification failed
```bash
ssh-keygen -R 192.168.2.217
```

### Verbose Logging für Debugging
```bash
ssh -vvv -i ~/.ssh/rsa_arielle arielle@192.168.2.217
```
