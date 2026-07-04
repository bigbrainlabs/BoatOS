"""
Water Current Service - Manages water flow velocity data
Combines static lookup tables with live Pegelonline data
"""
from typing import Dict, Optional, List, Tuple
from pegelonline import pegelonline
from pathlib import Path
import sqlite3
import gzip
import math


# ---------------------------------------------------------------------------
# Minimal MVT (Mapbox Vector Tile) parser — pure stdlib, no external deps.
# Used to extract waterway names from local MBTiles files (offline).
# ---------------------------------------------------------------------------

def _read_varint(data: bytes, pos: int) -> Tuple[int, int]:
    result = shift = 0
    while True:
        b = data[pos]; pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            break
        shift += 7
    return result, pos

def _skip_field(data: bytes, pos: int, wt: int) -> int:
    if wt == 0:
        _, pos = _read_varint(data, pos)
    elif wt == 1:
        pos += 8
    elif wt == 2:
        l, pos = _read_varint(data, pos); pos += l
    elif wt == 5:
        pos += 4
    return pos

def _parse_mvt_layer_names(layer_data: bytes) -> Tuple[Optional[str], List[str]]:
    """Two-pass MVT layer parser — features precede keys/values in Planetiler output."""
    keys: List[str] = []
    values: List[Optional[str]] = []
    feat_blobs: List[bytes] = []
    lname: Optional[str] = None

    pos = 0
    while pos < len(layer_data):
        tag, pos = _read_varint(layer_data, pos)
        fn, wt = tag >> 3, tag & 7
        if wt == 2:
            l, pos = _read_varint(layer_data, pos)
            lv = layer_data[pos:pos+l]; pos += l
            if fn == 1:
                lname = lv.decode('utf-8', errors='ignore')
            elif fn == 3:
                keys.append(lv.decode('utf-8', errors='ignore'))
            elif fn == 4:
                # Decode MVT Value message
                vpos = 0; val: Optional[str] = None
                while vpos < len(lv):
                    vtag, vpos = _read_varint(lv, vpos)
                    vfn, vwt = vtag >> 3, vtag & 7
                    if vwt == 2:
                        vl, vpos = _read_varint(lv, vpos)
                        vv = lv[vpos:vpos+vl]; vpos += vl
                        if vfn == 1:
                            val = vv.decode('utf-8', errors='ignore')
                    elif vwt == 0:
                        _, vpos = _read_varint(lv, vpos)
                    elif vwt == 1: vpos += 8
                    elif vwt == 5: vpos += 4
                values.append(val)
            elif fn == 2:
                feat_blobs.append(lv)
        elif wt == 0: _, pos = _read_varint(layer_data, pos)
        elif wt == 1: pos += 8
        elif wt == 5: pos += 4

    names: List[str] = []
    for fb in feat_blobs:
        fpos = 0
        while fpos < len(fb):
            ftag, fpos = _read_varint(fb, fpos)
            ffn, fwt = ftag >> 3, ftag & 7
            if ffn == 2 and fwt == 2:
                fl, fpos = _read_varint(fb, fpos)
                fv = fb[fpos:fpos+fl]; fpos += fl
                # packed uint32 tags: [key_idx, val_idx, ...]
                tpos = 0; ts: List[int] = []
                while tpos < len(fv):
                    t, tpos = _read_varint(fv, tpos); ts.append(t)
                for i in range(0, len(ts) - 1, 2):
                    ki, vi = ts[i], ts[i+1]
                    if ki < len(keys) and vi < len(values) and keys[ki] == 'name' and values[vi]:
                        names.append(str(values[vi]))
                break  # found tags, no need to parse rest of feature
            else:
                fpos = _skip_field(fb, fpos, fwt)
    return lname, names

def _waterway_names_from_tile(tile_data: bytes) -> List[str]:
    """Extract waterway names from a raw (decompressed) MVT tile."""
    names: List[str] = []
    pos = 0
    while pos < len(tile_data):
        tag, pos = _read_varint(tile_data, pos)
        fn, wt = tag >> 3, tag & 7
        if fn == 3 and wt == 2:
            l, pos = _read_varint(tile_data, pos)
            layer_data = tile_data[pos:pos+l]; pos += l
            lname, lnames = _parse_mvt_layer_names(layer_data)
            if lname == 'waterway':
                names.extend(lnames)
        elif wt == 2:
            l, pos = _read_varint(tile_data, pos); pos += l
        elif wt == 0: _, pos = _read_varint(tile_data, pos)
        elif wt == 1: pos += 8
        elif wt == 5: pos += 4
    return names

def _lat_lon_to_tile_xyz(lat: float, lon: float, zoom: int) -> Tuple[int, int, int]:
    """Convert lat/lon to tile (x, y_web, zoom). TMS y = (2^z - 1) - y_web."""
    lat_r = math.radians(lat)
    n = 2 ** zoom
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.log(math.tan(lat_r) + 1 / math.cos(lat_r)) / math.pi) / 2 * n)
    return x, y, zoom

class WaterCurrentService:
    def __init__(self):
        self.enabled = False
        self.static_currents = {'byName': {}, 'byType': {}}
        self.live_data_cache = {}
        self.known_flow_directions = {}
        self.river_areas = {}
        self.river_mouths = {}
        self.data_dir: Optional[Path] = None

    def configure(self, settings: Dict, data_dir: Optional[str] = None):
        """
        Configure water current service from settings

        Args:
            settings: waterCurrent settings from frontend
                {
                    "enabled": bool,
                    "byName": {"Rhein": {"current_kmh": 6.0, "type": "river"}, ...},
                    "byType": {"river": 2.0, "canal": 0.0, ...}
                }
        """
        if not settings:
            return

        if data_dir:
            self.data_dir = Path(data_dir)
        elif self.data_dir is None:
            # Auto-detect relative to this file: backend/app/ → BoatOS/data/
            self.data_dir = Path(__file__).resolve().parents[2] / 'data'

        self.enabled = settings.get('enabled', False)
        self.static_currents = {
            'byName': settings.get('byName', {}),
            'byType': settings.get('byType', {})
        }

        # Known flow directions (bearing = downstream direction in degrees)
        # Elbe: flows W in middle section (Aken/Magdeburg), then WNW toward Hamburg → 270°
        self.known_flow_directions = {
            'Rhein': 0,    # North
            'Main':  270,  # West
            'Mosel': 45,   # Northeast
            'Elbe':  270,  # West (middle Elbe; ~315° near Hamburg, but 270° fits Aken–Magdeburg best)
            'Saale': 0,    # North
            'Donau': 90,   # East
            'Weser': 0,    # North
            'Oder':  0,    # North
        }
        # Geographic bounding boxes [lat_min, lat_max, lon_min, lon_max]
        # Used to eliminate rivers that can't physically be at the route location
        self.river_areas = {
            'Rhein': (47.5, 52.0,  6.0,  9.0),
            'Mosel': (49.2, 50.4,  6.0,  7.7),
            'Main':  (49.7, 50.3,  8.0, 12.7),
            'Elbe':  (50.9, 54.0,  9.0, 15.0),
            'Saale': (51.0, 51.98, 11.5, 12.3),
            'Donau': (47.5, 49.5,  9.0, 17.0),
            'Weser': (51.3, 53.6,  8.0,  9.6),
            'Oder':  (50.0, 53.8, 13.8, 15.0),
        }
        # Mouth coordinates (lat, lon) — where the river flows into the next body of water.
        # Bearing from any point on the river TO the mouth = local downstream direction.
        self.river_mouths = {
            'Rhein': (51.960,  4.120),  # Hoek van Holland (North Sea)
            'Mosel': (50.370,  7.608),  # Koblenz (into Rhein)
            'Main':  (50.007,  8.274),  # Mainz (into Rhein)
            'Elbe':  (53.895,  8.668),  # Cuxhaven (North Sea)
            'Saale': (51.966, 11.897),  # Barby (into Elbe)
            'Donau': (45.217, 29.633),  # Sulina/Black Sea
            'Weser': (53.537,  8.572),  # Bremerhaven (North Sea)
            'Oder':  (53.742, 14.568),  # Szczecin Lagoon
        }

        print(f"🌊 Water current service configured: {'enabled' if self.enabled else 'disabled'}")
        if self.enabled:
            print(f"   Static data: {len(self.static_currents['byName'])} waterways")

    def _is_canal(self, name: str) -> bool:
        """Heuristic: is this waterway likely a canal (no significant current)?"""
        kw = ['kanal', 'canal', 'channel', 'kana', 'meer', 'see', 'lake', 'meer']
        return any(k in name.lower() for k in kw)

    def get_current_at_point(self, lat: float, lon: float, waterway_name: Optional[str] = None) -> Optional[float]:
        """
        Get water current velocity at a specific point in km/h.
        Strategy: byName lookup → byType fallback (type inferred from name).
        """
        if not self.enabled:
            return None

        if waterway_name:
            # 1: exact name match
            waterway_data = self.static_currents['byName'].get(waterway_name)
            if waterway_data:
                return waterway_data.get('current_kmh', 0)

            # 2: type-based fallback — infer river vs canal from name
            wtype = 'canal' if self._is_canal(waterway_name) else 'river'
            type_val = self.static_currents['byType'].get(wtype)
            if type_val is not None:
                return float(type_val) if isinstance(type_val, (int, float)) else type_val.get('current_kmh', 0)

        return None

    def _dominant_waterway_from_steps(self, waterway_steps: List[Tuple[str, float]]) -> Optional[str]:
        """Return waterway name with most route distance from OSRM steps."""
        dist_by_name: Dict[str, float] = {}
        for name, dist_m in waterway_steps:
            dist_by_name[name] = dist_by_name.get(name, 0) + dist_m
        if not dist_by_name:
            return None
        return max(dist_by_name, key=dist_by_name.get)

    def _get_mbtiles_files(self) -> List[Path]:
        """Return all non-seamark MBTiles files in the data directory."""
        if self.data_dir is None:
            return []
        return [p for p in self.data_dir.glob('*.mbtiles') if 'seamark' not in p.name]

    def _waterway_at_point(
        self,
        lat: float,
        lon: float,
        mbtiles_files: List[Path],
        tile_cache: Dict,
        zoom: int = 12
    ) -> Optional[str]:
        """
        Query MBTiles at a single lat/lon and return the dominant waterway name
        from the 'waterway' MVT layer. Uses tile_cache to avoid redundant reads.
        """
        x, y_web, z = _lat_lon_to_tile_xyz(lat, lon, zoom)
        y_tms = (2**z - 1) - y_web

        names: List[str] = []
        for mbtiles_path in mbtiles_files:
            cache_key = (mbtiles_path, z, x, y_tms)
            if cache_key in tile_cache:
                names.extend(tile_cache[cache_key])
                continue
            try:
                conn = sqlite3.connect(f"file:{mbtiles_path}?mode=ro", uri=True)
                row = conn.execute(
                    "SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?",
                    (z, x, y_tms)
                ).fetchone()
                conn.close()
                if not row:
                    tile_cache[cache_key] = []
                    continue
                try:
                    tile = gzip.decompress(row[0])
                except Exception:
                    tile = bytes(row[0])
                tile_names = _waterway_names_from_tile(tile)
                tile_cache[cache_key] = tile_names
                names.extend(tile_names)
            except Exception:
                tile_cache[cache_key] = []

        if not names:
            return None
        counts: Dict[str, int] = {}
        for n in names:
            counts[n] = counts.get(n, 0) + 1
        return max(counts, key=counts.get)

    def _dominant_waterway_from_mbtiles(
        self,
        route_geometry: List[List[float]],
        zoom: int = 12
    ) -> Optional[str]:
        """Sample 5 points along route, return the most frequent waterway name."""
        mbtiles_files = self._get_mbtiles_files()
        if not mbtiles_files:
            return None
        n = len(route_geometry)
        indices = [int(i * (n - 1) / 4) for i in range(5)] if n >= 5 else list(range(n))
        tile_cache: Dict = {}
        counts: Dict[str, int] = {}
        for idx in indices:
            lon, lat = route_geometry[idx]
            name = self._waterway_at_point(lat, lon, mbtiles_files, tile_cache, zoom)
            if name:
                counts[name] = counts.get(name, 0) + 1
        return max(counts, key=counts.get) if counts else None

    def _get_live_current_nearby(self, lat: float, lon: float, max_distance_km: float = 50) -> Optional[float]:
        """
        Get live current data from nearest Pegelonline station with VA data

        Args:
            lat, lon: Coordinates
            max_distance_km: Maximum search radius

        Returns:
            Flow velocity in km/h from nearest station, or None
        """
        try:
            # Fetch gauges in bounding box (±0.5 degrees ~ 55km)
            bbox_size = 0.5
            gauges = pegelonline.fetch_gauges(
                lat - bbox_size, lon - bbox_size,
                lat + bbox_size, lon + bbox_size
            )

            # Filter to stations with VA data
            stations_with_flow = [g for g in gauges if 'flow_velocity_kmh' in g]

            if not stations_with_flow:
                return None

            # Find nearest station
            nearest_station = None
            min_distance = float('inf')

            for station in stations_with_flow:
                distance = self._haversine_distance(
                    lat, lon,
                    station['lat'], station['lon']
                )

                if distance < min_distance and distance <= max_distance_km:
                    min_distance = distance
                    nearest_station = station

            if nearest_station:
                flow_kmh = nearest_station['flow_velocity_kmh']
                print(f"🌊 Live current from {nearest_station['name']}: {flow_kmh} km/h ({min_distance:.1f}km away)")
                return flow_kmh

            return None

        except Exception as e:
            print(f"⚠️ Error fetching live current data: {e}")
            return None

    def _haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance in km between two points"""
        R = 6371  # Earth radius in kilometers

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        return R * c

    def calculate_effective_speed(
        self,
        boat_speed_kmh: float,
        current_kmh: float,
        bearing_deg: float,
        flow_direction_deg: float = 90  # Assume downstream = East by default
    ) -> float:
        """
        Calculate effective boat speed considering water current

        Args:
            boat_speed_kmh: Boat's speed through water
            current_kmh: Water current velocity
            bearing_deg: Boat's heading (0° = North, 90° = East)
            flow_direction_deg: Direction of water flow (0° = North, 90° = East)

        Returns:
            Effective speed over ground in km/h
        """
        if current_kmh == 0:
            return boat_speed_kmh

        # Calculate angle between boat heading and current
        angle_diff = abs(bearing_deg - flow_direction_deg)
        if angle_diff > 180:
            angle_diff = 360 - angle_diff

        angle_rad = math.radians(angle_diff)

        # Effective speed component from current
        # If parallel (0°): full boost/penalty
        # If perpendicular (90°): no longitudinal effect
        # If opposite (180°): full penalty
        current_component = current_kmh * math.cos(angle_rad)

        effective_speed = boat_speed_kmh + current_component

        return max(0, effective_speed)  # Speed can't be negative

    def _estimate_flow_direction_from_route(self, route_geometry: List[List[float]]) -> float:
        """
        Estimate predominant flow direction by analyzing the route geometry
        Returns bearing in degrees (0° = North, 90° = East, etc.)
        """
        if len(route_geometry) < 10:
            # Not enough points, use start-to-end bearing
            lon1, lat1 = route_geometry[0]
            lon2, lat2 = route_geometry[-1]
            return self._calculate_bearing(lat1, lon1, lat2, lon2)

        # Calculate average bearing over route
        bearings = []
        for i in range(0, len(route_geometry) - 1, max(1, len(route_geometry) // 20)):
            lon1, lat1 = route_geometry[i]
            lon2, lat2 = route_geometry[min(i + 1, len(route_geometry) - 1)]
            bearings.append(self._calculate_bearing(lat1, lon1, lat2, lon2))

        # Average bearings (handling circular nature of angles)
        x_sum = sum(math.cos(math.radians(b)) for b in bearings)
        y_sum = sum(math.sin(math.radians(b)) for b in bearings)
        avg_bearing = math.degrees(math.atan2(y_sum, x_sum))
        return (avg_bearing + 360) % 360

    def adjust_route_duration(
        self,
        route_geometry: List[List[float]],  # [[lon, lat], [lon, lat], ...]
        distance_km: float,
        boat_speed_kmh: float,
        waterway_steps: Optional[List[Tuple[str, float]]] = None  # [(name, dist_m), ...]
    ) -> Tuple[float, Dict]:
        """
        Adjust route duration based on water currents along the route.
        Waterway detection priority:
          1. OSRM step names (dominant by distance) — accurate OSM data
          2. Geographic bounding box + bearing match (fallback for non-OSRM routes)
        """
        if not self.enabled or boat_speed_kmh <= 0:
            return distance_km / boat_speed_kmh if boat_speed_kmh > 0 else 0, {}

        detected_waterway: Optional[str] = None

        # --- 1. Primary: MBTiles query (offline, from local vector tile data, no hardcoding)
        detected_waterway = self._dominant_waterway_from_mbtiles(route_geometry)
        if detected_waterway:
            print(f"   🌊 Waterway detected from MBTiles: {detected_waterway}")

        # --- 2. Fallback: OSRM step names (if MBTiles unavailable)
        if not detected_waterway and waterway_steps:
            detected_waterway = self._dominant_waterway_from_steps(waterway_steps)
            if detected_waterway:
                print(f"   🌊 Waterway detected from OSRM steps: {detected_waterway}")

        # --- 3. Last resort: bounding box + bearing (for direct/non-OSRM routes)
        if not detected_waterway and self.static_currents['byName']:
            route_bearing = self._estimate_flow_direction_from_route(route_geometry)
            mid_idx = len(route_geometry) // 2
            mid_lon, mid_lat = route_geometry[mid_idx]

            best_match_diff = float('inf')
            for waterway_name, waterway_data in self.static_currents['byName'].items():
                if waterway_data.get('current_kmh', 0) <= 0:
                    continue
                area = self.river_areas.get(waterway_name)
                if area:
                    lat_min, lat_max, lon_min, lon_max = area
                    if not (lat_min <= mid_lat <= lat_max and lon_min <= mid_lon <= lon_max):
                        continue
                mouth_c = self.river_mouths.get(waterway_name)
                if mouth_c:
                    cand_bearing = self._calculate_bearing(mid_lat, mid_lon, mouth_c[0], mouth_c[1])
                else:
                    cand_bearing = self.known_flow_directions.get(waterway_name)
                    if cand_bearing is None:
                        continue
                angle_diff = abs(route_bearing - cand_bearing)
                if angle_diff > 180:
                    angle_diff = 360 - angle_diff
                reverse_diff = abs(route_bearing - ((cand_bearing + 180) % 360))
                if reverse_diff > 180:
                    reverse_diff = 360 - reverse_diff
                final_diff = min(angle_diff, reverse_diff)
                if final_diff < 50 and final_diff < best_match_diff:
                    best_match_diff = final_diff
                    detected_waterway = waterway_name

        # Fallback flow direction (used when no mouth known)
        route_bearing = self._estimate_flow_direction_from_route(route_geometry)

        # Prepare per-segment MBTiles lookup (shared tile cache across segments)
        mbtiles_files = self._get_mbtiles_files()
        tile_cache: Dict = {}

        print(f"   🌊 Current: boat={boat_speed_kmh:.1f}km/h, dist={distance_km:.1f}km, "
              f"fallback={detected_waterway or 'unknown'}")

        # Sample points along route (every ~10km, min 3 segments)
        num_samples = max(3, int(distance_km / 10))
        sample_indices = [int(i * (len(route_geometry) - 1) / (num_samples - 1)) for i in range(num_samples)]
        sample_indices[-1] = len(route_geometry) - 1

        known_waterways = set(self.static_currents['byName'].keys()) | set(self.river_mouths.keys())

        # ── Pass 1: collect segment geometry + waterway per segment ──────────
        raw_segments = []
        for i in range(len(sample_indices) - 1):
            idx1 = sample_indices[i]
            idx2 = sample_indices[i + 1]
            lon1, lat1 = route_geometry[idx1]
            lon2, lat2 = route_geometry[idx2]
            mid_lat = (lat1 + lat2) / 2
            mid_lon = (lon1 + lon2) / 2
            seg_waterway_raw = (
                self._waterway_at_point(mid_lat, mid_lon, mbtiles_files, tile_cache)
                if mbtiles_files else None
            )
            seg_waterway = (
                seg_waterway_raw if seg_waterway_raw in known_waterways
                else (detected_waterway or seg_waterway_raw)
            )
            raw_segments.append({
                'lat1': lat1, 'lon1': lon1, 'lat2': lat2, 'lon2': lon2,
                'mid_lat': mid_lat, 'mid_lon': mid_lon,
                'dist_km': self._haversine_distance(lat1, lon1, lat2, lon2),
                'bearing': self._calculate_bearing(lat1, lon1, lat2, lon2),
                'waterway': seg_waterway,
            })

        # ── Determine upstream/downstream per waterway from route endpoints ──
        # Uses first-entry and last-exit of each waterway on the route.
        # This handles river meanders correctly: individual segments may go
        # "away" from the mouth, but the overall path on that river still
        # brings the boat closer (downstream) or further (upstream).
        ww_first: Dict[str, Tuple[float, float]] = {}
        ww_last:  Dict[str, Tuple[float, float]] = {}
        for sd in raw_segments:
            ww = sd['waterway']
            if ww:
                if ww not in ww_first:
                    ww_first[ww] = (sd['lat1'], sd['lon1'])
                ww_last[ww] = (sd['lat2'], sd['lon2'])

        waterway_upstream: Dict[str, bool] = {}
        for ww, (flat, flon) in ww_first.items():
            mouth = self.river_mouths.get(ww)
            if mouth:
                llat, llon = ww_last[ww]
                d_first = self._haversine_distance(flat, flon, mouth[0], mouth[1])
                d_last  = self._haversine_distance(llat, llon, mouth[0], mouth[1])
                waterway_upstream[ww] = d_last > d_first + 0.1  # further from mouth = upstream

        # ── Pass 2: compute effective speeds + time impacts ──────────────────
        weighted_speed_sum = 0.0
        total_sampled_dist = 0.0
        segment_infos = []
        time_impact_by_waterway: Dict[str, float] = {}

        for i, sd in enumerate(raw_segments):
            seg_waterway = sd['waterway']
            current_kmh = self.get_current_at_point(sd['mid_lat'], sd['mid_lon'], seg_waterway)
            segment_dist_km = sd['dist_km']

            if current_kmh:
                mouth = self.river_mouths.get(seg_waterway) if seg_waterway else None
                if mouth and seg_waterway in waterway_upstream:
                    going_upstream = waterway_upstream[seg_waterway]
                    current_component = current_kmh * (-1 if going_upstream else 1)
                    effective_speed = max(0.5, boat_speed_kmh + current_component)
                    direction = "↑berg" if going_upstream else "↓tal"
                else:
                    # No mouth known → bearing fallback
                    effective_speed = self.calculate_effective_speed(
                        boat_speed_kmh, current_kmh, sd['bearing'], route_bearing
                    )
                    angle_diff = abs(sd['bearing'] - route_bearing)
                    if angle_diff > 180:
                        angle_diff = 360 - angle_diff
                    direction = "↓tal" if angle_diff < 90 else "↑berg"

                nominal_time_h = segment_dist_km / boat_speed_kmh
                actual_time_h  = segment_dist_km / effective_speed
                time_impact_h  = actual_time_h - nominal_time_h
                print(f"      Seg {i+1} [{seg_waterway}]: {segment_dist_km:.1f}km, "
                      f"{direction}, current={current_kmh}km/h → eff={effective_speed:.1f}km/h "
                      f"({time_impact_h:+.2f}h)")
                segment_infos.append({
                    'distance_km': segment_dist_km,
                    'waterway': seg_waterway,
                    'current_kmh': current_kmh,
                    'direction': direction,
                    'effective_speed_kmh': effective_speed,
                    'time_impact_h': time_impact_h,
                })
                if seg_waterway:
                    time_impact_by_waterway[seg_waterway] = (
                        time_impact_by_waterway.get(seg_waterway, 0) + time_impact_h
                    )
            else:
                effective_speed = boat_speed_kmh
                segment_infos.append({
                    'distance_km': segment_dist_km,
                    'waterway': seg_waterway,
                    'current_kmh': 0,
                    'effective_speed_kmh': boat_speed_kmh,
                })

            if effective_speed > 0 and segment_dist_km > 0:
                weighted_speed_sum += segment_dist_km * effective_speed
                total_sampled_dist += segment_dist_km

        # Apply weighted avg effective speed to ACTUAL route distance (not sampled crow-fly)
        if total_sampled_dist > 0 and weighted_speed_sum > 0:
            avg_effective_speed = weighted_speed_sum / total_sampled_dist
            total_adjusted_time = distance_km / avg_effective_speed
        else:
            total_adjusted_time = distance_km / boat_speed_kmh

        # Display waterway = the one with the largest absolute time impact.
        # This shows the waterway that matters most to the journey, regardless of km.
        # E.g. for Elbe→Saale-upstream: Saale upstream costs more time than Elbe downstream
        # saves → "↑ Saale" is shown even though the Elbe has more km.
        if time_impact_by_waterway:
            display_waterway = max(time_impact_by_waterway, key=lambda w: abs(time_impact_by_waterway[w]))
            display_time_diff = time_impact_by_waterway[display_waterway]
        else:
            display_waterway = detected_waterway
            display_time_diff = total_adjusted_time - (distance_km / boat_speed_kmh)

        total_time_diff = total_adjusted_time - (distance_km / boat_speed_kmh)
        debug_info = {
            'segments': segment_infos,
            'detected_waterway': display_waterway,
            'original_duration_h': distance_km / boat_speed_kmh,
            'adjusted_duration_h': total_adjusted_time,
            'time_diff_h': display_time_diff,   # waterway-specific impact → drives ↑/↓ in badge
            'total_time_diff_h': total_time_diff,
        }

        print(f"   🌊 Total: {total_adjusted_time:.2f}h (was {distance_km/boat_speed_kmh:.2f}h, "
              f"net={total_time_diff:+.2f}h, badge={display_waterway} {display_time_diff:+.2f}h)")

        return total_adjusted_time, debug_info

    def _calculate_bearing(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate bearing in degrees from point 1 to point 2"""
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lon_rad = math.radians(lon2 - lon1)

        y = math.sin(delta_lon_rad) * math.cos(lat2_rad)
        x = math.cos(lat1_rad) * math.sin(lat2_rad) - \
            math.sin(lat1_rad) * math.cos(lat2_rad) * math.cos(delta_lon_rad)

        bearing_rad = math.atan2(y, x)
        bearing_deg = math.degrees(bearing_rad)

        # Normalize to 0-360
        bearing_deg = (bearing_deg + 360) % 360

        return bearing_deg

# Global instance
water_current_service = WaterCurrentService()
