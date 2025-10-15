#!/usr/bin/env python3
"""
Verify and fix positions for major locks
Uses OSM Nominatim to find the correct positions
"""

import sys
import requests
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

# List of major locks to verify (these are most important for navigation)
MAJOR_LOCKS = [
    "Schleuse Hohenwarthe",
    "Schleuse Rothensee",
    "Schleuse Anderten",
    "Schleuse Uelzen",
    "Schleuse Sülfeld",
    "Schleuse Minden",
    "Schleuse Lauenburg",
    "Schleuse Brunsbüttel",
    "Schleuse Kiel-Holtenau",
    "Schleuse Brandenburg",
    "Schleuse Petershagen",
    "Schleuse Dörpen",
    "Schleuse Oldenburg",
]

def get_osm_position(lock_name):
    """Query OSM Nominatim for correct position"""
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={lock_name}&format=json&limit=1"
        response = requests.get(url, headers={'User-Agent': 'BoatOS/1.0'})

        if response.status_code == 200:
            data = response.json()
            if data:
                return float(data[0]['lat']), float(data[0]['lon']), data[0]['display_name']

        return None, None, None
    except Exception as e:
        print(f"  ⚠️ Error: {e}")
        return None, None, None

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters"""
    import math
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

def verify_and_fix():
    """Verify and fix major lock positions"""
    print("=" * 70)
    print("MAJOR LOCK POSITION VERIFICATION")
    print("=" * 70)
    print()

    locks = locks_storage.load_locks()
    corrections = []

    for lock_name in MAJOR_LOCKS:
        # Find lock in database
        lock = next((l for l in locks if l['name'] == lock_name), None)

        if not lock:
            print(f"⚠️ {lock_name} - NOT IN DATABASE")
            continue

        print(f"🔍 Checking: {lock_name}")
        print(f"   Current: {lock['lat']:.6f}, {lock['lon']:.6f}")

        # Get OSM position
        osm_lat, osm_lon, osm_name = get_osm_position(lock_name)

        if osm_lat and osm_lon:
            distance = calculate_distance(lock['lat'], lock['lon'], osm_lat, osm_lon)

            print(f"   OSM:     {osm_lat:.6f}, {osm_lon:.6f}")
            print(f"   Distance: {distance:.0f}m")

            if distance > 500:
                print(f"   ⚠️ NEEDS CORRECTION")
                corrections.append({
                    'name': lock_name,
                    'lock_id': lock['id'],
                    'old_lat': lock['lat'],
                    'old_lon': lock['lon'],
                    'new_lat': osm_lat,
                    'new_lon': osm_lon,
                    'distance': distance,
                    'osm_name': osm_name
                })
            elif distance > 100:
                print(f"   ℹ️ Minor difference")
            else:
                print(f"   ✅ Position OK")
        else:
            print(f"   ❌ Could not find on OSM")

        print()
        time.sleep(1.1)  # Rate limiting

    # Apply corrections
    if corrections:
        print("=" * 70)
        print(f"APPLYING {len(corrections)} CORRECTIONS")
        print("=" * 70)
        print()

        for corr in corrections:
            print(f"🔧 Fixing: {corr['name']}")
            print(f"   Moving {corr['distance']:.0f}m")
            print(f"   {corr['old_lat']:.6f}, {corr['old_lon']:.6f}")
            print(f"   → {corr['new_lat']:.6f}, {corr['new_lon']:.6f}")

            locks_storage.update_lock(corr['lock_id'], {
                'lat': corr['new_lat'],
                'lon': corr['new_lon']
            })

            print(f"   ✅ Updated!\n")

        print("=" * 70)
        print(f"✅ Applied {len(corrections)} corrections")
        print("=" * 70)
    else:
        print("=" * 70)
        print("✅ All major lock positions verified - no corrections needed!")
        print("=" * 70)

if __name__ == "__main__":
    verify_and_fix()
