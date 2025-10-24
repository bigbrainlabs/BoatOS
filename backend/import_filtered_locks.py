#!/usr/bin/env python3
"""
Import gefilterte OSM-Schleusen in die Datenbank
Nutzt locks_osm_filtered.json (bereits gefiltert und gruppiert)
"""

import json
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

def import_filtered_locks(json_file):
    """
    Importiere gefilterte Schleusen-Daten
    """

    print("=" * 80)
    print("IMPORT GEFILTERTE OSM-SCHLEUSEN")
    print("=" * 80)
    print()

    # Lade gefilterte Daten
    print(f"Lese gefilterte Schleusen von {json_file}...")
    with open(json_file, 'r', encoding='utf-8') as f:
        filtered_locks = json.load(f)

    print(f"   {len(filtered_locks)} gefilterte Schleusen gefunden")
    print()

    # Hole existierende Schleusen
    existing_locks = locks_storage.load_locks()
    existing_names = {lock['name'].lower(): lock for lock in existing_locks}

    print(f"Existierende Schleusen in DB: {len(existing_locks)}")
    print()

    # Import
    imported = 0
    skipped = 0
    errors = 0

    for osm_lock in filtered_locks:
        try:
            name = osm_lock['name']
            name_lower = name.lower()

            # Prüfe ob bereits vorhanden
            if name_lower in existing_names:
                skipped += 1
                continue

            # Erstelle Lock-Entry
            lock_data = {
                'name': name,
                'lat': osm_lock['lat'],
                'lon': osm_lock['lon']
            }

            # Optionale Felder
            if 'max_length' in osm_lock:
                lock_data['max_length'] = osm_lock['max_length']
            if 'max_width' in osm_lock:
                lock_data['max_width'] = osm_lock['max_width']
            if 'max_height' in osm_lock:
                lock_data['max_height'] = osm_lock['max_height']
            if 'phone' in osm_lock:
                lock_data['phone'] = osm_lock['phone']
            if 'waterway' in osm_lock:
                lock_data['waterway'] = osm_lock['waterway']

            # Öffnungszeiten
            if 'tags' in osm_lock and 'opening_hours' in osm_lock['tags']:
                lock_data['opening_hours'] = osm_lock['tags']['opening_hours']

            # Speichere in DB
            locks_storage.add_lock(lock_data)
            imported += 1

        except Exception as e:
            print(f"   FEHLER bei {osm_lock.get('name', 'unknown')}: {e}")
            errors += 1

    print()
    print("=" * 80)
    print("IMPORT SUMMARY")
    print("=" * 80)
    print(f"   Importiert: {imported}")
    print(f"   Uebersprungen: {skipped} (bereits vorhanden)")
    print(f"   Fehler:   {errors}")
    print()

    # Zeige finale Statistik
    all_locks = locks_storage.load_locks()
    print(f"Datenbank enthaelt jetzt {len(all_locks)} Schleusen")
    print()

    return imported, skipped, errors

if __name__ == "__main__":
    filtered_file = Path(__file__).parent / "data" / "locks_osm_filtered.json"

    if not filtered_file.exists():
        print(f"FEHLER: {filtered_file} nicht gefunden!")
        print("   Bitte erst 'python3 filter_and_group_locks.py' ausfuehren.")
        exit(1)

    import_filtered_locks(filtered_file)
    print("FERTIG!")
