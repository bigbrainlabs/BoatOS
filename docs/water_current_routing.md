# Wasserströmung im Routing — Stand & Offene Punkte

## Was wurde gebaut

### Frontend (`frontend/js/settings.js`)
`saveAllSettings()` baut jetzt das `waterCurrent`-Objekt korrekt auf und schickt es ans Backend:
```json
{
  "waterCurrent": {
    "enabled": true,
    "byName": {
      "Elbe":  { "current_kmh": 3.5, "type": "river" },
      "Saale": { "current_kmh": 1.1, "type": "river" },
      ...
    },
    "byType": { "river": 2.0, "canal": 0.0, ... }
  }
}
```
Vorher wurde nur `routing.waterCurrentEnabled` gespeichert — das Backend konnte den Dienst nie aktivieren.

---

### Backend (`backend/app/water_current.py`)

#### Gewässererkennung — 2-stufig
1. **Geographische Bounding Boxes** — jeder Fluss hat einen Bereich, außerhalb dessen er ausgeschlossen wird (Rhein kann nicht bei lon 12°E sein, Main nicht bei lat 52°N etc.)
2. **Kursmatch** — Routenkurs muss innerhalb 50° der Fließ- oder Gegenrichtung des Flusses liegen. Bei mehreren Treffern gewinnt der Fluss mit der höchsten konfigurierten Strömungsgeschwindigkeit.

```python
self.river_areas = {
    'Rhein': (47.5, 52.0,  6.0,  9.0),
    'Mosel': (49.2, 50.4,  6.0,  7.7),
    'Main':  (49.7, 50.3,  8.0, 12.7),
    'Elbe':  (50.9, 54.0,  9.0, 15.0),
    'Saale': (51.0, 52.6, 11.3, 12.6),
    ...
}
```

#### Fließrichtung — mündungsbasiert
Statt fester Winkel pro Fluss (die bei jeder Kurve falsch sind) wird für jedes Routensegment der Kurs vom Segmentmittelpunkt zur **Flussmündung** berechnet. Dieser Kurs ist die lokale Fließrichtung — automatisch korrekt für jeden Abschnitt.

```python
self.river_mouths = {
    'Elbe':  (53.895,  8.668),  # Cuxhaven
    'Saale': (51.966, 11.897),  # Barby (in die Elbe)
    'Rhein': (51.960,  4.120),  # Hoek van Holland
    'Main':  (50.007,  8.274),  # Mainz
    'Mosel': (50.370,  7.608),  # Koblenz
    ...
}
```

#### ETA-Berechnung — gewichteter Durchschnitt
Vorher wurde die Summe der Segment-Luftlinienabstände als Gesamtdistanz genutzt — das war immer kürzer als die echte Routenlänge. Jetzt:
1. Effektivgeschwindigkeit jedes Segments gewichtet nach Segmentlänge → Ø-Effektivgeschwindigkeit
2. Diese Ø-Geschwindigkeit auf die **echte Routendistanz** (aus OSRM) angewendet

```python
avg_effective_speed = weighted_speed_sum / total_sampled_dist
total_adjusted_time = distance_km / avg_effective_speed
```

---

## Aktuell getestetes Verhalten

| Route | Ergebnis |
|-------|----------|
| Elbe zu tal (Rosslau→Aken) | ✅ kürzer als Basis |
| Elbe zu berg (Aken→Rosslau) | ✅ länger als Basis |
| Saale zu tal (Calbe→Barby) | ✅ kürzer als Basis |
| Saale zu berg (Barby→Calbe) | ✅ länger als Basis |

Log-Output pro Segment:
```
🌊 Current: boat=9.0km/h, dist=19.5km, river=Elbe, mouth=(53.895,8.668)
   Seg 1: 10.3km, bearing=265°, mouth=302° (↓tal, Δ37°), current=3.5km/h → eff=12.2km/h
   Seg 2:  9.2km, bearing=261°, mouth=298° (↓tal, Δ37°), current=3.5km/h → eff=12.2km/h
🌊 Total: 1.60h (was 2.17h, diff=-0.57h)
```

---

## Offene Punkte / TODOs

### 1. Elbe-Fließrichtung im Bereich Hamburg
Die Bounding Box endet bei lon 15°E, aber der obere Wert `'Elbe': 270°` (West) ist eine Annäherung. Im Abschnitt Magdeburg→Hamburg fließt die Elbe eher WNW (315°). Der Kursmatch kann nahe Hamburg grenzwertig werden. → Die mündungsbasierte Berechnung kompensiert das für die ETA, aber die **Gewässererkennung** bleibt winkelabhängig. Evtl. Bearing-Threshold oder Bounding Box anpassen.

### 2. Kanalstrecken
`byType.canal = 0.0` ist der Defaultwert. Kanäle haben keine Strömung — korrekt. Aber Kanäle werden aktuell gar nicht erkannt (kein Eintrag in `known_flow_directions`). Falls Routing über Kanäle geht, wird der Fallback-Fluss des Gebiets genutzt. Ggf. Kanal-Bounding-Boxes ergänzen und Strömung = 0 explizit setzen.

### 3. Mehrere Flüsse auf einer Route
Eine Route Aken→Hamburg überquert keinen anderen Fluss, aber eine Route z.B. Rhein→Main-Donau-Kanal→Donau würde mehrere Gewässer durchqueren. Aktuell gilt für die gesamte Route **ein** erkannter Fluss. → Erweiterung: Routing in Segmente je Gewässer aufteilen (komplex, braucht Fluss-Polygon-Daten).

### 4. Live-Pegelonline-Daten
`_get_live_current_nearby()` ist vollständig implementiert, aber deaktiviert (`# DISABLED: causing routing timeouts`). Würde echte aktuelle Strömungsmesswerte von Pegelstationen liefern. → Reaktivieren mit Caching (z.B. 5-Min-TTL pro Station) um Timeouts zu vermeiden.

### 5. Anzeige in der Route-Info
`duration_adjusted_h` wird gesetzt und vom Frontend genutzt, aber die Anzeige unterscheidet nicht zwischen "mit Strömung" und "ohne Strömung". Ein kleines `🌊` oder `(Strömung berücksichtigt)` in der ETA-Zeile wäre sinnvoll.

### 6. Einstellungs-UI: Standardwerte
Die HTML-Defaultwerte der Eingabefelder (`setting-current-elbe = 2.2 km/h` etc.) sind generische Mittelwerte. Für den Aken/Saale-Bereich:
- Elbe bei Aken: ca. 2–4 km/h je nach Wasserstand
- Saale bei Calbe: ca. 0.5–2 km/h
→ Werte beim ersten Start aus Pegelonline holen oder deutlicher als "Schätzwert" markieren.

### 7. Neue Gewässer ergänzen
Derzeit fest verdrahtet: Rhein, Mosel, Main, Elbe, Saale, Donau, Weser, Oder.
Für neue Gebiete (Havel, Spree, Neckar etc.) müssen `known_flow_directions`, `river_areas` und `river_mouths` ergänzt werden — alle in `configure()`.

---

## Relevante Dateien

| Datei | Inhalt |
|-------|--------|
| `backend/app/water_current.py` | Gesamte Logik: Gewässererkennung, Mündungsbearing, ETA-Anpassung |
| `backend/app/main.py` Z. 2831 | Aufruf `water_current_service.adjust_route_duration()` nach OSRM-Routing |
| `backend/app/main.py` Z. 3465 | Startup: lädt `settings.json` und ruft `configure()` auf |
| `backend/data/settings.json` | Persistierte Einstellungen inkl. `waterCurrent`-Objekt |
| `frontend/js/settings.js` Z. 176 | Baut `settings.waterCurrent` beim Speichern auf |
| `frontend/js/navigation.js` Z. 883 | Frontend nutzt `duration_adjusted_h` für ETA-Anzeige |
