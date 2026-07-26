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
 * - Größe skaliert mit dem Zoom (≈ konstante Bildgröße), Abgleich bei moveend.
 * - Kein Dauer-Repaint: die Szene ist statisch, gezeichnet wird nur, wenn die
 *   Karte ohnehin neu zeichnet (Interaktion) + einmalig nach jedem Abgleich.
 *
 * AUFBAU (wichtig zu verstehen, bevor man hier etwas ändert)
 * ----------------------------------------------------------
 * Gebaut wird nicht pro Tonne, sondern pro ERSCHEINUNGSBILD — also je
 * Kombination aus Form, Farbbändern und Toppzeichen (buoySignature). Aus so
 * einer Bauanleitung (buoyParts) entsteht je Bauteil ein InstancedMesh, das
 * alle Marken desselben Aussehens in einem einzigen Draw-Call zeichnet.
 *
 * Ein Abgleich (rebuild) baut deshalb nichts mehr auf, solange kein NEUES
 * Erscheinungsbild ins Bild kommt — er schreibt nur Instanz-Matrizen. Das ist
 * der Grund, warum MAX_BUOYS bei 2000 liegen kann und die Simulation nicht
 * mehr stockt: eine zusätzliche Marke kostet eine Matrix, keinen Draw-Call.
 *
 * Wem gehört was — eine Ebene, ein Eigentümer:
 *   _geoms      → die Geometrien      (geteilt: gleiche Kugel = eine Geometrie)
 *   _mats       → die Materialien     (geteilt: eines je Farbe)
 *   _templates  → die InstancedMeshes (je Erscheinungsbild eines pro Bauteil)
 * Die Szene ist nur Anzeige: sie wird nie ersetzt und gibt nie etwas frei.
 * _freeMeshes() räumt ausschließlich die InstancedMeshes ab (Geometrie und
 * Material benutzen andere Vorlagen mit!); alle drei Ebenen räumt nur
 * _clearBuoys() ab — beim Größenwechsel und beim Deaktivieren.
 */
(function () {
    const LAYER_ID = 'ienc-buoys-3d-gl';
    const BUOY_CLASSES = ['boylat', 'boycar', 'boyisd', 'boysaw', 'boyspp',
                          'bcnlat', 'bcncar', 'bcnisd', 'bcnsaw', 'bcnspp', 'daymar'];
    // Obergrenze sichtbarer Marken. Seit dem Instancing kostet eine zusaetzliche
    // Tonne nur noch eine Matrix statt eines eigenen Draw-Calls — die Grenze
    // darf deshalb deutlich hoeher liegen als die frueheren 500.
    const MAX_BUOYS = 2000;
    // Eigenes Budget fuer Schilder: sie sind zahlreicher als alles andere
    // zusammen und wuerden sich sonst das Marken-Limit unter den Nagel reissen.
    const MAX_SIGNS = 800;
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

        // Tagesmarken (daymar) sind KEINE Tonnen: sie schwimmen nicht, sondern
        // sind Formen (Kegel, Raute, Kreuz) auf einem Pfahl an Land oder auf
        // einem Bauwerk. Mit Tonnenkoerper sahen sie im Bild wie rot-weisse
        // Tonnen am Ufer aus. Deshalb ohne Koerper — nur Pfahl + Form.
        if (cls === 'daymar') {
            // flat = flache Tafel ohne Ausrichtung in den Daten. Der Abgleich
            // dreht sie zur Kamera, sonst waere sie von der Seite unsichtbar.
            return { shape: 'can', bands, topShp, topColor: primColor, body: false,
                     flat: topShp === 12 || topShp === 19 };
        }

        // Lateraltonnen/-baken: Körper farbgetrieben, Toppzeichen aus TOPSHP
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
    let _m = null;                // Arbeitsmatrix fuer die Instanzen (nicht pro Marke neu)
    let _mr = null;               // Arbeitsmatrix fuer die Drehung (Schilder)

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

    /** Lokale Lage eines Bauteils innerhalb der Marke als Matrix. */
    function _local(THREE, y, rx, rz) {
        return _localAt(THREE, 0, y, 0, rx, rz);
    }

    /** Wie _local, aber mit Versatz in x/z und Drehung um die Hochachse. */
    function _localAt(THREE, x, y, z, rx, rz, ry) {
        if (!_dummy) _dummy = new THREE.Object3D();
        _dummy.position.set(x || 0, y, z || 0);
        _dummy.rotation.set(rx || 0, ry || 0, rz || 0);
        _dummy.updateMatrix();
        return _dummy.matrix.clone();
    }

    /** Bauanleitung eines Erscheinungsbildes: Liste aus { geometry, material, local }. */
    function buoyParts(THREE, K, S) {
        const parts = [];
        const add = (geometry, color, y, rx, rz, ry) =>
            parts.push({ geometry, material: _mat(THREE, color),
                         local: _localAt(THREE, 0, y, 0, rx, rz, ry) });
        // Tagesmarken haben keinen Koerper — die Form sitzt auf einem Pfahl.
        const hasBody = K.body !== false;
        const bh = hasBody ? S : 0, rB = S * 0.34, rT = S * 0.22;

        // Körper: Farbbänder (bands[0] = oben) als gestapelte Zylinder-Segmente
        if (!hasBody) {
            /* kein Tonnenkoerper */
        } else if (K.shape === 'cone') {
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
        // Raute = gekippte quadratische TAFEL mit weissem Rand, nicht zwei
        // Kegel. Der Rand liegt als leicht groessere Platte dahinter, beide
        // zentriert, damit die Marke von beiden Seiten gleich aussieht.
        const rhomb = (y) => plate(y, Math.PI / 4);
        // Quadratische Tafel mit Rand — wie die Raute, nur ungekippt.
        const square = (y) => plate(y, 0);
        function plate(y, rot) {
            const a = S * 0.5;
            // Die REIHENFOLGE in COLOUR ist bei Tafeln nicht verlaesslich: fuer
            // dieselbe gruen-weisse Raute steht in den Daten 179× "4,1" und
            // 31× "1,4". Aus der Position laesst sich Rand und Flaeche also
            // nicht ableiten. Verlaesslich ist die Rolle der Farben: WEISS ist
            // der Rand, die farbige Angabe die Flaeche. Ohne Weiss (selten,
            // z. B. "6,2,6") gilt die erste Farbe als Rand.
            const bs = K.bands || [];
            const faceC = bs.find((c) => c !== COL.white) || bs[0] || tc;
            const edgeC = bs.includes(COL.white)
                ? COL.white
                : (bs.find((c) => c !== faceC) || COL.white);
            const edge = _geom(`pledge:${a.toFixed(3)}`, () => new THREE.BoxGeometry(a, a, S * 0.05));
            const face = _geom(`plface:${a.toFixed(3)}`, () => new THREE.BoxGeometry(a * 0.74, a * 0.74, S * 0.08));
            // EINE Tafel. Ihre Ausrichtung setzt der Abgleich pro Instanz so,
            // dass sie zur Kamera zeigt (siehe K.flat in rebuild) — Tagesmarken
            // haben kein ORIENT, und eine starre flache Platte ist von der
            // Seite nur ein Strich. Zwei gekreuzte Platten haben das zwar
            // geloest, sahen aber aus wie zwei ineinandergesteckte Schilder.
            add(edge, edgeC, y, 0, rot);
            add(face, faceC, y, 0, rot);
        }

        // Oberkante Koerper — bei Tagesmarken stattdessen Pfahlhoehe, sonst
        // saesse die Form am Boden.
        const T = hasBody ? bh : S * 0.9;
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
                case 12: rhomb(T + S * 0.56); break;                          // Raute (gekippte Tafel)
                case 13: cone(true, lo); cone(true, hi); break;            // 2 Kegel oben
                case 14: cone(false, lo); cone(false, hi); break;          // 2 Kegel unten
                // 19 steht nicht im S-57-Katalog, kommt in den Karten aber 220×
                // vor (Tagesmarken). Vor Ort ist es eine quadratische Tafel —
                // rot mit weissem Rand, Farbe wie immer aus COLOUR. Vorher fiel
                // es in den default und wurde als Kugel gezeichnet.
                case 19: square(T + S * 0.56); break;                        // quadratische Tafel
                default: ball(y1); break;
            }
        }
        return parts;
    }

    /** Erscheinungsbild → Schluessel. Gleicher Schluessel = gleiche Bauanleitung. */
    function buoySignature(K) {
        return `${K.shape}|${K.bands.join(',')}|${K.topShp == null ? '-' : K.topShp}`
             + `|${K.topColor}|${K.body === false ? 'nb' : 'b'}`;
    }

    // ---- Schilder (CEVNI-Binnenschifffahrtszeichen, S-57 notmrk) ----
    //
    // Mit Abstand die groesste Klasse in den Karten (3570 Stueck gegenueber 2026
    // Tagesmarken und 168 Tonnen). Zwei Attribute tragen die Darstellung:
    //   fnctnm — Funktion: 1 Verbot, 2 Gebot, 3 Einschraenkung,
    //            4 Empfehlung, 5 Hinweis. Bei ALLEN 3570 vorhanden.
    //   catnmk — konkreter Zeichentyp (67 verschiedene). Steuert spaeter das
    //            Symbol auf der Tafel; die haeufigsten 15 decken nur 66 % ab.
    //   ORIENT — Ausrichtung in Grad, bei 2820 von 3570 vorhanden.
    //
    // ACHTUNG, VORLAEUFIG: Die Farbgebung je Funktionsklasse unten ist eine
    // ANNAHME. Die BinSchStrO/CEVNI beschreibt die Zeichen ueber Abbildungen,
    // nicht ueber Farbvorgaben im Text, und die greifbaren Sekundaerquellen
    // widersprechen sich (Rechteck mit rotem Rand vs. Kreis/Raute). Vor dem
    // Anspruch "amtlich korrekt" muss das gegen die echten Tafeln geprueft
    // werden. Die Mechanik (Aufstellen, Ausrichten, Instancing) ist davon
    // unberuehrt — es aendern sich nur Farben und Formen in signParts().
    const SIGN = {
        1: { face: 0xf2f2f2, edge: 0xd10000 },   // Verbot
        2: { face: 0xf2f2f2, edge: 0xd10000 },   // Gebot
        3: { face: 0xf2f2f2, edge: 0xd10000 },   // Einschraenkung
        4: { face: 0xf2f2f2, edge: 0x1c1c1c },   // Empfehlung
        5: { face: 0x1b4f9c, edge: 0xf0f0f0 },   // Hinweis
    };

    /* ── Amtliche Zeichenbilder ──────────────────────────────────────────────
     * icons/cevni/index.json bildet catnmk auf die Abbildung aus BinSchStrO
     * Anlage 7 ab (von ELWIS bezogen, Zuordnung ueber Annex AA des Inland-ENC
     * Encoding Guide). Deckt rund 76 % der Schilder ab; der Rest hat entweder
     * keinen CEVNI-Code in den Daten oder nur eine Diagramm-Skizze statt einer
     * Tafel — dort bleibt die geometrische Tafel aus signParts().
     */
    let _signIndex = null;              // catnmk → { img, ar }
    const _signTex = new Map();         // Bilddatei → THREE.Texture  (Eigentuemer)
    const _signMats = new Map();        // Bilddatei → THREE.Material (Eigentuemer)

    function _loadSignIndex() {
        if (_signIndex !== null) return;
        _signIndex = {};                // verhindert Mehrfachladen
        fetch('icons/cevni/index.json')
            .then((r) => (r.ok ? r.json() : {}))
            .then((j) => {
                _signIndex = j;
                // Vorlagen neu aufbauen, damit die Schilder ihr Bild bekommen
                const m = getMap();
                if (CTX.active && m) { _clearBuoys(); rebuild(m, window.THREE, window.maplibregl); }
            })
            .catch(() => {});
    }

    /**
     * Textur UND Material je Bilddatei — beides gehoert diesen Caches, nicht
     * der Vorlage. Sonst haetten Materialien wieder zwei moegliche Eigentuemer,
     * genau wie frueher bei den Tonnen-Meshes.
     */
    function _signMaterial(THREE, img) {
        let m = _signMats.get(img);
        if (m) return m;
        let t = _signTex.get(img);
        if (!t) {
            t = new THREE.TextureLoader().load('icons/cevni/' + img, () => {
                const map = getMap(); if (map) map.triggerRepaint();   // geladen → neu zeichnen
            });
            if (THREE.SRGBColorSpace) t.colorSpace = THREE.SRGBColorSpace;
            _signTex.set(img, t);
        }
        // FrontSide, NICHT DoubleSide: eine beidseitig sichtbare Flaeche zeigt
        // von hinten das seitenverkehrte Bild — Schrift und Schraegbalken waren
        // gespiegelt. Stattdessen setzt signParts() zwei Blaetter Ruecken an
        // Ruecken, jedes nach vorn gerichtet.
        m = new THREE.MeshBasicMaterial({
            map: t,
            side: THREE.FrontSide,
            transparent: true,
        });
        _signMats.set(img, m);
        return m;
    }

    function describeSign(p) {
        const fn = parseInt(p.fnctnm, 10);
        const o = parseFloat(p.ORIENT);
        const cat = p.catnmk != null ? String(p.catnmk) : null;
        const ix = (_signIndex && cat) ? _signIndex[cat] : null;
        return {
            fn: SIGN[fn] ? fn : 5,
            cat,
            img: ix ? ix.img : null,
            ar: ix ? ix.ar : null,
            // ORIENT ist eine Peilung von Nord im Uhrzeigersinn. In der Szene
            // ist +x Ost und -z Nord; die Tafel-Normale zeigt per Default nach
            // +z. Rein geometrisch waere ry = PI - ORIENT — dann schauten die
            // Tafeln aber alle vom Wasser weg. ORIENT bezeichnet offenbar die
            // Richtung, aus der man das Zeichen liest (also die Blickrichtung
            // des Schiffers), nicht die Blickrichtung der Tafel. Deshalb die
            // zusaetzliche halbe Drehung: ry = -ORIENT.
            ry: Number.isFinite(o) ? -o * Math.PI / 180 : null,
        };
    }

    /**
     * Bauanleitung eines Schildes: nur die Tafel (Rand als leicht groessere
     * Platte dahinter), bewusst ohne Pfosten — der traegt keine Information
     * und kostet bei 800 Schildern ein Drittel der Draw-Calls.
     * Das Symbol auf der Tafel fehlt noch: dafuer muessten die CEVNI-Zeichen
     * als Textur vorliegen.
     */
    /**
     * Rautenfoermige Brueckenzeichen, die sich nicht aus einem Bild ergeben.
     *
     *   catnmk 44 — empfohlene Durchfahrt (beide Richtungen): gelbe Raute.
     *               Hat im Encoding Guide keinen CEVNI-Code, also auch kein
     *               Bild — vorher erschien die weisse Ersatztafel.
     *   catnmk 12/13 — A.10, Durchfahrt links bzw. rechts verboten: Raute zur
     *               Haelfte rot, zur Haelfte weiss. Die WEISSE Haelfte zeigt
     *               zur erlaubten Durchfahrt, steht also bei 12 rechts und bei
     *               13 links. (Die amtliche Abbildung zeigt beide Tafeln
     *               nebeneinander und war deshalb als Textur unbrauchbar.)
     */
    const DIAMOND = { 44: 'gelb', 12: 'weiss-rechts', 13: 'weiss-links' };

    function diamondParts(THREE, kind, S, cy) {
        const a = S * 0.42;                       // halbe Diagonale
        const tri = (side) => {                   // side: +1 rechts, -1 links
            const s = new THREE.Shape();
            s.moveTo(0, a); s.lineTo(side * a, 0); s.lineTo(0, -a); s.closePath();
            return new THREE.ShapeGeometry(s);
        };
        const full = () => {
            const s = new THREE.Shape();
            s.moveTo(0, a); s.lineTo(a, 0); s.lineTo(0, -a); s.lineTo(-a, 0); s.closePath();
            return new THREE.ShapeGeometry(s);
        };
        const out = [];
        const push = (geometry, color, z) => {
            out.push({ geometry, material: _mat(THREE, color), local: _localAt(THREE, 0, cy, z) });
            // Rueckseite: gleiche Flaeche um 180° gedreht, sonst waere das
            // Zeichen von hinten spiegelverkehrt (wie bei den Bild-Tafeln).
            out.push({ geometry, material: _mat(THREE, color),
                       local: _localAt(THREE, 0, cy, -z, 0, 0, Math.PI) });
        };
        if (kind === 'gelb') {
            push(_geom(`dmfull:${a.toFixed(3)}`, full), COL.yellow, S * 0.01);
        } else {
            const whiteSide = kind === 'weiss-rechts' ? 1 : -1;
            push(_geom(`dmtri:${a.toFixed(3)}:${whiteSide}`, () => tri(whiteSide)), COL.white, S * 0.01);
            push(_geom(`dmtri:${a.toFixed(3)}:${-whiteSide}`, () => tri(-whiteSide)), COL.red, S * 0.01);
        }
        return out;
    }

    function signParts(THREE, K, S) {
        const parts = [];
        const c = SIGN[K.fn] || SIGN[5];
        const cy = S * 0.95;

        // Rautenzeichen zuerst: sie gehen sowohl der Textur als auch der
        // rechteckigen Ersatztafel vor.
        const dm = DIAMOND[K.cat];
        if (dm) return diamondParts(THREE, dm, S, cy);

        // Liegt die amtliche Abbildung vor, ist das Schild EIN texturiertes
        // Blatt — Rand, Symbol und Schraegbalken stecken bereits im Bild. Das
        // ist nicht nur richtiger, sondern auch billiger: ein Bauteil statt
        // drei. Seitenverhaeltnis kommt aus dem Bild, damit hohe Tafeln
        // (z. B. B.2) nicht gestaucht werden.
        if (K.img) {
            const hh = S * 0.78, ww = hh * (K.ar || 1);
            const geometry = _geom(`splane:${ww.toFixed(3)}:${hh.toFixed(3)}`,
                                   () => new THREE.PlaneGeometry(ww, hh));
            const material = _signMaterial(THREE, K.img);
            // Zwei Blaetter Ruecken an Ruecken (das hintere um 180° gedreht),
            // damit das Zeichen von beiden Seiten richtig herum steht.
            parts.push({ geometry, material, local: _localAt(THREE, 0, cy, 0) });
            parts.push({ geometry, material, local: _localAt(THREE, 0, cy, 0, 0, 0, Math.PI) });
            return parts;
        }

        const w = S * 0.85, h = S * 0.62;
        const fw = w * 0.82, fh = h * 0.76;          // Innenfeld
        const add = (geometry, color, y, z, rz) => parts.push({
            geometry, material: _mat(THREE, color), local: _localAt(THREE, 0, y, z || 0, 0, rz || 0),
        });
        // Alle Platten sind ZENTRIERT und werden nach hinten hin dicker, damit
        // die Tafel von BEIDEN Seiten gleich aussieht. Stand die Frontplatte
        // nur nach vorne ueber, sah man von hinten die nackte Randplatte —
        // also ein komplett rotes bzw. schwarzes Schild, und der Schraegbalken
        // kippte auf die falsche Diagonale.
        add(_geom(`sedge:${w.toFixed(3)}`, () => new THREE.BoxGeometry(w, h, S * 0.04)),
            c.edge, cy, 0);
        add(_geom(`sface:${w.toFixed(3)}`, () => new THREE.BoxGeometry(fw, fh, S * 0.07)),
            c.face, cy, 0);

        // Verbotszeichen (Gruppe A) tragen einen roten Schrägbalken von links
        // oben nach rechts unten — an den amtlichen Abbildungen (ELWIS,
        // BinSchStrO Anlage 7) geprueft. Rein geometrisch, keine Textur noetig,
        // und das einzige Merkmal, das Gruppe A ohne Symbol erkennbar macht.
        if (K.fn === 1) {
            const len = Math.hypot(fw, fh) * 0.98;
            const rz = -Math.atan2(fh, fw);
            add(_geom(`sbar:${len.toFixed(3)}`,
                () => new THREE.BoxGeometry(len, h * 0.12, S * 0.09)),
                SIGN[1].edge, cy, 0, rz);
        }
        return parts;
    }

    /**
     * Nur was das AUSSEHEN bestimmt, gehoert in den Schluessel — sonst
     * entstuenden aus 5 Funktionen × 67 Zeichentypen hunderte Vorlagen und der
     * Gewinn des Instancings waere dahin. catnmk kommt erst dazu, wenn es
     * tatsaechlich verschiedene Symbole gibt.
     */
    function signSignature(K) {
        // Das BILD bestimmt das Aussehen, nicht catnmk selbst — Zeichen ohne
        // Abbildung teilen sich weiterhin die geometrische Tafel je Funktion.
        // Ausnahme: die Rautenzeichen haben ihre eigene Form je catnmk.
        if (DIAMOND[K.cat]) return `sign|raute|${K.cat}`;
        return K.img ? `sign|img|${K.img}` : `sign|${K.fn}`;
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

    /**
     * Schilder der sichtbaren Karte einsammeln und in dieselbe Vorlagen-Struktur
     * einhaengen wie die Tonnen.
     *
     * Eigenes Budget, weil notmrk die Marken zahlenmaessig erdrueckt (3570 zu
     * 168) — ohne Deckel wuerden die Schilder allein das Limit aufbrauchen und
     * die Betonnung verdraengen.
     */
    function _collectSigns(map, THREE, c, mLon, mLat, bySig, S) {
        _loadSignIndex();
        let feats = [];
        try {
            feats = map.querySourceFeatures('ienc', {
                sourceLayer: 'marks',
                filter: ['==', ['get', '_cls'], 'notmrk'],
            });
        } catch (_) { feats = []; }

        const seen = new Set();
        let n = 0;
        for (const f of feats) {
            const geo = f.geometry;
            if (!geo || geo.type !== 'Point') continue;
            const [lng, lat] = geo.coordinates;
            const key = lng.toFixed(5) + ',' + lat.toFixed(5);
            if (seen.has(key)) continue;
            seen.add(key);
            const K = describeSign(f.properties || {});
            const sig = signSignature(K);
            let e = bySig.get(sig);
            if (!e) { e = { make: () => signParts(THREE, K, S), items: [] }; bySig.set(sig, e); }
            e.items.push({
                x: (lng - c.lng) * mLon, y: 0, z: -(lat - c.lat) * mLat,
                ry: K.ry,   // null → keine Ausrichtung bekannt, Tafel bleibt ungedreht
            });
            if (++n >= MAX_SIGNS) break;
        }
        return n;
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
        const bearing = ((map.getBearing && map.getBearing()) || 0) * Math.PI / 180;
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
            if (!e) { e = { make: () => buoyParts(THREE, K, S), items: [] }; bySig.set(sig, e); }
            // Positionen sind relativ zum Kartenmittelpunkt (east, up, -north)
            e.items.push({
                x: (lng - c.lng) * mLon, y: 0, z: -(lat - c.lat) * mLat,
                // Flache Tafeln der Kamera zuwenden. Die Tafel-Normale zeigt
                // per Default nach +z; ry = -Kartenpeilung dreht sie der
                // Blickrichtung entgegen. Das entspricht auch der Wirklichkeit:
                // Tagesmarken stehen zum Fahrwasser, also dem entgegenkommenden
                // Verkehr zugewandt.
                ry: K.flat ? -bearing : null,
            });
            if (++count >= MAX_BUOYS) break;
        }

        // 1b. Schilder — eigene S-57-Klasse, eigenes Budget, aber dieselbe
        //     Vorlagen-Mechanik. Sie stehen an Land und sind ausgerichtet.
        _collectSigns(map, THREE, c, mLon, mLat, bySig, S);

        // 2. Je Erscheinungsbild die Instanz-Matrizen schreiben
        if (!_m) _m = new THREE.Matrix4();
        if (!_mr) _mr = new THREE.Matrix4();
        _templates.forEach((t) => { t.n = 0; });
        bySig.forEach((e, sig) => {
            const n = e.items.length;
            let t = _templates.get(sig);
            if (!t) {
                t = { parts: e.make(), meshes: [], capacity: 0, n: 0 };
                _templates.set(sig, t);
            }
            // Reserve mitwachsen lassen, damit nicht bei jeder neuen Marke neu
            // alloziert wird; schrumpfen erst, wenn deutlich zu gross.
            if (n > t.capacity || n * 4 < t.capacity) {
                _allocTemplate(THREE, t, Math.max(16, Math.ceil(n * 1.5)));
            }
            for (let i = 0; i < n; i++) {
                const it = e.items[i];
                for (let p = 0; p < t.parts.length; p++) {
                    // Instanz = Verschiebung × Drehung um die Hochachse × lokale
                    // Lage des Bauteils. Ohne Drehung (Tonnen) faellt die
                    // Multiplikation weg und es genuegt, die Translationsspalte
                    // zu addieren — die Verschiebung ist rein translativ.
                    if (it.ry == null) {
                        _m.copy(t.parts[p].local);
                    } else {
                        _mr.makeRotationY(it.ry);
                        _m.multiplyMatrices(_mr, t.parts[p].local);
                    }
                    _m.elements[12] += it.x;
                    _m.elements[13] += it.y;
                    _m.elements[14] += it.z;
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
