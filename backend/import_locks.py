#!/usr/bin/env python3
"""
Import locks data from JSON file into locks database
"""

import json
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent / "app"))

import locks_storage

def import_locks_from_json(json_file: str):
    """Import locks from JSON file"""

    print(f"📊 Reading locks data from {json_file}...")

    with open(json_file, 'r', encoding='utf-8') as f:
        locks_data = json.load(f)

    print(f"   Found {len(locks_data)} locks to import")

    imported = 0
    skipped = 0
    errors = 0

    for lock_data in locks_data:
        try:
            lock_name = lock_data.get('name', 'Unknown')

            # Check if lock already exists (by name and waterway)
            existing_locks = locks_storage.load_locks()
            if any(l['name'] == lock_name and l['waterway'] == lock_data.get('waterway')
                   for l in existing_locks):
                print(f"   ⏭️  Skipping {lock_name} (already exists)")
                skipped += 1
                continue

            # Add lock
            lock_id = locks_storage.add_lock(lock_data)
            print(f"   ✅ Imported {lock_name} (ID: {lock_id})")
            imported += 1

        except Exception as e:
            print(f"   ❌ Error importing {lock_data.get('name', 'Unknown')}: {e}")
            errors += 1

    print(f"\n📊 Import Summary:")
    print(f"   ✅ Imported: {imported}")
    print(f"   ⏭️  Skipped:  {skipped}")
    print(f"   ❌ Errors:   {errors}")
    print(f"   📦 Total:    {len(locks_data)}")

    # Show database stats
    all_locks = locks_storage.load_locks()
    print(f"\n📈 Database now contains {len(all_locks)} locks")

    # Group by waterway
    waterways = {}
    for lock in all_locks:
        waterway = lock.get('waterway', 'Unknown')
        waterways[waterway] = waterways.get(waterway, 0) + 1

    print(f"\n🗺️  Locks per waterway:")
    for waterway, count in sorted(waterways.items()):
        print(f"   {waterway}: {count}")

if __name__ == "__main__":
    import_file = Path(__file__).parent / "data" / "locks_import.json"

    if not import_file.exists():
        print(f"❌ Import file not found: {import_file}")
        sys.exit(1)

    import_locks_from_json(str(import_file))
    print("\n✅ Import complete!")
