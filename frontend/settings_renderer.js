/**
 * Settings Renderer - Dashboard-Style
 * Renders settings in the same card-based layout as the sensor dashboard
 */

// Card Creation Functions (matching dashboard style)

function createSettingsHeroCard(icon, label, content) {
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
                </div>
            </div>
            <div style="font-size: 18px; color: white;">
                ${content}
            </div>
        </div>
    `;
}

function createSettingsCard(icon, label, content, color = 'cyan') {
    const colorMap = {
        cyan: 'linear-gradient(135deg, rgba(100, 255, 218, 0.1), rgba(100, 255, 218, 0.05))',
        blue: 'linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05))',
        orange: 'linear-gradient(135deg, rgba(230, 126, 34, 0.1), rgba(230, 126, 34, 0.05))',
        green: 'linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(46, 204, 113, 0.05))',
        purple: 'linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(155, 89, 182, 0.05))'
    };

    const borderColorMap = {
        cyan: 'rgba(100, 255, 218, 0.3)',
        blue: 'rgba(52, 152, 219, 0.3)',
        orange: 'rgba(230, 126, 34, 0.3)',
        green: 'rgba(46, 204, 113, 0.3)',
        purple: 'rgba(155, 89, 182, 0.3)'
    };

    const textColorMap = {
        cyan: '#64ffda',
        blue: '#3498db',
        orange: '#e67e22',
        green: '#2ecc71',
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
            <div style="font-size: 16px; color: white;">
                ${content}
            </div>
        </div>
    `;
}

// Render General Settings Tab
function renderGeneralSettings() {
    return `
        <div style="max-width: 1400px; margin: 0 auto; position: relative; z-index: 2;">
            <!-- Hero Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 30px;">
                ${createSettingsHeroCard('🌍', 'Sprache', `
                    <label style="display: block; color: #8892b0; font-size: 14px; margin-bottom: 8px;">Sprache / Language</label>
                    <select id="setting-language" style="
                        width: 100%;
                        padding: 12px 16px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 15px;
                    ">
                        <option value="de">🇩🇪 Deutsch</option>
                        <option value="en">🇬🇧 English</option>
                    </select>
                `)}

                ${createSettingsHeroCard('🎨', 'Design', `
                    <label style="display: block; color: #8892b0; font-size: 14px; margin-bottom: 8px;">Theme</label>
                    <select id="setting-theme" style="
                        width: 100%;
                        padding: 12px 16px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 15px;
                    ">
                        <option value="auto">Auto (System)</option>
                        <option value="dark">Dark</option>
                        <option value="light">Light</option>
                        <option value="night">Night Mode</option>
                    </select>
                `)}

                ${createSettingsHeroCard('⚡', 'Einheiten', `
                    <label style="display: block; color: #8892b0; font-size: 14px; margin-bottom: 8px;">Geschwindigkeit</label>
                    <select id="setting-speed-unit" style="
                        width: 100%;
                        padding: 12px 16px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 15px;
                        margin-bottom: 12px;
                    ">
                        <option value="kn">Knoten (kn)</option>
                        <option value="kmh">km/h</option>
                        <option value="mph">mph</option>
                    </select>

                    <label style="display: block; color: #8892b0; font-size: 14px; margin-bottom: 8px;">Distanz</label>
                    <select id="setting-distance-unit" style="
                        width: 100%;
                        padding: 12px 16px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 15px;
                    ">
                        <option value="nm">Seemeilen (nm)</option>
                        <option value="km">Kilometer (km)</option>
                        <option value="mi">Meilen (mi)</option>
                    </select>
                `)}
            </div>

            <!-- Detailed Settings Cards -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
                ${createSettingsCard('DPH', 'Tiefe', `
                    <select id="setting-depth-unit" style="
                        width: 100%;
                        padding: 10px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 14px;
                    ">
                        <option value="m">Meter (m)</option>
                        <option value="ft">Fuß (ft)</option>
                        <option value="fm">Faden (fm)</option>
                    </select>
                `, 'cyan')}

                ${createSettingsCard('TMP', 'Temperatur', `
                    <select id="setting-temperature-unit" style="
                        width: 100%;
                        padding: 10px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 14px;
                    ">
                        <option value="c">Celsius (°C)</option>
                        <option value="f">Fahrenheit (°F)</option>
                    </select>
                `, 'orange')}

                ${createSettingsCard('PRE', 'Druck', `
                    <select id="setting-pressure-unit" style="
                        width: 100%;
                        padding: 10px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 14px;
                    ">
                        <option value="hpa">hPa</option>
                        <option value="mbar">mbar</option>
                        <option value="mmhg">mmHg</option>
                        <option value="inhg">inHg</option>
                    </select>
                `, 'blue')}

                ${createSettingsCard('GPS', 'Koordinaten', `
                    <select id="setting-coordinate-format" style="
                        width: 100%;
                        padding: 10px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 14px;
                    ">
                        <option value="decimal">Dezimal</option>
                        <option value="dms">DMS</option>
                        <option value="dmm">DMM</option>
                    </select>
                `, 'purple')}

                ${createSettingsCard('CAL', 'Datum', `
                    <select id="setting-date-format" style="
                        width: 100%;
                        padding: 10px;
                        background: rgba(10, 14, 39, 0.6);
                        border: 2px solid rgba(100, 255, 218, 0.2);
                        border-radius: 8px;
                        color: #fff;
                        font-size: 14px;
                    ">
                        <option value="dd.mm.yyyy">DD.MM.YYYY</option>
                        <option value="mm/dd/yyyy">MM/DD/YYYY</option>
                        <option value="yyyy-mm-dd">YYYY-MM-DD</option>
                    </select>
                `, 'green')}
            </div>
        </div>
    `;
}

// Render Sensors Settings Tab
async function renderSensorsSettings() {
    try {
        const response = await fetch('/api/sensors/list');
        const data = await response.json();

        const statusColors = {
            online: '#2ecc71',
            offline: '#e74c3c',
            standby: '#f39c12'
        };

        const statusLabels = {
            online: 'Online',
            offline: 'Offline',
            standby: 'Standby'
        };

        return `
            <div style="max-width: 1400px; margin: 0 auto; position: relative; z-index: 2;">
                <!-- Sensor Overview Cards -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 25px; margin-bottom: 30px;">
                    ${createSettingsHeroCard('📊', 'Sensoren gesamt', data.total, '', 'Alle registrierten Sensoren')}
                    ${createSettingsHeroCard('✅', 'Online', data.online, '', 'Aktiv und senden Daten')}
                    ${createSettingsHeroCard('❌', 'Offline', data.offline, '', 'Keine Verbindung')}
                </div>

                <!-- Detected Sensors -->
                <h3 style="color: #64ffda; font-size: 20px; font-weight: 600; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid rgba(100, 255, 218, 0.2);">
                    🔌 Erkannte Sensoren
                </h3>

                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    ${data.sensors.map(sensor => {
                        // Define value labels for better readability
                        const valueLabels = {
                            latitude: 'Latitude',
                            longitude: 'Longitude',
                            satellites: 'Satelliten',
                            altitude: 'Höhe (m)',
                            speed: 'Speed (kn)',
                            heading: 'Heading (°)',
                            course: 'Course (°)',
                            depth: 'Tiefe (m)',
                            direction: 'Richtung (°)',
                            rpm: 'RPM',
                            temperature: 'Temp (°C)',
                            oil_pressure: 'Öldruck (bar)',
                            voltage: 'Spannung (V)',
                            current: 'Strom (A)',
                            humidity: 'Luftfeuchte (%)'
                        };

                        return `
                        <div style="
                            background: linear-gradient(135deg, rgba(30, 60, 114, 0.6), rgba(42, 82, 152, 0.6));
                            backdrop-filter: blur(15px);
                            border: 2px solid ${sensor.status === 'online' ? 'rgba(46, 204, 113, 0.4)' : sensor.status === 'offline' ? 'rgba(231, 76, 60, 0.4)' : 'rgba(243, 156, 18, 0.4)'};
                            border-radius: 16px;
                            padding: 24px;
                            box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                            position: relative;
                            overflow: hidden;
                        ">
                            <!-- Status Indicator -->
                            <div style="
                                position: absolute;
                                top: 15px;
                                right: 15px;
                                background: ${statusColors[sensor.status]};
                                color: white;
                                padding: 4px 12px;
                                border-radius: 20px;
                                font-size: 11px;
                                font-weight: 600;
                                text-transform: uppercase;
                                letter-spacing: 0.5px;
                                box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                            ">${statusLabels[sensor.status]}</div>

                            <!-- Sensor Icon & Name -->
                            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                                <span style="font-size: 36px;">${sensor.icon}</span>
                                <div>
                                    <div style="font-size: 19px; font-weight: 600; color: white;">${sensor.name}</div>
                                    <div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 1.2px;">${sensor.type}</div>
                                </div>
                            </div>

                            <!-- Sensor Values (grouped and styled) -->
                            <div style="
                                background: rgba(10, 14, 39, 0.5);
                                border-radius: 10px;
                                padding: 14px;
                                border: 1px solid rgba(100, 255, 218, 0.1);
                            ">
                                ${Object.entries(sensor.values).map(([key, value], index) => `
                                    <div style="
                                        display: flex;
                                        justify-content: space-between;
                                        align-items: center;
                                        padding: 8px 0;
                                        ${index < Object.keys(sensor.values).length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.08);' : ''}
                                    ">
                                        <span style="
                                            color: #8892b0;
                                            font-size: 12px;
                                            font-weight: 500;
                                        ">${valueLabels[key] || key}</span>
                                        <span style="
                                            color: ${sensor.status === 'online' ? '#64ffda' : sensor.status === 'offline' ? '#e74c3c' : '#f39c12'};
                                            font-size: 14px;
                                            font-weight: 700;
                                            font-family: monospace;
                                        ">${typeof value === 'number' ? (key === 'latitude' || key === 'longitude' ? value.toFixed(6) : value.toFixed(2)) : value}</span>
                                    </div>
                                `).join('')}
                            </div>

                            <!-- MQTT Topics -->
                            ${sensor.topics && sensor.topics.length > 0 ? `
                            <div style="
                                margin-top: 16px;
                                padding-top: 12px;
                                border-top: 1px solid rgba(100, 255, 218, 0.2);
                            ">
                                <div style="
                                    font-size: 11px;
                                    color: #8892b0;
                                    font-weight: 600;
                                    text-transform: uppercase;
                                    letter-spacing: 1px;
                                    margin-bottom: 8px;
                                ">📡 MQTT Topics:</div>
                                <div style="
                                    display: flex;
                                    flex-direction: column;
                                    gap: 4px;
                                ">
                                    ${sensor.topics.map(topic => `
                                        <div style="
                                            background: rgba(100, 255, 218, 0.05);
                                            padding: 6px 10px;
                                            border-radius: 6px;
                                            border: 1px solid rgba(100, 255, 218, 0.15);
                                            font-family: monospace;
                                            font-size: 11px;
                                            color: #64ffda;
                                            word-break: break-all;
                                        ">${topic}</div>
                                    `).join('')}
                                </div>
                            </div>
                            ` : ''}

                            <!-- Sensor ID Badge -->
                            <div style="
                                margin-top: 14px;
                                text-align: center;
                                background: rgba(100, 255, 218, 0.1);
                                padding: 6px;
                                border-radius: 6px;
                                border: 1px solid rgba(100, 255, 218, 0.2);
                            ">
                                <span style="font-size: 10px; color: #64ffda; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">ID: ${sensor.id}</span>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>

            </div>
        `;
    } catch (error) {
        console.error('Error loading sensors:', error);
        return `
            <div style="padding: 40px; text-align: center; color: #e74c3c;">
                <h3>⚠️ Fehler beim Laden der Sensoren</h3>
                <p style="color: #8892b0; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

// Export
window.SettingsRenderer = {
    renderGeneralSettings: renderGeneralSettings,
    renderSensorsSettings: renderSensorsSettings,
    createSettingsHeroCard: createSettingsHeroCard,
    createSettingsCard: createSettingsCard
};
