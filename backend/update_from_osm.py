#!/usr/bin/env python3
"""
Aktualisiere Datenbank-Schleusen mit korrekten OSM-Koordinaten
Nutzt die gefilterten OSM-Daten von locks_germany_filtered.json
"""

import sys
import json
import math
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

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

def fuzzy_match_name(name1, name2, threshold=0.6):
    """Fuzzy Name Matching - gibt (is_match, score) zurück"""
    norm1 = normalize_name(name1)
    norm2 = normalize_name(name2)

    # Exakte Übereinstimmung
    if norm1 == norm2:
        return True, 1.0

    # Teilstring-Übereinstimmung
    if norm1 in norm2 or norm2 in norm1:
        shorter = min(len(norm1), len(norm2))
        longer = max(len(norm1), len(norm2))
        score = shorter / longer
        return score >= threshold, score

    # Wort-Übereinstimmung
    words1 = set(norm1.split())
    words2 = set(norm2.split())
    common = words1 & words2

    if common:
        score = len(common) / max(len(words1), len(words2))
        return score >= threshold, score

    return False, 0.0

def update_locks(dry_run=True):
    """Aktualisiere Datenbank mit OSM-Koordinaten"""

    print("=" * 80)
    print("DATENBANK-UPDATE MIT OSM-KOORDINATEN")
    print("=" * 80)
    if dry_run:
        print("MODUS: DRY RUN (keine Änderungen)")
    else:
        print("MODUS: LIVE UPDATE (Datenbank wird geändert!)")
    print()

    # Lade Datenbank-Schleusen
    db_locks = locks_storage.load_locks()
    print(f"Datenbank-Schleusen: {len(db_locks)}")

    # Lade gefilterte OSM-Schleusen
    osm_file = Path(__file__).parent / "data" / "locks_germany_filtered.json"

    if not osm_file.exists():
        print(f"\n❌ FEHLER: {osm_file} nicht gefunden!")
        print("   Bitte erst 'py fetch_locks_osm.py' ausführen.")
        return

    with open(osm_file, 'r', encoding='utf-8') as f:
        osm_locks = json.load(f)
    print(f"OSM-Schleusen:       {len(osm_locks)}")
    print()

    # Matching
    matches = []
    no_match = []
    skipped = []

    for db_lock in db_locks:
        db_name = db_lock['name']
        db_lat = db_lock['lat']
        db_lon = db_lock['lon']

        # Suche beste Übereinstimmung in OSM
        best_match = None
        best_score = 0.0
        best_distance = float('inf')

        for osm_lock in osm_locks:
            is_match, score = fuzzy_match_name(db_name, osm_lock['name'])

            if is_match:
                distance = calculate_distance(db_lat, db_lon, osm_lock['lat'], osm_lock['lon'])

                # Bevorzuge bessere Namen-Übereinstimmung, dann geringere Distanz
                if score > best_score or (score == best_score and distance < best_distance):
                    best_match = osm_lock
                    best_score = score
                    best_distance = distance

        if best_match:
            # Nur aktualisieren wenn Distanz > 50m (signifikante Abweichung)
            if best_distance > 50:
                matches.append({
                    'db_lock': db_lock,
                    'osm_lock': best_match,
                    'score': best_score,
                    'distance': best_distance
                })
            else:
                skipped.append({
                    'db_lock': db_lock,
                    'osm_lock': best_match,
                    'distance': best_distance
                })
        else:
            no_match.append(db_lock)

    # Sortiere nach Distanz
    matches.sort(key=lambda x: x['distance'], reverse=True)

    # Statistik
    print("=" * 80)
    print("MATCHING-ERGEBNISSE")
    print("=" * 80)
    print(f"Zu aktualisierende Schleusen: {len(matches)} (Abweichung > 50m)")
    print(f"Bereits korrekt:               {len(skipped)} (< 50m Abweichung)")
    print(f"Keine OSM-Übereinstimmung:     {len(no_match)}")
    print()

    # Zeige was aktualisiert wird
    if matches:
        print("=" * 80)
        print(f"SCHLEUSEN MIT GROSSTEN ABWEICHUNGEN (werden aktualisiert):")
        print("=" * 80)
        print(f"{'DB-Name':35} {'OSM-Name':35} {'Distanz':10}")
        print("-" * 80)

        for match in matches[:20]:  # Zeige Top 20
            db_name = match['db_lock']['name'][:34]
            osm_name = match['osm_lock']['name'][:34]
            distance = int(match['distance'])

            print(f"{db_name:35} {osm_name:35} {distance:9}m")

        if len(matches) > 20:
            print(f"... und {len(matches) - 20} weitere")

        print()

    # Zeige Schleusen ohne Übereinstimmung
    if no_match:
        print("=" * 80)
        print(f"SCHLEUSEN OHNE OSM-UBEREINSTIMMUNG ({len(no_match)}):")
        print("=" * 80)
        for lock in no_match[:10]:
            print(f"  - {lock['name']}")
        if len(no_match) > 10:
            print(f"  ... und {len(no_match) - 10} weitere")
        print()

    # Durchschnittliche Distanz
    if matches:
        avg_distance = sum(m['distance'] for m in matches) / len(matches)
        print(f"Durchschnittliche Abweichung der zu aktualisierenden Schleusen: {int(avg_distance)}m")
        print()

    # Update ausführen
    if not dry_run and matches:
        print("=" * 80)
        print("AKTUALISIERE DATENBANK...")
        print("=" * 80)

        updated = 0
        for match in matches:
            db_lock = match['db_lock']
            osm_lock = match['osm_lock']

            print(f"Aktualisiere: {db_lock['name']}")
            print(f"  Alt: {db_lock['lat']:.6f}, {db_lock['lon']:.6f}")
            print(f"  Neu: {osm_lock['lat']:.6f}, {osm_lock['lon']:.6f}")

            # Update in Datenbank
            locks_storage.update_lock(db_lock['id'], {
                'lat': osm_lock['lat'],
                'lon': osm_lock['lon']
            })

            updated += 1

        print()
        print(f"✅ {updated} Schleusen aktualisiert!")

    elif dry_run:
        print("=" * 80)
        print("DRY RUN - Keine Änderungen vorgenommen")
        print("=" * 80)
        print("Um die Datenbank zu aktualisieren, führe aus:")
        print("  py update_from_osm.py --live")
        print()

    return matches, no_match, skipped

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Aktualisiere Schleusen-Positionen von OSM')
    parser.add_argument('--live', action='store_true', help='Live-Update (ohne ist Dry-Run)')

    args = parser.parse_args()

    update_locks(dry_run=not args.live)
