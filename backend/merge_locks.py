#!/usr/bin/env python3
"""
Intelligentes Merge von bestehenden Schleusen-Daten mit OSM-Daten:
- Behält alle manuell eingegebenen Details
- Entfernt Duplikate
- Fügt neue OSM-Schleusen hinzu
- Aktualisiert Positionen falls nötig
"""

import json
import math
import sys
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

def has_manual_details(lock):
    """Prüfe ob die Schleuse manuell eingegebene Details hat"""
    detail_fields = [
        'phone', 'vhf_channel', 'email', 'website', 'registration_method',
        'opening_hours', 'break_times', 'max_length', 'max_width',
        'max_draft', 'max_height', 'avg_duration', 'notes', 'facilities',
        'rating', 'river_km'
    ]

    for field in detail_fields:
        if lock.get(field):
            return True

    return False

def merge_locks(dry_run=True):
    """Merge bestehende und OSM-Schleusen"""

    print("=" * 80)
    print("INTELLIGENT LOCK MERGE")
    print("=" * 80)
    if dry_run:
        print("MODUS: DRY RUN (keine Änderungen)")
    else:
        print("MODUS: LIVE UPDATE (Datenbank wird geändert!)")
    print()

    # Lade bestehende Datenbank
    existing_locks = locks_storage.load_locks()
    print(f"Bestehende Schleusen in DB: {len(existing_locks)}")

    # Zähle wie viele Details haben
    with_details = sum(1 for lock in existing_locks if has_manual_details(lock))
    print(f"  Davon mit manuellen Details: {with_details}")
    print()

    # Lade gefilterte OSM-Daten
    osm_file = Path(__file__).parent / "data" / "locks_osm_filtered.json"

    if not osm_file.exists():
        print(f"FEHLER: {osm_file} nicht gefunden!")
        print("   Bitte erst 'py filter_and_group_locks.py' ausführen.")
        return

    with open(osm_file, 'r', encoding='utf-8') as f:
        osm_locks = json.load(f)
    print(f"OSM-Schleusen verfügbar: {len(osm_locks)}")
    print()

    # Merge-Logik
    print("=" * 80)
    print("MERGE-PROZESS")
    print("=" * 80)
    print()

    kept_with_details = []
    updated_positions = []
    removed_duplicates = []
    added_new = []

    # Track welche OSM-Schleusen bereits verwendet wurden
    used_osm_indices = set()

    # Phase 1: Behalte alle Schleusen mit manuellen Details
    print("Phase 1: Behalte Schleusen mit manuellen Details...")
    for db_lock in existing_locks:
        if has_manual_details(db_lock):
            # Prüfe ob wir eine bessere Position in OSM haben
            best_match = None
            best_score = 0.0
            best_distance = float('inf')
            best_idx = None

            for idx, osm_lock in enumerate(osm_locks):
                if idx in used_osm_indices:
                    continue

                is_match, score = fuzzy_match_name(db_lock['name'], osm_lock['name'])

                if is_match:
                    distance = calculate_distance(
                        db_lock['lat'], db_lock['lon'],
                        osm_lock['lat'], osm_lock['lon']
                    )

                    if score > best_score or (score == best_score and distance < best_distance):
                        best_match = osm_lock
                        best_score = score
                        best_distance = distance
                        best_idx = idx

            if best_match and best_idx is not None:
                # Markiere OSM-Schleuse als verwendet
                used_osm_indices.add(best_idx)

                # Wenn Position deutlich abweicht (>100m), aktualisiere sie
                if best_distance > 100:
                    old_pos = (db_lock['lat'], db_lock['lon'])
                    db_lock['lat'] = best_match['lat']
                    db_lock['lon'] = best_match['lon']
                    updated_positions.append({
                        'name': db_lock['name'],
                        'old_pos': old_pos,
                        'new_pos': (best_match['lat'], best_match['lon']),
                        'distance': best_distance
                    })

            kept_with_details.append(db_lock)

    print(f"   Behalten: {len(kept_with_details)} Schleusen mit Details")
    print(f"   Positionen aktualisiert: {len(updated_positions)}")
    print()

    # Phase 2: Füge neue OSM-Schleusen hinzu
    print("Phase 2: Füge neue OSM-Schleusen hinzu...")
    for idx, osm_lock in enumerate(osm_locks):
        if idx in used_osm_indices:
            continue

        # Prüfe ob diese Schleuse ein Duplikat einer existierenden ist
        is_duplicate = False

        for existing_lock in kept_with_details:
            is_match, score = fuzzy_match_name(osm_lock['name'], existing_lock['name'])

            if is_match:
                distance = calculate_distance(
                    osm_lock['lat'], osm_lock['lon'],
                    existing_lock['lat'], existing_lock['lon']
                )

                # Wenn Name matched und Position nahe ist (<500m), ist es ein Duplikat
                if distance < 500:
                    is_duplicate = True
                    removed_duplicates.append({
                        'osm_name': osm_lock['name'],
                        'existing_name': existing_lock['name'],
                        'distance': distance,
                        'score': score
                    })
                    break

        if not is_duplicate:
            # Erstelle neuen Lock-Entry
            new_lock = {
                'name': osm_lock['name'],
                'lat': osm_lock['lat'],
                'lon': osm_lock['lon'],
                'waterway': osm_lock.get('waterway', ''),
                'phone': osm_lock.get('phone'),
            }

            # Optionale Felder
            if 'max_length' in osm_lock:
                new_lock['max_length'] = osm_lock['max_length']
            if 'max_width' in osm_lock:
                new_lock['max_width'] = osm_lock['max_width']
            if 'max_height' in osm_lock:
                new_lock['max_height'] = osm_lock['max_height']

            # Öffnungszeiten
            if 'tags' in osm_lock and 'opening_hours' in osm_lock['tags']:
                new_lock['opening_hours'] = osm_lock['tags']['opening_hours']

            added_new.append(new_lock)

    print(f"   Neue hinzugefügt: {len(added_new)}")
    print(f"   Duplikate entfernt: {len(removed_duplicates)}")
    print()

    # Erstelle finale Liste
    final_locks = kept_with_details + added_new

    # Statistik
    print("=" * 80)
    print("MERGE-ZUSAMMENFASSUNG")
    print("=" * 80)
    print(f"Vorher:")
    print(f"  Datenbank:           {len(existing_locks)} Schleusen")
    print(f"  OSM (gefiltert):     {len(osm_locks)} Schleusen")
    print()
    print(f"Nachher:")
    print(f"  Behalten (Details):  {len(kept_with_details)}")
    print(f"  Neu hinzugefügt:     {len(added_new)}")
    print(f"  Duplikate entfernt:  {len(removed_duplicates)}")
    print(f"  Positionen update:   {len(updated_positions)}")
    print()
    print(f"FINALE ANZAHL:         {len(final_locks)} Schleusen")
    print()

    # Zeige Details
    if updated_positions:
        print("=" * 80)
        print(f"AKTUALISIERTE POSITIONEN (Top 10):")
        print("=" * 80)
        print(f"{'Name':40} {'Abweichung':>15}")
        print("-" * 80)
        for update in sorted(updated_positions, key=lambda x: x['distance'], reverse=True)[:10]:
            print(f"{update['name'][:39]:40} {int(update['distance']):>14}m")
        print()

    if added_new:
        print("=" * 80)
        print(f"NEUE SCHLEUSEN (Top 20):")
        print("=" * 80)
        for lock in added_new[:20]:
            print(f"  + {lock['name']}")
        if len(added_new) > 20:
            print(f"  ... und {len(added_new) - 20} weitere")
        print()

    # Update ausführen
    if not dry_run:
        print("=" * 80)
        print("AKTUALISIERE DATENBANK...")
        print("=" * 80)

        # Backup
        import shutil
        from datetime import datetime

        db_file = Path(__file__).parent / "data" / "locks.db"
        backup_file = db_file.parent / f"locks.db.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy(db_file, backup_file)
        print(f"Backup erstellt: {backup_file.name}")
        print()

        # Lösche alte Datenbank
        db_file.unlink()
        print("Alte Datenbank gelöscht")

        # Initialisiere neue Datenbank (erstellt Tabelle)
        locks_storage.init_locks_db()
        print("Neue Datenbank initialisiert")

        # Importiere finale Liste
        for lock in final_locks:
            locks_storage.add_lock(lock)

        print(f"{len(final_locks)} Schleusen importiert")
        print()
        print("FERTIG!")
    else:
        print("=" * 80)
        print("DRY RUN - Keine Änderungen vorgenommen")
        print("=" * 80)
        print("Um die Datenbank zu aktualisieren, führe aus:")
        print("  py merge_locks.py --live")
        print()

    return final_locks, kept_with_details, added_new, removed_duplicates

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Merge Schleusen-Daten intelligent')
    parser.add_argument('--live', action='store_true', help='Live-Update (ohne ist Dry-Run)')

    args = parser.parse_args()

    merge_locks(dry_run=not args.live)
