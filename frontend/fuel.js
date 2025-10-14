/**
 * Fuel Tracking Module
 * Handles fuel refills, consumption tracking, and cost calculations
 */

const FUEL_API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

let fuelEntries = [];
let fuelModalOpen = false;
let userSettings = null;
let fuelTrendChart = null;

// Conversion factors
const NM_TO_KM = 1.852;
const KM_TO_NM = 1 / 1.852;

// ==================== API Functions ====================

async function loadUserSettings() {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/settings`);
        userSettings = await response.json();
        return userSettings;
    } catch (error) {
        console.error('Error loading settings:', error);
        return null;
    }
}

function getDistanceUnit() {
    return userSettings?.general?.distanceUnit || 'nm';
}

function convertDistance(distanceNM) {
    const unit = getDistanceUnit();
    if (unit === 'km') {
        return distanceNM * NM_TO_KM;
    }
    return distanceNM;
}

function getDistanceUnitLabel() {
    const unit = getDistanceUnit();
    return unit === 'km' ? 'km' : 'NM';
}

function getConsumptionUnitLabel() {
    const unit = getDistanceUnit();
    return unit === 'km' ? 'L/100km' : 'L/NM';
}

function convertConsumption(consumptionPerNM) {
    const unit = getDistanceUnit();
    if (unit === 'km') {
        // Convert L/NM to L/100km
        // 1 NM = 1.852 km
        // L/NM * (1 NM / 1.852 km) * 100 km = L/100km
        return (consumptionPerNM / NM_TO_KM) * 100;
    }
    return consumptionPerNM;
}

async function loadFuelEntries() {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel`);
        fuelEntries = await response.json();
        updateFuelUI();
        return fuelEntries;
    } catch (error) {
        console.error('Error loading fuel entries:', error);
        return [];
    }
}

async function addFuelEntry(liters, pricePerLiter, location, odometer, notes, position) {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                liters,
                price_per_liter: pricePerLiter,
                location,
                odometer,
                notes,
                position
            })
        });
        const newEntry = await response.json();

        if (!newEntry.error) {
            fuelEntries.push(newEntry);
            updateFuelUI();
            return newEntry;
        }
        return null;
    } catch (error) {
        console.error('Error adding fuel entry:', error);
        return null;
    }
}

async function updateFuelEntry(id, updates) {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        const updated = await response.json();

        if (!updated.error) {
            const index = fuelEntries.findIndex(e => e.id === id);
            if (index !== -1) {
                fuelEntries[index] = updated;
            }
            updateFuelUI();
            return updated;
        }
        return null;
    } catch (error) {
        console.error('Error updating fuel entry:', error);
        return null;
    }
}

async function deleteFuelEntry(id) {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();

        if (result.status === 'deleted') {
            fuelEntries = fuelEntries.filter(e => e.id !== id);
            updateFuelUI();
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error deleting fuel entry:', error);
        return false;
    }
}

async function getFuelStats(days = 30) {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel/stats?days=${days}`);
        return await response.json();
    } catch (error) {
        console.error('Error loading fuel stats:', error);
        return null;
    }
}

// ==================== UI Functions ====================

function updateFuelUI() {
    const fuelList = document.getElementById('fuel-list');
    if (!fuelList) return;

    if (fuelEntries.length === 0) {
        fuelList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⛽</div>
                <div class="empty-text">Keine Tankungen</div>
                <div class="empty-subtext">Erfasse deine erste Tankung</div>
            </div>
        `;
        return;
    }

    // Sort by timestamp descending
    const sorted = [...fuelEntries].sort((a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    fuelList.innerHTML = sorted.map(entry => {
        const date = new Date(entry.timestamp);
        const dateStr = date.toLocaleDateString('de-DE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const timeStr = date.toLocaleTimeString('de-DE', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="fuel-card" data-id="${entry.id}">
                <div class="fuel-card-header">
                    <div class="fuel-info">
                        <div class="fuel-date">${dateStr} ${timeStr}</div>
                        <div class="fuel-location">${entry.location || 'Unbekannt'}</div>
                    </div>
                    <div class="fuel-cost">${entry.total_cost.toFixed(2)} ${entry.currency}</div>
                </div>
                <div class="fuel-card-body">
                    <div class="fuel-detail">
                        <span class="fuel-detail-icon">⛽</span>
                        <span class="fuel-detail-text">${entry.liters.toFixed(1)} L</span>
                    </div>
                    <div class="fuel-detail">
                        <span class="fuel-detail-icon">💰</span>
                        <span class="fuel-detail-text">${entry.price_per_liter.toFixed(3)} ${entry.currency}/L</span>
                    </div>
                    ${entry.odometer ? `
                    <div class="fuel-detail">
                        <span class="fuel-detail-icon">📏</span>
                        <span class="fuel-detail-text">${convertDistance(entry.odometer).toFixed(1)} ${getDistanceUnitLabel()}</span>
                    </div>
                    ` : ''}
                    ${entry.notes ? `
                    <div class="fuel-notes">${entry.notes}</div>
                    ` : ''}
                </div>
                <div class="fuel-card-actions">
                    <button class="fuel-action-btn" onclick="editFuelEntry(${entry.id})" title="Bearbeiten">✏️</button>
                    <button class="fuel-action-btn" onclick="deleteFuelEntryConfirm(${entry.id})" title="Löschen">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

function showFuelModal(entry = null) {
    const modal = document.getElementById('fuel-modal');
    const form = document.getElementById('fuel-form');
    const title = document.getElementById('fuel-modal-title');

    if (entry) {
        title.textContent = 'Tankung bearbeiten';
        document.getElementById('fuel-liters').value = entry.liters;
        document.getElementById('fuel-price').value = entry.price_per_liter;
        document.getElementById('fuel-location').value = entry.location || '';
        document.getElementById('fuel-odometer').value = entry.odometer || '';
        document.getElementById('fuel-notes').value = entry.notes || '';
        form.dataset.editId = entry.id;
    } else {
        title.textContent = 'Neue Tankung';
        form.reset();
        delete form.dataset.editId;
    }

    modal.style.display = 'flex';
    fuelModalOpen = true;
}

function hideFuelModal() {
    document.getElementById('fuel-modal').style.display = 'none';
    fuelModalOpen = false;
}

function editFuelEntry(id) {
    const entry = fuelEntries.find(e => e.id === id);
    if (entry) {
        showFuelModal(entry);
    }
}

async function deleteFuelEntryConfirm(id) {
    const entry = fuelEntries.find(e => e.id === id);
    if (!entry) return;

    const date = new Date(entry.timestamp).toLocaleDateString('de-DE');
    if (confirm(`Tankung vom ${date} wirklich löschen?`)) {
        const success = await deleteFuelEntry(id);
        if (success) {
            console.log('✅ Fuel entry deleted');
        }
    }
}

async function handleFuelFormSubmit(event) {
    event.preventDefault();

    const form = event.target;
    const liters = parseFloat(document.getElementById('fuel-liters').value);
    const pricePerLiter = parseFloat(document.getElementById('fuel-price').value);
    const location = document.getElementById('fuel-location').value.trim();
    const odometer = document.getElementById('fuel-odometer').value;
    const notes = document.getElementById('fuel-notes').value.trim();

    if (!liters || !pricePerLiter) {
        alert('Bitte Menge und Preis eingeben');
        return;
    }

    const editId = form.dataset.editId;

    if (editId) {
        // Update existing entry
        const updates = {
            liters,
            price_per_liter: pricePerLiter,
            location,
            notes
        };
        if (odometer) {
            updates.odometer = parseFloat(odometer);
        }

        const updated = await updateFuelEntry(parseInt(editId), updates);
        if (updated) {
            console.log('✅ Fuel entry updated');
            hideFuelModal();
        }
    } else {
        // Add new entry
        const newEntry = await addFuelEntry(
            liters,
            pricePerLiter,
            location,
            odometer ? parseFloat(odometer) : 0,
            notes,
            null // Position will be auto-filled by backend
        );
        if (newEntry) {
            console.log('✅ Fuel entry added');
            hideFuelModal();
        }
    }
}

// ==================== Panel Functions ====================

async function showFuelPanel() {
    hideAllPanels();
    const panel = document.getElementById('fuel-panel');
    if (panel) {
        panel.style.display = 'block';
        await loadUserSettings();
        loadFuelEntries();
        updateFuelStats();
        updateFuelTrendChart();
    }
}

function hideFuelPanel() {
    const panel = document.getElementById('fuel-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

async function updateFuelStats() {
    const stats = await getFuelStats(30);
    if (!stats) return;

    // Also load consumption stats
    const consumption = await getConsumptionStats();

    const statsContainer = document.getElementById('fuel-stats');
    if (!statsContainer) return;

    let consumptionHtml = '';
    if (consumption && consumption.trips_analyzed > 0) {
        const distUnit = getDistanceUnitLabel();
        const consUnit = getConsumptionUnitLabel();
        const avgConsumption = convertConsumption(consumption.avg_consumption_per_nm);
        const estimatedRange = convertDistance(consumption.estimated_range_nm);
        const totalDistance = convertDistance(consumption.total_distance_with_fuel);

        consumptionHtml = `
            <div class="consumption-section">
                <h4 style="margin: 20px 0 15px 0; color: #64ffda;">⛽ Verbrauchsanalyse</h4>
                <div class="stats-grid">
                    <div class="stat-card stat-card-highlight">
                        <div class="stat-label">Ø Verbrauch</div>
                        <div class="stat-value">${avgConsumption.toFixed(2)} <span class="stat-unit">${consUnit}</span></div>
                    </div>
                    <div class="stat-card stat-card-highlight">
                        <div class="stat-label">Ø Verbrauch/Stunde</div>
                        <div class="stat-value">${consumption.avg_consumption_per_hour.toFixed(2)} <span class="stat-unit">L/h</span></div>
                    </div>
                    <div class="stat-card stat-card-highlight">
                        <div class="stat-label">Geschätzte Reichweite</div>
                        <div class="stat-value">${estimatedRange.toFixed(0)} <span class="stat-unit">${distUnit}</span></div>
                        <div class="stat-subtext">bei ${consumption.tank_capacity_l}L Tank</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Gesamt getankt</div>
                        <div class="stat-value">${consumption.total_fuel_consumed.toFixed(1)} <span class="stat-unit">L</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Gesamt gefahren</div>
                        <div class="stat-value">${totalDistance.toFixed(1)} <span class="stat-unit">${distUnit}</span></div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Fahrten analysiert</div>
                        <div class="stat-value">${consumption.trips_analyzed}</div>
                    </div>
                </div>
            </div>
        `;
    }

    statsContainer.innerHTML = `
        <h4 style="margin: 0 0 15px 0; color: #64ffda;">📊 Tankungen-Statistik</h4>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Tankungen (30 Tage)</div>
                <div class="stat-value">${stats.recent_entries}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Liter (30 Tage)</div>
                <div class="stat-value">${stats.recent_liters.toFixed(1)} <span class="stat-unit">L</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Kosten (30 Tage)</div>
                <div class="stat-value">${stats.recent_cost.toFixed(2)} <span class="stat-unit">${stats.currency}</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ø Preis</div>
                <div class="stat-value">${stats.avg_price_per_liter.toFixed(3)} <span class="stat-unit">${stats.currency}/L</span></div>
            </div>
        </div>
        ${consumptionHtml}
    `;
}

async function getConsumptionStats() {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel/consumption`);
        return await response.json();
    } catch (error) {
        console.error('Error loading consumption stats:', error);
        return null;
    }
}

async function getConsumptionTrend(months = 6) {
    try {
        const response = await fetch(`${FUEL_API_URL}/api/fuel/consumption/trend?months=${months}`);
        return await response.json();
    } catch (error) {
        console.error('Error loading consumption trend:', error);
        return null;
    }
}

async function updateFuelTrendChart() {
    const trendData = await getConsumptionTrend(6);
    if (!trendData || trendData.length === 0) {
        document.getElementById('fuel-chart-container').style.display = 'none';
        return;
    }

    document.getElementById('fuel-chart-container').style.display = 'block';

    const ctx = document.getElementById('fuel-trend-chart');
    if (!ctx) return;

    const distUnit = getDistanceUnitLabel();
    const consUnit = getConsumptionUnitLabel();

    // Prepare data
    const labels = trendData.map(m => m.month_name.split(' ')[0]); // Extract month name only
    const distances = trendData.map(m => convertDistance(m.distance_nm));
    const fuelUsed = trendData.map(m => m.fuel_liters);
    const consumption = trendData.map(m => convertConsumption(m.consumption_per_nm));

    // Destroy existing chart if it exists
    if (fuelTrendChart) {
        fuelTrendChart.destroy();
    }

    // Create new chart
    fuelTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `Verbrauch (${consUnit})`,
                    data: consumption,
                    borderColor: '#64ffda',
                    backgroundColor: 'rgba(100, 255, 218, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    yAxisID: 'y',
                    fill: true
                },
                {
                    label: `Distanz (${distUnit})`,
                    data: distances,
                    borderColor: '#4db8ff',
                    backgroundColor: 'rgba(77, 184, 255, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y1',
                    fill: true
                },
                {
                    label: 'Getankt (L)',
                    data: fuelUsed,
                    borderColor: '#ffd700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    yAxisID: 'y2',
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: '#fff',
                        font: {
                            size: 12
                        },
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(10, 14, 39, 0.95)',
                    titleColor: '#64ffda',
                    bodyColor: '#fff',
                    borderColor: 'rgba(42, 82, 152, 0.6)',
                    borderWidth: 2,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(2);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(42, 82, 152, 0.2)'
                    },
                    ticks: {
                        color: '#8892b0',
                        font: {
                            size: 11
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: `Verbrauch (${consUnit})`,
                        color: '#64ffda',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: 'rgba(42, 82, 152, 0.2)'
                    },
                    ticks: {
                        color: '#64ffda',
                        font: {
                            size: 10
                        }
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: `Distanz (${distUnit})`,
                        color: '#4db8ff',
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        drawOnChartArea: false
                    },
                    ticks: {
                        color: '#4db8ff',
                        font: {
                            size: 10
                        }
                    }
                },
                y2: {
                    type: 'linear',
                    display: false, // Hidden axis for fuel
                    position: 'right'
                }
            }
        }
    });
}

// ==================== Initialization ====================

// Make functions globally available
window.showFuelModal = showFuelModal;
window.hideFuelModal = hideFuelModal;
window.showFuelPanel = showFuelPanel;
window.hideFuelPanel = hideFuelPanel;
window.editFuelEntry = editFuelEntry;
window.deleteFuelEntryConfirm = deleteFuelEntryConfirm;

document.addEventListener('DOMContentLoaded', () => {
    // Setup event listeners
    const fuelForm = document.getElementById('fuel-form');
    if (fuelForm) {
        fuelForm.addEventListener('submit', handleFuelFormSubmit);
    }

    // Close modal when clicking outside
    const fuelModal = document.getElementById('fuel-modal');
    if (fuelModal) {
        fuelModal.addEventListener('click', (e) => {
            if (e.target === fuelModal) {
                hideFuelModal();
            }
        });
    }
});
