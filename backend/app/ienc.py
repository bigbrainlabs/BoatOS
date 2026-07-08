# -*- coding: utf-8 -*-
"""
Inland-ENC (IENC) Pipeline: ELWIS-Download + S-57 → GeoJSON-Extraktion.

Alle Funktionen hier sind BLOCKING (requests, GDAL) und müssen aus der
FastAPI-Event-Loop heraus mit asyncio.to_thread() aufgerufen werden.

Pipeline pro Gewässer:
  1. scrape_catalog()      — verfügbare Gewässer von ELWIS auflisten
  2. download_waterway()   — ZIP laden, .000-Zellen extrahieren
  3. extract_geojson()     — S-57 → GeoJSON pro Objektklasse (mit Attributen!)
                             + manifest.json (Zellen, Edition, Bounds, Zähler)

Die GeoJSON-Dateien landen in <chart_dir>/geojson/<klasse>.geojson und sind
über den bestehenden Static-Mount /charts/<chart_id>/geojson/... abrufbar.
Phase 2 baut daraus Vektor-Tiles; die Gruppen in IENC_CLASSES definieren
die späteren Source-Layer.
"""

import gzip
import json
import os
import shutil
import sqlite3
import zipfile
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

import mvt

ELWIS_BASE_URL = "https://www.elwis.de"
IENC_URL = "https://www.elwis.de/DE/dynamisch/IENC/"

# S-57/IENC-Objektklassen, die extrahiert werden — gruppiert nach späterem
# Vektor-Tile-Source-Layer. Standard-S-57-Klassen sind GROSS geschrieben,
# Inland-Erweiterungen (IENC-Spezifikation) klein. Der Vergleich läuft
# case-insensitiv, da GDAL die Layer-Namen aus den CSV-Katalogen übernimmt.
IENC_CLASSES = {
    # Tiefen — Flächen mit DRVAL1/DRVAL2, Konturen, Einzellotungen
    "depth": ["DEPARE", "DRGARE", "DEPCNT", "SOUNDG"],
    # Fahrrinne & Wasserstraßen-Achse, Kilometrierung, Pegel
    "fairway": ["FAIRWY", "NAVLNE", "RECTRC", "wtwaxs", "dismar", "wtwgag"],
    # Bauwerke: Brücken (verclr!), Freileitungen (cblohd), Wehre, Tore,
    # Schleusenbecken, Uferbauwerke, Pontons
    "structures": ["BRIDGE", "CBLOHD", "PIPOHD", "DAMCON", "GATCON",
                   "lokbsn", "SLCONS", "PONTON", "FLODOC", "HULKES"],
    # Gefahren: Hindernisse, Wracks, Steine, Fährstrecken (Seilfähren!),
    # Vorsichts- und Sperrgebiete
    "hazards": ["OBSTRN", "WRECKS", "UWTROC", "FERYRT", "CTNARE", "RESARE"],
    # Schifffahrtszeichen: Betonnung, Baken, Lichter, Tafelzeichen (notmrk =
    # CEVNI-Binnenschifffahrtszeichen), Signalstellen
    "marks": ["BOYLAT", "BOYCAR", "BOYISD", "BOYSAW", "BOYSPP",
              "BCNLAT", "BCNCAR", "BCNISD", "BCNSAW", "BCNSPP",
              "DAYMAR", "TOPMAR", "LIGHTS", "notmrk", "SISTAT", "SISTAW"],
    # Häfen & Liegestellen: Hafenanlagen, Liegeplätze, Ankerplätze,
    # Bunkerstationen, Terminals
    "harbour": ["HRBFAC", "HRBARE", "BERTHS", "MORFAC", "ACHARE", "ACHBRT",
                "SMCFAC", "bunsta", "refdmp", "termnl", "vehtrf", "CHKPNT"],
    # Basis-Geometrien (für spätere Darstellung/Kontext, Phase 3 entscheidet)
    "base": ["LNDARE", "RIVERS", "CANALS", "LAKARE", "LNDMRK", "BUAARE"],
}

# Flache Lookup-Map: klasse (lowercase) → gruppe
_CLASS_GROUP = {cls.lower(): grp for grp, classes in IENC_CLASSES.items()
                for cls in classes}


def safe_id(name: str) -> str:
    """Stabile Chart-ID aus dem ELWIS-Gewässernamen (identisch in Katalog
    und Download verwenden, sonst funktioniert der 'downloaded'-Abgleich nicht)."""
    return (name.replace("/", "_").replace(" ", "_")
                .replace("(", "").replace(")", ""))


# ==================== ELWIS KATALOG & DOWNLOAD ====================

def scrape_catalog() -> list:
    """Verfügbare IENC-Gewässer von der ELWIS-Seite scrapen. BLOCKING."""
    response = requests.get(IENC_URL, timeout=15)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")

    waterways = []
    seen = set()
    for link in soup.find_all("a", href=True):
        if "Download?file=" not in link["href"]:
            continue
        name = link.text.strip()
        if not name or name in seen:
            continue
        seen.add(name)
        url = link["href"]
        if not url.startswith("http"):
            url = ELWIS_BASE_URL + url
        waterways.append({"id": safe_id(name), "name": name, "url": url})
    return waterways


def download_waterway(page_url: str, chart_dir: Path) -> int:
    """
    Ein Gewässer von ELWIS laden: Download-Seite parsen, ZIP holen,
    .000-Zellen nach chart_dir extrahieren. BLOCKING.
    Gibt die Anzahl gefundener .000-Zellen zurück.
    """
    # Schritt 1+2: Download-Seite holen und den File:-Link extrahieren
    page = requests.get(page_url, timeout=30)
    page.raise_for_status()
    soup = BeautifulSoup(page.content, "html.parser")

    file_link = None
    for link in soup.find_all("a", href=True):
        if "File:" in link["href"] or "/Inland/IENC/" in link["href"]:
            file_link = link["href"]
            break
    if not file_link:
        raise ValueError("Kein Datei-Link auf der ELWIS-Download-Seite gefunden")
    zip_url = file_link if file_link.startswith("http") else ELWIS_BASE_URL + file_link

    # Schritt 3: ZIP streamen und entpacken — bei Re-Download altes Verzeichnis
    # ersetzen, damit gelöschte/umbenannte Zellen nicht liegen bleiben
    if chart_dir.exists():
        shutil.rmtree(chart_dir)
    chart_dir.mkdir(parents=True, exist_ok=True)

    zip_path = chart_dir / "download.zip"
    with requests.get(zip_url, timeout=120, stream=True) as r:
        r.raise_for_status()
        with open(zip_path, "wb") as f:
            for chunk in r.iter_content(chunk_size=65536):
                f.write(chunk)

    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(chart_dir)
    zip_path.unlink()

    cells = list(chart_dir.rglob("*.000"))
    if not cells:
        raise ValueError("ZIP enthielt keine .000-Zellen")
    return len(cells)


# ==================== S-57 → GEOJSON ====================

def _sanitize_props(items: dict) -> dict:
    """OGR-Feldwerte JSON-tauglich machen (Bytes → str, None raus)."""
    props = {}
    for k, v in items.items():
        if v is None:
            continue
        if isinstance(v, bytes):
            v = v.decode("utf-8", errors="replace")
        props[k] = v
    return props


def _open_s57(path: str):
    """
    S-57-Zelle mit Inland-Objektkatalog öffnen.

    Ältere GDAL-Versionen brauchen S57_PROFILE=iw, damit die Inland-Klassen
    (notmrk, dismar, wtwaxs, ...) dekodiert werden — das lädt die separaten
    s57objectclasses_iw.csv-Kataloge. Neuere GDAL-Versionen (u.a. 3.10 auf
    dem Pi) haben die Inland-Klassen in den Haupt-Katalog integriert und
    bringen die _iw-Dateien nicht mehr mit; dort darf das Profil NICHT
    gesetzt werden, sonst öffnet der Treiber mit degradiertem Katalog.
    """
    from osgeo import gdal, ogr

    gdal.SetConfigOption(
        "OGR_S57_OPTIONS",
        "RETURN_PRIMITIVES=OFF,RETURN_LINKAGES=OFF,LNAM_REFS=OFF,"
        "SPLIT_MULTIPOINT=ON,ADD_SOUNDG_DEPTH=ON,UPDATES=APPLY,"
        "RECODE_BY_DSSI=ON",
    )
    has_iw_catalog = bool(gdal.FindFile("gdal", "s57objectclasses_iw.csv"))
    gdal.SetConfigOption("S57_PROFILE", "iw" if has_iw_catalog else None)

    ds = ogr.Open(path)
    if ds is None and has_iw_catalog:
        # Fallback: Profil zurücknehmen und ohne erneut versuchen
        gdal.SetConfigOption("S57_PROFILE", None)
        ds = ogr.Open(path)
    return ds


def _read_dsid(ds) -> dict:
    """Edition/Update/Ausgabedatum aus dem DSID-Metadaten-Layer lesen."""
    info = {}
    try:
        layer = ds.GetLayerByName("DSID")
        if layer is None:
            return info
        layer.ResetReading()
        feat = layer.GetNextFeature()
        if feat is None:
            return info
        fields = feat.items()
        for src, dst in (("DSID_EDTN", "edition"), ("DSID_UPDN", "update"),
                         ("DSID_ISDT", "issued"), ("DSID_DSNM", "cell_name")):
            if fields.get(src) is not None:
                info[dst] = fields[src]
    except Exception:
        pass
    return info


def extract_geojson(chart_dir: Path, progress_cb=None) -> dict:
    """
    Alle .000-Zellen in chart_dir lesen und pro IENC-Objektklasse eine
    GeoJSON-Datei mit vollständigen Attributen schreiben. BLOCKING.

    Ausgabe: <chart_dir>/geojson/<klasse>.geojson + manifest.json
    Rückgabe: das Manifest-Dict.
    """
    cells = sorted(chart_dir.rglob("*.000"))
    if not cells:
        raise ValueError(f"Keine .000-Zellen in {chart_dir}")

    out_dir = chart_dir / "geojson"
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True)

    # klasse (lowercase) → Feature-Liste, über alle Zellen des Gewässers
    features_by_class = {}
    cell_infos = []
    bounds = [180.0, 90.0, -180.0, -90.0]  # lon_min, lat_min, lon_max, lat_max

    for i, cell in enumerate(cells):
        if progress_cb:
            progress_cb(f"Zelle {cell.name} ({i + 1}/{len(cells)})")

        ds = _open_s57(str(cell))
        if ds is None:
            cell_infos.append({"file": cell.name, "error": "GDAL konnte Zelle nicht öffnen"})
            continue

        info = _read_dsid(ds)
        info["file"] = cell.name
        cell_infos.append(info)

        for layer_idx in range(ds.GetLayerCount()):
            layer = ds.GetLayerByIndex(layer_idx)
            if layer is None:
                continue
            cls = layer.GetName().lower()
            if cls not in _CLASS_GROUP:
                continue

            layer.ResetReading()
            while True:
                try:
                    feat = layer.GetNextFeature()
                except Exception:
                    continue  # einzelne kaputte Features überspringen (GDAL-S-57-Macken)
                if feat is None:
                    break
                geom = feat.GetGeometryRef()
                if geom is None:
                    continue
                try:
                    geometry = json.loads(geom.ExportToJson())
                except Exception:
                    continue

                env = geom.GetEnvelope()  # (lon_min, lon_max, lat_min, lat_max)
                bounds[0] = min(bounds[0], env[0])
                bounds[1] = min(bounds[1], env[2])
                bounds[2] = max(bounds[2], env[1])
                bounds[3] = max(bounds[3], env[3])

                features_by_class.setdefault(cls, []).append({
                    "type": "Feature",
                    "geometry": geometry,
                    "properties": _sanitize_props(feat.items()),
                })

        ds = None

    # GeoJSON pro Klasse schreiben
    class_counts = {}
    for cls, feats in sorted(features_by_class.items()):
        class_counts[cls] = len(feats)
        collection = {
            "type": "FeatureCollection",
            "name": cls,
            "features": feats,
        }
        with open(out_dir / f"{cls}.geojson", "w", encoding="utf-8") as f:
            json.dump(collection, f, ensure_ascii=False, default=str)

    total = sum(class_counts.values())
    manifest = {
        "generated": datetime.now().isoformat(),
        "cell_count": len(cells),
        "cells": cell_infos,
        "classes": class_counts,
        "groups": {grp: [c.lower() for c in classes if c.lower() in class_counts]
                   for grp, classes in IENC_CLASSES.items()},
        "features_total": total,
        "bounds": bounds if total > 0 else None,
    }
    with open(out_dir / "manifest.json", "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2, default=str)

    return manifest


def read_manifest(chart_dir: Path) -> dict:
    """Manifest einer bereits konvertierten Karte lesen (oder None)."""
    p = Path(chart_dir) / "geojson" / "manifest.json"
    if not p.exists():
        return None
    try:
        with open(p, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return None


# ==================== GEOJSON → VEKTOR-MBTILES ====================

TILE_MINZOOM = 8
TILE_MAXZOOM = 14  # wie die Basemap; darüber overzoomt MapLibre client-seitig

# OGC-Standard-Skalennenner bei Zoom 0 (96 dpi) — für die SCAMIN-Auswertung
_SCALE_Z0 = 559082264.0287178

# S-57-Verwaltungsattribute, die in den Tiles nur Platz kosten würden.
# In den GeoJSON-Dateien bleiben sie vollständig erhalten.
_DROP_PROPS = {"RCID", "PRIM", "GRUP", "OBJL", "RVER", "AGEN", "FIDN", "FIDS",
               "LNAM", "SORDAT", "SORIND", "RECDAT", "RECIND", "SCAMIN"}

# Layer-Reihenfolge im Tile (Flächen zuerst — Renderreihenfolge steuert
# ohnehin der MapLibre-Style, das hier ist nur Konvention)
_GROUP_ORDER = ["base", "depth", "fairway", "harbour", "structures", "hazards", "marks"]


def _geom_bbox(geom: dict):
    """(lon_min, lat_min, lon_max, lat_max) einer GeoJSON-Geometrie."""
    lon_min = lat_min = 999.0
    lon_max = lat_max = -999.0

    def walk(c):
        nonlocal lon_min, lat_min, lon_max, lat_max
        if isinstance(c[0], (int, float)):
            lon_min = min(lon_min, c[0]); lon_max = max(lon_max, c[0])
            lat_min = min(lat_min, c[1]); lat_max = max(lat_max, c[1])
        else:
            for e in c:
                walk(e)

    coords = geom.get("coordinates")
    if not coords:
        return None
    walk(coords)
    if lon_min > lon_max:
        return None
    return (lon_min, lat_min, lon_max, lat_max)


def _load_tile_features(charts, progress_cb=None) -> list:
    """
    GeoJSON aller Gewässer laden → Liste (gruppe, geom, props, scamin, bbox).
    charts: Liste (name, chart_dir).
    """
    feats = []
    for name, chart_dir in charts:
        if progress_cb:
            progress_cb(f"Lade {name}…")
        gdir = Path(chart_dir) / "geojson"
        for gj in sorted(gdir.glob("*.geojson")):
            cls = gj.stem
            grp = _CLASS_GROUP.get(cls)
            if grp is None:
                continue
            try:
                with open(gj, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue
            for feat in data.get("features", []):
                geom = feat.get("geometry")
                if not geom:
                    continue
                bbox = _geom_bbox(geom)
                if bbox is None:
                    continue
                props = feat.get("properties") or {}
                scamin = props.get("SCAMIN")
                lean = {k: v for k, v in props.items() if k not in _DROP_PROPS}
                lean["_cls"] = cls
                feats.append((grp, geom, lean, scamin, bbox))
    return feats


def build_mbtiles(charts, out_path, progress_cb=None) -> dict:
    """
    Kombinierte Vektor-MBTiles aus den GeoJSON-Daten aller übergebenen
    Gewässer bauen (Source-Layer = Gruppen aus IENC_CLASSES). BLOCKING.

    Ein gemeinsames MBTiles statt Merge zur Laufzeit: an Gewässer-Kreuzungen
    teilen sich mehrere Gewässer ein Tile — beim Protobuf-Konkat gäbe es dort
    doppelte Layer-Namen, so werden die Features vor dem Encoden vereint.

    SCAMIN aus den Zellen steuert, ab welchem Zoom ein Feature auftaucht;
    auf TILE_MAXZOOM landet alles (Overzoom zeigt es weiter an).

    charts: Liste (name, chart_dir). Rückgabe: Statistik-Dict.
    """
    out_path = Path(out_path)
    feats = _load_tile_features(charts, progress_cb)

    if not feats:
        if out_path.exists():
            out_path.unlink()
        return {"tiles": 0, "features": 0, "waterways": 0}

    tmp = out_path.with_suffix(".building")
    if tmp.exists():
        tmp.unlink()
    conn = sqlite3.connect(str(tmp))
    conn.execute("PRAGMA journal_mode=OFF")
    conn.execute("PRAGMA synchronous=OFF")
    conn.execute("CREATE TABLE metadata (name TEXT, value TEXT)")
    conn.execute("CREATE TABLE tiles (zoom_level INTEGER, tile_column INTEGER, "
                 "tile_row INTEGER, tile_data BLOB)")
    conn.execute("CREATE UNIQUE INDEX tile_index ON tiles "
                 "(zoom_level, tile_column, tile_row)")

    bounds = [
        min(f[4][0] for f in feats), min(f[4][1] for f in feats),
        max(f[4][2] for f in feats), max(f[4][3] for f in feats),
    ]

    tile_count = 0
    pad = mvt.BUFFER / mvt.EXTENT

    for z in range(TILE_MINZOOM, TILE_MAXZOOM + 1):
        scale_den = _SCALE_Z0 / (1 << z)
        n = 1 << z

        # Features per Bounding-Box auf Tiles verteilen
        buckets = {}
        for idx, (grp, geom, props, scamin, bbox) in enumerate(feats):
            if z < TILE_MAXZOOM and isinstance(scamin, (int, float)) and scale_den > scamin:
                continue
            x0, y0 = mvt.project(bbox[0], bbox[3], z)  # links oben
            x1, y1 = mvt.project(bbox[2], bbox[1], z)  # rechts unten
            tx0 = max(0, int(x0 - pad)); tx1 = min(n - 1, int(x1 + pad))
            ty0 = max(0, int(y0 - pad)); ty1 = min(n - 1, int(y1 + pad))
            for tx in range(tx0, tx1 + 1):
                for ty in range(ty0, ty1 + 1):
                    buckets.setdefault((tx, ty), []).append(idx)

        if progress_cb:
            progress_cb(f"Zoom {z}: {len(buckets)} Tiles")

        for (tx, ty), idxs in buckets.items():
            layers = {grp: [] for grp in _GROUP_ORDER}
            for i in idxs:
                grp, geom, props, scamin, bbox = feats[i]
                clipped = mvt.clip_geometry(geom, z, tx, ty)
                if clipped is None:
                    continue
                layers[grp].append((clipped[0], clipped[1], props))
            data = mvt.encode_tile(layers)
            if not data:
                continue
            blob = gzip.compress(data, compresslevel=6)
            tms_y = n - 1 - ty
            conn.execute("INSERT OR REPLACE INTO tiles VALUES (?,?,?,?)",
                         (z, tx, tms_y, sqlite3.Binary(blob)))
            tile_count += 1
        conn.commit()

    groups_present = sorted({f[0] for f in feats}, key=_GROUP_ORDER.index)
    metadata = {
        "name": "BoatOS IENC",
        "format": "pbf",
        "minzoom": str(TILE_MINZOOM),
        "maxzoom": str(TILE_MAXZOOM),
        "bounds": ",".join(f"{v:.6f}" for v in bounds),
        "type": "overlay",
        "generated": datetime.now().isoformat(),
        "waterways": json.dumps([name for name, _ in charts], ensure_ascii=False),
        "json": json.dumps({"vector_layers": [
            {"id": grp, "minzoom": TILE_MINZOOM, "maxzoom": TILE_MAXZOOM, "fields": {}}
            for grp in groups_present
        ]}),
    }
    conn.executemany("INSERT INTO metadata VALUES (?, ?)", metadata.items())
    conn.commit()
    conn.close()

    os.replace(tmp, out_path)
    return {"tiles": tile_count, "features": len(feats), "waterways": len(charts),
            "size_mb": round(out_path.stat().st_size / 1048576, 2)}


# ==================== ROUTE-CHECK (Brücken/Tiefen/Wehre) ====================
# Prüft eine berechnete Route gegen die extrahierten IENC-Daten und liefert
# Warnungen: zu niedrige Brücken/Freileitungen (VERCLR vs. Bootshöhe),
# zu flache Tiefenbereiche (DRVAL1 vs. Tiefgang), Wehre/Sperrtore nahe der
# Route. Reine Warnung — das Routing selbst bleibt unverändert.

# Sicherheitsmargen (m)
HEIGHT_MARGIN = 0.3        # Brücken: Wellenschlag, Beladung, Messungenauigkeit
CABLE_MARGIN = 1.0         # Freileitungen: elektrischer Sicherheitsabstand
DEPTH_MARGIN = 0.3         # Tiefen: Squat, Wasserstandsschwankung
CORRIDOR_M = 40            # Korridor um die Route für Bauwerke
DEPTH_SAMPLE_M = 50        # Abtastabstand der Route für Tiefen-Checks

# GeoJSON-Cache: Pfad → (mtime, features) — Elbe-depare ist ein paar MB,
# das wollen wir nicht bei jeder Routenberechnung neu parsen
_geojson_cache = {}


def _load_class_features(chart_dir: Path, cls: str) -> list:
    p = Path(chart_dir) / "geojson" / f"{cls}.geojson"
    if not p.exists():
        return []
    try:
        mtime = p.stat().st_mtime
        cached = _geojson_cache.get(str(p))
        if cached and cached[0] == mtime:
            return cached[1]
        with open(p, "r", encoding="utf-8") as f:
            feats = json.load(f).get("features", [])
        _geojson_cache[str(p)] = (mtime, feats)
        return feats
    except Exception:
        return []


def _m_per_deg(lat: float):
    """Meter pro Grad (Länge/Breite) — equirectangular, reicht für <1 km."""
    import math
    return 111320.0 * math.cos(math.radians(lat)), 110540.0


def _geom_points(geom: dict):
    """Alle Koordinaten einer Geometrie als flache Punktliste."""
    pts = []

    def walk(c):
        if isinstance(c[0], (int, float)):
            pts.append((c[0], c[1]))
        else:
            for e in c:
                walk(e)

    coords = geom.get("coordinates")
    if coords:
        walk(coords)
    return pts


def _point_in_ring(pt, ring) -> bool:
    """Ray-Casting: Punkt in Ring?"""
    x, y = pt
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        j = i
    return inside


def _point_in_polygon(pt, geom: dict) -> bool:
    """Punkt in (Multi-)Polygon inkl. Löcher."""
    gtype = geom.get("type")
    polys = geom.get("coordinates") or []
    if gtype == "Polygon":
        polys = [polys]
    elif gtype != "MultiPolygon":
        return False
    for rings in polys:
        if not rings or not _point_in_ring(pt, rings[0]):
            continue
        if any(_point_in_ring(pt, hole) for hole in rings[1:]):
            continue
        return True
    return False


def _sample_route(coords, step_m):
    """Route abtasten → Liste (lon, lat, km_vom_Start)."""
    samples = []
    km = 0.0
    for i in range(len(coords) - 1):
        a, b = coords[i], coords[i + 1]
        mx, my = _m_per_deg(a[1])
        seg_m = (((b[0] - a[0]) * mx) ** 2 + ((b[1] - a[1]) * my) ** 2) ** 0.5
        n = max(1, int(seg_m / step_m))
        for s in range(n):
            f = s / n
            samples.append((a[0] + (b[0] - a[0]) * f,
                            a[1] + (b[1] - a[1]) * f,
                            (km + seg_m * f / 1000)))
        km += seg_m / 1000
    if coords:
        samples.append((coords[-1][0], coords[-1][1], km))
    return samples


def _route_bbox(coords, pad_deg=0.01):
    return (min(c[0] for c in coords) - pad_deg, min(c[1] for c in coords) - pad_deg,
            max(c[0] for c in coords) + pad_deg, max(c[1] for c in coords) + pad_deg)


def _bbox_overlaps(a, b) -> bool:
    return not (a[2] < b[0] or b[2] < a[0] or a[3] < b[1] or b[3] < a[1])


def _num_or_none(v):
    try:
        f = float(v)
        return f
    except (TypeError, ValueError):
        return None


def check_route(route_coords, chart_dirs, draft_m=None, height_m=None) -> list:
    """
    Route gegen IENC-Daten prüfen. BLOCKING (via to_thread aufrufen).

    route_coords: [[lon, lat], ...] — finale Routen-Geometrie
    chart_dirs:   Liste (name, chart_dir) der aktiven ENC-Gewässer
    draft_m/height_m: Bootsmaße; None = jeweiligen Check überspringen

    Rückgabe: Warnliste, sortiert nach km. Einträge:
      {type, severity ('danger'|'warning'), name, cls, km, lat, lon,
       clearance|depth, required}
    """
    if not route_coords or len(route_coords) < 2:
        return []

    rbox = _route_bbox(route_coords)
    samples = _sample_route(route_coords, DEPTH_SAMPLE_M)
    warnings = []
    seen = set()

    # Spatial-Hash über die Route-Samples (~0.004° ≈ 300–450 m Zellen):
    # lange Routen haben tausende Segmente — Feature×Segment wäre zu teuer.
    # Da die Samples max. DEPTH_SAMPLE_M auseinander liegen, genügt der
    # Abstand zum nächsten Sample (+ halber Sample-Abstand als Toleranz).
    _CELL = 0.004
    grid = {}
    for lon, lat, km in samples:
        grid.setdefault((int(lon / _CELL), int(lat / _CELL)), []).append((lon, lat, km))

    def _nearest_sample(p, max_m):
        """(dist_m, km) des nächsten Samples im Umkreis, sonst None."""
        ix, iy = int(p[0] / _CELL), int(p[1] / _CELL)
        mx, my = _m_per_deg(p[1])
        best = None
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for lon, lat, km in grid.get((ix + dx, iy + dy), ()):
                    d = (((p[0] - lon) * mx) ** 2 + ((p[1] - lat) * my) ** 2) ** 0.5
                    if d <= max_m and (best is None or d < best[0]):
                        best = (d, km)
        return best

    def route_pos(pt_lonlat):
        """Routen-km der Objektposition. Wird nur nach bestandenem
        near_route() aufgerufen — das nächste Sample liegt also sicher in
        den ±1-Nachbarzellen des Grids."""
        hit = _nearest_sample(pt_lonlat, CORRIDOR_M + DEPTH_SAMPLE_M)
        return hit[1] if hit else 0.0

    def near_route(pts, max_m) -> bool:
        """Liegt mindestens ein Geometrie-Punkt im Korridor um die Route?"""
        tol = max_m + DEPTH_SAMPLE_M / 2
        return any(_nearest_sample(p, tol) for p in pts)

    # --- Bauwerke: Brücken, Freileitungen, Wehre/Sperrtore ---
    structure_checks = [
        ("bridge", "bridge", height_m, HEIGHT_MARGIN),
        ("cblohd", "cable", height_m, CABLE_MARGIN),
        ("pipohd", "cable", height_m, CABLE_MARGIN),
        ("damcon", "weir", None, 0),
        ("gatcon", "weir", None, 0),
    ]
    for name, chart_dir in chart_dirs:
        for cls, wtype, ref_height, margin in structure_checks:
            for feat in _load_class_features(chart_dir, cls):
                geom = feat.get("geometry")
                props = feat.get("properties") or {}
                if not geom:
                    continue
                pts = _geom_points(geom)
                if not pts:
                    continue
                fbox = (min(p[0] for p in pts), min(p[1] for p in pts),
                        max(p[0] for p in pts), max(p[1] for p in pts))
                if not _bbox_overlaps(fbox, rbox):
                    continue
                if not near_route(pts, CORRIDOR_M):
                    continue

                cx = sum(p[0] for p in pts) / len(pts)
                cy = sum(p[1] for p in pts) / len(pts)
                obj_name = props.get("NOBJNM") or props.get("OBJNAM") or ""
                km_pos = route_pos((cx, cy))
                # Dedupe über Name + Routen-km (250-m-Cluster): fasst
                # Doppel-Spans (zwei Fahrbahnen, gleicher Name) zusammen
                key = (cls, obj_name, round(km_pos * 4) / 4)
                if key in seen:
                    continue

                if wtype == "weir":
                    # Wehr/Sperrtor im Korridor ist immer meldenswert
                    seen.add(key)
                    warnings.append({
                        "type": "weir", "severity": "warning", "cls": cls,
                        "name": obj_name, "km": round(km_pos, 1),
                        "lat": cy, "lon": cx,
                    })
                    continue

                if ref_height is None:
                    continue  # keine Bootshöhe gesetzt → Check übersprungen
                clearance = _num_or_none(props.get("VERCLR"))
                if clearance is None:
                    continue  # Höhe unbekannt — kein Rauschen erzeugen
                required = round(ref_height + margin, 2)  # round: Float-Artefakte
                if clearance >= required:
                    continue
                seen.add(key)
                warnings.append({
                    "type": wtype,
                    "severity": "danger" if clearance < ref_height else "warning",
                    "cls": cls, "name": obj_name,
                    "clearance": clearance, "required": required,
                    "km": round(km_pos, 1), "lat": cy, "lon": cx,
                })

    # --- Tiefen: Route-Samples gegen flache DEPARE/DRGARE-Polygone ---
    # IENC-Kanäle kodieren Ufer-zu-Ufer-Flächen mit DRVAL1=0 (Uferzone) und
    # DRVAL2=Fahrrinnentiefe — gegen DRVAL1 zu prüfen wäre Dauer-Fehlalarm.
    # Gewarnt wird deshalb nur, wenn selbst die MAXIMALE Tiefe des Bereichs
    # (DRVAL2, Fallback DRVAL1) für den Tiefgang nicht reicht.
    if draft_m is not None:
        needed = round(draft_m + DEPTH_MARGIN, 2)  # round: 1.1+0.3 wäre sonst 1.4000000000000001
        shallow = []
        for name, chart_dir in chart_dirs:
            for cls in ("depare", "drgare"):
                for feat in _load_class_features(chart_dir, cls):
                    geom = feat.get("geometry")
                    props = feat.get("properties") or {}
                    if not geom or geom.get("type") not in ("Polygon", "MultiPolygon"):
                        continue
                    d2 = _num_or_none(props.get("DRVAL2"))
                    if d2 is None:
                        d2 = _num_or_none(props.get("DRVAL1"))
                    if d2 is None or d2 >= needed:
                        continue
                    pts = _geom_points(geom)
                    if not pts:
                        continue
                    fbox = (min(p[0] for p in pts), min(p[1] for p in pts),
                            max(p[0] for p in pts), max(p[1] for p in pts))
                    if _bbox_overlaps(fbox, rbox):
                        shallow.append((fbox, geom, d2, name))

        # Aufeinanderfolgende Treffer zu Abschnitten zusammenfassen
        in_shallow = None  # (start_km, min_depth, lon, lat, gewässer)
        last_km = 0.0

        def flush(end_km):
            if in_shallow is None:
                return
            start_km, d1, lon, lat, waterway = in_shallow
            warnings.append({
                "type": "depth",
                "severity": "danger" if d1 < draft_m else "warning",
                "cls": "depare", "name": "",
                "waterway": waterway,  # für den Pegel-Abgleich (Gewässer-Match)
                "depth": d1, "required": round(needed, 2),
                "km": round(start_km, 1), "length_km": round(max(end_km - start_km, 0.05), 1),
                "lat": lat, "lon": lon,
            })

        for lon, lat, km in samples:
            hit = None
            for fbox, geom, d1, wname in shallow:
                if (fbox[0] <= lon <= fbox[2] and fbox[1] <= lat <= fbox[3]
                        and _point_in_polygon((lon, lat), geom)):
                    if hit is None or d1 < hit[0]:
                        hit = (d1, wname)
            if hit is not None:
                if in_shallow is None:
                    in_shallow = (km, hit[0], lon, lat, hit[1])
                elif hit[0] < in_shallow[1]:
                    in_shallow = (in_shallow[0], hit[0], in_shallow[2], in_shallow[3], hit[1])
            else:
                flush(km)
                in_shallow = None
            last_km = km
        flush(last_km)
        in_shallow = None

    warnings.sort(key=lambda w: w["km"])
    return warnings


def _norm_water_name(s: str) -> str:
    """Gewässernamen normalisieren für den Pegel-Abgleich ('Elbe-Havel-Kanal'
    ↔ 'ELBE-HAVEL-KANAL'). Exakte Gleichheit, KEIN Substring — sonst würde
    ein Havel-Flusspegel Havelkanal-Tiefen 'korrigieren'."""
    return "".join(c for c in s.upper() if c.isalnum())


def apply_level_offsets(warnings: list, gauges: list, draft_m: float,
                        max_gauge_km: float = 30.0) -> list:
    """
    Tiefen-Warnungen um den aktuellen Wasserstand korrigieren.

    Wichtig: Der Pegelstand ist KEINE Fahrwassertiefe. Verwendet wird nur
    die Differenz zum Niedrigwasser-Referenzwert (delta_m = W − MNW, aus
    pegelonline.get_reference_levels) als konservativer Aufschlag auf die
    Kartentiefe (Kartennull GlW liegt unter MNW → echter Aufschlag wäre
    größer). Ein Pegel wird nur verwendet, wenn er am SELBEN Gewässer liegt
    (Namens-Match gegen das ELWIS-Chart der Fläche) und nahe genug ist.
    Warnungen, die nach Korrektur genügend Wasser haben, entfallen.
    """
    if not gauges or draft_m is None:
        return warnings

    needed = round(draft_m + DEPTH_MARGIN, 2)
    result = []
    for w in warnings:
        if w.get("type") != "depth":
            result.append(w)
            continue

        wnorm = _norm_water_name(w.get("waterway", ""))
        best = None  # (dist_km, gauge)
        for g in gauges:
            if _norm_water_name(g.get("water", "")) != wnorm:
                continue
            mx, my = _m_per_deg(w["lat"])
            dist_km = ((((g["lon"] - w["lon"]) * mx) ** 2 +
                        ((g["lat"] - w["lat"]) * my) ** 2) ** 0.5) / 1000
            if dist_km <= max_gauge_km and (best is None or dist_km < best[0]):
                best = (dist_km, g)

        if best is None:
            result.append(w)  # kein passender Pegel — Kartentiefe bleibt maßgeblich
            continue

        dist_km, g = best
        current = round(w["depth"] + g["delta_m"], 2)
        if current >= needed:
            continue  # mit aktuellem Wasserstand genug Wasser → Warnung entfällt
        w = dict(w)
        w["current_depth"] = current
        w["level_offset_m"] = g["delta_m"]
        w["gauge"] = g["name"]
        w["gauge_distance_km"] = round(dist_km, 1)
        w["severity"] = "danger" if current < draft_m else "warning"
        result.append(w)

    return result


def read_tiles_meta(mbtiles_path) -> dict:
    """Metadaten der kombinierten IENC-MBTiles lesen (oder None)."""
    p = Path(mbtiles_path)
    if not p.exists():
        return None
    try:
        conn = sqlite3.connect(f"file:{p}?mode=ro", uri=True)
        rows = dict(conn.execute("SELECT name, value FROM metadata").fetchall())
        conn.close()
        return {
            "generated": rows.get("generated"),
            "bounds": rows.get("bounds"),
            "waterways": json.loads(rows.get("waterways", "[]")),
            "size_mb": round(p.stat().st_size / 1048576, 2),
        }
    except Exception:
        return None
