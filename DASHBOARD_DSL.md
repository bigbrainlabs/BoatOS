# Dashboard DSL (Domain Specific Language)

Einfache, lesbare Sprache zum Definieren von Dashboard-Layouts in BoatOS.

## Grundkonzept

Das Dashboard ist **grid-basiert** und in **Reihen (ROWS)** organisiert. Jede Reihe enthält **Widgets** (Sensoren, Gauges, Charts).

## Syntax-Übersicht

```
GRID <columns>

ROW [name]
  WIDGET sensor_id [OPTIONS]
  WIDGET sensor_id [OPTIONS]
  ...

ROW [name]
  WIDGET sensor_id [OPTIONS]
  ...
```

## Befehle

### GRID
Definiert die Anzahl der Spalten im Grid.

```
GRID 3          # 3 Spalten
GRID 4          # 4 Spalten
```

### ROW
Startet eine neue Reihe. Optionaler Name für bessere Lesbarkeit.

```
ROW hero        # Reihe mit Namen
ROW             # Reihe ohne Namen
```

### Widget-Typen

#### 1. SENSOR
Zeigt einen Sensor mit seinen Werten an.

```
SENSOR <sensor_base_name> [OPTIONS]
```

**Optionen:**
- `SIZE <n>` - Breite in Grid-Spalten (Standard: 1)
- `STYLE <card|hero|compact>` - Darstellungsstil
- `ICON <emoji>` - Überschreibt automatisches Icon
- `ALIAS "<name>"` - Überschreibt Sensor-Namen
- `COLOR <cyan|blue|orange|green|purple>` - Farbschema
- `SHOW <topic1,topic2>` - Zeigt nur diese Topics (kommagetrennt, keine Leerzeichen)
- `HIDE <topic1,topic2>` - Versteckt diese Topics (kommagetrennt, keine Leerzeichen)
- `UNITS "<topic1:suffix1,topic2:suffix2>"` - Einheiten für Topics (z.B. "temp:°C,hum:%")

**Beispiele:**
```
SENSOR navigation/position SIZE 2 STYLE hero SHOW latitude,longitude
SENSOR arielle/bilge/thermo SHOW temp,hum UNITS "temp:°C,hum:%" STYLE compact
SENSOR navigation/gnss/satellites ALIAS "GPS Sats"
SENSOR battery SHOW voltage UNITS "voltage:V" STYLE compact
SENSOR boat/navigation UNITS "speedOverGround:kn,courseOverGroundTrue:°"
```

#### 2. GAUGE
Zeigt einen Wert als Gauge/Anzeige (Tachometer-Style).

```
GAUGE <sensor_path> [OPTIONS]
```

**Optionen:**
- `MIN <value>` - Minimum-Wert (Standard: 0)
- `MAX <value>` - Maximum-Wert (erforderlich)
- `UNIT "<text>"` - Einheit (z.B. "kn", "°C")
- `COLOR <color>` - Farbe
- `SIZE <n>` - Breite in Grid-Spalten

**Beispiele:**
```
GAUGE navigation/speedOverGround MAX 20 UNIT "kn" COLOR cyan
GAUGE engine/temperature MIN 0 MAX 120 UNIT "°C" COLOR orange
```

#### 3. CHART
Zeigt einen Wert als Chart/Diagramm über Zeit.

```
CHART <sensor_path> [OPTIONS]
```

**Optionen:**
- `TYPE <line|bar|area>` - Chart-Typ
- `PERIOD <minutes>` - Zeitraum (Standard: 60)
- `COLOR <color>` - Farbe
- `SIZE <n>` - Breite

**Beispiele:**
```
CHART fuel/level TYPE bar COLOR green PERIOD 120
CHART navigation/speedOverGround TYPE line COLOR cyan
```

#### 4. TEXT
Zeigt statischen oder dynamischen Text.

```
TEXT "<text>" [OPTIONS]
```

**Optionen:**
- `SIZE <n>` - Breite
- `STYLE <title|subtitle|normal>` - Text-Stil
- `COLOR <color>` - Farbe

**Beispiele:**
```
TEXT "Navigation" STYLE title
TEXT "Motordaten" STYLE subtitle COLOR orange
```

## Kommentare

Zeilen, die mit `#` beginnen, sind Kommentare und werden ignoriert.

```
# Dies ist ein Kommentar
GRID 3  # Dies auch
```

## Vollständiges Beispiel

```
# BoatOS Dashboard Layout
# 3-Spalten Grid

GRID 3

# Hero-Bereich mit GPS und Satelliten
ROW hero
  SENSOR navigation/position SIZE 2 STYLE hero ICON 🧭
  SENSOR navigation/gnss/satellites SIZE 1 ALIAS "GPS Sats"

# Gauges für Speed und Kurs
ROW gauges
  GAUGE navigation/speedOverGround MAX 20 UNIT "kn" COLOR cyan
  GAUGE navigation/heading MIN 0 MAX 360 UNIT "°" COLOR blue
  TEXT "Navigation" STYLE subtitle

# Umgebungssensoren
ROW environment
  SENSOR bilge/thermo COLOR blue
  SENSOR outside/temperature COLOR green
  SENSOR outside/humidity COLOR purple

# Charts
ROW charts
  CHART fuel/level TYPE bar COLOR green SIZE 2
  CHART engine/temperature TYPE line COLOR orange SIZE 1
```

## Sensor Base Names

Sensor Base Names entsprechen den MQTT Topic-Basenamen ohne die letzte Ebene:

- `arielle/bilge/thermo` → zeigt temp, hum, battv, etc.
- `boat/navigation/position` → zeigt latitude, longitude
- `boat/navigation/gnss` → zeigt satellites, altitude, etc.

## Standard-Werte

Wenn keine Optionen angegeben werden:

- **SIZE**: 1 (eine Spalte)
- **STYLE**: card
- **COLOR**: cyan
- **ICON**: Auto (basierend auf Sensor-Typ)

## Fehlerbehandlung

- Unbekannte Sensoren werden mit "?" Icon angezeigt
- Syntaxfehler werden geloggt, Zeile wird übersprungen
- Bei leerem/fehlendem Layout wird Default-Layout verwendet

## Default-Layout

Falls keine Konfiguration vorhanden ist, wird ein automatisches Layout generiert basierend auf erkannten Sensoren.

## Validierung

Der Parser validiert:
- ✅ GRID muss als erstes definiert sein
- ✅ Sensor Base Names müssen existieren
- ✅ MIN < MAX bei Gauges
- ✅ SIZE darf nicht größer als GRID sein
- ✅ Optionen müssen gültige Werte haben
