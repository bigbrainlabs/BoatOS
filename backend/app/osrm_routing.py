"""
OSRM-based Waterway Routing
Fast routing using local OSRM server with custom waterway profile
"""
from typing import List, Tuple, Optional
import aiohttp
import asyncio
import math

class OSRMRouter:
    def __init__(self, osrm_url: str = "http://localhost:5000"):
        """
        Initialize OSRM router

        Args:
            osrm_url: URL of OSRM server (default: http://localhost:5000)
        """
        self.osrm_url = osrm_url.rstrip('/')
        self.enabled = False  # Will be set to True after health check

    async def check_health(self) -> bool:
        """Check if OSRM server is available"""
        try:
            async with aiohttp.ClientSession() as session:
                # OSRM doesn't have /health endpoint, test with a simple route request
                # Use Magdeburg coordinates as test point
                test_url = f"{self.osrm_url}/route/v1/driving/11.6167,52.1205;11.6267,52.1305?overview=false"
                async with session.get(
                    test_url,
                    timeout=aiohttp.ClientTimeout(total=3)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("code") == "Ok":
                            self.enabled = True
                            print(f"✅ OSRM server available at {self.osrm_url}")
                            return True
        except Exception as e:
            print(f"⚠️ OSRM server not available: {e}")

        self.enabled = False
        return False

    def _extract_infrastructure(self, route_data: dict) -> dict:
        """
        Extract locks, bridges and other infrastructure from OSRM route data

        Args:
            route_data: OSRM route response

        Returns:
            Dict with locks and bridges arrays
        """
        locks = []
        bridges = []
        distance_so_far = 0

        legs = route_data.get("legs", [])

        for leg in legs:
            steps = leg.get("steps", [])

            for step in steps:
                # Get step distance
                step_distance = step.get("distance", 0)

                # Get location
                maneuver = step.get("maneuver", {})
                location = maneuver.get("location", [])

                if len(location) == 2:
                    lon, lat = location

                    # Check for locks (marked as barriers in our profile)
                    # OSRM doesn't directly expose OSM tags, but we can infer from maneuver types
                    # In our motorboat.lua, locks are marked with result.barrier = true
                    # This would show up as restricted maneuvers

                    # For now, we'll look for specific instruction types
                    instruction = step.get("name", "").lower()
                    ref = step.get("ref", "").lower()

                    # Detect locks
                    if any(keyword in instruction for keyword in ["lock", "schleuse", "sluis", "écluse"]):
                        locks.append({
                            "name": step.get("name", "Unbekannte Schleuse"),
                            "lat": lat,
                            "lon": lon,
                            "distance_from_start": distance_so_far
                        })

                    # Detect bridges
                    if any(keyword in instruction for keyword in ["bridge", "brücke", "brug", "pont"]):
                        # Try to extract clearance from OSM data if available
                        clearance = None

                        bridges.append({
                            "name": step.get("name", "Unbekannte Brücke"),
                            "lat": lat,
                            "lon": lon,
                            "clearance": clearance,
                            "distance_from_start": distance_so_far
                        })

                distance_so_far += step_distance

        return {
            "locks": locks,
            "bridges": bridges
        }

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

    async def route(self, waypoints: List[Tuple[float, float]], boat_data: Optional[dict] = None) -> dict:
        """
        Calculate route using OSRM server

        Args:
            waypoints: List of (lon, lat) tuples
            boat_data: Optional boat specifications (draft, height, beam, etc.)

        Returns:
            GeoJSON Feature with route geometry and properties
        """
        if len(waypoints) < 2:
            return {"error": "Need at least 2 waypoints"}

        # Check OSRM health if not already checked
        if not self.enabled:
            await self.check_health()

        # If OSRM not available, fall back to direct routing
        if not self.enabled:
            return self._direct_route(waypoints)

        try:
            # Build OSRM route request
            # Format: /route/v1/driving/lon1,lat1;lon2,lat2?overview=full&geometries=geojson
            coordinates_str = ";".join([f"{lon},{lat}" for lon, lat in waypoints])
            url = f"{self.osrm_url}/route/v1/driving/{coordinates_str}"

            params = {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",  # Enable steps to get maneuver details
                "annotations": "true"  # Enable annotations for metadata
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status == 200:
                        data = await response.json()

                        if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                            route = data["routes"][0]

                            # Extract geometry and distance
                            geometry = route["geometry"]
                            distance_m = route["distance"]
                            duration_s = route.get("duration", 0)

                            # Extract infrastructure (locks, bridges)
                            infrastructure = self._extract_infrastructure(route)

                            # Log boat restrictions if provided
                            restrictions = []
                            if boat_data:
                                if boat_data.get("draft", 0) > 0:
                                    restrictions.append(f"Draft: {boat_data['draft']}m")
                                if boat_data.get("height", 0) > 0:
                                    restrictions.append(f"Height: {boat_data['height']}m")
                                if boat_data.get("beam", 0) > 0:
                                    restrictions.append(f"Beam: {boat_data['beam']}m")

                            print(f"✅ OSRM route: {distance_m/1852:.2f} NM, {duration_s/60:.1f} min")
                            if restrictions:
                                print(f"   Boat restrictions: {', '.join(restrictions)}")
                            if infrastructure["locks"]:
                                print(f"   Locks: {len(infrastructure['locks'])}")
                            if infrastructure["bridges"]:
                                print(f"   Bridges: {len(infrastructure['bridges'])}")

                            return {
                                "type": "Feature",
                                "geometry": geometry,
                                "properties": {
                                    "distance_m": distance_m,
                                    "distance_nm": distance_m / 1852,
                                    "duration_s": duration_s,
                                    "duration_h": duration_s / 3600,
                                    "waterway_routed": True,
                                    "routing_type": "osrm",
                                    "locks": infrastructure["locks"],
                                    "bridges": infrastructure["bridges"],
                                    "boat_restrictions": boat_data if boat_data else None
                                }
                            }
                        else:
                            print(f"⚠️ OSRM returned no routes: {data.get('code')}, using direct routing")
                            return self._direct_route(waypoints)

                    else:
                        error_text = await response.text()
                        print(f"⚠️ OSRM API error {response.status}: {error_text}")
                        return self._direct_route(waypoints)

        except asyncio.TimeoutError:
            print("⚠️ OSRM API timeout, using direct routing")
            return self._direct_route(waypoints)

        except Exception as e:
            print(f"❌ OSRM routing error: {e}")
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
