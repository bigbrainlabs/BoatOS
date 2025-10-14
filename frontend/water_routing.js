async function updateRoute() {
    // Alte Route löschen
    routeLayer.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer._icon) {
            routeLayer.removeLayer(layer);
        }
    });

    if (waypoints.length < 2) return;

    // Koordinaten für Routing-API vorbereiten
    const coordinates = waypoints.map(w => {
        const latlng = w.marker.getLatLng();
        return [latlng.lng, latlng.lat]; // Lon, Lat für die API
    });

    try {
        // Get boat settings from settings.js (if available)
        const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};

        // Prepare request body with boat data
        const requestBody = {
            waypoints: coordinates
        };

        // Add boat specifications if available
        if (boatSettings.draft > 0) {
            requestBody.boat_draft = boatSettings.draft;
        }
        if (boatSettings.height > 0) {
            requestBody.boat_height = boatSettings.height;
        }
        if (boatSettings.beam > 0) {
            requestBody.boat_beam = boatSettings.beam;
        }

        // BoatOS Backend Routing API
        const response = await fetch(`${API_URL}/api/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            console.warn('⚠️ Backend routing failed, falling back to direct routing');
            drawDirectRoute();
            return;
        }

        const data = await response.json();

        if (data.geometry && data.geometry.coordinates) {
            // Route zeichnen mit Backend-Daten
            const routePoints = data.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            const isDirect = data.properties.routing_type === 'direct';

            // Schatteneffekt
            L.polyline(routePoints, {
                color: 'white',
                weight: 7,
                opacity: 0.3,
                dashArray: isDirect ? '15, 10' : '',
                lineCap: 'round'
            }).addTo(routeLayer);

            // Hauptroute
            L.polyline(routePoints, {
                color: isDirect ? '#e74c3c' : '#3498db',
                weight: 5,
                opacity: isDirect ? 0.7 : 0.9,
                dashArray: isDirect ? '15, 10' : '',
                lineCap: 'round'
            }).addTo(routeLayer);

            // Distanz aus Routing-Ergebnis (in Metern)
            const distanceMeters = data.properties.distance_m;
            const distanceNM = data.properties.distance_nm;

            // Get cruise speed from boat settings (km/h) and convert to knots
            let avgSpeed = 5; // Default fallback: 5 knots
            console.log('🚤 Boat Settings:', boatSettings);
            console.log('🚤 Cruise Speed (km/h):', boatSettings.cruiseSpeed);

            if (boatSettings.cruiseSpeed && boatSettings.cruiseSpeed > 0) {
                avgSpeed = boatSettings.cruiseSpeed / 1.852; // Convert km/h to knots
                console.log('✅ Using cruise speed:', boatSettings.cruiseSpeed, 'km/h =', avgSpeed.toFixed(1), 'kn');
            } else {
                console.log('⚠️ No cruise speed set, using default 5 knots');
            }

            // Use duration_adjusted_h from backend if available (includes water current adjustment)
            let etaHours;
            if (data.properties.duration_adjusted_h) {
                etaHours = data.properties.duration_adjusted_h;
                console.log('🌊 Using adjusted ETA from backend:', etaHours.toFixed(2), 'hours (includes water current)');
            } else {
                etaHours = distanceNM / avgSpeed;
                console.log('⏱️ Calculating ETA from distance/speed:', etaHours.toFixed(2), 'hours');
            }

            let durationHours = Math.floor(etaHours);
            let durationMinutes = Math.round((etaHours - durationHours) * 60);

            // Handle case where rounding gives 60 minutes
            if (durationMinutes >= 60) {
                durationHours += 1;
                durationMinutes = 0;
            }

            // Segment-Infos generieren
            const routeInfo = [];
            for (let i = 0; i < waypoints.length - 1; i++) {
                const from = waypoints[i];
                const to = waypoints[i + 1];

                const fromLL = from.marker.getLatLng();
                const toLL = to.marker.getLatLng();
                const bearing = calculateBearing(fromLL.lat, fromLL.lng, toLL.lat, toLL.lng);
                const segmentDist = fromLL.distanceTo(toLL) / 1852;

                routeInfo.push({
                    from: from.name,
                    to: to.name,
                    distance: segmentDist.toFixed(2),
                    bearing: Math.round(bearing)
                });
            }

            // Add lock markers if present (but skip duplicates from locks database)
            if (data.properties.locks && data.properties.locks.length > 0) {
                let displayedLocks = 0;
                let skippedLocks = 0;

                data.properties.locks.forEach(lock => {
                    // Check if this lock is already in our locks database
                    if (typeof isLockInDatabase === 'function' && isLockInDatabase(lock)) {
                        skippedLocks++;
                        return; // Skip this lock, it's already displayed by locks.js
                    }

                    const lockIcon = L.divIcon({
                        className: 'lock-marker',
                        html: '<div style="background: rgba(255, 140, 0, 0.9); color: white; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4); border: 2px solid white;">🔒 Schleuse</div>',
                        iconSize: [100, 30],
                        iconAnchor: [50, 15]
                    });

                    const marker = L.marker([lock.lat, lock.lon], { icon: lockIcon }).addTo(routeLayer);
                    marker.bindPopup(`<strong>🔒 ${lock.name}</strong><br>Distanz: ${formatDistance(lock.distance_from_start)}`);
                    displayedLocks++;
                });

                if (displayedLocks > 0) {
                    console.log(`🔒 ${displayedLocks} OSRM-Schleusen auf Route angezeigt`);
                }
                if (skippedLocks > 0) {
                    console.log(`⏭️ ${skippedLocks} Schleusen übersprungen (bereits in Datenbank)`);
                }
            }

            // Add bridge markers if present
            if (data.properties.bridges && data.properties.bridges.length > 0) {
                data.properties.bridges.forEach(bridge => {
                    const bridgeIcon = L.divIcon({
                        className: 'bridge-marker',
                        html: '<div style="background: rgba(52, 152, 219, 0.9); color: white; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.4); border: 2px solid white;">🌉 Brücke</div>',
                        iconSize: [100, 30],
                        iconAnchor: [50, 15]
                    });

                    const marker = L.marker([bridge.lat, bridge.lon], { icon: bridgeIcon }).addTo(routeLayer);
                    const clearanceInfo = bridge.clearance ? `<br>Durchfahrtshöhe: ${bridge.clearance}m` : '';
                    marker.bindPopup(`<strong>🌉 ${bridge.name}</strong><br>Distanz: ${formatDistance(bridge.distance_from_start)}${clearanceInfo}`);
                });
                console.log(`🌉 ${data.properties.bridges.length} Brücken gefunden`);
            }

            console.log(`📏 Routed: ${formatDistance(distanceMeters)} (${data.properties.routing_type}), ETA: ${durationHours}h ${durationMinutes}min @ ${formatSpeed(avgSpeed)}`);
            showRouteInfo(distanceMeters, durationHours, durationMinutes, routeInfo, isDirect, data.properties.locks, data.properties.bridges, avgSpeed);

        } else {
            console.warn('⚠️ No route found, using direct routing');
            drawDirectRoute();
        }

    } catch (error) {
        console.error('❌ Routing error:', error);
        console.log('📍 Falling back to direct routing');
        drawDirectRoute();
    }
}

function drawDirectRoute() {
    // Fallback: Direkte Luftlinie
    const points = waypoints.map(w => {
        const latlng = w.marker.getLatLng();
        return [latlng.lat, latlng.lng];
    });

    L.polyline(points, {
        color: 'white',
        weight: 7,
        opacity: 0.3,
        dashArray: '15, 10',
        lineCap: 'round'
    }).addTo(routeLayer);

    L.polyline(points, {
        color: '#e74c3c',
        weight: 5,
        opacity: 0.8,
        dashArray: '15, 10',
        lineCap: 'round'
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
                html: '<div style="background: rgba(231, 76, 60, 0.9); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">' +
                    '⚠️ ' + segmentDistFormatted + ' (Luftlinie)<br>' +
                    Math.round(bearing) + '°' +
                    '</div>',
                iconSize: [120, 40],
                iconAnchor: [60, 20]
            })
        }).addTo(routeLayer);
    }

    const totalNM = (totalDistance / 1852);

    // Get cruise speed from boat settings (km/h) and convert to knots
    const boatSettings = typeof getBoatSettings === 'function' ? getBoatSettings() : {};
    let avgSpeed = 5; // Default fallback: 5 knots
    console.log('🚤 Boat Settings (direct):', boatSettings);
    console.log('🚤 Cruise Speed (km/h):', boatSettings.cruiseSpeed);

    if (boatSettings.cruiseSpeed && boatSettings.cruiseSpeed > 0) {
        avgSpeed = boatSettings.cruiseSpeed / 1.852; // Convert km/h to knots
        console.log('✅ Using cruise speed:', boatSettings.cruiseSpeed, 'km/h =', avgSpeed.toFixed(1), 'kn');
    } else {
        console.log('⚠️ No cruise speed set, using default 5 knots');
    }

    const etaHours = totalNM / avgSpeed;
    let etaHoursInt = Math.floor(etaHours);
    let etaMinutes = Math.round((etaHours - etaHoursInt) * 60);

    // Handle case where rounding gives 60 minutes
    if (etaMinutes >= 60) {
        etaHoursInt += 1;
        etaMinutes = 0;
    }

    console.log(`📏 Direct Route (Luftlinie): ${formatDistance(totalDistance)}`);
    showRouteInfo(totalDistance, etaHoursInt, etaMinutes, routeInfo, true, [], [], avgSpeed);
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

function showRouteInfo(totalMeters, hours, minutes, segments, isDirect, locks = [], bridges = [], avgSpeed = 5) {
    const oldPanel = document.getElementById('route-info-panel');
    if (oldPanel) oldPanel.remove();

    const warningBadge = isDirect ? '<span style="background: rgba(231, 76, 60, 0.8); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 8px;">⚠️ LUFTLINIE</span>' : '';

    const panel = document.createElement('div');
    panel.id = 'route-info-panel';
    panel.style.cssText = 'position: absolute; bottom: 80px; left: 20px; background: rgba(10, 14, 39, 0.95); backdrop-filter: blur(10px); border: 2px solid ' +
        (isDirect ? 'rgba(231, 76, 60, 0.6)' : 'rgba(42, 82, 152, 0.6)') +
        '; border-radius: 12px; padding: 15px; z-index: 1001; min-width: 300px; max-width: 350px; color: white; font-size: 14px;';

    const distanceFormatted = formatDistance(totalMeters);

    // Infrastructure summary
    let infrastructureInfo = '';
    if (locks && locks.length > 0 || bridges && bridges.length > 0) {
        infrastructureInfo = '<div style="background: rgba(100, 255, 218, 0.1); padding: 8px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: #64ffda;">' +
            '<strong>Infrastruktur:</strong><br>';
        if (locks && locks.length > 0) {
            infrastructureInfo += `🔒 ${locks.length} Schleuse${locks.length > 1 ? 'n' : ''}<br>`;
        }
        if (bridges && bridges.length > 0) {
            infrastructureInfo += `🌉 ${bridges.length} Brücke${bridges.length > 1 ? 'n' : ''}`;
        }
        infrastructureInfo += '</div>';
    }

    panel.innerHTML = '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">' +
        '<h3 style="margin: 0; color: #64ffda; font-size: 16px;">' + (isDirect ? '📍' : '🚤') + ' Route' + warningBadge + '</h3>' +
        '<div style="display: flex; gap: 5px;">' +
        '<button onclick="openUnitsSettings()" style="background: rgba(42, 82, 152, 0.3); border: none; color: white; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">⚙️</button>' +
        '<button onclick="clearRoute()" style="background: rgba(231, 76, 60, 0.3); border: none; color: white; padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">Löschen</button>' +
        '</div>' +
        '</div>' +
        (isDirect ? '<div style="background: rgba(231, 76, 60, 0.2); padding: 8px; border-radius: 6px; margin-bottom: 10px; font-size: 11px; color: #ffcccc;">⚠️ Wasserrouting nicht verfügbar. Zeige Luftlinie.</div>' : '') +
        '<div style="background: rgba(42, 82, 152, 0.2); padding: 10px; border-radius: 8px; margin-bottom: 10px;">' +
        '<div style="font-size: 24px; font-weight: 700; color: #64ffda;">' + distanceFormatted + '</div>' +
        '<div style="font-size: 12px; color: #8892b0;">ETA: ' + hours + 'h ' + minutes + 'min @ ' + formatSpeed(avgSpeed) + '</div>' +
        '</div>' +
        infrastructureInfo +
        '<div style="max-height: 200px; overflow-y: auto;">' +
        segments.map(s =>
            '<div style="background: rgba(42, 82, 152, 0.15); padding: 8px; border-radius: 6px; margin-bottom: 5px; font-size: 12px;">' +
            '<div style="color: #64ffda; font-weight: 600;">' + s.from + ' → ' + s.to + '</div>' +
            '<div style="color: #8892b0; margin-top: 3px;">' + formatDistance(s.distance * 1852) + ' • ' + s.bearing + '°</div>' +
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
