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
    const MAX_BUOYS = 500;
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
    function makeBuoy(THREE, K, S) {
        const g = new THREE.Group();
        const mat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0.1, side: THREE.DoubleSide });
        const bh = S, rB = S * 0.34, rT = S * 0.22;

        // Körper: Farbbänder (bands[0] = oben) als gestapelte Zylinder-Segmente
        if (K.shape === 'cone') {
            const m = new THREE.Mesh(new THREE.ConeGeometry(rB, bh, 18), mat(K.bands[0]));
            m.position.y = bh / 2; g.add(m);
        } else {
            const n = K.bands.length, seg = bh / n;
            for (let i = 0; i < n; i++) {                    // i: 0=unten .. n-1=oben
                const yb = i * seg, yt = (i + 1) * seg;
                const rb = rB + (rT - rB) * (yb / bh);
                const rt = rB + (rT - rB) * (yt / bh);
                const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, seg + 0.001, 18), mat(K.bands[n - 1 - i]));
                m.position.y = (yb + yt) / 2; g.add(m);
            }
        }

        // Mast + Toppzeichen (aus S-57 TOPSHP)
        const tc = K.topColor || COL.black;
        const mast = (toY) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.03, S * 0.03, toY - bh, 8), mat(COL.black)); m.position.y = (bh + toY) / 2; g.add(m); };
        const cone = (up, y) => { const m = new THREE.Mesh(new THREE.ConeGeometry(S * 0.2, S * 0.36, 16), mat(tc)); m.position.y = y; if (!up) m.rotation.x = Math.PI; g.add(m); };
        const ball = (y) => { const m = new THREE.Mesh(new THREE.SphereGeometry(S * 0.2, 16, 12), mat(tc)); m.position.y = y; g.add(m); };
        const can  = (y) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.17, S * 0.17, S * 0.34, 14), mat(tc)); m.position.y = y; g.add(m); };
        const board = (y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(S * 0.55, S * 0.5, S * 0.06), mat(tc)); m.position.y = y; g.add(m); };
        const cube = (y) => { const m = new THREE.Mesh(new THREE.BoxGeometry(S * 0.34, S * 0.34, S * 0.34), mat(tc)); m.position.y = y; m.rotation.z = Math.PI / 4; g.add(m); };
        const bar  = (y, rot, len) => { const m = new THREE.Mesh(new THREE.BoxGeometry(len, S * 0.12, S * 0.12), mat(tc)); m.position.y = y; m.rotation.z = rot; g.add(m); };

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
        return g;
    }

    // ---- Kontext ----
    const CTX = { active: false, built: false, origin: null, scale: 1,
                  scene: null, camera: null, renderer: null, rotX: null, moveHandler: null };

    function getMap() {
        const m = window.BoatOS && BoatOS.map && BoatOS.map.getMap && BoatOS.map.getMap();
        return m || null;
    }

    // Gibt GPU-Ressourcen einer alten Szene frei (sonst WebGL-Speicherleck bei jedem Rebuild)
    function _disposeScene(s) {
        if (!s) return;
        s.traverse((o) => {
            if (o.geometry) o.geometry.dispose();
            if (o.material) {
                const mats = Array.isArray(o.material) ? o.material : [o.material];
                mats.forEach((m) => m && m.dispose());
            }
        });
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
        if (feats.length === 0 && !sourceLoaded && CTX.scene) return;

        const scene = new THREE.Scene();
        scene.add(new THREE.AmbientLight(0xffffff, 0.95));
        const dir = new THREE.DirectionalLight(0xffffff, 0.7);
        dir.position.set(0.4, 1, 0.5); scene.add(dir);

        const mLat = 111320, mLon = 111320 * Math.cos(c.lat * Math.PI / 180);
        const seen = new Set();
        let count = 0;
        for (const f of feats) {
            const geo = f.geometry;
            if (!geo || geo.type !== 'Point') continue;
            const [lng, lat] = geo.coordinates;
            const key = lng.toFixed(5) + ',' + lat.toFixed(5);   // ~1 m: Tile-Grenzen-Duplikate zusammenfassen
            if (seen.has(key)) continue;
            seen.add(key);
            const b = makeBuoy(THREE, describe(f.properties || {}), S);
            b.position.set((lng - c.lng) * mLon, 0, -(lat - c.lat) * mLat);   // (east, up, -north)
            scene.add(b);
            if (++count >= MAX_BUOYS) break;
        }

        _disposeScene(CTX.scene);   // alte Szene freigeben (kein WebGL-Leck)
        CTX.scene = scene;
        if (!CTX.camera) CTX.camera = new THREE.Camera();
        if (!CTX.rotX) CTX.rotX = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        map.triggerRepaint();
        return count;
    }

    function clearScene() {
        _disposeScene(CTX.scene);
        if (CTX.scene) CTX.scene = new (window.THREE.Scene)();
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
            _disposeScene(CTX.scene); CTX.scene = null;   // GPU-Ressourcen freigeben
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
