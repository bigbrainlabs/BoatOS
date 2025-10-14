#!/usr/bin/env python3
"""
Fetch all locks (Schleusen) from OpenStreetMap for German waterways
Uses Overpass API to get comprehensive lock data
"""

import requests
import json
import time
from pathlib import Path

def fetch_locks_from_overpass(bbox=None):
    """
    Fetch locks from OpenStreetMap using Overpass API

    Args:
        bbox: Bounding box as (min_lat, min_lon, max_lat, max_lon)
              If None, uses Germany's approximate bounds
    """

    if bbox is None:
        # Germany approximate bounds
        bbox = (47.2, 5.8, 55.1, 15.1)  # (min_lat, min_lon, max_lat, max_lon)

    overpass_url = "https://overpass-api.de/api/interpreter"

    # Overpass query for locks
    # In OSM, locks are primarily tagged as waterway=lock_gate
    # We use a simplified query that focuses on the main tag
    overpass_query = f"""
    [out:json][timeout:180];
    (
      node["waterway"="lock_gate"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});
      way["waterway"="lock_gate"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});
    );
    out body center;
    """

    print(f"Querying Overpass API for locks in Germany...")
    print(f"   Bounding box: {bbox}")

    try:
        response = requests.post(overpass_url, data=overpass_query, timeout=240)
        response.raise_for_status()
        data = response.json()

        locks = []
        elements = data.get('elements', [])

        print(f"Found {len(elements)} OSM elements")

        # Debug: Print response if no elements found
        if len(elements) == 0:
            print(f"DEBUG: Response data: {data}")
            print(f"DEBUG: Query was:\n{overpass_query}")

        for element in elements:
            try:
                # Get coordinates
                if element['type'] == 'node':
                    lat = element['lat']
                    lon = element['lon']
                elif 'center' in element:
                    lat = element['center']['lat']
                    lon = element['center']['lon']
                else:
                    continue  # Skip if no coordinates

                tags = element.get('tags', {})

                # Extract lock information
                lock = {
                    'osm_id': element['id'],
                    'osm_type': element['type'],
                    'name': tags.get('name', tags.get('lock:name', f'Lock {element["id"]}')),
                    'lat': lat,
                    'lon': lon,
                    'tags': tags
                }

                # Try to extract additional info
                if 'lock:length' in tags:
                    try:
                        lock['max_length'] = float(tags['lock:length'])
                    except:
                        pass

                if 'lock:width' in tags:
                    try:
                        lock['max_width'] = float(tags['lock:width'])
                    except:
                        pass

                if 'lock:height' in tags:
                    try:
                        lock['max_height'] = float(tags['lock:height'])
                    except:
                        pass

                # Waterway name
                lock['waterway'] = tags.get('waterway:name', tags.get('canal', ''))

                # Contact info
                if 'phone' in tags:
                    lock['phone'] = tags['phone']
                if 'website' in tags:
                    lock['website'] = tags['website']

                locks.append(lock)

            except Exception as e:
                print(f"   WARNING: Error processing element {element.get('id')}: {e}")
                continue

        return locks

    except Exception as e:
        print(f"ERROR querying Overpass API: {e}")
        return []

def save_osm_locks(locks, output_file):
    """Save OSM locks to JSON file"""

    print(f"\nSaving {len(locks)} locks to {output_file}...")

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(locks, f, indent=2, ensure_ascii=False)

    print(f"Saved!")

    # Print statistics
    waterways = {}
    for lock in locks:
        waterway = lock.get('waterway', 'Unknown')
        if waterway:
            waterways[waterway] = waterways.get(waterway, 0) + 1

    print(f"\nStatistics:")
    print(f"   Total locks: {len(locks)}")
    print(f"   Unique waterways: {len(waterways)}")

    if waterways:
        print(f"\nTop waterways:")
        for waterway, count in sorted(waterways.items(), key=lambda x: x[1], reverse=True)[:10]:
            if waterway:
                print(f"   {waterway}: {count}")

if __name__ == "__main__":
    output_file = Path(__file__).parent / "data" / "locks_osm_raw.json"

    print("OpenStreetMap Lock Fetcher")
    print("=" * 50)

    # Fetch locks from OSM
    locks = fetch_locks_from_overpass()

    if locks:
        save_osm_locks(locks, output_file)
        print(f"\nComplete! Data saved to {output_file}")
        print(f"\nYou can now process this data with a converter script to")
        print(f"   match it with known lock names and add additional information.")
    else:
        print("\nNo locks found")
