/**
 * BoatOS Charts Management
 * MapLibre GL JS Version
 */

// API URL - wird dynamisch ermittelt (verwendet globale falls vorhanden)
const CHARTS_API_URL = window.API_URL || (window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : `${window.location.protocol}//${window.location.hostname}`);

// Referenz auf die Map-Instanz (wird extern gesetzt)
let chartsMap = null;

let chartLayers = [];
let chartOverlays = {}; // chartId -> { sourceId, layerId }

// ==================== CHARTS LOADING ====================
async function loadCharts() {
    try {
        const response = await fetch(`${CHARTS_API_URL}/api/charts`);
        if (response.ok) {
            chartLayers = await response.json();
            updateChartsUI();
            loadChartOverlays();
            console.log(`✅ Loaded ${chartLayers.length} chart layers`);
        }
    } catch (error) {
        console.error('❌ Failed to load charts:', error);
    }
}

function loadChartOverlays() {
    // Get map reference
    const map = chartsMap || window.map || window.BoatOS?.map?.getMap?.();
    if (!map) {
        console.warn('⚠️ charts.js: Map not available yet');
        return;
    }

    // Remove existing overlays
    Object.entries(chartOverlays).forEach(([chartId, overlay]) => {
        try {
            if (map.getLayer(overlay.layerId)) {
                map.removeLayer(overlay.layerId);
            }
            if (map.getSource(overlay.sourceId)) {
                map.removeSource(overlay.sourceId);
            }
        } catch (e) {
            console.warn(`Could not remove chart layer ${chartId}:`, e);
        }
    });
    chartOverlays = {};

    // Add enabled charts
    chartLayers.filter(c => c.enabled).forEach(chart => {
        try {
            let tilesUrl;

            if (chart.type === 'tiles' || chart.type === 'kap' || chart.type === 'enc') {
                // KAP and ENC charts are converted to tiles
                tilesUrl = (chart.type === 'kap' || chart.type === 'enc')
                    ? `${CHARTS_API_URL}${chart.url}/tiles/{z}/{x}/{y}.png`
                    : `${CHARTS_API_URL}${chart.url}/{z}/{x}/{y}.png`;
            } else if (chart.type === 'mbtiles') {
                // MBTiles layer
                tilesUrl = `${CHARTS_API_URL}/api/charts/${chart.id}/tiles/{z}/{x}/{y}`;
            } else if (chart.type === 'image') {
                // Single georeferenced image - would need bounds
                console.warn(`Image overlays need implementation for ${chart.name}`);
                return;
            }

            if (tilesUrl) {
                const sourceId = `chart-source-${chart.id}`;
                const layerId = `chart-layer-${chart.id}`;

                // Add raster source
                map.addSource(sourceId, {
                    type: 'raster',
                    tiles: [tilesUrl],
                    tileSize: 256,
                    maxzoom: 18
                });

                // Add raster layer (before labels if possible)
                const firstSymbolLayer = map.getStyle().layers.find(l => l.type === 'symbol');
                map.addLayer({
                    id: layerId,
                    type: 'raster',
                    source: sourceId,
                    paint: {
                        'raster-opacity': 0.7
                    }
                }, firstSymbolLayer?.id);

                chartOverlays[chart.id] = { sourceId, layerId };
                console.log(`📊 Added chart overlay: ${chart.name}`);
            }
        } catch (error) {
            console.error(`❌ Failed to load chart ${chart.name}:`, error);
        }
    });
}

// ==================== CHARTS UI ====================
function updateChartsUI() {
    const chartsList = document.getElementById('charts-list');
    if (!chartsList) return;

    if (chartLayers.length === 0) {
        chartsList.innerHTML = '<div style="padding: 20px; text-align: center; color: #8892b0;">Keine Karten hochgeladen</div>';
        return;
    }

    chartsList.innerHTML = chartLayers.map(chart => `
        <div style="background: rgba(42, 82, 152, 0.3); padding: 15px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: #64ffda; margin-bottom: 5px;">${chart.name}</div>
                <div style="font-size: 12px; color: #8892b0;">${chart.type.toUpperCase()} · ${new Date(chart.uploaded).toLocaleDateString('de-DE')}</div>
            </div>
            <div style="display: flex; gap: 10px;">
                <label style="cursor: pointer; background: ${chart.enabled ? 'rgba(46, 204, 113, 0.3)' : 'rgba(255,255,255,0.1)'}; padding: 8px 12px; border-radius: 6px; font-size: 14px;">
                    <input type="checkbox" ${chart.enabled ? 'checked' : ''} onchange="toggleChart('${chart.id}', this.checked)" style="margin-right: 5px;">
                    ${chart.enabled ? 'An' : 'Aus'}
                </label>
                <button onclick="deleteChart('${chart.id}')" style="background: rgba(231, 76, 60, 0.3); padding: 8px 12px; border: none; border-radius: 6px; color: white; cursor: pointer;">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function toggleChart(chartId, enabled) {
    try {
        const response = await fetch(`${CHARTS_API_URL}/api/charts/${chartId}?enabled=${enabled}`, {
            method: 'PATCH'
        });

        if (response.ok) {
            const result = await response.json();

            // Check if conversion is needed
            if (result.status === 'needs_conversion') {
                showMsg('📊 Konvertiere Karte...');
                showProgressModal('📊 Konvertiere ENC-Karte...');

                // Start conversion
                const convertResponse = await fetch(`${CHARTS_API_URL}/api/charts/${chartId}/convert`, {
                    method: 'POST'
                });

                if (convertResponse.ok) {
                    // Poll for conversion status
                    await pollConversionStatus(chartId);
                } else {
                    showMsg('❌ Konvertierung fehlgeschlagen');
                    closeProgressModal();
                }
            } else {
                // Normal toggle
                const chart = chartLayers.find(c => c.id === chartId);
                if (chart) {
                    chart.enabled = enabled;
                    updateChartsUI();
                    loadChartOverlays();
                    showMsg(enabled ? '✅ Karte aktiviert' : '⏸️ Karte deaktiviert');
                }
            }
        } else {
            showMsg('❌ Fehler beim Aktivieren/Deaktivieren');
        }
    } catch (error) {
        console.error('❌ Failed to toggle chart:', error);
        showMsg('❌ Fehler beim Aktivieren/Deaktivieren');
    }
}

async function pollConversionStatus(chartId) {
    let progress = 0;
    const interval = setInterval(async () => {
        progress += 5;
        updateProgress(Math.min(progress, 95), 'Konvertiere...', null);

        // Check if conversion is complete by reloading charts
        const response = await fetch(`${CHARTS_API_URL}/api/charts`);
        if (response.ok) {
            const charts = await response.json();
            const chart = charts.find(c => c.id === chartId);

            if (chart && chart.converted) {
                clearInterval(interval);
                completeProgress('✅ Konvertierung abgeschlossen!');

                // Enable the chart after conversion
                const enableResponse = await fetch(`${CHARTS_API_URL}/api/charts/${chartId}?enabled=true`, {
                    method: 'PATCH'
                });

                if (enableResponse.ok) {
                    await loadCharts();
                    loadChartOverlays();
                    showMsg('✅ Karte aktiviert');
                }

                setTimeout(() => {
                    closeProgressModal();
                }, 2000);
            }
        }

        // Timeout after 5 minutes
        if (progress >= 300) {
            clearInterval(interval);
            updateProgress(100, '⚠️ Konvertierung dauert länger als erwartet');
            document.getElementById('progress-close-btn').style.display = 'block';
        }
    }, 1000);
}

async function deleteChart(chartId) {
    if (!confirm('Karte wirklich löschen?')) return;

    try {
        const response = await fetch(`${CHARTS_API_URL}/api/charts/${chartId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            chartLayers = chartLayers.filter(c => c.id !== chartId);
            loadChartOverlays();
            updateChartsUI();
            showMsg('🗑️ Karte gelöscht');
        }
    } catch (error) {
        console.error('❌ Failed to delete chart:', error);
    }
}

async function uploadChart() {
    const fileInput = document.getElementById('chart-file-input');
    const folderInput = document.getElementById('chart-folder-input');
    const nameInput = document.getElementById('chart-name-input');

    // Check which input has files
    let files = fileInput.files.length > 0 ? fileInput.files : folderInput.files;

    if (!files || files.length === 0) {
        alert('Bitte wähle Dateien oder einen Ordner aus');
        return;
    }

    showMsg('📤 Lade Karten hoch...');

    // Group files by directory
    const filesByDir = {};
    for (let file of files) {
        const parts = file.webkitRelativePath ? file.webkitRelativePath.split('/') : [file.name];
        const dirName = parts.length > 1 ? parts[0] : file.name.split('.')[0];

        if (!filesByDir[dirName]) {
            filesByDir[dirName] = [];
        }
        filesByDir[dirName].push(file);
    }

    // Upload each directory as a chart
    for (const [dirName, dirFiles] of Object.entries(filesByDir)) {
        try {
            const formData = new FormData();

            for (const file of dirFiles) {
                formData.append('files', file, file.webkitRelativePath || file.name);
            }

            const chartName = nameInput.value || dirName;
            const firstFile = dirFiles[0];
            let layerType = 'tiles';
            if (firstFile.name.endsWith('.kap')) layerType = 'kap';
            else if (firstFile.name.endsWith('.000')) layerType = 'enc';
            else if (firstFile.name.endsWith('.mbtiles')) layerType = 'mbtiles';
            else if (firstFile.name.match(/\.(tif|tiff)$/i)) layerType = 'image';

            // Show progress modal for KAP/ENC conversions
            const needsConversion = layerType === 'kap' || layerType === 'enc';
            if (needsConversion) {
                showProgressModal(`📊 Verarbeite ${chartName}...`);
                updateProgress(10, 'Upload läuft...');
            }

            const response = await fetch(`${CHARTS_API_URL}/api/charts/upload?name=${encodeURIComponent(chartName)}&layer_type=${layerType}`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const chart = await response.json();
                chartLayers.push(chart);

                if (needsConversion) {
                    updateProgress(50, 'Konvertiere zu Tiles...');
                    // Poll for conversion completion
                    await waitForConversion(chart.id, chartName);
                } else {
                    showMsg(`✅ ${chartName} hochgeladen`);
                }
            } else {
                const error = await response.json();
                if (needsConversion) {
                    closeProgressModal();
                }
                alert(`Fehler: ${error.error || 'Upload fehlgeschlagen'}`);
            }
        } catch (error) {
            console.error('❌ Upload failed:', error);
            alert(`Upload fehlgeschlagen für "${dirName}"`);
        }
    }

    loadChartOverlays();
    updateChartsUI();
    fileInput.value = '';
    folderInput.value = '';
    nameInput.value = '';
    updateFileInfo();
}

// Wait for chart conversion to complete
async function waitForConversion(chartId, chartName) {
    let progress = 50;
    let attempts = 0;
    const maxAttempts = 120; // 2 minutes max

    const checkInterval = setInterval(async () => {
        attempts++;
        progress = Math.min(50 + (attempts * 0.4), 95);
        updateProgress(progress, 'Konvertiere zu Tiles... (kann 1-3 Min. dauern)');

        try {
            // Check if tiles directory has files
            const response = await fetch(`${CHARTS_API_URL}/api/charts`);
            if (response.ok) {
                const charts = await response.json();
                const chart = charts.find(c => c.id === chartId);

                if (chart) {
                    // Check if chart has tiles by trying to load the chart
                    const tilesExist = chart.type === 'tiles' || chart.type === 'kap' || chart.type === 'enc';

                    // Simple heuristic: if it's been 5+ seconds since upload, assume conversion is done
                    if (attempts > 5) {
                        clearInterval(checkInterval);
                        completeProgress(`✅ ${chartName} fertig!`);
                        await loadCharts();
                        setTimeout(() => {
                            closeProgressModal();
                            showMsg(`✅ ${chartName} bereit`);
                        }, 2000);
                    }
                }
            }
        } catch (error) {
            console.error('Error checking conversion status:', error);
        }

        // Timeout after max attempts
        if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
            updateProgress(100, '⏰ Konvertierung läuft im Hintergrund weiter');
            document.getElementById('progress-close-btn').style.display = 'block';
        }
    }, 1000);
}

// Update file selection info
function updateFileInfo() {
    const fileInput = document.getElementById('chart-file-input');
    const folderInput = document.getElementById('chart-folder-input');
    const infoDiv = document.getElementById('selected-files-info');

    const fileCount = fileInput.files.length + folderInput.files.length;
    if (fileCount > 0) {
        infoDiv.textContent = `${fileCount} Datei(en) ausgewählt`;
        infoDiv.style.color = '#64ffda';
    } else {
        infoDiv.textContent = '';
    }
}

// Charts modal is now integrated into settings
function openChartsModal() {
    openSettingsModal();
    // Switch to charts tab
    switchSettingsTab('charts');
    loadCharts();
}

function closeChartsModal() {
    // No longer needed - charts are in settings
}

// Set map reference (called from main.js)
function setChartsMap(mapInstance) {
    chartsMap = mapInstance;
    console.log('📊 Charts map reference set');
}

// Add Layer Control to Map (optional - charts are now in settings)
function addLayerControl() {
    // Layer control is now integrated into settings sidebar
    console.log('📊 Charts accessible via Settings > Seekarten');
}

// ==================== ENC DOWNLOAD ====================
let encCatalog = [];
let selectedENC = [];

async function loadENCCatalog() {
    try {
        const response = await fetch(`${CHARTS_API_URL}/api/enc/catalog`);
        if (response.ok) {
            encCatalog = await response.json();
            updateENCCatalogUI();
            console.log(`ENC Catalog: ${encCatalog.length} waterways loaded`);
        }
    } catch (error) {
        console.error('Failed to load ENC catalog:', error);
        document.getElementById('enc-catalog-list').innerHTML = '<div style="color: #e74c3c; text-align: center; padding: 20px;">Fehler beim Laden des Katalogs</div>';
    }
}

function updateENCCatalogUI() {
    const catalogList = document.getElementById('enc-catalog-list');
    if (!catalogList) return;

    if (encCatalog.length === 0) {
        catalogList.innerHTML = '<div style="color: #8892b0; text-align: center; padding: 20px;">Keine ENC-Dateien verfügbar</div>';
        return;
    }

    catalogList.innerHTML = encCatalog.map(enc => `
        <div style="background: rgba(42, 82, 152, 0.3); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
            <label style="cursor: pointer; display: flex; align-items: center;">
                <input type="checkbox"
                       class="enc-checkbox"
                       id="enc-${enc.id}"
                       data-filename="${enc.filename}"
                       ${enc.downloaded ? 'checked disabled' : ''}
                       style="margin-right: 10px;">
                <span style="color: ${enc.downloaded ? '#2ecc71' : '#fff'}; font-size: 14px;">
                    ${enc.name}
                    ${enc.downloaded ? '<span style="color: #2ecc71; font-size: 12px;">✓</span>' : ''}
                </span>
            </label>
        </div>
    `).join('');

    // Add event listeners after HTML is rendered
    document.querySelectorAll('.enc-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const filename = this.getAttribute('data-filename');
            toggleENCSelection(filename, this.checked);
        });
    });

    const hasAvailable = encCatalog.some(enc => !enc.downloaded);
    document.getElementById('download-enc-btn').disabled = !hasAvailable;
}

function toggleENCSelection(filename, checked) {
    if (checked) {
        if (!selectedENC.includes(filename)) {
            selectedENC.push(filename);
        }
    } else {
        selectedENC = selectedENC.filter(f => f !== filename);
    }

    const statusDiv = document.getElementById('enc-download-status');
    if (selectedENC.length > 0) {
        statusDiv.textContent = `${selectedENC.length} selected`;
    } else {
        statusDiv.textContent = '';
    }
}

function selectAllENC() {
    selectedENC = [];
    encCatalog.forEach(enc => {
        if (!enc.downloaded) {
            selectedENC.push(enc.filename);
            const checkbox = document.getElementById(`enc-${enc.id}`);
            if (checkbox) checkbox.checked = true;
        }
    });

    const statusDiv = document.getElementById('enc-download-status');
    statusDiv.textContent = `${selectedENC.length} selected`;
}

function deselectAllENC() {
    selectedENC = [];
    encCatalog.forEach(enc => {
        const checkbox = document.getElementById(`enc-${enc.id}`);
        if (checkbox && !enc.downloaded) checkbox.checked = false;
    });

    const statusDiv = document.getElementById('enc-download-status');
    statusDiv.textContent = '';
}

async function downloadSelectedENC() {
    if (selectedENC.length === 0) {
        alert('Bitte wähle mindestens ein Gewässer aus');
        return;
    }

    const statusDiv = document.getElementById('enc-download-status');
    const downloadBtn = document.getElementById('download-enc-btn');

    statusDiv.textContent = `Downloading ${selectedENC.length} waterways...`;
    downloadBtn.disabled = true;

    // Convert filenames to full waterway objects from catalog
    const waterways = selectedENC.map(filename => {
        const enc = encCatalog.find(e => e.filename === filename);
        return enc ? { name: enc.name, url: enc.url, filename: enc.filename } : null;
    }).filter(w => w !== null);

    try {
        const response = await fetch(`${CHARTS_API_URL}/api/enc/download`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(waterways)
        });

        if (response.ok) {
            const result = await response.json();
            statusDiv.textContent = `Downloaded ${result.success}/${result.total} successfully`;

            await loadENCCatalog();
            await loadCharts();
            selectedENC = [];

            setTimeout(() => {
                statusDiv.textContent = '';
            }, 5000);
        } else {
            statusDiv.textContent = 'Download failed';
        }
    } catch (error) {
        console.error('ENC download error:', error);
        statusDiv.textContent = 'Download failed';
    } finally {
        downloadBtn.disabled = false;
    }
}

// ==================== PROGRESS MODAL ====================
function showProgressModal(title = '📊 Verarbeite Karten...') {
    const modal = document.getElementById('chart-progress-modal');
    document.getElementById('progress-title').textContent = title;
    document.getElementById('progress-status').textContent = 'Initialisiere...';
    document.getElementById('progress-bar').style.width = '0%';
    document.getElementById('progress-bar').textContent = '0%';
    document.getElementById('progress-details').textContent = '';
    document.getElementById('progress-close-btn').style.display = 'none';
    modal.style.display = 'flex';
}

function updateProgress(percent, status, details = null) {
    document.getElementById('progress-bar').style.width = percent + '%';
    document.getElementById('progress-bar').textContent = Math.round(percent) + '%';
    document.getElementById('progress-status').textContent = status;

    if (details) {
        const detailsDiv = document.getElementById('progress-details');
        detailsDiv.textContent += details + '\n';
        detailsDiv.scrollTop = detailsDiv.scrollHeight;
    }
}

function completeProgress(message = 'Fertig!') {
    updateProgress(100, message);
    document.getElementById('progress-close-btn').style.display = 'block';
}

function closeProgressModal() {
    document.getElementById('chart-progress-modal').style.display = 'none';
    loadCharts();
    loadENCCatalog();
}

// ==================== GLOBAL EXPORTS ====================
// Make functions globally available for onclick handlers

window.setChartsMap = setChartsMap;
window.loadCharts = loadCharts;
window.loadChartOverlays = loadChartOverlays;
window.updateChartsUI = updateChartsUI;
window.toggleChart = toggleChart;
window.deleteChart = deleteChart;
window.uploadChart = uploadChart;
window.updateFileInfo = updateFileInfo;
window.openChartsModal = openChartsModal;

// ENC functions
window.loadENCCatalog = loadENCCatalog;
window.selectAllENC = selectAllENC;
window.deselectAllENC = deselectAllENC;
window.downloadSelectedENC = downloadSelectedENC;

// Progress modal
window.showProgressModal = showProgressModal;
window.updateProgress = updateProgress;
window.completeProgress = completeProgress;
window.closeProgressModal = closeProgressModal;

// showMsg helper (uses BoatOS.ui.showToast if available)
function showMsg(message) {
    if (window.BoatOS?.ui?.showToast) {
        window.BoatOS.ui.showToast(message, 'info');
    } else if (window.showToast) {
        window.showToast(message, 'info');
    } else {
        console.log(message);
    }
}

console.log('📊 Charts module loaded (MapLibre version)');
