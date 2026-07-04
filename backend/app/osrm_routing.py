"""
OSRM-based Waterway Routing
Fast routing using local OSRM server with custom waterway profile
"""
from typing import List, Tuple, Optional, Dict
import aiohttp
import asyncio
import math
import heapq
import sqlite3
from pathlib import Path
from collections import defaultdict

class OSRMRouter:
    def __init__(self, osrm_url: str = "http://127.0.0.1:5000"):
        """
        Initialize OSRM router

        Args:
            osrm_url: URL of OSRM server (default: http://localhost:5000)
        """
        self.osrm_url = osrm_url.rstrip('/')
        self.enabled = False  # Will be set to True after health check

    async def check_health(self, timeout: int = 60) -> bool:
        """Check if OSRM server is available"""
        try:
            async with aiohttp.ClientSession() as session:
                # OSRM doesn't have /health endpoint, test with a simple route request
                # Use Magdeburg coordinates as test point
                test_url = f"{self.osrm_url}/route/v1/driving/11.6167,52.1205;11.6267,52.1305?overview=false"
                async with session.get(
                    test_url,
                    timeout=aiohttp.ClientTimeout(total=timeout)
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

    def _extract_waterway_steps(self, route_data: dict) -> list:
        """Extract [(name, distance_m)] from OSRM steps — gives actual OSM waterway names."""
        result = []
        for leg in route_data.get("legs", []):
            for step in leg.get("steps", []):
                name = (step.get("name") or "").strip()
                dist = step.get("distance", 0)
                if name and dist > 50:
                    result.append((name, dist))
        return result

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
            # Snap waypoints to nearest waterway node before routing
            snapped = await self._snap_waypoints(waypoints)

            # Build OSRM route request
            # Format: /route/v1/driving/lon1,lat1;lon2,lat2?overview=full&geometries=geojson
            coordinates_str = ";".join([f"{lon},{lat}" for lon, lat in snapped])
            url = f"{self.osrm_url}/route/v1/driving/{coordinates_str}"

            # radiuses=unlimited lets OSRM snap each waypoint to the nearest
            # waterway node regardless of distance (prevents NoSegment errors
            # when a WP is placed away from the waterway network)
            radiuses = ";".join(["unlimited"] * len(snapped))
            params = {
                "overview": "full",
                "geometries": "geojson",
                "steps": "true",
                "annotations": "true",
                "radiuses": radiuses
            }

            async with aiohttp.ClientSession() as session:
                async with session.get(
                    url,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=30)
                ) as response:
                    if response.status == 200:
                        data = await response.json()

                        if data.get("code") == "Ok" and "routes" in data and len(data["routes"]) > 0:
                            route = data["routes"][0]

                            # Extract geometry and distance
                            geometry = route["geometry"]
                            distance_m = route["distance"]
                            duration_s = route.get("duration", 0)

                            # Check if route is valid (distance > 0)
                            # OSRM returns distance=0 when coordinates are outside loaded map data
                            if distance_m == 0:
                                print(f"⚠️ OSRM returned distance=0 (coordinates outside map data)")
                                return self._direct_route(waypoints)

                            # Detect partial route: OSRM snaps the destination to the nearest
                            # known waterway node when the destination is outside the loaded
                            # map region (e.g. Netherlands when only Germany is loaded).
                            # If the route endpoint is far from the intended destination,
                            # extend with a straight-line segment so the route reaches the goal.
                            partial_route = False
                            partial_gap_km = 0.0
                            route_coords = geometry.get("coordinates", [])
                            if route_coords and len(waypoints) >= 2:
                                last_pt = route_coords[-1]  # [lon, lat]
                                dest = waypoints[-1]        # (lon, lat)
                                gap_m = self.haversine_distance(last_pt[0], last_pt[1], dest[0], dest[1])
                                if gap_m > 5000:  # > 5 km gap → OSRM didn't reach destination
                                    partial_route = True
                                    partial_gap_km = gap_m / 1000
                                    print(f"⚠️ OSRM partial route: {partial_gap_km:.1f} km gap to destination — extending with direct line")
                                    geometry["coordinates"].append([dest[0], dest[1]])
                                    distance_m += gap_m

                            # Extract infrastructure (locks, bridges) + waterway names
                            infrastructure = self._extract_infrastructure(route)
                            waterway_steps = self._extract_waterway_steps(route)

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
                                    "waterway_steps": waterway_steps,
                                    "boat_restrictions": boat_data if boat_data else None,
                                    "partial_route": partial_route,
                                    "partial_gap_km": round(partial_gap_km, 1) if partial_route else None,
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

    async def _snap_waypoints(self, waypoints: List[Tuple[float, float]]) -> List[Tuple[float, float]]:
        """
        Snap each waypoint to the nearest node on the waterway network using OSRM /nearest.
        Falls back to original coordinate if snapping fails or snapped point is > 5km away.
        """
        snapped = []
        MAX_SNAP_DIST_M = 5000  # ignore snaps further than 5km

        async with aiohttp.ClientSession() as session:
            for lon, lat in waypoints:
                try:
                    url = f"{self.osrm_url}/nearest/v1/driving/{lon},{lat}?number=1"
                    async with session.get(url, timeout=aiohttp.ClientTimeout(total=3)) as resp:
                        if resp.status == 200:
                            data = await resp.json()
                            if data.get("code") == "Ok" and data.get("waypoints"):
                                wp = data["waypoints"][0]
                                snap_lon, snap_lat = wp["location"]
                                dist = wp.get("distance", MAX_SNAP_DIST_M + 1)
                                if dist <= MAX_SNAP_DIST_M:
                                    snapped.append((snap_lon, snap_lat))
                                    if dist > 100:
                                        print(f"📍 Snapped WP ({lat:.4f},{lon:.4f}) → ({snap_lat:.4f},{snap_lon:.4f}) dist={dist:.0f}m")
                                    continue
                except Exception:
                    pass
                snapped.append((lon, lat))  # fallback: original coordinate

        return snapped

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


class BrouterRouter:
    """Online waterway routing via brouter.de (rivers profile). No API key required."""

    URL = "https://brouter.de/brouter"
    PROFILE = "rivers"

    async def route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """
        Route via Brouter online API.
        waypoints: list of (lon, lat) tuples
        Returns same structure as OSRMRouter.route(), or dict with 'error' key on failure.
        """
        lonlats = "|".join(f"{lon},{lat}" for lon, lat in waypoints)
        params = {
            "lonlats": lonlats,
            "profile": self.PROFILE,
            "alternativeidx": "0",
            "format": "geojson",
        }
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    self.URL,
                    params=params,
                    timeout=aiohttp.ClientTimeout(total=20)
                ) as response:
                    if response.status != 200:
                        text = await response.text()
                        print(f"⚠️ Brouter API HTTP {response.status}: {text[:200]}")
                        return {"error": f"Brouter HTTP {response.status}"}

                    data = await response.json(content_type=None)
                    features = data.get("features", [])
                    if not features:
                        return {"error": "Brouter returned no route features"}

                    feature = features[0]
                    geometry = feature.get("geometry", {})
                    props = feature.get("properties", {})

                    distance_m = float(props.get("track-length", 0))
                    duration_s = float(props.get("total-time", 0))

                    if distance_m == 0:
                        return {"error": "Brouter returned zero-distance route"}

                    print(f"✅ Brouter route: {distance_m/1852:.2f} NM, {duration_s/60:.1f} min")

                    return {
                        "type": "Feature",
                        "geometry": geometry,
                        "properties": {
                            "distance_m": distance_m,
                            "distance_nm": distance_m / 1852,
                            "duration_s": duration_s,
                            "duration_h": duration_s / 3600,
                            "waterway_routed": True,
                            "routing_type": "brouter",
                            "locks": [],
                            "bridges": [],
                            "partial_route": False,
                        }
                    }

        except asyncio.TimeoutError:
            print("⚠️ Brouter API timeout after 20s")
            return {"error": "Brouter timeout"}
        except Exception as e:
            print(f"❌ Brouter routing error: {e}")
            return {"error": str(e)}


class WaterwayGraphRouter:
    """A* routing on .routing SQLite graphs built by the MBTiles Creator."""

    CELL = 0.1  # degrees per spatial grid cell

    def __init__(self, routing_dir: Path):
        self.routing_dir = Path(routing_dir)
        self._adj: Dict[int, List[Tuple[int, float]]] = {}
        self._coords: Dict[int, Tuple[float, float]] = {}
        self._spatial: Dict[Tuple[int, int], List[int]] = defaultdict(list)
        self._loaded: List[str] = []

    def load_all(self):
        self._adj.clear()
        self._coords.clear()
        self._spatial.clear()
        self._loaded.clear()
        if not self.routing_dir.exists():
            return
        for rf in sorted(self.routing_dir.glob("*.routing")):
            self._load_file(rf)

    def _load_file(self, path: Path):
        try:
            con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, check_same_thread=False)
            for nid, lat, lon in con.execute("SELECT id, lat, lon FROM nodes"):
                self._coords[nid] = (lat, lon)
                cx, cy = int(lon / self.CELL), int(lat / self.CELL)
                self._spatial[(cx, cy)].append(nid)
            for fn, tn, dist in con.execute("SELECT from_node, to_node, distance_m FROM edges"):
                self._adj.setdefault(fn, []).append((tn, float(dist)))
            con.close()
            self._loaded.append(path.stem)
            print(f"✅ Routing graph '{path.stem}': {len(self._coords)} nodes")
        except Exception as e:
            print(f"⚠️ Failed to load {path.name}: {e}")

    @property
    def enabled(self) -> bool:
        return bool(self._loaded)

    def _hav(self, lat1, lon1, lat2, lon2) -> float:
        R = 6371000.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
        return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    def _snap(self, lat: float, lon: float, max_m: float = 15000) -> Optional[int]:
        cx, cy = int(lon / self.CELL), int(lat / self.CELL)
        best_id, best_d = None, max_m
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                for nid in self._spatial.get((cx + dx, cy + dy), []):
                    nlat, nlon = self._coords[nid]
                    d = self._hav(lat, lon, nlat, nlon)
                    if d < best_d:
                        best_d = d
                        best_id = nid
        return best_id

    def _astar(self, start: int, goal: int) -> Tuple[Optional[List[int]], float]:
        if start == goal:
            return [start], 0.0
        if start not in self._coords or goal not in self._coords:
            return None, 0.0
        glat, glon = self._coords[goal]
        open_set: List[Tuple[float, int]] = [(0.0, start)]
        came_from: Dict[int, int] = {}
        g: Dict[int, float] = {start: 0.0}
        visited: set = set()
        while open_set:
            _, cur = heapq.heappop(open_set)
            if cur in visited:
                continue
            visited.add(cur)
            if cur == goal:
                path = []
                while cur in came_from:
                    path.append(cur)
                    cur = came_from[cur]
                path.append(start)
                path.reverse()
                return path, g[goal]
            for nb, dist in self._adj.get(cur, []):
                ng = g.get(cur, math.inf) + dist
                if ng < g.get(nb, math.inf):
                    came_from[nb] = cur
                    g[nb] = ng
                    nlat, nlon = self._coords.get(nb, (glat, glon))
                    heapq.heappush(open_set, (ng + self._hav(nlat, nlon, glat, glon), nb))
        return None, 0.0

    async def route(self, waypoints: List[Tuple[float, float]]) -> dict:
        if not self.enabled:
            return {"error": "no_routing_graphs"}
        snapped = []
        for lon, lat in waypoints:
            nid = self._snap(lat, lon)
            if nid is None:
                return {"error": f"no_coverage:{lat:.4f},{lon:.4f}"}
            snapped.append(nid)
        coords: List[List[float]] = []
        total_m = 0.0
        for i in range(len(snapped) - 1):
            path, dist = self._astar(snapped[i], snapped[i + 1])
            if path is None:
                return {"error": f"no_path_segment_{i}"}
            seg = [[self._coords[n][1], self._coords[n][0]] for n in path]
            if coords:
                seg = seg[1:]
            coords.extend(seg)
            total_m += dist
        if coords:
            coords[0] = list(waypoints[0])
            coords[-1] = list(waypoints[-1])
        speed_ms = 10 * 1000 / 3600
        return {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "distance_m": total_m,
                "distance_nm": total_m / 1852,
                "duration_s": total_m / speed_ms,
                "duration_h": total_m / speed_ms / 3600,
                "waterway_routed": True,
                "routing_type": "python_graph",
                "locks": [],
                "bridges": [],
                "partial_route": False,
            },
        }
