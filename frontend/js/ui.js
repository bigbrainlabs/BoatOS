/**
 * BoatOS UI Modul
 * Verwaltet alle UI-Komponenten wie Modals, Panels, Toasts, Favoriten, Layer und Settings
 *
 * Dieses Modul extrahiert UI-spezifische Funktionalitäten aus app.js
 */

// ===========================================
// Konstanten und State
// ===========================================

// API URL - wird dynamisch basierend auf dem aktuellen Host ermittelt
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${protocol}://${window.location.hostname}`;

// Favoriten State
let favorites = [];
let favoritesPanel = null;
let favoriteMarkers = [];
let favoritesVisible = false;

// Panel IDs für hideAllPanels
const PANEL_IDS = [
    'crew-panel',
    'fuel-panel',
    'dashboard-panel',
    'gps-panel',
    'weather-panel',
    'settings-panel',
    'layer-panel'
];

// Layer-Konfiguration
const LAYER_CONFIG = {
    seamark: {
        id: 'seamark-overlay',
        name: 'Seezeichen (OpenSeaMap)',
        defaultVisible: true
    },
    inland: {
        id: 'inland-overlay',
        name: 'Binnenschifffahrt',
        defaultVisible: true
    },
    satellite: {
        id: 'satellite-layer',
        name: 'Satellitenansicht',
        defaultVisible: false
    },
    track: {
        id: 'track-line',
        name: 'Track-Historie',
        defaultVisible: true
    }
};

// Toast-Typen mit zugehörigen Farben
const TOAST_COLORS = {
    success: 'rgba(46, 204, 113, 0.95)',
    error: 'rgba(231, 76, 60, 0.95)',
    warning: 'rgba(241, 196, 15, 0.95)',
    info: 'rgba(52, 152, 219, 0.95)'
};

// ===========================================
// Modal/Panel Management
// ===========================================

/**
 * Öffnet ein Modal-Fenster
 * @param {string} modalId - ID des Modal-Elements
 * @param {object} options - Optionale Konfiguration (animation, onOpen callback)
 */
export function openModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn(`Modal mit ID '${modalId}' nicht gefunden`);
        return false;
    }

    // Alle anderen Modals schließen falls gewünscht
    if (options.closeOthers !== false) {
        document.querySelectorAll('.modal.active').forEach(m => {
            if (m.id !== modalId) {
                m.classList.remove('active');
                m.style.display = 'none';
            }
        });
    }

    // Modal anzeigen
    modal.style.display = 'block';
    modal.classList.add('active');

    // Animation falls gewünscht
    if (options.animation) {
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        requestAnimationFrame(() => {
            modal.style.transition = 'opacity 0.3s, transform 0.3s';
            modal.style.opacity = '1';
            modal.style.transform = 'scale(1)';
        });
    }

    // Callback ausführen
    if (typeof options.onOpen === 'function') {
        options.onOpen(modal);
    }

    // ESC-Taste zum Schließen
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal(modalId);
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    console.log(`Modal geöffnet: ${modalId}`);
    return true;
}

/**
 * Schließt ein Modal-Fenster
 * @param {string} modalId - ID des Modal-Elements
 * @param {object} options - Optionale Konfiguration (animation, onClose callback)
 */
export function closeModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn(`Modal mit ID '${modalId}' nicht gefunden`);
        return false;
    }

    // Animation falls gewünscht
    if (options.animation) {
        modal.style.transition = 'opacity 0.2s, transform 0.2s';
        modal.style.opacity = '0';
        modal.style.transform = 'scale(0.9)';
        setTimeout(() => {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }, 200);
    } else {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }

    // Callback ausführen
    if (typeof options.onClose === 'function') {
        options.onClose(modal);
    }

    console.log(`Modal geschlossen: ${modalId}`);
    return true;
}

/**
 * Schaltet ein Panel um (öffnen/schließen)
 * @param {string} panelId - ID des Panel-Elements
 * @param {boolean} closeOthers - Andere Panels schließen (default: true)
 * @returns {boolean} - Neuer Status (true = offen)
 */
export function togglePanel(panelId, closeOthers = true) {
    const panel = document.getElementById(panelId);
    if (!panel) {
        console.warn(`Panel mit ID '${panelId}' nicht gefunden`);
        return false;
    }

    // Aktuellen Status prüfen (berücksichtigt CSS display property)
    const currentDisplay = window.getComputedStyle(panel).display;
    const isHidden = currentDisplay === 'none';

    // Andere Panels schließen falls gewünscht
    if (closeOthers && isHidden) {
        hideAllPanels();
    }

    // Panel umschalten
    if (isHidden) {
        panel.style.display = 'block';
        console.log(`Panel geöffnet: ${panelId}`);
        return true;
    } else {
        panel.style.display = 'none';
        console.log(`Panel geschlossen: ${panelId}`);
        return false;
    }
}

/**
 * Versteckt alle Panels
 */
export function hideAllPanels() {
    PANEL_IDS.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
        }
    });
}

// Für Kompatibilität mit globalem Zugriff
window.hideAllPanels = hideAllPanels;

// ===========================================
// Favoriten-Verwaltung
// ===========================================

/**
 * Lädt Favoriten vom Backend
 * @returns {Promise<Array>} - Array der Favoriten
 */
export async function loadFavorites() {
    try {
        const response = await fetch(`${API_URL}/api/favorites`);
        if (response.ok) {
            const data = await response.json();
            favorites = data.favorites || [];
            console.log(`Favoriten geladen: ${favorites.length} Einträge`);

            // Event auslösen für andere Module
            window.dispatchEvent(new CustomEvent('favoritesLoaded', {
                detail: { favorites }
            }));

            return favorites;
        }
    } catch (error) {
        console.error('Fehler beim Laden der Favoriten:', error);
    }
    return [];
}

/**
 * Speichert einen neuen Favoriten
 * @param {string} name - Name des Favoriten
 * @param {number} lat - Breitengrad
 * @param {number} lon - Längengrad
 * @param {string} category - Kategorie (marina, anchorage, fuel, lock, bridge, restaurant, shop, other)
 * @param {string} notes - Optionale Notizen
 * @returns {Promise<boolean>} - Erfolg
 */
export async function saveFavorite(name, lat, lon, category, notes = '') {
    try {
        const response = await fetch(`${API_URL}/api/favorites`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, lat, lon, category, notes })
        });

        if (response.ok) {
            const data = await response.json();
            if (data.status === 'success') {
                favorites.push(data.favorite);

                // Event auslösen
                window.dispatchEvent(new CustomEvent('favoriteSaved', {
                    detail: { favorite: data.favorite }
                }));

                showToast(`Favorit gespeichert: ${name}`, 'success');
                console.log(`Favorit gespeichert: ${name}`);
                return true;
            }
        }
        showToast('Fehler beim Speichern des Favoriten', 'error');
        return false;
    } catch (error) {
        console.error('Fehler beim Speichern des Favoriten:', error);
        showToast('Fehler beim Speichern des Favoriten', 'error');
        return false;
    }
}

/**
 * Löscht einen Favoriten
 * @param {string} favoriteId - ID des Favoriten
 * @returns {Promise<boolean>} - Erfolg
 */
export async function deleteFavorite(favoriteId) {
    try {
        const response = await fetch(`${API_URL}/api/favorites/${favoriteId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            favorites = favorites.filter(f => f.id !== favoriteId);

            // Event auslösen
            window.dispatchEvent(new CustomEvent('favoriteDeleted', {
                detail: { favoriteId }
            }));

            showToast('Favorit gelöscht', 'info');
            console.log(`Favorit gelöscht: ${favoriteId}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Fehler beim Löschen des Favoriten:', error);
        return false;
    }
}

/**
 * Gibt alle Favoriten zurück
 * @returns {Array} - Array der Favoriten
 */
export function getFavorites() {
    return favorites;
}

/**
 * Findet einen Favoriten anhand der ID
 * @param {string} favoriteId - ID des Favoriten
 * @returns {object|null} - Favoriten-Objekt oder null
 */
export function getFavoriteById(favoriteId) {
    return favorites.find(f => f.id === favoriteId) || null;
}

// ===========================================
// Layer-Panel UI
// ===========================================

/**
 * Füllt die Layer-Liste im Panel
 * @param {object} map - MapLibre Map-Instanz
 */
export function populateLayerList(map) {
    const layerList = document.getElementById('layer-list');
    if (!layerList) {
        console.warn('Layer-Liste Element nicht gefunden');
        return;
    }

    // Liste leeren
    layerList.innerHTML = '';

    // Gespeicherte Layer-Einstellungen laden
    const savedLayerSettings = JSON.parse(localStorage.getItem('boatos_layer_settings') || '{}');

    // Layer-Einträge erstellen
    Object.entries(LAYER_CONFIG).forEach(([key, config]) => {
        const isVisible = savedLayerSettings[key] !== undefined
            ? savedLayerSettings[key]
            : config.defaultVisible;

        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            background: rgba(42, 82, 152, 0.2);
            border-radius: 8px;
            margin-bottom: 8px;
        `;

        layerItem.innerHTML = `
            <span style="color: #ccd6f6; font-size: 14px;">${config.name}</span>
            <label class="switch" style="position: relative; display: inline-block; width: 50px; height: 26px;">
                <input type="checkbox" id="layer-${key}" ${isVisible ? 'checked' : ''}
                       style="opacity: 0; width: 0; height: 0;">
                <span class="slider" style="
                    position: absolute;
                    cursor: pointer;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background-color: ${isVisible ? '#64ffda' : '#ccc'};
                    transition: 0.4s;
                    border-radius: 26px;
                "></span>
            </label>
        `;

        // Event-Listener für Toggle
        const checkbox = layerItem.querySelector('input');
        const slider = layerItem.querySelector('.slider');

        checkbox.addEventListener('change', () => {
            const visible = checkbox.checked;
            slider.style.backgroundColor = visible ? '#64ffda' : '#ccc';
            toggleLayerVisibility(map, key, visible);
        });

        layerList.appendChild(layerItem);
    });

    console.log('Layer-Liste populiert');
}

/**
 * Schaltet die Sichtbarkeit eines Layers um
 * @param {object} map - MapLibre Map-Instanz
 * @param {string} layerKey - Layer-Schlüssel aus LAYER_CONFIG
 * @param {boolean} visible - Sichtbarkeit
 */
export function toggleLayerVisibility(map, layerKey, visible) {
    if (!map) {
        console.warn('Map-Instanz nicht verfügbar');
        return;
    }

    const config = LAYER_CONFIG[layerKey];
    if (!config) {
        console.warn(`Layer-Konfiguration für '${layerKey}' nicht gefunden`);
        return;
    }

    // Layer-Sichtbarkeit in MapLibre setzen
    if (map.getLayer(config.id)) {
        map.setLayoutProperty(config.id, 'visibility', visible ? 'visible' : 'none');
        console.log(`Layer '${config.name}' ${visible ? 'sichtbar' : 'versteckt'}`);
    }

    // Einstellung speichern
    const savedSettings = JSON.parse(localStorage.getItem('boatos_layer_settings') || '{}');
    savedSettings[layerKey] = visible;
    localStorage.setItem('boatos_layer_settings', JSON.stringify(savedSettings));

    // Event auslösen
    window.dispatchEvent(new CustomEvent('layerVisibilityChanged', {
        detail: { layerKey, visible }
    }));
}

// ===========================================
// Settings-Panel UI
// ===========================================

/**
 * Lädt Einstellungen aus localStorage
 * @returns {object} - Einstellungsobjekt
 */
export function loadSettings() {
    const defaultSettings = {
        units: {
            speed: 'knots',      // knots, kmh, mph
            distance: 'nm',      // nm, km, mi
            depth: 'm',          // m, ft
            temperature: 'c'     // c, f
        },
        navigation: {
            showCompassRose: true,
            showTrackHistory: true,
            autoFollow: true,
            maxTrackPoints: 500
        },
        display: {
            theme: 'dark',
            fontSize: 'medium',
            showSensorTiles: true
        },
        gps: {
            lowSatelliteThreshold: 15  // Sekunden
        },
        boat: {
            icon: 'motorboat_small',
            cruiseSpeed: 10  // km/h
        },
        ais: {
            enabled: false,
            apiKey: '',
            updateInterval: 60,
            showLabels: true
        },
        waterLevel: {
            enabled: false
        },
        infrastructure: {
            enabled: false,
            types: ['lock', 'bridge', 'harbor']
        }
    };

    try {
        const saved = localStorage.getItem('boatos_settings');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Deep merge mit defaults
            const merged = deepMerge(defaultSettings, parsed);
            console.log('Einstellungen geladen');
            return merged;
        }
    } catch (error) {
        console.error('Fehler beim Laden der Einstellungen:', error);
    }

    return defaultSettings;
}

/**
 * Speichert Einstellungen in localStorage
 * @param {object} settings - Einstellungsobjekt
 * @returns {boolean} - Erfolg
 */
export function saveSettings(settings) {
    try {
        localStorage.setItem('boatos_settings', JSON.stringify(settings));

        // Event auslösen für andere Module
        window.dispatchEvent(new CustomEvent('settingsChanged', {
            detail: { settings }
        }));

        showToast('Einstellungen gespeichert', 'success');
        console.log('Einstellungen gespeichert');
        return true;
    } catch (error) {
        console.error('Fehler beim Speichern der Einstellungen:', error);
        showToast('Fehler beim Speichern der Einstellungen', 'error');
        return false;
    }
}

/**
 * Hilfsfunktion: Deep Merge zweier Objekte
 */
function deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

// ===========================================
// Toast/Notification
// ===========================================

/**
 * Zeigt eine Toast-Benachrichtigung an
 * @param {string} message - Nachricht
 * @param {string} type - Typ (success, error, warning, info)
 * @param {number} duration - Anzeigedauer in ms (default: 2000)
 */
export function showToast(message, type = 'info', duration = 2000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${TOAST_COLORS[type] || TOAST_COLORS.info};
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        opacity: 1;
        transition: opacity 0.5s ease-out;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Nach Ablauf der Zeit ausblenden
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 500);
    }, duration);

    console.log(`Toast (${type}): ${message}`);
}

/**
 * Zeigt eine Benachrichtigung an (Alias für showToast zur Kompatibilität)
 * @param {string} message - Nachricht
 * @param {string} type - Typ (success, error, warning, info)
 */
export function showNotification(message, type = 'info') {
    showToast(message, type);
}

// Für Kompatibilität mit globalem Zugriff aus app.js
window.showNotification = showNotification;
window.showToast = showToast;

// ===========================================
// Sidebar Toggle
// ===========================================

/**
 * Öffnet die Sidebar
 * @param {string} sidebarId - ID der Sidebar (default: 'sidebar')
 */
export function openSidebar(sidebarId = 'sidebar') {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) {
        console.warn(`Sidebar mit ID '${sidebarId}' nicht gefunden`);
        return false;
    }

    sidebar.classList.add('open');
    sidebar.classList.remove('closed');

    // Overlay aktivieren (nutzt HTML-Element mit CSS-Klasse)
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.classList.add('active');
    }

    // Settings laden wenn es die Settings-Sidebar ist
    if (sidebarId === 'sidebar' && window.BoatOS && window.BoatOS.loadAllSettings) {
        window.BoatOS.loadAllSettings();
    }

    console.log(`Sidebar geöffnet: ${sidebarId}`);
    return true;
}

/**
 * Schließt die Sidebar
 * @param {string} sidebarId - ID der Sidebar (default: 'sidebar')
 */
export function closeSidebar(sidebarId = 'sidebar') {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) {
        console.warn(`Sidebar mit ID '${sidebarId}' nicht gefunden`);
        return false;
    }

    sidebar.classList.remove('open');
    sidebar.classList.add('closed');

    // Overlay deaktivieren
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }

    console.log(`Sidebar geschlossen: ${sidebarId}`);
    return true;
}

/**
 * Schaltet die Sidebar um
 * @param {string} sidebarId - ID der Sidebar (default: 'sidebar')
 * @returns {boolean} - Neuer Status (true = offen)
 */
export function toggleSidebar(sidebarId = 'sidebar') {
    const sidebar = document.getElementById(sidebarId);
    if (!sidebar) {
        console.warn(`Sidebar mit ID '${sidebarId}' nicht gefunden`);
        return false;
    }

    if (sidebar.classList.contains('open')) {
        closeSidebar(sidebarId);
        return false;
    } else {
        openSidebar(sidebarId);
        return true;
    }
}

// ===========================================
// Tab-Switching
// ===========================================

/**
 * Wechselt den aktiven Tab
 * @param {string} tabId - ID des Tabs
 * @param {string} tabGroupId - ID der Tab-Gruppe (default: 'main-tabs')
 */
export function switchTab(tabId, tabGroupId = 'main-tabs') {
    const tabGroup = document.getElementById(tabGroupId);
    if (!tabGroup) {
        console.warn(`Tab-Gruppe mit ID '${tabGroupId}' nicht gefunden`);
        return false;
    }

    // Alle Tabs in der Gruppe deaktivieren
    const tabs = tabGroup.querySelectorAll('.tab');
    const tabContents = document.querySelectorAll(`[data-tab-group="${tabGroupId}"]`);

    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabId) {
            tab.classList.add('active');
        }
    });

    // Alle Tab-Inhalte verstecken und den aktiven anzeigen
    tabContents.forEach(content => {
        if (content.id === `tab-content-${tabId}`) {
            content.style.display = 'block';
            content.classList.add('active');
        } else {
            content.style.display = 'none';
            content.classList.remove('active');
        }
    });

    // Event auslösen
    window.dispatchEvent(new CustomEvent('tabChanged', {
        detail: { tabId, tabGroupId }
    }));

    console.log(`Tab gewechselt: ${tabId}`);
    return true;
}

/**
 * Initialisiert Tab-Gruppen mit Click-Handlern
 * @param {string} tabGroupId - ID der Tab-Gruppe
 */
export function initTabs(tabGroupId = 'main-tabs') {
    const tabGroup = document.getElementById(tabGroupId);
    if (!tabGroup) return;

    const tabs = tabGroup.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            if (targetTab) {
                switchTab(targetTab, tabGroupId);
            }
        });
    });

    // Ersten Tab als Standard aktivieren
    if (tabs.length > 0 && tabs[0].dataset.tab) {
        switchTab(tabs[0].dataset.tab, tabGroupId);
    }
}

// ===========================================
// Hilfs-Funktionen
// ===========================================

/**
 * HTML-Entities escapen (für sichere Textausgabe)
 * @param {string} text - Eingangstext
 * @returns {string} - Escapeter Text
 */
export function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Kategorie-Icons für Favoriten
 */
export const CATEGORY_ICONS = {
    'marina': '⚓',
    'anchorage': '🔱',
    'fuel': '⛽',
    'lock': '🚧',
    'bridge': '🌉',
    'restaurant': '🍽️',
    'shop': '🏪',
    'danger': '⚠️',
    'other': '📍'
};

/**
 * Gibt das Icon für eine Kategorie zurück
 * @param {string} category - Kategorie-Name
 * @returns {string} - Emoji-Icon
 */
export function getCategoryIcon(category) {
    return CATEGORY_ICONS[category] || CATEGORY_ICONS.other;
}

// ===========================================
// Modul-Initialisierung
// ===========================================

/**
 * Initialisiert das UI-Modul
 * Sollte nach DOMContentLoaded aufgerufen werden
 */
export function initUI() {
    console.log('UI-Modul initialisiert');

    // Event-Listener für globale ESC-Taste
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // Alle Modals schließen
            document.querySelectorAll('.modal.active').forEach(modal => {
                closeModal(modal.id);
            });
        }
    });

    // Bei Start im Dashboard-Modus: FAB und Bottom Sheet verstecken
    if (currentMode === 'dashboard') {
        const fabContainer = document.getElementById('fabContainer');
        const bottomSheet = document.getElementById('bottomSheet');
        if (fabContainer) fabContainer.style.display = 'none';
        if (bottomSheet) bottomSheet.style.display = 'none';
    }
}

// ===========================================
// Bottom Sheet Funktionen
// ===========================================

let sheetState = 'peek'; // 'peek', 'full'

/**
 * Wechselt den Bottom Sheet Status (peek <-> full)
 */
export function cycleSheet() {
    const sheet = document.getElementById('bottomSheet');
    if (!sheet) return;

    if (sheetState === 'peek') {
        sheetState = 'full';
        sheet.classList.remove('peek', 'hidden');
        sheet.classList.add('full');
    } else {
        sheetState = 'peek';
        sheet.classList.remove('full', 'hidden');
        sheet.classList.add('peek');
    }
}

/**
 * Zeigt eine Sektion im Bottom Sheet
 * @param {string} sectionId - ID der Sektion (ohne 'section-' Prefix)
 * @param {HTMLElement} tabElement - Das angeklickte Tab-Element
 */
export function showSection(sectionId, tabElement) {
    // Alle Sektionen verstecken
    document.querySelectorAll('.sheet-content > div').forEach(section => {
        section.classList.add('section-hidden');
    });

    // Gewählte Sektion zeigen
    const section = document.getElementById(`section-${sectionId}`);
    if (section) {
        section.classList.remove('section-hidden');
    }

    // Tab-Styling aktualisieren
    document.querySelectorAll('.sheet-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Sheet auf "full" erweitern wenn nicht schon
    if (sheetState === 'peek') {
        cycleSheet();
    }
}

// ===========================================
// GPS Popup Funktionen
// ===========================================

/**
 * Toggled das GPS Detail Popup
 */
export function toggleGpsPopup() {
    const popup = document.getElementById('gpsPopup');
    if (popup) {
        popup.classList.toggle('active');
    }
}

// ===========================================
// Mode Toggle (Map/Dashboard)
// ===========================================

let currentMode = 'dashboard'; // 'map' oder 'dashboard' - Start mit Dashboard

/**
 * Wechselt zwischen Karten- und Dashboard-Ansicht
 */
export function toggleMode() {
    const mapContainer = document.getElementById('mapContainer');
    const dashboardContainer = document.getElementById('dashboardContainer');
    const modeToggle = document.getElementById('modeToggle');
    const fabContainer = document.getElementById('fabContainer');
    const bottomSheet = document.getElementById('bottomSheet');

    if (currentMode === 'map') {
        currentMode = 'dashboard';
        if (mapContainer) mapContainer.classList.add('hidden');
        if (dashboardContainer) dashboardContainer.classList.add('active');
        if (modeToggle) modeToggle.textContent = '🗺️';
        if (fabContainer) fabContainer.style.display = 'none';
        if (bottomSheet) bottomSheet.style.display = 'none';
    } else {
        currentMode = 'map';
        if (mapContainer) mapContainer.classList.remove('hidden');
        if (dashboardContainer) dashboardContainer.classList.remove('active');
        if (modeToggle) modeToggle.textContent = '📊';
        if (fabContainer) fabContainer.style.display = 'flex';
        if (bottomSheet) {
            bottomSheet.style.display = 'block';
            // Sheet auf peek-Status zurücksetzen
            bottomSheet.classList.remove('full', 'hidden');
            bottomSheet.classList.add('peek');
            sheetState = 'peek';
        }
    }
}

// ===========================================
// Layer Panel
// ===========================================

/**
 * Zeigt/versteckt das Layer-Panel
 */
export function toggleLayers() {
    // TODO: Implementieren oder Modal öffnen
    showNotification('Layer-Einstellungen öffnen...', 'info');
    toggleSidebar();
    showSettingsTab('map', document.querySelector('[onclick*="showSettingsTab(\'map\'"]'));
}

// ===========================================
// Search Funktionen
// ===========================================

/**
 * Öffnet das Such-Overlay
 */
export function openSearch() {
    const overlay = document.getElementById('searchOverlay');
    if (overlay) {
        overlay.classList.add('active');
        const input = document.getElementById('searchInput');
        if (input) {
            input.focus();
            input.value = '';
        }
    }
}

/**
 * Schließt das Such-Overlay
 * @param {Event} event - Optional, um Bubbling zu verhindern
 */
export function closeSearch(event) {
    if (event && event.target && event.target.id !== 'searchOverlay') {
        return;
    }
    const overlay = document.getElementById('searchOverlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

/**
 * Verarbeitet Sucheingaben
 * @param {string} query - Suchbegriff
 */
export function handleSearch(query) {
    const resultsContainer = document.getElementById('searchResults');
    if (!resultsContainer) return;

    if (query.length < 2) {
        resultsContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-dim);">Mindestens 2 Zeichen eingeben</div>';
        return;
    }

    // TODO: Echte Suche implementieren
    resultsContainer.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-dim);">Suche nach "${escapeHTML(query)}"...</div>`;
}

// ===========================================
// Favoriten
// ===========================================

/**
 * Zeigt/versteckt Favoriten auf der Karte und öffnet das Favoriten-Panel
 */
export async function showFavorites() {
    const map = window.BoatOS?.map?.getMap?.() || window.map;

    // Toggle: Wenn bereits sichtbar, alles ausblenden
    if (favoritesVisible) {
        hideFavoriteMarkers();
        closeFavoritesPanel();
        favoritesVisible = false;

        // Button-Status aktualisieren
        const favBtn = document.querySelector('.quick-action[onclick*="showFavorites"]');
        if (favBtn) favBtn.classList.remove('active');

        showToast('Favoriten ausgeblendet', 'info');
        return;
    }

    // Favoriten laden
    showToast('Favoriten werden geladen...', 'info');
    await loadFavorites();

    if (favorites.length === 0) {
        showToast('Keine Favoriten vorhanden', 'warning');
        return;
    }

    // Marker auf Karte anzeigen
    if (map) {
        showFavoriteMarkers(map);
    }

    // Panel anzeigen
    openFavoritesPanel();

    favoritesVisible = true;

    // Button-Status aktualisieren
    const favBtn = document.querySelector('.quick-action[onclick*="showFavorites"]');
    if (favBtn) favBtn.classList.add('active');

    showToast(`${favorites.length} Favoriten geladen`, 'success');
}

/**
 * Zeigt Favoriten-Marker auf der Karte
 * @param {object} map - MapLibre Map-Instanz
 */
function showFavoriteMarkers(map) {
    // Alte Marker entfernen
    hideFavoriteMarkers();

    favorites.forEach(fav => {
        const icon = getCategoryIcon(fav.category);

        // Marker-Element erstellen
        const el = document.createElement('div');
        el.className = 'favorite-marker';
        el.innerHTML = icon;
        el.style.cssText = `
            font-size: 28px;
            cursor: pointer;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
            transition: transform 0.2s;
        `;

        // Hover-Effekt
        el.addEventListener('mouseenter', () => {
            el.style.transform = 'scale(1.3)';
        });
        el.addEventListener('mouseleave', () => {
            el.style.transform = 'scale(1)';
        });

        // Click-Handler für Popup
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            showFavoritePopup(map, fav);
        });

        // MapLibre Marker erstellen
        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([fav.lon, fav.lat])
            .addTo(map);

        favoriteMarkers.push(marker);
    });

    console.log(`${favoriteMarkers.length} Favoriten-Marker angezeigt`);
}

/**
 * Entfernt alle Favoriten-Marker von der Karte
 */
function hideFavoriteMarkers() {
    favoriteMarkers.forEach(marker => marker.remove());
    favoriteMarkers = [];
}

/**
 * Zeigt ein Popup für einen Favoriten
 * @param {object} map - MapLibre Map-Instanz
 * @param {object} fav - Favoriten-Objekt
 */
function showFavoritePopup(map, fav) {
    const icon = getCategoryIcon(fav.category);
    const popupContent = `
        <div style="padding: 10px; min-width: 200px;">
            <h3 style="margin: 0 0 8px 0; color: #0a192f; font-size: 16px;">
                ${icon} ${escapeHTML(fav.name)}
            </h3>
            <p style="margin: 0 0 8px 0; color: #666; font-size: 12px;">
                ${fav.lat.toFixed(5)}, ${fav.lon.toFixed(5)}
            </p>
            ${fav.notes ? `<p style="margin: 0 0 12px 0; color: #333; font-size: 13px;">${escapeHTML(fav.notes)}</p>` : ''}
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button onclick="window.navigateToFavorite('${fav.id}')" style="
                    padding: 6px 12px; background: #64ffda; color: #0a192f;
                    border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
                ">Als Ziel</button>
                <button onclick="window.addFavoriteAsWaypoint('${fav.id}')" style="
                    padding: 6px 12px; background: #2a5298; color: white;
                    border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
                ">Wegpunkt</button>
                <button onclick="window.confirmDeleteFavorite('${fav.id}')" style="
                    padding: 6px 12px; background: #e74c3c; color: white;
                    border: none; border-radius: 4px; cursor: pointer; font-size: 12px;
                ">Löschen</button>
            </div>
        </div>
    `;

    new maplibregl.Popup({ closeButton: true, maxWidth: '300px' })
        .setLngLat([fav.lon, fav.lat])
        .setHTML(popupContent)
        .addTo(map);
}

/**
 * Öffnet das Favoriten-Panel
 */
function openFavoritesPanel() {
    // Bestehendes Panel entfernen
    closeFavoritesPanel();

    const panel = document.createElement('div');
    panel.id = 'favorites-panel';
    panel.style.cssText = `
        position: fixed;
        right: 10px;
        top: 70px;
        width: 300px;
        max-height: calc(100vh - 160px);
        background: rgba(10, 25, 47, 0.95);
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        z-index: 1000;
        overflow: hidden;
        border: 1px solid rgba(100, 255, 218, 0.2);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        padding: 15px;
        background: rgba(42, 82, 152, 0.3);
        border-bottom: 1px solid rgba(100, 255, 218, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    header.innerHTML = `
        <span style="color: #64ffda; font-weight: 600; font-size: 16px;">⭐ Favoriten (${favorites.length})</span>
        <button onclick="window.closeFavoritesPanel()" style="
            background: none; border: none; color: #ccd6f6;
            font-size: 20px; cursor: pointer; padding: 0;
        ">&times;</button>
    `;
    panel.appendChild(header);

    // Liste
    const list = document.createElement('div');
    list.style.cssText = `
        max-height: calc(100vh - 240px);
        overflow-y: auto;
        padding: 10px;
    `;

    favorites.forEach(fav => {
        const icon = getCategoryIcon(fav.category);
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.style.cssText = `
            padding: 12px;
            background: rgba(42, 82, 152, 0.2);
            border-radius: 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: background 0.2s;
        `;
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 24px;">${icon}</span>
                <div style="flex: 1; min-width: 0;">
                    <div style="color: #ccd6f6; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${escapeHTML(fav.name)}
                    </div>
                    <div style="color: #8892b0; font-size: 11px;">
                        ${fav.lat.toFixed(4)}, ${fav.lon.toFixed(4)}
                    </div>
                </div>
            </div>
        `;

        // Hover-Effekt
        item.addEventListener('mouseenter', () => {
            item.style.background = 'rgba(42, 82, 152, 0.4)';
        });
        item.addEventListener('mouseleave', () => {
            item.style.background = 'rgba(42, 82, 152, 0.2)';
        });

        // Click: Zur Position fliegen
        item.addEventListener('click', () => {
            panToFavorite(fav);
        });

        list.appendChild(item);
    });

    panel.appendChild(list);
    document.body.appendChild(panel);
    favoritesPanel = panel;
}

/**
 * Schließt das Favoriten-Panel
 */
export function closeFavoritesPanel() {
    if (favoritesPanel) {
        favoritesPanel.remove();
        favoritesPanel = null;
    }
    const existingPanel = document.getElementById('favorites-panel');
    if (existingPanel) {
        existingPanel.remove();
    }
}

/**
 * Fliegt zur Position eines Favoriten
 * @param {object} fav - Favoriten-Objekt
 */
function panToFavorite(fav) {
    const map = window.BoatOS?.map?.getMap?.() || window.map;
    if (map) {
        map.flyTo({
            center: [fav.lon, fav.lat],
            zoom: 15,
            duration: 1000
        });
    }
}

/**
 * Navigiert zu einem Favoriten (setzt ihn als Ziel)
 * @param {string} favoriteId - ID des Favoriten
 */
window.navigateToFavorite = function(favoriteId) {
    const fav = getFavoriteById(favoriteId);
    if (!fav) return;

    // Zur Navigation-Funktion weiterleiten
    if (window.BoatOS?.navigation?.setDestination) {
        window.BoatOS.navigation.setDestination(fav.lat, fav.lon, fav.name);
        showToast(`Navigation zu ${fav.name} gestartet`, 'success');
    } else {
        // Fallback: Als ersten Wegpunkt setzen
        window.addFavoriteAsWaypoint(favoriteId);
    }
};

/**
 * Fügt einen Favoriten als Wegpunkt hinzu
 * @param {string} favoriteId - ID des Favoriten
 */
window.addFavoriteAsWaypoint = function(favoriteId) {
    const fav = getFavoriteById(favoriteId);
    if (!fav) return;

    const context = window.BoatOS?.context;
    if (context && window.BoatOS?.navigation?.addWaypoint) {
        const waypoint = {
            lat: fav.lat,
            lon: fav.lon,
            name: fav.name,
            timestamp: new Date().toISOString()
        };
        window.BoatOS.navigation.addWaypoint(waypoint, context);
        if (window.updateWaypointList) window.updateWaypointList();
        showToast(`${fav.name} als Wegpunkt hinzugefügt`, 'success');
    } else {
        showToast('Wegpunkt konnte nicht hinzugefügt werden', 'error');
    }
};

/**
 * Bestätigt das Löschen eines Favoriten
 * @param {string} favoriteId - ID des Favoriten
 */
window.confirmDeleteFavorite = async function(favoriteId) {
    const fav = getFavoriteById(favoriteId);
    if (!fav) return;

    if (confirm(`Favorit "${fav.name}" wirklich löschen?`)) {
        const success = await deleteFavorite(favoriteId);
        if (success) {
            // Marker aktualisieren
            const map = window.BoatOS?.map?.getMap?.() || window.map;
            if (map && favoritesVisible) {
                showFavoriteMarkers(map);
                openFavoritesPanel();
            }
        }
    }
};

// Globale Funktion zum Schließen des Panels
window.closeFavoritesPanel = closeFavoritesPanel;

// ===========================================
// Logbook Funktionen
// ===========================================

/**
 * Fügt einen Logbuch-Eintrag hinzu
 */
export function addLogEntry() {
    showNotification('Neuer Logbuch-Eintrag...', 'info');
    // TODO: Logbuch-Eintrag-Modal öffnen
}

/**
 * Zeigt einen Logbook-Tab
 * @param {string} tabId - 'current' oder 'archive'
 * @param {HTMLElement} tabElement - Das angeklickte Tab-Element
 */
export function showLogbookTab(tabId, tabElement) {
    // Tab-Styling aktualisieren
    document.querySelectorAll('.logbook-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // TODO: Entsprechenden Inhalt laden
    console.log('Logbook Tab:', tabId);
}

// ===========================================
// Settings Panel Funktionen
// ===========================================

/**
 * Zeigt einen Settings-Tab
 * @param {string} tabId - 'general', 'boat', 'map', 'nav', 'ais'
 * @param {HTMLElement} tabElement - Das angeklickte Tab-Element
 */
export function showSettingsTab(tabId, tabElement) {
    // Alle Settings-Sektionen verstecken
    const sections = ['settings-general', 'settings-boat', 'settings-map', 'settings-nav', 'settings-ais', 'settings-charts', 'settings-gps', 'settings-data', 'settings-routing'];
    sections.forEach(id => {
        const section = document.getElementById(id);
        if (section) {
            section.classList.add('section-hidden');
        }
    });

    // Gewählte Sektion zeigen
    const section = document.getElementById(`settings-${tabId}`);
    if (section) {
        section.classList.remove('section-hidden');
    }

    // Tab-Styling aktualisieren
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    if (tabElement) {
        tabElement.classList.add('active');
    }
}

/**
 * Toggled eine Setting-Toggle
 * @param {HTMLElement} toggleElement - Das Toggle-Element
 * @param {string} settingKey - Der Setting-Key
 */
export function toggleSettingToggle(toggleElement, settingKey) {
    toggleElement.classList.toggle('active');
    const isActive = toggleElement.classList.contains('active');
    console.log(`Setting ${settingKey}: ${isActive}`);

    // Spezielle Behandlung für Dark Mode
    if (settingKey === 'darkMode' && window.BoatOS && window.BoatOS.theme) {
        window.BoatOS.theme.setDarkMode(isActive);
    }

    // Schleusen-Layer umschalten
    if (settingKey === 'showLocks') {
        setLocksVisible(isActive);
    }

    // Pegelstände umschalten
    if (settingKey === 'showPegel') {
        setPegelVisible(isActive);
    }
}

/**
 * Wählt ein Boot-Icon aus
 * @param {HTMLElement} iconElement - Das angeklickte Icon-Element
 */
export function selectBoatIcon(iconElement) {
    // Alle Icons deaktivieren
    document.querySelectorAll('.boat-icon-option').forEach(icon => {
        icon.classList.remove('active');
    });

    // Gewähltes Icon aktivieren
    iconElement.classList.add('active');

    const iconType = iconElement.dataset.icon;
    console.log('Boot-Icon gewählt:', iconType);

    // Boot-Marker aktualisieren
    if (window.BoatOS && window.BoatOS.map && window.BoatOS.map.updateBoatMarkerIcon) {
        window.BoatOS.map.updateBoatMarkerIcon(iconType);
    }
}

// ===========================================
// Schleusen & Pegel Toggle Funktionen
// ===========================================

// State für Sichtbarkeit
let locksVisible = true;
let pegelVisible = false;

/**
 * Setzt die Sichtbarkeit der Schleusen
 * @param {boolean} visible - Sichtbar ja/nein
 */
function setLocksVisible(visible) {
    locksVisible = visible;

    // locks.js Funktion aufrufen (globale Funktion)
    // Direkt über window.locksVisible Property setzen
    if (typeof window.locksVisible !== 'undefined') {
        window.locksVisible = visible;
    }

    if (visible) {
        // Schleusen laden/anzeigen
        if (typeof window.updateLocksOnMap === 'function') {
            window.updateLocksOnMap();
        }
    } else {
        // Schleusen verstecken
        if (typeof window.clearLocksMarkers === 'function') {
            window.clearLocksMarkers();
        }
    }

    // Button-Status aktualisieren
    const btn = document.getElementById('btn-locks');
    if (btn) {
        btn.classList.toggle('active', visible);
    }

    console.log(`Schleusen ${visible ? 'aktiviert' : 'deaktiviert'}`);
}

/**
 * Setzt die Sichtbarkeit der Pegelstände
 * @param {boolean} visible - Sichtbar ja/nein
 */
function setPegelVisible(visible) {
    pegelVisible = visible;

    // ais.js Funktion aufrufen
    if (window.BoatOS?.ais?.updateWaterLevelSettings) {
        window.BoatOS.ais.updateWaterLevelSettings({ enabled: visible });
    }

    // Button-Status aktualisieren
    const btn = document.getElementById('btn-pegel');
    if (btn) {
        btn.classList.toggle('active', visible);
    }

    console.log(`Pegelstände ${visible ? 'aktiviert' : 'deaktiviert'}`);
}

/**
 * Toggle-Funktion für Schleusen Quick-Action Button
 */
export function toggleLocks() {
    locksVisible = !locksVisible;
    setLocksVisible(locksVisible);

    // Settings-Toggle synchronisieren
    const settingsToggle = document.getElementById('toggle-locks');
    if (settingsToggle) {
        settingsToggle.classList.toggle('active', locksVisible);
    }

    showToast(locksVisible ? '🚧 Schleusen eingeblendet' : '🚧 Schleusen ausgeblendet', 'info');
}

/**
 * Toggle-Funktion für Pegel Quick-Action Button
 */
export function togglePegel() {
    pegelVisible = !pegelVisible;
    setPegelVisible(pegelVisible);

    // Settings-Toggle synchronisieren
    const settingsToggle = document.getElementById('toggle-pegel');
    if (settingsToggle) {
        settingsToggle.classList.toggle('active', pegelVisible);
    }

    showToast(pegelVisible ? '📊 Pegelstände eingeblendet' : '📊 Pegelstände ausgeblendet', 'info');
}

/**
 * Initialisiert die Layer basierend auf gespeicherten Einstellungen
 */
export function initLayerVisibility() {
    // Gespeicherte Einstellungen laden
    const settings = loadSettings();

    // Schleusen standardmäßig aktiv
    const locksEnabled = settings.infrastructure?.showLocks !== false;
    locksVisible = locksEnabled;

    // Pegel standardmäßig inaktiv
    const pegelEnabled = settings.waterLevel?.enabled === true;
    pegelVisible = pegelEnabled;

    // UI synchronisieren
    const locksToggle = document.getElementById('toggle-locks');
    if (locksToggle) {
        locksToggle.classList.toggle('active', locksEnabled);
    }

    const pegelToggle = document.getElementById('toggle-pegel');
    if (pegelToggle) {
        pegelToggle.classList.toggle('active', pegelEnabled);
    }

    const locksBtn = document.getElementById('btn-locks');
    if (locksBtn) {
        locksBtn.classList.toggle('active', locksEnabled);
    }

    const pegelBtn = document.getElementById('btn-pegel');
    if (pegelBtn) {
        pegelBtn.classList.toggle('active', pegelEnabled);
    }

    console.log(`Layer-Sichtbarkeit initialisiert: Schleusen=${locksEnabled}, Pegel=${pegelEnabled}`);
}

// ===========================================
// Exports für globale Kompatibilität
// ===========================================

// Diese Funktionen werden auch global verfügbar gemacht für Kompatibilität
// mit bestehender app.js und onclick-Handlern in HTML
window.openModal = openModal;
window.closeModal = closeModal;
window.togglePanel = togglePanel;
window.loadFavorites = loadFavorites;
window.saveFavorite = saveFavorite;
window.deleteFavorite = deleteFavorite;
window.populateLayerList = populateLayerList;
window.toggleLayerVisibility = toggleLayerVisibility;
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.toggleSidebar = toggleSidebar;
window.switchTab = switchTab;
window.getCategoryIcon = getCategoryIcon;
window.escapeHTML = escapeHTML;
window.cycleSheet = cycleSheet;
window.showSection = showSection;
window.toggleGpsPopup = toggleGpsPopup;
window.toggleMode = toggleMode;
window.toggleLayers = toggleLayers;
window.openSearch = openSearch;
window.closeSearch = closeSearch;
window.handleSearch = handleSearch;
window.showFavorites = showFavorites;
window.addLogEntry = addLogEntry;
window.showLogbookTab = showLogbookTab;
window.showSettingsTab = showSettingsTab;
window.toggleSettingToggle = toggleSettingToggle;
window.selectBoatIcon = selectBoatIcon;
window.toggleLocks = toggleLocks;
window.togglePegel = togglePegel;
window.initLayerVisibility = initLayerVisibility;
