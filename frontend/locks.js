/**
 * Locks Module
 * Displays locks (Schleusen) on the map
 */

let locksLayer = null;
let locksData = [];
let locksVisible = true;

/**
 * Initialize locks layer
 */
function initLocksLayer(map) {
    locksLayer = L.layerGroup().addTo(map);

    // Load locks on map move
    map.on('moveend', updateLocksOnMap);

    // Initial load
    updateLocksOnMap();

    console.log('✅ Locks layer initialized');
}

/**
 * Update locks displayed on map based on current view
 */
async function updateLocksOnMap() {
    if (!locksVisible || !locksLayer) return;

    const bounds = map.getBounds();
    const bbox = {
        lat_min: bounds.getSouth(),
        lon_min: bounds.getWest(),
        lat_max: bounds.getNorth(),
        lon_max: bounds.getEast()
    };

    try {
        const response = await fetch(
            `${API_URL}/api/locks/bounds?lat_min=${bbox.lat_min}&lon_min=${bbox.lon_min}&lat_max=${bbox.lat_max}&lon_max=${bbox.lon_max}`
        );

        if (!response.ok) {
            console.warn('⚠️ Failed to fetch locks');
            return;
        }

        const data = await response.json();
        locksData = data.locks || [];

        // Clear existing markers
        locksLayer.clearLayers();

        // Add lock markers
        locksData.forEach(lock => {
            addLockMarker(lock);
        });

        console.log(`🔒 Loaded ${locksData.length} locks in view`);

    } catch (error) {
        console.error('❌ Error loading locks:', error);
    }
}

/**
 * Add a single lock marker to the map
 */
function addLockMarker(lock) {
    // Custom lock icon
    const lockIcon = L.divIcon({
        className: 'lock-marker',
        html: `<div class="lock-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="10" width="12" height="10" rx="1" fill="#FF8C00" stroke="white" stroke-width="2"/>
                <path d="M8 10V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V10" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="15" r="1.5" fill="white"/>
            </svg>
        </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });

    const marker = L.marker([lock.lat, lock.lon], { icon: lockIcon });

    // Create popup content
    const popupContent = createLockPopup(lock);
    marker.bindPopup(popupContent, {
        maxWidth: 350,
        className: 'lock-popup'
    });

    // Add click handler for details
    marker.on('click', () => {
        showLockDetails(lock);
    });

    marker.addTo(locksLayer);
}

/**
 * Create popup HTML for a lock
 */
function createLockPopup(lock) {
    const statusInfo = lock.opening_hours ?
        `<div class="lock-status" id="lock-status-${lock.id}">🔄 Prüfe Status...</div>` : '';

    const technicalData = [];
    if (lock.max_length) technicalData.push(`Länge: ${lock.max_length}m`);
    if (lock.max_width) technicalData.push(`Breite: ${lock.max_width}m`);
    if (lock.max_draft) technicalData.push(`Tiefgang: ${lock.max_draft}m`);
    if (lock.max_height) technicalData.push(`Höhe: ${lock.max_height}m`);

    const techInfo = technicalData.length > 0 ?
        `<div class="lock-tech">${technicalData.join(' • ')}</div>` : '';

    // Build contact info with all available methods
    const contactLines = [];
    if (lock.vhf_channel) contactLines.push(`📻 ${lock.vhf_channel}`);
    if (lock.phone) contactLines.push(`📞 <a href="tel:${lock.phone}" style="color: #64ffda; text-decoration: none;">${lock.phone}</a>`);
    if (lock.email) contactLines.push(`📧 <a href="mailto:${lock.email}" style="color: #64ffda; text-decoration: none;">${lock.email}</a>`);
    if (lock.website) {
        const websiteDisplay = lock.website.replace(/^https?:\/\/(www\.)?/, '').substring(0, 25);
        contactLines.push(`🌐 <a href="${lock.website}" target="_blank" style="color: #64ffda; text-decoration: none;">${websiteDisplay}</a>`);
    }
    if (lock.registration_method) {
        contactLines.push(`<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid rgba(100, 255, 218, 0.2); font-size: 11px;"><strong>Anmeldung:</strong> ${lock.registration_method}</div>`);
    }

    const contact = contactLines.length > 0 ?
        `<div class="lock-contact">${contactLines.join('<br>')}</div>` : '';

    const facilities = lock.facilities && lock.facilities.length > 0 ?
        `<div class="lock-facilities">
            ${lock.facilities.map(f => getFacilityIcon(f)).join(' ')}
        </div>` : '';

    const avgDuration = lock.avg_duration ?
        `<div class="lock-duration">⏱️ ~${lock.avg_duration} min</div>` : '';

    const html = `
        <div class="lock-popup-content">
            <h3>🔒 ${lock.name}</h3>
            <div class="lock-waterway">${lock.waterway}${lock.river_km ? ` • km ${lock.river_km}` : ''}</div>
            ${statusInfo}
            ${techInfo}
            ${avgDuration}
            ${contact}
            ${facilities}
            ${lock.notes ? `<div class="lock-notes">${lock.notes}</div>` : ''}
            <div class="lock-actions">
                <button onclick="showLockDetails(${lock.id})" class="btn-primary">Details</button>
                <button onclick="addLockToRoute(${lock.id}, ${lock.lat}, ${lock.lon}, '${lock.name.replace(/'/g, "\\'")}')" class="btn-secondary">Zu Route</button>
            </div>
        </div>
    `;

    // Check lock status asynchronously
    if (lock.opening_hours && lock.id) {
        setTimeout(() => checkLockStatus(lock.id), 100);
    }

    return html;
}

/**
 * Check if lock is currently open
 */
async function checkLockStatus(lockId) {
    try {
        const response = await fetch(`${API_URL}/api/locks/${lockId}/status`);
        if (!response.ok) return;

        const status = await response.json();
        const statusEl = document.getElementById(`lock-status-${lockId}`);

        if (statusEl) {
            if (status.is_open) {
                statusEl.innerHTML = `✅ <span style="color: #2ecc71;">Geöffnet</span>${status.closes_at ? ` bis ${status.closes_at}` : ''}`;
                statusEl.style.background = 'rgba(46, 204, 113, 0.1)';
            } else {
                statusEl.innerHTML = `🔴 <span style="color: #e74c3c;">Geschlossen</span>${status.opens_at ? ` bis ${status.opens_at}` : ''}`;
                statusEl.style.background = 'rgba(231, 76, 60, 0.1)';
            }
            statusEl.style.padding = '6px 10px';
            statusEl.style.borderRadius = '6px';
            statusEl.style.marginTop = '8px';
        }
    } catch (error) {
        console.warn('Could not check lock status:', error);
    }
}

/**
 * Get facility icon
 */
function getFacilityIcon(facility) {
    const icons = {
        'water': '💧',
        'electricity': '⚡',
        'waste': '🗑️',
        'fuel': '⛽',
        'wifi': '📶',
        'toilet': '🚻'
    };
    return icons[facility] || '•';
}

/**
 * Show detailed lock information in a panel
 */
async function showLockDetails(lockIdOrLock) {
    let lock;

    // Check if we received an ID or a lock object
    if (typeof lockIdOrLock === 'number') {
        // Fetch full lock data
        try {
            const response = await fetch(`${API_URL}/api/locks/${lockIdOrLock}`);
            if (!response.ok) return;
            lock = await response.json();
        } catch (error) {
            console.error('Error loading lock details:', error);
            return;
        }
    } else {
        lock = lockIdOrLock;
    }

    // Remove existing panel
    const oldPanel = document.getElementById('lock-details-panel');
    if (oldPanel) oldPanel.remove();

    // Create details panel
    const panel = document.createElement('div');
    panel.id = 'lock-details-panel';
    panel.className = 'info-panel';
    panel.style.cssText = `
        position: absolute;
        top: 80px;
        right: 20px;
        background: rgba(10, 14, 39, 0.95);
        backdrop-filter: blur(10px);
        border: 2px solid rgba(100, 255, 218, 0.3);
        border-radius: 12px;
        padding: 20px;
        z-index: 1002;
        max-width: 400px;
        max-height: 80vh;
        overflow-y: auto;
        color: white;
    `;

    // Opening hours table
    let hoursTable = '';
    if (lock.opening_hours) {
        const days = { mo: 'Mo', tu: 'Di', we: 'Mi', th: 'Do', fr: 'Fr', sa: 'Sa', su: 'So' };
        hoursTable = '<div class="lock-hours"><strong>Öffnungszeiten:</strong><table style="width: 100%; margin-top: 8px;">';
        for (const [day, hours] of Object.entries(lock.opening_hours)) {
            hoursTable += `<tr><td style="padding: 4px;">${days[day] || day}</td><td style="padding: 4px;">${hours}</td></tr>`;
        }
        hoursTable += '</table></div>';

        if (lock.break_times && lock.break_times.length > 0) {
            hoursTable += '<div style="margin-top: 8px; font-size: 12px; color: #ffa500;">⏸️ Pausenzeiten: ';
            hoursTable += lock.break_times.map(b => `${b.start}-${b.end}`).join(', ');
            hoursTable += '</div>';
        }
    } else {
        hoursTable = '<div class="lock-hours"><strong>Öffnungszeiten:</strong> 24/7</div>';
    }

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <h2 style="margin: 0; color: #64ffda; font-size: 20px;">🔒 ${lock.name}</h2>
            <button onclick="closeLockDetails()" style="background: rgba(231, 76, 60, 0.3); border: none; color: white; padding: 8px 12px; border-radius: 6px; cursor: pointer;">✕</button>
        </div>

        <div class="lock-waterway" style="color: #8892b0; margin-bottom: 16px;">${lock.waterway}${lock.river_km ? ` • km ${lock.river_km}` : ''}</div>

        <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: #64ffda; margin-bottom: 8px;">TECHNISCHE DATEN</div>
            ${lock.max_length ? `<div>Länge: <strong>${lock.max_length}m</strong></div>` : ''}
            ${lock.max_width ? `<div>Breite: <strong>${lock.max_width}m</strong></div>` : ''}
            ${lock.max_draft ? `<div>Tiefgang: <strong>${lock.max_draft}m</strong></div>` : ''}
            ${lock.max_height ? `<div>Durchfahrtshöhe: <strong>${lock.max_height}m</strong></div>` : ''}
            ${lock.avg_duration ? `<div>Schleusdauer: <strong>~${lock.avg_duration} min</strong></div>` : ''}
        </div>

        <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            ${hoursTable}
        </div>

        ${lock.phone || lock.vhf_channel || lock.email || lock.website || lock.registration_method ? `
        <div style="background: rgba(42, 82, 152, 0.2); padding: 12px; border-radius: 8px; margin-bottom: 16px;">
            <div style="font-size: 12px; color: #64ffda; margin-bottom: 8px;">KONTAKT</div>
            ${lock.phone ? `<div>📞 <a href="tel:${lock.phone}" style="color: white;">${lock.phone}</a></div>` : ''}
            ${lock.vhf_channel ? `<div>📻 ${lock.vhf_channel}</div>` : ''}
            ${lock.email ? `<div>📧 <a href="mailto:${lock.email}" style="color: white;">${lock.email}</a></div>` : ''}
            ${lock.website ? `<div>🌐 <a href="${lock.website}" target="_blank" style="color: white;">Website</a></div>` : ''}
            ${lock.registration_method ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid rgba(100, 255, 218, 0.2);"><strong style="color: #64ffda;">Anmeldung möglich:</strong> ${lock.registration_method}</div>` : ''}
        </div>
        ` : ''}

        ${lock.notes ? `
        <div style="background: rgba(255, 165, 0, 0.1); padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 13px;">
            <strong>ℹ️ Hinweise:</strong><br>${lock.notes}
        </div>
        ` : ''}

        <div style="display: flex; gap: 10px;">
            <button onclick="addLockToRoute(${lock.id}, ${lock.lat}, ${lock.lon}, '${lock.name.replace(/'/g, "\\'")}')"
                style="flex: 1; background: rgba(42, 82, 152, 0.5); border: none; color: white; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                ➕ Zu Route
            </button>
            <button onclick="notifyLock(${lock.id})"
                style="flex: 1; background: rgba(46, 204, 113, 0.5); border: none; color: white; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: 600;">
                📧 Anmelden
            </button>
        </div>
    `;

    document.getElementById('map-container').appendChild(panel);
}

/**
 * Close lock details panel
 */
function closeLockDetails() {
    const panel = document.getElementById('lock-details-panel');
    if (panel) panel.remove();
}

/**
 * Add lock as waypoint to route
 */
function addLockToRoute(lockId, lat, lon, name) {
    if (typeof addWaypoint === 'function') {
        // Create a click event at the lock position
        const fakeEvent = {
            latlng: L.latLng(lat, lon)
        };
        addWaypoint(fakeEvent);
        showNotification(`🔒 ${name} zu Route hinzugefügt`);
        closeLockDetails();
    } else {
        console.warn('addWaypoint function not available');
    }
}

/**
 * Notify lock (prepare email/SMS)
 */
async function notifyLock(lockId) {
    try {
        const response = await fetch(`${API_URL}/api/locks/${lockId}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eta: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() // +2 hours
            })
        });

        if (!response.ok) {
            showNotification('❌ Fehler beim Erstellen der Anmeldung', 'error');
            return;
        }

        const data = await response.json();

        // Open email client with pre-filled data
        if (data.email && data.email.to) {
            const mailtoLink = `mailto:${data.email.to}?subject=${encodeURIComponent(data.email.subject)}&body=${encodeURIComponent(data.email.body)}`;
            window.location.href = mailtoLink;
            showNotification('📧 Email-Programm wird geöffnet...', 'success');
        } else {
            showNotification('⚠️ Keine Email-Adresse hinterlegt', 'warning');
        }

    } catch (error) {
        console.error('Error notifying lock:', error);
        showNotification('❌ Fehler beim Erstellen der Anmeldung', 'error');
    }
}

/**
 * Toggle locks layer visibility
 */
function toggleLocksLayer() {
    locksVisible = !locksVisible;

    if (locksVisible) {
        locksLayer.addTo(map);
        updateLocksOnMap();
    } else {
        locksLayer.clearLayers();
    }

    return locksVisible;
}

/**
 * Check if a lock from OSRM data is already in our database
 * Uses proximity check (within 500m) and optional name matching
 *
 * @param {Object} osrmLock - Lock object from OSRM routing with {lat, lon, name}
 * @returns {boolean} - True if lock is already in our database
 */
function isLockInDatabase(osrmLock) {
    if (!osrmLock || !osrmLock.lat || !osrmLock.lon) return false;

    const PROXIMITY_THRESHOLD = 500; // meters

    // Check against all locks in current view
    for (const lock of locksData) {
        // Calculate distance using Haversine
        const R = 6371000; // Earth radius in meters
        const dLat = (lock.lat - osrmLock.lat) * Math.PI / 180;
        const dLon = (lock.lon - osrmLock.lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(osrmLock.lat * Math.PI / 180) * Math.cos(lock.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance < PROXIMITY_THRESHOLD) {
            // Optional: Also check name similarity if both have names
            if (osrmLock.name && lock.name) {
                const osrmName = osrmLock.name.toLowerCase().replace(/[^a-zäöü]/g, '');
                const dbName = lock.name.toLowerCase().replace(/[^a-zäöü]/g, '');

                // If names are similar, it's definitely the same lock
                if (osrmName.includes(dbName) || dbName.includes(osrmName)) {
                    console.log(`🔍 Lock duplicate found: "${osrmLock.name}" matches database lock "${lock.name}" (${distance.toFixed(0)}m away)`);
                    return true;
                }
            }

            // Even without name match, if within 500m it's likely the same lock
            console.log(`🔍 Lock duplicate found by proximity: ${distance.toFixed(0)}m from database lock "${lock.name}"`);
            return true;
        }
    }

    return false;
}
