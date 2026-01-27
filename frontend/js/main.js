/**
 * BoatOS Main Entry Point
 * Importiert alle Module und initialisiert die Anwendung
 *
 * @module main
 */

// ==================== MODULE IMPORTS ====================
import * as core from './core.js';
import * as theme from './theme.js';
import * as mapModule from './map.js';
import * as navigation from './navigation.js';
import * as weather from './weather.js';
import * as sensors from './sensors.js';
import * as ui from './ui.js';
import * as ais from './ais.js';
import * as logbook from './logbook.js';
import * as settings from './settings.js';

// ==================== UNIT SYSTEM ====================
let unitSettings = {
    distance: 'nm',
    speed: 'kn'
};

function getDistanceLabel() {
    if (unitSettings.distance === 'nm') return 'NM';
    if (unitSettings.distance === 'km') return 'km';
    return unitSettings.distance.toUpperCase();
}

function getSpeedLabel() {
    if (unitSettings.speed === 'kn' || unitSettings.speed === 'knots') return 'kn';
    if (unitSettings.speed === 'kmh') return 'km/h';
    return 'kn';
}

function convertDistanceFromNM(nm) {
    if (unitSettings.distance === 'km') return nm * 1.852;
    return nm;
}

function convertSpeedFromKn(kn) {
    if (unitSettings.speed === 'kmh') return kn * 1.852;
    return kn;
}

// Globale Formatierungsfunktionen
window.formatSpeed = function(knots, decimals = 1) {
    const converted = convertSpeedFromKn(knots);
    return `${converted.toFixed(decimals)} ${getSpeedLabel()}`;
};

window.formatDistance = function(nm, decimals = 1) {
    const converted = convertDistanceFromNM(nm);
    return `${converted.toFixed(decimals)} ${getDistanceLabel()}`;
};

window.formatDistanceMeters = function(meters, decimals = 1) {
    const nm = meters / 1852;
    const converted = convertDistanceFromNM(nm);
    return `${converted.toFixed(decimals)} ${getDistanceLabel()}`;
};

window.getUnitSettings = function() {
    return { ...unitSettings };
};

// Alle Einheiten-Labels im UI aktualisieren
function updateAllUnitLabels() {
    const distLabel = getDistanceLabel();
    const speedLabel = getSpeedLabel();

    // TopBar
    document.querySelectorAll('.unit-speed').forEach(el => el.textContent = speedLabel);
    document.querySelectorAll('.unit-distance').forEach(el => el.textContent = distLabel);

    // Spezifische Labels
    const sogLabel = document.getElementById('sog-label');
    if (sogLabel) sogLabel.textContent = `SOG ${speedLabel}`;

    const distLabelEl = document.getElementById('dist-label');
    if (distLabelEl) distLabelEl.textContent = distLabel;

    // Dashboard
    const dashSogLabel = document.getElementById('dash-sog-label');
    if (dashSogLabel) dashSogLabel.textContent = `SOG (${speedLabel})`;

    const dashDistLabel = document.getElementById('dash-dist-label');
    if (dashDistLabel) dashDistLabel.textContent = `Distanz (${distLabel})`;

    const dashWindLabel = document.getElementById('dash-wind-label');
    if (dashWindLabel) dashWindLabel.textContent = 'Wind';

    const dashTripLabel = document.getElementById('dash-trip-label');
    if (dashTripLabel) dashTripLabel.textContent = `${distLabel} heute`;

    const dashAvgLabel = document.getElementById('dash-avg-label');
    if (dashAvgLabel) dashAvgLabel.textContent = `Ø ${speedLabel}`;

    // Route Section
    const routeDistLabel = document.querySelector('#section-route .route-stat:first-child .label');
    if (routeDistLabel) routeDistLabel.textContent = distLabel;

    // Logbook Trip Section
    const tripDistLabel = document.getElementById('trip-dist-label');
    if (tripDistLabel) tripDistLabel.textContent = distLabel;

    const tripSpeedLabel = document.getElementById('trip-speed-label');
    if (tripSpeedLabel) tripSpeedLabel.textContent = `Ø ${speedLabel}`;

    // Weather Section
    const weatherWindLabel = document.getElementById('weather-wind-label');
    if (weatherWindLabel) weatherWindLabel.textContent = `Wind (${speedLabel})`;

    console.log('Unit labels aktualisiert:', { distLabel, speedLabel });
}

// ==================== ROUTE INFO ====================
function showRouteInfo(distanceNM, etaHours, etaMinutes, routeInfo, isReverse, isWaterway, avgSpeed, locksCount = 0) {
    console.log('showRouteInfo aufgerufen:', { distanceNM, etaHours, etaMinutes, locksCount });

    // Distanz anzeigen
    const distEl = document.getElementById('route-distance');
    const distLabel = document.querySelector('#section-route .route-stat:first-child .label');
    if (distEl) {
        const dist = convertDistanceFromNM(parseFloat(distanceNM));
        distEl.textContent = dist.toFixed(1);
    }
    if (distLabel) {
        distLabel.textContent = getDistanceLabel();
    }

    // Zeit formatieren
    const timeEl = document.getElementById('route-time');
    if (timeEl) {
        const hours = String(etaHours).padStart(2, '0');
        const mins = String(etaMinutes).padStart(2, '0');
        timeEl.textContent = `${hours}:${mins}`;
    }

    // ETA berechnen
    const etaEl = document.getElementById('route-eta');
    if (etaEl) {
        const now = new Date();
        const arrivalTime = new Date(now.getTime() + (etaHours * 60 + etaMinutes) * 60000);
        const arrivalHours = String(arrivalTime.getHours()).padStart(2, '0');
        const arrivalMins = String(arrivalTime.getMinutes()).padStart(2, '0');
        etaEl.textContent = `${arrivalHours}:${arrivalMins}`;
    }

    // Schleusen
    const locksEl = document.getElementById('route-locks');
    if (locksEl) {
        locksEl.textContent = locksCount.toString();
    }

    // TopBar aktualisieren
    const topDistEl = document.getElementById('dist-value');
    const topDistLabel = document.querySelector('.nav-value:nth-child(3) .label');
    if (topDistEl) {
        const dist = convertDistanceFromNM(parseFloat(distanceNM));
        topDistEl.textContent = dist.toFixed(1);
    }
    if (topDistLabel) {
        topDistLabel.textContent = getDistanceLabel();
    }

    const topEtaEl = document.getElementById('eta-value');
    if (topEtaEl && etaEl) {
        topEtaEl.textContent = etaEl.textContent;
    }

    console.log(`Route: ${distanceNM} NM, ETA: ${etaHours}h ${etaMinutes}min, Schleusen: ${locksCount}`);
}

// ==================== WAYPOINT LIST ====================
function updateWaypointList(context) {
    const listEl = document.getElementById('waypointList');
    if (!listEl) return;

    if (context.waypoints.length === 0) {
        listEl.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--text-dim);">
                Keine Route geplant.<br>
                <small>Klicke auf die Karte um Wegpunkte hinzuzufügen.</small>
            </div>`;
        return;
    }

    listEl.innerHTML = context.waypoints.map((wp, i) => `
        <div class="waypoint-item">
            <div class="waypoint-icon">${i + 1}</div>
            <div class="waypoint-info">
                <div class="waypoint-name">${wp.name}</div>
                <div class="waypoint-details">${wp.lat.toFixed(5)}, ${wp.lon.toFixed(5)}</div>
            </div>
            <div class="waypoint-actions">
                <button class="wp-btn" onclick="BoatOS.removeWaypoint(${i})" title="Löschen">🗑️</button>
            </div>
        </div>
    `).join('');
}

// ==================== TRIP STATUS ====================
async function checkTripStatus(context) {
    try {
        const apiUrl = logbook.getApiUrl();
        const response = await fetch(`${apiUrl}/api/track/status`);
        if (response.ok) {
            const status = await response.json();
            logbook.updateTripUI(status.recording === true, status.paused === true);

            // Trip-Statistiken aktualisieren
            const pointsEl = document.getElementById('trip-points');
            const distEl = document.getElementById('trip-distance');

            if (pointsEl) pointsEl.textContent = status.points || 0;
            if (distEl && status.distance) {
                const dist = window.formatDistance
                    ? window.formatDistance(parseFloat(status.distance))
                    : status.distance + ' NM';
                distEl.textContent = dist;
            }
        }
    } catch (e) {
        console.log('Trip-Status Abfrage fehlgeschlagen:', e);
    }

    // Logbuch-Einträge laden
    logbook.loadLogEntries();
}

// ==================== GLOBAL BOATOS OBJECT ====================
// Für onclick Handler im HTML
window.BoatOS = {
    // Module-Referenzen
    core,
    theme,
    map: mapModule,
    navigation,
    weather,
    sensors,
    ui,
    ais,
    logbook,
    settings,

    // Context (wird bei Init gesetzt)
    context: null,

    // API URL Helper
    getApiUrl: logbook.getApiUrl,

    // === NAVIGATION CONTROLS ===
    toggleNavigation: function() {
        const ctx = this.context || {};
        const navContext = {
            waypoints: ctx.waypoints || [],
            showNotification: ui.showNotification,
            currentPosition: ctx.currentPosition || core.currentPosition || null
        };

        if (navigation.toggleNavigation) {
            navigation.toggleNavigation(navContext);
        }
        this.updateNavButton();
    },

    stopNavigation: function() {
        if (navigation.stopNavigation) {
            navigation.stopNavigation({ showNotification: ui.showNotification });
        }
        this.updateNavButton();
    },

    updateNavButton: function() {
        const btn = document.getElementById('btn-start-nav');
        if (btn) {
            const isActive = navigation.isNavigationActive ? navigation.isNavigationActive() : false;
            if (isActive) {
                btn.innerHTML = '⏸️';
                btn.title = 'Navigation pausieren';
                btn.style.background = 'var(--warning)';
            } else {
                btn.innerHTML = '▶️';
                btn.title = 'Navigation starten';
                btn.style.background = 'var(--success)';
            }
        }
    },

    editRoute: function() {
        if (navigation.editRoute) {
            navigation.editRoute();
        }
        ui.showNotification('Route bearbeiten - Wegpunkte verschieben', 'info');
    },

    // === WAYPOINT FROM CLICK (for navigation module) ===
    addWaypointFromClick: function(lat, lon) {
        if (window.addWaypointFromClick) {
            window.addWaypointFromClick(lat, lon);
        } else {
            console.warn('addWaypointFromClick not available');
        }
    },

    // === SET ROUTE PLANNING MODE (for navigation module) ===
    setRoutePlanningMode: function(active) {
        if (window.setRoutePlanningMode) {
            window.setRoutePlanningMode(active);
        } else {
            console.warn('setRoutePlanningMode not available');
        }
    },

    clearRoute: function() {
        const ctx = this.context || {};
        if (navigation.clearRoute) {
            navigation.clearRoute(ctx);
        }

        ctx.waypoints = [];
        ctx.waypointMarkers = [];

        const waypointList = document.getElementById('waypointList');
        if (waypointList) {
            waypointList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-dim);">
                    Keine Route geplant.<br>
                    <small>Klicke auf die Karte um Wegpunkte hinzuzufügen.</small>
                </div>
            `;
        }

        const routeDist = document.getElementById('route-distance');
        const routeTime = document.getElementById('route-time');
        const routeLocks = document.getElementById('route-locks');
        const routeEta = document.getElementById('route-eta');
        if (routeDist) routeDist.textContent = '--';
        if (routeTime) routeTime.textContent = '--:--';
        if (routeLocks) routeLocks.textContent = '0';
        if (routeEta) routeEta.textContent = '--:--';

        this.stopNavigation();
        ui.showNotification('Route gelöscht', 'info');
    },

    removeWaypoint: function(index) {
        navigation.removeWaypoint(index, this.context);
        updateWaypointList(this.context);
    },

    // === LOGBOOK FUNCTIONS (delegated) ===
    startTrip: () => logbook.startTrip(),
    confirmStartTrip: () => logbook.confirmStartTrip(),
    closeCrewModal: () => logbook.closeCrewModal(),
    stopTrip: () => logbook.stopTrip(),
    pauseTrip: () => logbook.pauseTrip(),
    resumeTrip: () => logbook.resumeTrip(),
    addLogEntry: () => logbook.addLogEntry(),
    closeManualEntryModal: () => logbook.closeManualEntryModal(),
    submitManualEntry: () => logbook.submitManualEntry(),
    updateTripUI: (isRecording, isPaused) => logbook.updateTripUI(isRecording, isPaused),
    updateTripButtons: (isActive) => logbook.updateTripUI(isActive, false),
    loadLogEntries: () => logbook.loadLogEntries(),
    showLogbookTab: (tab, element) => logbook.showLogbookTab(tab, element),
    loadArchivedTrips: () => logbook.loadArchivedTrips(),
    exportTrip: (tripId) => logbook.exportTrip(tripId),
    viewTripOnMap: (tripId) => logbook.viewTripOnMap(tripId),
    deleteTrip: (tripId) => logbook.deleteTrip(tripId),

    // === SETTINGS FUNCTIONS (delegated) ===
    saveAllSettings: () => settings.saveAllSettings(),
    loadAllSettings: () => settings.loadAllSettings()
};

// ==================== INITIALIZATION ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('BoatOS wird initialisiert...');

    // Theme initialisieren
    theme.initTheme();

    // Karte initialisieren
    const mapInstance = mapModule.initMap({
        container: 'map',
        center: { lat: 51.855, lon: 12.046 },
        zoom: 13
    });

    // Warten bis Karte geladen ist
    if (mapInstance) {
        mapInstance.on('load', () => {
            console.log('Karte geladen');

            if (mapModule.createBoatMarker) {
                mapModule.createBoatMarker('motorboat_small');
            }

            if (mapModule.initTrackLayer) {
                mapModule.initTrackLayer();
            }

            // Schleusen-Layer initialisieren (locks.js)
            if (typeof window.setLocksMap === 'function') {
                window.setLocksMap(mapInstance);
            }
            if (typeof window.initLocksLayer === 'function') {
                window.initLocksLayer(mapInstance);
                console.log('Schleusen-Layer initialisiert');
            }

            // AIS-Modul Map-Referenz setzen für Pegelstände
            if (ais.initAISModule) {
                ais.initAISModule(mapInstance);
                console.log('AIS-Modul initialisiert');
            }

            // Layer-Sichtbarkeit basierend auf Einstellungen initialisieren
            if (ui.initLayerVisibility) {
                ui.initLayerVisibility();
            }

            // Charts-Modul initialisieren (charts.js)
            if (typeof window.setChartsMap === 'function') {
                window.setChartsMap(mapInstance);
            }
            if (typeof window.loadCharts === 'function') {
                window.loadCharts();
                console.log('Charts-Modul initialisiert');
            }
        });
    }

    // Core initialisieren
    if (core.init) {
        core.init();
    }

    // Einstellungen laden
    if (ui.loadSettings) {
        const loadedSettings = ui.loadSettings();
        if (loadedSettings.units) {
            unitSettings.distance = loadedSettings.units.distance || 'nm';
            unitSettings.speed = loadedSettings.units.speed === 'knots' ? 'kn' :
                                 loadedSettings.units.speed === 'kmh' ? 'kmh' : 'kn';
        }
    }

    // Settings-Change Event
    window.addEventListener('settingsChanged', (e) => {
        const changedSettings = e.detail.settings;
        if (changedSettings.units) {
            unitSettings.distance = changedSettings.units.distance || 'nm';
            unitSettings.speed = changedSettings.units.speed === 'knots' ? 'kn' :
                                 changedSettings.units.speed === 'kmh' ? 'kmh' : 'kn';
            console.log('Einheiten aktualisiert:', unitSettings);
            updateAllUnitLabels();
        }
    });

    // Kontext erstellen
    const context = {
        map: mapInstance,
        API_URL: core.API_URL,
        currentPosition: core.currentPosition || { lat: 51.855, lon: 12.046 },
        showNotification: ui.showNotification || ((msg, type) => console.log(`[${type}] ${msg}`)),
        showRouteInfo: showRouteInfo,
        waypoints: [],
        waypointMarkers: []
    };

    // Kontext global verfügbar machen
    window.BoatOS.context = context;

    // Logbook-Kontext setzen
    logbook.setContext(context);

    // Settings-Kontext setzen
    settings.setContext({ ui, navigation, core });

    // Route-Update Funktion
    context.updateRoute = async () => {
        if (context.waypoints.length >= 2) {
            await navigation.calculateRoute(context);
        }
        updateWaypointList(context);
    };

    // UI initialisieren
    if (ui.initUI) ui.initUI();

    // Einheiten-Labels aktualisieren
    updateAllUnitLabels();

    // Wetter starten
    if (weather.startWeatherUpdates) weather.startWeatherUpdates();

    // AIS initialisieren
    if (ais.initAISModule) {
        ais.initAISModule(mapInstance, context.currentPosition);
    }

    // Kompass erstellen
    if (sensors.createCompassRose) sensors.createCompassRose();

    // GPS-Updates weiterleiten
    if (core.onGpsUpdate && sensors.handleGPSUpdate) {
        core.onGpsUpdate((gpsData) => {
            sensors.handleGPSUpdate(gpsData);

            if (mapModule.updateBoatPosition && gpsData.lat && gpsData.lon) {
                mapModule.updateBoatPosition(gpsData);
            }

            if (mapModule.addToTrackHistory && gpsData.lat && gpsData.lon) {
                mapModule.addToTrackHistory(gpsData.lat, gpsData.lon);
            }

            window.BoatOS.context.currentPosition = { lat: gpsData.lat, lon: gpsData.lon };

            if (navigation.isNavigationActive && navigation.isNavigationActive()) {
                navigation.updateNavigation(gpsData.lat, gpsData.lon, window.BoatOS.context);
            }
        });
    }

    // Mapclick-Handler - leitet an Navigation-Modul für Mode-Prüfung weiter
    window.addEventListener('mapclick', (e) => {
        const { lngLat } = e.detail;

        // Navigation-Modul entscheidet basierend auf aktivem Modus
        if (navigation.handleMapClick) {
            navigation.handleMapClick(lngLat);
        }
    });

    // Event-Listener für Mode-Änderungen
    window.addEventListener('mapInteractionModeChanged', (e) => {
        console.log('Map-Modus geändert:', e.detail.mode);
    });

    // Theme-Wechsel-Event
    window.addEventListener('themechange', (e) => {
        console.log('Theme gewechselt:', e.detail.isDark ? 'Dark' : 'Light');
    });

    // Settings laden
    settings.loadAllSettings();

    // Trip-Status prüfen
    checkTripStatus(context);

    // Dashboard initialisieren und laden
    if (window.dashboardRenderer) {
        console.log('Dashboard wird geladen...');
        window.dashboardRenderer.loadAndRender();
    }

    // Globale Funktionen für Navigation-Modul
    window.updateWaypointList = () => updateWaypointList(context);

    console.log('BoatOS bereit!');
});

// Export für andere Module falls nötig
export { updateAllUnitLabels, showRouteInfo, updateWaypointList };
