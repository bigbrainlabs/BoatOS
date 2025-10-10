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
    const time = new Date(entry.timestamp).toLocaleString('de-DE');

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
                        <div class="weather-value">${w.wind_speed.toFixed(1)} kn</div>
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
        statsHtml = `
            <div class="entry-stats-grid">
                <div class="stat-tile" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${entry.points}</div>
                    <div class="stat-label">Punkte</div>
                </div>
                <div class="stat-tile" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                    <div class="stat-icon">📏</div>
                    <div class="stat-value">${entry.distance}</div>
                    <div class="stat-label">NM</div>
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
        document.getElementById("track-distance").innerHTML = `${status.distance} <span style="font-size:16px">NM</span>`;
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
    try {
        const response = await fetch(`${getAPI()}/api/track/start`, { method: "POST" });
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
            if (typeof showMsg === 'function') showMsg(`⚓ Fahrt beendet - ${result.distance} NM aufgezeichnet`);
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
    closeLogbook();
    if (typeof showMsg === 'function') showMsg("🗺️ Track view - Coming soon!");
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
    
    const dateStr = startDate.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    });
    
    const startTime = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    
    return '<div class="trip-card" onclick="viewTripDetails(' + trip.id + ')">' +
        '<div class="trip-header">' +
            '<div>' +
                '<div class="trip-date">🚢 ' + dateStr + '</div>' +
                '<div class="trip-time">' + startTime + ' - ' + endTime + '</div>' +
            '</div>' +
        '</div>' +
        '<div class="trip-stats">' +
            '<div class="trip-stat">' +
                '<div class="trip-stat-value">' + (trip.distance || 0) + '</div>' +
                '<div class="trip-stat-label">NM</div>' +
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
            '<button class="entry-btn small" onclick="exportTrip(' + trip.id + ')">💾 GPX Export</button>' +
            '<button class="entry-btn small delete" onclick="deleteTrip(' + trip.id + ')">🗑️ Löschen</button>' +
        '</div>' +
    '</div>';
}

function viewTripDetails(tripId) {
    // TODO: Show trip details in a separate modal or expand card
    if (typeof showMsg === 'function') showMsg("🗺️ Trip-Details - Coming soon!");
}

async function exportTrip(tripId) {
    try {
        window.open(getAPI() + '/api/track/export/' + tripId, "_blank");
        if (typeof showMsg === 'function') showMsg("💾 Downloading GPX file...");
    } catch (error) {
        console.error("Error exporting trip:", error);
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
