#!/usr/bin/env python3
"""
Filtere und gruppiere OSM-Schleusen:
- Entferne lock_gate (einzelne Tore)
- Gruppiere Duplikate nach Name und Position
- Erstelle bereinigte Schleusen-Liste
"""

import json
import math
from pathlib import Path
from collections import defaultdict

def calculate_distance(lat1, lon1, lat2, lon2):
    """Berechne Distanz in Metern zwischen zwei Koordinaten"""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def normalize_name(name):
    """Normalisiere Namen für Vergleich"""
    import re
    name = name.lower()
    name = re.sub(r'[^\w\s]', ' ', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def filter_locks(input_file, output_file):
    """Filtere und gruppiere Schleusen"""

    print("=" * 80)
    print("SCHLEUSEN-FILTER & GRUPPIERUNG")
    print("=" * 80)
    print()

    # Lade OSM-Daten
    with open(input_file, 'r', encoding='utf-8') as f:
        all_locks = json.load(f)

    print(f"Gesamt OSM-Eintraege: {len(all_locks)}")

    # Schritt 1: Entferne lock_gate (einzelne Tore)
    filtered = []
    lock_gates = 0

    for lock in all_locks:
        tags = lock.get('tags', {})
        waterway = tags.get('waterway', '')

        # Filtere lock_gate aus
        if waterway == 'lock_gate':
            lock_gates += 1
            continue

        # Überspringe Einträge ohne richtigen Namen
        if lock['name'].startswith('Lock '):
            continue

        filtered.append(lock)

    print(f"Gefiltert: {lock_gates} lock_gate Eintraege")
    print(f"Nach Filterung: {len(filtered)} Eintraege")
    print()

    # Schritt 2: Gruppiere Duplikate nach Name + Position
    groups = defaultdict(list)

    for lock in filtered:
        # Normalisiere Namen für Gruppierung
        norm_name = normalize_name(lock['name'])

        # Runde Position auf ~100m Genauigkeit
        lat_rounded = round(lock['lat'], 3)
        lon_rounded = round(lock['lon'], 3)

        key = (norm_name, lat_rounded, lon_rounded)
        groups[key].append(lock)

    # Schritt 3: Wähle besten Eintrag aus jeder Gruppe
    deduplicated = []
    duplicates_removed = 0

    for group_locks in groups.values():
        if len(group_locks) == 1:
            deduplicated.append(group_locks[0])
        else:
            # Bei Duplikaten: Bevorzuge waterway=lock, dann am besten dokumentiert
            duplicates_removed += len(group_locks) - 1

            # Sortiere nach Priorität
            def priority(lock):
                score = 0
                tags = lock.get('tags', {})

                # Höchste Priorität: waterway=lock
                if tags.get('waterway') == 'lock':
                    score += 100

                # Mehr Tags = besser dokumentiert
                score += len(tags)

                # Hat Öffnungszeiten?
                if 'opening_hours' in tags:
                    score += 10

                # Hat Dimensionen?
                if 'lock:length' in tags or 'lock:width' in tags:
                    score += 5

                return score

            best = max(group_locks, key=priority)
            deduplicated.append(best)

    print(f"Duplikate entfernt: {duplicates_removed}")
    print(f"Finale Schleusen-Liste: {len(deduplicated)}")
    print()

    # Sortiere nach Namen
    deduplicated.sort(key=lambda x: x['name'])

    # Speichere gefilterte Liste
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(deduplicated, f, indent=2, ensure_ascii=False)

    print(f"Gespeichert: {output_file}")
    print()

    # Statistik
    print("=" * 80)
    print("ZUSAMMENFASSUNG")
    print("=" * 80)
    print(f"Eingabe:     {len(all_locks):5} OSM-Eintraege")
    print(f"lock_gate:   {lock_gates:5} entfernt")
    print(f"Duplikate:   {duplicates_removed:5} entfernt")
    print(f"Ausgabe:     {len(deduplicated):5} bereinigte Schleusen")
    print()

    # Reduzierung
    reduction = (1 - len(deduplicated) / len(all_locks)) * 100
    print(f"Reduzierung: {reduction:.1f}%")
    print()

    return deduplicated

if __name__ == "__main__":
    input_file = Path(__file__).parent / "data" / "locks_osm_improved.json"
    output_file = Path(__file__).parent / "data" / "locks_osm_filtered.json"

    if not input_file.exists():
        print(f"FEHLER: {input_file} nicht gefunden!")
        exit(1)

    filter_locks(input_file, output_file)
    print("FERTIG!")
