"""
Waterway Routing using ENC data
Uses A* pathfinding on waterway network extracted from ENC charts
"""
import json
import math
from pathlib import Path
from typing import List, Tuple, Optional
import heapq

class WaterwayRouter:
    def __init__(self, charts_dir: Path):
        self.charts_dir = charts_dir
        self.waterway_network = []
        self.load_waterway_network()

    def load_waterway_network(self):
        """Load waterway geometries directly from ENC .000 files using GDAL"""
        try:
            from osgeo import ogr
        except ImportError:
            print("⚠️ GDAL/OGR not available, waterway routing disabled")
            return

        enc_dirs = list(self.charts_dir.glob("enc_*"))

        for enc_dir in enc_dirs:
            enc_files = list(enc_dir.rglob("*.000"))
            for enc_file in enc_files:
                try:
                    # Open S-57 ENC file
                    datasource = ogr.Open(str(enc_file))
                    if not datasource:
                        continue

                    # Iterate through all layers in the S-57 file
                    for layer_idx in range(datasource.GetLayerCount()):
                        layer = datasource.GetLayerByIndex(layer_idx)
                        layer_name = layer.GetName()

                        # Only process waterway-related layers
                        # FAIRWY = Fairway, RCRTCL = Recommended Track, DWRTCL = Deep Water Route
                        if layer_name in ['FAIRWY', 'RCRTCL', 'DWRTCL', 'CANALS', 'RIVBNK']:
                            for feature in layer:
                                geom = feature.GetGeometryRef()
                                if geom:
                                    geom_type = geom.GetGeometryName()

                                    if geom_type == 'LINESTRING':
                                        coords = []
                                        for i in range(geom.GetPointCount()):
                                            x, y = geom.GetX(i), geom.GetY(i)
                                            coords.append([x, y])
                                        if len(coords) > 1:
                                            self.waterway_network.append(coords)

                                    elif geom_type == 'MULTILINESTRING':
                                        for sub_geom_idx in range(geom.GetGeometryCount()):
                                            line = geom.GetGeometryRef(sub_geom_idx)
                                            coords = []
                                            for i in range(line.GetPointCount()):
                                                x, y = line.GetX(i), line.GetY(i)
                                                coords.append([x, y])
                                            if len(coords) > 1:
                                                self.waterway_network.append(coords)

                    datasource = None  # Close file
                except Exception as e:
                    print(f"⚠️ Error loading {enc_file.name}: {e}")

        print(f"📊 Loaded {len(self.waterway_network)} waterway segments")

    def _is_navigable_waterway(self, props: dict) -> bool:
        """Check if feature is a navigable waterway"""
        # ENC property keys that indicate waterways
        # OBJL (Object Label): 42 = Fairway, 43 = Canal, etc.
        objl = props.get('OBJL', '')
        catcnl = props.get('CATCNL', '')  # Category of canal

        # Include fairways, canals, recommended tracks
        navigable_objects = ['42', '43', '12', 'FAIRWY', 'CANALS', 'RCRTCL']

        return any(obj in str(objl) or obj in str(catcnl) for obj in navigable_objects)

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

    def find_nearest_point_on_waterway(self, lon: float, lat: float) -> Optional[Tuple[float, float]]:
        """Find nearest point on waterway network"""
        min_dist = float('inf')
        nearest_point = None

        for segment in self.waterway_network:
            for point in segment:
                if len(point) >= 2:
                    dist = self.haversine_distance(lon, lat, point[0], point[1])
                    if dist < min_dist:
                        min_dist = dist
                        nearest_point = (point[0], point[1])

        return nearest_point if min_dist < 1000 else None  # Max 1km snap distance

    def route(self, waypoints: List[Tuple[float, float]]) -> dict:
        """
        Calculate route through waterways
        Returns simplified route following waterway network
        """
        if len(waypoints) < 2:
            return {"error": "Need at least 2 waypoints"}

        # For now, implement simple waterway-snapped routing
        # Future: Implement A* pathfinding on waterway graph

        route_coords = []
        total_distance = 0

        for i in range(len(waypoints) - 1):
            start = waypoints[i]
            end = waypoints[i + 1]

            # Snap to nearest waterway
            start_snapped = self.find_nearest_point_on_waterway(start[0], start[1])
            end_snapped = self.find_nearest_point_on_waterway(end[0], end[1])

            if start_snapped and end_snapped:
                # Find waterway segment connecting these points
                segment = self._find_connecting_segment(start_snapped, end_snapped)
                if segment:
                    route_coords.extend(segment)
                    # Calculate segment distance
                    for j in range(len(segment) - 1):
                        total_distance += self.haversine_distance(
                            segment[j][0], segment[j][1],
                            segment[j+1][0], segment[j+1][1]
                        )
                else:
                    # No waterway connection found, use direct line
                    route_coords.extend([start, end])
                    total_distance += self.haversine_distance(start[0], start[1], end[0], end[1])
            else:
                # Fallback to direct line
                route_coords.extend([start, end])
                total_distance += self.haversine_distance(start[0], start[1], end[0], end[1])

        return {
            "type": "Feature",
            "geometry": {
                "type": "LineString",
                "coordinates": route_coords
            },
            "properties": {
                "distance_m": total_distance,
                "distance_nm": total_distance / 1852,
                "waterway_routed": len(route_coords) > len(waypoints)
            }
        }

    def _find_connecting_segment(self, start: Tuple[float, float], end: Tuple[float, float]) -> Optional[List]:
        """Find waterway segment that connects two points"""
        # Simple implementation: find segment containing both points nearby
        threshold = 0.001  # ~100m

        for segment in self.waterway_network:
            start_in = any(
                abs(p[0] - start[0]) < threshold and abs(p[1] - start[1]) < threshold
                for p in segment
            )
            end_in = any(
                abs(p[0] - end[0]) < threshold and abs(p[1] - end[1]) < threshold
                for p in segment
            )

            if start_in and end_in:
                # Find subsegment between start and end
                start_idx = None
                end_idx = None

                for i, p in enumerate(segment):
                    if abs(p[0] - start[0]) < threshold and abs(p[1] - start[1]) < threshold:
                        start_idx = i
                    if abs(p[0] - end[0]) < threshold and abs(p[1] - end[1]) < threshold:
                        end_idx = i

                if start_idx is not None and end_idx is not None:
                    if start_idx < end_idx:
                        return segment[start_idx:end_idx+1]
                    else:
                        return list(reversed(segment[end_idx:start_idx+1]))

        return None
