// ==================== LOGBOOK ====================
// Use API and showMsg from app.js (global scope)
const getAPI = () => window.location.hostname === 'localhost' ? 'http://localhost:8000' : `http://${window.location.hostname}:8000`;
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
            container.innerHTML = '<div class="empty-logbook">No tracks recorded yet</div>';
            return;
        }
        container.innerHTML = entries.reverse().map(entry => `
            <div class="logbook-entry">
                <div class="entry-header">
                    <div class="entry-title">🛤️ Track ${entry.id}</div>
                    <div class="entry-time">${new Date(entry.timestamp).toLocaleString()}</div>
                </div>
                <div class="entry-details">
                    <span>📍 ${entry.points} Points</span>
                    <span>📏 ${entry.distance} NM</span>
                    <span>⏱️ ${entry.duration}</span>
                </div>
                <div class="entry-actions">
                    <button class="entry-btn" onclick="exportTrack(${entry.id})">💾 Export GPX</button>
                    <button class="entry-btn" onclick="viewTrackOnMap(${entry.id})">🗺️ View on Map</button>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error("Error loading logbook:", error);
    }
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
        } else {
            document.getElementById("recording-indicator").style.display = "none";
            document.getElementById("btn-track-start").disabled = false;
            document.getElementById("btn-track-stop").disabled = true;
        }
    } catch (error) {
        console.error("Error updating track status:", error);
    }
}

async function startTrackRecording() {
    try {
        await fetch(`${getAPI()}/api/track/start`, { method: "POST" });
        if (typeof showMsg === 'function') showMsg("🎬 Track recording started");
        updateTrackStatus();
    } catch (error) {
        console.error("Error starting track:", error);
    }
}

async function stopTrackRecording() {
    try {
        const response = await fetch(`${getAPI()}/api/track/stop`, { method: "POST" });
        const result = await response.json();
        if (typeof showMsg === 'function') showMsg(`⏹️ Track stopped - ${result.distance} NM recorded`);
        updateTrackStatus();
        loadLogbookEntries();
    } catch (error) {
        console.error("Error stopping track:", error);
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

document.addEventListener("click", function(e) {
    if (e.target.id === "logbook-modal") closeLogbook();
});
