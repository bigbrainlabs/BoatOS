/**
 * BoatOS Sensors Modul
 *
 * Dieses Modul verarbeitet alle GPS- und Sensordaten:
 * - GPS-Daten Verarbeitung (WebSocket gps_update Events)
 * - Track-Recording (Aufzeichnung der Fahrt)
 * - GPS-Status Updates (Satelliten, HDOP, VDOP)
 * - Kompass/Heading Anzeige
 * - Position-History und Track-Punkte
 *
 * @module sensors
 */

// ==================== IMPORTS ====================
// Da core.js und map.js noch nicht existieren, greifen wir vorerst
// auf globale Variablen zu. Bei zukuenftiger Modularisierung ersetzen durch:
// import { API_URL, WS_URL } from './core.js';
// import { map, boatMarker, boatMarkerElement } from './map.js';

// ==================== KONSTANTEN ====================
// Standardwerte fuer GPS-Konfiguration
const DEFAULT_MAX_TRACK_POINTS = 500;
const DEFAULT_LOW_SATELLITE_THRESHOLD = 15000; // 15 Sekunden in Millisekunden
const BACKEND_GPS_FALLBACK_DELAY = 30000; // 30 Sekunden bevor Browser-GPS als Fallback verwendet wird

// ==================== MODUL-ZUSTAND ====================
// Track-History und Position
let trackHistory = []; // Array von {lat, lon, timestamp}
let maxTrackPoints = DEFAULT_MAX_TRACK_POINTS;
let currentPosition = { lat: 51.855, lon: 12.046 }; // Standard: Aken/Elbe

// GPS-Zustand
let lastGpsUpdate = null;
let gpsSource = null; // "backend" oder "browser"
let browserGpsAccuracy = null;
let lowSatelliteStartTime = null; // Zeitstempel wann Satellitenanzahl unter 4 fiel
let LOW_SATELLITE_THRESHOLD = DEFAULT_LOW_SATELLITE_THRESHOLD;
let lastBackendGpsTime = null; // Zeitpunkt des letzten gültigen Backend-GPS
let backendGpsUnavailableStartTime = null; // Zeitpunkt wann Backend-GPS nicht mehr verfuegbar war
let firstGpsPositionReceived = false; // Ob Karte bereits auf erste GPS-Position zentriert wurde
let currentBoatHeading = 0; // Aktueller Kurs/Heading des Boots

// Kompass-Zustand
let compassRoseElement = null;
let compassRoseContainer = null;
let currentHeading = 0;

// Auto-Follow Modus (Karte folgt Boot)
let autoFollow = true;

// ==================== GPS-DATEN VERARBEITUNG ====================

/**
 * Verarbeitet eingehende GPS-Updates vom WebSocket
 * Diese Funktion wird bei jedem 'gps_update' Event aufgerufen
 *
 * @param {Object} data - Sensordaten vom Backend
 * @param {Object} data.gps - GPS-Daten mit lat, lon, satellites, etc.
 */
export function handleGPSUpdate(data) {
    // Sensordaten fuer GPS-Panel cachen
    window.lastSensorData = data;

    // Backend GPS hat Prioritaet - immer verwenden wenn gueltig
    if (data.gps && data.gps.lat !== 0 && data.gps.lon !== 0) {
        lastBackendGpsTime = Date.now();
        backendGpsUnavailableStartTime = null; // Timer zuruecksetzen

        if (gpsSource !== "backend") {
            gpsSource = "backend";
            updateGpsSourceIndicator();
        }

        // Karte auf erste GPS-Position zentrieren
        const map = getMap();
        if (!firstGpsPositionReceived && map) {
            firstGpsPositionReceived = true;
            console.log('GPS: Erste Position empfangen - zentriere Karte auf: ' +
                data.gps.lat.toFixed(6) + ', ' + data.gps.lon.toFixed(6));
            map.flyTo({
                center: [data.gps.lon, data.gps.lat],
                zoom: 14,
                duration: 1500
            });
        }

        updateBoatPosition(data.gps);
    } else {
        // Backend GPS ungueltig oder fehlt
        if (backendGpsUnavailableStartTime === null) {
            backendGpsUnavailableStartTime = Date.now();
        }

        // Quelle erst nach 5 Sekunden ohne gueltige Daten zuruecksetzen
        if (gpsSource === "backend" && lastBackendGpsTime &&
            (Date.now() - lastBackendGpsTime) > 5000) {
            gpsSource = null;
            updateGpsSourceIndicator();
        }
    }
}

/**
 * Verarbeitet GPS-Daten und extrahiert relevante Informationen
 *
 * @param {Object} gpsData - Rohe GPS-Daten
 * @returns {Object} Verarbeitete GPS-Daten
 */
export function processGPSData(gpsData) {
    if (!gpsData) return null;

    return {
        lat: gpsData.lat || 0,
        lon: gpsData.lon || 0,
        speed: gpsData.speed || 0, // in Knoten
        heading: gpsData.heading || gpsData.course || 0,
        course: gpsData.course || 0,
        satellites: gpsData.satellites || 0,
        altitude: gpsData.altitude || 0,
        hdop: gpsData.hdop || null,
        vdop: gpsData.vdop || null,
        fix: gpsData.fix || false,
        timestamp: gpsData.timestamp || new Date().toISOString()
    };
}

// ==================== BOOT-POSITION UPDATE ====================

/**
 * Aktualisiert die Boot-Position auf der Karte
 *
 * @param {Object} gps - GPS-Daten mit lat, lon, course, heading
 */
export function updateBoatPosition(gps) {
    const map = getMap();
    const boatMarker = getBoatMarker();
    const boatMarkerElement = getBoatMarkerElement();

    if (gps && gps.lat && gps.lon) {
        const newLat = gps.lat;
        const newLon = gps.lon;

        // Nur aktualisieren wenn sich Position tatsaechlich geaendert hat
        if (newLat === currentPosition.lat && newLon === currentPosition.lon) {
            return;
        }

        currentPosition = { lat: newLat, lon: newLon };

        // Zur Track-Historie hinzufuegen
        addToTrackHistory(newLat, newLon);

        // Boot-Marker Position aktualisieren - MapLibre nutzt [lon, lat]
        if (boatMarker) {
            boatMarker.setLngLat([newLon, newLat]);
        }

        // Marker basierend auf Kurs rotieren (falls verfuegbar)
        let heading = gps.course || gps.heading || 0;
        if (heading !== undefined && heading !== 0) {
            currentBoatHeading = heading;
            // Boot-Marker Element rotieren
            if (boatMarkerElement) {
                boatMarkerElement.style.transform = `rotate(${heading}deg)`;
            }
            // Kompassrose mit Heading aktualisieren
            updateCompassRose(heading);
        } else if (gps.heading !== undefined) {
            // Heading verwenden wenn Kurs nicht verfuegbar
            updateCompassRose(gps.heading);
        }

        // Karte folgt Boot wenn Auto-Follow aktiv
        if (autoFollow && map) {
            map.easeTo({
                center: [newLon, newLat],
                duration: 500
            });
        }

        lastGpsUpdate = Date.now();
        console.log(`GPS: ${newLat.toFixed(6)}, ${newLon.toFixed(6)}`);

        // Externe Callback-Funktionen aufrufen (falls vorhanden)
        if (typeof window.onBoatPositionUpdate === 'function') {
            window.onBoatPositionUpdate(newLat, newLon, gps);
        }
    } else {
        // Keine gueltigen GPS-Daten - pruefen ob GPS veraltet
        if (lastGpsUpdate && (Date.now() - lastGpsUpdate) > 10000) {
            const gpsStatus = document.getElementById('gps-status');
            if (gpsStatus) {
                gpsStatus.classList.remove('connected');
            }
        }
    }
}

// ==================== TRACK-RECORDING ====================

/**
 * Fuegt einen Punkt zur Track-Historie hinzu
 *
 * @param {number} lat - Breitengrad
 * @param {number} lon - Laengengrad
 */
export function addToTrackHistory(lat, lon) {
    // Neuen Punkt zur Track-Historie hinzufuegen
    trackHistory.push({ lat, lon, timestamp: Date.now() });

    // Track-Historie auf maxTrackPoints begrenzen
    if (trackHistory.length > maxTrackPoints) {
        trackHistory.shift(); // Aeltesten Punkt entfernen
    }

    // GeoJSON-Quelle aktualisieren - MapLibre nutzt [lon, lat]
    const coordinates = trackHistory.map(point => [point.lon, point.lat]);
    const map = getMap();
    if (map && map.getSource('track-history')) {
        map.getSource('track-history').setData({
            type: 'LineString',
            coordinates: coordinates
        });
    }
}

/**
 * Startet die Track-Aufzeichnung
 * Setzt die Track-Historie zurueck und beginnt neue Aufzeichnung
 */
export function startRecording() {
    trackHistory = [];
    console.log('Track-Aufzeichnung gestartet');

    if (typeof window.showMsg === 'function') {
        window.showMsg('Aufzeichnung gestartet');
    }
}

/**
 * Stoppt die Track-Aufzeichnung
 *
 * @returns {Array} Die aufgezeichnete Track-Historie
 */
export function stopRecording() {
    console.log('Track-Aufzeichnung gestoppt. Punkte: ' + trackHistory.length);

    if (typeof window.showMsg === 'function') {
        window.showMsg('Aufzeichnung gestoppt (' + trackHistory.length + ' Punkte)');
    }

    return [...trackHistory]; // Kopie zurueckgeben
}

/**
 * Speichert den aktuellen Track als GPX-Datei
 *
 * @param {string} [name] - Optionaler Name fuer den Track
 * @returns {Promise<Object>} Gespeicherte Track-Daten
 */
export async function saveTrack(name) {
    const trackName = name || `Track ${new Date().toLocaleDateString('de-DE')}`;

    const trackData = {
        name: trackName,
        points: trackHistory.map(p => ({
            lat: p.lat,
            lon: p.lon,
            timestamp: new Date(p.timestamp).toISOString()
        })),
        timestamp: new Date().toISOString()
    };

    try {
        const API_URL = getApiUrl();
        const response = await fetch(`${API_URL}/api/tracks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(trackData)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Track gespeichert:', result);

            if (typeof window.showNotification === 'function') {
                window.showNotification('Track gespeichert');
            }
            return result;
        } else {
            throw new Error('Track speichern fehlgeschlagen');
        }
    } catch (err) {
        console.error('Fehler beim Speichern des Tracks:', err);
        throw err;
    }
}

/**
 * Loescht die Track-Historie
 */
export function clearTrackHistory() {
    trackHistory = [];
    const map = getMap();
    if (map && map.getSource('track-history')) {
        map.getSource('track-history').setData({
            type: 'LineString',
            coordinates: []
        });
    }
    if (typeof window.showMsg === 'function') {
        window.showMsg('Track-Historie geloescht');
    }
}

/**
 * Zeigt oder versteckt die Track-Historie auf der Karte
 *
 * @param {boolean} show - true zum Anzeigen, false zum Verstecken
 */
export function toggleTrackHistory(show) {
    const map = getMap();
    if (map && map.getLayer('track-line')) {
        map.setLayoutProperty('track-line', 'visibility', show ? 'visible' : 'none');
    }
}

// Track-Sichtbarkeit State
let trackVisible = true;

/**
 * Toggelt die Track-Anzeige (für Button)
 */
export function toggleTrack() {
    trackVisible = !trackVisible;
    toggleTrackHistory(trackVisible);

    // Button-Styling aktualisieren
    const trackBtn = document.getElementById('trackBtn');
    if (trackBtn) {
        if (trackVisible) {
            trackBtn.classList.remove('recording');
            trackBtn.style.background = '';
        } else {
            trackBtn.classList.add('recording');
        }
    }

    console.log(`Track ${trackVisible ? 'sichtbar' : 'versteckt'}`);
}

// ==================== GPS-STATUS UPDATE ====================

/**
 * Aktualisiert die GPS-Status-Anzeige
 *
 * @param {Object} gps - GPS-Daten
 */
export function updateGPSStatus(gps) {
    updateGpsInfo(gps);
}

/**
 * Aktualisiert die GPS-Info-Anzeige im GPS-Panel
 *
 * @param {Object} gps - GPS-Daten mit satellites, altitude, hdop, vdop, etc.
 */
export function updateGpsInfo(gps) {
    const gpsStatus = document.getElementById('gps-status');

    // Satelliten-Indikator mit Zeitverzoegerung fuer niedrige Satellitenanzahl
    // Nur satellitenbasierte Logik wenn Satellitendaten vorhanden (Backend-GPS)
    if (gps.satellites !== undefined) {
        const satCount = gps.satellites;
        const now = Date.now();

        if (satCount >= 4) {
            // Gute Satellitenanzahl - sofort verbunden anzeigen
            gpsStatus.classList.add('connected');
            gpsStatus.title = `GPS: ${satCount} Satelliten`;
            // Timer zuruecksetzen
            lowSatelliteStartTime = null;
        } else {
            // Niedrige Satellitenanzahl - 'connected' erst nach Threshold-Zeit entfernen
            if (lowSatelliteStartTime === null) {
                // Erstes Mal unter 4 Satelliten - Timer starten
                lowSatelliteStartTime = now;
            } else if (now - lowSatelliteStartTime >= LOW_SATELLITE_THRESHOLD) {
                // Laenger als Threshold unter 4 Satelliten - getrennt anzeigen
                gpsStatus.classList.remove('connected');
            }
            // Titel immer mit aktueller Anzahl aktualisieren
            gpsStatus.title = `GPS: ${satCount} Satelliten (kein Fix)`;
        }
    } else if (gpsSource === "browser") {
        // Browser-GPS - keine Satellitendaten verfuegbar
        // Verbunden annehmen wenn Browser-GPS Daten empfangen werden
        gpsStatus.classList.add('connected');
        gpsStatus.title = `GPS: Browser/Phone`;
        lowSatelliteStartTime = null; // Timer fuer Browser-GPS zuruecksetzen
    }

    // GPS-Detail-Info aktualisieren wenn Panel existiert
    const gpsPanel = document.getElementById('gps-panel');
    if (gpsPanel) {
        updateGpsPanelDetails(gps);
    }
}

/**
 * Aktualisiert die Satelliten-Informationen im GPS-Panel
 *
 * @param {Object} gps - GPS-Daten
 */
export function updateSatelliteInfo(gps) {
    const satEl = document.getElementById('gps-satellites');
    if (satEl && gps.satellites !== undefined) {
        satEl.textContent = gps.satellites;

        // Farbcodierung basierend auf Satellitenanzahl
        if (gps.satellites >= 6) {
            satEl.style.color = '#2ecc71'; // Gruen - ausgezeichnet
        } else if (gps.satellites >= 4) {
            satEl.style.color = '#f39c12'; // Orange - akzeptabel
        } else {
            satEl.style.color = '#e74c3c'; // Rot - schlecht
        }
    }
}

/**
 * Aktualisiert die Detail-Anzeige im GPS-Panel
 *
 * @param {Object} gps - GPS-Daten
 */
function updateGpsPanelDetails(gps) {
    // Satelliten
    if (gps.satellites !== undefined) {
        const satEl = document.getElementById('gps-satellites');
        if (satEl) satEl.textContent = gps.satellites;
    }

    // Hoehe
    if (gps.altitude !== undefined) {
        const altEl = document.getElementById('gps-altitude');
        if (altEl) altEl.textContent = `${gps.altitude.toFixed(1)} m`;
    }

    // Position
    if (gps.lat !== undefined && gps.lon !== undefined) {
        const posEl = document.getElementById('gps-position');
        if (posEl) {
            const posFormatted = typeof window.formatCoordinates === 'function'
                ? window.formatCoordinates(gps.lat, gps.lon)
                : `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
            posEl.textContent = posFormatted;
        }
    }

    // Geschwindigkeit
    const speedEl = document.getElementById('gps-speed');
    if (speedEl && gps.speed !== undefined) {
        const speedFormatted = typeof window.formatSpeed === 'function'
            ? window.formatSpeed(gps.speed)
            : `${gps.speed.toFixed(1)} kn`;
        speedEl.textContent = speedFormatted;
    }

    // Heading
    const headingEl = document.getElementById('gps-heading');
    if (headingEl && gps.heading !== undefined) {
        headingEl.textContent = `${Math.round(gps.heading)}`;
    }

    // Fix-Status
    const fixStatusEl = document.getElementById('gps-fix-status');
    if (fixStatusEl) {
        if (gps.fix) {
            fixStatusEl.textContent = typeof window.t === 'function' ? window.t('gps_fix') : 'Fix';
            fixStatusEl.style.color = '#2ecc71';
        } else {
            fixStatusEl.textContent = typeof window.t === 'function' ? window.t('gps_no_fix') : 'Kein Fix';
            fixStatusEl.style.color = '#e74c3c';
        }
    }

    // Zeitstempel
    const timestampEl = document.getElementById('gps-timestamp');
    if (timestampEl && gps.timestamp) {
        const date = new Date(gps.timestamp);
        timestampEl.textContent = date.toLocaleTimeString('de-DE');
    }

    // HDOP (Horizontal Dilution of Precision)
    const hdopEl = document.getElementById('gps-hdop');
    if (hdopEl && gps.hdop !== undefined && gps.hdop !== null) {
        hdopEl.textContent = gps.hdop.toFixed(2);
        // Farbcodierung: <2 ausgezeichnet, 2-5 gut, 5-10 maessig, >10 schlecht
        if (gps.hdop < 2) hdopEl.style.color = '#2ecc71';
        else if (gps.hdop < 5) hdopEl.style.color = '#f39c12';
        else if (gps.hdop < 10) hdopEl.style.color = '#e67e22';
        else hdopEl.style.color = '#e74c3c';
    }

    // VDOP (Vertical Dilution of Precision)
    const vdopEl = document.getElementById('gps-vdop');
    if (vdopEl && gps.vdop !== undefined && gps.vdop !== null) {
        vdopEl.textContent = gps.vdop.toFixed(2);
        // Farbcodierung: <2 ausgezeichnet, 2-5 gut, 5-10 maessig, >10 schlecht
        if (gps.vdop < 2) vdopEl.style.color = '#2ecc71';
        else if (gps.vdop < 5) vdopEl.style.color = '#f39c12';
        else if (gps.vdop < 10) vdopEl.style.color = '#e67e22';
        else vdopEl.style.color = '#e74c3c';
    }
}

/**
 * Aktualisiert die GPS-Quellen-Anzeige (Backend vs Browser)
 */
export function updateGpsSourceIndicator() {
    const gpsStatus = document.getElementById("gps-status");
    const gpsSourceEl = document.getElementById("gps-source");
    const gpsAccuracyEl = document.getElementById("gps-accuracy");

    // Hintergrund nicht ueberschreiben - updateGpsInfo() handhabt das via 'connected' Klasse
    // Nur Icon/Emoji basierend auf GPS-Quelle aktualisieren
    if (gpsSource === "backend") {
        if (gpsStatus) gpsStatus.textContent = "GPS";
        if (gpsSourceEl) gpsSourceEl.textContent = "Backend Module";
        if (gpsAccuracyEl) gpsAccuracyEl.textContent = "High";
    } else if (gpsSource === "browser") {
        if (gpsStatus) gpsStatus.textContent = "GPS";
        if (gpsSourceEl) gpsSourceEl.textContent = "Browser/Phone";
        if (gpsAccuracyEl && browserGpsAccuracy) {
            gpsAccuracyEl.textContent = Math.round(browserGpsAccuracy) + " m";
        }
    } else {
        if (gpsStatus) gpsStatus.textContent = "GPS";
        if (gpsSourceEl) gpsSourceEl.textContent = "No Signal";
        if (gpsAccuracyEl) gpsAccuracyEl.textContent = "-- m";
    }
}

// ==================== KOMPASS / HEADING ====================

/**
 * Erstellt die Kompassrose als DOM-Element
 *
 * @returns {HTMLElement} Container-Element der Kompassrose
 */
export function createCompassRose() {
    const container = document.createElement('div');
    container.className = 'compass-rose-container';
    container.style.cssText = 'position: absolute; top: 10px; left: 10px; width: 100px; height: 100px; background: rgba(255,255,255,0.9); border: 3px solid rgba(0,0,0,0.3); border-radius: 50%; box-shadow: 0 2px 10px rgba(0,0,0,0.3); z-index: 1000;';

    // Kompass-Markierungen generieren
    const markings = Array.from({length: 12}, (_, i) => {
        const angle = i * 30;
        const rad = (angle - 90) * Math.PI / 180;
        const x1 = 50 + 40 * Math.cos(rad);
        const y1 = 50 + 40 * Math.sin(rad);
        const x2 = 50 + 45 * Math.cos(rad);
        const y2 = 50 + 45 * Math.sin(rad);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f8c8d" stroke-width="2"/>`;
    }).join('');

    // Kompassrose SVG
    container.innerHTML = `
        <svg width="100" height="100" viewBox="0 0 100 100" style="position: absolute; top: 0; left: 0; transition: transform 0.5s ease-out;">
            <circle cx="50" cy="50" r="48" fill="#fff" stroke="#333" stroke-width="2"/>
            <text x="50" y="15" text-anchor="middle" font-size="14" font-weight="bold" fill="#e74c3c">N</text>
            <text x="85" y="54" text-anchor="middle" font-size="12" font-weight="bold" fill="#34495e">E</text>
            <text x="50" y="92" text-anchor="middle" font-size="12" font-weight="bold" fill="#34495e">S</text>
            <text x="15" y="54" text-anchor="middle" font-size="12" font-weight="bold" fill="#34495e">W</text>
            <polygon points="50,10 45,55 50,50 55,55" fill="#e74c3c" stroke="#c0392b" stroke-width="1"/>
            <polygon points="50,90 45,45 50,50 55,45" fill="#ecf0f1" stroke="#95a5a6" stroke-width="1"/>
            <circle cx="50" cy="50" r="4" fill="#2c3e50"/>
            <g id="compass-markings">${markings}</g>
        </svg>
        <div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #64ffda; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; font-family: monospace;" id="compass-heading">000</div>
    `;

    compassRoseElement = container.querySelector('svg');
    compassRoseContainer = container;
    return container;
}

/**
 * Aktualisiert die Kompassrose mit dem aktuellen Heading
 *
 * @param {number} heading - Kurs in Grad (0-360)
 */
export function updateCompassRose(heading) {
    if (compassRoseElement && heading !== undefined && heading !== null) {
        currentHeading = heading;
        compassRoseElement.style.transform = `rotate(${-heading}deg)`;
        const headingText = document.getElementById('compass-heading');
        if (headingText) {
            headingText.textContent = `${Math.round(heading).toString().padStart(3, '0')}`;
        }
    }
}

/**
 * Alias fuer updateCompassRose - aktualisiert das Heading
 *
 * @param {number} heading - Kurs in Grad (0-360)
 */
export function updateHeading(heading) {
    updateCompassRose(heading);
    currentBoatHeading = heading;
}

/**
 * Zeigt oder versteckt die Kompassrose
 *
 * @param {boolean} show - true zum Anzeigen, false zum Verstecken
 */
export function toggleCompassRose(show) {
    const mapContainer = document.getElementById('map-container');
    const existingCompass = document.querySelector('.compass-rose-container');

    if (show) {
        if (!existingCompass && mapContainer) {
            mapContainer.appendChild(createCompassRose());
        }
    } else {
        if (existingCompass) {
            existingCompass.remove();
            compassRoseContainer = null;
        }
    }
}

/**
 * Aktualisiert die Kompass-Anzeige (Alias fuer toggleCompassRose)
 *
 * @param {number} heading - Kurs in Grad (0-360)
 */
export function updateCompass(heading) {
    updateCompassRose(heading);
}

// ==================== HILFSFUNKTIONEN ====================

/**
 * Holt die Map-Instanz (von globalem Scope oder window)
 * @returns {Object|null} MapLibre Map Instanz
 */
function getMap() {
    return window.map || null;
}

/**
 * Holt den Boot-Marker (von globalem Scope oder window)
 * @returns {Object|null} MapLibre Marker Instanz
 */
function getBoatMarker() {
    return window.boatMarker || null;
}

/**
 * Holt das Boot-Marker DOM Element
 * @returns {HTMLElement|null} Boot-Marker HTML Element
 */
function getBoatMarkerElement() {
    return window.boatMarkerElement || null;
}

/**
 * Holt die API-URL (von globalem Scope oder window)
 * @returns {string} API URL
 */
function getApiUrl() {
    return window.API_URL || '';
}

// ==================== GETTER FUNKTIONEN ====================

/**
 * Gibt die aktuelle Position zurueck
 * @returns {Object} Aktuelle Position {lat, lon}
 */
export function getCurrentPosition() {
    return { ...currentPosition };
}

/**
 * Gibt die Track-Historie zurueck
 * @returns {Array} Array von Track-Punkten
 */
export function getTrackHistory() {
    return [...trackHistory];
}

/**
 * Gibt das aktuelle Heading zurueck
 * @returns {number} Aktuelles Heading in Grad
 */
export function getCurrentHeading() {
    return currentHeading;
}

/**
 * Gibt das Boot-Heading zurueck
 * @returns {number} Boot-Heading in Grad
 */
export function getBoatHeading() {
    return currentBoatHeading;
}

/**
 * Gibt die GPS-Quelle zurueck
 * @returns {string|null} "backend", "browser" oder null
 */
export function getGpsSource() {
    return gpsSource;
}

/**
 * Prueft ob Auto-Follow aktiv ist
 * @returns {boolean} true wenn Auto-Follow aktiv
 */
export function isAutoFollowEnabled() {
    return autoFollow;
}

// ==================== SETTER FUNKTIONEN ====================

/**
 * Setzt den Auto-Follow Modus
 * @param {boolean} enabled - true zum Aktivieren
 */
export function setAutoFollow(enabled) {
    autoFollow = enabled;
    console.log('Auto-Follow ' + (enabled ? 'aktiviert' : 'deaktiviert'));
}

/**
 * Setzt die maximale Anzahl der Track-Punkte
 * @param {number} count - Maximale Punktanzahl
 */
export function setMaxTrackPoints(count) {
    maxTrackPoints = count;
}

/**
 * Setzt den GPS Low-Satellite Threshold
 * @param {number} thresholdMs - Threshold in Millisekunden
 */
export function setLowSatelliteThreshold(thresholdMs) {
    LOW_SATELLITE_THRESHOLD = thresholdMs;
}

/**
 * Setzt die Browser-GPS Genauigkeit
 * @param {number} accuracy - Genauigkeit in Metern
 */
export function setBrowserGpsAccuracy(accuracy) {
    browserGpsAccuracy = accuracy;
}

// ==================== EXPORT FUER GLOBALEN ZUGRIFF ====================
// Diese Funktionen und Variablen werden auch global verfuegbar gemacht
// fuer Rueckwaertskompatibilitaet mit bestehendem Code

if (typeof window !== 'undefined') {
    // Funktionen global verfuegbar machen
    window.handleGPSUpdate = handleGPSUpdate;
    window.processGPSData = processGPSData;
    window.updateBoatPosition = updateBoatPosition;
    window.addToTrackHistory = addToTrackHistory;
    window.startRecording = startRecording;
    window.stopRecording = stopRecording;
    window.saveTrack = saveTrack;
    window.clearTrackHistory = clearTrackHistory;
    window.toggleTrackHistory = toggleTrackHistory;
    window.updateGPSStatus = updateGPSStatus;
    window.updateGpsInfo = updateGpsInfo;
    window.updateSatelliteInfo = updateSatelliteInfo;
    window.updateGpsSourceIndicator = updateGpsSourceIndicator;
    window.createCompassRose = createCompassRose;
    window.updateCompassRose = updateCompassRose;
    window.updateCompass = updateCompass;
    window.updateHeading = updateHeading;
    window.toggleCompassRose = toggleCompassRose;
    window.getCurrentPosition = getCurrentPosition;
    window.getTrackHistory = getTrackHistory;
    window.getCurrentHeading = getCurrentHeading;
    window.getBoatHeading = getBoatHeading;
    window.getGpsSource = getGpsSource;
    window.isAutoFollowEnabled = isAutoFollowEnabled;
    window.setAutoFollow = setAutoFollow;
    window.setMaxTrackPoints = setMaxTrackPoints;
    window.setLowSatelliteThreshold = setLowSatelliteThreshold;

    // Variablen fuer externen Zugriff
    window.sensors = {
        trackHistory,
        currentPosition,
        currentHeading,
        autoFollow,
        gpsSource
    };
}
