"""
OSM-based Waterway Routing using NetworkX and Overpass API
Provides A* pathfinding on waterway network from OpenStreetMap data
"""
from typing import List, Tuple, Optional, Dict
import math
import asyncio
import aiohttp
import networkx as nx
from collections import defaultdict
import json
import os
import time

class OSMWaterwayRouter:
    def __init__(self, cache_dir: str = "./osm_cache"):
        """Initialize OSM Waterway Router with local caching"""
        self.cache_dir = cache_dir
        self.graph_cache: Dict[str, nx.DiGraph] = {}  # Region-based graph cache
        self.cache_ttl = 86400  # Cache for 24 hours

        # Create cache directory if it doesn't exist
        os.makedirs(cache_dir, exist_ok=True)

        # Overpass API endpoints (with fallback)
        self.overpass_endpoints = [
            "https://overpass-api.de/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter",
            "https://z.overpass-api.de/api/interpreter"
        ]

        print("✅ OSM Waterway Router initialized with cache")

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

    def get_region_key(self, lat: float, lon: float, radius_km: float = 10) -> str:
        """Generate a cache key for a geographic region"""
        # Round to nearest 0.1 degree (~11km) for caching
        lat_rounded = round(lat * 10) / 10
        lon_rounded = round(lon * 10) / 10
        return f"region_{lat_rounded}_{lon_rounded}_{radius_km}"

    async def fetch_waterway_data(self, center_lat: float, center_lon: float, radius_km: float = 10) -> dict:
        """Fetch waterway data from Overpass API"""
        # Create Overpass QL query for waterways
        radius_m = radius_km * 1000
        query = f"""
        [out:json][timeout:25];
        (
          way["waterway"~"river|canal|stream|fairway"](around:{radius_m},{center_lat},{center_lon});
        );
        out body;
        >;
        out skel qt;
        """

        # Try different Overpass endpoints
        for endpoint in self.overpass_endpoints:
            try:
                async with aiohttp.ClientSession() as session:
                    async with session.post(
                        endpoint,
                        data={"data": query},
                        timeout=aiohttp.ClientTimeout(total=30)
                    ) as response:
                        if response.status == 200:
                            data = await response.json()
                            print(f"✅ Fetched waterway data from Overpass API ({len(data.get('elements', []))} elements)")
                            return data
                        else:
                            print(f"⚠️ Overpass API returned status {response.status}")
            except asyncio.TimeoutError:
                print(f"⚠️ Timeout fetching from {endpoint}")
            except Exception as e:
                print(f"⚠️ Error fetching from {endpoint}: {e}")

        # If all endpoints fail, return empty data
        print("❌ Failed to fetch data from all Overpass endpoints")
        return {"elements": []}

    def build_graph_from_osm(self, osm_data: dict) -> nx.DiGraph:
        """Build NetworkX directed graph from OSM data"""
        G = nx.DiGraph()

        # Parse nodes
        nodes = {}
        for element in osm_data.get("elements", []):
            if element.get("type") == "node":
                node_id = element["id"]
                lat = element["lat"]
                lon = element["lon"]
                nodes[node_id] = (lat, lon)
                G.add_node(node_id, lat=lat, lon=lon)

        # Parse ways (waterways)
        for element in osm_data.get("elements", []):
            if element.get("type") == "way":
                way_nodes = element.get("nodes", [])
                tags = element.get("tags", {})
                waterway_type = tags.get("waterway", "unknown")

                # Add edges between consecutive nodes
                for i in range(len(way_nodes) - 1):
                    node_a = way_nodes[i]
                    node_b = way_nodes[i + 1]

                    if node_a in nodes and node_b in nodes:
                        lat_a, lon_a = nodes[node_a]
                        lat_b, lon_b = nodes[node_b]

                        # Calculate edge weight (distance)
                        distance = self.haversine_distance(lon_a, lat_a, lon_b, lat_b)

                        # Add bidirectional edges for most waterways
                        # (rivers might be one-way in the future with flow direction)
                        G.add_edge(node_a, node_b, weight=distance, waterway=waterway_type)
                        G.add_edge(node_b, node_a, weight=distance, waterway=waterway_type)

        print(f"📊 Built graph: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges")
        return G

    async def get_or_build_graph(self, lat: float, lon: float, radius_km: float = 10) -> nx.DiGraph:
        """Get cached graph or build new one"""
        region_key = self.get_region_key(lat, lon, radius_km)
        cache_file = os.path.join(self.cache_dir, f"{region_key}.json")

        # Check if cache exists and is valid
        if os.path.exists(cache_file):
            file_age = time.time() - os.path.getmtime(cache_file)
            if file_age < self.cache_ttl:
                # Load from cache
                try:
                    with open(cache_file, 'r') as f:
                        osm_data = json.load(f)
                    print(f"✅ Loaded OSM data from cache ({region_key})")
                    return self.build_graph_from_osm(osm_data)
                except Exception as e:
                    print(f"⚠️ Error loading cache: {e}")

        # Fetch new data from Overpass API
        osm_data = await self.fetch_waterway_data(lat, lon, radius_km)

        # Save to cache
        try:
            with open(cache_file, 'w') as f:
                json.dump(osm_data, f)
            print(f"💾 Saved OSM data to cache ({region_key})")
        except Exception as e:
            print(f"⚠️ Error saving cache: {e}")

        return self.build_graph_from_osm(osm_data)

    def find_nearest_node(self, G: nx.DiGraph, lat: float, lon: float) -> Optional[int]:
        """Find nearest graph node to given coordinates"""
        min_distance = float('inf')
        nearest_node = None

        for node, data in G.nodes(data=True):
            node_lat = data.get('lat')
            node_lon = data.get('lon')
            if node_lat is not None and node_lon is not None:
                distance = self.haversine_distance(lon, lat, node_lon, node_lat)
                if distance < min_distance:
                    min_distance = distance
                    nearest_node = node

        return nearest_node

    async def route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """
        Calculate route using OSM waterway network
        Falls back to direct routing if OSM routing fails
        """
        if len(waypoints) < 2:
            return {"error": "Need at least 2 waypoints"}

        # Calculate bounding box center for graph fetching
        lats = [wp[1] for wp in waypoints]
        lons = [wp[0] for wp in waypoints]
        center_lat = sum(lats) / len(lats)
        center_lon = sum(lons) / len(lons)

        # Calculate radius (distance from center to farthest waypoint + buffer)
        max_distance = 0
        for lon, lat in waypoints:
            dist = self.haversine_distance(center_lon, center_lat, lon, lat)
            max_distance = max(max_distance, dist)

        radius_km = (max_distance / 1000) + 5  # Add 5km buffer

        try:
            # Get or build OSM graph for region
            G = await self.get_or_build_graph(center_lat, center_lon, radius_km)

            if G.number_of_nodes() == 0:
                print("⚠️ No waterway nodes found, falling back to direct routing")
                return self._direct_route(waypoints)

            # Find nearest nodes for all waypoints
            waypoint_nodes = []
            for lon, lat in waypoints:
                nearest = self.find_nearest_node(G, lat, lon)
                if nearest is None:
                    print(f"⚠️ No node found near ({lat}, {lon}), falling back to direct routing")
                    return self._direct_route(waypoints)
                waypoint_nodes.append(nearest)

            # Route between consecutive waypoint nodes using A*
            route_coords = []
            total_distance = 0

            for i in range(len(waypoint_nodes) - 1):
                start_node = waypoint_nodes[i]
                end_node = waypoint_nodes[i + 1]

                try:
                    # A* pathfinding on waterway graph
                    path = nx.astar_path(
                        G,
                        start_node,
                        end_node,
                        heuristic=lambda n1, n2: self.haversine_distance(
                            G.nodes[n1]['lon'], G.nodes[n1]['lat'],
                            G.nodes[n2]['lon'], G.nodes[n2]['lat']
                        ),
                        weight='weight'
                    )

                    # Convert path to coordinates
                    for node in path:
                        lat = G.nodes[node]['lat']
                        lon = G.nodes[node]['lon']
                        route_coords.append([lon, lat])

                    # Calculate segment distance
                    for j in range(len(path) - 1):
                        n1, n2 = path[j], path[j + 1]
                        total_distance += G[n1][n2]['weight']

                except nx.NetworkXNoPath:
                    print(f"⚠️ No path found between waypoints {i} and {i+1}, using direct line")
                    # Fallback to direct line for this segment
                    start_lon, start_lat = waypoints[i]
                    end_lon, end_lat = waypoints[i + 1]
                    route_coords.append([start_lon, start_lat])
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
                    "waterway_routed": True,
                    "routing_type": "waterway"
                }
            }

        except Exception as e:
            print(f"❌ OSM routing error: {e}")
            return self._direct_route(waypoints)

    def _direct_route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """Fallback direct line routing"""
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
