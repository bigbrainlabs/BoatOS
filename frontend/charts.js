/**
 * BoatOS Charts Management
 */

let chartLayers = [];
let chartOverlays = {};

// ==================== CHARTS LOADING ====================
async function loadCharts() {
    try {
        const response = await fetch(`${API_URL}/api/charts`);
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
    // Remove existing overlays
    Object.values(chartOverlays).forEach(layer => map.removeLayer(layer));
    chartOverlays = {};

    // Add enabled charts
    chartLayers.filter(c => c.enabled).forEach(chart => {
        try {
            let layer;

            if (chart.type === 'tiles' || chart.type === 'kap' || chart.type === 'enc') {
                // KAP and ENC charts are converted to tiles
                const tilesUrl = (chart.type === 'kap' || chart.type === 'enc')
                    ? `${API_URL}${chart.url}/tiles/{z}/{x}/{y}.png`
                    : `${API_URL}${chart.url}/{z}/{x}/{y}.png`;

                layer = L.tileLayer(tilesUrl, {
                    maxZoom: 18,
                    maxNativeZoom: 13,
                    opacity: 0.7,
                    errorTileUrl: ''
                });
            } else if (chart.type === 'mbtiles') {
                // MBTiles layer
                layer = L.tileLayer(`${API_URL}/api/charts/${chart.id}/tiles/{z}/{x}/{y}`, {
                    maxZoom: 18,
                    opacity: 0.7
                });
            } else if (chart.type === 'image') {
                // Single georeferenced image - would need bounds
                // Simplified for now
                console.warn(`Image overlays need implementation for ${chart.name}`);
                return;
            }

            if (layer) {
                layer.addTo(map);
                chartOverlays[chart.id] = layer;
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
        const response = await fetch(`${API_URL}/api/charts/${chartId}?enabled=${enabled}`, {
            method: 'PATCH'
        });

        if (response.ok) {
            const chart = chartLayers.find(c => c.id === chartId);
            if (chart) {
                chart.enabled = enabled;
                loadChartOverlays();
                updateChartsUI();
            }
        }
    } catch (error) {
        console.error('❌ Failed to toggle chart:', error);
    }
}

async function deleteChart(chartId) {
    if (!confirm('Karte wirklich löschen?')) return;

    try {
        const response = await fetch(`${API_URL}/api/charts/${chartId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            chartLayers = chartLayers.filter(c => c.id !== chartId);
            loadChartOverlays();
            updateChartsUI();
            showNotification('🗑️ Karte gelöscht');
        }
    } catch (error) {
        console.error('❌ Failed to delete chart:', error);
    }
}

async function uploadChart() {
    const fileInput = document.getElementById('chart-file-input');
    const nameInput = document.getElementById('chart-name-input');

    const files = fileInput.files;
    if (!files || files.length === 0) {
        alert('Bitte wähle Dateien oder einen Ordner aus');
        return;
    }

    showNotification('📤 Lade Karten hoch...');

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

            const response = await fetch(`${API_URL}/api/charts/upload?name=${encodeURIComponent(chartName)}&layer_type=${layerType}`, {
                method: 'POST',
                body: formData
            });

            if (response.ok) {
                const chart = await response.json();
                chartLayers.push(chart);
                showNotification(`✅ ${chartName} hochgeladen`);
            } else {
                const error = await response.json();
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
    nameInput.value = '';
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

// Add Layer Control to Map
function addLayerControl() {
    const layerControl = L.control({ position: 'topleft' });

    layerControl.onAdd = function() {
        const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
        div.innerHTML = `
            <button onclick="openChartsModal()" style="background: white; width: 34px; height: 34px; border: none; cursor: pointer; font-size: 18px; border-radius: 4px;" title="Karten verwalten">
                📊
            </button>
        `;
        return div;
    };

    layerControl.addTo(map);
}

// ==================== ENC DOWNLOAD ====================
let encCatalog = [];
let selectedENC = [];

async function loadENCCatalog() {
    try {
        const response = await fetch(`${API_URL}/api/enc/catalog`);
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

    try {
        const response = await fetch(`${API_URL}/api/enc/download`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(selectedENC)
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

// Charts initialized from app.js
