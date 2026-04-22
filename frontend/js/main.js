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
import * as wifi from './wifi.js';
import { initKeyboard } from './keyboard.js';

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
    updateSimButton();

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

    // ETA berechnen — mit Tageslimit falls gesetzt
    const etaEl = document.getElementById('route-eta');
    if (etaEl) {
        const etaData = navigation.calculateETA(parseFloat(distanceNM), avgSpeed || 6);
        etaEl.textContent = navigation.formatArrivalTime(etaData.arrivalTime);
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
    if (topEtaEl && etaEl) topEtaEl.textContent = etaEl.textContent;

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
        updateSimButton();
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
                <button class="wp-btn" onclick="BoatOS.removeWaypoint(${i})" title="Löschen"
                    ${navigation.isNavigationActive && navigation.isNavigationActive() ? 'disabled style="opacity:0.3;cursor:not-allowed;"' : ''}>🗑️</button>
            </div>
        </div>
    `).join('');

    updateSimButton();
    window.BoatOS?.updateNavButton();
}

// ==================== SIMULATION ====================
let simInterval = null;
let simDistanceTraveled = 0;
let simMultiplier = 25; // ×25 = ~13 m/tick
let simSavedPosition = null; // Boot-Position vor Simulation sichern

function simHaversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function simBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180)
            - Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function interpolateAlongRoute(coords, targetDist) {
    let accumulated = 0;
    for (let i = 0; i < coords.length - 1; i++) {
        const segDist = simHaversine(coords[i].lat, coords[i].lon, coords[i+1].lat, coords[i+1].lon);
        if (accumulated + segDist >= targetDist) {
            const t = segDist > 0 ? (targetDist - accumulated) / segDist : 0;
            return {
                lat: coords[i].lat + t * (coords[i+1].lat - coords[i].lat),
                lon: coords[i].lon + t * (coords[i+1].lon - coords[i].lon),
                bearing: simBearing(coords[i].lat, coords[i].lon, coords[i+1].lat, coords[i+1].lon)
            };
        }
        accumulated += segDist;
    }
    return null; // Route abgefahren
}

function simTick() {
    const routeCoords = navigation.getCurrentRouteCoordinates
        ? navigation.getCurrentRouteCoordinates()
        : null;
    if (!routeCoords || routeCoords.length < 2) { stopSimulation(); return; }

    // Meter pro Tick (100ms): Basis 10 kn × Multiplikator
    simDistanceTraveled += simMultiplier * 10 * 1852 / 36000;

    const pos = interpolateAlongRoute(routeCoords, simDistanceTraveled);
    if (!pos) {
        stopSimulation();
        if (ui.showNotification) ui.showNotification('🏁 Simulation beendet', 'info');
        return;
    }

    mapModule.updateBoatPosition({ lat: pos.lat, lon: pos.lon, course: pos.bearing });
    window.currentPosition = { lat: pos.lat, lon: pos.lon };
}

function startSimulation() {
    const routeCoords = navigation.getCurrentRouteCoordinates
        ? navigation.getCurrentRouteCoordinates()
        : null;
    if (!routeCoords || routeCoords.length < 2) {
        if (ui.showNotification) ui.showNotification('Keine berechnete Route für Simulation', 'warning');
        return;
    }
    simSavedPosition = window.currentPosition ? { ...window.currentPosition } : null;
    simDistanceTraveled = 0;
    simInterval = setInterval(simTick, 100);
    setSimButtonState(true);
    mapModule.setAutoFollow(true);
    mapModule.updateFollowButton && mapModule.updateFollowButton(true);
    if (ui.showNotification) ui.showNotification('▶ Simulation gestartet', 'info');
}

function stopSimulation() {
    if (simInterval) { clearInterval(simInterval); simInterval = null; }
    setSimButtonState(false);
    // Boot-Marker zurück auf echte Position
    if (simSavedPosition) {
        mapModule.updateBoatPosition(simSavedPosition);
        window.currentPosition = simSavedPosition;
    }
}

function setSimButtonState(running) {
    const btn = document.getElementById('btn-simulation');
    const bar = document.getElementById('sim-speed-bar');
    if (btn) {
        btn.textContent = running ? '⏹ Stop' : '▶ Simulation';
        btn.style.background = running ? 'var(--danger)' : 'var(--success)';
    }
    if (bar) bar.style.display = running ? 'flex' : 'none';
}

function _toDatetimeLocalString(date) {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function updateSimButton() {
    const btn = document.getElementById('btn-simulation');
    if (!btn) return;
    const hasRoute = !!(navigation.getCurrentRouteCoordinates
        && navigation.getCurrentRouteCoordinates()?.length >= 2);
    const navActive = navigation.isNavigationActive && navigation.isNavigationActive();
    const simRunning = simInterval !== null;
    btn.style.display = (hasRoute && !navActive) || simRunning ? 'flex' : 'none';
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
    wifi,

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

        updateSimButton();

        // When navigation starts: enable auto-follow and fly to boat
        if (navigation.isNavigationActive && navigation.isNavigationActive()) {
            if (mapModule.centerOnBoat) {
                mapModule.centerOnBoat();
            }
        }
    },

    stopNavigation: function() {
        if (navigation.stopNavigation) {
            navigation.stopNavigation({ showNotification: ui.showNotification });
        }
        this.updateNavButton();
    },

    updateNavButton: function() {
        const isActive = navigation.isNavigationActive ? navigation.isNavigationActive() : false;
        const hasRoute = (window.BoatOS?.context?.waypoints?.length >= 2);

        // Sheet-Button (kleines Icon)
        const btn = document.getElementById('btn-start-nav');
        if (btn) {
            btn.innerHTML = isActive ? '⏸️' : '▶️';
            btn.title = isActive ? 'Navigation stoppen' : 'Navigation starten';
            btn.style.background = isActive ? 'var(--warning)' : 'var(--success)';
        }

        // Map-Button (Pill, top-left)
        const mapBtn = document.getElementById('btn-nav-map');
        if (mapBtn) {
            const visible = hasRoute || isActive;
            mapBtn.style.display = visible ? 'flex' : 'none';
            mapBtn.textContent = isActive ? '⏹ Navigation' : '▶ Navigation';
            mapBtn.style.background = isActive ? 'var(--danger)' : 'var(--success)';
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

        // Top-bar zurücksetzen
        const topDist = document.getElementById('dist-value');
        const topEta = document.getElementById('eta-value');
        const topDistLabel = document.getElementById('dist-label');
        if (topDist) topDist.textContent = '--';
        if (topEta) topEta.textContent = '--:--';
        if (topDistLabel) topDistLabel.textContent = 'NM';

        this.stopNavigation();
        updateSimButton();
        ui.showNotification('Route gelöscht', 'info');
    },

    removeWaypoint: function(index) {
        if (navigation.isNavigationActive && navigation.isNavigationActive()) return;
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
    loadCrewManagement: () => logbook.loadCrewManagement(),
    showCrewManageModal: (member) => logbook.showCrewManageModal(member),
    closeCrewManageModal: () => logbook.closeCrewManageModal(),
    editCrewMember: (id) => logbook.editCrewMember(id),
    deleteCrewMemberConfirm: (id) => logbook.deleteCrewMemberConfirm(id),
    submitCrewManageForm: () => logbook.submitCrewManageForm(),
    _selectCrewAvatar: (emoji) => logbook.selectCrewAvatar(emoji),

    // === DEPARTURE TIME ===
    setDepartureNow: function() {
        navigation.setDepartureTime(null);
        const input = document.getElementById('departure-datetime');
        if (input) input.value = _toDatetimeLocalString(new Date());
        navigation.refreshETADisplay();
    },
    onDepartureChanged: function(val) {
        navigation.setDepartureTime(val ? new Date(val) : null);
        navigation.refreshETADisplay();
    },

    // === SAVED ROUTES ===
    saveCurrentRouteWithName: async function() {
        const ctx = this.context || {};
        const wps = ctx.waypoints || [];
        if (wps.length < 2) {
            ui.showNotification('Mindestens 2 Wegpunkte benötigt', 'warning');
            return;
        }
        const distEl = document.getElementById('route-distance');
        const distNM = parseFloat(distEl?.textContent) || 0;
        const autoName = wps.map(w => w.name).join(' → ');
        const name = prompt('Routenname:', autoName);
        if (name === null) return; // cancelled
        try {
            await navigation.saveCurrentRoute(name || autoName, wps, distNM);
            ui.showNotification(`Route gespeichert: ${name || autoName}`, 'success');
        } catch(e) {
            ui.showNotification('Fehler beim Speichern', 'error');
        }
    },

    showSavedRoutesPanel: async function() {
        const existing = document.getElementById('saved-routes-panel');
        if (existing) { existing.remove(); return; }

        let routes;
        try {
            routes = await navigation.loadSavedRoutesList();
        } catch(e) {
            ui.showNotification('Fehler beim Laden der Routen', 'error');
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'saved-routes-panel';
        panel.style.cssText = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: var(--bg-panel); border: 1px solid var(--border);
            border-radius: var(--radius-xl); padding: var(--space-lg);
            z-index: 2000; width: min(420px, 92vw); max-height: 70vh;
            overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        `;

        const renderPanel = (routeList) => {
            panel.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-md);">
                    <span style="font-size:var(--fs-xl); font-weight:600; color:var(--accent);">📂 Gespeicherte Routen (${routeList.length})</span>
                    <button onclick="document.getElementById('saved-routes-panel').remove()"
                            style="background:none;border:none;color:var(--text-dim);font-size:var(--fs-xl);cursor:pointer;padding:4px 8px;">✕</button>
                </div>
                ${routeList.length === 0 ? `<div style="text-align:center;padding:var(--space-2xl);color:var(--text-dim);">Keine gespeicherten Routen</div>` :
                    routeList.map(r => {
                        const date = new Date(r.created).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit' });
                        const dist = r.totalDistanceNM ? ` · ${parseFloat(r.totalDistanceNM).toFixed(1)} NM` : '';
                        const wps = (r.waypoints || []).length;
                        return `
                        <div style="display:flex; align-items:center; gap:var(--space-md); padding:var(--space-sm) 0; border-bottom:1px solid var(--border);">
                            <div style="flex:1; min-width:0;">
                                <div style="font-weight:600; font-size:var(--fs-base); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name}</div>
                                <div style="font-size:var(--fs-sm); color:var(--text-dim);">${wps} Wegpunkte${dist} · ${date}</div>
                            </div>
                            <button onclick="window.BoatOS._loadSavedRoute(${JSON.stringify(r).replace(/"/g, '&quot;')})"
                                    style="padding:var(--space-xs) var(--space-md); background:var(--accent); color:white;
                                           border:none; border-radius:var(--radius-md); font-size:var(--fs-sm); cursor:pointer; white-space:nowrap; touch-action:manipulation;">
                                Laden
                            </button>
                            <button onclick="window.BoatOS._deleteSavedRoute('${r.id}', this)"
                                    style="padding:var(--space-xs) var(--space-sm); background:none; color:var(--text-dim);
                                           border:1px solid var(--border); border-radius:var(--radius-md); font-size:var(--fs-sm); cursor:pointer; touch-action:manipulation;">
                                🗑️
                            </button>
                        </div>`;
                    }).join('')
                }
            `;
        };

        renderPanel(routes);
        document.body.appendChild(panel);
    },

    _loadSavedRoute: function(route) {
        const ctx = this.context || {};
        // Clear current route first
        this.clearRoute();
        // Add waypoints one by one
        (route.waypoints || []).forEach((wp, i) => {
            navigation.addWaypoint({ name: wp.name, lat: wp.lat, lon: wp.lon }, ctx);
        });
        updateWaypointList(ctx);
        document.getElementById('saved-routes-panel')?.remove();
        ui.showNotification(`Route "${route.name}" geladen`, 'success');
    },

    _deleteSavedRoute: async function(routeId, btnEl) {
        if (!confirm('Route löschen?')) return;
        try {
            await navigation.deleteSavedRoute(routeId);
            // refresh panel
            document.getElementById('saved-routes-panel')?.remove();
            this.showSavedRoutesPanel();
        } catch(e) {
            ui.showNotification('Fehler beim Löschen', 'error');
        }
    },

    // === SIMULATION ===
    toggleSimulation: () => simInterval ? stopSimulation() : startSimulation(),
    setSimSpeed: (val) => {
        simMultiplier = Math.max(1, Math.min(1000, val));
        const lbl = document.getElementById('sim-speed-label');
        if (lbl) lbl.textContent = '×' + simMultiplier;
    },

    // === SETTINGS FUNCTIONS (delegated) ===
    saveAllSettings: () => settings.saveAllSettings(),
    loadAllSettings: () => settings.loadAllSettings()
};

// ==================== INITIALIZATION ====================
// Force dark styling on all <select> elements via inline style (reliable across all WebKit builds)
function applyDarkSelects() {
    const style = getComputedStyle(document.documentElement);
    const bg = style.getPropertyValue('--bg-card').trim() || '#141b2d';
    const fg = style.getPropertyValue('--text').trim() || '#e2e8f0';
    const border = style.getPropertyValue('--border').trim() || '#2a3550';
    document.querySelectorAll('select').forEach(el => {
        el.style.backgroundColor = bg;
        el.style.color = fg;
        el.style.borderColor = border;
        el.style.webkitAppearance = 'none';
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('BoatOS wird initialisiert...');

    // Theme initialisieren
    theme.initTheme();

    // Apply dark selects immediately and whenever settings panel opens
    applyDarkSelects();
    document.addEventListener('settingsPanelOpened', applyDarkSelects);

    // On-screen keyboard only on Pi kiosk (localhost) — external devices use their OS keyboard
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        initKeyboard();
    }

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
        // AIS-Modul mit gespeicherten Settings initialisieren (API-Key etc.)
        if (loadedSettings.ais && ais.updateAISSettings) {
            ais.updateAISSettings(loadedSettings.ais);
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
        // AIS-Settings an Modul weitergeben
        if (changedSettings.ais && ais.updateAISSettings) {
            ais.updateAISSettings(changedSettings.ais);
        }
        // Tagesplanung-Settings an navigation weitergeben
        if (changedSettings.navigation) {
            if (navigation.setDailyTravelHours) navigation.setDailyTravelHours(changedSettings.navigation.dailyTravelHours || 0);
            if (navigation.setDayStartHour) {
                const parts = (changedSettings.navigation.dayStartTime || '08:00').split(':');
                navigation.setDayStartHour(parseInt(parts[0]) || 8);
            }
            navigation.refreshETADisplay();
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

    // Layer-Sichtbarkeit sofort setzen (Button-Zustände, kein Map-Zugriff nötig)
    if (ui.initLayerVisibility) ui.initLayerVisibility();

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
            sensors.handleGPSUpdate(gpsData); // Sensor-Anzeige immer aktualisieren

            if (simInterval !== null) return; // Position während Simulation einfrieren

            if (mapModule.updateBoatPosition && gpsData.lat && gpsData.lon) {
                mapModule.updateBoatPosition(gpsData);
            }

            if (mapModule.addToTrackHistory && gpsData.lat && gpsData.lon) {
                mapModule.addToTrackHistory(gpsData.lat, gpsData.lon);
            }

            window.BoatOS.context.currentPosition = { lat: gpsData.lat, lon: gpsData.lon };

            if (navigation.isNavigationActive && navigation.isNavigationActive()) {
                navigation.updateNavigation(gpsData.lat, gpsData.lon, window.BoatOS.context);
            } else if (window.BoatOS.context.waypoints?.length >= 2) {
                // Route geplant aber Navigation noch nicht gestartet → Restdistanz + ETA live aktualisieren
                navigation.updateLiveETA(window.BoatOS.context);
            }
        });
    }

    // Browser Geolocation als Fallback starten
    if (sensors.startBrowserGpsFallback) {
        sensors.startBrowserGpsFallback((pos) => {
            if (simInterval !== null) return; // Position während Simulation einfrieren
            if (mapModule.updateBoatPosition) mapModule.updateBoatPosition(pos);
            window.BoatOS.context.currentPosition = { lat: pos.lat, lon: pos.lon };
            if (navigation.isNavigationActive && navigation.isNavigationActive()) {
                navigation.updateNavigation(pos.lat, pos.lon, window.BoatOS.context);
            }
        });
    }

    // Mapclick-Handler - leitet an Navigation-Modul für Mode-Prüfung weiter
    window.addEventListener('mapclick', (e) => {
        const { lngLat, longPress } = e.detail;

        // Close AIS detail panel on map tap
        if (ais.closeAISDetails) ais.closeAISDetails();

        if (navigation.handleMapClick) {
            navigation.handleMapClick(lngLat, longPress);
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

    // Abfahrt-Input auf jetzt vorbelegen
    const depInput = document.getElementById('departure-datetime');
    if (depInput) depInput.value = _toDatetimeLocalString(new Date());

    // Globale Funktionen für Navigation-Modul
    window.updateWaypointList = () => updateWaypointList(context);

    console.log('BoatOS bereit!');
});

// Export für andere Module falls nötig
export { updateAllUnitLabels, showRouteInfo, updateWaypointList };
