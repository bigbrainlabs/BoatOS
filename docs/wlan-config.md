# WLAN konfigurieren

BoatOS verwaltet WLAN über die eingebaute WiFi-Verwaltung — erreichbar in **Helm** (Touchscreen) und **Deck** (Browser).

---

## Mit einem Netzwerk verbinden

### Über Helm (Touchscreen)

1. Einstellungen-Tab öffnen → **WLAN**
2. **"Netzwerke scannen"** antippen
3. Gewünschtes Netzwerk antippen
4. Passwort eingeben (Auge-Icon zum Einblenden) → **"Verbinden"**

### Über Deck (Browser)

1. `https://boatos.local` im Browser öffnen
2. Einstellungen → **WLAN**
3. **"Netzwerke scannen"** → Netzwerk auswählen → Passwort eingeben → Verbinden

---

## Gespeicherte Netzwerke verwalten

Einmal verbundene Netzwerke werden automatisch gespeichert. Der Pi verbindet sich beim nächsten Start automatisch.

**Netzwerk vergessen:**
- Helm: WLAN-Sheet öffnen → neben dem gespeicherten Netz auf **"Vergessen"** tippen
- Deck: Einstellungen → WLAN → gespeichertes Netz → **"Löschen"**

---

## Hotspot

Wenn kein bekanntes WLAN in Reichweite ist, kann der Pi einen eigenen Hotspot aufspannen. Andere Geräte verbinden sich dann direkt mit dem Pi.

**Hotspot starten:**
- Helm: WLAN-Sheet öffnen → **"Hotspot starten"**
- Deck: Einstellungen → WLAN → **"📡 Hotspot starten"**

**Hotspot-Zugangsdaten** werden im Helm-Overlay und im Deck-Banner angezeigt:

| | |
|---|---|
| SSID | `BoatOS-Setup` |
| Passwort | `boatos1234` |
| IP (BoatOS) | `192.168.4.1` |

Nach dem Verbinden mit dem Hotspot: `https://192.168.4.1` im Browser aufrufen.

> **Hinweis:** Der Hotspot läuft auf 2,4 GHz. Auf kleinem Raum (z.B. in einem Hafen) kann er andere WLAN-Geräte kurzzeitig beeinflussen. Nach Gebrauch stoppen.

**Hotspot stoppen:**
- Helm: Banner antippen → **"Stoppen"**
- Deck: **"Stoppen"**-Button

---

## WLAN-Adapter neu starten

Bei Verbindungsproblemen (z.B. nach langer Fahrt ohne WLAN) kann der Adapter neu initialisiert werden — ohne Pi-Neustart.

- Helm: WLAN-Sheet öffnen → **↺-Button** (oben rechts im Header)
- Deck: Einstellungen → WLAN → **"↺ Adapter neu starten"**

Der Vorgang dauert ~10 Sekunden. Danach wird automatisch neu gescannt.

---

## Häufige Probleme

| Problem | Lösung |
|---|---|
| Verbindung schlägt immer fehl | Passwort prüfen (Auge-Icon nutzen) — Groß-/Kleinschreibung beachten |
| Pi verbindet sich nicht automatisch | Netzwerk vergessen und neu verbinden |
| WLAN bricht immer wieder ab | Adapter neu starten (↺-Button) |
| Hotspot startet aber Verbindung schlägt fehl | Statische IP am Gerät setzen: `192.168.4.2`, Maske `255.255.255.0`, Gateway `192.168.4.1` |
| `boatos.local` nicht erreichbar | IP-Adresse direkt nutzen — Windows benötigt Bonjour für mDNS |
