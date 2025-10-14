// ==================== LOGBOOK ====================
// Use API and showMsg from app.js (global scope)
const getAPI = () => {
    // Use relative path - nginx proxies /api to backend
    if (window.location.hostname === 'localhost') {
        return 'http://localhost:8000';
    }
    // Return empty string for relative URLs (nginx proxy)
    return '';
};
let trackStatusInterval;

function openLogbook() {
    document.getElementById("logbook-modal").classList.add("active");
    loadLogbookEntries();
    updateTrackStatus();
    trackStatusInterval = setInterval(updateTrackStatus, 2000);
}

function closeLogbook() {
    document.getElementById("logbook-modal").classList.remove("active");
    clearInterval(trackStatusInterval);
}

async function loadLogbookEntries() {
    try {
        const response = await fetch(`${getAPI()}/api/logbook`);
        const entries = await response.json();
        const container = document.getElementById("logbook-entries");
        if (entries.length === 0) {
            container.innerHTML = '<div class="empty-logbook">Noch keine Logbuch-Einträge</div>';
            return;
        }
        container.innerHTML = entries.reverse().map(entry => renderLogbookEntry(entry)).join("");
    } catch (error) {
        console.error("Error loading logbook:", error);
    }
}

function renderLogbookEntry(entry) {
    const entryTypes = {
        'trip_start': { icon: '🚢', label: 'Fahrt gestartet', color: 'linear-gradient(135deg, #2ecc71, #27ae60)' },
        'trip_end': { icon: '⚓', label: 'Fahrt beendet', color: 'linear-gradient(135deg, #3498db, #2980b9)' },
        'manual': { icon: '📝', label: 'Manueller Eintrag', color: 'linear-gradient(135deg, #9b59b6, #8e44ad)' },
        'trip_pause': { icon: '⏸️', label: 'Aufzeichnung pausiert', color: 'linear-gradient(135deg, #f39c12, #e67e22)' },
        'trip_resume': { icon: '▶️', label: 'Aufzeichnung fortgesetzt', color: 'linear-gradient(135deg, #16a085, #1abc9c)' }
    };

    const type = entryTypes[entry.type] || entryTypes['manual'];

    // Format timestamp with user's date format
    const time = typeof formatDateTime === 'function'
        ? formatDateTime(new Date(entry.timestamp))
        : new Date(entry.timestamp).toLocaleString('de-DE');

    // Weather display with proper icons
    let weatherHtml = '';
    if (entry.weather) {
        const w = entry.weather;
        const weatherIcon = getWeatherIcon(w.description);
        const windIcon = getWindArrow(w.wind_deg);
        weatherHtml = `
            <div class="entry-weather">
                <div class="weather-item">
                    <div class="weather-icon">${weatherIcon}</div>
                    <div class="weather-info">
                        <div class="weather-value">${w.temp ? w.temp.toFixed(1) : 'N/A'}°C</div>
                        <div class="weather-label">${w.description || 'Keine Daten'}</div>
                    </div>
                </div>
                ${w.wind_speed ? `
                <div class="weather-item">
                    <div class="weather-icon wind-arrow">${windIcon}</div>
                    <div class="weather-info">
                        <div class="weather-value">${typeof formatSpeed === 'function' ? formatSpeed(w.wind_speed) : w.wind_speed.toFixed(1) + ' kn'}</div>
                        <div class="weather-label">${getWindDirection(w.wind_deg)}</div>
                    </div>
                </div>` : ''}
            </div>`;
    }

    // Position display
    let positionHtml = '';
    if (entry.position) {
        const lat = entry.position.lat.toFixed(5);
        const lon = entry.position.lon.toFixed(5);
        positionHtml = `<div class="entry-position">📍 ${lat}, ${lon}</div>`;
    }

    // Trip statistics as colorful tiles (for trip_end)
    let statsHtml = '';
    if (entry.type === 'trip_end' && entry.points) {
        // Format distance with units
        const distanceFormatted = typeof formatDistance === 'function'
            ? formatDistance(parseFloat(entry.distance) * 1852)  // Convert NM to meters
            : `${entry.distance} NM`;

        statsHtml = `
            <div class="entry-stats-grid">
                <div class="stat-tile" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${entry.points}</div>
                    <div class="stat-label">Punkte</div>
                </div>
                <div class="stat-tile" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                    <div class="stat-icon">📏</div>
                    <div class="stat-value">${distanceFormatted}</div>
                    <div class="stat-label"></div>
                </div>
                <div class="stat-tile" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
                    <div class="stat-icon">⏱️</div>
                    <div class="stat-value">${entry.duration}</div>
                    <div class="stat-label">Dauer</div>
                </div>
            </div>`;
    }

    // Actions
    let actionsHtml = '';
    if (entry.type === 'trip_end' && entry.track_data) {
        actionsHtml = `
            <div class="entry-actions">
                <button class="entry-btn small" onclick="exportTrack(${entry.id})">💾 GPX</button>
                <button class="entry-btn small" onclick="viewTrackOnMap(${entry.id})">🗺️ Karte</button>
                <button class="entry-btn small delete" onclick="deleteLogbookEntry(${entry.id})">🗑️</button>
            </div>`;
    } else {
        actionsHtml = `
            <div class="entry-actions">
                <button class="entry-btn small delete" onclick="deleteLogbookEntry(${entry.id})">🗑️</button>
            </div>`;
    }

    return `
        <div class="logbook-entry" data-type="${entry.type}">
            <div class="timeline-marker"></div>
            <div class="entry-content">
                <div class="entry-header">
                    <div class="entry-icon" style="background: ${type.color}">${type.icon}</div>
                    <div class="entry-header-text">
                        <div class="entry-title">${type.label}</div>
                        <div class="entry-time">${time}</div>
                    </div>
                </div>
                ${entry.notes ? `<div class="entry-notes">${entry.notes}</div>` : ''}
                ${positionHtml}
                ${weatherHtml}
                ${statsHtml}
                ${actionsHtml}
            </div>
        </div>
    `;
}

function getWeatherIcon(description) {
    if (!description) return '🌡️';
    const desc = description.toLowerCase();
    if (desc.includes('clear') || desc.includes('klar')) return '☀️';
    if (desc.includes('cloud') || desc.includes('bewölkt') || desc.includes('wolke')) return '☁️';
    if (desc.includes('rain') || desc.includes('regen')) return '🌧️';
    if (desc.includes('storm') || desc.includes('gewitter')) return '⛈️';
    if (desc.includes('snow') || desc.includes('schnee')) return '🌨️';
    if (desc.includes('fog') || desc.includes('nebel')) return '🌫️';
    if (desc.includes('wind')) return '💨';
    return '🌡️';
}

function getWindArrow(deg) {
    if (!deg && deg !== 0) return '↑';
    // Wind arrow pointing FROM direction (meteorological convention)
    const arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    const index = Math.round(deg / 45) % 8;
    return arrows[index];
}

function getWindDirection(deg) {
    if (!deg && deg !== 0) return '';
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(deg / 22.5) % 16;
    return directions[index];
}

async function updateTrackStatus() {
    try {
        const response = await fetch(`${getAPI()}/api/track/status`);
        const status = await response.json();
        document.getElementById("track-points").textContent = status.points;

        // Format distance with units
        const distanceFormatted = typeof formatDistance === 'function'
            ? formatDistance(parseFloat(status.distance) * 1852)  // Convert NM to meters
            : `${status.distance} NM`;
        document.getElementById("track-distance").innerHTML = `${distanceFormatted} <span style="font-size:16px"></span>`;
        if (status.recording) {
            document.getElementById("recording-indicator").style.display = "block";
            document.getElementById("btn-track-start").disabled = true;
            document.getElementById("btn-track-stop").disabled = false;
            
            // Handle pause/resume buttons
            if (status.paused) {
                document.getElementById("btn-track-pause").disabled = true;
                document.getElementById("btn-track-resume").disabled = false;
            } else {
                document.getElementById("btn-track-pause").disabled = false;
                document.getElementById("btn-track-resume").disabled = true;
            }
        } else {
            document.getElementById("recording-indicator").style.display = "none";
            document.getElementById("btn-track-start").disabled = false;
            document.getElementById("btn-track-stop").disabled = true;
            document.getElementById("btn-track-pause").disabled = true;
            document.getElementById("btn-track-resume").disabled = true;
        }
    } catch (error) {
        console.error("Error updating track status:", error);
    }
}

async function startTrackRecording() {
    // Show crew selection modal first
    await showCrewSelectionModal();
}

async function showCrewSelectionModal() {
    try {
        // Load crew members from backend
        const response = await fetch(`${getAPI()}/api/crew`);
        const crewMembers = await response.json();

        // Create modal HTML
        const modalHtml = `
            <div id="crew-selection-modal" class="modal active">
                <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2>👥 Crew auswählen</h2>
                        <button onclick="closeCrewSelectionModal()" class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p style="margin-bottom: 15px;">Wer ist bei dieser Fahrt dabei?</p>
                        ${crewMembers.length > 0 ? `
                            <div class="crew-selection-list">
                                ${crewMembers.map(member => `
                                    <label class="crew-selection-item">
                                        <input type="checkbox" name="crew" value="${member.id}">
                                        <div class="crew-selection-info">
                                            <div class="crew-selection-name">${member.name}</div>
                                            <div class="crew-selection-role crew-role-${member.role.toLowerCase()}">${member.role}</div>
                                        </div>
                                    </label>
                                `).join('')}
                            </div>
                        ` : `
                            <div class="empty-state-small">
                                Keine Crew-Mitglieder verfügbar.<br>
                                Füge zuerst Crew-Mitglieder hinzu.
                            </div>
                        `}
                    </div>
                    <div class="modal-footer">
                        <button onclick="closeCrewSelectionModal()" class="btn btn-secondary">Abbrechen</button>
                        <button onclick="confirmStartTrackRecording()" class="btn btn-primary">Fahrt starten</button>
                    </div>
                </div>
            </div>
        `;

        // Add modal to body
        const existingModal = document.getElementById('crew-selection-modal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalHtml);

    } catch (error) {
        console.error("Error loading crew:", error);
        // Start without crew selection if loading fails
        confirmStartTrackRecording();
    }
}

function closeCrewSelectionModal() {
    const modal = document.getElementById('crew-selection-modal');
    if (modal) {
        modal.remove();
    }
}

async function confirmStartTrackRecording() {
    try {
        // Get selected crew members
        const checkboxes = document.querySelectorAll('#crew-selection-modal input[name="crew"]:checked');
        const crewIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        // Close modal
        closeCrewSelectionModal();

        // Start recording with crew_ids
        const response = await fetch(`${getAPI()}/api/track/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ crew_ids: crewIds })
        });
        const result = await response.json();
        if (typeof showMsg === 'function') showMsg("🚢 Fahrt gestartet - Track-Aufzeichnung läuft");
        updateTrackStatus();
        loadLogbookEntries(); // Reload to show the trip_start entry
    } catch (error) {
        console.error("Error starting track:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Starten der Aufzeichnung");
    }
}

async function stopTrackRecording() {
    try {
        const response = await fetch(`${getAPI()}/api/track/stop`, { method: "POST" });
        const result = await response.json();
        if (result.distance) {
            // Format distance with units
            const distanceFormatted = typeof formatDistance === 'function'
                ? formatDistance(parseFloat(result.distance) * 1852)  // Convert NM to meters
                : `${result.distance} NM`;
            if (typeof showMsg === 'function') showMsg(`⚓ Fahrt beendet - ${distanceFormatted} aufgezeichnet`);
        } else {
            if (typeof showMsg === 'function') showMsg("⚓ Fahrt beendet");
        }
        updateTrackStatus();
        loadLogbookEntries(); // Reload to show the trip_end entry
    } catch (error) {
        console.error("Error stopping track:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Beenden der Aufzeichnung");
    }
}

async function pauseTrackRecording() {
    try {
        const response = await fetch(`${getAPI()}/api/track/pause`, { method: "POST" });
        const result = await response.json();
        if (typeof showMsg === 'function') showMsg("⏸️ Aufzeichnung pausiert");
        updateTrackStatus();
        loadLogbookEntries();
    } catch (error) {
        console.error("Error pausing track:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Pausieren");
    }
}

async function resumeTrackRecording() {
    try {
        const response = await fetch(`${getAPI()}/api/track/resume`, { method: "POST" });
        const result = await response.json();
        if (typeof showMsg === 'function') showMsg("▶️ Aufzeichnung fortgesetzt");
        updateTrackStatus();
        loadLogbookEntries();
    } catch (error) {
        console.error("Error resuming track:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Fortsetzen");
    }
}

async function exportTrack(entryId) {
    try {
        window.open(`${getAPI()}/api/track/export/${entryId}`, "_blank");
        if (typeof showMsg === 'function') showMsg("💾 Downloading GPX file...");
    } catch (error) {
        console.error("Error exporting track:", error);
    }
}

async function viewTrackOnMap(entryId) {
    try {
        // Fetch track data from backend
        const response = await fetch(`${getAPI()}/api/logbook/${entryId}`);
        if (!response.ok) {
            if (typeof showMsg === 'function') showMsg("❌ Fehler beim Laden des Tracks");
            return;
        }

        const entry = await response.json();

        // Check if track_data exists
        if (!entry.track_data || entry.track_data.length === 0) {
            if (typeof showMsg === 'function') showMsg("⚠️ Keine Track-Daten verfügbar");
            return;
        }

        // Close logbook modal
        closeLogbook();

        // Draw track on map
        if (typeof window.showTrackOnMap === 'function') {
            window.showTrackOnMap(entry.track_data, entry);
            if (typeof showMsg === 'function') showMsg(`🗺️ Track angezeigt: ${entry.track_data.length} Punkte`);
        } else {
            if (typeof showMsg === 'function') showMsg("❌ Map-Funktion nicht verfügbar");
        }

    } catch (error) {
        console.error("Error viewing track:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Anzeigen des Tracks");
    }
}

function openManualEntryModal() {
    document.getElementById("manual-entry-modal").classList.add("active");
}

function closeManualEntryModal() {
    document.getElementById("manual-entry-modal").classList.remove("active");
    document.getElementById("manual-entry-form").reset();
}

async function submitManualEntry() {
    const notes = document.getElementById("manual-entry-notes").value;
    const includeWeather = document.getElementById("manual-entry-weather").checked;

    if (!notes || notes.trim() === '') {
        if (typeof showMsg === 'function') showMsg("⚠️ Bitte Notizen eingeben");
        return;
    }

    try {
        const response = await fetch(`${getAPI()}/api/logbook`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                type: "manual",
                notes: notes.trim(),
                include_weather: includeWeather
            })
        });

        if (response.ok) {
            if (typeof showMsg === 'function') showMsg("✅ Logbuch-Eintrag erstellt");
            closeManualEntryModal();
            loadLogbookEntries();
        } else {
            if (typeof showMsg === 'function') showMsg("❌ Fehler beim Erstellen des Eintrags");
        }
    } catch (error) {
        console.error("Error creating manual entry:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Erstellen des Eintrags");
    }
}

async function deleteLogbookEntry(entryId) {
    if (!confirm("Eintrag wirklich löschen?")) {
        return;
    }

    try {
        const response = await fetch(`${getAPI()}/api/logbook/${entryId}`, {
            method: "DELETE"
        });

        if (response.ok) {
            if (typeof showMsg === 'function') showMsg("🗑️ Eintrag gelöscht");
            loadLogbookEntries();
        } else {
            if (typeof showMsg === 'function') showMsg("❌ Fehler beim Löschen");
        }
    } catch (error) {
        console.error("Error deleting entry:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Löschen");
    }
}

document.addEventListener("click", function(e) {
    if (e.target.id === "logbook-modal") closeLogbook();
    if (e.target.id === "manual-entry-modal") closeManualEntryModal();
    if (e.target.id === "trip-details-modal") closeTripDetails();
});

// Tab switching
function switchLogbookTab(tab) {
    // Update tab buttons
    document.querySelectorAll('.logbook-tab').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.logbook-tab-content').forEach(content => content.classList.remove('active'));
    document.getElementById('logbook-tab-' + tab).classList.add('active');
    
    // Load trips when switching to archive tab
    if (tab === 'archive') {
        loadArchivedTrips();
    }
}

async function loadArchivedTrips() {
    try {
        const response = await fetch(getAPI() + '/api/logbook/trips');
        const trips = await response.json();
        const container = document.getElementById("trips-list");
        
        if (trips.length === 0) {
            container.innerHTML = '<div class="empty-trips">Noch keine archivierten Fahrten</div>';
            return;
        }
        
        container.innerHTML = trips.reverse().map(trip => renderTripCard(trip)).join("");
    } catch (error) {
        console.error("Error loading trips:", error);
    }
}

function renderTripCard(trip) {
    const startDate = new Date(trip.trip_start);
    const endDate = new Date(trip.trip_end);

    // Format date with user's date format
    const dateStr = typeof formatDate === 'function'
        ? formatDate(startDate)
        : startDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    // Format times (always show time in HH:MM format)
    const startTime = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

    // Format distance with units
    const distanceFormatted = typeof formatDistance === 'function'
        ? formatDistance(parseFloat(trip.distance || 0) * 1852)  // Convert NM to meters
        : `${(trip.distance || 0)} NM`;

    // Crew members display
    let crewHtml = '';
    if (trip.crew_ids && trip.crew_ids.length > 0) {
        crewHtml = '<div class="trip-crew">👥 ' + trip.crew_ids.length + ' Crew</div>';
    }

    return '<div class="trip-card" onclick="viewTripDetails(' + trip.id + ')">' +
        '<div class="trip-header">' +
            '<div>' +
                '<div class="trip-date">🚢 ' + dateStr + '</div>' +
                '<div class="trip-time">' + startTime + ' - ' + endTime + '</div>' +
                crewHtml +
            '</div>' +
        '</div>' +
        '<div class="trip-stats">' +
            '<div class="trip-stat">' +
                '<div class="trip-stat-value">' + distanceFormatted + '</div>' +
                '<div class="trip-stat-label"></div>' +
            '</div>' +
            '<div class="trip-stat">' +
                '<div class="trip-stat-value">' + (trip.duration || '0:00') + '</div>' +
                '<div class="trip-stat-label">Dauer</div>' +
            '</div>' +
            '<div class="trip-stat">' +
                '<div class="trip-stat-value">' + (trip.points || 0) + '</div>' +
                '<div class="trip-stat-label">Punkte</div>' +
            '</div>' +
        '</div>' +
        '<div class="trip-actions" onclick="event.stopPropagation()">' +
            '<button class="entry-btn small" onclick="exportTrip(' + trip.id + ')">💾 GPX</button>' +
            '<button class="entry-btn small" onclick="exportTripPDF(' + trip.id + ')">📄 PDF</button>' +
            '<button class="entry-btn small delete" onclick="deleteTrip(' + trip.id + ')">🗑️ Löschen</button>' +
        '</div>' +
    '</div>';
}

async function viewTripDetails(tripId) {
    try {
        // Fetch trip details from backend
        const response = await fetch(getAPI() + '/api/logbook/trip/' + tripId);
        if (!response.ok) {
            if (typeof showMsg === 'function') showMsg("❌ Fehler beim Laden der Trip-Details");
            return;
        }

        const trip = await response.json();

        // Update modal title with formatted date
        const startDate = new Date(trip.trip_start);
        const dateStr = typeof formatDate === 'function'
            ? formatDate(startDate)
            : startDate.toLocaleDateString('de-DE');
        const title = `Fahrt vom ${dateStr}`;
        document.getElementById('trip-details-title').textContent = title;

        // Update summary stats
        // Format distance with units
        const distanceFormatted = typeof formatDistance === 'function'
            ? formatDistance(parseFloat(trip.distance || 0) * 1852)  // Convert NM to meters
            : `${(trip.distance || 0)} NM`;
        document.getElementById('trip-detail-distance').textContent = distanceFormatted;
        document.getElementById('trip-detail-duration').textContent = trip.duration || '0:00';
        document.getElementById('trip-detail-points').textContent = trip.points || '0';
        document.getElementById('trip-detail-entries').textContent = trip.entries ? trip.entries.length : '0';

        // Render timeline
        const timelineContainer = document.getElementById('trip-details-timeline');
        if (trip.entries && trip.entries.length > 0) {
            timelineContainer.innerHTML = trip.entries.map(entry => renderLogbookEntry(entry)).join("");
        } else {
            timelineContainer.innerHTML = '<div class="empty-logbook">Keine Einträge vorhanden</div>';
        }

        // Show modal
        document.getElementById('trip-details-modal').classList.add('active');

    } catch (error) {
        console.error("Error loading trip details:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Laden der Trip-Details");
    }
}

function closeTripDetails() {
    document.getElementById('trip-details-modal').classList.remove('active');
}

async function exportTrip(tripId) {
    try {
        window.open(getAPI() + '/api/track/export/' + tripId, "_blank");
        if (typeof showMsg === 'function') showMsg("💾 Downloading GPX file...");
    } catch (error) {
        console.error("Error exporting trip:", error);
    }
}


async function exportTripPDF(tripId) {
    try {
        window.open(getAPI() + '/api/trip/pdf/' + tripId, "_blank");
        if (typeof showMsg === 'function') showMsg("📄 Downloading PDF...");
    } catch (error) {
        console.error("Error exporting PDF:", error);
    }
}

async function deleteTrip(tripId) {
    if (!confirm("Trip wirklich löschen?")) {
        return;
    }
    
    try {
        const response = await fetch(getAPI() + '/api/logbook/' + tripId, {
            method: "DELETE"
        });
        
        if (response.ok) {
            if (typeof showMsg === 'function') showMsg("🗑️ Trip gelöscht");
            loadArchivedTrips(); // Reload list
        } else {
            if (typeof showMsg === 'function') showMsg("❌ Fehler beim Löschen");
        }
    } catch (error) {
        console.error("Error deleting trip:", error);
        if (typeof showMsg === 'function') showMsg("❌ Fehler beim Löschen");
    }
}
