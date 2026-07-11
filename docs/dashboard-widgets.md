# Dashboard-Widget-Registry — Entwicklerdokumentation

Dieses Dokument beschreibt die Widget-Registry-Architektur des BoatOS Helm-Dashboards (Flutter). Sie ermöglicht es, neue Dashboard-Widgets als eigenständige Dart-Dateien hinzuzufügen, ohne bestehenden Code anzufassen.

> Das Deck-Pendant (JS/Web) ist gleich aufgebaut: [dashboard-widgets-deck.md](dashboard-widgets-deck.md). Ein Widget wird je Plattform einmal geschrieben, beide sprechen dasselbe DSL (`backend/app/dashboard_dsl.py`).

---

## Konzept

Jeder Widget-Typ lebt in einer eigenen Datei unter `flutter_app/lib/widgets/dashboard/`. Beim App-Start registriert sich jedes Widget in einer zentralen Registry. Das Dashboard und der Settings-Editor fragen dort ab, wie ein Widget gerendert, bearbeitet und in DSL serialisiert wird.

```
┌─────────────────────────────────────────────────────┐
│                   main.dart                         │
│  initDashWidgetRegistry()  ← einmalig beim Start    │
└───────────────────┬─────────────────────────────────┘
                    │ ruft registerSelf() für jeden Typ
                    ▼
┌─────────────────────────────────────────────────────┐
│           DashWidgetRegistry (registry.dart)        │
│  type → { builder, editor, dsl, label }             │
└───────┬─────────────────────┬───────────────────────┘
        │                     │
        ▼                     ▼
┌───────────────┐   ┌─────────────────────┐
│ dashboard_    │   │  settings_screen.dart│
│ screen.dart   │   │  _WidgetEditDialog   │
│ _buildWidget()│   │  _toWidgetDsl()      │
└───────────────┘   └─────────────────────┘
```

---

## Dateistruktur

```
flutter_app/lib/widgets/dashboard/
├── registry.dart          ← Registry-Klasse (nicht anfassen)
├── registry_init.dart     ← registerSelf() aller Widgets aufrufen
├── dash_widget.dart       ← DashWidget-Datenmodell + DashRow
├── gauge_widget.dart      ← GAUGE + gemeinsame Editor-Sub-Widgets
├── sensor_widget.dart     ← SENSOR
├── clock_widget.dart      ← CLOCK
├── compass_widget.dart    ← COMPASS
├── text_widget.dart       ← TEXT
├── spacer_widget.dart     ← SPACER
└── horizon_widget.dart    ← HORIZON (künstlicher Horizont)
```

---

## Neues Widget erstellen — Schritt für Schritt

### 1. Neue Datei anlegen

Datei: `flutter_app/lib/widgets/dashboard/mein_widget.dart`

```dart
import 'package:flutter/material.dart';
import 'dash_widget.dart';
import 'registry.dart';

class MeinDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type:    'MEIN',          // DSL-Schlüsselwort (Großbuchstaben)
      label:   'Mein Widget',   // Anzeigename im Editor
      builder: build,
      editor:  buildEditor,
      dsl:     toDsl,
    );
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    // sensors: Map<base_name, { 'values': { 'feld': wert }, 'name': '...' }>
    final path = w.sensor ?? '';
    final rawVal = sensors[path]?['values']?['meinFeld'];
    final value  = rawVal is num ? rawVal.toDouble() : double.tryParse('$rawVal') ?? 0.0;

    return Container(
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Text('$value',
          style: const TextStyle(fontSize: 24, color: Color(0xFF4FC3F7))),
    );
  }

  // ── Editor ─────────────────────────────────────────────────────────────────

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    // allSensors: Liste aller bekannten Sensoren (aus /api/sensors/list)
    // setState:   aufrufen wenn sich w ändert, damit die Vorschau aktualisiert
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Sensor auswählen:'),
      DashSensorListPicker(
        sensors: allSensors,
        selected: w.sensor,
        onSelect: (path) => setState(() => w.sensor = path),
      ),
      const SizedBox(height: 14),
      _lbl('Breite (Spalten)'),
      const SizedBox(height: 6),
      DashSizePicker(
        value: w.size,
        onSelect: (n) => setState(() => w.size = n),
      ),
    ]);
  }

  // ── DSL-Serialisierung ─────────────────────────────────────────────────────

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('MEIN ${w.sensor ?? 'unbekannt'}');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    return buf.toString();
  }

  static Widget _lbl(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));
}
```

> `DashSensorListPicker`, `DashSizePicker`, `DashStyleChips`, `DashDecimalsPicker` sind fertige
> Editor-Sub-Widgets, die aus `gauge_widget.dart` importiert werden können.

---

### 2. In registry_init.dart eintragen

```dart
// flutter_app/lib/widgets/dashboard/registry_init.dart
import 'mein_widget.dart';   // ← hinzufügen

void initDashWidgetRegistry() {
  GaugeDashWidget.registerSelf();
  SensorDashWidget.registerSelf();
  // ...
  MeinDashWidget.registerSelf();  // ← hinzufügen
}
```

Das war es. Das Widget erscheint sofort im Editor und kann im DSL verwendet werden.

---

### 3. DSL-Parser erweitern (optional)

Der Parser in `dashboard_screen.dart` kennt alle Standard-Widgets bereits. Wenn dein Widget eigene DSL-Parameter braucht, kannst du sie über `DashWidget`-Felder abbilden. Für einfache Fälle (ein Sensor-Pfad + SIZE) ist das nicht nötig.

Für komplexere Parameter (wie `HORIZON` mit `rollSensor=`, `pitchSensor=`): ein `case 'MEIN':`-Block in `_parseDSL()` und `_parseWidgetFromTokens()` in `dashboard_screen.dart` hinzufügen.

---

## Das DashWidget-Datenmodell

`DashWidget` ist das einheitliche Konfigurationsobjekt, das zwischen Parser, Renderer und Editor geteilt wird. Alle Felder sind `var` (veränderbar), damit der Editor sie direkt schreiben kann.

```dart
class DashWidget {
  String  type;          // 'GAUGE', 'SENSOR', 'HORIZON', ...
  String? sensor;        // Sensor-Pfad (base_name)
  String? field;         // Einzelnes Feld (für GAUGE/SENSOR)
  String? alias;         // Anzeigename (AS "...")
  String? style;         // Stil (arc270, card, ...)
  double? min, max;      // Wertebereich (GAUGE)
  String? unit;          // Einheit (GAUGE)
  String? label;         // Beschriftung (GAUGE)
  int?    decimals;      // Nachkommastellen
  String? text;          // Freitext (TEXT-Widget)
  int     size;          // Breite in Spalten (Standard: 1)
  String? color;         // Farbe (Bezeichner wie 'cyan', 'amber')

  // HORIZON-spezifisch
  String? rollSensor, rollField;
  String? pitchSensor, pitchField;
  String? impactSensor, impactField;
}
```

Neue Widget-spezifische Felder können jederzeit zu `DashWidget` hinzugefügt werden.

---

## Die Registry-API

```dart
// Registrieren (einmalig beim Start)
DashWidgetRegistry.register({
  required String       type,
  required String       label,
  required WidgetBuilder  builder,  // (w, sensors, {impactMuted}) → Widget
  required EditorBuilder  editor,   // (w, setState, allSensors) → Widget
  required DslSerializer  dsl,      // (w) → String
});

// Aufrufen (in dashboard_screen.dart und settings_screen.dart)
Widget  rendered = DashWidgetRegistry.build(w, sensors, impactMuted: false);
Widget  editor   = DashWidgetRegistry.buildEditor(w, setState, sensors);
String  dslLine  = DashWidgetRegistry.toDsl(w);

// Meta
Iterable<String> types  = DashWidgetRegistry.registeredTypes;
String           label  = DashWidgetRegistry.labelFor('GAUGE');
bool             exists = DashWidgetRegistry.isRegistered('MEIN');
```

---

## Sensor-Daten im Builder lesen

Der `sensors`-Parameter in `build()` ist eine Map mit der Struktur:

```
{
  "boot/batterie": {
    "base_name": "boot/batterie",
    "name":      "Batterie",
    "unit":      "V",
    "values": {
      "spannung": "12.6",
      "strom":    "3.2"
    }
  },
  ...
}
```

Typisches Lesemuster:

```dart
// Ersten numerischen Wert aus einem Sensor lesen
double value = 0;
final entry = sensors[w.sensor ?? ''];
if (entry != null) {
  for (final v in (entry['values'] as Map).values) {
    final d = v is num ? v.toDouble() : double.tryParse('$v');
    if (d != null) { value = d; break; }
  }
}

// Spezifisches Feld lesen
final raw = sensors['mein/sensor']?['values']?['meinFeld'];
final d   = raw is num ? raw.toDouble() : double.tryParse('$raw') ?? 0.0;
```

Die Hilfsfunktion `dashGetValue(sensors, path)` aus `gauge_widget.dart` deckt den häufigsten Fall ab (erster numerischer Wert, oder `base/feld`-Pfad).

---

## Fortgeschritten: Live-Daten (GPS/Backend/Route) + CustomPainter

Manche Widgets leben nicht aus dem MQTT-`sensors`-Map, sondern aus GPS, der aktiven Route oder einem Backend-Endpoint und zeichnen selbst. Dann gibt `build()` einen **StatefulWidget** zurück, der Provider konsumiert und ggf. das Backend pollt. Vorbild: `compass_widget.dart` (Navi-Master-Instrument).

Verfügbare Provider (in `main.dart` registriert, App-weit):

```dart
// GPS live (lat/lon, speed in Knoten, heading in Grad)
final gps = context.watch<WebSocketService>().gps;   // GpsData?  → gps?.lat, gps?.speed, …

// Einheiten aus den Settings
final s = context.watch<SettingsService>();
final kmh = s.isKmh;   // Geschwindigkeit km/h vs. kn
final km  = s.isKm;    // Distanz km vs. NM

// Aktive Route-Polyline (Backend-broadcast, Deck ↔ Helm-synchron) → Restweg/Peilung
final coords = context.watch<WebSocketService>().route;  // List<[lat, lon]>, leer = keine Route
```

Backend-Daten throttled holen (sonst hämmert ein fahrendes Boot das Backend — s. pegelonline-Vollload-Falle):

```dart
Timer.periodic(const Duration(seconds: 2), (_) {
  final gps = context.read<WebSocketService>().gps;
  if (gps == null || _busy || now - _last < const Duration(seconds: 5)) return;
  _busy = true; _last = now;
  http.get(Uri.parse('http://localhost:8000/api/nav/point?lat=${gps.lat}&lon=${gps.lon}'))
      .timeout(const Duration(seconds: 12))
      .then((r) { if (mounted) setState(() => _data = jsonDecode(r.body)); })
      .catchError((_) {}).whenComplete(() => _busy = false);
});
```

Gezeichnet wird per `CustomPainter` (alles relativ zur Kantenlänge `s`, damit die Proportionen beim Skalieren bleiben) in einem `LayoutBuilder` → `CustomPaint`. Den Rahmen (Card) bringt jedes Widget selbst mit — `Container(decoration: BoxDecoration(color: 0xFF161B22, borderRadius: 12, border: 0xFF30363D))`.

> Die aktive Route ist Backend-State: Deck **und** Helm posten sie bei jeder Änderung an `POST /api/nav/route`, das Backend broadcastet `route_update` an alle WS-Clients. Der `WebSocketService` hält sie (`route`-Getter) — so ist die Route plattformübergreifend synchron (Instrument + Karten-Linie).

---

## Vorhandene Editor-Sub-Widgets

Alle in `gauge_widget.dart` (Dashboard-Ordner) definiert:

| Widget               | Beschreibung                              |
|----------------------|-------------------------------------------|
| `DashSensorListPicker` | Scrollbare Sensor-Liste mit Suche       |
| `DashSizePicker`     | Spaltenbreite 1–4 als Chip-Auswahl       |
| `DashStyleChips`     | Stil-Auswahl als Toggle-Chips            |
| `DashDecimalsPicker` | Nachkommastellen 0–3 als Chip-Auswahl    |

---

## Dateiübersicht

| Datei                  | Ändern wenn…                                        |
|------------------------|-----------------------------------------------------|
| `registry.dart`        | Die Registry-Schnittstelle selbst ändern            |
| `registry_init.dart`   | Ein neues Widget hinzugefügt wird                   |
| `dash_widget.dart`     | Das Datenmodell neue Felder braucht                 |
| `dashboard_screen.dart`| DSL-Parser für neue Schlüsselwörter erweitern       |
| `*_widget.dart`        | Das jeweilige Widget geändert/erweitert wird        |
| `services/websocket_service.dart` / `main.dart` | Ein neues Widget App-weite Live-Daten (GPS/Route/Provider) braucht |

Weder `dashboard_screen.dart` noch `settings_screen.dart` müssen für neue Widget-Typen geändert werden — nur `registry_init.dart` und die neue Widget-Datei.
