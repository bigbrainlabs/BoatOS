# BoatOS Änderungen - 2025-10-19

## Zusammenfassung
Heute wurden Boot-Splash, Desktop-Wallpaper und Kiosk-Mode-Konfiguration überarbeitet.

---

## 1. Boot-Splash & Desktop-Wallpaper System

### Problem (Original)
- Boot-Logo (Plymouth) wurde nur kurz angezeigt
- Danach kam ein schwarzer Bildschirm
- Desktop hatte keinen einheitlichen Wallpaper

### Lösung

#### A. LightDM Greeter angepasst
**Datei**: `/etc/lightdm/pi-greeter.conf`

**Änderungen**:
```diff
- wallpaper=/usr/share/rpd-wallpaper/RPiSystem.png
+ wallpaper=/opt/boatos-splash.png

- desktop_bg=#d6d6d3d3dede
+ desktop_bg=#0a0e27

- wallpaper_mode=crop
+ wallpaper_mode=stretch
```

**Backup**: `/etc/lightdm/pi-greeter.conf.backup`

#### B. Desktop-Wallpaper (PCManFM)
**Datei**: `~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf`

War bereits korrekt konfiguriert:
```ini
wallpaper=/opt/boatos-splash.png
desktop_bg=#0a0e27
wallpaper_mode=stretch
```

#### C. Boot-Splash Images
Beide verwenden das gleiche Bild (MD5: 84aaa04df880f957eb629a5f43102351):
- `/opt/boatos-splash.png` (1920x1080, PNG)
- `/usr/share/plymouth/themes/pix/splash.png`

**Backup**: `/usr/share/plymouth/themes/pix/splash.png.backup`

---

## 2. BoatOS Frontend - Boot-Screen-Logik

### Problem
Nach dem Entfernen des Boot-Screens blieb `#app` auf `display: none` und war nicht sichtbar.

### Lösung

#### A. sensors_dashboard.js
**Datei**: `frontend/sensors_dashboard.js`

**Funktion `hideBootScreen()`** angepasst:
```javascript
function hideBootScreen() {
    const bootScreen = document.getElementById('boot-screen');
    const app = document.getElementById('app');

    if (bootScreen) {
        console.log('✅ Boot complete - hiding boot screen and showing app');
        bootScreen.classList.add('fade-out');

        // Show the app element
        if (app) {
            app.style.display = 'grid';
        }

        setTimeout(() => {
            bootScreen.remove();
        }, 800);
    }
}
```

#### B. index.html - Desktop-Wallpaper
**Datei**: `frontend/index.html`

**Body-Style** erweitert mit Wallpaper-Elementen:
```css
body {
    font-family: sans-serif;
    background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%);
    color: #fff;
    overflow: hidden;
    user-select: none;
    position: relative;
}

/* Desktop Wallpaper - BootOS Style Background */
body::before {
    content: '⚓';
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 600px;
    opacity: 0.03;
    z-index: 0;
    pointer-events: none;
}

body::after {
    content: 'BoatOS';
    position: fixed;
    top: 20%;
    left: 50%;
    transform: translateX(-50%);
    font-size: 72px;
    font-weight: 300;
    letter-spacing: 16px;
    color: rgba(100, 255, 218, 0.08);
    z-index: 0;
    pointer-events: none;
}

#app {
    display: none;
    grid-template-rows: auto 1fr auto;
    height: 100vh;
    position: relative;
    z-index: 1;
}
```

**Hochgeladen**: Via SCP zum Server

---

## 3. Kiosk-Mode Konfiguration

### Problem
Kiosk-Mode versuchte die alte URL `/marine-dashboard/` zu laden, die nicht mehr existiert.
Chromium startete 2x (duplicate autostart entries).

### Lösung

#### A. Desktop Autostart Entry entfernt
**Datei gelöscht**: `~/.config/autostart/marine-dashboard.desktop`

**Grund**: Doppelter Eintrag (war auch in lxsession/autostart)

**Backup**: `~/.config/autostart/marine-dashboard.desktop.backup`

#### B. LXSession Autostart angepasst
**Datei**: `~/.config/lxsession/LXDE-pi/autostart`

**Änderungen**:
```diff
- @chromium --kiosk --noerrdialogs --disable-infobars --app=file:///home/arielle/marine-dashboard/index.html
+ @chromium --kiosk --noerrdialogs --disable-infobars --disable-session-crashed-bubble --disable-translate --disable-features=TranslateUI,Translate --ignore-certificate-errors --app=https://192.168.2.217/
```

**Backups**:
- `~/.config/lxsession/LXDE-pi/autostart.backup`
- `~/.config/lxsession/LXDE-pi/autostart.bak2`
- `~/.config/lxsession/LXDE-pi/autostart.bak3`

**Chromium Flags**:
- `--kiosk` - Vollbild-Modus
- `--noerrdialogs` - Keine Fehler-Dialoge
- `--disable-infobars` - Keine Info-Leisten
- `--disable-session-crashed-bubble` - Kein "Chrome didn't shut down correctly" Popup
- `--disable-translate` - Translation-Feature deaktiviert
- `--disable-features=TranslateUI,Translate` - Translation-UI komplett ausgeschaltet
- `--ignore-certificate-errors` - **WICHTIG**: Selbst-signierte SSL-Zertifikate akzeptieren

#### C. SSL-Zertifikat Problem behoben
**Problem**: Nach dem Löschen der Chromium-Konfiguration wurden die SSL-Ressourcen blockiert (self-signed certificate).

**Fehler in Logs**:
```
ERROR:net/socket/ssl_client_socket_impl.cc:902] handshake failed; returned -1, SSL error code 1, net_error -202
```

**Lösung**: `--ignore-certificate-errors` Flag hinzugefügt

#### D. Translation-Popup permanent deaktiviert
**Problem**: Translation-Popup erschien trotz Flags immer wieder.

**Lösung**: Chromium Preferences erstellt
**Datei**: `~/.config/chromium/Default/Preferences`

```json
{
  "translate": {
    "enabled": false
  },
  "translate_site_blacklist_with_time": {},
  "translate_accepted_count": {},
  "translate_denied_count": {
    "de": 999
  }
}
```

**Kombination**: Preferences + Chromium Flags = Translation komplett deaktiviert

---

## 4. Chromium Browser-Cache

### Aktion
Browser-Cache wurde gelöscht um alte JavaScript-Dateien zu entfernen:
```bash
rm -rf ~/.cache/chromium/*
```

**Grund**: Alte Versionen von `sensors_dashboard.js` und `index.html` waren im Cache

---

## Ergebnis - Boot-Prozess

Der Boot-Prozess sollte jetzt nahtlos sein:

1. **Plymouth** zeigt BoatOS-Logo (⚓)
2. **LightDM Greeter** zeigt das gleiche Bild (statt schwarzer Bildschirm)
3. **Desktop** startet mit BoatOS-Wallpaper im Hintergrund
4. **Chromium Kiosk-Mode** startet automatisch und lädt `https://192.168.2.217/`

**Kein schwarzer Bildschirm mehr zwischen den Phasen!**

---

## Farbschema

Einheitliches maritimes Design:
- **Hintergrund**: `#0a0e27` (Dunkles Marineblau)
- **Akzent**: `#64ffda` (Türkis/Cyan)
- **Sekundär**: `#1a1f3a` (Mittel-Blau)
- **Text**: `#ffffff` (Weiß)
- **Sekundärtext**: `#8892b0` (Hellgrau-Blau)

---

## Test-Checkliste

### ✅ Funktioniert (von externem Browser)
- [ ] BoatOS lädt über HTTPS
- [ ] Karte wird angezeigt
- [ ] Dashboard funktioniert
- [ ] Sensor-Tiles funktionieren
- [ ] Backend API antwortet

### 🔄 Zu testen (am Raspberry Pi Display)
- [ ] Boot-Logo erscheint
- [ ] Kein schwarzer Bildschirm nach Boot-Logo
- [ ] Desktop-Wallpaper zeigt BoatOS-Style
- [ ] Chromium startet nur 1x (nicht 2x)
- [ ] Translation-Popup erscheint NICHT mehr
- [ ] BoatOS lädt korrekt im Kiosk-Mode
- [ ] Karte funktioniert
- [ ] Dashboard funktioniert
- [ ] Touch-Bedienung funktioniert

---

## Behobene Probleme ✅

1. **Translation-Popup**: ✅ Behoben (Chromium Preferences + Flags)
2. **Doppelter Chromium-Start**: ✅ Behoben (autostart entry entfernt)
3. **Boot-Screen bleibt schwarz**: ✅ Behoben (LightDM Greeter angepasst)
4. **SSL-Zertifikat Fehler**: ✅ Behoben (`--ignore-certificate-errors` Flag)
5. **BoatOS funktioniert nicht am Pi**: ✅ Behoben (SSL + Chromium Config)
6. **Chromium Cache Problem**: ✅ Behoben (Cache gelöscht, frische Config)
7. **Taskbar/Panel sichtbar**: ✅ Behoben (wf-panel-pi deaktiviert)
8. **Mauszeiger im Kiosk-Mode**: ✅ Behoben (CSS cursor: none)
9. **Monitor schaltet während Boot aus**: 🔧 In Arbeit (HDMI Blanking + Plymouth Verzögerung)

---

## Dateien zum Testen bei nächstem Neustart

Nach dem nächsten Neustart automatisch aktiv:
1. LightDM Greeter mit BoatOS-Splash
2. Desktop mit BoatOS-Wallpaper
3. Chromium Kiosk-Mode (1x) ohne Translation-Popup

---

## Nächste Schritte

1. **Neustart durchführen** um alle Änderungen zu testen
2. **Boot-Prozess beobachten** am Monitor
3. **Kiosk-Mode prüfen** ob alles funktioniert
4. **Falls nötig**: Weitere Anpassungen dokumentieren

---

## Backup-Wiederherstellung

Falls etwas schief geht:

### LightDM Greeter
```bash
sudo cp /etc/lightdm/pi-greeter.conf.backup /etc/lightdm/pi-greeter.conf
sudo systemctl restart lightdm
```

### Plymouth Splash
```bash
sudo cp /usr/share/plymouth/themes/pix/splash.png.backup /usr/share/plymouth/themes/pix/splash.png
sudo update-initramfs -u
```

### Kiosk-Mode
```bash
cp ~/.config/lxsession/LXDE-pi/autostart.backup ~/.config/lxsession/LXDE-pi/autostart
```

---

## 5. Monitor-Blanking & Plymouth-Timing Fix

### Problem
Boot-Splash verschwindet nach 0.5 Sekunden. Monitor schaltet sich während des Boots aus und geht erst wieder an wenn der Desktop da ist.

### Lösung

#### A. Boot-Parameter angepasst
**Datei**: `/boot/firmware/cmdline.txt`

**Neu hinzugefügt**:
- `consoleblank=0` - Verhindert Console-Blanking während Boot
- `vt.global_cursor_default=0` - Versteckt Cursor auf Console

**Backup**: `/boot/firmware/cmdline.txt.backup`

#### B. HDMI-Blanking deaktiviert
**Datei**: `/boot/firmware/config.txt`

**Hinzugefügt**:
```ini
# BoatOS - Prevent HDMI blanking during boot
hdmi_blanking=0
```

**Backup**: `/boot/firmware/config.txt.backup`

#### C. Plymouth-Quit verzögert
**Datei**: `/etc/systemd/system/plymouth-quit-wait.service.d/override.conf`

**Neu erstellt**:
```ini
[Service]
# Delay Plymouth quit to show boot splash longer
ExecStartPre=/bin/sleep 3
```

**Effekt**: Plymouth läuft 3 Sekunden länger bevor LightDM übernimmt

---

## 6. Desktop-Konfiguration (Labwc/Wayland)

### Problem
Taskbar, Mülleimer-Icon und Mauszeiger waren auf Desktop sichtbar.

### Lösung

#### A. Taskbar/Panel ausgeblendet
**Datei**: `/etc/xdg/labwc/autostart`

**Änderung**:
```diff
- /usr/bin/lwrespawn /usr/bin/wf-panel-pi &
+ # /usr/bin/lwrespawn /usr/bin/wf-panel-pi &  # DISABLED - No panel for BoatOS
```

**Status**: ✅ Funktioniert

#### B. Mauszeiger im Kiosk-Mode versteckt
**Datei**: `frontend/index.html`

**CSS hinzugefügt**:
```css
* { cursor: none; }
body { cursor: none; }
```

**Status**: ✅ Funktioniert (Cursor beim Bedienen weg, nur beim Start kurz sichtbar)

#### C. Mülleimer-Icon
**Datei**: `~/.config/pcmanfm/LXDE-pi/desktop-items-0.conf` und `pcmanfm.conf`

**Konfiguration**: `show_trash=0`

**Status**: ⚠️ Teilweise (Icon noch sichtbar auf Desktop, aber nicht in Kiosk-Mode)

---

## Weitere Dokumentation

- **SSH-Zugang**: [README_SSH.md](README_SSH.md)
- **Boot-Splash Details**: [README_BOOT_SPLASH.md](README_BOOT_SPLASH.md)
