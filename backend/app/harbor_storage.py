"""
Hafen-/Ankerplatz-Storage (Vorab-Import aus OSM)
================================================
Häfen, Marinas und Ankerplätze werden NICHT mehr live pro Kartenbewegung von
Overpass geholt (das wird bei viel Nutzung rate-limitiert/geblockt), sondern
alle paar Tage EINMAL importiert und hier offline vorgehalten. Der Endpoint
liest dann nur noch aus dieser Datei — schnell und ohne Internet.

Format der Datei (data/harbors_osm.json):
    {"fetched_at": "<iso>", "count": <n>, "pois": [ {id,type,lat,lon,name,properties}, ... ]}
"""

import json
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

_DATA_DIR = Path("data")
_DATA_DIR.mkdir(exist_ok=True)
_STORE = _DATA_DIR / "harbors_osm.json"

# In-Memory-Cache, damit nicht bei jedem Request die Datei gelesen wird.
_lock = threading.Lock()
_cache: Optional[Dict[str, Any]] = None


def _read() -> Dict[str, Any]:
    global _cache
    with _lock:
        if _cache is not None:
            return _cache
        try:
            with open(_STORE, encoding="utf-8") as f:
                _cache = json.load(f)
        except Exception:
            _cache = {"fetched_at": None, "count": 0, "pois": []}
        return _cache


def save(pois: List[Dict[str, Any]]) -> None:
    """POI-Liste persistieren (überschreibt den bisherigen Bestand)."""
    global _cache
    payload = {
        "fetched_at": datetime.now().isoformat(),
        "count": len(pois),
        "pois": pois,
    }
    tmp = _STORE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    tmp.replace(_STORE)   # atomar ersetzen
    with _lock:
        _cache = payload


def get_in_bounds(lat_min: float, lon_min: float,
                  lat_max: float, lon_max: float) -> List[Dict[str, Any]]:
    """Alle vorab importierten POIs innerhalb der Bounding-Box."""
    pois = _read().get("pois", [])
    out = []
    for p in pois:
        lat, lon = p.get("lat"), p.get("lon")
        if lat is None or lon is None:
            continue
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            out.append(p)
    return out


def count() -> int:
    return _read().get("count", 0)


def fetched_at() -> Optional[str]:
    return _read().get("fetched_at")


def age_hours() -> Optional[float]:
    """Alter des Bestands in Stunden — None, wenn noch nie importiert."""
    ts = fetched_at()
    if not ts:
        return None
    try:
        return (datetime.now() - datetime.fromisoformat(ts)).total_seconds() / 3600.0
    except Exception:
        return None


def is_stale(max_hours: float) -> bool:
    """True, wenn noch nie importiert oder älter als max_hours."""
    age = age_hours()
    return age is None or age >= max_hours
