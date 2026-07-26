"""
Weather Alerts Module
Fetches severe weather warnings from DWD via Bright Sky API
"""
import aiohttp
from datetime import datetime
from typing import List, Dict, Any

BRIGHTSKY_API_URL = "https://api.brightsky.dev"

# Cache for alerts
alerts_cache: Dict[str, Any] = {
    "alerts": [],
    "last_updated": None,
    "location": None
}

def is_valid_alert(alert: Dict[str, Any]) -> bool:
    """
    Check if alert contains useful information

    Filters out alerts with:
    - "Unknown Event" AND no headline/description/instruction

    Args:
        alert: Alert dict from Bright Sky API

    Returns:
        bool: True if alert is valid and useful
    """
    event = alert.get("event", "")
    headline = alert.get("headline", "")
    description = alert.get("description", "")
    instruction = alert.get("instruction", "")

    # If event is "Unknown Event" and no other useful info, filter it out
    if event == "Unknown Event" or not event:
        has_info = bool(headline or description or instruction)
        return has_info

    # Event name exists and is not "Unknown Event" - keep it
    return True

async def fetch_weather_alerts(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch weather alerts for a given location from Bright Sky (DWD data)

    Args:
        lat: Latitude
        lon: Longitude

    Returns:
        Dict with alerts and metadata
    """
    global alerts_cache

    try:
        async with aiohttp.ClientSession() as session:
            url = f"{BRIGHTSKY_API_URL}/alerts?lat={lat}&lon={lon}"

            async with session.get(url) as resp:
                if resp.status == 200:
                    data = await resp.json()

                    # Filter out invalid/useless alerts
                    raw_alerts = data.get("alerts", [])
                    valid_alerts = [alert for alert in raw_alerts if is_valid_alert(alert)]

                    filtered_count = len(raw_alerts) - len(valid_alerts)
                    if filtered_count > 0:
                        print(f"🗑️ Filtered out {filtered_count} invalid alert(s)")

                    # Bright Sky liefert die amtliche Warnzelle mit Namen mit
                    # (z.B. "Stadt Aken (Elbe)") — die wurde bisher weggeworfen,
                    # dadurch war nie erkennbar, WOFÜR die Warnung gilt.
                    loc = data.get("location") or {}
                    place = loc.get("name") or loc.get("name_short") or ""

                    alerts_cache = {
                        "alerts": valid_alerts,
                        "last_updated": datetime.now().isoformat(),
                        "location": {"lat": lat, "lon": lon, "name": place,
                                     "district": loc.get("district"),
                                     "state": loc.get("state")},
                        "count": len(valid_alerts)
                    }

                    print(f"✅ Weather alerts updated: {alerts_cache['count']} active warning(s)")
                    return alerts_cache
                else:
                    print(f"⚠️ Weather alerts API error: {resp.status}")
                    return alerts_cache
    except Exception as e:
        print(f"⚠️ Weather alerts fetch error: {e}")
        return alerts_cache

OWM_ONECALL_URL = "https://api.openweathermap.org/data/3.0/onecall"


async def fetch_owm_alerts(lat: float, lon: float, api_key: str) -> Dict[str, Any]:
    """
    Warnungen über OpenWeather One Call 3.0 — OPT-IN, braucht ein eigenes Abo.

    Wichtig: One Call 3.0 ist ein SEPARATES Produkt. Der normale 2.5-Key (den
    BoatOS für Wetter/Vorhersage nutzt) funktioniert hier erst, wenn zusätzlich
    "One Call by Call" abonniert wurde — sonst antwortet die API mit 401.

    Für Deutschland reicht OpenWeather ohnehin die DWD-Warnungen nur durch; der
    Mehrwert liegt im AUSLAND, wo Bright Sky nichts liefert.

    OWM liefert KEINEN Schweregrad (anders als der DWD). Wir setzen daher
    'Moderate' als neutrale Vorgabe — lieber eine Stufe zu vorsichtig als eine
    erfundene Einordnung.
    """
    global alerts_cache

    if not api_key:
        return {"alerts": [], "last_updated": None, "location": None, "count": 0,
                "error": "Kein OpenWeather-API-Key hinterlegt"}

    try:
        async with aiohttp.ClientSession() as session:
            url = (f"{OWM_ONECALL_URL}?lat={lat}&lon={lon}&appid={api_key}"
                   f"&exclude=minutely,hourly,daily,current&units=metric&lang=de")
            async with session.get(url) as resp:
                if resp.status == 401:
                    msg = ("OpenWeather One Call 3.0 nicht freigeschaltet — dafür ist ein "
                           "separates 'One Call by Call'-Abo nötig")
                    print(f"⚠️ {msg}")
                    return {"alerts": [], "last_updated": None, "location": None,
                            "count": 0, "error": msg}
                if resp.status != 200:
                    msg = f"OpenWeather One Call HTTP {resp.status}"
                    print(f"⚠️ {msg}")
                    return {"alerts": [], "last_updated": None, "location": None,
                            "count": 0, "error": msg}

                data = await resp.json()
                alerts = []
                for a in data.get("alerts", []) or []:
                    alerts.append({
                        "id": f"owm-{a.get('start')}-{a.get('event')}",
                        "event": a.get("event") or "Warnung",
                        "headline": a.get("sender_name") or "",
                        "description": a.get("description") or "",
                        "instruction": "",
                        "severity": "Moderate",     # OWM liefert keine Stufe
                        "onset": _from_unix(a.get("start")),
                        "effective": _from_unix(a.get("start")),
                        "expires": _from_unix(a.get("end")),
                        "urgency": "",
                        "category": ", ".join(a.get("tags") or []),
                    })

                alerts_cache = {
                    "alerts": alerts,
                    "last_updated": datetime.now().isoformat(),
                    "location": {"lat": lat, "lon": lon},
                    "count": len(alerts),
                }
                print(f"✅ OpenWeather-Warnungen: {len(alerts)} aktiv")
                return alerts_cache
    except Exception as e:
        print(f"⚠️ OpenWeather alerts fetch error: {e}")
        return {"alerts": [], "last_updated": None, "location": None,
                "count": 0, "error": str(e)}


def _from_unix(ts):
    try:
        return datetime.fromtimestamp(int(ts)).isoformat()
    except Exception:
        return None


def get_cached_alerts() -> Dict[str, Any]:
    """Get cached alerts without making a new API call"""
    return alerts_cache

def get_alert_severity_level(severity: str) -> int:
    """
    Convert DWD severity to numeric level for UI

    DWD Severity levels:
    - Minor: Level 1 (Yellow)
    - Moderate: Level 2 (Orange)
    - Severe: Level 3 (Red)
    - Extreme: Level 4 (Dark Red)

    Args:
        severity: DWD severity string

    Returns:
        int: Numeric level (1-4)
    """
    severity_map = {
        "Minor": 1,
        "Moderate": 2,
        "Severe": 3,
        "Extreme": 4
    }
    return severity_map.get(severity, 1)

def get_alert_color(severity: str) -> str:
    """
    Get color code for alert severity

    Args:
        severity: DWD severity string

    Returns:
        str: Hex color code
    """
    color_map = {
        "Minor": "#FFD700",      # Yellow
        "Moderate": "#FF8C00",   # Orange
        "Severe": "#FF4500",     # Red-Orange
        "Extreme": "#8B0000"     # Dark Red
    }
    return color_map.get(severity, "#FFD700")

def filter_alerts_by_severity(alerts: List[Dict], min_severity: int = 1) -> List[Dict]:
    """
    Filter alerts by minimum severity level

    Args:
        alerts: List of alert dicts
        min_severity: Minimum severity level (1-4)

    Returns:
        List of filtered alerts
    """
    return [
        alert for alert in alerts
        if get_alert_severity_level(alert.get("severity", "Minor")) >= min_severity
    ]

def get_highest_severity_alert(alerts: List[Dict]) -> Dict[str, Any]:
    """
    Get the most severe alert from a list

    Args:
        alerts: List of alert dicts

    Returns:
        Dict with highest severity alert or None
    """
    if not alerts:
        return None

    return max(
        alerts,
        key=lambda a: get_alert_severity_level(a.get("severity", "Minor"))
    )

def format_alert_for_ui(alert: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format alert data for frontend display

    Args:
        alert: Raw alert dict from Bright Sky

    Returns:
        Formatted alert dict
    """
    severity = alert.get("severity", "Minor")

    return {
        "id": alert.get("id"),
        "event": alert.get("event", "Unknown Event"),
        "headline": alert.get("headline", ""),
        "description": alert.get("description", ""),
        "severity": severity,
        "severity_level": get_alert_severity_level(severity),
        "color": get_alert_color(severity),
        "effective": alert.get("effective"),
        "onset": alert.get("onset"),
        "expires": alert.get("expires"),
        "instruction": alert.get("instruction", ""),
        "urgency": alert.get("urgency", ""),
        "category": alert.get("category", "")
    }
