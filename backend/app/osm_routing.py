"""
OSM-based Waterway Routing using pyroutelib3 v2.0
Provides A* pathfinding on waterway network from OpenStreetMap data
"""
from typing import List, Tuple, Optional
import math

class OSMWaterwayRouter:
    def __init__(self):
        # pyroutelib3 v2.0 uses direct OSM data loading
        # We'll use a simple OSM graph for waterway routing
        print("✅ OSM Waterway Router initialized")

    def haversine_distance(self, lon1: float, lat1: float, lon2: float, lat2: float) -> float:
        """Calculate distance in meters between two points"""
        R = 6371000  # Earth radius in meters

        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)

        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

        return R * c

    def route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """
        Calculate route using direct line for now
        pyroutelib3 v2.0 requires local OSM data or Overpass API calls
        Future: Implement proper OSM routing with local data
        """
        if len(waypoints) < 2:
            return {"error": "Need at least 2 waypoints"}

        route_coords = []
        total_distance = 0

        for i in range(len(waypoints) - 1):
            start_lon, start_lat = waypoints[i]
            end_lon, end_lat = waypoints[i + 1]

            # For now, use direct line routing
            # TODO: Implement OSM waterway routing with local data
            route_coords.append([start_lon, start_lat])
            if i == len(waypoints) - 2:
                route_coords.append([end_lon, end_lat])

            total_distance += self.haversine_distance(start_lon, start_lat, end_lon, end_lat)

        return {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": route_coords
            },
            "properties": {
                "distance_m": total_distance,
                "distance_nm": total_distance / 1852,
                "waterway_routed": False,  # Direct line routing for now
                "routing_type": "direct"
            }
        }
