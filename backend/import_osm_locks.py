#!/usr/bin/env python3
"""
Import locks from OSM raw data into BoatOS database
Filters and processes OSM data to create usable lock entries
"""

import json
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

def process_osm_locks(osm_file):
    """
    Process OSM lock data and import into database

    Strategy:
    1. Filter locks with names (more likely to be actual navigable locks)
    2. Extract all available metadata
    3. Deduplicate by name and position
    4. Import into database
    """

    print(f"📊 Reading OSM locks from {osm_file}...")
    with open(osm_file, 'r', encoding='utf-8') as f:
        osm_locks = json.load(f)

    print(f"   Found {len(osm_locks)} OSM lock elements")

    # Filter to named locks (more likely to be actual navigable locks)
    named_locks = [l for l in osm_locks if l['tags'].get('name')]
    print(f"   {len(named_locks)} have names")

    # Process and deduplicate
    processed_locks = {}

    for lock in named_locks:
        name = lock['tags'].get('name', f'Lock {lock["osm_id"]}')

        # Create lock entry
        lock_entry = {
            'name': name,
            'lat': lock['lat'],
            'lon': lock['lon'],
            'osm_id': lock['osm_id'],
            'osm_type': lock['osm_type']
        }

        tags = lock['tags']

        # Extract waterway info
        if 'waterway:name' in tags:
            lock_entry['waterway'] = tags['waterway:name']
        elif 'canal' in tags:
            lock_entry['waterway'] = tags['canal']
        elif tags.get('waterway') not in ['lock_gate']:
            lock_entry['waterway'] = tags.get('waterway', '')

        # Extract dimensions
        if 'lock:length' in tags:
            try:
                lock_entry['max_length'] = float(tags['lock:length'].replace('m', '').strip())
            except:
                pass

        if 'lock:width' in tags:
            try:
                lock_entry['max_width'] = float(tags['lock:width'].replace('m', '').strip())
            except:
                pass

        if 'lock:depth' in tags or 'maxdepth' in tags:
            try:
                depth = tags.get('lock:depth') or tags.get('maxdepth')
                lock_entry['max_draft'] = float(depth.replace('m', '').strip())
            except:
                pass

        if 'maxheight' in tags:
            try:
                lock_entry['max_height'] = float(tags['maxheight'].replace('m', '').strip())
            except:
                pass

        # Extract contact info
        if 'phone' in tags:
            lock_entry['phone'] = tags['phone']

        if 'email' in tags:
            lock_entry['email'] = tags['email']

        if 'website' in tags:
            lock_entry['website'] = tags['website']

        if 'contact:phone' in tags:
            lock_entry['phone'] = tags['contact:phone']

        if 'contact:email' in tags:
            lock_entry['email'] = tags['contact:email']

        if 'contact:website' in tags:
            lock_entry['website'] = tags['contact:website']

        # Extract VHF channel
        if 'seamark:radio_station:channel' in tags:
            lock_entry['vhf_channel'] = tags['seamark:radio_station:channel']
        elif 'vhf:channel' in tags:
            lock_entry['vhf_channel'] = tags['vhf:channel']

        # Extract opening hours
        if 'opening_hours' in tags:
            # TODO: Parse opening_hours into our format
            lock_entry['opening_hours_raw'] = tags['opening_hours']

        # Extract operator
        if 'operator' in tags:
            lock_entry['operator'] = tags['operator']

        # Deduplicate by name (keep first occurrence)
        # TODO: Improve deduplication by checking proximity
        key = name.lower()
        if key not in processed_locks:
            processed_locks[key] = lock_entry

    print(f"   {len(processed_locks)} unique named locks after deduplication")

    # Import into database using batch insert for speed
    print(f"\n📥 Importing locks into database (batch mode)...")
    import sqlite3

    conn = sqlite3.connect(locks_storage.DB_PATH)
    cursor = conn.cursor()

    # Get existing lock names for deduplication
    cursor.execute("SELECT name FROM locks")
    existing_names = {row[0] for row in cursor.fetchall()}

    imported = 0
    skipped = 0
    errors = 0
    batch = []

    for lock_entry in processed_locks.values():
        try:
            # Skip if already exists
            if lock_entry['name'] in existing_names:
                skipped += 1
                continue

            # Prepare values for INSERT
            values = (
                lock_entry.get('name'),
                lock_entry.get('waterway', 'Unknown'),
                lock_entry.get('lat'),
                lock_entry.get('lon'),
                lock_entry.get('river_km'),
                lock_entry.get('phone'),
                lock_entry.get('vhf_channel'),
                lock_entry.get('email'),
                lock_entry.get('website'),
                json.dumps(lock_entry.get('opening_hours')) if lock_entry.get('opening_hours') else None,
                json.dumps(lock_entry.get('break_times')) if lock_entry.get('break_times') else None,
                lock_entry.get('max_length'),
                lock_entry.get('max_width'),
                lock_entry.get('max_draft'),
                lock_entry.get('max_height'),
                lock_entry.get('avg_duration', 15),  # Default 15 minutes
                lock_entry.get('requires_booking', 0),
                lock_entry.get('supports_sms', 0),
                lock_entry.get('api_endpoint'),
                lock_entry.get('notes'),
                json.dumps(lock_entry.get('facilities')) if lock_entry.get('facilities') else None
            )

            batch.append(values)
            imported += 1

            # Commit in batches of 100
            if len(batch) >= 100:
                cursor.executemany("""
                    INSERT INTO locks (
                        name, waterway, lat, lon, river_km,
                        phone, vhf_channel, email, website,
                        opening_hours, break_times,
                        max_length, max_width, max_draft, max_height,
                        avg_duration, requires_booking, supports_sms, api_endpoint,
                        notes, facilities
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, batch)
                conn.commit()
                print(f"   Imported {imported} locks...")
                batch = []

        except Exception as e:
            print(f"   ⚠️ Error importing {lock_entry.get('name', 'unknown')}: {e}")
            errors += 1

    # Import remaining batch
    if batch:
        cursor.executemany("""
            INSERT INTO locks (
                name, waterway, lat, lon, river_km,
                phone, vhf_channel, email, website,
                opening_hours, break_times,
                max_length, max_width, max_draft, max_height,
                avg_duration, requires_booking, supports_sms, api_endpoint,
                notes, facilities
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, batch)
        conn.commit()

    conn.close()

    print(f"\n📊 Import Summary:")
    print(f"   ✅ Imported: {imported}")
    print(f"   ⏭️  Skipped:  {skipped} (already exist)")
    print(f"   ❌ Errors:   {errors}")

    # Show final stats
    all_locks = locks_storage.load_locks()
    print(f"\n📈 Database now contains {len(all_locks)} locks")

    # Show waterway distribution
    waterways = {}
    for lock in all_locks:
        ww = lock.get('waterway', 'Unknown')
        waterways[ww] = waterways.get(ww, 0) + 1

    print(f"\n🗺️  Top 20 waterways:")
    for ww, count in sorted(waterways.items(), key=lambda x: x[1], reverse=True)[:20]:
        if ww:
            print(f"   {ww}: {count}")

    print(f"\n✅ Import complete!")

if __name__ == "__main__":
    osm_file = Path(__file__).parent / "data" / "locks_osm_raw.json"

    if not osm_file.exists():
        print(f"❌ OSM data file not found: {osm_file}")
        print(f"   Run fetch_locks_osm.py first to collect data")
        sys.exit(1)

    print("✅ Using existing locks database\n")

    # Process and import
    process_osm_locks(osm_file)
