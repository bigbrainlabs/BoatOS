# BoatOS aktualisieren

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
ssh arielle@boatos.local
# oder mit IP:
ssh arielle@<IP-Adresse>
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
