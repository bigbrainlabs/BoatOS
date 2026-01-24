/**
 * BoatOS Logbook Modul
 * Verwaltet Fahrtenbuch, Trips, und Aufzeichnungen
 *
 * @module logbook
 */

import * as ui from './ui.js';
import * as navigation from './navigation.js';

// ==================== STATE ====================
let context = null;

// ==================== HELPERS ====================

/**
 * Gibt die API URL zurück (relativ für nginx proxy)
 */
export function getApiUrl() {
    return window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';
}

/**
 * Setzt den Kontext für das Logbook-Modul
 */
export function setContext(ctx) {
    context = ctx;
}

// ==================== TRIP MANAGEMENT ====================

/**
 * Fahrt starten - zeigt erst Crew-Auswahl
 */
export async function startTrip() {
    try {
        const response = await fetch(`${getApiUrl()}/api/crew`);
        const crewMembers = await response.json();

        const crewList = document.getElementById('crew-list');
        if (crewList) {
            if (crewMembers.length > 0) {
                crewList.innerHTML = crewMembers.map(member => `
                    <label style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-card); border-radius: 12px; margin-bottom: 8px; cursor: pointer; border: 1px solid var(--border);">
                        <input type="checkbox" name="crew" value="${member.id}" style="width: 20px; height: 20px; accent-color: var(--accent);">
                        <div>
                            <div style="font-weight: 600;">${member.name}</div>
                            <div style="font-size: 12px; color: var(--text-dim);">${member.role}</div>
                        </div>
                    </label>
                `).join('');
            } else {
                crewList.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">Keine Crew-Mitglieder. Fahrt wird ohne Crew gestartet.</div>';
            }
        }

        const modal = document.getElementById('crew-modal');
        if (modal) modal.style.display = 'flex';

    } catch (error) {
        console.log('Crew laden fehlgeschlagen, starte ohne Crew-Auswahl');
        confirmStartTrip();
    }
}

/**
 * Crew-Modal schließen
 */
export function closeCrewModal() {
    const modal = document.getElementById('crew-modal');
    if (modal) modal.style.display = 'none';
}

/**
 * Fahrt tatsächlich starten
 */
export async function confirmStartTrip() {
    try {
        const checkboxes = document.querySelectorAll('#crew-list input[name="crew"]:checked');
        const crewIds = Array.from(checkboxes).map(cb => parseInt(cb.value));

        closeCrewModal();

        const response = await fetch(`${getApiUrl()}/api/track/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crew_ids: crewIds })
        });

        if (response.ok) {
            if (ui.showNotification) {
                ui.showNotification('🚢 Fahrt gestartet - Aufzeichnung läuft', 'success');
            }
            updateTripUI(true, false);
            loadLogEntries();

            // Navigation starten wenn Route vorhanden
            if (context && context.waypoints && context.waypoints.length >= 2) {
                if (navigation.isNavigationActive && !navigation.isNavigationActive()) {
                    if (navigation.toggleNavigation) {
                        navigation.toggleNavigation({
                            waypoints: context.waypoints,
                            showNotification: ui.showNotification,
                            currentPosition: context.currentPosition
                        });
                    }
                }
            }
        } else {
            if (ui.showNotification) {
                ui.showNotification('Fehler beim Starten', 'error');
            }
        }
    } catch (error) {
        console.error('Fehler beim Starten:', error);
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Starten der Fahrt', 'error');
        }
    }
}

/**
 * Fahrt beenden
 */
export async function stopTrip() {
    try {
        // Navigation stoppen
        if (navigation.isNavigationActive && navigation.isNavigationActive()) {
            if (navigation.toggleNavigation) {
                navigation.toggleNavigation({
                    waypoints: context?.waypoints || [],
                    showNotification: ui.showNotification,
                    currentPosition: context?.currentPosition
                });
            }
        }

        const response = await fetch(`${getApiUrl()}/api/track/stop`, { method: 'POST' });
        const result = await response.json();

        if (result.distance) {
            const dist = window.formatDistance
                ? window.formatDistance(parseFloat(result.distance))
                : result.distance + ' NM';
            if (ui.showNotification) {
                ui.showNotification(`⚓ Fahrt beendet - ${dist} aufgezeichnet`, 'success');
            }
        } else {
            if (ui.showNotification) {
                ui.showNotification('⚓ Fahrt beendet', 'info');
            }
        }

        updateTripUI(false, false);

        // Zusammenfassung anzeigen
        const logEntriesContainer = document.getElementById('logEntries');
        if (logEntriesContainer && result) {
            const distFormatted = window.formatDistance
                ? window.formatDistance(parseFloat(result.distance || 0))
                : (result.distance || 0) + ' NM';
            logEntriesContainer.innerHTML = `
                <div style="background: linear-gradient(135deg, var(--accent), var(--success)); border-radius: 12px; padding: 20px; color: white; text-align: center;">
                    <div style="font-size: 32px; margin-bottom: 10px;">⚓</div>
                    <div style="font-size: 18px; font-weight: 600; margin-bottom: 15px;">Fahrt beendet!</div>
                    <div style="display: flex; justify-content: center; gap: 20px;">
                        <div>
                            <div style="font-size: 24px; font-weight: 700;">${distFormatted}</div>
                            <div style="font-size: 12px; opacity: 0.8;">Distanz</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: 700;">${result.duration || '0:00'}</div>
                            <div style="font-size: 12px; opacity: 0.8;">Dauer</div>
                        </div>
                        <div>
                            <div style="font-size: 24px; font-weight: 700;">${result.points || 0}</div>
                            <div style="font-size: 12px; opacity: 0.8;">Punkte</div>
                        </div>
                    </div>
                    <button onclick="BoatOS.showLogbookTab('archive', document.querySelector('#section-logbook .logbook-tab:last-child'))"
                            style="margin-top: 15px; padding: 10px 20px; background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.3); border-radius: 8px; color: white; font-size: 14px; cursor: pointer;">
                        📁 Im Archiv ansehen
                    </button>
                </div>
            `;
        }

        // Archiv aktualisieren
        console.log('Fahrt beendet, lade Archiv...');
        await loadArchivedTrips();
        console.log('Archiv geladen');

        // Zum Logbook-Section wechseln
        if (ui.showSection) {
            const logbookTabBtn = document.querySelector('.sheet-tab[onclick*="logbook"]');
            ui.showSection('logbook', logbookTabBtn);
        }

        // Aktuelle Fahrt Tab auswählen
        const currentTab = document.querySelector('#section-logbook .logbook-tab:first-child');
        if (currentTab) {
            showLogbookTab('current', currentTab);
        }

        // Trip-Statistiken zurücksetzen
        const pointsEl = document.getElementById('trip-points');
        const distEl = document.getElementById('trip-distance');
        const timeEl = document.getElementById('trip-time');
        if (pointsEl) pointsEl.textContent = '0';
        if (distEl) distEl.textContent = '--';
        if (timeEl) timeEl.textContent = '--:--';

    } catch (error) {
        console.error('Fehler beim Beenden:', error);
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Beenden der Fahrt', 'error');
        }
    }
}

/**
 * Fahrt pausieren (Ankern)
 */
export async function pauseTrip() {
    try {
        // Navigation pausieren
        if (navigation.isNavigationActive && navigation.isNavigationActive()) {
            if (navigation.toggleNavigation) {
                navigation.toggleNavigation({
                    waypoints: context?.waypoints || [],
                    showNotification: ui.showNotification,
                    currentPosition: context?.currentPosition
                });
            }
        }

        const response = await fetch(`${getApiUrl()}/api/track/pause`, { method: 'POST' });
        if (response.ok) {
            if (ui.showNotification) {
                ui.showNotification('⏸️ Aufzeichnung pausiert - Anker gesetzt', 'info');
            }
            updateTripUI(true, true);
            loadLogEntries();
        }
    } catch (error) {
        console.error('Fehler beim Pausieren:', error);
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Pausieren', 'error');
        }
    }
}

/**
 * Fahrt fortsetzen
 */
export async function resumeTrip() {
    try {
        const response = await fetch(`${getApiUrl()}/api/track/resume`, { method: 'POST' });
        if (response.ok) {
            if (ui.showNotification) {
                ui.showNotification('▶️ Aufzeichnung fortgesetzt - Anker gelichtet', 'success');
            }
            updateTripUI(true, false);
            loadLogEntries();

            // Navigation fortsetzen wenn Route vorhanden
            if (context && context.waypoints && context.waypoints.length >= 2) {
                if (navigation.isNavigationActive && !navigation.isNavigationActive()) {
                    if (navigation.toggleNavigation) {
                        navigation.toggleNavigation({
                            waypoints: context.waypoints,
                            showNotification: ui.showNotification,
                            currentPosition: context.currentPosition
                        });
                    }
                }
            }
        }
    } catch (error) {
        console.error('Fehler beim Fortsetzen:', error);
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Fortsetzen', 'error');
        }
    }
}

// ==================== MANUAL ENTRIES ====================

/**
 * Manuellen Eintrag erstellen - Modal öffnen
 */
export function addLogEntry() {
    const modal = document.getElementById('manual-entry-modal');
    if (modal) modal.style.display = 'flex';
}

/**
 * Manual Entry Modal schließen
 */
export function closeManualEntryModal() {
    const modal = document.getElementById('manual-entry-modal');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('manual-entry-form');
    if (form) form.reset();
}

/**
 * Manuellen Eintrag speichern
 */
export async function submitManualEntry() {
    const notes = document.getElementById('manual-entry-notes').value;
    const includeWeather = document.getElementById('manual-entry-weather').checked;

    if (!notes || notes.trim() === '') {
        if (ui.showNotification) {
            ui.showNotification('Bitte Notizen eingeben', 'warning');
        }
        return;
    }

    try {
        const response = await fetch(`${getApiUrl()}/api/logbook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'manual',
                notes: notes.trim(),
                include_weather: includeWeather
            })
        });

        if (response.ok) {
            if (ui.showNotification) {
                ui.showNotification('📝 Eintrag gespeichert', 'success');
            }
            closeManualEntryModal();
            loadLogEntries();
        } else {
            if (ui.showNotification) {
                ui.showNotification('Fehler beim Speichern', 'error');
            }
        }
    } catch (error) {
        console.error('Fehler:', error);
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Speichern', 'error');
        }
    }
}

// ==================== UI UPDATES ====================

/**
 * Trip UI aktualisieren
 */
export function updateTripUI(isRecording, isPaused) {
    const startBtn = document.getElementById('btn-start-trip');
    const stopBtn = document.getElementById('btn-stop-trip');
    const pauseBtn = document.getElementById('btn-pause-trip');
    const resumeBtn = document.getElementById('btn-resume-trip');
    const indicator = document.getElementById('recording-indicator-new');
    const pausedBadge = document.getElementById('trip-paused-badge');
    const tripStatus = document.getElementById('trip-status');
    const tripTitle = document.getElementById('trip-title');

    if (isRecording) {
        if (startBtn) startBtn.style.display = 'none';
        if (stopBtn) stopBtn.style.display = 'flex';
        if (indicator) indicator.style.display = 'flex';
        if (tripTitle) tripTitle.textContent = 'Aktive Fahrt';

        if (isPaused) {
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (resumeBtn) resumeBtn.style.display = 'flex';
            if (pausedBadge) pausedBadge.style.display = 'block';
            if (tripStatus) {
                tripStatus.textContent = 'Pausiert (Anker)';
                tripStatus.style.color = 'var(--warning)';
            }
        } else {
            if (pauseBtn) pauseBtn.style.display = 'flex';
            if (resumeBtn) resumeBtn.style.display = 'none';
            if (pausedBadge) pausedBadge.style.display = 'none';
            if (tripStatus) {
                tripStatus.textContent = 'Aufzeichnung läuft';
                tripStatus.style.color = 'var(--success)';
            }
        }
    } else {
        if (startBtn) startBtn.style.display = 'flex';
        if (stopBtn) stopBtn.style.display = 'none';
        if (pauseBtn) pauseBtn.style.display = 'none';
        if (resumeBtn) resumeBtn.style.display = 'none';
        if (indicator) indicator.style.display = 'none';
        if (pausedBadge) pausedBadge.style.display = 'none';
        if (tripStatus) {
            tripStatus.textContent = 'Bereit zum Starten';
            tripStatus.style.color = 'var(--text-dim)';
        }
        if (tripTitle) tripTitle.textContent = 'Keine aktive Fahrt';
    }
}

// ==================== LOG ENTRIES ====================

/**
 * Logbuch-Einträge laden
 */
export async function loadLogEntries() {
    try {
        const response = await fetch(`${getApiUrl()}/api/logbook`);
        const entries = await response.json();
        const container = document.getElementById('logEntries');
        if (!container) return;

        if (entries.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">Noch keine Einträge</div>';
            return;
        }

        // Letzte 10 Einträge anzeigen (neueste zuerst)
        container.innerHTML = entries.slice(-10).reverse().map(entry => renderLogEntry(entry)).join('');
    } catch (error) {
        console.error('Fehler beim Laden der Einträge:', error);
    }
}

/**
 * Einzelnen Eintrag rendern
 */
export function renderLogEntry(entry) {
    const types = {
        'trip_start': { icon: '🚢', label: 'Fahrt gestartet', color: 'var(--success)' },
        'trip_end': { icon: '⚓', label: 'Fahrt beendet', color: 'var(--accent)' },
        'manual': { icon: '📝', label: 'Notiz', color: 'var(--accent)' },
        'trip_pause': { icon: '⏸️', label: 'Pause (Anker)', color: 'var(--warning)' },
        'trip_resume': { icon: '▶️', label: 'Fortgesetzt', color: 'var(--success)' }
    };
    const type = types[entry.type] || types['manual'];
    const time = new Date(entry.timestamp).toLocaleString('de-DE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });

    let weatherHtml = '';
    if (entry.weather) {
        const w = entry.weather;
        const windFormatted = window.formatSpeed ? window.formatSpeed(w.wind_speed || 0, 0) : `${w.wind_speed?.toFixed(0) || '--'} kn`;
        weatherHtml = `<div style="font-size: 12px; color: var(--text-dim); margin-top: 4px;">🌡️ ${w.temp?.toFixed(1) || '--'}°C | 💨 ${windFormatted}</div>`;
    }

    return `
        <div style="display: flex; gap: 12px; padding: 12px; background: var(--bg-card); border-radius: 12px; margin-bottom: 8px; border-left: 3px solid ${type.color};">
            <div style="font-size: 24px;">${type.icon}</div>
            <div style="flex: 1;">
                <div style="font-weight: 600; font-size: 14px;">${type.label}</div>
                <div style="font-size: 12px; color: var(--text-dim);">${time}</div>
                ${entry.notes ? `<div style="font-size: 13px; margin-top: 6px;">${entry.notes}</div>` : ''}
                ${weatherHtml}
            </div>
        </div>
    `;
}

// ==================== TABS ====================

/**
 * Logbuch-Tab wechseln
 */
export function showLogbookTab(tab, element) {
    // Tabs aktualisieren
    document.querySelectorAll('#section-logbook .logbook-tab').forEach(t => t.classList.remove('active'));
    if (element) element.classList.add('active');

    // Content wechseln
    const currentTab = document.getElementById('logbook-tab-current');
    const archiveTab = document.getElementById('logbook-tab-archive');

    if (currentTab) currentTab.style.display = tab === 'current' ? 'block' : 'none';
    if (archiveTab) archiveTab.style.display = tab === 'archive' ? 'block' : 'none';

    // Archiv laden
    if (tab === 'archive') {
        loadArchivedTrips();
    }
}

// ==================== ARCHIVE ====================

/**
 * Archivierte Fahrten laden
 */
export async function loadArchivedTrips() {
    try {
        const apiUrl = getApiUrl();
        console.log('Lade archivierte Fahrten von:', apiUrl + '/api/logbook/trips');
        const response = await fetch(`${apiUrl}/api/logbook/trips`);
        console.log('API Response Status:', response.status);
        const trips = await response.json();
        console.log('Geladene Fahrten:', trips);

        const container = document.getElementById('trips-list');
        if (!container) {
            console.log('Container trips-list nicht gefunden!');
            return;
        }

        if (!trips || trips.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">Noch keine archivierten Fahrten</div>';
            return;
        }

        // Trips rendern (neueste zuerst)
        const sortedTrips = [...trips].reverse();
        console.log('Sortierte Fahrten:', sortedTrips.length);
        container.innerHTML = sortedTrips.map(trip => {
            try {
                return renderTripCard(trip);
            } catch (e) {
                console.error('Fehler beim Rendern von Trip:', trip, e);
                return '';
            }
        }).join('');
    } catch (error) {
        console.error('Fehler beim Laden der Fahrten:', error);
        const container = document.getElementById('trips-list');
        if (container) container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--text-dim);">Fehler beim Laden</div>';
    }
}

/**
 * Trip-Card rendern
 */
export function renderTripCard(trip) {
    const startDate = new Date(trip.trip_start);
    const dateStr = startDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = startDate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    const dist = window.formatDistance ? window.formatDistance(parseFloat(trip.distance || 0)) : (trip.distance || 0) + ' NM';

    return `
        <div style="background: var(--bg-card); border-radius: 12px; padding: 15px; border: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <div>
                    <div style="font-size: 16px; font-weight: 600;">🚢 ${dateStr}</div>
                    <div style="font-size: 12px; color: var(--text-dim);">${timeStr} Uhr</div>
                </div>
                ${trip.crew_ids?.length ? `<div style="font-size: 12px; color: var(--text-dim);">👥 ${trip.crew_ids.length}</div>` : ''}
            </div>
            <div style="display: flex; gap: 15px; margin-bottom: 12px;">
                <div><span style="font-size: 18px; font-weight: 700; color: var(--accent);">${dist}</span></div>
                <div><span style="font-size: 18px; font-weight: 700; color: var(--accent);">${trip.duration || '0:00'}</span> <span style="font-size: 12px; color: var(--text-dim);">Dauer</span></div>
                <div><span style="font-size: 18px; font-weight: 700; color: var(--accent);">${trip.points || 0}</span> <span style="font-size: 12px; color: var(--text-dim);">Punkte</span></div>
            </div>
            <div style="display: flex; gap: 8px;">
                <button onclick="BoatOS.exportTrip(${trip.id})" style="flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-panel); color: var(--text); font-size: 12px; cursor: pointer;">💾 GPX</button>
                <button onclick="BoatOS.viewTripOnMap(${trip.id})" style="flex: 1; padding: 8px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg-panel); color: var(--text); font-size: 12px; cursor: pointer;">🗺️ Karte</button>
                <button onclick="BoatOS.deleteTrip(${trip.id})" style="padding: 8px 12px; border: 1px solid var(--danger); border-radius: 8px; background: transparent; color: var(--danger); font-size: 12px; cursor: pointer;">🗑️</button>
            </div>
        </div>
    `;
}

// ==================== TRIP ACTIONS ====================

/**
 * GPX exportieren
 */
export function exportTrip(tripId) {
    window.open(`${getApiUrl()}/api/track/export/${tripId}`, '_blank');
    if (ui.showNotification) {
        ui.showNotification('💾 GPX-Download gestartet', 'info');
    }
}

/**
 * Track auf Karte anzeigen
 */
export async function viewTripOnMap(tripId) {
    try {
        const response = await fetch(`${getApiUrl()}/api/logbook/${tripId}`);
        const entry = await response.json();

        if (!entry.track_data || entry.track_data.length === 0) {
            if (ui.showNotification) {
                ui.showNotification('Keine Track-Daten verfügbar', 'warning');
            }
            return;
        }

        // TODO: Track auf Karte zeichnen
        if (ui.showNotification) {
            ui.showNotification(`🗺️ Track mit ${entry.track_data.length} Punkten`, 'info');
        }
    } catch (error) {
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Laden', 'error');
        }
    }
}

/**
 * Fahrt löschen
 */
export async function deleteTrip(tripId) {
    if (!confirm('Diese Fahrt wirklich löschen?')) return;

    try {
        const response = await fetch(`${getApiUrl()}/api/logbook/${tripId}`, { method: 'DELETE' });
        if (response.ok) {
            if (ui.showNotification) {
                ui.showNotification('🗑️ Fahrt gelöscht', 'info');
            }
            loadArchivedTrips();
        }
    } catch (error) {
        if (ui.showNotification) {
            ui.showNotification('Fehler beim Löschen', 'error');
        }
    }
}
