# BoatOS Boot Splash & Desktop Wallpaper Konfiguration

## Problem
Beim Booten des Raspberry Pi wurde das Boot-Logo nur kurz angezeigt, danach wurde der Bildschirm schwarz bis der Desktop erschien.

## Lösung
Das Problem war der LightDM Greeter, der einen anderen Wallpaper und Hintergrundfarbe verwendet hat als das Boot-Logo und der Desktop.

## Boot-Prozess
1. **Plymouth Boot Splash** - Zeigt `/usr/share/plymouth/themes/pix/splash.png`
2. **LightDM Greeter** - Zeigt jetzt `/opt/boatos-splash.png`
3. **Desktop (PCManFM)** - Zeigt `/opt/boatos-splash.png`

## Dateien

### Boot Splash Image
- **Haupt-Image**: `/opt/boatos-splash.png` (1920x1080, PNG)
- **Plymouth Theme**: `/usr/share/plymouth/themes/pix/splash.png` (Symlink oder Kopie)
- **Format**: PNG, 1920x1080, 16-bit RGBA

### Konfigurationsdateien

#### 1. Plymouth Boot Splash
**Datei**: `/usr/share/plymouth/themes/pix/pix.plymouth`
```ini
[Plymouth Theme]
Name=pix
Description=Raspberry Pi Desktop Splash
ModuleName=script

[script]
ImageDir=/usr/share/plymouth/themes/pix
ScriptFile=/usr/share/plymouth/themes/pix/pix.script
```

**Aktivierung**: In `/boot/firmware/cmdline.txt` mit Parameter `splash`

#### 2. LightDM Greeter (Login-Screen)
**Datei**: `/etc/lightdm/pi-greeter.conf`
```ini
[greeter]
default-user-image=/usr/share/raspberrypi-artwork/raspberry-pi-logo.png
desktop_bg=#0a0e27
wallpaper=/opt/boatos-splash.png
wallpaper_mode=stretch
```

**Geändert**:
- `wallpaper`: von `/usr/share/rpd-wallpaper/RPiSystem.png` zu `/opt/boatos-splash.png`
- `desktop_bg`: von `#d6d6d3d3dede` zu `#0a0e27`
- `wallpaper_mode`: von `crop` zu `stretch`

#### 3. Desktop Wallpaper (PCManFM)
**Datei**: `~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf`
```ini
[*]
wallpaper_mode=stretch
wallpaper_common=1
wallpaper=/opt/boatos-splash.png
desktop_bg=#0a0e27
desktop_fg=#ffffff
desktop_shadow=#000000
```

## Boot-Parameter
**Datei**: `/boot/firmware/cmdline.txt`
```
console=serial0,115200 console=tty1 root=PARTUUID=677e6785-02 rootfstype=ext4 fsck.repair=yes rootwait quiet splash plymouth.ignore-serial-consoles cfg80211.ieee80211_regdom=DE
```

Wichtige Parameter:
- `quiet` - Unterdrückt Boot-Meldungen
- `splash` - Aktiviert Plymouth
- `plymouth.ignore-serial-consoles` - Verhindert Plymouth auf seriellen Konsolen

## Änderungen vornehmen

### Boot-Splash Image aktualisieren

1. **Neues Bild erstellen** (1920x1080 empfohlen)
   ```bash
   # Lokal erstellen, dann hochladen
   scp your-new-splash.png boatos-admin:/tmp/
   ```

2. **Bild auf dem Server installieren**
   ```bash
   ssh boatos-admin
   sudo cp /tmp/your-new-splash.png /opt/boatos-splash.png
   sudo cp /opt/boatos-splash.png /usr/share/plymouth/themes/pix/splash.png
   ```

3. **Plymouth neu initialisieren**
   ```bash
   sudo update-initramfs -u
   ```

4. **Desktop-Wallpaper aktualisieren** (automatisch beim nächsten Login)
   ```bash
   pcmanfm --set-wallpaper /opt/boatos-splash.png
   ```

### Farben anpassen

**LightDM Greeter**:
```bash
sudo nano /etc/lightdm/pi-greeter.conf
# desktop_bg=#RRGGBB ändern
sudo systemctl restart lightdm
```

**Desktop**:
```bash
nano ~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf
# desktop_bg=#RRGGBB ändern
pcmanfm --reconfigure
```

## Debugging

### Plymouth testen (ohne Neustart)
```bash
# Plymouth im Terminal anzeigen (benötigt Root)
sudo plymouthd
sudo plymouth --show-splash
# 5 Sekunden warten
sleep 5
sudo plymouth quit
```

### Boot-Logs prüfen
```bash
# Systemd Boot-Logs
journalctl -b | grep -i plymouth

# Plymouth-Quit-Wait Timing
systemctl status plymouth-quit-wait.service

# LightDM Start-Zeit
systemctl status lightdm.service
```

### Screenshots vom Boot-Prozess
```bash
# Mit HDMI-Capture-Karte oder
# Foto mit Smartphone machen
```

## Backup

Vor Änderungen wurden Backups erstellt:
- `/etc/lightdm/pi-greeter.conf.backup`
- `/usr/share/plymouth/themes/pix/splash.png.backup`

## Wiederherstellung

Falls etwas schief geht:
```bash
# LightDM Greeter
sudo cp /etc/lightdm/pi-greeter.conf.backup /etc/lightdm/pi-greeter.conf
sudo systemctl restart lightdm

# Plymouth Splash
sudo cp /usr/share/plymouth/themes/pix/splash.png.backup /usr/share/plymouth/themes/pix/splash.png
sudo update-initramfs -u
```

## Farbschema

Das BoatOS verwendet ein einheitliches, maritimes Farbschema:

- **Hintergrund**: `#0a0e27` (Dunkles Marineblau)
- **Akzent**: `#64ffda` (Türkis/Cyan)
- **Sekundär**: `#1a1f3a` (Mittel-Blau)
- **Text**: `#ffffff` (Weiß)
- **Sekundärtext**: `#8892b0` (Hellgrau-Blau)

## Ergebnis

Nach einem Neustart sollte der Boot-Prozess jetzt nahtlos sein:
1. Plymouth zeigt das BoatOS-Logo
2. LightDM übernimmt mit dem gleichen Bild
3. Desktop startet mit dem gleichen Wallpaper
4. **Kein schwarzer Bildschirm mehr!**

## Nächste Verbesserungen

Mögliche weitere Optimierungen:
- Plymouth-Theme mit Animation erweitern
- Boot-Zeit optimieren für schnelleren Übergang
- Custom LightDM Greeter mit BootOS-Branding
- Progressbar oder Ladeanimation hinzufügen
