import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import threading
import subprocess
import shutil
import zipfile
import io
import os
import sys
from pathlib import Path

import requests

WORK_DIR = Path(__file__).parent
TMP_DIR = WORK_DIR / "tmp"

REGIONS = [
    ("Deutschland", "https://download.geofabrik.de/europe/germany-latest.osm.pbf"),
    ("Niederlande", "https://download.geofabrik.de/europe/netherlands-latest.osm.pbf"),
    ("Belgien", "https://download.geofabrik.de/europe/belgium-latest.osm.pbf"),
    ("Frankreich", "https://download.geofabrik.de/europe/france-latest.osm.pbf"),
    ("Polen", "https://download.geofabrik.de/europe/poland-latest.osm.pbf"),
    ("Tschechien", "https://download.geofabrik.de/europe/czech-republic-latest.osm.pbf"),
    ("Österreich", "https://download.geofabrik.de/europe/austria-latest.osm.pbf"),
    ("Schweiz", "https://download.geofabrik.de/europe/switzerland-latest.osm.pbf"),
    ("Dänemark", "https://download.geofabrik.de/europe/denmark-latest.osm.pbf"),
    ("Bayern", "https://download.geofabrik.de/europe/germany/bavaria-latest.osm.pbf"),
    ("Baden-Württemberg", "https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf"),
    ("Brandenburg", "https://download.geofabrik.de/europe/germany/brandenburg-latest.osm.pbf"),
    ("Mecklenburg-Vorpommern", "https://download.geofabrik.de/europe/germany/mecklenburg-vorpommern-latest.osm.pbf"),
    ("Niedersachsen", "https://download.geofabrik.de/europe/germany/lower-saxony-latest.osm.pbf"),
    ("Nordrhein-Westfalen", "https://download.geofabrik.de/europe/germany/nordrhein-westfalen-latest.osm.pbf"),
    ("Rheinland-Pfalz", "https://download.geofabrik.de/europe/germany/rheinland-pfalz-latest.osm.pbf"),
    ("Sachsen", "https://download.geofabrik.de/europe/germany/saxony-latest.osm.pbf"),
    ("Sachsen-Anhalt", "https://download.geofabrik.de/europe/germany/saxony-anhalt-latest.osm.pbf"),
    ("Schleswig-Holstein", "https://download.geofabrik.de/europe/germany/schleswig-holstein-latest.osm.pbf"),
    ("Thüringen", "https://download.geofabrik.de/europe/germany/thuringia-latest.osm.pbf"),
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
        self.minsize(640, 480)

        self._cancel_event = threading.Event()
        self._running = False

        self._build_ui()

    def _build_ui(self):
        pad = {"padx": 10, "pady": 5}

        top = ttk.Frame(self)
        top.pack(fill="x", **pad)

        ttk.Label(top, text="Region:").grid(row=0, column=0, sticky="w")
        self._region_var = tk.StringVar()
        region_names = [r[0] for r in REGIONS]
        self._region_combo = ttk.Combobox(
            top, textvariable=self._region_var, values=region_names, state="readonly", width=30
        )
        self._region_combo.current(0)
        self._region_combo.grid(row=0, column=1, sticky="w", padx=(5, 0))

        ttk.Label(top, text="Pi-Adresse:").grid(row=1, column=0, sticky="w", pady=(5, 0))
        self._pi_var = tk.StringVar(value="boatos.local")
        self._pi_entry = ttk.Entry(top, textvariable=self._pi_var, width=30)
        self._pi_entry.grid(row=1, column=1, sticky="w", padx=(5, 0), pady=(5, 0))

        btn_frame = ttk.Frame(self)
        btn_frame.pack(fill="x", **pad)

        self._start_btn = ttk.Button(btn_frame, text="Start (Upload)", command=self._on_start_upload)
        self._start_btn.pack(side="left", padx=(0, 5))

        self._save_btn = ttk.Button(btn_frame, text="In Ordner speichern", command=self._on_start_save)
        self._save_btn.pack(side="left", padx=(0, 5))

        self._cancel_btn = ttk.Button(btn_frame, text="Abbrechen", command=self._on_cancel, state="disabled")
        self._cancel_btn.pack(side="left")

        progress_frame = ttk.Frame(self)
        progress_frame.pack(fill="x", padx=10, pady=(0, 5))

        self._progress_label = ttk.Label(progress_frame, text="")
        self._progress_label.pack(anchor="w")

        self._progress = ttk.Progressbar(progress_frame, mode="determinate", maximum=100)
        self._progress.pack(fill="x")

        log_frame = ttk.LabelFrame(self, text="Log")
        log_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))

        self._log = tk.Text(log_frame, state="disabled", wrap="word", font=("Consolas", 9))
        scrollbar = ttk.Scrollbar(log_frame, command=self._log.yview)
        self._log.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        self._log.pack(fill="both", expand=True)

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
            self._log_line(f"=== BoatOS mbtiles Creator ===")
            self._log_line(f"Region: {region_name}")
            self._log_line(f"Ausgabe: {mbtiles_name}")
            self._log_line("")

            if not self._step_check_tilemaker():
                return
            if self._cancel_event.is_set():
                return

            if not self._step_water_polygons():
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

    def _step_check_tilemaker(self) -> bool:
        self._log_line("[1/5] Prüfe tilemaker.exe...")
        exe = WORK_DIR / "tilemaker.exe"
        config = WORK_DIR / "config-openmaptiles.json"
        process = WORK_DIR / "process-openmaptiles.lua"

        missing = []
        if not exe.exists():
            missing.append("tilemaker.exe")
        if not config.exists():
            missing.append("config-openmaptiles.json")
        if not process.exists():
            missing.append("process-openmaptiles.lua")

        if missing:
            msg = (
                "Folgende Dateien fehlen im Tool-Verzeichnis:\n"
                + "\n".join(f"  - {m}" for m in missing)
                + "\n\nBitte setup-tilemaker.md lesen für Installationsanleitung."
            )
            self.after(0, lambda: messagebox.showerror("Dateien fehlen", msg))
            self._log_line(f"[Fehler] Fehlend: {', '.join(missing)}")
            return False

        self._log_line("  tilemaker.exe gefunden.")
        self._log_line("  config-openmaptiles.json gefunden.")
        self._log_line("  process-openmaptiles.lua gefunden.")
        return True

    def _step_water_polygons(self) -> bool:
        self._log_line("[2/5] Prüfe Water Polygons...")
        water_dir = WORK_DIR / "water-polygons-split-4326"
        if water_dir.exists():
            self._log_line("  Water Polygons bereits vorhanden.")
            return True

        self._log_line("  Nicht gefunden. Lade water-polygons-split-4326.zip herunter...")
        url = "https://osmdata.openstreetmap.de/download/water-polygons-split-4326.zip"
        zip_path = TMP_DIR / "water-polygons-split-4326.zip"
        TMP_DIR.mkdir(parents=True, exist_ok=True)

        try:
            with requests.get(url, stream=True, timeout=60) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                downloaded = 0
                with open(zip_path, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=65536):
                        if self._cancel_event.is_set():
                            self._log_line("  [Abgebrochen]")
                            return False
                        f.write(chunk)
                        downloaded += len(chunk)
                        if total:
                            pct = downloaded / total * 100
                            label = f"Water Polygons: {downloaded/1e6:.1f} / {total/1e6:.1f} MB"
                            self._set_progress(pct, label)

            self._log_line("  Entpacke...")
            self._set_progress(100, "Entpacke Water Polygons...")
            with zipfile.ZipFile(zip_path, "r") as zf:
                zf.extractall(WORK_DIR)
            zip_path.unlink(missing_ok=True)
            self._log_line("  Water Polygons bereit.")
            return True

        except Exception as e:
            self._log_line(f"  [Fehler beim Download] {e}")
            return False

    def _step_download_pbf(self, url: str, pbf_path: Path) -> bool:
        self._log_line(f"[3/5] Lade PBF herunter...")
        self._log_line(f"  URL: {url}")
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
                            label = f"PBF: {downloaded/1e6:.1f} / {total/1e6:.1f} MB"
                        else:
                            pct = 0
                            label = f"PBF: {downloaded/1e6:.1f} MB"
                        self._set_progress(pct, label)

            size_mb = pbf_path.stat().st_size / 1e6
            self._log_line(f"  Download abgeschlossen ({size_mb:.1f} MB).")
            return True

        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False

    def _step_convert(self, pbf_path: Path, mbtiles_path: Path) -> bool:
        self._log_line("[4/5] Konvertiere mit tilemaker...")
        self._set_progress(0, "Konvertierung läuft...")

        if mbtiles_path.exists():
            mbtiles_path.unlink()

        cmd = [
            str(WORK_DIR / "tilemaker.exe"),
            "--input", str(pbf_path),
            "--output", str(mbtiles_path),
            "--config", str(WORK_DIR / "config-openmaptiles.json"),
            "--process", str(WORK_DIR / "process-openmaptiles.lua"),
        ]

        self._log_line("  " + " ".join(cmd))

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                cwd=str(WORK_DIR),
            )

            for line in proc.stdout:
                if self._cancel_event.is_set():
                    proc.kill()
                    self._log_line("  [Abgebrochen]")
                    return False
                line = line.rstrip()
                if line:
                    self._log_line("  " + line)

            proc.wait()
            if proc.returncode != 0:
                self._log_line(f"  [Fehler] tilemaker Exitcode: {proc.returncode}")
                return False

            if not mbtiles_path.exists():
                self._log_line("  [Fehler] Ausgabedatei nicht erzeugt.")
                return False

            size_mb = mbtiles_path.stat().st_size / 1e6
            self._log_line(f"  Konvertierung abgeschlossen ({size_mb:.1f} MB).")
            return True

        except Exception as e:
            self._log_line(f"  [Fehler] {e}")
            return False

    def _step_upload(self, mbtiles_path: Path, pi_address: str, mbtiles_name: str) -> bool:
        self._log_line("[5/5] Lade auf Pi hoch...")
        url = f"http://{pi_address}/api/map/regions/upload-raw"
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
