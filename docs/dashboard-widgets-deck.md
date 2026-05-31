# Dashboard-Widget-Registry — Deck (JS/Web)

Dieses Dokument beschreibt die Widget-Registry-Architektur des BoatOS Deck-Dashboards (Browser/Web-Frontend). Sie ermöglicht es, neue Dashboard-Widgets als eigenständige JS-Dateien hinzuzufügen, ohne bestehenden Code anzufassen.

---

## Konzept

Jedes Widget registriert sich selbst in `window.DashWidgets` (einem globalen Objekt). Der `DashboardRenderer` und der `DashboardEditor` fragen dort ab, wie ein Widget gerendert, bearbeitet und in DSL serialisiert wird.

```
┌───────────────────────────────────────────────────────────┐
│                      index.html                           │
│  <script src="widgets/gauge.js"> etc.  ← vor renderer    │
└───────────────────┬───────────────────────────────────────┘
                    │ setzt window.DashWidgets['type'] = ...
                    ▼
┌───────────────────────────────────────────────────────────┐
│            window.DashWidgets  (globales Objekt)          │
│  'gauge' → { toDSL, renderSlotControls, renderHTML, ... } │
│  'sensor' → { ... }                                       │
│  ...                                                      │
└──────────┬────────────────────────┬───────────────────────┘
           │                        │
           ▼                        ▼
┌─────────────────────┐  ┌──────────────────────────────────┐
│ dashboard_renderer  │  │  dashboard-editor.js             │
│ .renderWidget()     │  │  ._widgetToDSLLine()             │
│ → def.renderHTML()  │  │  → def.toDSL()                   │
└─────────────────────┘  │  [+ def.renderSlotControls()]    │
                         └──────────────────────────────────┘
```

---

## Dateistruktur

```
frontend/
├── widgets/
│   ├── gauge.js       ← GAUGE
│   ├── sensor.js      ← SENSOR
│   ├── clock.js       ← CLOCK
│   ├── compass.js     ← COMPASS
│   ├── text.js        ← TEXT
│   ├── spacer.js      ← SPACER
│   └── horizon.js     ← HORIZON
├── dashboard_renderer.js   ← ruft renderHTML()
└── js/dashboard-editor.js  ← ruft toDSL() + renderSlotControls()
```

---

## Widget-Struktur

Jeder Eintrag in `window.DashWidgets` hat diese Form:

```js
window.DashWidgets = window.DashWidgets || {};
window.DashWidgets['mein'] = {
  type:     'mein',          // Kleinbuchstaben, passend zum DSL-Schlüssel
  label:    'Mein Widget',   // Anzeigename im Editor

  defaults: {
    type: 'mein',
    size: 1,
    // weitere Felder mit Standardwerten
  },

  toDSL(w) { ... },                             // w → DSL-String
  renderSlotControls(slot, w, sensors) { ... }, // Editor-Controls (HTML-String)
  renderHTML(widget, size) { ... },             // Rendering (HTML-String)
};
```

### `toDSL(w)` — DSL-Serialisierung

Gibt die DSL-Zeile für das Widget zurück (ohne führenden Zeilenumbruch):

```js
toDSL(w) {
  let dsl = `  MEIN ${w.sensor || ''}`;
  if (w.size && w.size > 1) dsl += ` SIZE ${w.size}`;
  return dsl;
},
```

Wird aufgerufen von `DashboardEditor._widgetToDSLLine()`.

### `renderSlotControls(slot, w, sensors)` — Editor-Formular

Gibt einen HTML-String zurück, der die widget-spezifischen Konfigurationsfelder enthält. Live-Änderungen werden per `window.dashboardEditor.updateWidget()` weitergegeben:

```js
renderSlotControls(slot, w, sensors) {
  const cur = w.sensor || '';
  return `
    <div style="margin-top:8px">
      <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">
        Sensor
      </label>
      <select onchange="window.dashboardEditor.updateWidget(${slot},'sensor',this.value)"
              style="width:100%;padding:6px;background:var(--bg-card);
                     border:1px solid var(--border);border-radius:6px;
                     color:var(--text);font-size:12px">
        <option value="">-- keiner --</option>
        ${sensors.map(s => `
          <option value="${s.base_name}" ${cur === s.base_name ? 'selected' : ''}>
            ${s.name || s.base_name}
          </option>
        `).join('')}
      </select>
    </div>
  `;
},
```

- `slot`: Index des Widgets im Editor-Array (für `updateWidget`)
- `w`: aktuelles Widget-Objekt (aus `editor.widgets[slot]`)
- `sensors`: Array aus `/api/sensors/list` → `[{ base_name, name, values, ... }, ...]`
- `window.dashboardEditor.updateWidget(slot, prop, value)` aktualisiert das Widget und re-rendert den Editor sofort

### `renderHTML(widget, size)` — Darstellung

Gibt einen vollständigen HTML-String für die Darstellung im Dashboard zurück. `grid-column: span ${size}` ist Pflicht:

```js
renderHTML(widget, size) {
  const val = (widget._liveValues && widget._liveValues[widget.sensor]) || '--';
  return `
    <div style="
      grid-column: span ${size};
      background: radial-gradient(ellipse at 30% 20%,
        rgba(40,80,140,0.7), rgba(15,25,50,0.85));
      border: 2px solid rgba(100,180,255,0.2);
      border-radius: var(--radius-xl);
      padding: var(--space-3xl);
      display: flex; align-items: center; justify-content: center;
      color: var(--accent); font-size: var(--fs-4xl); font-weight: 700;
    ">
      <span data-sensor="${widget.sensor}">${val}</span>
    </div>
  `;
},
```

Für Live-Updates füge `data-sensor="..."` oder `data-gauge-path="..."` Attribute ein —  
`DashboardRenderer.updateValues()` schreibt neue Werte in Elemente mit diesen Attributen.

---

## Vollständiges Beispiel

Datei: `frontend/widgets/mein.js`

```js
window.DashWidgets = window.DashWidgets || {};
window.DashWidgets['mein'] = {
    type: 'mein',
    label: 'Mein Widget',
    defaults: { type: 'mein', sensor: '', size: 1, color: 'cyan' },

    toDSL(w) {
        let dsl = `  MEIN ${w.sensor || ''}`;
        if (w.size && w.size > 1) dsl += ` SIZE ${w.size}`;
        if (w.color && w.color !== 'cyan') dsl += ` COLOR ${w.color}`;
        return dsl;
    },

    renderSlotControls(slot, w, sensors) {
        const cur = w.sensor || '';
        const color = w.color || 'cyan';
        return `
            <div style="margin-top:8px">
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Sensor</label>
                <select onchange="window.dashboardEditor.updateWidget(${slot},'sensor',this.value)"
                        style="width:100%;padding:6px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
                    <option value="">-- keiner --</option>
                    ${sensors.map(s => `
                        <option value="${s.base_name}" ${cur === s.base_name ? 'selected' : ''}>
                            ${s.name || s.base_name}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div style="margin-top:8px">
                <label style="font-size:11px;color:var(--text-dim);display:block;margin-bottom:4px">Farbe</label>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                    ${['cyan','blue','green','orange','purple','red','yellow'].map(c => `
                        <div onclick="window.dashboardEditor.updateWidget(${slot},'color','${c}')"
                             style="width:24px;height:24px;border-radius:5px;cursor:pointer;
                                    background:var(--${c==='cyan'?'accent':c});
                                    border:2px solid ${color===c?'white':'transparent'}"></div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    renderHTML(widget, size) {
        const colorMap = {
            cyan: '#64ffda', blue: '#3498db', orange: '#e67e22',
            green: '#2ecc71', purple: '#9b59b6', red: '#e74c3c', yellow: '#f1c40f'
        };
        const color = colorMap[widget.color || 'cyan'] || colorMap.cyan;
        return `
            <div style="
                grid-column: span ${size};
                background: radial-gradient(ellipse at 30% 20%, rgba(40,80,140,0.7), rgba(15,25,50,0.85));
                border: 2px solid rgba(100,180,255,0.2);
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                display: flex; align-items: center; justify-content: center;
                font-size: var(--fs-4xl); font-weight: 700; color: ${color};
            ">
                <span data-sensor="${widget.sensor || ''}">--</span>
            </div>
        `;
    },
};
```

---

## Neues Widget einbinden — Schritt für Schritt

### 1. Widget-Datei anlegen

`frontend/widgets/mein.js` mit der obigen Struktur anlegen.

### 2. In index.html eintragen

Die `<script>`-Tags der Widget-Dateien müssen **vor** `dashboard_renderer.js` und `dashboard-editor.js` stehen:

```html
<!-- Dashboard Widgets Registry -->
<script src="widgets/gauge.js"></script>
<script src="widgets/sensor.js"></script>
<script src="widgets/clock.js"></script>
<script src="widgets/compass.js"></script>
<script src="widgets/text.js"></script>
<script src="widgets/spacer.js"></script>
<script src="widgets/horizon.js"></script>
<script src="widgets/mein.js"></script>   <!-- ← hinzufügen -->
```

### 3. DSL-Parser erweitern (falls nötig)

Der Renderer und Editor delegieren Rendering/Serialisierung vollständig an die Registry. Der DSL-Parser (`dashboard_renderer.js` → `parseDSL()`) muss nur erweitert werden, wenn das neue Widget eigene DSL-Schlüsselwörter einführt, die der Parser noch nicht kennt.

---

## Sensor-Daten im renderHTML-Kontext

`renderHTML` wird beim initialen Rendern aufgerufen — Sensor-Werte sind zu diesem Zeitpunkt noch nicht vorhanden. Für Live-Updates nutze `data-*`-Attribute:

```
data-sensor="boot/batterie"          → DashboardRenderer schreibt ersten numerischen Wert
data-gauge-path="gauge-arc-123"      → SVG-Pfad für Gauge-Arc
data-gauge-needle="gauge-needle-123" → SVG-Element für Nadel
```

`DashboardRenderer.updateValues(sensors)` aktualisiert alle Elemente mit diesen Attributen im DOM — ohne `renderHTML` erneut aufzurufen.

Die `sensors`-Map in `renderSlotControls` hat die Struktur (aus `/api/sensors/list`):

```js
[
  {
    base_name: "boot/batterie",
    name:      "Batterie",
    unit:      "V",
    values:    { "spannung": "12.6", "strom": "3.2" }
  },
  ...
]
```

---

## Vorhandene Widget-Typen

| Datei         | Typ      | DSL-Schlüssel | Besonderheiten                         |
|---------------|----------|---------------|----------------------------------------|
| `gauge.js`    | `gauge`  | `GAUGE`       | arc270/arc180/arc360/bar, SVG, Nadel   |
| `sensor.js`   | `sensor` | `SENSOR`      | card/compact/minimal, Einheit, Alias   |
| `clock.js`    | `clock`  | `CLOCK`       | Systemzeit, kein Sensor                |
| `compass.js`  | `compass`| `COMPASS`     | Platzhalter, kein Sensor               |
| `text.js`     | `text`   | `TEXT`        | Freitext, Stil (title/subtitle/normal) |
| `spacer.js`   | `spacer` | `SPACER`      | Unsichtbar, nur SIZE                   |
| `horizon.js`  | `horizon`| `HORIZON`     | Platzhalter (Horizont)                 |

---

## Dateiübersicht

| Datei                        | Ändern wenn…                                            |
|------------------------------|---------------------------------------------------------|
| `frontend/widgets/*.js`      | Ein Widget geändert oder neu hinzugefügt wird           |
| `frontend/index.html`        | Ein neues Widget-Script eingebunden werden muss         |
| `frontend/dashboard_renderer.js` | Das Rendering-Framework erweitert werden muss       |
| `frontend/js/dashboard-editor.js` | Der Editor neue Widget-Typen im Typ-Picker zeigen soll |

`dashboard_renderer.js` und `dashboard-editor.js` müssen für neue Widget-Typen **nicht** geändert werden — nur `index.html` und die neue Widget-Datei.
