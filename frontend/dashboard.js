/**
 * Statistics Dashboard Module
 * Displays aggregated statistics for trips, fuel, and crew
 */

const DASHBOARD_API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';

let dashboardData = null;
let distanceChart = null;
let fuelChart = null;

// ==================== API Functions ====================

async function loadDashboardData() {
    try {
        const response = await fetch(`${DASHBOARD_API_URL}/api/statistics/dashboard`);
        dashboardData = await response.json();
        updateDashboardUI();
        return dashboardData;
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        return null;
    }
}

async function loadTripStatistics(days = 365) {
    try {
        const response = await fetch(`${DASHBOARD_API_URL}/api/statistics/trips?days=${days}`);
        return await response.json();
    } catch (error) {
        console.error('Error loading trip statistics:', error);
        return null;
    }
}

async function loadMonthlyBreakdown() {
    try {
        const response = await fetch(`${DASHBOARD_API_URL}/api/statistics/monthly`);
        return await response.json();
    } catch (error) {
        console.error('Error loading monthly breakdown:', error);
        return null;
    }
}

async function loadYearlyComparison() {
    try {
        const response = await fetch(`${DASHBOARD_API_URL}/api/statistics/yearly`);
        return await response.json();
    } catch (error) {
        console.error('Error loading yearly comparison:', error);
        return null;
    }
}

// ==================== Import/Export Functions ====================

async function exportAllData() {
    try {
        const response = await fetch(`${DASHBOARD_API_URL}/api/data/export`);

        if (!response.ok) {
            throw new Error('Export fehlgeschlagen');
        }

        // Get filename from Content-Disposition header
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'boatos_export.json';
        if (contentDisposition) {
            const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
            if (matches != null && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        // Download the file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showExportSuccess();
    } catch (error) {
        console.error('Export error:', error);
        showExportError(error.message);
    }
}

async function importDataFromFile(file) {
    try {
        const text = await file.text();
        const importData = JSON.parse(text);

        const response = await fetch(`${DASHBOARD_API_URL}/api/data/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(importData)
        });

        const result = await response.json();

        if (result.status === 'error') {
            throw new Error(result.error);
        }

        showImportSuccess(result);

        // Reload dashboard data
        await loadDashboardData();

    } catch (error) {
        console.error('Import error:', error);
        showImportError(error.message);
    }
}

function showExportSuccess() {
    const container = document.getElementById('import-export-status');
    if (container) {
        container.innerHTML = `
            <div style="padding: 15px; background: rgba(76, 175, 80, 0.2); border: 2px solid #4caf50; border-radius: 8px; color: #4caf50; margin: 10px 0;">
                ✓ Daten erfolgreich exportiert
            </div>
        `;
        setTimeout(() => {
            container.innerHTML = '';
        }, 3000);
    }
}

function showExportError(message) {
    const container = document.getElementById('import-export-status');
    if (container) {
        container.innerHTML = `
            <div style="padding: 15px; background: rgba(244, 67, 54, 0.2); border: 2px solid #f44336; border-radius: 8px; color: #f44336; margin: 10px 0;">
                ✗ Export fehlgeschlagen: ${message}
            </div>
        `;
    }
}

function showImportSuccess(result) {
    const container = document.getElementById('import-export-status');
    if (container) {
        const imported = result.imported;
        const errors = result.errors || [];

        let errorHtml = '';
        if (errors.length > 0) {
            errorHtml = `
                <div style="margin-top: 10px; padding: 10px; background: rgba(255, 152, 0, 0.2); border-left: 3px solid #ff9800; color: #ff9800;">
                    <strong>Warnungen:</strong>
                    <ul style="margin: 5px 0; padding-left: 20px;">
                        ${errors.slice(0, 5).map(e => `<li>${e}</li>`).join('')}
                        ${errors.length > 5 ? `<li>... und ${errors.length - 5} weitere</li>` : ''}
                    </ul>
                </div>
            `;
        }

        container.innerHTML = `
            <div style="padding: 15px; background: rgba(76, 175, 80, 0.2); border: 2px solid #4caf50; border-radius: 8px; color: #4caf50; margin: 10px 0;">
                <div style="font-weight: bold; margin-bottom: 8px;">✓ Import erfolgreich</div>
                <div style="font-size: 0.9em; color: #ccc;">
                    <div>📝 Logbuch-Fahrten: ${imported.logbook_trips}</div>
                    <div>👥 Crew-Mitglieder: ${imported.crew_members}</div>
                    <div>⛽ Tankungen: ${imported.fuel_entries}</div>
                    <div>⚙️ Einstellungen: ${imported.settings ? 'Ja' : 'Nein'}</div>
                </div>
                ${errorHtml}
            </div>
        `;

        setTimeout(() => {
            if (!errorHtml) {
                container.innerHTML = '';
            }
        }, 5000);
    }
}

function showImportError(message) {
    const container = document.getElementById('import-export-status');
    if (container) {
        container.innerHTML = `
            <div style="padding: 15px; background: rgba(244, 67, 54, 0.2); border: 2px solid #f44336; border-radius: 8px; color: #f44336; margin: 10px 0;">
                ✗ Import fehlgeschlagen: ${message}
            </div>
        `;
    }
}

function handleImportFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        if (!file.name.endsWith('.json')) {
            showImportError('Nur JSON-Dateien werden unterstützt');
            return;
        }
        importDataFromFile(file);
    }
}

// ==================== UI Functions ====================

function updateDashboardUI() {
    if (!dashboardData) return;

    updateDashboardTripStats();
    updateDashboardFuelStats();
    updateDashboardCrewStats();
    updateMonthlyChart();
    updateDashboardCharts();
}

function updateDashboardTripStats() {
    const container = document.getElementById('dashboard-trips');
    if (!container || !dashboardData.trips) return;

    const trips = dashboardData.trips;

    container.innerHTML = `
        <h3 class="dashboard-section-title">🚤 Fahrten-Statistik</h3>
        <div class="stats-grid">
            <div class="stat-card stat-card-large">
                <div class="stat-label">Gesamt-Fahrten</div>
                <div class="stat-value">${trips.total_trips}</div>
                <div class="stat-subtext">${trips.recent_trips} in den letzten ${trips.period_days} Tagen</div>
            </div>
            <div class="stat-card stat-card-large">
                <div class="stat-label">Gesamt-Distanz</div>
                <div class="stat-value">${trips.total_distance_nm.toFixed(1)} <span class="stat-unit">NM</span></div>
                <div class="stat-subtext">${trips.recent_distance_nm.toFixed(1)} NM kürzlich</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Gesamtdauer</div>
                <div class="stat-value">${trips.total_duration_hours.toFixed(1)} <span class="stat-unit">h</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ø Distanz</div>
                <div class="stat-value">${trips.avg_distance_nm.toFixed(1)} <span class="stat-unit">NM</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ø Dauer</div>
                <div class="stat-value">${trips.avg_duration_hours.toFixed(1)} <span class="stat-unit">h</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Längste Fahrt</div>
                <div class="stat-value">${trips.longest_trip_nm.toFixed(1)} <span class="stat-unit">NM</span></div>
            </div>
        </div>
    `;
}

function updateDashboardFuelStats() {
    const container = document.getElementById('dashboard-fuel');
    if (!container || !dashboardData.fuel) return;

    const fuel = dashboardData.fuel;

    container.innerHTML = `
        <h3 class="dashboard-section-title">⛽ Treibstoff-Statistik</h3>
        <div class="stats-grid">
            <div class="stat-card stat-card-large">
                <div class="stat-label">Tankungen (30 Tage)</div>
                <div class="stat-value">${fuel.recent_entries || 0}</div>
                <div class="stat-subtext">${fuel.total_entries} gesamt</div>
            </div>
            <div class="stat-card stat-card-large">
                <div class="stat-label">Gesamt-Liter</div>
                <div class="stat-value">${fuel.total_liters.toFixed(1)} <span class="stat-unit">L</span></div>
                <div class="stat-subtext">${(fuel.recent_liters || 0).toFixed(1)} L kürzlich</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Gesamt-Kosten</div>
                <div class="stat-value">${fuel.total_cost.toFixed(0)} <span class="stat-unit">${fuel.currency}</span></div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ø Preis/L</div>
                <div class="stat-value">${fuel.avg_price_per_liter.toFixed(3)} <span class="stat-unit">${fuel.currency}</span></div>
            </div>
            ${fuel.last_refill ? `
            <div class="stat-card stat-card-wide">
                <div class="stat-label">Letzte Tankung</div>
                <div class="stat-value-small">${new Date(fuel.last_refill.timestamp).toLocaleDateString('de-DE')}</div>
                <div class="stat-subtext">${fuel.last_refill.liters.toFixed(1)} L @ ${fuel.last_refill.location || 'Unbekannt'}</div>
            </div>
            ` : ''}
        </div>
    `;
}

function updateDashboardCrewStats() {
    const container = document.getElementById('dashboard-crew');
    if (!container || !dashboardData.crew) return;

    const crew = dashboardData.crew;

    container.innerHTML = `
        <h3 class="dashboard-section-title">👥 Crew-Statistik</h3>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-label">Gesamt</div>
                <div class="stat-value">${crew.total_members}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Kapitäne</div>
                <div class="stat-value">${crew.captains}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Crew</div>
                <div class="stat-value">${crew.crew}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Gäste</div>
                <div class="stat-value">${crew.guests}</div>
            </div>
        </div>
        ${crew.most_active && crew.most_active.length > 0 ? `
        <div class="crew-active-list">
            <h4 class="crew-active-title">Aktivste Crew-Mitglieder</h4>
            ${crew.most_active.slice(0, 5).map(member => `
                <div class="crew-active-item">
                    <span class="crew-active-name">${member.name}</span>
                    <span class="crew-active-role">${member.role}</span>
                    <span class="crew-active-trips">${member.trips} Fahrten</span>
                </div>
            `).join('')}
        </div>
        ` : ''}
    `;
}

function updateMonthlyChart() {
    const container = document.getElementById('dashboard-monthly');
    if (!container || !dashboardData.monthly_breakdown) return;

    const monthly = dashboardData.monthly_breakdown;

    if (monthly.length === 0) {
        container.innerHTML = `
            <h3 class="dashboard-section-title">📊 Monatliche Übersicht</h3>
            <div class="empty-state-small">Keine Daten verfügbar</div>
        `;
        return;
    }

    // Find max values for scaling
    const maxTrips = Math.max(...monthly.map(m => m.trips));
    const maxDistance = Math.max(...monthly.map(m => m.distance_nm));

    container.innerHTML = `
        <h3 class="dashboard-section-title">📊 Monatliche Übersicht (letzte 6 Monate)</h3>
        <div class="monthly-chart">
            ${monthly.map(month => {
                const tripPercent = maxTrips > 0 ? (month.trips / maxTrips * 100) : 0;
                const distancePercent = maxDistance > 0 ? (month.distance_nm / maxDistance * 100) : 0;

                return `
                    <div class="monthly-bar">
                        <div class="monthly-bar-label">${month.month_name.split(' ')[0]}</div>
                        <div class="monthly-bar-container">
                            <div class="monthly-bar-fill" style="height: ${tripPercent}%">
                                <span class="monthly-bar-value">${month.trips}</span>
                            </div>
                        </div>
                        <div class="monthly-bar-subtext">${month.distance_nm.toFixed(1)} NM</div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

// ==================== Panel Functions ====================

function showDashboardPanel() {
    hideAllPanels();
    const panel = document.getElementById('dashboard-panel');
    if (panel) {
        panel.style.display = 'block';
        loadDashboardData();
    }
}

function hideDashboardPanel() {
    const panel = document.getElementById('dashboard-panel');
    if (panel) {
        panel.style.display = 'none';
    }
}

function updateDashboardCharts() {
    if (!dashboardData || !dashboardData.monthly_breakdown) return;

    const monthly = dashboardData.monthly_breakdown;
    if (monthly.length === 0) return;

    // Prepare data
    const labels = monthly.map(m => m.month_name.split(' ')[0]);
    const distances = monthly.map(m => m.distance_nm);
    const trips = monthly.map(m => m.trips);

    // Distance Chart
    const distCtx = document.getElementById('dashboard-distance-chart');
    if (distCtx) {
        if (distanceChart) {
            distanceChart.destroy();
        }

        distanceChart = new Chart(distCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Distanz (NM)',
                    data: distances,
                    backgroundColor: 'rgba(100, 255, 218, 0.6)',
                    borderColor: '#64ffda',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 14, 39, 0.95)',
                        titleColor: '#64ffda',
                        bodyColor: '#fff',
                        borderColor: 'rgba(42, 82, 152, 0.6)',
                        borderWidth: 2,
                        padding: 12
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(42, 82, 152, 0.2)'
                        },
                        ticks: {
                            color: '#8892b0',
                            font: { size: 11 }
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(42, 82, 152, 0.2)'
                        },
                        ticks: {
                            color: '#64ffda',
                            font: { size: 10 }
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    // Fuel Chart (using consumption trend data if available)
    const fuelCtx = document.getElementById('dashboard-fuel-chart');
    if (fuelCtx) {
        // Load fuel trend data
        fetch(`${DASHBOARD_API_URL}/api/fuel/consumption/trend?months=6`)
            .then(res => res.json())
            .then(trendData => {
                if (!trendData || trendData.length === 0) return;

                const fuelLabels = trendData.map(m => m.month_name.split(' ')[0]);
                const fuelLiters = trendData.map(m => m.fuel_liters);
                const consumption = trendData.map(m => m.consumption_per_nm);

                if (fuelChart) {
                    fuelChart.destroy();
                }

                fuelChart = new Chart(fuelCtx, {
                    type: 'line',
                    data: {
                        labels: fuelLabels,
                        datasets: [
                            {
                                label: 'Getankt (L)',
                                data: fuelLiters,
                                borderColor: '#ffd700',
                                backgroundColor: 'rgba(255, 215, 0, 0.2)',
                                borderWidth: 3,
                                tension: 0.4,
                                yAxisID: 'y',
                                fill: true
                            },
                            {
                                label: 'Verbrauch (L/NM)',
                                data: consumption,
                                borderColor: '#64ffda',
                                backgroundColor: 'rgba(100, 255, 218, 0.1)',
                                borderWidth: 2,
                                tension: 0.4,
                                yAxisID: 'y1',
                                fill: false
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: true,
                        aspectRatio: 2,
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
                                    font: { size: 11 },
                                    usePointStyle: true,
                                    padding: 10
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(10, 14, 39, 0.95)',
                                titleColor: '#64ffda',
                                bodyColor: '#fff',
                                borderColor: 'rgba(42, 82, 152, 0.6)',
                                borderWidth: 2,
                                padding: 12
                            }
                        },
                        scales: {
                            x: {
                                grid: {
                                    color: 'rgba(42, 82, 152, 0.2)'
                                },
                                ticks: {
                                    color: '#8892b0',
                                    font: { size: 11 }
                                }
                            },
                            y: {
                                type: 'linear',
                                position: 'left',
                                title: {
                                    display: true,
                                    text: 'Liter',
                                    color: '#ffd700',
                                    font: { size: 10 }
                                },
                                grid: {
                                    color: 'rgba(42, 82, 152, 0.2)'
                                },
                                ticks: {
                                    color: '#ffd700',
                                    font: { size: 10 }
                                }
                            },
                            y1: {
                                type: 'linear',
                                position: 'right',
                                title: {
                                    display: true,
                                    text: 'L/NM',
                                    color: '#64ffda',
                                    font: { size: 10 }
                                },
                                grid: {
                                    drawOnChartArea: false
                                },
                                ticks: {
                                    color: '#64ffda',
                                    font: { size: 10 }
                                }
                            }
                        }
                    }
                });
            })
            .catch(err => console.error('Error loading fuel trend:', err));
    }
}

// ==================== Initialization ====================

// Make functions globally available
window.showDashboardPanel = showDashboardPanel;
window.hideDashboardPanel = hideDashboardPanel;
window.exportAllData = exportAllData;
window.handleImportFileSelect = handleImportFileSelect;

document.addEventListener('DOMContentLoaded', () => {
    // Auto-refresh every 60 seconds (only when panel is visible)
    setInterval(() => {
        const panel = document.getElementById('dashboard-panel');
        if (panel && panel.style.display !== 'none') {
            loadDashboardData();
        }
    }, 60000);
});
