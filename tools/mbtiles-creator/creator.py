import os
import sqlite3
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import subprocess
import ctypes
import json
import re
import shutil
import sys
from datetime import datetime, timedelta
from pathlib import Path

import requests

if getattr(sys, 'frozen', False):
    WORK_DIR = Path(sys.executable).parent
else:
    WORK_DIR = Path(__file__).parent
TMP_DIR = WORK_DIR / "tmp"
CONFIG_FILE = WORK_DIR / "creator_config.json"
PLANETILER_JAR = WORK_DIR / "planetiler.jar"


def _load_config() -> dict:
    try:
        return json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _save_config(data: dict):
    try:
        CONFIG_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")
    except Exception:
        pass


def _available_ram_gb() -> int:
    try:
        class MEMORYSTATUSEX(ctypes.Structure):
            _fields_ = [
                ("dwLength", ctypes.c_ulong),
                ("dwMemoryLoad", ctypes.c_ulong),
                ("ullTotalPhys", ctypes.c_ulonglong),
                ("ullAvailPhys", ctypes.c_ulonglong),
                ("ullTotalPageFile", ctypes.c_ulonglong),
                ("ullAvailPageFile", ctypes.c_ulonglong),
                ("ullTotalVirtual", ctypes.c_ulonglong),
                ("ullAvailVirtual", ctypes.c_ulonglong),
                ("sullAvailExtendedVirtual", ctypes.c_ulonglong),
            ]
        stat = MEMORYSTATUSEX()
        stat.dwLength = ctypes.sizeof(stat)
        ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(stat))
        return max(2, int(stat.ullAvailPhys / 1e9) - 1)
    except Exception:
        return 4


# ── Translations ──────────────────────────────────────────────────────────────

TRANSLATIONS = {
    'de': {
        'title':            'BoatOS MBTiles Creator',
        'lbl_region':       'Region:',
        'lbl_pi':           'Pi-Adresse:',
        'btn_start_upload': 'Start (Upload)',
        'btn_save':         'In Ordner speichern',
        'btn_cancel':       'Abbrechen',
        'lbl_log':          'Log',
        'btn_lang':         'EN',
        'folder_dialog':    'Zielordner wählen',
        # Pipeline steps
        'step1':            '[1/4] Prüfe Java...',
        'step2':            '[2/4] Prüfe planetiler.jar...',
        'step3':            '[3/4] Lade OSM-Kartendaten herunter...',
        'step4':            '[4/4] Konvertiere mit planetiler...',
        'step5_upload':     '[5/5] Lade auf Pi hoch...',
        'step5_save':       '[5/5] Kopiere in Zielordner...',
        # Java
        'java_not_found':   '[Fehler] Java nicht gefunden.',
        'java_hint':        '  Bitte Java 21 installieren: https://www.java.com/de/download/',
        'java_err_title':   'Java fehlt',
        'java_err_msg':     (
            'Java wurde nicht gefunden.\n\n'
            'Bitte installiere Java 21 von:\nhttps://www.java.com/de/download/\n\n'
            'Danach BoatOS MBTiles Creator neu starten.'
        ),
        'java_warn':        '  Warnung: Java {ver} — Java 21 empfohlen. Versuche trotzdem...',
        'java_ok':          '  Java {ver} OK.',
        # Planetiler
        'pt_found':         '  planetiler.jar vorhanden ({mb:.0f} MB).',
        'pt_downloading':   '  Nicht gefunden — lade herunter...',
        'pt_version':       '  Version: {tag} ({mb:.0f} MB)',
        'pt_no_asset':      '[Fehler] planetiler.jar nicht im Release gefunden.',
        'pt_ready':         'planetiler.jar bereit.',
        # OSM download
        'osm_source':       '  Quelle: {url}',
        'osm_cached':       '  Bereits vorhanden ({days}d alt) — überspringe Download.',
        'osm_invalid':      '  Datei unvollständig — lade neu herunter.',
        'osm_progress':     'OSM-Download: {dl:.1f} / {total:.1f} MB',
        'osm_progress_unk': 'OSM-Download: {dl:.1f} MB',
        'osm_done':         '  Download abgeschlossen ({mb:.1f} MB).',
        # Conversion
        'conv_cached':      '  Bereits vorhanden ({days}d alt) — überspringe Konvertierung.',
        'conv_invalid':     '  MBTiles unvollständig oder beschädigt — konvertiere neu.',
        'conv_running':     'Konvertierung läuft...',
        'conv_ram':         '  RAM für Java: {xmx} GB',
        'conv_progress':    'Konvertierung: {pct:.0f}%',
        'conv_done':        '  Konvertierung abgeschlossen ({mb:.1f} MB).',
        'conv_err_exit':    '  [Fehler] planetiler Exitcode: {code}',
        'conv_err_nofile':  '  [Fehler] Ausgabedatei nicht erzeugt.',
        # Upload / save
        'upload_post':      '  POST {url}',
        'upload_progress':  'Upload: {ul:.1f} / {total:.1f} MB',
        'upload_ok':        '  Upload erfolgreich (HTTP {status}).',
        'save_copying':     'Kopiere nach {dest}...',
        'save_done':        '  Gespeichert: {dest}',
        # Generic
        'header':           '=== BoatOS MBTiles Creator ===',
        'lbl_region_log':   'Region: {name}',
        'lbl_output_log':   'Ausgabe: {name}',
        'cancelled':        '  [Abgebrochen]',
        'cancel_req':       '[Abbrechen angefordert...]',
        'done':             'Fertig.',
        'error':            '[Fehler] {e}',
        'error_indent':     '  [Fehler] {e}',
        # Seamarks
        'step_sm_convert':  '[+] Extrahiere Seezeichen (offline)...',
        'sm_running':       'Seezeichen-Konvertierung läuft...',
        'sm_cached':        '  Seezeichen bereits vorhanden ({days}d alt) — überspringe.',
        'sm_done':          '  Seezeichen fertig ({mb:.1f} MB).',
        'sm_fail':          '  Seezeichen-Konvertierung fehlgeschlagen — überspringe.',
        'step_sm_upload':   '[+] Lade Seezeichen auf Pi hoch...',
        'step_sm_save':     '[+] Speichere Seezeichen...',
        # Routing graph
        'chk_routing':      'auch Routing-Daten erstellen (für Routen über Ländergrenzen)',
        'step_routing':     '[+] Erstelle Wasserstraßen-Routing-Graph...',
        'routing_install':  '  Installiere osmium-Bibliothek...',
        'routing_nodes':    '  {nodes} Knoten, {edges} Kanten gefunden.',
        'routing_write':    '  Schreibe {name}...',
        'routing_done':     '  Routing-Datei: {name} ({mb:.1f} MB)',
        'routing_skip':     '  osmium nicht verfügbar — Routing übersprungen.',
        'routing_upload':   '[+] Lade Routing-Datei auf Pi hoch...',
        'routing_save':     '[+] Speichere Routing-Datei...',
    },
    'en': {
        'title':            'BoatOS MBTiles Creator',
        'lbl_region':       'Region:',
        'lbl_pi':           'Pi Address:',
        'btn_start_upload': 'Start (Upload)',
        'btn_save':         'Save to Folder',
        'btn_cancel':       'Cancel',
        'lbl_log':          'Log',
        'btn_lang':         'DE',
        'folder_dialog':    'Choose destination folder',
        # Pipeline steps
        'step1':            '[1/4] Checking Java...',
        'step2':            '[2/4] Checking planetiler.jar...',
        'step3':            '[3/4] Downloading OSM map data...',
        'step4':            '[4/4] Converting with planetiler...',
        'step5_upload':     '[5/5] Uploading to Pi...',
        'step5_save':       '[5/5] Copying to folder...',
        # Java
        'java_not_found':   '[Error] Java not found.',
        'java_hint':        '  Please install Java 21: https://www.java.com/download/',
        'java_err_title':   'Java missing',
        'java_err_msg':     (
            'Java was not found.\n\n'
            'Please install Java 21 from:\nhttps://www.java.com/download/\n\n'
            'Then restart BoatOS MBTiles Creator.'
        ),
        'java_warn':        '  Warning: Java {ver} — Java 21 recommended. Trying anyway...',
        'java_ok':          '  Java {ver} OK.',
        # Planetiler
        'pt_found':         '  planetiler.jar found ({mb:.0f} MB).',
        'pt_downloading':   '  Not found — downloading...',
        'pt_version':       '  Version: {tag} ({mb:.0f} MB)',
        'pt_no_asset':      '[Error] planetiler.jar not found in release.',
        'pt_ready':         'planetiler.jar ready.',
        # OSM download
        'osm_source':       '  Source: {url}',
        'osm_cached':       '  Already downloaded ({days}d old) — skipping.',
        'osm_invalid':      '  File incomplete — re-downloading.',
        'osm_progress':     'OSM Download: {dl:.1f} / {total:.1f} MB',
        'osm_progress_unk': 'OSM Download: {dl:.1f} MB',
        'osm_done':         '  Download complete ({mb:.1f} MB).',
        # Conversion
        'conv_cached':      'Already converted ({days}d old) — skipping conversion.',
        'conv_invalid':     '  MBTiles incomplete or corrupted — re-converting.',
        'conv_running':     'Conversion running...',
        'conv_ram':         '  RAM for Java: {xmx} GB',
        'conv_progress':    'Converting: {pct:.0f}%',
        'conv_done':        '  Conversion complete ({mb:.1f} MB).',
        'conv_err_exit':    '  [Error] planetiler exit code: {code}',
        'conv_err_nofile':  '  [Error] Output file not created.',
        # Upload / save
        'upload_post':      '  POST {url}',
        'upload_progress':  'Upload: {ul:.1f} / {total:.1f} MB',
        'upload_ok':        '  Upload successful (HTTP {status}).',
        'save_copying':     'Copying to {dest}...',
        'save_done':        '  Saved: {dest}',
        # Generic
        'header':           '=== BoatOS MBTiles Creator ===',
        'lbl_region_log':   'Region: {name}',
        'lbl_output_log':   'Output: {name}',
        'cancelled':        '  [Cancelled]',
        'cancel_req':       '[Cancel requested...]',
        'done':             'Done.',
        'error':            '[Error] {e}',
        'error_indent':     '  [Error] {e}',
        # Seamarks
        'step_sm_convert':  '[+] Extracting seamarks (offline)...',
        'sm_running':       'Seamark conversion running...',
        'sm_cached':        '  Seamarks already present ({days}d old) — skipping.',
        'sm_done':          '  Seamarks done ({mb:.1f} MB).',
        'sm_fail':          '  Seamark conversion failed — skipping.',
        'step_sm_upload':   '[+] Uploading seamarks to Pi...',
        'step_sm_save':     '[+] Saving seamarks...',
        # Routing graph
        'chk_routing':      'also build routing data (for cross-border routes)',
        'step_routing':     '[+] Building waterway routing graph...',
        'routing_install':  '  Installing osmium library...',
        'routing_nodes':    '  {nodes} nodes, {edges} edges found.',
        'routing_write':    '  Writing {name}...',
        'routing_done':     '  Routing file: {name} ({mb:.1f} MB)',
        'routing_skip':     '  osmium not available — skipping routing.',
        'routing_upload':   '[+] Uploading routing file to Pi...',
        'routing_save':     '[+] Saving routing file...',
    },
}


# ── Planetiler YAML schema for seamark extraction ─────────────────────────────

SEAMARK_SCHEMA_YAML = """\
schema_name: BoatOS Seamarks
schema_description: Offline seamark data for marine navigation (buoys, beacons, lights)
attribution: "© OpenSeaMap contributors, © OpenStreetMap contributors"

sources:
  osm:
    type: osm

layers:
  - id: seamark
    features:
      - source: osm
        geometry: point
        min_zoom: 8
        include_when:
          "seamark:type": __any__
        attributes:
          - key: type
            tag_value: "seamark:type"
          - key: name
            tag_value: name
          - key: category
            tag_value: "seamark:category"
          - key: colour
            tag_value: "seamark:colour"
          - key: colour_pattern
            tag_value: "seamark:colour_pattern"
          - key: shape
            tag_value: "seamark:shape"
          - key: topmark_shape
            tag_value: "seamark:topmark:shape"
          - key: topmark_colour
            tag_value: "seamark:topmark:colour"
          - key: light_char
            tag_value: "seamark:light:character"
          - key: light_colour
            tag_value: "seamark:light:colour"
          - key: light_period
            tag_value: "seamark:light:period"
"""


# ── Regions: (de_name, en_name, url) ─────────────────────────────────────────

REGIONS = [
    # ── Deutschland / Germany ─────────────────────────────────────────────────
    ("Deutschland",                  "Germany",                       "https://download.geofabrik.de/europe/germany-latest.osm.pbf"),
    ("DE · Baden-Württemberg",       "DE · Baden-Württemberg",        "https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf"),
    ("DE · Bayern",                  "DE · Bavaria",                  "https://download.geofabrik.de/europe/germany/bavaria-latest.osm.pbf"),
    ("DE · Berlin",                  "DE · Berlin",                   "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"),
    ("DE · Brandenburg",             "DE · Brandenburg",              "https://download.geofabrik.de/europe/germany/brandenburg-latest.osm.pbf"),
    ("DE · Bremen",                  "DE · Bremen",                   "https://download.geofabrik.de/europe/germany/bremen-latest.osm.pbf"),
    ("DE · Hamburg",                 "DE · Hamburg",                  "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf"),
    ("DE · Hessen",                  "DE · Hesse",                    "https://download.geofabrik.de/europe/germany/hessen-latest.osm.pbf"),
    ("DE · Mecklenburg-Vorpommern",  "DE · Mecklenburg-Vorpommern",   "https://download.geofabrik.de/europe/germany/mecklenburg-vorpommern-latest.osm.pbf"),
    ("DE · Niedersachsen",           "DE · Lower Saxony",             "https://download.geofabrik.de/europe/germany/lower-saxony-latest.osm.pbf"),
    ("DE · Nordrhein-Westfalen",     "DE · North Rhine-Westphalia",   "https://download.geofabrik.de/europe/germany/nordrhein-westfalen-latest.osm.pbf"),
    ("DE · Rheinland-Pfalz",         "DE · Rhineland-Palatinate",     "https://download.geofabrik.de/europe/germany/rheinland-pfalz-latest.osm.pbf"),
    ("DE · Saarland",                "DE · Saarland",                 "https://download.geofabrik.de/europe/germany/saarland-latest.osm.pbf"),
    ("DE · Sachsen",                 "DE · Saxony",                   "https://download.geofabrik.de/europe/germany/saxony-latest.osm.pbf"),
    ("DE · Sachsen-Anhalt",          "DE · Saxony-Anhalt",            "https://download.geofabrik.de/europe/germany/saxony-anhalt-latest.osm.pbf"),
    ("DE · Schleswig-Holstein",      "DE · Schleswig-Holstein",       "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf"),
    ("DE · Thüringen",               "DE · Thuringia",                "https://download.geofabrik.de/europe/germany/thuringia-latest.osm.pbf"),
    # ── Mitteleuropa / Central Europe ────────────────────────────────────────
    ("Niederlande",                  "Netherlands",                   "https://download.geofabrik.de/europe/netherlands-latest.osm.pbf"),
    ("Belgien",                      "Belgium",                       "https://download.geofabrik.de/europe/belgium-latest.osm.pbf"),
    ("Luxemburg",                    "Luxembourg",                    "https://download.geofabrik.de/europe/luxembourg-latest.osm.pbf"),
    ("Frankreich",                   "France",                        "https://download.geofabrik.de/europe/france-latest.osm.pbf"),
    ("Schweiz",                      "Switzerland",                   "https://download.geofabrik.de/europe/switzerland-latest.osm.pbf"),
    ("Österreich",                   "Austria",                       "https://download.geofabrik.de/europe/austria-latest.osm.pbf"),
    ("Tschechien",                   "Czech Republic",                "https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf"),
    ("Polen",                        "Poland",                        "https://download.geofabrik.de/europe/poland-latest.osm.pbf"),
    ("Slowakei",                     "Slovakia",                      "https://download.geofabrik.de/europe/slovakia-latest.osm.pbf"),
    ("Ungarn",                       "Hungary",                       "https://download.geofabrik.de/europe/hungary-latest.osm.pbf"),
    # ── Nordeuropa / Northern Europe ─────────────────────────────────────────
    ("Dänemark",                     "Denmark",                       "https://download.geofabrik.de/europe/denmark-latest.osm.pbf"),
    ("Schweden",                     "Sweden",                        "https://download.geofabrik.de/europe/sweden-latest.osm.pbf"),
    ("Norwegen",                     "Norway",                        "https://download.geofabrik.de/europe/norway-latest.osm.pbf"),
    ("Finnland",                     "Finland",                       "https://download.geofabrik.de/europe/finland-latest.osm.pbf"),
    ("Island",                       "Iceland",                       "https://download.geofabrik.de/europe/iceland-latest.osm.pbf"),
    # ── Britische Inseln / British Isles ─────────────────────────────────────
    ("Großbritannien",               "Great Britain",                  "https://download.geofabrik.de/europe/great-britain-latest.osm.pbf"),
    ("GB · England",                 "GB · England",                  "https://download.geofabrik.de/europe/great-britain/england-latest.osm.pbf"),
    ("GB · Scotland",                "GB · Scotland",                 "https://download.geofabrik.de/europe/great-britain/scotland-latest.osm.pbf"),
    ("GB · Wales",                   "GB · Wales",                    "https://download.geofabrik.de/europe/great-britain/wales-latest.osm.pbf"),
    ("Irland",                       "Ireland",                       "https://download.geofabrik.de/europe/ireland-and-northern-ireland-latest.osm.pbf"),
    # ── Südeuropa / Southern Europe ──────────────────────────────────────────
    ("Spanien",                      "Spain",                         "https://download.geofabrik.de/europe/spain-latest.osm.pbf"),
    ("Portugal",                     "Portugal",                      "https://download.geofabrik.de/europe/portugal-latest.osm.pbf"),
    ("Italien",                      "Italy",                         "https://download.geofabrik.de/europe/italy-latest.osm.pbf"),
    ("Kroatien",                     "Croatia",                       "https://download.geofabrik.de/europe/croatia-latest.osm.pbf"),
    ("Slowenien",                    "Slovenia",                      "https://download.geofabrik.de/europe/slovenia-latest.osm.pbf"),
    ("Griechenland",                 "Greece",                        "https://download.geofabrik.de/europe/greece-latest.osm.pbf"),
    ("Türkei",                       "Turkey",                        "https://download.geofabrik.de/europe/turkey-latest.osm.pbf"),
    # ── Osteuropa / Eastern Europe ───────────────────────────────────────────
    ("Estland",                      "Estonia",                       "https://download.geofabrik.de/europe/estonia-latest.osm.pbf"),
    ("Lettland",                     "Latvia",                        "https://download.geofabrik.de/europe/latvia-latest.osm.pbf"),
    ("Litauen",                      "Lithuania",                     "https://download.geofabrik.de/europe/lithuania-latest.osm.pbf"),
    ("Russland (Europa)",            "Russia (Europe)",               "https://download.geofabrik.de/europe/russia-latest.osm.pbf"),
    # ── Nordamerika / North America ──────────────────────────────────────────
    ("USA (gesamt)",                 "USA (all)",                     "https://download.geofabrik.de/north-america/us-latest.osm.pbf"),
    ("USA · Florida",                "USA · Florida",                 "https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf"),
    ("USA · New York",               "USA · New York",                "https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf"),
    ("USA · Texas",                  "USA · Texas",                   "https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf"),
    ("USA · California",             "USA · California",              "https://download.geofabrik.de/north-america/us/california-latest.osm.pbf"),
    ("USA · Great Lakes (Michigan)", "USA · Great Lakes (Michigan)",  "https://download.geofabrik.de/north-america/us/michigan-latest.osm.pbf"),
    ("Kanada",                       "Canada",                        "https://download.geofabrik.de/north-america/canada-latest.osm.pbf"),
    ("Kanada · British Columbia",    "Canada · British Columbia",     "https://download.geofabrik.de/north-america/canada/british-columbia-latest.osm.pbf"),
    ("Kanada · Ontario",             "Canada · Ontario",              "https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf"),
    # ── Karibik / Caribbean ──────────────────────────────────────────────────
    ("Karibik",                      "Caribbean",                     "https://download.geofabrik.de/central-america-latest.osm.pbf"),
    # ── Australien & Pazifik / Australia & Pacific ───────────────────────────
    ("Australien",                   "Australia",                     "https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf"),
    ("Neuseeland",                   "New Zealand",                   "https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf"),
]


def pbf_to_mbtiles_name(url: str) -> str:
    basename = url.split("/")[-1]
    stem = basename.replace("-latest.osm.pbf", "").replace(".osm.pbf", "")
    return stem + ".mbtiles"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.resizable(True, True)
        self.minsize(660, 480)

        self._cancel_event = threading.Event()
        self._running = False
        self._java_exe: str = "java"
        self._region_idx: int = 0

        cfg = _load_config()
        self._lang = cfg.get("lang", "de")

        self._build_ui()
        self.title(self.t('title'))

    # ── i18n ──────────────────────────────────────────────────────────────────

    def t(self, key: str, **kwargs) -> str:
        s = TRANSLATIONS.get(self._lang, TRANSLATIONS['de']).get(key, key)
        return s.format(**kwargs) if kwargs else s

    def _toggle_lang(self):
        self._lang = 'en' if self._lang == 'de' else 'de'
        cfg = _load_config()
        cfg['lang'] = self._lang
        _save_config(cfg)
        self._update_ui_texts()

    def _update_ui_texts(self):
        self.title(self.t('title'))
        self._lbl_region.configure(text=self.t('lbl_region'))
        self._lbl_pi.configure(text=self.t('lbl_pi'))
        self._start_btn.configure(text=self.t('btn_start_upload'))
        self._save_btn.configure(text=self.t('btn_save'))
        self._cancel_btn.configure(text=self.t('btn_cancel'))
        self._log_frame.configure(text=self.t('lbl_log'))
        self._lang_btn.configure(text=self.t('btn_lang'))
        col = 0 if self._lang == 'de' else 1
        names = [r[col] for r in REGIONS]
        self._region_combo.configure(values=names)
        self._region_combo.current(self._region_idx)

    # ── Cache validation ──────────────────────────────────────────────────────

    def _is_valid_pbf(self, path: Path) -> bool:
        try:
            return path.stat().st_size > 10_000
        except Exception:
            return False

    def _is_valid_mbtiles(self, path: Path) -> bool:
        try:
            if path.stat().st_size < 4096:
                return False
            con = sqlite3.connect(f"file:{path}?mode=ro", uri=True, timeout=5)
            try:
                tables = {r[0] for r in con.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()}
                return "metadata" in tables and "tiles" in tables
            finally:
                con.close()
        except Exception:
            return False

    # ── Java detection ────────────────────────────────────────────────────────

    def _find_java_exe(self) -> str | None:
        found = shutil.which("java")
        if found:
            return found

        java_home = os.environ.get("JAVA_HOME", "")
        if java_home:
            candidate = Path(java_home) / "bin" / "java.exe"
            if candidate.exists():
                return str(candidate)

        try:
            import winreg
            for reg_path in [
                r"SOFTWARE\JavaSoft\JDK",
                r"SOFTWARE\JavaSoft\Java Development Kit",
                r"SOFTWARE\JavaSoft\Java Runtime Environment",
            ]:
                try:
                    with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, reg_path) as key:
                        cur = winreg.QueryValueEx(key, "CurrentVersion")[0]
                        with winreg.OpenKey(key, cur) as vk:
                            jh = winreg.QueryValueEx(vk, "JavaHome")[0]
                            candidate = Path(jh) / "bin" / "java.exe"
                            if candidate.exists():
                                return str(candidate)
                except Exception:
                    continue
        except Exception:
            pass

        oracle = Path("C:/Program Files/Common Files/Oracle/Java/javapath/java.exe")
        if oracle.exists():
            return str(oracle)

        for root in [
            Path("C:/Program Files/Java"),
            Path("C:/Program Files/Eclipse Adoptium"),
            Path("C:/Program Files/Microsoft"),
            Path("C:/Program Files/Eclipse Foundation"),
            Path("C:/Program Files/Amazon Corretto"),
            Path("C:/Program Files/Azul Systems/Zulu"),
            Path(os.environ.get("LOCALAPPDATA", "C:/x")) / "Programs" / "Eclipse Adoptium",
        ]:
            try:
                for entry in sorted(root.iterdir(), reverse=True):
                    candidate = entry / "bin" / "java.exe"
                    if candidate.exists():
                        return str(candidate)
            except Exception:
                continue

        return None

    def _java_version(self) -> tuple[str | None, str | None]:
        exe = self._find_java_exe()
        if not exe:
            return None, None
        try:
            r = subprocess.run(
                [exe, "-version"],
                capture_output=True, text=True, timeout=5,
            )
            out = r.stderr or r.stdout
            m = re.search(r'version "([^"]+)"', out)
            version = m.group(1) if m else "found"
            return version, exe
        except Exception:
            return None, None

    def _java_major(self, version_str: str) -> int:
        parts = version_str.split(".")
        major = int(parts[0]) if parts[0].isdigit() else 0
        if major == 1 and len(parts) > 1 and parts[1].isdigit():
            major = int(parts[1])
        return major

    # ── Planetiler download ───────────────────────────────────────────────────

    def _do_download_planetiler(self) -> bool:
        rel = requests.get(
            "https://api.github.com/repos/onthegomap/planetiler/releases/latest",
            timeout=15,
        ).json()
        tag = rel.get("tag_name", "?")
        asset = next(
            (a for a in rel.get("assets", []) if a["name"] == "planetiler.jar"),
            None,
        )
        if not asset:
            self._log_line(self.t('pt_no_asset'))
            return False

        url = asset["browser_download_url"]
        size_mb = asset["size"] / 1e6
        self._log_line(self.t('pt_version', tag=tag, mb=size_mb))

        tmp = WORK_DIR / "planetiler.jar.tmp"
        with requests.get(url, stream=True, timeout=600) as resp:
            resp.raise_for_status()
            total = int(resp.headers.get("content-length", 0))
            downloaded = 0
            with open(tmp, "wb") as f:
                for chunk in resp.iter_content(chunk_size=65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total:
                        pct = downloaded / total * 100
                        self._set_progress(
                            pct,
                            f"planetiler.jar: {downloaded/1e6:.1f} / {total/1e6:.1f} MB",
                        )

        tmp.replace(PLANETILER_JAR)
        self._set_progress(100, self.t('pt_ready'))
        return True

    # ── UI ────────────────────────────────────────────────────────────────────

    def _build_ui(self):
        pad = {"padx": 10, "pady": 4}

        top = ttk.Frame(self)
        top.pack(fill="x", **pad)
        top.columnconfigure(1, weight=1)

        # Language toggle (top right)
        self._lang_btn = ttk.Button(
            top, text=self.t('btn_lang'), width=4, command=self._toggle_lang
        )
        self._lang_btn.grid(row=0, column=3, rowspan=2, padx=(8, 0), sticky="ne")

        # Region
        self._lbl_region = ttk.Label(top, text=self.t('lbl_region'))
        self._lbl_region.grid(row=0, column=0, sticky="w")
        self._region_var = tk.StringVar()
        col = 0 if self._lang == 'de' else 1
        region_names = [r[col] for r in REGIONS]
        self._region_combo = ttk.Combobox(
            top, textvariable=self._region_var, values=region_names,
            state="readonly", width=36,
        )
        self._region_combo.current(0)
        self._region_combo.grid(row=0, column=1, columnspan=2, sticky="w", padx=(5, 0))
        self._region_combo.bind("<<ComboboxSelected>>", self._on_region_select)

        # Pi address
        self._lbl_pi = ttk.Label(top, text=self.t('lbl_pi'))
        self._lbl_pi.grid(row=1, column=0, sticky="w", pady=(6, 0))
        self._pi_var = tk.StringVar(value=_load_config().get("pi_address", "boatos.local"))
        self._pi_entry = ttk.Entry(top, textvariable=self._pi_var, width=36)
        self._pi_entry.grid(row=1, column=1, columnspan=2, sticky="w", padx=(5, 0), pady=(6, 0))
        self._pi_var.trace_add("write", lambda *_: self._save_pi_address())

        # Routing checkbox
        self._routing_var = tk.BooleanVar(value=False)
        self._routing_chk = ttk.Checkbutton(
            top, text=self.t('chk_routing'), variable=self._routing_var,
        )
        self._routing_chk.grid(row=2, column=0, columnspan=3, sticky="w", pady=(6, 0))

        # Buttons
        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", **pad)

        self._start_btn = ttk.Button(
            btn_frame, text=self.t('btn_start_upload'), command=self._on_start_upload
        )
        self._start_btn.pack(side="left", padx=(0, 5))

        self._save_btn = ttk.Button(
            btn_frame, text=self.t('btn_save'), command=self._on_start_save
        )
        self._save_btn.pack(side="left", padx=(0, 5))

        self._cancel_btn = ttk.Button(
            btn_frame, text=self.t('btn_cancel'), command=self._on_cancel, state="disabled"
        )
        self._cancel_btn.pack(side="left")

        ttk.Button(
            btn_frame, text="📋", width=3, command=self._copy_log
        ).pack(side="right")

        # Progress
        progress_frame = ttk.Frame(self)
        progress_frame.pack(fill="x", padx=10, pady=(0, 5))

        self._progress_label = ttk.Label(progress_frame, text="")
        self._progress_label.pack(anchor="w")

        self._progress = ttk.Progressbar(
            progress_frame, mode="determinate", maximum=100
        )
        self._progress.pack(fill="x")

        # Log
        self._log_frame = ttk.LabelFrame(self, text=self.t('lbl_log'))
        self._log_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        self._log = tk.Text(
            self._log_frame, state="disabled", wrap="word", font=("Consolas", 9)
        )
        scrollbar = ttk.Scrollbar(self._log_frame, command=self._log.yview)
        self._log.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self._log.pack(fill="both", expand=True)

    def _on_region_select(self, _event=None):
        self._region_idx = self._region_combo.current()

    def _save_pi_address(self):
        cfg = _load_config()
        cfg["pi_address"] = self._pi_var.get()
        _save_config(cfg)

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _log_line(self, text: str):
        def _do():
            self._log.configure(state="normal")
            self._log.insert("end", text + "\n")
            self._log.see("end")
            self._log.configure(state="disabled")
        self.after(0, _do)
        try:
            with open(WORK_DIR / "last_run.log", "a", encoding="utf-8") as f:
                f.write(text + "\n")
        except Exception:
            pass

    def _copy_log(self):
        text = self._log.get("1.0", "end")
        self.clipboard_clear()
        self.clipboard_append(text)

    def _set_progress(self, value: float, label: str = ""):
        def _do():
            self._progress["value"] = value
            if label:
                self._progress_label.configure(text=label)
        self.after(0, _do)

    def _set_buttons(self, running: bool):
        def _do():
            state_main = "disabled" if running else "normal"
            state_cancel = "normal" if running else "disabled"
            self._start_btn.configure(state=state_main)
            self._save_btn.configure(state=state_main)
            self._cancel_btn.configure(state=state_cancel)
            self._region_combo.configure(state="disabled" if running else "readonly")
            self._pi_entry.configure(state="disabled" if running else "normal")
            self._routing_chk.configure(state="disabled" if running else "normal")
        self.after(0, _do)

    # ── Pipeline ──────────────────────────────────────────────────────────────

    def _on_cancel(self):
        self._cancel_event.set()
        self._log_line(self.t('cancel_req'))

    def _on_start_upload(self):
        self._run_pipeline(save_folder=None)

    def _on_start_save(self):
        folder = filedialog.askdirectory(title=self.t('folder_dialog'))
        if not folder:
            return
        self._run_pipeline(save_folder=Path(folder))

    def _run_pipeline(self, save_folder):
        if self._running:
            return
        self._running = True
        self._cancel_event.clear()

        idx = self._region_idx
        de_name, en_name, url = REGIONS[idx]
        region_name = en_name if self._lang == 'en' else de_name
        pi_address = self._pi_var.get().strip()
        mbtiles_name = pbf_to_mbtiles_name(url)

        self._set_buttons(running=True)
        self._log.after(0, lambda: self._log.configure(state="normal"))
        self._log.after(0, lambda: self._log.delete("1.0", "end"))
        self._log.after(0, lambda: self._log.configure(state="disabled"))

        try:
            (WORK_DIR / "last_run.log").write_text("", encoding="utf-8")
        except Exception:
            pass

        threading.Thread(
            target=self._pipeline_thread,
            args=(region_name, url, mbtiles_name, pi_address, save_folder),
            daemon=True,
        ).start()

    def _pipeline_thread(self, region_name, url, mbtiles_name, pi_address, save_folder):
        try:
            self._log_line(self.t('header'))
            self._log_line(self.t('lbl_region_log', name=region_name))
            self._log_line(self.t('lbl_output_log', name=mbtiles_name))
            self._log_line("")

            if not self._step_check_java():
                return
            if self._cancel_event.is_set():
                return

            if not self._step_check_planetiler():
                return
            if self._cancel_event.is_set():
                return

            pbf_path = TMP_DIR / url.split("/")[-1]
            if not self._step_download_pbf(url, pbf_path):
                return
            if self._cancel_event.is_set():
                return

            mbtiles_path = TMP_DIR / mbtiles_name
            if not self._step_convert(pbf_path, mbtiles_path):
                return
            if self._cancel_event.is_set():
                return

            # Seamark extraction (non-fatal — base map upload proceeds regardless)
            seamarks_stem = Path(mbtiles_name).stem + "-seamarks"
            seamarks_path = TMP_DIR / (seamarks_stem + ".mbtiles")
            seamarks_ok = self._step_convert_seamarks(pbf_path, seamarks_path)
            if self._cancel_event.is_set():
                return

            # Routing graph build (optional, non-fatal)
            build_routing = self._routing_var.get()
            routing_path = None
            if build_routing:
                routing_path = self._step_build_routing(pbf_path)
                if self._cancel_event.is_set():
                    return

            if save_folder:
                self._step_save(mbtiles_path, save_folder, mbtiles_name)
                if seamarks_ok:
                    self._step_save(seamarks_path, save_folder,
                                    seamarks_stem + ".mbtiles", step_key='step_sm_save')
                if routing_path:
                    self._step_save(routing_path, save_folder,
                                    routing_path.name, step_key='routing_save')
            else:
                self._step_upload(mbtiles_path, pi_address, mbtiles_name)
                if seamarks_ok:
                    self._step_upload(seamarks_path, pi_address,
                                      seamarks_stem + ".mbtiles", step_key='step_sm_upload')
                if routing_path:
                    self._step_upload_routing(routing_path, pi_address)

        except Exception as e:
            self._log_line(self.t('error', e=e))
        finally:
            self._running = False
            self._set_buttons(running=False)
            self._set_progress(0, "")

    def _step_check_java(self) -> bool:
        self._log_line(self.t('step1'))
        jv, java_exe = self._java_version()
        if not jv:
            self._log_line(self.t('java_not_found'))
            self._log_line(self.t('java_hint'))
            self.after(0, lambda: messagebox.showerror(
                self.t('java_err_title'),
                self.t('java_err_msg'),
            ))
            return False
        self._java_exe = java_exe
        self._log_line(f"  {java_exe}")
        major = self._java_major(jv)
        if major < 21:
            self._log_line(self.t('java_warn', ver=jv))
        else:
            self._log_line(self.t('java_ok', ver=jv))
        return True

    def _step_check_planetiler(self) -> bool:
        self._log_line(self.t('step2'))
        if PLANETILER_JAR.exists():
            size_mb = PLANETILER_JAR.stat().st_size / 1e6
            self._log_line(self.t('pt_found', mb=size_mb))
            return True

        self._log_line(self.t('pt_downloading'))
        try:
            return self._do_download_planetiler()
        except Exception as e:
            self._log_line(self.t('error_indent', e=e))
            return False

    def _step_download_pbf(self, url: str, pbf_path: Path) -> bool:
        self._log_line(self.t('step3'))
        self._log_line(self.t('osm_source', url=url))
        TMP_DIR.mkdir(parents=True, exist_ok=True)

        if pbf_path.exists():
            age = datetime.now() - datetime.fromtimestamp(pbf_path.stat().st_mtime)
            if age < timedelta(weeks=2) and self._is_valid_pbf(pbf_path):
                self._log_line(self.t('osm_cached', days=age.days))
                return True
            self._log_line(self.t('osm_invalid'))

        try:
            with requests.get(url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(pbf_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if self._cancel_event.is_set():
                            self._log_line(self.t('cancelled'))
                            return False
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            label = self.t('osm_progress', dl=downloaded/1e6, total=total/1e6)
                            self._set_progress(downloaded / total * 100, label)
                        else:
                            label = self.t('osm_progress_unk', dl=downloaded/1e6)
                            self._set_progress(0, label)

            size_mb = pbf_path.stat().st_size / 1e6
            self._log_line(self.t('osm_done', mb=size_mb))
            return True

        except Exception as e:
            self._log_line(self.t('error_indent', e=e))
            return False

    def _step_convert(self, pbf_path: Path, mbtiles_path: Path) -> bool:
        self._log_line(self.t('step4'))

        if mbtiles_path.exists():
            age = datetime.now() - datetime.fromtimestamp(mbtiles_path.stat().st_mtime)
            if age < timedelta(weeks=2) and self._is_valid_mbtiles(mbtiles_path):
                self._log_line(self.t('conv_cached', days=age.days))
                self._set_progress(100, self.t('done'))
                return True
            self._log_line(self.t('conv_invalid'))
            mbtiles_path.unlink()

        self._set_progress(0, self.t('conv_running'))

        xmx = _available_ram_gb()
        self._log_line(self.t('conv_ram', xmx=xmx))

        cmd = [
            self._java_exe,
            f"-Xmx{xmx}g",
            "-jar", str(PLANETILER_JAR),
            f"--osm-path={pbf_path}",
            f"--output={mbtiles_path}",
            f"--data-dir={WORK_DIR / 'data'}",
            "--download",
        ]

        self._log_line(f"  java -Xmx{xmx}g -jar planetiler.jar ...")

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                cwd=str(WORK_DIR),
            )

            for line in proc.stdout:
                if self._cancel_event.is_set():
                    proc.kill()
                    self._log_line(self.t('cancelled'))
                    return False
                line = line.rstrip()
                if not line:
                    continue
                self._log_line("  " + line)
                m = re.search(r'\b(\d{1,3})%', line)
                if m:
                    pct = float(m.group(1))
                    self._set_progress(pct, self.t('conv_progress', pct=pct))

            proc.wait()
            if proc.returncode != 0:
                self._log_line(self.t('conv_err_exit', code=proc.returncode))
                return False

            if not mbtiles_path.exists():
                self._log_line(self.t('conv_err_nofile'))
                return False

            size_mb = mbtiles_path.stat().st_size / 1e6
            self._log_line(self.t('conv_done', mb=size_mb))
            self._set_progress(100, self.t('done'))
            return True

        except Exception as e:
            self._log_line(self.t('error_indent', e=e))
            return False

    def _step_convert_seamarks(self, pbf_path: Path, seamarks_path: Path) -> bool:
        self._log_line(self.t('step_sm_convert'))

        if seamarks_path.exists():
            age = datetime.now() - datetime.fromtimestamp(seamarks_path.stat().st_mtime)
            if age < timedelta(weeks=2) and self._is_valid_mbtiles(seamarks_path):
                self._log_line(self.t('sm_cached', days=age.days))
                return True
            seamarks_path.unlink()

        schema_path = TMP_DIR / "seamark_schema.yaml"
        schema_path.write_text(SEAMARK_SCHEMA_YAML, encoding="utf-8")

        xmx = _available_ram_gb()
        cmd = [
            self._java_exe,
            f"-Xmx{xmx}g",
            "-jar", str(PLANETILER_JAR),
            "--schema", str(schema_path),
            f"--osm-path={pbf_path}",
            f"--output={seamarks_path}",
            f"--data-dir={WORK_DIR / 'data'}",
        ]
        self._log_line(f"  java -Xmx{xmx}g -jar planetiler.jar --schema=seamark_schema.yaml ...")
        self._set_progress(0, self.t('sm_running'))

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                encoding="utf-8",
                errors="replace",
                cwd=str(WORK_DIR),
            )
            for line in proc.stdout:
                if self._cancel_event.is_set():
                    proc.kill()
                    return False
                line = line.rstrip()
                if not line:
                    continue
                self._log_line("  " + line)
                m = re.search(r'\b(\d{1,3})%', line)
                if m:
                    self._set_progress(float(m.group(1)), self.t('sm_running'))

            proc.wait()
            if proc.returncode != 0 or not seamarks_path.exists():
                self._log_line(self.t('sm_fail'))
                return False

            size_mb = seamarks_path.stat().st_size / 1e6
            self._log_line(self.t('sm_done', mb=size_mb))
            self._set_progress(100, self.t('done'))
            return True
        except Exception as e:
            self._log_line(f"  {e}")
            self._log_line(self.t('sm_fail'))
            return False

    def _step_upload(self, mbtiles_path: Path, pi_address: str, mbtiles_name: str,
                     step_key: str = 'step5_upload') -> bool:
        self._log_line(self.t(step_key))
        # Port 8000 = direkt ans Backend, umgeht nginx (kein client_max_body_size-Limit)
        url = f"http://{pi_address}:8000/api/map/regions/upload-raw?overwrite=true"
        self._log_line(self.t('upload_post', url=url))

        try:
            total = mbtiles_path.stat().st_size
            cancel = self._cancel_event
            uploaded_ref = [0]

            class _Reader:
                def __init__(self):
                    self._f = open(mbtiles_path, "rb")
                def read(self, n=-1):
                    if cancel.is_set():
                        return b""
                    data = self._f.read(n)
                    uploaded_ref[0] += len(data)
                    return data
                def __len__(self):
                    return total
                def close(self):
                    self._f.close()

            reader = _Reader()

            # Background thread polls progress independently of the read loop
            done_evt = threading.Event()
            def _poll_progress():
                while not done_evt.wait(0.5):
                    ul = uploaded_ref[0]
                    if ul:
                        self._set_progress(
                            ul / total * 100,
                            self.t('upload_progress', ul=ul/1e6, total=total/1e6),
                        )
            threading.Thread(target=_poll_progress, daemon=True).start()

            try:
                resp = requests.post(
                    url,
                    data=reader,
                    headers={
                        "Content-Type": "application/octet-stream",
                        "X-Filename": mbtiles_name,
                        "Content-Length": str(total),
                    },
                    timeout=600,
                )
            finally:
                done_evt.set()
                reader.close()

            if cancel.is_set():
                self._log_line(self.t('cancelled'))
                return False

            resp.raise_for_status()
            self._log_line(self.t('upload_ok', status=resp.status_code))
            return True

        except Exception as e:
            self._log_line(self.t('error_indent', e=e))
            return False

    def _step_save(self, mbtiles_path: Path, save_folder: Path, mbtiles_name: str,
                   step_key: str = 'step5_save') -> bool:
        self._log_line(self.t(step_key))
        dest = save_folder / mbtiles_name
        self._set_progress(50, self.t('save_copying', dest=dest))
        try:
            shutil.copy2(mbtiles_path, dest)
            self._set_progress(100, self.t('done'))
            self._log_line(self.t('save_done', dest=dest))
            return True
        except Exception as e:
            self._log_line(self.t('error_indent', e=e))
            return False

    def _step_build_routing(self, pbf_path: Path):
        """Extract waterway network from PBF and write .routing SQLite file."""
        self._log_line(self.t('step_routing'))

        try:
            import osmium  # noqa: F401
        except ImportError:
            self._log_line(self.t('routing_install'))
            try:
                subprocess.run(
                    [sys.executable, '-m', 'pip', 'install', 'osmium'],
                    check=True, capture_output=True, timeout=120,
                )
            except Exception as e:
                self._log_line(f'  {e}')
                self._log_line(self.t('routing_skip'))
                return None

        import osmium
        import math as _m

        WATERWAY_TYPES = {'river', 'canal', 'stream', 'fairway', 'dock'}

        class _WE(osmium.SimpleHandler):
            def __init__(self):
                super().__init__()
                self.nodes: dict = {}
                self.edges: list = []

            def way(self, w):
                tags = {t.k: t.v for t in w.tags}
                if tags.get('waterway') not in WATERWAY_TYPES:
                    return
                locs = [(n.ref, float(n.location.lat), float(n.location.lon))
                        for n in w.nodes if n.location.valid()]
                if len(locs) < 2:
                    return
                oneway = tags.get('oneway') == 'yes'
                for nid, lat, lon in locs:
                    self.nodes[nid] = (lat, lon)
                R = 6371000.0
                for i in range(len(locs) - 1):
                    n1, lat1, lon1 = locs[i]
                    n2, lat2, lon2 = locs[i + 1]
                    dlat = _m.radians(lat2 - lat1)
                    dlon = _m.radians(lon2 - lon1)
                    a = (_m.sin(dlat / 2) ** 2 +
                         _m.cos(_m.radians(lat1)) * _m.cos(_m.radians(lat2)) *
                         _m.sin(dlon / 2) ** 2)
                    dist = R * 2 * _m.atan2(_m.sqrt(a), _m.sqrt(1 - a))
                    self.edges.append((n1, n2, dist))
                    if not oneway:
                        self.edges.append((n2, n1, dist))

        handler = _WE()
        self._set_progress(5, self.t('step_routing'))
        try:
            # flex_mem keeps the location index fully in RAM — more reliable on Windows
            # than the default mmap-based sparse index for large PBF files.
            handler.apply_file(str(pbf_path), locations=True, idx='flex_mem')
        except TypeError:
            handler.apply_file(str(pbf_path), locations=True)

        n, e = len(handler.nodes), len(handler.edges)
        self._log_line(self.t('routing_nodes', nodes=n, edges=e))
        if n == 0:
            self._log_line('  Keine Wasserwege gefunden.')
            return None

        region = pbf_path.stem
        for suffix in ('-latest.osm', '.osm', '-latest'):
            region = region.replace(suffix, '')
        routing_path = TMP_DIR / f"{region}.routing"
        self._log_line(self.t('routing_write', name=routing_path.name))
        self._set_progress(80, self.t('routing_write', name=routing_path.name))

        routing_path.unlink(missing_ok=True)
        con = sqlite3.connect(str(routing_path))
        try:
            con.execute("PRAGMA journal_mode=DELETE")
            con.execute("PRAGMA synchronous=FULL")
            con.execute("CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT)")
            con.execute(
                "CREATE TABLE nodes "
                "(id INTEGER PRIMARY KEY, lat REAL NOT NULL, lon REAL NOT NULL)"
            )
            con.execute(
                "CREATE TABLE edges "
                "(from_node INTEGER NOT NULL, to_node INTEGER NOT NULL, distance_m REAL NOT NULL)"
            )
            lats = [v[0] for v in handler.nodes.values()]
            lons = [v[1] for v in handler.nodes.values()]
            con.executemany("INSERT OR IGNORE INTO metadata VALUES (?,?)", [
                ("region", region),
                ("node_count", str(n)),
                ("edge_count", str(e)),
                ("bbox_minlat", str(min(lats))),
                ("bbox_maxlat", str(max(lats))),
                ("bbox_minlon", str(min(lons))),
                ("bbox_maxlon", str(max(lons))),
                ("created_at", datetime.now().isoformat()),
            ])
            con.executemany(
                "INSERT INTO nodes VALUES (?,?,?)",
                [(nid, lat, lon) for nid, (lat, lon) in handler.nodes.items()],
            )
            con.executemany("INSERT INTO edges VALUES (?,?,?)", handler.edges)
            con.execute("CREATE INDEX idx_edges_from ON edges(from_node)")
            con.commit()
        finally:
            con.close()

        mb = routing_path.stat().st_size / 1e6
        self._log_line(self.t('routing_done', name=routing_path.name, mb=mb))
        self._set_progress(100, self.t('done'))
        return routing_path

    def _step_upload_routing(self, routing_path: Path, pi_address: str) -> bool:
        self._log_line(self.t('routing_upload'))
        url = f"http://{pi_address}:8000/api/routing/upload-raw?overwrite=true"
        self._log_line(self.t('upload_post', url=url))
        try:
            total = routing_path.stat().st_size
            cancel = self._cancel_event
            uploaded_ref = [0]

            class _Reader:
                def __init__(self_):
                    self_._f = open(routing_path, "rb")
                def read(self_, n=-1):
                    if cancel.is_set():
                        return b""
                    data = self_._f.read(n)
                    uploaded_ref[0] += len(data)
                    return data
                def __len__(self_):
                    return total
                def close(self_):
                    self_._f.close()

            reader = _Reader()
            done_evt = threading.Event()

            def _poll():
                while not done_evt.wait(0.5):
                    ul = uploaded_ref[0]
                    if ul:
                        self._set_progress(
                            ul / total * 100,
                            self.t('upload_progress', ul=ul / 1e6, total=total / 1e6),
                        )
            threading.Thread(target=_poll, daemon=True).start()

            try:
                resp = requests.post(
                    url, data=reader,
                    headers={
                        "Content-Type": "application/octet-stream",
                        "X-Filename": routing_path.name,
                        "Content-Length": str(total),
                    },
                    timeout=300,
                )
            finally:
                done_evt.set()
                reader.close()

            if cancel.is_set():
                self._log_line(self.t('cancelled'))
                return False
            resp.raise_for_status()
            self._log_line(self.t('upload_ok', status=resp.status_code))
            return True
        except Exception as e:
            self._log_line(self.t('error_indent', e=e))
            return False


if __name__ == "__main__":
    app = App()
    app.mainloop()
