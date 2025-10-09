/**
 * BoatOS Frontend - Marine Dashboard
 */

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

// ==================== MAP INIT ====================
function initMap() {
    // Karte initialisieren
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView([currentPosition.lat, currentPosition.lon], 13);

    // Base Map (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
    }).addTo(map);

    // OpenSeaMap Tiles (nautical markers for coastal areas)
    L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        maxZoom: 18,
        opacity: 0.8
    }).addTo(map);

    // OpenRailwayMap - shows bridges
    L.tileLayer('https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', {
        maxZoom: 19,
        opacity: 0.5
    }).addTo(map);

    // Zoom Control (rechts unten)
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // Boot-Position Marker
    boatMarker = L.marker([currentPosition.lat, currentPosition.lon], {
        icon: L.divIcon({
            html: '⛵',
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
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    if (settings.showTrackHistory === false) {
        map.removeLayer(trackHistoryLayer);
    }

    // Click Handler für Wegpunkte
    map.on('click', onMapClick);

    // Disable auto-follow when user drags map
    map.on('dragstart', () => {
        autoFollow = false;
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
        
        // Mark GPS source as backend if we receive valid GPS data
        if (data.gps && data.gps.lat !== 0 && data.gps.lon !== 0) {
            gpsSource = "backend";
            updateBoatPosition(data.gps);
            updateGpsSourceIndicator();
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
        document.getElementById('speed').innerHTML =
            `${data.speed.toFixed(1)}<span class="tile-unit">kn</span>`;
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
        document.getElementById('depth').innerHTML =
            `${data.depth.toFixed(1)}<span class="tile-unit">m</span>`;
    }

    // Wind
    if (data.wind && data.wind.speed !== undefined) {
        document.getElementById('wind').innerHTML =
            `${data.wind.speed.toFixed(0)}<span class="tile-unit">kn</span>`;
    }

    // GPS Info (satellites, altitude)
    if (data.gps) {
        updateGpsInfo(data.gps);
    }
}

function updateGpsInfo(gps) {
    // Satellites indicator
    if (gps.satellites !== undefined) {
        const gpsStatus = document.getElementById('gps-status');
        const satCount = gps.satellites;

        if (satCount >= 4) {
            gpsStatus.classList.add('connected');
            gpsStatus.title = `GPS: ${satCount} Satelliten`;
        } else {
            gpsStatus.classList.remove('connected');
            gpsStatus.title = `GPS: ${satCount} Satelliten (kein Fix)`;
        }
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
            document.getElementById('gps-position').textContent =
                `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)}`;
        }

        // Speed
        const speedEl = document.getElementById('gps-speed');
        if (speedEl && gps.speed !== undefined) {
            speedEl.textContent = `${gps.speed.toFixed(1)} kn`;
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
        if (hdopEl && gps.hdop !== undefined) {
            hdopEl.textContent = gps.hdop.toFixed(2);
            // Color code: <2 excellent, 2-5 good, 5-10 moderate, >10 poor
            if (gps.hdop < 2) hdopEl.style.color = '#2ecc71';
            else if (gps.hdop < 5) hdopEl.style.color = '#f39c12';
            else if (gps.hdop < 10) hdopEl.style.color = '#e67e22';
            else hdopEl.style.color = '#e74c3c';
        }

        // VDOP (Vertical Dilution of Precision)
        const vdopEl = document.getElementById('gps-vdop');
        if (vdopEl && gps.vdop !== undefined) {
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

function toggleGpsPanel() {
    const panel = document.getElementById('gps-panel');
    const weatherPanel = document.getElementById('weather-panel');

    // Close weather panel if open
    if (weatherPanel && weatherPanel.style.display === 'block') {
        weatherPanel.style.display = 'none';
    }

    if (panel.style.display === 'none' || !panel.style.display) {
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
        if (gps.course !== undefined && gps.course !== 0) {
            const markerElement = boatMarker.getElement();
            if (markerElement) {
                markerElement.style.transform = `rotate(${gps.course}deg)`;
            }
            // Update compass rose with heading
            updateCompassRose(gps.course);
        } else if (gps.heading !== undefined) {
            // Use heading if course not available
            updateCompassRose(gps.heading);
        }

        // GPS Status
        document.getElementById('gps-status').classList.add('connected');

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
    // Marker auf Karte
    const marker = L.marker([waypoint.lat, waypoint.lon], {
        icon: L.divIcon({
            html: '⛵',
            className: 'waypoint-marker',
            html: `<div style="color: white; font-size: 10px; text-align: center; margin-top: 22px;">${waypoint.name}</div>`,
            iconSize: [20, 20]
        }),
        draggable: true
    }).addTo(routeLayer);

    marker.on('drag', () => {
        updateRoute();
    });

    marker.on('click', () => {
        if (confirm(`Wegpunkt ${waypoint.name} löschen?`)) {
            routeLayer.removeLayer(marker);
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

            if (routeData.error) {
                console.warn('⚠️ Routing error:', routeData.error);
                drawDirectRoute();
                return;
            }

            // Route aus ENC-Daten zeichnen
            if (routeData.geometry && routeData.geometry.coordinates) {
                const coords = routeData.geometry.coordinates;
                const routePoints = coords.map(c => [c[1], c[0]]); // [lat, lon] für Leaflet

                // Prüfe ob es echtes Routing ist oder nur Fallback
                const isWaterwayRouted = routeData.properties?.waterway_routed || false;
                const routingType = routeData.properties?.routing_type || 'waterway';

                if (routingType === 'direct' || !isWaterwayRouted) {
                    console.log('📍 Using direct routing (ENC routing not available)');
                    drawDirectRoute();
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
                const avgSpeed = 5;
                const etaHours = distanceNM / avgSpeed;
                const etaHoursInt = Math.floor(etaHours);
                const etaMinutes = Math.round((etaHours - etaHoursInt) * 60);

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
                showRouteInfo(distanceNM.toFixed(2), etaHoursInt, etaMinutes, routeInfo, false, true);
                return;
            }
        }
    } catch (error) {
        console.error('❌ ENC routing failed:', error);
    }

    // Fallback auf direkte Route
    drawDirectRoute();
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

        L.marker([midLat, midLng], {
            icon: L.divIcon({
                className: 'route-label',
                html: '<div style="background: rgba(52, 152, 219, 0.95); color: white; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 3px 6px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.3);">' +
                    (segmentDistance / 1852).toFixed(2) + ' NM<br>' +
                    Math.round(bearing) + '°' +
                    '</div>',
                iconSize: [90, 35],
                iconAnchor: [45, 18]
            })
        }).addTo(routeLayer);
    }

    const totalNM = (totalDistance / 1852).toFixed(2);
    const avgSpeed = 5;
    const etaHours = totalNM / avgSpeed;
    const etaHoursInt = Math.floor(etaHours);
    const etaMinutes = Math.round((etaHours - etaHoursInt) * 60);

    console.log(`📏 Rhumbline Route: ${totalNM} NM`);
    showRouteInfo(totalNM, etaHoursInt, etaMinutes, routeInfo, false, false);
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

function showRouteInfo(totalNM, hours, minutes, segments, isDirect, isWaterway) {
    const oldPanel = document.getElementById('route-info-panel');
    if (oldPanel) oldPanel.remove();

    const routeType = isWaterway ? 'waterway' : 'rhumbline';
    const routeColor = isWaterway ? 'rgba(46, 204, 113, 0.6)' : 'rgba(52, 152, 219, 0.6)';
    const routeIcon = isWaterway ? '🌊' : '🧭';
    const routeTitle = isWaterway ? 'Route (Wasserwege)' : 'Route (Rhumbline)';
    const routeDesc = isWaterway ? '✓ Route folgt Wasserwegen aus ENC-Karten' : 'ℹ️ Direkte Kurslinien zwischen Wegpunkten';

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
        '<div style="font-size: 24px; font-weight: 700; color: #64ffda;">' + totalNM + ' NM</div>' +
        '<div style="font-size: 12px; color: #8892b0;">ETA: ' + hours + 'h ' + minutes + 'min @ 5kn</div>' +
        '</div>' +
        '<div style="max-height: 200px; overflow-y: auto;">' +
        segments.map(s =>
            '<div style="background: rgba(42, 82, 152, 0.15); padding: 8px; border-radius: 6px; margin-bottom: 5px; font-size: 12px;">' +
            '<div style="color: #64ffda; font-weight: 600;">' + s.from + ' → ' + s.to + '</div>' +
            '<div style="color: #8892b0; margin-top: 3px;">' + s.distance + ' NM • ' + s.bearing + '°</div>' +
            '</div>'
        ).join('') +
        '</div>';

    document.getElementById('map-container').appendChild(panel);
}

function clearRoute() {
    waypoints.forEach(w => {
        if (w.marker) {
            routeLayer.removeLayer(w.marker);
        }
    });
    waypoints = [];
    routeLayer.clearLayers();

    const panel = document.getElementById('route-info-panel');
    if (panel) panel.remove();

    showNotification('🗑️ Route gelöscht');
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

    // Current Weather Details
    document.getElementById('weather-panel-temp').textContent = `${current.temp.toFixed(1)}°C`;
    document.getElementById('weather-panel-feels').textContent = `${current.feels_like.toFixed(1)}°C`;
    document.getElementById('weather-panel-desc').textContent = current.description;
    document.getElementById('weather-panel-wind').textContent = `${current.wind_speed.toFixed(1)} kn`;
    document.getElementById('weather-panel-pressure').textContent = `${current.pressure} hPa`;
    document.getElementById('weather-panel-humidity').textContent = `${current.humidity}%`;
    document.getElementById('weather-panel-visibility').textContent = `${current.visibility.toFixed(1)} NM`;
    document.getElementById('weather-panel-clouds').textContent = `${current.clouds}%`;

    // Forecast
    const forecastHtml = weatherData.forecast.map(f => `
        <div class="forecast-item">
            <div class="forecast-date">${f.date}</div>
            <img src="https://openweathermap.org/img/wn/${f.icon}.png" alt="${f.description}" style="width:50px">
            <div class="forecast-temp">${f.temp.toFixed(1)}°C</div>
            <div class="forecast-wind">${f.wind_speed.toFixed(0)} kn</div>
        </div>
    `).join('');

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

document.getElementById('btn-sensors').addEventListener('click', () => {
    showNotification('📊 Sensor-Details - Coming soon!');
    // TODO: Sensor-Details-Modal öffnen
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
window.addEventListener('load', () => {
    initMap();
    connectWebSocket();

    // Add center button to map
    centerButton.addTo(map);

    // Add compass rose to map (check settings first)
    const settings = JSON.parse(localStorage.getItem('boatos_settings') || '{}');
    if (settings.navigation?.showCompassRose !== false) {
        compassRose.addTo(map);
    }

    // Weather laden und alle 30min aktualisieren
    fetchWeather();
    setInterval(fetchWeather, 1800000); // 30 min

    // Geolocation API (Browser GPS als Fallback)
    let firstPositionReceived = false;
    if (navigator.geolocation) {
        console.log('🌍 Requesting browser geolocation...');
        navigator.geolocation.watchPosition(
            (position) => {
                browserGpsAccuracy = position.coords.accuracy;
                console.log('📍 Browser GPS: ' + position.coords.latitude.toFixed(6) + ', ' + position.coords.longitude.toFixed(6) + ' (±' + Math.round(position.coords.accuracy) + 'm)');
                
                // Center map on first browser position
                if (!firstPositionReceived) {
                    firstPositionReceived = true;
                    map.setView([position.coords.latitude, position.coords.longitude], 15);
                    console.log('✅ Centered map on browser location');
                }
                
                // Nur nutzen wenn keine GPS-Daten vom Backend kommen
                if (gpsSource !== "backend") {
                    gpsSource = 'browser';
                    updateBoatPosition({
                        lat: position.coords.latitude,
                        lon: position.coords.longitude
                    });
                    
                    // Update GPS source indicator
                    updateGpsSourceIndicator();
                }
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
    
    if (gpsSource === "backend") {
        gpsStatus.style.background = "rgba(46, 213, 115, 0.3)";
        gpsStatus.textContent = "GPS 📡";
        if (gpsSourceEl) gpsSourceEl.textContent = "Backend Module";
        if (gpsAccuracyEl) gpsAccuracyEl.textContent = "High";
    } else if (gpsSource === "browser") {
        gpsStatus.style.background = "rgba(52, 152, 219, 0.3)";
        gpsStatus.textContent = "GPS 📱";
        if (gpsSourceEl) gpsSourceEl.textContent = "Browser/Phone";
        if (gpsAccuracyEl && browserGpsAccuracy) {
            gpsAccuracyEl.textContent = Math.round(browserGpsAccuracy) + " m";
        }
    } else {
        gpsStatus.style.background = "rgba(231, 76, 60, 0.3)";
        gpsStatus.textContent = "GPS ❌";
        if (gpsSourceEl) gpsSourceEl.textContent = "No Signal";
        if (gpsAccuracyEl) gpsAccuracyEl.textContent = "-- m";
    }
}

// ==================== SERVICE WORKER (PWA) ====================
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('✅ Service Worker registered'))
        .catch(err => console.log('⚠️ Service Worker registration failed:', err));
}
