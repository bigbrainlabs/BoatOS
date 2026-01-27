/**
 * BoatOS Navigation Modul
 *
 * Enthält alle Funktionen für:
 * - Routing (Route berechnen, API-Anfragen)
 * - Waypoint-Management (hinzufügen, entfernen, neu anordnen)
 * - Live-Navigation (starten, stoppen, aktualisieren)
 * - Route-Berechnungen (ETA, Distanz, Bearing)
 * - Waypoint-Marker Verwaltung
 * - Schleusenerkennung auf der Route
 */

// ==================== IMPORTS ====================
// Hinweis: Diese Variablen müssen aus den Hauptmodulen importiert werden
// wenn core.js und map.js als Module verfügbar sind

// Für jetzt: globale Variablen die vom Hauptmodul bereitgestellt werden
// import { map, API_URL, currentPosition, showNotification } from './core.js';
// import { waypoints, waypointMarkers } from './map.js';

// ==================== MODUL-INTERNE STATE VARIABLEN ====================

// Route-Koordinaten für XTE-Berechnung
let currentRouteCoordinates = null;

// Routen-Farbe für Segment-Hervorhebung
let currentRouteColor = '#3498db';

// Aktuelle Routen-Polyline Referenz
let currentRoutePolyline = null;

// Navigations-Status
let navigationActive = false;

// Navigations-Start Button Referenz
let navigationStartButton = null;

// AbortController für Route-Berechnungen
let routeCalculationController = null;

// Route-Daten für Live-ETA
let currentRouteData = {
    totalDistanceNM: 0,
    plannedEtaHours: 0,
    plannedEtaMinutes: 0,
    plannedSpeed: 5
};

// Route-Pfeil Marker
let routeArrows = [];
let routeArrowMarkers = [];

// Route-Label Marker
let routeLabelMarkers = [];

// Schleusen auf der Route
let locksOnRoute = [];
let lockWarnings = [];
let locksTimelinePanel = null;

// Segment-Hervorhebung Status
let currentSegmentActive = false;
let completedSegmentsActive = false;

// Fortschritts-Anzeige
let routeProgressDisplay = null;

// Nächster Wegpunkt Anzeige
let nextWaypointDisplay = null;

// Abbiegehinweis Anzeige
let turnByTurnDisplay = null;

// XTE-Warnungsanzeige
let xteWarningDisplay = null;

// ==================== MAP INTERACTION MODES ====================

// Verfügbare Modi: 'none', 'route', 'poi'
let mapInteractionMode = 'none';

// Referenz auf aktuell aktiven Quick-Action Button
let activeQuickActionButton = null;

/**
 * Aktiviert/Deaktiviert den Routen-Planungs-Modus
 * Im Route-Modus werden Klicks auf die Karte zu Wegpunkten
 */
export function startRoutePlanning() {
    // Wenn Route-Modus bereits aktiv, deaktivieren
    if (mapInteractionMode === 'route') {
        setMapInteractionMode('none');
        showNotificationSafe('🛤️ Routenplanung beendet');
        return;
    }

    // Route-Modus aktivieren
    setMapInteractionMode('route');
    showNotificationSafe('🛤️ Routenplanung aktiv - Tippe auf Karte für Wegpunkte');
}

/**
 * Aktiviert/Deaktiviert den POI-Platzierungs-Modus
 * Im POI-Modus werden Klicks auf die Karte zu Favoriten/POIs
 */
export function startPoiPlacement() {
    // Wenn POI-Modus bereits aktiv, deaktivieren
    if (mapInteractionMode === 'poi') {
        setMapInteractionMode('none');
        showNotificationSafe('📍 POI-Modus beendet');
        return;
    }

    // POI-Modus aktivieren
    setMapInteractionMode('poi');
    showNotificationSafe('📍 POI-Modus aktiv - Tippe auf Karte um Favorit zu setzen');
}

/**
 * Setzt den Map-Interaktions-Modus und aktualisiert UI
 * @param {string} mode - 'none', 'route', oder 'poi'
 */
export function setMapInteractionMode(mode) {
    mapInteractionMode = mode;

    // Quick-Action Buttons aktualisieren
    updateQuickActionStates();

    // Cursor aktualisieren
    updateMapCursor();

    // Event an app.js senden für routePlanningMode Kompatibilität
    if (window.BoatOS && window.BoatOS.setRoutePlanningMode) {
        window.BoatOS.setRoutePlanningMode(mode === 'route');
    }

    // Custom Event feuern für andere Module
    window.dispatchEvent(new CustomEvent('mapInteractionModeChanged', {
        detail: { mode }
    }));
}

/**
 * Gibt den aktuellen Interaktions-Modus zurück
 */
export function getMapInteractionMode() {
    return mapInteractionMode;
}

/**
 * Aktualisiert die Quick-Action Button Zustände
 */
function updateQuickActionStates() {
    // Alle Quick-Actions zurücksetzen
    document.querySelectorAll('.quick-action').forEach(el => {
        el.classList.remove('active');
    });

    // Aktiven Modus markieren
    if (mapInteractionMode === 'route') {
        const routeAction = document.querySelector('.quick-action[data-mode="route"]');
        if (routeAction) routeAction.classList.add('active');
    } else if (mapInteractionMode === 'poi') {
        const poiAction = document.querySelector('.quick-action[data-mode="poi"]');
        if (poiAction) poiAction.classList.add('active');
    }
}

/**
 * Aktualisiert den Map-Cursor basierend auf Modus
 */
function updateMapCursor() {
    const mapContainer = document.getElementById('map-container');
    if (!mapContainer) return;

    switch (mapInteractionMode) {
        case 'route':
            mapContainer.style.cursor = 'crosshair';
            break;
        case 'poi':
            mapContainer.style.cursor = 'copy';
            break;
        default:
            mapContainer.style.cursor = '';
            break;
    }
}

/**
 * Behandelt Map-Klicks basierend auf aktuellem Modus
 * Wird von main.js aufgerufen
 * @param {Object} lngLat - {lng, lat} Koordinaten
 */
export function handleMapClick(lngLat) {
    switch (mapInteractionMode) {
        case 'route':
            // Wegpunkt hinzufügen
            addWaypointFromMapClick(lngLat.lat, lngLat.lng);
            break;

        case 'poi':
            // POI-Dialog öffnen
            openPoiDialog(lngLat.lat, lngLat.lng);
            break;

        default:
            // Kein spezieller Modus - normales Verhalten (nichts tun)
            break;
    }
}

/**
 * Fügt einen Wegpunkt per Map-Click hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lng - Längengrad
 */
function addWaypointFromMapClick(lat, lng) {
    // Context aus BoatOS holen
    const context = window.BoatOS?.context;
    if (!context) {
        console.warn('BoatOS context nicht verfügbar');
        return;
    }

    const waypointNumber = (context.waypoints?.length || 0) + 1;

    const waypoint = {
        lat: lat,
        lon: lng,
        name: `WP ${waypointNumber}`,
        timestamp: new Date().toISOString()
    };

    // addWaypoint aus diesem Modul verwenden
    addWaypoint(waypoint, context);

    // Waypoint-Liste aktualisieren (falls Funktion verfügbar)
    if (window.updateWaypointList) {
        window.updateWaypointList(context);
    }

    showNotificationSafe(`📍 Wegpunkt ${waypointNumber} hinzugefügt`);
}

/**
 * Öffnet den POI-Erstellungs-Dialog
 * @param {number} lat - Breitengrad
 * @param {number} lon - Längengrad
 */
function openPoiDialog(lat, lon) {
    // Modal erstellen
    const modal = document.createElement('div');
    modal.id = 'poi-dialog';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
    `;

    const categories = [
        { id: 'marina', icon: '⚓', name: 'Marina' },
        { id: 'anchorage', icon: '🔱', name: 'Ankerplatz' },
        { id: 'fuel', icon: '⛽', name: 'Tankstelle' },
        { id: 'lock', icon: '🚧', name: 'Schleuse' },
        { id: 'bridge', icon: '🌉', name: 'Brücke' },
        { id: 'restaurant', icon: '🍽️', name: 'Restaurant' },
        { id: 'shop', icon: '🏪', name: 'Geschäft' },
        { id: 'danger', icon: '⚠️', name: 'Gefahrenstelle' },
        { id: 'other', icon: '📍', name: 'Sonstiges' }
    ];

    modal.innerHTML = `
        <div style="
            background: rgba(10, 14, 39, 0.98);
            border: 2px solid #64ffda;
            border-radius: 16px;
            padding: 24px;
            width: 90%;
            max-width: 400px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        ">
            <h3 style="margin: 0 0 16px 0; color: #64ffda; font-size: 18px;">
                📍 Neuer POI / Favorit
            </h3>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #8892b0; margin-bottom: 6px;">Name *</label>
                <input type="text" id="poi-name" placeholder="z.B. Schöner Ankerplatz" style="
                    width: 100%;
                    padding: 12px;
                    background: rgba(42, 82, 152, 0.3);
                    border: 1px solid rgba(100, 255, 218, 0.3);
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    box-sizing: border-box;
                ">
            </div>

            <div style="margin-bottom: 16px;">
                <label style="display: block; font-size: 12px; color: #8892b0; margin-bottom: 6px;">Kategorie</label>
                <div id="poi-categories" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                    ${categories.map((cat, index) => `
                        <button type="button" class="poi-category-btn ${index === 0 ? 'active' : ''}" data-category="${cat.id}" style="
                            padding: 10px;
                            background: ${index === 0 ? 'rgba(100, 255, 218, 0.2)' : 'rgba(42, 82, 152, 0.3)'};
                            border: 1px solid ${index === 0 ? '#64ffda' : 'rgba(100, 255, 218, 0.3)'};
                            border-radius: 8px;
                            color: white;
                            cursor: pointer;
                            font-size: 12px;
                            text-align: center;
                        ">
                            <div style="font-size: 20px; margin-bottom: 4px;">${cat.icon}</div>
                            ${cat.name}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div style="margin-bottom: 20px;">
                <label style="display: block; font-size: 12px; color: #8892b0; margin-bottom: 6px;">Notizen</label>
                <textarea id="poi-notes" placeholder="Optionale Beschreibung..." rows="3" style="
                    width: 100%;
                    padding: 12px;
                    background: rgba(42, 82, 152, 0.3);
                    border: 1px solid rgba(100, 255, 218, 0.3);
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    resize: vertical;
                    box-sizing: border-box;
                "></textarea>
            </div>

            <div style="font-size: 11px; color: #8892b0; margin-bottom: 16px;">
                📍 Position: ${lat.toFixed(6)}, ${lon.toFixed(6)}
            </div>

            <div style="display: flex; gap: 12px;">
                <button id="poi-cancel" style="
                    flex: 1;
                    padding: 12px;
                    background: rgba(231, 76, 60, 0.3);
                    border: 1px solid rgba(231, 76, 60, 0.5);
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    cursor: pointer;
                ">Abbrechen</button>
                <button id="poi-save" style="
                    flex: 1;
                    padding: 12px;
                    background: #27ae60;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">Speichern</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Focus auf Name-Input
    setTimeout(() => document.getElementById('poi-name').focus(), 100);

    // Kategorie-Button Handler
    modal.querySelectorAll('.poi-category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            modal.querySelectorAll('.poi-category-btn').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'rgba(42, 82, 152, 0.3)';
                b.style.borderColor = 'rgba(100, 255, 218, 0.3)';
            });
            btn.classList.add('active');
            btn.style.background = 'rgba(100, 255, 218, 0.2)';
            btn.style.borderColor = '#64ffda';
        });
    });

    // Abbrechen Handler
    document.getElementById('poi-cancel').addEventListener('click', () => {
        modal.remove();
    });

    // Speichern Handler
    document.getElementById('poi-save').addEventListener('click', async () => {
        const name = document.getElementById('poi-name').value.trim();
        if (!name) {
            showNotificationSafe('Bitte einen Namen eingeben', 'warning');
            document.getElementById('poi-name').focus();
            return;
        }

        const activeCategory = modal.querySelector('.poi-category-btn.active');
        const category = activeCategory ? activeCategory.dataset.category : 'other';
        const notes = document.getElementById('poi-notes').value.trim();

        // POI speichern
        if (window.saveFavorite) {
            const success = await window.saveFavorite(name, lat, lon, category, notes);
            if (success) {
                showNotificationSafe(`✅ POI "${name}" gespeichert`);
                modal.remove();

                // POI-Modus beenden
                setMapInteractionMode('none');
            }
        } else {
            console.error('saveFavorite function not found');
            showNotificationSafe('Fehler beim Speichern', 'error');
        }
    });

    // ESC zum Schließen
    const escHandler = (e) => {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', escHandler);
        }
    };
    document.addEventListener('keydown', escHandler);

    // Click außerhalb zum Schließen
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Sichere Notification-Funktion
 */
function showNotificationSafe(message, type = 'info') {
    if (window.BoatOS && window.BoatOS.ui && window.BoatOS.ui.showNotification) {
        window.BoatOS.ui.showNotification(message, type);
    } else if (window.showNotification) {
        window.showNotification(message, type);
    } else {
        console.log(`[${type}] ${message}`);
    }
}

// ==================== HILFSFUNKTIONEN ====================

/**
 * Haversine-Distanzberechnung zwischen zwei Punkten
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Längengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Längengrad Punkt 2
 * @returns {number} Distanz in Metern
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Erdradius in Metern
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Berechnet den Distanz zwischen zwei Punkten (Alias für haversineDistance)
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Längengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Längengrad Punkt 2
 * @returns {number} Distanz in Metern
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    return haversineDistance(lat1, lon1, lat2, lon2);
}

/**
 * Berechnet den Kurs (Bearing) zwischen zwei Punkten
 * @param {number} lat1 - Breitengrad Startpunkt
 * @param {number} lon1 - Längengrad Startpunkt
 * @param {number} lat2 - Breitengrad Endpunkt
 * @param {number} lon2 - Längengrad Endpunkt
 * @returns {number} Kurs in Grad (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180;
    const toDeg = 180 / Math.PI;

    lat1 = lat1 * toRad;
    lat2 = lat2 * toRad;
    const dLon = (lon2 - lon1) * toRad;

    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * toDeg;
    bearing = (bearing + 360) % 360;

    return bearing;
}

/**
 * Hilfsfunktion um Wegpunkt-Koordinaten zu erhalten
 * @param {Object} wp - Wegpunkt-Objekt
 * @returns {Object} Koordinaten {lat, lng}
 */
export function getWaypointLatLng(wp) {
    if (wp.marker && wp.marker.getLngLat) {
        const lngLat = wp.marker.getLngLat();
        return { lat: lngLat.lat, lng: lngLat.lng };
    }
    return { lat: wp.lat, lng: wp.lon };
}

/**
 * Erstellt Bounds aus einem Array von Punkten
 * @param {Array} points - Array von Punkten [{lat, lon}] oder [[lat, lon]]
 * @returns {Array|null} Bounds [[minLon, minLat], [maxLon, maxLat]]
 */
export function createBoundsFromPoints(points) {
    if (!points || points.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity;
    let minLon = Infinity, maxLon = -Infinity;
    points.forEach(p => {
        const lat = Array.isArray(p) ? p[0] : p.lat;
        const lon = Array.isArray(p) ? p[1] : p.lon;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lon < minLon) minLon = lon;
        if (lon > maxLon) maxLon = lon;
    });
    return [[minLon, minLat], [maxLon, maxLat]];
}

/**
 * Berechnet die kürzeste Distanz von einem Punkt zu einem Liniensegment
 * @param {number} pointLat - Breitengrad des Punktes
 * @param {number} pointLon - Längengrad des Punktes
 * @param {number} lineLat1 - Breitengrad Linien-Startpunkt
 * @param {number} lineLon1 - Längengrad Linien-Startpunkt
 * @param {number} lineLat2 - Breitengrad Linien-Endpunkt
 * @param {number} lineLon2 - Längengrad Linien-Endpunkt
 * @returns {Object} {distance: Meter, side: 'port'|'starboard', nearestPoint: {lat, lon}}
 */
export function pointToLineSegmentDistance(pointLat, pointLon, lineLat1, lineLon1, lineLat2, lineLon2) {
    // Vektor vom Linien-Start zum Punkt
    const pointVec = {
        lat: pointLat - lineLat1,
        lng: pointLon - lineLon1
    };

    // Vektor vom Linien-Start zum Linien-Ende
    const lineVec = {
        lat: lineLat2 - lineLat1,
        lng: lineLon2 - lineLon1
    };

    // Projektion des Punktes auf die Linie (Skalarprodukt)
    const lineLengthSquared = lineVec.lat * lineVec.lat + lineVec.lng * lineVec.lng;

    if (lineLengthSquared === 0) {
        // Liniensegment ist eigentlich ein Punkt
        return {
            distance: haversineDistance(pointLat, pointLon, lineLat1, lineLon1),
            side: 'unknown',
            nearestPoint: { lat: lineLat1, lon: lineLon1 }
        };
    }

    // Parameter t repräsentiert Position auf der Linie (0 = Start, 1 = Ende)
    let t = (pointVec.lat * lineVec.lat + pointVec.lng * lineVec.lng) / lineLengthSquared;
    t = Math.max(0, Math.min(1, t)); // Auf [0, 1] begrenzen

    // Nächster Punkt auf dem Liniensegment
    const nearestLat = lineLat1 + t * lineVec.lat;
    const nearestLng = lineLon1 + t * lineVec.lng;

    // Distanz vom Punkt zum nächsten Punkt auf der Linie
    const distance = haversineDistance(pointLat, pointLon, nearestLat, nearestLng);

    // Bestimme welche Seite (Backbord/Steuerbord) mittels Kreuzprodukt
    // Positiv = Steuerbord (rechts), Negativ = Backbord (links)
    const crossProduct = lineVec.lng * pointVec.lat - lineVec.lat * pointVec.lng;
    const side = crossProduct > 0 ? 'starboard' : 'port';

    return {
        distance: distance,
        side: side,
        nearestPoint: { lat: nearestLat, lon: nearestLng }
    };
}

/**
 * XML-Sonderzeichen escapen
 * @param {string} str - Eingabestring
 * @returns {string} Escapeter String
 */
export function escapeXML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * HTML-Sonderzeichen escapen
 * @param {string} str - Eingabestring
 * @returns {string} Escapeter String
 */
export function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== WEGPUNKT-MANAGEMENT ====================

/**
 * Fügt einen neuen Wegpunkt hinzu
 * @param {Object} waypoint - Wegpunkt-Daten {lat, lon, name, timestamp}
 * @param {Object} context - Kontext mit map, waypoints, API_URL
 */
export function addWaypoint(waypoint, context) {
    const { map, waypoints, API_URL, updateRoute } = context;
    const waypointNumber = waypoints.length + 1;

    // HTML-Element für Wegpunkt-Marker erstellen
    const el = document.createElement('div');
    el.className = 'waypoint-marker';
    el.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; width: 40px;">
            <div style="background: #3498db; color: white; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4); margin-bottom: 4px;">${waypoint.name}</div>
            <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); border: 4px solid white; border-radius: 50%; box-shadow: 0 3px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: white;">${waypointNumber}</div>
        </div>
    `;

    // MapLibre Marker mit Drag-Unterstützung erstellen
    const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'bottom' })
        .setLngLat([waypoint.lon, waypoint.lat])
        .addTo(map);

    // Drag-Event behandeln
    marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        // Wegpunkt-Koordinaten aktualisieren
        const wp = waypoints.find(w => w.marker === marker);
        if (wp) {
            wp.lat = lngLat.lat;
            wp.lon = lngLat.lng;
        }
        if (updateRoute) updateRoute();
    });

    // Klick zum Löschen
    el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Wegpunkt ${waypoint.name} löschen?`)) {
            marker.remove();
            const index = waypoints.findIndex(w => w.name === waypoint.name);
            if (index > -1) {
                waypoints.splice(index, 1);
            }
            if (updateRoute) updateRoute();
        }
    });

    waypoints.push({ ...waypoint, marker });

    // An Backend senden
    if (API_URL) {
        fetch(`${API_URL}/api/waypoints`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(waypoint)
        }).catch(err => console.error('Fehler beim Speichern des Wegpunkts:', err));
    }

    if (updateRoute) updateRoute();
}

/**
 * Entfernt einen Wegpunkt
 * @param {number} index - Index des Wegpunkts
 * @param {Object} context - Kontext mit waypoints, updateRoute
 */
export function removeWaypoint(index, context) {
    const { waypoints, updateRoute } = context;

    if (index >= 0 && index < waypoints.length) {
        const wp = waypoints[index];
        if (wp.marker) {
            wp.marker.remove();
        }
        waypoints.splice(index, 1);
        if (updateRoute) updateRoute();
    }
}

/**
 * Ordnet Wegpunkte neu an
 * @param {number} fromIndex - Ursprünglicher Index
 * @param {number} toIndex - Neuer Index
 * @param {Object} context - Kontext mit waypoints, updateRoute
 */
export function reorderWaypoints(fromIndex, toIndex, context) {
    const { waypoints, updateRoute } = context;

    if (fromIndex >= 0 && fromIndex < waypoints.length &&
        toIndex >= 0 && toIndex < waypoints.length) {
        const [removed] = waypoints.splice(fromIndex, 1);
        waypoints.splice(toIndex, 0, removed);
        if (updateRoute) updateRoute();
    }
}

// ==================== ROUTING-FUNKTIONEN ====================

/**
 * Berechnet die Route zwischen allen Wegpunkten
 * @param {Object} context - Kontext mit map, waypoints, API_URL, etc.
 */
export async function calculateRoute(context) {
    const { map, waypoints, API_URL, showRoutingLoader, hideRoutingLoader, showNotification } = context;

    // Laufende Route-Berechnung abbrechen
    if (routeCalculationController) {
        routeCalculationController.abort();
        console.log('Laufende Route-Berechnung abgebrochen');
    }

    // Neuen AbortController erstellen
    routeCalculationController = new AbortController();

    // Routen-Anzeige leeren
    clearRouteDisplay(context);

    if (waypoints.length < 2) {
        routeCalculationController = null;
        return;
    }

    // Lade-Indikator anzeigen
    if (showRoutingLoader) showRoutingLoader();

    try {
        // Koordinaten für API vorbereiten
        const coordinates = waypoints.map(w => {
            const lngLat = w.marker.getLngLat();
            return [lngLat.lng, lngLat.lat]; // [lon, lat]
        });

        const response = await fetch(`${API_URL}/api/route`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ waypoints: coordinates }),
            signal: routeCalculationController.signal
        });

        if (response.ok) {
            const routeData = await response.json();
            console.log('Backend-Antwort:', routeData);

            if (routeData.error) {
                console.warn('Routing-Fehler:', routeData.error);
                drawDirectRoute(context);
                if (hideRoutingLoader) hideRoutingLoader();
                return;
            }

            // Route aus Daten zeichnen
            if (routeData.geometry && routeData.geometry.coordinates) {
                const isWaterwayRouted = routeData.properties?.waterway_routed || false;
                const routingType = routeData.properties?.routing_type || 'waterway';

                if (routingType === 'direct' || !isWaterwayRouted) {
                    console.log('Verwende direkte Route (ENC-Routing nicht verfügbar)');
                    drawDirectRoute(context);
                    if (hideRoutingLoader) hideRoutingLoader();
                    return;
                }

                // Wasserweg-Route zeichnen
                drawWaterwayRoute(routeData, context);
                if (hideRoutingLoader) hideRoutingLoader();
                return;
            }
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Route-Berechnung abgebrochen');
            if (hideRoutingLoader) hideRoutingLoader();
            routeCalculationController = null;
            return;
        }
        console.error('ENC-Routing fehlgeschlagen:', error);
    }

    // Fallback auf direkte Route
    drawDirectRoute(context);
    if (hideRoutingLoader) hideRoutingLoader();
    routeCalculationController = null;
}

/**
 * Alias für calculateRoute
 */
export const fetchRoute = calculateRoute;

/**
 * Alias für calculateRoute
 */
export const updateRoute = calculateRoute;

/**
 * Zeichnet eine Wasserweg-Route auf der Karte
 * @param {Object} routeData - Routen-Daten vom Backend
 * @param {Object} context - Kontext
 */
function drawWaterwayRoute(routeData, context) {
    const { map, waypoints, showRouteInfo } = context;
    const coords = routeData.geometry.coordinates;
    const routeCoords = coords;

    // Route-Feature erstellen
    const routeFeature = {
        type: 'Feature',
        properties: { color: '#2ecc71' },
        geometry: {
            type: 'LineString',
            coordinates: routeCoords
        }
    };

    // GeoJSON-Quellen aktualisieren
    if (map.getSource('route-shadow')) {
        map.getSource('route-shadow').setData({
            type: 'FeatureCollection',
            features: [routeFeature]
        });
    }

    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'FeatureCollection',
            features: [routeFeature]
        });
    }

    // Route-Koordinaten für XTE-Berechnung speichern
    currentRouteCoordinates = routeCoords.map(c => ({ lat: c[1], lon: c[0] }));
    currentRouteColor = '#2ecc71';

    // Richtungspfeile hinzufügen
    addRouteArrows(context);

    // Distanz und ETA berechnen
    const distanceNM = routeData.properties?.distance_nm || 0;
    const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};
    let avgSpeed = 5;
    if (boatSettings.cruiseSpeed && boatSettings.cruiseSpeed > 0) {
        avgSpeed = boatSettings.cruiseSpeed / 1.852;
    }

    let etaHours;
    if (routeData.properties.duration_adjusted_h) {
        etaHours = routeData.properties.duration_adjusted_h;
    } else {
        etaHours = distanceNM / avgSpeed;
    }

    let etaHoursInt = Math.floor(etaHours);
    let etaMinutes = Math.round((etaHours - etaHoursInt) * 60);
    if (etaMinutes >= 60) {
        etaHoursInt += 1;
        etaMinutes = 0;
    }

    // Segment-Informationen
    const routeInfo = [];
    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = getWaypointLatLng(waypoints[i]);
        const to = getWaypointLatLng(waypoints[i + 1]);
        const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
        const segmentDist = haversineDistance(from.lat, from.lng, to.lat, to.lng) / 1852;

        routeInfo.push({
            from: waypoints[i].name,
            to: waypoints[i + 1].name,
            distance: segmentDist.toFixed(2),
            bearing: Math.round(bearing)
        });
    }

    // Schleusen-Daten extrahieren
    if (routeData.properties.locks_from_db) {
        locksOnRoute = routeData.properties.locks_from_db;
        console.log(`${locksOnRoute.length} Schleusen auf Route gefunden`);
    }

    if (routeData.properties.lock_warnings) {
        lockWarnings = routeData.properties.lock_warnings;
    }

    console.log(`Wasserweg-Route: ${distanceNM.toFixed(2)} NM`);

    // Route-Daten speichern
    currentRouteData = {
        totalDistanceNM: distanceNM,
        plannedEtaHours: etaHoursInt,
        plannedEtaMinutes: etaMinutes,
        plannedSpeed: avgSpeed
    };

    if (showRouteInfo) {
        showRouteInfo(distanceNM.toFixed(2), etaHoursInt, etaMinutes, routeInfo, false, true, avgSpeed, locksOnRoute.length);
    }

    // Schleusen-Timeline aktualisieren
    if (locksOnRoute.length > 0) {
        displayLocksTimeline(context);
    }
}

/**
 * Zeichnet eine direkte Route (Rhumbline) zwischen den Wegpunkten
 * @param {Object} context - Kontext
 */
export function drawDirectRoute(context) {
    const { map, waypoints, showRouteInfo } = context;

    // Wegpunkt-Positionen abrufen
    const points = waypoints.map(w => {
        const lnglat = w.marker.getLngLat();
        return [lnglat.lat, lnglat.lng];
    });

    // In GeoJSON-Koordinaten umwandeln [lon, lat]
    const routeCoords = points.map(p => [p[1], p[0]]);

    // Route-Schatten Quelle aktualisieren
    if (map.getSource('route-shadow')) {
        map.getSource('route-shadow').setData({
            type: 'Feature',
            geometry: {
                type: 'LineString',
                coordinates: routeCoords
            }
        });
    }

    // Haupt-Routen Quelle aktualisieren
    if (map.getSource('route')) {
        map.getSource('route').setData({
            type: 'Feature',
            properties: { color: '#3498db' },
            geometry: {
                type: 'LineString',
                coordinates: routeCoords
            }
        });
    }

    // Route-Koordinaten für XTE-Berechnung speichern
    currentRouteCoordinates = points.map(p => ({ lat: p[0], lon: p[1] }));
    currentRoutePolyline = { options: { originalColor: '#3498db' } };

    // Richtungspfeile hinzufügen
    addRouteArrows(context);

    let totalDistance = 0;
    let routeInfo = [];

    // Alte Route-Labels entfernen
    removeRouteLabels(context);

    for (let i = 0; i < waypoints.length - 1; i++) {
        const fromLngLat = waypoints[i].marker.getLngLat();
        const toLngLat = waypoints[i + 1].marker.getLngLat();
        const from = { lat: fromLngLat.lat, lng: fromLngLat.lng };
        const to = { lat: toLngLat.lat, lng: toLngLat.lng };
        const segmentDistance = haversineDistance(from.lat, from.lng, to.lat, to.lng);
        totalDistance += segmentDistance;

        const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);

        routeInfo.push({
            from: waypoints[i].name,
            to: waypoints[i + 1].name,
            distance: (segmentDistance / 1852).toFixed(2),
            bearing: Math.round(bearing)
        });

        const midLat = (from.lat + to.lat) / 2;
        const midLng = (from.lng + to.lng) / 2;

        const segmentDistFormatted = typeof formatDistance === 'function'
            ? formatDistance(segmentDistance)
            : `${(segmentDistance / 1852).toFixed(2)} NM`;

        // Route-Label als MapLibre HTML-Marker
        const labelEl = document.createElement('div');
        labelEl.className = 'route-label';
        labelEl.innerHTML = `<div style="background: rgba(52, 152, 219, 0.95); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.3);">
            ${segmentDistFormatted}<br>${Math.round(bearing)}°
        </div>`;

        const labelMarker = new maplibregl.Marker({ element: labelEl, anchor: 'center' })
            .setLngLat([midLng, midLat])
            .addTo(map);

        routeLabelMarkers.push(labelMarker);
    }

    const totalNM = (totalDistance / 1852).toFixed(2);

    // Geschwindigkeit aus Boot-Einstellungen
    const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};
    let avgSpeed = 5;
    if (boatSettings.cruiseSpeed && boatSettings.cruiseSpeed > 0) {
        avgSpeed = boatSettings.cruiseSpeed / 1.852;
    }

    const etaHours = totalNM / avgSpeed;
    let etaHoursInt = Math.floor(etaHours);
    let etaMinutes = Math.round((etaHours - etaHoursInt) * 60);
    if (etaMinutes >= 60) {
        etaHoursInt += 1;
        etaMinutes = 0;
    }

    // Route-Daten speichern
    currentRouteData = {
        totalDistanceNM: parseFloat(totalNM),
        plannedEtaHours: etaHoursInt,
        plannedEtaMinutes: etaMinutes,
        plannedSpeed: avgSpeed
    };

    console.log(`Rhumbline-Route: ${totalNM} NM`);
    if (showRouteInfo) {
        showRouteInfo(totalNM, etaHoursInt, etaMinutes, routeInfo, false, false, avgSpeed, 0);
    }
}

/**
 * Leert die Routen-Anzeige
 * @param {Object} context - Kontext mit map
 */
export function clearRouteDisplay(context) {
    const { map } = context;

    if (map && map.getSource('route')) {
        map.getSource('route').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map && map.getSource('route-shadow')) {
        map.getSource('route-shadow').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map && map.getSource('completed-segments')) {
        map.getSource('completed-segments').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map && map.getSource('current-segment')) {
        map.getSource('current-segment').setData({ type: 'FeatureCollection', features: [] });
    }
    if (map && map.getSource('remaining-segments')) {
        map.getSource('remaining-segments').setData({ type: 'FeatureCollection', features: [] });
    }

    // Route-Label Marker entfernen
    removeRouteLabels(context);

    // Route-Pfeile entfernen
    routeArrows.forEach(marker => marker.remove());
    routeArrows = [];
    routeArrowMarkers.forEach(m => m.remove());
    routeArrowMarkers = [];

    currentRouteCoordinates = null;
}

/**
 * Entfernt Route-Labels
 * @param {Object} context - Kontext (optional)
 */
export function removeRouteLabels(context) {
    routeLabelMarkers.forEach(marker => marker.remove());
    routeLabelMarkers = [];
}

/**
 * Löscht die aktuelle Route komplett
 * @param {Object} context - Kontext
 */
export function clearRoute(context) {
    const { waypoints, showNotification } = context;

    // Wegpunkt-Marker von der Karte entfernen
    waypoints.forEach(w => {
        if (w.marker) {
            w.marker.remove();
        }
    });
    waypoints.length = 0;

    // Route-Anzeige leeren
    clearRouteDisplay(context);

    // Panels entfernen
    const panel = document.getElementById('route-info-panel');
    if (panel) panel.remove();

    if (nextWaypointDisplay) {
        nextWaypointDisplay.remove();
        nextWaypointDisplay = null;
    }

    if (turnByTurnDisplay) {
        turnByTurnDisplay.remove();
        turnByTurnDisplay = null;
    }

    if (xteWarningDisplay) {
        xteWarningDisplay.remove();
        xteWarningDisplay = null;
    }

    if (routeProgressDisplay) {
        routeProgressDisplay.remove();
        routeProgressDisplay = null;
    }

    // Segment-Hervorhebung Status zurücksetzen
    currentSegmentActive = false;
    completedSegmentsActive = false;

    // Route-Daten zurücksetzen
    currentRouteCoordinates = null;
    currentRoutePolyline = null;
    currentRouteData = {
        totalDistanceNM: 0,
        plannedEtaHours: 0,
        plannedEtaMinutes: 0,
        plannedSpeed: 5
    };

    // Schleusen-Timeline entfernen
    if (locksTimelinePanel) {
        locksTimelinePanel.remove();
        locksTimelinePanel = null;
    }
    locksOnRoute = [];
    lockWarnings = [];

    // Navigation stoppen
    stopNavigation(context);

    if (showNotification) showNotification('Route gelöscht');
}

/**
 * Fügt Richtungspfeile entlang der Route hinzu
 * @param {Object} context - Kontext mit map
 */
export function addRouteArrows(context) {
    const { map } = context;

    // Bestehende Pfeile entfernen
    routeArrows.forEach(arrow => arrow.remove());
    routeArrows = [];
    routeArrowMarkers.forEach(m => m.remove());
    routeArrowMarkers = [];

    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) return;

    // Gesamte Routen-Distanz berechnen
    let totalDistance = 0;
    for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
        totalDistance += haversineDistance(
            currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon,
            currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon
        );
    }

    // Pfeil-Abstand: ca. 2 km
    const arrowSpacing = 2000;
    const numArrows = Math.floor(totalDistance / arrowSpacing);

    if (numArrows < 1) return;

    // Pfeile in Intervallen platzieren
    let currentDist = arrowSpacing;

    for (let arrowNum = 0; arrowNum < numArrows; arrowNum++) {
        let accumulatedDistance = 0;
        let arrowPlaced = false;

        for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
            const segmentDistance = haversineDistance(
                currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon,
                currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon
            );

            if (accumulatedDistance + segmentDistance >= currentDist) {
                const distanceIntoSegment = currentDist - accumulatedDistance;
                const fraction = distanceIntoSegment / segmentDistance;

                const arrowLat = currentRouteCoordinates[i].lat +
                    (currentRouteCoordinates[i + 1].lat - currentRouteCoordinates[i].lat) * fraction;
                const arrowLon = currentRouteCoordinates[i].lon +
                    (currentRouteCoordinates[i + 1].lon - currentRouteCoordinates[i].lon) * fraction;

                const bearing = calculateBearing(
                    currentRouteCoordinates[i].lat,
                    currentRouteCoordinates[i].lon,
                    currentRouteCoordinates[i + 1].lat,
                    currentRouteCoordinates[i + 1].lon
                );

                const arrowEl = document.createElement('div');
                arrowEl.className = 'route-arrow-icon';
                arrowEl.style.cssText = `transform: rotate(${bearing}deg); font-size: 20px; text-shadow: 0 0 3px rgba(0,0,0,0.8); pointer-events: none;`;
                arrowEl.innerHTML = '&#x2B06;'; // Unicode Pfeil nach oben

                const arrowMarker = new maplibregl.Marker({ element: arrowEl, anchor: 'center' })
                    .setLngLat([arrowLon, arrowLat])
                    .addTo(map);

                routeArrowMarkers.push(arrowMarker);
                arrowPlaced = true;
                break;
            }

            accumulatedDistance += segmentDistance;
        }

        if (!arrowPlaced) break;
        currentDist += arrowSpacing;
    }
}

// ==================== LIVE-NAVIGATION ====================

/**
 * Startet die Navigation
 * @param {Object} context - Kontext
 */
export function startNavigation(context) {
    const { waypoints, showNotification, currentPosition } = context;

    if (!waypoints || waypoints.length < 2) {
        if (showNotification) {
            showNotification('Erstelle zuerst eine Route mit mindestens 2 Wegpunkten', 'warning');
        }
        return;
    }

    navigationActive = true;

    if (navigationStartButton) {
        navigationStartButton.innerHTML = '&#x23F8;'; // Pause-Symbol
        navigationStartButton.title = 'Navigation pausieren';
        navigationStartButton.style.background = '#27ae60';
    }

    if (showNotification) showNotification('Navigation gestartet', 'success');
    console.log('Navigation GESTARTET');

    // Anzeigen aktualisieren
    if (currentPosition && currentPosition.lat && currentPosition.lon) {
        const currentSpeed = window.lastSensorData?.speed || 0;
        updateNextWaypointDisplay(currentPosition.lat, currentPosition.lon, currentSpeed, context);
        updateTurnByTurnDisplay(currentPosition.lat, currentPosition.lon, context);
        updateLiveETA(context);
        updateRouteSegmentHighlighting(currentPosition.lat, currentPosition.lon, context);
        updateCourseDeviationWarning(currentPosition.lat, currentPosition.lon, context);
    }
}

/**
 * Stoppt die Navigation
 * @param {Object} context - Kontext (optional)
 */
export function stopNavigation(context) {
    if (navigationActive) {
        navigationActive = false;

        if (navigationStartButton) {
            navigationStartButton.innerHTML = '&#x25B6;'; // Play-Symbol
            navigationStartButton.title = 'Navigation starten';
            navigationStartButton.style.background = 'white';
        }

        const showNotification = context?.showNotification;
        if (showNotification) showNotification('Navigation beendet', 'info');
        console.log('Navigation BEENDET');
    }
}

/**
 * Schaltet die Navigation um (Start/Pause)
 * @param {Object} context - Kontext
 */
export function toggleNavigation(context) {
    const { waypoints, showNotification, currentPosition } = context;

    if (!waypoints || waypoints.length < 2) {
        if (showNotification) {
            showNotification('Erstelle zuerst eine Route mit mindestens 2 Wegpunkten', 'warning');
        }
        return;
    }

    navigationActive = !navigationActive;

    if (navigationActive) {
        // Navigation starten
        if (navigationStartButton) {
            navigationStartButton.innerHTML = '&#x23F8;';
            navigationStartButton.title = 'Navigation pausieren';
            navigationStartButton.style.background = '#27ae60';
        }
        if (showNotification) showNotification('Navigation gestartet', 'success');
        console.log('Navigation GESTARTET');

        // Anzeigen aktualisieren
        if (currentPosition && currentPosition.lat && currentPosition.lon) {
            const currentSpeed = window.lastSensorData?.speed || 0;
            updateNextWaypointDisplay(currentPosition.lat, currentPosition.lon, currentSpeed, context);
            updateTurnByTurnDisplay(currentPosition.lat, currentPosition.lon, context);
            updateLiveETA(context);
            updateRouteSegmentHighlighting(currentPosition.lat, currentPosition.lon, context);
            updateCourseDeviationWarning(currentPosition.lat, currentPosition.lon, context);
        }
    } else {
        // Navigation pausieren
        if (navigationStartButton) {
            navigationStartButton.innerHTML = '&#x25B6;';
            navigationStartButton.title = 'Navigation starten';
            navigationStartButton.style.background = 'white';
        }
        if (showNotification) showNotification('Navigation pausiert', 'info');
        console.log('Navigation PAUSIERT');

        // XTE-Warnung entfernen
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }

        // Abbiegehinweis entfernen
        if (turnByTurnDisplay) {
            turnByTurnDisplay.remove();
            turnByTurnDisplay = null;
        }

        // Routen-Farbe zurücksetzen
        if (currentRoutePolyline && currentRoutePolyline.setStyle) {
            const isWaterway = currentRoutePolyline.options.originalColor === '#2ecc71';
            const normalColor = isWaterway ? '#2ecc71' : '#3498db';
            currentRoutePolyline.setStyle({ color: normalColor, weight: 5 });
        }
    }
}

/**
 * Aktualisiert die Navigations-Anzeigen bei neuer Position
 * @param {number} lat - Aktuelle Breitengrad
 * @param {number} lon - Aktuelle Längengrad
 * @param {Object} context - Kontext
 */
export function updateNavigation(lat, lon, context) {
    const currentSpeed = window.lastSensorData?.speed || 0;

    updateNextWaypointDisplay(lat, lon, currentSpeed, context);
    updateTurnByTurnDisplay(lat, lon, context);
    updateLiveETA(context);
    updateRouteSegmentHighlighting(lat, lon, context);
    updateCourseDeviationWarning(lat, lon, context);

    // Schleusen-Timeline Distanzen aktualisieren
    if (locksOnRoute.length > 0) {
        displayLocksTimeline(context);
    }
}

// ==================== ETA UND DISTANZ BERECHNUNG ====================

/**
 * Berechnet die geschätzte Ankunftszeit
 * @param {number} distanceNM - Distanz in Seemeilen
 * @param {number} speedKnots - Geschwindigkeit in Knoten
 * @returns {Object} {hours, minutes, arrivalTime}
 */
export function calculateETA(distanceNM, speedKnots) {
    if (!speedKnots || speedKnots <= 0) {
        return { hours: 0, minutes: 0, arrivalTime: null };
    }

    const etaHours = distanceNM / speedKnots;
    const hours = Math.floor(etaHours);
    const minutes = Math.round((etaHours - hours) * 60);

    const now = new Date();
    const arrivalTime = new Date(now.getTime() + etaHours * 60 * 60 * 1000);

    return { hours, minutes, arrivalTime };
}

/**
 * Aktualisiert die Live-ETA Anzeige
 * @param {Object} context - Kontext
 */
export function updateLiveETA(context) {
    const { waypoints, currentPosition } = context;

    // Nur aktualisieren wenn Route und Navigation aktiv
    if (!navigationActive || !waypoints || waypoints.length === 0 ||
        !currentPosition || !currentPosition.lat || !currentPosition.lon) {
        const liveEtaDisplay = document.getElementById('live-eta-display');
        if (liveEtaDisplay) {
            liveEtaDisplay.style.display = 'none';
        }
        return;
    }

    const currentSpeed = window.lastSensorData?.speed || 0;

    // Mindestens 0.5 Knoten für sinnvolle ETA
    if (currentSpeed < 0.5) {
        const liveEtaDisplay = document.getElementById('live-eta-display');
        if (liveEtaDisplay) {
            liveEtaDisplay.innerHTML = 'Live ETA: Warte auf GPS-Geschwindigkeit...';
            liveEtaDisplay.style.display = 'block';
        }
        return;
    }

    // Verbleibende Gesamtdistanz berechnen
    let totalRemainingDistanceMeters = 0;
    const currentLat = currentPosition.lat;
    const currentLon = currentPosition.lon;

    if (waypoints.length > 0) {
        // Distanz zum ersten Wegpunkt
        const firstWP = waypoints[0].marker.getLngLat();
        totalRemainingDistanceMeters = haversineDistance(currentLat, currentLon, firstWP.lat, firstWP.lng);

        // Distanz zwischen allen verbleibenden Wegpunkten addieren
        for (let i = 0; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i].marker.getLngLat();
            const wp2 = waypoints[i + 1].marker.getLngLat();
            totalRemainingDistanceMeters += haversineDistance(wp1.lat, wp1.lng, wp2.lat, wp2.lng);
        }
    }

    const remainingDistanceNM = totalRemainingDistanceMeters / 1852;
    const eta = calculateETA(remainingDistanceNM, currentSpeed);

    const speedFormatted = typeof formatSpeed === 'function'
        ? formatSpeed(currentSpeed)
        : `${currentSpeed.toFixed(1)} kn`;

    const arrivalTimeStr = eta.arrivalTime
        ? eta.arrivalTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
        : '--:--';

    let etaText = '';
    if (eta.hours > 0) {
        etaText = `${eta.hours}h ${eta.minutes}min`;
    } else {
        etaText = `${eta.minutes}min`;
    }

    const liveEtaDisplay = document.getElementById('live-eta-display');
    if (liveEtaDisplay) {
        liveEtaDisplay.innerHTML = `<strong>Live ETA (GPS):</strong> ${etaText} @ ${speedFormatted} | Ankunft: ${arrivalTimeStr}`;
        liveEtaDisplay.style.display = 'block';
    }
}

// ==================== KURSABWEICHUNG (XTE) ====================

/**
 * Berechnet den Cross-Track Error (XTE) - Abweichung vom Kurs
 * @param {number} boatLat - Boot-Breitengrad
 * @param {number} boatLon - Boot-Längengrad
 * @returns {Object|null} {distance, side, segment, nearestPoint}
 */
export function calculateCrossTrackError(boatLat, boatLon) {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        return null;
    }

    // Nächstes Segment auf der Route finden
    let minDistance = Infinity;
    let closestSegment = null;
    let xteInfo = null;

    for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
        const seg1 = currentRouteCoordinates[i];
        const seg2 = currentRouteCoordinates[i + 1];

        const result = pointToLineSegmentDistance(
            boatLat, boatLon,
            seg1.lat, seg1.lon,
            seg2.lat, seg2.lon
        );

        if (result.distance < minDistance) {
            minDistance = result.distance;
            closestSegment = i;
            xteInfo = result;
        }
    }

    return {
        distance: xteInfo.distance,
        side: xteInfo.side,
        segment: closestSegment,
        nearestPoint: xteInfo.nearestPoint
    };
}

/**
 * Aktualisiert die Kursabweichungs-Warnung
 * @param {number} boatLat - Boot-Breitengrad
 * @param {number} boatLon - Boot-Längengrad
 * @param {Object} context - Kontext
 */
export function updateCourseDeviationWarning(boatLat, boatLon, context) {
    const { map } = context;

    // Nur bei aktiver Navigation anzeigen
    if (!navigationActive) {
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }
        return;
    }

    const xte = calculateCrossTrackError(boatLat, boatLon);

    if (!xte) {
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }
        return;
    }

    const WARN_THRESHOLD = 100; // Meter - Warnung anzeigen
    const CRITICAL_THRESHOLD = 500; // Meter - kritische Warnung

    if (xte.distance > WARN_THRESHOLD) {
        const distanceFormatted = xte.distance < 1000
            ? `${Math.round(xte.distance)} m`
            : `${(xte.distance / 1000).toFixed(2)} km`;

        const sideText = xte.side === 'port' ? 'Backbord ←' : 'Steuerbord →';
        const sideColor = xte.side === 'port' ? '#e74c3c' : '#27ae60';

        const isCritical = xte.distance > CRITICAL_THRESHOLD;
        const warningIcon = isCritical ? '&#x26A0;' : '&#x26A1;';
        const warningText = isCritical ? 'KRITISCHE ABWEICHUNG' : 'Kursabweichung';
        const bgColor = isCritical ? 'rgba(231, 76, 60, 0.95)' : 'rgba(243, 156, 18, 0.95)';

        if (!xteWarningDisplay) {
            xteWarningDisplay = document.createElement('div');
            xteWarningDisplay.id = 'xte-warning-display';
            xteWarningDisplay.style.cssText = `
                position: absolute;
                top: 180px;
                right: 20px;
                background: ${bgColor};
                backdrop-filter: blur(10px);
                border: 3px solid white;
                border-radius: 12px;
                padding: 16px;
                z-index: 1003;
                min-width: 260px;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                animation: pulse 2s ease-in-out infinite;
            `;
            document.getElementById('map-container').appendChild(xteWarningDisplay);
        }

        xteWarningDisplay.style.background = bgColor;

        xteWarningDisplay.innerHTML = `
            <div style="font-size: 13px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 700;">
                ${warningIcon} ${warningText}
            </div>
            <div style="font-size: 28px; font-weight: 700; margin-bottom: 12px; text-align: center;">
                ${distanceFormatted}
            </div>
            <div style="background: rgba(255, 255, 255, 0.2); padding: 10px; border-radius: 8px; text-align: center;">
                <div style="font-size: 11px; margin-bottom: 4px;">RICHTUNG</div>
                <div style="font-size: 18px; font-weight: 600; color: ${sideColor};">
                    ${sideText}
                </div>
            </div>
            <div style="margin-top: 12px; font-size: 11px; text-align: center; opacity: 0.9;">
                Zurück zum Kurs navigieren
            </div>
        `;
    } else {
        // Im akzeptablen Bereich - Warnung entfernen
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }
    }
}

// ==================== ABBIEGEHINWEISE ====================

/**
 * Berechnet Abbiegerichtung und -winkel zwischen zwei Kursen
 * @param {number} currentBearing - Aktueller Kurs
 * @param {number} nextBearing - Nächster Kurs
 * @returns {Object} {turnType, turnIcon, turnText, turnAngle}
 */
export function calculateTurnDirection(currentBearing, nextBearing) {
    currentBearing = (currentBearing + 360) % 360;
    nextBearing = (nextBearing + 360) % 360;

    let turnAngle = nextBearing - currentBearing;
    if (turnAngle > 180) turnAngle -= 360;
    if (turnAngle < -180) turnAngle += 360;

    let turnType, turnIcon, turnText;

    if (Math.abs(turnAngle) < 10) {
        turnType = 'straight';
        turnIcon = '&#x2B06;';
        turnText = 'Geradeaus';
    } else if (turnAngle > 0 && turnAngle < 45) {
        turnType = 'slight-right';
        turnIcon = '&#x2197;';
        turnText = 'Leicht rechts';
    } else if (turnAngle >= 45 && turnAngle < 135) {
        turnType = 'right';
        turnIcon = '&#x27A1;';
        turnText = 'Rechts abbiegen';
    } else if (turnAngle >= 135) {
        turnType = 'sharp-right';
        turnIcon = '&#x21AA;';
        turnText = 'Scharf rechts';
    } else if (turnAngle < 0 && turnAngle > -45) {
        turnType = 'slight-left';
        turnIcon = '&#x2196;';
        turnText = 'Leicht links';
    } else if (turnAngle <= -45 && turnAngle > -135) {
        turnType = 'left';
        turnIcon = '&#x2B05;';
        turnText = 'Links abbiegen';
    } else {
        turnType = 'sharp-left';
        turnIcon = '&#x21A9;';
        turnText = 'Scharf links';
    }

    return { turnType, turnIcon, turnText, turnAngle };
}

/**
 * Aktualisiert die Abbiegehinweis-Anzeige
 * @param {number} currentLat - Aktuelle Breitengrad
 * @param {number} currentLon - Aktuelle Längengrad
 * @param {Object} context - Kontext
 */
export function updateTurnByTurnDisplay(currentLat, currentLon, context) {
    const { waypoints } = context;

    // Nur bei aktiver Navigation anzeigen
    if (!navigationActive || !waypoints || waypoints.length < 2) {
        if (turnByTurnDisplay) {
            turnByTurnDisplay.remove();
            turnByTurnDisplay = null;
        }
        return;
    }

    // Nächsten Wegpunkt finden
    let nextWaypointIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const wpLngLat = wp.marker.getLngLat();
        const distance = haversineDistance(currentLat, currentLon, wpLngLat.lat, wpLngLat.lng);

        if (distance < minDistance) {
            minDistance = distance;
            nextWaypointIndex = i;
        }
    }

    // Letzter Wegpunkt - Ankunftsmeldung anzeigen
    if (nextWaypointIndex >= waypoints.length - 1) {
        const lastWP = waypoints[waypoints.length - 1];
        const lastWPLngLat = lastWP.marker.getLngLat();
        const distanceToLast = haversineDistance(currentLat, currentLon, lastWPLngLat.lat, lastWPLngLat.lng);

        const distanceFormatted = typeof formatDistance === 'function'
            ? formatDistance(distanceToLast)
            : `${(distanceToLast / 1852).toFixed(2)} NM`;

        if (!turnByTurnDisplay) {
            turnByTurnDisplay = document.createElement('div');
            turnByTurnDisplay.id = 'turn-by-turn-display';
            turnByTurnDisplay.style.cssText = `
                position: absolute;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(10, 14, 39, 0.95);
                backdrop-filter: blur(10px);
                border: 3px solid #27ae60;
                border-radius: 16px;
                padding: 20px 30px;
                z-index: 1003;
                color: white;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
                text-align: center;
            `;
            document.getElementById('map-container').appendChild(turnByTurnDisplay);
        }

        turnByTurnDisplay.innerHTML = `
            <div style="font-size: 48px; margin-bottom: 10px;">&#x1F3AF;</div>
            <div style="font-size: 18px; font-weight: 700; color: #27ae60; margin-bottom: 8px;">
                Ziel erreichen
            </div>
            <div style="font-size: 24px; font-weight: 600; color: #64ffda;">
                ${distanceFormatted}
            </div>
            <div style="font-size: 14px; color: #8892b0; margin-top: 8px;">
                ${lastWP.name || 'Ziel'}
            </div>
        `;
        return;
    }

    // Abbiegewinkel für nächstes Segment berechnen
    const currentWP = waypoints[nextWaypointIndex];
    const nextWP = waypoints[nextWaypointIndex + 1];

    const currentWPLngLat = currentWP.marker.getLngLat();
    const nextWPLngLat = nextWP.marker.getLngLat();

    const bearingToCurrent = calculateBearing(currentLat, currentLon, currentWPLngLat.lat, currentWPLngLat.lng);
    const bearingToNext = calculateBearing(currentWPLngLat.lat, currentWPLngLat.lng, nextWPLngLat.lat, nextWPLngLat.lng);

    const turn = calculateTurnDirection(bearingToCurrent, bearingToNext);

    const distanceToTurn = haversineDistance(currentLat, currentLon, currentWPLngLat.lat, currentWPLngLat.lng);
    const distanceFormatted = typeof formatDistance === 'function'
        ? formatDistance(distanceToTurn)
        : `${(distanceToTurn / 1852).toFixed(2)} NM`;

    if (!turnByTurnDisplay) {
        turnByTurnDisplay = document.createElement('div');
        turnByTurnDisplay.id = 'turn-by-turn-display';
        turnByTurnDisplay.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 14, 39, 0.95);
            backdrop-filter: blur(10px);
            border: 3px solid #64ffda;
            border-radius: 16px;
            padding: 20px 30px;
            z-index: 1003;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
            text-align: center;
        `;
        document.getElementById('map-container').appendChild(turnByTurnDisplay);
    }

    turnByTurnDisplay.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">${turn.turnIcon}</div>
        <div style="font-size: 18px; font-weight: 700; color: #64ffda; margin-bottom: 8px;">
            ${turn.turnText}
        </div>
        <div style="font-size: 24px; font-weight: 600; color: white;">
            in ${distanceFormatted}
        </div>
        <div style="font-size: 14px; color: #8892b0; margin-top: 8px;">
            bei ${currentWP.name || `WP ${nextWaypointIndex + 1}`}
        </div>
    `;
}

/**
 * Aktualisiert die Anzeige für den nächsten Wegpunkt
 * @param {number} currentLat - Aktuelle Breitengrad
 * @param {number} currentLon - Aktuelle Längengrad
 * @param {number} currentSpeed - Aktuelle Geschwindigkeit in Knoten
 * @param {Object} context - Kontext
 */
export function updateNextWaypointDisplay(currentLat, currentLon, currentSpeed, context) {
    const { waypoints } = context;

    // Nur anzeigen wenn Wegpunkte vorhanden
    if (!waypoints || waypoints.length === 0) {
        if (nextWaypointDisplay) {
            nextWaypointDisplay.remove();
            nextWaypointDisplay = null;
        }
        return;
    }

    // Nächsten Wegpunkt finden
    let nextWaypoint = null;
    let minDistance = Infinity;
    let waypointIndex = -1;

    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const wpLngLat = wp.marker.getLngLat();
        const distance = haversineDistance(currentLat, currentLon, wpLngLat.lat, wpLngLat.lng);

        if (distance < minDistance) {
            minDistance = distance;
            nextWaypoint = wp;
            waypointIndex = i;
        }
    }

    if (!nextWaypoint) return;

    const wpLngLat = nextWaypoint.marker.getLngLat();
    const bearing = calculateBearing(currentLat, currentLon, wpLngLat.lat, wpLngLat.lng);

    const distanceMeters = minDistance;
    const distanceFormatted = typeof formatDistance === 'function'
        ? formatDistance(distanceMeters)
        : `${(distanceMeters / 1852).toFixed(2)} NM`;

    let etaText = 'N/A';
    if (currentSpeed && currentSpeed > 0) {
        const distanceNM = distanceMeters / 1852;
        const eta = calculateETA(distanceNM, currentSpeed);
        if (eta.hours > 0) {
            etaText = `${eta.hours}h ${eta.minutes}min`;
        } else {
            etaText = `${eta.minutes}min`;
        }
    }

    if (!nextWaypointDisplay) {
        nextWaypointDisplay = document.createElement('div');
        nextWaypointDisplay.id = 'next-waypoint-display';
        nextWaypointDisplay.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: rgba(10, 14, 39, 0.95);
            backdrop-filter: blur(10px);
            border: 3px solid #64ffda;
            border-radius: 16px;
            padding: 20px;
            z-index: 1002;
            min-width: 280px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
        document.getElementById('map-container').appendChild(nextWaypointDisplay);
    }

    const waypointNumber = waypointIndex + 1;
    const totalWaypoints = waypoints.length;

    nextWaypointDisplay.innerHTML = `
        <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
            Nächster Wegpunkt (${waypointNumber}/${totalWaypoints})
        </div>
        <div style="font-size: 24px; font-weight: 700; color: #64ffda; margin-bottom: 12px; line-height: 1.2;">
            ${nextWaypoint.name || `WP ${waypointNumber}`}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
            <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">DISTANZ</div>
                <div style="font-size: 20px; font-weight: 600; color: white;">${distanceFormatted}</div>
            </div>
            <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">KURS</div>
                <div style="font-size: 20px; font-weight: 600; color: white;">${Math.round(bearing)}°</div>
            </div>
        </div>
        <div style="background: rgba(100, 255, 218, 0.1); padding: 12px; border-radius: 10px; margin-top: 12px; text-align: center;">
            <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">ETA</div>
            <div style="font-size: 18px; font-weight: 600; color: #64ffda;">${etaText}</div>
        </div>
    `;
}

// ==================== ROUTEN-SEGMENT HERVORHEBUNG ====================

/**
 * Aktualisiert die Routen-Segment-Hervorhebung basierend auf aktueller Position
 * @param {number} currentLat - Aktuelle Breitengrad
 * @param {number} currentLon - Aktuelle Längengrad
 * @param {Object} context - Kontext
 */
export function updateRouteSegmentHighlighting(currentLat, currentLon, context) {
    const { map, waypoints } = context;

    // Nur bei aktiver Navigation hervorheben
    if (!navigationActive || !waypoints || waypoints.length < 2 ||
        !currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        // Hervorhebung über GeoJSON-Quellen leeren
        if (map.getSource('completed-segments')) {
            map.getSource('completed-segments').setData({ type: 'FeatureCollection', features: [] });
        }
        if (map.getSource('current-segment')) {
            map.getSource('current-segment').setData({ type: 'FeatureCollection', features: [] });
        }
        if (map.getSource('remaining-segments')) {
            map.getSource('remaining-segments').setData({ type: 'FeatureCollection', features: [] });
        }
        currentSegmentActive = false;
        completedSegmentsActive = false;
        return;
    }

    // Nächsten Punkt auf der Route finden
    let minDistance = Infinity;
    let closestSegmentIndex = 0;
    let closestPoint = null;

    for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
        const seg1 = currentRouteCoordinates[i];
        const seg2 = currentRouteCoordinates[i + 1];

        const result = pointToLineSegmentDistance(
            currentLat, currentLon,
            seg1.lat, seg1.lon,
            seg2.lat, seg2.lon
        );

        if (result.distance < minDistance) {
            minDistance = result.distance;
            closestSegmentIndex = i;
            closestPoint = result.nearestPoint;
        }
    }

    const isWaterway = currentRoutePolyline && currentRoutePolyline.options.originalColor === '#2ecc71';
    const normalColor = isWaterway ? '#2ecc71' : '#3498db';

    // Abgeschlossene Segmente aktualisieren
    if (closestSegmentIndex > 0) {
        const completedCoords = [];
        for (let i = 0; i <= closestSegmentIndex; i++) {
            completedCoords.push([currentRouteCoordinates[i].lon, currentRouteCoordinates[i].lat]);
        }
        if (map.getSource('completed-segments')) {
            map.getSource('completed-segments').setData({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: completedCoords }
            });
        }
        completedSegmentsActive = true;
    } else if (map.getSource('completed-segments')) {
        map.getSource('completed-segments').setData({ type: 'FeatureCollection', features: [] });
        completedSegmentsActive = false;
    }

    // Aktuelles Segment aktualisieren
    const currentSegmentCoords = [
        [closestPoint.lon, closestPoint.lat],
        [currentRouteCoordinates[closestSegmentIndex + 1].lon, currentRouteCoordinates[closestSegmentIndex + 1].lat]
    ];
    if (map.getSource('current-segment')) {
        map.getSource('current-segment').setData({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: currentSegmentCoords }
        });
    }
    currentSegmentActive = true;

    // Verbleibende Segmente aktualisieren
    if (closestSegmentIndex < currentRouteCoordinates.length - 2) {
        const remainingCoords = [];
        for (let i = closestSegmentIndex + 1; i < currentRouteCoordinates.length; i++) {
            remainingCoords.push([currentRouteCoordinates[i].lon, currentRouteCoordinates[i].lat]);
        }
        if (map.getSource('remaining-segments')) {
            map.getSource('remaining-segments').setData({
                type: 'Feature',
                properties: { color: normalColor },
                geometry: { type: 'LineString', coordinates: remainingCoords }
            });
        }
    } else if (map.getSource('remaining-segments')) {
        map.getSource('remaining-segments').setData({ type: 'FeatureCollection', features: [] });
    }

    // Fortschritts-Anzeige aktualisieren
    updateRouteProgress(closestSegmentIndex, closestPoint, context);
}

/**
 * Aktualisiert die Routen-Fortschritts-Anzeige
 * @param {number} segmentIndex - Index des aktuellen Segments
 * @param {Object} closestPoint - Nächster Punkt auf der Route
 * @param {Object} context - Kontext
 */
function updateRouteProgress(segmentIndex, closestPoint, context) {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) return;

    // Zurückgelegte Distanz berechnen
    let completedDistance = 0;
    for (let i = 0; i < segmentIndex; i++) {
        completedDistance += haversineDistance(
            currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon,
            currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon
        );
    }
    if (segmentIndex < currentRouteCoordinates.length - 1) {
        completedDistance += haversineDistance(
            currentRouteCoordinates[segmentIndex].lat, currentRouteCoordinates[segmentIndex].lon,
            closestPoint.lat, closestPoint.lon
        );
    }

    // Gesamte Routen-Distanz berechnen
    let totalDistance = 0;
    for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
        totalDistance += haversineDistance(
            currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon,
            currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon
        );
    }

    const progressPercent = totalDistance > 0 ? (completedDistance / totalDistance) * 100 : 0;
    const remainingDistance = totalDistance - completedDistance;

    const remainingDistFormatted = typeof formatDistance === 'function'
        ? formatDistance(remainingDistance)
        : `${(remainingDistance / 1852).toFixed(1)} NM`;

    if (!routeProgressDisplay) {
        routeProgressDisplay = document.createElement('div');
        routeProgressDisplay.id = 'route-progress-display';
        routeProgressDisplay.style.cssText = `
            position: absolute;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(10, 14, 39, 0.95);
            backdrop-filter: blur(10px);
            border: 2px solid #64ffda;
            border-radius: 12px;
            padding: 12px 20px;
            z-index: 1003;
            min-width: 280px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
        document.getElementById('map-container').appendChild(routeProgressDisplay);
    }

    routeProgressDisplay.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <div style="flex: 1;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">ROUTEN-FORTSCHRITT</div>
                <div style="font-size: 18px; font-weight: 700; color: #64ffda;">${progressPercent.toFixed(0)}%</div>
            </div>
            <div style="flex: 1; text-align: right;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">VERBLEIBEND</div>
                <div style="font-size: 16px; font-weight: 600; color: white;">${remainingDistFormatted}</div>
            </div>
        </div>
        <div style="
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
            overflow: hidden;
            margin-top: 8px;
        ">
            <div style="
                width: ${progressPercent.toFixed(1)}%;
                height: 100%;
                background: linear-gradient(90deg, #ffd700, #64ffda);
                border-radius: 3px;
                transition: width 0.5s ease;
            "></div>
        </div>
    `;
}

// ==================== SCHLEUSENERKENNUNG ====================

/**
 * Verarbeitet Schleusen auf der Route
 * @param {Array} locks - Array von Schleusen
 * @param {Object} context - Kontext
 */
export function processLocksOnRoute(locks, context) {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        locksOnRoute = [];
        return;
    }

    // Schleusen filtern die nahe der Route sind (innerhalb 2km)
    locksOnRoute = locks.filter(lock => {
        const lockLatLon = { lat: lock.lat, lon: lock.lon };
        for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
            const seg1 = currentRouteCoordinates[i];
            const seg2 = currentRouteCoordinates[i + 1];
            const result = pointToLineSegmentDistance(
                lockLatLon.lat, lockLatLon.lon,
                seg1.lat, seg1.lon,
                seg2.lat, seg2.lon
            );
            if (result.distance < 2000) {
                return true;
            }
        }
        return false;
    });

    // Nach Distanz vom Routenstart sortieren
    const routeStart = currentRouteCoordinates[0];
    locksOnRoute.forEach(lock => {
        lock._distanceFromStart = haversineDistance(routeStart.lat, routeStart.lon, lock.lat, lock.lon);
    });
    locksOnRoute.sort((a, b) => a._distanceFromStart - b._distanceFromStart);

    console.log(`${locksOnRoute.length} Schleusen auf oder nahe der Route`);
}

/**
 * Aktualisiert die Schleusen-Timeline
 * @param {Object} context - Kontext
 */
export async function updateLocksTimeline(context) {
    const { API_URL } = context;

    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        if (locksTimelinePanel) {
            locksTimelinePanel.remove();
            locksTimelinePanel = null;
        }
        locksOnRoute = [];
        return;
    }

    try {
        // Bounding Box der Route berechnen
        const lats = currentRouteCoordinates.map(p => p.lat);
        const lons = currentRouteCoordinates.map(p => p.lon);
        const lat_min = Math.min(...lats);
        const lat_max = Math.max(...lats);
        const lon_min = Math.min(...lons);
        const lon_max = Math.max(...lons);

        // Schleusen in Bounding Box abrufen
        const response = await fetch(
            `${API_URL}/api/locks/bounds?lat_min=${lat_min}&lon_min=${lon_min}&lat_max=${lat_max}&lon_max=${lon_max}`
        );

        if (!response.ok) {
            console.warn('Fehler beim Abrufen der Schleusen:', response.statusText);
            return;
        }

        const data = await response.json();
        const locks = data.locks || [];
        console.log(`${locks.length} Schleusen in Routen-Bounds gefunden`);

        // Schleusen verarbeiten
        processLocksOnRoute(locks, context);

        // Timeline anzeigen
        displayLocksTimeline(context);

    } catch (error) {
        console.error('Fehler beim Aktualisieren der Schleusen-Timeline:', error);
    }
}

/**
 * Zeigt die Schleusen-Timeline Panel an
 * @param {Object} context - Kontext
 */
export function displayLocksTimeline(context) {
    const { currentPosition } = context;

    if (locksOnRoute.length === 0) {
        if (locksTimelinePanel) {
            locksTimelinePanel.remove();
            locksTimelinePanel = null;
        }
        return;
    }

    // Panel erstellen oder aktualisieren
    if (!locksTimelinePanel) {
        locksTimelinePanel = document.createElement('div');
        locksTimelinePanel.id = 'locks-timeline-panel';
        locksTimelinePanel.style.cssText = `
            position: absolute;
            bottom: 80px;
            right: 20px;
            max-width: 350px;
            max-height: 400px;
            overflow-y: auto;
            background: rgba(10, 14, 39, 0.95);
            backdrop-filter: blur(10px);
            border: 3px solid #64ffda;
            border-radius: 12px;
            padding: 16px;
            z-index: 1002;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
        document.getElementById('map-container').appendChild(locksTimelinePanel);
    }

    const currentLat = currentPosition?.lat;
    const currentLon = currentPosition?.lon;
    const currentSpeed = window.lastSensorData?.speed || 5;

    let html = `
        <div style="font-size: 13px; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 700;">
            &#x1F512; Schleusen auf Route (${locksOnRoute.length})
        </div>
    `;

    locksOnRoute.forEach((lock, index) => {
        let distanceMeters = 0;
        let distanceNM = 0;
        let etaText = 'N/A';

        if (currentLat && currentLon && !isNaN(currentLat) && !isNaN(currentLon)) {
            distanceMeters = haversineDistance(currentLat, currentLon, lock.lat, lock.lon);
            distanceNM = distanceMeters / 1852;
        }

        if (currentSpeed > 0 && distanceNM > 0) {
            const eta = calculateETA(distanceNM, currentSpeed);
            if (eta.hours > 0) {
                etaText = `${eta.hours}h ${eta.minutes}min`;
            } else {
                etaText = `${eta.minutes}min`;
            }
        }

        const distanceFormatted = distanceNM < 1
            ? `${(distanceNM * 1852).toFixed(0)} m`
            : `${distanceNM.toFixed(1)} NM`;

        const lockName = lock.name || `Schleuse ${index + 1}`;
        const warning = lockWarnings.find(w => w.lock_id === lock.id);

        const isPassed = distanceMeters < 100;
        let statusColor, statusIcon, warningHtml = '';

        if (warning && !isPassed) {
            statusColor = '#e74c3c';
            statusIcon = '&#x26A0;';
            warningHtml = `
                <div style="background: rgba(231, 76, 60, 0.2); padding: 8px; border-radius: 6px; margin-top: 8px; border-left: 3px solid #e74c3c;">
                    <div style="font-size: 12px; font-weight: 600; color: #e74c3c; margin-bottom: 4px;">
                        GESCHLOSSEN
                    </div>
                    <div style="font-size: 11px; color: #ffa07a;">
                        ${escapeHTML(warning.reason)}
                    </div>
                    ${warning.opens_at ? `
                        <div style="font-size: 11px; color: #8892b0; margin-top: 4px;">
                            Öffnet um: ${escapeHTML(warning.opens_at)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (isPassed) {
            statusColor = '#2ecc71';
            statusIcon = '&#x2713;';
        } else {
            statusColor = '#f39c12';
            statusIcon = '&#x2192;';
        }

        let contactHtml = '';
        if (lock.vhf_channel || lock.phone) {
            contactHtml = `
                <div style="background: rgba(100, 255, 218, 0.1); padding: 8px; border-radius: 6px; margin-top: 8px; font-size: 11px;">
                    ${lock.vhf_channel ? `
                        <div style="color: #64ffda; font-weight: 600; margin-bottom: 4px;">
                            &#x1F4FB; VHF: ${escapeHTML(lock.vhf_channel)}
                        </div>
                    ` : ''}
                    ${lock.phone ? `
                        <div style="color: #8892b0; margin-bottom: 2px;">
                            &#x1F4DE; ${escapeHTML(lock.phone)}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        html += `
            <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 8px; border-left: 4px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                    <div style="font-size: 15px; font-weight: 600; color: white;">${statusIcon} ${escapeHTML(lockName)}</div>
                    <div style="font-size: 12px; color: #8892b0;">#${index + 1}</div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                    <div>
                        <div style="color: #8892b0;">DISTANZ</div>
                        <div style="color: white; font-weight: 600;">${distanceFormatted}</div>
                    </div>
                    <div>
                        <div style="color: #8892b0;">ETA</div>
                        <div style="color: white; font-weight: 600;">${etaText}</div>
                    </div>
                </div>
                ${warningHtml}
                ${contactHtml}
            </div>
        `;
    });

    locksTimelinePanel.innerHTML = html;
}

// ==================== GPX EXPORT/IMPORT ====================

/**
 * Exportiert die aktuelle Route als GPX-Datei
 * @param {Object} context - Kontext
 */
export function exportRouteAsGPX(context) {
    const { waypoints, showNotification } = context;

    if (!waypoints || waypoints.length === 0) {
        if (showNotification) showNotification('Keine Wegpunkte zum Exportieren', 'warning');
        return;
    }

    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BoatOS Marine Navigation"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>BoatOS Route</name>
    <desc>Exportiert von BoatOS Marine Navigation System</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

    let gpxWaypoints = '';
    let gpxRoutePoints = '  <rte>\n    <name>BoatOS Route</name>\n';

    waypoints.forEach((wp, index) => {
        const lnglat = wp.marker.getLngLat();
        const name = wp.name || `WP${index + 1}`;

        gpxWaypoints += `  <wpt lat="${lnglat.lat.toFixed(7)}" lon="${lnglat.lng.toFixed(7)}">
    <name>${escapeXML(name)}</name>
    <sym>Waypoint</sym>
  </wpt>
`;

        gpxRoutePoints += `    <rtept lat="${lnglat.lat.toFixed(7)}" lon="${lnglat.lng.toFixed(7)}">
      <name>${escapeXML(name)}</name>
    </rtept>
`;
    });

    gpxRoutePoints += '  </rte>\n';
    const gpxFooter = '</gpx>';
    const gpxContent = gpxHeader + gpxWaypoints + gpxRoutePoints + gpxFooter;

    // Download auslösen
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boatos-route-${new Date().toISOString().split('T')[0]}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (showNotification) {
        showNotification(`Route als GPX exportiert (${waypoints.length} Wegpunkte)`, 'success');
    }
}

/**
 * Importiert Wegpunkte aus einer GPX-Datei
 * @param {File} file - GPX-Datei
 * @param {Object} context - Kontext
 */
export function importGPXFile(file, context) {
    const { map, waypoints, showNotification, updateRoute } = context;

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const gpxContent = e.target.result;
            const parser = new DOMParser();
            const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');

            const parserError = gpxDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Ungültiges GPX-Format');
            }

            let wptElements = gpxDoc.querySelectorAll('wpt');
            if (wptElements.length === 0) {
                wptElements = gpxDoc.querySelectorAll('rtept');
            }
            if (wptElements.length === 0) {
                wptElements = gpxDoc.querySelectorAll('trkpt');
            }

            if (wptElements.length === 0) {
                throw new Error('Keine Wegpunkte in GPX-Datei gefunden');
            }

            // Bestehende Route löschen
            clearRoute(context);

            let importedCount = 0;
            wptElements.forEach((wpt, index) => {
                const lat = parseFloat(wpt.getAttribute('lat'));
                const lon = parseFloat(wpt.getAttribute('lon'));

                if (isNaN(lat) || isNaN(lon)) return;

                const nameEl = wpt.querySelector('name');
                const name = nameEl ? nameEl.textContent : `WP${index + 1}`;

                const el = document.createElement('div');
                el.className = 'waypoint-marker';
                el.style.cssText = 'cursor: grab;';
                el.innerHTML = `<div style="background: #e74c3c; color: white; padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 13px; white-space: nowrap; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white;">${escapeHTML(name)}</div>`;

                const marker = new maplibregl.Marker({ element: el, draggable: true, anchor: 'center' })
                    .setLngLat([lon, lat])
                    .addTo(map);

                marker.on('dragend', () => {
                    if (updateRoute) updateRoute();
                });

                el.addEventListener('click', function() {
                    if (confirm(`Wegpunkt "${name}" löschen?`)) {
                        marker.remove();
                        const wpIndex = waypoints.findIndex(w => w.marker === marker);
                        if (wpIndex > -1) {
                            waypoints.splice(wpIndex, 1);
                        }
                        if (updateRoute) updateRoute();
                    }
                });

                waypoints.push({ marker: marker, name: name, lat: lat, lon: lon });
                importedCount++;
            });

            if (waypoints.length >= 2 && updateRoute) {
                updateRoute();
            }

            // Auf alle Wegpunkte zoomen
            if (waypoints.length > 0) {
                const bounds = createBoundsFromPoints(waypoints.map(w => {
                    const lnglat = w.marker.getLngLat();
                    return { lat: lnglat.lat, lon: lnglat.lng };
                }));
                if (bounds) {
                    map.fitBounds(bounds, { padding: 50 });
                }
            }

            if (showNotification) {
                showNotification(`GPX importiert: ${importedCount} Wegpunkte`, 'success');
            }

        } catch (error) {
            console.error('GPX Import Fehler:', error);
            if (showNotification) {
                showNotification(`GPX-Import fehlgeschlagen: ${error.message}`, 'error');
            }
        }
    };

    reader.onerror = function() {
        if (showNotification) {
            showNotification('Fehler beim Lesen der GPX-Datei', 'error');
        }
    };

    reader.readAsText(file);
}

// ==================== GETTER FÜR MODUL-STATUS ====================

/**
 * Gibt zurück ob die Navigation aktiv ist
 * @returns {boolean}
 */
export function isNavigationActive() {
    return navigationActive;
}

/**
 * Gibt die aktuellen Route-Koordinaten zurück
 * @returns {Array|null}
 */
export function getCurrentRouteCoordinates() {
    return currentRouteCoordinates;
}

/**
 * Gibt die aktuellen Route-Daten zurück
 * @returns {Object}
 */
export function getCurrentRouteData() {
    return currentRouteData;
}

/**
 * Gibt die Schleusen auf der Route zurück
 * @returns {Array}
 */
export function getLocksOnRoute() {
    return locksOnRoute;
}

/**
 * Setzt den Navigations-Start Button (für externe Initialisierung)
 * @param {HTMLElement} button - Button-Element
 */
export function setNavigationStartButton(button) {
    navigationStartButton = button;
}

// ==================== ROUTEN-PLANUNG UI ====================
// Hinweis: startRoutePlanning() ist jetzt oben im MAP INTERACTION MODES Abschnitt definiert

/**
 * Öffnet den Routen-Editor
 */
export function editRoute() {
    console.log('Routen-Editor öffnen');

    // Benachrichtigung anzeigen
    if (window.BoatOS && window.BoatOS.ui && window.BoatOS.ui.showNotification) {
        window.BoatOS.ui.showNotification('Route bearbeiten...', 'info');
    }

    // TODO: Routen-Editor-Modal öffnen
}

/**
 * Initialisiert das Navigations-Modul
 * Kann aufgerufen werden um Event-Listener einzurichten
 */
export function init() {
    console.log('Navigation-Modul initialisiert');
}

// ==================== EXPORT ALLER FUNKTIONEN ====================

export default {
    // Hilfsfunktionen
    haversineDistance,
    calculateDistance,
    calculateBearing,
    getWaypointLatLng,
    createBoundsFromPoints,
    pointToLineSegmentDistance,
    escapeXML,
    escapeHTML,

    // Wegpunkt-Management
    addWaypoint,
    removeWaypoint,
    reorderWaypoints,

    // Routing
    calculateRoute,
    fetchRoute,
    updateRoute,
    drawDirectRoute,
    clearRouteDisplay,
    removeRouteLabels,
    clearRoute,
    addRouteArrows,

    // Navigation
    startNavigation,
    stopNavigation,
    toggleNavigation,
    updateNavigation,

    // ETA/Distanz
    calculateETA,
    updateLiveETA,

    // Kursabweichung
    calculateCrossTrackError,
    updateCourseDeviationWarning,

    // Abbiegehinweise
    calculateTurnDirection,
    updateTurnByTurnDisplay,
    updateNextWaypointDisplay,

    // Segment-Hervorhebung
    updateRouteSegmentHighlighting,

    // Schleusen
    processLocksOnRoute,
    updateLocksTimeline,
    displayLocksTimeline,

    // GPX
    exportRouteAsGPX,
    importGPXFile,

    // Getter
    isNavigationActive,
    getCurrentRouteCoordinates,
    getCurrentRouteData,
    getLocksOnRoute,
    setNavigationStartButton,

    // Map Interaction Modes
    startRoutePlanning,
    startPoiPlacement,
    setMapInteractionMode,
    getMapInteractionMode,
    handleMapClick
};
