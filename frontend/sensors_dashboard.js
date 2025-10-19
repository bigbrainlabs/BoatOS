/**
 * Live Sensor Dashboard Module
 * Real-time display of all boat sensors with WebSocket updates
 */

const SENSORS_API_URL = window.location.hostname === 'localhost' ? 'http://localhost:8000' : '';
const SENSORS_WS_URL = window.location.hostname === 'localhost' ? 'ws://localhost:8000/ws' : `wss://${window.location.host}/ws`;

let sensorWebSocket = null;
let sensorData = {
    gps: { lat: 0, lon: 0, satellites: 0, altitude: 0, course: 0 },
    speed: 0,
    heading: 0,
    depth: 0,
    wind: { speed: 0, direction: 0 },
    engine: { rpm: 0, temp: 0, oil_pressure: 0 },
    battery: { voltage: 0, current: 0 },
    bilge: { temperature: 0, humidity: 0 }
};

// ==================== WebSocket Connection ====================

function connectSensorWebSocket() {
    if (sensorWebSocket && sensorWebSocket.readyState === WebSocket.OPEN) {
        return;
    }

    console.log('🔌 Connecting to sensor WebSocket...');

    try {
        sensorWebSocket = new WebSocket(SENSORS_WS_URL);

        sensorWebSocket.onopen = () => {
            console.log('✅ Sensor WebSocket connected');
            updateConnectionStatus(true);
        };

        sensorWebSocket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                updateSensorData(data);
            } catch (error) {
                console.error('Error parsing sensor data:', error);
            }
        };

        sensorWebSocket.onerror = (error) => {
            console.error('❌ Sensor WebSocket error:', error);
            updateConnectionStatus(false);
        };

        sensorWebSocket.onclose = () => {
            console.log('🔌 Sensor WebSocket closed, reconnecting...');
            updateConnectionStatus(false);
            setTimeout(connectSensorWebSocket, 3000);
        };
    } catch (error) {
        console.error('Error creating WebSocket:', error);
        setTimeout(connectSensorWebSocket, 3000);
    }
}

function updateSensorData(data) {
    // Update sensor data from WebSocket
    if (data.gps) {
        sensorData.gps = { ...sensorData.gps, ...data.gps };
    }
    if (data.speed !== undefined) {
        sensorData.speed = data.speed;
    }
    if (data.heading !== undefined) {
        sensorData.heading = data.heading;
    }
    if (data.depth !== undefined) {
        sensorData.depth = data.depth;
    }
    if (data.wind) {
        sensorData.wind = { ...sensorData.wind, ...data.wind };
    }
    if (data.engine) {
        sensorData.engine = { ...sensorData.engine, ...data.engine };
    }
    if (data.battery) {
        sensorData.battery = { ...sensorData.battery, ...data.battery };
    }
    if (data.bilge) {
        sensorData.bilge = { ...sensorData.bilge, ...data.bilge };
    }

    // Update UI
    if (isDashboardVisible()) {
        renderSensorDashboard();
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('sensor-connection-status');
    if (indicator) {
        indicator.classList.toggle('connected', connected);
        indicator.textContent = connected ? '[ON] Live' : '[OFF] Offline';
    }

    // Hide boot screen when connected
    if (connected) {
        updateBootStatus('Connected! Starting dashboard...');
        setTimeout(() => {
            hideBootScreen();
        }, 500);
    }
}

// ==================== Dashboard Rendering ====================

function isDashboardVisible() {
    const dashboard = document.getElementById('sensors-dashboard');
    return dashboard && dashboard.style.display !== 'none';
}

function showSensorsDashboard() {
    // Hide header, map-container, and controls for fullscreen dashboard
    const header = document.getElementById('header');
    const mapContainer = document.getElementById('map-container');
    const controls = document.getElementById('controls');
    const viewLabel = document.getElementById('current-view');

    if (header) header.style.display = 'none';
    if (mapContainer) mapContainer.style.display = 'none';
    if (controls) controls.style.display = 'none';

    // Show or create dashboard
    let dashboard = document.getElementById('sensors-dashboard');
    if (!dashboard) {
        dashboard = createDashboardElement();
        document.getElementById('app').appendChild(dashboard);
    }

    dashboard.style.display = 'flex';

    // Update button text (for when dashboard is hidden and button becomes visible again)
    if (viewLabel) viewLabel.textContent = '[DSH] Dashboard';

    // Render first, then connect to preserve connection status
    renderSensorDashboard();
    connectSensorWebSocket();

    // Update FAB
    updateFloatingActionButton();
}

function hideSensorsDashboard() {
    const dashboard = document.getElementById('sensors-dashboard');
    const header = document.getElementById('header');
    const mapContainer = document.getElementById('map-container');
    const controls = document.getElementById('controls');
    const viewLabel = document.getElementById('current-view');

    if (dashboard) dashboard.style.display = 'none';
    if (header) header.style.display = 'flex';
    if (mapContainer) mapContainer.style.display = 'block';
    if (controls) controls.style.display = 'flex';

    // CRITICAL: Wait for CSS grid to recalculate before invalidating map size
    // The map container needs time to get its dimensions after display:block
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            if (window.map && typeof window.map.invalidateSize === 'function') {
                const mapContainer = document.getElementById('map');
                const rect = mapContainer ? mapContainer.getBoundingClientRect() : null;
                console.log('🗺️ Dashboard closed - Map container is now visible');
                console.log('📐 Map container dimensions:', rect);
                console.log('📏 Map size BEFORE invalidate:', window.map.getSize());

                // Force map to recalculate its size based on the now-visible container
                window.map.invalidateSize({animate: false, pan: false});

                console.log('📏 Map size AFTER invalidate:', window.map.getSize());
            }
        });
    });

    // Reset button text to show where you can go
    if (viewLabel) {
        viewLabel.textContent = '[DSH] Dashboard';
    }

    if (sensorWebSocket) {
        sensorWebSocket.close();
        sensorWebSocket = null;
    }

    // Update FAB
    updateFloatingActionButton();
}

function createDashboardElement() {
    const dashboard = document.createElement('div');
    dashboard.id = 'sensors-dashboard';
    dashboard.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow-y: auto;
        padding: 0;
        background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%);
        z-index: 9999;
        display: flex;
        flex-direction: column;
    `;
    return dashboard;
}

function renderSensorDashboard() {
    const dashboard = document.getElementById('sensors-dashboard');
    if (!dashboard) return;

    // Save current connection status before re-rendering
    const wasConnected = sensorWebSocket && sensorWebSocket.readyState === WebSocket.OPEN;

    dashboard.innerHTML = `
        <!-- Animated Background -->
        <div class="animated-bg"></div>

        <!-- Dashboard Header -->
        <div style="
            background: linear-gradient(135deg, #1e3c72, #2a5298);
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: relative;
            z-index: 10;
        ">
            <h1 style="font-size: 28px; margin: 0;">⚓ Marine Dashboard</h1>
            <div style="display: flex; gap: 15px; align-items: center;">
                <div id="sensor-connection-status" style="
                    background: rgba(255,255,255,0.1);
                    padding: 5px 12px;
                    border-radius: 20px;
                    font-size: 14px;
                ">
                    [OFF] Connecting...
                </div>
            </div>
        </div>

        <!-- Dashboard Content -->
        <div style="flex: 1; overflow-y: auto; padding: 20px; position: relative;">
            <!-- Background Anchor Icon -->
            <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                font-size: 800px;
                opacity: 0.05;
                z-index: 1;
                pointer-events: none;
            ">⚓</div>

            <div style="max-width: 1400px; margin: 0 auto; position: relative; z-index: 2;">
                <!-- Hero Cards - Main Values -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 30px; position: relative; z-index: 10;">
                    ${createHeroCard('SPD', 'Speed', sensorData.speed.toFixed(1), 'kn', 'Geschwindigkeit')}
                    ${createHeroCard('BAT', 'Batterie', sensorData.battery.voltage.toFixed(1), 'V', 'Hauptbatterie')}
                    ${createHeroCard('TMP', 'Bilge', sensorData.bilge.temperature.toFixed(1), '°C', 'Temperatur')}
                </div>

                <!-- Navigation Details -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px; position: relative; z-index: 10;">
                    ${createStatCard('POS', 'Position', formatPosition(sensorData.gps.lat, sensorData.gps.lon), '', 'cyan')}
                    ${createStatCard('CRS', 'Kurs', Math.round(sensorData.gps.course || 0), '°', 'purple')}
                    ${createStatCard('HDG', 'Heading', Math.round(sensorData.heading), '°', 'purple')}
                    ${createStatCard('SAT', 'Satelliten', sensorData.gps.satellites, '', 'cyan')}
                </div>

                <!-- Environment & Systems -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; position: relative; z-index: 10;">
                    ${createStatCard('DPH', 'Tiefe', sensorData.depth.toFixed(1), 'm', 'cyan')}
                    ${createStatCard('WND', 'Wind', sensorData.wind.speed.toFixed(1), 'kn', 'blue')}
                    ${createStatCard('DIR', 'Richtung', Math.round(sensorData.wind.direction), '°', 'blue')}
                    ${createStatCard('HUM', 'Humidity', sensorData.bilge.humidity.toFixed(1), '%', 'blue')}
                    ${createStatCard('RPM', 'Motor RPM', sensorData.engine.rpm, 'RPM', 'red')}
                    ${createStatCard('TMP', 'Motor Temp', sensorData.engine.temp, '°C', 'orange')}
                    ${createStatCard('OIL', 'Öldruck', sensorData.engine.oil_pressure.toFixed(1), 'bar', 'amber')}
                    ${createStatCard('AMP', 'Strom', sensorData.battery.current.toFixed(1), 'A', 'green')}
                </div>
            </div>
        </div>
    `;

    // Restore connection status after re-rendering
    if (wasConnected) {
        updateConnectionStatus(true);
    }
}

function createHeroCard(icon, label, value, unit, subtitle) {
    return `
        <div style="
            background: linear-gradient(135deg, rgba(30, 60, 114, 0.8), rgba(42, 82, 152, 0.8));
            backdrop-filter: blur(15px);
            border: 1px solid rgba(100, 255, 218, 0.2);
            border-radius: 24px;
            padding: 35px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        ">
            <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 25px;">
                <div style="
                    background: linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2));
                    padding: 18px;
                    border-radius: 20px;
                    font-size: 24px;
                    font-weight: 700;
                    color: #64ffda;
                    font-family: monospace;
                    min-width: 70px;
                    text-align: center;
                ">${icon}</div>
                <div style="text-align: right;">
                    <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 5px;">${label}</div>
                    ${subtitle ? `<div style="font-size: 11px; color: #64ffda;">${subtitle}</div>` : ''}
                </div>
            </div>
            <div style="font-size: 64px; font-weight: 100; color: white; letter-spacing: -2px;">
                ${value}
                ${unit ? `<span style="font-size: 32px; color: #8892b0; margin-left: 10px;">${unit}</span>` : ''}
            </div>
        </div>
    `;
}

function createStatCard(icon, label, value, unit, color) {
    const colorMap = {
        cyan: 'linear-gradient(135deg, rgba(100, 255, 218, 0.1), rgba(100, 255, 218, 0.05))',
        blue: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05))',
        orange: 'linear-gradient(135deg, rgba(230, 126, 34, 0.1), rgba(230, 126, 34, 0.05))',
        red: 'linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(231, 76, 60, 0.05))',
        green: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(46, 204, 113, 0.05))',
        amber: 'linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(241, 196, 15, 0.05))',
        purple: 'linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(155, 89, 182, 0.05))'
    };

    const borderColorMap = {
        cyan: 'rgba(100, 255, 218, 0.3)',
        blue: 'rgba(52, 152, 219, 0.3)',
        orange: 'rgba(230, 126, 34, 0.3)',
        red: 'rgba(231, 76, 60, 0.3)',
        green: 'rgba(46, 204, 113, 0.3)',
        amber: 'rgba(241, 196, 15, 0.3)',
        purple: 'rgba(155, 89, 182, 0.3)'
    };

    const textColorMap = {
        cyan: '#64ffda',
        blue: '#3498db',
        orange: '#e67e22',
        red: '#e74c3c',
        green: '#2ecc71',
        amber: '#f1c40f',
        purple: '#9b59b6'
    };

    return `
        <div style="
            background: ${colorMap[color] || colorMap.cyan};
            backdrop-filter: blur(15px);
            border: 1px solid ${borderColorMap[color] || borderColorMap.cyan};
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
        ">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <span style="
                    font-size: 14px;
                    font-weight: 700;
                    color: ${textColorMap[color] || textColorMap.cyan};
                    font-family: monospace;
                ">${icon}</span>
                <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #8892b0;">${label}</span>
            </div>
            <div style="font-size: 42px; font-weight: 300; color: ${textColorMap[color] || textColorMap.cyan}; letter-spacing: -1px;">
                ${value}
                ${unit ? `<span style="font-size: 20px; color: #8892b0; margin-left: 6px;">${unit}</span>` : ''}
            </div>
        </div>
    `;
}

function formatPosition(lat, lon) {
    if (lat === 0 && lon === 0) return '--';
    return `${lat.toFixed(5)}°, ${lon.toFixed(5)}°`;
}

// ==================== Styles ====================

const dashboardStyles = `
    <style>
        /* Animated Background Effect */
        .animated-bg {
            position: fixed;
            inset: 0;
            overflow: hidden;
            pointer-events: none;
            opacity: 0.3;
            z-index: 1;
        }

        .animated-bg::before,
        .animated-bg::after {
            content: '';
            position: absolute;
            width: 600px;
            height: 600px;
            border-radius: 50%;
            filter: blur(100px);
            animation: float 20s ease-in-out infinite;
        }

        .animated-bg::before {
            background: radial-gradient(circle, rgba(100, 255, 218, 0.3), transparent);
            top: 0;
            right: 0;
            animation-delay: 0s;
        }

        .animated-bg::after {
            background: radial-gradient(circle, rgba(52, 152, 219, 0.3), transparent);
            bottom: 0;
            left: 0;
            animation-delay: 10s;
        }

        @keyframes float {
            0%, 100% {
                transform: translate(0, 0) scale(1);
            }
            33% {
                transform: translate(100px, -100px) scale(1.1);
            }
            66% {
                transform: translate(-100px, 100px) scale(0.9);
            }
        }

        /* Status Item Styles */
        .status-item.connected {
            background: rgba(46, 213, 115, 0.2) !important;
            color: #2ecc71;
            border: 1px solid rgba(46, 213, 115, 0.3);
            padding: 8px 16px;
            border-radius: 20px;
        }

        /* Floating Action Button */
        .floating-action-button {
            position: fixed;
            bottom: 30px;
            right: 30px;
            width: 70px;
            height: 70px;
            border-radius: 50%;
            background: linear-gradient(135deg, #1e3c72, #2a5298);
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 3px rgba(100, 255, 218, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            z-index: 10000;
            transition: all 0.3s ease;
            border: 2px solid rgba(100, 255, 218, 0.5);
            backdrop-filter: blur(10px);
        }

        .floating-action-button:hover {
            transform: scale(1.1);
            box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5), 0 0 0 4px rgba(100, 255, 218, 0.5);
        }

        .floating-action-button:active {
            transform: scale(0.95);
        }

        .fab-icon {
            font-size: 36px;
            line-height: 1;
            user-select: none;
            -webkit-user-select: none;
        }

        /* Pulse animation for FAB */
        @keyframes fab-pulse {
            0%, 100% {
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 3px rgba(100, 255, 218, 0.3);
            }
            50% {
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4), 0 0 0 6px rgba(100, 255, 218, 0.6);
            }
        }

        .floating-action-button {
            animation: fab-pulse 2s ease-in-out infinite;
        }
    </style>
`;

// Inject styles
if (!document.getElementById('sensors-dashboard-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'sensors-dashboard-styles';
    styleElement.innerHTML = dashboardStyles;
    document.head.appendChild(styleElement);
}

// ==================== Floating Action Button (FAB) ====================

function createFloatingActionButton() {
    // Remove existing FAB if present
    const existingFab = document.getElementById('view-switch-fab');
    if (existingFab) {
        existingFab.remove();
    }

    // Create FAB
    const fab = document.createElement('div');
    fab.id = 'view-switch-fab';
    fab.className = 'floating-action-button';
    fab.onclick = toggleViewFromFab;

    // Start with dashboard icon (since we start in dashboard view)
    fab.innerHTML = '<span class="fab-icon">🗺️</span>';

    document.body.appendChild(fab);

    // Update FAB state based on current view
    updateFloatingActionButton();

    console.log('✅ Floating Action Button created');
}

function updateFloatingActionButton() {
    const fab = document.getElementById('view-switch-fab');
    if (!fab) return;

    const isDashboard = isDashboardVisible();

    // Update icon and tooltip
    if (isDashboard) {
        fab.innerHTML = '<span class="fab-icon">🗺️</span>';
        fab.title = 'Navigation';
    } else {
        fab.innerHTML = '<span class="fab-icon">📊</span>';
        fab.title = 'Dashboard';
    }
}

function toggleViewFromFab() {
    if (isDashboardVisible()) {
        hideSensorsDashboard();
    } else {
        showSensorsDashboard();
    }
    updateFloatingActionButton();
}

// ==================== Boot Screen ====================

function updateBootStatus(message) {
    const statusElement = document.getElementById('boot-status');
    if (statusElement) {
        statusElement.textContent = message;
        console.log(`🚀 Boot: ${message}`);
    }
}

function hideBootScreen() {
    const bootScreen = document.getElementById('boot-screen');
    const app = document.getElementById('app');

    if (bootScreen) {
        console.log('✅ Boot complete - hiding boot screen');
        bootScreen.classList.add('fade-out');

        // Note: #app is now always visible (display:grid), boot screen just fades out

        // Map invalidation is handled when switching views - not needed here
        // because dashboard is shown immediately after boot

        setTimeout(() => {
            bootScreen.remove();
        }, 800);
    }
}

// Initialize FAB when script loads
document.addEventListener('DOMContentLoaded', () => {
    updateBootStatus('Loading interface...');
    setTimeout(() => {
        createFloatingActionButton();
        updateBootStatus('Connecting to sensors...');
    }, 100);
});

// Export functions
window.SensorsDashboard = {
    show: showSensorsDashboard,
    hide: hideSensorsDashboard,
    connect: connectSensorWebSocket,
    isVisible: isDashboardVisible
};
