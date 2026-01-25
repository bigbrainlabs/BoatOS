"""
Water Current Service - Manages water flow velocity data
Combines static lookup tables with live Pegelonline data
"""
from typing import Dict, Optional, List, Tuple
from pegelonline import pegelonline
import math

class WaterCurrentService:
    def __init__(self):
        self.static_currents = {}  # Will be loaded from settings
        self.live_data_cache = {}  # Cache for Pegelonline VA data

    def configure(self, settings: Dict):
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

        self.enabled = settings.get('enabled', False)
        self.static_currents = {
            'byName': settings.get('byName', {}),
            'byType': settings.get('byType', {})
        }

        # Known flow directions for major German rivers (bearing in degrees)
        # These are approximate predominant flow directions
        self.known_flow_directions = {
            'Rhein': 0,      # North (generally flows northward)
            'Main': 270,     # West (flows into Rhine)
            'Mosel': 45,     # Northeast (flows into Rhine at Koblenz)
            'Elbe': 315,     # Northwest (flows from Czech Republic to North Sea)
            'Saale': 0,      # North (flows into Elbe)
            'Donau': 90,     # East (flows eastward to Black Sea)
            'Weser': 0,      # North (flows to North Sea)
            'Oder': 0,       # North (flows to Baltic Sea)
        }

        print(f"🌊 Water current service configured: {'enabled' if self.enabled else 'disabled'}")
        if self.enabled:
            print(f"   Static data: {len(self.static_currents['byName'])} waterways")

    def get_current_at_point(self, lat: float, lon: float, waterway_name: Optional[str] = None) -> Optional[float]:
        """
        Get water current velocity at a specific point in km/h

        Strategy:
        1. Try to find nearby Pegelonline station with VA data
        2. Fall back to static lookup by waterway name
        3. Fall back to default by waterway type

        Args:
            lat, lon: Coordinates
            waterway_name: Optional name of waterway (e.g. "Rhein")

        Returns:
            Flow velocity in km/h, or None if not available
        """
        if not self.enabled:
            return None

        # Strategy 1: DISABLED - Live data from Pegelonline was causing routing timeouts
        # live_current = self._get_live_current_nearby(lat, lon)
        # if live_current is not None:
        #     return live_current

        # Strategy 2: Lookup by waterway name
        if waterway_name:
            waterway_data = self.static_currents['byName'].get(waterway_name)
            if waterway_data:
                return waterway_data.get('current_kmh', 0)

        # Strategy 3: Default by type (e.g. "river" = 2.0 km/h)
        # We don't have type info here, so return None
        return None

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
        boat_speed_kmh: float
    ) -> Tuple[float, Dict]:
        """
        Adjust route duration based on water currents along the route

        Args:
            route_geometry: List of [lon, lat] coordinates
            distance_km: Total route distance
            boat_speed_kmh: Boat's cruising speed

        Returns:
            Tuple of (adjusted_duration_hours, debug_info)
        """
        if not self.enabled or boat_speed_kmh <= 0:
            # No adjustment, return original duration
            return distance_km / boat_speed_kmh if boat_speed_kmh > 0 else 0, {}

        # Identify which waterway we're on - try to detect from route geometry
        detected_waterway = None
        flow_direction = None

        # First, estimate the route's general direction
        route_bearing = self._estimate_flow_direction_from_route(route_geometry)

        # Find the waterway whose known flow direction is closest to route bearing
        # This assumes the route follows the waterway direction
        best_match_waterway = None
        best_angle_diff = 180  # Start with worst case

        for waterway_name, waterway_data in self.static_currents['byName'].items():
            if waterway_data.get('current_kmh', 0) > 0:
                known_direction = self.known_flow_directions.get(waterway_name)
                if known_direction is not None:
                    # Calculate angle difference (considering both directions of travel)
                    angle_diff = abs(route_bearing - known_direction)
                    if angle_diff > 180:
                        angle_diff = 360 - angle_diff

                    # Also check reverse direction (traveling upstream)
                    reverse_diff = abs(route_bearing - ((known_direction + 180) % 360))
                    if reverse_diff > 180:
                        reverse_diff = 360 - reverse_diff

                    # Use the smaller angle (either downstream or upstream)
                    final_diff = min(angle_diff, reverse_diff)

                    if final_diff < best_angle_diff and final_diff < 45:  # Must be within 45° to match
                        best_angle_diff = final_diff
                        best_match_waterway = waterway_name
                        flow_direction = known_direction

        if best_match_waterway:
            detected_waterway = best_match_waterway
        else:
            # Fallback: use first configured waterway (old behavior)
            for waterway_name, waterway_data in self.static_currents['byName'].items():
                if waterway_data.get('current_kmh', 0) > 0:
                    detected_waterway = waterway_name
                    flow_direction = self.known_flow_directions.get(waterway_name)
                    if flow_direction is not None:
                        break

        # If no specific waterway detected, use route bearing (old behavior)
        if flow_direction is None:
            flow_direction = self._estimate_flow_direction_from_route(route_geometry)
            waterway_info = "estimated from route"
        else:
            waterway_info = f"{detected_waterway} (known)"

        print(f"   🌊 Current adjustment: boat={boat_speed_kmh:.1f} km/h, distance={distance_km:.1f} km")
        print(f"      Waterway: {waterway_info}, flow_dir={flow_direction:.0f}°")

        # Sample points along route (every ~10km)
        num_samples = max(3, int(distance_km / 10))
        # Create sample indices, ensuring we include the last point
        sample_indices = [int(i * (len(route_geometry) - 1) / (num_samples - 1)) for i in range(num_samples)]

        # Ensure last index is exactly the last point
        sample_indices[-1] = len(route_geometry) - 1

        total_adjusted_time = 0
        segment_infos = []

        for i in range(len(sample_indices) - 1):
            idx1 = sample_indices[i]
            idx2 = sample_indices[i + 1]

            lon1, lat1 = route_geometry[idx1]
            lon2, lat2 = route_geometry[idx2]

            # Calculate segment distance
            segment_dist_km = self._haversine_distance(lat1, lon1, lat2, lon2)

            # Calculate bearing for this segment
            bearing = self._calculate_bearing(lat1, lon1, lat2, lon2)

            # Get current at midpoint
            mid_lat = (lat1 + lat2) / 2
            mid_lon = (lon1 + lon2) / 2
            current_kmh = self.get_current_at_point(mid_lat, mid_lon, detected_waterway)

            if current_kmh:
                # Use detected flow direction (either from known waterway or estimated)
                effective_speed = self.calculate_effective_speed(
                    boat_speed_kmh,
                    current_kmh,
                    bearing,
                    flow_direction
                )

                segment_time_h = segment_dist_km / effective_speed if effective_speed > 0 else 0

                # Calculate angle difference for logging
                angle_diff = abs(bearing - flow_direction)
                if angle_diff > 180:
                    angle_diff = 360 - angle_diff

                print(f"      Seg {i+1}: {segment_dist_km:.1f}km, bearing={bearing:.0f}° (Δ{angle_diff:.0f}° from flow), current={current_kmh}km/h → eff={effective_speed:.1f}km/h, time={segment_time_h:.2f}h")

                segment_infos.append({
                    'distance_km': segment_dist_km,
                    'current_kmh': current_kmh,
                    'flow_direction_deg': flow_direction,
                    'segment_bearing_deg': bearing,
                    'effective_speed_kmh': effective_speed,
                    'time_h': segment_time_h
                })
            else:
                # No current data, use base speed
                segment_time_h = segment_dist_km / boat_speed_kmh

                segment_infos.append({
                    'distance_km': segment_dist_km,
                    'current_kmh': 0,
                    'effective_speed_kmh': boat_speed_kmh,
                    'time_h': segment_time_h
                })

            total_adjusted_time += segment_time_h

        debug_info = {
            'segments': segment_infos,
            'detected_waterway': detected_waterway,
            'flow_direction_deg': flow_direction,
            'original_duration_h': distance_km / boat_speed_kmh,
            'adjusted_duration_h': total_adjusted_time,
            'time_diff_h': total_adjusted_time - (distance_km / boat_speed_kmh)
        }

        print(f"   🌊 Total: {total_adjusted_time:.2f}h (was {distance_km/boat_speed_kmh:.2f}h, diff={debug_info['time_diff_h']:.2f}h)")

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
