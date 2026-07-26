/**
 * Quick-Action-Karussell (Coverflow-Arc)
 *
 * Positioniert die bestehenden .quick-action-Elemente per CSS-Transform in
 * einen zirkulären Arc: das zentrale Element ist prominent, die seitlichen
 * werden kleiner, transparenter und leicht nach hinten gekippt ("Kreis nach
 * hinten"). Navigation über ‹ ›-Pfeile und Swipe.
 *
 * Bewusst werden die vorhandenen DOM-Elemente NUR umpositioniert (nicht neu
 * gerendert) — so bleiben inline-onclick-Handler und Aktiv-Zustände
 * (.active auf btn-ais/btn-locks/btn-pegel/btn-satellite …) unangetastet.
 */

let _els = [];
let _offset = 0;
let _half = 2;          // sichtbare Elemente je Seite (2 → 5 sichtbar)
let _swipeMoved = false;
let _arrowL = null;
let _arrowR = null;
let _strip = null;      // Karussell-Container (.quick-actions) — gibt die nutzbare Breite vor
const GAP_LOOSE = 0.92;   // Wunschabstand zwischen zwei Kacheln (× Kachelbreite)
const GAP_TIGHT = 0.78;   // engster erlaubter Abstand, bevor eine Position wegfaellt
const MAX_HALF  = 3;      // hoechstens 7 sichtbar (nur in der breiten Darstellung)

let _gapFactor = GAP_LOOSE;   // aktueller Abstandsfaktor (siehe _computeHalf)

/** Skalierung des Elements an Position |d| (muss zu _layout passen). */
function _scaleAt(ad) {
    return Math.max(0.4, 1 - ad * 0.16);
}

/**
 * Wie viele Elemente passen je Seite neben das mittlere?
 *
 * Frueher ein fester Breakpoint (<560 px → 1, sonst 2). Das verschenkte Platz:
 * Auf dem Handy standen 3 Elemente in der Mitte, links und rechts blieb die
 * halbe Zeile leer. Jetzt aus der TATSAECHLICH verfuegbaren Breite gerechnet —
 * abzueglich der beiden Pfeile — sodass die Zeile immer voll genutzt wird.
 *
 * Zwei Korrekturen gegenueber der ersten Fassung, damit 7 Elemente frueher
 * greifen statt erst auf sehr breiten Fenstern:
 *  - Die aeusseren Kacheln sind HERUNTERSKALIERT (_scaleAt). Vorher wurde fuer
 *    jede Position die volle Kachelbreite reserviert — der Arc galt als zu
 *    breit und fiel unnoetig auf 5 zurueck.
 *  - Reicht es knapp nicht, wird erst der Abstand bis GAP_TIGHT gestrafft,
 *    bevor eine Position aufgegeben wird. Enger zusammenruecken sieht besser
 *    aus als eine halb leere Zeile.
 */
function _computeHalf() {
    const w = (_els[0] && _els[0].offsetWidth) || 58;
    const arrows = 2 * ((_arrowL && _arrowL.offsetWidth) || 30) + 24;   // + Luft
    // Breite des KARUSSELLS, nicht des Fensters: links und rechts sind Spalten
    // fuer Karten-Tasten und FABs reserviert (siehe rondell.css). Mit der
    // Fensterbreite gerechnet wuerde das Rondell in diese Spalten hineinwachsen.
    const box = (_strip && _strip.clientWidth) || (window.innerWidth || 800);
    // Unterhalb des CSS-Breakpoints (schmale, vertikale Kacheln) bleibt es bei
    // der bisherigen Rechnung — die Handy-/Tablet-Ansicht soll sich NICHT
    // aendern. Die genauere Formel unten greift nur in der breiten Darstellung.
    if ((window.innerWidth || 800) < 768) {
        _gapFactor = GAP_LOOSE;
        const half = Math.floor((box - arrows - w) / (2 * w * GAP_LOOSE));
        return Math.max(1, Math.min(MAX_HALF, half));
    }

    const halfAvail = (box - arrows) / 2;
    for (let half = MAX_HALF; half > 1; half--) {
        // halfAvail >= half * (w * gap) + (w * scale(half)) / 2   → nach gap aufloesen
        const gap = (halfAvail - (w * _scaleAt(half)) / 2) / (half * w);
        if (gap >= GAP_TIGHT) {
            _gapFactor = Math.min(GAP_LOOSE, gap);
            return half;
        }
    }
    _gapFactor = GAP_LOOSE;
    return 1;
}

function _spacing() {
    const w = (_els[0] && _els[0].offsetWidth) || 64;
    return w * _gapFactor;
}

export function rotateQuickActions(dir) {
    const n = _els.length;
    if (!n) return;
    _offset = ((_offset + dir) % n + n) % n;
    _layout();
}

function _layout() {
    const n = _els.length;
    if (!n) return;
    const spacing = _spacing();
    _els.forEach((el, i) => {
        let d = ((i - _offset) % n + n) % n;   // 0..n-1
        if (d > n / 2) d -= n;                  // → vorzeichenbehaftete zirkuläre Distanz
        const ad = Math.abs(d);
        if (ad > _half) {                       // außerhalb des Fensters → versteckt
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
            el.style.zIndex = '0';
            el.style.transform =
                `translate(-50%,-50%) translateX(${Math.sign(d) * spacing * (_half + 1)}px) scale(0.35)`;
            el.setAttribute('aria-hidden', 'true');
            el.classList.remove('qa-center');
            return;
        }
        const x = d * spacing;
        const scale = _scaleAt(ad);
        // Fade/Tiefe werden GESTRECKT, sobald mehr als 5 sichtbar sind: mit dem
        // festen Schritt 0.32 laege das aeusserste Element bei 7 Sichtbaren
        // (ad=3) auf Deckkraft 0.04 — praktisch unsichtbar. So endet der Arc
        // immer bei ~0.36, und bei _half 1/2 rechnet es exakt wie vorher.
        const k = Math.max(2, _half);
        const opacity = 1 - ad * (0.64 / k);
        const ry = -d * (32 / k);               // Arc-Rotation
        const tz = -ad * (76 / k);              // nach hinten in die Tiefe
        el.style.opacity = String(opacity);
        el.style.pointerEvents = 'auto';
        el.style.zIndex = String(100 - ad);
        el.style.transform =
            `translate(-50%,-50%) translateX(${x}px) translateZ(${tz}px) rotateY(${ry}deg) scale(${scale})`;
        el.classList.toggle('qa-center', d === 0);
        el.removeAttribute('aria-hidden');
    });
    _positionArrows(spacing);
}

/**
 * Rückt die Pfeile direkt an den äußeren Rand des sichtbaren Arcs.
 * edge = Mitte→Außenkante des äußersten sichtbaren Elements (skaliert) + Lücke.
 */
function _positionArrows(spacing) {
    if (!_arrowL || !_arrowR) return;
    const w = (_els[0] && _els[0].offsetWidth) || 58;
    const outerScale = _scaleAt(_half);
    const edge = _half * spacing + (w * outerScale) / 2 + 6;
    const arrowW = _arrowL.offsetWidth || 30;
    _arrowL.style.left = `calc(50% - ${edge + arrowW}px)`;
    _arrowR.style.left = `calc(50% + ${edge}px)`;
}

export function initQuickActionsCarousel() {
    const wrap = document.querySelector('.quick-actions-wrap');
    const strip = document.querySelector('.quick-actions');
    if (!wrap || !strip) return;
    _strip = strip;
    _els = Array.from(strip.querySelectorAll('.quick-action'));
    if (!_els.length) return;

    wrap.classList.add('qa-carousel');

    // Pfeile
    const mkArrow = (cls, sym, dir) => {
        const b = document.createElement('button');
        b.className = 'qa-arrow ' + cls;
        b.type = 'button';
        b.textContent = sym;
        b.setAttribute('aria-label', dir < 0 ? 'zurück' : 'weiter');
        b.addEventListener('click', () => rotateQuickActions(dir));
        return b;
    };
    _arrowL = mkArrow('qa-arrow-left', '‹', -1);
    _arrowR = mkArrow('qa-arrow-right', '›', 1);
    wrap.appendChild(_arrowL);
    wrap.appendChild(_arrowR);

    // Swipe (Pointer-Drag). Pointer-Capture ist auf Touch entscheidend: ohne
    // sie stiehlt der mobile Browser die horizontale Geste (pointercancel) und
    // pointermove/-up kommen nicht mehr an → Sliden ginge nicht.
    let startX = null;
    let captured = false;
    strip.addEventListener('pointerdown', (e) => {
        startX = e.clientX;
        _swipeMoved = false;
        captured = false;
        // WICHTIG: hier NICHT capturen — sonst landet das click-Event auf der
        // Swipe-Fläche statt auf dem Button und der onclick feuert nie.
    });
    strip.addEventListener('pointermove', (e) => {
        if (startX == null) return;
        if (Math.abs(e.clientX - startX) > 8) {
            _swipeMoved = true;
            // Erst jetzt (echter Swipe) capturen, damit die Geste nicht abbricht.
            if (!captured) { try { strip.setPointerCapture(e.pointerId); captured = true; } catch (_) {} }
        }
    });
    const endSwipe = (e) => {
        if (startX == null) return;
        const dx = (e.clientX ?? startX) - startX;
        startX = null;
        if (captured) { try { strip.releasePointerCapture(e.pointerId); } catch (_) {} captured = false; }
        if (Math.abs(dx) > 40) rotateQuickActions(dx < 0 ? 1 : -1);
    };
    strip.addEventListener('pointerup', endSwipe);
    strip.addEventListener('pointercancel', endSwipe);
    // Klick nach echtem Swipe unterdrücken (sonst löst der Button-onclick aus)
    strip.addEventListener('click', (e) => {
        if (_swipeMoved) { e.stopPropagation(); e.preventDefault(); _swipeMoved = false; }
    }, true);

    let _rt = null;
    window.addEventListener('resize', () => {
        clearTimeout(_rt);
        _rt = setTimeout(() => { _half = _computeHalf(); _layout(); }, 150);
    });

    _half = _computeHalf();
    // Zwei Frames warten, damit Layout/offsetWidth steht
    requestAnimationFrame(() => requestAnimationFrame(_layout));
}
