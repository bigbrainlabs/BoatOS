// ==================== SETTINGS MODAL ====================

// Default settings
const defaultSettings = {
    general: {
        language: 'de',
        theme: 'auto',
        speedUnit: 'kn',
        distanceUnit: 'nm',
        depthUnit: 'm',
        temperatureUnit: 'c',
        pressureUnit: 'hpa',
        coordinateFormat: 'decimal',
        dateFormat: 'dd.mm.yyyy'
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
        minSatellites: 4,
        lowSatelliteThreshold: 15
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
    },
    routing: {
        provider: 'osrm',  // 'osrm', 'direct'
        osrmUrl: 'http://localhost:5000',
        graphhopperApiKey: ''
    },
    boat: {
        name: '',
        type: 'motorboat',
        length: 0,           // meters
        beam: 0,             // meters
        draft: 0,            // meters
        height: 0,           // meters above waterline
        fuelConsumption: 0,  // liters/hour
        fuelCapacity: 0,     // liters
        cruiseSpeed: 0,      // km/h
        icon: 'motorboat_small'  // boat icon type
    },
    waterCurrent: {
        enabled: false,      // Enable current consideration in routing
        byName: {
            'Rhein': { current_kmh: 6.0, type: 'river' },
            'Mosel': { current_kmh: 3.0, type: 'river' },
            'Main': { current_kmh: 2.5, type: 'river' },
            'Elbe': { current_kmh: 4.0, type: 'river' },
            'Saale': { current_kmh: 2.0, type: 'river' },
            'Donau': { current_kmh: 5.0, type: 'river' }
        },
        byType: {
            'river': 2.0,
            'canal': 0.0,
            'stream': 1.0,
            'lake': 0.0
        }
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

// Open Settings Modal (now opens as fullscreen)
async function openSettingsModal(fromView = 'map') {
    // First, try to load from backend to get latest settings
    try {
        const response = await fetch('/api/settings', {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            }
        });
        if (response.ok) {
            const serverSettings = await response.json();
            currentSettings = { ...defaultSettings, ...serverSettings };
            console.log('📡 Settings loaded from backend:', currentSettings);
            // Also update localStorage with fresh data
            localStorage.setItem('boatos_settings', JSON.stringify(currentSettings));
        } else {
            console.warn('⚠️ Backend settings not available, using localStorage');
            // Fallback to localStorage
            const stored = localStorage.getItem('boatos_settings');
            if (stored) {
                try {
                    const storedSettings = JSON.parse(stored);
                    currentSettings = {
                        general: { ...defaultSettings.general, ...storedSettings.general },
                        navigation: { ...defaultSettings.navigation, ...storedSettings.navigation },
                        gps: { ...defaultSettings.gps, ...storedSettings.gps },
                        weather: { ...defaultSettings.weather, ...storedSettings.weather },
                        sensors: { ...defaultSettings.sensors, ...storedSettings.sensors },
                        ais: { ...defaultSettings.ais, ...storedSettings.ais },
                        infrastructure: { ...defaultSettings.infrastructure, ...storedSettings.infrastructure },
                        waterLevel: { ...defaultSettings.waterLevel, ...storedSettings.waterLevel },
                        routing: { ...defaultSettings.routing, ...storedSettings.routing },
                        boat: { ...defaultSettings.boat, ...storedSettings.boat },
                        waterCurrent: {
                            ...defaultSettings.waterCurrent,
                            ...storedSettings.waterCurrent,
                            byName: { ...defaultSettings.waterCurrent.byName, ...storedSettings.waterCurrent?.byName },
                            byType: { ...defaultSettings.waterCurrent.byType, ...storedSettings.waterCurrent?.byType }
                        }
                    };
                    console.log('📂 Settings loaded from localStorage:', currentSettings);
                } catch (e) {
                    console.error('Error parsing stored settings:', e);
                }
            }
        }
    } catch (error) {
        console.warn('⚠️ Could not fetch backend settings:', error);
        // Fallback to localStorage
        const stored = localStorage.getItem('boatos_settings');
        if (stored) {
            try {
                const storedSettings = JSON.parse(stored);
                currentSettings = {
                    general: { ...defaultSettings.general, ...storedSettings.general },
                    navigation: { ...defaultSettings.navigation, ...storedSettings.navigation },
                    gps: { ...defaultSettings.gps, ...storedSettings.gps },
                    weather: { ...defaultSettings.weather, ...storedSettings.weather },
                    sensors: { ...defaultSettings.sensors, ...storedSettings.sensors },
                    ais: { ...defaultSettings.ais, ...storedSettings.ais },
                    infrastructure: { ...defaultSettings.infrastructure, ...storedSettings.infrastructure },
                    waterLevel: { ...defaultSettings.waterLevel, ...storedSettings.waterLevel },
                    routing: { ...defaultSettings.routing, ...storedSettings.routing },
                    boat: { ...defaultSettings.boat, ...storedSettings.boat },
                    waterCurrent: {
                        ...defaultSettings.waterCurrent,
                        ...storedSettings.waterCurrent,
                        byName: { ...defaultSettings.waterCurrent.byName, ...storedSettings.waterCurrent?.byName },
                        byType: { ...defaultSettings.waterCurrent.byType, ...storedSettings.waterCurrent?.byType }
                    }
                };
                console.log('📂 Settings loaded from localStorage:', currentSettings);
            } catch (e) {
                console.error('Error parsing stored settings:', e);
            }
        }
    }

    // Use screen management from settings_screen.js
    if (typeof window.SettingsScreen !== 'undefined' && typeof window.SettingsScreen.show === 'function') {
        window.SettingsScreen.show(fromView);
    } else {
        // Fallback to old modal behavior
        const modal = document.getElementById('settings-modal');
        modal.classList.add('show');
        modal.style.display = 'flex';
        loadSettingsToForm();
    }
}

// Close Settings Modal (now closes fullscreen)
function closeSettingsModal() {
    // Use screen management from settings_screen.js
    if (typeof window.SettingsScreen !== 'undefined' && typeof window.SettingsScreen.hide === 'function') {
        window.SettingsScreen.hide();
    } else {
        // Fallback to old modal behavior
        const modal = document.getElementById('settings-modal');
        modal.classList.remove('show');
        modal.style.display = 'none';
    }
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
    if (tabName === 'charts') {
        if (typeof loadCharts === 'function') {
            loadCharts();
        }
        // Auto-load ENC catalog with a small delay to ensure charts.js is loaded
        setTimeout(() => {
            if (typeof loadENCCatalog === 'function') {
                loadENCCatalog();
            } else {
                console.warn('loadENCCatalog not yet available');
            }
        }, 100);
    }

    // Load sensors if sensors tab is selected
    if (tabName === 'sensors') {
        if (typeof window.SettingsRenderer !== 'undefined' &&
            typeof window.SettingsRenderer.renderSensorsSettings === 'function' &&
            typeof window.SettingsRenderer.renderMqttConnectionCard === 'function') {
            const sensorsTab = document.getElementById('settings-sensors');
            if (sensorsTab) {
                // Render both sensors list and MQTT connection card
                Promise.all([
                    window.SettingsRenderer.renderSensorsSettings(),
                    window.SettingsRenderer.renderMqttConnectionCard()
                ]).then(([sensorsHtml, mqttHtml]) => {
                    sensorsTab.innerHTML = sensorsHtml + mqttHtml;
                });
            }
        }
    }

    // Load dashboard if dashboard tab is selected
    if (tabName === 'dashboard') {
        if (typeof window.SettingsRenderer !== 'undefined' &&
            typeof window.SettingsRenderer.renderDashboardSettings === 'function') {
            const dashboardTab = document.getElementById('settings-dashboard');
            if (dashboardTab) {
                window.SettingsRenderer.renderDashboardSettings().then(html => {
                    dashboardTab.innerHTML = html;
                });
            }
        }
    }
}

// Load settings into form
function loadSettingsToForm() {
    // Render General Settings Tab in Dashboard Style
    if (typeof window.SettingsRenderer !== 'undefined' && typeof window.SettingsRenderer.renderGeneralSettings === 'function') {
        const generalTab = document.getElementById('settings-general');
        if (generalTab) {
            generalTab.innerHTML = window.SettingsRenderer.renderGeneralSettings();
        }
    }

    // General
    document.getElementById('setting-language').value = currentSettings.general.language || 'de';
    document.getElementById('setting-theme').value = currentSettings.general.theme || 'auto';
    document.getElementById('setting-speed-unit').value = currentSettings.general.speedUnit || 'kn';

    // Units (with safe checks)
    if (document.getElementById('setting-distance-unit')) {
        document.getElementById('setting-distance-unit').value = currentSettings.general.distanceUnit || 'nm';
    }
    if (document.getElementById('setting-depth-unit')) {
        document.getElementById('setting-depth-unit').value = currentSettings.general.depthUnit || 'm';
    }
    if (document.getElementById('setting-temperature-unit')) {
        document.getElementById('setting-temperature-unit').value = currentSettings.general.temperatureUnit || 'c';
    }
    if (document.getElementById('setting-pressure-unit')) {
        document.getElementById('setting-pressure-unit').value = currentSettings.general.pressureUnit || 'hpa';
    }
    if (document.getElementById('setting-coordinate-format')) {
        document.getElementById('setting-coordinate-format').value = currentSettings.general.coordinateFormat || 'decimal';
    }
    if (document.getElementById('setting-date-format')) {
        document.getElementById('setting-date-format').value = currentSettings.general.dateFormat || 'dd.mm.yyyy';
    }

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
    if (document.getElementById('setting-low-satellite-threshold')) {
        document.getElementById('setting-low-satellite-threshold').value = currentSettings.gps.lowSatelliteThreshold || 15;
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

    // Routing
    if (document.getElementById('setting-routing-provider')) {
        document.getElementById('setting-routing-provider').value = currentSettings.routing?.provider || 'osrm';
    }
    if (document.getElementById('setting-osrm-url')) {
        document.getElementById('setting-osrm-url').value = currentSettings.routing?.osrmUrl || 'http://localhost:5000';
    }
    if (document.getElementById('setting-graphhopper-api-key')) {
        document.getElementById('setting-graphhopper-api-key').value = currentSettings.routing?.graphhopperApiKey || '';
    }

    // Update routing provider visibility
    updateRoutingProviderVisibility();

    // Boat settings
    if (document.getElementById('setting-boat-name')) {
        document.getElementById('setting-boat-name').value = currentSettings.boat?.name || '';
    }
    if (document.getElementById('setting-boat-type')) {
        document.getElementById('setting-boat-type').value = currentSettings.boat?.type || 'motorboat';
    }
    if (document.getElementById('setting-boat-length')) {
        document.getElementById('setting-boat-length').value = currentSettings.boat?.length || '';
    }
    if (document.getElementById('setting-boat-beam')) {
        document.getElementById('setting-boat-beam').value = currentSettings.boat?.beam || '';
    }
    if (document.getElementById('setting-boat-draft')) {
        document.getElementById('setting-boat-draft').value = currentSettings.boat?.draft || '';
    }
    if (document.getElementById('setting-boat-height')) {
        document.getElementById('setting-boat-height').value = currentSettings.boat?.height || '';
    }
    if (document.getElementById('setting-boat-fuel-consumption')) {
        document.getElementById('setting-boat-fuel-consumption').value = currentSettings.boat?.fuelConsumption || '';
    }
    if (document.getElementById('setting-boat-fuel-capacity')) {
        document.getElementById('setting-boat-fuel-capacity').value = currentSettings.boat?.fuelCapacity || '';
    }
    if (document.getElementById('setting-boat-cruise-speed')) {
        document.getElementById('setting-boat-cruise-speed').value = currentSettings.boat?.cruiseSpeed || '';
    }

    // Boat icon
    if (typeof loadBoatIconPreviews === 'function') {
        loadBoatIconPreviews();
        const iconType = currentSettings.boat?.icon || 'motorboat_small';
        if (typeof selectBoatIcon === 'function') {
            selectBoatIcon(iconType, false); // false = don't update map yet
        }
    }

    // Water Current
    if (document.getElementById('setting-water-current-enabled')) {
        document.getElementById('setting-water-current-enabled').checked = currentSettings.waterCurrent?.enabled || false;
        document.getElementById('setting-current-rhein').value = currentSettings.waterCurrent?.byName?.['Rhein']?.current_kmh || 6.0;
        document.getElementById('setting-current-mosel').value = currentSettings.waterCurrent?.byName?.['Mosel']?.current_kmh || 3.0;
        document.getElementById('setting-current-main').value = currentSettings.waterCurrent?.byName?.['Main']?.current_kmh || 2.5;
        document.getElementById('setting-current-elbe').value = currentSettings.waterCurrent?.byName?.['Elbe']?.current_kmh || 4.0;
        document.getElementById('setting-current-saale').value = currentSettings.waterCurrent?.byName?.['Saale']?.current_kmh || 2.0;
        document.getElementById('setting-current-donau').value = currentSettings.waterCurrent?.byName?.['Donau']?.current_kmh || 5.0;
        document.getElementById('setting-current-type-river').value = currentSettings.waterCurrent?.byType?.['river'] || 2.0;
        document.getElementById('setting-current-type-canal').value = currentSettings.waterCurrent?.byType?.['canal'] || 0.0;
        document.getElementById('setting-current-type-stream').value = currentSettings.waterCurrent?.byType?.['stream'] || 1.0;
        document.getElementById('setting-current-type-lake').value = currentSettings.waterCurrent?.byType?.['lake'] || 0.0;
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
            distanceUnit: getValue('setting-distance-unit', 'nm'),
            depthUnit: getValue('setting-depth-unit', 'm'),
            temperatureUnit: getValue('setting-temperature-unit', 'c'),
            pressureUnit: getValue('setting-pressure-unit', 'hpa'),
            coordinateFormat: getValue('setting-coordinate-format', 'decimal'),
            dateFormat: getValue('setting-date-format', 'dd.mm.yyyy')
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
            minSatellites: 4,
            lowSatelliteThreshold: parseInt(getValue('setting-low-satellite-threshold', '15'))
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
        },
        routing: {
            provider: getValue('setting-routing-provider', 'osrm'),
            osrmUrl: getValue('setting-osrm-url', 'http://localhost:5000'),
            graphhopperApiKey: getValue('setting-graphhopper-api-key', '')
        },
        boat: {
            name: getValue('setting-boat-name', ''),
            type: getValue('setting-boat-type', 'motorboat'),
            length: parseFloat(getValue('setting-boat-length', '0')) || 0,
            beam: parseFloat(getValue('setting-boat-beam', '0')) || 0,
            draft: parseFloat(getValue('setting-boat-draft', '0')) || 0,
            height: parseFloat(getValue('setting-boat-height', '0')) || 0,
            fuelConsumption: parseFloat(getValue('setting-boat-fuel-consumption', '0')) || 0,
            fuelCapacity: parseFloat(getValue('setting-boat-fuel-capacity', '0')) || 0,
            cruiseSpeed: parseFloat(getValue('setting-boat-cruise-speed', '0')) || 0,
            icon: (typeof getSelectedBoatIcon === 'function') ? getSelectedBoatIcon() : 'motorboat_small'
        },
        waterCurrent: {
            enabled: getChecked('setting-water-current-enabled', false),
            byName: {
                'Rhein': { current_kmh: parseFloat(getValue('setting-current-rhein', '6.0')) || 6.0, type: 'river' },
                'Mosel': { current_kmh: parseFloat(getValue('setting-current-mosel', '3.0')) || 3.0, type: 'river' },
                'Main': { current_kmh: parseFloat(getValue('setting-current-main', '2.5')) || 2.5, type: 'river' },
                'Elbe': { current_kmh: parseFloat(getValue('setting-current-elbe', '4.0')) || 4.0, type: 'river' },
                'Saale': { current_kmh: parseFloat(getValue('setting-current-saale', '2.0')) || 2.0, type: 'river' },
                'Donau': { current_kmh: parseFloat(getValue('setting-current-donau', '5.0')) || 5.0, type: 'river' }
            },
            byType: {
                'river': parseFloat(getValue('setting-current-type-river', '2.0')) || 2.0,
                'canal': parseFloat(getValue('setting-current-type-canal', '0.0')) || 0.0,
                'stream': parseFloat(getValue('setting-current-type-stream', '1.0')) || 1.0,
                'lake': parseFloat(getValue('setting-current-type-lake', '0.0')) || 0.0
            }
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
    if (typeof currentLang !== 'undefined' && currentSettings.general.language !== currentLang) {
        if (typeof setLanguage === 'function') {
            setLanguage(currentSettings.general.language);
        }
    }

    // Apply theme
    applyTheme(currentSettings.general.theme);

    // Apply track history visibility (only if map is initialized)
    if (typeof map !== 'undefined' && map && typeof toggleTrackHistory === 'function') {
        toggleTrackHistory(currentSettings.navigation.showTrackHistory);
    }

    // Apply compass rose visibility (only if map is initialized)
    if (typeof map !== 'undefined' && map && typeof toggleCompassRose === 'function') {
        toggleCompassRose(currentSettings.navigation.showCompassRose);
    }

    // Apply AIS settings (only if AIS is initialized)
    if (typeof updateAISSettings === 'function') {
        updateAISSettings(currentSettings.ais);
    }

    // Apply Infrastructure settings (only if infrastructure is initialized and map is ready)
    if (typeof map !== 'undefined' && map && typeof updateInfrastructureSettings === 'function') {
        updateInfrastructureSettings(currentSettings.infrastructure);
    }

    // Apply Water Level settings (only if water level is initialized)
    if (typeof updateWaterLevelSettings === 'function') {
        updateWaterLevelSettings(currentSettings.waterLevel);
    }

    // Apply GPS threshold setting
    if (typeof LOW_SATELLITE_THRESHOLD !== 'undefined' && currentSettings.gps && currentSettings.gps.lowSatelliteThreshold) {
        window.LOW_SATELLITE_THRESHOLD = currentSettings.gps.lowSatelliteThreshold * 1000; // Convert seconds to milliseconds
        console.log(`📡 GPS low satellite threshold updated to ${currentSettings.gps.lowSatelliteThreshold}s`);
    }

    // Refresh UI elements with new unit labels
    refreshUnitLabels();

    // Refresh sensor dashboard if it's visible (to apply new units)
    if (typeof window.SensorsDashboard !== 'undefined' && typeof window.SensorsDashboard.isVisible === 'function') {
        if (window.SensorsDashboard.isVisible() && typeof renderSensorDashboard === 'function') {
            renderSensorDashboard();
            console.log('🔄 Sensor dashboard refreshed with new units');
        }
    }

    console.log('✅ Settings applied:', currentSettings);
}

// Refresh UI elements to display correct unit labels
function refreshUnitLabels() {
    // Update sensor tile unit labels
    const speedTile = document.querySelector('#speed');
    if (speedTile) {
        const speedUnit = speedTile.querySelector('.tile-unit');
        if (speedUnit && typeof getUnitLabel === 'function') {
            speedUnit.textContent = getUnitLabel('speed');
        }
    }

    const depthTile = document.querySelector('#depth');
    if (depthTile) {
        const depthUnit = depthTile.querySelector('.tile-unit');
        if (depthUnit && typeof getUnitLabel === 'function') {
            depthUnit.textContent = getUnitLabel('depth');
        }
    }

    const windTile = document.querySelector('#wind');
    if (windTile) {
        const windUnit = windTile.querySelector('.tile-unit');
        if (windUnit && typeof getUnitLabel === 'function') {
            windUnit.textContent = getUnitLabel('speed');
        }
    }

    // Trigger UI refresh if there's active data
    if (typeof lastGPSData !== 'undefined' && lastGPSData) {
        // Re-process last GPS data to update displays with new units
        if (typeof updateGPSDisplay === 'function') {
            updateGPSDisplay(lastGPSData);
        }
    }

    console.log('🔄 Unit labels refreshed');
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

// Import settings
function importSettings() {
    // Create a hidden file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const importedSettings = JSON.parse(text);

            // Validate settings structure
            if (!importedSettings.general || !importedSettings.navigation) {
                showMsg('❌ Ungültige Einstellungsdatei');
                return;
            }

            // Merge with default settings to ensure all keys exist
            currentSettings = { ...defaultSettings, ...importedSettings };

            // Save to localStorage
            localStorage.setItem('boatos_settings', JSON.stringify(currentSettings));

            // Save to backend
            await saveSettingsToBackend();

            // Apply settings
            applySettings();

            // Reload form
            loadSettingsToForm();

            showMsg('✅ Einstellungen importiert');
        } catch (error) {
            console.error('Import error:', error);
            showMsg('❌ Fehler beim Importieren');
        }
    };

    input.click();
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

    // Only reload from localStorage if backend had settings
    // Otherwise, keep the settings that were already loaded synchronously at script load
    if (loadedFromBackend) {
        console.log('✅ Settings loaded from backend, applying...');
        // Apply settings to the application
        applySettings();
    } else {
        console.log('ℹ️ No backend settings, using already loaded localStorage settings');
    }

    console.log('⚙️ Settings initialized:', currentSettings);
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

// Update routing provider settings visibility
function updateRoutingProviderVisibility() {
    const provider = document.getElementById('setting-routing-provider')?.value || 'osrm';
    const osrmField = document.getElementById('osrm-url-field');
    const graphhopperField = document.getElementById('graphhopper-api-key-field');
    const osrmInfoBox = document.getElementById('osrm-info-box');
    const graphhopperInfoBox = document.getElementById('graphhopper-info-box');
    const directInfoBox = document.getElementById('direct-info-box');

    // Show/hide input fields
    if (osrmField) {
        osrmField.style.display = (provider === 'osrm') ? 'block' : 'none';
    }
    if (graphhopperField) {
        graphhopperField.style.display = (provider === 'graphhopper') ? 'block' : 'none';
    }

    // Show/hide info boxes
    if (osrmInfoBox) {
        osrmInfoBox.style.display = (provider === 'osrm') ? 'block' : 'none';
    }
    if (graphhopperInfoBox) {
        graphhopperInfoBox.style.display = (provider === 'graphhopper') ? 'block' : 'none';
    }
    if (directInfoBox) {
        directInfoBox.style.display = (provider === 'direct') ? 'block' : 'none';
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

// Initialize settings immediately (synchronously load from localStorage)
(function() {
    const stored = localStorage.getItem('boatos_settings');
    if (stored) {
        try {
            const storedSettings = JSON.parse(stored);
            // Deep merge: merge each section individually to preserve new fields in defaultSettings
            currentSettings = {
                general: { ...defaultSettings.general, ...storedSettings.general },
                navigation: { ...defaultSettings.navigation, ...storedSettings.navigation },
                gps: { ...defaultSettings.gps, ...storedSettings.gps },
                weather: { ...defaultSettings.weather, ...storedSettings.weather },
                sensors: { ...defaultSettings.sensors, ...storedSettings.sensors },
                ais: { ...defaultSettings.ais, ...storedSettings.ais },
                infrastructure: { ...defaultSettings.infrastructure, ...storedSettings.infrastructure },
                waterLevel: { ...defaultSettings.waterLevel, ...storedSettings.waterLevel },
                routing: { ...defaultSettings.routing, ...storedSettings.routing },
                boat: { ...defaultSettings.boat, ...storedSettings.boat },
                waterCurrent: {
                    ...defaultSettings.waterCurrent,
                    ...storedSettings.waterCurrent,
                    byName: { ...defaultSettings.waterCurrent.byName, ...storedSettings.waterCurrent?.byName },
                    byType: { ...defaultSettings.waterCurrent.byType, ...storedSettings.waterCurrent?.byType }
                }
            };
            console.log('⚙️ Settings loaded synchronously from localStorage:', currentSettings);
        } catch (e) {
            console.error('Error parsing stored settings:', e);
        }
    } else {
        console.log('⚙️ Using default settings');
    }
})();

// Get boat settings for routing
function getBoatSettings() {
    return currentSettings.boat || defaultSettings.boat;
}

// Get water current settings for routing
function getWaterCurrentSettings() {
    return currentSettings.waterCurrent || defaultSettings.waterCurrent;
}

// Initialize on page load (apply settings and try loading from backend)
window.addEventListener('load', function() {
    // Apply settings first (this will call refreshUnitLabels)
    applySettings();

    // Then check backend for updates
    initializeSettings();
});

// ==================== DATABASE MANAGEMENT ====================

/**
 * Import locks from OpenStreetMap
 */
async function importLocksFromOSM() {
    if (!confirm('Möchten Sie neue Schleusen aus OpenStreetMap importieren?\n\nDieser Vorgang kann einige Minuten dauern.')) {
        return;
    }

    showMsg('🌍 Starte OSM-Import...', 5000);

    try {
        const response = await fetch(`${API_URL}/api/locks/import-osm`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMsg(`✅ ${result.imported} Schleusen importiert, ${result.updated} aktualisiert!`, 5000);

            // Reload locks on map if locks layer is active
            if (typeof updateLocksOnMap === 'function') {
                updateLocksOnMap();
            }
        } else {
            showMsg(`❌ Import fehlgeschlagen: ${result.error}`, 5000);
        }
    } catch (error) {
        console.error('OSM Import error:', error);
        showMsg(`❌ Fehler beim Import: ${error.message}`, 5000);
    }
}

/**
 * Enrich locks data with VHF channels and contact information
 */
async function enrichLocksData() {
    if (!confirm('Möchten Sie die Schleusen-Daten anreichern?\n\nVHF-Kanäle, Kontaktdaten und weitere Infos werden ergänzt.')) {
        return;
    }

    showMsg('✨ Starte Datenanreicherung...', 5000);

    try {
        const response = await fetch(`${API_URL}/api/locks/enrich`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            showMsg(`✅ ${result.enriched} Schleusen angereichert! VHF: ${result.vhf_coverage}`, 5000);

            // Reload locks on map
            if (typeof updateLocksOnMap === 'function') {
                updateLocksOnMap();
            }

            // Auto-show quality report
            setTimeout(() => checkLocksQuality(), 1000);
        } else {
            showMsg(`❌ Anreicherung fehlgeschlagen: ${result.error}`, 5000);
        }
    } catch (error) {
        console.error('Enrichment error:', error);
        showMsg(`❌ Fehler bei Anreicherung: ${error.message}`, 5000);
    }
}

/**
 * Check and display locks database quality
 */
async function checkLocksQuality() {
    showMsg('📊 Lade Qualitätsbericht...', 2000);

    try {
        const response = await fetch(`${API_URL}/api/locks/quality`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            // Format quality report
            const report = `
Gesamtzahl Schleusen: ${result.total}

═══ VHF-Kanäle ═══
Mit VHF: ${result.vhf_count}/${result.total} (${result.vhf_percentage})

═══ Kontaktdaten ═══
Telefonnummern: ${result.phone_count}/${result.total} (${result.phone_percentage})
E-Mail-Adressen: ${result.email_count}/${result.total} (${result.email_percentage})

═══ Technische Daten ═══
Abmessungen (L × B): ${result.dimensions_count}/${result.total} (${result.dimensions_percentage})
Kilometer-Marken: ${result.km_count}/${result.total} (${result.km_percentage})

═══ Zusatzinformationen ═══
Notizen/Hinweise: ${result.notes_count}/${result.total} (${result.notes_percentage})

═══ Top Wasserstraßen ═══
${result.top_waterways.map(w => `${w.waterway}: ${w.count} Schleusen`).join('\n')}

Datenstand: ${new Date().toLocaleString('de-DE')}
            `.trim();

            // Show report
            document.getElementById('locks-quality-content').textContent = report;
            document.getElementById('locks-quality-report').style.display = 'block';

            showMsg('✅ Qualitätsbericht geladen', 3000);
        } else {
            showMsg(`❌ Fehler: ${result.error}`, 5000);
        }
    } catch (error) {
        console.error('Quality check error:', error);
        showMsg(`❌ Fehler beim Laden: ${error.message}`, 5000);
    }
}

/**
 * Verify and fix lock positions against OpenStreetMap
 */
async function verifyLocksPositions() {
    if (!confirm('Möchten Sie alle Schleusen-Positionen überprüfen und korrigieren?\n\nDies kann 2-3 Minuten dauern und korrigiert automatisch Positionen mit >500m Abweichung von OpenStreetMap.')) {
        return;
    }

    showMsg('📍 Starte Positions-Überprüfung (2-3 Min.)...', 10000);

    try {
        const response = await fetch(`${API_URL}/api/locks/verify-positions`, {
            method: 'POST'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
            const message = result.fixed > 0
                ? `✅ ${result.checked} Schleusen geprüft, ${result.fixed} Positionen korrigiert (Ø ${result.avg_distance_fixed}m Abweichung)`
                : `✅ ${result.checked} Schleusen geprüft - alle Positionen korrekt!`;

            showMsg(message, 8000);

            // Reload locks on map if locks layer is active
            if (typeof updateLocksOnMap === 'function') {
                setTimeout(() => updateLocksOnMap(), 1000);
            }
        } else {
            showMsg(`❌ Überprüfung fehlgeschlagen: ${result.error}`, 5000);
        }
    } catch (error) {
        console.error('Position verification error:', error);
        showMsg(`❌ Fehler bei Überprüfung: ${error.message}`, 5000);
    }
}

// ==================== BOAT ICON SELECTION ====================
let selectedBoatIcon = 'motorboat_small';

/**
 * Load boat icon previews in the settings UI
 */
function loadBoatIconPreviews() {
    if (typeof BOAT_ICONS === 'undefined') {
        console.warn('⚠️ BOAT_ICONS not loaded yet');
        return;
    }

    Object.keys(BOAT_ICONS).forEach(iconType => {
        const previewEl = document.getElementById(`icon-preview-${iconType}`);
        if (previewEl) {
            previewEl.innerHTML = BOAT_ICONS[iconType];
        }
    });
}

/**
 * Select a boat icon
 * @param {string} iconType - The icon type to select
 * @param {boolean} updateMap - Whether to update the map marker immediately
 */
function selectBoatIcon(iconType, updateMap = true) {
    // Remove 'selected' class from all options
    document.querySelectorAll('.boat-icon-option').forEach(opt => {
        opt.classList.remove('selected');
    });

    // Add 'selected' class to clicked option
    const selectedOption = document.querySelector(`[data-icon="${iconType}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }

    // Update global variable
    selectedBoatIcon = iconType;

    // Update currentSettings
    if (currentSettings.boat) {
        currentSettings.boat.icon = iconType;
    }

    // Update map marker if requested and function is available
    if (updateMap && typeof updateBoatMarkerIcon === 'function') {
        updateBoatMarkerIcon(iconType);
    }
}

/**
 * Get the currently selected boat icon
 * @returns {string} The selected icon type
 */
function getSelectedBoatIcon() {
    return currentSettings.boat?.icon || selectedBoatIcon || 'motorboat_small';
}
