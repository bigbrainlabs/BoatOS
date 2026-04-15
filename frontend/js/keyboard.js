/**
 * BoatOS On-Screen Keyboard
 * Erscheint automatisch wenn ein Input-Feld fokussiert wird.
 * Numpad für number-Inputs, QWERTY + Sonderzeichen für Text/Passwort.
 */

let _activeInput = null;
let _kbEl = null;
let _shifted = false;
let _pressing = false;  // true while a keyboard key is being pressed
let _layer = 'qwerty';  // 'qwerty' | 'sym'

// ==================== LAYOUT ====================

const NUMPAD_ROWS = [
    ['7','8','9'],
    ['4','5','6'],
    ['1','2','3'],
    ['.','0','⌫'],
];

const QWERTY_ROWS = [
    ['q','w','e','r','t','z','u','i','o','p'],
    ['a','s','d','f','g','h','j','k','l'],
    ['⇧','y','x','c','v','b','n','m','⌫'],
    ['#?','@','-','_','   ','.','/','⌤'],
];

const SYMBOLS_ROWS = [
    ['1','2','3','4','5','6','7','8','9','0'],
    ['!','@','#','$','%','^','&','*','(',')'],
    ['+','=','?','\\','|',';',"'",'`','⌫'],
    ['ABC','-','_',':','   ',',','.','⌤'],
];

// ==================== BUILD ====================

function buildKeyboard(isNumeric) {
    const kb = document.createElement('div');
    kb.id = 'osk-panel';
    kb.setAttribute('data-numeric', isNumeric ? '1' : '0');
    // Prevent any touch on the panel from bubbling up and causing blur
    kb.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    kb.addEventListener('mousedown',  e => e.preventDefault());
    kb.style.cssText = `
        position: fixed;
        bottom: 0; left: 0; right: 0;
        background: #0d1426;
        border-top: 1px solid #2a3550;
        padding: 8px 6px 10px;
        z-index: 99999;
        touch-action: none;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        gap: 5px;
    `;

    let rows;
    if (isNumeric) {
        rows = NUMPAD_ROWS;
    } else if (_layer === 'sym') {
        rows = SYMBOLS_ROWS;
    } else {
        rows = QWERTY_ROWS;
    }

    rows.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.style.cssText = 'display:flex;justify-content:center;gap:5px;';

        row.forEach(key => {
            const btn = document.createElement('button');
            const isSpace  = key.trim() === '';
            const isOK     = key === '⌤';
            const isABC    = key === 'ABC';
            const isSym    = key === '#?';
            const isWide   = isOK || isABC || isSym || isSpace;

            btn.dataset.key = key;
            btn.textContent = isOK ? '✓ OK' : isSpace ? 'Space' : key;

            const bgColor = isOK ? '#0d9488'
                          : (key === '⌫' || key === '⇧') ? '#374151'
                          : (isABC || isSym) ? '#2a4060'
                          : '#1e2d4a';

            btn.style.cssText = `
                background: ${bgColor};
                color: ${isOK ? '#fff' : '#e2e8f0'};
                border: 1px solid ${isABC || isSym ? '#4a7090' : '#2a3550'};
                border-radius: 7px;
                font-size: ${isNumeric ? '22px' : isABC || isSym ? '14px' : '16px'};
                font-family: inherit;
                font-weight: ${isABC || isSym ? '600' : 'normal'};
                cursor: pointer;
                touch-action: manipulation;
                -webkit-tap-highlight-color: transparent;
                flex: ${isSpace ? '3' : isWide ? '1.8' : '1'};
                min-width: ${isNumeric ? '70px' : '28px'};
                height: ${isNumeric ? '58px' : '44px'};
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
                -webkit-user-select: none;
                padding: 0 4px;
            `;

            btn.tabIndex = -1;  // prevent button from receiving focus

            const onDown = e => {
                e.preventDefault();
                _pressing = true;   // set BEFORE focusout can fire
                btn.style.background = isOK ? '#0f766e' : '#2a3f60';
            };
            btn.addEventListener('mousedown',   onDown);
            btn.addEventListener('touchstart',  onDown, { passive: false });
            btn.addEventListener('pointerdown', onDown);

            const onUp = e => {
                e.preventDefault();
                e.stopPropagation();
                handleKey(key);
                if (_activeInput) _activeInput.focus();
                setTimeout(() => {
                    btn.style.background = bgColor;
                    _pressing = false;
                }, 150);
            };
            btn.addEventListener('touchend',  onUp, { passive: false });
            btn.addEventListener('pointerup', onUp);

            rowEl.appendChild(btn);
        });

        kb.appendChild(rowEl);
    });

    return kb;
}

// ==================== INPUT HANDLING ====================

function handleKey(key) {
    if (!_activeInput) return;

    if (key === '⌤') {
        _activeInput.blur();
        hide();
        return;
    }

    if (key === '#?') {
        _layer = 'sym';
        rebuildKeyboard();
        return;
    }

    if (key === 'ABC') {
        _layer = 'qwerty';
        rebuildKeyboard();
        return;
    }

    if (key === '⌫') {
        const s = _activeInput.selectionStart;
        const e = _activeInput.selectionEnd;
        if (s !== e) {
            insertText('');
        } else if (s > 0) {
            _activeInput.setSelectionRange(s - 1, s);
            insertText('');
        }
        _activeInput.dispatchEvent(new Event('input', { bubbles: true }));
        return;
    }

    if (key === '⇧') {
        _shifted = !_shifted;
        updateShift();
        return;
    }

    let char = key === '   ' ? ' ' : key;
    if (_shifted && char.length === 1 && char.match(/[a-z]/)) {
        char = char.toUpperCase();
        _shifted = false;
        updateShift();
    }

    insertText(char);
    _activeInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function insertText(text) {
    const el = _activeInput;
    if (!el) return;
    const s = el.selectionStart ?? el.value.length;
    const e = el.selectionEnd ?? el.value.length;
    el.value = el.value.slice(0, s) + text + el.value.slice(e);
    const pos = s + text.length;
    el.setSelectionRange(pos, pos);
}

function updateShift() {
    if (!_kbEl) return;
    _kbEl.querySelectorAll('button').forEach(btn => {
        const k = btn.dataset.key;
        if (k && k.length === 1 && k.match(/[a-z]/)) {
            btn.textContent = _shifted ? k.toUpperCase() : k;
        }
    });
    const shiftBtn = [...(_kbEl?.querySelectorAll('button') || [])].find(b => b.dataset.key === '⇧');
    if (shiftBtn) shiftBtn.style.background = _shifted ? '#0d9488' : '#374151';
}

function rebuildKeyboard() {
    if (!_activeInput) return;
    const isNumeric = _kbEl?.getAttribute('data-numeric') === '1';
    hide(false);
    _kbEl = buildKeyboard(isNumeric);
    document.body.appendChild(_kbEl);
}

// ==================== SHOW / HIDE ====================

function show(input) {
    const isNumeric = input.type === 'number';
    _activeInput = input;
    _shifted = false;
    _layer = 'qwerty';

    // Remove existing keyboard
    hide(false);

    _kbEl = buildKeyboard(isNumeric);
    document.body.appendChild(_kbEl);

    // Scroll settings panel so the input is visible above keyboard
    const kbHeight = isNumeric ? 280 : 250;
    scrollInputIntoView(input, kbHeight);
}

function hide(clearActive = true) {
    if (_kbEl) {
        _kbEl.remove();
        _kbEl = null;
    }
    if (clearActive) _activeInput = null;
}

function scrollInputIntoView(input, kbHeight) {
    const rect = input.getBoundingClientRect();
    const windowH = window.innerHeight;
    const visibleBottom = windowH - kbHeight - 16;
    if (rect.bottom > visibleBottom) {
        const scrollable = input.closest('.sidebar-content');
        if (scrollable) {
            const diff = rect.bottom - visibleBottom;
            scrollable.scrollTop += diff;
        }
    }
}

// ==================== INIT ====================

export function initKeyboard() {
    // Use capture phase so we catch focus before anything else
    document.addEventListener('focusin', e => {
        const el = e.target;
        if (el.tagName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox'
            && el.type !== 'radio' && el.type !== 'file' && !el.readOnly) {
            show(el);
        } else if (el.tagName === 'TEXTAREA') {
            show(el);
        }
    }, true);

    document.addEventListener('focusout', e => {
        // Don't hide while a keyboard key is being pressed
        if (_pressing) return;
        setTimeout(() => {
            if (_pressing) return;
            const active = document.activeElement;
            if (!active || (active.tagName !== 'INPUT' && active.tagName !== 'TEXTAREA')) {
                hide();
            }
        }, 200);
    }, true);
}
