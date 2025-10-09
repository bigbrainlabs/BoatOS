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
        trackInterval: 10
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
    }
};

// Current settings (loaded from localStorage or backend)
let currentSettings = JSON.parse(JSON.stringify(defaultSettings));

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
    event.target.classList.add('active');
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
}

// Save settings
function saveSettings() {
    // Collect settings from form
    currentSettings = {
        general: {
            language: document.getElementById('setting-language').value,
            theme: document.getElementById('setting-theme').value,
            speedUnit: document.getElementById('setting-speed-unit').value,
            distanceUnit: currentSettings.general.distanceUnit,
            depthUnit: currentSettings.general.depthUnit
        },
        navigation: {
            mapOrientation: document.getElementById('setting-map-orientation')?.value || 'north-up',
            defaultZoom: parseInt(document.getElementById('setting-default-zoom')?.value || 13),
            autoTrack: document.getElementById('setting-auto-track')?.checked || false,
            trackInterval: parseInt(document.getElementById('setting-track-interval')?.value || 10)
        },
        gps: {
            signalkUrl: document.getElementById('setting-signalk-url')?.value || 'http://localhost:3000',
            gpsInterval: parseInt(document.getElementById('setting-gps-interval')?.value || 1000),
            gpsFilter: document.getElementById('setting-gps-filter')?.checked || true,
            minSatellites: parseInt(document.getElementById('setting-min-satellites')?.value || 4)
        },
        weather: {
            apiKey: document.getElementById('setting-weather-api-key')?.value || '',
            updateInterval: parseInt(document.getElementById('setting-weather-interval')?.value || 30),
            tempUnit: document.getElementById('setting-temp-unit')?.value || 'c',
            windUnit: document.getElementById('setting-wind-unit')?.value || 'kn'
        },
        sensors: {
            mqttUrl: document.getElementById('setting-mqtt-url')?.value || '',
            mqttUser: document.getElementById('setting-mqtt-user')?.value || '',
            mqttPass: document.getElementById('setting-mqtt-pass')?.value || '',
            depthAlarm: parseFloat(document.getElementById('setting-depth-alarm')?.value || 2.0),
            depthAlarmEnable: document.getElementById('setting-depth-alarm-enable')?.checked || false
        }
    };

    // Save to localStorage
    localStorage.setItem('boatos_settings', JSON.stringify(currentSettings));

    // Apply settings
    applySettings();

    // Show success message
    showMsg('💾 Einstellungen gespeichert!');

    // Close modal
    closeSettingsModal();

    // Save to backend (optional)
    saveSettingsToBackend();
}

// Apply settings (update app behavior)
function applySettings() {
    // Apply language
    if (currentSettings.general.language !== currentLang) {
        setLanguage(currentSettings.general.language);
    }

    // Apply theme
    applyTheme(currentSettings.general.theme);

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
