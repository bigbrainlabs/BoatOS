/**
 * BoatOS Frontend - Marine Dashboard
 */

// ==================== DEBUG CONSOLE OVERLAY ====================
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
let logBuffer = [];
const maxLines = 30;

function initDebugConsole() {
    const debugConsole = document.getElementById('debug-console');

    function addToDebug(message, color = '#0f0') {
        logBuffer.push(`<span style="color: ${color}">${message}</span>`);
        if (logBuffer.length > maxLines) logBuffer.shift();
        const debugEl = document.getElementById('debug-console');
        if (debugEl) debugEl.innerHTML = logBuffer.join('<br>');
    }

    console.log = function(...args) {
        originalLog.apply(console, args);
        addToDebug(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), '#0f0');
    };

    console.error = function(...args) {
        originalError.apply(console, args);
        addToDebug('ERROR: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), '#f00');
    };

    console.warn = function(...args) {
        originalWarn.apply(console, args);
        addToDebug('WARN: ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '), '#ff0');
    };

    console.log('🐛 Debug console initialized');
}

// Initialize debug console when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDebugConsole);
} else {
    initDebugConsole();
}

// Auto-detect protocol (http/https) for API and WebSocket
const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
const API_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${protocol}://${window.location.hostname}`;

const WS_URL = window.location.hostname === 'localhost'
    ? 'ws://localhost:8000/ws'
    : `${wsProtocol}://${window.location.hostname}/ws`;

// ==================== STATE ====================
let map;
let boatMarker;
let waypoints = [];
let routeLayer;
let trackHistoryLayer; // GPS track history polyline
let trackHistory = []; // Array of {lat, lon, timestamp}
let maxTrackPoints = 500; // Maximum track points to keep
let currentPosition = { lat: 50.8, lon: 5.6 }; // Default: Albertkanal
let ws;
let routePlanningMode = false;
let weatherData = null;
let autoFollow = true; // Auto-follow boot position
let lastGpsUpdate = null;
let gpsSource = null; // "backend" or "browser"
let browserGpsAccuracy = null;
let lowSatelliteStartTime = null; // Timestamp when satellite count first dropped below 4
let LOW_SATELLITE_THRESHOLD = 15000; // 15 seconds in milliseconds (can be changed in settings)
let lastBackendGpsTime = null; // Track when we last received valid backend GPS
let backendGpsUnavailableStartTime = null; // Track when backend GPS first became unavailable
const BACKEND_GPS_FALLBACK_DELAY = 30000; // Wait 30 seconds before falling back to browser GPS (only as true fallback)
let currentBoatHeading = 0; // Current boat heading/course for rotation

// Map layers (global references)
let osmLayer;
let satelliteLayer;
let currentBaseLayer = 'osm'; // 'osm' or 'satellite'

// AIS
let aisVessels = {};  // MMSI -> {marker, data}
let aisEnabled = false;
let aisUpdateInterval = null;
let aisSettings = { enabled: false, apiKey: '', updateInterval: 60, showLabels: true };

// ==================== MAP INIT ====================
function initMap() {
    console.log('🗺️ initMap() called');

    // Check map container dimensions
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        const rect = mapContainer.getBoundingClientRect();
        console.log('📐 Map container dimensions:', {
            width: rect.width,
            height: rect.height,
            display: window.getComputedStyle(mapContainer).display,
            visibility: window.getComputedStyle(mapContainer).visibility
        });
    } else {
        console.error('❌ Map container not found!');
    }

    console.log('📍 Initial position:', currentPosition);

    // Karte initialisieren
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([currentPosition.lat, currentPosition.lon], 13);

    console.log('🗺️ Map created, zoom:', map.getZoom(), 'center:', map.getCenter());

    // ==================== BASE LAYERS ====================
    // Using local Nginx tile proxy to avoid HTTPS mixed content issues
    osmLayer = L.tileLayer('/tiles/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap'
    });

    // Add tile loading event listeners for debugging
    osmLayer.on('tileerror', function(error, tile) {
        console.error('❌ Tile load error:', error.tile.src, error);
    });
    osmLayer.on('tileloadstart', function(event) {
        console.log('⏳ Tile loading:', event.tile.src);
    });
    osmLayer.on('tileload', function(event) {
        console.log('✅ Tile loaded:', event.tile.src);
    });
    osmLayer.on('load', function() {
        console.log('✅ All tiles loaded for current view');
    });

    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 19,
        attribution: '© ESRI'
    });

    // Default base layer
    console.log('➕ Adding OSM layer to map');
    osmLayer.addTo(map);
    console.log('🗺️ OSM layer added. Map bounds:', map.getBounds());

    // ==================== OVERLAY LAYERS ====================
    const seaMarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 0.8,
        attribution: '© OpenSeaMap'
    });

    const inlandLayer = L.tileLayer('https://tiles.openseamap.org/inland/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 0.8,
        attribution: '© OpenSeaMap Inland'
    });

    const railwayLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 0.5,
        attribution: '© OpenRailwayMap'
    });

    const trafficLayer = L.tileLayer('https://tiles.marinetraffic.com/ais_helpers/shiptilesingle.aspx?output=png&sat=1&grouping=shiptype&tile_size=256&legends=1&zoom={z}&X={x}&Y={y}', {
        maxZoom: 15,
        opacity: 0.7,
        attribution: '© MarineTraffic'
    });

    // Add default overlays
    seaMarkLayer.addTo(map);
    // inlandLayer.addTo(map); // DISABLED: Inland layer temporarily disabled (contains lock POIs from OpenSeaMap)
    railwayLayer.addTo(map);

    // ==================== LAYER CONTROL ====================
    const overlays = {
        "⚓ Seezeichen": seaMarkLayer,
        "🚢 Binnengewässer": inlandLayer,
        "🌉 Brücken": railwayLayer,
        "🚢 Schiffsverkehr": trafficLayer
    };

    L.control.layers(null, overlays, {
        position: 'bottomright',
        collapsed: true
    }).addTo(map);

    // Zoom Control (rechts unten)
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Boot-Position Marker
    // Get boat icon from settings
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    const boatIconType = settings.boat?.icon || 'motorboat_small';
    const boatIconHtml = (typeof getBoatIcon === 'function') ? getBoatIcon(boatIconType) : '⛵';

    boatMarker = L.marker([currentPosition.lat, currentPosition.lon], {
        icon: L.divIcon({
            html: boatIconHtml,
            className: 'boat-marker',
            iconSize: [40, 40]
        }),
        rotationAngle: 0
    }).addTo(map);

    // Route Layer
    routeLayer = L.layerGroup().addTo(map);

    // Track History Layer (initially empty polyline)
    trackHistoryLayer = L.polyline([], {
        color: '#3498db',
        weight: 3,
        opacity: 0.7,
        smoothFactor: 1
    }).addTo(map);

    // Check if track history should be shown from settings
    if (settings.showTrackHistory === false) {
        map.removeLayer(trackHistoryLayer);
    }

    // Click Handler für Wegpunkte
    map.on('click', onMapClick);

    // Disable auto-follow when user manually interacts with map
    map.on('dragstart', () => {
        autoFollow = false;
        console.log('🔓 Auto-follow deaktiviert (Karte verschoben)');
    });

    map.on('zoomstart', (e) => {
        // Only disable auto-follow if zoom was initiated by user (not programmatically)
        if (e.originalEvent) {
            autoFollow = false;
            console.log('🔓 Auto-follow deaktiviert (Zoom geändert)');
        }
    });

    console.log('✅ Map initialized');
}

// ==================== WEBSOCKET ====================
function connectWebSocket() {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        document.getElementById('signalk-status').classList.add('connected');
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        updateSensorDisplay(data);

        // Backend GPS has priority - always use it if valid
        if (data.gps && data.gps.lat !== 0 && data.gps.lon !== 0) {
            lastBackendGpsTime = Date.now();
            backendGpsUnavailableStartTime = null; // Reset unavailable timer
            if (gpsSource !== "backend") {
                gpsSource = "backend";
                updateGpsSourceIndicator();
            }
            updateBoatPosition(data.gps);
        } else {
            // Backend GPS invalid or missing
            // Start tracking how long it's been unavailable
            if (backendGpsUnavailableStartTime === null) {
                backendGpsUnavailableStartTime = Date.now();
            }

            // Only clear source after 5 seconds of no valid data
            if (gpsSource === "backend" && lastBackendGpsTime && (Date.now() - lastBackendGpsTime) > 5000) {
                gpsSource = null;
                updateGpsSourceIndicator();
            }
        }
    };

    ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        document.getElementById('signalk-status').classList.remove('connected');
    };

    ws.onclose = () => {
        console.log('⚠️ WebSocket disconnected, reconnecting...');
        document.getElementById('signalk-status').classList.remove('connected');
        setTimeout(connectWebSocket, 3000);
    };
}

// ==================== SENSOR UPDATES ====================
function updateSensorDisplay(data) {
    // Cache sensor data for GPS panel
    window.lastSensorData = data;

    // Speed
    if (data.speed !== undefined) {
        const speedFormatted = typeof formatSpeed === 'function'
            ? formatSpeed(data.speed)
            : `${data.speed.toFixed(1)} kn`;
        const parts = speedFormatted.split(' ');
        document.getElementById('speed').innerHTML =
            `${parts[0]}<span class="tile-unit">${parts.slice(1).join(' ')}</span>`;
    }

    // Heading (use GPS course if available, otherwise use heading)
    let displayHeading = data.heading;
    if (data.gps && data.gps.course !== undefined && data.gps.course !== 0) {
        displayHeading = data.gps.course;
    }
    if (displayHeading !== undefined) {
        document.getElementById('heading').innerHTML =
            `${Math.round(displayHeading)}<span class="tile-unit">°</span>`;
    }

    // Depth
    if (data.depth !== undefined) {
        const depthFormatted = typeof formatDepth === 'function'
            ? formatDepth(data.depth)
            : `${data.depth.toFixed(1)} m`;
        const parts = depthFormatted.split(' ');
        document.getElementById('depth').innerHTML =
            `${parts[0]}<span class="tile-unit">${parts.slice(1).join(' ')}</span>`;
    }

    // Wind
    if (data.wind && data.wind.speed !== undefined) {
        const windFormatted = typeof formatSpeed === 'function'
            ? formatSpeed(data.wind.speed)
            : `${data.wind.speed.toFixed(0)} kn`;
        const parts = windFormatted.split(' ');
        document.getElementById('wind').innerHTML =
            `${parts[0]}<span class="tile-unit">${parts.slice(1).join(' ')}</span>`;
    }

    // GPS Info (satellites, altitude)
    if (data.gps) {
        updateGpsInfo(data.gps);
    }
}

function updateGpsInfo(gps) {
    const gpsStatus = document.getElementById('gps-status');

    // Satellites indicator with time delay for low satellite count
    // Only use satellite-based logic if we have satellite data (backend GPS)
    if (gps.satellites !== undefined) {
        const satCount = gps.satellites;
        const now = Date.now();

        if (satCount >= 4) {
            // Good satellite count - immediately show connected
            gpsStatus.classList.add('connected');
            gpsStatus.title = `GPS: ${satCount} Satelliten`;
            // Reset low satellite timer
            lowSatelliteStartTime = null;
        } else {
            // Low satellite count - only remove 'connected' after threshold time
            if (lowSatelliteStartTime === null) {
                // First time below 4 satellites - start timer
                lowSatelliteStartTime = now;
            } else if (now - lowSatelliteStartTime >= LOW_SATELLITE_THRESHOLD) {
                // Below 4 satellites for more than threshold time - show disconnected
                gpsStatus.classList.remove('connected');
            }
            // Always update title to show current count
            gpsStatus.title = `GPS: ${satCount} Satelliten (kein Fix)`;
        }
    } else if (gpsSource === "browser") {
        // Browser GPS - no satellite data available
        // Assume connected if we're receiving browser GPS data
        gpsStatus.classList.add('connected');
        gpsStatus.title = `GPS: Browser/Phone`;
        lowSatelliteStartTime = null; // Reset timer for browser GPS
    }

    // Update GPS detail info if panel exists
    const gpsPanel = document.getElementById('gps-panel');
    if (gpsPanel) {
        // Satellites
        if (gps.satellites !== undefined) {
            document.getElementById('gps-satellites').textContent = gps.satellites;
        }

        // Altitude
        if (gps.altitude !== undefined) {
            document.getElementById('gps-altitude').textContent = `${gps.altitude.toFixed(1)} m`;
        }

        // Position
        if (gps.lat !== undefined && gps.lon !== undefined) {
            const posFormatted = typeof formatCoordinates === 'function'
                ? formatCoordinates(gps.lat, gps.lon)
                : `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
            document.getElementById('gps-position').textContent = posFormatted;
        }

        // Speed
        const speedEl = document.getElementById('gps-speed');
        if (speedEl && gps.speed !== undefined) {
            const speedFormatted = typeof formatSpeed === 'function'
                ? formatSpeed(gps.speed)
                : `${gps.speed.toFixed(1)} kn`;
            speedEl.textContent = speedFormatted;
        }

        // Heading
        const headingEl = document.getElementById('gps-heading');
        if (headingEl && gps.heading !== undefined) {
            headingEl.textContent = `${Math.round(gps.heading)}°`;
        }

        // Fix Status
        const fixStatusEl = document.getElementById('gps-fix-status');
        if (fixStatusEl) {
            if (gps.fix) {
                fixStatusEl.textContent = t('gps_fix');
                fixStatusEl.style.color = '#2ecc71';
            } else {
                fixStatusEl.textContent = t('gps_no_fix');
                fixStatusEl.style.color = '#e74c3c';
            }
        }

        // Timestamp
        const timestampEl = document.getElementById('gps-timestamp');
        if (timestampEl && gps.timestamp) {
            const date = new Date(gps.timestamp);
            timestampEl.textContent = date.toLocaleTimeString('de-DE');
        }

        // HDOP (Horizontal Dilution of Precision)
        const hdopEl = document.getElementById('gps-hdop');
        if (hdopEl && gps.hdop !== undefined && gps.hdop !== null) {
            hdopEl.textContent = gps.hdop.toFixed(2);
            // Color code: <2 excellent, 2-5 good, 5-10 moderate, >10 poor
            if (gps.hdop < 2) hdopEl.style.color = '#2ecc71';
            else if (gps.hdop < 5) hdopEl.style.color = '#f39c12';
            else if (gps.hdop < 10) hdopEl.style.color = '#e67e22';
            else hdopEl.style.color = '#e74c3c';
        }

        // VDOP (Vertical Dilution of Precision)
        const vdopEl = document.getElementById('gps-vdop');
        if (vdopEl && gps.vdop !== undefined && gps.vdop !== null) {
            vdopEl.textContent = gps.vdop.toFixed(2);
            // Color code: <2 excellent, 2-5 good, 5-10 moderate, >10 poor
            if (gps.vdop < 2) vdopEl.style.color = '#2ecc71';
            else if (gps.vdop < 5) vdopEl.style.color = '#f39c12';
            else if (gps.vdop < 10) vdopEl.style.color = '#e67e22';
            else vdopEl.style.color = '#e74c3c';
        }
    }
}

// ==================== GPS TRACK HISTORY ====================
function addToTrackHistory(lat, lon) {
    // Add new point to track history
    trackHistory.push({ lat, lon, timestamp: Date.now() });

    // Limit track history to maxTrackPoints
    if (trackHistory.length > maxTrackPoints) {
        trackHistory.shift(); // Remove oldest point
    }

    // Update polyline with new points
    const latLngs = trackHistory.map(point => [point.lat, point.lon]);
    trackHistoryLayer.setLatLngs(latLngs);
}

function clearTrackHistory() {
    trackHistory = [];
    trackHistoryLayer.setLatLngs([]);
    if (typeof showMsg === 'function') {
        showMsg('🗑️ Track-Historie gelöscht');
    }
}

function toggleTrackHistory(show) {
    if (show) {
        if (!map.hasLayer(trackHistoryLayer)) {
            map.addLayer(trackHistoryLayer);
        }
    } else {
        if (map.hasLayer(trackHistoryLayer)) {
            map.removeLayer(trackHistoryLayer);
        }
    }
}

// ==================== MAP VIEW TOGGLE ====================
function toggleMapView() {
    if (currentBaseLayer === 'osm') {
        // Switch to satellite
        map.removeLayer(osmLayer);
        satelliteLayer.addTo(map);
        currentBaseLayer = 'satellite';
        document.getElementById('current-map-view').textContent = '🛰️ Satellit';
    } else {
        // Switch to OSM
        map.removeLayer(satelliteLayer);
        osmLayer.addTo(map);
        currentBaseLayer = 'osm';
        document.getElementById('current-map-view').textContent = '🗺️ Karte';
    }
}

// ==================== PANEL MANAGEMENT ====================
function hideAllPanels() {
    const panels = [
        'crew-panel',
        'fuel-panel',
        'dashboard-panel',
        'gps-panel',
        'weather-panel'
    ];
    panels.forEach(panelId => {
        const panel = document.getElementById(panelId);
        if (panel) {
            panel.style.display = 'none';
        }
    });
}

// Make hideAllPanels globally available for other modules
window.hideAllPanels = hideAllPanels;

function toggleGpsPanel() {
    const panel = document.getElementById('gps-panel');
    const weatherPanel = document.getElementById('weather-panel');

    // Close weather panel if open
    if (weatherPanel && weatherPanel.style.display === 'block') {
        weatherPanel.style.display = 'none';
    }

    // Check computed style to handle CSS display property
    const currentDisplay = window.getComputedStyle(panel).display;
    if (currentDisplay === 'none') {
        panel.style.display = 'block';
    } else {
        panel.style.display = 'none';
    }
}

function updateBoatPosition(gps) {
    if (gps && gps.lat && gps.lon) {
        const newLat = gps.lat;
        const newLon = gps.lon;

        // Only update if position actually changed
        if (newLat === currentPosition.lat && newLon === currentPosition.lon) {
            return;
        }

        currentPosition = { lat: newLat, lon: newLon };

        // Add to track history
        addToTrackHistory(newLat, newLon);

        // Marker aktualisieren
        boatMarker.setLatLng([newLat, newLon]);

        // Rotate marker based on course (if available)
        let heading = gps.course || gps.heading || 0;
        if (heading !== undefined && heading !== 0) {
            currentBoatHeading = heading;
            // Update marker icon with rotation
            const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
            const boatIconType = settings.boat?.icon || 'motorboat_small';
            if (typeof createBoatMarkerIcon === 'function') {
                const rotatedIcon = createBoatMarkerIcon(boatIconType, heading);
                boatMarker.setIcon(rotatedIcon);
            }
            // Update compass rose with heading
            updateCompassRose(heading);
        } else if (gps.heading !== undefined) {
            // Use heading if course not available
            updateCompassRose(gps.heading);
        }

        // GPS Status is now handled by updateGpsInfo() based on satellite count
        // Don't override it here

        // Karte folgt Boot wenn auto-follow aktiv
        if (autoFollow) {
            map.setView([newLat, newLon], map.getZoom(), {
                animate: true,
                duration: 0.5
            });
        }

        lastGpsUpdate = Date.now();
        console.log(`📍 GPS: ${newLat.toFixed(6)}, ${newLon.toFixed(6)}`);
    } else {
        // No valid GPS data - check if GPS is stale
        if (lastGpsUpdate && (Date.now() - lastGpsUpdate) > 10000) {
            document.getElementById('gps-status').classList.remove('connected');
        }
    }
}

// ==================== WEGPUNKTE ====================
function onMapClick(e) {
    if (!routePlanningMode) return;

    const waypoint = {
        lat: e.latlng.lat,
        lon: e.latlng.lng,
        name: `WP${waypoints.length + 1}`,
        timestamp: new Date().toISOString()
    };

    addWaypoint(waypoint);
}

function addWaypoint(waypoint) {
    const waypointNumber = waypoints.length + 1;

    // Schöner Marker mit Pin-Design - direkt zur Karte hinzufügen
    const marker = L.marker([waypoint.lat, waypoint.lon], {
        icon: L.divIcon({
            html: `
                <div style="display: flex; flex-direction: column; align-items: center; width: 40px;">
                    <div style="background: #3498db; color: white; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4); margin-bottom: 4px;">${waypoint.name}</div>
                    <div style="width: 40px; height: 40px; background: linear-gradient(135deg, #3498db 0%, #2980b9 100%); border: 4px solid white; border-radius: 50%; box-shadow: 0 3px 10px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: white;">${waypointNumber}</div>
                </div>
            `,
            className: 'waypoint-marker',
            iconSize: [40, 60],
            iconAnchor: [20, 60]
        }),
        draggable: true
    }).addTo(map);  // Direkt zur Karte statt zu routeLayer

    marker.on('drag', () => {
        updateRoute();
    });

    marker.on('click', () => {
        if (confirm(`Wegpunkt ${waypoint.name} löschen?`)) {
            map.removeLayer(marker);  // Von der Karte entfernen statt von routeLayer
            waypoints = waypoints.filter(w => w.name !== waypoint.name);
            updateRoute();
        }
    });

    waypoints.push({ ...waypoint, marker });

    // An Backend senden
    fetch(`${API_URL}/api/waypoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waypoint)
    });

    updateRoute();
}

async function updateRoute() {
    // Alte Route löschen
    routeLayer.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer._icon) {
            routeLayer.removeLayer(layer);
        }
    });

    if (waypoints.length < 2) return;

    // Zeige Loading-Indikator
    showRoutingLoader();

    // Versuche ENC-basiertes Wasserrouting
    try {
        const coordinates = waypoints.map(w => {
            const latlng = w.marker.getLatLng();
            return [latlng.lng, latlng.lat]; // [lon, lat]
        });

        const response = await fetch(`${API_URL}/api/route`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({waypoints: coordinates})
        });

        if (response.ok) {
            const routeData = await response.json();
            console.log('🔍 Backend response:', routeData);
            console.log('🔍 Properties:', routeData.properties);
            console.log('🔍 routing_type:', routeData.properties?.routing_type);
            console.log('🔍 waterway_routed:', routeData.properties?.waterway_routed);

            if (routeData.error) {
                console.warn('⚠️ Routing error:', routeData.error);
                drawDirectRoute();
                hideRoutingLoader();
                return;
            }

            // Route aus ENC-Daten zeichnen
            if (routeData.geometry && routeData.geometry.coordinates) {
                const coords = routeData.geometry.coordinates;
                const routePoints = coords.map(c => [c[1], c[0]]); // [lat, lon] für Leaflet

                // Prüfe ob es echtes Routing ist oder nur Fallback
                const isWaterwayRouted = routeData.properties?.waterway_routed || false;
                const routingType = routeData.properties?.routing_type || 'waterway';

                console.log('🔍 Evaluated: routingType =', routingType, ', isWaterwayRouted =', isWaterwayRouted);

                if (routingType === 'direct' || !isWaterwayRouted) {
                    console.log('📍 Using direct routing (ENC routing not available)');
                    drawDirectRoute();
                    hideRoutingLoader();
                    return;
                }

                // Schatten-Linie
                L.polyline(routePoints, {
                    color: 'white',
                    weight: 8,
                    opacity: 0.4,
                    lineCap: 'round'
                }).addTo(routeLayer);

                // Hauptlinie (grün für ENC-Routing)
                L.polyline(routePoints, {
                    color: '#2ecc71',
                    weight: 5,
                    opacity: 0.9,
                    lineCap: 'round'
                }).addTo(routeLayer);

                // Distanz und Segment-Infos
                const distanceNM = routeData.properties?.distance_nm || 0;

                // Get cruise speed from boat settings (km/h) and convert to knots
                const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};
                let avgSpeed = 5; // Default fallback: 5 knots
                if (boatSettings.cruiseSpeed && boatSettings.cruiseSpeed > 0) {
                    avgSpeed = boatSettings.cruiseSpeed / 1.852; // Convert km/h to knots
                }

                // Use duration_adjusted_h from backend if available (includes water current)
                let etaHours;
                if (routeData.properties.duration_adjusted_h) {
                    etaHours = routeData.properties.duration_adjusted_h;
                    console.log('🌊 Using adjusted ETA from backend:', etaHours.toFixed(2), 'hours (includes water current)');
                } else {
                    etaHours = distanceNM / avgSpeed;
                    console.log('⏱️ Calculating ETA from distance/speed:', etaHours.toFixed(2), 'hours');
                }

                let etaHoursInt = Math.floor(etaHours);
                let etaMinutes = Math.round((etaHoursInt - etaHours) * 60);

                // Handle case where rounding gives 60 minutes
                if (etaMinutes >= 60) {
                    etaHoursInt += 1;
                    etaMinutes = 0;
                }

                // Segment-Infos
                const routeInfo = [];
                for (let i = 0; i < waypoints.length - 1; i++) {
                    const from = waypoints[i].marker.getLatLng();
                    const to = waypoints[i + 1].marker.getLatLng();
                    const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
                    const segmentDist = from.distanceTo(to) / 1852;

                    routeInfo.push({
                        from: waypoints[i].name,
                        to: waypoints[i + 1].name,
                        distance: segmentDist.toFixed(2),
                        bearing: Math.round(bearing)
                    });
                }

                console.log(`🌊 Waterway Route: ${distanceNM.toFixed(2)} NM`);
                showRouteInfo(distanceNM.toFixed(2), etaHoursInt, etaMinutes, routeInfo, false, true, avgSpeed);
                hideRoutingLoader();
                return;
            }
        }
    } catch (error) {
        console.error('❌ ENC routing failed:', error);
    }

    // Fallback auf direkte Route
    drawDirectRoute();
    hideRoutingLoader();
}

function drawDirectRoute() {
    // Direkte Rhumbline-Route (Luftlinie)
    const points = waypoints.map(w => {
        const latlng = w.marker.getLatLng();
        return [latlng.lat, latlng.lng];
    });

    // Schatten-Linie (weiß, breiter)
    L.polyline(points, {
        color: 'white',
        weight: 8,
        opacity: 0.4,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(routeLayer);

    // Hauptlinie (blau, durchgezogen)
    L.polyline(points, {
        color: '#3498db',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(routeLayer);

    let totalDistance = 0;
    let routeInfo = [];

    for (let i = 0; i < waypoints.length - 1; i++) {
        const from = waypoints[i].marker.getLatLng();
        const to = waypoints[i + 1].marker.getLatLng();
        const segmentDistance = from.distanceTo(to);
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

        // Format segment distance with units
        const segmentDistFormatted = typeof formatDistance === 'function'
            ? formatDistance(segmentDistance)
            : `${(segmentDistance / 1852).toFixed(2)} NM`;

        L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'route-label',
                html: '<div style="background: rgba(52, 152, 219, 0.95); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.3);">' +
                    segmentDistFormatted + '<br>' +
                    Math.round(bearing) + '°' +
                    '</div>',
                iconSize: [90, 35],
                iconAnchor: [45, 18]
            })
        }).addTo(routeLayer);
    }

    const totalNM = (totalDistance / 1852).toFixed(2);

    // Get cruise speed from boat settings (km/h) and convert to knots
    const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};
    let avgSpeed = 5; // Default fallback: 5 knots
    if (boatSettings.cruiseSpeed && boatSettings.cruiseSpeed > 0) {
        avgSpeed = boatSettings.cruiseSpeed / 1.852; // Convert km/h to knots
    }

    const etaHours = totalNM / avgSpeed;
    let etaHoursInt = Math.floor(etaHours);
    let etaMinutes = Math.round((etaHours - etaHoursInt) * 60);

    // Handle case where rounding gives 60 minutes
    if (etaMinutes >= 60) {
        etaHoursInt += 1;
        etaMinutes = 0;
    }

    console.log(`📏 Rhumbline Route: ${totalNM} NM`);
    showRouteInfo(totalNM, etaHoursInt, etaMinutes, routeInfo, false, false, avgSpeed);
}

function calculateBearing(lat1, lon1, lat2, lon2) {
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

function showRouteInfo(totalNM, hours, minutes, segments, isDirect, isWaterway, avgSpeed = 5) {
    const oldPanel = document.getElementById('route-info-panel');
    if (oldPanel) oldPanel.remove();

    const routeType = isWaterway ? 'waterway' : 'rhumbline';
    const routeColor = isWaterway ? 'rgba(46, 204, 113, 0.6)' : 'rgba(52, 152, 219, 0.6)';
    const routeIcon = isWaterway ? '🌊' : '🧭';
    const routeTitle = isWaterway ? 'Route (Wasserwege)' : 'Route (Rhumbline)';
    const routeDesc = isWaterway ? '✓ Route folgt Wasserwegen aus ENC-Karten' : 'ℹ️ Direkte Kurslinien zwischen Wegpunkten';

    // Format total distance with units
    const totalDistFormatted = typeof formatDistance === 'function'
        ? formatDistance(parseFloat(totalNM) * 1852)  // Convert NM to meters first
        : `${totalNM} NM`;

    // Format speed with units
    const speedFormatted = typeof formatSpeed === 'function'
        ? formatSpeed(avgSpeed)
        : `${avgSpeed.toFixed(1)} kn`;

    const panel = document.createElement('div');
    panel.id = 'route-info-panel';
    panel.style.cssText = 'position: absolute; bottom: 80px; left: 20px; background: rgba(10, 14, 39, 0.95); backdrop-filter: blur(10px); border: 2px solid ' + routeColor + '; border-radius: 12px; padding: 15px; z-index: 1001; min-width: 300px; max-width: 350px; color: white; font-size: 14px;';

    panel.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
        '<h3 style="margin: 0; color: #64ffda; font-size: 16px;">' + routeIcon + ' ' + routeTitle + '</h3>' +
        '<button onclick="clearRoute()" style="background: rgba(231, 76, 60, 0.3); border: none; color: white; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">Löschen</button>' +
        '</div>' +
        '<div style="background: ' + (isWaterway ? 'rgba(46, 204, 113, 0.15)' : 'rgba(52, 152, 219, 0.15)') + '; padding: 8px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: ' + (isWaterway ? '#7effc5' : '#8dd4f8') + ';">' +
        routeDesc +
        '</div>' +
        '<div style="background: rgba(42, 82, 152, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 10px;">' +
        '<div style="font-size: 24px; font-weight: 700; color: #64ffda;">' + totalDistFormatted + '</div>' +
        '<div style="font-size: 12px; color: #8892b0;">ETA: ' + hours + 'h ' + minutes + 'min @ ' + speedFormatted + '</div>' +
        '</div>' +
        '<div style="max-height: 200px; overflow-y: auto;">' +
        segments.map(s => {
            // Format segment distance with units
            const segDistFormatted = typeof formatDistance === 'function'
                ? formatDistance(parseFloat(s.distance) * 1852)  // Convert NM to meters first
                : `${s.distance} NM`;
            return '<div style="background: rgba(42, 82, 152, 0.15); padding: 8px; border-radius: 6px; margin-bottom: 5px; font-size: 12px;">' +
                '<div style="color: #64ffda; font-weight: 600;">' + s.from + ' → ' + s.to + '</div>' +
                '<div style="color: #8892b0; margin-top: 3px;">' + segDistFormatted + ' • ' + s.bearing + '°</div>' +
                '</div>';
        }).join('') +
        '</div>';

    document.getElementById('map-container').appendChild(panel);
}

function clearRoute() {
    // Entferne Wegpunkt-Marker von der Karte
    waypoints.forEach(w => {
        if (w.marker) {
            map.removeLayer(w.marker);  // Von der Karte entfernen
        }
    });
    waypoints = [];

    // Entferne Routen-Linien vom routeLayer
    routeLayer.clearLayers();

    const panel = document.getElementById('route-info-panel');
    if (panel) panel.remove();

    showNotification('🗑️ Route gelöscht');
}

// ==================== ROUTING LOADER ====================
function showRoutingLoader() {
    // Entferne alten Loader falls vorhanden
    hideRoutingLoader();

    const loader = document.createElement('div');
    loader.id = 'routing-loader';
    loader.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(10, 14, 39, 0.95);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(52, 152, 219, 0.6);
        border-radius: 12px;
        padding: 20px 30px;
        z-index: 10000;
        color: white;
        font-size: 16px;
        font-weight: 600;
        text-align: center;
        box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    `;

    loader.innerHTML = `
        <div style="display: flex; align-items: center; gap: 15px;">
            <div style="width: 30px; height: 30px; border: 3px solid rgba(52, 152, 219, 0.3); border-top-color: #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <div>
                <div style="color: #64ffda; margin-bottom: 5px;">Route wird berechnet...</div>
                <div style="font-size: 12px; color: #8892b0;">Berechne Wasserwege</div>
            </div>
        </div>
    `;

    document.body.appendChild(loader);

    // Add CSS animation for spinner
    if (!document.getElementById('routing-loader-style')) {
        const style = document.createElement('style');
        style.id = 'routing-loader-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

function hideRoutingLoader() {
    const loader = document.getElementById('routing-loader');
    if (loader) {
        loader.remove();
    }
}


// ==================== WEATHER ====================
async function fetchWeather() {
    try {
        const lang = getLanguage ? getLanguage() : 'de';
        const response = await fetch(`${API_URL}/api/weather?lang=${lang}`);
        if (response.ok) {
            weatherData = await response.json();
            updateWeatherDisplay();
            console.log('✅ Weather data loaded:', weatherData);
        }
    } catch (error) {
        console.error('❌ Weather fetch failed:', error);
    }
}

function updateWeatherDisplay() {
    if (!weatherData || !weatherData.current) return;

    const current = weatherData.current;

    // Update Weather Tile
    document.getElementById('weather-temp').textContent = current.temp.toFixed(1);
    document.getElementById('weather-desc').textContent = current.description;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${current.icon}@2x.png`;

    // Update Wind im Wind-Tile (falls vorhanden)
    if (current.wind_speed !== undefined) {
        document.getElementById('wind').innerHTML =
            `${current.wind_speed.toFixed(0)}<span class="tile-unit">kn</span>`;
    }
}

function toggleWeatherPanel() {
    const panel = document.getElementById('weather-panel');
    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        updateWeatherPanel();
    } else {
        panel.style.display = 'none';
    }
}

function updateWeatherPanel() {
    if (!weatherData || !weatherData.current) return;

    const current = weatherData.current;

    // Current Weather Details with unit formatting
    const tempFormatted = typeof formatTemperature === 'function'
        ? formatTemperature(current.temp)
        : `${current.temp.toFixed(1)}°C`;
    const feelsFormatted = typeof formatTemperature === 'function'
        ? formatTemperature(current.feels_like)
        : `${current.feels_like.toFixed(1)}°C`;
    const windFormatted = typeof formatSpeed === 'function'
        ? formatSpeed(current.wind_speed)
        : `${current.wind_speed.toFixed(1)} kn`;
    const pressureFormatted = typeof formatPressure === 'function'
        ? formatPressure(current.pressure)
        : `${current.pressure} hPa`;
    const visibilityFormatted = typeof formatDistance === 'function'
        ? formatDistance(current.visibility * 1852) // Convert NM to meters first
        : `${current.visibility.toFixed(1)} NM`;

    document.getElementById('weather-panel-temp').textContent = tempFormatted;
    document.getElementById('weather-panel-feels').textContent = feelsFormatted;
    document.getElementById('weather-panel-desc').textContent = current.description;
    document.getElementById('weather-panel-wind').textContent = windFormatted;
    document.getElementById('weather-panel-pressure').textContent = pressureFormatted;
    document.getElementById('weather-panel-humidity').textContent = `${current.humidity}%`;
    document.getElementById('weather-panel-visibility').textContent = visibilityFormatted;
    document.getElementById('weather-panel-clouds').textContent = `${current.clouds}%`;

    // Forecast with unit formatting
    const forecastHtml = weatherData.forecast.map(f => {
        const fTempFormatted = typeof formatTemperature === 'function'
            ? formatTemperature(f.temp)
            : `${f.temp.toFixed(1)}°C`;
        const fWindFormatted = typeof formatSpeed === 'function'
            ? formatSpeed(f.wind_speed)
            : `${f.wind_speed.toFixed(0)} kn`;

        return `
            <div class="forecast-item">
                <div class="forecast-date">${f.date}</div>
                <img src="https://openweathermap.org/img/wn/${f.icon}.png" alt="${f.description}" style="width:50px">
                <div class="forecast-temp">${fTempFormatted}</div>
                <div class="forecast-wind">${fWindFormatted}</div>
            </div>
        `;
    }).join('');

    document.getElementById('weather-forecast').innerHTML = forecastHtml;
}

// ==================== CONTROLS ====================
document.getElementById('btn-waypoint').addEventListener('click', () => {
    // Wegpunkt an aktueller Boot-Position
    addWaypoint({
        lat: currentPosition.lat,
        lon: currentPosition.lon,
        name: `WP${waypoints.length + 1}`,
        timestamp: new Date().toISOString()
    });

    showNotification('📍 Wegpunkt gesetzt');
});

document.getElementById('btn-route').addEventListener('click', (e) => {
    routePlanningMode = !routePlanningMode;
    e.target.classList.toggle('active');

    if (routePlanningMode) {
        showNotification('🛤️ Routenplanung aktiv - Tippe auf Karte für Wegpunkte');
    } else {
        showNotification('🛤️ Routenplanung beendet');

        // Route speichern
        if (waypoints.length > 0) {
            saveRoute();
        }
    }
});

document.getElementById('btn-logbook').addEventListener('click', () => {
    openLogbook();
});

document.getElementById('btn-sensors').addEventListener('click', (e) => {
    const sensorTiles = document.getElementById('sensor-tiles');
    const isHidden = sensorTiles.classList.contains('hidden');

    // Toggle the sensor tiles visibility
    sensorTiles.classList.toggle('hidden');

    // Button should be active when tiles are VISIBLE (not hidden)
    if (isHidden) {
        e.target.classList.add('active');
    } else {
        e.target.classList.remove('active');
    }
});

// Center on boat button
function centerOnBoat() {
    autoFollow = true;
    map.setView([currentPosition.lat, currentPosition.lon], 15, {
        animate: true,
        duration: 1
    });
    showNotification('🎯 Karte zentriert auf Boot');
}

// Add center button to map
const centerButton = L.control({ position: 'bottomleft' });
centerButton.onAdd = function() {
    const btn = L.DomUtil.create('button', 'leaflet-bar leaflet-control');
    btn.innerHTML = '🎯';
    btn.style.cssText = 'background: white; width: 30px; height: 30px; border: 2px solid rgba(0,0,0,0.2); cursor: pointer; font-size: 18px;';
    btn.onclick = centerOnBoat;
    btn.title = 'Auf Boot zentrieren';
    return btn;
};

// Compass Rose Control
let compassRoseElement = null;
let currentHeading = 0;

const compassRose = L.control({ position: 'topleft' });
compassRose.onAdd = function() {
    const container = L.DomUtil.create('div', 'compass-rose-container');
    container.style.cssText = 'width: 100px; height: 100px; background: rgba(255,255,255,0.9); border: 3px solid rgba(0,0,0,0.3); border-radius: 50%; position: relative; box-shadow: 0 2px 10px rgba(0,0,0,0.3);';

    // Compass rose SVG
    container.innerHTML = `
        <svg width="100" height="100" viewBox="0 0 100 100" style="position: absolute; top: 0; left: 0; transition: transform 0.5s ease-out;">
            <!-- Background circle -->
            <circle cx="50" cy="50" r="48" fill="#fff" stroke="#333" stroke-width="2"/>

            <!-- Cardinal directions -->
            <text x="50" y="15" text-anchor="middle" font-size="14" font-weight="bold" fill="#e74c3c">N</text>
            <text x="85" y="54" text-anchor="middle" font-size="12" font-weight="bold" fill="#34495e">E</text>
            <text x="50" y="92" text-anchor="middle" font-size="12" font-weight="bold" fill="#34495e">S</text>
            <text x="15" y="54" text-anchor="middle" font-size="12" font-weight="bold" fill="#34495e">W</text>

            <!-- Needle (North pointer - red) -->
            <polygon points="50,10 45,55 50,50 55,55" fill="#e74c3c" stroke="#c0392b" stroke-width="1"/>

            <!-- Needle (South pointer - white/gray) -->
            <polygon points="50,90 45,45 50,50 55,45" fill="#ecf0f1" stroke="#95a5a6" stroke-width="1"/>

            <!-- Center dot -->
            <circle cx="50" cy="50" r="4" fill="#2c3e50"/>

            <!-- Degree markings -->
            <g id="compass-markings">
                ${Array.from({length: 12}, (_, i) => {
                    const angle = i * 30;
                    const rad = (angle - 90) * Math.PI / 180;
                    const x1 = 50 + 40 * Math.cos(rad);
                    const y1 = 50 + 40 * Math.sin(rad);
                    const x2 = 50 + 45 * Math.cos(rad);
                    const y2 = 50 + 45 * Math.sin(rad);
                    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#7f8c8d" stroke-width="2"/>`;
                }).join('')}
            </g>
        </svg>
        <div style="position: absolute; bottom: -25px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.7); color: #64ffda; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; font-family: monospace;" id="compass-heading">000°</div>
    `;

    compassRoseElement = container.querySelector('svg');
    return container;
};

function updateCompassRose(heading) {
    if (compassRoseElement && heading !== undefined && heading !== null) {
        currentHeading = heading;
        // Rotate compass to show heading (negative rotation because compass rotates opposite to heading)
        compassRoseElement.style.transform = `rotate(${-heading}deg)`;

        // Update heading text
        const headingText = document.getElementById('compass-heading');
        if (headingText) {
            headingText.textContent = `${Math.round(heading).toString().padStart(3, '0')}°`;
        }
    }
}

function toggleCompassRose(show) {
    const compassContainer = document.querySelector('.compass-rose-container');

    if (show) {
        // Add compass if not already on map
        if (!compassContainer || !compassContainer.parentElement) {
            compassRose.addTo(map);
        }
    } else {
        // Remove compass from map
        if (compassContainer && compassContainer.parentElement) {
            map.removeControl(compassRose);
        }
    }
}

function saveRoute() {
    const route = {
        name: `Route ${new Date().toLocaleDateString('de-DE')}`,
        waypoints: waypoints.map(w => ({
            lat: w.lat,
            lon: w.lon,
            name: w.name
        })),
        timestamp: new Date().toISOString()
    };

    fetch(`${API_URL}/api/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(route)
    })
    .then(res => res.json())
    .then(data => {
        console.log('✅ Route gespeichert:', data);
        showNotification('💾 Route gespeichert');
    })
    .catch(err => {
        console.error('❌ Route speichern fehlgeschlagen:', err);
    });
}

// ==================== NOTIFICATIONS ====================
function showNotification(message) {
    // Simple Toast-Notification
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(46, 204, 113, 0.95);
        color: white;
        padding: 15px 30px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: 600;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => toast.remove(), 500);
    }, 2000);
}

// ==================== STARTUP ====================
// Initialize map as soon as DOM is ready (not waiting for all resources)
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded - initializing map...');
    initMap();
    connectWebSocket();

    // Add center button to map
    centerButton.addTo(map);

    // Add compass rose to map (check settings first)
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    if (settings.navigation?.showCompassRose !== false) {
        compassRose.addTo(map);
    }

    // Apply infrastructure settings on startup
    // DISABLED: Infrastructure temporarily disabled for data collection
    // if (settings.infrastructure) {
    //     updateInfrastructureSettings(settings.infrastructure);
    // }

    // Apply water level settings on startup
    if (settings.waterLevel) {
        updateWaterLevelSettings(settings.waterLevel);
    }

    // Apply GPS threshold setting
    if (settings.gps && settings.gps.lowSatelliteThreshold) {
        LOW_SATELLITE_THRESHOLD = settings.gps.lowSatelliteThreshold * 1000; // Convert seconds to milliseconds
        console.log(`📡 GPS low satellite threshold set to ${settings.gps.lowSatelliteThreshold}s`);
    }

    // Weather laden und alle 30min aktualisieren
    fetchWeather();
    setInterval(fetchWeather, 1800000); // 30 min

    // Initialize locks layer
    if (typeof initLocksLayer === 'function') {
        initLocksLayer(map);
    }

    // Geolocation API (Browser GPS als Fallback)
    let firstPositionReceived = false;
    if (navigator.geolocation) {
        console.log('🌍 Requesting browser geolocation...');
        navigator.geolocation.watchPosition(
            (position) => {
                browserGpsAccuracy = position.coords.accuracy;
                console.log('📍 Browser GPS: ' + position.coords.latitude.toFixed(6) + ', ' + position.coords.longitude.toFixed(6) + ' (±' + Math.round(position.coords.accuracy) + 'm)');

                // Center map on first browser position ONLY if backend GPS has never been received
                if (!firstPositionReceived && gpsSource === null && lastBackendGpsTime === null) {
                    firstPositionReceived = true;
                    map.setView([position.coords.latitude, position.coords.longitude], 15);
                    console.log('✅ Centered map on browser location (no backend GPS yet)');
                }

                // Only use browser GPS as fallback when backend GPS has been unavailable for enough time
                if (gpsSource !== "backend") {
                    // Check if backend GPS has been unavailable long enough
                    const backendUnavailableDuration = backendGpsUnavailableStartTime
                        ? (Date.now() - backendGpsUnavailableStartTime)
                        : 0;

                    // Only switch to browser GPS after the fallback delay
                    // AND only if backend GPS was seen before (backendGpsUnavailableStartTime is set)
                    if (backendGpsUnavailableStartTime !== null && backendUnavailableDuration >= BACKEND_GPS_FALLBACK_DELAY) {
                        if (gpsSource !== 'browser') {
                            gpsSource = 'browser';
                            updateGpsSourceIndicator();
                            console.log('⚠️ Switching to browser GPS fallback (backend unavailable for ' + Math.round(backendUnavailableDuration / 1000) + 's)');
                        }
                        const browserGps = {
                            lat: position.coords.latitude,
                            lon: position.coords.longitude,
                            speed: position.coords.speed ? position.coords.speed * 1.94384 : 0, // m/s to knots
                            heading: position.coords.heading || 0
                        };
                        updateBoatPosition(browserGps);
                        updateGpsInfo(browserGps); // Update GPS status for browser GPS
                    }
                    // Otherwise: Don't use browser GPS at all - wait for backend GPS
                }
                // If backend GPS is active, don't override GPS status with browser GPS
                // If backend GPS was available before, it will take over again automatically
            },
            (error) => {
                console.error('❌ Geolocation error:', error.code, error.message);
                if (error.code === 1) {
                    console.warn('⚠️ Geolocation permission denied. Enable location in browser settings.');
                } else if (error.code === 2) {
                    console.warn('⚠️ Position unavailable. GPS may not be available.');
                }
                gpsSource = null;
                updateGpsSourceIndicator();
            },
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
    }



    console.log('🚢 BoatOS Frontend started!');
});

// ==================== GPS SOURCE INDICATOR ====================
function updateGpsSourceIndicator() {
    const gpsStatus = document.getElementById("gps-status");
    const gpsSourceEl = document.getElementById("gps-source");
    const gpsAccuracyEl = document.getElementById("gps-accuracy");

    // Don't override background - let updateGpsInfo() handle it via 'connected' class
    // Only update the icon/emoji based on GPS source
    if (gpsSource === "backend") {
        gpsStatus.textContent = "GPS 📡";
        if (gpsSourceEl) gpsSourceEl.textContent = "Backend Module";
        if (gpsAccuracyEl) gpsAccuracyEl.textContent = "High";
    } else if (gpsSource === "browser") {
        gpsStatus.textContent = "GPS 📱";
        if (gpsSourceEl) gpsSourceEl.textContent = "Browser/Phone";
        if (gpsAccuracyEl && browserGpsAccuracy) {
            gpsAccuracyEl.textContent = Math.round(browserGpsAccuracy) + " m";
        }
    } else {
        gpsStatus.textContent = "GPS ❌";
        if (gpsSourceEl) gpsSourceEl.textContent = "No Signal";
        if (gpsAccuracyEl) gpsAccuracyEl.textContent = "-- m";
    }
}

// ==================== AIS ====================
async function fetchAISVessels() {
    if (!aisSettings.enabled) {
        return;
    }

    try {
        // Get map bounds
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
        console.warn('⚠️ AIS fetch error:', error);
    }
}

function updateAISMarkers(vessels) {
    // Remove old vessels not in update
    const currentMMSIs = new Set(vessels.map(v => v.mmsi));
    Object.keys(aisVessels).forEach(mmsi => {
        if (!currentMMSIs.has(mmsi)) {
            map.removeLayer(aisVessels[mmsi].marker);
            delete aisVessels[mmsi];
        }
    });

    // Add/update vessels
    vessels.forEach(vessel => {
        if (aisVessels[vessel.mmsi]) {
            // Update existing
            const { marker } = aisVessels[vessel.mmsi];
            marker.setLatLng([vessel.lat, vessel.lon]);
            if (marker.setRotationAngle) {
                marker.setRotationAngle(vessel.heading || vessel.cog || 0);
            }
            aisVessels[vessel.mmsi].data = vessel;
        } else {
            // Create new marker
            const icon = createShipIcon(vessel);
            const marker = L.marker([vessel.lat, vessel.lon], {
                icon: icon,
                rotationAngle: vessel.heading || vessel.cog || 0,
                rotationOrigin: 'center'
            });

            marker.bindPopup(() => createAISPopup(vessel));
            marker.on('click', () => showAISDetails(vessel));
            marker.addTo(map);

            aisVessels[vessel.mmsi] = { marker, data: vessel };
        }
    });
}

function createShipIcon(vessel) {
    const color = getShipColor(vessel.navstat);
    const size = vessel.length > 100 ? 24 : 16;

    const svgIcon = `
        <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2 L20 20 L12 17 L4 20 Z" fill="${color}" stroke="white" stroke-width="1.5"/>
        </svg>
    `;

    return L.divIcon({
        html: svgIcon,
        className: 'ais-ship-icon',
        iconSize: [size, size],
        iconAnchor: [size/2, size/2]
    });
}

function getShipColor(navstat) {
    switch (navstat) {
        case 0: return '#3498db'; // Under way - blue
        case 1: return '#2ecc71'; // At anchor - green
        case 5: return '#2ecc71'; // Moored - green
        case 6: return '#e74c3c'; // Aground - red
        case 7: return '#9b59b6'; // Fishing - purple
        case 8: return '#1abc9c'; // Sailing - teal
        default: return '#95a5a6'; // Unknown - gray
    }
}

function createAISPopup(vessel) {
    return `
        <div class="ais-popup">
            <h4>${vessel.name}</h4>
            <p><strong>MMSI:</strong> ${vessel.mmsi}</p>
            <p><strong>Speed:</strong> ${vessel.sog.toFixed(1)} kn</p>
            <p><strong>Course:</strong> ${Math.round(vessel.cog)}°</p>
            ${vessel.destination ? `<p><strong>Destination:</strong> ${vessel.destination}</p>` : ''}
        </div>
    `;
}

function showAISDetails(vessel) {
    const panel = document.getElementById('ais-details-panel');
    if (!panel) return;

    document.getElementById('ais-name').textContent = vessel.name;
    document.getElementById('ais-mmsi').textContent = vessel.mmsi;
    document.getElementById('ais-callsign').textContent = vessel.callsign || 'N/A';
    document.getElementById('ais-type').textContent = getShipTypeText(vessel.type);
    document.getElementById('ais-speed').textContent = vessel.sog.toFixed(1) + ' kn';
    document.getElementById('ais-course').textContent = Math.round(vessel.cog) + '°';
    document.getElementById('ais-heading').textContent = vessel.heading ? vessel.heading + '°' : 'N/A';
    document.getElementById('ais-navstat').textContent = getNavstatText(vessel.navstat);
    document.getElementById('ais-destination').textContent = vessel.destination || 'N/A';
    document.getElementById('ais-eta').textContent = vessel.eta || 'N/A';
    document.getElementById('ais-length').textContent = vessel.length ? vessel.length + ' m' : 'N/A';
    document.getElementById('ais-width').textContent = vessel.width ? vessel.width + ' m' : 'N/A';
    document.getElementById('ais-draught').textContent = vessel.draught ? vessel.draught.toFixed(1) + ' m' : 'N/A';

    panel.classList.add('show');
}

function closeAISDetails() {
    const panel = document.getElementById('ais-details-panel');
    if (panel) {
        panel.classList.remove('show');
    }
}

function getNavstatText(navstat) {
    const statuses = {
        0: "Under way using engine", 1: "At anchor", 2: "Not under command",
        3: "Restricted manoeuvrability", 4: "Constrained by draught", 5: "Moored",
        6: "Aground", 7: "Engaged in fishing", 8: "Under way sailing",
        14: "AIS-SART active", 15: "Undefined"
    };
    return statuses[navstat] || "Unknown";
}

function getShipTypeText(type) {
    if (type == 0) return "Unknown";
    if (type >= 20 && type <= 29) return "Wing in ground";
    if (type == 30) return "Fishing";
    if (type >= 31 && type <= 32) return "Towing";
    if (type == 36) return "Sailing";
    if (type == 37) return "Pleasure craft";
    if (type >= 40 && type <= 49) return "High speed craft";
    if (type >= 60 && type <= 69) return "Passenger";
    if (type >= 70 && type <= 79) return "Cargo";
    if (type >= 80 && type <= 89) return "Tanker";
    return "Other";
}

function updateAISSettings(settings) {
    aisSettings = settings;

    // Clear interval
    if (aisUpdateInterval) {
        clearInterval(aisUpdateInterval);
        aisUpdateInterval = null;
    }

    // Remove all markers
    Object.values(aisVessels).forEach(({marker}) => map.removeLayer(marker));
    aisVessels = {};

    // Start if enabled
    if (settings.enabled && settings.apiKey) {
        fetchAISVessels();
        aisUpdateInterval = setInterval(fetchAISVessels, settings.updateInterval * 1000);
        console.log('🚢 AIS enabled');
    } else {
        console.log('🚢 AIS disabled');
    }
}

// ==================== WATERWAY INFRASTRUCTURE ====================
let infrastructurePOIs = {};  // id -> {marker, data}
let infrastructureEnabled = false;
let infrastructureUpdateInterval = null;
let infrastructureSettings = { enabled: false, types: ['lock', 'bridge', 'harbor'] };

async function fetchInfrastructurePOIs() {
    if (!infrastructureSettings.enabled) {
        return;
    }

    try {
        // Get map bounds
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
        console.warn('⚠️ Infrastructure fetch error:', error);
    }
}

function updateInfrastructureMarkers(pois) {
    // Remove old POIs not in update
    const currentIDs = new Set(pois.map(p => p.id));
    Object.keys(infrastructurePOIs).forEach(id => {
        if (!currentIDs.has(parseInt(id))) {
            map.removeLayer(infrastructurePOIs[id].marker);
            delete infrastructurePOIs[id];
        }
    });

    // Add/update POIs
    pois.forEach(poi => {
        if (infrastructurePOIs[poi.id]) {
            // Update existing marker position (if changed)
            const { marker } = infrastructurePOIs[poi.id];
            marker.setLatLng([poi.lat, poi.lon]);
            infrastructurePOIs[poi.id].data = poi;
        } else {
            // Create new marker
            const icon = createInfrastructureIcon(poi.type);
            const marker = L.marker([poi.lat, poi.lon], {
                icon: icon,
                title: poi.name
            });

            marker.bindPopup(() => createInfrastructurePopup(poi));
            marker.on('click', () => showInfrastructureDetails(poi));
            marker.addTo(map);

            infrastructurePOIs[poi.id] = { marker, data: poi };
        }
    });
}

function createInfrastructureIcon(type) {
    const icons = {
        'lock': '🔒',
        'bridge': '🌉',
        'harbor': '⚓',
        'weir': '〰️',
        'dam': '🏗️'
    };

    const colors = {
        'lock': '#e74c3c',
        'bridge': '#3498db',
        'harbor': '#2ecc71',
        'weir': '#9b59b6',
        'dam': '#f39c12'
    };

    const emoji = icons[type] || '📍';
    const color = colors[type] || '#95a5a6';

    return L.divIcon({
        html: `<div style="font-size: 20px; text-shadow: 0 0 3px ${color}, 0 0 5px rgba(0,0,0,0.8); filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5));">${emoji}</div>`,
        className: 'infrastructure-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

function createInfrastructurePopup(poi) {
    const typeNames = {
        'lock': '🔒 Schleuse',
        'bridge': '🌉 Brücke',
        'harbor': '⚓ Hafen',
        'weir': '〰️ Wehr',
        'dam': '🏗️ Damm'
    };

    let html = `<div style="min-width: 150px;">
        <h4 style="margin: 0 0 8px 0; color: #2c3e50;">${typeNames[poi.type] || poi.type}</h4>
        <p style="margin: 0; font-weight: 600;">${poi.name}</p>`;

    // Add key properties
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

function showInfrastructureDetails(poi) {
    const panel = document.getElementById('infrastructure-details-panel');
    if (!panel) return;

    const typeNames = {
        'lock': '🔒 Schleuse',
        'bridge': '🌉 Brücke',
        'harbor': '⚓ Hafen/Marina',
        'weir': '〰️ Wehr',
        'dam': '🏗️ Damm'
    };

    // Update title
    document.getElementById('infrastructure-details-title').textContent = typeNames[poi.type] || poi.type;

    // Build details HTML
    let detailsHtml = `
        <div class="info-item" style="grid-column: span 2;">
            <div class="info-label">Name</div>
            <div class="info-value">${poi.name}</div>
        </div>
    `;

    // Add properties based on type
    const props = poi.properties;

    if (props.operator) {
        detailsHtml += `
            <div class="info-item" style="grid-column: span 2;">
                <div class="info-label">Betreiber</div>
                <div class="info-value">${props.operator}</div>
            </div>
        `;
    }

    if (poi.type === 'lock') {
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

function closeInfrastructureDetails() {
    const panel = document.getElementById('infrastructure-details-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

function updateInfrastructureSettings(settings) {
    infrastructureSettings = settings;

    // Clear interval
    if (infrastructureUpdateInterval) {
        clearInterval(infrastructureUpdateInterval);
        infrastructureUpdateInterval = null;
    }

    // Remove all markers
    Object.values(infrastructurePOIs).forEach(({marker}) => map.removeLayer(marker));
    infrastructurePOIs = {};

    // Start if enabled
    if (settings.enabled) {
        fetchInfrastructurePOIs();
        // Refresh on map move/zoom
        map.on('moveend', fetchInfrastructurePOIs);
        console.log('🏗️ Infrastructure layer enabled');
    } else {
        map.off('moveend', fetchInfrastructurePOIs);
        console.log('🏗️ Infrastructure layer disabled');
    }
}

// ==================== WATER LEVEL GAUGES (PEGELONLINE) ====================
let waterLevelGauges = {};  // id -> {marker, data}
let waterLevelSettings = { enabled: false };

async function fetchWaterLevelGauges() {
    if (!waterLevelSettings.enabled) {
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
        console.warn('⚠️ Water level fetch error:', error);
    }
}

function updateWaterLevelMarkers(gauges) {
    // Remove old gauges not in update
    const currentIDs = new Set(gauges.map(g => g.id));
    Object.keys(waterLevelGauges).forEach(id => {
        if (!currentIDs.has(id)) {
            map.removeLayer(waterLevelGauges[id].marker);
            delete waterLevelGauges[id];
        }
    });

    // Add/update gauges
    gauges.forEach(gauge => {
        if (waterLevelGauges[gauge.id]) {
            // Update existing marker
            const { marker } = waterLevelGauges[gauge.id];
            marker.setLatLng([gauge.lat, gauge.lon]);
            // Update icon with new water level
            marker.setIcon(createWaterLevelIcon(gauge));
            waterLevelGauges[gauge.id].data = gauge;
        } else {
            // Create new marker
            const icon = createWaterLevelIcon(gauge);
            const marker = L.marker([gauge.lat, gauge.lon], {
                icon: icon,
                title: gauge.name
            });

            marker.bindPopup(() => createWaterLevelPopup(gauge));
            marker.addTo(map);

            waterLevelGauges[gauge.id] = { marker, data: gauge };
        }
    });
}

function createWaterLevelIcon(gauge) {
    const level = gauge.water_level_cm;

    return L.divIcon({
        html: `<div style="background: rgba(10, 14, 39, 0.95); border: 2px solid #3498db; border-radius: 8px; padding: 4px 8px; font-size: 11px; font-weight: bold; color: #64ffda; text-align: center; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
            📊 ${level} cm
        </div>`,
        className: 'water-level-icon',
        iconSize: [70, 24],
        iconAnchor: [35, 12]
    });
}

function createWaterLevelPopup(gauge) {
    const date = new Date(gauge.timestamp);
    const timeStr = date.toLocaleString('de-DE');

    return `
        <div style="min-width: 200px;">
            <h4 style="margin: 0 0 8px 0; color: #2c3e50;">📊 Pegel</h4>
            <p style="margin: 0; font-weight: 600;">${gauge.name}</p>
            <p style="margin: 4px 0; font-size: 12px;"><strong>Gewässer:</strong> ${gauge.water}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #3498db;"><strong>Wasserstand:</strong> ${gauge.water_level_m} m (${gauge.water_level_cm} cm)</p>
            <p style="margin: 4px 0; font-size: 11px; color: #7f8c8d;">${timeStr}</p>
        </div>
    `;
}

function updateWaterLevelSettings(settings) {
    waterLevelSettings = settings;

    // Remove all markers
    Object.values(waterLevelGauges).forEach(({marker}) => map.removeLayer(marker));
    waterLevelGauges = {};

    // Start if enabled
    if (settings.enabled) {
        fetchWaterLevelGauges();
        // Refresh on map move/zoom
        map.on('moveend', fetchWaterLevelGauges);
        console.log('📊 Water level gauges enabled');
    } else {
        map.off('moveend', fetchWaterLevelGauges);
        console.log('📊 Water level gauges disabled');
    }
}

// ==================== TRACK VISUALIZATION ====================
let displayedTrackLayer = null;

window.showTrackOnMap = function(trackData, entry) {
    // Remove previous track if exists
    if (displayedTrackLayer) {
        map.removeLayer(displayedTrackLayer);
    }

    // Convert track data to LatLng array
    const trackPoints = trackData.map(point => [point.lat, point.lon]);

    // Create polyline for the track
    displayedTrackLayer = L.polyline(trackPoints, {
        color: '#9b59b6',  // Purple color to distinguish from live track
        weight: 4,
        opacity: 0.8,
        smoothFactor: 1
    }).addTo(map);

    // Add start marker
    if (trackPoints.length > 0) {
        const startIcon = L.divIcon({
            html: '<div style="background: #2ecc71; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">▶</div>',
            className: 'track-start-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        L.marker(trackPoints[0], { icon: startIcon }).addTo(map)
            .bindPopup(`<b>Start</b><br>${new Date(trackData[0].timestamp).toLocaleString('de-DE')}`);
    }

    // Add end marker
    if (trackPoints.length > 1) {
        const endIcon = L.divIcon({
            html: '<div style="background: #e74c3c; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">⏹</div>',
            className: 'track-end-marker',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
        L.marker(trackPoints[trackPoints.length - 1], { icon: endIcon }).addTo(map)
            .bindPopup(`<b>Ende</b><br>${new Date(trackData[trackData.length - 1].timestamp).toLocaleString('de-DE')}`);
    }

    // Zoom map to fit track bounds
    if (trackPoints.length > 0) {
        const bounds = L.latLngBounds(trackPoints);
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Add info panel with track statistics
    const oldPanel = document.getElementById('track-view-panel');
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'track-view-panel';
    panel.style.cssText = 'position: absolute; top: 20px; left: 20px; background: rgba(10, 14, 39, 0.95); backdrop-filter: blur(10px); border: 2px solid rgba(155, 89, 182, 0.6); border-radius: 12px; padding: 15px; z-index: 1001; min-width: 280px; color: white; font-size: 14px;';

    const startTime = new Date(trackData[0].timestamp);
    const endTime = new Date(trackData[trackData.length - 1].timestamp);
    const duration = Math.round((endTime - startTime) / 1000 / 60); // minutes

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #64ffda; font-size: 16px;">📍 Track-Ansicht</h3>
            <button onclick="clearDisplayedTrack()" style="background: rgba(231, 76, 60, 0.3); border: none; color: white; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">Schließen</button>
        </div>
        <div style="background: rgba(155, 89, 182, 0.15); padding: 8px; border-radius: 6px; margin-bottom: 10px; font-size: 12px; color: #bb8fce;">
            ${startTime.toLocaleDateString('de-DE')} • ${startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - ${endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div style="background: rgba(42, 82, 152, 0.2); padding: 10px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: #64ffda;">${trackData.length}</div>
                <div style="font-size: 11px; color: #8892b0;">Punkte</div>
            </div>
            <div style="background: rgba(42, 82, 152, 0.2); padding: 10px; border-radius: 8px;">
                <div style="font-size: 20px; font-weight: 700; color: #64ffda;">${entry.distance || '?'}</div>
                <div style="font-size: 11px; color: #8892b0;">Distanz (NM)</div>
            </div>
        </div>
    `;

    document.getElementById('map-container').appendChild(panel);

    console.log(`✅ Track displayed: ${trackData.length} points`);
};

window.clearDisplayedTrack = function() {
    if (displayedTrackLayer) {
        map.removeLayer(displayedTrackLayer);
        displayedTrackLayer = null;
    }

    // Remove markers (start/end)
    map.eachLayer(layer => {
        if (layer.options && layer.options.icon &&
            (layer.options.icon.options.className === 'track-start-marker' ||
             layer.options.icon.options.className === 'track-end-marker')) {
            map.removeLayer(layer);
        }
    });

    const panel = document.getElementById('track-view-panel');
    if (panel) panel.remove();

    console.log('✅ Track view cleared');
};

// ==================== UPDATE BOAT MARKER ICON ====================
function updateBoatMarkerIcon(iconType) {
    if (!boatMarker) {
        console.warn('⚠️ Boat marker not initialized yet');
        return;
    }

    if (typeof createBoatMarkerIcon !== 'function') {
        console.warn('⚠️ createBoatMarkerIcon function not available (boat_icons.js not loaded?)');
        return;
    }

    // Use current heading/rotation when updating icon
    const newIcon = createBoatMarkerIcon(iconType || 'motorboat_small', currentBoatHeading);
    boatMarker.setIcon(newIcon);
    console.log(`✅ Boat marker icon updated to: ${iconType} (rotation: ${currentBoatHeading}°)`);
}

// ==================== SERVICE WORKER (PWA) ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ Service Worker registered'))
        .catch(err => console.log('⚠️ Service Worker registration failed:', err));
}
