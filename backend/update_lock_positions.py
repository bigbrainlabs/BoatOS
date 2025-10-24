#!/usr/bin/env python3
"""
Einmalige Aktualisierung aller Schleusenpositionen aus OSM
"""

import sys
import requests
import time
from pathlib import Path

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

def get_osm_lock_near_position(lock_name, lat, lon, search_radius_deg=0.15):
    """
    Suche nach einer Schleuse mit passendem Namen in der Nähe der gegebenen Position
    search_radius_deg: Suchradius in Grad (~0.1° = ~10km)
    """
    try:
        # Bounding Box um die Position
        bbox_south = lat - search_radius_deg
        bbox_north = lat + search_radius_deg
        bbox_west = lon - search_radius_deg
        bbox_east = lon + search_radius_deg

        # Erstelle Overpass-Query mit Bounding-Box
        overpass_query = f"""
        [out:json][timeout:25][bbox:{bbox_south},{bbox_west},{bbox_north},{bbox_east}];
        (
          nwr["waterway"="lock"];
        );
        out center;
        """

        url = "https://overpass-api.de/api/interpreter"
        response = requests.post(url, data={'data': overpass_query}, headers={'User-Agent': 'BoatOS/1.0'}, timeout=30)

        if response.status_code == 200:
            data = response.json()
            elements = data.get('elements', [])

            if not elements:
                print(f"  ⚠️  Keine Schleusen in der Nähe gefunden")
                return None, None, None, None, None

            # Finde die beste Übereinstimmung nach Name (case-insensitive)
            lock_name_lower = lock_name.lower()
            best_match = None
            best_score = 0

            for element in elements:
                osm_name = element.get('tags', {}).get('name', '')
                if not osm_name:
                    continue

                osm_name_lower = osm_name.lower()

                # Exakte Übereinstimmung
                if osm_name_lower == lock_name_lower:
                    best_match = element
                    break

                # Teilübereinstimmung
                if lock_name_lower in osm_name_lower or osm_name_lower in lock_name_lower:
                    # Berechne Ähnlichkeit (einfach: Länge der gemeinsamen Teilstrings)
                    score = len(set(lock_name_lower.split()) & set(osm_name_lower.split()))
                    if score > best_score:
                        best_score = score
                        best_match = element

            if not best_match:
                # Nehme die nächstgelegene Schleuse
                print(f"  ℹ️  Keine Namen-Übereinstimmung, nehme nächstgelegene")
                best_match = elements[0]

            # Extrahiere Koordinaten
            if best_match['type'] == 'node':
                osm_lat, osm_lon = best_match['lat'], best_match['lon']
            elif 'center' in best_match:
                osm_lat, osm_lon = best_match['center']['lat'], best_match['center']['lon']
            else:
                return None, None, None, None, None

            osm_name = best_match.get('tags', {}).get('name', lock_name)
            osm_id = f"{best_match['type']}/{best_match['id']}"

            # Berechne Distanz
            import math
            R = 6371000  # Earth radius in meters
            phi1 = math.radians(lat)
            phi2 = math.radians(osm_lat)
            delta_phi = math.radians(osm_lat - lat)
            delta_lambda = math.radians(osm_lon - lon)
            a = (math.sin(delta_phi / 2) ** 2 +
                 math.cos(phi1) * math.cos(phi2) *
                 math.sin(delta_lambda / 2) ** 2)
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
            distance = R * c

            return float(osm_lat), float(osm_lon), osm_name, osm_id, int(distance)

        return None, None, None, None, None

    except Exception as e:
        print(f"  ⚠️  Fehler: {e}")
        return None, None, None, None, None

def update_all_locks():
    """Aktualisiere alle Schleusenpositionen"""
    print("=" * 80)
    print("SCHLEUSEN-POSITIONS-AKTUALISIERUNG")
    print("=" * 80)
    print()

    locks = locks_storage.load_locks()
    print(f"📊 Aktualisiere {len(locks)} Schleusen...\n")

    updated = 0
    not_found = 0

    for i, lock in enumerate(locks, 1):
        print(f"[{i}/{len(locks)}] {lock['name']}...")
        print(f"  📍 Aktuelle Position: {lock['lat']:.6f}, {lock['lon']:.6f}")

        # Suche OSM-Position in der Nähe
        osm_lat, osm_lon, osm_name, osm_id, distance = get_osm_lock_near_position(
            lock['name'], lock['lat'], lock['lon']
        )

        if osm_lat and osm_lon:
            print(f"  ✅ OSM gefunden: {osm_name} ({osm_id})")
            print(f"  📍 OSM Position: {osm_lat:.6f}, {osm_lon:.6f}")
            print(f"  📏 Distanz: {distance}m")

            if distance > 100:
                # Aktualisiere Position
                locks_storage.update_lock(lock['id'], {
                    'lat': osm_lat,
                    'lon': osm_lon
                })
                print(f"  ✅ Position aktualisiert!")
                updated += 1
            else:
                print(f"  ℹ️  Position bereits korrekt (< 100m)")
        else:
            print(f"  ❌ Nicht in OSM gefunden")
            not_found += 1

        # Rate limiting für Overpass
        time.sleep(1.5)
        print()

    print("=" * 80)
    print("FERTIG")
    print("=" * 80)
    print(f"✅ Aktualisiert: {updated}")
    print(f"ℹ️  Bereits korrekt: {len(locks) - updated - not_found}")
    print(f"❌ Nicht gefunden: {not_found}")
    print()

if __name__ == "__main__":
    update_all_locks()
