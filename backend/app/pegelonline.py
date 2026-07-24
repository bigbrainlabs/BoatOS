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
        # Der API-Call lädt IMMER alle Stationen (Bbox wird nur clientseitig
        # gefiltert). Deshalb die teure Vollliste EINMAL cachen (bbox-unabhängig)
        # und hier nur filtern — sonst lädt ein fahrendes Boot die komplette
        # DE-Pegel-DB bei jeder Position neu (Backend-Hang).
        all_refs = self._all_reference_levels()
        return [r for r in all_refs
                if lat_min <= r['lat'] <= lat_max and lon_min <= r['lon'] <= lon_max]

    def _all_reference_levels(self) -> List[Dict[str, Any]]:
        """Alle deutschen Referenz-Pegel (MNW) — einmal geladen + gecacht. BLOCKING."""
        cache_key = "reflevels_all"
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
            print(f"✅ {len(refs)} Referenz-Pegel (MNW) geladen (gecacht)")
            return refs
        except Exception as e:
            print(f"⚠️ Referenz-Pegel konnten nicht geladen werden: {e}")
            return []

    # ==================== GEZEITEN (MVP: gemessene Tidenkurve) ====================
    # Bewusst simpel: an der Küste (Elbe/Weser/Ems/Nordsee) zeigt der gemessene
    # Wasserstand die Tide direkt. Keine harmonische Vorhersage — das kommt später.

    def _all_stations_index(self) -> List[Dict[str, Any]]:
        """Leichter Stations-Index (uuid, Name, Position, Gewässer) — einmal gecacht."""
        cache_key = "stations_index"
        if self._is_cache_valid(cache_key):
            return self.cache[cache_key]['data']
        try:
            resp = requests.get(f"{self.base_url}/stations.json",
                                headers={'User-Agent': 'BoatOS/1.0'}, timeout=15)
            resp.raise_for_status()
            idx = []
            for s in resp.json():
                lat, lon = s.get('latitude'), s.get('longitude')
                if lat is None or lon is None:
                    continue
                idx.append({
                    'uuid': s.get('uuid'),
                    'name': (s.get('longname') or s.get('shortname') or 'Pegel').title(),
                    'lat': lat, 'lon': lon,
                    'water': (s.get('water') or {}).get('longname', ''),
                })
            self.cache[cache_key] = {'data': idx, 'timestamp': datetime.now()}
            print(f"✅ Pegel-Stationsindex: {len(idx)} Stationen (gecacht)")
            return idx
        except Exception as e:
            print(f"⚠️ Stationsindex konnte nicht geladen werden: {e}")
            return []

    def nearest_station(self, lat: float, lon: float) -> Optional[Dict[str, Any]]:
        """Nächstgelegene Pegelstation zu einer Position (grobe ebene Distanz reicht)."""
        idx = self._all_stations_index()
        if not idx:
            return None
        import math
        def d2(s):
            dlat = (s['lat'] - lat) * 111.0
            dlon = (s['lon'] - lon) * 111.0 * math.cos(math.radians(lat))
            return dlat * dlat + dlon * dlon
        return min(idx, key=d2)

    def fetch_tide_curve(self, uuid: str, hours: int = 30) -> List[Dict[str, Any]]:
        """Wasserstands-Zeitreihe (W) einer Station der letzten `hours` Stunden."""
        try:
            resp = requests.get(
                f"{self.base_url}/stations/{uuid}/W/measurements.json",
                params={'start': f'P{max(1, hours // 24 + 1)}D'},
                headers={'User-Agent': 'BoatOS/1.0'}, timeout=12
            )
            resp.raise_for_status()
            cutoff = datetime.now() - timedelta(hours=hours)
            out = []
            for m in resp.json():
                ts = m.get('timestamp')
                v = m.get('value')
                if ts is None or v is None:
                    continue
                try:
                    t = datetime.fromisoformat(ts)
                    if t.replace(tzinfo=None) < cutoff:
                        continue
                except Exception:
                    pass
                out.append({'t': ts, 'cm': v})
            return out
        except Exception as e:
            print(f"⚠️ Tidenkurve ({uuid}) fehlgeschlagen: {e}")
            return []

    def get_tide(self, lat: float, lon: float) -> Dict[str, Any]:
        """
        MVP-Gezeiten für eine Position: nächste Station + gemessene Kurve,
        aktueller Stand, Trend (Flut/Ebbe) und letztes Hoch-/Niedrigwasser.
        BLOCKING (requests) → im Endpoint via to_thread aufrufen.
        """
        st = self.nearest_station(lat, lon)
        if not st:
            return {'available': False, 'reason': 'Keine Pegelstation gefunden'}
        curve = self.fetch_tide_curve(st['uuid'], hours=30)
        if len(curve) < 3:
            return {'available': False, 'reason': 'Keine Messreihe', 'station': st['name']}

        cur = curve[-1]
        # Trend aus den letzten ~30 min: steigend = Flut, fallend = Ebbe
        prev = curve[-2]
        for c in reversed(curve[:-1]):
            try:
                if (datetime.fromisoformat(cur['t']) - datetime.fromisoformat(c['t'])).total_seconds() >= 1800:
                    prev = c
                    break
            except Exception:
                pass
        diff = cur['cm'] - prev['cm']
        trend = 'rising' if diff > 1 else ('falling' if diff < -1 else 'slack')

        # Letztes Hoch-/Niedrigwasser als Extrema der gemessenen Kurve
        vals = [c['cm'] for c in curve]
        hi = max(range(len(vals)), key=lambda i: vals[i])
        lo = min(range(len(vals)), key=lambda i: vals[i])

        return {
            'available': True,
            'station': st['name'],
            'water': st['water'],
            'lat': st['lat'], 'lon': st['lon'],
            'current_cm': round(cur['cm']),
            'current_m': round(cur['cm'] / 100, 2),
            'current_t': cur['t'],
            'trend': trend,          # rising (Flut) / falling (Ebbe) / slack
            'last_high': {'cm': round(vals[hi]), 'm': round(vals[hi] / 100, 2), 't': curve[hi]['t']},
            'last_low':  {'cm': round(vals[lo]), 'm': round(vals[lo] / 100, 2), 't': curve[lo]['t']},
            # Kurve auf ~150 Punkte ausdünnen — reicht für die Sparkline, spart Daten
            'curve': [{'t': c['t'], 'm': round(c['cm'] / 100, 2)}
                      for c in curve[::max(1, len(curve) // 150)]],
        }

# Global instance
pegelonline = PegelOnline()
