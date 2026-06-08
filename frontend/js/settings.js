/**
 * BoatOS Settings Modul
 * Verwaltet alle Einstellungen (Speichern/Laden)
 *
 * @module settings
 */

import { t, setLang } from './i18n.js';

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

    // === ALLGEMEIN - Einheiten ===
    settings.units = settings.units || {};

    const speedUnit = document.getElementById('setting-speed-unit');
    const distanceUnit = document.getElementById('setting-distance-unit');
    const depthUnit = document.getElementById('setting-depth-unit');
    const temperatureUnit = document.getElementById('setting-temperature-unit');
    const pressureUnit = document.getElementById('setting-pressure-unit');
    const volumeUnit = document.getElementById('setting-volume-unit');

    if (speedUnit) settings.units.speed = speedUnit.value;
    if (distanceUnit) settings.units.distance = distanceUnit.value;
    if (depthUnit) settings.units.depth = depthUnit.value;
    if (temperatureUnit) settings.units.temperature = temperatureUnit.value;
    if (pressureUnit) settings.units.pressure = pressureUnit.value;
    if (volumeUnit) settings.units.volume = volumeUnit.value;

    // === ALLGEMEIN - Formate ===
    const coordFormat = document.getElementById('setting-coordinate-format');
    if (coordFormat) settings.coordFormat = coordFormat.value;

    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        settings.language = langSelect.value;
        settings.ui = { ...(settings.ui || {}), language: langSelect.value };
        setLang(langSelect.value);
    }

    // === BOOT ===
    settings.boat = settings.boat || {};
    const boatName = document.getElementById('setting-boat-name');
    const boatType = document.getElementById('setting-boat-type');
    const boatLength = document.getElementById('setting-boat-length');
    const boatBeam = document.getElementById('setting-boat-beam');
    const boatDraft = document.getElementById('setting-boat-draft');
    const boatHeight = document.getElementById('setting-boat-height');
    const boatFuelCapacity = document.getElementById('setting-boat-fuel-capacity');
    const boatFuelConsumption = document.getElementById('setting-boat-fuel-consumption');
    const boatCruiseSpeed = document.getElementById('setting-boat-cruise-speed');

    if (boatName) settings.boat.name = boatName.value;
    if (boatType) settings.boat.type = boatType.value;
    if (boatLength) settings.boat.length = parseFloat(boatLength.value) || 0;
    if (boatBeam) settings.boat.beam = parseFloat(boatBeam.value) || 0;
    if (boatDraft) settings.boat.draft = parseFloat(boatDraft.value) || 0;
    if (boatHeight) settings.boat.height = parseFloat(boatHeight.value) || 0;
    if (boatFuelCapacity) settings.boat.fuelCapacity = parseFloat(boatFuelCapacity.value) || 0;
    if (boatFuelConsumption) settings.boat.fuelConsumption = parseFloat(boatFuelConsumption.value) || 0;
    if (boatCruiseSpeed) settings.boat.cruiseSpeed = parseFloat(boatCruiseSpeed.value) || 0;

    // Boot-Icon aus aktivem Element
    const activeIcon = document.querySelector('.boat-icon-option.active');
    if (activeIcon) settings.boat.icon = activeIcon.dataset.icon;

    // === KARTE ===
    settings.map = settings.map || {};
    const mapStyleSelect = document.getElementById('setting-map-style');
    if (mapStyleSelect) settings.map.style = mapStyleSelect.value;

    // Toggle-Werte aus aktiven Zuständen lesen
    const toggleOpenSeaMap = document.getElementById('toggle-openseamap');
    const toggleLocks = document.getElementById('toggle-locks');
    const togglePegel = document.getElementById('toggle-pegel');
    const toggleTrack = document.getElementById('toggle-track');
    const toggleAutoCenter = document.getElementById('toggle-autocenter');
    const toggleHeadingUp = document.getElementById('toggle-headingup');

    if (toggleOpenSeaMap) settings.map.openSeaMap = toggleOpenSeaMap.classList.contains('active');
    if (toggleLocks) settings.map.showLocks = toggleLocks.classList.contains('active');
    if (togglePegel) settings.map.showPegel = togglePegel.classList.contains('active');
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
    const dailyHours = document.getElementById('setting-daily-travel-hours');
    const dayStartTime = document.getElementById('setting-day-start-time');
    if (dailyHours) settings.navigation.dailyTravelHours = parseFloat(dailyHours.value) || 0;
    if (dayStartTime) settings.navigation.dayStartTime = dayStartTime.value || '08:00';

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

    // === GPS ===
    settings.gps = settings.gps || {};
    const signalkUrl = document.getElementById('setting-signalk-url');
    const lowSatThreshold = document.getElementById('setting-low-satellite-threshold');
    const gpsSource = document.getElementById('setting-gps-source');

    if (signalkUrl) settings.gps.signalkUrl = signalkUrl.value;
    if (lowSatThreshold) settings.gps.lowSatelliteThreshold = parseInt(lowSatThreshold.value) || 15;
    if (gpsSource) settings.gps.source = gpsSource.value;

    // === ROUTING ===
    settings.routing = settings.routing || {};
    const routingProvider = document.getElementById('setting-routing-provider');
    const osrmUrl = document.getElementById('setting-osrm-url');
    const graphhopperApiKey = document.getElementById('setting-graphhopper-api-key');
    const toggleWaterCurrent = document.getElementById('toggle-water-current');

    if (routingProvider) settings.routing.provider = routingProvider.value;
    if (osrmUrl) settings.routing.osrmUrl = osrmUrl.value;
    if (graphhopperApiKey) settings.routing.graphhopperApiKey = graphhopperApiKey.value;
    if (toggleWaterCurrent) settings.routing.waterCurrentEnabled = toggleWaterCurrent.classList.contains('active');

    // Fließgeschwindigkeiten - Gewässer-spezifisch
    settings.routing.currents = settings.routing.currents || {};
    ['rhein', 'mosel', 'main', 'elbe', 'saale', 'donau'].forEach(name => {
        const el = document.getElementById(`setting-current-${name}`);
        if (el) settings.routing.currents[name] = parseFloat(el.value) || 0;
    });

    // Fließgeschwindigkeiten - nach Typ
    settings.routing.currentTypes = settings.routing.currentTypes || {};
    ['river', 'canal', 'stream', 'lake'].forEach(type => {
        const el = document.getElementById(`setting-current-type-${type}`);
        if (el) settings.routing.currentTypes[type] = parseFloat(el.value) || 0;
    });

    // Build waterCurrent object in format expected by backend water_current_service
    const nameMap = { rhein: 'Rhein', mosel: 'Mosel', main: 'Main', elbe: 'Elbe', saale: 'Saale', donau: 'Donau' };
    settings.waterCurrent = {
        enabled: settings.routing.waterCurrentEnabled === true,
        byName: {},
        byType: settings.routing.currentTypes || {}
    };
    ['rhein', 'mosel', 'main', 'elbe', 'saale', 'donau'].forEach(name => {
        const val = settings.routing.currents?.[name];
        if (val) settings.waterCurrent.byName[nameMap[name]] = { current_kmh: val, type: 'river' };
    });

    // Lokal speichern
    if (ui?.saveSettings) {
        ui.saveSettings(settings);
    } else {
        localStorage.setItem('boatos_settings', JSON.stringify(settings));
    }

    // Ans Backend senden (damit AIS, Routing etc. sofort neu konfiguriert werden)
    fetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    }).catch(err => console.warn('Settings-Backend-Sync fehlgeschlagen:', err));

    // Event für andere Module auslösen
    window.dispatchEvent(new CustomEvent('settingsChanged', { detail: { settings } }));

    // Sidebar schließen
    if (ui?.toggleSidebar) {
        ui.toggleSidebar();
    }

    // Notification anzeigen
    if (ui?.showNotification) {
        ui.showNotification(t('settingsSaved'), 'success');
    }

    console.log('Einstellungen gespeichert:', settings);
}

// ==================== LOAD SETTINGS ====================

/**
 * Alle Einstellungen in das Formular laden
 * Versucht zuerst localStorage, dann Backend als Fallback
 */
export async function loadAllSettings() {
    const ui = getUI();
    let settings = ui?.loadSettings ? ui.loadSettings() : {};

    // Always merge backend settings on top of localStorage — backend is authoritative
    // (localStorage may be empty, default-only, or from a different browser origin)
    try {
        const res = await fetch(`${API_URL}/api/settings`);
        const backendSettings = await res.json();
        if (backendSettings && backendSettings.boat?.name) {
            // Backend has real data — merge over current settings (backend wins)
            const merged = Object.assign({}, settings, backendSettings);
            if (ui?.saveSettings) ui.saveSettings(merged);
            else localStorage.setItem('boatos_settings', JSON.stringify(merged));
            settings = merged;
            console.log('Einstellungen vom Backend geladen:', backendSettings.boat?.name);
        }
    } catch (e) {
        console.warn('Backend-Settings nicht erreichbar, nutze localStorage:', e);
    }

    // === ALLGEMEIN - Einheiten ===
    if (settings.units) {
        const speedUnit = document.getElementById('setting-speed-unit');
        const distanceUnit = document.getElementById('setting-distance-unit');
        const depthUnit = document.getElementById('setting-depth-unit');
        const temperatureUnit = document.getElementById('setting-temperature-unit');
        const pressureUnit = document.getElementById('setting-pressure-unit');
        const volumeUnit = document.getElementById('setting-volume-unit');

        if (speedUnit && settings.units.speed) speedUnit.value = settings.units.speed;
        if (distanceUnit && settings.units.distance) distanceUnit.value = settings.units.distance;
        if (depthUnit && settings.units.depth) depthUnit.value = settings.units.depth;
        if (temperatureUnit && settings.units.temperature) temperatureUnit.value = settings.units.temperature;
        if (pressureUnit && settings.units.pressure) pressureUnit.value = settings.units.pressure;
        if (volumeUnit && settings.units.volume) volumeUnit.value = settings.units.volume;
    }

    // === ALLGEMEIN - Formate ===
    const coordFormat = document.getElementById('setting-coordinate-format');
    if (coordFormat && settings.coordFormat) coordFormat.value = settings.coordFormat;

    const langSelect = document.getElementById('setting-language');
    if (langSelect && settings.language) {
        langSelect.value = settings.language;
        setLang(settings.language);
    }

    // === BOOT ===
    if (settings.boat) {
        const boatName = document.getElementById('setting-boat-name');
        const boatType = document.getElementById('setting-boat-type');
        const boatLength = document.getElementById('setting-boat-length');
        const boatBeam = document.getElementById('setting-boat-beam');
        const boatDraft = document.getElementById('setting-boat-draft');
        const boatHeight = document.getElementById('setting-boat-height');
        const boatFuelCapacity = document.getElementById('setting-boat-fuel-capacity');
        const boatFuelConsumption = document.getElementById('setting-boat-fuel-consumption');
        const boatCruiseSpeed = document.getElementById('setting-boat-cruise-speed');

        if (boatName && settings.boat.name) boatName.value = settings.boat.name;
        if (boatType && settings.boat.type) boatType.value = settings.boat.type;
        if (boatLength && settings.boat.length) boatLength.value = settings.boat.length;
        if (boatBeam && settings.boat.beam) boatBeam.value = settings.boat.beam;
        if (boatDraft && settings.boat.draft) boatDraft.value = settings.boat.draft;
        if (boatHeight && settings.boat.height) boatHeight.value = settings.boat.height;
        if (boatFuelCapacity && settings.boat.fuelCapacity) boatFuelCapacity.value = settings.boat.fuelCapacity;
        if (boatFuelConsumption && settings.boat.fuelConsumption) boatFuelConsumption.value = settings.boat.fuelConsumption;
        if (boatCruiseSpeed && settings.boat.cruiseSpeed) boatCruiseSpeed.value = settings.boat.cruiseSpeed;

        // Boot-Icon aktivieren
        if (settings.boat.icon) {
            document.querySelectorAll('.boat-icon-option').forEach(el => {
                el.classList.toggle('active', el.dataset.icon === settings.boat.icon);
            });
        }
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
            'toggle-pegel': settings.map.showPegel,
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
        const dailyHours = document.getElementById('setting-daily-travel-hours');
        const dayStartTime = document.getElementById('setting-day-start-time');
        if (dailyHours && settings.navigation.dailyTravelHours !== undefined) dailyHours.value = settings.navigation.dailyTravelHours;
        if (dayStartTime && settings.navigation.dayStartTime) dayStartTime.value = settings.navigation.dayStartTime;
        // Werte an navigation.js weitergeben
        const navMod = moduleContext?.navigation;
        if (navMod?.setDailyTravelHours) navMod.setDailyTravelHours(settings.navigation.dailyTravelHours || 0);
        if (navMod?.setDayStartHour) {
            const parts = (settings.navigation.dayStartTime || '08:00').split(':');
            navMod.setDayStartHour(parseInt(parts[0]) || 8);
        }
        if (navMod?.refreshETADisplay) navMod.refreshETADisplay();
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

    // === GPS ===
    if (settings.gps) {
        const signalkUrl = document.getElementById('setting-signalk-url');
        const lowSatThreshold = document.getElementById('setting-low-satellite-threshold');
        const gpsSource = document.getElementById('setting-gps-source');

        if (signalkUrl && settings.gps.signalkUrl) signalkUrl.value = settings.gps.signalkUrl;
        if (lowSatThreshold && settings.gps.lowSatelliteThreshold) lowSatThreshold.value = settings.gps.lowSatelliteThreshold;
        if (gpsSource && settings.gps.source) gpsSource.value = settings.gps.source;
    }

    // Load GPS device config from backend (live from SignalK settings)
    try {
        const cfgResp = await fetch(`${API_URL}/api/gps/config`);
        const cfg = await cfgResp.json();
        const devEl = document.getElementById('setting-gps-device');
        const baudEl = document.getElementById('setting-gps-baudrate');
        if (devEl && cfg.device) devEl.value = cfg.device;
        if (baudEl && cfg.baudrate) baudEl.value = String(cfg.baudrate);
    } catch (e) {}

    // === ROUTING ===
    if (settings.routing) {
        const routingProvider = document.getElementById('setting-routing-provider');
        const osrmUrl = document.getElementById('setting-osrm-url');
        const graphhopperApiKey = document.getElementById('setting-graphhopper-api-key');
        const toggleWaterCurrent = document.getElementById('toggle-water-current');

        if (routingProvider && settings.routing.provider) routingProvider.value = settings.routing.provider;
        if (osrmUrl && settings.routing.osrmUrl) osrmUrl.value = settings.routing.osrmUrl;
        if (graphhopperApiKey && settings.routing.graphhopperApiKey) graphhopperApiKey.value = settings.routing.graphhopperApiKey;
        if (toggleWaterCurrent) toggleWaterCurrent.classList.toggle('active', settings.routing.waterCurrentEnabled === true);

        // Fließgeschwindigkeiten laden
        if (settings.routing.currents) {
            ['rhein', 'mosel', 'main', 'elbe', 'saale', 'donau'].forEach(name => {
                const el = document.getElementById(`setting-current-${name}`);
                if (el && settings.routing.currents[name] !== undefined) el.value = settings.routing.currents[name];
            });
        }
        if (settings.routing.currentTypes) {
            ['river', 'canal', 'stream', 'lake'].forEach(type => {
                const el = document.getElementById(`setting-current-type-${type}`);
                if (el && settings.routing.currentTypes[type] !== undefined) el.value = settings.routing.currentTypes[type];
            });
        }
    }

    // Provider-Sichtbarkeit initial setzen
    updateRoutingProviderVisibility();

    console.log('Einstellungen geladen:', settings);
}

// ==================== DATA MANAGEMENT ====================

const API_URL = window.API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.hostname}`);

/**
 * Zeigt eine Benachrichtigung an
 */
function showMsg(message, duration = 3000) {
    const ui = getUI();
    if (ui?.showNotification) {
        ui.showNotification(message, 'info');
    } else if (ui?.showToast) {
        ui.showToast(message, 'info');
    } else {
        console.log(message);
    }
}

/**
 * Einstellungen auf Standardwerte zurücksetzen
 */
export function resetSettings() {
    if (!confirm(t('settingsResetConfirm'))) {
        return;
    }

    localStorage.removeItem('boatos_settings');
    showMsg(t('settingsReset'));

    // Seite neu laden um Defaults anzuwenden
    setTimeout(() => location.reload(), 1000);
}

/**
 * Einstellungen als JSON exportieren (kompletter Backend-Export)
 */
export async function exportSettings() {
    showMsg(t('settingsExporting'));
    try {
        const res = await fetch(`${API_URL}/api/data/export`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const cd = res.headers.get('Content-Disposition') || '';
        const match = cd.match(/filename=([^;]+)/);
        link.download = match ? match[1] : `boatos_export_${new Date().toISOString().slice(0,10)}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showMsg(t('settingsExported'));
    } catch (e) {
        showMsg(t('settingsExportError', { error: e.message }));
    }
}

/**
 * Einstellungen aus JSON importieren (kompletter Backend-Import)
 */
export function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        showMsg(t('settingsImporting'));
        try {
            const text = await file.text();
            const data = JSON.parse(text);

            const res = await fetch(`${API_URL}/api/data/import`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.status === 'error') throw new Error(result.error);

            const imp = result.imported || {};
            const parts = [];
            if (imp.settings)          parts.push('Einstellungen');
            if (imp.gps_device)        parts.push('GPS-Gerät');
            if (imp.logbook_trips > 0) parts.push(`${imp.logbook_trips} Logbuch-Einträge`);
            if (imp.crew_members > 0)  parts.push(`${imp.crew_members} Crewmitglieder`);
            if (imp.fuel_entries > 0)  parts.push(`${imp.fuel_entries} Tankeinträge`);

            const items = parts.join(', ') || t('settingsImportNothing');
            showMsg(t('settingsImported', { items }));

            if (result.errors?.length) {
                console.warn('Import-Warnungen:', result.errors);
            }

            // Einstellungen neu laden
            setTimeout(() => location.reload(), 1500);
        } catch (error) {
            console.error('Import error:', error);
            showMsg(t('settingsImportError', { error: error.message }));
        }
    };

    input.click();
}

// ==================== LOCKS DATABASE ====================

/**
 * Schleusen aus OpenStreetMap importieren
 */
export async function importLocksFromOSM() {
    if (!confirm(t('settingsLocksImportConfirm'))) {
        return;
    }

    showMsg(t('settingsLocksImportStart'));

    try {
        const response = await fetch(`${API_URL}/api/locks/import-osm`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMsg(t('settingsLocksImported', { imported: result.imported, updated: result.updated }));

            // Schleusen auf der Karte aktualisieren
            if (typeof window.updateLocksOnMap === 'function') {
                window.updateLocksOnMap();
            }
        } else {
            showMsg(t('settingsLocksImportError', { error: result.error }));
        }
    } catch (error) {
        console.error('OSM Import error:', error);
        showMsg(t('settingsLocksImportError', { error: error.message }));
    }
}

/**
 * Schleusen-Daten mit VHF-Kanälen und Kontaktdaten anreichern
 */
export async function enrichLocksData() {
    if (!confirm('Möchten Sie die Schleusen-Daten anreichern?\n\nVHF-Kanäle, Kontaktdaten und weitere Infos werden ergänzt.')) {
        return;
    }

    showMsg(t('settingsLocksEnrichStart'));

    try {
        const response = await fetch(`${API_URL}/api/locks/enrich`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMsg(t('settingsLocksEnriched', { enriched: result.enriched }));

            // Schleusen auf der Karte aktualisieren
            if (typeof window.updateLocksOnMap === 'function') {
                window.updateLocksOnMap();
            }

            // Qualitätsbericht automatisch anzeigen
            setTimeout(() => checkLocksQuality(), 1000);
        } else {
            showMsg(t('settingsLocksEnrichError', { error: result.error }));
        }
    } catch (error) {
        console.error('Enrichment error:', error);
        showMsg(t('settingsLocksEnrichError', { error: error.message }));
    }
}

/**
 * Qualitätsbericht der Schleusen-Datenbank anzeigen
 */
export async function checkLocksQuality() {
    showMsg(t('settingsQualityLoading'));

    try {
        const response = await fetch(`${API_URL}/api/locks/quality`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Bericht formatieren
            const report = `
Gesamtzahl Schleusen: ${result.total}

═══ VHF-Kanäle ═══
Mit VHF: ${result.vhf_count}/${result.total} (${result.vhf_percentage})

═══ Kontaktdaten ═══
Telefonnummern: ${result.phone_count}/${result.total} (${result.phone_percentage})
E-Mail-Adressen: ${result.email_count}/${result.total} (${result.email_percentage})

═══ Technische Daten ═══
Abmessungen (L × B): ${result.dimensions_count}/${result.total} (${result.dimensions_percentage})
Kilometer-Marken: ${result.km_count}/${result.total} (${result.km_percentage})

═══ Zusatzinformationen ═══
Notizen/Hinweise: ${result.notes_count}/${result.total} (${result.notes_percentage})

═══ Top Wasserstraßen ═══
${result.top_waterways?.map(w => `${w.waterway}: ${w.count} Schleusen`).join('\n') || 'Keine Daten'}

Datenstand: ${new Date().toLocaleString('de-DE')}
            `.trim();

            // Bericht anzeigen
            const contentEl = document.getElementById('locks-quality-content');
            const reportEl = document.getElementById('locks-quality-report');
            if (contentEl) contentEl.textContent = report;
            if (reportEl) reportEl.style.display = 'block';

            showMsg(t('settingsQualityLoaded'));
        } else {
            showMsg(t('settingsQualityError', { error: result.error }));
        }
    } catch (error) {
        console.error('Quality check error:', error);
        showMsg(t('settingsQualityError', { error: error.message }));
    }
}

/**
 * Schleusen-Positionen gegen OpenStreetMap überprüfen und korrigieren
 */
export async function verifyLocksPositions() {
    if (!confirm(t('settingsPosConfirm'))) {
        return;
    }

    showMsg(t('settingsPosStart'));

    try {
        const response = await fetch(`${API_URL}/api/locks/verify-positions`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMsg(t('settingsPosChecked', { checked: result.checked }));

            // Schleusen auf der Karte aktualisieren
            if (typeof window.updateLocksOnMap === 'function') {
                setTimeout(() => window.updateLocksOnMap(), 1000);
            }
        } else {
            showMsg(t('settingsLocksImportError', { error: result.error }));
        }
    } catch (error) {
        console.error('Position verification error:', error);
        showMsg(t('settingsLocksImportError', { error: error.message }));
    }
}

// ==================== ROUTING ====================

/**
 * Sichtbarkeit der Routing-Provider-Settings aktualisieren
 */
export function updateRoutingProviderVisibility() {
    const provider = document.getElementById('setting-routing-provider')?.value || 'osrm';
    const osrmSettings = document.getElementById('osrm-settings');
    const graphhopperSettings = document.getElementById('graphhopper-settings');

    if (osrmSettings) osrmSettings.style.display = provider === 'osrm' ? 'block' : 'none';
    if (graphhopperSettings) graphhopperSettings.style.display = provider === 'graphhopper' ? 'block' : 'none';
}

/**
 * OSRM-Region wechseln
 */
export async function switchOSRMRegion() {
    const regionSelector = document.getElementById('region-selector');
    const statusEl = document.getElementById('region-switch-status');
    const selectedRegion = regionSelector?.value;

    if (!selectedRegion) {
        showMsg('❌ Bitte eine Region auswählen');
        return;
    }

    if (statusEl) {
        statusEl.style.display = 'block';
        statusEl.textContent = `🔄 Wechsle zu ${selectedRegion}...`;
    }

    try {
        const response = await fetch(`${API_URL}/api/osrm/switch-region`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ region: selectedRegion })
        });

        const result = await response.json();

        if (result.success) {
            showMsg(`✅ Region gewechselt zu: ${selectedRegion}`);
            if (statusEl) statusEl.textContent = `✅ Aktiv: ${selectedRegion}`;
            const currentRegionName = document.getElementById('current-region-name');
            if (currentRegionName) currentRegionName.textContent = selectedRegion;
        } else {
            throw new Error(result.error || 'Fehler');
        }
    } catch (error) {
        showMsg(`❌ Fehler: ${error.message}`);
        if (statusEl) statusEl.textContent = `❌ ${error.message}`;
    }
}

export async function applyGpsConfig() {
    const device   = document.getElementById('setting-gps-device')?.value?.trim() || '/dev/ttyUSB0';
    const baudrate = parseInt(document.getElementById('setting-gps-baudrate')?.value || '4800');
    const statusEl = document.getElementById('gps-config-status');

    if (statusEl) { statusEl.textContent = '⏳ Wird übernommen…'; statusEl.style.display = 'block'; }

    try {
        const resp = await fetch(`${API_URL}/api/gps/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device, baudrate })
        });
        const result = await resp.json();
        if (result.status === 'ok') {
            if (statusEl) statusEl.textContent = `✅ ${device} @ ${baudrate} Baud — SignalK neugestartet`;
        } else {
            if (statusEl) statusEl.textContent = `❌ ${result.message || 'Fehler'}`;
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = `❌ Verbindungsfehler`;
    }
}
