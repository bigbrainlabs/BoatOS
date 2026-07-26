"""
Display-Strom per GPIO-Relais schalten (permanenter Einbau / BoatOpenIO).

Der Pi läuft 24/7 durch (sammelt Sensordaten, steuert Aktoren); nur der
Bildschirm wird per Relais stromlos geschaltet. Software-Wege greifen hier
NICHT: unter KMS hält flutter-pi den DRM-Master → `vcgencmd display_power`
wirkungslos; der HDMI-Monitor hat kein Backlight-Sysfs und kein CEC. Ein
Relais auf der Display-Versorgung ist definitiv (0 W im Aus) und
display-unabhängig.

Konfiguration in data/settings.json:
  "system": { "display": {
      "relayGpio": 17,        // BCM-Pin des Relais (Pflicht, sonst No-op)
      "activeLow": false,     // true bei Low-aktiven Relais-Boards
      "wakeGpio": 27,         // optional: Taster-Eingang zum Aufwecken
      "wakeActiveLow": true   // Taster gegen GND + Pull-up
  }}

GPIO via `pinctrl` (läuft als boatos-User, gpio-Gruppe, kein sudo nötig).

WICHTIG (Verdrahtung): Kappt das Relais die GESAMTE Display-Versorgung, ist
auch der Touch aus → Aufwecken braucht einen Hardware-Taster (wakeGpio) oder
einen Auto-On-Trigger (Zündung/Zeitplan). Nur wenn der Touch separat versorgt
bleibt, weckt Touch.
"""
import json
import subprocess
import threading
import time

_SETTINGS = "data/settings.json"


def _cfg() -> dict:
    try:
        return (json.load(open(_SETTINGS)).get("system", {}) or {}).get("display", {}) or {}
    except Exception:
        return {}


def _relay():
    d = _cfg()
    pin = d.get("relayGpio")
    return (int(pin) if pin is not None else None), bool(d.get("activeLow", False))


def is_configured() -> bool:
    return _relay()[0] is not None


def _pin_level(pin: int):
    """True=high, False=low, None=unbekannt. `pinctrl get` gibt '… | hi/lo …'."""
    try:
        out = subprocess.run(["pinctrl", "get", str(pin)],
                             capture_output=True, text=True, timeout=3).stdout.lower()
    except Exception:
        return None
    if "| hi" in out:
        return True
    if "| lo" in out:
        return False
    return None


def get_state():
    """True=Display an, False=aus, None=nicht konfiguriert/unbekannt."""
    pin, active_low = _relay()
    if pin is None:
        return None
    lvl = _pin_level(pin)
    if lvl is None:
        return None
    return (not lvl) if active_low else lvl


def set_state(on: bool) -> bool:
    """Display an/aus. True bei Erfolg, False wenn nicht konfiguriert/Fehler."""
    pin, active_low = _relay()
    if pin is None:
        return False
    want_high = (bool(on) != active_low)  # active_low: an → Pin low
    try:
        subprocess.run(["pinctrl", "set", str(pin), "op", "dh" if want_high else "dl"],
                       check=True, timeout=3)
        return True
    except Exception:
        return False


# ── Wake-Taster (GPIO-Eingang) ───────────────────────────────────────────────
_wake_thread = None


def start_wake_watcher():
    """Pollt den Wake-Taster; bei Druck → Display an. No-op wenn nicht
    konfiguriert. Beim Backend-Start aufrufen."""
    global _wake_thread
    if _wake_thread is not None:
        return
    d = _cfg()
    wpin = d.get("wakeGpio")
    if wpin is None:
        return
    wpin = int(wpin)
    active_low = bool(d.get("wakeActiveLow", True))
    # Eingang mit Pull-up (Taster gegen GND) konfigurieren
    try:
        subprocess.run(["pinctrl", "set", str(wpin), "ip", "pu" if active_low else "pd"],
                       timeout=3)
    except Exception:
        pass

    def loop():
        prev = None
        while True:
            lvl = _pin_level(wpin)
            if lvl is not None:
                pressed = (not lvl) if active_low else lvl
                if pressed and prev is False:  # steigende Flanke = Tastendruck
                    set_state(True)
                prev = pressed
            time.sleep(0.25)

    _wake_thread = threading.Thread(target=loop, daemon=True)
    _wake_thread.start()
