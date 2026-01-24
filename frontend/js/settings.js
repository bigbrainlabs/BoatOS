/**
 * BoatOS Settings Modul
 * Verwaltet alle Einstellungen (Speichern/Laden)
 *
 * @module settings
 */

// ==================== STATE ====================
let moduleContext = null;

// ==================== HELPERS ====================

/**
 * Setzt den Modul-Kontext
 */
export function setContext(ctx) {
    moduleContext = ctx;
}

/**
 * Gibt den UI-Modul zurück
 */
function getUI() {
    return moduleContext?.ui || window.BoatOS?.ui;
}

// ==================== SAVE SETTINGS ====================

/**
 * Alle Einstellungen aus dem Formular sammeln und speichern
 */
export function saveAllSettings() {
    const ui = getUI();

    // Bestehende Settings laden
    const settings = ui?.loadSettings ? ui.loadSettings() : {};

    // === ALLGEMEIN ===
    settings.units = settings.units || {};
    const unitsSelect = document.getElementById('setting-units');
    if (unitsSelect) {
        const isMetric = unitsSelect.value === 'metric';
        settings.units.distance = isMetric ? 'km' : 'nm';
        settings.units.speed = isMetric ? 'kmh' : 'kn';
    }

    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        settings.language = langSelect.value;
    }

    const coordSelect = document.getElementById('setting-coord-format');
    if (coordSelect) {
        settings.coordFormat = coordSelect.value;
    }

    // === BOOT ===
    settings.boat = settings.boat || {};
    const boatTypeSelect = document.getElementById('setting-boat-type');
    const boatLengthInput = document.getElementById('setting-boat-length');
    const boatWidthInput = document.getElementById('setting-boat-width');
    const boatDraftInput = document.getElementById('setting-boat-draft');
    const boatHeightInput = document.getElementById('setting-boat-height');

    if (boatTypeSelect) settings.boat.type = boatTypeSelect.value;
    if (boatLengthInput) settings.boat.length = parseFloat(boatLengthInput.value) || 0;
    if (boatWidthInput) settings.boat.width = parseFloat(boatWidthInput.value) || 0;
    if (boatDraftInput) settings.boat.draft = parseFloat(boatDraftInput.value) || 0;
    if (boatHeightInput) settings.boat.height = parseFloat(boatHeightInput.value) || 0;

    // === KARTE ===
    settings.map = settings.map || {};
    const mapStyleSelect = document.getElementById('setting-map-style');
    if (mapStyleSelect) settings.map.style = mapStyleSelect.value;

    // Toggle-Werte aus aktiven Zuständen lesen
    const toggleOpenSeaMap = document.getElementById('toggle-openseamap');
    const toggleLocks = document.getElementById('toggle-locks');
    const toggleTrack = document.getElementById('toggle-track');
    const toggleAutoCenter = document.getElementById('toggle-autocenter');
    const toggleHeadingUp = document.getElementById('toggle-headingup');

    if (toggleOpenSeaMap) settings.map.openSeaMap = toggleOpenSeaMap.classList.contains('active');
    if (toggleLocks) settings.map.showLocks = toggleLocks.classList.contains('active');
    if (toggleTrack) settings.map.showTrack = toggleTrack.classList.contains('active');
    if (toggleAutoCenter) settings.map.autoCenter = toggleAutoCenter.classList.contains('active');
    if (toggleHeadingUp) settings.map.headingUp = toggleHeadingUp.classList.contains('active');

    // === NAVIGATION ===
    settings.navigation = settings.navigation || {};
    const toggleWaterways = document.getElementById('toggle-waterways');
    const defaultSpeed = document.getElementById('setting-default-speed');
    const toggleArrivalAlarm = document.getElementById('toggle-arrival-alarm');
    const alarmDistance = document.getElementById('setting-alarm-distance');

    if (toggleWaterways) settings.navigation.preferWaterways = toggleWaterways.classList.contains('active');
    if (defaultSpeed) settings.navigation.defaultSpeed = parseFloat(defaultSpeed.value) || 6;
    if (toggleArrivalAlarm) settings.navigation.arrivalAlarm = toggleArrivalAlarm.classList.contains('active');
    if (alarmDistance) settings.navigation.alarmDistance = parseFloat(alarmDistance.value) || 0.1;

    // === AIS ===
    settings.ais = settings.ais || {};
    const toggleAis = document.getElementById('toggle-ais');
    const aisProvider = document.getElementById('setting-ais-provider');
    const aisApiKey = document.getElementById('setting-ais-apikey');
    const aisRange = document.getElementById('setting-ais-range');
    const aisInterval = document.getElementById('setting-ais-interval');
    const toggleAisLabels = document.getElementById('toggle-ais-labels');
    const toggleCpa = document.getElementById('toggle-cpa');
    const minCpa = document.getElementById('setting-min-cpa');

    if (toggleAis) settings.ais.enabled = toggleAis.classList.contains('active');
    if (aisProvider) settings.ais.provider = aisProvider.value;
    if (aisApiKey) settings.ais.apiKey = aisApiKey.value;
    if (aisRange) settings.ais.range = parseInt(aisRange.value) || 20;
    if (aisInterval) settings.ais.updateInterval = parseInt(aisInterval.value) || 60;
    if (toggleAisLabels) settings.ais.showLabels = toggleAisLabels.classList.contains('active');
    if (toggleCpa) settings.ais.cpaAlarm = toggleCpa.classList.contains('active');
    if (minCpa) settings.ais.minCpa = parseFloat(minCpa.value) || 0.5;

    // Speichern
    if (ui?.saveSettings) {
        ui.saveSettings(settings);
    } else {
        localStorage.setItem('boatos_settings', JSON.stringify(settings));
    }

    // Event für andere Module auslösen
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { settings } }));

    // Sidebar schließen
    if (ui?.toggleSidebar) {
        ui.toggleSidebar();
    }

    // Notification anzeigen
    if (ui?.showNotification) {
        ui.showNotification('Einstellungen gespeichert', 'success');
    }

    console.log('Einstellungen gespeichert:', settings);
}

// ==================== LOAD SETTINGS ====================

/**
 * Alle Einstellungen in das Formular laden
 */
export function loadAllSettings() {
    const ui = getUI();
    const settings = ui?.loadSettings ? ui.loadSettings() : {};

    // === ALLGEMEIN ===
    if (settings.units) {
        const unitsSelect = document.getElementById('setting-units');
        if (unitsSelect) {
            if (settings.units.distance === 'km' || settings.units.speed === 'kmh') {
                unitsSelect.value = 'metric';
            } else {
                unitsSelect.value = 'nautical';
            }
        }
    }

    const langSelect = document.getElementById('setting-language');
    if (langSelect && settings.language) {
        langSelect.value = settings.language;
    }

    const coordSelect = document.getElementById('setting-coord-format');
    if (coordSelect && settings.coordFormat) {
        coordSelect.value = settings.coordFormat;
    }

    // === BOOT ===
    if (settings.boat) {
        const boatTypeSelect = document.getElementById('setting-boat-type');
        const boatLengthInput = document.getElementById('setting-boat-length');
        const boatWidthInput = document.getElementById('setting-boat-width');
        const boatDraftInput = document.getElementById('setting-boat-draft');
        const boatHeightInput = document.getElementById('setting-boat-height');

        if (boatTypeSelect && settings.boat.type) boatTypeSelect.value = settings.boat.type;
        if (boatLengthInput && settings.boat.length) boatLengthInput.value = settings.boat.length;
        if (boatWidthInput && settings.boat.width) boatWidthInput.value = settings.boat.width;
        if (boatDraftInput && settings.boat.draft) boatDraftInput.value = settings.boat.draft;
        if (boatHeightInput && settings.boat.height) boatHeightInput.value = settings.boat.height;
    }

    // === KARTE ===
    if (settings.map) {
        const mapStyleSelect = document.getElementById('setting-map-style');
        if (mapStyleSelect && settings.map.style) {
            mapStyleSelect.value = settings.map.style;
        }

        // Toggles setzen
        const toggles = {
            'toggle-openseamap': settings.map.openSeaMap,
            'toggle-locks': settings.map.showLocks,
            'toggle-track': settings.map.showTrack,
            'toggle-autocenter': settings.map.autoCenter,
            'toggle-headingup': settings.map.headingUp
        };
        Object.entries(toggles).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el && value !== undefined) {
                el.classList.toggle('active', value);
            }
        });
    }

    // === NAVIGATION ===
    if (settings.navigation) {
        const toggleWaterways = document.getElementById('toggle-waterways');
        const defaultSpeed = document.getElementById('setting-default-speed');
        const toggleArrivalAlarm = document.getElementById('toggle-arrival-alarm');
        const alarmDistance = document.getElementById('setting-alarm-distance');

        if (toggleWaterways) toggleWaterways.classList.toggle('active', settings.navigation.preferWaterways !== false);
        if (defaultSpeed && settings.navigation.defaultSpeed) defaultSpeed.value = settings.navigation.defaultSpeed;
        if (toggleArrivalAlarm) toggleArrivalAlarm.classList.toggle('active', settings.navigation.arrivalAlarm !== false);
        if (alarmDistance && settings.navigation.alarmDistance) alarmDistance.value = settings.navigation.alarmDistance;
    }

    // === AIS ===
    if (settings.ais) {
        const toggleAis = document.getElementById('toggle-ais');
        const aisProvider = document.getElementById('setting-ais-provider');
        const aisApiKey = document.getElementById('setting-ais-apikey');
        const aisRange = document.getElementById('setting-ais-range');
        const aisInterval = document.getElementById('setting-ais-interval');
        const toggleAisLabels = document.getElementById('toggle-ais-labels');
        const toggleCpa = document.getElementById('toggle-cpa');
        const minCpa = document.getElementById('setting-min-cpa');

        if (toggleAis) toggleAis.classList.toggle('active', settings.ais.enabled === true);
        if (aisProvider && settings.ais.provider) aisProvider.value = settings.ais.provider;
        if (aisApiKey && settings.ais.apiKey) aisApiKey.value = settings.ais.apiKey;
        if (aisRange && settings.ais.range) aisRange.value = settings.ais.range;
        if (aisInterval && settings.ais.updateInterval) aisInterval.value = settings.ais.updateInterval;
        if (toggleAisLabels) toggleAisLabels.classList.toggle('active', settings.ais.showLabels !== false);
        if (toggleCpa) toggleCpa.classList.toggle('active', settings.ais.cpaAlarm !== false);
        if (minCpa && settings.ais.minCpa) minCpa.value = settings.ais.minCpa;
    }

    console.log('Einstellungen geladen:', settings);
}
