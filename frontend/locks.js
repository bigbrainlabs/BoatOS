/**
 * Locks Module - MapLibre GL Version
 * Displays locks (Schleusen) on the map
 */

// API URL - wird dynamisch ermittelt (verwendet globale falls vorhanden)
const LOCKS_API_URL = window.API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.hostname}`);

// Referenz auf die Map-Instanz (wird extern gesetzt)
let map = null;

let locksMarkers = []; // Array of MapLibre markers
let locksData = [];
let locksVisible = true;

/**
 * Initialize locks layer
 */
function initLocksLayer(mapInstance) {
    // Load locks on map move
    mapInstance.on('moveend', updateLocksOnMap);

    // Initial load
    updateLocksOnMap();

    console.log('✅ Locks layer initialized (MapLibre)');
}

/**
 * Update locks displayed on map based on current view
 */
async function updateLocksOnMap() {
    if (!locksVisible || !map) return;

    const bounds = map.getBounds();
    const bbox = {
        lat_min: bounds.getSouth(),
        lon_min: bounds.getWest(),
        lat_max: bounds.getNorth(),
        lon_max: bounds.getEast()
    };

    try {
        const response = await fetch(
            `${LOCKS_API_URL}/api/locks/bounds?lat_min=${bbox.lat_min}&lon_min=${bbox.lon_min}&lat_max=${bbox.lat_max}&lon_max=${bbox.lon_max}`
        );

        if (!response.ok) {
            console.warn('⚠️ Failed to fetch locks');
            return;
        }

        const data = await response.json();
        locksData = data.locks || [];

        // Clear existing markers
        clearLocksMarkers();

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
 * Clear all lock markers
 */
function clearLocksMarkers() {
    locksMarkers.forEach(marker => marker.remove());
    locksMarkers = [];
}

/**
 * Add a single lock marker to the map
 */
function addLockMarker(lock) {
    // Create HTML element for marker
    const el = document.createElement('div');
    el.className = 'lock-marker';
    el.innerHTML = `
        <div class="lock-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="10" width="12" height="10" rx="1" fill="#FF8C00" stroke="white" stroke-width="2"/>
                <path d="M8 10V7C8 4.79 9.79 3 12 3C14.21 3 16 4.79 16 7V10" stroke="white" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="15" r="1.5" fill="white"/>
            </svg>
        </div>
    `;
    el.style.cursor = 'pointer';
    el.style.width = '32px';
    el.style.height = '32px';

    // Create MapLibre marker
    const marker = new maplibregl.Marker({ element: el })
        .setLngLat([lock.lon, lock.lat])
        .addTo(map);

    // Create popup
    const popup = new maplibregl.Popup({
        offset: 25,
        maxWidth: '350px',
        className: 'lock-popup'
    }).setHTML(createLockPopup(lock));

    marker.setPopup(popup);

    // Click handler
    el.addEventListener('click', () => {
        showLockDetails(lock);
    });

    locksMarkers.push(marker);
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

    const contactLines = [];
    if (lock.vhf_channel) contactLines.push(`📻 ${lock.vhf_channel}`);
    if (lock.phone) contactLines.push(`📞 <a href="tel:${lock.phone}">${lock.phone}</a>`);
    if (lock.email) contactLines.push(`📧 <a href="mailto:${lock.email}">${lock.email}</a>`);
    if (lock.website) {
        const websiteDisplay = lock.website.replace(/^https?:\/\/(www\.)?/, '').substring(0, 25);
        contactLines.push(`🌐 <a href="${lock.website}" target="_blank">${websiteDisplay}</a>`);
    }
    if (lock.registration_method) {
        contactLines.push(`<div style="margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--border); font-size: 11px;"><strong>Anmeldung:</strong> ${lock.registration_method}</div>`);
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
            ${lock.notes ? `<div class="lock-notes">ℹ️ ${lock.notes}</div>` : ''}
            <div class="lock-actions">
                <button onclick="showLockDetails(${lock.id})" class="btn-primary">Details</button>
                <button onclick="addLockToRoute(${lock.id}, ${lock.lat}, ${lock.lon}, '${lock.name.replace(/'/g, "\\'")}')" class="btn-secondary">Zu Route</button>
            </div>
        </div>
    `;

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
        const response = await fetch(`${LOCKS_API_URL}/api/locks/${lockId}/status`);
        if (!response.ok) return;

        const status = await response.json();
        const statusEl = document.getElementById(`lock-status-${lockId}`);

        if (statusEl) {
            if (status.is_open) {
                statusEl.innerHTML = `✅ <span class="text-success">Geöffnet</span>${status.closes_at ? ` bis ${status.closes_at}` : ''}`;
                statusEl.classList.add('open');
                statusEl.classList.remove('closed');
            } else {
                statusEl.innerHTML = `🔴 <span class="text-danger">Geschlossen</span>${status.opens_at ? ` bis ${status.opens_at}` : ''}`;
                statusEl.classList.add('closed');
                statusEl.classList.remove('open');
            }
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

    if (typeof lockIdOrLock === 'number') {
        try {
            const response = await fetch(`${LOCKS_API_URL}/api/locks/${lockIdOrLock}`);
            if (!response.ok) return;
            lock = await response.json();
        } catch (error) {
            console.error('Error loading lock details:', error);
            return;
        }
    } else {
        lock = lockIdOrLock;
    }

    const oldPanel = document.getElementById('lock-details-panel');
    if (oldPanel) oldPanel.remove();

    const panel = document.createElement('div');
    panel.id = 'lock-details-panel';
    panel.className = 'lock-details-panel';

    let hoursTable = '';
    if (lock.opening_hours) {
        const days = { mo: 'Mo', tu: 'Di', we: 'Mi', th: 'Do', fr: 'Fr', sa: 'Sa', su: 'So' };
        hoursTable = '<div class="lock-hours"><strong>Öffnungszeiten:</strong><table>';
        for (const [day, hours] of Object.entries(lock.opening_hours)) {
            hoursTable += `<tr><td>${days[day] || day}</td><td>${hours}</td></tr>`;
        }
        hoursTable += '</table></div>';

        if (lock.break_times && lock.break_times.length > 0) {
            hoursTable += '<div style="margin-top: 8px; font-size: 12px; color: var(--warning);">⏸️ Pausenzeiten: ';
            hoursTable += lock.break_times.map(b => `${b.start}-${b.end}`).join(', ');
            hoursTable += '</div>';
        }
    } else {
        hoursTable = '<div class="lock-hours"><strong>Öffnungszeiten:</strong> 24/7</div>';
    }

    panel.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
            <h2>🔒 ${lock.name}</h2>
            <button onclick="closeLockDetails()" class="btn-close">✕</button>
        </div>

        <div class="lock-waterway" style="color: var(--text-dim); margin-bottom: 16px;">${lock.waterway}${lock.river_km ? ` • km ${lock.river_km}` : ''}</div>

        <div class="lock-section">
            <div class="lock-section-title">Technische Daten</div>
            ${lock.max_length ? `<div>Länge: <strong>${lock.max_length}m</strong></div>` : ''}
            ${lock.max_width ? `<div>Breite: <strong>${lock.max_width}m</strong></div>` : ''}
            ${lock.max_draft ? `<div>Tiefgang: <strong>${lock.max_draft}m</strong></div>` : ''}
            ${lock.max_height ? `<div>Durchfahrtshöhe: <strong>${lock.max_height}m</strong></div>` : ''}
            ${lock.avg_duration ? `<div>Schleusdauer: <strong>~${lock.avg_duration} min</strong></div>` : ''}
        </div>

        <div class="lock-section">
            ${hoursTable}
        </div>

        ${lock.phone || lock.vhf_channel || lock.email || lock.website || lock.registration_method ? `
        <div class="lock-section">
            <div class="lock-section-title">Kontakt</div>
            ${lock.phone ? `<div>📞 <a href="tel:${lock.phone}">${lock.phone}</a></div>` : ''}
            ${lock.vhf_channel ? `<div>📻 ${lock.vhf_channel}</div>` : ''}
            ${lock.email ? `<div>📧 <a href="mailto:${lock.email}">${lock.email}</a></div>` : ''}
            ${lock.website ? `<div>🌐 <a href="${lock.website}" target="_blank">Website</a></div>` : ''}
            ${lock.registration_method ? `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border);"><strong style="color: var(--accent);">Anmeldung:</strong> ${lock.registration_method}</div>` : ''}
        </div>
        ` : ''}

        ${lock.notes ? `
        <div class="lock-notes">
            <strong>ℹ️ Hinweise:</strong><br>${lock.notes}
        </div>
        ` : ''}

        <div class="lock-actions">
            <button onclick="addLockToRoute(${lock.id}, ${lock.lat}, ${lock.lon}, '${lock.name.replace(/'/g, "\\'")}')" class="btn-route">
                ➕ Zu Route
            </button>
            <button onclick="notifyLock(${lock.id})" class="btn-notify">
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
        // Create waypoint object for MapLibre
        const waypoint = {
            lat: lat,
            lon: lon,
            name: name
        };
        addWaypoint(waypoint);
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
        const response = await fetch(`${LOCKS_API_URL}/api/locks/${lockId}/notify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                eta: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
            })
        });

        if (!response.ok) {
            showNotification('❌ Fehler beim Erstellen der Anmeldung', 'error');
            return;
        }

        const data = await response.json();

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
        updateLocksOnMap();
    } else {
        clearLocksMarkers();
    }

    return locksVisible;
}

/**
 * Check if a lock from OSRM data is already in our database
 */
function isLockInDatabase(osrmLock) {
    if (!osrmLock || !osrmLock.lat || !osrmLock.lon) return false;

    const PROXIMITY_THRESHOLD = 500;

    for (const lock of locksData) {
        const R = 6371000;
        const dLat = (lock.lat - osrmLock.lat) * Math.PI / 180;
        const dLon = (lock.lon - osrmLock.lon) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(osrmLock.lat * Math.PI / 180) * Math.cos(lock.lat * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        if (distance < PROXIMITY_THRESHOLD) {
            if (osrmLock.name && lock.name) {
                const osrmName = osrmLock.name.toLowerCase().replace(/[^a-zäöü]/g, '');
                const dbName = lock.name.toLowerCase().replace(/[^a-zäöü]/g, '');

                if (osrmName.includes(dbName) || dbName.includes(osrmName)) {
                    console.log(`🔍 Lock duplicate found: "${osrmLock.name}" matches database lock "${lock.name}" (${distance.toFixed(0)}m away)`);
                    return true;
                }
            }

            console.log(`🔍 Lock duplicate found by proximity: ${distance.toFixed(0)}m from database lock "${lock.name}"`);
            return true;
        }
    }

    return false;
}

// ===========================================
// Globale Exports
// ===========================================

// Map-Instanz setzen (wird von main.js aufgerufen)
function setLocksMap(mapInstance) {
    map = mapInstance;
    console.log('🔒 Locks map reference set');
}

// Globale Funktionen exportieren
window.initLocksLayer = initLocksLayer;
window.updateLocksOnMap = updateLocksOnMap;
window.clearLocksMarkers = clearLocksMarkers;
window.toggleLocksLayer = toggleLocksLayer;
window.showLockDetails = showLockDetails;
window.closeLockDetails = closeLockDetails;
window.setLocksMap = setLocksMap;

// locksVisible als Getter/Setter für externe Zugriffe
Object.defineProperty(window, 'locksVisible', {
    get: function() { return locksVisible; },
    set: function(val) { locksVisible = val; }
});
