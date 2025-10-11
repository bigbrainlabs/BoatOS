// ==================== SETTINGS MODAL ====================

// Default settings
const defaultSettings = {
    general: {
        language: 'de',
        theme: 'auto',
        speedUnit: 'kn',
        distanceUnit: 'nm',
        depthUnit: 'm'
    },
    navigation: {
        mapOrientation: 'north-up',
        defaultZoom: 13,
        autoTrack: false,
        trackInterval: 10,
        showTrackHistory: true,
        showCompassRose: true
    },
    gps: {
        signalkUrl: 'http://localhost:3000',
        gpsInterval: 1000,
        gpsFilter: true,
        minSatellites: 4
    },
    weather: {
        apiKey: '',
        updateInterval: 30,
        tempUnit: 'c',
        windUnit: 'kn'
    },
    sensors: {
        mqttUrl: '',
        mqttUser: '',
        mqttPass: '',
        depthAlarm: 2.0,
        depthAlarmEnable: false
    },
    ais: {
        provider: 'aisstream',  // 'aishub', 'aisstream'
        apiKey: '',
        enabled: false,
        updateInterval: 60,
        showLabels: true
    },
    infrastructure: {
        enabled: false,
        types: ['lock', 'bridge', 'harbor']
    },
    waterLevel: {
        enabled: false
    }
};

// Current settings (loaded from localStorage or backend)
let currentSettings = JSON.parse(JSON.stringify(defaultSettings));

// Toast notification function
function showMsg(message, duration = 3000) {
    const existingToast = document.getElementById('settings-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    const toast = document.createElement('div');
    toast.id = 'settings-toast';
    toast.textContent = message;
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    toast.style.color = 'white';
    toast.style.padding = '15px 25px';
    toast.style.borderRadius = '8px';
    toast.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
    toast.style.zIndex = '100000';
    toast.style.fontSize = '16px';
    toast.style.fontWeight = '600';
    toast.style.animation = 'slideInRight 0.3s ease-out';
    
    if (!document.getElementById('toast-animations')) {
        const style = document.createElement('style');
        style.id = 'toast-animations';
        style.innerHTML = '@keyframes slideInRight { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes slideOutRight { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }';
        document.head.appendChild(style);
    }
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// Open Settings Modal
function openSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.add('show');
    modal.style.display = 'flex';
    loadSettingsToForm();
}

// Close Settings Modal
function closeSettingsModal() {
    const modal = document.getElementById('settings-modal');
    modal.classList.remove('show');
    modal.style.display = 'none';
}

// Switch Settings Tab
function switchSettingsTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Remove active class from all tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab content
    const selectedContent = document.getElementById(`settings-${tabName}`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }

    // Add active class to clicked tab
    if (event && event.target) {
        event.target.classList.add('active');
    } else {
        // If called programmatically, find and activate the correct tab button
        const tabButton = document.querySelector(`[onclick="switchSettingsTab('${tabName}')"]`);
        if (tabButton) {
            tabButton.classList.add('active');
        }
    }

    // Load charts if charts tab is selected
    if (tabName === 'charts' && typeof loadCharts === 'function') {
        loadCharts();
    }
}

// Load settings into form
function loadSettingsToForm() {
    // General
    document.getElementById('setting-language').value = currentSettings.general.language || 'de';
    document.getElementById('setting-theme').value = currentSettings.general.theme || 'auto';
    document.getElementById('setting-speed-unit').value = currentSettings.general.speedUnit || 'kn';

    // Navigation
    if (document.getElementById('setting-map-orientation')) {
        document.getElementById('setting-map-orientation').value = currentSettings.navigation.mapOrientation || 'north-up';
    }
    if (document.getElementById('setting-show-track-history')) {
        document.getElementById('setting-show-track-history').value = String(currentSettings.navigation.showTrackHistory !== false);
    }
    if (document.getElementById('setting-show-compass-rose')) {
        document.getElementById('setting-show-compass-rose').value = String(currentSettings.navigation.showCompassRose !== false);
    }

    // GPS
    if (document.getElementById('setting-signalk-url')) {
        document.getElementById('setting-signalk-url').value = currentSettings.gps.signalkUrl || 'http://localhost:3000';
    }

    // Weather
    if (document.getElementById('setting-weather-interval')) {
        document.getElementById('setting-weather-interval').value = currentSettings.weather.updateInterval || 30;
    }

    // Sensors
    if (document.getElementById('setting-mqtt-url')) {
        document.getElementById('setting-mqtt-url').value = currentSettings.sensors.mqttUrl || '';
    }

    // AIS
    if (document.getElementById('setting-ais-provider')) {
        document.getElementById('setting-ais-provider').value = currentSettings.ais.provider || 'openais';
    }
    if (document.getElementById('setting-ais-api-key')) {
        document.getElementById('setting-ais-api-key').value = currentSettings.ais.apiKey || '';
    }
    if (document.getElementById('setting-ais-enabled')) {
        document.getElementById('setting-ais-enabled').checked = currentSettings.ais.enabled !== false;
    }
    // Show/hide API key field based on provider
    updateAISKeyVisibility();

    // Infrastructure
    if (document.getElementById('setting-infrastructure-enabled')) {
        document.getElementById('setting-infrastructure-enabled').checked = currentSettings.infrastructure?.enabled || false;
    }
    if (document.getElementById('setting-infrastructure-locks')) {
        const types = currentSettings.infrastructure?.types || ['lock', 'bridge', 'harbor'];
        document.getElementById('setting-infrastructure-locks').checked = types.includes('lock');
        document.getElementById('setting-infrastructure-bridges').checked = types.includes('bridge');
        document.getElementById('setting-infrastructure-harbors').checked = types.includes('harbor');
        document.getElementById('setting-infrastructure-weirs').checked = types.includes('weir');
        document.getElementById('setting-infrastructure-dams').checked = types.includes('dam');
    }

    // Water Level
    if (document.getElementById('setting-waterLevel-enabled')) {
        document.getElementById('setting-waterLevel-enabled').checked = currentSettings.waterLevel?.enabled || false;
    }
}

// Save settings
function saveSettings() {
    console.log('Saving settings...');
    
    // Helper function to safely get value
    const getValue = (id, defaultVal) => {
        const el = document.getElementById(id);
        return el ? el.value : defaultVal;
    };
    
    const getChecked = (id, defaultVal) => {
        const el = document.getElementById(id);
        return el ? el.checked : defaultVal;
    };
    
    // Collect settings from form (only existing fields)
    currentSettings = {
        general: {
            language: getValue('setting-language', 'de'),
            theme: getValue('setting-theme', 'auto'),
            speedUnit: getValue('setting-speed-unit', 'kn'),
            distanceUnit: currentSettings.general.distanceUnit,
            depthUnit: currentSettings.general.depthUnit
        },
        navigation: {
            mapOrientation: getValue('setting-map-orientation', 'north-up'),
            defaultZoom: 13,
            autoTrack: false,
            trackInterval: 10,
            showTrackHistory: getValue('setting-show-track-history', 'true') === 'true',
            showCompassRose: getValue('setting-show-compass-rose', 'true') === 'true'
        },
        gps: {
            signalkUrl: getValue('setting-signalk-url', 'http://localhost:3000'),
            gpsInterval: 1000,
            gpsFilter: true,
            minSatellites: 4
        },
        weather: {
            apiKey: '',
            updateInterval: parseInt(getValue('setting-weather-interval', '30')),
            tempUnit: 'c',
            windUnit: 'kn'
        },
        sensors: {
            mqttUrl: getValue('setting-mqtt-url', ''),
            mqttUser: '',
            mqttPass: '',
            depthAlarm: 2.0,
            depthAlarmEnable: false
        },
        ais: {
            provider: getValue('setting-ais-provider', 'openais'),
            apiKey: getValue('setting-ais-api-key', ''),
            enabled: getChecked('setting-ais-enabled', false),
            updateInterval: 60,
            showLabels: true
        },
        infrastructure: {
            enabled: getChecked('setting-infrastructure-enabled', false),
            types: []
        },
        waterLevel: {
            enabled: getChecked('setting-waterLevel-enabled', false)
        }
    };

    // Collect infrastructure types
    if (getChecked('setting-infrastructure-locks', false)) currentSettings.infrastructure.types.push('lock');
    if (getChecked('setting-infrastructure-bridges', false)) currentSettings.infrastructure.types.push('bridge');
    if (getChecked('setting-infrastructure-harbors', false)) currentSettings.infrastructure.types.push('harbor');
    if (getChecked('setting-infrastructure-weirs', false)) currentSettings.infrastructure.types.push('weir');
    if (getChecked('setting-infrastructure-dams', false)) currentSettings.infrastructure.types.push('dam');

    console.log('Settings to save:', currentSettings);

    // Save to localStorage
    try {
        localStorage.setItem('boatos_settings', JSON.stringify(currentSettings));
        console.log('✅ Saved to localStorage');
    } catch (e) {
        console.error('Error saving to localStorage:', e);
    }

    // Apply settings
    applySettings();

    // Save to backend (optional)
    saveSettingsToBackend();
    
    // Show success message and close modal
    showMsg('💾 Einstellungen gespeichert!');
    
    // Close modal after a short delay
    setTimeout(() => {
        closeSettingsModal();
    }, 500);
}

// Apply settings (update app behavior)
function applySettings() {
    // Apply language
    if (currentSettings.general.language !== currentLang) {
        setLanguage(currentSettings.general.language);
    }

    // Apply theme
    applyTheme(currentSettings.general.theme);

    // Apply track history visibility (only if map is initialized)
    if (typeof map !== 'undefined' && typeof toggleTrackHistory === 'function') {
        toggleTrackHistory(currentSettings.navigation.showTrackHistory);
    }

    // Apply compass rose visibility (only if map is initialized)
    if (typeof map !== 'undefined' && typeof toggleCompassRose === 'function') {
        toggleCompassRose(currentSettings.navigation.showCompassRose);
    }

    // Apply AIS settings (only if AIS is initialized)
    if (typeof updateAISSettings === 'function') {
        updateAISSettings(currentSettings.ais);
    }

    // Apply Infrastructure settings (only if infrastructure is initialized)
    if (typeof updateInfrastructureSettings === 'function') {
        updateInfrastructureSettings(currentSettings.infrastructure);
    }

    // Apply Water Level settings (only if water level is initialized)
    if (typeof updateWaterLevelSettings === 'function') {
        updateWaterLevelSettings(currentSettings.waterLevel);
    }

    console.log('✅ Settings applied:', currentSettings);
}

// Apply theme
function applyTheme(theme) {
    const body = document.body;

    if (theme === 'dark') {
        body.classList.add('dark-theme');
        body.classList.remove('light-theme', 'night-theme');
    } else if (theme === 'light') {
        body.classList.add('light-theme');
        body.classList.remove('dark-theme', 'night-theme');
    } else if (theme === 'night') {
        body.classList.add('night-theme');
        body.classList.remove('dark-theme', 'light-theme');
    } else {
        // Auto - use system preference
        body.classList.remove('dark-theme', 'light-theme', 'night-theme');
    }
}

// Reset settings to default
function resetSettings() {
    if (confirm('Alle Einstellungen auf Standardwerte zurücksetzen?')) {
        currentSettings = JSON.parse(JSON.stringify(defaultSettings));
        localStorage.setItem('boatos_settings', JSON.stringify(currentSettings));
        loadSettingsToForm();
        applySettings();
        showMsg('🔄 Einstellungen zurückgesetzt');
    }
}

// Export settings
function exportSettings() {
    const dataStr = JSON.stringify(currentSettings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boatos-settings-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showMsg('📥 Einstellungen exportiert');
}

// Save settings to backend
async function saveSettingsToBackend() {
    try {
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSettings)
        });

        if (response.ok) {
            console.log('✅ Settings saved to backend');
        }
    } catch (error) {
        console.warn('⚠️ Could not save to backend:', error);
    }
}

// Load settings from backend
async function loadSettingsFromBackend() {
    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const serverSettings = await response.json();
            currentSettings = { ...defaultSettings, ...serverSettings };
            return true;
        }
    } catch (error) {
        console.warn('⚠️ Could not load from backend:', error);
    }
    return false;
}

// Initialize settings on load
async function initializeSettings() {
    // Try to load from backend first
    const loadedFromBackend = await loadSettingsFromBackend();

    // If not found on backend, load from localStorage
    if (!loadedFromBackend) {
        const stored = localStorage.getItem('boatos_settings');
        if (stored) {
            try {
                currentSettings = { ...defaultSettings, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Error parsing stored settings:', e);
            }
        }
    }

    // Apply settings
    applySettings();

    console.log('⚙️ Settings initialized');
}

// Update AIS API key field visibility based on provider
function updateAISKeyVisibility() {
    const provider = document.getElementById('setting-ais-provider')?.value || 'aisstream';
    const keyField = document.getElementById('ais-api-key-field');

    if (keyField) {
        // All providers require API key
        keyField.style.display = 'block';
    }
}

// Export waypoints (placeholder)
function exportWaypoints() {
    showMsg('📥 Wegpunkte-Export wird implementiert...');
}

// Export tracks (placeholder)
function exportTracks() {
    showMsg('📥 Track-Export wird implementiert...');
}

// Clear all data
function clearAllData() {
    const msg1 = 'Wirklich ALLE Daten löschen? (Wegpunkte, Routen, Tracks)\n\nDies kann nicht rückgängig gemacht werden!';
    const msg2 = 'Letzte Warnung! Alle Daten werden unwiderruflich gelöscht!';

    if (confirm(msg1)) {
        if (confirm(msg2)) {
            localStorage.removeItem('boatos_waypoints');
            localStorage.removeItem('boatos_routes');
            localStorage.removeItem('boatos_tracks');
            showMsg('🗑️ Alle Daten gelöscht');
            setTimeout(() => location.reload(), 1000);
        }
    }
}

// Initialize on page load
window.addEventListener('load', function() {
    initializeSettings();
});
