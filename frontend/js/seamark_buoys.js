/**
 * OSM-Tonnen / Seezeichen — Vektor-Layer (2D) + Speisung der 3D-Szene
 * ==================================================================
 * Die amtlichen ELWIS-IENC-Daten enthalten fuer die deutschen Binnenreviere
 * fast keine Lateral-/Fahrwasser-Tonnen. Die reiche Betonnung, die man sonst
 * sieht, kommt aus dem OpenSeaMap-RASTER-Overlay — Pixel, keine Geometrie.
 *
 * Dieses Modul holt die Tonnen als echte Punkte aus dem Backend
 * (/api/seamarks/buoys, vorab aus OSM importiert) und
 *   1. zeigt sie als 2D-Vektor-Kreise (offline, farbig, klickbar erweiterbar),
 *   2. legt sie unter window.BoatOS.osmBuoys ab, woraus buoy3d.js dieselbe
 *      3D-Szene baut wie fuer die ELWIS-Marken (gleiche S-57-Vokabel:
 *      _cls / COLOUR / TOPSHP / CATCAM → describe()).
 *
 * Gefuettert wird bei jeder groesseren Kartenbewegung (moveend, entprellt),
 * mit Seq-Guard gegen ueberholte Antworten und "wenig bewegt"-Kurzschluss wie
 * bei den Infrastruktur-POIs.
 */

const SRC = 'osm-buoys';
const LAYER = 'osm-buoys-circle';

let _map = null;
let _enabled = true;
let _bound = false;
let _fetchTimer = null;
let _reqSeq = 0;
let _lastCenter = null, _lastZoom = null;

function _api() {
    return (window.BoatOS && window.BoatOS.getApiUrl) ? window.BoatOS.getApiUrl() : '';
}

// S-57 COLOUR-Code → Anzeigefarbe des 2D-Kreises (Primaerfarbe = erster Code).
const S57_HEX = {
    '1': '#f0f0f0', '2': '#1c1c1c', '3': '#d10000', '4': '#009a3c',
    '5': '#1b4f9c', '6': '#f2c200', '7': '#8a8a8a', '9': '#f0a000', '11': '#e57000',
};

function _primaryHex(colour) {
    const first = String(colour == null ? '' : colour).split(',')[0].trim();
    return S57_HEX[first] || '#8a8a8a';
}

/**
 * Source + 2D-Kreis-Layer anlegen (idempotent; nach jedem Style-Wechsel erneut
 * aufrufen — Muster wie addIENCLayers/addOpenSeaMapOverlays). Registriert den
 * moveend-Fetch EINMAL und stoesst einen ersten Abruf an.
 */
export function addSeamarkBuoys(map) {
    _map = map;
    if (!map) return;
    if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    }
    if (!map.getLayer(LAYER)) {
        map.addLayer({
            id: LAYER, type: 'circle', source: SRC,
            layout: { visibility: _enabled ? 'visible' : 'none' },
            paint: {
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 2.5, 14, 4.5, 17, 7],
                'circle-color': ['get', 'color'],
                'circle-stroke-width': 1,
                'circle-stroke-color': 'rgba(0,0,0,0.4)',
            },
        });
    }
    if (!_bound) {
        map.on('moveend', _debouncedFetch);
        _bound = true;
    }
    fetchNow(true);
}

// Gedrosselt, NICHT entprellt: im Follow-/Sim-Modus feuert 'moveend' quasi
// ununterbrochen. Ein reiner Debounce würde dabei nie feuern (Timer wird stets
// zurückgesetzt) → die Tonnen würden während der Fahrt nicht nachgeladen und
// verschwänden, sobald das Boot aus dem geladenen Bereich läuft. Der Throttle
// feuert höchstens alle FETCH_MIN_MS, aber auch WÄHREND der Bewegung; der
// „wenig bewegt"-Kurzschluss in fetchNow verhindert unnötige Abrufe.
const FETCH_MIN_MS = 1200;
let _lastFetchTs = 0;
function _debouncedFetch() {
    const now = performance.now();
    const since = now - _lastFetchTs;
    clearTimeout(_fetchTimer);
    _fetchTimer = null;
    if (since >= FETCH_MIN_MS) {
        _lastFetchTs = now;
        fetchNow(false);
    } else {
        _fetchTimer = setTimeout(() => {
            _fetchTimer = null;
            _lastFetchTs = performance.now();
            fetchNow(false);
        }, FETCH_MIN_MS - since);
    }
}

/** bbox der aktuellen Ansicht holen und Darstellung + 3D-Speisung aktualisieren. */
export async function fetchNow(force) {
    if (!_map || !_enabled) return;
    const b = _map.getBounds(), c = _map.getCenter(), z = _map.getZoom();

    // Wenig bewegt und gleicher Zoom → Bestand stehen lassen (kein Refetch).
    if (!force && _lastCenter && Math.abs(z - _lastZoom) < 0.5) {
        const spanLon = b.getEast() - b.getWest();
        const spanLat = b.getNorth() - b.getSouth();
        if (Math.abs(c.lng - _lastCenter.lng) < spanLon * 0.35 &&
            Math.abs(c.lat - _lastCenter.lat) < spanLat * 0.35) return;
    }

    const mySeq = ++_reqSeq;
    try {
        // Vorlauf-Rand: die bbox um MARGIN je Seite vergroessern, damit Tonnen
        // schon geladen sind, bevor das Boot sie erreicht — sonst „poppen" sie
        // bei schneller Fahrt/×10-Simulation erst am Bildrand auf.
        const MARGIN = 0.6;
        const mLat = (b.getNorth() - b.getSouth()) * MARGIN;
        const mLon = (b.getEast() - b.getWest()) * MARGIN;
        let latMin = b.getSouth() - mLat, latMax = b.getNorth() + mLat;
        let lonMin = b.getWest() - mLon, lonMax = b.getEast() + mLon;
        // WICHTIG: in der 3D-Look-ahead-Ansicht reicht getBounds bis zum Horizont
        // → die Antwort kann >3000 Marken haben. Die 3D-Szene deckelt aber bei
        // MAX_BUOYS und verwirft dann (in Array-Reihenfolge) teils genau die
        // lokalen Fahrwassertonnen → sie „fehlen" in 3D. Darum die Spanne um den
        // Kartenmittelpunkt auf MAX_SPAN deckeln (mehr sieht man eh nicht sinnvoll)
        // — haelt die Anzahl unter dem Limit UND entlastet den Pi (kleinere Antwort).
        const MAX_SPAN = 0.32;   // ~35 km
        if (latMax - latMin > MAX_SPAN) { latMin = c.lat - MAX_SPAN / 2; latMax = c.lat + MAX_SPAN / 2; }
        if (lonMax - lonMin > MAX_SPAN) { lonMin = c.lng - MAX_SPAN / 2; lonMax = c.lng + MAX_SPAN / 2; }
        const p = new URLSearchParams({
            lat_min: latMin, lon_min: lonMin, lat_max: latMax, lon_max: lonMax,
        });
        const r = await fetch(`${_api()}/api/seamarks/buoys?${p}`);
        if (!r.ok) return;
        const d = await r.json();
        if (mySeq !== _reqSeq) return;   // ueberholte Antwort verwerfen
        _lastCenter = { lng: c.lng, lat: c.lat };
        _lastZoom = z;
        _apply(d.buoys || []);
    } catch (_) {
        // offline → aktuellen Bestand behalten, nicht leeren
    }
}

function _apply(buoys) {
    const arr = [];      // schlanke 3D-Speisung Tonnen/Baken: {lng, lat, props}
    const signs = [];    // 3D-Speisung CEVNI-Schilder: {lng, lat, fnctnm, orient, cat}
    const feats = [];    // 2D-GeoJSON (nur Tonnen/Baken als Kreise)
    for (const b of buoys) {
        if (typeof b.lat !== 'number' || typeof b.lon !== 'number') continue;
        if (b.kind === 'sign') {
            signs.push({ lng: b.lon, lat: b.lat, fnctnm: b.fnctnm, orient: b.orient, cat: b.cat });
            continue;
        }
        // Dieselbe S-57-Vokabel, die describe() (buoy3d.js) versteht.
        const props = {
            _cls: b.cls,
            COLOUR: b.colour || '',
            TOPSHP: (b.topshp == null ? '' : b.topshp),
            CATCAM: (b.catcam || ''),
        };
        arr.push({ lng: b.lon, lat: b.lat, props });
        feats.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [b.lon, b.lat] },
            properties: { cls: b.cls, color: _primaryHex(b.colour), name: b.name || '' },
        });
    }
    window.BoatOS = window.BoatOS || {};
    window.BoatOS.osmBuoys = arr;
    window.BoatOS.osmSigns = signs;

    const src = _map && _map.getSource(SRC);
    if (src) src.setData({ type: 'FeatureCollection', features: feats });

    // 3D-Szene neu abgleichen, wenn der Look-ahead-Modus aktiv ist.
    if (window.BoatOS3D && window.BoatOS3D.isActive && window.BoatOS3D.isActive()) {
        window.BoatOS3D.refresh();
    }
}

/** 2D-Kreise ein-/ausblenden (die 3D-Speisung folgt: aus → leert osmBuoys). */
export function setSeamarkBuoysEnabled(on) {
    _enabled = !!on;
    if (_map && _map.getLayer(LAYER)) {
        _map.setLayoutProperty(LAYER, 'visibility', on ? 'visible' : 'none');
    }
    if (on) {
        fetchNow(true);
    } else {
        if (window.BoatOS) { window.BoatOS.osmBuoys = []; window.BoatOS.osmSigns = []; }
        if (window.BoatOS3D && window.BoatOS3D.isActive && window.BoatOS3D.isActive()) {
            window.BoatOS3D.refresh();
        }
    }
}
