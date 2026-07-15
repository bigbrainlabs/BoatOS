/**
 * BoatOS Gezeiten (MVP)
 * =====================
 * Zeigt die gemessene Tidenkurve der nächsten Pegelstation (aus /api/tides,
 * gespeist von PegelOnline). An der Küste ist das eine echte Tide; im Binnen-
 * land nur der Flusspegel. Bewusst simpel — harmonische Vorhersage kommt später.
 */

import * as ui from './ui.js';

// Fallback, wenn die Karte (noch) keine Mitte liefert: eine bekannte Tide-
// Station (Cuxhaven), damit man die Funktion überhaupt sieht.
const FALLBACK = { lat: 53.87, lon: 8.72 };

// BEWUSST der KARTENMITTE folgend, nicht dem GPS: so zeigt man einfach die
// Küste an, die man gerade betrachtet, und bekommt dort die Tide — unabhängig
// davon, wo das Boot steht.
function _pos() {
    try {
        const map = window.BoatOS?.map?.getMap?.();
        if (map) {
            const c = map.getCenter();
            if (c && isFinite(c.lat) && isFinite(c.lng)) return { lat: c.lat, lon: c.lng };
        }
    } catch (_) {}
    return FALLBACK;
}

function _apiUrl() {
    return window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
}

/** Rondell-Aktion: Panel öffnen und laden. */
export function open(el) {
    ui.showSection('tides', el);
    fetchAndRender();
}

export async function fetchAndRender() {
    const body = document.getElementById('tides-body');
    if (!body) return;
    body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim);">Gezeiten werden geladen…</div>';

    const { lat, lon } = _pos();
    try {
        const res = await fetch(`${_apiUrl()}/api/tides?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`);
        const d = await res.json();
        if (!d || !d.available) {
            body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-dim);">${d?.reason || 'Keine Gezeitendaten'}${d?.station ? ' — ' + d.station : ''}</div>`;
            return;
        }
        body.innerHTML = _render(d);
    } catch (e) {
        body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">Fehler beim Laden.</div>';
    }
}

function _fmtTime(iso) {
    if (!iso) return '--:--';
    try { return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }); }
    catch (_) { return '--:--'; }
}

function _render(d) {
    const trend = {
        rising:  { txt: 'steigend · Flut', arrow: '▲', color: '#3fb950' },
        falling: { txt: 'fallend · Ebbe',  arrow: '▼', color: '#e3b341' },
        slack:   { txt: 'Stillwasser',     arrow: '■', color: 'var(--text-dim)' },
    }[d.trend] || { txt: d.trend, arrow: '', color: 'var(--text)' };

    const range = (d.last_high.m - d.last_low.m).toFixed(2);

    return `
        <div style="padding:4px 2px;">
            <div style="font-weight:700;font-size:1rem;color:var(--accent);">🌊 ${d.station}</div>
            <div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:12px;">${d.water || ''} · Pegel (gemessen)</div>

            <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:2px;">
                <div style="font-size:2rem;font-weight:700;font-variant-numeric:tabular-nums;">${d.current_m.toFixed(2)} m</div>
                <div style="color:${trend.color};font-weight:600;">${trend.arrow} ${trend.txt}</div>
            </div>
            <div style="font-size:0.75rem;color:var(--text-dim);margin-bottom:12px;">Stand ${_fmtTime(d.current_t)} · Tidenhub ${range} m</div>

            ${_sparkline(d)}

            <div style="display:flex;gap:14px;margin-top:12px;font-size:0.85rem;">
                <div style="flex:1;background:var(--bg-card);border-radius:8px;padding:8px 10px;">
                    <div style="color:var(--text-dim);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;">letztes Hochwasser</div>
                    <div style="font-weight:600;">${d.last_high.m.toFixed(2)} m · ${_fmtTime(d.last_high.t)}</div>
                </div>
                <div style="flex:1;background:var(--bg-card);border-radius:8px;padding:8px 10px;">
                    <div style="color:var(--text-dim);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.05em;">letztes Niedrigwasser</div>
                    <div style="font-weight:600;">${d.last_low.m.toFixed(2)} m · ${_fmtTime(d.last_low.t)}</div>
                </div>
            </div>
            <div style="font-size:0.7rem;color:var(--text-dim);margin-top:10px;">
                MVP: gemessene Kurve der letzten ~30 h. Vorhersage von Hoch-/Niedrigwasser folgt.
            </div>
        </div>`;
}

/** Kleine SVG-Sparkline der Kurve mit markiertem aktuellem Punkt. */
function _sparkline(d) {
    const pts = d.curve || [];
    if (pts.length < 2) return '';
    const W = 100, H = 34;               // viewBox-Einheiten (skaliert per CSS)
    const ms = pts.map(p => p.m);
    const min = Math.min(...ms), max = Math.max(...ms);
    const span = (max - min) || 1;
    const x = (i) => (i / (pts.length - 1)) * W;
    const y = (m) => H - ((m - min) / span) * (H - 4) - 2;
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.m).toFixed(1)}`).join(' ');
    const lastX = x(pts.length - 1), lastY = y(pts[pts.length - 1].m);
    const fill = `${path} L${W},${H} L0,${H} Z`;

    return `
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
             style="width:100%;height:70px;display:block;background:var(--bg-card);border-radius:8px;">
            <path d="${fill}" fill="var(--accent)" opacity="0.14"/>
            <path d="${path}" fill="none" stroke="var(--accent)" stroke-width="0.8" vector-effect="non-scaling-stroke"/>
            <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="1.8" fill="var(--accent)"/>
        </svg>`;
}
