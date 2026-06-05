# BoatOS aktualisieren

> **⚠️ Hinweis für Image v1.5.21:** Das Update hängt beim ersten Versuch. Einmaliger Workaround per SSH erforderlich — siehe [Bekannte Probleme](#bekannte-probleme) unten.

## Weg 1 — Update-Button (empfohlen)

Der einfachste Weg — keine Kommandozeile nötig.

Wenn eine neue Version verfügbar ist, erscheint in **Deck** und **Helm** automatisch ein Hinweis-Banner.

**Deck:** Einstellungen → Bereich "System" → **"Update installieren"**  
**Helm:** Bernstein-Banner in der Navigationsleiste antippen → Update starten

Der Pi lädt die neue Version herunter, installiert sie und startet neu. Der Vorgang dauert je nach Internetverbindung 1–3 Minuten.

---

## Weg 2 — Manuell per SSH

Für technisch versierte Nutzer oder wenn der Update-Button nicht funktioniert.

### Verbinden

```bash
ssh boatos@boatos.local
# oder mit IP:
ssh boatos@<IP-Adresse>
```

### Update durchführen

```bash
cd ~/BoatOS
git pull
bash scripts/update.sh
```

Das Update-Script:
- Zieht die aktuelle Version aus GitHub
- Aktualisiert Backend-Dependencies
- Deployt das neue Flutter-Binary (Helm)
- Startet alle Dienste neu

### Aktuelle Version prüfen

```bash
cat ~/BoatOS/VERSION
```

Oder in Deck: Einstellungen → System → Versionsanzeige.

---

## Hinweise

- **Karten und Routing-Daten** werden durch ein Update **nicht** überschrieben — eigene Kartendaten bleiben erhalten.
- **Einstellungen und Logbuch** bleiben ebenfalls erhalten.
- Bei Problemen nach einem Update: `sudo systemctl status boatos.service` zeigt die Backend-Logs.

---

## Bekannte Probleme

### Update hängt bei `[1/6]` — Image v1.5.21

Das Update-Script im v1.5.21-Image enthält einen Bug der zum Hängen führt. Einmaliger Workaround: das Script per SSH löschen, damit es beim nächsten Update-Klick automatisch frisch von GitHub geladen wird.

**Voraussetzung:** Pi und PC im gleichen Netzwerk. Passwort: Standard-Passwort (sofern nicht geändert, siehe [Sicherheitshinweis in der Installation](installation.md#-sicherheit--standard-passwörter-ändern)).

**Windows (PowerShell):**
```powershell
ssh boatos@boatos.local "rm ~/BoatOS/scripts/update.sh"
```

**Linux / Mac:**
```bash
ssh boatos@boatos.local "rm ~/BoatOS/scripts/update.sh"
```

Danach im Deck auf **Einstellungen → System → Update starten** klicken. Das Update läuft jetzt vollständig durch. Dieser Schritt ist nur einmal nötig — ab v1.6.2 funktioniert das Update direkt.
