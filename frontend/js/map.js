/**
 * BoatOS Map Modul
 * MapLibre GL Karteninitialisierung und -verwaltung
 *
 * Dieses Modul enthält alle kartenbezogenen Funktionen:
 * - MapLibre GL Initialisierung
 * - Tile-Layer Management
 * - Boot-Marker
 * - Track-Layer (Fahrspur)
 * - Routen-Layer
 * - Zoom & Pan Funktionen
 * - Layer-Toggle Funktionen
 */

// ===========================================
// Imports
// ===========================================
// Hinweis: core.js muss zuerst geladen werden und stellt globale Variablen bereit
// wie API_URL, currentPosition, etc.
import { addIENCLayers, toggleIENCLayer, isIENCVisible } from './ienc.js';

// Re-Export: macht die IENC-Funktionen unter BoatOS.map.* verfügbar (ui.js)
export { toggleIENCLayer, isIENCVisible };

// ===========================================
// Map State
// ===========================================
let map = null;
let boatMarker = null;
let boatMarkerElement = null;
let currentBoatHeading = 0;
let autoFollow = false;

// ---- GPS smoothing ----
const GPS_EMA_ALPHA = 0.35;
const GPS_ANIM_DURATION = 4200;
let _emaLat = null, _emaLon = null;
let _fromLat = null, _fromLon = null;
let _targetLat = null, _targetLon = null;
let _dispLat = null, _dispLon = null;
let _animStart = null;
let _animRafId = null;
let _lastMapFollow = 0;

/**
 * Laufende Kamerafahrt (3D-Wechsel, Nord-oben-Rueckkehr) — bis zu diesem
 * Zeitpunkt (performance.now()) darf die Follow-Animation NICHT dazwischenfunken.
 *
 * Grund: map.jumpTo() bricht ein laufendes map.easeTo() sofort ab. Die
 * Follow-Animation feuert alle 30 ms ein jumpTo — der 600-ms-easeTo des
 * 3D-Wechsels war damit nach spaetestens 30 ms tot. Sichtbar war genau das:
 * die Karte "zuckt" kurz und bleibt 2D. Waehrend der Kamerafahrt bewegt sich
 * nur noch der Marker; danach uebernimmt Follow wieder.
 */
let _camTransitionUntil = 0;
function _beginCameraTransition(durationMs) {
    _camTransitionUntil = performance.now() + durationMs + 80;   // + Puffer
}

// ---- Course Up mode ----
let courseUpMode = false;
let perspective3D = false;          // 3D-/Look-ahead-Kartenmodus (gekippt + head-up)
let _courseUpBefore3D = false;
let _zoomBefore3D = null;
const PITCH_3D = 65;                // Standard-Neigung im 3D-Modus (Grad) — braucht maxPitch > 60 (siehe initMap)
const PITCH_MIN = 20, PITCH_MAX = 75, PITCH_STEP = 5;

// Vom Nutzer per Pitch-Buttons gewaehlte Neigung (bleibt ueber Sitzungen erhalten)
let _pitch3D = (() => {
    const v = parseFloat(localStorage.getItem('pitch3D'));
    return (Number.isFinite(v) && v >= PITCH_MIN && v <= PITCH_MAX) ? v : PITCH_3D;
})();

/** Neigung setzen — wirkt sofort, wenn 3D aktiv ist; sonst beim naechsten Wechsel. */
function _setPitch3D(deg) {
    _pitch3D = Math.max(PITCH_MIN, Math.min(PITCH_MAX, Math.round(deg)));
    try { localStorage.setItem('pitch3D', String(_pitch3D)); } catch (_) {}
    if (map && perspective3D) {
        // Kamerafahrt anmelden, sonst killt das naechste Follow-jumpTo sie sofort
        _beginCameraTransition(250);
        map.easeTo({ pitch: _pitch3D, duration: 250 });
    }
    _updatePitchIndicator();
}

export function pitchUp()   { _setPitch3D(_pitch3D + PITCH_STEP); }   // flacher (mehr Vorausschau)
export function pitchDown() { _setPitch3D(_pitch3D - PITCH_STEP); }   // steiler (mehr Draufsicht)
export function getPitch3D() { return _pitch3D; }

/**
 * Zwei Neigungs-Tasten als eigene MapLibre-Control-Gruppe — sie landen damit
 * direkt bei den Zoom-Tasten (NavigationControl, bottom-left) und sehen aus wie
 * deren Zwillinge, statt in einem separaten UI-Element zu leben.
 */
class PitchControl {
    onAdd() {
        const c = document.createElement('div');
        c.className = 'maplibregl-ctrl maplibregl-ctrl-group pitch-ctrl';

        // SVG statt Text-Glyphe: Die Control-Buttons sind IMMER weiss (MapLibre-
        // Style), eine per var(--text) eingefaerbte Glyphe war im Dark-Theme also
        // weiss auf weiss — schlicht unsichtbar. Fester dunkler Strich, wie die
        // Zoom-Icons von MapLibre selbst.
        const icon = (up) => `
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 18 h18" stroke="#333" stroke-width="2" stroke-linecap="round" fill="none"/>
              <path d="${up ? 'M12 4 l5 7 h-10 z' : 'M12 14 l5 -7 h-10 z'}" fill="#333"/>
            </svg>`;
        const mk = (up, title, fn) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.title = title;
            b.setAttribute('aria-label', title);
            b.innerHTML = icon(up);
            b.addEventListener('click', (e) => { e.preventDefault(); fn(); });
            c.appendChild(b);
        };
        mk(true,  'Neigung flacher (mehr Vorausschau)', pitchUp);
        mk(false, 'Neigung steiler (mehr Draufsicht)', pitchDown);
        this._c = c;
        return c;
    }
    onRemove() { this._c?.remove(); this._c = null; }
}

/**
 * Ziel-Zoom der 3D-Ansicht — abhaengig von der Bildschirmbreite.
 *
 * Ein fester Wert kann nicht fuer alle stimmen: Zoom bestimmt den Massstab, die
 * Bildschirmbreite aber, WIE VIEL Fluss davon ins Bild passt. 17.5 gibt auf einem
 * breiten Display schoenes Fahrgefuehl; auf dem Handy klebt man damit auf dem Bug.
 * Darum je schmaler der Screen, desto weiter raus.
 */
const ZOOM_3D_PHONE = 16.0;         // < 768 px  — schmales Handy-Display
const ZOOM_3D_TABLET = 17.0;        // < 1200 px — Tablet / Pi-Touchscreen
const ZOOM_3D_WIDE = 17.5;          // ab 1200 px — Desktop / grosses Kartenplotter-Display

function _zoom3dTarget() {
    // Breite des Karten-Containers, nicht window: das Deck laeuft auch eingebettet.
    const w = (map && map.getContainer() && map.getContainer().clientWidth) ||
              window.innerWidth || 1200;
    if (w < 768) return ZOOM_3D_PHONE;
    if (w < 1200) return ZOOM_3D_TABLET;
    return ZOOM_3D_WIDE;
}
let _smoothHeading = null;
const HEADING_EMA_ALPHA = 0.15; // low = very smooth bearing rotation

function _updateSmoothedHeading(raw) {
    if (_smoothHeading === null) { _smoothHeading = raw; return raw; }
    let diff = raw - _smoothHeading;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    _smoothHeading = (_smoothHeading + HEADING_EMA_ALPHA * diff + 360) % 360;
    return _smoothHeading;
}

function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function _animateBoatMarker(ts) {
    const t = Math.min((ts - _animStart) / GPS_ANIM_DURATION, 1);
    const e = _easeOutCubic(t);

    _dispLat = _fromLat + (_targetLat - _fromLat) * e;
    _dispLon = _fromLon + (_targetLon - _fromLon) * e;

    if (autoFollow && ts >= _camTransitionUntil) {
        // Marker UND Karte synchron im selben Tick per jumpTo bewegen (jumpTo
        // rendert nur 1×, easeTo würde die ganze Dauer mit 60fps rendern → Pi-Last).
        // Gedrosselt auf ~33 fps: gleichmäßiges Scrollen, Boot bleibt exakt
        // zentriert (kein Wackeln relativ zur Karte), Pi bleibt bedienbar.
        // Waehrend einer Kamerafahrt (3D-Wechsel) ausgesetzt — jumpTo wuerde sie killen.
        if (ts - _lastMapFollow > 30) {
            const jt = { center: [_dispLon, _dispLat] };
            if (courseUpMode && currentBoatHeading !== 0) {
                // Head-up: Fahrtrichtung nach oben → bearing = +heading (geglättet)
                jt.bearing = _updateSmoothedHeading(currentBoatHeading);
            }
            map.jumpTo(jt);
            boatMarker.setLngLat([_dispLon, _dispLat]);
            _lastMapFollow = ts;
            if (courseUpMode && currentBoatHeading !== 0 && boatMarkerElement) {
                boatMarkerElement.style.transform = `rotate(${currentBoatHeading - map.getBearing()}deg)`;
            }
        }
    } else {
        boatMarker.setLngLat([_dispLon, _dispLat]);   // ohne Follow: Marker frei, voll flüssig
    }

    if (t < 1) {
        _animRafId = requestAnimationFrame(_animateBoatMarker);
    } else {
        _animRafId = null;
    }
}

// Layer State
let currentBaseLayer = 'osm'; // 'osm' oder 'satellite'
let seaMarkLayerVisible = true;
let inlandLayerVisible = false;

// Track History
let trackHistory = [];
let maxTrackPoints = 500;

// Route State
let currentRouteCoordinates = null;
let currentRouteColor = '#3498db';
let routeLabelMarkers = [];

// Displayed Track (aus Logbook)
let displayedTrackMarkers = [];
let displayedTrackSourceAdded = false;

// ===========================================
// Map Initialisierung
// ===========================================

/**
 * Initialisiert die MapLibre GL Karte
 * @param {Object} options - Optionale Konfiguration
 * @returns {Object} Map-Instanz
 */
async function _checkTileserver() {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    try {
        const r = await fetch(window.location.origin + '/api/map/tiles', {
            cache: 'no-store',
            signal: ctrl.signal
        });
        clearTimeout(timer);
        if (!r.ok) return null;
        const data = await r.json();
        return (data.ok === true) ? (data.active || ['germany']) : null;
    } catch {
        clearTimeout(timer);
        return null;
    }
}

let _activeRegions = null;

export async function recheckOfflineTiles() {
    const regions = await _checkTileserver();
    const nowOk = regions !== null;

    // Nicht nur auf einen Verfügbarkeits-Wechsel reagieren, sondern auch darauf,
    // dass sich die AKTIVE REGIONSLISTE geändert hat (z.B. Niederlande dazugeschaltet).
    // Sonst blieb der Style unverändert — Source + Layer der neuen Region fehlten,
    // und das Gebiet tauchte erst nach einem kompletten Reload auf.
    const regionsChanged = nowOk &&
        JSON.stringify(regions) !== JSON.stringify(_activeRegions);

    if (nowOk === window._tileserverAvailable && !regionsChanged) return;

    window._tileserverAvailable = nowOk;
    _activeRegions = regions;
    if (!map) return;

    // Route/Segmente/Track sichern, BEVOR der Style ersetzt wird
    const snap = _snapshotDynamicSources();

    // WICHTIG: diff:false erzwingt einen vollen Style-Reload.
    // Mit dem Standard-Diffing entfernt MapLibre alles imperativ Hinzugefügte
    // (Labels, Seezeichen, Satellit — steht ja nicht im neuen Style-Objekt) UND
    // feuert 'style.load' nicht, weil der Style nicht neu geladen, sondern nur
    // gepatcht wird. Dann liefe der Wiederherstellungs-Handler unten nie und es
    // bliebe nur die nackte Basiskarte übrig.
    if (nowOk) {
        map.setStyle(_vectorStyle(regions), { diff: false });
        map.once('style.load', () => {
            addLabelsLayer();
            document.getElementById('tileserver-banner')?.remove();
            // Seezeichen kommen async — Sichtbarkeit erst danach wieder anwenden
            Promise.resolve(addOpenSeaMapOverlays()).then(() => {
                toggleSeamarkLayer(seaMarkLayerVisible);
                toggleInlandLayer(inlandLayerVisible);
            }).catch(() => {});
            addIENCLayers(map);   // amtliche IENC-Vektor-Tiles neu anlegen
            _restoreAfterStyleChange(snap);
        });
    } else {
        map.setStyle(_rasterFallbackStyle(), { diff: false });
        map.once('style.load', () => {
            _showTileserverBanner();
            addIENCLayers(map);
            _restoreAfterStyleChange(snap);
        });
    }
}

// Dynamische GeoJSON-Sources, deren Inhalt ein Style-Reload verlieren würde
const _DYNAMIC_SOURCES = [
    'route', 'route-shadow', 'completed-segments',
    'current-segment', 'remaining-segments', 'track-history'
];

/**
 * Fotografiert die dynamischen Source-Inhalte VOR dem Style-Wechsel.
 *
 * Bewusst über map.getStyle(): das serialisiert die GeoJSON-Sources samt Daten.
 * So ist es völlig egal, WER gezeichnet hat — navigation.js schreibt z.B. direkt
 * in die 'route'-Source und geht an map.js/showRoute komplett vorbei, weshalb
 * ein Restore über currentRouteCoordinates gar nicht funktionieren kann.
 */
function _snapshotDynamicSources() {
    const snap = { sources: {}, routeColor: null };
    if (!map) return snap;
    try {
        const style = map.getStyle();
        for (const id of _DYNAMIC_SOURCES) {
            const src = style.sources?.[id];
            if (src && src.type === 'geojson' && src.data) snap.sources[id] = src.data;
        }
    } catch (_) {}
    try {
        if (map.getLayer('route-line')) {
            snap.routeColor = map.getPaintProperty('route-line', 'line-color');
        }
    } catch (_) {}
    return snap;
}

/**
 * Stellt nach einem setStyle() den verlorenen Karten-Zustand wieder her.
 *
 * setStyle() ersetzt den kompletten Style — die GeoJSON-Sources (Route,
 * Segmente, Track) werden LEER neu angelegt und der Satelliten-Layer (der
 * sonst nur im map-load-Handler entsteht) fehlt. Marker (Boot, Pegel,
 * Schleusen, AIS, Routen-Labels) sind DOM-basiert und überleben.
 */
function _restoreAfterStyleChange(snap) {
    if (!map) return;

    // sky ist eine STYLE-Eigenschaft — setStyle() wirft sie mit weg.
    _applySky();

    // Route, Segmente und Track aus dem Snapshot zurückspielen
    if (snap && snap.sources) {
        for (const [id, data] of Object.entries(snap.sources)) {
            try {
                const src = map.getSource(id);
                if (src && data) src.setData(data);
            } catch (_) {}
        }
    }
    if (snap && snap.routeColor && map.getLayer('route-line')) {
        try { map.setPaintProperty('route-line', 'line-color', snap.routeColor); } catch (_) {}
    }

    // Satelliten-Source/-Layer neu anlegen (existiert im frischen Style nicht mehr)
    if (!map.getSource('satellite')) {
        map.addSource('satellite', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri, Maxar, Earthstar Geographics',
            maxzoom: 19
        });
    }
    if (!map.getLayer('satellite-layer')) {
        map.addLayer({
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            layout: { visibility: 'none' }
        }, 'background');
    }
    if (localStorage.getItem('satelliteMode') === 'true') {
        toggleSatellite(true);
    }

    // Wind-Overlay neu zeichnen: Source, Layer UND die addImage-Pfeilbilder sind
    // mit dem alten Style verschwunden. Ueber den Namespace statt per Import —
    // weather-map.js importiert map.js, ein Rueckimport waere ein Zyklus.
    try { window.BoatOS?.weatherMap?.redrawWindOverlay?.(); } catch (_) {}
}

function _showTileserverBanner() {
    const existing = document.getElementById('tileserver-banner');
    if (existing) return;
    const banner = document.createElement('div');
    banner.id = 'tileserver-banner';
    banner.style.cssText = [
        'position:absolute', 'top:8px', 'left:50%', 'transform:translateX(-50%)',
        'z-index:900', 'background:rgba(30,30,30,0.88)', 'color:#FFB74D',
        'font-size:12px', 'padding:5px 12px', 'border-radius:6px',
        'pointer-events:none', 'white-space:nowrap',
        'border:1px solid rgba(255,183,77,0.35)'
    ].join(';');
    banner.textContent = '⚠ Offline-Karten nicht verfügbar · Online-Fallback (OpenStreetMap)';
    document.getElementById('map')?.appendChild(banner);
}

/**
 * Zoom-/Neigungs-Anzeige als eigenes MapLibre-Control.
 *
 * Bewusst NICHT frei positioniert: als Control flieszt die Anzeige mit den
 * Zoom-/Pitch-Tasten im selben Container. Frei platziert (left/bottom in Pixeln)
 * lag sie zwangslaeufig irgendwann UNTER den Buttons — der Stapel waechst ja,
 * sobald die Pitch-Tasten dazukommen. Genau das ist passiert.
 */
class ReadoutControl {
    onAdd(m) {
        const c = document.createElement('div');
        c.className = 'maplibregl-ctrl map-readout';
        c.innerHTML = '<span id="zoom-indicator"></span><span id="pitch-indicator"></span>';
        const upd = () => {
            const z = c.querySelector('#zoom-indicator');
            if (z) z.textContent = 'Z ' + m.getZoom().toFixed(1);
        };
        upd();
        m.on('zoom', upd);
        this._c = c;
        setTimeout(_updatePitchIndicator, 0);
        return c;
    }
    onRemove() { this._c?.remove(); this._c = null; }
}

function _vectorStyle(regions) {
    const origin = window.location.origin;
    const sources = {};
    for (const r of regions) {
        sources[`basemap-${r}`] = {
            type: 'vector',
            tiles: [`${origin}/tiles/${r}/{z}/{x}/{y}`],
            minzoom: 0,
            maxzoom: 14
        };
    }
    Object.assign(sources, {
        'track-history': { type: 'geojson', data: { type: 'LineString', coordinates: [] } },
        'route': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        'route-shadow': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        'completed-segments': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        'current-segment': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
        'remaining-segments': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    });

    const basemapDefs = [
        { id: 'water',      type: 'fill', 'source-layer': 'water',          paint: { 'fill-color': '#80b0d0' } },
        { id: 'waterway',   type: 'line', 'source-layer': 'waterway',        paint: { 'line-color': '#80b0d0', 'line-width': 2 } },
        { id: 'landcover',  type: 'fill', 'source-layer': 'landcover',       paint: { 'fill-color': '#c0e0c0', 'fill-opacity': 0.5 } },
        { id: 'park',       type: 'fill', 'source-layer': 'park',            paint: { 'fill-color': '#a0d0a0', 'fill-opacity': 0.5 } },
        { id: 'landuse',    type: 'fill', 'source-layer': 'landuse',         paint: { 'fill-color': '#f0f0e0', 'fill-opacity': 0.3 } },
        { id: 'building',   type: 'fill', 'source-layer': 'building',        minzoom: 13, paint: { 'fill-color': '#d0d0d0' } },
        { id: 'roads',      type: 'line', 'source-layer': 'transportation',  paint: { 'line-color': '#ffffff', 'line-width': 1 } },
        { id: 'roads-major',type: 'line', 'source-layer': 'transportation',  filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary']]], paint: { 'line-color': '#ffcc80', 'line-width': 3 } },
        { id: 'boundary',   type: 'line', 'source-layer': 'boundary',        paint: { 'line-color': '#808080', 'line-width': 1, 'line-dasharray': [2, 2] } },
    ];

    const layers = [
        { id: 'background', type: 'background', paint: { 'background-color': '#e0e0e0' } },
    ];
    for (const def of basemapDefs) {
        for (const r of regions) {
            layers.push({ ...def, id: `${def.id}-${r}`, source: `basemap-${r}` });
        }
    }
    layers.push(
        { id: 'route-shadow-line',     type: 'line', source: 'route-shadow',        paint: { 'line-color': 'white',   'line-width': 8, 'line-opacity': 0.4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
        { id: 'completed-segments-line', type: 'line', source: 'completed-segments', paint: { 'line-color': '#666',   'line-width': 4, 'line-opacity': 0.3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
        { id: 'route-line',            type: 'line', source: 'route',               paint: { 'line-color': '#2ecc71', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
        { id: 'current-segment-line',  type: 'line', source: 'current-segment',     paint: { 'line-color': '#ffd700', 'line-width': 6, 'line-opacity': 1.0 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
        { id: 'remaining-segments-line', type: 'line', source: 'remaining-segments', paint: { 'line-color': '#3498db', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
        { id: 'track-line',            type: 'line', source: 'track-history',       paint: { 'line-color': '#4CAF50', 'line-width': 3 } }
    );

    return { version: 8, sources, layers };
}

function _rasterFallbackStyle() {
    return {
        version: 8,
        sources: {
            'osm': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
                maxzoom: 19
            },
            'track-history': { type: 'geojson', data: { type: 'LineString', coordinates: [] } },
            'route': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            'route-shadow': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            'completed-segments': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            'current-segment': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
            'remaining-segments': { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
        },
        layers: [
            { id: 'background', type: 'background', paint: { 'background-color': '#e0e0e0' } },
            { id: 'osm-tiles', type: 'raster', source: 'osm' },
            { id: 'route-shadow-line', type: 'line', source: 'route-shadow', paint: { 'line-color': 'white', 'line-width': 8, 'line-opacity': 0.4 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'completed-segments-line', type: 'line', source: 'completed-segments', paint: { 'line-color': '#666', 'line-width': 4, 'line-opacity': 0.3 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#2ecc71', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'current-segment-line', type: 'line', source: 'current-segment', paint: { 'line-color': '#ffd700', 'line-width': 6, 'line-opacity': 1.0 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'remaining-segments-line', type: 'line', source: 'remaining-segments', paint: { 'line-color': '#3498db', 'line-width': 5, 'line-opacity': 0.9 }, layout: { 'line-cap': 'round', 'line-join': 'round' } },
            { id: 'track-line', type: 'line', source: 'track-history', paint: { 'line-color': '#4CAF50', 'line-width': 3 } }
        ]
    };
}

export async function initMap(options = {}) {
    console.log('Karte wird initialisiert...');

    // maplibre-gl.js dynamisch laden falls noch nicht vorhanden
    if (!window.maplibregl) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = '/lib/maplibre-gl.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    // Container pruefen
    const mapContainer = document.getElementById('map');
    if (!mapContainer) {
        console.error('Map Container nicht gefunden!');
        return null;
    }

    const rect = mapContainer.getBoundingClientRect();
    console.log(`Container Groesse: ${rect.width}x${rect.height}`);

    // Standard-Position (Aken/Elbe)
    const defaultPosition = options.center || { lat: 51.855, lon: 12.046 };

    // Tileserver-Verfügbarkeit prüfen, ggf. Online-Fallback nutzen
    const regions = await _checkTileserver();
    const tileserverOk = regions !== null;
    window._tileserverAvailable = tileserverOk;
    _activeRegions = regions;
    console.log(tileserverOk ? `Tileserver verfügbar (${regions.join(',')})` : 'Tileserver nicht verfügbar — Online-Fallback aktiv');

    map = new maplibregl.Map({
        container: 'map',
        style: tileserverOk ? _vectorStyle(regions) : _rasterFallbackStyle(),
        center: [defaultPosition.lon, defaultPosition.lat],
        zoom: options.zoom || 13,
        // MapLibre deckelt den Pitch per Default bei 60° und kappt hoehere Werte
        // STILL — ein pitch:70 waere wirkungslos "angekommen". Fuer die flache
        // Look-ahead-Perspektive das Limit anheben.
        maxPitch: 75,
        attributionControl: false
    });

    console.log('MapLibre GL Map erstellt');

    // Fehler-Handler
    map.on('error', (e) => {
        console.error('Map Fehler:', e.error);
    });

    // Kompass-Nadel mit Karten-Rotation mitdrehen
    map.on('rotate', () => {
        const needle = document.getElementById('compass-needle-group');
        if (needle) needle.style.transform = `rotate(${-map.getBearing()}deg)`;
    });

    // Reihenfolge = Anordnung im bottom-left-Stapel: Anzeige, Zoom, Neigung
    map.addControl(new ReadoutControl(), 'bottom-left');
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-left');
    map.addControl(new PitchControl(), 'bottom-left');   // nur in der 3D-Ansicht sichtbar

    // Himmel/Wolken an jede Kamerabewegung koppeln (Horizontlinie wandert mit
    // Neigung und Zoom). 'move' feuert auch waehrend easeTo — also auch
    // waehrend der 3D-Kamerafahrt.
    map.on('move', _updateSkyOverlay);
    map.on('resize', _updateSkyOverlay);

    // Nach vollstaendigem Laden weitere Layer hinzufuegen
    map.on('load', () => {
        console.log('Karte geladen');
        _applySky();
        _ensureSkyOverlay();
        if (tileserverOk) {
            addLabelsLayer();
        } else {
            _showTileserverBanner();
        }
        addOpenSeaMapOverlays(); // async — intentionally not awaited here
        addIENCLayers(map);      // amtliche IENC-Vektor-Tiles (falls installiert)

        // Satelliten-Source und -Layer vorinitialisieren (standardmaessig versteckt)
        map.addSource('satellite', {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '© Esri, Maxar, Earthstar Geographics',
            maxzoom: 19
        });
        map.addLayer({
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            layout: { visibility: 'none' }
        }, 'background'); // unterhalb aller anderen Layer einfuegen

        // Gespeicherte Satelliteneinstellung wiederherstellen
        if (localStorage.getItem('satelliteMode') === 'true') {
            toggleSatellite(true);
        }
        // Gespeicherten 3D-/Look-ahead-Modus wiederherstellen
        if (localStorage.getItem('perspective3D') === 'true') {
            setTimeout(() => toggleMap3D(true), 600);
        }

        initMapMarkers();

        // Periodisch prüfen ob Tileserver wieder verfügbar (z.B. nach Backend-Restart)
        // Nur wenn aktuell im Fallback-Modus. Stoppt automatisch wenn wieder online.
        setInterval(() => {
            if (!window._tileserverAvailable) recheckOfflineTiles();
        }, 30000);
    });

    // Long-Press Erkennung direkt auf Canvas (nicht via MapLibre-Events),
    // damit Overlay-Buttons (nav, follow, sim) keine falschen Triggers auslösen
    let longPressTimer = null;
    let longPressFired = false;
    let longPressOrigin = null;
    let longPressLngLat = null;
    let hadMultiTouch = false; // zweiter Finger → nachfolgenden click unterdrücken

    const canvas = map.getCanvas();

    // touchstart ist zuverlässiger als isPrimary für Multi-Touch-Erkennung
    // (isPrimary funktioniert auf manchen Touch-Treibern nicht korrekt)
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length > 1) {
            // Zweiter Finger → Long-Press und nachfolgenden Click unterdrücken
            clearTimeout(longPressTimer);
            longPressTimer = null;
            hadMultiTouch = true;
        }
    }, { passive: true });

    canvas.addEventListener('pointerdown', (e) => {
        // Sicherstellen dass wirklich die Karte getippt wurde und nicht ein Overlay-Button
        const topEl = document.elementFromPoint(e.clientX, e.clientY);
        if (topEl !== canvas) return; // Button oder anderes UI-Element liegt darüber

        // Zweiter Finger per isPrimary (Fallback, falls touchstart nicht ausreicht)
        if (!e.isPrimary) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            hadMultiTouch = true;
            return;
        }

        // Erstes Finger-Down → neuer Einzel-Touch-Gesture
        hadMultiTouch = false;
        longPressFired = false;
        longPressOrigin = { x: e.clientX, y: e.clientY };
        const rect = canvas.getBoundingClientRect();
        longPressLngLat = map.unproject([e.clientX - rect.left, e.clientY - rect.top]);
        longPressTimer = setTimeout(() => {
            // Nochmals prüfen: falls zwischenzeitlich Multi-Touch erkannt wurde, abbrechen
            if (hadMultiTouch) return;
            longPressFired = true;
            longPressTimer = null;
            window.dispatchEvent(new CustomEvent('mapclick', {
                detail: { lngLat: longPressLngLat, longPress: true }
            }));
            // Flag nach kurzer Zeit zurücksetzen, damit nachfolgende reguläre Klicks funktionieren
            setTimeout(() => { longPressFired = false; }, 300);
        }, 500);
    });

    canvas.addEventListener('pointermove', (e) => {
        if (!longPressTimer || !longPressOrigin) return;
        const dx = e.clientX - longPressOrigin.x;
        const dy = e.clientY - longPressOrigin.y;
        if (dx * dx + dy * dy > 100) { // >10px → kein Long-Press
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    });

    canvas.addEventListener('pointerup',     () => { clearTimeout(longPressTimer); longPressTimer = null; });
    canvas.addEventListener('pointercancel', () => { clearTimeout(longPressTimer); longPressTimer = null; });

    // Kurzer Tap → normaler Click (für POI etc., kein Wegpunkt)
    map.on('click', (e) => {
        if (longPressFired) { longPressFired = false; return; } // bereits als Long-Press behandelt
        if (hadMultiTouch) { hadMultiTouch = false; return; }  // Pinch-Zoom Nachfolge-Click
        window.dispatchEvent(new CustomEvent('mapclick', {
            detail: { lngLat: e.lngLat, longPress: false }
        }));
    });

    // Overlay-Buttons: pointerdown-Events stoppen, damit MapLibre keine Drag-Geste erkennt
    // und suppressClick() nach Button-Taps nicht aufgerufen wird
    const overlayButtons = document.getElementById('map-overlay-buttons');
    if (overlayButtons) {
        overlayButtons.addEventListener('pointerdown', (e) => {
            clearTimeout(longPressTimer);
            longPressTimer = null;
            e.stopPropagation();
        });
    }

    // Auto-Follow deaktivieren bei manueller Interaktion
    map.on('dragstart', () => {
        clearTimeout(longPressTimer);
        longPressTimer = null;
        autoFollow = false;
        updateFollowButton(false);
    });

    // Auto-Follow deaktivieren bei User-initiiertem Zoom (Pinch, Scroll) — nicht bei flyTo/easeTo
    map.on('zoomstart', (e) => {
        if (e.originalEvent) {
            autoFollow = false;
            updateFollowButton(false);
        }
    });

    return map;
}

/**
 * Fuegt Beschriftungs-Layer hinzu
 */
export function addLabelsLayer() {
    try {
        map.setGlyphs('https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf');

        const regions = _activeRegions || ['germany'];
        const labelDefs = [
            { id: 'place-city',     'source-layer': 'place',    filter: ['==', ['get', 'class'], 'city'],    minzoom: 5,  layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'],    'text-size': 16 }, paint: { 'text-color': '#333', 'text-halo-color': '#fff', 'text-halo-width': 2   } },
            { id: 'place-town',     'source-layer': 'place',    filter: ['==', ['get', 'class'], 'town'],    minzoom: 8,  layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 13 }, paint: { 'text-color': '#444', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } },
            { id: 'place-village',  'source-layer': 'place',    filter: ['==', ['get', 'class'], 'village'], minzoom: 11, layout: { 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 11 }, paint: { 'text-color': '#555', 'text-halo-color': '#fff', 'text-halo-width': 1   } },
            { id: 'waterway-label', 'source-layer': 'waterway', filter: ['has', 'name'],                     layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Noto Sans Regular'], 'text-size': 12 }, paint: { 'text-color': '#4a90d9', 'text-halo-color': '#fff', 'text-halo-width': 1.5 } },
        ];

        for (const r of regions) {
            for (const def of labelDefs) {
                map.addLayer({ ...def, id: `${def.id}-${r}`, source: `basemap-${r}`, type: 'symbol' });
            }
        }
        console.log('Labels hinzugefuegt');
    } catch (e) {
        console.warn('Labels konnten nicht hinzugefuegt werden:', e.message);
    }
}

/**
 * Fuegt OpenSeaMap Overlays hinzu — lokal (Vektor) wenn verfuegbar, sonst online (Raster)
 */
export async function addOpenSeaMapOverlays() {
    try {
        // Idempotent: nach einem Style-Reload erneut aufgerufen. Ohne diesen Guard
        // wirft addSource("already exists") und der EINE try/catch unten verschluckt
        // es — dann entsteht KEIN einziges Overlay mehr.
        if (map.getSource('seamark-online')) return;

        // Online-Fallback immer als Source registrieren
        map.addSource('seamark-online', {
            type: 'raster',
            tiles: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png'],
            tileSize: 256
        });

        // Pruefen ob lokale Seamark-MBTiles verfuegbar
        let localAvailable = false;
        try {
            const r = await fetch('/api/map/seamarks/status',
                { signal: AbortSignal.timeout(2000) });
            if (r.ok) localAvailable = (await r.json()).available;
        } catch (_) {}

        if (localAvailable) {
            // Online-Raster zuerst (unten), lokale Vektordaten darüber
            map.addLayer({
                id: 'seamark-overlay',
                type: 'raster',
                source: 'seamark-online',
                layout: { visibility: 'visible' },
                paint: { 'raster-opacity': 1.0 }
            });

            // Lokale Vektor-Seezeichen
            map.addSource('seamark-local', {
                type: 'vector',
                tiles: [`${location.protocol}//${location.host}/api/map/seamarks/{z}/{x}/{y}.pbf`],
                minzoom: 8,
                maxzoom: 14,
                attribution: '© OpenSeaMap contributors'
            });

            // Kreis-Layer: Farbe nach IALA-Konvention aus "colour"-Attribut
            map.addLayer({
                id: 'seamark-local-circle',
                type: 'circle',
                source: 'seamark-local',
                'source-layer': 'seamark',
                minzoom: 8,
                layout: { visibility: 'visible' },
                paint: {
                    'circle-radius': ['interpolate', ['linear'], ['zoom'],
                        8, 3, 12, 5, 15, 7],
                    'circle-color': ['match', ['get', 'colour'],
                        'red',              '#CC2200',
                        'green',            '#006622',
                        'yellow',           '#FFD700',
                        'black',            '#1a1a1a',
                        'white',            '#E8E8E8',
                        'red;white',        '#CC3355',
                        'white;red',        '#CC3355',
                        'green;white',      '#228844',
                        'white;green',      '#228844',
                        'black;red;black',  '#660022',
                        'black;yellow',     '#886600',
                        'yellow;black',     '#886600',
                        'black;yellow;black','#886600',
                        'yellow;black;yellow','#886600',
                        '#888888'
                    ],
                    'circle-stroke-width': 1.5,
                    'circle-stroke-color': ['match', ['get', 'colour'],
                        'white',        '#333333',
                        'yellow',       '#333333',
                        'red;white',    '#333333',
                        'white;red',    '#333333',
                        'green;white',  '#333333',
                        'white;green',  '#333333',
                        '#000000'
                    ],
                    'circle-opacity': 0.9
                }
            });

            // Label-Layer: Name und/oder Leuchtfeuerkennung
            map.addLayer({
                id: 'seamark-local-label',
                type: 'symbol',
                source: 'seamark-local',
                'source-layer': 'seamark',
                minzoom: 11,
                layout: {
                    visibility: 'visible',
                    'text-field': ['coalesce',
                        ['case',
                            ['all', ['has', 'name'], ['has', 'light_char']],
                            ['concat', ['get', 'name'], '\n', ['get', 'light_char']],
                            ['has', 'name'], ['get', 'name'],
                            ['has', 'light_char'], ['get', 'light_char'],
                            ''
                        ],
                        ''
                    ],
                    'text-size': 10,
                    'text-offset': [0, 1.2],
                    'text-anchor': 'top',
                    'text-optional': true,
                    'text-max-width': 8
                },
                paint: {
                    'text-color': '#000000',
                    'text-halo-color': '#ffffff',
                    'text-halo-width': 1.5
                }
            });

            console.log('Lokale Vektor-Seezeichen aktiv + Online-Raster als Fallback');
        } else {
            // Kein lokales MBTiles — online Raster-Overlay
            map.addLayer({
                id: 'seamark-overlay',
                type: 'raster',
                source: 'seamark-online',
                layout: { visibility: 'visible' },
                paint: { 'raster-opacity': 1.0 }
            });
            console.log('OpenSeaMap Online-Overlay aktiv (kein lokales MBTiles)');
        }

        // Binnenschifffahrt-Layer (immer online)
        map.addSource('inland', {
            type: 'raster',
            tiles: ['https://tiles.openseamap.org/inland/{z}/{x}/{y}.png'],
            tileSize: 256
        });
        map.addLayer({
            id: 'inland-overlay',
            type: 'raster',
            source: 'inland',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 1.0 }
        });

    } catch (e) {
        console.warn('OpenSeaMap Overlays konnten nicht hinzugefuegt werden:', e);
    }
}

// ===========================================
// Boot-Marker Funktionen
// ===========================================

// Mapping: Settings-Icon-Keys → Emoji
const BOAT_ICON_EMOJIS = {
    motorboat: '🚤',
    sailboat:  '⛵',
    yacht:     '🛥️',
    ship:      '🚢',
};

function boatEmoji(iconType) {
    return BOAT_ICON_EMOJIS[iconType] || '🚤';
}

/**
 * Initialisiert den Boot-Marker auf der Karte
 */
function initMapMarkers() {
    // Boot-Icon aus Einstellungen laden
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    const boatIconType = settings.boat?.icon || 'motorboat';

    // HTML-Element fuer Boot-Marker erstellen
    const el = document.createElement('div');
    el.className = 'boat-marker';
    el.textContent = boatEmoji(boatIconType);
    boatMarkerElement = el;

    // Aktuelle Position aus globalem State
    const currentPos = window.currentPosition || { lat: 51.855, lon: 12.046 };

    boatMarker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat([currentPos.lon, currentPos.lat])
        .addTo(map);

    console.log('Boot-Marker hinzugefuegt');

    // Track-History Sichtbarkeit pruefen
    if (settings.showTrackHistory === false) {
        map.setLayoutProperty('track-line', 'visibility', 'none');
    }
}

/**
 * Erstellt den Boot-Marker
 * @param {string} iconType - Typ des Boot-Icons
 * @returns {Object} Marker-Instanz
 */
export function createBoatMarker(iconType = 'motorboat') {
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    const type = settings.boat?.icon || iconType;

    const el = document.createElement('div');
    el.className = 'boat-marker';
    el.textContent = boatEmoji(type);
    boatMarkerElement = el;

    return el;
}

/**
 * Aktualisiert die Boot-Position auf der Karte
 * @param {Object} gps - GPS-Daten {lat, lon, course, heading}
 */
/**
 * Setzt das Boot SOFORT auf eine Position — ohne Glättung, ohne Animation und
 * ohne Track-Eintrag. Für echte Sprünge (Simulation Start/Ende).
 *
 * Über updateBoatPosition() wäre das falsch: die EMA-/Ease-Glättung lässt den
 * Marker sichtbar per LUFTLINIE zum Ziel gleiten, und addToTrackHistory()
 * zeichnet die Sprungstrecke zusätzlich als Track-Linie mit ein.
 */
export function setBoatPositionImmediate(lat, lon, heading) {
    if (!map || !boatMarker) return;

    // Laufende Marker-Animation abbrechen (sonst gleitet sie weiter zum alten Ziel)
    if (_animRafId) { cancelAnimationFrame(_animRafId); _animRafId = null; }

    // Kompletten Glättungs-Zustand auf die neue Position setzen — kein Nachziehen
    _emaLat = lat; _emaLon = lon;
    _fromLat = lat; _fromLon = lon;
    _targetLat = lat; _targetLon = lon;
    _dispLat = lat; _dispLon = lon;

    window.currentPosition = { lat, lon };   // bewusst OHNE addToTrackHistory()
    boatMarker.setLngLat([lon, lat]);

    if (typeof heading === 'number') {
        currentBoatHeading = heading;
        _smoothHeading = heading;            // Bearing nicht über die alte Richtung einschwenken lassen
        if (boatMarkerElement) {
            boatMarkerElement.style.transform = `rotate(${heading - map.getBearing()}deg)`;
        }
    }

    if (autoFollow && performance.now() >= _camTransitionUntil) {
        const opts = { center: [lon, lat] };
        if (courseUpMode && currentBoatHeading) opts.bearing = currentBoatHeading;
        map.jumpTo(opts);
    }
}

export function updateBoatPosition(gps) {
    if (!gps || !gps.lat || !gps.lon) return;
    if (!map || !boatMarker) return;

    const rawLat = gps.lat;
    const rawLon = gps.lon;

    // Skip if identical to last raw position
    const currentPos = window.currentPosition || {};
    if (rawLat === currentPos.lat && rawLon === currentPos.lon) return;

    // Update raw position state + track history (unsmoothed — accurate for logging)
    window.currentPosition = { lat: rawLat, lon: rawLon };
    addToTrackHistory(rawLat, rawLon);

    // EMA filter: blend new measurement into smoothed target
    if (_emaLat === null) {
        _emaLat = rawLat; _emaLon = rawLon;
    } else {
        _emaLat = GPS_EMA_ALPHA * rawLat + (1 - GPS_EMA_ALPHA) * _emaLat;
        _emaLon = GPS_EMA_ALPHA * rawLon + (1 - GPS_EMA_ALPHA) * _emaLon;
    }

    // Heading (rotate marker) — Karten-Drehung abziehen, damit das Boot in
    // Kurs-oben nach oben zeigt (in Nord-oben zeigt es Richtung heading).
    const heading = gps.course || gps.heading || 0;
    if (heading !== 0) {
        currentBoatHeading = heading;
        if (boatMarkerElement) {
            boatMarkerElement.style.transform = `rotate(${heading - map.getBearing()}deg)`;
        }
    }

    // Start smooth animation from current display position toward new EMA target
    _fromLat = _dispLat ?? _emaLat;
    _fromLon = _dispLon ?? _emaLon;
    _targetLat = _emaLat;
    _targetLon = _emaLon;
    _animStart = performance.now();

    if (!_animRafId) {
        _animRafId = requestAnimationFrame(_animateBoatMarker);
    }
    // If RAF already running, it picks up the updated _from/_target/_animStart next frame
}

/**
 * Aktualisiert das Boot-Marker Icon
 * @param {string} iconType - Typ des Icons
 */
export function updateBoatMarkerIcon(iconType) {
    if (!boatMarker || !boatMarkerElement) {
        console.warn('Boot-Marker noch nicht initialisiert');
        return;
    }

    boatMarkerElement.textContent = boatEmoji(iconType);
    boatMarkerElement.style.transform = `rotate(${currentBoatHeading}deg)`;
    console.log(`Boot-Marker Icon aktualisiert: ${iconType}`);
}

// ===========================================
// Track-Layer Funktionen
// ===========================================

/**
 * Initialisiert den Track-Layer (wird automatisch bei Map-Init gemacht)
 */
export function initTrackLayer() {
    // Wird bereits in initMap() durch GeoJSON Source erstellt
    console.log('Track-Layer initialisiert');
}

/**
 * Fuegt einen Punkt zur Track-History hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 */
export function addToTrackHistory(lat, lon) {
    trackHistory.push({ lat, lon, timestamp: Date.now() });

    // Maximale Anzahl Punkte begrenzen
    if (trackHistory.length > maxTrackPoints) {
        trackHistory.shift();
    }

    // GeoJSON Source aktualisieren
    updateTrackLine();
}

/**
 * Aktualisiert die Track-Linie auf der Karte
 */
export function updateTrackLine() {
    if (!map || !map.getSource('track-history')) return;

    const coordinates = trackHistory.map(point => [point.lon, point.lat]);
    map.getSource('track-history').setData({
        type: 'LineString',
        coordinates: coordinates
    });
}

/**
 * Setzt die Track-Historie (z.B. um den echten Track nach einer Simulation
 * wiederherzustellen) und zeichnet die Linie neu.
 */
export function setTrackHistory(points) {
    trackHistory = Array.isArray(points) ? points.slice(-maxTrackPoints) : [];
    updateTrackLine();
}

/**
 * Loescht die Track-History
 */
export function clearTrack() {
    trackHistory = [];
    if (map && map.getSource('track-history')) {
        map.getSource('track-history').setData({
            type: 'LineString',
            coordinates: []
        });
    }
    console.log('Track-Historie geloescht');
}

/**
 * Setzt die maximale Anzahl Track-Punkte
 * @param {number} max - Maximale Anzahl
 */
export function setMaxTrackPoints(max) {
    maxTrackPoints = max;
    // Ueberschuessige Punkte entfernen
    while (trackHistory.length > maxTrackPoints) {
        trackHistory.shift();
    }
    updateTrackLine();
}

/**
 * Schaltet die Track-History Sichtbarkeit um
 * @param {boolean} show - true zum Anzeigen
 */
export function toggleTrackHistory(show) {
    if (map && map.getLayer('track-line')) {
        map.setLayoutProperty('track-line', 'visibility', show ? 'visible' : 'none');
    }
}

// ===========================================
// Route-Layer Funktionen
// ===========================================

/**
 * Zeigt eine Route auf der Karte an
 * @param {Array} coordinates - Array von [lon, lat] Koordinaten
 * @param {Object} options - Optionen wie Farbe, etc.
 */
export function showRoute(coordinates, options = {}) {
    if (!map) return;

    const color = options.color || '#2ecc71';
    currentRouteColor = color;

    // Route-Koordinaten speichern (fuer XTE-Berechnung)
    currentRouteCoordinates = coordinates.map(c => ({ lat: c[1], lon: c[0] }));

    const routeFeature = {
        type: 'Feature',
        properties: { color: color },
        geometry: {
            type: 'LineString',
            coordinates: coordinates
        }
    };

    // Schatten-Layer aktualisieren
    if (map.getSource('route-shadow')) {
        map.getSource('route-shadow').setData({
            type: 'FeatureCollection',
            features: [routeFeature]
        });
    }

    // Haupt-Route aktualisieren
    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'FeatureCollection',
            features: [routeFeature]
        });
    }

    // Routen-Farbe setzen
    if (map.getLayer('route-line')) {
        map.setPaintProperty('route-line', 'line-color', color);
    }

    console.log(`Route angezeigt mit ${coordinates.length} Punkten`);
}

/**
 * Loescht die Route von der Karte
 */
export function clearRoute() {
    if (!map) return;

    // Alle Routen-Sources leeren
    const sources = ['route', 'route-shadow', 'completed-segments', 'current-segment', 'remaining-segments'];
    sources.forEach(sourceId => {
        if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData({ type: 'FeatureCollection', features: [] });
        }
    });

    // Routen-Label-Marker entfernen
    removeRouteLabels();

    currentRouteCoordinates = null;

    console.log('Route geloescht');
}

/**
 * Entfernt Routen-Label-Marker
 */
export function removeRouteLabels() {
    routeLabelMarkers.forEach(marker => marker.remove());
    routeLabelMarkers = [];
}

/**
 * Loescht Routen-Richtungspfeile
 */
/**
 * Fuegt einen Routen-Label-Marker hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 * @param {string} html - HTML-Inhalt des Labels
 */
export function addRouteLabelMarker(lat, lon, html) {
    const labelEl = document.createElement('div');
    labelEl.className = 'route-label';
    labelEl.innerHTML = html;

    const labelMarker = new maplibregl.Marker({ element: labelEl, anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(map);

    routeLabelMarkers.push(labelMarker);
    return labelMarker;
}


/**
 * Aktualisiert Routen-Segment-Highlighting
 * @param {Array} completedCoords - Abgeschlossene Koordinaten
 * @param {Array} currentSegmentCoords - Aktuelles Segment
 * @param {Array} remainingCoords - Verbleibende Koordinaten
 */
export function updateRouteSegments(completedCoords, currentSegmentCoords, remainingCoords) {
    if (!map) return;

    // Abgeschlossene Segmente
    if (completedCoords && completedCoords.length > 0 && map.getSource('completed-segments')) {
        map.getSource('completed-segments').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: completedCoords }
        });
    }

    // Aktuelles Segment
    if (currentSegmentCoords && currentSegmentCoords.length > 0 && map.getSource('current-segment')) {
        map.getSource('current-segment').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: currentSegmentCoords }
        });
    }

    // Verbleibende Segmente
    if (remainingCoords && remainingCoords.length > 0 && map.getSource('remaining-segments')) {
        map.getSource('remaining-segments').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: remainingCoords }
        });
    }
}

// ===========================================
// Tile-Layer Management
// ===========================================

/**
 * Fuegt einen Tile-Layer hinzu
 * @param {string} id - Layer-ID
 * @param {string} url - Tile-URL Template
 * @param {Object} options - Layer-Optionen
 */
export function addTileLayer(id, url, options = {}) {
    if (!map) return;

    if (!map.getSource(id)) {
        map.addSource(id, {
            type: 'raster',
            tiles: [url],
            tileSize: options.tileSize || 256,
            maxzoom: options.maxzoom || 19
        });

        map.addLayer({
            id: `${id}-layer`,
            type: 'raster',
            source: id,
            paint: { 'raster-opacity': options.opacity || 1.0 }
        }, options.beforeId);
    }

    console.log(`Tile-Layer hinzugefuegt: ${id}`);
}

/**
 * Entfernt einen Tile-Layer
 * @param {string} id - Layer-ID
 */
export function removeTileLayer(id) {
    if (!map) return;

    if (map.getLayer(`${id}-layer`)) {
        map.removeLayer(`${id}-layer`);
    }
    if (map.getSource(id)) {
        map.removeSource(id);
    }

    console.log(`Tile-Layer entfernt: ${id}`);
}

/**
 * Setzt die Sichtbarkeit eines Layers
 * @param {string} layerId - Layer-ID
 * @param {boolean} visible - Sichtbarkeit
 */
export function setLayerVisibility(layerId, visible) {
    if (map && map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
    }
}

/**
 * Setzt die Opazitaet eines Layers
 * @param {string} layerId - Layer-ID
 * @param {number} opacity - Opazitaet (0-1)
 */
export function setLayerOpacity(layerId, opacity) {
    if (map && map.getLayer(layerId)) {
        map.setPaintProperty(layerId, 'raster-opacity', opacity);
    }
}

// ===========================================
// Zoom & Pan Funktionen
// ===========================================

/**
 * Zentriert die Karte auf das Boot
 */
export function centerOnBoat() {
    const currentPos = window.currentPosition || { lat: 51.855, lon: 12.046 };
    autoFollow = true;
    updateFollowButton(true);

    if (map) {
        const flyOpts = {
            center: [currentPos.lon, currentPos.lat],
            zoom: 15,
            duration: 1000
        };
        if (courseUpMode && currentBoatHeading !== 0) {
            flyOpts.bearing = currentBoatHeading;   // Head-up: Fahrtrichtung nach oben
        }
        map.flyTo(flyOpts);
    }
}

export function toggleCourseUp() {
    courseUpMode = !courseUpMode;
    if (!courseUpMode) {
        // Zurück zu Norden — Follow waehrend der Drehung pausieren, sonst killt
        // das erste jumpTo die Kamerafahrt und die Karte bleibt schief stehen.
        if (map) { _beginCameraTransition(600); map.easeTo({ bearing: 0, duration: 600 }); }
        _smoothHeading = null;
    }
    _updateCourseUpButton();
}

function _updateCourseUpButton() {
    const ring = document.getElementById('compass-active-ring');
    if (ring) ring.setAttribute('opacity', courseUpMode ? '1' : '0');
}

/* ── Himmel in der 3D-Ansicht ────────────────────────────────────────────────
 *
 * Zwei Ebenen, bewusst getrennt:
 *  1. Der VERLAUF kommt von MapLibre selbst (map.setSky, seit 4.x im Style-Spec):
 *     kraeftiges Blau im Zenit, heller Dunst zum Horizont, plus Fog, der die
 *     Karte in der Ferne ausblendet. Das rendert die GPU im Karten-Shader —
 *     also korrekt hinter allem und ohne eigenes Zutun bei jeder Neigung.
 *  2. Die WOLKEN sind ein DOM-Overlay ueber dem Canvas. MapLibre kann keine
 *     Wolken; ein three.js-Skydome waere fuer den Pi zu teuer. Zwei driftende
 *     Schichten aus CSS-Radial-Gradienten geben Parallaxe. Bewusst KEIN
 *     filter: blur() — das erzeugt auf der Pi-GPU Artefakte (siehe Seezeichen).
 *
 * Der Nachtmodus braucht keine Sonderbehandlung: der Rotfilter aus theme.css
 * liegt auf #map und damit auf Canvas UND Overlay.
 */
function _applySky() {
    if (!map || typeof map.setSky !== 'function') return;
    try {
        map.setSky({
            'sky-color': '#4b8fd6',          // Zenit
            'horizon-color': '#cfe4f5',      // Dunst kurz ueber dem Horizont
            'fog-color': '#e3edf5',          // Ferne der Karte
            'sky-horizon-blend': 0.7,        // wie weit das Blau nach unten reicht
            'horizon-fog-blend': 0.55,
            'fog-ground-blend': 0.35,
        });
    } catch (_) { /* aeltere MapLibre ohne sky-Spec: dann eben ohne */ }
}

let _skyEl = null;

function _ensureSkyOverlay() {
    if (_skyEl || !map) return;
    const host = map.getCanvasContainer && map.getCanvasContainer();
    const canvas = map.getCanvas && map.getCanvas();
    if (!host || !canvas) return;
    const el = document.createElement('div');
    el.className = 'map-sky';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = '<div class="map-sky-clouds far"></div><div class="map-sky-clouds near"></div>';
    // Direkt hinter den Canvas: Marker haengen im selben Container und werden
    // spaeter angehaengt — sie bleiben damit ueber den Wolken.
    canvas.insertAdjacentElement('afterend', el);
    _skyEl = el;
    _updateSkyOverlay();
}

/**
 * Setzt die Hoehe des Wolkenbands auf die Horizontlinie.
 *
 * transform.getHorizon() liefert den Abstand der Horizontlinie von der
 * Bildmitte — dieselbe Rechnung nutzt MapLibre intern fuer den Sky-Shader und
 * fuer getBounds(). Interne API: faellt sie weg, bleibt das Band einfach leer
 * (der Verlauf aus setSky ist davon unabhaengig und bleibt sichtbar).
 */
function _updateSkyOverlay() {
    if (!map || !_skyEl) return;
    let y = 0;
    try {
        const t = map.transform;
        const h = (map.getContainer() && map.getContainer().clientHeight) || 0;
        if (t && typeof t.getHorizon === 'function') {
            // 1.3× : bis zur Horizontlinie reicht der sky-Verlauf, darunter
            // folgt noch der Dunststreifen bis zum Kartenrand (Far-Plane). Die
            // Wolken duerfen leicht hineinlaufen — die Maske blendet sie dort
            // ohnehin aus, und ein harter Schnitt genau auf der Linie faellt
            // staerker auf als ein paar ferne Wolken im Dunst.
            const horizonY = h / 2 - t.getHorizon();
            y = Math.max(0, Math.min(h, horizonY * 1.3));
        }
    } catch (_) { y = 0; }
    _skyEl.style.height = Math.round(y) + 'px';
}

// 3D-/Look-ahead-Perspektive: Karte gekippt + head-up + Boot in die untere
// Bildhälfte (mehr Fahrrinne voraus sichtbar), auf den bestehenden IENC-Daten.
export function toggleMap3D(active) {
    if (typeof active !== 'boolean') active = !perspective3D;
    perspective3D = active;
    if (window.BoatOS3D) window.BoatOS3D.setActive(active);  // echte 3D-Seezeichen ein/aus
    if (map) {
        if (active) {
            _courseUpBefore3D = courseUpMode;
            courseUpMode = true;            // Look-ahead braucht Kurs oben
            _updateCourseUpButton();
            autoFollow = true;
            updateFollowButton(true);
            const h = (map.getContainer() && map.getContainer().clientHeight) || 600;
            _zoomBefore3D = map.getZoom();
            const opts = {
                pitch: _pitch3D,
                zoom: Math.min(20, Math.max(_zoomBefore3D, _zoom3dTarget())),
                padding: { top: Math.round(h * 0.45), bottom: 0, left: 0, right: 0 },
                duration: 600,
            };
            if (currentBoatHeading) opts.bearing = _updateSmoothedHeading(currentBoatHeading);
            // Boot mitnehmen: waehrend der Kamerafahrt pausiert Follow (siehe
            // _beginCameraTransition), sonst wuerde die Fahrt sofort abgebrochen.
            if (_dispLat != null && _dispLon != null) opts.center = [_dispLon, _dispLat];
            _beginCameraTransition(opts.duration);
            map.easeTo(opts);
        } else {
            courseUpMode = _courseUpBefore3D;
            _updateCourseUpButton();
            const opts = { pitch: 0, padding: { top: 0, bottom: 0, left: 0, right: 0 }, duration: 600 };
            if (_zoomBefore3D != null) opts.zoom = _zoomBefore3D;
            if (!courseUpMode) { opts.bearing = 0; _smoothHeading = null; }
            if (_dispLat != null && _dispLon != null) opts.center = [_dispLon, _dispLat];
            _beginCameraTransition(opts.duration);
            map.easeTo(opts);
        }
    }
    try { localStorage.setItem('perspective3D', active ? 'true' : 'false'); } catch (_) {}
    const btn = document.getElementById('btn-map3d');
    if (btn) btn.classList.toggle('active', active);

    // Pitch-Buttons gibt es nur in 3D — in der Draufsicht waeren sie sinnlos.
    document.body.classList.toggle('map3d-active', active);
    _updatePitchIndicator();
}

/** Zeigt die aktuelle Neigung neben der Zoomstufe an (nur im 3D-Modus). */
function _updatePitchIndicator() {
    const el = document.getElementById('pitch-indicator');
    if (!el) return;
    el.textContent = `${Math.round(_pitch3D)}°`;
    el.style.display = perspective3D ? 'inline-block' : 'none';
}

export function isPerspective3D() { return perspective3D; }

function updateFollowButton(following) {
    const btn = document.getElementById('btn-follow-resume');
    if (!btn) return;
    // Follow-Button nur anzeigen wenn Navigation aktiv ist und Folgen deaktiviert wurde
    const navActive = window.BoatOS?.navigation?.isNavigationActive?.() ?? false;
    btn.style.display = (navActive && !following) ? 'flex' : 'none';
}

/**
 * Zoomt die Karte hinein
 */
export function zoomIn() {
    autoFollow = false;
    updateFollowButton(false);
    if (map) map.zoomIn({ duration: 300 });
}

/**
 * Zoomt die Karte heraus
 */
export function zoomOut() {
    autoFollow = false;
    updateFollowButton(false);
    if (map) map.zoomOut({ duration: 300 });
}

/**
 * Fliegt zu einer Position
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 * @param {number} zoom - Zoom-Level (optional)
 */
export function flyTo(lat, lon, zoom = 14) {
    if (map) {
        map.flyTo({
            center: [lon, lat],
            zoom: zoom,
            duration: 1500
        });
    }
}

/**
 * Passt die Karte an Bounds an
 * @param {Array} bounds - [[minLon, minLat], [maxLon, maxLat]]
 * @param {Object} options - Optionen wie padding
 */
export function fitBounds(bounds, options = {}) {
    if (map && bounds) {
        map.fitBounds(bounds, {
            padding: options.padding || 50,
            duration: options.duration || 1000
        });
    }
}

/**
 * Aktiviert/Deaktiviert Auto-Follow
 * @param {boolean} enable - true zum Aktivieren
 */
export function setAutoFollow(enable) {
    autoFollow = enable;
    updateFollowButton(enable);
}

/**
 * Gibt zurueck ob Auto-Follow aktiv ist
 * @returns {boolean}
 */
export function isAutoFollowEnabled() {
    return autoFollow;
}

// ===========================================
// Layer-Toggle Funktionen
// ===========================================

/**
 * Wechselt zwischen Karten- und Satellitenansicht
 */
export function toggleMapView() {
    if (!map) return;

    if (currentBaseLayer === 'osm') {
        currentBaseLayer = 'satellite';

        // Satelliten-Source hinzufuegen falls nicht vorhanden
        if (!map.getSource('satellite')) {
            map.addSource('satellite', {
                type: 'raster',
                tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
                tileSize: 256,
                maxzoom: 19
            });
        }

        // Vektor-Layer ausblenden
        hideVectorLayers();

        // Satelliten-Layer anzeigen
        if (!map.getLayer('satellite-layer')) {
            map.addLayer({
                id: 'satellite-layer',
                type: 'raster',
                source: 'satellite',
                paint: { 'raster-opacity': 1 }
            }, 'seamark-overlay');
        } else {
            map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }

        console.log('Satellitenansicht aktiviert');
    } else {
        currentBaseLayer = 'osm';

        // Satelliten-Layer ausblenden
        if (map.getLayer('satellite-layer')) {
            map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }

        // Vektor-Layer einblenden
        showVectorLayers();

        console.log('Kartenansicht aktiviert');
    }

    return currentBaseLayer;
}

function hideVectorLayers() {
    if (!map) return;
    map.getStyle().layers.forEach(layer => {
        if (layer.id === 'background' || (layer.source && layer.source.startsWith('basemap-'))) {
            map.setLayoutProperty(layer.id, 'visibility', 'none');
        }
    });
}

function showVectorLayers() {
    if (!map) return;
    map.getStyle().layers.forEach(layer => {
        if (layer.id === 'background' || (layer.source && layer.source.startsWith('basemap-'))) {
            map.setLayoutProperty(layer.id, 'visibility', 'visible');
        }
    });
}

/**
 * Schaltet OpenSeaMap Seezeichen-Layer um (lokal und/oder online)
 * @param {boolean} visible - Sichtbarkeit
 */
export function toggleSeamarkLayer(visible) {
    seaMarkLayerVisible = visible;
    // Lokale Vektor-Layer
    ['seamark-local-circle', 'seamark-local-label'].forEach(id => {
        if (map.getLayer(id)) setLayerVisibility(id, visible);
    });
    // Online-Raster immer mitschalten (Fallback für Gebiete ohne lokale Daten)
    if (map.getLayer('seamark-overlay')) {
        setLayerVisibility('seamark-overlay', visible);
    }
    console.log(`Seezeichen-Layer: ${visible ? 'sichtbar' : 'ausgeblendet'}`);
}

/**
 * Schaltet Binnenschifffahrt-Layer um
 * @param {boolean} visible - Sichtbarkeit
 */
export function toggleInlandLayer(visible) {
    inlandLayerVisible = visible;
    setLayerVisibility('inland-overlay', visible);
    console.log(`Binnenschifffahrt-Layer: ${visible ? 'sichtbar' : 'ausgeblendet'}`);
}

/**
 * Gibt die aktuelle Basisschicht zurueck
 * @returns {string} 'osm' oder 'satellite'
 */
export function getCurrentBaseLayer() {
    return currentBaseLayer;
}

/**
 * Schaltet den Satelliten-Layer ein oder aus
 * @param {boolean} [active] - true = an, false = aus, undefined = umschalten
 */
export function toggleSatellite(active) {
    if (!map) return;

    if (active === undefined) {
        active = currentBaseLayer !== 'satellite';
    }

    if (active) {
        // Satelliten-Layer einblenden
        if (map.getLayer('satellite-layer')) {
            map.setLayoutProperty('satellite-layer', 'visibility', 'visible');
        }
        // OSM-Vektor-Layer ausblenden, damit Satellit als Basis sichtbar ist
        hideVectorLayers();
        currentBaseLayer = 'satellite';
        console.log('Satellitenansicht aktiviert');
    } else {
        // Satelliten-Layer ausblenden
        if (map.getLayer('satellite-layer')) {
            map.setLayoutProperty('satellite-layer', 'visibility', 'none');
        }
        // OSM-Vektor-Layer wieder einblenden
        showVectorLayers();
        currentBaseLayer = 'osm';
        console.log('Kartenansicht aktiviert');
    }

    // Button-Zustand aktualisieren
    const btn = document.getElementById('btn-satellite');
    if (btn) {
        btn.classList.toggle('active', active);
    }

    // Praeferenz speichern
    localStorage.setItem('satelliteMode', active ? 'true' : 'false');

    return currentBaseLayer;
}

/**
 * Gibt zurueck ob der Satelliten-Layer aktiv ist
 * @returns {boolean}
 */
export function isSatelliteMode() {
    return currentBaseLayer === 'satellite';
}

/**
 * Konvertiert Laengen-/Breitengrad in Kachel-Koordinaten (XYZ)
 * @param {number} lng - Laengengrad
 * @param {number} lat - Breitengrad
 * @param {number} zoom - Zoom-Level
 * @returns {{x: number, y: number, z: number}}
 */
function lngLatToTile(lng, lat, zoom) {
    const z = Math.floor(zoom);
    const x = Math.floor((lng + 180) / 360 * Math.pow(2, z));
    const latRad = lat * Math.PI / 180;
    const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, z));
    return { x, y, z };
}

/**
 * Berechnet alle Satelliten-Kachel-URLs fuer den aktuellen Viewport
 * Fetcht die Kacheln NICHT selbst — gibt nur die URLs zurueck.
 * @param {Function} [progressCallback] - Fortschritts-Callback (aktuelle, gesamt)
 * @returns {string[]} Array aller Kachel-URLs
 */
export function cacheSatelliteViewport(progressCallback) {
    if (!map) return [];

    const BASE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';
    const MAX_TILES = 3000;
    const bounds = map.getBounds();
    const currentZoom = map.getZoom();

    const minLng = bounds.getWest();
    const maxLng = bounds.getEast();
    const minLat = bounds.getSouth();
    const maxLat = bounds.getNorth();

    // Zoom-Bereiche: von 0 bis min(currentZoom, 10) und von currentZoom bis 16
    const minOverviewZoom = 0;
    const maxOverviewZoom = Math.min(Math.floor(currentZoom), 10);
    const maxDetailZoom = Math.min(Math.floor(currentZoom), 16);

    const urls = [];

    // Hilfsfunktion: URLs fuer einen Zoom-Level zum Array hinzufuegen
    function addZoomLevel(z) {
        const tileMin = lngLatToTile(minLng, maxLat, z); // maxLat = kleinste y-Kachel
        const tileMax = lngLatToTile(maxLng, minLat, z); // minLat = groesste y-Kachel

        const xMin = Math.max(0, tileMin.x);
        const xMax = Math.min(Math.pow(2, z) - 1, tileMax.x);
        const yMin = Math.max(0, tileMin.y);
        const yMax = Math.min(Math.pow(2, z) - 1, tileMax.y);

        for (let x = xMin; x <= xMax; x++) {
            for (let y = yMin; y <= yMax; y++) {
                if (urls.length >= MAX_TILES) return false; // Limit erreicht
                urls.push(`${BASE_URL}/${z}/${y}/${x}`);
            }
        }
        return true;
    }

    // Uebersichts-Zoom-Level (globale Kacheln, immer hinzufuegen)
    for (let z = minOverviewZoom; z <= maxOverviewZoom; z++) {
        if (!addZoomLevel(z)) break;
    }

    // Detail-Zoom-Level (viewport-spezifisch, bis Limit)
    for (let z = maxOverviewZoom + 1; z <= maxDetailZoom; z++) {
        if (!addZoomLevel(z)) break;
    }

    console.log(`Satelliten-Cache: ${urls.length} Kacheln berechnet (Zoom ${minOverviewZoom}–${maxDetailZoom})`);

    if (progressCallback) {
        progressCallback(0, urls.length);
    }

    return urls;
}

// ===========================================
// Displayed Track Funktionen (aus Logbook)
// ===========================================

/**
 * Zeigt einen gespeicherten Track auf der Karte an
 * @param {Array} trackData - Array von {lat, lon, timestamp}
 */
export function showTrackOnMap(trackData) {
    if (!map) return;

    // Vorherige Track-Marker entfernen
    displayedTrackMarkers.forEach(m => m.remove());
    displayedTrackMarkers = [];

    // Koordinaten konvertieren
    const trackCoords = trackData.map(point => [point.lon, point.lat]);

    // Source hinzufuegen oder aktualisieren
    if (!displayedTrackSourceAdded && map.loaded()) {
        map.addSource('displayed-track', {
            type: 'geojson',
            data: { type: 'LineString', coordinates: trackCoords }
        });
        map.addLayer({
            id: 'displayed-track-line',
            type: 'line',
            source: 'displayed-track',
            paint: {
                'line-color': '#9b59b6',
                'line-width': 4,
                'line-opacity': 0.8
            },
            layout: {
                'line-cap': 'round',
                'line-join': 'round'
            }
        });
        displayedTrackSourceAdded = true;
    } else if (map.getSource('displayed-track')) {
        map.getSource('displayed-track').setData({ type: 'LineString', coordinates: trackCoords });
        map.setLayoutProperty('displayed-track-line', 'visibility', 'visible');
    }

    // Start-Marker hinzufuegen
    if (trackCoords.length > 0) {
        const startEl = document.createElement('div');
        startEl.style.cssText = 'background: #2ecc71; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);';
        startEl.innerHTML = '▶';

        const startMarker = new maplibregl.Marker({ element: startEl, anchor: 'center' })
            .setLngLat(trackCoords[0])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Start</b><br>${new Date(trackData[0].timestamp).toLocaleString('de-DE')}`))
            .addTo(map);
        displayedTrackMarkers.push(startMarker);
    }

    // End-Marker hinzufuegen
    if (trackCoords.length > 1) {
        const endEl = document.createElement('div');
        endEl.style.cssText = 'background: #e74c3c; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);';
        endEl.innerHTML = '⏹';

        const endMarker = new maplibregl.Marker({ element: endEl, anchor: 'center' })
            .setLngLat(trackCoords[trackCoords.length - 1])
            .setPopup(new maplibregl.Popup().setHTML(`<b>Ende</b><br>${new Date(trackData[trackData.length - 1].timestamp).toLocaleString('de-DE')}`))
            .addTo(map);
        displayedTrackMarkers.push(endMarker);
    }

    // Karte auf Track zoomen
    if (trackCoords.length > 0) {
        const bounds = createBoundsFromPoints(trackData);
        if (bounds) {
            map.fitBounds(bounds, { padding: 50 });
        }
    }

    console.log(`Track angezeigt: ${trackData.length} Punkte`);
}

/**
 * Loescht den angezeigten Track
 */
export function clearDisplayedTrack() {
    if (map && map.getLayer('displayed-track-line')) {
        map.setLayoutProperty('displayed-track-line', 'visibility', 'none');
    }

    displayedTrackMarkers.forEach(m => m.remove());
    displayedTrackMarkers = [];

    console.log('Track-Ansicht geschlossen');
}

// ===========================================
// Hilfsfunktionen
// ===========================================

/**
 * Erstellt Bounds aus einem Array von Punkten
 * @param {Array} points - Array von {lat, lon} oder [lat, lon]
 * @returns {Array} [[minLon, minLat], [maxLon, maxLat]] oder null
 */
export function createBoundsFromPoints(points) {
    if (!points || points.length === 0) return null;

    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;

    points.forEach(p => {
        const lat = Array.isArray(p) ? p[0] : p.lat;
        const lon = Array.isArray(p) ? p[1] : p.lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
    });

    return [[minLon, minLat], [maxLon, maxLat]];
}

/**
 * Berechnet die Distanz zwischen zwei Punkten (Haversine)
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Laengengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Laengengrad Punkt 2
 * @returns {number} Distanz in Metern
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Erdradius in Metern
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Berechnet den Kurs zwischen zwei Punkten
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Laengengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Laengengrad Punkt 2
 * @returns {number} Kurs in Grad (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    lat1 = lat1 * toRad;
    lat2 = lat2 * toRad;
    const dLon = (lon2 - lon1) * toRad;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * toDeg;
    bearing = (bearing + 360) % 360;

    return bearing;
}

// ===========================================
// Getter fuer internen State
// ===========================================

/**
 * Gibt die Map-Instanz zurueck
 * @returns {Object} MapLibre GL Map Instanz
 */
export function getMap() {
    return map;
}

/**
 * Gibt die aktuellen Route-Koordinaten zurueck
 * @returns {Array} Route-Koordinaten
 */
export function getCurrentRouteCoordinates() {
    return currentRouteCoordinates;
}

/**
 * Gibt die Track-History zurueck
 * @returns {Array} Track-Punkte
 */
export function getTrackHistory() {
    return trackHistory;
}

/**
 * Gibt den aktuellen Boot-Heading zurueck
 * @returns {number} Heading in Grad
 */
export function getCurrentBoatHeading() {
    return currentBoatHeading;
}

// ===========================================
// Export State Getter
// ===========================================
export function getMapState() {
    return {
        map,
        currentBaseLayer,
        seaMarkLayerVisible,
        inlandLayerVisible,
        autoFollow,
        trackHistoryLength: trackHistory.length,
        hasRoute: currentRouteCoordinates !== null
    };
}
