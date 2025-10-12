"""
GraphHopper API Integration for Waterway Routing
Fast, cloud-based routing with custom vehicle profiles
"""
from typing import List, Tuple, Optional
import aiohttp
import math

class GraphHopperRouter:
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize GraphHopper router

        Args:
            api_key: GraphHopper API key (get free key at https://graphhopper.com/)
                    If None, will fall back to direct routing
        """
        self.api_key = api_key
        self.base_url = "https://graphhopper.com/api/1/route"
        self.enabled = api_key is not None and api_key != ""

        if self.enabled:
            print(f"✅ GraphHopper router initialized with API key")
        else:
            print(f"⚠️ GraphHopper router initialized without API key (direct routing only)")

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
        Calculate route using GraphHopper API or fallback to direct routing

        Args:
            waypoints: List of (lon, lat) tuples

        Returns:
            GeoJSON Feature with route geometry and properties
        """
        if len(waypoints) < 2:
            return {"error": "Need at least 2 waypoints"}

        # If API key not configured, use direct routing
        if not self.enabled:
            return self._direct_route(waypoints)

        try:
            # Build GraphHopper API request with multiple point parameters
            # Format: point=lat,lon&point=lat,lon&vehicle=foot&points_encoded=false

            # Build URL with multiple 'point' parameters (can't use dict for duplicate keys)
            point_params = "&".join([f"point={lat},{lon}" for lon, lat in waypoints])
            url = f"{self.base_url}?key={self.api_key}&vehicle=foot&points_encoded=false&elevation=false&instructions=false&calc_points=true&{point_params}"

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()

                        if "paths" in data and len(data["paths"]) > 0:
                            path = data["paths"][0]

                            # Extract coordinates from GeoJSON
                            coordinates = path["points"]["coordinates"]
                            distance_m = path["distance"]

                            print(f"✅ GraphHopper route: {distance_m/1852:.2f} NM")

                            return {
                                "type": "Feature",
                                "geometry": {
                                    "type": "LineString",
                                    "coordinates": coordinates
                                },
                                "properties": {
                                    "distance_m": distance_m,
                                    "distance_nm": distance_m / 1852,
                                    "waterway_routed": True,
                                    "routing_type": "graphhopper",
                                    "time_ms": path.get("time", 0)
                                }
                            }
                        else:
                            print("⚠️ GraphHopper returned no paths, using direct routing")
                            return self._direct_route(waypoints)

                    elif response.status == 401:
                        print("❌ GraphHopper API key invalid")
                        self.enabled = False
                        return self._direct_route(waypoints)

                    elif response.status == 429:
                        print("⚠️ GraphHopper rate limit exceeded, using direct routing")
                        return self._direct_route(waypoints)

                    else:
                        error_text = await response.text()
                        print(f"⚠️ GraphHopper API error {response.status}: {error_text}")
                        return self._direct_route(waypoints)

        except asyncio.TimeoutError:
            print("⚠️ GraphHopper API timeout, using direct routing")
            return self._direct_route(waypoints)

        except Exception as e:
            print(f"❌ GraphHopper routing error: {e}")
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
