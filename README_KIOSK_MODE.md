# Chromium Kiosk Mode Konfiguration

## Übersicht

BoatOS läuft im Kiosk Mode mit Chromium auf einem Raspberry Pi 4 mit Wayland (labwc Compositor). Die Anwendung wird automatisch beim Boot gestartet und zeigt die BoatOS-Oberfläche im Vollbildmodus an.

## Systemanforderungen

- Raspberry Pi 4 Model B
- Debian Trixie (Testing)
- Wayland Display Server mit labwc Compositor
- Chromium Browser
- nginx als lokaler Webserver (HTTPS auf localhost)

## Konfigurationsdateien

### 1. Autostart-Datei: `~/.config/labwc/autostart`

Diese Datei startet Chromium automatisch beim Login:

```bash
# Wait for display server to be ready
sleep 5

# Disable GNOME Keyring for Chromium
export GNOME_KEYRING_CONTROL=""
export XDG_SESSION_TYPE=wayland
export LANGUAGE=de_DE.UTF-8
export LANG=de_DE.UTF-8

# Start BoatOS in Chromium Kiosk Mode with dedicated profile
WAYLAND_DISPLAY=wayland-0 chromium --ozone-platform=wayland --user-data-dir=/home/arielle/.config/chromium-kiosk --kiosk --noerrdialogs --disable-infobars --ignore-certificate-errors --password-store=basic --use-mock-keychain --disable-translate --disable-session-crashed-bubble --disable-features=Translate,TranslateUI --lang=de --app=https://localhost/ > /tmp/chromium_kiosk.log 2>&1 &
```

### 2. Chromium Policies: `/etc/chromium/policies/managed/boatos.json`

System-weite Chromium-Policies deaktivieren unerwünschte Features:

```json
{
  "PasswordManagerEnabled": false,
  "TranslateEnabled": false,
  "PromptForDownloadLocation": false,
  "DefaultNotificationsSetting": 2,
  "DefaultGeolocationSetting": 2,
  "SyncDisabled": true
}
```

### 3. Chromium Preferences: `~/.config/chromium-kiosk/master_preferences`

Profil-spezifische Einstellungen:

```json
{
  "homepage": "https://localhost",
  "homepage_is_newtabpage": false,
  "browser": {
    "show_home_button": false,
    "check_default_browser": false
  },
  "translate": {
    "enabled": false
  },
  "translate_accepted_count": 0,
  "translate_denied_count": 999,
  "translate_too_often_denied": true,
  "translate_site_blacklist": ["localhost"],
  "translate_whitelists": {}
}
```

## Wichtige Chromium Flags

| Flag | Zweck |
|------|-------|
| `--ozone-platform=wayland` | Verwendet native Wayland-Unterstützung |
| `--user-data-dir=/home/arielle/.config/chromium-kiosk` | Dediziertes Profil für Kiosk Mode |
| `--kiosk` | Vollbildmodus ohne Browser-UI |
| `--app=https://localhost/` | Öffnet BoatOS (localhost statt fester IP) |
| `--password-store=basic` | Deaktiviert System-Keyring |
| `--use-mock-keychain` | Verhindert Keyring-Dialoge |
| `--disable-translate` | Deaktiviert Übersetzungs-Feature |
| `--disable-features=Translate,TranslateUI` | Entfernt Übersetzungs-Banner |
| `--lang=de` | Setzt Sprache auf Deutsch |
| `--ignore-certificate-errors` | Akzeptiert selbst-signierte SSL-Zertifikate |
| `--noerrdialogs` | Unterdrückt Fehler-Dialoge |
| `--disable-infobars` | Entfernt Info-Banner |
| `--disable-session-crashed-bubble` | Keine "Chromium ist abgestürzt" Meldung |

## GNOME Keyring Deaktivierung

### Problem
GNOME Keyring zeigt beim Start einen Dialog "Create new keyring", der den Kiosk Mode stört.

### ✅ Lösung

#### Schritt 1: Autostart-Dateien deaktivieren
```bash
sudo mv /etc/xdg/autostart/gnome-keyring-pkcs11.desktop /etc/xdg/autostart/gnome-keyring-pkcs11.desktop.disabled
sudo mv /etc/xdg/autostart/gnome-keyring-secrets.desktop /etc/xdg/autostart/gnome-keyring-secrets.desktop.disabled
sudo mv /etc/xdg/autostart/gnome-keyring-ssh.desktop /etc/xdg/autostart/gnome-keyring-ssh.desktop.disabled
```

#### Schritt 2: Binary deaktivieren
```bash
sudo mv /usr/bin/gnome-keyring-daemon /usr/bin/gnome-keyring-daemon.disabled
```

Diese Lösung verhindert, dass der Keyring-Daemon überhaupt gestartet werden kann.

## Translate-Banner Deaktivierung

### Problem
Chromium zeigt ein "english german" Translate-Banner an.

### ✅ Lösung
Kombination aus mehreren Maßnahmen:

1. **Chromium Flags:**
   - `--disable-translate`
   - `--disable-features=Translate,TranslateUI`
   - `--lang=de`

2. **Umgebungsvariablen:**
   ```bash
   export LANGUAGE=de_DE.UTF-8
   export LANG=de_DE.UTF-8
   ```

3. **System Policies:** TranslateEnabled: false in `/etc/chromium/policies/managed/boatos.json`

4. **Preferences:** translate_site_blacklist für localhost

## Localhost statt fester IP

### Warum localhost?
- IP-Adressen können sich ändern (DHCP)
- nginx hört auf localhost (127.0.0.1)
- Vermeidet Netzwerk-Abhängigkeiten
- Funktioniert auch ohne WiFi/Ethernet

### nginx Konfiguration
nginx muss auf localhost mit HTTPS lauschen:

```nginx
server {
    listen 443 ssl;
    server_name localhost;

    ssl_certificate /etc/nginx/ssl/nginx-selfsigned.crt;
    ssl_certificate_key /etc/nginx/ssl/nginx-selfsigned.key;

    root /home/arielle/BoatOS/frontend;
    index index.html;
}
```

## Autologin Konfiguration

Damit der Kiosk Mode beim Boot startet, muss der Benutzer `arielle` automatisch eingeloggt werden.

**Konfiguration:** `/etc/lightdm/lightdm.conf` oder Wayland-Login-Manager
```ini
[Seat:*]
autologin-user=arielle
autologin-user-timeout=0
```

## Troubleshooting

### Chromium startet nicht
**Lösung:**
```bash
# Log-Datei prüfen
tail -f /tmp/chromium_kiosk.log

# Prozesse checken
ps aux | grep chromium

# Manuell starten zum Testen
WAYLAND_DISPLAY=wayland-0 chromium --kiosk --app=https://localhost/
```

### Keyring-Dialog erscheint trotzdem
**Lösung:**
```bash
# Prüfen, ob Daemon läuft
ps aux | grep keyring

# Daemon killen
killall gnome-keyring-daemon

# Binary-Umbenennung verifizieren
ls -la /usr/bin/gnome-keyring-daemon*
```

### Weiße Seite beim Start
**Problem:** nginx läuft nicht oder Chromium startet zu früh

**Lösung:**
```bash
# nginx Status prüfen
systemctl status nginx

# nginx neu starten
sudo systemctl restart nginx

# Sleep-Zeit in autostart erhöhen
sleep 10  # statt sleep 5
```

### Mehrere Chromium-Instanzen laufen
**Problem:** Alte autostart-Skripte oder Services

**Lösung:**
```bash
# Alle Chromium-Instanzen anzeigen
ps aux | grep chromium | grep -v grep

# Alle Instanzen beenden
killall chromium

# Alte autostart-Einträge suchen
find /etc/xdg/autostart/ -name "*chromium*"
find ~/.config/autostart/ -name "*chromium*"
```

### Translate-Banner erscheint
**Prüfen:**
```bash
# Chromium Flags verifizieren
ps aux | grep chromium | grep translate

# Policies prüfen
cat /etc/chromium/policies/managed/boatos.json

# Preferences prüfen
cat ~/.config/chromium-kiosk/Default/Preferences | grep -i translate
```

## Deployment Checklist

Beim Setup auf einem neuen Raspberry Pi:

- [ ] nginx mit HTTPS auf localhost konfiguriert
- [ ] labwc Compositor installiert
- [ ] Autologin für Benutzer aktiviert
- [ ] `~/.config/labwc/autostart` erstellt
- [ ] `/etc/chromium/policies/managed/boatos.json` erstellt
- [ ] GNOME Keyring autostart deaktiviert
- [ ] GNOME Keyring Binary umbenannt
- [ ] Test: Reboot und prüfen ob Kiosk Mode startet
- [ ] Test: Keine Keyring-Dialoge
- [ ] Test: Keine Translate-Banner
- [ ] Test: localhost wird korrekt geladen

## Weitere Dokumentation

- **WiFi & Kernel-Konfiguration:** Siehe [README_WIFI_KERNEL.md](README_WIFI_KERNEL.md)
- **SSH-Zugriff:** Siehe [readme_ssh.md](readme_ssh.md)
- **Boot Splash & Wallpaper:** Siehe [README_BOOT_SPLASH.md](README_BOOT_SPLASH.md)

## Bekannte Einschränkungen

1. **Selbst-signierte Zertifikate:** `--ignore-certificate-errors` ist notwendig, da nginx ein selbst-signiertes SSL-Zertifikat verwendet
2. **Touch-Kalibrierung:** Bei manchen Touchscreens kann eine Kalibrierung notwendig sein
3. **Display-Timeout:** Bildschirmschoner sollte deaktiviert werden für Dauerbetrieb
4. **GPU-Beschleunigung:** Bei manchen Raspberry Pi Modellen kann `--disable-gpu` notwendig sein

## Performance-Optimierungen

Für bessere Performance im Kiosk Mode:

```bash
# In autostart zusätzlich setzen:
export CHROMIUM_FLAGS="--disable-sync --disable-background-networking --disable-component-update"
```

Optional in `/boot/firmware/config.txt`:
```
# GPU Memory für bessere Chromium-Performance
gpu_mem=256
```
