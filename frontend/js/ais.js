/**
 * BoatOS AIS Modul
 *
 * Enthält alle Funktionen für:
 * - AIS-Daten empfangen & verarbeiten
 * - AIS-Schiffe auf Karte anzeigen
 * - Schleusen-Daten laden und anzeigen
 * - Pegelstände (Wasserstandsdaten)
 * - Wasserstraßen-Infrastruktur Layer
 */

// ==================== IMPORTS ====================
// Diese Variablen müssen aus dem Hauptmodul importiert werden
// import { map, currentPosition, API_URL } from './core.js';

// ==================== MODUL-KONFIGURATION ====================
// API URL - wird vom Hauptmodul gesetzt oder automatisch erkannt
let API_URL = window.API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.hostname}`);

// Referenz zur Karteninstanz (wird von außen gesetzt)
let map = null;

// Aktuelle Bootsposition (wird von außen aktualisiert)
let currentPosition = { lat: 51.855, lon: 12.046 };

// ==================== AIS STATE ====================
let aisVessels = {};  // MMSI -> {marker: MapLibre Marker, data, element}
let aisEnabled = false;
let aisUpdateInterval = null;
let aisSettings = { enabled: false, apiKey: '', updateInterval: 60, showLabels: true };

// ==================== INFRASTRUKTUR STATE ====================
let infrastructurePOIs = {};  // id -> {marker, data}
let infrastructureEnabled = false;
let infrastructureUpdateInterval = null;
let infrastructureSettings = { enabled: false, types: ['lock', 'bridge', 'harbor'] };

// ==================== PEGELSTÄNDE STATE ====================
let waterLevelGauges = {};  // id -> {marker, element, data}
let waterLevelSettings = { enabled: false };

// ==================== SCHLEUSEN TIMELINE STATE ====================
let locksTimelinePanel = null;
let locksOnRoute = [];
let lockWarnings = []; // Warnungen für geschlossene Schleusen
let currentRouteCoordinates = null; // Referenz auf Route-Koordinaten

// ==================== HILFSFUNKTIONEN ====================

/**
 * Berechnet die Entfernung zwischen zwei Koordinaten in Metern (Haversine-Formel)
 * @param {number} lat1 - Breitengrad Punkt 1
 * @param {number} lon1 - Längengrad Punkt 1
 * @param {number} lat2 - Breitengrad Punkt 2
 * @param {number} lon2 - Längengrad Punkt 2
 * @returns {number} Entfernung in Metern
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
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
 * Berechnet den kürzesten Abstand von einem Punkt zu einem Liniensegment
 * @param {number} pointLat - Breitengrad des Punktes
 * @param {number} pointLon - Längengrad des Punktes
 * @param {number} lineLat1 - Breitengrad Linienstart
 * @param {number} lineLon1 - Längengrad Linienstart
 * @param {number} lineLat2 - Breitengrad Linienende
 * @param {number} lineLon2 - Längengrad Linienende
 * @returns {Object} {distance, side, nearestPoint}
 */
function pointToLineSegmentDistance(pointLat, pointLon, lineLat1, lineLon1, lineLat2, lineLon2) {
    // Vektor vom Linienstart zum Punkt
    const pointVec = {
        lat: pointLat - lineLat1,
        lng: pointLon - lineLon1
    };

    // Vektor vom Linienstart zum Linienende
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

    // Parameter t gibt Position auf der Linie an (0 = Start, 1 = Ende)
    let t = (pointVec.lat * lineVec.lat + pointVec.lng * lineVec.lng) / lineLengthSquared;
    t = Math.max(0, Math.min(1, t)); // Auf [0, 1] beschränken

    // Nächster Punkt auf dem Liniensegment
    const nearestLat = lineLat1 + t * lineVec.lat;
    const nearestLng = lineLon1 + t * lineVec.lng;

    // Entfernung vom Punkt zum nächsten Punkt auf der Linie
    const distance = haversineDistance(pointLat, pointLon, nearestLat, nearestLng);

    // Bestimme die Seite (Backbord/Steuerbord) mittels Kreuzprodukt
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
 * Maskiert HTML-Sonderzeichen zur XSS-Prävention
 * @param {string} str - Eingabestring
 * @returns {string} Maskierter String
 */
function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== AIS FUNKTIONEN ====================

/**
 * Holt AIS-Schiffsdaten vom Backend
 * Wird periodisch aufgerufen wenn AIS aktiviert ist
 */
async function fetchAISVessels() {
    if (!aisSettings.enabled || !map) {
        return;
    }

    try {
        // Kartenbereich abrufen
        const bounds = map.getBounds();
        const params = new URLSearchParams({
            lat_min: bounds.getSouth(),
            lon_min: bounds.getWest(),
            lat_max: bounds.getNorth(),
            lon_max: bounds.getEast()
        });

        const response = await fetch(`${API_URL}/api/ais/vessels?${params}`);
        if (response.ok) {
            const data = await response.json();
            updateAISMarkers(data.vessels);
        }
    } catch (error) {
        console.warn('AIS Abruf-Fehler:', error);
    }
}

/**
 * Aktualisiert die AIS-Marker auf der Karte
 * Entfernt Schiffe die nicht mehr im Update sind und aktualisiert/erstellt neue
 * @param {Array} vessels - Array von Schiffsobjekten
 */
function updateAISMarkers(vessels) {
    // Alte Schiffe entfernen die nicht mehr im Update sind
    const currentMMSIs = new Set(vessels.map(v => v.mmsi));
    Object.keys(aisVessels).forEach(mmsi => {
        if (!currentMMSIs.has(mmsi)) {
            aisVessels[mmsi].marker.remove(); // MapLibre marker.remove()
            delete aisVessels[mmsi];
        }
    });

    // Schiffe hinzufügen/aktualisieren
    vessels.forEach(vessel => {
        if (aisVessels[vessel.mmsi]) {
            // Existierenden Marker Position und Rotation aktualisieren
            const { marker, element } = aisVessels[vessel.mmsi];
            marker.setLngLat([vessel.lon, vessel.lat]); // MapLibre verwendet [lon, lat]
            // Rotation über Element-Style aktualisieren
            if (element) {
                const rotation = vessel.heading || vessel.cog || 0;
                element.style.transform = `rotate(${rotation}deg)`;
            }
            aisVessels[vessel.mmsi].data = vessel;
        } else {
            // Neuen MapLibre Marker erstellen
            const { element, size } = createShipElement(vessel);
            const rotation = vessel.heading || vessel.cog || 0;
            element.style.transform = `rotate(${rotation}deg)`;

            const marker = new maplibregl.Marker({ element, anchor: 'center' })
                .setLngLat([vessel.lon, vessel.lat])
                .addTo(map);

            // Popup bei Klick hinzufügen
            element.addEventListener('click', () => {
                showAISDetails(vessel);
            });

            aisVessels[vessel.mmsi] = { marker, element, data: vessel };
        }
    });
}

/**
 * Erstellt das HTML-Element für ein Schiffssymbol
 * @param {Object} vessel - Schiffsobjekt mit Navigationsdaten
 * @returns {Object} {element, size} - DOM-Element und Größe
 */
function createShipElement(vessel) {
    const color = getShipColor(vessel.navstat);
    const size = vessel.length > 100 ? 24 : 16;

    const el = document.createElement('div');
    el.className = 'ais-ship-icon';
    el.style.cssText = `width: ${size}px; height: ${size}px; cursor: pointer;`;
    el.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2 L20 20 L12 17 L4 20 Z" fill="${color}" stroke="white" stroke-width="1.5"/>
        </svg>
    `;

    return { element: el, size };
}

/**
 * Gibt die Farbe basierend auf dem Navigationsstatus zurück
 * @param {number} navstat - Navigationsstatus des Schiffes
 * @returns {string} Hex-Farbcode
 */
function getShipColor(navstat) {
    switch (navstat) {
        case 0: return '#3498db'; // In Fahrt mit Motor - Blau
        case 1: return '#2ecc71'; // Vor Anker - Grün
        case 5: return '#2ecc71'; // Vertäut - Grün
        case 6: return '#e74c3c'; // Auf Grund - Rot
        case 7: return '#9b59b6'; // Fischerei - Violett
        case 8: return '#1abc9c'; // Segelnd - Türkis
        default: return '#95a5a6'; // Unbekannt - Grau
    }
}

/**
 * Erstellt das HTML für ein AIS-Popup
 * @param {Object} vessel - Schiffsobjekt
 * @returns {string} HTML-String für das Popup
 */
function createAISPopup(vessel) {
    return `
        <div class="ais-popup">
            <h4>${escapeHTML(vessel.name)}</h4>
            <p><strong>MMSI:</strong> ${vessel.mmsi}</p>
            <p><strong>Geschwindigkeit:</strong> ${vessel.sog.toFixed(1)} kn</p>
            <p><strong>Kurs:</strong> ${Math.round(vessel.cog)}</p>
            ${vessel.destination ? `<p><strong>Ziel:</strong> ${escapeHTML(vessel.destination)}</p>` : ''}
        </div>
    `;
}

/**
 * Zeigt das AIS-Detailpanel für ein Schiff an
 * @param {Object} vessel - Schiffsobjekt mit allen Daten
 */
function showAISDetails(vessel) {
    const panel = document.getElementById('ais-details-panel');
    if (!panel) return;

    document.getElementById('ais-name').textContent = vessel.name;
    document.getElementById('ais-mmsi').textContent = vessel.mmsi;
    document.getElementById('ais-callsign').textContent = vessel.callsign || 'N/A';
    document.getElementById('ais-type').textContent = getShipTypeText(vessel.type);
    document.getElementById('ais-speed').textContent = vessel.sog.toFixed(1) + ' kn';
    document.getElementById('ais-course').textContent = Math.round(vessel.cog) + '\u00B0';
    document.getElementById('ais-heading').textContent = vessel.heading ? vessel.heading + '\u00B0' : 'N/A';
    document.getElementById('ais-navstat').textContent = getNavstatText(vessel.navstat);
    document.getElementById('ais-destination').textContent = vessel.destination || 'N/A';
    document.getElementById('ais-eta').textContent = vessel.eta || 'N/A';
    document.getElementById('ais-length').textContent = vessel.length ? vessel.length + ' m' : 'N/A';
    document.getElementById('ais-width').textContent = vessel.width ? vessel.width + ' m' : 'N/A';
    document.getElementById('ais-draught').textContent = vessel.draught ? vessel.draught.toFixed(1) + ' m' : 'N/A';

    panel.classList.add('show');
}

/**
 * Schließt das AIS-Detailpanel
 */
function closeAISDetails() {
    const panel = document.getElementById('ais-details-panel');
    if (panel) {
        panel.classList.remove('show');
    }
}

/**
 * Gibt den Navigationsstatus als Text zurück
 * @param {number} navstat - Navigationsstatus-Code
 * @returns {string} Beschreibung des Status
 */
function getNavstatText(navstat) {
    const statuses = {
        0: "In Fahrt mit Motor",
        1: "Vor Anker",
        2: "Manövrierunfähig",
        3: "Manövrierbeschränkt",
        4: "Durch Tiefgang beschränkt",
        5: "Vertäut",
        6: "Auf Grund",
        7: "Beim Fischen",
        8: "In Fahrt unter Segel",
        14: "AIS-SART aktiv",
        15: "Undefiniert"
    };
    return statuses[navstat] || "Unbekannt";
}

/**
 * Gibt den Schiffstyp als Text zurück
 * @param {number} type - Schiffstyp-Code
 * @returns {string} Beschreibung des Schiffstyps
 */
function getShipTypeText(type) {
    if (type == 0) return "Unbekannt";
    if (type >= 20 && type <= 29) return "Bodeneffektfahrzeug";
    if (type == 30) return "Fischereifahrzeug";
    if (type >= 31 && type <= 32) return "Schlepper";
    if (type == 36) return "Segelboot";
    if (type == 37) return "Sportboot";
    if (type >= 40 && type <= 49) return "Hochgeschwindigkeitsfahrzeug";
    if (type >= 60 && type <= 69) return "Passagierschiff";
    if (type >= 70 && type <= 79) return "Frachtschiff";
    if (type >= 80 && type <= 89) return "Tankschiff";
    return "Sonstiges";
}

/**
 * Aktualisiert die AIS-Einstellungen und startet/stoppt den Abruf
 * @param {Object} settings - Einstellungsobjekt {enabled, apiKey, updateInterval, showLabels}
 */
function updateAISSettings(settings) {
    aisSettings = settings;

    // Interval löschen
    if (aisUpdateInterval) {
        clearInterval(aisUpdateInterval);
        aisUpdateInterval = null;
    }

    // Alle Marker entfernen (MapLibre)
    Object.values(aisVessels).forEach(({marker}) => marker.remove());
    aisVessels = {};

    // Starten wenn aktiviert
    if (settings.enabled && settings.apiKey) {
        fetchAISVessels();
        aisUpdateInterval = setInterval(fetchAISVessels, settings.updateInterval * 1000);
        console.log('AIS aktiviert');
    } else {
        console.log('AIS deaktiviert');
    }
}

// ==================== INFRASTRUKTUR FUNKTIONEN ====================

/**
 * Holt Infrastruktur-POIs (Schleusen, Brücken, Häfen) vom Backend
 */
async function fetchInfrastructurePOIs() {
    if (!infrastructureSettings.enabled || !map) {
        return;
    }

    try {
        // Kartenbereich abrufen
        const bounds = map.getBounds();
        const types = infrastructureSettings.types.join(',');
        const params = new URLSearchParams({
            lat_min: bounds.getSouth(),
            lon_min: bounds.getWest(),
            lat_max: bounds.getNorth(),
            lon_max: bounds.getEast(),
            types: types
        });

        const response = await fetch(`${API_URL}/api/infrastructure?${params}`);
        if (response.ok) {
            const data = await response.json();
            updateInfrastructureMarkers(data.pois);
        }
    } catch (error) {
        console.warn('Infrastruktur Abruf-Fehler:', error);
    }
}

/**
 * Aktualisiert die Infrastruktur-Marker auf der Karte
 * @param {Array} pois - Array von POI-Objekten
 */
function updateInfrastructureMarkers(pois) {
    // Alte POIs entfernen die nicht mehr im Update sind
    const currentIDs = new Set(pois.map(p => p.id));
    Object.keys(infrastructurePOIs).forEach(id => {
        if (!currentIDs.has(parseInt(id))) {
            infrastructurePOIs[id].marker.remove(); // MapLibre marker.remove()
            delete infrastructurePOIs[id];
        }
    });

    // POIs hinzufügen/aktualisieren
    pois.forEach(poi => {
        if (infrastructurePOIs[poi.id]) {
            // Position von existierendem Marker aktualisieren (falls geändert)
            const { marker } = infrastructurePOIs[poi.id];
            marker.setLngLat([poi.lon, poi.lat]); // MapLibre verwendet [lon, lat]
            infrastructurePOIs[poi.id].data = poi;
        } else {
            // Neuen MapLibre Marker erstellen
            const el = createInfrastructureElement(poi.type);
            el.title = poi.name;

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([poi.lon, poi.lat])
                .addTo(map);

            // Popup bei Klick hinzufügen
            const popup = new maplibregl.Popup({ offset: 15 })
                .setHTML(createInfrastructurePopup(poi));
            marker.setPopup(popup);

            infrastructurePOIs[poi.id] = { marker, data: poi };
        }
    });
}

/**
 * Erstellt das HTML-Element für ein Infrastruktur-Symbol
 * @param {string} type - Typ der Infrastruktur (lock, bridge, harbor, etc.)
 * @returns {HTMLElement} DOM-Element für den Marker
 */
function createInfrastructureElement(type) {
    const icons = {
        'lock': '\uD83D\uDD12',     // Schloss-Emoji
        'bridge': '\uD83C\uDF09',   // Brücken-Emoji
        'harbor': '\u2693',         // Anker-Emoji
        'weir': '\u3030\uFE0F',     // Wellen-Emoji
        'dam': '\uD83C\uDFD7\uFE0F' // Baustellen-Emoji
    };

    const colors = {
        'lock': '#e74c3c',
        'bridge': '#3498db',
        'harbor': '#2ecc71',
        'weir': '#9b59b6',
        'dam': '#f39c12'
    };

    const emoji = icons[type] || '\uD83D\uDCCD'; // Standard: Pin
    const color = colors[type] || '#95a5a6';

    const el = document.createElement('div');
    el.className = 'infrastructure-icon';
    el.style.cssText = `font-size: 20px; text-shadow: 0 0 3px ${color}, 0 0 5px rgba(0,0,0,0.8); filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)); cursor: pointer;`;
    el.innerHTML = emoji;

    return el;
}

/**
 * Erstellt das HTML für ein Infrastruktur-Popup
 * @param {Object} poi - POI-Objekt
 * @returns {string} HTML-String für das Popup
 */
function createInfrastructurePopup(poi) {
    const typeNames = {
        'lock': '\uD83D\uDD12 Schleuse',
        'bridge': '\uD83C\uDF09 Brücke',
        'harbor': '\u2693 Hafen',
        'weir': '\u3030\uFE0F Wehr',
        'dam': '\uD83C\uDFD7\uFE0F Damm'
    };

    let html = `<div style="min-width: 150px;">
        <h4 style="margin: 0 0 8px 0; color: #2c3e50;">${typeNames[poi.type] || poi.type}</h4>
        <p style="margin: 0; font-weight: 600;">${escapeHTML(poi.name)}</p>`;

    // Wichtige Eigenschaften hinzufügen
    if (poi.properties.height) {
        html += `<p style="margin: 4px 0; font-size: 12px;">Höhe: ${poi.properties.height}</p>`;
    }
    if (poi.properties.clearance_height || poi.properties.max_height) {
        html += `<p style="margin: 4px 0; font-size: 12px;">Durchfahrtshöhe: ${poi.properties.clearance_height || poi.properties.max_height}</p>`;
    }
    if (poi.properties.length) {
        html += `<p style="margin: 4px 0; font-size: 12px;">Länge: ${poi.properties.length}</p>`;
    }
    if (poi.properties.vhf_channel) {
        html += `<p style="margin: 4px 0; font-size: 12px;">VHF: ${poi.properties.vhf_channel}</p>`;
    }

    html += `</div>`;
    return html;
}

/**
 * Zeigt das Infrastruktur-Detailpanel für einen POI
 * @param {Object} poi - POI-Objekt mit allen Daten
 */
async function showInfrastructureDetails(poi) {
    const panel = document.getElementById('infrastructure-details-panel');
    if (!panel) return;

    const typeNames = {
        'lock': '\uD83D\uDD12 Schleuse',
        'bridge': '\uD83C\uDF09 Brücke',
        'harbor': '\u2693 Hafen/Marina',
        'weir': '\u3030\uFE0F Wehr',
        'dam': '\uD83C\uDFD7\uFE0F Damm'
    };

    // Titel aktualisieren
    document.getElementById('infrastructure-details-title').textContent = typeNames[poi.type] || poi.type;

    // Details-HTML erstellen
    let detailsHtml = `
        <div class="info-item" style="grid-column: span 2;">
            <div class="info-label">Name</div>
            <div class="info-value">${escapeHTML(poi.name)}</div>
        </div>
    `;

    // Eigenschaften basierend auf Typ hinzufügen
    const props = poi.properties;

    if (props.operator) {
        detailsHtml += `
            <div class="info-item" style="grid-column: span 2;">
                <div class="info-label">Betreiber</div>
                <div class="info-value">${escapeHTML(props.operator)}</div>
            </div>
        `;
    }

    // Für Schleusen: Status aus Datenbank abrufen
    let lockStatus = null;
    if (poi.type === 'lock') {
        try {
            // Passende Schleuse in Datenbank suchen (innerhalb 200m)
            const nearbyResponse = await fetch(`${API_URL}/api/locks/nearby?lat=${poi.lat}&lon=${poi.lon}&radius=0.2`);
            if (nearbyResponse.ok) {
                const nearbyData = await nearbyResponse.json();
                if (nearbyData.locks && nearbyData.locks.length > 0) {
                    // Nächste Schleuse verwenden
                    const dbLock = nearbyData.locks[0];

                    // Status abrufen
                    const statusResponse = await fetch(`${API_URL}/api/locks/${dbLock.id}/status`);
                    if (statusResponse.ok) {
                        lockStatus = await statusResponse.json();
                    }
                }
            }
        } catch (error) {
            console.warn('Konnte Schleusenstatus nicht abrufen:', error);
        }

        // Status anzeigen wenn verfügbar
        if (lockStatus) {
            const isOpen = lockStatus.is_open;
            const statusColor = isOpen ? '#2ecc71' : '#e74c3c';
            const statusIcon = isOpen ? '\u2705' : '\uD83D\uDD12';
            const statusText = isOpen ? 'OFFEN' : 'GESCHLOSSEN';

            detailsHtml += `
                <div class="info-item" style="grid-column: span 2;">
                    <div style="background: ${statusColor}20; border: 2px solid ${statusColor}; border-radius: 8px; padding: 12px; text-align: center;">
                        <div style="font-size: 18px; font-weight: 700; color: ${statusColor}; margin-bottom: 4px;">
                            ${statusIcon} ${statusText}
                        </div>
                        ${lockStatus.reason ? `
                            <div style="font-size: 11px; color: #8892b0; margin-top: 4px;">
                                ${escapeHTML(lockStatus.reason)}
                            </div>
                        ` : ''}
                        ${!isOpen && lockStatus.opens_at ? `
                            <div style="font-size: 11px; color: #64ffda; margin-top: 6px; font-weight: 600;">
                                Öffnet um: ${escapeHTML(lockStatus.opens_at)}
                            </div>
                        ` : ''}
                        ${isOpen && lockStatus.closes_at ? `
                            <div style="font-size: 11px; color: #ffa07a; margin-top: 6px;">
                                Schließt um: ${escapeHTML(lockStatus.closes_at)}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        if (props.height) detailsHtml += `<div class="info-item"><div class="info-label">Hubhöhe</div><div class="info-value">${props.height}</div></div>`;
        if (props.length) detailsHtml += `<div class="info-item"><div class="info-label">Länge</div><div class="info-value">${props.length}</div></div>`;
        if (props.width) detailsHtml += `<div class="info-item"><div class="info-label">Breite</div><div class="info-value">${props.width}</div></div>`;
        if (props.lock_type) detailsHtml += `<div class="info-item"><div class="info-label">Typ</div><div class="info-value">${props.lock_type}</div></div>`;
    }

    if (poi.type === 'bridge') {
        if (props.clearance_height) detailsHtml += `<div class="info-item"><div class="info-label">Durchfahrtshöhe</div><div class="info-value">${props.clearance_height}</div></div>`;
        if (props.max_height) detailsHtml += `<div class="info-item"><div class="info-label">Max. Höhe</div><div class="info-value">${props.max_height}</div></div>`;
        if (props.structure) detailsHtml += `<div class="info-item"><div class="info-label">Bauart</div><div class="info-value">${props.structure}</div></div>`;
        if (props.movable) detailsHtml += `<div class="info-item"><div class="info-label">Beweglich</div><div class="info-value">${props.movable === 'yes' ? 'Ja' : 'Nein'}</div></div>`;
    }

    if (poi.type === 'harbor') {
        if (props.capacity) detailsHtml += `<div class="info-item"><div class="info-label">Kapazität</div><div class="info-value">${props.capacity} Plätze</div></div>`;
        if (props.berths) detailsHtml += `<div class="info-item"><div class="info-label">Liegeplätze</div><div class="info-value">${props.berths}</div></div>`;
        if (props.fuel) detailsHtml += `<div class="info-item"><div class="info-label">Treibstoff</div><div class="info-value">${props.fuel === 'yes' ? 'Ja' : 'Nein'}</div></div>`;
        if (props.electricity) detailsHtml += `<div class="info-item"><div class="info-label">Strom</div><div class="info-value">${props.electricity === 'yes' ? 'Ja' : 'Nein'}</div></div>`;
    }

    if (props.opening_hours) {
        detailsHtml += `<div class="info-item" style="grid-column: span 2;"><div class="info-label">Öffnungszeiten</div><div class="info-value">${props.opening_hours}</div></div>`;
    }

    if (props.vhf_channel) {
        detailsHtml += `<div class="info-item"><div class="info-label">VHF Kanal</div><div class="info-value">${props.vhf_channel}</div></div>`;
    }

    if (props.phone) {
        detailsHtml += `<div class="info-item"><div class="info-label">Telefon</div><div class="info-value">${props.phone}</div></div>`;
    }

    if (props.website) {
        detailsHtml += `<div class="info-item" style="grid-column: span 2;"><div class="info-label">Website</div><div class="info-value"><a href="${props.website}" target="_blank" style="color: #64ffda;">${props.website}</a></div></div>`;
    }

    // Position
    detailsHtml += `
        <div class="info-item" style="grid-column: span 2;">
            <div class="info-label">Position</div>
            <div class="info-value" style="font-family: monospace; font-size: 12px;">${poi.lat.toFixed(6)}, ${poi.lon.toFixed(6)}</div>
        </div>
    `;

    document.getElementById('infrastructure-details-content').innerHTML = detailsHtml;
    panel.style.display = 'block';
}

/**
 * Schließt das Infrastruktur-Detailpanel
 */
function closeInfrastructureDetails() {
    const panel = document.getElementById('infrastructure-details-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

/**
 * Aktualisiert die Infrastruktur-Einstellungen
 * @param {Object} settings - Einstellungsobjekt {enabled, types}
 */
function updateInfrastructureSettings(settings) {
    infrastructureSettings = settings;

    // Interval löschen
    if (infrastructureUpdateInterval) {
        clearInterval(infrastructureUpdateInterval);
        infrastructureUpdateInterval = null;
    }

    // Alle Marker entfernen (MapLibre)
    Object.values(infrastructurePOIs).forEach(({marker}) => marker.remove());
    infrastructurePOIs = {};

    // Starten wenn aktiviert
    if (settings.enabled) {
        fetchInfrastructurePOIs();
        // Bei Kartenbewegung/-zoom aktualisieren
        map.on('moveend', fetchInfrastructurePOIs);
        console.log('Infrastruktur-Layer aktiviert');
    } else {
        map.off('moveend', fetchInfrastructurePOIs);
        console.log('Infrastruktur-Layer deaktiviert');
    }
}

/**
 * Zeigt den Infrastruktur-Layer an
 */
function showInfrastructure() {
    updateInfrastructureSettings({ ...infrastructureSettings, enabled: true });
}

/**
 * Versteckt den Infrastruktur-Layer
 */
function hideInfrastructure() {
    updateInfrastructureSettings({ ...infrastructureSettings, enabled: false });
}

// ==================== PEGELSTÄNDE (WASSERSTAND) FUNKTIONEN ====================

/**
 * Holt Pegelstands-Daten von der API (PegelOnline)
 */
async function fetchWaterLevelGauges() {
    if (!waterLevelSettings.enabled || !map) {
        return;
    }

    try {
        const bounds = map.getBounds();
        const params = new URLSearchParams({
            lat_min: bounds.getSouth(),
            lon_min: bounds.getWest(),
            lat_max: bounds.getNorth(),
            lon_max: bounds.getEast()
        });

        const response = await fetch(`${API_URL}/api/gauges?${params}`);
        if (response.ok) {
            const data = await response.json();
            updateWaterLevelMarkers(data.gauges);
        }
    } catch (error) {
        console.warn('Pegelstands-Abruf-Fehler:', error);
    }
}

/**
 * Alias für fetchWaterLevelGauges - lädt Pegelstände
 */
function loadWaterLevels() {
    return fetchWaterLevelGauges();
}

/**
 * Aktualisiert die Pegelstand-Marker auf der Karte
 * @param {Array} gauges - Array von Pegel-Objekten
 */
function updateWaterLevelMarkers(gauges) {
    // Alte Pegel entfernen die nicht mehr im Update sind
    const currentIDs = new Set(gauges.map(g => g.id));
    Object.keys(waterLevelGauges).forEach(id => {
        if (!currentIDs.has(id)) {
            waterLevelGauges[id].marker.remove(); // MapLibre marker.remove()
            delete waterLevelGauges[id];
        }
    });

    // Pegel hinzufügen/aktualisieren
    gauges.forEach(gauge => {
        if (waterLevelGauges[gauge.id]) {
            // Existierenden Marker aktualisieren
            const { marker, element } = waterLevelGauges[gauge.id];
            marker.setLngLat([gauge.lon, gauge.lat]); // MapLibre verwendet [lon, lat]
            // Wasserstand-Text aktualisieren
            if (element) {
                element.innerHTML = `\uD83D\uDCCA ${gauge.water_level_cm} cm`;
            }
            waterLevelGauges[gauge.id].data = gauge;
        } else {
            // Neuen MapLibre Marker erstellen
            const el = createWaterLevelElement(gauge);

            const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
                .setLngLat([gauge.lon, gauge.lat])
                .addTo(map);

            // Popup hinzufügen
            const popup = new maplibregl.Popup({ offset: 15 })
                .setHTML(createWaterLevelPopup(gauge));
            marker.setPopup(popup);

            waterLevelGauges[gauge.id] = { marker, element: el, data: gauge };
        }
    });
}

/**
 * Alias für updateWaterLevelMarkers - zeigt Pegelstände an
 * @param {Array} gauges - Array von Pegel-Objekten
 */
function displayWaterLevels(gauges) {
    updateWaterLevelMarkers(gauges);
}

/**
 * Erstellt das HTML-Element für einen Pegelstand-Marker
 * @param {Object} gauge - Pegel-Objekt
 * @returns {HTMLElement} DOM-Element für den Marker
 */
function createWaterLevelElement(gauge) {
    const level = gauge.water_level_cm;

    const el = document.createElement('div');
    el.className = 'water-level-icon';
    el.title = gauge.name;
    el.style.cssText = 'background: rgba(10, 14, 39, 0.95); border: 2px solid #3498db; border-radius: 8px; padding: 4px 8px; font-size: 11px; font-weight: bold; color: #64ffda; text-align: center; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4); cursor: pointer;';
    el.innerHTML = `\uD83D\uDCCA ${level} cm`;

    return el;
}

/**
 * Erstellt das HTML für ein Pegelstand-Popup
 * @param {Object} gauge - Pegel-Objekt
 * @returns {string} HTML-String für das Popup
 */
function createWaterLevelPopup(gauge) {
    const date = new Date(gauge.timestamp);
    const timeStr = date.toLocaleString('de-DE');

    return `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #2c3e50;">\uD83D\uDCCA Pegel</h4>
            <p style="margin: 0; font-weight: 600;">${escapeHTML(gauge.name)}</p>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Gewässer:</strong> ${escapeHTML(gauge.water)}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #3498db;"><strong>Wasserstand:</strong> ${gauge.water_level_m} m (${gauge.water_level_cm} cm)</p>
            <p style="margin: 4px 0; font-size: 11px; color: #7f8c8d;">${timeStr}</p>
        </div>
    `;
}

/**
 * Aktualisiert die Pegelstand-Einstellungen
 * @param {Object} settings - Einstellungsobjekt {enabled}
 */
function updateWaterLevelSettings(settings) {
    waterLevelSettings = settings;

    // Alle Marker entfernen (MapLibre)
    Object.values(waterLevelGauges).forEach(({marker}) => marker.remove());
    waterLevelGauges = {};

    // Starten wenn aktiviert
    if (settings.enabled) {
        fetchWaterLevelGauges();
        // Bei Kartenbewegung/-zoom aktualisieren
        map.on('moveend', fetchWaterLevelGauges);
        console.log('Pegelstände aktiviert');
    } else {
        map.off('moveend', fetchWaterLevelGauges);
        console.log('Pegelstände deaktiviert');
    }
}

// ==================== SCHLEUSEN TIMELINE FUNKTIONEN ====================

/**
 * Aktualisiert die Schleusen-Timeline mit Schleusen entlang der Route
 * Lädt Schleusen aus der API basierend auf dem Routenbereich
 */
async function updateLocksTimeline() {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        // Keine Route - Timeline ausblenden
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
        const response = await fetch(`${API_URL}/api/locks/bounds?lat_min=${lat_min}&lon_min=${lon_min}&lat_max=${lat_max}&lon_max=${lon_max}`);
        if (!response.ok) {
            console.warn('Fehler beim Abrufen der Schleusen:', response.statusText);
            return;
        }

        const data = await response.json();
        const locks = data.locks || [];
        console.log(`Gefunden: ${locks.length} Schleusen im Routenbereich`);

        // Schleusen filtern die tatsächlich nahe der Route sind (innerhalb 2km)
        locksOnRoute = locks.filter(lock => {
            const lockLatLon = { lat: lock.lat, lon: lock.lon };
            // Prüfen ob Schleuse innerhalb 2km von irgendeinem Routensegment
            for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
                const seg1 = currentRouteCoordinates[i];
                const seg2 = currentRouteCoordinates[i + 1];
                const result = pointToLineSegmentDistance(
                    lockLatLon.lat, lockLatLon.lon,
                    seg1.lat, seg1.lon,
                    seg2.lat, seg2.lon
                );
                if (result.distance < 2000) { // 2km Schwellenwert
                    return true;
                }
            }
            return false;
        });

        console.log(`${locksOnRoute.length} Schleusen sind auf oder nahe der Route`);

        // Schleusen nach Entfernung vom Routenstart sortieren
        const routeStart = currentRouteCoordinates[0];
        locksOnRoute.forEach(lock => {
            lock._distanceFromStart = haversineDistance(routeStart.lat, routeStart.lon, lock.lat, lock.lon);
        });
        locksOnRoute.sort((a, b) => a._distanceFromStart - b._distanceFromStart);

        // Schleusen-Timeline anzeigen
        displayLocksTimeline();

    } catch (error) {
        console.error('Fehler beim Aktualisieren der Schleusen-Timeline:', error);
    }
}

/**
 * Alias für updateLocksTimeline - lädt Schleusen
 */
function loadLocks() {
    return updateLocksTimeline();
}

/**
 * Zeigt das Schleusen-Timeline-Panel an
 */
function displayLocksTimeline() {
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

    // Aktuelle Position und Geschwindigkeit für ETA-Berechnung
    const currentLat = currentPosition.lat;
    const currentLon = currentPosition.lon;
    const currentSpeed = window.lastSensorData?.speed || 5; // Knoten

    let html = `
        <div style="font-size: 13px; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 700;">
            \uD83D\uDD12 Schleusen auf Route (${locksOnRoute.length})
        </div>
    `;

    locksOnRoute.forEach((lock, index) => {
        // Entfernung und ETA berechnen
        let distanceMeters = 0;
        let distanceNM = 0;
        let etaText = 'N/A';

        // Nur berechnen wenn gültige aktuelle Position vorhanden
        if (currentLat && currentLon && !isNaN(currentLat) && !isNaN(currentLon)) {
            distanceMeters = haversineDistance(currentLat, currentLon, lock.lat, lock.lon);
            distanceNM = distanceMeters / 1852;
        }

        // ETA berechnen
        if (currentSpeed > 0 && distanceNM > 0) {
            const etaHours = distanceNM / currentSpeed;
            const hours = Math.floor(etaHours);
            const minutes = Math.round((etaHours - hours) * 60);

            if (hours > 0) {
                etaText = `${hours}h ${minutes}min`;
            } else {
                etaText = `${minutes}min`;
            }
        }

        const distanceFormatted = distanceNM < 1
            ? `${(distanceNM * 1000).toFixed(0)} m`
            : `${distanceNM.toFixed(1)} NM`;

        // Schleusenname
        const lockName = lock.name || `Schleuse ${index + 1}`;

        // Prüfen ob Warnung für diese Schleuse existiert
        const warning = lockWarnings.find(w => w.lock_id === lock.id);

        // Status-Indikator (grün wenn passiert, rot wenn geschlossen, gelb wenn kommend)
        const isPassed = distanceMeters < 100; // Als passiert betrachten wenn innerhalb 100m
        let statusColor, statusIcon, warningHtml = '';

        if (warning && !isPassed) {
            // Schleuse wird bei Ankunft geschlossen sein
            statusColor = '#e74c3c'; // Rot
            statusIcon = '\u26A0\uFE0F';
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
                    ${warning.delay_formatted ? `
                        <div style="font-size: 11px; color: #ff6b6b; margin-top: 4px; font-weight: 600;">
                            \u23F1\uFE0F Wartezeit: ${escapeHTML(warning.delay_formatted)}
                        </div>
                    ` : ''}
                    ${warning.suggested_departure_formatted ? `
                        <div style="font-size: 11px; color: #64ffda; margin-top: 4px;">
                            \uD83D\uDCA1 Empfohlene Abfahrt: ${escapeHTML(warning.suggested_departure_formatted)}
                        </div>
                    ` : ''}
                </div>
            `;
        } else if (isPassed) {
            statusColor = '#2ecc71'; // Grün
            statusIcon = '\u2713';
        } else {
            statusColor = '#f39c12'; // Gelb
            statusIcon = '\u2192';
        }

        // VHF-Kanal und Kontaktinformationen
        let contactHtml = '';
        if (lock.vhf_channel || lock.phone || lock.email) {
            contactHtml = `
                <div style="background: rgba(100, 255, 218, 0.1); padding: 8px; border-radius: 6px; margin-top: 8px; font-size: 11px;">
                    ${lock.vhf_channel ? `
                        <div style="color: #64ffda; font-weight: 600; margin-bottom: 4px;">
                            \uD83D\uDCFB VHF: ${escapeHTML(lock.vhf_channel)}
                        </div>
                    ` : ''}
                    ${lock.phone ? `
                        <div style="color: #8892b0; margin-bottom: 2px;">
                            \uD83D\uDCDE ${escapeHTML(lock.phone)}
                        </div>
                    ` : ''}
                    ${lock.email ? `
                        <div style="margin-top: 6px;">
                            <button onclick="prepareLockNotification(${lock.id})" style="
                                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                cursor: pointer;
                                font-size: 11px;
                                font-weight: 600;
                                width: 100%;
                            ">
                                \uD83D\uDCE7 Anmelden
                            </button>
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

/**
 * Alias für displayLocksTimeline - zeigt Schleusen an
 * @param {Array} locks - Optional: Array von Schleusen-Objekten
 */
function displayLocks(locks) {
    if (locks) {
        locksOnRoute = locks;
    }
    displayLocksTimeline();
}

/**
 * Bereitet die Email-Anmeldung für eine Schleuse vor
 * @param {number} lockId - ID der Schleuse
 */
async function prepareLockNotification(lockId) {
    try {
        // Schleusen-Details abrufen
        const lockResponse = await fetch(`${API_URL}/api/locks/${lockId}`);
        if (!lockResponse.ok) {
            alert('Fehler beim Laden der Schleusen-Details');
            return;
        }
        const lock = await lockResponse.json();

        // Boots-Einstellungen abrufen
        const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};
        const boatName = boatSettings.name || 'Unbekannt';
        const boatLength = boatSettings.length || 'N/A';
        const boatWidth = boatSettings.width || 'N/A';
        const boatDraft = boatSettings.draft || 'N/A';

        // ETA berechnen
        let etaText = 'in ca. X Stunden';
        if (currentPosition.lat && currentPosition.lon) {
            const distanceMeters = haversineDistance(currentPosition.lat, currentPosition.lon, lock.lat, lock.lon);
            const distanceNM = distanceMeters / 1852;
            const currentSpeed = window.lastSensorData?.speed || 5; // Knoten
            if (currentSpeed > 0) {
                const etaHours = distanceNM / currentSpeed;
                const hours = Math.floor(etaHours);
                const minutes = Math.round((etaHours - hours) * 60);
                if (hours > 0) {
                    etaText = `in ca. ${hours}h ${minutes}min`;
                } else {
                    etaText = `in ca. ${minutes}min`;
                }
            }
        }

        // Email-Betreff und -Text erstellen
        const subject = `Schleusung ${lock.name} - ${boatName}`;
        const body = `Guten Tag,

ich möchte mich für eine Schleusung anmelden:

Schleuse: ${lock.name}
Voraussichtliche Ankunft: ${etaText}

Bootsdaten:
- Name: ${boatName}
- Länge: ${boatLength} m
- Breite: ${boatWidth} m
- Tiefgang: ${boatDraft} m

Mit freundlichen Grüßen`;

        // Email-Client mit vorgefüllter Vorlage öffnen
        const mailtoLink = `mailto:${lock.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailtoLink;

        console.log(`Email-Vorlage vorbereitet für ${lock.name}`);
    } catch (error) {
        console.error('Fehler beim Vorbereiten der Anmeldung:', error);
        alert('Fehler beim Vorbereiten der Email-Vorlage');
    }
}

// ==================== MODUL-INITIALISIERUNG ====================

/**
 * Initialisiert das AIS-Modul mit der Karteninstanz
 * @param {Object} mapInstance - MapLibre GL Map Instanz
 * @param {Object} options - Optionale Konfiguration {apiUrl, position}
 */
function initAISModule(mapInstance, options = {}) {
    map = mapInstance;

    if (options.apiUrl) {
        API_URL = options.apiUrl;
    }

    if (options.position) {
        currentPosition = options.position;
    }

    console.log('AIS-Modul initialisiert');
}

/**
 * Setzt die aktuelle Bootsposition (wird vom Hauptmodul aufgerufen)
 * @param {Object} position - {lat, lon}
 */
function setCurrentPosition(position) {
    currentPosition = position;
}

/**
 * Setzt die aktuellen Routen-Koordinaten für die Schleusen-Timeline
 * @param {Array} coordinates - Array von {lat, lon} Objekten
 */
function setRouteCoordinates(coordinates) {
    currentRouteCoordinates = coordinates;
}

/**
 * Setzt Schleusen-Warnungen
 * @param {Array} warnings - Array von Warnungsobjekten
 */
function setLockWarnings(warnings) {
    lockWarnings = warnings;
}

/**
 * Gibt die Schleusen-Marker zurück (für externe Nutzung)
 * @returns {Array} Array von Schleusen auf der Route
 */
function getLockMarkers() {
    return locksOnRoute;
}

// ==================== UI WRAPPER FUNKTIONEN ====================

/**
 * Zeigt das AIS-Panel im Bottom Sheet
 */
function showAISPanel() {
    console.log('AIS-Panel anzeigen');

    // Zur AIS-Sektion im Bottom Sheet wechseln
    if (window.BoatOS && window.BoatOS.ui && window.BoatOS.ui.showSection) {
        window.BoatOS.ui.showSection('ais', document.querySelector('.sheet-tab[onclick*="ais"]'));
    }

    // AIS-Daten aktualisieren
    fetchAISVessels();
}

/**
 * Zeigt die Schleusen im Bottom Sheet
 */
function showLocks() {
    console.log('Schleusen anzeigen');

    // Zur Schleusen-Sektion im Bottom Sheet wechseln
    if (window.BoatOS && window.BoatOS.ui && window.BoatOS.ui.showSection) {
        window.BoatOS.ui.showSection('locks', document.querySelector('.sheet-tab[onclick*="locks"]'));
    }

    // Schleusen laden
    loadLocks();
}

// ==================== EXPORTS ====================
// ES6 Module Exports
export {
    // Initialisierung
    initAISModule,
    setCurrentPosition,
    setRouteCoordinates,
    setLockWarnings,

    // AIS Funktionen
    fetchAISVessels,
    updateAISMarkers,
    createShipElement,
    createAISPopup,
    showAISDetails,
    closeAISDetails,
    updateAISSettings,
    getShipColor,
    getNavstatText,
    getShipTypeText,
    showAISPanel,

    // UI Wrapper
    showLocks,

    // Infrastruktur Funktionen
    fetchInfrastructurePOIs,
    updateInfrastructureMarkers,
    createInfrastructureElement,
    createInfrastructurePopup,
    showInfrastructureDetails,
    closeInfrastructureDetails,
    updateInfrastructureSettings,
    showInfrastructure,
    hideInfrastructure,

    // Pegelstände Funktionen
    fetchWaterLevelGauges,
    loadWaterLevels,
    updateWaterLevelMarkers,
    displayWaterLevels,
    createWaterLevelElement,
    createWaterLevelPopup,
    updateWaterLevelSettings,

    // Schleusen Timeline Funktionen
    updateLocksTimeline,
    loadLocks,
    displayLocksTimeline,
    displayLocks,
    prepareLockNotification,
    getLockMarkers,

    // Hilfsfunktionen
    haversineDistance,
    pointToLineSegmentDistance,
    escapeHTML,

    // State (für externe Lesezugriffe)
    aisVessels,
    aisSettings,
    infrastructurePOIs,
    infrastructureSettings,
    waterLevelGauges,
    waterLevelSettings,
    locksOnRoute,
    lockWarnings
};

// Für nicht-ES6 Module Umgebungen: Globale Verfügbarkeit
if (typeof window !== 'undefined') {
    window.AISModule = {
        // Initialisierung
        initAISModule,
        setCurrentPosition,
        setRouteCoordinates,
        setLockWarnings,

        // AIS
        fetchAISVessels,
        updateAISMarkers,
        showAISDetails,
        closeAISDetails,
        updateAISSettings,

        // Infrastruktur
        fetchInfrastructurePOIs,
        updateInfrastructureMarkers,
        showInfrastructureDetails,
        closeInfrastructureDetails,
        updateInfrastructureSettings,
        showInfrastructure,
        hideInfrastructure,

        // Pegelstände
        fetchWaterLevelGauges,
        loadWaterLevels,
        updateWaterLevelMarkers,
        displayWaterLevels,
        updateWaterLevelSettings,

        // Schleusen
        updateLocksTimeline,
        loadLocks,
        displayLocksTimeline,
        displayLocks,
        prepareLockNotification,
        getLockMarkers
    };

    // Globale Funktion für Button-Callback
    window.prepareLockNotification = prepareLockNotification;
}
