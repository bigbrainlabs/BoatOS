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

                <!-- Refresh Sensors Button -->
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; gap: 15px;">
                    <h3 style="color: #64ffda; font-size: 20px; font-weight: 600; margin: 0;">
                        🔌 Erkannte Sensoren
                    </h3>
                    <div style="display: flex; gap: 10px;">
                        <button onclick="cleanupZombieTopics()" id="cleanup-topics-btn" style="
                            padding: 12px 24px;
                            background: linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(192, 57, 43, 0.2));
                            border: 1px solid rgba(231, 76, 60, 0.3);
                            border-radius: 10px;
                            color: #e74c3c;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        " onmouseover="this.style.background='linear-gradient(135deg, rgba(231, 76, 60, 0.3), rgba(192, 57, 43, 0.3))'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(231, 76, 60, 0.3)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(192, 57, 43, 0.2))'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            🧹 Zombies löschen
                        </button>
                        <button onclick="refreshSensors()" id="refresh-sensors-btn" style="
                            padding: 12px 24px;
                            background: linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2));
                            border: 1px solid rgba(100, 255, 218, 0.3);
                            border-radius: 10px;
                            color: #64ffda;
                            font-size: 14px;
                            font-weight: 600;
                            cursor: pointer;
                            transition: all 0.3s ease;
                            text-transform: uppercase;
                            letter-spacing: 0.5px;
                        " onmouseover="this.style.background='linear-gradient(135deg, rgba(100, 255, 218, 0.3), rgba(52, 152, 219, 0.3))'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(100, 255, 218, 0.3)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2))'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            🔄 Aktualisieren
                        </button>
                    </div>
                </div>

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

                            <!-- Custom Alias -->
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
                                ">✏️ Eigener Name (Alias):</div>
                                <div style="display: flex; gap: 8px;">
                                    <input
                                        type="text"
                                        id="alias-${sensor.id}"
                                        value="${sensor.has_alias ? sensor.name : ''}"
                                        placeholder="z.B. Haupttemperatursensor"
                                        style="
                                            flex: 1;
                                            padding: 10px 12px;
                                            background: rgba(10, 14, 39, 0.6);
                                            border: 1px solid rgba(100, 255, 218, 0.3);
                                            border-radius: 8px;
                                            color: #fff;
                                            font-size: 13px;
                                            font-family: inherit;
                                        "
                                    />
                                    <button
                                        onclick="saveSensorAlias('${sensor.base_name}', '${sensor.id}')"
                                        id="save-alias-${sensor.id}"
                                        style="
                                            padding: 10px 16px;
                                            background: linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2));
                                            border: 1px solid rgba(100, 255, 218, 0.3);
                                            border-radius: 8px;
                                            color: #64ffda;
                                            font-size: 13px;
                                            font-weight: 600;
                                            cursor: pointer;
                                            transition: all 0.3s ease;
                                            white-space: nowrap;
                                        "
                                        onmouseover="this.style.background='linear-gradient(135deg, rgba(100, 255, 218, 0.3), rgba(52, 152, 219, 0.3))'"
                                        onmouseout="this.style.background='linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2))'"
                                    >💾 Speichern</button>
                                </div>
                                ${sensor.has_alias ? `
                                    <div style="
                                        margin-top: 8px;
                                        font-size: 11px;
                                        color: #64ffda;
                                        background: rgba(100, 255, 218, 0.05);
                                        padding: 6px 10px;
                                        border-radius: 6px;
                                        border: 1px solid rgba(100, 255, 218, 0.15);
                                    ">
                                        ✓ Alias aktiv (Basis: ${sensor.base_name})
                                    </div>
                                ` : ''}
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

/**
 * Render MQTT Connection Settings Card
 */
async function renderMqttConnectionCard() {
    // Load current MQTT settings
    let mqttSettings = {
        host: 'localhost',
        port: 1883,
        username: '',
        password: ''
    };

    try {
        const response = await fetch('/api/settings');
        if (response.ok) {
            const settings = await response.json();
            if (settings.mqtt_url) {
                // Parse mqtt://host:port format
                const url = new URL(settings.mqtt_url.replace('mqtt://', 'http://'));
                mqttSettings.host = url.hostname;
                mqttSettings.port = url.port || 1883;
            }
            mqttSettings.username = settings.mqtt_username || '';
            mqttSettings.password = settings.mqtt_password || '';
        }
    } catch (error) {
        console.error('Error loading MQTT settings:', error);
    }

    return `
        <div style="
            background: linear-gradient(135deg, rgba(30, 60, 114, 0.8), rgba(42, 82, 152, 0.8));
            backdrop-filter: blur(15px);
            border: 1px solid rgba(100, 255, 218, 0.2);
            border-radius: 24px;
            padding: 35px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            margin-top: 30px;
        ">
            <!-- Header -->
            <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 30px;">
                <div style="
                    background: linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2));
                    padding: 15px;
                    border-radius: 16px;
                    font-size: 28px;
                ">📡</div>
                <div>
                    <h3 style="margin: 0; color: #64ffda; font-size: 20px; font-weight: 700;">MQTT Broker Verbindung</h3>
                    <p style="margin: 5px 0 0 0; color: #8892b0; font-size: 13px;">Konfiguration der MQTT-Verbindung für Sensordaten</p>
                </div>
            </div>

            <!-- Connection Status -->
            <div id="mqtt-connection-status" style="
                padding: 12px 20px;
                background: rgba(100, 255, 218, 0.1);
                border: 1px solid rgba(100, 255, 218, 0.3);
                border-radius: 12px;
                margin-bottom: 25px;
                display: none;
            ">
                <span style="color: #64ffda; font-weight: 600;">✓ Verbindung erfolgreich</span>
            </div>

            <!-- Form Fields -->
            <div style="display: grid; gap: 20px;">
                <!-- Host -->
                <div>
                    <label style="
                        display: block;
                        color: #ccd6f6;
                        font-size: 13px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Host</label>
                    <input type="text" id="mqtt-host" value="${mqttSettings.host}" placeholder="localhost" style="
                        width: 100%;
                        padding: 14px 18px;
                        background: rgba(10, 25, 47, 0.8);
                        border: 1px solid rgba(100, 255, 218, 0.2);
                        border-radius: 12px;
                        color: #ccd6f6;
                        font-size: 15px;
                        font-family: monospace;
                        box-sizing: border-box;
                        transition: all 0.3s ease;
                    " onfocus="this.style.borderColor='rgba(100, 255, 218, 0.5)'" onblur="this.style.borderColor='rgba(100, 255, 218, 0.2)'">
                </div>

                <!-- Port -->
                <div>
                    <label style="
                        display: block;
                        color: #ccd6f6;
                        font-size: 13px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Port</label>
                    <input type="number" id="mqtt-port" value="${mqttSettings.port}" placeholder="1883" style="
                        width: 100%;
                        padding: 14px 18px;
                        background: rgba(10, 25, 47, 0.8);
                        border: 1px solid rgba(100, 255, 218, 0.2);
                        border-radius: 12px;
                        color: #ccd6f6;
                        font-size: 15px;
                        font-family: monospace;
                        box-sizing: border-box;
                        transition: all 0.3s ease;
                    " onfocus="this.style.borderColor='rgba(100, 255, 218, 0.5)'" onblur="this.style.borderColor='rgba(100, 255, 218, 0.2)'">
                </div>

                <!-- Username (optional) -->
                <div>
                    <label style="
                        display: block;
                        color: #ccd6f6;
                        font-size: 13px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Username <span style="color: #8892b0; font-size: 11px; text-transform: none;">(optional)</span></label>
                    <input type="text" id="mqtt-username" value="${mqttSettings.username}" placeholder="Benutzername" style="
                        width: 100%;
                        padding: 14px 18px;
                        background: rgba(10, 25, 47, 0.8);
                        border: 1px solid rgba(100, 255, 218, 0.2);
                        border-radius: 12px;
                        color: #ccd6f6;
                        font-size: 15px;
                        font-family: monospace;
                        box-sizing: border-box;
                        transition: all 0.3s ease;
                    " onfocus="this.style.borderColor='rgba(100, 255, 218, 0.5)'" onblur="this.style.borderColor='rgba(100, 255, 218, 0.2)'">
                </div>

                <!-- Password (optional) -->
                <div>
                    <label style="
                        display: block;
                        color: #ccd6f6;
                        font-size: 13px;
                        font-weight: 600;
                        margin-bottom: 8px;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                    ">Password <span style="color: #8892b0; font-size: 11px; text-transform: none;">(optional)</span></label>
                    <input type="password" id="mqtt-password" value="${mqttSettings.password}" placeholder="Passwort" style="
                        width: 100%;
                        padding: 14px 18px;
                        background: rgba(10, 25, 47, 0.8);
                        border: 1px solid rgba(100, 255, 218, 0.2);
                        border-radius: 12px;
                        color: #ccd6f6;
                        font-size: 15px;
                        font-family: monospace;
                        box-sizing: border-box;
                        transition: all 0.3s ease;
                    " onfocus="this.style.borderColor='rgba(100, 255, 218, 0.5)'" onblur="this.style.borderColor='rgba(100, 255, 218, 0.2)'">
                </div>

                <!-- Buttons -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 10px;">
                    <button id="mqtt-test-connection" onclick="testMqttConnection()" style="
                        padding: 16px;
                        background: linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2));
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        border-radius: 12px;
                        color: #64ffda;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    " onmouseover="this.style.background='linear-gradient(135deg, rgba(100, 255, 218, 0.3), rgba(52, 152, 219, 0.3))'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(100, 255, 218, 0.3)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2))'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        🔌 Testen
                    </button>
                    <button id="mqtt-save-settings" onclick="saveMqttSettings()" style="
                        padding: 16px;
                        background: linear-gradient(135deg, rgba(46, 204, 113, 0.2), rgba(39, 174, 96, 0.2));
                        border: 1px solid rgba(46, 204, 113, 0.3);
                        border-radius: 12px;
                        color: #2ecc71;
                        font-size: 15px;
                        font-weight: 700;
                        cursor: pointer;
                        transition: all 0.3s ease;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    " onmouseover="this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 0.3), rgba(39, 174, 96, 0.3))'; this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 20px rgba(46, 204, 113, 0.3)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(46, 204, 113, 0.2), rgba(39, 174, 96, 0.2))'; this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                        💾 Speichern
                    </button>
                </div>
            </div>

            <!-- Info Text -->
            <div style="
                margin-top: 20px;
                padding: 15px;
                background: rgba(100, 255, 218, 0.05);
                border-left: 3px solid rgba(100, 255, 218, 0.5);
                border-radius: 8px;
            ">
                <p style="margin: 0 0 10px 0; color: #8892b0; font-size: 12px; line-height: 1.6;">
                    💡 <strong style="color: #64ffda;">Hinweis:</strong> Die MQTT-Verbindung wird für den Empfang von Sensordaten verwendet.
                </p>
                <p style="margin: 0; color: #8892b0; font-size: 12px; line-height: 1.6;">
                    🐳 <strong style="color: #64ffda;">Docker:</strong> Bei MQTT-Broker in Docker-Container:
                    <br>• Mit <code style="background: rgba(100, 255, 218, 0.1); padding: 2px 6px; border-radius: 4px;">--network host</code> oder Port-Mapping: <code style="background: rgba(100, 255, 218, 0.1); padding: 2px 6px; border-radius: 4px;">localhost</code> verwenden
                    <br>• Mit Docker-Network: Container-Name oder <code style="background: rgba(100, 255, 218, 0.1); padding: 2px 6px; border-radius: 4px;">host.docker.internal</code> verwenden
                </p>
            </div>
        </div>
    `;
}

/**
 * Save MQTT Settings
 */
window.saveMqttSettings = async function() {
    const button = document.getElementById('mqtt-save-settings');
    const originalButtonText = button.innerHTML;

    // Show loading state
    button.innerHTML = '⏳ Speichere...';
    button.disabled = true;

    try {
        const host = document.getElementById('mqtt-host').value;
        const port = document.getElementById('mqtt-port').value;
        const username = document.getElementById('mqtt-username').value;
        const password = document.getElementById('mqtt-password').value;

        // Construct MQTT URL
        const mqttUrl = `mqtt://${host}:${port}`;

        // Save to backend
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mqtt_url: mqttUrl,
                mqtt_host: host,
                mqtt_port: parseInt(port),
                mqtt_username: username,
                mqtt_password: password
            })
        });

        if (response.ok) {
            button.innerHTML = '✅ Gespeichert';
            console.log('✅ MQTT settings saved');

            // Reset button after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        } else {
            button.innerHTML = '❌ Fehler';
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('MQTT save error:', error);
        button.innerHTML = '❌ Fehler';
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    }
};

/**
 * Test MQTT Connection
 */
window.testMqttConnection = async function() {
    const button = document.getElementById('mqtt-test-connection');
    const statusDiv = document.getElementById('mqtt-connection-status');
    const originalButtonText = button.innerHTML;

    // Show loading state
    button.innerHTML = '⏳ Teste Verbindung...';
    button.disabled = true;
    statusDiv.style.display = 'none';

    try {
        const host = document.getElementById('mqtt-host').value;
        const port = document.getElementById('mqtt-port').value;
        const username = document.getElementById('mqtt-username').value;
        const password = document.getElementById('mqtt-password').value;

        // Test connection via backend
        const response = await fetch('/api/mqtt/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host, port: parseInt(port), username, password })
        });

        if (response.ok) {
            const result = await response.json();
            statusDiv.style.display = 'block';
            statusDiv.style.background = 'rgba(46, 204, 113, 0.1)';
            statusDiv.style.borderColor = 'rgba(46, 204, 113, 0.3)';
            statusDiv.innerHTML = '<span style="color: #2ecc71; font-weight: 600;">✓ Verbindung erfolgreich</span>';
        } else {
            statusDiv.style.display = 'block';
            statusDiv.style.background = 'rgba(231, 76, 60, 0.1)';
            statusDiv.style.borderColor = 'rgba(231, 76, 60, 0.3)';
            statusDiv.innerHTML = '<span style="color: #e74c3c; font-weight: 600;">✗ Verbindung fehlgeschlagen</span>';
        }
    } catch (error) {
        console.error('MQTT test error:', error);
        statusDiv.style.display = 'block';
        statusDiv.style.background = 'rgba(231, 76, 60, 0.1)';
        statusDiv.style.borderColor = 'rgba(231, 76, 60, 0.3)';
        statusDiv.innerHTML = '<span style="color: #e74c3c; font-weight: 600;">✗ Fehler beim Testen der Verbindung</span>';
    } finally {
        button.innerHTML = originalButtonText;
        button.disabled = false;
    }
};

/**
 * Refresh Sensors List
 */
window.refreshSensors = async function() {
    const button = document.getElementById('refresh-sensors-btn');
    if (!button) return;

    const originalButtonText = button.innerHTML;

    // Show loading state
    button.innerHTML = '⏳ Aktualisiere...';
    button.disabled = true;

    try {
        // Reload sensors tab content
        if (typeof window.SettingsRenderer !== 'undefined' &&
            typeof window.SettingsRenderer.renderSensorsSettings === 'function' &&
            typeof window.SettingsRenderer.renderMqttConnectionCard === 'function') {

            const sensorsTab = document.getElementById('settings-sensors');
            if (sensorsTab) {
                // Render both sensors list and MQTT connection card
                const [sensorsHtml, mqttHtml] = await Promise.all([
                    window.SettingsRenderer.renderSensorsSettings(),
                    window.SettingsRenderer.renderMqttConnectionCard()
                ]);

                sensorsTab.innerHTML = sensorsHtml + mqttHtml;
                console.log('✅ Sensoren aktualisiert');
            }
        }
    } catch (error) {
        console.error('Error refreshing sensors:', error);
        button.innerHTML = '❌ Fehler';
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    }
};

/**
 * Cleanup Zombie MQTT Topics (topics that haven't been updated in a while)
 */
window.cleanupZombieTopics = async function() {
    const button = document.getElementById('cleanup-topics-btn');
    if (!button) return;

    const originalButtonText = button.innerHTML;

    // Show loading state
    button.innerHTML = '⏳ Räume auf...';
    button.disabled = true;

    try {
        // Call cleanup endpoint (default: remove topics older than 60 minutes)
        const response = await fetch('/api/mqtt/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ max_age_minutes: 60 })
        });

        if (response.ok) {
            const result = await response.json();
            console.log('🧹 Zombie topics removed:', result);

            button.innerHTML = `✅ ${result.removed} gelöscht`;

            // Refresh sensors list after cleanup
            setTimeout(() => {
                window.refreshSensors();
            }, 1000);

            // Reset button after 2 seconds
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        } else {
            button.innerHTML = '❌ Fehler';
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('Error cleaning up zombie topics:', error);
        button.innerHTML = '❌ Fehler';
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    }
};

/**
 * Save Sensor Alias
 */
window.saveSensorAlias = async function(baseName, sensorId) {
    const button = document.getElementById(`save-alias-${sensorId}`);
    const input = document.getElementById(`alias-${sensorId}`);

    if (!button || !input) return;

    const originalButtonText = button.innerHTML;
    const aliasValue = input.value.trim();

    // Show loading state
    button.innerHTML = '⏳';
    button.disabled = true;

    try {
        // Load current settings
        const settingsResponse = await fetch('/api/settings');
        const currentSettings = settingsResponse.ok ? await settingsResponse.json() : {};

        // Get or create sensor_aliases object
        if (!currentSettings.sensor_aliases) {
            currentSettings.sensor_aliases = {};
        }

        // Update or remove alias
        if (aliasValue === '') {
            // Remove alias if empty
            delete currentSettings.sensor_aliases[baseName];
        } else {
            // Set new alias
            currentSettings.sensor_aliases[baseName] = aliasValue;
        }

        // Save settings
        const response = await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(currentSettings)
        });

        if (response.ok) {
            console.log('✅ Alias gespeichert:', baseName, '→', aliasValue);
            button.innerHTML = '✅';

            // Refresh sensors list to show new alias
            setTimeout(() => {
                window.refreshSensors();
            }, 800);
        } else {
            button.innerHTML = '❌';
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('Error saving sensor alias:', error);
        button.innerHTML = '❌';
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    }
};

/**
 * Render Dashboard Settings
 */
async function renderDashboardSettings() {
    try {
        // Load current layout
        const response = await fetch('/api/dashboard/layout');
        const data = await response.json();
        const layout = data.layout || '';

        return `
            <div style="max-width: 1400px; margin: 0 auto; position: relative; z-index: 2;">
                <!-- Hero Card -->
                ${createSettingsHeroCard('📊', 'Dashboard Layout', `
                    <p style="color: #8892b0; font-size: 14px; line-height: 1.6; margin: 0;">
                        Konfiguriere das Dashboard-Layout mit der BoatOS DSL (Domain Specific Language).
                        <a href="https://github.com/bigbrainlabs/BoatOS/blob/main/DASHBOARD_DSL.md" target="_blank" style="color: #64ffda; text-decoration: none;">
                            📖 Dokumentation
                        </a>
                    </p>
                `)}

                <!-- Code Editor -->
                <div style="margin-bottom: 30px;">
                    <div style="
                        background: linear-gradient(135deg, rgba(30, 60, 114, 0.6), rgba(42, 82, 152, 0.6));
                        backdrop-filter: blur(15px);
                        border: 1px solid rgba(100, 255, 218, 0.2);
                        border-radius: 16px;
                        padding: 24px;
                        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                    ">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <h3 style="color: #64ffda; font-size: 16px; font-weight: 600; margin: 0;">
                                DSL Code Editor
                            </h3>
                            <div style="display: flex; gap: 10px;">
                                <button onclick="testDashboardLayout()" id="test-dashboard-btn" style="
                                    padding: 10px 20px;
                                    background: linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.2));
                                    border: 1px solid rgba(52, 152, 219, 0.3);
                                    border-radius: 8px;
                                    color: #3498db;
                                    font-size: 13px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                ">🧪 Testen</button>
                                <button onclick="saveDashboardLayout()" id="save-dashboard-btn" style="
                                    padding: 10px 20px;
                                    background: linear-gradient(135deg, rgba(100, 255, 218, 0.2), rgba(52, 152, 219, 0.2));
                                    border: 1px solid rgba(100, 255, 218, 0.3);
                                    border-radius: 8px;
                                    color: #64ffda;
                                    font-size: 13px;
                                    font-weight: 600;
                                    cursor: pointer;
                                    transition: all 0.3s ease;
                                ">💾 Speichern</button>
                            </div>
                        </div>

                        <textarea id="dashboard-layout-editor" style="
                            width: 100%;
                            min-height: 400px;
                            padding: 16px;
                            background: rgba(10, 14, 39, 0.8);
                            border: 1px solid rgba(100, 255, 218, 0.3);
                            border-radius: 8px;
                            color: #fff;
                            font-size: 14px;
                            font-family: 'Courier New', monospace;
                            line-height: 1.6;
                            resize: vertical;
                        ">${layout}</textarea>

                        <div id="dashboard-errors" style="margin-top: 15px;"></div>
                    </div>
                </div>

                <!-- Example Layouts -->
                <div style="margin-bottom: 30px;">
                    ${createSettingsCard('📝', 'Beispiel-Layouts', `
                        <div style="display: flex; flex-direction: column; gap: 10px;">
                            <button onclick="loadExampleLayout('default')" style="
                                padding: 12px;
                                background: rgba(100, 255, 218, 0.1);
                                border: 1px solid rgba(100, 255, 218, 0.3);
                                border-radius: 8px;
                                color: #64ffda;
                                font-size: 14px;
                                cursor: pointer;
                                text-align: left;
                            ">
                                📊 Default Layout (3-Spalten mit Hero-Cards)
                            </button>
                            <button onclick="loadExampleLayout('compact')" style="
                                padding: 12px;
                                background: rgba(100, 255, 218, 0.1);
                                border: 1px solid rgba(100, 255, 218, 0.3);
                                border-radius: 8px;
                                color: #64ffda;
                                font-size: 14px;
                                cursor: pointer;
                                text-align: left;
                            ">
                                📱 Compact Layout (4-Spalten klein)
                            </button>
                            <button onclick="loadExampleLayout('gauges')" style="
                                padding: 12px;
                                background: rgba(100, 255, 218, 0.1);
                                border: 1px solid rgba(100, 255, 218, 0.3);
                                border-radius: 8px;
                                color: #64ffda;
                                font-size: 14px;
                                cursor: pointer;
                                text-align: left;
                            ">
                                🎯 Gauge Layout (mit Anzeigen)
                            </button>
                        </div>
                    `, 'blue')}
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading dashboard settings:', error);
        return `
            <div style="padding: 40px; text-align: center; color: #e74c3c;">
                <h3>⚠️ Fehler beim Laden der Dashboard-Einstellungen</h3>
                <p style="color: #8892b0; margin-top: 10px;">${error.message}</p>
            </div>
        `;
    }
}

/**
 * Save Dashboard Layout
 */
window.saveDashboardLayout = async function() {
    const button = document.getElementById('save-dashboard-btn');
    const editor = document.getElementById('dashboard-layout-editor');
    const errorsDiv = document.getElementById('dashboard-errors');

    if (!button || !editor) return;

    const originalButtonText = button.innerHTML;
    button.innerHTML = '⏳ Speichere...';
    button.disabled = true;
    errorsDiv.innerHTML = '';

    try {
        const layout = editor.value;

        // First parse to check for errors
        const parseResponse = await fetch('/api/dashboard/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout })
        });
        const parseResult = await parseResponse.json();

        if (parseResult.errors && parseResult.errors.length > 0) {
            errorsDiv.innerHTML = `
                <div style="
                    background: rgba(231, 76, 60, 0.1);
                    border: 1px solid rgba(231, 76, 60, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                ">
                    <div style="color: #e74c3c; font-weight: 600; margin-bottom: 8px;">⚠️ Fehler gefunden:</div>
                    ${parseResult.errors.map(err => `
                        <div style="color: #e74c3c; font-size: 12px; margin-left: 10px;">• ${err}</div>
                    `).join('')}
                </div>
            `;
            button.innerHTML = '❌ Fehler';
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
            return;
        }

        // Save layout
        const response = await fetch('/api/dashboard/layout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout })
        });

        if (response.ok) {
            button.innerHTML = '✅ Gespeichert';

            // Reload dashboard
            if (window.dashboardRenderer) {
                await window.dashboardRenderer.loadAndRender();
            }

            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        } else {
            button.innerHTML = '❌ Fehler';
            setTimeout(() => {
                button.innerHTML = originalButtonText;
                button.disabled = false;
            }, 2000);
        }
    } catch (error) {
        console.error('Error saving dashboard layout:', error);
        button.innerHTML = '❌ Fehler';
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    }
};

/**
 * Test Dashboard Layout
 */
window.testDashboardLayout = async function() {
    const button = document.getElementById('test-dashboard-btn');
    const editor = document.getElementById('dashboard-layout-editor');
    const errorsDiv = document.getElementById('dashboard-errors');

    if (!button || !editor) return;

    const originalButtonText = button.innerHTML;
    button.innerHTML = '⏳ Teste...';
    button.disabled = true;

    try {
        const layout = editor.value;

        const response = await fetch('/api/dashboard/parse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ layout })
        });
        const result = await response.json();

        if (result.errors && result.errors.length > 0) {
            errorsDiv.innerHTML = `
                <div style="
                    background: rgba(231, 76, 60, 0.1);
                    border: 1px solid rgba(231, 76, 60, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                ">
                    <div style="color: #e74c3c; font-weight: 600; margin-bottom: 8px;">⚠️ Fehler gefunden:</div>
                    ${result.errors.map(err => `
                        <div style="color: #e74c3c; font-size: 12px; margin-left: 10px;">• ${err}</div>
                    `).join('')}
                </div>
            `;
            button.innerHTML = '❌ Fehler';
        } else {
            errorsDiv.innerHTML = `
                <div style="
                    background: rgba(46, 204, 113, 0.1);
                    border: 1px solid rgba(46, 204, 113, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                ">
                    <div style="color: #2ecc71; font-weight: 600;">✅ Layout ist valide!</div>
                    <div style="color: #8892b0; font-size: 12px; margin-top: 5px;">
                        Grid: ${result.grid} Spalten | ${result.rows.length} Reihen | ${result.rows.reduce((sum, row) => sum + row.widgets.length, 0)} Widgets
                    </div>
                </div>
            `;
            button.innerHTML = '✅ OK';
        }

        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    } catch (error) {
        console.error('Error testing dashboard layout:', error);
        button.innerHTML = '❌ Fehler';
        setTimeout(() => {
            button.innerHTML = originalButtonText;
            button.disabled = false;
        }, 2000);
    }
};

/**
 * Load Example Layout
 */
window.loadExampleLayout = function(type) {
    const editor = document.getElementById('dashboard-layout-editor');
    if (!editor) return;

    const examples = {
        default: `# Default BoatOS Dashboard
GRID 3

ROW hero
  SENSOR navigation/position SIZE 2 STYLE hero
  SENSOR navigation/gnss/satellites SIZE 1

ROW sensors
  SENSOR bilge/thermo
  SENSOR navigation/gnss
  TEXT "Weitere Sensoren folgen..." STYLE subtitle`,

        compact: `# Compact Dashboard (4 Spalten)
GRID 4

ROW
  SENSOR navigation/position SIZE 2 STYLE compact
  SENSOR navigation/gnss/satellites SIZE 1 STYLE compact
  SENSOR bilge/thermo SIZE 1 STYLE compact`,

        gauges: `# Dashboard mit Gauges
GRID 3

ROW hero
  SENSOR navigation/position SIZE 2 STYLE hero
  GAUGE navigation/speedOverGround MAX 20 UNIT "kn" COLOR cyan

ROW gauges
  GAUGE navigation/speedOverGround MAX 20 UNIT "kn"
  GAUGE navigation/gnss/satellites MAX 20 UNIT "" COLOR green
  TEXT "Mehr Daten" STYLE subtitle`
    };

    editor.value = examples[type] || examples.default;
};

// Export
window.SettingsRenderer = {
    renderGeneralSettings: renderGeneralSettings,
    renderSensorsSettings: renderSensorsSettings,
    renderMqttConnectionCard: renderMqttConnectionCard,
    renderDashboardSettings: renderDashboardSettings,
    createSettingsHeroCard: createSettingsHeroCard,
    createSettingsCard: createSettingsCard
};
