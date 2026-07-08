# -*- coding: utf-8 -*-
"""
Minimaler, dependency-freier Mapbox-Vector-Tile-Encoder (MVT 2.1).

Gegenstück zum MVT-Parser in water_current.py — hier wird encodiert statt
dekodiert. Bewusst ohne protobuf/shapely/mapbox-vector-tile implementiert,
damit auf dem Pi keine neuen Abhängigkeiten nötig sind (Distri-Image!).

Umfang: genau das, was die IENC-Pipeline (ienc.py) braucht —
GeoJSON-Geometrien in Tile-Koordinaten quantisieren, am Tile-Rand clippen
und als Tile-Protobuf mit mehreren Layern serialisieren.

Koordinatensystem: Tile-lokal, Y nach unten, Extent 4096. Exterior-Ringe
brauchen laut Spec positive Shoelace-Fläche, Löcher negative.
"""

import json
import math
import struct

EXTENT = 4096
BUFFER = 64  # Tile-Rand-Puffer in Tile-Einheiten (für Symbole/Linien am Rand)

# MVT-Geometrietypen
GEOM_POINT = 1
GEOM_LINESTRING = 2
GEOM_POLYGON = 3

# Protobuf-Kommandos
_CMD_MOVETO = 1
_CMD_LINETO = 2
_CMD_CLOSEPATH = 7


# ==================== PROTOBUF-PRIMITIVEN ====================

def _varint(v: int) -> bytes:
    out = bytearray()
    while True:
        b = v & 0x7F
        v >>= 7
        if v:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def _zigzag(v: int) -> int:
    # Funktioniert in Python für beliebige ints (arithmetischer Shift)
    return (v << 1) ^ (v >> 63)


def _tag(field: int, wire: int) -> bytes:
    return _varint((field << 3) | wire)


def _len_field(field: int, payload: bytes) -> bytes:
    return _tag(field, 2) + _varint(len(payload)) + payload


def _varint_field(field: int, v: int) -> bytes:
    return _tag(field, 0) + _varint(v)


def _encode_value(v) -> bytes:
    """Tile.Value — string(1), double(3), int64(4), bool(7)."""
    if isinstance(v, bool):
        return _varint_field(7, 1 if v else 0)
    if isinstance(v, int):
        # int64 als Varint; negative Werte werden 10 Bytes lang — selten, ok
        return _tag(4, 0) + _varint(v & 0xFFFFFFFFFFFFFFFF)
    if isinstance(v, float):
        return _tag(3, 1) + struct.pack("<d", v)
    return _len_field(1, str(v).encode("utf-8"))


# ==================== PROJEKTION & CLIPPING ====================

def project(lon: float, lat: float, z: int):
    """WGS84 → globale Tile-Koordinaten (Einheit: Tiles) bei Zoom z."""
    n = 1 << z
    x = (lon + 180.0) / 360.0 * n
    lat = max(-85.0511, min(85.0511, lat))
    lat_r = math.radians(lat)
    y = (1.0 - math.log(math.tan(lat_r) + 1.0 / math.cos(lat_r)) / math.pi) / 2.0 * n
    return x, y


def _to_local(coords, z, tx, ty):
    """[(lon,lat),...] → Tile-lokale Float-Koordinaten (Extent-Einheiten)."""
    out = []
    for lon, lat in coords:
        gx, gy = project(lon, lat, z)
        out.append(((gx - tx) * EXTENT, (gy - ty) * EXTENT))
    return out


def _clip_ring(ring, lo, hi):
    """Sutherland-Hodgman gegen das Rechteck [lo,hi]² (für Polygon-Ringe)."""
    def clip_edge(pts, inside, intersect):
        if not pts:
            return []
        out = []
        prev = pts[-1]
        prev_in = inside(prev)
        for cur in pts:
            cur_in = inside(cur)
            if cur_in:
                if not prev_in:
                    out.append(intersect(prev, cur))
                out.append(cur)
            elif prev_in:
                out.append(intersect(prev, cur))
            prev, prev_in = cur, cur_in
        return out

    def x_cross(p, q, x):
        t = (x - p[0]) / (q[0] - p[0])
        return (x, p[1] + t * (q[1] - p[1]))

    def y_cross(p, q, y):
        t = (y - p[1]) / (q[1] - p[1])
        return (p[0] + t * (q[0] - p[0]), y)

    pts = ring
    pts = clip_edge(pts, lambda p: p[0] >= lo, lambda p, q: x_cross(p, q, lo))
    pts = clip_edge(pts, lambda p: p[0] <= hi, lambda p, q: x_cross(p, q, hi))
    pts = clip_edge(pts, lambda p: p[1] >= lo, lambda p, q: y_cross(p, q, lo))
    pts = clip_edge(pts, lambda p: p[1] <= hi, lambda p, q: y_cross(p, q, hi))
    return pts


def _clip_line(coords, lo, hi):
    """Polyline am Rechteck clippen → Liste von Teilstücken (Liang-Barsky pro Segment)."""
    parts = []
    cur = []
    for i in range(len(coords) - 1):
        seg = _clip_segment(coords[i], coords[i + 1], lo, hi)
        if seg is None:
            if len(cur) >= 2:
                parts.append(cur)
            cur = []
            continue
        a, b = seg
        if cur and cur[-1] == a:
            cur.append(b)
        else:
            if len(cur) >= 2:
                parts.append(cur)
            cur = [a, b]
    if len(cur) >= 2:
        parts.append(cur)
    return parts


def _clip_segment(p, q, lo, hi):
    """Liang-Barsky: Segment p→q am Rechteck clippen (oder None)."""
    x0, y0 = p
    x1, y1 = q
    dx, dy = x1 - x0, y1 - y0
    t0, t1 = 0.0, 1.0
    for num, den in (
        (lo - x0, dx), (x0 - hi, -dx),
        (lo - y0, dy), (y0 - hi, -dy),
    ):
        if den == 0:
            if num > 0:
                return None
            continue
        t = num / den
        if den > 0:
            if t > t1:
                return None
            if t > t0:
                t0 = t
        else:
            if t < t0:
                return None
            if t < t1:
                t1 = t
    return ((x0 + t0 * dx, y0 + t0 * dy), (x0 + t1 * dx, y0 + t1 * dy))


def _shoelace(ring) -> float:
    a = 0.0
    for i in range(len(ring) - 1):
        a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return a / 2.0


def _quantize(coords):
    """Float-Koordinaten runden, aufeinanderfolgende Duplikate entfernen."""
    out = []
    for x, y in coords:
        pt = (round(x), round(y))
        if not out or out[-1] != pt:
            out.append(pt)
    return out


def clip_geometry(geojson_geom: dict, z: int, tx: int, ty: int):
    """
    GeoJSON-Geometrie für Tile (z,tx,ty) vorbereiten: projizieren, clippen,
    quantisieren. Rückgabe: (mvt_type, parts) oder None wenn nichts übrig.

    parts: Point → Liste von (x,y); LineString → Liste von Punktlisten;
    Polygon → Liste von Ringen (Exterior positiv, Löcher negativ orientiert).
    """
    gtype = geojson_geom.get("type")
    coords = geojson_geom.get("coordinates")
    if not gtype or coords is None:
        return None
    lo, hi = -BUFFER, EXTENT + BUFFER

    def strip_z(c):
        return (c[0], c[1])

    if gtype in ("Point", "MultiPoint"):
        pts = [coords] if gtype == "Point" else coords
        local = _to_local([strip_z(p) for p in pts], z, tx, ty)
        kept = [(round(x), round(y)) for x, y in local if lo <= x <= hi and lo <= y <= hi]
        # Duplikate nach Quantisierung entfernen
        kept = list(dict.fromkeys(kept))
        return (GEOM_POINT, kept) if kept else None

    if gtype in ("LineString", "MultiLineString"):
        lines = [coords] if gtype == "LineString" else coords
        parts = []
        for line in lines:
            local = _to_local([strip_z(p) for p in line], z, tx, ty)
            for piece in _clip_line(local, lo, hi):
                q = _quantize(piece)
                if len(q) >= 2:
                    parts.append(q)
        return (GEOM_LINESTRING, parts) if parts else None

    if gtype in ("Polygon", "MultiPolygon"):
        polys = [coords] if gtype == "Polygon" else coords
        parts = []
        for rings in polys:
            for ri, ring in enumerate(rings):
                local = _to_local([strip_z(p) for p in ring], z, tx, ty)
                clipped = _clip_ring(local, lo, hi)
                if len(clipped) < 3:
                    continue
                q = _quantize(clipped)
                # Ring schließen für Flächenberechnung, aber offen speichern
                if len(q) >= 2 and q[0] == q[-1]:
                    q = q[:-1]
                if len(q) < 3:
                    continue
                closed = q + [q[0]]
                area = _shoelace(closed)
                if area == 0:
                    continue
                want_positive = (ri == 0)  # Exterior positiv, Löcher negativ
                if (area > 0) != want_positive:
                    q.reverse()
                parts.append(q)
        return (GEOM_POLYGON, parts) if parts else None

    if gtype == "GeometryCollection":
        # Kommt in S-57-Exporten praktisch nicht vor — bewusst ignoriert
        return None
    return None


# ==================== GEOMETRIE-KOMMANDOS ====================

def _cmd(cmd_id: int, count: int) -> int:
    return (cmd_id & 0x7) | (count << 3)


def _encode_geometry(mvt_type: int, parts) -> bytes:
    ints = []
    px, py = 0, 0

    if mvt_type == GEOM_POINT:
        ints.append(_cmd(_CMD_MOVETO, len(parts)))
        for x, y in parts:
            ints.append(_zigzag(x - px))
            ints.append(_zigzag(y - py))
            px, py = x, y
    elif mvt_type == GEOM_LINESTRING:
        for line in parts:
            ints.append(_cmd(_CMD_MOVETO, 1))
            ints.append(_zigzag(line[0][0] - px))
            ints.append(_zigzag(line[0][1] - py))
            px, py = line[0]
            ints.append(_cmd(_CMD_LINETO, len(line) - 1))
            for x, y in line[1:]:
                ints.append(_zigzag(x - px))
                ints.append(_zigzag(y - py))
                px, py = x, y
    elif mvt_type == GEOM_POLYGON:
        for ring in parts:
            ints.append(_cmd(_CMD_MOVETO, 1))
            ints.append(_zigzag(ring[0][0] - px))
            ints.append(_zigzag(ring[0][1] - py))
            px, py = ring[0]
            ints.append(_cmd(_CMD_LINETO, len(ring) - 1))
            for x, y in ring[1:]:
                ints.append(_zigzag(x - px))
                ints.append(_zigzag(y - py))
                px, py = x, y
            ints.append(_cmd(_CMD_CLOSEPATH, 1))

    return b"".join(_varint(i) for i in ints)


# ==================== TILE-ENCODING ====================

def encode_tile(layers: dict) -> bytes:
    """
    Tile serialisieren. layers: {layer_name: [(mvt_type, parts, props), ...]}
    mit parts wie von clip_geometry() geliefert.
    """
    out = bytearray()
    for name, features in layers.items():
        if not features:
            continue
        keys = []          # key → index
        key_idx = {}
        values = []        # encodierte Value-Bytes
        value_idx = {}     # (typname, wert) → index
        feat_bufs = []

        for mvt_type, parts, props in features:
            tags = []
            for k, v in props.items():
                if v is None:
                    continue
                if isinstance(v, (list, tuple)):
                    # S-57-Listen-Attribute (z.B. dirimp) → "1,2" statt Python-Repr,
                    # damit MapLibre-Filter darauf matchen können
                    v = ",".join(str(e) for e in v)
                elif isinstance(v, dict):
                    v = json.dumps(v, ensure_ascii=False)
                ki = key_idx.get(k)
                if ki is None:
                    ki = len(keys)
                    key_idx[k] = ki
                    keys.append(k)
                vk = (type(v).__name__, v)
                vi = value_idx.get(vk)
                if vi is None:
                    vi = len(values)
                    value_idx[vk] = vi
                    values.append(_encode_value(v))
                tags.append(ki)
                tags.append(vi)

            geom = _encode_geometry(mvt_type, parts)
            fb = bytearray()
            if tags:
                fb += _len_field(2, b"".join(_varint(t) for t in tags))
            fb += _varint_field(3, mvt_type)
            fb += _len_field(4, geom)
            feat_bufs.append(bytes(fb))

        layer = bytearray()
        layer += _varint_field(15, 2)  # version
        layer += _len_field(1, name.encode("utf-8"))
        for fb in feat_bufs:
            layer += _len_field(2, fb)
        for k in keys:
            layer += _len_field(3, k.encode("utf-8"))
        for vb in values:
            layer += _len_field(4, vb)
        layer += _varint_field(5, EXTENT)

        out += _len_field(3, bytes(layer))
    return bytes(out)
