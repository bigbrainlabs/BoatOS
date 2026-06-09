import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import subprocess
import ctypes
import json
import re
import shutil
import sys
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


# (Anzeigename, Geofabrik-URL)
REGIONS = [
    # ── Deutschland (Bundesländer) ────────────────────────────────────
    ("Deutschland",                   "https://download.geofabrik.de/europe/germany-latest.osm.pbf"),
    ("DE · Baden-Württemberg",        "https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf"),
    ("DE · Bayern",                   "https://download.geofabrik.de/europe/germany/bavaria-latest.osm.pbf"),
    ("DE · Berlin",                   "https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf"),
    ("DE · Brandenburg",              "https://download.geofabrik.de/europe/germany/brandenburg-latest.osm.pbf"),
    ("DE · Bremen",                   "https://download.geofabrik.de/europe/germany/bremen-latest.osm.pbf"),
    ("DE · Hamburg",                  "https://download.geofabrik.de/europe/germany/hamburg-latest.osm.pbf"),
    ("DE · Hessen",                   "https://download.geofabrik.de/europe/germany/hessen-latest.osm.pbf"),
    ("DE · Mecklenburg-Vorpommern",   "https://download.geofabrik.de/europe/germany/mecklenburg-vorpommern-latest.osm.pbf"),
    ("DE · Niedersachsen",            "https://download.geofabrik.de/europe/germany/lower-saxony-latest.osm.pbf"),
    ("DE · Nordrhein-Westfalen",      "https://download.geofabrik.de/europe/germany/nordrhein-westfalen-latest.osm.pbf"),
    ("DE · Rheinland-Pfalz",          "https://download.geofabrik.de/europe/germany/rheinland-pfalz-latest.osm.pbf"),
    ("DE · Saarland",                 "https://download.geofabrik.de/europe/germany/saarland-latest.osm.pbf"),
    ("DE · Sachsen",                  "https://download.geofabrik.de/europe/germany/saxony-latest.osm.pbf"),
    ("DE · Sachsen-Anhalt",           "https://download.geofabrik.de/europe/germany/saxony-anhalt-latest.osm.pbf"),
    ("DE · Schleswig-Holstein",       "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf"),
    ("DE · Thüringen",                "https://download.geofabrik.de/europe/germany/thuringia-latest.osm.pbf"),
    # ── Mitteleuropa ──────────────────────────────────────────────────
    ("Niederlande",                   "https://download.geofabrik.de/europe/netherlands-latest.osm.pbf"),
    ("Belgien",                       "https://download.geofabrik.de/europe/belgium-latest.osm.pbf"),
    ("Luxemburg",                     "https://download.geofabrik.de/europe/luxembourg-latest.osm.pbf"),
    ("Frankreich",                    "https://download.geofabrik.de/europe/france-latest.osm.pbf"),
    ("Schweiz",                       "https://download.geofabrik.de/europe/switzerland-latest.osm.pbf"),
    ("Österreich",                    "https://download.geofabrik.de/europe/austria-latest.osm.pbf"),
    ("Tschechien",                    "https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf"),
    ("Polen",                         "https://download.geofabrik.de/europe/poland-latest.osm.pbf"),
    ("Slowakei",                      "https://download.geofabrik.de/europe/slovakia-latest.osm.pbf"),
    ("Ungarn",                        "https://download.geofabrik.de/europe/hungary-latest.osm.pbf"),
    # ── Nordeuropa / Skandinavien ─────────────────────────────────────
    ("Dänemark",                      "https://download.geofabrik.de/europe/denmark-latest.osm.pbf"),
    ("Schweden",                      "https://download.geofabrik.de/europe/sweden-latest.osm.pbf"),
    ("Norwegen",                      "https://download.geofabrik.de/europe/norway-latest.osm.pbf"),
    ("Finnland",                      "https://download.geofabrik.de/europe/finland-latest.osm.pbf"),
    ("Island",                        "https://download.geofabrik.de/europe/iceland-latest.osm.pbf"),
    # ── Britische Inseln ──────────────────────────────────────────────
    ("Großbritannien",                "https://download.geofabrik.de/europe/great-britain-latest.osm.pbf"),
    ("GB · England",                  "https://download.geofabrik.de/europe/great-britain/england-latest.osm.pbf"),
    ("GB · Scotland",                 "https://download.geofabrik.de/europe/great-britain/scotland-latest.osm.pbf"),
    ("GB · Wales",                    "https://download.geofabrik.de/europe/great-britain/wales-latest.osm.pbf"),
    ("Irland",                        "https://download.geofabrik.de/europe/ireland-and-northern-ireland-latest.osm.pbf"),
    # ── Südeuropa / Mittelmeer ────────────────────────────────────────
    ("Spanien",                       "https://download.geofabrik.de/europe/spain-latest.osm.pbf"),
    ("Portugal",                      "https://download.geofabrik.de/europe/portugal-latest.osm.pbf"),
    ("Italien",                       "https://download.geofabrik.de/europe/italy-latest.osm.pbf"),
    ("Kroatien",                      "https://download.geofabrik.de/europe/croatia-latest.osm.pbf"),
    ("Slowenien",                     "https://download.geofabrik.de/europe/slovenia-latest.osm.pbf"),
    ("Griechenland",                  "https://download.geofabrik.de/europe/greece-latest.osm.pbf"),
    ("Türkei",                        "https://download.geofabrik.de/europe/turkey-latest.osm.pbf"),
    # ── Osteuropa / Baltikum ──────────────────────────────────────────
    ("Estland",                       "https://download.geofabrik.de/europe/estonia-latest.osm.pbf"),
    ("Lettland",                      "https://download.geofabrik.de/europe/latvia-latest.osm.pbf"),
    ("Litauen",                       "https://download.geofabrik.de/europe/lithuania-latest.osm.pbf"),
    ("Russland (Europa)",             "https://download.geofabrik.de/europe/russia-latest.osm.pbf"),
    # ── Nordamerika ───────────────────────────────────────────────────
    ("USA (gesamt)",                  "https://download.geofabrik.de/north-america/us-latest.osm.pbf"),
    ("USA · Florida",                 "https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf"),
    ("USA · New York",                "https://download.geofabrik.de/north-america/us/new-york-latest.osm.pbf"),
    ("USA · Texas",                   "https://download.geofabrik.de/north-america/us/texas-latest.osm.pbf"),
    ("USA · California",              "https://download.geofabrik.de/north-america/us/california-latest.osm.pbf"),
    ("USA · Great Lakes (Michigan)",  "https://download.geofabrik.de/north-america/us/michigan-latest.osm.pbf"),
    ("Kanada",                        "https://download.geofabrik.de/north-america/canada-latest.osm.pbf"),
    ("Kanada · British Columbia",     "https://download.geofabrik.de/north-america/canada/british-columbia-latest.osm.pbf"),
    ("Kanada · Ontario",              "https://download.geofabrik.de/north-america/canada/ontario-latest.osm.pbf"),
    # ── Karibik / Mittelamerika ───────────────────────────────────────
    ("Karibik",                       "https://download.geofabrik.de/central-america-latest.osm.pbf"),
    # ── Australien & Pazifik ──────────────────────────────────────────
    ("Australien",                    "https://download.geofabrik.de/australia-oceania/australia-latest.osm.pbf"),
    ("Neuseeland",                    "https://download.geofabrik.de/australia-oceania/new-zealand-latest.osm.pbf"),
]


def pbf_to_mbtiles_name(url: str) -> str:
    basename = url.split("/")[-1]
    stem = basename.replace("-latest.osm.pbf", "").replace(".osm.pbf", "")
    return stem + ".mbtiles"


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("BoatOS mbtiles Creator")
        self.resizable(True, True)
        self.minsize(660, 520)

        self._cancel_event = threading.Event()
        self._running = False
        self._java_exe: str = "java"

        self._build_ui()

    # ── Status detection ──────────────────────────────────────────────

    def _find_java_exe(self) -> str | None:
        """Return path to java.exe, checking PATH, registry, and common install dirs."""
        import shutil as _shutil

        # 1. PATH (works when launched from terminal)
        found = _shutil.which("java")
        if found:
            return found

        # 2. JAVA_HOME environment variable
        java_home = os.environ.get("JAVA_HOME", "")
        if java_home:
            candidate = Path(java_home) / "bin" / "java.exe"
            if candidate.exists():
                return str(candidate)

        # 3. Windows registry — most reliable for Oracle/OpenJDK installs
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

        # 4. Oracle javapath shortcut directory
        oracle = Path("C:/Program Files/Common Files/Oracle/Java/javapath/java.exe")
        if oracle.exists():
            return str(oracle)

        # 5. Common install directories — newest version first
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
        """Returns (version_string, java_exe_path) or (None, None)."""
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
            version = m.group(1) if m else "gefunden"
            return version, exe
        except Exception:
            return None, None

    def _java_major(self, version_str: str) -> int:
        parts = version_str.split(".")
        major = int(parts[0]) if parts[0].isdigit() else 0
        # old-style: "1.8.0" → Java 8
        if major == 1 and len(parts) > 1 and parts[1].isdigit():
            major = int(parts[1])
        return major

    # ── Planetiler download ───────────────────────────────────────────

    def _download_planetiler_btn(self):
        self._dl_pt_btn.configure(state="disabled")
        threading.Thread(
            target=self._download_planetiler_standalone_thread, daemon=True
        ).start()

    def _download_planetiler_standalone_thread(self):
        try:
            self._log_line("Lade planetiler.jar herunter...")
            if self._do_download_planetiler():
                self._log_line("planetiler.jar bereit.")
        except Exception as e:
            self._log_line(f"[Fehler] {e}")
        finally:
            self.after(0, lambda: self._dl_pt_btn.configure(state="normal"))
            self.after(2000, lambda: self._set_progress(0, ""))

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
            self._log_line("[Fehler] planetiler.jar nicht im Release gefunden.")
            return False

        url = asset["browser_download_url"]
        size_mb = asset["size"] / 1e6
        self._log_line(f"  Version: {tag} ({size_mb:.0f} MB)")

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
        self._set_progress(100, "planetiler.jar bereit.")
        return True

    # ── UI ────────────────────────────────────────────────────────────

    def _build_ui(self):
        pad = {"padx": 10, "pady": 4}

        top = ttk.Frame(self)
        top.pack(fill="x", **pad)
        top.columnconfigure(1, weight=1)

        # Planetiler pre-download button
        ttk.Label(top, text="Planetiler:").grid(row=0, column=0, sticky="w")
        ttk.Label(top, text="wird automatisch heruntergeladen (einmalig, ~93 MB)").grid(
            row=0, column=1, columnspan=2, sticky="w", padx=(5, 0)
        )
        self._dl_pt_btn = ttk.Button(
            top, text="⬇ Jetzt herunterladen", command=self._download_planetiler_btn
        )
        self._dl_pt_btn.grid(row=0, column=3, padx=(4, 0))

        # Region
        ttk.Label(top, text="Region:").grid(row=1, column=0, sticky="w", pady=(10, 0))
        self._region_var = tk.StringVar()
        region_names = [r[0] for r in REGIONS]
        self._region_combo = ttk.Combobox(
            top, textvariable=self._region_var, values=region_names,
            state="readonly", width=34,
        )
        self._region_combo.current(0)
        self._region_combo.grid(
            row=1, column=1, columnspan=2, sticky="w", padx=(5, 0), pady=(10, 0)
        )

        # Pi address
        ttk.Label(top, text="Pi-Adresse:").grid(row=2, column=0, sticky="w", pady=(4, 0))
        self._pi_var = tk.StringVar(value=_load_config().get("pi_address", "boatos.local"))
        self._pi_entry = ttk.Entry(top, textvariable=self._pi_var, width=34)
        self._pi_entry.grid(
            row=2, column=1, columnspan=2, sticky="w", padx=(5, 0), pady=(4, 0)
        )
        self._pi_var.trace_add("write", lambda *_: self._save_pi_address())

        # Buttons
        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", **pad)

        self._start_btn = ttk.Button(
            btn_frame, text="Start (Upload)", command=self._on_start_upload
        )
        self._start_btn.pack(side="left", padx=(0, 5))

        self._save_btn = ttk.Button(
            btn_frame, text="In Ordner speichern", command=self._on_start_save
        )
        self._save_btn.pack(side="left", padx=(0, 5))

        self._cancel_btn = ttk.Button(
            btn_frame, text="Abbrechen", command=self._on_cancel, state="disabled"
        )
        self._cancel_btn.pack(side="left")

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
        log_frame = ttk.LabelFrame(self, text="Log")
        log_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        self._log = tk.Text(
            log_frame, state="disabled", wrap="word", font=("Consolas", 9)
        )
        scrollbar = ttk.Scrollbar(log_frame, command=self._log.yview)
        self._log.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self._log.pack(fill="both", expand=True)

    def _save_pi_address(self):
        cfg = _load_config()
        cfg["pi_address"] = self._pi_var.get()
        _save_config(cfg)

    # ── Helpers ───────────────────────────────────────────────────────

    def _log_line(self, text: str):
        def _do():
            self._log.configure(state="normal")
            self._log.insert("end", text + "\n")
            self._log.see("end")
            self._log.configure(state="disabled")
        self.after(0, _do)

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
        self.after(0, _do)

    # ── Pipeline ──────────────────────────────────────────────────────

    def _on_cancel(self):
        self._cancel_event.set()
        self._log_line("[Abbrechen angefordert...]")

    def _on_start_upload(self):
        self._run_pipeline(save_folder=None)

    def _on_start_save(self):
        folder = filedialog.askdirectory(title="Zielordner wählen")
        if not folder:
            return
        self._run_pipeline(save_folder=Path(folder))

    def _run_pipeline(self, save_folder):
        if self._running:
            return
        self._running = True
        self._cancel_event.clear()

        region_name = self._region_var.get()
        url = next(u for n, u in REGIONS if n == region_name)
        pi_address = self._pi_var.get().strip()
        mbtiles_name = pbf_to_mbtiles_name(url)

        self._set_buttons(running=True)
        self._log.after(0, lambda: self._log.configure(state="normal"))
        self._log.after(0, lambda: self._log.delete("1.0", "end"))
        self._log.after(0, lambda: self._log.configure(state="disabled"))

        threading.Thread(
            target=self._pipeline_thread,
            args=(region_name, url, mbtiles_name, pi_address, save_folder),
            daemon=True,
        ).start()

    def _pipeline_thread(self, region_name, url, mbtiles_name, pi_address, save_folder):
        try:
            self._log_line("=== BoatOS mbtiles Creator ===")
            self._log_line(f"Region: {region_name}")
            self._log_line(f"Ausgabe: {mbtiles_name}")
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

            if save_folder:
                self._step_save(mbtiles_path, save_folder, mbtiles_name)
            else:
                self._step_upload(mbtiles_path, pi_address, mbtiles_name)

        except Exception as e:
            self._log_line(f"\n[Fehler] {e}")
        finally:
            self._running = False
            self._set_buttons(running=False)
            self._set_progress(0, "")

    def _step_check_java(self) -> bool:
        self._log_line("[1/4] Prüfe Java...")
        jv, java_exe = self._java_version()
        if not jv:
            self._log_line("[Fehler] Java nicht gefunden.")
            self._log_line("  Bitte Java 21 installieren: https://www.java.com/de/download/")
            self.after(0, lambda: messagebox.showerror(
                "Java fehlt",
                "Java wurde nicht gefunden.\n\n"
                "Bitte installiere Java 21 von:\nhttps://www.java.com/de/download/\n\n"
                "Danach BoatOS mbtiles Creator neu starten.",
            ))
            return False
        self._java_exe = java_exe
        self._log_line(f"  {java_exe}")
        major = self._java_major(jv)
        if major < 21:
            self._log_line(
                f"  Warnung: Java {jv} — Java 21 empfohlen. Versuche trotzdem..."
            )
        else:
            self._log_line(f"  Java {jv} OK.")
        return True

    def _step_check_planetiler(self) -> bool:
        self._log_line("[2/4] Prüfe planetiler.jar...")
        if PLANETILER_JAR.exists():
            size_mb = PLANETILER_JAR.stat().st_size / 1e6
            self._log_line(f"  planetiler.jar vorhanden ({size_mb:.0f} MB).")
            return True

        self._log_line("  Nicht gefunden — lade herunter...")
        try:
            ok = self._do_download_planetiler()
            return ok
        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False

    def _step_download_pbf(self, url: str, pbf_path: Path) -> bool:
        self._log_line("[3/4] Lade OSM-Kartendaten herunter...")
        self._log_line(f"  Quelle: {url}")
        TMP_DIR.mkdir(parents=True, exist_ok=True)

        try:
            with requests.get(url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(pbf_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if self._cancel_event.is_set():
                            self._log_line("  [Abgebrochen]")
                            return False
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            pct = downloaded / total * 100
                            label = f"OSM-Download: {downloaded/1e6:.1f} / {total/1e6:.1f} MB"
                        else:
                            pct = 0
                            label = f"OSM-Download: {downloaded/1e6:.1f} MB"
                        self._set_progress(pct, label)

            size_mb = pbf_path.stat().st_size / 1e6
            self._log_line(f"  Download abgeschlossen ({size_mb:.1f} MB).")
            return True

        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False

    def _step_convert(self, pbf_path: Path, mbtiles_path: Path) -> bool:
        self._log_line("[4/4] Konvertiere mit planetiler...")
        self._set_progress(0, "Konvertierung läuft...")

        if mbtiles_path.exists():
            mbtiles_path.unlink()

        xmx = _available_ram_gb()
        self._log_line(f"  RAM für Java: {xmx} GB")

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
                    self._log_line("  [Abgebrochen]")
                    return False
                line = line.rstrip()
                if not line:
                    continue
                self._log_line("  " + line)
                # Parse percentage from planetiler progress lines
                m = re.search(r'\b(\d{1,3})%', line)
                if m:
                    pct = float(m.group(1))
                    self._set_progress(pct, f"Konvertierung: {pct:.0f}%")

            proc.wait()
            if proc.returncode != 0:
                self._log_line(f"  [Fehler] planetiler Exitcode: {proc.returncode}")
                return False

            if not mbtiles_path.exists():
                self._log_line("  [Fehler] Ausgabedatei nicht erzeugt.")
                return False

            size_mb = mbtiles_path.stat().st_size / 1e6
            self._log_line(f"  Konvertierung abgeschlossen ({size_mb:.1f} MB).")
            self._set_progress(100, "Fertig.")
            return True

        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False

    def _step_upload(self, mbtiles_path: Path, pi_address: str, mbtiles_name: str) -> bool:
        self._log_line("[5/5] Lade auf Pi hoch...")
        # Port 8000 = direkt ans Backend, umgeht nginx (kein client_max_body_size-Limit)
        url = f"http://{pi_address}:8000/api/map/regions/upload-raw"
        self._log_line(f"  POST {url}")

        try:
            total = mbtiles_path.stat().st_size

            def _gen():
                uploaded = 0
                with open(mbtiles_path, "rb") as f:
                    while True:
                        if self._cancel_event.is_set():
                            break
                        chunk = f.read(65536)
                        if not chunk:
                            break
                        uploaded += len(chunk)
                        pct = uploaded / total * 100
                        label = f"Upload: {uploaded/1e6:.1f} / {total/1e6:.1f} MB"
                        self._set_progress(pct, label)
                        yield chunk

            with requests.post(
                url,
                data=_gen(),
                headers={
                    "Content-Type": "application/octet-stream",
                    "X-Filename": mbtiles_name,
                    "Content-Length": str(total),
                },
                timeout=600,
                stream=True,
            ) as resp:
                if self._cancel_event.is_set():
                    self._log_line("  [Abgebrochen]")
                    return False
                resp.raise_for_status()
                self._log_line(f"  Upload erfolgreich (HTTP {resp.status_code}).")
                return True

        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False

    def _step_save(self, mbtiles_path: Path, save_folder: Path, mbtiles_name: str) -> bool:
        self._log_line("[5/5] Kopiere in Zielordner...")
        dest = save_folder / mbtiles_name
        self._set_progress(50, f"Kopiere nach {dest}...")
        try:
            shutil.copy2(mbtiles_path, dest)
            self._set_progress(100, "Fertig.")
            self._log_line(f"  Gespeichert: {dest}")
            return True
        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False


if __name__ == "__main__":
    app = App()
    app.mainloop()
