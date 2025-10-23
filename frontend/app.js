/**
 * BoatOS Frontend - Marine Dashboard
 */

// Debug console disabled - was causing JavaScript errors
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

// Favorites
let favorites = [];
let favoritesPanel = null;
let favoriteMarkers = L.layerGroup(); // Layer group for favorite markers
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

// Overlay layers (for layer control)
let seaMarkLayer;
let inlandLayer;  // Contains locks/schleusen
let railwayLayer;  // Contains bridges/brücken
let trafficLayer;

// AIS
let aisVessels = {};  // MMSI -> {marker, data}
let aisEnabled = false;
let aisUpdateInterval = null;
let aisSettings = { enabled: false, apiKey: '', updateInterval: 60, showLabels: true };

// Course Deviation / Cross-Track Error
let currentRouteCoordinates = null; // Array of {lat, lon} for XTE calculation
let currentRoutePolyline = null; // Reference to main route polyline for color changes
let xteWarningDisplay = null; // DOM element for XTE warning
let turnByTurnDisplay = null; // DOM element for turn-by-turn navigation instructions

// Route Segment Highlighting
let currentSegmentPolyline = null; // Highlighted current segment (yellow)
let completedSegmentsPolyline = null; // Completed segments (faded)
let remainingSegmentsPolyline = null; // Remaining segments (blue/green)
let routeProgressDisplay = null; // Progress display element
let routeArrows = []; // Direction arrows along route

// Navigation State
let navigationActive = false; // true when actively navigating (not just planning)
let navigationStartButton = null; // Button to start/pause/stop navigation

// Route calculation abort controller
let routeCalculationController = null; // AbortController to cancel pending route requests

// Route data for live ETA calculation
let currentRouteData = {
    totalDistanceNM: 0,
    plannedEtaHours: 0,
    plannedEtaMinutes: 0,
    plannedSpeed: 5
};

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

    // DO NOT call invalidateSize() here!
    // The map initializes with correct size (1920x508)
    // invalidateSize() will be called when switching from dashboard to map view
    console.log('📏 Initial map size:', map.getSize());

    // ==================== OVERLAY LAYERS ====================
    seaMarkLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 0.8,
        attribution: '© OpenSeaMap'
    });

    inlandLayer = L.tileLayer('https://tiles.openseamap.org/inland/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 0.8,
        attribution: '© OpenSeaMap Inland'
    });

    railwayLayer = L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 0.5,
        attribution: '© OpenRailwayMap'
    });

    trafficLayer = L.tileLayer('https://tiles.marinetraffic.com/ais_helpers/shiptilesingle.aspx?output=png&sat=1&grouping=shiptype&tile_size=256&legends=1&zoom={z}&X={x}&Y={y}', {
        maxZoom: 15,
        opacity: 0.7,
        attribution: '© MarineTraffic'
    });

    // Add default overlays
    seaMarkLayer.addTo(map);
    // inlandLayer now controlled by layer control (contains locks/schleusen)
    railwayLayer.addTo(map);

    // ==================== LAYER CONTROL ====================
    const overlays = {
        "⚓ Seezeichen": seaMarkLayer,
        "🔒 Schleusen & Wasserwege": inlandLayer,
        "🌉 Brücken": railwayLayer,
        "🚢 Schiffsverkehr (AIS)": trafficLayer
    };

    L.control.layers(null, overlays, {
        position: 'bottomright',
        collapsed: false  // Always visible for easy access
    }).addTo(map);

    // Zoom Control (rechts unten)
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Favorites Button
    const FavoritesControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
            container.innerHTML = `
                <a href="#" style="
                    background: rgba(10, 14, 39, 0.95);
                    backdrop-filter: blur(10px);
                    border: 2px solid #64ffda;
                    border-radius: 8px;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    text-decoration: none;
                    cursor: pointer;
                " title="Favoriten">⭐</a>
            `;
            container.onclick = (e) => {
                e.preventDefault();
                showFavoritesPanel();
            };
            return container;
        }
    });
    map.addControl(new FavoritesControl());

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

        // Update next waypoint display
        const currentSpeed = window.lastSensorData?.speed || 0;
        updateNextWaypointDisplay(newLat, newLon, currentSpeed);

        // Update turn-by-turn navigation
        updateTurnByTurnDisplay(newLat, newLon);

        // Update live ETA
        updateLiveETA();

        // Update route segment highlighting and progress
        updateRouteSegmentHighlighting(newLat, newLon);

        // Update course deviation warning (XTE)
        updateCourseDeviationWarning(newLat, newLon);

        // Update locks timeline distances (if visible)
        if (locksOnRoute.length > 0) {
            displayLocksTimeline();
        }
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
    // Cancel any pending route calculation
    if (routeCalculationController) {
        routeCalculationController.abort();
        console.log('🚫 Aborted pending route calculation');
    }

    // Create new abort controller for this request
    routeCalculationController = new AbortController();

    // Alte Route löschen
    routeLayer.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer._icon) {
            routeLayer.removeLayer(layer);
        }
    });

    if (waypoints.length < 2) {
        routeCalculationController = null;
        return;
    }

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
            body: JSON.stringify({waypoints: coordinates}),
            signal: routeCalculationController.signal
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
                currentRoutePolyline = L.polyline(routePoints, {
                    color: '#2ecc71',
                    weight: 5,
                    opacity: 0.9,
                    lineCap: 'round',
                    originalColor: '#2ecc71' // Store original color for XTE reset
                }).addTo(routeLayer);

                // Store route coordinates for XTE calculation
                currentRouteCoordinates = routePoints.map(p => ({ lat: p[0], lon: p[1] }));

                // Add route arrows for direction indication
                addRouteArrows();

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

                // Update locks timeline
                updateLocksTimeline();

                return;
            }
        }
    } catch (error) {
        // If request was aborted, silently return (user deleted waypoint or started new route)
        if (error.name === 'AbortError') {
            console.log('🚫 Route calculation aborted');
            hideRoutingLoader();
            routeCalculationController = null;
            return;
        }
        console.error('❌ ENC routing failed:', error);
    }

    // Fallback auf direkte Route
    drawDirectRoute();
    hideRoutingLoader();
    routeCalculationController = null;
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
    currentRoutePolyline = L.polyline(points, {
        color: '#3498db',
        weight: 5,
        opacity: 0.9,
        lineCap: 'round',
        lineJoin: 'round',
        originalColor: '#3498db' // Store original color for XTE reset
    }).addTo(routeLayer);

    // Store route coordinates for XTE calculation
    currentRouteCoordinates = points.map(p => ({ lat: p[0], lon: p[1] }));

    // Add route arrows for direction indication
    addRouteArrows();

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

    // Update locks timeline
    updateLocksTimeline();
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

    // Store route data for live ETA calculation
    currentRouteData = {
        totalDistanceNM: parseFloat(totalNM),
        plannedEtaHours: hours,
        plannedEtaMinutes: minutes,
        plannedSpeed: avgSpeed
    };

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
        '<div style="font-size: 12px; color: #8892b0;">Planned ETA: ' + hours + 'h ' + minutes + 'min @ ' + speedFormatted + '</div>' +
        '<div id="live-eta-display" style="font-size: 12px; color: #64ffda; margin-top: 4px; display: none;"></div>' +
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

    // Remove next waypoint display
    if (nextWaypointDisplay) {
        nextWaypointDisplay.remove();
        nextWaypointDisplay = null;
    }

    // Remove turn-by-turn display
    if (turnByTurnDisplay) {
        turnByTurnDisplay.remove();
        turnByTurnDisplay = null;
    }

    // Remove XTE warning display
    if (xteWarningDisplay) {
        xteWarningDisplay.remove();
        xteWarningDisplay = null;
    }

    // Remove route progress display
    if (routeProgressDisplay) {
        routeProgressDisplay.remove();
        routeProgressDisplay = null;
    }

    // Remove segment highlighting polylines
    if (currentSegmentPolyline) {
        currentSegmentPolyline.remove();
        currentSegmentPolyline = null;
    }
    if (completedSegmentsPolyline) {
        completedSegmentsPolyline.remove();
        completedSegmentsPolyline = null;
    }
    if (remainingSegmentsPolyline) {
        remainingSegmentsPolyline.remove();
        remainingSegmentsPolyline = null;
    }

    // Remove route arrows
    routeArrows.forEach(arrow => {
        if (arrow) {
            map.removeLayer(arrow);
        }
    });
    routeArrows = [];

    // Clear route data for XTE calculation
    currentRouteCoordinates = null;
    currentRoutePolyline = null;

    // Clear route data for live ETA
    currentRouteData = {
        totalDistanceNM: 0,
        plannedEtaHours: 0,
        plannedEtaMinutes: 0,
        plannedSpeed: 5
    };

    // Remove locks timeline
    if (locksTimelinePanel) {
        locksTimelinePanel.remove();
        locksTimelinePanel = null;
    }
    locksOnRoute = [];

    // Stop navigation when route is cleared
    stopNavigation();

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
// Initialize map as soon as DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM loaded - initializing map...');
    initMap();
    connectWebSocket();

    // Load favorites from backend
    loadFavorites();

    // Add center button to map
    centerButton.addTo(map);

    // Add GPX Import/Export buttons
    const gpxControl = L.control({ position: 'topleft' });
    gpxControl.onAdd = function() {
        const container = L.DomUtil.create('div', 'gpx-control leaflet-bar');
        container.style.cssText = 'background: white; display: flex; flex-direction: column; gap: 2px;';

        // GPX Export button
        const exportBtn = L.DomUtil.create('button', 'gpx-btn', container);
        exportBtn.innerHTML = '📥';
        exportBtn.title = 'Route als GPX exportieren';
        exportBtn.style.cssText = 'background: white; width: 30px; height: 30px; border: none; cursor: pointer; font-size: 16px; padding: 0;';
        exportBtn.onclick = function(e) {
            L.DomEvent.stopPropagation(e);
            exportRouteAsGPX();
        };

        // GPX Import button
        const importBtn = L.DomUtil.create('button', 'gpx-btn', container);
        importBtn.innerHTML = '📤';
        importBtn.title = 'GPX-Datei importieren';
        importBtn.style.cssText = 'background: white; width: 30px; height: 30px; border: none; cursor: pointer; font-size: 16px; padding: 0;';

        // Create hidden file input
        const fileInput = L.DomUtil.create('input', '', container);
        fileInput.type = 'file';
        fileInput.accept = '.gpx';
        fileInput.style.display = 'none';
        fileInput.onchange = function(e) {
            if (e.target.files && e.target.files[0]) {
                importGPXFile(e.target.files[0]);
                e.target.value = ''; // Reset for re-import
            }
        };

        importBtn.onclick = function(e) {
            L.DomEvent.stopPropagation(e);
            fileInput.click();
        };

        return container;
    };
    gpxControl.addTo(map);

    // Add Navigation Start/Stop button
    const navControl = L.control({ position: 'topleft' });
    navControl.onAdd = function() {
        const container = L.DomUtil.create('div', 'nav-control leaflet-bar');

        navigationStartButton = L.DomUtil.create('button', 'nav-btn', container);
        navigationStartButton.innerHTML = '▶️';
        navigationStartButton.title = 'Navigation starten';
        navigationStartButton.style.cssText = 'background: white; width: 30px; height: 30px; border: none; cursor: pointer; font-size: 16px; padding: 0;';
        navigationStartButton.onclick = function(e) {
            L.DomEvent.stopPropagation(e);
            toggleNavigation();
        };

        return container;
    };
    navControl.addTo(map);

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
    // Skip browser geolocation on Pi since hardware GPS is always available
    // Pi accesses via localhost or its own IP (192.168.2.217)
    const isRunningOnPi = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname === '::1' ||
                          window.location.hostname === '192.168.2.217';

    if (isRunningOnPi) {
        console.log('🔧 Running on Pi - browser geolocation disabled (using hardware GPS only)');
    }

    let firstPositionReceived = false;
    if (navigator.geolocation && !isRunningOnPi) {
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

// ==================== NEXT WAYPOINT DISPLAY ====================
let nextWaypointDisplay = null;

function updateNextWaypointDisplay(currentLat, currentLon, currentSpeed) {
    // Only show if we have waypoints
    if (!waypoints || waypoints.length === 0) {
        if (nextWaypointDisplay) {
            nextWaypointDisplay.remove();
            nextWaypointDisplay = null;
        }
        return;
    }

    // Find next waypoint (closest one ahead in route)
    let nextWaypoint = null;
    let minDistance = Infinity;
    let waypointIndex = -1;

    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const wpLatLng = wp.marker.getLatLng();
        const distance = L.latLng(currentLat, currentLon).distanceTo(wpLatLng);

        if (distance < minDistance) {
            minDistance = distance;
            nextWaypoint = wp;
            waypointIndex = i;
        }
    }

    if (!nextWaypoint) return;

    // Calculate bearing to waypoint
    const wpLatLng = nextWaypoint.marker.getLatLng();
    const bearing = calculateBearing(currentLat, currentLon, wpLatLng.lat, wpLatLng.lng);

    // Distance in meters, convert to NM or km based on settings
    const distanceMeters = minDistance;
    const distanceFormatted = typeof formatDistance === 'function'
        ? formatDistance(distanceMeters)
        : `${(distanceMeters / 1852).toFixed(2)} NM`;

    // Calculate ETA based on current speed
    let etaText = 'N/A';
    if (currentSpeed && currentSpeed > 0) {
        const distanceNM = distanceMeters / 1852;
        const etaHours = distanceNM / currentSpeed;
        const hours = Math.floor(etaHours);
        const minutes = Math.round((etaHours - hours) * 60);

        if (hours > 0) {
            etaText = `${hours}h ${minutes}min`;
        } else {
            etaText = `${minutes}min`;
        }
    }

    // Create or update display
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

    // Update content
    const waypointNumber = waypointIndex + 1;
    const totalWaypoints = waypoints.length;

    nextWaypointDisplay.innerHTML = `
        <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">
            Next Waypoint (${waypointNumber}/${totalWaypoints})
        </div>
        <div style="font-size: 24px; font-weight: 700; color: #64ffda; margin-bottom: 12px; line-height: 1.2;">
            ${nextWaypoint.name || `WP ${waypointNumber}`}
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px;">
            <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">DISTANCE</div>
                <div style="font-size: 20px; font-weight: 600; color: white;">${distanceFormatted}</div>
            </div>
            <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 10px;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">BEARING</div>
                <div style="font-size: 20px; font-weight: 600; color: white;">${Math.round(bearing)}°</div>
            </div>
        </div>
        <div style="background: rgba(100, 255, 218, 0.1); padding: 12px; border-radius: 10px; margin-top: 12px; text-align: center;">
            <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">ETA</div>
            <div style="font-size: 18px; font-weight: 600; color: #64ffda;">${etaText}</div>
        </div>
    `;
}

// ==================== TURN-BY-TURN NAVIGATION ====================

/**
 * Calculate turn direction and angle between two bearings
 */
function calculateTurnDirection(currentBearing, nextBearing) {
    // Normalize bearings to 0-360
    currentBearing = (currentBearing + 360) % 360;
    nextBearing = (nextBearing + 360) % 360;

    // Calculate smallest angle difference
    let turnAngle = nextBearing - currentBearing;
    if (turnAngle > 180) turnAngle -= 360;
    if (turnAngle < -180) turnAngle += 360;

    // Determine turn type based on angle
    let turnType, turnIcon, turnText;

    if (Math.abs(turnAngle) < 10) {
        turnType = 'straight';
        turnIcon = '⬆️';
        turnText = 'Geradeaus';
    } else if (turnAngle > 0 && turnAngle < 45) {
        turnType = 'slight-right';
        turnIcon = '↗️';
        turnText = 'Leicht rechts';
    } else if (turnAngle >= 45 && turnAngle < 135) {
        turnType = 'right';
        turnIcon = '➡️';
        turnText = 'Rechts abbiegen';
    } else if (turnAngle >= 135) {
        turnType = 'sharp-right';
        turnIcon = '↪️';
        turnText = 'Scharf rechts';
    } else if (turnAngle < 0 && turnAngle > -45) {
        turnType = 'slight-left';
        turnIcon = '↖️';
        turnText = 'Leicht links';
    } else if (turnAngle <= -45 && turnAngle > -135) {
        turnType = 'left';
        turnIcon = '⬅️';
        turnText = 'Links abbiegen';
    } else {
        turnType = 'sharp-left';
        turnIcon = '↩️';
        turnText = 'Scharf links';
    }

    return { turnType, turnIcon, turnText, turnAngle };
}

/**
 * Update turn-by-turn navigation display
 */
function updateTurnByTurnDisplay(currentLat, currentLon) {
    // Only show during active navigation
    if (!navigationActive || !waypoints || waypoints.length < 2) {
        if (turnByTurnDisplay) {
            turnByTurnDisplay.remove();
            turnByTurnDisplay = null;
        }
        return;
    }

    // Find next waypoint (closest one ahead)
    let nextWaypointIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < waypoints.length; i++) {
        const wp = waypoints[i];
        const wpLatLng = wp.marker.getLatLng();
        const distance = L.latLng(currentLat, currentLon).distanceTo(wpLatLng);

        if (distance < minDistance) {
            minDistance = distance;
            nextWaypointIndex = i;
        }
    }

    // If we're at the last waypoint, show arrival message
    if (nextWaypointIndex >= waypoints.length - 1) {
        const lastWP = waypoints[waypoints.length - 1];
        const lastWPLatLng = lastWP.marker.getLatLng();
        const distanceToLast = L.latLng(currentLat, currentLon).distanceTo(lastWPLatLng);

        const distanceFormatted = typeof formatDistance === 'function'
            ? formatDistance(distanceToLast)
            : `${(distanceToLast / 1852).toFixed(2)} NM`;

        // Show final approach
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
            <div style="font-size: 48px; margin-bottom: 10px;">🎯</div>
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

    // Calculate turn for next segment
    const currentWP = waypoints[nextWaypointIndex];
    const nextWP = waypoints[nextWaypointIndex + 1];

    const currentWPLatLng = currentWP.marker.getLatLng();
    const nextWPLatLng = nextWP.marker.getLatLng();

    // Bearing to current waypoint
    const bearingToCurrent = calculateBearing(currentLat, currentLon, currentWPLatLng.lat, currentWPLatLng.lng);

    // Bearing from current to next waypoint (the upcoming segment)
    const bearingToNext = calculateBearing(currentWPLatLng.lat, currentWPLatLng.lng, nextWPLatLng.lat, nextWPLatLng.lng);

    // Calculate turn direction
    const turn = calculateTurnDirection(bearingToCurrent, bearingToNext);

    // Distance to waypoint where turn happens
    const distanceToTurn = L.latLng(currentLat, currentLon).distanceTo(currentWPLatLng);
    const distanceFormatted = typeof formatDistance === 'function'
        ? formatDistance(distanceToTurn)
        : `${(distanceToTurn / 1852).toFixed(2)} NM`;

    // Create or update display
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

// ==================== LIVE ETA CALCULATION ====================

/**
 * Update live ETA based on current GPS speed and remaining distance
 */
function updateLiveETA() {
    // Only update if we have a route and navigation is active
    if (!navigationActive || !waypoints || waypoints.length === 0 || !currentPosition.lat || !currentPosition.lon) {
        const liveEtaDisplay = document.getElementById('live-eta-display');
        if (liveEtaDisplay) {
            liveEtaDisplay.style.display = 'none';
        }
        return;
    }

    const currentSpeed = window.lastSensorData?.speed || 0;

    // Need at least 0.5 knots to calculate meaningful ETA
    if (currentSpeed < 0.5) {
        const liveEtaDisplay = document.getElementById('live-eta-display');
        if (liveEtaDisplay) {
            liveEtaDisplay.innerHTML = 'Live ETA: Waiting for GPS speed...';
            liveEtaDisplay.style.display = 'block';
        }
        return;
    }

    // Calculate total remaining distance
    let totalRemainingDistanceMeters = 0;
    const currentLat = currentPosition.lat;
    const currentLon = currentPosition.lon;

    if (waypoints.length > 0) {
        // Distance to first waypoint
        const firstWP = waypoints[0].marker.getLatLng();
        totalRemainingDistanceMeters = L.latLng(currentLat, currentLon).distanceTo(firstWP);

        // Add distance between all remaining waypoints
        for (let i = 0; i < waypoints.length - 1; i++) {
            const wp1 = waypoints[i].marker.getLatLng();
            const wp2 = waypoints[i + 1].marker.getLatLng();
            totalRemainingDistanceMeters += wp1.distanceTo(wp2);
        }
    }

    const remainingDistanceNM = totalRemainingDistanceMeters / 1852;

    // Calculate ETA based on current GPS speed (SOG)
    const etaHours = remainingDistanceNM / currentSpeed;
    const hours = Math.floor(etaHours);
    const minutes = Math.round((etaHours - hours) * 60);

    // Format speed with units
    const speedFormatted = typeof formatSpeed === 'function'
        ? formatSpeed(currentSpeed)
        : `${currentSpeed.toFixed(1)} kn`;

    // Calculate arrival time
    const now = new Date();
    const arrivalTime = new Date(now.getTime() + etaHours * 60 * 60 * 1000);
    const arrivalTimeStr = arrivalTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    let etaText = '';
    if (hours > 0) {
        etaText = `${hours}h ${minutes}min`;
    } else {
        etaText = `${minutes}min`;
    }

    // Update display
    const liveEtaDisplay = document.getElementById('live-eta-display');
    if (liveEtaDisplay) {
        liveEtaDisplay.innerHTML = `<strong>Live ETA (GPS):</strong> ${etaText} @ ${speedFormatted} • Arrival: ${arrivalTimeStr}`;
        liveEtaDisplay.style.display = 'block';
    }
}

// ==================== ROUTE SEGMENT HIGHLIGHTING & PROGRESS ====================

/**
 * Update route segment highlighting based on current position
 */
function updateRouteSegmentHighlighting(currentLat, currentLon) {
    // Only highlight during active navigation
    if (!navigationActive || !waypoints || waypoints.length < 2 || !currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        // Clear highlighting
        if (currentSegmentPolyline) {
            currentSegmentPolyline.remove();
            currentSegmentPolyline = null;
        }
        if (completedSegmentsPolyline) {
            completedSegmentsPolyline.remove();
            completedSegmentsPolyline = null;
        }
        if (remainingSegmentsPolyline) {
            remainingSegmentsPolyline.remove();
            remainingSegmentsPolyline = null;
        }
        return;
    }

    // Find closest point on route
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

    // Get route color
    const isWaterway = currentRoutePolyline && currentRoutePolyline.options.originalColor === '#2ecc71';
    const normalColor = isWaterway ? '#2ecc71' : '#3498db';

    // Clear old polylines
    if (currentSegmentPolyline) currentSegmentPolyline.remove();
    if (completedSegmentsPolyline) completedSegmentsPolyline.remove();
    if (remainingSegmentsPolyline) remainingSegmentsPolyline.remove();

    // Draw completed segments (faded)
    if (closestSegmentIndex > 0) {
        const completedPoints = [];
        for (let i = 0; i <= closestSegmentIndex; i++) {
            completedPoints.push([currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon]);
        }
        completedSegmentsPolyline = L.polyline(completedPoints, {
            color: '#666',
            weight: 4,
            opacity: 0.3,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(routeLayer);
    }

    // Draw current segment (bright yellow/orange)
    const currentSegmentPoints = [
        [closestPoint.lat, closestPoint.lon],
        [currentRouteCoordinates[closestSegmentIndex + 1].lat, currentRouteCoordinates[closestSegmentIndex + 1].lon]
    ];
    currentSegmentPolyline = L.polyline(currentSegmentPoints, {
        color: '#ffd700', // Gold/Yellow
        weight: 6,
        opacity: 1.0,
        lineCap: 'round',
        lineJoin: 'round'
    }).addTo(routeLayer);

    // Draw remaining segments (normal color)
    if (closestSegmentIndex < currentRouteCoordinates.length - 2) {
        const remainingPoints = [];
        for (let i = closestSegmentIndex + 1; i < currentRouteCoordinates.length; i++) {
            remainingPoints.push([currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon]);
        }
        remainingSegmentsPolyline = L.polyline(remainingPoints, {
            color: normalColor,
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(routeLayer);
    }

    // Update progress display
    updateRouteProgress(closestSegmentIndex, closestPoint);
}

/**
 * Update route progress display
 */
function updateRouteProgress(segmentIndex, closestPoint) {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) return;

    // Calculate completed distance
    let completedDistance = 0;
    for (let i = 0; i < segmentIndex; i++) {
        const p1 = L.latLng(currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon);
        const p2 = L.latLng(currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon);
        completedDistance += p1.distanceTo(p2);
    }
    // Add distance from last completed segment to current position
    if (segmentIndex < currentRouteCoordinates.length - 1) {
        const p1 = L.latLng(currentRouteCoordinates[segmentIndex].lat, currentRouteCoordinates[segmentIndex].lon);
        const current = L.latLng(closestPoint.lat, closestPoint.lon);
        completedDistance += p1.distanceTo(current);
    }

    // Calculate total route distance
    let totalDistance = 0;
    for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
        const p1 = L.latLng(currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon);
        const p2 = L.latLng(currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon);
        totalDistance += p1.distanceTo(p2);
    }

    // Calculate progress percentage
    const progressPercent = totalDistance > 0 ? (completedDistance / totalDistance) * 100 : 0;
    const remainingDistance = totalDistance - completedDistance;

    // Format distances
    const remainingDistFormatted = typeof formatDistance === 'function'
        ? formatDistance(remainingDistance)
        : `${(remainingDistance / 1852).toFixed(1)} NM`;

    // Create or update progress display
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
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">ROUTE PROGRESS</div>
                <div style="font-size: 18px; font-weight: 700; color: #64ffda;">${progressPercent.toFixed(0)}%</div>
            </div>
            <div style="flex: 1; text-align: right;">
                <div style="font-size: 11px; color: #8892b0; margin-bottom: 4px;">REMAINING</div>
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

/**
 * Add direction arrows along the route
 */
function addRouteArrows() {
    // Clear existing arrows
    routeArrows.forEach(arrow => arrow.remove());
    routeArrows = [];

    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) return;

    // Calculate total route distance
    let totalDistance = 0;
    for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
        const p1 = L.latLng(currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon);
        const p2 = L.latLng(currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon);
        totalDistance += p1.distanceTo(p2);
    }

    // Arrow spacing: 1-2 NM (approximately 1852-3704 meters)
    const arrowSpacing = 2000; // 2 km
    const numArrows = Math.floor(totalDistance / arrowSpacing);

    if (numArrows < 1) return; // Route too short

    // Place arrows at intervals
    let currentDistance = arrowSpacing; // Start after first interval

    for (let arrowNum = 0; arrowNum < numArrows; arrowNum++) {
        // Find position along route at currentDistance
        let accumulatedDistance = 0;
        let arrowPlaced = false;

        for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
            const p1 = L.latLng(currentRouteCoordinates[i].lat, currentRouteCoordinates[i].lon);
            const p2 = L.latLng(currentRouteCoordinates[i + 1].lat, currentRouteCoordinates[i + 1].lon);
            const segmentDistance = p1.distanceTo(p2);

            if (accumulatedDistance + segmentDistance >= currentDistance) {
                // Arrow position is in this segment
                const distanceIntoSegment = currentDistance - accumulatedDistance;
                const fraction = distanceIntoSegment / segmentDistance;

                // Interpolate position
                const arrowLat = currentRouteCoordinates[i].lat +
                    (currentRouteCoordinates[i + 1].lat - currentRouteCoordinates[i].lat) * fraction;
                const arrowLon = currentRouteCoordinates[i].lon +
                    (currentRouteCoordinates[i + 1].lon - currentRouteCoordinates[i].lon) * fraction;

                // Calculate bearing for arrow rotation
                const bearing = calculateBearing(
                    currentRouteCoordinates[i].lat,
                    currentRouteCoordinates[i].lon,
                    currentRouteCoordinates[i + 1].lat,
                    currentRouteCoordinates[i + 1].lon
                );

                // Create arrow marker
                const arrowIcon = L.divIcon({
                    html: `<div style="
                        transform: rotate(${bearing}deg);
                        font-size: 20px;
                        text-shadow: 0 0 3px rgba(0,0,0,0.8);
                    ">⬆️</div>`,
                    className: 'route-arrow-icon',
                    iconSize: [24, 24],
                    iconAnchor: [12, 12]
                });

                const arrowMarker = L.marker([arrowLat, arrowLon], {
                    icon: arrowIcon,
                    interactive: false // Not clickable
                }).addTo(routeLayer);

                routeArrows.push(arrowMarker);
                arrowPlaced = true;
                break;
            }

            accumulatedDistance += segmentDistance;
        }

        if (!arrowPlaced) break;
        currentDistance += arrowSpacing;
    }
}

// ==================== CROSS-TRACK ERROR & COURSE DEVIATION ====================

/**
 * Calculate the shortest distance from a point to a line segment
 * Returns: {distance: meters, side: 'port'|'starboard', nearestPoint: {lat, lon}}
 */
function pointToLineSegmentDistance(pointLat, pointLon, lineLat1, lineLon1, lineLat2, lineLon2) {
    // Convert to Leaflet LatLng for distance calculations
    const point = L.latLng(pointLat, pointLon);
    const lineStart = L.latLng(lineLat1, lineLon1);
    const lineEnd = L.latLng(lineLat2, lineLon2);

    // Vector from line start to point
    const pointVec = {
        lat: point.lat - lineStart.lat,
        lng: point.lng - lineStart.lng
    };

    // Vector from line start to line end
    const lineVec = {
        lat: lineEnd.lat - lineStart.lat,
        lng: lineEnd.lng - lineStart.lng
    };

    // Project point onto line (dot product)
    const lineLengthSquared = lineVec.lat * lineVec.lat + lineVec.lng * lineVec.lng;

    if (lineLengthSquared === 0) {
        // Line segment is actually a point
        return {
            distance: point.distanceTo(lineStart),
            side: 'unknown',
            nearestPoint: { lat: lineStart.lat, lon: lineStart.lng }
        };
    }

    // Parameter t represents position along line (0 = start, 1 = end)
    let t = (pointVec.lat * lineVec.lat + pointVec.lng * lineVec.lng) / lineLengthSquared;
    t = Math.max(0, Math.min(1, t)); // Clamp to [0, 1]

    // Nearest point on line segment
    const nearestLat = lineStart.lat + t * lineVec.lat;
    const nearestLng = lineStart.lng + t * lineVec.lng;
    const nearest = L.latLng(nearestLat, nearestLng);

    // Distance from point to nearest point on line
    const distance = point.distanceTo(nearest);

    // Determine which side (port/starboard) using cross product
    // Positive = starboard (right), Negative = port (left)
    const crossProduct = lineVec.lng * pointVec.lat - lineVec.lat * pointVec.lng;
    const side = crossProduct > 0 ? 'starboard' : 'port';

    return {
        distance: distance,
        side: side,
        nearestPoint: { lat: nearestLat, lon: nearestLng }
    };
}

/**
 * Calculate Cross-Track Error (XTE) - distance from boat to route
 */
function calculateCrossTrackError(boatLat, boatLon) {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        return null;
    }

    // Find closest segment in route
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
 * Update course deviation warning display
 */
function updateCourseDeviationWarning(boatLat, boatLon) {
    // Only show XTE warning when navigation is actively started
    if (!navigationActive) {
        // Remove warning if navigation is not active
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }
        // Reset route color
        if (currentRoutePolyline) {
            const isWaterway = currentRoutePolyline.options.originalColor === '#2ecc71';
            const normalColor = isWaterway ? '#2ecc71' : '#3498db';
            currentRoutePolyline.setStyle({ color: normalColor, weight: 5 });
        }
        return;
    }

    const xte = calculateCrossTrackError(boatLat, boatLon);

    if (!xte) {
        // No active route - remove warning if exists
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }

        // Reset route color to normal
        if (currentRoutePolyline) {
            currentRoutePolyline.setStyle({ color: '#3498db', weight: 5 });
        }
        return;
    }

    const WARN_THRESHOLD = 100; // meters - show warning
    const CRITICAL_THRESHOLD = 500; // meters - critical warning

    if (xte.distance > WARN_THRESHOLD) {
        // Show deviation warning

        // Change route color to indicate deviation
        if (currentRoutePolyline) {
            if (xte.distance > CRITICAL_THRESHOLD) {
                currentRoutePolyline.setStyle({ color: '#e74c3c', weight: 6 }); // Red for critical
            } else {
                currentRoutePolyline.setStyle({ color: '#f39c12', weight: 5.5 }); // Orange for warning
            }
        }

        // Format distance
        const distanceFormatted = xte.distance < 1000
            ? `${Math.round(xte.distance)} m`
            : `${(xte.distance / 1000).toFixed(2)} km`;

        // Side indicator
        const sideText = xte.side === 'port' ? 'Backbord ←' : 'Steuerbord →';
        const sideColor = xte.side === 'port' ? '#e74c3c' : '#27ae60';

        // Warning level
        const isCritical = xte.distance > CRITICAL_THRESHOLD;
        const warningIcon = isCritical ? '⚠️' : '⚡';
        const warningText = isCritical ? 'KRITISCHE ABWEICHUNG' : 'Kursabweichung';
        const bgColor = isCritical ? 'rgba(231, 76, 60, 0.95)' : 'rgba(243, 156, 18, 0.95)';

        // Create or update display
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

            // Add pulse animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes pulse {
                    0%, 100% { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); }
                    50% { box-shadow: 0 8px 32px rgba(255, 255, 255, 0.3), 0 0 20px rgba(255, 255, 255, 0.2); }
                }
            `;
            document.head.appendChild(style);
        }

        // Update background color based on severity
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
        // Within acceptable range - remove warning
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }

        // Reset route color
        if (currentRoutePolyline) {
            // Determine original color based on route type
            const isWaterway = currentRoutePolyline.options.originalColor === '#2ecc71';
            const normalColor = isWaterway ? '#2ecc71' : '#3498db';
            currentRoutePolyline.setStyle({ color: normalColor, weight: 5 });
        }
    }
}

// ==================== NAVIGATION CONTROL ====================

/**
 * Toggle navigation state (Start/Pause/Stop)
 */
function toggleNavigation() {
    if (!waypoints || waypoints.length < 2) {
        showNotification('⚠️ Erstelle zuerst eine Route mit mindestens 2 Wegpunkten', 'warning');
        return;
    }

    navigationActive = !navigationActive;

    if (navigationActive) {
        // Start navigation
        navigationStartButton.innerHTML = '⏸️';
        navigationStartButton.title = 'Navigation pausieren';
        navigationStartButton.style.background = '#27ae60'; // Green
        showNotification('🧭 Navigation gestartet', 'success');
        console.log('🧭 Navigation STARTED');

        // Force update displays
        if (currentPosition.lat && currentPosition.lon) {
            const currentSpeed = window.lastSensorData?.speed || 0;
            updateNextWaypointDisplay(currentPosition.lat, currentPosition.lon, currentSpeed);
            updateTurnByTurnDisplay(currentPosition.lat, currentPosition.lon);
            updateLiveETA();
            updateRouteSegmentHighlighting(currentPosition.lat, currentPosition.lon);
            updateCourseDeviationWarning(currentPosition.lat, currentPosition.lon);
        }
    } else {
        // Pause navigation
        navigationStartButton.innerHTML = '▶️';
        navigationStartButton.title = 'Navigation starten';
        navigationStartButton.style.background = 'white';
        showNotification('⏸️ Navigation pausiert', 'info');
        console.log('⏸️ Navigation PAUSED');

        // Clear XTE warning when paused
        if (xteWarningDisplay) {
            xteWarningDisplay.remove();
            xteWarningDisplay = null;
        }

        // Clear turn-by-turn display when paused
        if (turnByTurnDisplay) {
            turnByTurnDisplay.remove();
            turnByTurnDisplay = null;
        }

        // Reset route color
        if (currentRoutePolyline) {
            const isWaterway = currentRoutePolyline.options.originalColor === '#2ecc71';
            const normalColor = isWaterway ? '#2ecc71' : '#3498db';
            currentRoutePolyline.setStyle({ color: normalColor, weight: 5 });
        }
    }
}

/**
 * Stop navigation completely (called when route is cleared)
 */
function stopNavigation() {
    if (navigationActive) {
        navigationActive = false;
        if (navigationStartButton) {
            navigationStartButton.innerHTML = '▶️';
            navigationStartButton.title = 'Navigation starten';
            navigationStartButton.style.background = 'white';
        }
        showNotification('🛑 Navigation beendet', 'info');
        console.log('🛑 Navigation STOPPED');
    }
}

// ==================== FAVORITES ====================

/**
 * Load favorites from backend
 */
async function loadFavorites() {
    try {
        const response = await fetch(`${API_URL}/api/favorites`);
        if (response.ok) {
            const data = await response.json();
            favorites = data.favorites || [];
            updateFavoritesMarkers();
            console.log(`📍 Loaded ${favorites.length} favorites`);
        }
    } catch (error) {
        console.error('❌ Error loading favorites:', error);
    }
}

/**
 * Save a new favorite
 */
async function saveFavorite(name, lat, lon, category, notes = '') {
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
                updateFavoritesMarkers();
                showNotification(`⭐ Favorit gespeichert: ${name}`, 'success');
                return true;
            }
        }
        showNotification('❌ Fehler beim Speichern des Favoriten', 'error');
        return false;
    } catch (error) {
        console.error('❌ Error saving favorite:', error);
        showNotification('❌ Fehler beim Speichern des Favoriten', 'error');
        return false;
    }
}

/**
 * Delete a favorite
 */
async function deleteFavorite(favoriteId) {
    try {
        const response = await fetch(`${API_URL}/api/favorites/${favoriteId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            favorites = favorites.filter(f => f.id !== favoriteId);
            updateFavoritesMarkers();
            showNotification('🗑️ Favorit gelöscht', 'info');
            return true;
        }
        return false;
    } catch (error) {
        console.error('❌ Error deleting favorite:', error);
        return false;
    }
}

/**
 * Update favorite markers on map
 */
function updateFavoritesMarkers() {
    // Clear existing markers
    favoriteMarkers.clearLayers();

    // Add markers for each favorite
    favorites.forEach(fav => {
        // Get category icon
        const categoryIcons = {
            'marina': '⚓',
            'anchorage': '🔱',
            'fuel': '⛽',
            'lock': '🚧',
            'bridge': '🌉',
            'restaurant': '🍽️',
            'shop': '🏪',
            'other': '📍'
        };

        const icon = categoryIcons[fav.category] || '📍';

        const marker = L.marker([fav.lat, fav.lon], {
            icon: L.divIcon({
                html: `<div style="font-size: 24px;">${icon}</div>`,
                className: 'favorite-marker',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            })
        });

        const popupContent = `
            <div style="min-width: 200px;">
                <h3 style="margin: 0 0 8px 0; color: #64ffda;">${icon} ${fav.name}</h3>
                <div style="font-size: 12px; color: #8892b0; margin-bottom: 8px;">
                    ${fav.lat.toFixed(5)}, ${fav.lon.toFixed(5)}
                </div>
                ${fav.notes ? `<div style="font-size: 12px; margin-bottom: 8px;">${fav.notes}</div>` : ''}
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button onclick="addFavoriteAsWaypoint('${fav.id}')" style="flex: 1; background: #27ae60; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        Als Waypoint
                    </button>
                    <button onclick="deleteFavorite('${fav.id}')" style="flex: 1; background: #e74c3c; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                        Löschen
                    </button>
                </div>
            </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(favoriteMarkers);
    });

    // Add layer to map if not already added
    if (map && !map.hasLayer(favoriteMarkers)) {
        favoriteMarkers.addTo(map);
    }
}

/**
 * Add favorite as waypoint
 */
function addFavoriteAsWaypoint(favoriteId) {
    const fav = favorites.find(f => f.id === favoriteId);
    if (fav) {
        addWaypoint({ lat: fav.lat, lon: fav.lon, name: fav.name });
        showNotification(`📍 Waypoint hinzugefügt: ${fav.name}`, 'success');
    }
}

/**
 * Show favorites panel
 */
function showFavoritesPanel() {
    // Close if already open
    if (favoritesPanel) {
        favoritesPanel.remove();
        favoritesPanel = null;
        return;
    }

    favoritesPanel = document.createElement('div');
    favoritesPanel.id = 'favorites-panel';
    favoritesPanel.style.cssText = `
        position: absolute;
        top: 20px;
        right: 380px;
        background: rgba(10, 14, 39, 0.95);
        backdrop-filter: blur(10px);
        border: 2px solid #64ffda;
        border-radius: 12px;
        padding: 20px;
        z-index: 1004;
        min-width: 320px;
        max-width: 400px;
        max-height: 70vh;
        overflow-y: auto;
        color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;

    let html = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; color: #64ffda; font-size: 18px;">⭐ Favoriten</h3>
            <button onclick="closeFavoritesPanel()" style="background: rgba(231, 76, 60, 0.3); border: none; color: white; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px;">
                ✕
            </button>
        </div>
        <button onclick="saveCurrentLocationAsFavorite()" style="width: 100%; background: #27ae60; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600; margin-bottom: 16px;">
            ➕ Aktuelle Position speichern
        </button>
        <div style="max-height: 50vh; overflow-y: auto;">
    `;

    if (favorites.length === 0) {
        html += `
            <div style="text-align: center; padding: 20px; color: #8892b0;">
                <div style="font-size: 48px; margin-bottom: 12px;">📍</div>
                <div>Keine Favoriten vorhanden</div>
                <div style="font-size: 12px; margin-top: 8px;">Speichere Orte für schnellen Zugriff</div>
            </div>
        `;
    } else {
        // Group by category
        const categoryIcons = {
            'marina': '⚓',
            'anchorage': '🔱',
            'fuel': '⛽',
            'lock': '🚧',
            'bridge': '🌉',
            'restaurant': '🍽️',
            'shop': '🏪',
            'other': '📍'
        };

        favorites.forEach(fav => {
            const icon = categoryIcons[fav.category] || '📍';
            html += `
                <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                        <div>
                            <div style="font-size: 16px; font-weight: 600; color: #64ffda; margin-bottom: 4px;">
                                ${icon} ${fav.name}
                            </div>
                            <div style="font-size: 11px; color: #8892b0;">
                                ${fav.lat.toFixed(5)}, ${fav.lon.toFixed(5)}
                            </div>
                        </div>
                    </div>
                    ${fav.notes ? `<div style="font-size: 12px; color: #ccc; margin-bottom: 8px;">${fav.notes}</div>` : ''}
                    <div style="display: flex; gap: 8px;">
                        <button onclick="addFavoriteAsWaypoint('${fav.id}')" style="flex: 1; background: #27ae60; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">
                            📍 Als Waypoint
                        </button>
                        <button onclick="panToFavorite('${fav.id}')" style="flex: 1; background: #3498db; color: white; border: none; padding: 8px; border-radius: 6px; cursor: pointer; font-size: 11px;">
                            🗺️ Anzeigen
                        </button>
                        <button onclick="deleteFavorite('${fav.id}'); updateFavoritesPanel();" style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 11px;">
                            🗑️
                        </button>
                    </div>
                </div>
            `;
        });
    }

    html += '</div>';
    favoritesPanel.innerHTML = html;
    document.getElementById('map-container').appendChild(favoritesPanel);
}

function closeFavoritesPanel() {
    if (favoritesPanel) {
        favoritesPanel.remove();
        favoritesPanel = null;
    }
}

function updateFavoritesPanel() {
    if (favoritesPanel) {
        closeFavoritesPanel();
        showFavoritesPanel();
    }
}

/**
 * Pan map to favorite location
 */
function panToFavorite(favoriteId) {
    const fav = favorites.find(f => f.id === favoriteId);
    if (fav && map) {
        map.setView([fav.lat, fav.lon], 14);
        showNotification(`🗺️ Karte zentriert auf: ${fav.name}`, 'info');
    }
}

/**
 * Save current location as favorite
 */
async function saveCurrentLocationAsFavorite() {
    const lat = currentPosition.lat;
    const lon = currentPosition.lon;

    // Prompt for name
    const name = prompt('Name des Favoriten:', '');
    if (!name) return;

    // Prompt for category
    const categories = [
        'marina (⚓)',
        'anchorage (🔱)',
        'fuel (⛽)',
        'lock (🚧)',
        'bridge (🌉)',
        'restaurant (🍽️)',
        'shop (🏪)',
        'other (📍)'
    ];
    const categoryChoice = prompt('Kategorie:\n' + categories.map((c, i) => `${i + 1}. ${c}`).join('\n'), '1');
    const categoryIndex = parseInt(categoryChoice) - 1;
    const category = ['marina', 'anchorage', 'fuel', 'lock', 'bridge', 'restaurant', 'shop', 'other'][categoryIndex] || 'other';

    // Optional notes
    const notes = prompt('Notizen (optional):', '');

    const success = await saveFavorite(name, lat, lon, category, notes);
    if (success) {
        updateFavoritesPanel();
    }
}

// ==================== LOCKS TIMELINE ====================

let locksTimelinePanel = null;
let locksOnRoute = [];

/**
 * Update locks timeline with locks along the route
 */
async function updateLocksTimeline() {
    if (!currentRouteCoordinates || currentRouteCoordinates.length < 2) {
        // No route - hide timeline
        if (locksTimelinePanel) {
            locksTimelinePanel.remove();
            locksTimelinePanel = null;
        }
        locksOnRoute = [];
        return;
    }

    try {
        // Calculate bounding box of route
        const lats = currentRouteCoordinates.map(p => p.lat);
        const lons = currentRouteCoordinates.map(p => p.lon);
        const lat_min = Math.min(...lats);
        const lat_max = Math.max(...lats);
        const lon_min = Math.min(...lons);
        const lon_max = Math.max(...lons);

        // Fetch locks in bounding box
        const response = await fetch(`${API_URL}/api/locks/bounds?lat_min=${lat_min}&lon_min=${lon_min}&lat_max=${lat_max}&lon_max=${lon_max}`);
        if (!response.ok) {
            console.warn('Failed to fetch locks:', response.statusText);
            return;
        }

        const locks = await response.json();
        console.log(`🔒 Found ${locks.length} locks in route bounds`);

        // Filter locks that are actually near the route (within 2km)
        locksOnRoute = locks.filter(lock => {
            const lockLatLon = { lat: lock.lat, lon: lock.lon };
            // Check if lock is within 2km of any route segment
            for (let i = 0; i < currentRouteCoordinates.length - 1; i++) {
                const seg1 = currentRouteCoordinates[i];
                const seg2 = currentRouteCoordinates[i + 1];
                const result = pointToLineSegmentDistance(
                    lockLatLon.lat, lockLatLon.lon,
                    seg1.lat, seg1.lon,
                    seg2.lat, seg2.lon
                );
                if (result.distance < 2000) { // 2km threshold
                    return true;
                }
            }
            return false;
        });

        console.log(`🔒 ${locksOnRoute.length} locks are on or near route`);

        // Sort locks by distance from start of route
        const routeStart = currentRouteCoordinates[0];
        locksOnRoute.forEach(lock => {
            const lockLatLng = L.latLng(lock.lat, lock.lon);
            const startLatLng = L.latLng(routeStart.lat, routeStart.lon);
            lock._distanceFromStart = startLatLng.distanceTo(lockLatLng);
        });
        locksOnRoute.sort((a, b) => a._distanceFromStart - b._distanceFromStart);

        // Display locks timeline
        displayLocksTimeline();

    } catch (error) {
        console.error('Error updating locks timeline:', error);
    }
}

/**
 * Display locks timeline panel
 */
function displayLocksTimeline() {
    if (locksOnRoute.length === 0) {
        if (locksTimelinePanel) {
            locksTimelinePanel.remove();
            locksTimelinePanel = null;
        }
        return;
    }

    // Create or update panel
    if (!locksTimelinePanel) {
        locksTimelinePanel = document.createElement('div');
        locksTimelinePanel.id = 'locks-timeline-panel';
        locksTimelinePanel.style.cssText = `
            position: absolute;
            bottom: 80px;
            left: 20px;
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

    // Calculate current position distances
    const currentLat = currentPosition.lat;
    const currentLon = currentPosition.lon;
    const currentSpeed = window.lastSensorData?.speed || 5; // knots

    let html = `
        <div style="font-size: 13px; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; font-weight: 700;">
            🔒 Schleusen auf Route (${locksOnRoute.length})
        </div>
    `;

    locksOnRoute.forEach((lock, index) => {
        const lockLatLng = L.latLng(lock.lat, lock.lon);
        const currentLatLng = L.latLng(currentLat, currentLon);
        const distanceMeters = currentLatLng.distanceTo(lockLatLng);
        const distanceNM = distanceMeters / 1852;

        // Calculate ETA
        let etaText = 'N/A';
        if (currentSpeed > 0) {
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

        // Lock name
        const lockName = lock.name || `Schleuse ${index + 1}`;

        // Status indicator (green if passed, yellow if upcoming)
        const isPassed = distanceMeters < 100; // Consider passed if within 100m behind
        const statusColor = isPassed ? '#2ecc71' : '#f39c12';
        const statusIcon = isPassed ? '✓' : '→';

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
            </div>
        `;
    });

    locksTimelinePanel.innerHTML = html;
}

// ==================== GPX IMPORT/EXPORT ====================

/**
 * Export current waypoints as GPX file
 */
function exportRouteAsGPX() {
    if (!waypoints || waypoints.length === 0) {
        showNotification('⚠️ Keine Wegpunkte zum Exportieren', 'warning');
        return;
    }

    // Generate GPX XML
    const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="BoatOS Marine Navigation"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>BoatOS Route</name>
    <desc>Exported from BoatOS Marine Navigation System</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
`;

    let gpxWaypoints = '';
    let gpxRoutePoints = '  <rte>\n    <name>BoatOS Route</name>\n';

    waypoints.forEach((wp, index) => {
        const latlng = wp.marker.getLatLng();
        const name = wp.name || `WP${index + 1}`;

        // Add as waypoint (for Garmin/Navionics compatibility)
        gpxWaypoints += `  <wpt lat="${latlng.lat.toFixed(7)}" lon="${latlng.lng.toFixed(7)}">
    <name>${escapeXML(name)}</name>
    <sym>Waypoint</sym>
  </wpt>
`;

        // Add as route point
        gpxRoutePoints += `    <rtept lat="${latlng.lat.toFixed(7)}" lon="${latlng.lng.toFixed(7)}">
      <name>${escapeXML(name)}</name>
    </rtept>
`;
    });

    gpxRoutePoints += '  </rte>\n';

    const gpxFooter = '</gpx>';

    const gpxContent = gpxHeader + gpxWaypoints + gpxRoutePoints + gpxFooter;

    // Trigger download
    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boatos-route-${new Date().toISOString().split('T')[0]}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification(`📥 Route als GPX exportiert (${waypoints.length} Wegpunkte)`, 'success');
}

/**
 * Import waypoints from GPX file
 */
function importGPXFile(file) {
    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const gpxContent = e.target.result;
            const parser = new DOMParser();
            const gpxDoc = parser.parseFromString(gpxContent, 'text/xml');

            // Check for parsing errors
            const parserError = gpxDoc.querySelector('parsererror');
            if (parserError) {
                throw new Error('Ungültiges GPX-Format');
            }

            // Extract waypoints (try <wpt> first, then <rtept>)
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

            // Clear existing route
            clearRoute();

            // Add waypoints from GPX
            let importedCount = 0;
            wptElements.forEach((wpt, index) => {
                const lat = parseFloat(wpt.getAttribute('lat'));
                const lon = parseFloat(wpt.getAttribute('lon'));

                if (isNaN(lat) || isNaN(lon)) return;

                const nameEl = wpt.querySelector('name');
                const name = nameEl ? nameEl.textContent : `WP${index + 1}`;

                // Add waypoint to map
                const marker = L.marker([lat, lon], {
                    draggable: true,
                    icon: L.divIcon({
                        className: 'waypoint-marker',
                        html: `<div style="background: #e74c3c; color: white; padding: 6px 12px; border-radius: 8px; font-weight: 600; font-size: 13px; white-space: nowrap; box-shadow: 0 4px 8px rgba(0,0,0,0.3); border: 2px solid white;">${escapeHTML(name)}</div>`,
                        iconSize: [90, 35],
                        iconAnchor: [45, 18]
                    })
                }).addTo(map);

                // Add event listeners
                marker.on('dragend', updateRoute);
                marker.on('click', function() {
                    if (confirm(`Wegpunkt "${name}" löschen?`)) {
                        map.removeLayer(marker);
                        const wpIndex = waypoints.findIndex(w => w.marker === marker);
                        if (wpIndex > -1) {
                            waypoints.splice(wpIndex, 1);
                        }
                        updateRoute();
                    }
                });

                waypoints.push({ marker: marker, name: name });
                importedCount++;
            });

            // Update route
            if (waypoints.length >= 2) {
                updateRoute();
            }

            // Zoom to fit all waypoints
            if (waypoints.length > 0) {
                const bounds = L.latLngBounds(waypoints.map(w => w.marker.getLatLng()));
                map.fitBounds(bounds, { padding: [50, 50] });
            }

            showNotification(`📤 GPX importiert: ${importedCount} Wegpunkte`, 'success');

        } catch (error) {
            console.error('GPX Import Error:', error);
            showNotification(`❌ GPX-Import fehlgeschlagen: ${error.message}`, 'error');
        }
    };

    reader.onerror = function() {
        showNotification('❌ Fehler beim Lesen der GPX-Datei', 'error');
    };

    reader.readAsText(file);
}

/**
 * Helper function to escape XML special characters
 */
function escapeXML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

/**
 * Helper function to escape HTML special characters
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ==================== SERVICE WORKER (PWA) ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ Service Worker registered'))
        .catch(err => console.log('⚠️ Service Worker registration failed:', err));
}
