"""
Waterway Infrastructure Service - Fetches locks, bridges, harbors from OpenStreetMap
"""
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

class WaterwayInfrastructure:
    def __init__(self):
        self.overpass_url = "https://overpass-api.de/api/interpreter"
        self.cache = {}
        self.cache_duration = timedelta(hours=24)  # Cache for 24 hours

    def _get_cache_key(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float, types: List[str]) -> str:
        """Generate cache key for bbox and types"""
        return f"{lat_min:.3f},{lon_min:.3f},{lat_max:.3f},{lon_max:.3f}:{','.join(sorted(types))}"

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache entry is still valid"""
        if cache_key not in self.cache:
            return False
        cache_time = self.cache[cache_key].get('timestamp')
        if not cache_time:
            return False
        return datetime.now() - cache_time < self.cache_duration

    def fetch_infrastructure(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float,
                           types: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        """
        Fetch waterway infrastructure from OpenStreetMap Overpass API

        Args:
            lat_min, lon_min, lat_max, lon_max: Bounding box
            types: List of types to fetch. Options: 'lock', 'bridge', 'harbor', 'weir', 'dam'
                   If None, fetches all types

        Returns:
            List of infrastructure POIs with properties
        """
        if types is None:
            types = ['lock', 'bridge', 'harbor', 'weir', 'dam']

        # Check cache
        cache_key = self._get_cache_key(lat_min, lon_min, lat_max, lon_max, types)
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        # Build Overpass QL query
        bbox = f"{lat_min},{lon_min},{lat_max},{lon_max}"
        query_parts = []

        # Locks (Schleusen)
        if 'lock' in types:
            query_parts.append(f"""
                (
                  node["waterway"="lock_gate"]({bbox});
                  node["lock"="yes"]({bbox});
                  way["waterway"="lock_gate"]({bbox});
                  way["lock"="yes"]({bbox});
                );
            """)

        # Bridges (Brücken)
        if 'bridge' in types:
            query_parts.append(f"""
                (
                  way["bridge"="yes"]["waterway"]({bbox});
                  way["man_made"="bridge"]["waterway"]({bbox});
                );
            """)

        # Harbors/Marinas (Häfen)
        if 'harbor' in types:
            query_parts.append(f"""
                (
                  node["harbour"="yes"]({bbox});
                  node["amenity"="marina"]({bbox});
                  way["harbour"="yes"]({bbox});
                  way["amenity"="marina"]({bbox});
                );
            """)

        # Weirs (Wehre)
        if 'weir' in types:
            query_parts.append(f"""
                (
                  node["waterway"="weir"]({bbox});
                  way["waterway"="weir"]({bbox});
                );
            """)

        # Dams (Staudämme)
        if 'dam' in types:
            query_parts.append(f"""
                (
                  node["waterway"="dam"]({bbox});
                  way["waterway"="dam"]({bbox});
                );
            """)

        # Combine query
        query = f"""
        [out:json][timeout:25];
        {' '.join(query_parts)}
        out center;
        """

        try:
            response = requests.post(self.overpass_url, data={'data': query}, timeout=30)
            response.raise_for_status()
            data = response.json()

            # Parse results
            pois = []
            for element in data.get('elements', []):
                poi = self._parse_element(element)
                if poi:
                    pois.append(poi)

            # Cache results
            self.cache[cache_key] = {
                'data': pois,
                'timestamp': datetime.now()
            }

            print(f"✅ Fetched {len(pois)} infrastructure POIs from OSM")
            return pois

        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error fetching infrastructure from OSM: {e}")
            return []
        except Exception as e:
            print(f"⚠️ Error parsing infrastructure data: {e}")
            return []

    def _parse_element(self, element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse OSM element to POI format"""
        tags = element.get('tags', {})

        # Determine type
        poi_type = self._determine_type(tags)
        if not poi_type:
            return None

        # Get coordinates
        if element.get('type') == 'node':
            lat = element.get('lat')
            lon = element.get('lon')
        elif 'center' in element:
            lat = element['center'].get('lat')
            lon = element['center'].get('lon')
        else:
            return None

        if not lat or not lon:
            return None

        # Extract relevant properties
        poi = {
            'id': element.get('id'),
            'type': poi_type,
            'lat': lat,
            'lon': lon,
            'name': tags.get('name', tags.get('ref', f"{poi_type.capitalize()} #{element.get('id')}")),
            'properties': self._extract_properties(tags, poi_type)
        }

        return poi

    def _determine_type(self, tags: Dict[str, str]) -> Optional[str]:
        """Determine POI type from OSM tags"""
        if tags.get('waterway') == 'lock_gate' or tags.get('lock') == 'yes':
            return 'lock'
        elif tags.get('bridge') == 'yes' or tags.get('man_made') == 'bridge':
            return 'bridge'
        elif tags.get('harbour') == 'yes' or tags.get('amenity') == 'marina':
            return 'harbor'
        elif tags.get('waterway') == 'weir':
            return 'weir'
        elif tags.get('waterway') == 'dam':
            return 'dam'
        return None

    def _extract_properties(self, tags: Dict[str, str], poi_type: str) -> Dict[str, Any]:
        """Extract relevant properties based on POI type"""
        props = {}

        # Common properties
        if 'operator' in tags:
            props['operator'] = tags['operator']
        if 'opening_hours' in tags:
            props['opening_hours'] = tags['opening_hours']
        if 'phone' in tags:
            props['phone'] = tags['phone']
        if 'website' in tags:
            props['website'] = tags['website']
        if 'vhf_channel' in tags:
            props['vhf_channel'] = tags['vhf_channel']

        # Lock-specific
        if poi_type == 'lock':
            if 'lock:height' in tags:
                props['height'] = tags['lock:height']
            if 'lock:length' in tags:
                props['length'] = tags['lock:length']
            if 'lock:width' in tags:
                props['width'] = tags['lock:width']
            if 'lock:type' in tags:
                props['lock_type'] = tags['lock:type']

        # Bridge-specific
        elif poi_type == 'bridge':
            if 'bridge:height' in tags:
                props['clearance_height'] = tags['bridge:height']
            if 'maxheight' in tags:
                props['max_height'] = tags['maxheight']
            if 'bridge:structure' in tags:
                props['structure'] = tags['bridge:structure']
            if 'bridge:movable' in tags:
                props['movable'] = tags['bridge:movable']

        # Harbor-specific
        elif poi_type == 'harbor':
            if 'capacity' in tags:
                props['capacity'] = tags['capacity']
            if 'berth' in tags:
                props['berths'] = tags['berth']
            if 'seamark:harbour:category' in tags:
                props['category'] = tags['seamark:harbour:category']
            if 'fuel' in tags:
                props['fuel'] = tags['fuel']
            if 'electricity' in tags:
                props['electricity'] = tags['electricity']
            if 'toilets' in tags:
                props['toilets'] = tags['toilets']
            if 'shower' in tags:
                props['shower'] = tags['shower']

        # Weir-specific
        elif poi_type == 'weir':
            if 'height' in tags:
                props['height'] = tags['height']
            if 'weir' in tags:
                props['weir_type'] = tags['weir']

        return props

# Global instance
waterway_infrastructure = WaterwayInfrastructure()
