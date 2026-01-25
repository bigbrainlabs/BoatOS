/**
 * BoatOS Dashboard Editor
 * Fullscreen drag & drop editor for dashboard configuration
 * Ocean Soft Theme
 */

class DashboardEditor {
    constructor() {
        this.widgets = [];
        this.sensors = [];
        this.gridColumns = 3;
        this.rows = ['main'];
        this.selectedWidget = null;
        this.container = null;
        this.mode = 'visual'; // 'visual' or 'code'
        this.dslText = '';
        this.showHelp = false;
    }

    /**
     * Initialize and open the editor
     */
    async open() {
        const overlay = document.getElementById('dashboardEditorOverlay');
        const content = document.getElementById('dashboardEditorContent');

        if (!overlay || !content) {
            console.error('Dashboard editor elements not found');
            return;
        }

        this.container = content;
        overlay.style.display = 'flex';

        // Load data
        await this.loadSensors();
        await this.loadLayout();

        // Render editor
        this.render();
    }

    /**
     * Close the editor
     */
    close() {
        const overlay = document.getElementById('dashboardEditorOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    /**
     * Load available sensors from API
     */
    async loadSensors() {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const response = await fetch(`${apiUrl}/api/sensors/list`);
            const data = await response.json();

            // Expand sensors to include individual values
            this.sensors = [];
            this.sensorGroups = []; // For grouped display

            (data.sensors || []).forEach(sensor => {
                // Add the sensor group
                this.sensorGroups.push({
                    base_name: sensor.base_name,
                    name: sensor.name,
                    icon: sensor.icon,
                    values: sensor.values || {},
                    topics: sensor.topics || []
                });

                // Add individual values as separate sensors
                const values = sensor.values || {};
                const valueKeys = Object.keys(values);

                if (valueKeys.length === 1) {
                    // Single value sensor - use base_name directly
                    this.sensors.push({
                        base_name: sensor.base_name,
                        full_path: sensor.base_name + '/' + valueKeys[0],
                        name: sensor.name,
                        value_name: valueKeys[0],
                        icon: sensor.icon,
                        current_value: values[valueKeys[0]],
                        unit: this.guessUnit(valueKeys[0])
                    });
                } else {
                    // Multi-value sensor - add each value separately
                    valueKeys.forEach(key => {
                        this.sensors.push({
                            base_name: sensor.base_name,
                            full_path: sensor.base_name + '/' + key,
                            name: sensor.name + ' › ' + this.formatValueName(key),
                            value_name: key,
                            icon: sensor.icon,
                            current_value: values[key],
                            unit: this.guessUnit(key)
                        });
                    });
                }
            });
        } catch (error) {
            console.error('Error loading sensors:', error);
            // Fallback sensors
            this.sensors = [
                { base_name: 'gps_speed', full_path: 'gps_speed', name: 'GPS Speed', icon: '🚀', unit: 'kn' },
                { base_name: 'gps_course', full_path: 'gps_course', name: 'GPS Kurs', icon: '🧭', unit: '°' },
                { base_name: 'depth', full_path: 'depth', name: 'Tiefe', icon: '🌊', unit: 'm' }
            ];
            this.sensorGroups = [];
        }
    }

    /**
     * Format value name for display
     */
    formatValueName(name) {
        const map = {
            temperature: 'Temperatur',
            humidity: 'Feuchtigkeit',
            pressure: 'Druck',
            latitude: 'Breitengrad',
            longitude: 'Längengrad',
            speed: 'Geschwindigkeit',
            course: 'Kurs',
            heading: 'Heading',
            depth: 'Tiefe',
            voltage: 'Spannung',
            current: 'Strom',
            rpm: 'Drehzahl',
            satellites: 'Satelliten',
            altitude: 'Höhe'
        };
        return map[name.toLowerCase()] || name;
    }

    /**
     * Guess unit from value name
     */
    guessUnit(name) {
        const units = {
            temperature: '°C',
            humidity: '%',
            pressure: 'hPa',
            speed: 'kn',
            depth: 'm',
            voltage: 'V',
            current: 'A',
            rpm: 'rpm',
            altitude: 'm',
            satellites: ''
        };
        return units[name.toLowerCase()] || '';
    }

    /**
     * Load current dashboard layout
     */
    async loadLayout() {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            console.log('Loading dashboard layout from:', apiUrl + '/api/dashboard/layout');
            const response = await fetch(`${apiUrl}/api/dashboard/layout`);
            const data = await response.json();
            console.log('Loaded layout data:', data);

            if (data.layout) {
                this.dslText = data.layout;
                await this.parseLayout(data.layout);
                console.log('Parsed widgets:', this.widgets);
            } else {
                console.log('No layout in response, using defaults');
                this.useDefaultLayout();
            }
        } catch (error) {
            console.error('Error loading layout:', error);
            this.useDefaultLayout();
        }
    }

    /**
     * Use default layout
     */
    useDefaultLayout() {
        this.dslText = `GRID 2

ROW main
  SENSOR gps_speed AS "Geschwindigkeit" SIZE 1 STYLE card
  SENSOR gps_course AS "Kurs" SIZE 1 STYLE card
  SENSOR depth AS "Tiefe" SIZE 1 STYLE card
  SENSOR wind_speed AS "Wind" SIZE 1 STYLE card
`;
        this.widgets = [
            { type: 'sensor', sensor: 'gps_speed', alias: 'Geschwindigkeit', size: 1, style: 'card', rowName: 'main' },
            { type: 'sensor', sensor: 'gps_course', alias: 'Kurs', size: 1, style: 'card', rowName: 'main' },
            { type: 'sensor', sensor: 'depth', alias: 'Tiefe', size: 1, style: 'card', rowName: 'main' },
            { type: 'sensor', sensor: 'wind_speed', alias: 'Wind', size: 1, style: 'card', rowName: 'main' }
        ];
        this.gridColumns = 2;
    }

    /**
     * Parse DSL layout
     */
    async parseLayout(dslText) {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const response = await fetch(`${apiUrl}/api/dashboard/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dslText })
            });
            const parsed = await response.json();

            this.gridColumns = parsed.grid || 3;
            this.widgets = [];
            this.rows = [];

            if (parsed.rows) {
                parsed.rows.forEach(row => {
                    if (!this.rows.includes(row.name)) {
                        this.rows.push(row.name);
                    }
                    row.widgets.forEach(widget => {
                        this.widgets.push({ ...widget, rowName: row.name });
                    });
                });
            }

            if (!this.rows.includes('main')) {
                this.rows.push('main');
            }
        } catch (error) {
            console.error('Error parsing layout:', error);
        }
    }

    /**
     * Render the editor UI
     */
    render() {
        if (!this.container) return;

        // Update DSL text when switching to code mode
        if (this.mode === 'code') {
            this.dslText = this.toDSL();
        }

        this.container.innerHTML = `
            <!-- Mode Toggle -->
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button onclick="window.dashboardEditor.setMode('visual')" style="
                    flex: 1;
                    padding: 12px 20px;
                    background: ${this.mode === 'visual' ? 'var(--accent)' : 'var(--bg-card)'};
                    color: ${this.mode === 'visual' ? 'white' : 'var(--text)'};
                    border: 1px solid ${this.mode === 'visual' ? 'var(--accent)' : 'var(--border)'};
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">🎨 Visuell</button>
                <button onclick="window.dashboardEditor.setMode('code')" style="
                    flex: 1;
                    padding: 12px 20px;
                    background: ${this.mode === 'code' ? 'var(--accent)' : 'var(--bg-card)'};
                    color: ${this.mode === 'code' ? 'white' : 'var(--text)'};
                    border: 1px solid ${this.mode === 'code' ? 'var(--accent)' : 'var(--border)'};
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                ">📝 Code</button>
            </div>

            ${this.mode === 'code' ? this.renderCodeEditor() : this.renderVisualEditor()}
        `;

        if (this.mode === 'visual') {
            this.initDragDrop();
        }
    }

    /**
     * Render Code Editor
     */
    renderCodeEditor() {
        return `
            <div style="height: calc(100% - 60px); display: flex; gap: 20px;">
                <!-- Code Editor -->
                <div style="flex: 1; display: flex; flex-direction: column;">
                    <div style="margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: var(--text-dim); font-size: 13px;">
                            DSL-Code direkt bearbeiten
                        </span>
                        <button onclick="window.dashboardEditor.toggleHelp()" style="
                            padding: 6px 12px;
                            background: var(--bg-card);
                            color: var(--accent);
                            border: 1px solid var(--border);
                            border-radius: 8px;
                            font-size: 12px;
                            cursor: pointer;
                        ">❓ Hilfe</button>
                    </div>
                    <textarea id="dsl-code-editor" style="
                    flex: 1;
                    width: 100%;
                    padding: 15px;
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    color: var(--text);
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 14px;
                    line-height: 1.6;
                    resize: none;
                " spellcheck="false">${this.escapeHtml(this.dslText)}</textarea>
                <div style="margin-top: 10px; display: flex; gap: 10px;">
                    <button onclick="window.dashboardEditor.applyCodeChanges()" style="
                        padding: 12px 24px;
                        background: var(--success);
                        color: white;
                        border: none;
                        border-radius: 10px;
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                    ">✓ Übernehmen</button>
                    <button onclick="window.dashboardEditor.resetCode()" style="
                        padding: 12px 24px;
                        background: var(--bg-panel);
                        color: var(--text);
                        border: 1px solid var(--border);
                        border-radius: 10px;
                        font-size: 14px;
                        cursor: pointer;
                    ">↺ Zurücksetzen</button>
                    </div>
                </div>

                <!-- Help Panel -->
                <div id="dsl-help-panel" style="
                    width: 320px;
                    background: var(--bg-panel);
                    border: 1px solid var(--border);
                    border-radius: 12px;
                    padding: 20px;
                    overflow-y: auto;
                    display: ${this.showHelp ? 'block' : 'none'};
                ">
                    <h3 style="color: var(--accent); margin: 0 0 15px 0; font-size: 16px;">📖 DSL Syntax</h3>

                    <div style="color: var(--text); font-size: 13px; line-height: 1.8;">
                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">GRID &lt;spalten&gt;</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">GRID 3</code>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">ROW &lt;name&gt;</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">ROW main</code>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">SENSOR &lt;pfad&gt;</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">SENSOR bilge/thermo/temperature</code>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">GAUGE &lt;pfad&gt;</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-size: 11px;">GAUGE sensor/temp MIN 0 MAX 50 UNIT "°C" STYLE arc180</code>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">Sensor-Optionen:</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">ALIAS "Name"</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">SIZE 2</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">STYLE hero|card|compact</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">COLOR blue</code>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">Gauge-Optionen:</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">MIN 0</code> <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">MAX 100</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">UNIT "°C"</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">LABEL "Temperatur"</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">DECIMALS 1</code>
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">Gauge-Styles:</strong><br>
                            arc180, arc270, arc360, bar
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">Farben:</strong><br>
                            cyan, blue, green, orange, purple, red
                        </div>

                        <div style="margin-bottom: 15px;">
                            <strong style="color: var(--accent);">Spezial-Widgets:</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">SPACER</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">CLOCK</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">COMPASS</code>
                        </div>

                        <div style="padding: 10px; background: var(--bg-card); border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre;">GRID 2

ROW navigation
  SENSOR gps_speed AS "SOG" SIZE 1
  SENSOR gps_course AS "COG" SIZE 1

ROW weather
  SENSOR temperature STYLE big
  SENSOR wind_speed COLOR blue</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Toggle help panel
     */
    toggleHelp() {
        this.showHelp = !this.showHelp;
        this.render();
    }

    /**
     * Render Visual Editor
     */
    renderVisualEditor() {
        return `
            <div class="editor-layout" style="
                display: flex;
                gap: 20px;
                height: calc(100% - 60px);
            ">
                <!-- Widget Palette -->
                <div class="widget-palette" style="
                    width: 280px;
                    background: var(--bg-panel);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 20px;
                    overflow-y: auto;
                ">
                    <h3 style="color: var(--accent); margin: 0 0 15px 0; font-size: 16px;">
                        📦 Verfügbare Widgets
                    </h3>
                    <p style="color: var(--text-dim); font-size: 12px; margin-bottom: 15px;">
                        Klicke um hinzuzufügen
                    </p>

                    <!-- Sensor Cards -->
                    <div style="margin-bottom: 15px;">
                        <h4 style="color: var(--text-dim); margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">📊 Sensoren</h4>
                        <div class="sensor-list" style="max-height: 200px; overflow-y: auto;">
                            ${this.sensors.map(sensor => `
                                <div class="palette-item" onclick="window.dashboardEditor.addWidget('sensor', '${sensor.full_path || sensor.base_name}')" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 10px;
                                    padding: 10px;
                                    background: var(--bg-card);
                                    border: 1px solid var(--border);
                                    border-radius: 10px;
                                    margin-bottom: 6px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
                                    <span style="font-size: 20px;">${sensor.icon}</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="color: var(--text); font-weight: 600; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sensor.name}</div>
                                        <div style="color: var(--text-dim); font-size: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sensor.full_path || sensor.base_name}</div>
                                    </div>
                                    ${sensor.current_value !== undefined ? `<span style="color: var(--accent); font-size: 11px; font-family: monospace;">${sensor.current_value}${sensor.unit || ''}</span>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Gauge Widgets -->
                    <div style="margin-bottom: 15px; padding-top: 15px; border-top: 1px solid var(--border);">
                        <h4 style="color: var(--text-dim); margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">🎯 Gauges</h4>
                        <div class="sensor-list" style="max-height: 150px; overflow-y: auto;">
                            ${this.sensors.map(sensor => `
                                <div class="palette-item" onclick="window.dashboardEditor.addGauge('${sensor.full_path || sensor.base_name}', '${sensor.unit || ''}')" style="
                                    display: flex;
                                    align-items: center;
                                    gap: 10px;
                                    padding: 10px;
                                    background: linear-gradient(135deg, var(--bg-card), rgba(100, 255, 218, 0.05));
                                    border: 1px solid rgba(100, 255, 218, 0.2);
                                    border-radius: 10px;
                                    margin-bottom: 6px;
                                    cursor: pointer;
                                    transition: all 0.2s;
                                " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='rgba(100, 255, 218, 0.2)'">
                                    <span style="font-size: 18px;">🎯</span>
                                    <div style="flex: 1; min-width: 0;">
                                        <div style="color: var(--accent); font-weight: 600; font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${sensor.name}</div>
                                        <div style="color: var(--text-dim); font-size: 10px;">Gauge-Anzeige</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Special Widgets -->
                    <div style="padding-top: 15px; border-top: 1px solid var(--border);">
                        <h4 style="color: var(--text-dim); margin: 0 0 10px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">➕ Spezial</h4>
                        <div class="palette-item" onclick="window.dashboardEditor.addWidget('spacer')" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 10px;
                            background: var(--bg-card);
                            border: 1px solid var(--border);
                            border-radius: 10px;
                            margin-bottom: 6px;
                            cursor: pointer;
                        ">
                            <span style="font-size: 20px;">⬜</span>
                            <div style="color: var(--text); font-size: 12px;">Spacer</div>
                        </div>
                        <div class="palette-item" onclick="window.dashboardEditor.addWidget('clock')" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 10px;
                            background: var(--bg-card);
                            border: 1px solid var(--border);
                            border-radius: 10px;
                            margin-bottom: 6px;
                            cursor: pointer;
                        ">
                            <span style="font-size: 20px;">🕐</span>
                            <div style="color: var(--text); font-size: 12px;">Uhr</div>
                        </div>
                        <div class="palette-item" onclick="window.dashboardEditor.addWidget('text')" style="
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 10px;
                            background: var(--bg-card);
                            border: 1px solid var(--border);
                            border-radius: 10px;
                            margin-bottom: 6px;
                            cursor: pointer;
                        ">
                            <span style="font-size: 20px;">📝</span>
                            <div style="color: var(--text); font-size: 12px;">Text</div>
                        </div>
                    </div>
                </div>

                <!-- Canvas -->
                <div class="editor-canvas" style="
                    flex: 1;
                    background: var(--bg-panel);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 20px;
                    overflow-y: auto;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="color: var(--accent); margin: 0; font-size: 16px;">
                            🎨 Dashboard Layout
                        </h3>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <label style="color: var(--text-dim); font-size: 13px;">
                                Spalten:
                                <select id="grid-columns-select" onchange="window.dashboardEditor.setGridColumns(this.value)" style="
                                    margin-left: 8px;
                                    padding: 6px 12px;
                                    background: var(--bg-card);
                                    color: var(--text);
                                    border: 1px solid var(--border);
                                    border-radius: 8px;
                                ">
                                    ${[1,2,3,4].map(n => `<option value="${n}" ${this.gridColumns === n ? 'selected' : ''}>${n}</option>`).join('')}
                                </select>
                            </label>
                        </div>
                    </div>

                    <div id="canvas-grid" style="
                        display: grid;
                        grid-template-columns: repeat(${this.gridColumns}, 1fr);
                        gap: 12px;
                        min-height: 300px;
                        padding: 10px;
                        background: var(--bg-card);
                        border-radius: 12px;
                        border: 2px dashed var(--border);
                    ">
                        ${this.renderWidgets()}
                    </div>
                </div>

                <!-- Properties Panel -->
                <div class="properties-panel" style="
                    width: 280px;
                    background: var(--bg-panel);
                    border: 1px solid var(--border);
                    border-radius: 16px;
                    padding: 20px;
                    overflow-y: auto;
                ">
                    <h3 style="color: var(--accent); margin: 0 0 15px 0; font-size: 16px;">
                        ⚙️ Eigenschaften
                    </h3>
                    <div id="properties-content">
                        ${this.selectedWidget !== null ? this.renderProperties() : `
                            <p style="color: var(--text-dim); font-size: 13px;">
                                Wähle ein Widget zum Bearbeiten
                            </p>
                        `}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Set editor mode
     */
    setMode(mode) {
        if (mode === 'code') {
            this.dslText = this.toDSL();
        } else if (mode === 'visual' && this.mode === 'code') {
            // Parse code changes before switching to visual
            const textarea = document.getElementById('dsl-code-editor');
            if (textarea) {
                this.dslText = textarea.value;
            }
        }
        this.mode = mode;
        this.render();
    }

    /**
     * Apply code changes from textarea
     */
    async applyCodeChanges() {
        const textarea = document.getElementById('dsl-code-editor');
        if (!textarea) return;

        this.dslText = textarea.value;

        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const response = await fetch(`${apiUrl}/api/dashboard/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: this.dslText })
            });
            const parsed = await response.json();

            if (parsed.errors && parsed.errors.length > 0) {
                alert('Fehler im DSL-Code:\n' + parsed.errors.join('\n'));
                return;
            }

            // Update widgets from parsed result
            this.gridColumns = parsed.grid || 3;
            this.widgets = [];
            this.rows = [];

            if (parsed.rows) {
                parsed.rows.forEach(row => {
                    if (!this.rows.includes(row.name)) {
                        this.rows.push(row.name);
                    }
                    row.widgets.forEach(widget => {
                        this.widgets.push({ ...widget, rowName: row.name });
                    });
                });
            }

            if (window.BoatOS?.ui?.showNotification) {
                window.BoatOS.ui.showNotification('Code übernommen!', 'success');
            }

            // Switch to visual mode to see changes
            this.mode = 'visual';
            this.render();
        } catch (error) {
            console.error('Parse error:', error);
            alert('Fehler beim Parsen des DSL-Codes');
        }
    }

    /**
     * Reset code to current widget state
     */
    resetCode() {
        this.dslText = this.toDSL();
        this.render();
    }

    /**
     * Escape HTML for textarea
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Render widgets on canvas
     */
    renderWidgets() {
        if (this.widgets.length === 0) {
            return `
                <div style="
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 40px;
                    color: var(--text-dim);
                ">
                    Keine Widgets.<br>
                    <small>Klicke links auf ein Widget um es hinzuzufügen.</small>
                </div>
            `;
        }

        return this.widgets.map((widget, index) => `
            <div class="canvas-widget ${this.selectedWidget === index ? 'selected' : ''}"
                 data-index="${index}"
                 onclick="window.dashboardEditor.selectWidget(${index})"
                 style="
                    grid-column: span ${widget.size || 1};
                    background: var(--bg-panel);
                    border: 2px solid ${this.selectedWidget === index ? 'var(--accent)' : 'var(--border)'};
                    border-radius: 12px;
                    padding: 15px;
                    cursor: move;
                    position: relative;
                    transition: all 0.2s;
                ">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div>
                        <div style="font-size: 24px; margin-bottom: 5px;">
                            ${this.getWidgetIcon(widget)}
                        </div>
                        <div style="color: var(--text); font-weight: 600; font-size: 13px;">
                            ${widget.alias || this.getWidgetName(widget)}
                        </div>
                        <div style="color: var(--text-dim); font-size: 11px;">
                            ${widget.type} | Größe: ${widget.size || 1}
                        </div>
                    </div>
                    <button onclick="event.stopPropagation(); window.dashboardEditor.deleteWidget(${index})" style="
                        background: var(--danger);
                        color: white;
                        border: none;
                        width: 28px;
                        height: 28px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 16px;
                    ">×</button>
                </div>
            </div>
        `).join('');
    }

    /**
     * Get widget icon
     */
    getWidgetIcon(widget) {
        if (widget.type === 'sensor') {
            const sensor = this.sensors.find(s =>
                s.base_name === widget.sensor ||
                s.full_path === widget.sensor
            );
            return sensor ? sensor.icon : '📊';
        }
        if (widget.type === 'gauge') {
            return '🎯';
        }
        const icons = { spacer: '⬜', clock: '🕐', compass: '🧭', map: '🗺️', text: '📝' };
        return icons[widget.type] || '📦';
    }

    /**
     * Get widget name
     */
    getWidgetName(widget) {
        if (widget.type === 'sensor' || widget.type === 'gauge') {
            const sensor = this.sensors.find(s =>
                s.base_name === widget.sensor ||
                s.full_path === widget.sensor
            );
            if (sensor) return sensor.name;
            // Fallback: format sensor path
            return widget.sensor ? widget.sensor.split('/').pop() : 'Sensor';
        }
        if (widget.type === 'text') {
            return widget.text ? (widget.text.substring(0, 20) + (widget.text.length > 20 ? '...' : '')) : 'Text';
        }
        const names = { spacer: 'Spacer', clock: 'Uhr', compass: 'Kompass', map: 'Karte' };
        return names[widget.type] || widget.type;
    }

    /**
     * Render properties panel
     */
    renderProperties() {
        const widget = this.widgets[this.selectedWidget];
        if (!widget) return '';

        const isGauge = widget.type === 'gauge';
        const isSensor = widget.type === 'sensor';
        const isText = widget.type === 'text';

        return `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Widget Type Badge -->
                <div style="padding: 8px; background: var(--bg-card); border-radius: 8px; text-align: center;">
                    <span style="color: var(--accent); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                        ${widget.type.toUpperCase()}
                    </span>
                </div>

                ${isText ? `
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Text</label>
                    <input type="text" value="${widget.text || ''}"
                           onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'text', this.value)"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>
                ` : ''}

                ${(isSensor || isGauge) ? `
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Label / Alias</label>
                    <input type="text" value="${widget.alias || widget.label || ''}"
                           onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, '${isGauge ? 'label' : 'alias'}', this.value)"
                           placeholder="${this.getWidgetName(widget)}"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>
                ` : ''}

                <!-- Size -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Größe</label>
                    <select onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'size', parseInt(this.value))" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        ${[1,2,3,4].map(n => `<option value="${n}" ${(widget.size || 1) === n ? 'selected' : ''}>${n} Spalte${n > 1 ? 'n' : ''}</option>`).join('')}
                    </select>
                </div>

                ${isGauge ? `
                <!-- Gauge Style -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Gauge-Stil</label>
                    <select onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'style', this.value)" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        <option value="arc180" ${widget.style === 'arc180' ? 'selected' : ''}>🎯 Halbkreis (180°)</option>
                        <option value="arc270" ${widget.style === 'arc270' ? 'selected' : ''}>🎯 Dreiviertel (270°)</option>
                        <option value="arc360" ${widget.style === 'arc360' ? 'selected' : ''}>🎯 Vollkreis (360°)</option>
                        <option value="bar" ${widget.style === 'bar' ? 'selected' : ''}>📊 Balken</option>
                    </select>
                </div>

                <!-- Min/Max Values -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Min</label>
                        <input type="number" value="${widget.min || 0}"
                               onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'min', parseFloat(this.value))"
                               style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Max</label>
                        <input type="number" value="${widget.max || 100}"
                               onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'max', parseFloat(this.value))"
                               style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                    </div>
                </div>

                <!-- Unit -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Einheit</label>
                    <input type="text" value="${widget.unit || ''}"
                           onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'unit', this.value)"
                           placeholder="z.B. °C, %, kn"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>

                <!-- Decimals -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Dezimalstellen</label>
                    <select onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'decimals', parseInt(this.value))" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        ${[0,1,2,3].map(n => `<option value="${n}" ${(widget.decimals || 1) === n ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
                ` : ''}

                ${isSensor ? `
                <!-- Sensor Style -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Style</label>
                    <select onchange="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'style', this.value)" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        <option value="card" ${widget.style === 'card' ? 'selected' : ''}>📦 Card</option>
                        <option value="minimal" ${widget.style === 'minimal' ? 'selected' : ''}>➖ Minimal</option>
                        <option value="compact" ${widget.style === 'compact' ? 'selected' : ''}>📱 Compact</option>
                        <option value="hero" ${widget.style === 'hero' ? 'selected' : ''}>⭐ Hero</option>
                    </select>
                </div>
                ` : ''}

                <!-- Color -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Farbe</label>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${['cyan', 'blue', 'green', 'orange', 'purple', 'red', 'yellow'].map(color => `
                            <div onclick="window.dashboardEditor.updateWidget(${this.selectedWidget}, 'color', '${color}')" style="
                                width: 28px;
                                height: 28px;
                                border-radius: 6px;
                                background: var(--${color === 'cyan' ? 'accent' : color});
                                cursor: pointer;
                                border: 2px solid ${widget.color === color ? 'white' : 'transparent'};
                            "></div>
                        `).join('')}
                    </div>
                </div>

                <!-- Move buttons -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px;">
                    <button onclick="window.dashboardEditor.moveWidget(${this.selectedWidget}, -1)"
                            ${this.selectedWidget === 0 ? 'disabled' : ''}
                            style="padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font-size: 12px;">
                        ⬆️ Hoch
                    </button>
                    <button onclick="window.dashboardEditor.moveWidget(${this.selectedWidget}, 1)"
                            ${this.selectedWidget >= this.widgets.length - 1 ? 'disabled' : ''}
                            style="padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font-size: 12px;">
                        ⬇️ Runter
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Add a new widget
     */
    addWidget(type, sensor = null) {
        const widget = {
            type: type,
            size: 1,
            style: 'card',
            color: 'cyan',
            rowName: 'main'
        };

        if (type === 'sensor' && sensor) {
            widget.sensor = sensor;
        }

        if (type === 'text') {
            widget.text = 'Text hier eingeben';
        }

        this.widgets.push(widget);
        this.selectedWidget = this.widgets.length - 1;
        this.render();
    }

    /**
     * Add a gauge widget
     */
    addGauge(sensor, unit = '') {
        const widget = {
            type: 'gauge',
            sensor: sensor,
            size: 1,
            style: 'arc180',  // arc180, arc270, arc360, bar
            color: 'cyan',
            min: 0,
            max: 100,
            unit: unit,
            label: '',
            decimals: 1,
            rowName: 'main'
        };

        this.widgets.push(widget);
        this.selectedWidget = this.widgets.length - 1;
        this.render();
    }

    /**
     * Delete a widget
     */
    deleteWidget(index) {
        this.widgets.splice(index, 1);
        this.selectedWidget = null;
        this.render();
    }

    /**
     * Select a widget
     */
    selectWidget(index) {
        this.selectedWidget = index;
        this.render();
    }

    /**
     * Update widget property
     */
    updateWidget(index, property, value) {
        if (this.widgets[index]) {
            this.widgets[index][property] = value;
            this.render();
        }
    }

    /**
     * Move widget up or down
     */
    moveWidget(index, direction) {
        const newIndex = index + direction;
        if (newIndex >= 0 && newIndex < this.widgets.length) {
            const widget = this.widgets.splice(index, 1)[0];
            this.widgets.splice(newIndex, 0, widget);
            this.selectedWidget = newIndex;
            this.render();
        }
    }

    /**
     * Set grid columns
     */
    setGridColumns(columns) {
        this.gridColumns = parseInt(columns);
        this.render();
    }

    /**
     * Initialize drag & drop (simplified)
     */
    initDragDrop() {
        const grid = document.getElementById('canvas-grid');
        if (!grid) return;

        const widgets = grid.querySelectorAll('.canvas-widget');
        widgets.forEach(widget => {
            widget.draggable = true;

            widget.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', widget.dataset.index);
                widget.style.opacity = '0.5';
            });

            widget.addEventListener('dragend', () => {
                widget.style.opacity = '1';
            });

            widget.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            widget.addEventListener('drop', (e) => {
                e.preventDefault();
                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(widget.dataset.index);

                if (fromIndex !== toIndex) {
                    const movedWidget = this.widgets.splice(fromIndex, 1)[0];
                    this.widgets.splice(toIndex, 0, movedWidget);
                    this.selectedWidget = toIndex;
                    this.render();
                }
            });
        });
    }

    /**
     * Convert widgets to DSL format
     */
    toDSL() {
        let dsl = `GRID ${this.gridColumns}\n\n`;

        // Group by row
        const byRow = {};
        this.widgets.forEach(w => {
            const row = w.rowName || 'main';
            if (!byRow[row]) byRow[row] = [];
            byRow[row].push(w);
        });

        Object.entries(byRow).forEach(([rowName, widgets]) => {
            dsl += `ROW ${rowName}\n`;
            widgets.forEach(w => {
                if (w.type === 'sensor') {
                    dsl += `  SENSOR ${w.sensor}`;
                    if (w.alias) dsl += ` ALIAS "${w.alias}"`;
                    if (w.size && w.size > 1) dsl += ` SIZE ${w.size}`;
                    if (w.style && w.style !== 'card') dsl += ` STYLE ${w.style}`;
                    if (w.color && w.color !== 'cyan') dsl += ` COLOR ${w.color}`;
                } else if (w.type === 'gauge') {
                    dsl += `  GAUGE ${w.sensor}`;
                    if (w.min !== undefined && w.min !== 0) dsl += ` MIN ${w.min}`;
                    if (w.max !== undefined && w.max !== 100) dsl += ` MAX ${w.max}`;
                    if (w.unit) dsl += ` UNIT "${w.unit}"`;
                    if (w.label) dsl += ` LABEL "${w.label}"`;
                    if (w.size && w.size > 1) dsl += ` SIZE ${w.size}`;
                    if (w.style && w.style !== 'arc180') dsl += ` STYLE ${w.style}`;
                    if (w.color && w.color !== 'cyan') dsl += ` COLOR ${w.color}`;
                    if (w.decimals !== undefined && w.decimals !== 1) dsl += ` DECIMALS ${w.decimals}`;
                } else if (w.type === 'text') {
                    dsl += `  TEXT "${w.text || ''}"`;
                    if (w.size && w.size > 1) dsl += ` SIZE ${w.size}`;
                    if (w.style && w.style !== 'normal') dsl += ` STYLE ${w.style}`;
                    if (w.color && w.color !== 'cyan') dsl += ` COLOR ${w.color}`;
                } else {
                    dsl += `  ${w.type.toUpperCase()}`;
                    if (w.size && w.size > 1) dsl += ` SIZE ${w.size}`;
                }
                dsl += '\n';
            });
            dsl += '\n';
        });

        return dsl.trim();
    }

    /**
     * Save layout to backend
     */
    async save() {
        const dsl = this.toDSL();
        console.log('=== SAVING DASHBOARD ===');
        console.log('DSL to save:', dsl);
        console.log('Widgets:', JSON.stringify(this.widgets, null, 2));

        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            console.log('API URL:', apiUrl);

            const response = await fetch(`${apiUrl}/api/dashboard/layout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dsl })
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Response body:', result);

            if (response.ok) {
                // Update stored DSL
                this.dslText = dsl;

                if (window.BoatOS?.ui?.showNotification) {
                    window.BoatOS.ui.showNotification('Dashboard gespeichert!', 'success');
                } else {
                    alert('Dashboard gespeichert!');
                }
                this.close();

                // Reload dashboard with new layout
                if (window.dashboardRenderer) {
                    console.log('Reloading dashboard after save...');
                    window.dashboardRenderer.loadAndRender();
                }
            } else {
                throw new Error('Save failed: ' + JSON.stringify(result));
            }
        } catch (error) {
            console.error('Save error:', error);
            if (window.BoatOS?.ui?.showNotification) {
                window.BoatOS.ui.showNotification('Fehler beim Speichern', 'error');
            } else {
                alert('Fehler beim Speichern: ' + error.message);
            }
        }
    }
}

// Create global instance
window.dashboardEditor = new DashboardEditor();

// Add methods to BoatOS when it's ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for BoatOS to be initialized
    setTimeout(() => {
        if (window.BoatOS) {
            window.BoatOS.openDashboardEditor = () => window.dashboardEditor.open();
            window.BoatOS.closeDashboardEditor = () => window.dashboardEditor.close();
            window.BoatOS.saveDashboardLayout = () => window.dashboardEditor.save();
        }

        // Load and render dashboard from saved configuration
        if (window.dashboardRenderer) {
            console.log('Initializing dashboard from saved layout...');
            window.dashboardRenderer.loadAndRender();
        }
    }, 100);
});
