# Widget Editor — Anforderungsspezifikation

## Grundprinzip

- Jedes Widget ist vollständig selbstbeschreibend: alle Einstellungen gehören zum Widget selbst.
- Es gibt **keine globalen Sensor-Einstellungen** außerhalb des Widgets.
- Im Editor (Deck + Helm) wählt der Nutzer ein Widget aus und sieht **alle konfigurierbaren Felder** direkt in der Widget-Properties-Leiste / im Widget-Edit-Dialog.
- Sensor-Zuweisung erfolgt **pro benötigtem Wert** im Widget — jeder Eingabe-Kanal hat sein eigenes Sensor- und Feld-Dropdown.

---

## Widget-Typen und ihre konfigurierbaren Properties

### SENSOR
| Property | Beschreibung |
|---|---|
| Sensor | Sensor-Auswahl (base_name) |
| Feld | Welcher Wert des Sensors angezeigt wird |
| Bezeichnung (Alias) | Anzeige-Name überschreiben |
| Stil | card / minimal / compact / hero |

### GAUGE
| Property | Beschreibung |
|---|---|
| Sensor | Sensor-Auswahl (base_name) |
| Feld | Welcher Wert des Sensors angezeigt wird |
| Label | Bezeichnung |
| Einheit | z. B. °C, %, kn |
| Min / Max | Skalenbereich |
| Dezimalstellen | 0–3 |
| Stil | arc180 / arc270 / arc360 / bar |

### HORIZON
| Property | Beschreibung |
|---|---|
| Roll-Sensor | Sensor für Schlagseite (base_name) |
| Roll-Feld | Feld des Roll-Sensors (z. B. `schlagseite`) |
| Pitch-Sensor | Sensor für Neigung (base_name) |
| Pitch-Feld | Feld des Pitch-Sensors (z. B. `neigung`) |
| Impact-Sensor | Sensor für Erschütterungserkennung (optional) |
| Impact-Feld | Feld des Impact-Sensors (z. B. `aktiv`) |

### COMPASS
> **Stand:** aktuell nur Platzhalter-Icon (kein Property-Panel). Zieldefinition:

| Property | Beschreibung |
|---|---|
| Sensor | Sensor für Kurs/Heading (base_name) |
| Feld | Feld des Sensors (z. B. `heading`) |

### TEXT
| Property | Beschreibung |
|---|---|
| Text | Statischer Anzeigetext |

### CHART
| Property | Beschreibung |
|---|---|
| Sensor | Sensor-Pfad |
| Typ (`chart_type`) | line / bar / area |
| Periode | Zeitraum in Minuten (Standard 60) |

Kein Property-Panel im visuellen Editor (nur per DSL bzw. Sensor-Picker konfigurierbar).

### CLOCK / SPACER

Keine konfigurierbaren Properties.

---

## Datenmodell (Widget im Layout)

Alle Sensor-Zuweisungen werden als Felder im Widget-Objekt gespeichert (im DSL/Layout-JSON):

```json
{
  "type": "horizon",
  "rollSensor": "boot/lage",
  "rollField": "schlagseite",
  "pitchSensor": "boot/lage",
  "pitchField": "neigung",
  "impactSensor": "boot/sensoren/erschuetterung",
  "impactField": "aktiv"
}
```

```json
{
  "type": "gauge",
  "sensor": "boot/motor",
  "field": "drehzahl",
  "label": "Drehzahl",
  "unit": "rpm",
  "min": 0,
  "max": 4000,
  "style": "arc180",
  "decimals": 0
}
```

---

## Editor-Verhalten

1. Nutzer öffnet Dashboard-Editor
2. Nutzer klickt auf ein Widget → Properties-Leiste öffnet sich
3. Alle Widget-Properties sind direkt editierbar
4. Sensor-Dropdowns zeigen alle verfügbaren Sensoren aus `/api/sensors/list`
5. Feld-Dropdown zeigt die Felder des gewählten Sensors (dynamisch)
6. Änderungen werden sofort im Widget-Objekt gespeichert (kein separater Speichern-Button nötig außer für das gesamte Layout)
7. Vorschau (wo sinnvoll, z. B. Gauge) aktualisiert sich live

---

## Widget-Registry — der gemeinsame Modul-Contract (Deck ↔ Helm)

Deck und Helm nutzen **dieselbe Architektur**: ein Widget-Typ = **ein selbst-registrierendes Modul**. Der Render-Code bleibt sprachbedingt getrennt (JS/DOM vs. Flutter/CustomPainter), aber **Struktur, Vertrag und DSL sind identisch**. Ein neues Widget = eine Datei pro Plattform, beide nach demselben Muster, plus (falls neue Felder) der gemeinsame DSL-Parser im Backend.

### Vertrag

| Baustein | Deck (`window.dashWidgets`) | Helm (`DashWidgetRegistry`) |
|---|---|---|
| Registrierung | `register({ type, label, render, editor, icon, name, dsl })` | `register(type, label, builder, editor, dsl)` |
| Anzeige | `render(widget, {r, size})` → HTML | `builder(w, sensors)` → Widget |
| Property-Panel | `editor(widget, {ed, idx})` → HTML | `editor(w, setState, sensors)` → Widget |
| DSL-Zeile | `dsl(widget, {withSize})` → String | `dsl(w)` → String |
| Editor-Liste | `icon(widget, ed)` / `name(widget, ed)` | (aus Sensor/Label abgeleitet) |

### Dateien

- **Deck:** `frontend/js/dashboard/registry.js` (Kern) + `frontend/js/dashboard/widgets/<type>.js` (Module). Einbinden in `frontend/index.html` **vor** `dashboard_renderer.js`. Non-module → Registry liegt auf `window.dashWidgets` (bewusst **nicht** `window.BoatOS`, das `main.js` neu zuweist).
- **Helm:** `flutter_app/lib/widgets/dashboard/registry.dart` (Kern) + `<type>_widget.dart` (Module), registriert in `registry_init.dart`.
- **Gemeinsam:** `backend/app/dashboard_dsl.py` ist der kanonische DSL-Parser (Single Source of Truth der Grammatik).

### Casing-Konvention

- **DSL-Keywords werden UPPERCASE emittiert** (`SENSOR`, `GAUGE`, …) und **case-insensitiv geparst** — das ist die kanonische, plattformübergreifende Form.
- Der Laufzeit-Feldwert `widget.type` ist intern auf dem Deck **klein** (`'sensor'`, wie vom Backend-Parser geliefert), auf Helm **groß**. Die Registry normalisiert Lookups (`normType` → UPPERCASE), sodass beides transparent zusammenpasst. Ein Angleichen der internen Kleinschreibung ist **nicht nötig** und wird bewusst vermieden.

### Ein neues Widget hinzufügen (Rezept)

1. `frontend/js/dashboard/widgets/<type>.js` anlegen → `window.dashWidgets.register({...})` mit `render`, ggf. `editor`/`icon`/`name`/`dsl`.
2. Script-Tag in `frontend/index.html` (vor `dashboard_renderer.js`) ergänzen.
3. Helm-Pendant `<type>_widget.dart` + Eintrag in `registry_init.dart`.
4. Nur falls neue DSL-Felder: `backend/app/dashboard_dsl.py` (Parser) erweitern.

## Status

- [x] **DSL-Parser** (Backend): Widget-Felder werden geparst und durchgereicht (`rollSensor`/`rollField`/`pitchSensor`/`pitchField`/`impactSensor`/`impactField`, `field`, Chart `chart_type`/`period`).
- [x] **Deck — Registry-Architektur**: `render`/`editor`/`icon`/`name`/`dsl` je Widget im Modul; `dashboard_renderer.js` + `dashboard-editor.js` dispatchen über `window.dashWidgets`. Beide alten `switch`-Blöcke und beide DSL-Serialisierer entfernt.
- [x] **Deck — Properties-Panel**: `renderProperties()` = gemeinsamer Rahmen + `dashWidgets.buildEditor()`; Typ-Felder leben im Modul.
- [x] **Helm — Registry** (`DashWidgetRegistry`) als Referenz-Architektur.
- [ ] **Deck — Screen-Slot-Editor** (`dashboard-editor.js`, Slot-Zuweisung im Screen-Modus): eigener Editor-Kontext mit `setSlotProp`/`setSlotSensor`-Handlern und reduziertem Feldsatz — noch **nicht** auf die Registry migriert. Follow-up: `editor()` handler-parametrisieren, dann auch hier `buildEditor` nutzen.
- [ ] **COMPASS**: aktuell Platzhalter-Icon auf beiden Plattformen → echtes Kreis-Instrument (Basis fürs Motorboot-Nav-Instrument).
