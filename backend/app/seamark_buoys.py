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


def parse_element(element: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """OSM-Element (node/way) → normalisierte Tonne oder None.

    Rueckgabe traegt die S-57-Vokabel, die die Darstellung schon versteht:
        {id, cls, colour, topshp, catcam, lat, lon, name}
    """
    tags = element.get("tags") or {}
    st = tags.get("seamark:type")
    cls = _TYPE_CLS.get(st)
    if not cls:
        return None

    if element.get("type") == "node":
        lat, lon = element.get("lat"), element.get("lon")
    elif "center" in element:
        lat = element["center"].get("lat")
        lon = element["center"].get("lon")
    else:
        return None
    if lat is None or lon is None:
        return None

    return {
        "id": f"{element.get('type', 'n')[0]}{element.get('id')}",
        "cls": cls,
        "colour": _colour_string(tags, st),
        "topshp": _topshp(tags),
        "catcam": _catcam(tags, st),
        "lat": lat,
        "lon": lon,
        "name": _name(tags),
    }


# Seamark-Typen fuer die Overpass-Abfrage: NUR schwimmende Tonnen (buoy_*).
#
# Baken (beacon_*) sind ufer-/pfahlmontiert und decken sich mit den ELWIS-
# Tagesmarken/Toppzeichen (daymar/topmar) — am selben Ort erfasst BEIDE Quellen
# dieselbe Marke. Ausserdem rendert die 3D-Szene sie als schwimmenden
# Tonnenkoerper statt als Pfahlzeichen. Beides zusammen gab am Ufer doppelte,
# falsch dargestellte Zeichen. Die Ufer-/Pfahlzeichen kommen daher weiter aus
# ELWIS; OSM steuert nur die schwimmende Betonnung bei, die ELWIS fehlt.
# (Beacons liessen sich spaeter als echte Pfahlzeichen ergaenzen, falls in
# Revieren ohne ELWIS-Abdeckung gebraucht.)
_OVERPASS_TYPES = [
    "buoy_lateral", "buoy_cardinal", "buoy_isolated_danger", "buoy_safe_water",
    "buoy_special_purpose",
]


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
