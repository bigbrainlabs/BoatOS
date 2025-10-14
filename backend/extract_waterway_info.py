#!/usr/bin/env python3
"""
Extract detailed waterway information from OSM locks data
This will help us understand which waterways these locks belong to
"""

import json
from pathlib import Path
from collections import Counter

def extract_waterway_info(json_file):
    """Extract waterway associations from locks"""

    with open(json_file, 'r', encoding='utf-8') as f:
        locks = json.load(f)

    print(f"=" * 70)
    print(f"WATERWAY INFORMATION EXTRACTION")
    print(f"=" * 70)
    print(f"\nTotal locks: {len(locks)}")

    # Strategy: We need to look at the actual ways/canals these locks are part of
    # Since lock_gates are typically nodes on waterways, we'd need to query OSM
    # for the parent way. For now, let's analyze what we have:

    # Look for any location/region information
    locations = Counter()
    descriptions = []

    for lock in locks:
        tags = lock.get('tags', {})

        # Check description field
        if 'description' in tags:
            desc = tags['description']
            descriptions.append(desc)

        # Check for location info
        if 'is_in' in tags:
            locations[tags['is_in']] += 1

        # Check operator (might indicate waterway system)
        if 'operator' in tags:
            locations[tags['operator']] += 1

    print(f"\n{'-' * 70}")
    print(f"LOCATION/OPERATOR INFORMATION:")
    print(f"{'-' * 70}")
    if locations:
        for location, count in locations.most_common(20):
            print(f"  {location}: {count} locks")
    else:
        print("  No location information found in tags")

    # Look at geographic clusters to identify waterways
    print(f"\n{'-' * 70}")
    print(f"GEOGRAPHIC CLUSTERS (might indicate major waterways):")
    print(f"{'-' * 70}")

    # Group by rough location (0.1 degree grid)
    grid_clusters = Counter()
    for lock in locks:
        lat = round(lock['lat'], 1)
        lon = round(lock['lon'], 1)
        grid_clusters[(lat, lon)] += 1

    # Show clusters with multiple locks (likely major waterways)
    print(f"\nClusters with 10+ locks (likely major waterways):")
    for (lat, lon), count in sorted(grid_clusters.items(), key=lambda x: x[1], reverse=True)[:30]:
        if count >= 10:
            print(f"  Area around {lat:.1f}N, {lon:.1f}E: {count} locks")

    # Sample descriptions
    print(f"\n{'-' * 70}")
    print(f"SAMPLE DESCRIPTIONS (first 20 non-empty):")
    print(f"{'-' * 70}")
    non_empty_desc = [d for d in descriptions if d]
    for desc in non_empty_desc[:20]:
        print(f"  - {desc}")

    # Locks with names (might give us waterway context)
    print(f"\n{'-' * 70}")
    print(f"NAMED LOCKS (showing all with proper names):")
    print(f"{'-' * 70}")

    named_locks = []
    for lock in locks:
        if lock.get('name') and not lock['name'].startswith('Lock '):
            named_locks.append({
                'name': lock['name'],
                'lat': lock['lat'],
                'lon': lock['lon']
            })

    # Sort by name
    for nl in sorted(named_locks, key=lambda x: x['name'])[:50]:
        print(f"  {nl['name']} ({nl['lat']:.4f}, {nl['lon']:.4f})")

    if len(named_locks) > 50:
        print(f"  ... and {len(named_locks) - 50} more")

    # Look for patterns in seamark names
    seamark_names = []
    for lock in locks:
        tags = lock.get('tags', {})
        if 'seamark:name' in tags:
            seamark_names.append(tags['seamark:name'])

    if seamark_names:
        print(f"\n{'-' * 70}")
        print(f"SEAMARK NAMES:")
        print(f"{'-' * 70}")
        for name in seamark_names:
            print(f"  - {name}")

    print(f"\n{'-' * 70}")
    print(f"RECOMMENDATION:")
    print(f"{'-' * 70}")
    print(f"To get waterway names, we need to:")
    print(f"1. Query OSM for the 'way' elements that these lock_gate nodes belong to")
    print(f"2. Those ways will have the actual waterway/canal names")
    print(f"3. Alternatively, use the geographic clusters above to manually match")
    print(f"   with known German waterways (Rhine, Elbe, etc.)")
    print(f"\n")

if __name__ == "__main__":
    json_file = Path(__file__).parent / "data" / "locks_osm_raw.json"
    extract_waterway_info(json_file)
