#!/usr/bin/env python3
"""
Bereinigt die Schleusen-Datenbank:
- Entfernt alle Schleusen OHNE Details
- Behält nur Schleusen mit mindestens 1 Detail-Feld
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage
from datetime import datetime
import shutil

def has_any_detail(lock):
    """Prüfe ob die Schleuse mindestens 1 Detail hat"""
    detail_fields = [
        'phone', 'vhf_channel', 'email', 'website',
        'opening_hours', 'break_times',
        'max_length', 'max_width', 'max_draft', 'max_height',
        'avg_duration', 'notes', 'facilities', 'rating', 'river_km'
    ]

    for field in detail_fields:
        value = lock.get(field)
        if value:
            # Prüfe ob es wirklich ein Wert ist (nicht None, nicht leerer String)
            if isinstance(value, (int, float)) or (isinstance(value, str) and value.strip()):
                return True
            elif isinstance(value, (list, dict)) and value:
                return True

    return False

def cleanup_locks(dry_run=True):
    """Entferne Schleusen ohne Details"""

    print("=" * 80)
    print("SCHLEUSEN-DATENBANK BEREINIGUNG")
    print("=" * 80)
    if dry_run:
        print("MODUS: DRY RUN (keine Änderungen)")
    else:
        print("MODUS: LIVE UPDATE (Datenbank wird geändert!)")
    print()

    # Lade alle Schleusen
    all_locks = locks_storage.load_locks()
    print(f"Aktuelle Schleusen in DB: {len(all_locks)}")
    print()

    # Kategorisiere
    locks_with_details = []
    locks_without_details = []

    for lock in all_locks:
        if has_any_detail(lock):
            locks_with_details.append(lock)
        else:
            locks_without_details.append(lock)

    print(f"Schleusen MIT Details:   {len(locks_with_details)}")
    print(f"Schleusen OHNE Details:  {len(locks_without_details)}")
    print()

    # Zeige Beispiele von gelöschten Schleusen
    if locks_without_details:
        print("=" * 80)
        print("BEISPIELE VON GELÖSCHTEN SCHLEUSEN (Top 20):")
        print("=" * 80)
        for lock in locks_without_details[:20]:
            print(f"  - {lock['name']}")
        if len(locks_without_details) > 20:
            print(f"  ... und {len(locks_without_details) - 20} weitere")
        print()

    # Zeige Statistik der behaltenen Schleusen
    stats = {
        'phone': 0, 'vhf': 0, 'email': 0, 'website': 0,
        'opening_hours': 0, 'dimensions': 0, 'notes': 0
    }

    for lock in locks_with_details:
        if lock.get('phone'): stats['phone'] += 1
        if lock.get('vhf_channel'): stats['vhf'] += 1
        if lock.get('email'): stats['email'] += 1
        if lock.get('website'): stats['website'] += 1
        if lock.get('opening_hours'): stats['opening_hours'] += 1
        if lock.get('max_length') or lock.get('max_width'): stats['dimensions'] += 1
        if lock.get('notes'): stats['notes'] += 1

    print("=" * 80)
    print("DETAILS DER BEHALTENEN SCHLEUSEN:")
    print("=" * 80)
    print(f"  Telefon:        {stats['phone']}")
    print(f"  VHF:            {stats['vhf']}")
    print(f"  Email:          {stats['email']}")
    print(f"  Website:        {stats['website']}")
    print(f"  Öffnungszeiten: {stats['opening_hours']}")
    print(f"  Abmessungen:    {stats['dimensions']}")
    print(f"  Notizen:        {stats['notes']}")
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

        # Importiere nur Schleusen mit Details
        for lock in locks_with_details:
            locks_storage.add_lock(lock)

        print(f"{len(locks_with_details)} Schleusen importiert")
        print()
        print("FERTIG!")
    else:
        print("=" * 80)
        print("DRY RUN - Keine Änderungen vorgenommen")
        print("=" * 80)
        print("Um die Datenbank zu bereinigen, führe aus:")
        print("  python3 cleanup_locks.py --live")
        print()

    return locks_with_details, locks_without_details

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Bereinige Schleusen-Datenbank')
    parser.add_argument('--live', action='store_true', help='Live-Update (ohne ist Dry-Run)')

    args = parser.parse_args()

    cleanup_locks(dry_run=not args.live)
