/**
 * BoatOS Theme Modul
 * Light/Dark Mode Verwaltung
 */

// ===========================================
// Theme State
// ===========================================
let isDarkMode = false;

// ===========================================
// Theme Initialisierung
// ===========================================

/**
 * Theme beim Laden initialisieren
 * Prüft gespeicherte Einstellung oder System-Präferenz
 */
export function initTheme() {
    // Gespeicherte Einstellung laden
    const savedTheme = localStorage.getItem('boatos-theme');

    if (savedTheme) {
        isDarkMode = savedTheme === 'dark';
    } else {
        // System-Präferenz prüfen
        isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    applyTheme();

    // System-Änderungen überwachen
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('boatos-theme')) {
            isDarkMode = e.matches;
            applyTheme();
        }
    });

    console.log(`Theme initialisiert: ${isDarkMode ? 'Dark' : 'Light'} Mode`);
}

// ===========================================
// Theme Funktionen
// ===========================================

/**
 * Theme wechseln (Toggle)
 */
export function toggleTheme() {
    isDarkMode = !isDarkMode;
    applyTheme();
    saveTheme();
    return isDarkMode;
}

/**
 * Theme anwenden
 */
function applyTheme() {
    if (isDarkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }

    // Theme-Button aktualisieren
    updateThemeButton();

    // Custom Event feuern
    window.dispatchEvent(new CustomEvent('themechange', {
        detail: { isDark: isDarkMode }
    }));
}

/**
 * Theme-Button Icon aktualisieren
 */
function updateThemeButton() {
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.textContent = isDarkMode ? '☀️' : '🌙';
        themeBtn.title = isDarkMode ? 'Light Mode' : 'Dark Mode';
    }
}

/**
 * Theme speichern
 */
function saveTheme() {
    localStorage.setItem('boatos-theme', isDarkMode ? 'dark' : 'light');
}

/**
 * Dark Mode explizit setzen
 * @param {boolean} dark - true für Dark Mode
 */
export function setDarkMode(dark) {
    isDarkMode = dark;
    applyTheme();
    saveTheme();
}

/**
 * Prüfen ob Dark Mode aktiv
 * @returns {boolean}
 */
export function isDark() {
    return isDarkMode;
}

// ===========================================
// MapLibre Theme Integration
// ===========================================

/**
 * Gibt den passenden Map-Style für das aktuelle Theme zurück
 * @returns {string} URL zum Map Style
 */
export function getMapStyle() {
    // OpenFreeMap Styles
    if (isDarkMode) {
        return 'https://tiles.openfreemap.org/styles/dark';
    }
    return 'https://tiles.openfreemap.org/styles/positron';
}

/**
 * Map-Farben für das aktuelle Theme
 * @returns {object} Farbobjekt
 */
export function getMapColors() {
    if (isDarkMode) {
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
        isDarkMode,
        theme: isDarkMode ? 'dark' : 'light'
    };
}
