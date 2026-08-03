"""
Tonnen-/Seezeichen-Storage (Vorab-Import aus OSM)
=================================================
Analog zu harbor_storage: die aus OSM geholten Tonnen/Baken werden EINMAL
importiert und hier offline vorgehalten. Der Endpoint liest nur noch aus dieser
Datei — schnell und ohne Internet (wichtig auf dem Boot).

Format (data/seamark_buoys.json):
    {"fetched_at": "<iso>", "count": <n>, "buoys": [ {id,cls,colour,topshp,catcam,lat,lon,name}, ... ]}
"""

import json
import threading
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any, Optional

_DATA_DIR = Path("data")
_DATA_DIR.mkdir(exist_ok=True)
_STORE = _DATA_DIR / "seamark_buoys.json"

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
            _cache = {"fetched_at": None, "count": 0, "buoys": []}
        return _cache


def save(buoys: List[Dict[str, Any]]) -> None:
    """Tonnen-Liste persistieren (ueberschreibt den bisherigen Bestand)."""
    global _cache
    payload = {
        "fetched_at": datetime.now().isoformat(),
        "count": len(buoys),
        "buoys": buoys,
    }
    tmp = _STORE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False)
    tmp.replace(_STORE)   # atomar ersetzen
    with _lock:
        _cache = payload


def get_in_bounds(lat_min: float, lon_min: float,
                  lat_max: float, lon_max: float) -> List[Dict[str, Any]]:
    """Alle vorab importierten Tonnen innerhalb der Bounding-Box."""
    buoys = _read().get("buoys", [])
    out = []
    for b in buoys:
        lat, lon = b.get("lat"), b.get("lon")
        if lat is None or lon is None:
            continue
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            out.append(b)
    return out


def count() -> int:
    return _read().get("count", 0)


def fetched_at() -> Optional[str]:
    return _read().get("fetched_at")


def age_hours() -> Optional[float]:
    ts = fetched_at()
    if not ts:
        return None
    try:
        return (datetime.now() - datetime.fromisoformat(ts)).total_seconds() / 3600.0
    except Exception:
        return None


def is_stale(max_hours: float) -> bool:
    age = age_hours()
    return age is None or age >= max_hours
