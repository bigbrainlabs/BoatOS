"""
Python-based OSM Waterway Routing using pyroutelib3 v2.0
Lightweight routing directly from OSM data without OSRM server
"""
from typing import List, Tuple, Optional, Mapping
import math
import os
import json
from pathlib import Path

# We'll use pyroutelib3 v2.0 to route on waterways
try:
    from pyroutelib3.osm import Graph, LiveGraph, Profile
    from pyroutelib3.osm.profile import TurnRestriction
    from pyroutelib3 import find_route
    PYROUTELIB_AVAILABLE = True
except ImportError:
    PYROUTELIB_AVAILABLE = False
    print("⚠️ pyroutelib3 not available")


# Custom Waterway Profile for pyroutelib3 v2.0
class WaterwayProfile:
    """
    Waterway routing profile for boats
    Routes along rivers, canals, and navigable waterways
    """

    def way_penalty(self, way_tags: Mapping[str, str]) -> Optional[float]:
        """
        Return penalty for traversing a waterway, or None if not traversable
        Lower penalty = preferred route
        """
        waterway = way_tags.get('waterway', '')

        # Primary waterways (best for navigation)
        if waterway in ['river', 'canal', 'fairway']:
            return 1.0

        # Secondary waterways (usable but less ideal)
        if waterway in ['stream', 'tidal_channel']:
            return 2.0

        # Tertiary waterways (avoid if possible)
        if waterway in ['ditch', 'drain']:
            return 10.0

        # Check for route=ferry (important for boats!)
        if way_tags.get('route') == 'ferry':
            return 1.5

        # Not a traversable waterway
        return None

    def way_direction(self, way_tags: Mapping[str, str]) -> Tuple[bool, bool]:
        """
        Return (forward_allowed, backward_allowed) for waterway direction
        Most waterways are bidirectional unless marked with oneway
        """
        oneway = way_tags.get('oneway', 'no')

        # Check for oneway waterways (rare but exists)
        if oneway in ['yes', '1', 'true']:
            return (True, False)  # Only forward
        elif oneway == '-1':
            return (False, True)  # Only backward
        else:
            return (True, True)  # Bidirectional (most waterways)

    def is_turn_restriction(self, relation_tags: Mapping[str, str]) -> TurnRestriction:
        """
        Check if relation is a turn restriction for boats
        Most turn restrictions don't apply to waterways
        """
        return TurnRestriction.INAPPLICABLE


class PyRouteLibRouter:
    def __init__(self, osm_file: Optional[str] = None):
        """
        Initialize pyroutelib3 v2.0 router for waterways

        Args:
            osm_file: Path to OSM PBF file (optional, will use LiveGraph/Overpass if not provided)
        """
        self.osm_file = osm_file
        self.graph = None
        self.enabled = PYROUTELIB_AVAILABLE

        if not self.enabled:
            print("⚠️ pyroutelib3 not available, routing disabled")
            return

        # Create waterway profile
        self.profile = WaterwayProfile()

        # Try to initialize graph with local PBF data
        if osm_file and os.path.exists(osm_file):
            try:
                # Use Graph with local PBF file
                self.graph = Graph(osm_file, self.profile)
                print(f"✅ PyRouteLib waterway router initialized with {osm_file}")
                self.enabled = True
            except Exception as e:
                print(f"⚠️ Could not initialize PyRouteLib with local file: {e}")
                print(f"   This is expected - PBF parsing is very slow. Using LiveGraph instead.")
                # Fall back to LiveGraph (Overpass API)
                try:
                    self.graph = LiveGraph(self.profile)
                    print("✅ PyRouteLib waterway router initialized (LiveGraph/Overpass mode)")
                    self.enabled = True
                except Exception as e2:
                    print(f"⚠️ Could not initialize PyRouteLib LiveGraph: {e2}")
                    self.enabled = False
        else:
            # Use LiveGraph (queries Overpass API on-demand)
            try:
                self.graph = LiveGraph(self.profile)
                print("✅ PyRouteLib waterway router initialized (LiveGraph/Overpass mode)")
                self.enabled = True
            except Exception as e:
                print(f"⚠️ Could not initialize PyRouteLib: {e}")
                self.enabled = False

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

    async def route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """
        Calculate route using pyroutelib3 v2.0

        Args:
            waypoints: List of (lon, lat) tuples

        Returns:
            GeoJSON Feature with route geometry and properties
        """
        if len(waypoints) < 2:
            return {"error": "Need at least 2 waypoints"}

        if not self.enabled or not self.graph:
            return self._direct_route(waypoints)

        try:
            # Route between consecutive waypoints
            all_coords = []
            total_distance = 0

            for i in range(len(waypoints) - 1):
                start_lon, start_lat = waypoints[i]
                end_lon, end_lat = waypoints[i + 1]

                # Find nearest nodes to start/end coordinates
                # Note: pyroutelib3 v2.0 uses (lat, lon) order!
                start_node_obj = self.graph.find_nearest_node((start_lat, start_lon))
                end_node_obj = self.graph.find_nearest_node((end_lat, end_lon))

                if start_node_obj is None or end_node_obj is None:
                    print(f"⚠️ PyRouteLib could not find nearby waterway nodes for segment {i+1}")
                    # Fall back to direct line for this segment
                    all_coords.append([start_lon, start_lat])
                    all_coords.append([end_lon, end_lat])
                    total_distance += self.haversine_distance(start_lon, start_lat, end_lon, end_lat)
                    continue

                # Extract node IDs for routing
                start_node_id = start_node_obj.id
                end_node_id = end_node_obj.id

                # Find route using A* algorithm
                try:
                    route_nodes = find_route(self.graph, start_node_id, end_node_id)

                    if route_nodes and len(route_nodes) > 0:
                        # Convert node IDs to coordinates
                        for node_id in route_nodes:
                            node_data = self.graph.get_node(node_id)
                            if node_data:
                                lat, lon = node_data.position  # position is (lat, lon)
                                all_coords.append([lon, lat])

                        # Calculate distance for this segment
                        for j in range(len(route_nodes) - 1):
                            node1 = self.graph.get_node(route_nodes[j])
                            node2 = self.graph.get_node(route_nodes[j + 1])
                            lat1, lon1 = node1.position  # position is (lat, lon)
                            lat2, lon2 = node2.position
                            total_distance += self.haversine_distance(lon1, lat1, lon2, lat2)

                        print(f"✅ PyRouteLib segment {i+1}: {len(route_nodes)} nodes, {total_distance/1852:.2f} NM")
                    else:
                        print(f"⚠️ PyRouteLib could not find waterway route for segment {i+1}")
                        # Fall back to direct line for this segment
                        all_coords.append([start_lon, start_lat])
                        all_coords.append([end_lon, end_lat])
                        total_distance += self.haversine_distance(start_lon, start_lat, end_lon, end_lat)

                except Exception as segment_error:
                    print(f"⚠️ PyRouteLib segment {i+1} error: {segment_error}")
                    # Fall back to direct line for this segment
                    all_coords.append([start_lon, start_lat])
                    all_coords.append([end_lon, end_lat])
                    total_distance += self.haversine_distance(start_lon, start_lat, end_lon, end_lat)

            if not all_coords:
                print("⚠️ No route found, using direct routing")
                return self._direct_route(waypoints)

            return {
                "type": "Feature",
                "geometry": {
                    "type": "LineString",
                    "coordinates": all_coords
                },
                "properties": {
                    "distance_m": total_distance,
                    "distance_nm": total_distance / 1852,
                    "waterway_routed": True,
                    "routing_type": "pyroutelib"
                }
            }

        except Exception as e:
            print(f"❌ PyRouteLib routing error: {e}")
            import traceback
            traceback.print_exc()
            return self._direct_route(waypoints)

    def _direct_route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """Fallback direct line routing (Rhumbline)"""
        route_coords = []
        total_distance = 0

        for i in range(len(waypoints) - 1):
            start_lon, start_lat = waypoints[i]
            end_lon, end_lat = waypoints[i + 1]

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
                "waterway_routed": False,
                "routing_type": "direct"
            }
        }
