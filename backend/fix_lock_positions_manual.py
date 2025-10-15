#!/usr/bin/env python3
"""
Manual position corrections for locks with known incorrect positions
Based on OpenStreetMap verification
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

# Known position corrections from OpenStreetMap verification
POSITION_CORRECTIONS = {
    "Schleuse Hohenwarthe": {
        "lat": 52.2417265,
        "lon": 11.7395273,
        "source": "OSM way/1343045114",
        "old_lat": 52.2297,
        "old_lon": 11.7153
    },
    # Add more corrections as needed
}

def fix_positions():
    """Apply manual position corrections"""
    print("=" * 70)
    print("MANUAL LOCK POSITION CORRECTIONS")
    print("=" * 70)
    print()

    locks = locks_storage.load_locks()
    corrections_applied = 0

    for lock in locks:
        if lock['name'] in POSITION_CORRECTIONS:
            correction = POSITION_CORRECTIONS[lock['name']]

            print(f"🔧 Fixing: {lock['name']}")
            print(f"   Old position: {lock['lat']:.6f}, {lock['lon']:.6f}")
            print(f"   New position: {correction['lat']:.6f}, {correction['lon']:.6f}")
            print(f"   Source: {correction['source']}")

            # Calculate distance of correction
            import math
            R = 6371000
            phi1 = math.radians(lock['lat'])
            phi2 = math.radians(correction['lat'])
            delta_phi = math.radians(correction['lat'] - lock['lat'])
            delta_lambda = math.radians(correction['lon'] - lock['lon'])
            a = (math.sin(delta_phi / 2) ** 2 +
                 math.cos(phi1) * math.cos(phi2) *
                 math.sin(delta_lambda / 2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            distance = R * c

            print(f"   Distance corrected: {distance:.0f}m")

            # Apply correction
            locks_storage.update_lock(lock['id'], {
                'lat': correction['lat'],
                'lon': correction['lon']
            })

            print(f"   ✅ Position updated!\n")
            corrections_applied += 1

    print("=" * 70)
    print(f"✅ Applied {corrections_applied} position corrections")
    print("=" * 70)

if __name__ == "__main__":
    fix_positions()
