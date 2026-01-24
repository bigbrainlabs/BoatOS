/**
 * BoatOS Core Module
 * Zentrale Konfiguration, WebSocket-Verbindung, Initialisierung und Utility-Funktionen
 *
 * @module core
 */

// ==================== KONFIGURATION ====================

// Protokoll-Erkennung (http/https) für API und WebSocket
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';

/**
 * Backend API URL - automatische Erkennung basierend auf Host
 * @type {string}
 */
export const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${protocol}://${window.location.hostname}`;

/**
 * WebSocket URL für Echtzeit-Sensordaten
 * @type {string}
 */
export const WS_URL = window.location.hostname === 'localhost'
    ? 'ws://localhost:8000/ws'
    : `${wsProtocol}://${window.location.hostname}/ws`;

/**
 * Karten-Einstellungen
 * @type {Object}
 */
export const MAP_CONFIG = {
    // Default-Position: Aken an der Elbe
    defaultCenter: { lat: 51.855, lon: 12.046 },
    defaultZoom: 13,
    minZoom: 4,
    maxZoom: 19
};

/**
 * GPS-Einstellungen
 * @type {Object}
 */
export const GPS_CONFIG = {
    // Schwellenwert für niedrige Satellitenanzahl (in Millisekunden)
    lowSatelliteThreshold: 15000,
    // Verzögerung bevor Browser-GPS als Fallback verwendet wird (in Millisekunden)
    backendFallbackDelay: 30000
};

/**
 * Track-History Einstellungen
 * @type {Object}
 */
export const TRACK_CONFIG = {
    // Maximale Anzahl gespeicherter Track-Punkte
    maxPoints: 500
};


// ==================== ZUSTANDSVARIABLEN ====================

/**
 * Aktuelle Boot-Position
 * @type {{lat: number, lon: number}}
 */
export let currentPosition = { lat: MAP_CONFIG.defaultCenter.lat, lon: MAP_CONFIG.defaultCenter.lon };

/**
 * Aktuelle Geschwindigkeit in Knoten
 * @type {number}
 */
export let currentSpeed = 0;

/**
 * Aktueller Kurs/Heading in Grad
 * @type {number}
 */
export let currentBoatHeading = 0;

/**
 * Aktuelle Wassertiefe in Metern
 * @type {number|null}
 */
export let currentDepth = null;

/**
 * GPS-Quelle: "backend", "browser" oder null
 * @type {string|null}
 */
export let gpsSource = null;

/**
 * Genauigkeit des Browser-GPS in Metern
 * @type {number|null}
 */
export let browserGpsAccuracy = null;

/**
 * Zeitpunkt des letzten GPS-Updates
 * @type {number|null}
 */
export let lastGpsUpdate = null;

/**
 * Zeitpunkt des letzten Backend-GPS Updates
 * @type {number|null}
 */
export let lastBackendGpsTime = null;

/**
 * Zeitpunkt seit dem Backend-GPS nicht verfügbar ist
 * @type {number|null}
 */
export let backendGpsUnavailableStartTime = null;

/**
 * Flag ob bereits eine GPS-Position empfangen wurde
 * @type {boolean}
 */
export let firstGpsPositionReceived = false;

/**
 * Zeitpunkt seit dem die Satellitenanzahl unter 4 liegt
 * @type {number|null}
 */
export let lowSatelliteStartTime = null;

/**
 * Schwellenwert für niedrige Satellitenanzahl (kann in Einstellungen geändert werden)
 * @type {number}
 */
export let LOW_SATELLITE_THRESHOLD = GPS_CONFIG.lowSatelliteThreshold;

/**
 * Auto-Follow: Karte folgt automatisch der Boot-Position
 * @type {boolean}
 */
export let autoFollow = true;

/**
 * WebSocket-Verbindung
 * @type {WebSocket|null}
 */
export let ws = null;

/**
 * Wetterdaten
 * @type {Object|null}
 */
export let weatherData = null;

/**
 * Track-History: Array von {lat, lon, timestamp}
 * @type {Array}
 */
export let trackHistory = [];

/**
 * Maximale Anzahl an Track-Punkten
 * @type {number}
 */
export let maxTrackPoints = TRACK_CONFIG.maxPoints;


// ==================== SETTER-FUNKTIONEN ====================
// (notwendig da ES6 Module keine direkten Re-Exports von let-Variablen erlauben)

/**
 * Setzt die aktuelle Position
 * @param {{lat: number, lon: number}} pos - Neue Position
 */
export function setCurrentPosition(pos) {
    currentPosition = pos;
}

/**
 * Setzt die aktuelle Geschwindigkeit
 * @param {number} speed - Geschwindigkeit in Knoten
 */
export function setCurrentSpeed(speed) {
    currentSpeed = speed;
}

/**
 * Setzt den aktuellen Kurs
 * @param {number} heading - Kurs in Grad
 */
export function setCurrentBoatHeading(heading) {
    currentBoatHeading = heading;
}

/**
 * Setzt die aktuelle Wassertiefe
 * @param {number} depth - Tiefe in Metern
 */
export function setCurrentDepth(depth) {
    currentDepth = depth;
}

/**
 * Setzt die GPS-Quelle
 * @param {string|null} source - "backend", "browser" oder null
 */
export function setGpsSource(source) {
    gpsSource = source;
}

/**
 * Setzt die Browser-GPS Genauigkeit
 * @param {number} accuracy - Genauigkeit in Metern
 */
export function setBrowserGpsAccuracy(accuracy) {
    browserGpsAccuracy = accuracy;
}

/**
 * Setzt den Zeitpunkt des letzten GPS-Updates
 * @param {number} time - Zeitstempel
 */
export function setLastGpsUpdate(time) {
    lastGpsUpdate = time;
}

/**
 * Setzt den Zeitpunkt des letzten Backend-GPS Updates
 * @param {number} time - Zeitstempel
 */
export function setLastBackendGpsTime(time) {
    lastBackendGpsTime = time;
}

/**
 * Setzt den Zeitpunkt seit dem Backend-GPS nicht verfügbar ist
 * @param {number|null} time - Zeitstempel oder null
 */
export function setBackendGpsUnavailableStartTime(time) {
    backendGpsUnavailableStartTime = time;
}

/**
 * Setzt das Flag für erste empfangene GPS-Position
 * @param {boolean} received - true wenn Position empfangen
 */
export function setFirstGpsPositionReceived(received) {
    firstGpsPositionReceived = received;
}

/**
 * Setzt den Zeitpunkt für niedrige Satellitenanzahl
 * @param {number|null} time - Zeitstempel oder null
 */
export function setLowSatelliteStartTime(time) {
    lowSatelliteStartTime = time;
}

/**
 * Setzt den Schwellenwert für niedrige Satellitenanzahl
 * @param {number} threshold - Schwellenwert in Millisekunden
 */
export function setLowSatelliteThreshold(threshold) {
    LOW_SATELLITE_THRESHOLD = threshold;
}

/**
 * Setzt Auto-Follow
 * @param {boolean} follow - true um Boot zu folgen
 */
export function setAutoFollow(follow) {
    autoFollow = follow;
}

/**
 * Setzt Wetterdaten
 * @param {Object} data - Wetterdaten-Objekt
 */
export function setWeatherData(data) {
    weatherData = data;
}


// ==================== WEBSOCKET VERBINDUNG ====================

/**
 * Callback-Funktion für eingehende Sensor-Daten
 * @type {Function|null}
 */
let onSensorDataCallback = null;

/**
 * Callback-Funktion für GPS-Updates
 * @type {Function|null}
 */
let onGpsUpdateCallback = null;

/**
 * Callback-Funktion für Verbindungsstatus-Änderungen
 * @type {Function|null}
 */
let onConnectionChangeCallback = null;

/**
 * Registriert Callback für Sensor-Daten
 * @param {Function} callback - Callback-Funktion die bei neuen Daten aufgerufen wird
 */
export function onSensorData(callback) {
    onSensorDataCallback = callback;
}

/**
 * Registriert Callback für GPS-Updates
 * @param {Function} callback - Callback-Funktion die bei GPS-Updates aufgerufen wird
 */
export function onGpsUpdate(callback) {
    onGpsUpdateCallback = callback;
}

/**
 * Registriert Callback für Verbindungsstatus-Änderungen
 * @param {Function} callback - Callback-Funktion (connected: boolean)
 */
export function onConnectionChange(callback) {
    onConnectionChangeCallback = callback;
}

/**
 * Stellt WebSocket-Verbindung zum Backend her
 * Reconnect-Logic bei Verbindungsabbruch (3 Sekunden Verzögerung)
 */
export function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('WebSocket verbunden');
        if (onConnectionChangeCallback) {
            onConnectionChangeCallback(true);
        }
        // Status-Anzeige aktualisieren
        const statusEl = document.getElementById('signalk-status');
        if (statusEl) {
            statusEl.classList.add('connected');
        }
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            // Sensor-Daten an registrierten Callback weiterleiten
            if (onSensorDataCallback) {
                onSensorDataCallback(data);
            }

            // GPS-Daten verarbeiten
            if (data.gps && data.gps.lat !== 0 && data.gps.lon !== 0) {
                lastBackendGpsTime = Date.now();
                backendGpsUnavailableStartTime = null;

                if (gpsSource !== "backend") {
                    gpsSource = "backend";
                }

                // GPS-Update Callback
                if (onGpsUpdateCallback) {
                    onGpsUpdateCallback(data.gps, 'backend');
                }
            } else {
                // Backend GPS ungültig oder nicht verfügbar
                if (backendGpsUnavailableStartTime === null) {
                    backendGpsUnavailableStartTime = Date.now();
                }

                // GPS-Quelle zurücksetzen nach 5 Sekunden ohne gültige Daten
                if (gpsSource === "backend" && lastBackendGpsTime &&
                    (Date.now() - lastBackendGpsTime) > 5000) {
                    gpsSource = null;
                }
            }
        } catch (e) {
            console.error('Fehler beim Parsen der WebSocket-Daten:', e);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket Fehler:', error);
        const statusEl = document.getElementById('signalk-status');
        if (statusEl) {
            statusEl.classList.remove('connected');
        }
        if (onConnectionChangeCallback) {
            onConnectionChangeCallback(false);
        }
    };

    ws.onclose = () => {
        console.log('WebSocket getrennt, Reconnect in 3 Sekunden...');
        const statusEl = document.getElementById('signalk-status');
        if (statusEl) {
            statusEl.classList.remove('connected');
        }
        if (onConnectionChangeCallback) {
            onConnectionChangeCallback(false);
        }
        // Automatischer Reconnect nach 3 Sekunden
        setTimeout(connectWebSocket, 3000);
    };
}

/**
 * Sendet Daten über WebSocket
 * @param {Object} data - Zu sendende Daten
 * @returns {boolean} - true wenn erfolgreich gesendet
 */
export function sendWebSocketMessage(data) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
        return true;
    }
    return false;
}

/**
 * Prüft ob WebSocket verbunden ist
 * @returns {boolean}
 */
export function isWebSocketConnected() {
    return ws && ws.readyState === WebSocket.OPEN;
}


// ==================== UTILITY-FUNKTIONEN ====================

/**
 * Berechnet die Distanz zwischen zwei Punkten in Metern (Haversine-Formel)
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Längengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Längengrad Punkt 2
 * @returns {number} - Distanz in Metern
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
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
 * Erstellt Bounding-Box aus einem Array von Punkten
 * @param {Array} points - Array von [lat, lon] oder {lat, lon} Punkten
 * @returns {Array|null} - [[minLon, minLat], [maxLon, maxLat]] oder null
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
 * Formatiert Koordinaten als String
 * @param {number} lat - Breitengrad
 * @param {number} lon - Längengrad
 * @param {string} format - Format: 'decimal', 'dm' (Grad Minuten), 'dms' (Grad Minuten Sekunden)
 * @returns {string} - Formatierte Koordinaten
 */
export function formatCoordinate(lat, lon, format = 'decimal') {
    switch (format) {
        case 'decimal':
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

        case 'dm': // Grad und Dezimalminuten
            const latDM = decimalToDM(lat, 'lat');
            const lonDM = decimalToDM(lon, 'lon');
            return `${latDM}, ${lonDM}`;

        case 'dms': // Grad, Minuten, Sekunden
            const latDMS = decimalToDMS(lat, 'lat');
            const lonDMS = decimalToDMS(lon, 'lon');
            return `${latDMS}, ${lonDMS}`;

        default:
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
}

/**
 * Konvertiert Dezimalgrad zu Grad und Dezimalminuten
 * @param {number} decimal - Dezimalgrad
 * @param {string} type - 'lat' oder 'lon'
 * @returns {string} - Formatierter String
 */
function decimalToDM(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = (absolute - degrees) * 60;
    const direction = type === 'lat'
        ? (decimal >= 0 ? 'N' : 'S')
        : (decimal >= 0 ? 'E' : 'W');
    return `${degrees}° ${minutes.toFixed(3)}' ${direction}`;
}

/**
 * Konvertiert Dezimalgrad zu Grad, Minuten, Sekunden
 * @param {number} decimal - Dezimalgrad
 * @param {string} type - 'lat' oder 'lon'
 * @returns {string} - Formatierter String
 */
function decimalToDMS(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = (minutesDecimal - minutes) * 60;
    const direction = type === 'lat'
        ? (decimal >= 0 ? 'N' : 'S')
        : (decimal >= 0 ? 'E' : 'W');
    return `${degrees}° ${minutes}' ${seconds.toFixed(1)}" ${direction}`;
}

/**
 * Formatiert Geschwindigkeit mit Einheit
 * @param {number} knots - Geschwindigkeit in Knoten
 * @param {number} decimals - Anzahl Dezimalstellen
 * @returns {string} - Formatierte Geschwindigkeit (z.B. "5.2 kn")
 */
export function formatSpeed(knots, decimals = 1) {
    return `${knots.toFixed(decimals)} kn`;
}

/**
 * Formatiert Distanz mit Einheit
 * @param {number} meters - Distanz in Metern
 * @param {number} decimals - Anzahl Dezimalstellen
 * @returns {string} - Formatierte Distanz
 */
export function formatDistance(meters, decimals = 2) {
    // Umrechnung in Seemeilen
    const nm = meters / 1852;
    return `${nm.toFixed(decimals)} NM`;
}

/**
 * Formatiert Wassertiefe mit Einheit
 * @param {number} meters - Tiefe in Metern
 * @param {number} decimals - Anzahl Dezimalstellen
 * @returns {string} - Formatierte Tiefe (z.B. "3.5 m")
 */
export function formatDepth(meters, decimals = 1) {
    return `${meters.toFixed(decimals)} m`;
}

/**
 * Formatiert Zeit (Stunden und Minuten)
 * @param {number} hours - Zeit in Stunden (kann Dezimalstellen haben)
 * @returns {string} - Formatierte Zeit (z.B. "2h 30min")
 */
export function formatTime(hours) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h === 0) {
        return `${m}min`;
    }
    return `${h}h ${m}min`;
}

/**
 * Formatiert Zeitstempel als Uhrzeit
 * @param {Date|number|string} timestamp - Zeitstempel
 * @returns {string} - Formatierte Uhrzeit (HH:MM)
 */
export function formatTimeOfDay(timestamp) {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

/**
 * Formatiert Datum
 * @param {Date|number|string} timestamp - Zeitstempel
 * @param {string} format - Format: 'dd.mm.yyyy', 'yyyy-mm-dd', etc.
 * @returns {string} - Formatiertes Datum
 */
export function formatDate(timestamp, format = 'dd.mm.yyyy') {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();

    switch (format) {
        case 'dd.mm.yyyy':
            return `${day}.${month}.${year}`;
        case 'yyyy-mm-dd':
            return `${year}-${month}-${day}`;
        case 'mm/dd/yyyy':
            return `${month}/${day}/${year}`;
        default:
            return `${day}.${month}.${year}`;
    }
}

/**
 * Formatiert Kurs/Heading
 * @param {number} degrees - Kurs in Grad
 * @returns {string} - Formatierter Kurs (z.B. "045°")
 */
export function formatHeading(degrees) {
    const normalized = ((degrees % 360) + 360) % 360;
    return `${Math.round(normalized).toString().padStart(3, '0')}°`;
}

/**
 * Konvertiert Kurs in Kardinalrichtung
 * @param {number} degrees - Kurs in Grad
 * @returns {string} - Kardinalrichtung (N, NE, E, SE, S, SW, W, NW)
 */
export function degreesToCardinal(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((degrees % 360) + 360) % 360 / 45) % 8;
    return directions[index];
}

/**
 * Berechnet Kurs zwischen zwei Punkten
 * @param {number} lat1 - Breitengrad Start
 * @param {number} lon1 - Längengrad Start
 * @param {number} lat2 - Breitengrad Ziel
 * @param {number} lon2 - Längengrad Ziel
 * @returns {number} - Kurs in Grad (0-360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}


// ==================== TRACK HISTORY ====================

/**
 * Fuegt einen Punkt zur Track-History hinzu
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 */
export function addToTrackHistory(lat, lon) {
    const now = Date.now();

    // Nur hinzufuegen wenn genug Abstand zum letzten Punkt (>10m)
    if (trackHistory.length > 0) {
        const last = trackHistory[trackHistory.length - 1];
        const distance = calculateDistance(last.lat, last.lon, lat, lon);
        if (distance < 10) {
            return; // Zu nah am letzten Punkt
        }
    }

    trackHistory.push({ lat, lon, timestamp: now });

    // Alte Punkte entfernen wenn Maximum ueberschritten
    while (trackHistory.length > maxTrackPoints) {
        trackHistory.shift();
    }
}

/**
 * Loescht die Track-History
 */
export function clearTrackHistory() {
    trackHistory = [];
}

/**
 * Gibt die Track-History als GeoJSON LineString zurueck
 * @returns {Object} - GeoJSON LineString
 */
export function getTrackHistoryAsGeoJSON() {
    const coordinates = trackHistory.map(p => [p.lon, p.lat]);
    return {
        type: 'LineString',
        coordinates: coordinates
    };
}


// ==================== INITIALISIERUNG ====================

/**
 * Registrierte Startup-Callbacks
 * @type {Array<Function>}
 */
const startupCallbacks = [];

/**
 * Registriert eine Funktion die beim Start ausgefuehrt wird
 * @param {Function} callback - Callback-Funktion
 */
export function onStartup(callback) {
    startupCallbacks.push(callback);
}

/**
 * Fuehrt alle registrierten Startup-Callbacks aus
 */
function runStartupCallbacks() {
    startupCallbacks.forEach(callback => {
        try {
            callback();
        } catch (e) {
            console.error('Fehler bei Startup-Callback:', e);
        }
    });
}

/**
 * Haupt-Initialisierungsfunktion
 * Wird bei DOMContentLoaded aufgerufen
 */
export function doStartup() {
    console.log('BoatOS Core initialisiert');

    // GPS-Schwellenwert aus Einstellungen laden
    try {
        const settingsStr = localStorage.getItem('boatos_settings');
        if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.gps && settings.gps.lowSatelliteThreshold) {
                LOW_SATELLITE_THRESHOLD = settings.gps.lowSatelliteThreshold * 1000;
                console.log(`GPS Satelliten-Schwellenwert: ${settings.gps.lowSatelliteThreshold}s`);
            }
        }
    } catch (e) {
        console.warn('Fehler beim Laden der Settings:', e);
    }

    // WebSocket-Verbindung herstellen
    connectWebSocket();

    // Registrierte Callbacks ausfuehren
    runStartupCallbacks();

    console.log('BoatOS Frontend gestartet!');
}

/**
 * Prueft ob Geraet im Kiosk-Modus laeuft (lokal auf Raspberry Pi)
 * @returns {boolean}
 */
export function isKioskMode() {
    return window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1' ||
           window.location.hostname === '::1';
}

/**
 * Prueft ob auf Raspberry Pi ausgefuehrt wird
 * @returns {boolean}
 */
export function isRunningOnPi() {
    return isKioskMode() || window.location.hostname.startsWith('192.168.');
}


// ==================== DOM READY HANDLER ====================

// HINWEIS: Auto-Start deaktiviert für ES6 Modul-System
// Die Initialisierung wird jetzt von index_new.html gesteuert
// Falls die alte app.js verwendet wird, muss doStartup() manuell aufgerufen werden

/**
 * Init-Alias für einheitliche API
 * Kann von außen aufgerufen werden um Core zu initialisieren
 */
export function init() {
    doStartup();
}

// ==================== NOTFALL-FUNKTIONEN ====================

/**
 * Man Over Board (MOB) Alarm
 * Setzt einen MOB-Marker an der aktuellen Position
 */
export function manOverBoard() {
    console.log('MOB ALARM!');

    const pos = currentPosition || { lat: 51.855, lon: 12.046 };

    // Alarm-Sound abspielen (falls verfügbar)
    try {
        const audio = new Audio('/sounds/alarm.mp3');
        audio.play().catch(() => {});
    } catch (e) {
        // Sound nicht verfügbar
    }

    // Benachrichtigung anzeigen
    if (window.BoatOS && window.BoatOS.ui && window.BoatOS.ui.showNotification) {
        window.BoatOS.ui.showNotification('MOB ALARM! Position markiert!', 'error');
    }

    // MOB-Position speichern
    const mobPosition = {
        lat: pos.lat,
        lon: pos.lon,
        timestamp: new Date().toISOString()
    };

    localStorage.setItem('mob_position', JSON.stringify(mobPosition));

    // Zur MOB-Position fliegen
    if (window.BoatOS && window.BoatOS.map && window.BoatOS.map.flyTo) {
        window.BoatOS.map.flyTo(pos.lat, pos.lon, 16);
    }

    // TODO: MOB-Marker auf Karte setzen
    console.log('MOB Position:', mobPosition);

    return mobPosition;
}


// ==================== EXPORTS (Zusammenfassung) ====================
// Alle wichtigen Exporte sind oben mit 'export' gekennzeichnet
//
// Konfiguration:
//   - API_URL, WS_URL, MAP_CONFIG, GPS_CONFIG, TRACK_CONFIG
//
// Zustandsvariablen:
//   - currentPosition, currentSpeed, currentBoatHeading, currentDepth
//   - gpsSource, browserGpsAccuracy, lastGpsUpdate
//   - autoFollow, weatherData, trackHistory
//
// WebSocket:
//   - connectWebSocket(), sendWebSocketMessage(), isWebSocketConnected()
//   - onSensorData(), onGpsUpdate(), onConnectionChange()
//
// Utility-Funktionen:
//   - calculateDistance(), createBoundsFromPoints(), calculateBearing()
//   - formatCoordinate(), formatSpeed(), formatDistance(), formatDepth()
//   - formatTime(), formatTimeOfDay(), formatDate(), formatHeading()
//   - degreesToCardinal()
//
// Track History:
//   - addToTrackHistory(), clearTrackHistory(), getTrackHistoryAsGeoJSON()
//
// Initialisierung:
//   - doStartup(), onStartup(), isKioskMode(), isRunningOnPi()
