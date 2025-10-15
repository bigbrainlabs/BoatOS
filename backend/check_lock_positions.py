#!/usr/bin/env python3
"""
Check and fix lock positions by comparing with OpenStreetMap data
"""

import sys
import sqlite3
import requests
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

def get_osm_position(lock_name, waterway=None):
    """Query OpenStreetMap for the correct position of a lock"""
    # Build search query
    query = lock_name

    # Add waterway context if available
    if waterway:
        query += f" {waterway}"

    query += " Germany"

    try:
        url = f"https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=1"
        response = requests.get(url, headers={'User-Agent': 'BoatOS/1.0'})

        if response.status_code == 200:
            data = response.json()
            if data:
                return float(data[0]['lat']), float(data[0]['lon']), data[0]['display_name']

        return None, None, None
    except Exception as e:
        print(f"  ⚠️ Error querying OSM: {e}")
        return None, None, None

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance in meters between two coordinates using Haversine"""
    import math

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

def check_lock_positions(auto_fix=False, distance_threshold=500, silent=False):
    """
    Check all lock positions against OSM data

    Args:
        auto_fix: If True, automatically update positions with large discrepancies
        distance_threshold: Threshold in meters for flagging positions (default: 500m)
        silent: If True, suppress print output (for API usage)

    Returns:
        dict with keys: checked, fixed, avg_distance_fixed, issues
    """
    if not silent:
        print("=" * 80)
        print("LOCK POSITION VERIFICATION")
        print("=" * 80)
        print(f"Distance threshold: {distance_threshold}m")
        print(f"Auto-fix mode: {'ENABLED' if auto_fix else 'DISABLED'}")
        print()

    locks = locks_storage.load_locks()
    if not silent:
        print(f"📊 Checking {len(locks)} locks...\n")

    issues_found = []
    checked_count = 0

    for lock in locks:
        if not silent:
            print(f"🔍 Checking: {lock['name']}...")

        # Query OSM for correct position
        osm_lat, osm_lon, osm_name = get_osm_position(lock['name'], lock.get('waterway'))

        if osm_lat and osm_lon:
            # Calculate distance
            distance = calculate_distance(lock['lat'], lock['lon'], osm_lat, osm_lon)

            if distance > distance_threshold:
                if not silent:
                    print(f"  ⚠️ LARGE DISCREPANCY: {distance:.0f}m")
                    print(f"     Database: {lock['lat']:.6f}, {lock['lon']:.6f}")
                    print(f"     OSM:      {osm_lat:.6f}, {osm_lon:.6f}")
                    print(f"     OSM Name: {osm_name}")

                issues_found.append({
                    'lock': lock,
                    'distance': distance,
                    'osm_lat': osm_lat,
                    'osm_lon': osm_lon,
                    'osm_name': osm_name
                })

                if auto_fix:
                    # Update position in database
                    locks_storage.update_lock(lock['id'], {
                        'lat': osm_lat,
                        'lon': osm_lon
                    })
                    if not silent:
                        print(f"  ✅ Position updated!")

            elif distance > 50:
                if not silent:
                    print(f"  ℹ️ Minor difference: {distance:.0f}m (within acceptable range)")
            else:
                if not silent:
                    print(f"  ✅ Position accurate ({distance:.0f}m)")
        else:
            if not silent:
                print(f"  ⚠️ Could not find on OSM")

        checked_count += 1

        # Rate limiting
        time.sleep(1.1)  # OSM Nominatim allows max 1 request per second

        if not silent:
            print()

    # Calculate statistics
    fixed_count = len(issues_found) if auto_fix else 0
    avg_distance = sum(issue['distance'] for issue in issues_found) / len(issues_found) if issues_found else 0

    # Summary
    if not silent:
        print("=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(f"✅ Locks checked: {checked_count}")
        print(f"⚠️ Issues found: {len(issues_found)}")

        if issues_found:
            print(f"\n📋 LOCKS WITH POSITION ISSUES (>{distance_threshold}m):")
            issues_found.sort(key=lambda x: x['distance'], reverse=True)

            for issue in issues_found:
                print(f"\n  • {issue['lock']['name']}")
                print(f"    Distance: {issue['distance']:.0f}m")
                print(f"    Current:  {issue['lock']['lat']:.6f}, {issue['lock']['lon']:.6f}")
                print(f"    Correct:  {issue['osm_lat']:.6f}, {issue['osm_lon']:.6f}")
                if auto_fix:
                    print(f"    Status:   ✅ FIXED")
                else:
                    print(f"    Status:   ⚠️ NEEDS FIXING")

        print("\n" + "=" * 80)
        if auto_fix:
            print("✅ Position check and correction complete!")
        else:
            print("💡 Run with auto_fix=True to automatically correct positions")
            print("   Usage: python check_lock_positions.py --fix")
        print()

    # Return statistics for API usage
    return {
        'checked': checked_count,
        'fixed': fixed_count,
        'avg_distance_fixed': int(avg_distance),
        'issues': [
            {
                'name': issue['lock']['name'],
                'distance': int(issue['distance']),
                'old_position': [issue['lock']['lat'], issue['lock']['lon']],
                'new_position': [issue['osm_lat'], issue['osm_lon']]
            }
            for issue in issues_found
        ]
    }

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description='Check and fix lock positions')
    parser.add_argument('--fix', action='store_true', help='Automatically fix positions')
    parser.add_argument('--threshold', type=int, default=500, help='Distance threshold in meters (default: 500)')

    args = parser.parse_args()

    check_lock_positions(auto_fix=args.fix, distance_threshold=args.threshold)
