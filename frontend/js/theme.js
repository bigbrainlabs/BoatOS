/**
 * BoatOS Theme Modul
 * Hell / Dunkel / Nacht (Rotlicht) — Verwaltung
 *
 * Nacht-Modus: rotes Monochrom auf Schwarz, erhält die Nachtsichtfähigkeit
 * (blaues/grünes Licht zerstört die Dunkeladaption der Augen).
 * Technisch baut Nacht auf dem Dark-Theme auf: es wird ZUSÄTZLICH zu
 * data-theme="dark" die Klasse .night am <html> gesetzt. Dadurch greifen alle
 * bestehenden [data-theme="dark"]-Regeln weiter, und :root.night überschreibt
 * nur noch die Farbvariablen (+ Rot-Filter über den Karten-Canvas).
 */

// ===========================================
// Theme State
// ===========================================
const THEMES = ['light', 'dark', 'night'];
let currentTheme = 'light';

// ===========================================
// Theme Initialisierung
// ===========================================

/**
 * Theme beim Laden initialisieren
 * Prüft gespeicherte Einstellung oder System-Präferenz
 */
export function initTheme() {
    const savedTheme = localStorage.getItem('boatos-theme');

    if (THEMES.includes(savedTheme)) {
        currentTheme = savedTheme;
    } else {
        // System-Präferenz prüfen
        currentTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    applyTheme();

    // System-Änderungen überwachen (nur solange nichts explizit gewählt wurde)
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('boatos-theme')) {
            currentTheme = e.matches ? 'dark' : 'light';
            applyTheme();
        }
    });

    console.log(`Theme initialisiert: ${currentTheme}`);
}

// ===========================================
// Theme Funktionen
// ===========================================

/**
 * Theme durchschalten: hell → dunkel → nacht → hell
 * @returns {string} das nun aktive Theme
 */
export function toggleTheme() {
    const idx = THEMES.indexOf(currentTheme);
    currentTheme = THEMES[(idx + 1) % THEMES.length];
    applyTheme();
    saveTheme();
    return currentTheme;
}

/**
 * Theme explizit setzen
 * @param {string} theme - 'light' | 'dark' | 'night'
 */
export function setTheme(theme) {
    if (!THEMES.includes(theme)) return;
    currentTheme = theme;
    applyTheme();
    saveTheme();
}

/**
 * Theme anwenden
 */
function applyTheme() {
    const root = document.documentElement;

    // Nacht nutzt das Dark-Theme als Basis (alle Dark-Regeln bleiben gültig)
    if (currentTheme === 'light') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', 'dark');
    }
    root.classList.toggle('night', currentTheme === 'night');

    updateThemeButton();

    window.dispatchEvent(new CustomEvent('themechange', {
        detail: { theme: currentTheme, isDark: currentTheme !== 'light' }
    }));
}

/**
 * Theme-Button Icon aktualisieren (zeigt, was als NÄCHSTES kommt)
 */
function updateThemeButton() {
    const themeBtn = document.getElementById('themeToggle');
    if (!themeBtn) return;
    const next = {
        light: { icon: '🌙', title: 'Dunkel-Modus' },
        dark:  { icon: '🔴', title: 'Nacht-Modus (Rotlicht)' },
        night: { icon: '☀️', title: 'Hell-Modus' },
    }[currentTheme];
    themeBtn.textContent = next.icon;
    themeBtn.title = next.title;
}

/**
 * Theme speichern
 */
function saveTheme() {
    localStorage.setItem('boatos-theme', currentTheme);
}

/**
 * Dark Mode explizit setzen (Rückwärtskompatibilität für den Settings-Toggle)
 * @param {boolean} dark - true für Dark Mode
 */
export function setDarkMode(dark) {
    setTheme(dark ? 'dark' : 'light');
}

/**
 * Prüfen ob ein dunkles Theme aktiv ist (dunkel ODER nacht)
 * @returns {boolean}
 */
export function isDark() {
    return currentTheme !== 'light';
}

/**
 * Aktives Theme
 * @returns {string} 'light' | 'dark' | 'night'
 */
export function getTheme() {
    return currentTheme;
}

/**
 * Prüfen ob Nacht-Modus aktiv
 * @returns {boolean}
 */
export function isNight() {
    return currentTheme === 'night';
}

// ===========================================
// MapLibre Theme Integration
// ===========================================

/**
 * Gibt den passenden Map-Style für das aktuelle Theme zurück
 * @returns {string} URL zum Map Style
 */
export function getMapStyle() {
    // OpenFreeMap Styles (Nacht nutzt den Dark-Style + Rot-Filter per CSS)
    if (isDark()) {
        return 'https://tiles.openfreemap.org/styles/dark';
    }
    return 'https://tiles.openfreemap.org/styles/positron';
}

/**
 * Map-Farben für das aktuelle Theme
 * @returns {object} Farbobjekt
 */
export function getMapColors() {
    if (isDark()) {
        return {
            track: '#67e8f9',
            route: '#22d3ee',
            routeOutline: '#0c1929',
            water: '#1e4976',
            waypoint: '#22d3ee',
            waypointOutline: '#0c1929'
        };
    }
    return {
        track: '#22d3ee',
        route: '#0891b2',
        routeOutline: '#ffffff',
        water: '#80b0d0',
        waypoint: '#0891b2',
        waypointOutline: '#ffffff'
    };
}

// ===========================================
// Export State Getter
// ===========================================
export function getThemeState() {
    return {
        isDarkMode: currentTheme !== 'light',
        isNight: currentTheme === 'night',
        theme: currentTheme
    };
}
