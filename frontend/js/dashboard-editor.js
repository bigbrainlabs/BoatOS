/**
 * BoatOS Dashboard Editor
 * Fullscreen drag & drop editor for dashboard configuration
 * Ocean Soft Theme
 */

class DashboardEditor {
    constructor() {
        this.widgets = [];
        this.sensors = [];
        this.sensorGroupsPalette = [];
        this.gridColumns = 3;
        this.rows = ['main'];
        this.rowHeights = { main: 1 };
        this.selectedWidget = null;
        this.container = null;
        this.mode = 'visual'; // 'visual' or 'code'
        this.dslText = '';
        this.showHelp = false;
        // Screen-based layout (new format)
        this.templates = [];
        this.screens = [];
        this.currentScreenIndex = 0;
        this.layout = null; // parsed layout response
        this._trackedSensors = new Set(); // sensor base_names to log in logbook
        this._sensorGroupsData = [];
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
        await Promise.all([this.loadSensors(), this.loadSensorGroupsPalette(), this.loadTemplates()]);
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

    async loadSensorGroupsPalette() {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const resp = await fetch(`${apiUrl}/api/sensors/grouped`);
            const data = await resp.json();
            this.sensorGroupsPalette = data.groups || [];
        } catch (_) {
            this.sensorGroupsPalette = [];
        }
    }

    /**
     * Load layout templates from API (with hardcoded fallback)
     */
    async loadTemplates() {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const resp = await fetch(`${apiUrl}/api/dashboard/templates`);
            const data = await resp.json();
            this.templates = data.templates || [];
        } catch (e) {
            // Hardcoded fallback
            this.templates = [
                {id:'full',name:'Vollbild',description:'Ein Widget, volle Fläche',slots:['A'],cols:'1fr',rows:'1fr',areas:'A'},
                {id:'split-h',name:'Hälften',description:'Zwei gleiche Hälften',slots:['A','B'],cols:'1fr 1fr',rows:'1fr',areas:'A B'},
                {id:'split-v',name:'Oben/Unten',description:'Zwei übereinander',slots:['A','B'],cols:'1fr',rows:'1fr 1fr',areas:'A\nB'},
                {id:'thirds-h',name:'Drittel',description:'Drei gleiche Spalten',slots:['A','B','C'],cols:'1fr 1fr 1fr',rows:'1fr',areas:'A B C'},
                {id:'hero-right',name:'Hero Links',description:'Großes Widget links, zwei rechts',slots:['A','B','C'],cols:'2fr 1fr',rows:'1fr 1fr',areas:'A B\nA C'},
                {id:'hero-left',name:'Hero Rechts',description:'Großes Widget rechts, zwei links',slots:['A','B','C'],cols:'1fr 2fr',rows:'1fr 1fr',areas:'B A\nC A'},
                {id:'hero-top',name:'Hero Oben',description:'Großes Widget oben, zwei unten',slots:['A','B','C'],cols:'1fr 1fr',rows:'2fr 1fr',areas:'A A\nB C'},
                {id:'hero-bottom',name:'Hero Unten',description:'Zwei oben, großes Widget unten',slots:['A','B','C'],cols:'1fr 1fr',rows:'1fr 2fr',areas:'B C\nA A'},
                {id:'grid-4',name:'4er Raster',description:'Vier gleichgroße Felder',slots:['A','B','C','D'],cols:'1fr 1fr',rows:'1fr 1fr',areas:'A B\nC D'},
                {id:'mosaic-4',name:'Mosaik 4',description:'Großes links, drei rechts',slots:['A','B','C','D'],cols:'2fr 1fr',rows:'1fr 1fr 1fr',areas:'A B\nA C\nA D'},
                {id:'grid-6',name:'6er Raster',description:'Sechs gleichgroße Felder',slots:['A','B','C','D','E','F'],cols:'1fr 1fr 1fr',rows:'1fr 1fr',areas:'A B C\nD E F'},
                {id:'mosaic-5',name:'Mosaik 5',description:'Großes links, vier rechts',slots:['A','B','C','D','E'],cols:'2fr 1fr 1fr',rows:'1fr 1fr',areas:'A B C\nA D E'}
            ];
        }
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
                console.log('Parsed layout:', this.layout);
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
     * Parse DSL layout — handles both old (rows) and new (screen) format
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
            this.layout = parsed;

            if (parsed.format === 'screen') {
                // New screen-based format
                this.screens = (parsed.screens || []).map(s => ({
                    name: s.name || 'Screen',
                    layoutId: s.layout_id || 'full',
                    widgets: s.widgets || {}
                }));
                this.currentScreenIndex = 0;
                // Clear old format state
                this.widgets = [];
                this.rows = ['main'];
                this.rowHeights = { main: 1 };
            } else {
                // Old format
                this.screens = [];
                this.gridColumns = parsed.grid || 3;
                this.widgets = [];
                this.rows = [];
                this.rowHeights = {};

                if (parsed.rows) {
                    parsed.rows.forEach(row => {
                        if (!this.rows.includes(row.name)) {
                            this.rows.push(row.name);
                        }
                        this.rowHeights[row.name] = row.height || 1;
                        row.widgets.forEach(widget => {
                            this.widgets.push({ ...widget, rowName: row.name });
                        });
                    });
                }

                if (!this.rows.includes('main')) {
                    this.rows.push('main');
                    this.rowHeights['main'] = this.rowHeights['main'] || 1;
                }
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
            this.dslText = this.screens.length > 0 ? this.toDSLScreen() : this.toDSL();
        }

        this.container.innerHTML = `
            <!-- Mode Toggle -->
            <div style="display: flex; gap: 10px; margin-bottom: 15px;">
                <button onclick="window.dashboardEditor.setMode('visual')" style="
                    flex: 1; padding: 12px 20px;
                    background: ${this.mode === 'visual' ? 'var(--accent)' : 'var(--bg-card)'};
                    color: ${this.mode === 'visual' ? 'white' : 'var(--text)'};
                    border: 1px solid ${this.mode === 'visual' ? 'var(--accent)' : 'var(--border)'};
                    border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
                ">🎨 Visuell</button>
                <button onclick="window.dashboardEditor.setMode('code')" style="
                    flex: 1; padding: 12px 20px;
                    background: ${this.mode === 'code' ? 'var(--accent)' : 'var(--bg-card)'};
                    color: ${this.mode === 'code' ? 'white' : 'var(--text)'};
                    border: 1px solid ${this.mode === 'code' ? 'var(--accent)' : 'var(--border)'};
                    border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
                ">📝 Code</button>
                <button onclick="window.dashboardEditor.setMode('sensors')" style="
                    flex: 1; padding: 12px 20px;
                    background: ${this.mode === 'sensors' ? 'var(--accent)' : 'var(--bg-card)'};
                    color: ${this.mode === 'sensors' ? 'white' : 'var(--text)'};
                    border: 1px solid ${this.mode === 'sensors' ? 'var(--accent)' : 'var(--border)'};
                    border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer;
                ">📡 Sensoren</button>
            </div>

            ${this.mode === 'code' ? this.renderCodeEditor() : this.mode === 'sensors' ? this.renderSensorManager() : (this.screens.length > 0 ? this.renderScreenEditor() : this.renderVisualEditor())}
        `;

        if (this.mode === 'visual' && this.screens.length === 0) {
            this.initDragDrop();
        }
        if (this.mode === 'sensors') {
            this.loadSensorGroups();
        }
    }

    async loadSensorGroups() {
        const container = document.getElementById('sensor-mgmt-list');
        if (!container) return;
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const [groupsResp, settingsResp] = await Promise.all([
                fetch(`${apiUrl}/api/sensors/grouped`),
                fetch(`${apiUrl}/api/settings`),
            ]);
            const data = await groupsResp.json();
            const settings = settingsResp.ok ? await settingsResp.json() : {};
            this._trackedSensors = new Set(settings.trackSensors || []);
            this._sensorGroupsData = data.groups;

            if (!data.groups?.length) {
                container.innerHTML = '<div style="color:var(--text-dim);padding:16px">Keine Sensoren bekannt.</div>';
                return;
            }
            container.innerHTML = data.groups.map((g, gIdx) => `
                <details style="margin-bottom:8px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
                    <summary style="padding:10px 14px;cursor:pointer;background:var(--bg-card);display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;list-style:none;user-select:none">
                        <span>${g.icon}</span>
                        <span style="flex:1">${g.label}</span>
                        <label onclick="event.stopPropagation()" title="Alle in Gruppe loggen" style="display:flex;align-items:center;cursor:pointer;flex-shrink:0">
                            <input type="checkbox" data-group-cb="${gIdx}"
                                   onclick="event.stopPropagation()"
                                   onchange="window.dashboardEditor.toggleGroupLog(${gIdx},this.checked)"
                                   style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;">
                        </label>
                        <span style="color:var(--text-dim);font-weight:400;font-size:11px">${g.source} · ${g.sensors.length}</span>
                    </summary>
                    <div>
                        ${g.sensors.map(s => {
                            const isLogged = this._trackedSensors.has(s.topic);
                            const safeTopic = s.topic.replace(/'/g, "\\'");
                            return `
                            <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;border-top:1px solid var(--border);font-size:12px">
                                <span style="width:7px;height:7px;border-radius:50%;flex-shrink:0;background:${s.status==='online'?'#3fb950':s.status==='offline'?'#ef5350':'#8b949e'}"></span>
                                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${s.topic}"><strong>${s.label}</strong></span>
                                <span style="color:var(--text-dim);min-width:60px;text-align:right">${s.value||'—'} ${s.unit}</span>
                                <label onclick="event.stopPropagation()" title="${t('widget_log_label')}" style="display:flex;align-items:center;gap:4px;cursor:pointer;flex-shrink:0">
                                    <input type="checkbox" data-topic="${s.topic.replace(/"/g, '&quot;')}" ${isLogged ? 'checked' : ''}
                                           onchange="window.dashboardEditor.toggleSensorLog('${safeTopic}',this.checked)"
                                           style="width:14px;height:14px;accent-color:var(--accent);cursor:pointer;">
                                    <span style="font-size:11px;color:${isLogged?'var(--accent)':'var(--text-dim)'}">Log</span>
                                </label>
                                <button onclick="window.dashboardEditor.showWidgetTypePicker('${s.topic.replace(/'/g,"\\'")}','${s.label.replace(/'/g,"\\'")}','${(s.unit||'').replace(/'/g,"\\'")}', true)"
                                    title="Als Widget hinzufügen"
                                    style="background:none;border:none;cursor:pointer;color:#4fc3f7;font-size:15px;padding:2px 4px;flex-shrink:0;line-height:1">➕</button>
                                <button onclick="window.dashboardEditor.deleteSensorTopic('${s.topic.replace(/'/g,"\\'")}', this)"
                                    title="Topic entfernen"
                                    style="background:none;border:none;cursor:pointer;color:#ef5350;font-size:15px;padding:2px 4px;flex-shrink:0;line-height:1">🗑</button>
                            </div>`;
                        }).join('')}
                    </div>
                </details>`).join('');
            this._applyGroupCheckboxStates();
        } catch(e) {
            container.innerHTML = `<div style="color:#ef5350;padding:16px">Fehler: ${e.message}</div>`;
        }
    }

    async toggleSensorLog(baseName, checked) {
        if (checked) { this._trackedSensors.add(baseName); }
        else { this._trackedSensors.delete(baseName); }
        this._applyGroupCheckboxStates();
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const sRes = await fetch(`${apiUrl}/api/settings`);
            const s = sRes.ok ? await sRes.json() : {};
            s.trackSensors = [...this._trackedSensors];
            await fetch(`${apiUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(s)
            });
        } catch (_) {}
    }

    async toggleGroupLog(gIdx, enable) {
        const group = (this._sensorGroupsData || [])[gIdx];
        if (!group) return;
        group.sensors.forEach(s => {
            if (enable) this._trackedSensors.add(s.topic);
            else this._trackedSensors.delete(s.topic);
            const cb = document.querySelector(`[data-topic="${CSS.escape(s.topic)}"]`);
            if (cb) cb.checked = enable;
        });
        this._applyGroupCheckboxStates();
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const sRes = await fetch(`${apiUrl}/api/settings`);
            const settings = sRes.ok ? await sRes.json() : {};
            settings.trackSensors = [...this._trackedSensors];
            await fetch(`${apiUrl}/api/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
        } catch (_) {}
    }

    _applyGroupCheckboxStates() {
        (this._sensorGroupsData || []).forEach((g, gIdx) => {
            const cb = document.querySelector(`[data-group-cb="${gIdx}"]`);
            if (!cb) return;
            const topics = g.sensors.map(s => s.topic);
            const loggedCount = topics.filter(t => this._trackedSensors.has(t)).length;
            if (loggedCount === 0) {
                cb.checked = false;
                cb.indeterminate = false;
            } else if (loggedCount === topics.length) {
                cb.checked = true;
                cb.indeterminate = false;
            } else {
                cb.checked = false;
                cb.indeterminate = true;
            }
        });
    }

    renderSensorManager() {
        return `
            <div style="height:calc(100% - 60px);overflow-y:auto">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                    <span style="font-size:13px;color:var(--text-dim)">Alle bekannten MQTT-Topics. Veraltete Einträge hier entfernen.</span>
                    <button onclick="window.dashboardEditor.loadSensorGroups()" style="
                        background:var(--bg-card);border:1px solid var(--border);border-radius:6px;
                        padding:6px 12px;cursor:pointer;font-size:12px;color:var(--text)">🔄 Aktualisieren</button>
                </div>
                <div id="sensor-mgmt-list">
                    <div style="color:var(--text-dim);padding:16px">Wird geladen…</div>
                </div>
            </div>`;
    }

    async deleteSensorTopic(topic, btn) {
        if (!confirm(`Topic entfernen?\n${topic}`)) return;
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const resp = await fetch(`${apiUrl}/api/sensors/topic?topic=${encodeURIComponent(topic)}`, { method: 'DELETE' });
            const data = await resp.json();
            if (data.removed) {
                const row = btn.closest('div[style*="display:flex"]');
                if (row) { row.style.opacity = '0'; row.style.transition = 'opacity 0.3s'; setTimeout(() => row.remove(), 300); }
            }
        } catch(e) { alert(`Fehler: ${e.message}`); }
    }

    showWidgetTypePicker(sensorPath, sensorName, unit, fromSensorsTab = false) {
        const existing = document.getElementById('widget-type-picker');
        if (existing) existing.remove();

        const esc = s => s.replace(/'/g, "\\'");
        const overlay = document.createElement('div');
        overlay.id = 'widget-type-picker';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);display:flex;align-items:center;justify-content:center;z-index:10000';
        overlay.innerHTML = `
            <div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:14px;padding:24px;min-width:300px;max-width:380px;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
                <div style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px">Widget-Typ wählen</div>
                <div style="font-size:11px;color:var(--text-dim);margin-bottom:18px;word-break:break-all">${sensorName || sensorPath}</div>
                <div style="display:flex;flex-direction:column;gap:8px">
                    <button onclick="window.dashboardEditor._addFromPicker('sensor','${esc(sensorPath)}','${esc(unit)}',${fromSensorsTab});document.getElementById('widget-type-picker').remove()" style="
                        padding:12px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;
                        color:var(--text);font-size:13px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;
                        transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
                        <span style="font-size:22px">📊</span>
                        <span><strong>Sensor-Karte</strong><br><span style="font-size:11px;color:var(--text-dim)">Zeigt den aktuellen Wert als Karte</span></span>
                    </button>
                    <button onclick="window.dashboardEditor._addFromPicker('gauge','${esc(sensorPath)}','${esc(unit)}',${fromSensorsTab});document.getElementById('widget-type-picker').remove()" style="
                        padding:12px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;
                        color:var(--text);font-size:13px;cursor:pointer;text-align:left;display:flex;align-items:center;gap:12px;
                        transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
                        <span style="font-size:22px">🎯</span>
                        <span><strong>Gauge</strong><br><span style="font-size:11px;color:var(--text-dim)">Zeiger- oder Bogenanzeige</span></span>
                    </button>
                </div>
                <button onclick="document.getElementById('widget-type-picker').remove()" style="
                    margin-top:14px;width:100%;padding:10px;background:none;border:1px solid var(--border);
                    border-radius:8px;color:var(--text-dim);cursor:pointer;font-size:12px">Abbrechen</button>
            </div>`;
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

    _addFromPicker(type, sensorPath, unit, switchToVisual = false) {
        if (type === 'gauge') {
            this.addGauge(sensorPath, unit);
        } else {
            this.addWidget('sensor', sensorPath);
        }
        if (switchToVisual) {
            this.mode = 'visual';
            this.render();
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
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">COMPASS</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px;">HORIZON boot/sensoren/lage</code>
                        </div>

                        <div style="padding: 10px; background: var(--bg-card); border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre;">GRID 2

ROW navigation
  SENSOR gps_speed AS "SOG" SIZE 1
  SENSOR gps_course AS "COG" SIZE 1

ROW weather
  SENSOR temperature STYLE big
  SENSOR wind_speed COLOR blue</div>

                        <div style="margin-top: 15px; margin-bottom: 8px;">
                            <strong style="color: var(--accent);">SCREEN/LAYOUT Format (neu):</strong>
                        </div>

                        <div style="padding: 10px; background: var(--bg-card); border-radius: 8px; font-family: monospace; font-size: 11px; white-space: pre;">SCREEN Navigation LAYOUT hero-right
  A  SENSOR navigation/position STYLE hero
  B  GAUGE boot/motor/drehzahl MIN 0 MAX 3000 UNIT "rpm"
  C  CLOCK

SCREEN Wetter LAYOUT grid-4
  A  SENSOR bilge/thermo
  B  GAUGE wind_speed MIN 0 MAX 50 UNIT "kn"
  C  COMPASS
  D  CLOCK</div>

                        <div style="margin-top: 12px; margin-bottom: 8px;">
                            <strong style="color: var(--accent);">Verfügbare Vorlagen:</strong><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-size: 10px;">full, split-h, split-v, thirds-h</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-size: 10px;">hero-right, hero-left, hero-top, hero-bottom</code><br>
                            <code style="background: var(--bg-card); padding: 2px 6px; border-radius: 4px; font-size: 10px;">grid-4, mosaic-4, grid-6, mosaic-5</code>
                        </div>
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
                    padding: 16px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                ">
                    <!-- Grouped Sensors -->
                    <div style="flex:1;overflow-y:auto;margin-bottom:12px">
                        ${this.sensorGroupsPalette.length === 0 ? `
                            <div style="color:var(--text-dim);font-size:12px;padding:8px 0">Keine Sensoren — öffne den Sensoren-Tab zum Laden.</div>
                        ` : this.sensorGroupsPalette.map(g => `
                            <details style="margin-bottom:6px;border:1px solid var(--border);border-radius:8px;overflow:hidden">
                                <summary style="padding:8px 12px;cursor:pointer;background:var(--bg-card);display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;list-style:none;user-select:none"
                                    onmouseover="this.style.background='var(--bg-panel)'" onmouseout="this.style.background='var(--bg-card)'">
                                    <span>${g.icon}</span>
                                    <span style="flex:1">${g.label}</span>
                                    <span style="color:var(--text-dim);font-weight:400;font-size:10px">${g.sensors.length}</span>
                                </summary>
                                <div>
                                    ${g.sensors.map(s => `
                                        <div onclick="window.dashboardEditor.showWidgetTypePicker('${s.topic.replace(/'/g,"\\'")}','${s.label.replace(/'/g,"\\'")}','${(s.unit||'').replace(/'/g,"\\'")}',false)"
                                            style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-top:1px solid var(--border);font-size:11px;cursor:pointer;transition:background .15s"
                                            onmouseover="this.style.background='rgba(79,195,247,0.07)'" onmouseout="this.style.background=''">
                                            <span style="width:6px;height:6px;border-radius:50%;flex-shrink:0;background:${s.status==='online'?'#3fb950':s.status==='offline'?'#ef5350':'#8b949e'}"></span>
                                            <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${s.label}</span>
                                            <span style="color:var(--text-dim);font-size:10px;font-family:monospace">${s.value||''} ${s.unit||''}</span>
                                        </div>`).join('')}
                                </div>
                            </details>`).join('')}
                    </div>

                    <!-- Special Widgets -->
                    <div style="border-top:1px solid var(--border);padding-top:12px">
                        <div style="font-size:11px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Spezial</div>
                        ${[
                            ['window.dashboardEditor.addWidget(\'spacer\')', '⬜', 'Spacer'],
                            ['window.dashboardEditor.addWidget(\'clock\')',  '🕐', 'Uhr'],
                            ['window.dashboardEditor.addWidget(\'text\')',   '📝', 'Text'],
                            ['window.dashboardEditor.addWidget(\'compass\')', '🧭', 'Navi-Instrument'],
                            ['window.dashboardEditor.addWidget(\'horizon\')', '🌅', 'Horizont'],
                        ].map(([fn, icon, label]) => `
                            <div onclick="${fn}" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;margin-bottom:5px;cursor:pointer;font-size:12px;transition:border-color .15s"
                                onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
                                <span style="font-size:16px">${icon}</span>
                                <span style="color:var(--text)">${label}</span>
                            </div>`).join('')}
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
                            <button onclick="window.dashboardEditor.addRow()" style="
                                padding: 6px 14px;
                                background: var(--bg-card);
                                color: var(--accent);
                                border: 1px solid var(--accent);
                                border-radius: 8px;
                                font-size: 12px;
                                font-weight: 600;
                                cursor: pointer;
                            ">➕ Neue Reihe</button>
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
            this.dslText = this.screens.length > 0 ? this.toDSLScreen() : this.toDSL();
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
            // Use parseLayout which handles both old and new screen format
            await this.parseLayout(this.dslText);

            if (this.layout && this.layout.errors && this.layout.errors.length > 0) {
                alert('Fehler im DSL-Code:\n' + this.layout.errors.join('\n'));
                return;
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
        this.dslText = this.screens.length > 0 ? this.toDSLScreen() : this.toDSL();
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
     * Render widgets on canvas grouped by row with height controls
     */
    renderWidgets() {
        if (this.widgets.length === 0 && this.rows.length <= 1 && (this.rows.length === 0 || this.rows[0] === 'main')) {
            return `
                <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-dim);">
                    Keine Widgets.<br>
                    <small>Klicke links auf ein Widget um es hinzuzufügen.</small>
                </div>
            `;
        }

        // Use this.rows as canonical order, append any widget rows not in list
        const seen = new Set(this.rows);
        const rowOrder = [...this.rows];
        this.widgets.forEach(w => {
            const rn = w.rowName || 'main';
            if (!seen.has(rn)) { seen.add(rn); rowOrder.push(rn); }
        });

        // Group widgets by row preserving global index
        const byRow = {};
        this.widgets.forEach((w, idx) => {
            const rn = w.rowName || 'main';
            if (!byRow[rn]) byRow[rn] = [];
            byRow[rn].push({ widget: w, idx });
        });

        let html = '';
        rowOrder.forEach(rowName => {
            const h = this.rowHeights[rowName] || 1;
            const cellH = 140 * h;
            const rowWidgets = byRow[rowName] || [];

            // Row header (spans all columns)
            html += `
                <div data-drop-row="${rowName}" style="
                    grid-column: 1 / -1;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 5px 10px;
                    background: rgba(79,195,247,0.07);
                    border-radius: 8px;
                    border: 1px solid rgba(79,195,247,0.15);
                ">
                    <span style="color: var(--accent); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; flex: 1;">
                        ▸ ROW ${rowName}
                    </span>
                    <span style="color: var(--text-dim); font-size: 11px;">Höhe:</span>
                    ${[1,2,3,4].map(n => `
                        <button onclick="event.stopPropagation(); window.dashboardEditor.setRowHeight('${rowName}', ${n})" style="
                            width: 26px; height: 26px;
                            background: ${h === n ? 'var(--accent)' : 'var(--bg-card)'};
                            color: ${h === n ? 'white' : 'var(--text-dim)'};
                            border: 1px solid ${h === n ? 'var(--accent)' : 'var(--border)'};
                            border-radius: 5px; cursor: pointer; font-size: 11px; font-weight: 700;
                        ">H${n}</button>
                    `).join('')}
                    <button onclick="event.stopPropagation(); window.dashboardEditor.deleteRow('${rowName}')" title="Reihe löschen" style="
                        width: 26px; height: 26px; margin-left: 4px;
                        background: none; color: #ef5350;
                        border: 1px solid rgba(239,83,80,0.4);
                        border-radius: 5px; cursor: pointer; font-size: 13px; line-height: 1;
                    ">🗑</button>
                </div>
            `;

            // Empty row placeholder
            if (rowWidgets.length === 0) {
                html += `
                    <div data-drop-row="${rowName}" style="
                        grid-column: 1 / -1;
                        height: 60px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--text-dim);
                        font-size: 12px;
                        border: 1px dashed var(--border);
                        border-radius: 8px;
                        opacity: 0.6;
                    ">Keine Widgets — ziehe oder klicke einen Sensor hinein</div>
                `;
            }

            // Row's widgets
            rowWidgets.forEach(({ widget, idx }) => {
                html += `
                    <div class="canvas-widget ${this.selectedWidget === idx ? 'selected' : ''}"
                         data-index="${idx}"
                         data-row="${widget.rowName || 'main'}"
                         onclick="window.dashboardEditor.selectWidget(${idx})"
                         style="
                            grid-column: span ${widget.size || 1};
                            height: ${cellH}px;
                            background: var(--bg-panel);
                            border: 2px solid ${this.selectedWidget === idx ? 'var(--accent)' : 'var(--border)'};
                            border-radius: 12px;
                            padding: 12px;
                            cursor: pointer;
                            position: relative;
                            transition: border-color 0.2s;
                            box-sizing: border-box;
                            overflow: hidden;
                         ">
                        <div style="display: flex; justify-content: space-between; align-items: start; height: 100%;">
                            <div>
                                <div style="font-size: 20px; margin-bottom: 4px;">${this.getWidgetIcon(widget)}</div>
                                <div style="color: var(--text); font-weight: 600; font-size: 12px;">${widget.alias || this.getWidgetName(widget)}</div>
                                <div style="color: var(--text-dim); font-size: 10px;">${widget.type} | ×${widget.size || 1}</div>
                            </div>
                            <button onclick="event.stopPropagation(); window.dashboardEditor.deleteWidget(${idx})" style="
                                background: var(--danger); color: white; border: none;
                                width: 24px; height: 24px; border-radius: 50%; cursor: pointer; font-size: 14px; flex-shrink: 0;
                            ">×</button>
                        </div>
                    </div>
                `;
            });
        });

        return html;
    }

    /**
     * Add a new row
     */
    addRow() {
        let name = prompt('Reihen-Name:', `row${this.rows.length + 1}`);
        if (!name) return;
        name = name.trim().replace(/\s+/g, '_');
        if (!name || this.rows.includes(name)) return;
        this.rows.push(name);
        this.rowHeights[name] = 1;
        this.render();
    }

    /**
     * Delete a row
     */
    deleteRow(rowName) {
        const widgetsInRow = this.widgets.filter(w => (w.rowName || 'main') === rowName);
        if (widgetsInRow.length > 0) {
            if (!confirm(`Reihe "${rowName}" löschen?\n${widgetsInRow.length} Widget(s) werden nach "main" verschoben.`)) return;
            this.widgets.forEach(w => { if ((w.rowName || 'main') === rowName) w.rowName = 'main'; });
        } else {
            if (!confirm(`Reihe "${rowName}" löschen?`)) return;
        }
        this.rows = this.rows.filter(r => r !== rowName);
        if (!this.rows.includes('main')) this.rows.unshift('main');
        delete this.rowHeights[rowName];
        this.selectedWidget = null;
        this.render();
    }

    /**
     * Set height for a row (1-4)
     */
    setRowHeight(rowName, height) {
        this.rowHeights[rowName] = Math.max(1, Math.min(4, height));
        this.render();
    }

    /**
     * Get widget icon
     */
    getWidgetIcon(widget) {
        // Registry-Modul liefert das Icon (icon(widget, editor)); Fallback für
        // nicht registrierte Alt-Typen (z.B. 'map').
        if (window.dashWidgets && window.dashWidgets.isRegistered(widget.type)) {
            return window.dashWidgets.iconFor(widget, this);
        }
        const icons = { map: '🗺️' };
        return icons[widget.type] || '📦';
    }

    /**
     * Get widget name
     */
    getWidgetName(widget) {
        // Registry-Modul liefert den Namen (name(widget, editor)); Fallback für
        // nicht registrierte Alt-Typen (z.B. 'map').
        if (window.dashWidgets && window.dashWidgets.isRegistered(widget.type)) {
            return window.dashWidgets.nameFor(widget, this);
        }
        const names = { map: 'Karte' };
        return names[widget.type] || widget.type;
    }

    /**
     * Build a sensor dropdown (base_name) + field dropdown pair for a given key prefix.
     * sensorKey: property name on widget (e.g. 'sensor', 'rollSensor')
     * fieldKey:  property name for the field (e.g. 'field', 'rollField')
     * label:     human-readable label
     * optional:  if true, first option is "— deaktiviert —" with empty value
     */
    _renderSensorFieldDropdowns(widgetIdx, widget, sensorKey, fieldKey, label, optional = false) {
        const currentSensor = widget[sensorKey] || '';
        const currentField  = widget[fieldKey]  || '';
        const grp = (this.sensorGroups || []).find(s => s.base_name === currentSensor);
        const availableFields = grp ? Object.keys(grp.values || {}) : [];

        const sensorOptions = (optional ? `<option value="">— deaktiviert —</option>` : '') +
            (this.sensorGroups || []).map(s =>
                `<option value="${s.base_name}" ${currentSensor === s.base_name ? 'selected' : ''}>${s.name}</option>`
            ).join('');

        const fieldDropdown = (currentSensor && availableFields.length > 0) ? `
            <div>
                <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">${label} — Feld</label>
                <select onchange="window.dashboardEditor.updateWidget(${widgetIdx}, '${fieldKey}', this.value)" style="
                    width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                    ${availableFields.map(f => `<option value="${f}" ${currentField === f ? 'selected' : ''}>${f}</option>`).join('')}
                </select>
            </div>` : '';

        return `
            <div>
                <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">${label} — Sensor</label>
                <select onchange="window.dashboardEditor.updateWidgetSensor(${widgetIdx}, '${sensorKey}', '${fieldKey}', this.value)" style="
                    width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                    ${sensorOptions}
                </select>
            </div>
            ${fieldDropdown}`;
    }

    /**
     * Render properties panel
     */
    renderProperties() {
        const widget = this.widgets[this.selectedWidget];
        if (!widget) return '';

        const idx = this.selectedWidget;

        // Typ-spezifische Felder kommen aus dem Widget-Modul (registry.editor).
        const typeFields = window.dashWidgets
            ? window.dashWidgets.buildEditor(widget, { ed: this, idx })
            : '';

        return `
            <div style="display: flex; flex-direction: column; gap: 12px;">
                <!-- Widget Type Badge -->
                <div style="padding: 8px; background: var(--bg-card); border-radius: 8px; text-align: center;">
                    <span style="color: var(--accent); font-size: 11px; text-transform: uppercase; letter-spacing: 1px;">
                        ${widget.type.toUpperCase()}
                    </span>
                </div>

                ${typeFields}

                <!-- Row -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Reihe</label>
                    <select onchange="window.dashboardEditor.updateWidget(${idx}, 'rowName', this.value)" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        ${this.rows.map(r => `<option value="${r}" ${widget.rowName === r ? 'selected' : ''}>${r}</option>`).join('')}
                    </select>
                </div>

                <!-- Color -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Farbe</label>
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        ${['cyan', 'blue', 'green', 'orange', 'purple', 'red', 'yellow'].map(color => `
                            <div onclick="window.dashboardEditor.updateWidget(${idx}, 'color', '${color}')" style="
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
                    <button onclick="window.dashboardEditor.moveWidget(${idx}, -1)"
                            ${idx === 0 ? 'disabled' : ''}
                            style="padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font-size: 12px;">
                        Hoch
                    </button>
                    <button onclick="window.dashboardEditor.moveWidget(${idx}, 1)"
                            ${idx >= this.widgets.length - 1 ? 'disabled' : ''}
                            style="padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); cursor: pointer; font-size: 12px;">
                        Runter
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Add a new widget
     */
    addWidget(type, sensor = null) {
        const targetRow = this.rows[this.rows.length - 1] || 'main';
        const widget = {
            type: type,
            size: 1,
            style: 'card',
            color: 'cyan',
            rowName: targetRow
        };

        if (type === 'sensor' && sensor) {
            widget.sensor = sensor;
            widget.field  = '';
        }

        if (type === 'text') {
            widget.text = 'Text hier eingeben';
        }

        if (type === 'horizon') {
            widget.rollSensor  = '';
            widget.rollField   = '';
            widget.pitchSensor = '';
            widget.pitchField  = '';
            widget.impactSensor = '';
            widget.impactField  = 'aktiv';
        }

        this.widgets.push(widget);
        this.selectedWidget = this.widgets.length - 1;
        this.render();
    }

    /**
     * Add a gauge widget
     */
    addGauge(sensor, unit = '') {
        const targetRow = this.rows[this.rows.length - 1] || 'main';
        const widget = {
            type: 'gauge',
            sensor: sensor,
            field: '',
            size: 1,
            style: 'arc180',  // arc180, arc270, arc360, bar
            color: 'cyan',
            min: 0,
            max: 100,
            unit: unit,
            label: '',
            decimals: 1,
            rowName: targetRow
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
     * Update widget sensor selection — sets sensorKey and clears fieldKey in one render cycle
     */
    updateWidgetSensor(index, sensorKey, fieldKey, sensorValue) {
        if (this.widgets[index]) {
            this.widgets[index][sensorKey] = sensorValue;
            this.widgets[index][fieldKey]  = fieldKey === 'fields' ? [] : '';
            this.render();
        }
    }

    toggleField(index, fieldName, checked) {
        const widget = this.widgets[index];
        if (!widget) return;
        let fields = [...(widget.fields || [])];
        if (checked) {
            if (!fields.includes(fieldName)) fields.push(fieldName);
        } else {
            fields = fields.filter(f => f !== fieldName);
        }
        widget.fields = fields;
        this.render();
    }

    _renderSensorFieldCheckboxes(widgetIdx, widget) {
        const grp = (this.sensorGroups || []).find(s => s.base_name === widget.sensor);
        if (!grp) return '';
        const fields = Object.keys(grp.values || {});
        if (!fields.length) return '';
        const selectedFields = widget.fields || [];
        return `
            <div>
                <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Angezeigte Werte</label>
                <div style="display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; overflow: hidden;">
                    ${fields.map((f, i) => `
                        <label style="display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer; user-select: none;
                               border-bottom: ${i < fields.length - 1 ? '1px solid var(--border)' : 'none'};
                               background: ${selectedFields.includes(f) ? 'rgba(79,195,247,0.08)' : 'transparent'};">
                            <input type="checkbox" ${selectedFields.includes(f) ? 'checked' : ''}
                                   onchange="window.dashboardEditor.toggleField(${widgetIdx}, '${f}', this.checked)"
                                   style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0;">
                            <span style="font-size: 13px; color: var(--text);">${f}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
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
     * Initialize drag & drop with cross-row support
     */
    initDragDrop() {
        const grid = document.getElementById('canvas-grid');
        if (!grid) return;

        const highlight = (el, on) => {
            el.style.outline = on ? '2px solid var(--accent)' : '';
            el.style.outlineOffset = on ? '-2px' : '';
        };

        // Widget cards — draggable + drop target
        grid.querySelectorAll('.canvas-widget').forEach(card => {
            card.draggable = true;

            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.index);
                setTimeout(() => card.style.opacity = '0.4', 0);
            });

            card.addEventListener('dragend', () => {
                card.style.opacity = '1';
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                highlight(card, true);
            });

            card.addEventListener('dragleave', () => highlight(card, false));

            card.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                highlight(card, false);

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                const toIndex = parseInt(card.dataset.index);
                if (isNaN(fromIndex) || fromIndex === toIndex) return;

                const targetRow = card.dataset.row;
                const moved = this.widgets.splice(fromIndex, 1)[0];
                moved.rowName = targetRow;
                const adjustedTo = toIndex > fromIndex ? toIndex - 1 : toIndex;
                this.widgets.splice(adjustedTo, 0, moved);
                this.selectedWidget = adjustedTo;
                this.render();
            });
        });

        // Row headers + empty placeholders — drop zone to move widget into that row
        grid.querySelectorAll('[data-drop-row]').forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                highlight(zone, true);
            });

            zone.addEventListener('dragleave', () => highlight(zone, false));

            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                highlight(zone, false);

                const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                if (isNaN(fromIndex)) return;
                const targetRow = zone.dataset.dropRow;
                this.widgets[fromIndex].rowName = targetRow;
                this.selectedWidget = fromIndex;
                this.render();
            });
        });
    }

    // ─── Screen-based editor (new format) ──────────────────────────────────────

    /**
     * Generate small SVG thumbnail visualising a template's grid areas
     */
    _templateThumbnailSvg(template) {
        const areaRows = (template.areas || '').split('\n');
        const numRows = areaRows.length;
        const numCols = areaRows[0] ? areaRows[0].trim().split(/\s+/).length : 1;
        const W = 60, H = 45;
        const cellW = W / numCols, cellH = H / numRows;
        const colors = {A:'#1565C0',B:'#0D6E6E',C:'#6B3A7D',D:'#1A5C2A',E:'#7D3A1A',F:'#2A3A7D'};
        const drawn = new Set();
        let svg = '';
        for (let r = 0; r < numRows; r++) {
            const cols = areaRows[r].trim().split(/\s+/);
            for (let c = 0; c < cols.length; c++) {
                const slot = cols[c].toUpperCase();
                if (drawn.has(slot)) continue;
                drawn.add(slot);
                // Find bounding box of this slot
                let minR=r, maxR=r, minC=c, maxC=c;
                for (let rr = 0; rr < numRows; rr++) {
                    const rc = (areaRows[rr]||'').trim().split(/\s+/);
                    for (let cc = 0; cc < rc.length; cc++) {
                        if (rc[cc].toUpperCase() === slot) {
                            minR=Math.min(minR,rr); maxR=Math.max(maxR,rr);
                            minC=Math.min(minC,cc); maxC=Math.max(maxC,cc);
                        }
                    }
                }
                const x = minC*cellW+1, y = minR*cellH+1;
                const w = (maxC-minC+1)*cellW-2, h = (maxR-minR+1)*cellH-2;
                svg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="3" fill="${colors[slot]||'#333'}" opacity="0.85"/>`;
                svg += `<text x="${(x+w/2).toFixed(1)}" y="${(y+h/2+4).toFixed(1)}" text-anchor="middle" fill="white" font-size="12" font-weight="bold" font-family="monospace">${slot}</text>`;
            }
        }
        return `<svg viewBox="0 0 ${W} ${H}" style="width:${W}px;height:${H}px;display:block;">${svg}</svg>`;
    }

    /**
     * Render the screen-based visual editor
     */
    renderScreenEditor() {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen) return '<div style="color:var(--text-dim);padding:20px">Kein Screen vorhanden</div>';

        const tmpl = this.templates.find(t => t.id === screen.layoutId) || this.templates[0] || {id:'full',slots:['A'],cols:'1fr',rows:'1fr',areas:'A'};
        const slots = tmpl.slots || Object.keys(screen.widgets || {});

        return `
            <div style="height:calc(100% - 60px); display:flex; flex-direction:column; gap:12px;">
                <!-- Screen tabs -->
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; flex-shrink:0;">
                    ${this.screens.map((s, i) => `
                        <button onclick="window.dashboardEditor.switchScreen(${i})" style="
                            padding:6px 14px;
                            background:${i === this.currentScreenIndex ? 'var(--accent)' : 'var(--bg-card)'};
                            color:${i === this.currentScreenIndex ? 'white' : 'var(--text)'};
                            border:1px solid ${i === this.currentScreenIndex ? 'var(--accent)' : 'var(--border)'};
                            border-radius:8px; font-size:13px; font-weight:600; cursor:pointer; position:relative;
                        ">${s.name || `Screen ${i+1}`}
                            <span onclick="event.stopPropagation();window.dashboardEditor.deleteScreen(${i})" style="
                                position:absolute;top:-5px;right:-5px;width:16px;height:16px;border-radius:50%;
                                background:#ef5350;color:white;font-size:10px;display:flex;align-items:center;justify-content:center;
                                cursor:pointer;line-height:1;" title="Screen löschen">×</span>
                        </button>`).join('')}
                    <button onclick="window.dashboardEditor.addScreen()" style="
                        padding:6px 12px; background:var(--bg-card); color:var(--accent);
                        border:1px solid var(--accent); border-radius:8px; font-size:13px; cursor:pointer; font-weight:600;
                    ">+ Screen</button>
                    <input type="text" value="${screen.name || ''}"
                        onchange="window.dashboardEditor.renameScreen(this.value)"
                        style="padding:5px 10px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;
                               color:var(--text);font-size:12px;width:140px;" placeholder="Screen-Name">
                </div>

                <!-- Two-column editor: template picker + slot assignment -->
                <div style="flex:1; display:flex; gap:14px; min-height:0; overflow:hidden;">
                    <!-- Template picker -->
                    <div style="width:280px; flex-shrink:0; background:var(--bg-panel); border:1px solid var(--border); border-radius:12px; padding:14px; overflow-y:auto;">
                        <div style="font-size:12px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">Vorlage</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
                            ${this.templates.map(t => `
                                <div onclick="window.dashboardEditor.setScreenLayout('${t.id}')" style="
                                    padding:8px; border-radius:8px; cursor:pointer; text-align:center;
                                    border:2px solid ${screen.layoutId === t.id ? 'var(--accent)' : 'var(--border)'};
                                    background:${screen.layoutId === t.id ? 'rgba(79,195,247,0.08)' : 'var(--bg-card)'};
                                    transition:border-color .15s;
                                " onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='${screen.layoutId === t.id ? 'var(--accent)' : 'var(--border)'}'">
                                    <div style="margin-bottom:5px;">${this._templateThumbnailSvg(t)}</div>
                                    <div style="font-size:10px;color:var(--text);font-weight:600;">${t.name}</div>
                                </div>`).join('')}
                        </div>
                    </div>

                    <!-- Slot assignment -->
                    <div style="flex:1; background:var(--bg-panel); border:1px solid var(--border); border-radius:12px; padding:14px; overflow-y:auto;">
                        <div style="font-size:12px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">
                            Slots — Vorlage: <span style="color:var(--accent)">${tmpl.name || tmpl.id}</span>
                        </div>
                        ${slots.map(slot => {
                            const w = (screen.widgets || {})[slot] || {};
                            const wtype = w.type || '';
                            return `
                            <div style="display:flex;align-items:flex-start;gap:10px;padding:10px;margin-bottom:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;">
                                <!-- Slot letter badge -->
                                <div style="width:28px;height:28px;border-radius:6px;background:#1565C0;display:flex;align-items:center;justify-content:center;
                                            color:white;font-weight:700;font-family:monospace;font-size:14px;flex-shrink:0;">${slot}</div>
                                <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
                                    <!-- Widget type -->
                                    <select onchange="window.dashboardEditor.setSlotWidgetType('${slot}', this.value)" style="
                                        width:100%;padding:6px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                        border-radius:6px;color:var(--text);font-size:12px;">
                                        <option value="" ${!wtype ? 'selected':''}>— leer —</option>
                                        <option value="sensor" ${wtype==='sensor'?'selected':''}>Sensor-Karte</option>
                                        <option value="gauge" ${wtype==='gauge'?'selected':''}>Gauge</option>
                                        <option value="horizon" ${wtype==='horizon'?'selected':''}>Horizont</option>
                                        <option value="clock" ${wtype==='clock'?'selected':''}>Uhr</option>
                                        <option value="compass" ${wtype==='compass'?'selected':''}>Navi-Instrument</option>
                                        <option value="spacer" ${wtype==='spacer'?'selected':''}>Spacer</option>
                                        <option value="text" ${wtype==='text'?'selected':''}>Text</option>
                                    </select>
                                    ${wtype === 'gauge' ? `
                                    <select onchange="window.dashboardEditor.setSlotProp('${slot}','sensor',this.value)" style="
                                        width:100%;padding:6px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                        border-radius:6px;color:var(--text);font-size:12px;">
                                        <option value="">— Sensor / Feld wählen —</option>
                                        ${(this.sensors||[]).map(s => `<option value="${s.full_path}" ${w.sensor===s.full_path?'selected':''}>${s.name||s.full_path}</option>`).join('')}
                                    </select>
` : ''}
                                    ${wtype === 'sensor' ? `
                                    <select onchange="window.dashboardEditor.setSlotSensor('${slot}',this.value)" style="
                                        width:100%;padding:6px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                        border-radius:6px;color:var(--text);font-size:12px;">
                                        <option value="">— Sensor-Gruppe wählen —</option>
                                        ${(this.sensorGroups||[]).map(s => `<option value="${s.base_name}" ${w.sensor===s.base_name?'selected':''}>${s.name}</option>`).join('')}
                                    </select>
                                    ${this._renderSlotFieldCheckboxes(slot, w)}
                                    <input type="text" value="${(w.alias||'').replace(/"/g,'&quot;')}" placeholder="Anzeigename (Titel)"
                                        onchange="window.dashboardEditor.setSlotProp('${slot}','alias',this.value)"
                                        style="width:100%;padding:5px 8px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;box-sizing:border-box;">
                                    <select onchange="window.dashboardEditor.setSlotProp('${slot}','style',this.value)" style="
                                        width:100%;padding:5px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                        border-radius:6px;color:var(--text);font-size:12px;margin-top:2px;">
                                        <option value="card" ${(w.style||'card')==='card'?'selected':''}>Card</option>
                                        <option value="compact" ${w.style==='compact'?'selected':''}>Kompakt</option>
                                        <option value="hero" ${w.style==='hero'?'selected':''}>Hero</option>
                                    </select>
                                    ` : ''}
                                    ${wtype === 'horizon' ? `
                                    <div style="display:flex;flex-direction:column;gap:5px;">
                                        <label style="font-size:10px;color:var(--text-dim);margin:0;">Roll-Topic</label>
                                        <select onchange="window.dashboardEditor.setSlotHorizonPath('${slot}','roll',this.value)" style="
                                            width:100%;padding:5px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                            border-radius:6px;color:var(--text);font-size:11px;">
                                            <option value="">— Roll auswählen —</option>
                                            ${this.sensors.map(s => `<option value="${s.full_path||s.base_name+'/'+s.value_name}" ${(w.rollSensor&&w.rollField)&&(w.rollSensor+'/'+(w.rollField||''))===(s.full_path||s.base_name+'/'+s.value_name)?'selected':''}>${s.name||s.full_path}</option>`).join('')}
                                        </select>
                                        <label style="font-size:10px;color:var(--text-dim);margin:0;">Pitch-Topic</label>
                                        <select onchange="window.dashboardEditor.setSlotHorizonPath('${slot}','pitch',this.value)" style="
                                            width:100%;padding:5px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                            border-radius:6px;color:var(--text);font-size:11px;">
                                            <option value="">— Pitch auswählen —</option>
                                            ${this.sensors.map(s => `<option value="${s.full_path||s.base_name+'/'+s.value_name}" ${(w.pitchSensor&&w.pitchField)&&(w.pitchSensor+'/'+(w.pitchField||''))===(s.full_path||s.base_name+'/'+s.value_name)?'selected':''}>${s.name||s.full_path}</option>`).join('')}
                                        </select>
                                        <label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text);cursor:pointer;margin:2px 0;">
                                            <input type="checkbox" ${w.impactSensor?'checked':''} onchange="window.dashboardEditor.toggleSlotImpact('${slot}',this.checked)"
                                                style="width:14px;height:14px;cursor:pointer;">
                                            Impact-Alarm
                                        </label>
                                        ${w.impactSensor !== undefined && w.impactSensor !== null ? `
                                        <select onchange="window.dashboardEditor.setSlotHorizonPath('${slot}','impact',this.value)" style="
                                            width:100%;padding:5px 8px;background:var(--bg-panel);border:1px solid var(--border);
                                            border-radius:6px;color:var(--text);font-size:11px;">
                                            <option value="">— Impact-Topic —</option>
                                            ${this.sensors.map(s => `<option value="${s.full_path||s.base_name+'/'+s.value_name}" ${(w.impactSensor&&w.impactField)&&(w.impactSensor+'/'+(w.impactField||''))===(s.full_path||s.base_name+'/'+s.value_name)?'selected':''}>${s.name||s.full_path}</option>`).join('')}
                                        </select>` : ''}
                                    </div>` : ''}
                                    ${wtype === 'gauge' ? `
                                    <div style="display:flex;gap:6px;flex-wrap:wrap;">
                                        <input type="number" placeholder="Min" value="${w.min!=null?w.min:0}"
                                            onchange="window.dashboardEditor.setSlotProp('${slot}','min',parseFloat(this.value))"
                                            style="width:60px;padding:5px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">
                                        <input type="number" placeholder="Max" value="${w.max!=null?w.max:100}"
                                            onchange="window.dashboardEditor.setSlotProp('${slot}','max',parseFloat(this.value))"
                                            style="width:60px;padding:5px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">
                                        <input type="text" placeholder='Einheit' value="${w.unit||''}"
                                            onchange="window.dashboardEditor.setSlotProp('${slot}','unit',this.value)"
                                            style="width:60px;padding:5px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:11px;">
                                        <select onchange="window.dashboardEditor.setSlotProp('${slot}','style',this.value)" style="
                                            flex:1;padding:5px 6px;background:var(--bg-panel);border:1px solid var(--border);
                                            border-radius:6px;color:var(--text);font-size:11px;">
                                            <option value="arc270" ${(w.style||'arc270')==='arc270'?'selected':''}>270°</option>
                                            <option value="arc180" ${w.style==='arc180'?'selected':''}>180°</option>
                                            <option value="arc360" ${w.style==='arc360'?'selected':''}>360°</option>
                                            <option value="bar" ${w.style==='bar'?'selected':''}>Balken</option>
                                        </select>
                                        <select onchange="window.dashboardEditor.setSlotProp('${slot}','color',this.value)" style="
                                            flex:1;padding:5px 6px;background:var(--bg-panel);border:1px solid var(--border);
                                            border-radius:6px;color:var(--text);font-size:11px;">
                                            ${['cyan','blue','green','orange','purple','red'].map(c=>`<option value="${c}" ${(w.color||'cyan')===c?'selected':''}>${c}</option>`).join('')}
                                        </select>
                                        <select onchange="window.dashboardEditor.setSlotProp('${slot}','decimals',parseInt(this.value))" title="Dezimalstellen" style="
                                            width:54px;padding:5px 4px;background:var(--bg-panel);border:1px solid var(--border);
                                            border-radius:6px;color:var(--text);font-size:11px;">
                                            ${[0,1,2,3].map(n=>`<option value="${n}" ${(w.decimals??1)===n?'selected':''}>${n} Dez.</option>`).join('')}
                                        </select>
                                    </div>` : ''}
                                    ${wtype === 'text' ? `
                                    <input type="text" placeholder="Text eingeben" value="${(w.text||'').replace(/"/g,'&quot;')}"
                                        onchange="window.dashboardEditor.setSlotProp('${slot}','text',this.value)"
                                        style="width:100%;padding:5px 8px;background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:12px;">
                                    ` : ''}
                                </div>
                                <!-- Clear slot button -->
                                <button onclick="window.dashboardEditor.clearSlot('${slot}')" title="Slot leeren" style="
                                    background:none;border:1px solid rgba(239,83,80,0.4);border-radius:6px;
                                    color:#ef5350;font-size:13px;padding:4px 7px;cursor:pointer;flex-shrink:0;line-height:1;">×</button>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Switch to a different screen tab
     */
    switchScreen(index) {
        this.currentScreenIndex = Math.max(0, Math.min(index, this.screens.length - 1));
        this.render();
    }

    /**
     * Add a new screen
     */
    addScreen() {
        const n = this.screens.length + 1;
        this.screens.push({ name: `Screen ${n}`, layoutId: 'full', widgets: {} });
        this.currentScreenIndex = this.screens.length - 1;
        this.render();
    }

    /**
     * Delete a screen at index i
     */
    deleteScreen(i) {
        if (this.screens.length <= 1) {
            alert('Mindestens ein Screen muss vorhanden sein.');
            return;
        }
        if (!confirm(`Screen "${this.screens[i].name}" löschen?`)) return;
        this.screens.splice(i, 1);
        this.currentScreenIndex = Math.max(0, Math.min(this.currentScreenIndex, this.screens.length - 1));
        this.render();
    }

    /**
     * Rename current screen
     */
    renameScreen(name) {
        if (this.screens[this.currentScreenIndex]) {
            this.screens[this.currentScreenIndex].name = name.trim() || `Screen ${this.currentScreenIndex + 1}`;
        }
    }

    /**
     * Set the layout template for the current screen
     */
    setScreenLayout(layoutId) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen) return;
        const oldTmpl = this.templates.find(t => t.id === screen.layoutId) || { slots: [] };
        const newTmpl = this.templates.find(t => t.id === layoutId) || { slots: [] };
        // Keep widgets that exist in the new template's slots
        const newWidgets = {};
        for (const slot of (newTmpl.slots || [])) {
            if (screen.widgets[slot]) newWidgets[slot] = screen.widgets[slot];
        }
        screen.layoutId = layoutId;
        screen.widgets = newWidgets;
        this.render();
    }

    /**
     * Set a slot's widget type
     */
    setSlotWidgetType(slot, type) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen) return;
        if (!type) {
            delete screen.widgets[slot];
        } else {
            const defaults = {
                sensor:  { type:'sensor', sensor:'', style:'card', color:'cyan' },
                gauge:   { type:'gauge', sensor:'', min:0, max:100, unit:'', style:'arc270', color:'cyan', decimals:1 },
                horizon: { type:'horizon', rollSensor:'', rollField:'schlagseite', pitchSensor:'', pitchField:'neigung', impactSensor:null, impactField:null },
                clock:   { type:'clock' },
                compass: { type:'compass' },
                spacer:  { type:'spacer' },
                text:    { type:'text', text:'' }
            };
            screen.widgets[slot] = { ...(screen.widgets[slot] || {}), ...(defaults[type] || { type }) };
            screen.widgets[slot].type = type;
        }
        this.render();
    }

    /**
     * Set a property on a slot's widget
     */
    setSlotProp(slot, prop, value) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen || !screen.widgets[slot]) return;
        screen.widgets[slot][prop] = value;
        // No re-render needed — input/select already reflects the value
    }

    setSlotHorizonPath(slot, which, fullPath) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen || !screen.widgets[slot]) return;
        const w = screen.widgets[slot];
        if (!fullPath) return;
        const idx = fullPath.lastIndexOf('/');
        const base  = idx >= 0 ? fullPath.slice(0, idx)  : fullPath;
        const field = idx >= 0 ? fullPath.slice(idx + 1) : '';
        if (which === 'roll') {
            w.rollSensor = base; w.rollField = field;
        } else if (which === 'pitch') {
            w.pitchSensor = base; w.pitchField = field;
        } else if (which === 'impact') {
            w.impactSensor = base; w.impactField = field;
        }
    }

    toggleSlotImpact(slot, enabled) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen || !screen.widgets[slot]) return;
        const w = screen.widgets[slot];
        if (enabled) {
            if (!w.impactSensor) w.impactSensor = '';
            if (!w.impactField)  w.impactField  = 'aktiv';
        } else {
            w.impactSensor = null;
            w.impactField  = null;
        }
        this.render();
    }

    setSlotSensor(slot, baseName) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen) return;
        if (!screen.widgets[slot]) screen.widgets[slot] = { type: 'sensor' };
        screen.widgets[slot].sensor = baseName;
        screen.widgets[slot].fields = [];
        this.render();
    }

    toggleSlotField(slot, fieldName, checked) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen || !screen.widgets[slot]) return;
        const w = screen.widgets[slot];
        let fields = [...(w.fields || [])];
        if (checked) {
            if (!fields.includes(fieldName)) fields.push(fieldName);
        } else {
            fields = fields.filter(f => f !== fieldName);
        }
        w.fields = fields;
        this.render();
    }

    setSlotFieldAlias(slot, fieldName, alias) {
        const screen = this.screens[this.currentScreenIndex];
        if (!screen || !screen.widgets[slot]) return;
        const w = screen.widgets[slot];
        if (!w.fieldAliases) w.fieldAliases = {};
        if (alias) {
            w.fieldAliases[fieldName] = alias;
        } else {
            delete w.fieldAliases[fieldName];
        }
    }

    _renderSlotFieldCheckboxes(slot, w) {
        if (!w || !w.sensor) return '';
        const group = (this.sensorGroups || []).find(s => s.base_name === w.sensor);
        if (!group) return '';
        const fieldNames = Object.keys(group.values || {});
        if (!fieldNames.length) return '';
        const selectedFields = w.fields || w.show || [];
        const aliases = w.fieldAliases || {};
        const rows = fieldNames.map(f => {
            const checked = selectedFields.includes(f) ? 'checked' : '';
            const aliasVal = (aliases[f] || '').replace(/"/g, '&quot;');
            return `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;border-bottom:1px solid var(--border);">
                <input type="checkbox" ${checked} onchange="window.dashboardEditor.toggleSlotField('${slot}','${f}',this.checked)"
                    style="width:14px;height:14px;cursor:pointer;accent-color:var(--accent);flex-shrink:0;">
                <span style="font-size:12px;color:var(--text);min-width:80px;">${f}</span>
                <input type="text" value="${aliasVal}" placeholder="Anzeigename"
                    onchange="window.dashboardEditor.setSlotFieldAlias('${slot}','${f}',this.value)"
                    style="flex:1;padding:3px 7px;background:var(--bg-card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:11px;">
            </div>`;
        }).join('');
        return `<div style="background:var(--bg-panel);border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-top:4px;">${rows}</div>`;
    }

    /**
     * Clear a slot (remove widget assignment)
     */
    clearSlot(slot) {
        const screen = this.screens[this.currentScreenIndex];
        if (screen) delete screen.widgets[slot];
        this.render();
    }

    /**
     * Convert screens to DSL (new SCREEN/LAYOUT format)
     */
    toDSLScreen() {
        let dsl = '';
        for (const screen of this.screens) {
            const layoutId = screen.layoutId || 'full';
            const safeName = (screen.name || 'Screen').replace(/\s+/g, '_');
            dsl += `SCREEN ${safeName} LAYOUT ${layoutId}\n`;
            const tmpl = this.templates.find(t => t.id === layoutId) || { slots: [] };
            for (const slot of (tmpl.slots || [])) {
                const w = (screen.widgets || {})[slot];
                if (!w || !w.type) continue;
                dsl += `  ${slot}  ${this._widgetToDSLLine(w)}\n`;
            }
            dsl += '\n';
        }
        return dsl.trim();
    }

    /**
     * Serialize a single widget to a DSL line (without slot prefix)
     */
    // Screen-Slot-Serialisierung (ohne SIZE) — delegiert an die Widget-Registry.
    _widgetToDSLLine(w) {
        return window.dashWidgets.toDsl(w, { withSize: false }) || 'SPACER';
    }

    // ───────────────────────────────────────────────────────────────────────────

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
            const h = this.rowHeights[rowName] || 1;
            dsl += `ROW ${rowName}${h > 1 ? ` HEIGHT ${h}` : ''}\n`;
            widgets.forEach(w => {
                // Grid-Serialisierung (mit SIZE) — delegiert an die Widget-Registry.
                const line = window.dashWidgets.isRegistered(w.type)
                    ? window.dashWidgets.toDsl(w, { withSize: true })
                    : `${w.type.toUpperCase()}${w.size && w.size > 1 ? ` SIZE ${w.size}` : ''}`;
                dsl += `  ${line}\n`;
            });
            dsl += '\n';
        });

        return dsl.trim();
    }

    /**
     * Save layout to backend
     */
    async save() {
        const dsl = this.screens.length > 0 ? this.toDSLScreen() : this.toDSL();
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
