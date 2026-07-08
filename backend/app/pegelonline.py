"""
PEGELONLINE Service - Fetches water level data from German waterways
API Documentation: https://www.pegelonline.wsv.de/webservice/dokuRestapi
"""
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
import json

class PegelOnline:
    def __init__(self):
        self.base_url = "https://www.pegelonline.wsv.de/webservices/rest-api/v2"
        self.cache = {}
        self.cache_duration = timedelta(minutes=15)  # Cache for 15 minutes (data updates frequently)

    def _get_cache_key(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> str:
        """Generate cache key for bbox"""
        return f"{lat_min:.3f},{lon_min:.3f},{lat_max:.3f},{lon_max:.3f}"

    def _is_cache_valid(self, cache_key: str) -> bool:
        """Check if cache entry is still valid"""
        if cache_key not in self.cache:
            return False
        cache_time = self.cache[cache_key].get('timestamp')
        if not cache_time:
            return False
        return datetime.now() - cache_time < self.cache_duration

    def fetch_gauges(self, lat_min: float, lon_min: float, lat_max: float, lon_max: float) -> List[Dict[str, Any]]:
        """
        Fetch water level gauges from PEGELONLINE API

        Args:
            lat_min, lon_min, lat_max, lon_max: Bounding box

        Returns:
            List of gauge stations with current measurements
        """
        # Check cache
        cache_key = self._get_cache_key(lat_min, lon_min, lat_max, lon_max)
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            # Fetch all stations (API doesn't support bbox filtering directly)
            response = requests.get(
                f"{self.base_url}/stations.json",
                params={'includeTimeseries': 'true', 'includeCurrentMeasurement': 'true'},
                timeout=10
            )
            response.raise_for_status()
            stations = response.json()

            # Filter by bounding box and extract relevant data
            gauges = []
            for station in stations:
                lat = station.get('latitude')
                lon = station.get('longitude')

                # Skip if no coordinates
                if not lat or not lon:
                    continue

                # Check if in bounding box
                if not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
                    continue

                # Extract water level data
                gauge_data = self._parse_station(station)
                if gauge_data:
                    gauges.append(gauge_data)

            # Cache results
            self.cache[cache_key] = {
                'data': gauges,
                'timestamp': datetime.now()
            }

            print(f"✅ Fetched {len(gauges)} water level gauges from PEGELONLINE")
            return gauges

        except requests.exceptions.RequestException as e:
            print(f"⚠️ Error fetching gauges from PEGELONLINE: {e}")
            return []
        except Exception as e:
            print(f"⚠️ Error parsing PEGELONLINE data: {e}")
            return []

    def _parse_station(self, station: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse PEGELONLINE station to gauge format"""
        try:
            # Get water level timeseries
            water_level_series = None
            flow_velocity_series = None

            for ts in station.get('timeseries', []):
                if ts.get('shortname') == 'W':  # W = Wasserstand (water level)
                    water_level_series = ts
                elif ts.get('shortname') == 'VA':  # VA = Fließgeschwindigkeit (flow velocity)
                    flow_velocity_series = ts

            if not water_level_series:
                return None

            # Get current measurement
            current_measurement = water_level_series.get('currentMeasurement')
            if not current_measurement:
                return None

            # Extract values
            water_level_cm = current_measurement.get('value')
            timestamp = current_measurement.get('timestamp')

            if water_level_cm is None:
                return None

            # Get gauge metadata
            gauge = {
                'id': station.get('uuid'),
                'name': station.get('longname', station.get('shortname', 'Pegel')),
                'lat': station.get('latitude'),
                'lon': station.get('longitude'),
                'water': station.get('water', {}).get('longname', 'Unbekannt'),
                'water_level_cm': round(water_level_cm, 0),
                'water_level_m': round(water_level_cm / 100, 2),
                'timestamp': timestamp,
                'unit': water_level_series.get('unit', 'cm'),
                'properties': {}
            }

            # Add flow velocity if available
            if flow_velocity_series:
                flow_measurement = flow_velocity_series.get('currentMeasurement')
                if flow_measurement and flow_measurement.get('value') is not None:
                    # VA is in m/s, convert to km/h
                    flow_ms = flow_measurement.get('value')
                    flow_kmh = round(flow_ms * 3.6, 2)
                    gauge['flow_velocity_ms'] = round(flow_ms, 2)
                    gauge['flow_velocity_kmh'] = flow_kmh
                    gauge['flow_timestamp'] = flow_measurement.get('timestamp')
                    gauge['flow_unit'] = flow_velocity_series.get('unit', 'm/s')

            # Add optional properties
            if 'km' in station:
                gauge['properties']['km'] = station['km']

            # Get trend (rising/falling)
            if 'stateMnwMhw' in current_measurement:
                gauge['properties']['trend'] = current_measurement['stateMnwMhw']

            # Get characteristic values if available
            if 'charValue' in water_level_series:
                gauge['properties']['char_values'] = water_level_series['charValue']

            return gauge

        except Exception as e:
            print(f"⚠️ Error parsing station {station.get('shortname', 'unknown')}: {e}")
            return None

    def get_reference_levels(self, lat_min: float, lon_min: float,
                             lat_max: float, lon_max: float) -> List[Dict[str, Any]]:
        """
        Pegel mit Niedrigwasser-Referenz (MNW) für den IENC-Tiefen-Check.

        Liefert pro Station den Aufschlag delta_m = (W − MNW) / 100 auf die
        Kartentiefe. MNW dient als konservativer Proxy für das Kartennull
        (GlW liegt unter MNW → der echte Aufschlag wäre größer). Staugeregelte
        Kanalpegel haben keine characteristicValues und fallen automatisch
        raus — dort gilt die Kartentiefe direkt. BLOCKING.
        """
        cache_key = "reflevels_" + self._get_cache_key(lat_min, lon_min, lat_max, lon_max)
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']

        try:
            response = requests.get(
                f"{self.base_url}/stations.json",
                params={'includeTimeseries': 'true',
                        'includeCurrentMeasurement': 'true',
                        'includeCharacteristicValues': 'true'},
                timeout=15
            )
            response.raise_for_status()

            refs = []
            for station in response.json():
                lat, lon = station.get('latitude'), station.get('longitude')
                if not lat or not lon:
                    continue
                if not (lat_min <= lat <= lat_max and lon_min <= lon <= lon_max):
                    continue
                w_series = next((ts for ts in station.get('timeseries', [])
                                 if ts.get('shortname') == 'W'), None)
                if not w_series:
                    continue
                current = (w_series.get('currentMeasurement') or {}).get('value')
                mnw = next((cv.get('value') for cv in w_series.get('characteristicValues', [])
                            if cv.get('shortname') == 'MNW'), None)
                if current is None or mnw is None:
                    continue
                refs.append({
                    'name': station.get('longname', station.get('shortname', 'Pegel')).title(),
                    'lat': lat, 'lon': lon,
                    'water': station.get('water', {}).get('longname', ''),
                    'w_cm': current, 'mnw_cm': mnw,
                    'delta_m': round((current - mnw) / 100, 2),
                })

            self.cache[cache_key] = {'data': refs, 'timestamp': datetime.now()}
            print(f"✅ {len(refs)} Referenz-Pegel (MNW) für Tiefen-Check geladen")
            return refs
        except Exception as e:
            print(f"⚠️ Referenz-Pegel konnten nicht geladen werden: {e}")
            return []

# Global instance
pegelonline = PegelOnline()
