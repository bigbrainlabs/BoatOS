/**
 * BoatOS IENC-Layer — amtliche Binnenschifffahrtskarten (ELWIS)
 *
 * Rendert die kombinierten IENC-Vektor-Tiles des Backends
 * (/api/enc/tiles/{z}/{x}/{y}.pbf) als MapLibre-Layer-Gruppe:
 * Tiefenflächen, Fahrrinne, Brücken/Wehre/Freileitungen mit
 * Durchfahrtshöhen, CEVNI-Schifffahrtszeichen, Gefahrenstellen,
 * Häfen — inklusive Klick-Popups mit den S-57-Attributen.
 *
 * Muster wie die lokalen Seamark-Layer in map.js. Sichtbarkeit über
 * Settings-Key map.showIENC (Toggle in Einstellungen → Karte).
 * Source-Layer der Tiles: depth, fairway, structures, hazards, marks,
 * harbour, base (siehe backend/app/ienc.py); jedes Feature trägt in
 * "_cls" seine S-57-Objektklasse.
 */

// Gewünschte Sichtbarkeit (aus Settings) — wird auch gemerkt, wenn die
// Layer noch nicht existieren (Settings laden vor der Karte)
let iencVisible = true;
let iencMap = null;
let clickHandlersBound = false;
let popup = null;

const TILES_URL = `${location.protocol}//${location.host}/api/enc/tiles/{z}/{x}/{y}.pbf`;
const BEFORE_LAYER = 'route-shadow-line'; // Route/Track bleiben über IENC

// Deutsche Anzeigenamen der S-57-/IENC-Objektklassen (für Popups)
const CLS_NAMES = {
    depare: 'Tiefenbereich', drgare: 'Baggergebiet', depcnt: 'Tiefenlinie',
    fairwy: 'Fahrrinne', wtwaxs: 'Wasserstraßen-Achse', navlne: 'Navigationslinie',
    rectrc: 'Empfohlener Kurs', dismar: 'Kilometer-Marke', wtwgag: 'Pegel',
    bridge: 'Brücke', cblohd: 'Freileitung', pipohd: 'Rohrleitung (oberirdisch)',
    damcon: 'Wehr / Damm', gatcon: 'Sperrtor', lokbsn: 'Schleusenbecken',
    slcons: 'Uferbauwerk', ponton: 'Ponton', flodoc: 'Schwimmdock', hulkes: 'Hulk',
    obstrn: 'Hindernis', wrecks: 'Wrack', uwtroc: 'Unterwasserfelsen',
    feryrt: 'Fährstrecke', ctnare: 'Vorsichtgebiet', resare: 'Regelungsgebiet',
    notmrk: 'Schifffahrtszeichen', sistat: 'Signalstelle', sistaw: 'Signalstelle',
    boylat: 'Lateraltonne', boycar: 'Kardinaltonne', boyisd: 'Einzelgefahrtonne',
    boysaw: 'Fahrwassermitte-Tonne', boyspp: 'Sondertonne',
    bcnlat: 'Lateralbake', bcncar: 'Kardinalbake', bcnisd: 'Bake (Einzelgefahr)',
    bcnsaw: 'Bake (Fahrwassermitte)', bcnspp: 'Bake (Sonderzeichen)',
    daymar: 'Tagesmarke', topmar: 'Toppzeichen', lights: 'Leuchtfeuer',
    hrbfac: 'Hafen', hrbare: 'Hafengebiet', berths: 'Liegeplatz',
    morfac: 'Festmacheeinrichtung', achare: 'Ankerplatz', achbrt: 'Ankerliegeplatz',
    smcfac: 'Sportboot-Einrichtung', bunsta: 'Bunkerstation', refdmp: 'Entsorgung',
    termnl: 'Terminal', vehtrf: 'Fahrzeug-Umschlag', chkpnt: 'Kontrollpunkt',
};

// S-57 catbrg — Brückentyp
const CATBRG_NAMES = {
    '1': 'feste Brücke', '2': 'bewegliche Brücke', '3': 'Drehbrücke',
    '4': 'Hubbrücke', '5': 'Klappbrücke', '6': 'Pontonbrücke', '7': 'Zugbrücke',
};

// IENC fnctnm — Funktion des Schifffahrtszeichens (CEVNI-Gruppe)
const FNCTNM_NAMES = {
    '1': 'Verbotszeichen', '2': 'Gebotszeichen', '3': 'Einschränkungszeichen',
    '4': 'Empfehlungszeichen', '5': 'Hinweiszeichen',
};

// Layer, die auf Klick ein Popup öffnen
const INTERACTIVE_LAYERS = [
    'ienc-structures-fill', 'ienc-structures-line', 'ienc-cable-line',
    'ienc-hazards-fill', 'ienc-hazards-point', 'ienc-feryrt-line',
    'ienc-notmrk', 'ienc-buoys', 'ienc-harbour-point',
];

// Alle IENC-Layer-IDs (für Toggle) — wird beim Anlegen befüllt
const iencLayerIds = [];


function _num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function _esc(s) {
    return String(s).replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Fuegt Source + alle IENC-Layer hinzu (idempotent; nach jedem
 * Style-Wechsel erneut aufrufen — Muster wie addOpenSeaMapOverlays)
 *
 * Reentrancy-Guard: map-load und initLayerVisibility können das parallel
 * anstoßen; wegen des await auf den Status-Fetch würden sonst beide den
 * getSource-Check passieren → "Source ienc already exists".
 */
let _addPending = null;

export function addIENCLayers(map) {
    iencMap = map;
    if (map.getSource('ienc')) return Promise.resolve();
    if (_addPending) return _addPending;
    _addPending = _addIENCLayersInner(map)
        .catch(e => console.warn('IENC-Layer konnten nicht hinzugefuegt werden:', e))
        .finally(() => { _addPending = null; });
    return _addPending;
}

async function _addIENCLayersInner(map) {
    if (map.getSource('ienc')) return; // bereits vorhanden (gleicher Style)

    // Gibt es überhaupt gebaute IENC-Tiles?
    let available = false;
    try {
        const r = await fetch('/api/enc/tiles/status', { signal: AbortSignal.timeout(2000) });
        if (r.ok) available = (await r.json()).available === true;
    } catch (_) {}
    if (!available) {
        console.log('IENC: keine Vektor-Tiles vorhanden (kein Gewässer installiert/aktiviert)');
        return;
    }

    // Labels brauchen Glyphs — im Offline-Fallback-Style ist keine URL gesetzt
    try {
        if (!map.getStyle().glyphs) {
            map.setGlyphs('https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf');
        }
    } catch (_) {}

    map.addSource('ienc', {
        type: 'vector',
        tiles: [TILES_URL],
        minzoom: 8,
        maxzoom: 14, // darüber Overzoom
        attribution: '© WSV (Inland ENC)',
    });

    const vis = iencVisible ? 'visible' : 'none';
    const layers = _layerDefs(vis);

    iencLayerIds.length = 0;
    const before = map.getLayer(BEFORE_LAYER) ? BEFORE_LAYER : undefined;
    for (const def of layers) {
        try {
            map.addLayer(def, before);
            iencLayerIds.push(def.id);
        } catch (e) {
            console.warn(`IENC-Layer ${def.id} fehlgeschlagen:`, e.message);
        }
    }

    _bindClickHandlers(map);
    console.log(`IENC-Layer aktiv (${iencLayerIds.length} Layer, sichtbar: ${iencVisible})`);
}

/**
 * Schaltet alle IENC-Layer sichtbar/unsichtbar (Settings-Toggle).
 * Merkt den Zustand auch, wenn die Layer (noch) nicht existieren.
 */
export function toggleIENCLayer(visible) {
    iencVisible = visible;
    if (!iencMap) return;

    if (visible && !iencMap.getSource('ienc')) {
        // Tiles könnten inzwischen gebaut worden sein (erster ENC-Download)
        addIENCLayers(iencMap);
        return;
    }
    for (const id of iencLayerIds) {
        if (iencMap.getLayer(id)) {
            iencMap.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none');
        }
    }
}

export function isIENCVisible() {
    return iencVisible;
}


// ===========================================
// Layer-Definitionen
// ===========================================

function _layerDefs(vis) {
    const cls = (v) => ['==', ['get', '_cls'], v];
    const clsIn = (arr) => ['in', ['get', '_cls'], ['literal', arr]];

    return [
        // --- Tiefen (Flächen zuerst, unten im Stack) ---
        {
            id: 'ienc-depth-fill', type: 'fill', source: 'ienc', 'source-layer': 'depth',
            filter: clsIn(['depare', 'drgare']),
            layout: { visibility: vis },
            paint: {
                // Flach = kräftig, tief = hell (DRVAL1 = Mindesttiefe des Bereichs)
                'fill-color': ['step', ['to-number', ['coalesce', ['get', 'DRVAL1'], 0]],
                    '#4e93bc',   // < 1.5 m
                    1.5, '#77b3d4',
                    3,   '#a3cfe6',
                    5,   '#c4e0ef',
                ],
                'fill-opacity': 0.75,
            },
        },
        {
            id: 'ienc-depth-contour', type: 'line', source: 'ienc', 'source-layer': 'depth',
            filter: cls('depcnt'), minzoom: 11,
            layout: { visibility: vis },
            paint: { 'line-color': '#5588aa', 'line-width': 0.8, 'line-opacity': 0.6 },
        },

        // --- Fahrrinne & Achse ---
        {
            id: 'ienc-fairway-fill', type: 'fill', source: 'ienc', 'source-layer': 'fairway',
            filter: cls('fairwy'),
            layout: { visibility: vis },
            paint: { 'fill-color': '#55bb55', 'fill-opacity': 0.12 },
        },
        {
            id: 'ienc-fairway-line', type: 'line', source: 'ienc', 'source-layer': 'fairway',
            filter: cls('fairwy'), minzoom: 10,
            layout: { visibility: vis },
            paint: { 'line-color': '#449944', 'line-width': 1.2, 'line-dasharray': [3, 2], 'line-opacity': 0.6 },
        },
        {
            id: 'ienc-waxis-line', type: 'line', source: 'ienc', 'source-layer': 'fairway',
            filter: cls('wtwaxs'), minzoom: 10,
            layout: { visibility: vis },
            paint: { 'line-color': '#7f96ac', 'line-width': 1, 'line-dasharray': [1, 3], 'line-opacity': 0.5 },
        },

        // --- Häfen & Liegestellen ---
        {
            id: 'ienc-harbour-fill', type: 'fill', source: 'ienc', 'source-layer': 'harbour',
            filter: ['==', ['geometry-type'], 'Polygon'], minzoom: 11,
            layout: { visibility: vis },
            paint: { 'fill-color': '#3388cc', 'fill-opacity': 0.12 },
        },
        {
            id: 'ienc-harbour-point', type: 'circle', source: 'ienc', 'source-layer': 'harbour',
            filter: ['==', ['geometry-type'], 'Point'], minzoom: 12,
            layout: { visibility: vis },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 3, 15, 5],
                'circle-color': '#3388cc', 'circle-opacity': 0.85,
                'circle-stroke-width': 1, 'circle-stroke-color': '#ffffff',
            },
        },

        // --- Gefahren & Gebiete ---
        {
            id: 'ienc-hazards-fill', type: 'fill', source: 'ienc', 'source-layer': 'hazards',
            filter: ['all', ['==', ['geometry-type'], 'Polygon'], clsIn(['resare', 'ctnare'])],
            layout: { visibility: vis },
            paint: { 'fill-color': '#e6a23c', 'fill-opacity': 0.15 },
        },
        {
            id: 'ienc-hazards-line', type: 'line', source: 'ienc', 'source-layer': 'hazards',
            filter: clsIn(['resare', 'ctnare']), minzoom: 10,
            layout: { visibility: vis },
            paint: { 'line-color': '#cc8822', 'line-width': 1.5, 'line-dasharray': [4, 3], 'line-opacity': 0.7 },
        },
        {
            id: 'ienc-feryrt-line', type: 'line', source: 'ienc', 'source-layer': 'hazards',
            filter: cls('feryrt'), minzoom: 10,
            layout: { visibility: vis },
            paint: { 'line-color': '#cc6622', 'line-width': 2, 'line-dasharray': [5, 3], 'line-opacity': 0.8 },
        },
        {
            id: 'ienc-hazards-point', type: 'circle', source: 'ienc', 'source-layer': 'hazards',
            filter: ['all', ['==', ['geometry-type'], 'Point'], clsIn(['obstrn', 'wrecks', 'uwtroc'])],
            minzoom: 10,
            layout: { visibility: vis },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 6],
                'circle-color': '#cc2222', 'circle-opacity': 0.9,
                'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff',
            },
        },

        // --- Bauwerke ---
        {
            id: 'ienc-structures-fill', type: 'fill', source: 'ienc', 'source-layer': 'structures',
            filter: ['==', ['geometry-type'], 'Polygon'],
            layout: { visibility: vis },
            paint: {
                'fill-color': ['match', ['get', '_cls'],
                    'bridge', '#666666',
                    'lokbsn', '#8899aa',
                    'damcon', '#cc3333',
                    'gatcon', '#cc6633',
                    'ponton', '#997744',
                    '#909090',
                ],
                'fill-opacity': 0.65,
            },
        },
        {
            id: 'ienc-structures-line', type: 'line', source: 'ienc', 'source-layer': 'structures',
            filter: clsIn(['bridge', 'damcon', 'gatcon', 'slcons', 'lokbsn']),
            layout: { visibility: vis },
            paint: {
                'line-color': ['match', ['get', '_cls'],
                    'bridge', '#555555',
                    'damcon', '#cc2222',
                    'gatcon', '#cc5522',
                    'lokbsn', '#667788',
                    '#778899',
                ],
                'line-width': ['match', ['get', '_cls'],
                    'bridge', 3, 'damcon', 3.5, 'gatcon', 3, 1.2,
                ],
            },
        },
        {
            id: 'ienc-cable-line', type: 'line', source: 'ienc', 'source-layer': 'structures',
            filter: clsIn(['cblohd', 'pipohd']), minzoom: 10,
            layout: { visibility: vis },
            paint: { 'line-color': '#aa7700', 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.85 },
        },

        // --- Schifffahrtszeichen & Tonnen ---
        {
            id: 'ienc-notmrk', type: 'circle', source: 'ienc', 'source-layer': 'marks',
            filter: cls('notmrk'), minzoom: 11,
            layout: { visibility: vis },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 3.5, 15, 7],
                // Farbe nach Zeichen-Funktion: Verbot/Gebot rot, Empfehlung/Hinweis blau
                'circle-color': ['match', ['to-string', ['get', 'fnctnm']],
                    '1', '#cc2222', '2', '#cc2222', '3', '#dd6644',
                    '4', '#2266cc', '5', '#2288cc',
                    '#888888',
                ],
                'circle-stroke-width': 1.5, 'circle-stroke-color': '#ffffff',
            },
        },
        {
            id: 'ienc-buoys', type: 'circle', source: 'ienc', 'source-layer': 'marks',
            filter: clsIn(['boylat', 'boycar', 'boyisd', 'boysaw', 'boyspp',
                           'bcnlat', 'bcncar', 'bcnisd', 'bcnsaw', 'bcnspp',
                           'daymar', 'lights', 'sistat', 'sistaw']),
            minzoom: 10,
            layout: { visibility: vis },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 6],
                // S-57 COLOUR-Codes: 1 weiß, 2 schwarz, 3 rot, 4 grün, 5 blau, 6 gelb
                'circle-color': ['match',
                    ['slice', ['to-string', ['coalesce', ['get', 'COLOUR'], '']], 0, 1],
                    '1', '#e8e8e8', '2', '#222222', '3', '#cc2200',
                    '4', '#007733', '5', '#2255cc', '6', '#e6c619',
                    '#999999',
                ],
                'circle-stroke-width': 1.5, 'circle-stroke-color': '#333333',
            },
        },

        // --- Labels (oben) ---
        {
            id: 'ienc-bridge-label', type: 'symbol', source: 'ienc', 'source-layer': 'structures',
            filter: ['all', cls('bridge'), ['has', 'VERCLR']], minzoom: 11,
            layout: {
                visibility: vis,
                'text-field': ['concat', '▼ ', ['to-string', ['get', 'VERCLR']], ' m'],
                'text-font': ['Noto Sans Bold'],
                'text-size': 11,
                'text-optional': false,
            },
            paint: { 'text-color': '#223344', 'text-halo-color': '#ffffff', 'text-halo-width': 1.8 },
        },
        {
            id: 'ienc-cable-label', type: 'symbol', source: 'ienc', 'source-layer': 'structures',
            filter: ['all', clsIn(['cblohd', 'pipohd']), ['has', 'VERCLR']], minzoom: 12,
            layout: {
                visibility: vis,
                'symbol-placement': 'line',
                'text-field': ['concat', '↕ ', ['to-string', ['get', 'VERCLR']], ' m'],
                'text-font': ['Noto Sans Regular'],
                'text-size': 10,
            },
            paint: { 'text-color': '#7a5500', 'text-halo-color': '#ffffff', 'text-halo-width': 1.5 },
        },
        // Hinweis: dismar (Kilometer-Marken) werden bewusst NICHT beschriftet —
        // sie liegen in 100-m-Schritten und überfrachten das Gewässer.
        {
            id: 'ienc-harbour-label', type: 'symbol', source: 'ienc', 'source-layer': 'harbour',
            filter: ['any', ['has', 'NOBJNM'], ['has', 'OBJNAM']], minzoom: 13,
            layout: {
                visibility: vis,
                'text-field': ['coalesce', ['get', 'NOBJNM'], ['get', 'OBJNAM']],
                'text-font': ['Noto Sans Regular'],
                'text-size': 10,
                'text-offset': [0, 1.1],
                'text-anchor': 'top',
                'text-optional': true,
            },
            paint: { 'text-color': '#225588', 'text-halo-color': '#ffffff', 'text-halo-width': 1.4 },
        },
    ];
}


// ===========================================
// Klick-Popups
// ===========================================

function _bindClickHandlers(map) {
    if (clickHandlersBound) return;
    clickHandlersBound = true;

    for (const layerId of INTERACTIVE_LAYERS) {
        map.on('click', layerId, (e) => {
            if (!e.features?.length) return;
            _showPopup(map, e.lngLat, e.features[0].properties || {});
        });
        map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
    }
}

function _showPopup(map, lngLat, p) {
    const cls = p._cls || '';
    const title = CLS_NAMES[cls] || cls.toUpperCase();
    const name = p.NOBJNM || p.OBJNAM || '';

    const rows = [];
    const add = (label, value) => {
        if (value !== undefined && value !== null && value !== '') {
            rows.push(`<div style="display:flex;justify-content:space-between;gap:12px;">
                <span style="opacity:0.7;">${_esc(label)}</span><span><b>${_esc(value)}</b></span></div>`);
        }
    };

    if (cls === 'bridge' && p.catbrg) add('Typ', CATBRG_NAMES[String(p.catbrg).split(',')[0]]);
    if (_num(p.VERCLR) !== null) add('Durchfahrtshöhe', `${p.VERCLR} m`);
    if (_num(p.verccl) !== null) add('Höhe (geschlossen)', `${p.verccl} m`);
    if (_num(p.vercop) !== null) add('Höhe (geöffnet)', `${p.vercop} m`);
    if (_num(p.HORCLR) !== null) add('Durchfahrtsbreite', `${p.HORCLR} m`);
    if (_num(p.DRVAL1) !== null) add('Tiefe ab', `${p.DRVAL1} m`);
    if (_num(p.DRVAL2) !== null) add('Tiefe bis', `${p.DRVAL2} m`);
    if (_num(p.wtwdis) !== null) add('Wasserstraßen-km', p.wtwdis);
    if (cls === 'notmrk') {
        add('Funktion', FNCTNM_NAMES[String(p.fnctnm)] || undefined);
        add('CEVNI-Kategorie', p.catnmk);
        if (_num(p.ORIENT) !== null) add('Ausrichtung', `${p.ORIENT}°`);
    }
    const info = p.NINFOM || p.INFORM;
    if (info) rows.push(`<div style="margin-top:4px;opacity:0.85;">${_esc(info)}</div>`);

    const html = `
        <div style="min-width:170px;max-width:250px;font-size:13px;line-height:1.5;">
            <div style="font-weight:600;margin-bottom:2px;">${_esc(title)}</div>
            ${name ? `<div style="margin-bottom:4px;">${_esc(name)}</div>` : ''}
            ${rows.join('')}
        </div>`;

    if (popup) popup.remove();
    popup = new maplibregl.Popup({ closeButton: true, maxWidth: '280px', className: 'ienc-popup' })
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(map);
}
