#!/usr/bin/env python3
"""
Analyze the OSM locks data and generate comprehensive statistics
"""

import json
from pathlib import Path
from collections import Counter, defaultdict

def analyze_locks(json_file):
    """Analyze locks data from JSON file"""

    with open(json_file, 'r', encoding='utf-8') as f:
        locks = json.load(f)

    print(f"=" * 70)
    print(f"LOCK DATA ANALYSIS")
    print(f"=" * 70)
    print(f"\nTotal locks found: {len(locks)}")

    # Analyze names
    named_locks = [lock for lock in locks if lock.get('name') and not lock['name'].startswith('Lock ')]
    print(f"Locks with proper names: {len(named_locks)} ({len(named_locks)/len(locks)*100:.1f}%)")

    # Analyze waterway associations
    # Check different tag fields for waterway names
    waterway_names = defaultdict(int)
    for lock in locks:
        tags = lock.get('tags', {})

        # Try different ways waterways might be tagged
        waterway = None
        if 'name' in tags and ('kanal' in tags['name'].lower() or 'canal' in tags['name'].lower()):
            waterway = tags['name']
        elif 'canal' in tags:
            waterway = tags['canal']
        elif 'waterway:name' in tags:
            waterway = tags['waterway:name']

        if waterway:
            waterway_names[waterway] += 1

    # Look for nearby waterway features by checking ref tags
    ref_counter = Counter()
    canal_counter = Counter()
    for lock in locks:
        tags = lock.get('tags', {})
        if 'ref' in tags:
            ref_counter[tags['ref']] += 1
        if 'canal' in tags:
            canal_counter[tags['canal']] += 1

    print(f"\n{'-' * 70}")
    print(f"WATERWAY DISTRIBUTION (from refs):")
    print(f"{'-' * 70}")
    if ref_counter:
        for ref, count in ref_counter.most_common(20):
            print(f"  {ref}: {count} locks")
    else:
        print("  No ref tags found in the data")

    # Data quality analysis
    print(f"\n{'-' * 70}")
    print(f"DATA QUALITY METRICS:")
    print(f"{'-' * 70}")

    # Check various attributes
    with_name = sum(1 for lock in locks if lock.get('name') and not lock['name'].startswith('Lock '))
    with_phone = sum(1 for lock in locks if 'phone' in lock)
    with_website = sum(1 for lock in locks if 'website' in lock)
    with_max_length = sum(1 for lock in locks if 'max_length' in lock)
    with_max_width = sum(1 for lock in locks if 'max_width' in lock)
    with_max_height = sum(1 for lock in locks if 'max_height' in lock)

    # Check for tags that might have useful info
    seamark_type = sum(1 for lock in locks if 'seamark:type' in lock.get('tags', {}))
    seamark_name = sum(1 for lock in locks if 'seamark:name' in lock.get('tags', {}))
    lock_ref = sum(1 for lock in locks if 'lock:ref' in lock.get('tags', {}))
    lock_name = sum(1 for lock in locks if 'lock:name' in lock.get('tags', {}))

    print(f"  Proper names:        {with_name:4d} ({with_name/len(locks)*100:5.1f}%)")
    print(f"  Phone numbers:       {with_phone:4d} ({with_phone/len(locks)*100:5.1f}%)")
    print(f"  Website:             {with_website:4d} ({with_website/len(locks)*100:5.1f}%)")
    print(f"  Max length:          {with_max_length:4d} ({with_max_length/len(locks)*100:5.1f}%)")
    print(f"  Max width:           {with_max_width:4d} ({with_max_width/len(locks)*100:5.1f}%)")
    print(f"  Max height:          {with_max_height:4d} ({with_max_height/len(locks)*100:5.1f}%)")
    print(f"  Seamark type tag:    {seamark_type:4d} ({seamark_type/len(locks)*100:5.1f}%)")
    print(f"  Seamark name tag:    {seamark_name:4d} ({seamark_name/len(locks)*100:5.1f}%)")
    print(f"  Lock ref tag:        {lock_ref:4d} ({lock_ref/len(locks)*100:5.1f}%)")
    print(f"  Lock name tag:       {lock_name:4d} ({lock_name/len(locks)*100:5.1f}%)")

    # Geographic distribution
    print(f"\n{'-' * 70}")
    print(f"GEOGRAPHIC DISTRIBUTION:")
    print(f"{'-' * 70}")

    lat_bins = defaultdict(int)
    lon_bins = defaultdict(int)

    for lock in locks:
        lat = lock.get('lat', 0)
        lon = lock.get('lon', 0)
        lat_bin = int(lat)
        lon_bin = int(lon)
        lat_bins[lat_bin] += 1
        lon_bins[lon_bin] += 1

    print(f"  Latitude distribution (by degree):")
    for lat in sorted(lat_bins.keys()):
        print(f"    {lat}° N: {lat_bins[lat]} locks")

    # Sample of well-documented locks
    print(f"\n{'-' * 70}")
    print(f"SAMPLE OF WELL-DOCUMENTED LOCKS (first 10):")
    print(f"{'-' * 70}")

    well_documented = [lock for lock in locks if lock.get('name') and not lock['name'].startswith('Lock ')]
    for lock in well_documented[:10]:
        print(f"  - {lock['name']}")
        print(f"    Location: {lock['lat']:.4f}, {lock['lon']:.4f}")
        if 'phone' in lock:
            print(f"    Phone: {lock['phone']}")
        if 'website' in lock:
            print(f"    Website: {lock['website']}")
        print()

    # All available tag keys
    all_tags = set()
    for lock in locks:
        all_tags.update(lock.get('tags', {}).keys())

    print(f"\n{'-' * 70}")
    print(f"ALL AVAILABLE TAG KEYS IN DATA:")
    print(f"{'-' * 70}")
    for tag in sorted(all_tags):
        count = sum(1 for lock in locks if tag in lock.get('tags', {}))
        print(f"  {tag}: {count} occurrences")

    print(f"\n{'-' * 70}")
    print(f"DATA FILE: {json_file}")
    print(f"=" * 70)

if __name__ == "__main__":
    json_file = Path(__file__).parent / "data" / "locks_osm_raw.json"
    analyze_locks(json_file)
