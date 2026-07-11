# Dashboard-Widget-Registry — Deck (JS/Web)

Wie man dem BoatOS-**Deck**-Dashboard (Browser/Web-Frontend) eigene Widgets als eigenständige JS-Dateien hinzufügt — ohne den Renderer oder Editor anzufassen.

> Das Helm-Pendant (Flutter/Dart) ist gleich aufgebaut: [dashboard-widgets.md](dashboard-widgets.md). Ein Widget wird je Plattform einmal geschrieben, beide sprechen dasselbe DSL.

---

## Konzept

Jeder Widget-Typ ist ein **selbst-registrierendes Modul**. Beim Laden ruft es `window.dashWidgets.register({...})`. Renderer und Editor fragen die Registry ab, wie ein Widget gezeichnet, editiert und in DSL serialisiert wird.

```
index.html
  <script src="js/dashboard/registry.js">          ← Registry-Kern (zuerst)
  <script src="js/dashboard/widgets/<typ>.js"> …   ← Module (registrieren sich)
  <script src="dashboard_renderer.js">             ← nutzt window.dashWidgets
  <script src="js/dashboard-editor.js">
        │
        ▼
window.dashWidgets           (globales Registry-Objekt)
  register(def) · render(w,ctx) · buildEditor(w,ctx)
  iconFor / nameFor · toDsl(w,opts) · labelFor / isRegistered
        │
        ├─ dashboard_renderer.js  → dashWidgets.render(w, {r, size})
        └─ dashboard-editor.js    → iconFor/nameFor/buildEditor/toDsl
```

> **Wichtig:** Die Registry liegt auf **`window.dashWidgets`** (bewusst *nicht* unter `window.BoatOS` — das wird von `main.js` neu zugewiesen und würde die Registry löschen).

---

## Dateistruktur

```
frontend/
├── js/dashboard/
│   ├── registry.js            ← Registry-Kern (nicht anfassen)
│   └── widgets/
│       ├── sensor.js  gauge.js  chart.js  clock.js
│       ├── text.js    spacer.js horizon.js compass.js
│       └── <dein-widget>.js    ← neu
├── dashboard_renderer.js       ← ruft render()
└── js/dashboard-editor.js      ← ruft iconFor/nameFor/buildEditor/toDsl
```

---

## Der Widget-Contract

`register()` nimmt ein Objekt. Nur `type`, `label` und `render` sind Pflicht:

```js
window.dashWidgets.register({
  type:  'MEIN',              // kanonisch GROSS (wie das DSL-Keyword)
  label: 'Mein Widget',       // Anzeigename im Editor

  render(widget, ctx)  { … }, // → HTML-String  (Pflicht)
  editor(widget, ctx)  { … }, // → HTML der Property-Felder (optional)
  icon(widget, ed)     { … }, // → Emoji für die Editor-Liste (optional)
  name(widget, ed)     { … }, // → Anzeigename in der Editor-Liste (optional)
  dsl(widget, opts)    { … }, // → DSL-Zeile (optional, sonst nicht speicherbar)
});
```

### `render(widget, ctx)` — Darstellung → HTML-String

`ctx = { r, size, slot }`:
- `ctx.r` — die `DashboardRenderer`-Instanz (Sensordaten `ctx.r.sensors`, Helfer wie `ctx.r.getSensorValue(path)`, `ctx.r.generateId(prefix)`, `ctx.r.formatValue(...)`).
- `ctx.size` — Breite in Grid-Spalten. **`grid-column: span ${ctx.size}` ist Pflicht** im äußersten Element (außer im Screen-Slot, s.u.).
- `ctx.slot` — `true`, wenn in einem Screen-Slot gerendert (dann meist ohne `grid-column`-span).

```js
render(widget, ctx) {
  const val = ctx.r.getSensorValue(widget.sensor) ?? '–';
  return `
    <div class="gauge-widget" style="grid-column: span ${ctx.size};">
      <span data-sensor-path="${widget.sensor}">${val}</span>
    </div>`;
}
```

**Live-Updates:** `render()` läuft nur beim (Neu-)Aufbau. Für Sekunden-Updates eigene `data-*`-Attribute setzen — `DashboardRenderer.updateValues()` (1 s-Takt) schreibt neue Werte hinein, ohne `render()` erneut aufzurufen:

```
data-sensor-path="boot/batterie/spannung"  → Wert wird ersetzt
data-gauge-path="…" data-min="0" data-max="100" data-style="arc270" → Gauge-Nadel/Arc
```

Für Canvas-Instrumente gibt es ein eigenes Muster (s. „Fortgeschritten").

### `editor(widget, ctx)` — Property-Panel → HTML-String

`ctx = { ed, idx }`. `ed` ist der `DashboardEditor` (`ed.sensors`, `ed.sensorGroups`, Helfer wie `ed._renderSensorFieldCheckboxes(idx, w)`), `idx` der Widget-Index. Änderungen laufen über `window.dashboardEditor.updateWidget(idx, prop, value)` (schreibt ins Widget + re-rendert sofort):

```js
editor(w, ctx) {
  return `
    <div>
      <label>Sensor</label>
      <select onchange="window.dashboardEditor.updateWidget(${ctx.idx},'sensor',this.value)">
        <option value="">— keiner —</option>
        ${(ctx.ed.sensorGroups||[]).map(s =>
          `<option value="${s.base_name}" ${w.sensor===s.base_name?'selected':''}>${s.name}</option>`
        ).join('')}
      </select>
    </div>`;
}
```

Der gemeinsame Rahmen (Typ-Badge, Reihe, Farbe, Verschieben) kommt automatisch — `editor()` liefert nur die **typ-spezifischen** Felder. Ohne `editor()` hat das Widget nur die gemeinsamen Felder.

### `dsl(widget, opts)` — Serialisierung → DSL-Zeile

`opts.withSize` = `true` im Grid-Modus (dann `SIZE` anhängen), `false` im Screen-Slot. **Keyword GROSS.** Ohne `dsl()` lässt sich das Widget nicht speichern.

```js
dsl(w, o) {
  let line = `MEIN ${w.sensor || ''}`.trim();
  if (o.withSize && w.size > 1) line += ` SIZE ${w.size}`;
  if (w.color && w.color !== 'cyan') line += ` COLOR ${w.color}`;
  return line;
}
```

### `icon(widget, ed)` / `name(widget, ed)`

Emoji + Name in der Editor-Widget-Liste. Fehlen sie, gilt `📦` bzw. der Typ.

---

## Neues Widget einbinden — Schritt für Schritt

**1. Modul anlegen** `frontend/js/dashboard/widgets/mein.js`:

```js
(function () {
  'use strict';
  window.dashWidgets.register({
    type: 'MEIN',
    label: 'Mein Widget',
    render: (w, ctx) => `<div class="gauge-widget" style="grid-column: span ${ctx.size};">…</div>`,
    icon:  () => '🧩',
    name:  (w) => 'Mein Widget',
    dsl:   (w, o) => 'MEIN' + (o.withSize && w.size > 1 ? ` SIZE ${w.size}` : ''),
    // editor: (w, ctx) => `…`,   // optional
  });
})();
```

**2. In `frontend/index.html` einbinden** — **vor** `dashboard_renderer.js`, nach `registry.js`:

```html
<script src="js/dashboard/registry.js"></script>
<script src="js/dashboard/widgets/sensor.js"></script>
…
<script src="js/dashboard/widgets/mein.js"></script>   <!-- ← neu -->
<script src="dashboard_renderer.js"></script>
```

**3. Im Editor sichtbar machen** (optional): Eintrag in der „Spezial"-Liste des Add-Panels in `js/dashboard-editor.js`.

**4. DSL-Parser** (`backend/app/dashboard_dsl.py`) nur erweitern, wenn das Widget **neue** DSL-Keywords/-Felder einführt. Der Parser ist die kanonische Grammatik-Quelle (case-insensitiv). Für ein simples `MEIN <sensor> SIZE n` genügt ein `_parse_*`-Zweig analog `_parse_compass`.

`dashboard_renderer.js` und `dashboard-editor.js` müssen für neue Typen **nicht** geändert werden.

---

## Fortgeschritten: Canvas-Instrument mit Backend-/Live-Daten

Das **Navi-Instrument** (`js/dashboard/widgets/compass.js` → `dashboard_renderer.js`-Methoden) zeigt das Muster für ein Widget, das nicht aus dem `sensors`-Map lebt, sondern aus GPS + einem Backend-Endpoint, und auf Canvas zeichnet:

- **Hülle:** `render()` gibt einen Container mit `<canvas data-nav-instrument>` zurück (kein `data-sensor-path`).
- **Zeichnen:** eine `drawX(canvas)`-Methode am Renderer, alles relativ zur Kantenlänge `s` (Proportionen bleiben beim Skalieren). Canvas-Größe aus dem Eltern-Container (`min(clientWidth, clientHeight)`), **nicht** `canvas.offsetWidth` (bleibt auf 300 hängen).
- **Anstoßen:** in `render()`s `requestAnimationFrame` + in `updateValues()` (1 s) ein `_drawX()` aufrufen, das alle `[data-nav-instrument] canvas` neu dimensioniert und zeichnet.
- **Backend-Daten:** throttled fetchen (z. B. max 1×/5 s, sonst hämmert es das Backend — siehe die pegelonline-Vollload-Falle) und das Ergebnis auf `window.BoatOS.context` ablegen, das der Painter liest.

Live-Werte, die andere Module setzen (GPS SOG/COG, Restweg/Peilung), liegen auf `window.BoatOS.context` (von `main.js`/`navigation.js` gepflegt).

---

## Sensor-Daten-Format

`ctx.r.sensors` bzw. `ctx.ed.sensorGroups` (aus `/api/sensors/list`):

```js
{
  "boot/batterie": {
    base_name: "boot/batterie", name: "Batterie", unit: "V",
    values: { spannung: "12.6", strom: "3.2" }
  }, …
}
```

`ctx.r.getSensorValue(path)` löst `base_name` **oder** `base_name/feld` auf (erster numerischer Wert bei fehlendem Feld).

---

## Vorhandene Widget-Typen

| Modul        | Typ        | DSL        | Besonderheit                                   |
|--------------|------------|------------|------------------------------------------------|
| `sensor.js`  | `SENSOR`   | `SENSOR`   | card/compact/minimal/hero, Feld-Auswahl, Alias |
| `gauge.js`   | `GAUGE`    | `GAUGE`    | arc180/270/360/bar, SVG, Min/Max/Einheit/Dez.  |
| `chart.js`   | `CHART`    | `CHART`    | Zeitreihe (line/bar/area), Periode             |
| `clock.js`   | `CLOCK`    | `CLOCK`    | Uhrzeit/Datum, kein Sensor                     |
| `text.js`    | `TEXT`     | `TEXT`     | Freitext, Stil title/subtitle/normal           |
| `spacer.js`  | `SPACER`   | `SPACER`   | unsichtbar, nur SIZE                           |
| `horizon.js` | `HORIZON`  | `HORIZON`  | künstlicher Horizont (Canvas), roll/pitch/impact |
| `compass.js` | `COMPASS`  | `COMPASS`  | Navi-Master-Instrument (Canvas + Backend-Daten) |

---

## Dateiübersicht

| Datei                              | Ändern wenn…                                  |
|------------------------------------|-----------------------------------------------|
| `js/dashboard/widgets/*.js`        | ein Widget geändert/neu hinzugefügt wird      |
| `frontend/index.html`              | ein neues Widget-Script eingebunden wird      |
| `js/dashboard/registry.js`         | die Registry-Schnittstelle selbst ändern      |
| `js/dashboard-editor.js`           | ein neuer Typ im Add-Picker erscheinen soll   |
| `backend/app/dashboard_dsl.py`     | neue DSL-Keywords/-Felder geparst werden      |
