"""
Seezeichen-/Tonnen-Import aus OSM (OpenSeaMap-Tags)
===================================================
Die amtlichen ELWIS-IENC-Daten enthalten fuer die deutschen Binnenreviere fast
keine Lateral-/Fahrwasser-Tonnen (4 Stueck im ganzen Bestand) — die reiche
Betonnung, die man auf der Karte sieht, kommt aus dem OpenSeaMap-RASTER-Overlay
und hat damit keine Geometrie fuer die 3D-Szene.

Dieses Modul holt die Tonnen/Baken als echte Punkt-Geometrie aus OSM
(seamark:*-Tags) und uebersetzt sie in DIESELBE S-57-Vokabel, die die
3D-Darstellung (buoy3d.js: describe()) und der 2D-IENC-Layer schon sprechen:
_cls, COLOUR (S-57-Codes), TOPSHP, CATCAM. So muss die Darstellung nichts Neues
lernen — sie bekommt nur mehr Marken.

Wie Haefen/Ankerplaetze werden die Tonnen NICHT live pro Kartenbewegung geholt
(Overpass wuerde das rate-limitieren, und auf dem Boot ist ohnehin selten Netz),
sondern vorab importiert und offline vorgehalten (seamark_storage).

OSM-Tagging-Eigenheit: Bei typisierten Tonnen steht die Farbe NICHT unter dem
generischen seamark:colour, sondern typ-spezifisch, z. B.
seamark:buoy_lateral:colour=red. Deshalb lesen wir immer erst den typ-Schluessel
und fallen dann auf den generischen zurueck.
"""

import glob
import json
from pathlib import Path
from typing import Dict, Any, Optional, List

# ---- seamark:type → S-57-Objektklasse (_cls, wie in ienc.py/buoy3d.js) ----
_TYPE_CLS = {
    "buoy_lateral": "boylat",
    "buoy_cardinal": "boycar",
    "buoy_isolated_danger": "boyisd",
    "buoy_safe_water": "boysaw",
    "buoy_special_purpose": "boyspp",
    "beacon_lateral": "bcnlat",
    "beacon_cardinal": "bcncar",
    "beacon_isolated_danger": "bcnisd",
    "beacon_safe_water": "bcnsaw",
    "beacon_special_purpose": "bcnspp",
    # Ohne Untertyp getaggte Marken — als Sonderzeichen fuehren, damit sie
    # wenigstens (farbgetrieben) erscheinen statt verworfen zu werden.
    "buoy": "boyspp",
    "beacon": "bcnspp",
    "light_float": "boyspp",
}

# Die Klasse bestimmt, unter welchem seamark:<type>:*-Praefix die Attribute
# stehen. Fuer die Fallbacks (buoy/beacon/light_float) gibt es keinen eigenen
# Praefix — dort greift nur der generische seamark:*-Schluessel.
_TYPE_PREFIX = {
    "buoy_lateral", "buoy_cardinal", "buoy_isolated_danger", "buoy_safe_water",
    "buoy_special_purpose", "beacon_lateral", "beacon_cardinal",
    "beacon_isolated_danger", "beacon_safe_water", "beacon_special_purpose",
}

# ---- Farbe (OSM-Name) → S-57 COLOUR-Code (wie S57 in buoy3d.js) ----
_COLOUR_S57 = {
    "white": "1", "black": "2", "red": "3", "green": "4", "blue": "5",
    "yellow": "6", "grey": "7", "gray": "7", "brown": "8", "amber": "9",
    "violet": "10", "purple": "10", "orange": "11", "magenta": "12", "pink": "13",
}

# ---- seamark:topmark:shape (OSM-Text) → S-57 TOPSHP-Code (wie buoy3d.js) ----
# Reihenfolge wichtig: laengere/spezifische Muster zuerst pruefen.
_TOPSHP_PATTERNS = [
    ("2 cones base together", 11), ("2 cones point together", 10),
    ("2 cones points together", 10), ("2 cones base to base", 11),
    ("2 cones point to point", 10), ("2 cones up", 13), ("2 cones down", 14),
    ("2 cones point up", 13), ("2 cones point down", 14),
    ("cone, point up", 1), ("cone, point down", 2),
    ("cone point up", 1), ("cone point down", 2),
    ("2 spheres", 4), ("2 balls", 4),
    ("cube, point up", 9), ("cube point up", 9),
    ("x-shape", 7), ("x shape", 7), ("st andrew", 7),
    ("rhombus", 12), ("diamond", 12),
    ("sphere", 3), ("ball", 3),
    ("cylinder", 5), ("can", 5),
    ("board", 6), ("square", 19), ("rectangle", 6),
    ("cross", 8),
]

# ---- seamark:*:category (cardinal) → S-57 CATCAM-Code (N/E/S/W = 1/2/3/4) ----
_CATCAM = {"north": "1", "east": "2", "south": "3", "west": "4"}

# Namensfelder in Vorzugsreihenfolge
_NAME_TAGS = ("seamark:name", "name", "name:de", "seamark:buoy_lateral:name",
              "ref", "seamark:reference")


def _colour_string(tags: Dict[str, str], seamark_type: str) -> str:
    """seamark:<type>:colour (';'-getrennt, oben→unten) → S-57 'a,b,c'.

    Faellt auf den generischen seamark:colour zurueck. Leerer String, wenn
    keine Farbe getaggt ist — describe() setzt dann klassenabhaengige Defaults.
    """
    raw = None
    if seamark_type in _TYPE_PREFIX:
        raw = tags.get(f"seamark:{seamark_type}:colour")
    if not raw:
        raw = tags.get("seamark:colour")
    if not raw:
        return ""
    codes = []
    for part in str(raw).replace(",", ";").split(";"):
        c = _COLOUR_S57.get(part.strip().lower())
        if c:
            codes.append(c)
    return ",".join(codes)


def _topshp(tags: Dict[str, str]) -> Optional[int]:
    shp = tags.get("seamark:topmark:shape")
    if not shp:
        return None
    s = str(shp).strip().lower()
    for pat, code in _TOPSHP_PATTERNS:
        if pat in s:
            return code
    return None


def _catcam(tags: Dict[str, str], seamark_type: str) -> Optional[str]:
    cat = None
    if seamark_type in _TYPE_PREFIX:
        cat = tags.get(f"seamark:{seamark_type}:category")
    if not cat:
        cat = tags.get("seamark:category")
    if not cat:
        return None
    return _CATCAM.get(str(cat).strip().lower())


def _name(tags: Dict[str, str]) -> Optional[str]:
    for k in _NAME_TAGS:
        v = tags.get(k)
        if v:
            return v
    return None


# OSM seamark:notice:function / :category → S-57 fnctnm (1=Verbot .. 5=Hinweis).
_NOTICE_FN = {
    "prohibition": 1, "prohibited": 1,
    "obligation": 2, "mandatory": 2,
    "restriction": 3, "restricted": 3,
    "recommendation": 4, "recommended": 4,
    "information": 5, "informative": 5, "info": 5,
}


def _notice_fnctnm(tags: Dict[str, str]) -> int:
    """Funktionsklasse (1..5) eines OSM-notice-Schildes bestimmen."""
    fn = (tags.get("seamark:notice:function") or "").strip().lower()
    if fn in _NOTICE_FN:
        return _NOTICE_FN[fn]
    cat = (tags.get("seamark:notice:category") or "").strip().lower()
    if cat.startswith("no_") or "prohibit" in cat:
        return 1
    if "mandatory" in cat or "oblig" in cat:
        return 2
    if "limit" in cat or "restrict" in cat:
        return 3
    if "recommend" in cat:
        return 4
    return 5


def _coords(element: Dict[str, Any]):
    if element.get("type") == "node":
        return element.get("lat"), element.get("lon")
    if "center" in element:
        return element["center"].get("lat"), element["center"].get("lon")
    return None, None


def parse_element(element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """OSM-Element (node/way) → normalisierte Marke oder None.

    Tonnen/Baken (kind='buoy') tragen die S-57-Vokabel _cls/COLOUR/TOPSHP/CATCAM;
    CEVNI-Schilder (seamark:type=notice, kind='sign') tragen fnctnm/orient/cat.
    """
    tags = element.get("tags") or {}
    st = tags.get("seamark:type")
    lat, lon = _coords(element)
    if lat is None or lon is None:
        return None
    oid = f"{element.get('type', 'n')[0]}{element.get('id')}"

    if st == "notice":
        ori = tags.get("seamark:notice:orientation")
        try:
            orient = float(ori)
        except (TypeError, ValueError):
            orient = None
        return {
            "id": oid, "kind": "sign",
            "fnctnm": _notice_fnctnm(tags),
            "orient": orient,
            "cat": tags.get("seamark:notice:category"),
            "lat": lat, "lon": lon,
            "name": _name(tags),
        }

    cls = _TYPE_CLS.get(st)
    if not cls:
        return None
    return {
        "id": oid, "kind": "buoy",
        "cls": cls,
        "colour": _colour_string(tags, st),
        "topshp": _topshp(tags),
        "catcam": _catcam(tags, st),
        "lat": lat,
        "lon": lon,
        "name": _name(tags),
    }


# Seamark-Typen fuer die Overpass-Abfrage: schwimmende Tonnen (buoy_*) UND
# ufer-/pfahlmontierte Baken (beacon_*).
#
# OSM ist die weltweite PRIMAERQUELLE; ELWIS (nur national) ist Fallback. Die
# Baken werden in der 3D-Szene als PFAHL-Schilder gerendert (body-los, wie die
# daymar — nicht als schwimmender Koerper), und ELWIS-Marken werden dort
# unterdrueckt, wo OSM am selben Ort schon eine Marke hat. So gibt es weder
# das fruehere Ufer-Doppelbild noch Luecken ausserhalb Deutschlands.
_OVERPASS_TYPES = [
    "buoy_lateral", "buoy_cardinal", "buoy_isolated_danger", "buoy_safe_water",
    "buoy_special_purpose", "beacon_lateral", "beacon_cardinal",
    "beacon_isolated_danger", "beacon_safe_water", "beacon_special_purpose",
    # CEVNI-Schilder (kind='sign') — weltweit, wo ELWIS-notmrk fehlt.
    "notice",
]


# ==================== ELWIS-ANREICHERUNG ====================
# OSM taggt bei vielen Ufer-/Pfahlzeichen (X-Kreuz, Raute, Tafel) KEIN colour;
# die amtlichen ELWIS-Tagesmarken tragen die Farbe an derselben Position aber
# sehr wohl. Da OSM die Primaerquelle ist (weltweit) und ELWIS der nationale
# Fallback, fuellen wir fehlende colour/topshp aus der co-lokalen ELWIS-Marke.
# National (DE); anderswo bleibt colour leer (Typ-Defaults greifen im Render).

_ELWIS_CHARTS = Path(__file__).resolve().parents[2] / "data" / "charts"
_ELWIS_ENRICH_CLASSES = ["daymar", "topmar", "bcnlat", "bcncar", "bcnisd",
                         "bcnsaw", "bcnspp", "boylat", "boycar", "boyisd",
                         "boysaw", "boyspp"]
_ENRICH_G = 0.00025   # ~25 m Ortsraster


def _colour_from_elwis(val) -> str:
    """ELWIS COLOUR (['6'] oder ['4','1']) → S-57-String '6' / '4,1'."""
    if isinstance(val, list):
        return ",".join(str(v).strip() for v in val if str(v).strip())
    return str(val).strip() if val else ""


def enrich_from_elwis(buoys: List[Dict[str, Any]]) -> int:
    """Farblose OSM-Marken mit colour/topshp aus co-lokalen ELWIS-Marken fuellen.

    Baut ein ~25-m-Raster der ELWIS-Marken (Farbe/Toppzeichen) und uebertraegt
    es auf OSM-Marken ohne Farbe. Gibt die Zahl gefaerbter Marken zurueck.
    """
    if not _ELWIS_CHARTS.exists():
        return 0
    grid: Dict[str, tuple] = {}
    for cls in _ELWIS_ENRICH_CLASSES:
        for f in glob.glob(str(_ELWIS_CHARTS / "*" / "geojson" / f"{cls}.geojson")):
            try:
                with open(f, encoding="utf-8") as fh:
                    d = json.load(fh)
            except Exception:
                continue
            for ft in d.get("features", []):
                g = ft.get("geometry")
                if not g or g.get("type") != "Point":
                    continue
                lon, lat = g["coordinates"][:2]
                p = ft.get("properties") or {}
                col = _colour_from_elwis(p.get("COLOUR"))
                top = p.get("TOPSHP")
                if not col and top is None:
                    continue
                key = f"{round(lon / _ENRICH_G)}:{round(lat / _ENRICH_G)}"
                # Erste (farbige) Marke je Zelle gewinnt; farbige bevorzugen.
                if key not in grid or (col and not grid[key][0]):
                    grid[key] = (col, top)
    if not grid:
        return 0

    def _near(lon, lat):
        cx, cy = round(lon / _ENRICH_G), round(lat / _ENRICH_G)
        for dx in (0, -1, 1):
            for dy in (0, -1, 1):
                v = grid.get(f"{cx + dx}:{cy + dy}")
                if v and v[0]:
                    return v
        return None

    n = 0
    for b in buoys:
        if b.get("kind") == "sign":
            continue   # CEVNI-Schilder haben keine colour
        if b.get("colour"):
            continue   # OSM hat schon eine Farbe → nichts tun
        lat, lon = b.get("lat"), b.get("lon")
        if lat is None or lon is None:
            continue
        v = _near(lon, lat)
        if not v:
            continue
        col, top = v
        if col:
            b["colour"] = col
            n += 1
        if b.get("topshp") is None and top is not None:
            try:
                b["topshp"] = int(top)
            except Exception:
                pass
    return n


def overpass_query(bbox: str, timeout: int = 120) -> str:
    """Overpass-QL fuer alle Tonnen-/Baken-Typen in einer bbox ('la1,lo1,la2,lo2')."""
    parts = []
    for t in _OVERPASS_TYPES:
        parts.append(f'node["seamark:type"="{t}"]({bbox});')
        parts.append(f'way["seamark:type"="{t}"]({bbox});')
    body = "\n      ".join(parts)
    return f"""
    [out:json][timeout:{timeout}];
    (
      {body}
    );
    out body center qt;
    """
