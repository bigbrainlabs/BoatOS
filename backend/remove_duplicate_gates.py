#!/usr/bin/env python3
"""
Entfernt einzelne Schleusentore, wenn es in der Nähe eine vollständige Schleuse gibt.

Logik:
- Wenn innerhalb von 200m mehrere Schleusen-Einträge sind
- Und einer davon ist nur ein "Tor" (enthält Tor/Gate/Stem/Binnen/Außen etc.)
- Und ein anderer ist eine richtige "Schleuse" (enthält "Schleuse")
- Dann lösche das Tor und behalte die Schleuse
"""

import sys
import math
from pathlib import Path
from datetime import datetime
import shutil

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

def calculate_distance(lat1, lon1, lat2, lon2):
    """Berechne Distanz in Metern"""
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c

def is_gate_name(name):
    """Prüfe ob der Name nur ein Tor ist, keine Schleuse"""
    name_lower = name.lower()

    # Wenn es "schleuse" enthält, ist es wahrscheinlich eine richtige Schleuse
    if 'schleuse' in name_lower or 'lock' in name_lower:
        return False

    # Gate-Schlüsselwörter
    gate_keywords = [
        'tor', 'gate', 'stemm', 'binnen', 'außen', 'aussen',
        'hubschwenk', 'koppel', 'siel'
    ]

    for keyword in gate_keywords:
        if keyword in name_lower:
            return True

    return False

def is_real_lock(name):
    """Prüfe ob es eine richtige Schleuse ist"""
    name_lower = name.lower()
    return 'schleuse' in name_lower or 'lock' in name_lower

def has_significant_details(lock):
    """Prüfe ob die Schleuse wichtige Details hat (nicht nur river_km)"""
    # Wichtige Felder
    important_fields = [
        'phone', 'vhf_channel', 'email', 'website',
        'opening_hours', 'break_times',
        'max_length', 'max_width', 'max_draft', 'max_height',
        'avg_duration', 'notes', 'facilities'
    ]

    for field in important_fields:
        value = lock.get(field)
        if value:
            if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip()):
                return True
            elif isinstance(value, (list, dict)) and value:
                return True

    return False

def remove_duplicate_gates(dry_run=True):
    """Entferne Tor-Duplikate in der Nähe von richtigen Schleusen"""

    print("=" * 80)
    print("ENTFERNE TOR-DUPLIKATE")
    print("=" * 80)
    if dry_run:
        print("MODUS: DRY RUN (keine Änderungen)")
    else:
        print("MODUS: LIVE UPDATE (Datenbank wird geändert!)")
    print()

    # Lade alle Schleusen
    all_locks = locks_storage.load_locks()
    print(f"Aktuelle Schleusen: {len(all_locks)}")
    print()

    # Finde Tor-Duplikate
    gates_to_remove = []
    locks_to_keep = []

    for lock in all_locks:
        # Ist das ein einzelnes Tor?
        if is_gate_name(lock['name']):
            # Suche nach richtiger Schleuse in der Nähe (<200m)
            found_real_lock = False

            for other_lock in all_locks:
                if other_lock['id'] == lock['id']:
                    continue

                # Ist die andere eine richtige Schleuse?
                if is_real_lock(other_lock['name']):
                    distance = calculate_distance(
                        lock['lat'], lock['lon'],
                        other_lock['lat'], other_lock['lon']
                    )

                    if distance < 200:  # 200m Radius
                        gates_to_remove.append({
                            'gate': lock,
                            'lock': other_lock,
                            'distance': distance
                        })
                        found_real_lock = True
                        break

            if not found_real_lock:
                # Behalte Tore, die keine Schleuse in der Nähe haben
                locks_to_keep.append(lock)
        else:
            # Behalte alle normalen Schleusen
            locks_to_keep.append(lock)

    print(f"Gefundene Tor-Duplikate: {len(gates_to_remove)}")
    print(f"Schleusen zu behalten: {len(locks_to_keep)}")
    print()

    # Zeige Details der zu entfernenden Tore
    if gates_to_remove:
        print("=" * 80)
        print("ZU ENTFERNENDE TORE (nahe bei Schleusen):")
        print("=" * 80)

        for item in gates_to_remove:
            gate = item['gate']
            lock = item['lock']
            distance = item['distance']

            print(f"\n❌ {gate['name']}")
            print(f"   Position: {gate['lat']:.4f}, {gate['lon']:.4f}")
            print(f"   ➜ {int(distance)}m von: {lock['name']}")

        print()

    # Zeige Statistik
    print("=" * 80)
    print("ZUSAMMENFASSUNG")
    print("=" * 80)
    print(f"Vorher:  {len(all_locks)} Schleusen")
    print(f"Entfernt: {len(gates_to_remove)} Tor-Duplikate")
    print(f"Nachher: {len(locks_to_keep)} Schleusen")
    print()

    # Update ausführen
    if not dry_run:
        print("=" * 80)
        print("AKTUALISIERE DATENBANK...")
        print("=" * 80)

        # Backup
        db_file = Path(__file__).parent / "data" / "locks.db"
        backup_file = db_file.parent / f"locks.db.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        shutil.copy(db_file, backup_file)
        print(f"Backup erstellt: {backup_file.name}")
        print()

        # Lösche alte Datenbank
        db_file.unlink()
        print("Alte Datenbank gelöscht")

        # Initialisiere neue Datenbank
        locks_storage.init_locks_db()
        print("Neue Datenbank initialisiert")

        # Importiere bereinigte Liste
        for lock in locks_to_keep:
            locks_storage.add_lock(lock)

        print(f"{len(locks_to_keep)} Schleusen importiert")
        print()
        print("FERTIG!")
    else:
        print("=" * 80)
        print("DRY RUN - Keine Änderungen vorgenommen")
        print("=" * 80)
        print("Um die Datenbank zu bereinigen, führe aus:")
        print("  python3 remove_duplicate_gates.py --live")
        print()

    return locks_to_keep, gates_to_remove

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Entferne Tor-Duplikate')
    parser.add_argument('--live', action='store_true', help='Live-Update (ohne ist Dry-Run)')

    args = parser.parse_args()

    remove_duplicate_gates(dry_run=not args.live)
