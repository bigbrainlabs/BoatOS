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
        // BoatOS Backend Routing API
        const response = await fetch(`${API_URL}/api/route`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                waypoints: coordinates
            })
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
            const avgSpeed = 5; // knots
            const etaHours = distanceNM / avgSpeed;
            const durationHours = Math.floor(etaHours);
            const durationMinutes = Math.round((etaHours - durationHours) * 60);

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

            console.log(`📏 Routed: ${formatDistance(distanceMeters)} (${data.properties.routing_type}), ETA: ${durationHours}h ${durationMinutes}min @ 5kn`);
            showRouteInfo(distanceMeters, durationHours, durationMinutes, routeInfo, isDirect);

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
    const avgSpeed = 5;
    const etaHours = totalNM / avgSpeed;
    const etaHoursInt = Math.floor(etaHours);
    const etaMinutes = Math.round((etaHours - etaHoursInt) * 60);

    console.log(`📏 Direct Route (Luftlinie): ${formatDistance(totalDistance)}`);
    showRouteInfo(totalDistance, etaHoursInt, etaMinutes, routeInfo, true);
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

function showRouteInfo(totalMeters, hours, minutes, segments, isDirect) {
    const oldPanel = document.getElementById('route-info-panel');
    if (oldPanel) oldPanel.remove();

    const warningBadge = isDirect ? '<span style="background: rgba(231, 76, 60, 0.8); padding: 2px 6px; border-radius: 4px; font-size: 10px; margin-left: 8px;">⚠️ LUFTLINIE</span>' : '';

    const panel = document.createElement('div');
    panel.id = 'route-info-panel';
    panel.style.cssText = 'position: absolute; bottom: 80px; left: 20px; background: rgba(10, 14, 39, 0.95); backdrop-filter: blur(10px); border: 2px solid ' +
        (isDirect ? 'rgba(231, 76, 60, 0.6)' : 'rgba(42, 82, 152, 0.6)') +
        '; border-radius: 12px; padding: 15px; z-index: 1001; min-width: 300px; max-width: 350px; color: white; font-size: 14px;';

    const distanceFormatted = formatDistance(totalMeters);

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
        '<div style="font-size: 12px; color: #8892b0;">ETA: ' + hours + 'h ' + minutes + 'min @ ' + formatSpeed(5) + '</div>' +
        '</div>' +
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
