/**
 * Wind-Overlay auf der Karte
 * ==========================
 * Zeichnet Wind-Pfeile als MapLibre-Symbol-Layer:
 *   - entlang der Route (Vorhersage zur jeweiligen ETA, aus /api/weather/route)
 *   - am Boot (aktueller Wind, aus /api/weather)
 *
 * Zwei Design-Entscheidungen, die man beim Lesen sonst falsch versteht:
 *
 * 1. PFEILRICHTUNG: `wind_deg` ist meteorologisch — die Richtung, aus der der
 *    Wind KOMMT. Der Pfeil zeigt, WOHIN er weht (deg + 180), wie auf gaengigen
 *    Wetterkarten. Das Popup nennt zusaetzlich die Herkunft ("aus 210°").
 *
 * 2. KEINE GLYPHS: Die Zahl neben dem Pfeil wird als Canvas-Bild erzeugt, nicht
 *    als text-field. Im Offline-Raster-Fallback-Style hat die Karte keine
 *    glyphs-URL (siehe ienc.js) — ein Text-Layer bliebe dort stumm leer. Bilder
 *    funktionieren immer.
 */

import { getMap } from './map.js';

const SRC = 'wind-overlay';
const LAYER_ARROWS = 'wind-overlay-arrows';
const LAYER_LABELS = 'wind-overlay-labels';
const LS_KEY = 'windOverlay';

// Schwellwerte identisch zum Route-Wetter-Panel (weather.js) — sonst zeigt die
// Liste gruen, was die Karte gelb malt.
const WIND_STEPS = [
    { max: 11,       color: '#3fb950' },   // bis 5 Bft
    { max: 22,       color: '#e3b341' },   // bis 6 Bft
    { max: Infinity, color: '#f85149' },   // Starkwind aufwaerts
];

let routePoints = [];      // [{lat,lon,wind_speed,wind_deg,gust,eta,km,temp,description}]
let currentWind = null;    // {lat,lon,wind_speed,wind_deg,gust}
let visible = localStorage.getItem(LS_KEY) === 'true';
let popup = null;

export function windColor(kn) {
    if (kn == null) return '#8b949e';
    return WIND_STEPS.find(s => kn < s.max).color;
}

function bucket(kn) {
    if (kn == null) return 0;
    return WIND_STEPS.findIndex(s => kn < s.max);
}

// ==================== ICONS (Canvas statt Glyphs) ====================

/** Pfeil nach Norden (Rotation 0), spitz, mit weisser Kontur fuer Kontrast. */
function arrowImage(color, boat) {
    const S = 64, c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    g.translate(S / 2, S / 2);

    // Boot-Pfeil bekommt einen Ring — "Wind JETZT" vs. "Wind spaeter"
    if (boat) {
        g.beginPath();
        g.arc(0, 0, 29, 0, Math.PI * 2);
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = color;
        g.stroke();
    }

    g.beginPath();
    g.moveTo(0, -26);           // Spitze
    g.lineTo(11, -4);
    g.lineTo(4, -4);
    g.lineTo(4, 24);            // Schaft
    g.lineTo(-4, 24);
    g.lineTo(-4, -4);
    g.lineTo(-11, -4);
    g.closePath();
    g.fillStyle = color;
    g.fill();
    g.lineWidth = 2.5;
    g.strokeStyle = boat ? '#ffffff' : 'rgba(255,255,255,0.9)';
    g.stroke();

    return g.getImageData(0, 0, S, S);
}

/** Zahl mit Halo als Bild — dreht sich NICHT mit dem Pfeil mit. */
function labelImage(text, color) {
    const W = 96, H = 40, c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.font = 'bold 26px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 5;
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.strokeText(text, W / 2, H / 2);
    g.fillStyle = color;
    g.fillText(text, W / 2, H / 2);
    return g.getImageData(0, 0, W, H);
}

function ensureIcons(map) {
    // Nach einem Style-Reload sind die Bilder weg → Existenz pruefen, nicht Flag.
    WIND_STEPS.forEach((s, i) => {
        const id = `wind-arrow-${i}`;
        if (!map.hasImage(id)) map.addImage(id, arrowImage(s.color, false));
        const idBoat = `wind-arrow-boat-${i}`;
        if (!map.hasImage(idBoat)) map.addImage(idBoat, arrowImage(s.color, true));
    });
}

/** Zahlen-Icons erst erzeugen, wenn der Wert bekannt ist (max. ~13 Stueck). */
function ensureLabelIcon(map, kn) {
    const val = Math.round(kn);
    const id = `wind-label-${val}`;
    if (!map.hasImage(id)) map.addImage(id, labelImage(String(val), windColor(kn)));
    return id;
}

// ==================== DATEN → GEOJSON ====================

function featureCollection(map) {
    const feats = [];

    const push = (p, isBoat) => {
        const kn = p.wind_speed;
        if (kn == null || p.wind_deg == null) return;
        if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
        feats.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
            properties: {
                kn,
                deg: p.wind_deg,
                // Pfeil zeigt, wohin der Wind weht — wind_deg ist die Herkunft
                rot: (p.wind_deg + 180) % 360,
                gust: p.gust ?? null,
                eta: p.eta || null,
                km: p.km ?? null,
                temp: p.temp ?? null,
                description: p.description || '',
                boat: isBoat ? 1 : 0,
                icon: (isBoat ? 'wind-arrow-boat-' : 'wind-arrow-') + bucket(kn),
                label: ensureLabelIcon(map, kn),
            },
        });
    };

    routePoints.forEach(p => push(p, false));
    if (currentWind) push(currentWind, true);

    return { type: 'FeatureCollection', features: feats };
}

// ==================== LAYER ====================

function draw() {
    const map = getMap();
    if (!map) return;

    // Beim Seitenstart ist der Style oft noch nicht fertig — addSource/addLayer
    // wuerde werfen. Einmal auf 'load' warten, statt still nichts zu zeichnen.
    if (!map.isStyleLoaded()) {
        map.once('load', () => draw());
        return;
    }

    if (!visible) {
        removeLayers(map);
        return;
    }

    ensureIcons(map);
    const data = featureCollection(map);

    if (!map.getSource(SRC)) {
        map.addSource(SRC, { type: 'geojson', data });
    } else {
        map.getSource(SRC).setData(data);
    }

    if (!map.getLayer(LAYER_ARROWS)) {
        map.addLayer({
            id: LAYER_ARROWS,
            type: 'symbol',
            source: SRC,
            layout: {
                'icon-image': ['get', 'icon'],
                'icon-rotate': ['get', 'rot'],
                // 'map': Pfeil bleibt geografisch ausgerichtet, auch wenn die Karte
                // in der head-up-/3D-Ansicht gedreht und gekippt ist.
                'icon-rotation-alignment': 'map',
                'icon-pitch-alignment': 'map',
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.32, 12, 0.5, 16, 0.72],
            },
        });
    }

    if (!map.getLayer(LAYER_LABELS)) {
        map.addLayer({
            id: LAYER_LABELS,
            type: 'symbol',
            source: SRC,
            layout: {
                'icon-image': ['get', 'label'],
                'icon-allow-overlap': true,
                'icon-ignore-placement': true,
                // Zahl neben den Pfeil, aufrecht (keine Rotation, kein Pitch)
                'icon-offset': [46, -30],
                'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.34, 12, 0.46, 16, 0.6],
            },
        });
    }

    bindPopup(map);
}

function removeLayers(map) {
    [LAYER_LABELS, LAYER_ARROWS].forEach(id => {
        if (map.getLayer(id)) map.removeLayer(id);
    });
    if (map.getSource(SRC)) map.removeSource(SRC);
    if (popup) { popup.remove(); popup = null; }
}

let popupBound = false;
function bindPopup(map) {
    if (popupBound) return;
    popupBound = true;

    map.on('click', LAYER_ARROWS, (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const p = f.properties;
        const fmtSpd = window.formatSpeed || ((k) => `${Math.round(k)} kn`);
        const when = p.boat == 1
            ? 'jetzt'
            : (p.eta ? new Date(p.eta).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' (ETA)' : '');
        const gust = p.gust ? ` · Böen ${fmtSpd(Number(p.gust), 0)}` : '';
        const temp = (p.temp != null && p.temp !== '')
            ? (typeof window.formatTemperature === 'function' ? window.formatTemperature(Number(p.temp)) : `${p.temp}°`)
            : '';

        popup?.remove();
        popup = new maplibregl.Popup({ offset: 18, closeButton: true })
            .setLngLat(f.geometry.coordinates)
            .setHTML(`
                <div style="font-family:sans-serif;font-size:0.82rem;line-height:1.5;color:#111;">
                    <div style="font-weight:700;margin-bottom:2px;">💨 ${fmtSpd(Number(p.kn), 0)}${gust}</div>
                    <div>aus ${Math.round(Number(p.deg))}°</div>
                    <div style="color:#555;">${when}${temp ? ' · ' + temp : ''}</div>
                    ${p.description ? `<div style="color:#555;">${p.description}</div>` : ''}
                </div>`)
            .addTo(map);
    });

    map.on('mouseenter', LAYER_ARROWS, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', LAYER_ARROWS, () => { map.getCanvas().style.cursor = ''; });
}

// ==================== ÖFFENTLICHE API ====================

/** Vorhersage-Punkte der Route (aus /api/weather/route). */
export function setRouteWind(points) {
    routePoints = Array.isArray(points) ? points.filter(p => p && p.wind_speed != null) : [];
    draw();
}

/** Aktueller Wind am Boot (aus /api/weather + aktueller Position). */
export function setCurrentWind(lat, lon, windSpeedKn, windDeg, gust = null) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || windSpeedKn == null || windDeg == null) {
        currentWind = null;
    } else {
        currentWind = { lat, lon, wind_speed: windSpeedKn, wind_deg: windDeg, gust };
    }
    draw();
}

export function isWindOverlayVisible() {
    return visible;
}

export function setWindOverlay(show) {
    visible = !!show;
    localStorage.setItem(LS_KEY, visible ? 'true' : 'false');
    draw();
    updateToggleButton();
    return visible;
}

export function toggleWindOverlay() {
    const on = setWindOverlay(!visible);
    // Beim Einschalten fehlende Daten nachziehen: aktuellen Wind sofort,
    // Route-Wind nur, wenn ueberhaupt eine Route existiert.
    if (on) window.BoatOS?.weather?.refreshWindOverlay?.();
    return on;
}

export function updateToggleButton() {
    const btn = document.getElementById('btn-wind-overlay');
    if (btn) btn.classList.toggle('active', visible);
}

/**
 * Nach einem Style-Wechsel (setStyle diff:false) sind Source, Layer UND die
 * addImage-Bilder weg — map.js ruft das hier aus dem style.load-Handler auf.
 */
export function redrawWindOverlay() {
    popupBound = false;   // Handler hingen am alten Style-Layer
    draw();
}

export function initWindOverlay() {
    updateToggleButton();
    if (visible) draw();
}
