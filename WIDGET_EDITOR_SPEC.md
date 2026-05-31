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
| Breite | Spaltenanzahl |

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
| Breite | Spaltenanzahl |

### HORIZON
| Property | Beschreibung |
|---|---|
| Roll-Sensor | Sensor für Schlagseite (base_name) |
| Roll-Feld | Feld des Roll-Sensors (z. B. `schlagseite`) |
| Pitch-Sensor | Sensor für Neigung (base_name) |
| Pitch-Feld | Feld des Pitch-Sensors (z. B. `neigung`) |
| Impact-Sensor | Sensor für Erschütterungserkennung (optional) |
| Impact-Feld | Feld des Impact-Sensors (z. B. `aktiv`) |
| Breite | Spaltenanzahl |

### COMPASS
| Property | Beschreibung |
|---|---|
| Sensor | Sensor für Kurs/Heading (base_name) |
| Feld | Feld des Sensors (z. B. `heading`) |
| Breite | Spaltenanzahl |

### TEXT
| Property | Beschreibung |
|---|---|
| Text | Statischer Anzeigetext |
| Breite | Spaltenanzahl |

### CLOCK / SPACER
| Property | Beschreibung |
|---|---|
| Breite | Spaltenanzahl |

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
  "impactField": "aktiv",
  "size": 2
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
  "decimals": 0,
  "size": 1
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

## Umsetzung (TODOs)

- [ ] **DSL-Parser** (Backend): neue Widget-Felder parsen und durchreichen (`rollSensor`, `rollField`, `pitchSensor`, `pitchField`, `impactSensor`, `impactField`, `field` bei Gauge/Sensor)
- [ ] **Deck — dashboard-editor.js**: Properties-Panel für jeden Widget-Typ vollständig implementieren (alle Felder aus dieser Spec)
- [ ] **Deck — dashboard_renderer.js**: Widget-Properties aus Layout-JSON lesen statt aus globalen Settings
- [ ] **Helm — settings_screen.dart**: `_WidgetEditDialog` für alle Widget-Typen vollständig implementieren
- [ ] **Helm — dashboard_screen.dart**: Widget-Properties aus Layout lesen statt aus SettingsService
