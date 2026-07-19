/**
 * Echte 3D-Seezeichen — MapLibre Custom-Layer + three.js
 * ======================================================
 * Rendert die Tonnen/Baken aus den amtlichen IENC-Vektordaten (Source 'ienc',
 * Source-Layer 'marks') als echte 3D-Objekte in dieselbe WebGL-Szene wie die
 * Karte: geo-fest verankert, kippen mit dem Pitch, stehen senkrecht.
 *
 * - Nur im 3D-/Look-ahead-Modus aktiv (map.js: toggleMap3D → BoatOS3D.setActive).
 * - Geometrie nach IALA/S-57 (Körperfarbbänder + charakteristisches Toppzeichen),
 *   Zuordnung datengetrieben aus _cls / COLOUR / CATCAM.
 * - Größe skaliert mit dem Zoom (≈ konstante Bildgröße), Neuaufbau bei moveend.
 * - Kein Dauer-Repaint: die Szene ist statisch, gezeichnet wird nur, wenn die
 *   Karte ohnehin neu zeichnet (Interaktion) + einmalig nach jedem Neuaufbau.
 */
(function () {
    const LAYER_ID = 'ienc-buoys-3d-gl';
    const BUOY_CLASSES = ['boylat', 'boycar', 'boyisd', 'boysaw', 'boyspp',
                          'bcnlat', 'bcncar', 'bcnisd', 'bcnsaw', 'bcnspp', 'daymar'];
    // Obergrenze sichtbarer Marken. Seit dem Instancing kostet eine zusaetzliche
    // Tonne nur noch eine Matrix statt eines eigenen Draw-Calls — die Grenze
    // darf deshalb deutlich hoeher liegen als die frueheren 500.
    const MAX_BUOYS = 2000;
    // Feste reale Größe (Meter): die Tonnen skalieren dann beim Zoomen von selbst
    // mit (echtes 3D-Objekt). Über BoatOS3D.setSize(m) einstellbar.
    const SIZE = { m: 15 };

    const COL = { red: 0xd10000, green: 0x009a3c, yellow: 0xf2c200, black: 0x1c1c1c, white: 0xf0f0f0, grey: 0x8a8a8a };

    // S-57 COLOUR-Codes → Farbe
    const S57 = { '1': COL.white, '2': COL.black, '3': COL.red, '4': COL.green, '5': COL.blue, '6': COL.yellow };

    // COLOUR (z.B. "4,1") → Farbbänder oben→unten
    function colourBands(colVal) {
        const parts = String(colVal == null ? '' : colVal).split(',').map(s => s.trim()).filter(Boolean);
        const bands = parts.map(d => S57[d]).filter(v => v != null);
        return bands.length ? bands : [COL.grey];
    }

    // _cls / COLOUR / TOPSHP / CATCAM → { shape, bands, topShp, topColor }
    // Körperfarbe aus COLOUR (echte Muster, auch mehrfarbig).
    // Toppzeichen aus S-57 TOPSHP (exakt), sonst Fallback aus Klasse/Quadrant.
    // TOPSHP: 1 Kegel↑, 2 Kegel↓, 3 Kugel, 4 2 Kugeln, 5 Zylinder, 6 Tafel,
    //         7 Andreaskreuz (X), 8 stehendes Kreuz (+), 9 Würfel/Raute,
    //         10 2 Kegel Spitze-an-Spitze, 11 2 Kegel Basis-an-Basis,
    //         12 Raute, 13 2 Kegel↑, 14 2 Kegel↓.
    function describe(p) {
        const cls = (p._cls != null ? String(p._cls) : '');
        const bands = colourBands(p.COLOUR);
        const prim = (p.COLOUR != null ? String(p.COLOUR) : '')[0] || '';
        const primColor = S57[prim] || COL.black;
        let topShp = (p.TOPSHP != null && p.TOPSHP !== '') ? parseInt(p.TOPSHP, 10) : null;

        if (cls === 'boycar' || cls === 'bcncar') {
            const q = (p.CATCAM != null ? String(p.CATCAM) : '')[0] || '';
            if (topShp == null) topShp = { '1': 13, '2': 11, '3': 14, '4': 10 }[q] || 13;
            const cb = bands.length > 1 ? bands
                : ({ '1': [COL.black, COL.yellow], '2': [COL.black, COL.yellow, COL.black],
                     '3': [COL.yellow, COL.black], '4': [COL.yellow, COL.black, COL.yellow] }[q] || [COL.black, COL.yellow]);
            return { shape: 'can', bands: cb, topShp, topColor: COL.black };
        }
        if (cls === 'boyisd' || cls === 'bcnisd') return { shape: 'can', bands: bands.length > 1 ? bands : [COL.black, COL.red, COL.black], topShp: topShp == null ? 4 : topShp, topColor: COL.black };
        if (cls === 'boysaw' || cls === 'bcnsaw') return { shape: 'can', bands: bands.length > 1 ? bands : [COL.red, COL.white], topShp: topShp == null ? 3 : topShp, topColor: COL.red };
        // Sondertonne: gelbes X NUR wenn TOPSHP es wirklich sagt (nicht erfinden)
        if (cls === 'boyspp' || cls === 'bcnspp') return { shape: 'can', bands, topShp, topColor: prim === '6' ? COL.yellow : primColor };

        // Lateraltonnen/-baken + Tagesmarken (daymar): Körper farbgetrieben, Toppzeichen aus TOPSHP
        const shape = (prim === '4') ? 'cone' : 'can';
        return { shape, bands, topShp, topColor: primColor };
    }

    // ---- Geometrie ----
    //
    // Gebaut wird nicht mehr pro Tonne, sondern pro ERSCHEINUNGSBILD (Form +
    // Farbbaender + Toppzeichen). Aus so einer Bauanleitung entstehen dann
    // InstancedMeshes, die alle Tonnen desselben Aussehens in einem Draw-Call
    // zeichnen — siehe _ensureTemplate(). Geometrien und Materialien liegen in
    // gemeinsamen Caches, weil sich verschiedene Erscheinungsbilder viele
    // Bauteile teilen (jede Kugel gleicher Groesse ist dieselbe Geometrie).

    const _geoms = new Map();     // Schluessel → THREE.BufferGeometry (Eigentuemer)
    const _mats = new Map();      // Farbe      → THREE.MeshStandardMaterial (Eigentuemer)
    let _dummy = null;            // Hilfsobjekt zum Zusammensetzen lokaler Matrizen
    let _m = null;                // Arbeitsmatrix fuer die Instanzen (nicht pro Tonne neu)

    function _geom(key, make) {
        let g = _geoms.get(key);
        if (!g) { g = make(); _geoms.set(key, g); }
        return g;
    }

    function _mat(THREE, color) {
        let m = _mats.get(color);
        if (!m) {
            m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
            _mats.set(color, m);
        }
        return m;
    }

    /** Lokale Lage eines Bauteils innerhalb der Tonne als Matrix. */
    function _local(THREE, y, rx, rz) {
        if (!_dummy) _dummy = new THREE.Object3D();
        _dummy.position.set(0, y, 0);
        _dummy.rotation.set(rx || 0, 0, rz || 0);
        _dummy.updateMatrix();
        return _dummy.matrix.clone();
    }

    /** Bauanleitung eines Erscheinungsbildes: Liste aus { geometry, material, local }. */
    function buoyParts(THREE, K, S) {
        const parts = [];
        const add = (geometry, color, y, rx, rz) =>
            parts.push({ geometry, material: _mat(THREE, color), local: _local(THREE, y, rx, rz) });
        const bh = S, rB = S * 0.34, rT = S * 0.22;

        // Körper: Farbbänder (bands[0] = oben) als gestapelte Zylinder-Segmente
        if (K.shape === 'cone') {
            add(_geom(`cone:${rB}:${bh}`, () => new THREE.ConeGeometry(rB, bh, 18)), K.bands[0], bh / 2);
        } else {
            const n = K.bands.length, seg = bh / n;
            for (let i = 0; i < n; i++) {                    // i: 0=unten .. n-1=oben
                const yb = i * seg, yt = (i + 1) * seg;
                const rb = rB + (rT - rB) * (yb / bh);
                const rt = rB + (rT - rB) * (yt / bh);
                const g = _geom(`cyl:${rt.toFixed(4)}:${rb.toFixed(4)}:${seg.toFixed(4)}`,
                                () => new THREE.CylinderGeometry(rt, rb, seg + 0.001, 18));
                add(g, K.bands[n - 1 - i], (yb + yt) / 2);
            }
        }

        // Mast + Toppzeichen (aus S-57 TOPSHP)
        const tc = K.topColor || COL.black;
        const mast = (toY) => add(_geom(`mast:${(toY - bh).toFixed(4)}`,
            () => new THREE.CylinderGeometry(S * 0.03, S * 0.03, toY - bh, 8)), COL.black, (bh + toY) / 2);
        const cone = (up, y) => add(_geom('tcone', () => new THREE.ConeGeometry(S * 0.2, S * 0.36, 16)),
            tc, y, up ? 0 : Math.PI);
        const ball = (y) => add(_geom('tball', () => new THREE.SphereGeometry(S * 0.2, 16, 12)), tc, y);
        const can  = (y) => add(_geom('tcan', () => new THREE.CylinderGeometry(S * 0.17, S * 0.17, S * 0.34, 14)), tc, y);
        const board = (y) => add(_geom('tboard', () => new THREE.BoxGeometry(S * 0.55, S * 0.5, S * 0.06)), tc, y);
        const cube = (y) => add(_geom('tcube', () => new THREE.BoxGeometry(S * 0.34, S * 0.34, S * 0.34)), tc, y, 0, Math.PI / 4);
        const bar  = (y, rot, len) => add(_geom(`tbar:${len.toFixed(4)}`,
            () => new THREE.BoxGeometry(len, S * 0.12, S * 0.12)), tc, y, 0, rot);

        const T = bh;   // Oberkante Körper
        const shp = K.topShp;
        if (shp != null) {
            mast(T + S * 0.32);
            const y1 = T + S * 0.5, lo = T + S * 0.42, hi = T + S * 0.74;
            switch (shp) {
                case 1:  cone(true, y1); break;                              // Kegel Spitze oben
                case 2:  cone(false, y1); break;                            // Kegel Spitze unten
                case 3:  ball(y1); break;                                    // Kugel
                case 4:  ball(lo); ball(hi); break;                          // 2 Kugeln
                case 5:  can(y1); break;                                     // Zylinder
                case 6:  board(T + S * 0.55); break;                         // Tafel
                case 7:  bar(y1, Math.PI / 4, S * 0.6); bar(y1, -Math.PI / 4, S * 0.6); break;   // Andreaskreuz X
                case 8:  bar(y1, 0, S * 0.6); bar(y1, Math.PI / 2, S * 0.6); break;              // stehendes Kreuz +
                case 9:  cube(y1); break;                                    // Würfel/Raute
                case 10: cone(false, lo); cone(true, hi); break;            // Spitze an Spitze
                case 11: cone(true, lo); cone(false, hi); break;           // Basis an Basis
                case 12: cone(true, T + S * 0.44); cone(false, T + S * 0.68); break;  // Raute
                case 13: cone(true, lo); cone(true, hi); break;            // 2 Kegel oben
                case 14: cone(false, lo); cone(false, hi); break;          // 2 Kegel unten
                default: ball(y1); break;
            }
        }
        return parts;
    }

    /** Erscheinungsbild → Schluessel. Gleicher Schluessel = gleiche Bauanleitung. */
    function buoySignature(K) {
        return `${K.shape}|${K.bands.join(',')}|${K.topShp == null ? '-' : K.topShp}|${K.topColor}`;
    }

    // ---- Kontext ----
    const CTX = { active: false, built: false, origin: null, scale: 1,
                  scene: null, camera: null, renderer: null, rotX: null, moveHandler: null };

    function getMap() {
        const m = window.BoatOS && BoatOS.map && BoatOS.map.getMap && BoatOS.map.getMap();
        return m || null;
    }

    /**
     * Tonnen-Bestand: EINE dauerhafte Szene, darin InstancedMeshes je Erscheinungsbild.
     *
     * Frueher war jede Tonne eine eigene Group aus 5–9 Meshes. Bei MAX_BUOYS
     * waren das mehrere tausend Draw-Calls pro Bild — auf der Pi-GPU der
     * teuerste Posten. Jetzt zeichnet ein InstancedMesh alle Tonnen desselben
     * Aussehens auf einmal; uebrig bleiben so viele Draw-Calls, wie es
     * unterschiedliche Erscheinungsbilder × Bauteile gibt (typisch < 200).
     *
     * Ein Rebuild baut deshalb nichts mehr auf, solange kein NEUES
     * Erscheinungsbild auftaucht — er schreibt nur Matrizen.
     *
     * WEM GEHOERT WAS (eine Ebene, ein Eigentuemer):
     *   _geoms      → die Geometrien       (geteilt ueber Erscheinungsbilder)
     *   _mats       → die Materialien      (geteilt, je Farbe eines)
     *   _templates  → die InstancedMeshes  (je Erscheinungsbild eines pro Bauteil)
     * Die Szene ist nur Anzeige, sie wird nie ersetzt und gibt nie etwas frei.
     */
    const _templates = new Map();     // signature → { parts, meshes, capacity, n }
    let _builtSize = SIZE.m;          // Groesse, mit der die Bauteile gebaut wurden

    /** Legt die Szene samt Licht einmalig an; danach immer dieselbe. */
    function _ensureScene(THREE) {
        if (CTX.scene) return CTX.scene;
        const scene = new THREE.Scene();
        // Weniger Grundhelligkeit, dafuer gerichtetes Licht: mit Ambient 0.95
        // war jede Flaeche gleich hell und die Tonnen wirkten wie flach
        // eingefaerbte Silhouetten. Hemisphere gibt Himmel oben / Wasser unten.
        scene.add(new THREE.AmbientLight(0xffffff, 0.35));
        scene.add(new THREE.HemisphereLight(0xbcd8f0, 0x4a5a63, 0.45));
        const dir = new THREE.DirectionalLight(0xfff4e2, 0.95);
        dir.position.set(0.5, 1, 0.35);
        scene.add(dir);
        CTX.scene = scene;
        return scene;
    }

    /** Legt die InstancedMeshes einer Vorlage an (bzw. groesser neu an). */
    function _allocTemplate(THREE, t, capacity) {
        _freeMeshes(t);
        t.capacity = capacity;
        t.meshes = t.parts.map((p) => {
            const im = new THREE.InstancedMesh(p.geometry, p.material, capacity);
            im.frustumCulled = false;   // Position steckt in den Instanz-Matrizen
            im.count = 0;
            CTX.scene.add(im);
            return im;
        });
    }

    /**
     * Gibt NUR die InstancedMeshes frei — nicht Geometrie/Material, die gehoeren
     * den gemeinsamen Caches und werden von anderen Vorlagen mitbenutzt.
     */
    function _freeMeshes(t) {
        (t.meshes || []).forEach((im) => {
            if (im.parent) im.parent.remove(im);
            im.dispose();
        });
        t.meshes = [];
    }

    /** Einzige Stelle, die eine Vorlage freigibt. */
    function _dropTemplate(sig) {
        const t = _templates.get(sig);
        if (!t) return;
        _freeMeshes(t);
        _templates.delete(sig);
    }

    /** Alles zurueck auf Anfang: Vorlagen UND die geteilten Ressourcen. */
    function _clearBuoys() {
        _geoms.forEach((g) => g.dispose());
        _geoms.clear();
        _mats.forEach((m) => m.dispose());
        _mats.clear();
    }
    // Rebuild drosseln: das Follow-jumpTo feuert moveend ~30×/s → sonst 30 Szenen-
    // Neuaufbauten pro Sekunde. Max. alle 500 ms, mit Nachlauf (settle).
    let _rebuildTimer = null, _lastRebuildTs = 0;
    const REBUILD_MIN_MS = 500;
    function scheduleRebuild() {
        const map = getMap(), THREE = window.THREE, maplibregl = window.maplibregl;
        if (!CTX.active || !map || !THREE || !maplibregl) return;
        const now = performance.now();
        const since = now - _lastRebuildTs;
        clearTimeout(_rebuildTimer); _rebuildTimer = null;
        if (since >= REBUILD_MIN_MS) {
            _lastRebuildTs = now;
            rebuild(map, THREE, maplibregl);
        } else {
            _rebuildTimer = setTimeout(() => {
                _rebuildTimer = null;
                if (!CTX.active) return;
                _lastRebuildTs = performance.now();
                rebuild(getMap(), window.THREE, window.maplibregl);
            }, REBUILD_MIN_MS - since);
        }
    }

    // Szene aus den aktuell sichtbaren IENC-Marken (neu) aufbauen
    function rebuild(map, THREE, maplibregl) {
        if (!map.getSource('ienc')) { clearScene(); return; }

        const c = map.getCenter();
        CTX.origin = maplibregl.MercatorCoordinate.fromLngLat([c.lng, c.lat], 0);
        CTX.scale = CTX.origin.meterInMercatorCoordinateUnits();
        const S = SIZE.m;   // feste reale Größe → skaliert mit dem Zoom von selbst

        let feats = [];
        try {
            feats = map.querySourceFeatures('ienc', {
                sourceLayer: 'marks',
                filter: ['in', ['get', '_cls'], ['literal', BUOY_CLASSES]],
            });
        } catch (_) { feats = []; }

        // Leeres Ergebnis heisst nicht "hier gibt es keine Tonnen" — bei schneller
        // Fahrt (Simulation) laufen wir den Tiles davon, und querySourceFeatures
        // liefert fuer noch nicht geladene Tiles nichts. Die vorhandene Szene dann
        // stehen lassen statt sie wegzuwischen (sonst blinkt die Betonnung weg).
        let sourceLoaded = true;
        try { sourceLoaded = map.isSourceLoaded('ienc'); } catch (_) {}
        if (feats.length === 0 && !sourceLoaded && _templates.size) return;

        _ensureScene(THREE);

        // Groesse per setSize() geaendert → die Bauteile haben die alte Groesse
        if (_builtSize !== S) { _clearBuoys(); _builtSize = S; }

        // 1. Sichtbare Marken nach Erscheinungsbild sortieren
        const mLat = 111320, mLon = 111320 * Math.cos(c.lat * Math.PI / 180);
        const seen = new Set();
        const bySig = new Map();     // signature → { K, pos: [x,y,z, x,y,z, …] }
        let count = 0;
        for (const f of feats) {
            const geo = f.geometry;
            if (!geo || geo.type !== 'Point') continue;
            const [lng, lat] = geo.coordinates;
            const key = lng.toFixed(5) + ',' + lat.toFixed(5);   // ~1 m: Tile-Grenzen-Duplikate zusammenfassen
            if (seen.has(key)) continue;
            seen.add(key);
            const K = describe(f.properties || {});
            const sig = buoySignature(K);
            let e = bySig.get(sig);
            if (!e) { e = { K, pos: [] }; bySig.set(sig, e); }
            // Positionen sind relativ zum Kartenmittelpunkt (east, up, -north)
            e.pos.push((lng - c.lng) * mLon, 0, -(lat - c.lat) * mLat);
            if (++count >= MAX_BUOYS) break;
        }

        // 2. Je Erscheinungsbild die Instanz-Matrizen schreiben
        if (!_m) _m = new THREE.Matrix4();
        _templates.forEach((t) => { t.n = 0; });
        bySig.forEach((e, sig) => {
            const n = e.pos.length / 3;
            let t = _templates.get(sig);
            if (!t) {
                t = { parts: buoyParts(THREE, e.K, S), meshes: [], capacity: 0, n: 0 };
                _templates.set(sig, t);
            }
            // Reserve mitwachsen lassen, damit nicht bei jeder neuen Tonne neu
            // alloziert wird; schrumpfen erst, wenn deutlich zu gross.
            if (n > t.capacity || n * 4 < t.capacity) {
                _allocTemplate(THREE, t, Math.max(16, Math.ceil(n * 1.5)));
            }
            for (let i = 0; i < n; i++) {
                for (let p = 0; p < t.parts.length; p++) {
                    // Instanz = Verschiebung an die Tonnenposition × lokale Lage
                    // des Bauteils. Da die Verschiebung rein translativ ist,
                    // genuegt es, die Translationsspalte zu addieren.
                    _m.copy(t.parts[p].local);
                    _m.elements[12] += e.pos[i * 3];
                    _m.elements[13] += e.pos[i * 3 + 1];
                    _m.elements[14] += e.pos[i * 3 + 2];
                    t.meshes[p].setMatrixAt(i, _m);
                }
            }
            t.n = n;
        });

        // 3. Sichtbare Anzahl setzen; Vorlagen ohne Tonnen bleiben leer stehen
        //    (kein Neuaufbau, wenn wir gleich wieder welche brauchen).
        _templates.forEach((t) => {
            t.meshes.forEach((im) => {
                im.count = t.n;
                im.instanceMatrix.needsUpdate = true;
            });
        });

        if (!CTX.camera) CTX.camera = new THREE.Camera();
        if (!CTX.rotX) CTX.rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        map.triggerRepaint();
        return count;
    }

    function clearScene() {
        _clearBuoys();   // Szene bleibt bestehen (nur Licht), die Tonnen sind raus
        const map = getMap();
        if (map) map.triggerRepaint();
    }

    function ensureLayer(map, THREE) {
        if (CTX.built) return;
        const layer = {
            id: LAYER_ID, type: 'custom', renderingMode: '3d',
            onAdd(m, gl) {
                CTX.renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
                CTX.renderer.autoClear = false;
            },
            render(gl, matrix) {
                if (!CTX.renderer || !CTX.scene || !CTX.origin) return;
                const o = CTX.origin, s = CTX.scale;
                const l = new THREE.Matrix4()
                    .makeTranslation(o.x, o.y, o.z)
                    .scale(new THREE.Vector3(s, -s, s))
                    .multiply(CTX.rotX);
                CTX.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix).multiply(l);
                CTX.renderer.resetState();
                CTX.renderer.render(CTX.scene, CTX.camera);
            },
        };
        if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
        map.addLayer(layer);
        CTX.built = true;
    }

    function setActive(on) {
        const THREE = window.THREE, maplibregl = window.maplibregl, map = getMap();
        CTX.active = !!on;
        if (!THREE || !maplibregl || !map) return;

        if (on) {
            // NICHT auf isStyleLoaded()/'idle' warten! isStyleLoaded() ist false,
            // solange irgendeine Source noch Tiles nachlaedt, und 'idle' feuert erst,
            // wenn die Karte STILLSTEHT und alles geladen ist. In der Simulation
            // bewegt das Follow-jumpTo die Karte dauerhaft → es laedt immer etwas
            // nach, 'idle' kam nie, und die 3D-Betonnung wurde schlicht nie aktiviert.
            // Zum Anlegen von Layer und Szene reicht: die IENC-Source existiert.
            if (!map.getSource('ienc')) {
                map.once('styledata', () => { if (CTX.active) setActive(true); });
                return;
            }
            ensureLayer(map, THREE);
            _lastRebuildTs = performance.now();
            rebuild(map, THREE, maplibregl);
            if (!CTX.moveHandler) {
                CTX.moveHandler = scheduleRebuild;   // gedrosselt (nicht bei jedem moveend voll neu bauen)
                map.on('moveend', CTX.moveHandler);
            }
        } else {
            if (CTX.moveHandler) { map.off('moveend', CTX.moveHandler); CTX.moveHandler = null; }
            clearTimeout(_rebuildTimer); _rebuildTimer = null;
            if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
            _clearBuoys(); CTX.scene = null;   // GPU-Ressourcen freigeben
            CTX.built = false;
            map.triggerRepaint();
        }
    }

    window.BoatOS3D = {
        setActive,
        refresh() { const m = getMap(); if (CTX.active && m) rebuild(m, window.THREE, window.maplibregl); },
        isActive() { return CTX.active; },
        setSize(m) { SIZE.m = m; this.refresh(); },   // reale Tonnengröße in Metern
    };
})();
