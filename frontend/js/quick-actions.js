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

function _computeHalf() {
    return (window.innerWidth || 800) < 560 ? 1 : 2;   // schmal 3, breit 5
}

function _spacing() {
    const w = (_els[0] && _els[0].offsetWidth) || 64;
    return w * 0.92;
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
        const scale = 1 - ad * 0.16;
        const opacity = 1 - ad * 0.32;
        const ry = -d * 16;                     // Arc-Rotation
        const tz = -ad * 38;                    // nach hinten in die Tiefe
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
    const outerScale = Math.max(0.4, 1 - _half * 0.16);
    const edge = _half * spacing + (w * outerScale) / 2 + 6;
    const arrowW = _arrowL.offsetWidth || 30;
    _arrowL.style.left = `calc(50% - ${edge + arrowW}px)`;
    _arrowR.style.left = `calc(50% + ${edge}px)`;
}

export function initQuickActionsCarousel() {
    const wrap = document.querySelector('.quick-actions-wrap');
    const strip = document.querySelector('.quick-actions');
    if (!wrap || !strip) return;
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
