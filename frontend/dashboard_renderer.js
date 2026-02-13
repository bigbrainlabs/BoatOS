/**
 * Dashboard Renderer
 * Renders dashboard from parsed DSL layout with smooth real-time updates
 */

class DashboardRenderer {
    constructor() {
        this.sensors = {};
        this.layout = null;
        this.updateInterval = null;
        this.widgetCounter = 0;
        this.isInitialized = false;
        this.injectStyles();
    }

    /**
     * Inject CSS styles for smooth transitions
     */
    injectStyles() {
        if (document.getElementById('dashboard-renderer-styles')) return;

        const style = document.createElement('style');
        style.id = 'dashboard-renderer-styles';
        style.textContent = `
            .sensor-value {
                transition: opacity 0.15s ease-out;
            }
            .sensor-value.updating {
                opacity: 0.7;
            }
            .gauge-needle {
                transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
                transform-origin: 50% 50%;
            }
            .gauge-arc-value {
                transition: stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .gauge-bar-fill {
                transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .gauge-instrument {
                position: relative;
                width: 100%;
                flex: 1;
                min-height: 0;
            }
            .gauge-instrument svg {
                display: block;
                width: 100%;
                height: 100%;
                overflow: visible;
            }
            .gauge-widget {
                grid-column: span var(--gauge-span, 1);
                background: radial-gradient(ellipse at 30% 20%, rgba(40, 80, 140, 0.7), rgba(15, 25, 50, 0.85));
                border: 2px solid rgba(100, 180, 255, 0.25);
                border-radius: var(--radius-xl);
                padding: var(--space-xl);
                box-shadow:
                    0 4px 24px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08);
                text-align: center;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .gauge-value-below {
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Consolas', monospace;
                font-variant-numeric: tabular-nums;
                font-weight: 700;
                font-size: clamp(18px, 1.5vw, 26px);
                text-shadow: 0 0 15px currentColor;
                margin-top: var(--space-xs);
                flex-shrink: 0;
                line-height: 1;
            }
            .gauge-glass {
                pointer-events: none;
            }
            .gauge-label {
                font-size: var(--fs-sm);
                color: rgba(180, 200, 230, 0.8);
                text-transform: uppercase;
                letter-spacing: 2px;
                font-weight: 600;
                margin-bottom: var(--space-xs);
                flex-shrink: 0;
            }
            .gauge-value-display {
                font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Consolas', monospace;
                font-variant-numeric: tabular-nums;
                font-weight: 700;
                text-shadow: 0 0 20px currentColor;
            }
            .gauge-range {
                display: flex;
                justify-content: space-between;
                color: rgba(140, 160, 190, 0.6);
                font-size: var(--fs-2xs);
                font-family: 'SF Mono', monospace;
                margin-top: var(--space-2xs);
                padding: 0 var(--space-sm);
                flex-shrink: 0;
            }
            .gauge-bar-widget {
                grid-column: span var(--gauge-span, 1);
                background: radial-gradient(ellipse at 30% 20%, rgba(40, 80, 140, 0.7), rgba(15, 25, 50, 0.85));
                border: 2px solid rgba(100, 180, 255, 0.25);
                border-radius: var(--radius-xl);
                padding: var(--space-2xl) var(--space-3xl);
                box-shadow:
                    0 4px 24px rgba(0, 0, 0, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.08);
                text-align: center;
            }
            .gauge-bar-track {
                width: 100%;
                height: clamp(10px, 1vw, 14px);
                background: rgba(10, 20, 40, 0.6);
                border-radius: 7px;
                overflow: hidden;
                position: relative;
                box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
                border: 1px solid rgba(80, 120, 180, 0.15);
            }
            .gauge-bar-fill {
                height: 100%;
                border-radius: 7px;
                position: relative;
                overflow: hidden;
            }
            .gauge-bar-fill::after {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, rgba(255,255,255,0.25) 0%, transparent 60%);
                border-radius: inherit;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Generate unique ID for widget elements
     */
    generateId(prefix) {
        return `${prefix}-${++this.widgetCounter}`;
    }

    /**
     * Get sensor value by path (handles both base_name and full path with value)
     * @param {string} path - Sensor path like "bilge/thermo" or "bilge/thermo/temperature"
     * @returns {number|string} The sensor value
     */
    getSensorValue(path) {
        if (!path) return 0;

        // First try direct lookup
        if (this.sensors[path]) {
            const values = this.sensors[path].values || {};
            const keys = Object.keys(values);
            return keys.length > 0 ? values[keys[0]] : 0;
        }

        // Try to find by splitting path into base_name and value_name
        const parts = path.split('/');
        if (parts.length >= 2) {
            // Try progressively shorter base paths
            for (let i = parts.length - 1; i >= 1; i--) {
                const baseName = parts.slice(0, i).join('/');
                const valueName = parts.slice(i).join('/');

                if (this.sensors[baseName]) {
                    const values = this.sensors[baseName].values || {};
                    // Try exact value name match
                    if (values[valueName] !== undefined) {
                        return values[valueName];
                    }
                    // Try just the last part
                    const lastPart = parts[parts.length - 1];
                    if (values[lastPart] !== undefined) {
                        return values[lastPart];
                    }
                }
            }
        }

        return 0;
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
        const key = name.toLowerCase().split('/').pop();
        return map[key] || name;
    }

    /**
     * Load and render dashboard layout
     */
    async loadAndRender() {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';

            // Load layout DSL
            const layoutResponse = await fetch(`${apiUrl}/api/dashboard/layout`);
            const layoutData = await layoutResponse.json();
            const dslText = layoutData.layout;

            // Parse DSL
            const parseResponse = await fetch(`${apiUrl}/api/dashboard/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dslText })
            });
            this.layout = await parseResponse.json();

            // Load current sensors
            await this.updateSensors();

            // Reset widget counter for consistent IDs
            this.widgetCounter = 0;

            // Render full dashboard (only once)
            this.render();
            this.isInitialized = true;

            // Start auto-update with partial updates
            this.startAutoUpdate();

            console.log('Dashboard initialized with smooth updates');
        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.renderError();
        }
    }

    /**
     * Update sensor values from API
     */
    async updateSensors() {
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
            const sensorsResponse = await fetch(`${apiUrl}/api/sensors/list`);
            const sensorsData = await sensorsResponse.json();

            // Index sensors by base_name for quick lookup
            this.sensors = {};
            sensorsData.sensors.forEach(sensor => {
                this.sensors[sensor.base_name] = sensor;
            });
        } catch (error) {
            console.error('Error updating sensors:', error);
        }
    }

    /**
     * Update only the values in the DOM (no full re-render)
     */
    updateValues() {
        // Update all sensor value elements
        document.querySelectorAll('[data-sensor-path]').forEach(el => {
            const path = el.dataset.sensorPath;
            const format = el.dataset.format || 'auto';
            const decimals = parseInt(el.dataset.decimals || '2');
            const unit = el.dataset.unit || '';

            let value = this.getSensorValue(path);
            let displayValue;

            if (format === 'number' || !isNaN(parseFloat(value))) {
                const numValue = parseFloat(value) || 0;
                displayValue = numValue.toFixed(decimals);
                if (unit) displayValue += ` ${unit}`;
            } else {
                displayValue = value;
            }

            // Only update if value changed
            if (el.textContent !== displayValue) {
                el.textContent = displayValue;
            }
        });

        // Update gauge elements
        document.querySelectorAll('[data-gauge-path]').forEach(gauge => {
            const path = gauge.dataset.gaugePath;
            const min = parseFloat(gauge.dataset.min || '0');
            const max = parseFloat(gauge.dataset.max || '100');
            const style = gauge.dataset.style || 'arc180';

            const value = parseFloat(this.getSensorValue(path)) || 0;
            const percentage = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
            const decimals = parseInt(gauge.dataset.decimals || '1');
            const unit = gauge.dataset.unit || '';
            const displayVal = value.toFixed(decimals) + (unit ? ` ${unit}` : '');

            // Update value display (HTML element below gauge)
            const valueEl = gauge.querySelector('.gauge-value');
            if (valueEl && valueEl.textContent !== displayVal) {
                valueEl.textContent = displayVal;
            }

            // Update bar gauge
            const barFill = gauge.querySelector('.gauge-bar-fill');
            if (barFill) {
                barFill.style.width = `${percentage}%`;
            }

            // Update arc gauge needle (CSS transform rotation for smooth animation)
            const needle = gauge.querySelector('.gauge-needle');
            if (needle && !barFill) {
                const startAngle = parseFloat(gauge.dataset.startAngle || '-180');
                const totalAngle = parseFloat(gauge.dataset.totalAngle || '180');
                const needleAngle = startAngle + (percentage / 100) * totalAngle;
                needle.style.transform = `rotate(${needleAngle}deg)`;
            }

            // Update arc value path + glow arc
            const arcValue = gauge.querySelector('.gauge-arc-value');
            const arcGlow = gauge.querySelector('.gauge-arc-glow');
            if (arcValue) {
                const startAngle = parseFloat(gauge.dataset.startAngle || '-180');
                const totalAngle = parseFloat(gauge.dataset.totalAngle || '180');
                const gcx = parseFloat(gauge.dataset.gcx || '100');
                const gcy = parseFloat(gauge.dataset.gcy || '100');
                const radius = parseFloat(gauge.dataset.radius || '78');
                const valueEndAngle = startAngle + (percentage / 100) * totalAngle;

                if (percentage > 0.5) {
                    const newPath = this.describeArc(gcx, gcy, radius, startAngle, valueEndAngle);
                    arcValue.setAttribute('d', newPath);
                    arcValue.style.display = '';
                    if (arcGlow) {
                        arcGlow.setAttribute('d', newPath);
                        arcGlow.style.display = '';
                    }
                } else {
                    arcValue.style.display = 'none';
                    if (arcGlow) arcGlow.style.display = 'none';
                }
            }
        });

        // Update status indicators
        document.querySelectorAll('[data-sensor-status]').forEach(el => {
            const baseName = el.dataset.sensorStatus;
            const sensor = this.sensors[baseName];
            if (sensor) {
                const statusColors = {
                    online: '#2ecc71',
                    offline: '#e74c3c',
                    standby: '#f39c12'
                };
                el.style.background = statusColors[sensor.status] || statusColors.offline;
                el.textContent = sensor.status;
            }
        });
    }

    /**
     * Start auto-update interval with partial DOM updates
     */
    startAutoUpdate() {
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Update values every 1 second (smooth, no flicker)
        this.updateInterval = setInterval(async () => {
            await this.updateSensors();
            this.updateValues();
        }, 1000);
    }

    /**
     * Stop auto-update
     */
    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Render error state with helpful message
     */
    renderError() {
        const container = document.getElementById('sensor-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div style="text-align: center; padding: var(--space-4xl); color: var(--text-dim);">
                <div style="font-size: var(--fs-5xl); margin-bottom: var(--space-lg);">⚠️</div>
                <div style="font-size: var(--fs-xl); color: var(--text); margin-bottom: var(--space-md);">
                    Dashboard konnte nicht geladen werden
                </div>
                <div style="font-size: var(--fs-md); margin-bottom: var(--space-2xl);">
                    Bitte prüfe die Verbindung zum Backend
                </div>
                <button onclick="window.dashboardRenderer.loadAndRender()" style="
                    padding: var(--space-base) var(--space-3xl);
                    background: var(--accent);
                    color: white;
                    border: none;
                    border-radius: var(--radius-md);
                    font-size: var(--fs-lg);
                    cursor: pointer;
                ">Erneut versuchen</button>
            </div>
        `;
    }

    /**
     * Render dashboard from parsed layout
     */
    render() {
        const container = document.getElementById('sensor-dashboard');
        if (!container) {
            console.warn('Dashboard container not found');
            return;
        }

        this.widgetCounter = 0;
        container.innerHTML = this.renderToHTML();
    }

    /**
     * Render dashboard to HTML string (for preview mode)
     */
    renderToHTML() {
        // Show errors if any
        if (this.layout.errors && this.layout.errors.length > 0) {
            console.warn('Dashboard layout errors:', this.layout.errors);
        }

        // Build grid HTML
        const gridColumns = this.layout.grid || 3;
        let html = `<div class="dashboard-grid" style="
            display: grid;
            grid-template-columns: repeat(${gridColumns}, 1fr);
            gap: var(--space-2xl);
            max-width: 1400px;
            margin: 0 auto;
        ">`;

        // Render each row
        this.layout.rows.forEach(row => {
            row.widgets.forEach(widget => {
                html += this.renderWidget(widget, gridColumns);
            });
        });

        html += '</div>';

        return html;
    }

    /**
     * Render a single widget
     */
    renderWidget(widget, gridColumns) {
        const size = widget.size || 1;

        switch (widget.type) {
            case 'sensor':
                return this.renderSensorWidget(widget, size);
            case 'gauge':
                return this.renderGaugeWidget(widget, size);
            case 'chart':
                return this.renderChartWidget(widget, size);
            case 'text':
                return this.renderTextWidget(widget, size);
            default:
                return '';
        }
    }

    /**
     * Render sensor widget with data attributes for partial updates
     */
    renderSensorWidget(widget, size) {
        // Try to find sensor - support both base_name and full path
        let sensor = this.sensors[widget.sensor];
        let specificValue = null;

        if (!sensor) {
            // Try to find by base path
            const parts = widget.sensor.split('/');
            for (let i = parts.length - 1; i >= 1; i--) {
                const baseName = parts.slice(0, i).join('/');
                if (this.sensors[baseName]) {
                    sensor = this.sensors[baseName];
                    specificValue = parts.slice(i).join('/');
                    break;
                }
            }
        }

        if (!sensor) {
            return this.renderUnknownWidget(widget, size);
        }

        const style = widget.style || 'card';
        const color = widget.color || 'cyan';
        const icon = widget.icon || sensor.icon;
        const name = widget.alias || (specificValue ? this.formatValueName(specificValue) : sensor.name);
        const baseName = sensor.base_name;

        // Filter topics based on SHOW/HIDE or specific value
        let filteredValues;
        if (specificValue) {
            // Show only the specific value
            const val = sensor.values[specificValue] || sensor.values[specificValue.split('/').pop()];
            filteredValues = val !== undefined ? { [specificValue.split('/').pop()]: val } : {};
        } else {
            filteredValues = this.filterTopics(sensor.values, widget.show, widget.hide);
        }

        const colorMap = {
            cyan: 'rgba(100, 255, 218, 0.1)',
            blue: 'rgba(52, 152, 219, 0.1)',
            orange: 'rgba(230, 126, 34, 0.1)',
            green: 'rgba(46, 204, 113, 0.1)',
            purple: 'rgba(155, 89, 182, 0.1)'
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

        const bg = colorMap[color] || colorMap.cyan;
        const border = borderColorMap[color] || borderColorMap.cyan;
        const textColor = textColorMap[color] || textColorMap.cyan;

        const statusColors = {
            online: '#2ecc71',
            offline: '#e74c3c',
            standby: '#f39c12'
        };

        // Helper to create value element with data attributes
        const createValueElement = (key, value) => {
            const sensorPath = specificValue
                ? `${baseName}/${specificValue}`
                : `${baseName}/${key}`;
            const formattedValue = this.formatValueWithUnit(key, value, widget.units);
            return `<span class="sensor-value" data-sensor-path="${sensorPath}" data-format="auto" data-decimals="2">${formattedValue}</span>`;
        };

        // Hero style
        if (style === 'hero') {
            return `
                <div style="
                    grid-column: span ${size};
                    background: linear-gradient(135deg, rgba(30, 60, 114, 0.8), rgba(42, 82, 152, 0.8));
                    backdrop-filter: blur(15px);
                    border: 1px solid ${border};
                    border-radius: var(--radius-2xl);
                    padding: var(--space-4xl);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                ">
                    <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: var(--space-3xl);">
                        <div style="
                            background: linear-gradient(135deg, ${bg}, ${bg});
                            padding: var(--space-2xl);
                            border-radius: var(--radius-2xl);
                            font-size: var(--fs-4xl);
                            font-weight: 700;
                            color: ${textColor};
                            font-family: monospace;
                            min-width: 70px;
                            text-align: center;
                        ">${icon}</div>
                        <div data-sensor-status="${baseName}" style="
                            background: ${statusColors[sensor.status]};
                            color: white;
                            padding: var(--space-xs) var(--space-lg);
                            border-radius: var(--radius-2xl);
                            font-size: var(--fs-sm);
                            font-weight: 600;
                            text-transform: uppercase;
                        ">${sensor.status}</div>
                    </div>
                    <div style="font-size: var(--fs-3xl); color: white; font-weight: 600; margin-bottom: var(--space-lg);">
                        ${name}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(clamp(120px, 7.8vw, 150px), 1fr)); gap: var(--space-lg);">
                        ${Object.entries(filteredValues).map(([key, value]) => `
                            <div style="
                                background: rgba(10, 14, 39, 0.5);
                                padding: var(--space-base);
                                border-radius: var(--radius-md);
                                border: 1px solid ${border};
                            ">
                                <div style="color: #8892b0; font-size: var(--fs-sm); text-transform: uppercase; margin-bottom: var(--space-xs);">
                                    ${key}
                                </div>
                                <div style="color: ${textColor}; font-size: var(--fs-2xl); font-weight: 700; font-family: monospace;">
                                    ${createValueElement(key, value)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Compact style
        if (style === 'compact') {
            return `
                <div style="
                    grid-column: span ${size};
                    background: ${bg};
                    border: 1px solid ${border};
                    border-radius: var(--radius-lg);
                    padding: var(--space-xl);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                ">
                    <div style="display: flex; align-items: center; gap: var(--space-base); margin-bottom: var(--space-sm);">
                        <span style="font-size: var(--fs-3xl);">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-size: var(--fs-md); color: white; font-weight: 600;">${name}</div>
                            <div style="font-size: var(--fs-xs); color: #8892b0; text-transform: uppercase;">${sensor.type}</div>
                        </div>
                        <div data-sensor-status="${baseName}" style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: ${statusColors[sensor.status]};
                        "></div>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: var(--space-sm);">
                        ${Object.entries(filteredValues).map(([key, value]) => `
                            <div style="
                                background: rgba(10, 14, 39, 0.5);
                                padding: var(--space-xs) var(--space-md);
                                border-radius: var(--radius-sm);
                                border: 1px solid ${border};
                                flex: 1;
                                min-width: 80px;
                            ">
                                <div style="color: #8892b0; font-size: var(--fs-2xs); text-transform: uppercase; margin-bottom: 2px;">
                                    ${key}
                                </div>
                                <div style="color: ${textColor}; font-size: var(--fs-md); font-weight: 700; font-family: monospace;">
                                    ${createValueElement(key, value)}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Default card style
        return `
            <div style="
                grid-column: span ${size};
                background: ${bg};
                backdrop-filter: blur(15px);
                border: 2px solid ${border};
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                position: relative;
            ">
                <div data-sensor-status="${baseName}" style="
                    position: absolute;
                    top: var(--space-lg);
                    right: var(--space-lg);
                    background: ${statusColors[sensor.status]};
                    color: white;
                    padding: var(--space-2xs) var(--space-base);
                    border-radius: var(--radius-2xl);
                    font-size: var(--fs-sm);
                    font-weight: 600;
                    text-transform: uppercase;
                ">${sensor.status}</div>

                <div style="display: flex; align-items: center; gap: var(--space-base); margin-bottom: var(--space-xl);">
                    <span style="font-size: var(--fs-5xl);">${icon}</span>
                    <div>
                        <div style="font-size: var(--fs-3xl); font-weight: 600; color: white;">${name}</div>
                        <div style="font-size: var(--fs-sm); color: #8892b0; text-transform: uppercase;">${sensor.type}</div>
                    </div>
                </div>

                <div style="
                    background: rgba(10, 14, 39, 0.5);
                    border-radius: var(--radius-md);
                    padding: var(--space-lg);
                    border: 1px solid ${border};
                ">
                    ${Object.entries(filteredValues).map(([key, value], index) => `
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: var(--space-sm) 0;
                            ${index < Object.keys(filteredValues).length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.08);' : ''}
                        ">
                            <span style="color: #8892b0; font-size: var(--fs-base); font-weight: 500;">${key}</span>
                            <span style="color: ${textColor}; font-size: var(--fs-lg); font-weight: 700; font-family: monospace;">
                                ${createValueElement(key, value)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render gauge widget with data attributes for smooth updates
     */
    renderGaugeWidget(widget, size) {
        const value = this.getSensorValue(widget.sensor);
        const numValue = parseFloat(value) || 0;

        const min = widget.min || 0;
        const max = widget.max || 100;
        const unit = widget.unit || '';
        const color = widget.color || 'cyan';
        const style = widget.style || 'arc180';
        const label = widget.label || widget.sensor?.split('/').pop() || '';
        const decimals = widget.decimals !== undefined ? widget.decimals : 1;

        const percentage = Math.min(100, Math.max(0, ((numValue - min) / (max - min)) * 100));

        const textColorMap = {
            cyan: '#64ffda',
            blue: '#3498db',
            orange: '#e67e22',
            green: '#2ecc71',
            purple: '#9b59b6',
            red: '#e74c3c',
            yellow: '#f1c40f'
        };
        const textColor = textColorMap[color] || textColorMap.cyan;

        // Render based on style
        if (style === 'bar') {
            return this.renderBarGauge(widget, size, numValue, min, max, unit, percentage, textColor, label, decimals);
        } else {
            return this.renderArcGauge(widget, size, numValue, min, max, unit, percentage, textColor, label, decimals, style);
        }
    }

    /**
     * Render linear bar gauge with glass instrument look
     */
    renderBarGauge(widget, size, value, min, max, unit, percentage, color, label, decimals) {
        const gaugeId = this.generateId('gauge');

        return `
            <div id="${gaugeId}" class="gauge-bar-widget" data-gauge-path="${widget.sensor}" data-min="${min}" data-max="${max}"
                 data-style="bar" data-decimals="${decimals}" data-unit="${unit}" style="--gauge-span: ${size}; grid-column: span ${size};">
                ${label ? `<div class="gauge-label">${label}</div>` : ''}
                <div class="gauge-value gauge-value-display" style="font-size: var(--fs-5xl); color: ${color}; margin-bottom: var(--space-lg);">
                    ${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}
                </div>
                <div class="gauge-bar-track">
                    <div class="gauge-bar-fill" style="
                        width: ${percentage}%;
                        background: linear-gradient(90deg, ${color}88, ${color});
                    "></div>
                </div>
                <div class="gauge-range">
                    <span>${min}${unit ? ` ${unit}` : ''}</span>
                    <span>${max}${unit ? ` ${unit}` : ''}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render arc gauge as premium instrument with glass effect
     */
    renderArcGauge(widget, size, value, min, max, unit, percentage, color, label, decimals, style) {
        const gaugeId = this.generateId('gauge');

        // Viewbox size (internal SVG coordinate system)
        const S = 200;
        const cx = S / 2;
        const cy = S / 2;
        const radius = 78;
        const strokeWidth = 12;

        // Arc configuration based on style
        let startAngle, endAngle;
        switch (style) {
            case 'arc360':
                startAngle = -90;
                endAngle = 270;
                break;
            case 'arc270':
                startAngle = -225;
                endAngle = 45;
                break;
            case 'arc180':
            default:
                startAngle = -180;
                endAngle = 0;
                break;
        }

        const totalAngle = endAngle - startAngle;
        const needleAngle = startAngle + (percentage / 100) * totalAngle;

        // For arc180, shift center down so the half-circle fills the space
        const isHalf = style === 'arc180';
        const gcx = cx;
        const gcy = isHalf ? cy + 15 : cy;
        const viewH = isHalf ? Math.round(S * 0.62) : S;

        // SVG arcs
        const bgArc = this.describeArc(gcx, gcy, radius, startAngle, endAngle);
        const valueEndAngle = startAngle + (percentage / 100) * totalAngle;
        const valueArc = percentage > 0.5 ? this.describeArc(gcx, gcy, radius, startAngle, valueEndAngle) : '';

        // Tick marks with labels
        const tickCount = style === 'arc360' ? 8 : (style === 'arc270' ? 6 : 5);
        const ticks = this.generateInstrumentTicks(min, max, startAngle, totalAngle, gcx, gcy, radius, tickCount, color);

        // Needle drawn pointing RIGHT (0°), rotated via CSS transform for smooth animation
        const needleLen = radius - 12;
        const tailLen = 14;
        const baseW = 3.5;
        // Tip (pointing right from center)
        const tipX = gcx + needleLen;
        const tipY = gcy;
        // Base (perpendicular at center)
        const b1x = gcx;
        const b1y = gcy - baseW;
        const b2x = gcx;
        const b2y = gcy + baseW;
        // Counter-weight tail (pointing left)
        const t1x = gcx - tailLen;
        const t1y = gcy - 2.5;
        const t2x = gcx - tailLen;
        const t2y = gcy + 2.5;

        // Padding around the gauge so tick labels aren't clipped
        const P = 24;
        const vbX = -P;
        const vbY = isHalf ? 0 : -P;
        const vbW = S + 2 * P;
        const vbH = isHalf ? Math.round(gcy + P) : S + 2 * P;

        return `
            <div id="${gaugeId}" class="gauge-widget" data-gauge-path="${widget.sensor}" data-min="${min}" data-max="${max}"
                 data-style="${style}" data-decimals="${decimals}" data-unit="${unit}"
                 data-start-angle="${startAngle}" data-total-angle="${totalAngle}"
                 data-gcx="${gcx}" data-gcy="${gcy}" data-radius="${radius}"
                 style="--gauge-span: ${size}; grid-column: span ${size};">
                ${label ? `<div class="gauge-label">${label}</div>` : ''}
                <div class="gauge-instrument">
                    <svg viewBox="${vbX} ${vbY} ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet">
                        <defs>
                            <radialGradient id="glass-${gaugeId}" cx="40%" cy="30%" r="60%">
                                <stop offset="0%" stop-color="rgba(255,255,255,0.12)"/>
                                <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                            </radialGradient>
                        </defs>

                        <!-- Outer bezel ring -->
                        <circle cx="${gcx}" cy="${gcy}" r="${radius + 18}" fill="none"
                                stroke="rgba(60, 100, 160, 0.3)" stroke-width="1.5"
                                ${isHalf ? `clip-path="inset(0 0 50% 0)"` : ''}/>
                        <circle cx="${gcx}" cy="${gcy}" r="${radius + 15}" fill="none"
                                stroke="rgba(40, 70, 120, 0.2)" stroke-width="3"
                                ${isHalf ? `clip-path="inset(0 0 50% 0)"` : ''}/>

                        <!-- Background arc (track) -->
                        <path d="${bgArc}" fill="none" stroke="rgba(60, 100, 160, 0.2)"
                              stroke-width="${strokeWidth}" stroke-linecap="round"/>

                        <!-- Value arc (colored glow + solid) -->
                        ${valueArc ? `<path d="${valueArc}" fill="none" stroke="${color}"
                              stroke-width="${strokeWidth + 1}" stroke-linecap="round" opacity="0.45"
                              class="gauge-arc-glow"/>` : ''}
                        ${valueArc ? `<path d="${valueArc}" fill="none" stroke="${color}"
                              stroke-width="${strokeWidth}" stroke-linecap="round"
                              class="gauge-arc-value" data-circumference="${2 * Math.PI * radius}"/>` : ''}

                        <!-- Tick marks with labels -->
                        ${ticks}

                        <!-- Needle -->
                        <g class="gauge-needle" style="transform-origin: ${gcx}px ${gcy}px; transform: rotate(${needleAngle}deg);">
                            <polygon points="${tipX},${tipY} ${b1x},${b1y} ${t1x},${t1y} ${t2x},${t2y} ${b2x},${b2y}"
                                     fill="rgba(240, 240, 255, 0.95)" stroke="rgba(0,0,0,0.3)" stroke-width="0.5"/>
                        </g>

                        <!-- Center cap -->
                        <circle cx="${gcx}" cy="${gcy}" r="6" fill="rgba(15, 25, 45, 0.95)"
                                stroke="${color}" stroke-width="1.5"/>
                        <circle cx="${gcx}" cy="${gcy}" r="2.5" fill="${color}" opacity="0.8"/>

                        <!-- Glass overlay -->
                        <circle cx="${gcx}" cy="${gcy}" r="${radius + 14}" fill="url(#glass-${gaugeId})"
                                class="gauge-glass"
                                ${isHalf ? `clip-path="inset(0 0 50% 0)"` : ''}/>
                    </svg>
                </div>
                <div class="gauge-value gauge-value-below" style="color: ${color};">
                    ${value.toFixed(decimals)}${unit ? ` ${unit}` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Generate SVG arc path
     */
    describeArc(x, y, radius, startAngle, endAngle) {
        const start = this.polarToCartesian(x, y, radius, endAngle);
        const end = this.polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
    }

    polarToCartesian(cx, cy, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees * Math.PI) / 180;
        return {
            x: cx + radius * Math.cos(angleInRadians),
            y: cy + radius * Math.sin(angleInRadians)
        };
    }

    /**
     * Generate tick marks for gauge (legacy, kept for compatibility)
     */
    generateTicks(min, max, startAngle, totalAngle, cx, cy, radius, count) {
        return this.generateInstrumentTicks(min, max, startAngle, totalAngle, cx, cy, radius, count, '#64ffda');
    }

    /**
     * Generate instrument-style tick marks with numeric labels
     */
    generateInstrumentTicks(min, max, startAngle, totalAngle, cx, cy, radius, majorCount, color) {
        let ticks = '';
        const outerR = radius + 10;
        const majorInnerR = radius + 3;
        const minorInnerR = radius + 6;
        const labelR = radius + 22;

        // Minor ticks (between each major tick)
        const minorPerMajor = 4;
        const totalMinor = majorCount * minorPerMajor;
        for (let i = 0; i <= totalMinor; i++) {
            const angle = startAngle + (i / totalMinor) * totalAngle;
            const rad = (angle * Math.PI) / 180;
            const isMajor = i % minorPerMajor === 0;
            const innerR = isMajor ? majorInnerR : minorInnerR;

            const x1 = cx + innerR * Math.cos(rad);
            const y1 = cy + innerR * Math.sin(rad);
            const x2 = cx + outerR * Math.cos(rad);
            const y2 = cy + outerR * Math.sin(rad);

            const strokeW = isMajor ? 2 : 0.8;
            const strokeColor = isMajor ? 'rgba(180, 200, 230, 0.7)' : 'rgba(120, 150, 190, 0.35)';

            ticks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeW}"/>`;

            // Labels on major ticks
            if (isMajor) {
                const labelVal = min + (i / totalMinor) * (max - min);
                const lx = cx + labelR * Math.cos(rad);
                const ly = cy + labelR * Math.sin(rad);
                // Format: show integer if whole, otherwise 1 decimal
                const labelText = labelVal === Math.round(labelVal) ? Math.round(labelVal) : labelVal.toFixed(1);
                ticks += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central"
                           fill="rgba(140, 165, 200, 0.7)" font-size="8" font-family="'SF Mono', monospace"
                           font-weight="500">${labelText}</text>`;
            }
        }
        return ticks;
    }

    /**
     * Render chart widget (placeholder for now)
     */
    renderChartWidget(widget, size) {
        return `
            <div style="
                grid-column: span ${size};
                background: linear-gradient(135deg, rgba(30, 60, 114, 0.6), rgba(42, 82, 152, 0.6));
                backdrop-filter: blur(15px);
                border: 2px solid rgba(100, 255, 218, 0.3);
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 200px;
            ">
                <div>
                    <div style="font-size: var(--fs-5xl); margin-bottom: var(--space-md);">📊</div>
                    <div style="color: white; font-size: var(--fs-xl);">Chart: ${widget.sensor}</div>
                    <div style="color: #8892b0; font-size: var(--fs-base); margin-top: var(--space-xs);">
                        Type: ${widget.chart_type} | Period: ${widget.period}min
                    </div>
                    <div style="color: #f39c12; font-size: var(--fs-sm); margin-top: var(--space-md);">
                        Charts coming soon
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render text widget
     */
    renderTextWidget(widget, size) {
        const style = widget.style || 'normal';
        const color = widget.color || 'cyan';

        const textColorMap = {
            cyan: '#64ffda',
            blue: '#3498db',
            orange: '#e67e22',
            green: '#2ecc71',
            purple: '#9b59b6'
        };
        const textColor = textColorMap[color] || textColorMap.cyan;

        const styleMap = {
            title: { fontSize: 'var(--fs-5xl)', fontWeight: '700' },
            subtitle: { fontSize: 'var(--fs-3xl)', fontWeight: '600' },
            normal: { fontSize: 'var(--fs-xl)', fontWeight: '500' }
        };
        const textStyle = styleMap[style] || styleMap.normal;

        return `
            <div style="
                grid-column: span ${size};
                padding: var(--space-2xl);
                display: flex;
                align-items: center;
            ">
                <div style="
                    color: ${textColor};
                    font-size: ${textStyle.fontSize};
                    font-weight: ${textStyle.fontWeight};
                ">${widget.text}</div>
            </div>
        `;
    }

    /**
     * Render unknown sensor widget
     */
    renderUnknownWidget(widget, size) {
        return `
            <div style="
                grid-column: span ${size};
                background: rgba(231, 76, 60, 0.1);
                border: 2px solid rgba(231, 76, 60, 0.3);
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                text-align: center;
            ">
                <div style="font-size: var(--fs-5xl); margin-bottom: var(--space-md);">❓</div>
                <div style="color: #e74c3c; font-size: var(--fs-xl); font-weight: 600;">
                    Sensor nicht gefunden
                </div>
                <div style="color: #8892b0; font-size: var(--fs-base); margin-top: var(--space-xs);">
                    ${widget.sensor}
                </div>
            </div>
        `;
    }

    /**
     * Filter topics based on SHOW/HIDE options
     */
    filterTopics(values, show, hide) {
        if (!values) return {};

        let filtered = { ...values };

        // If SHOW is defined, only show those topics
        if (show && Array.isArray(show) && show.length > 0) {
            filtered = {};
            show.forEach(topic => {
                if (values[topic] !== undefined) {
                    filtered[topic] = values[topic];
                }
            });
            return filtered;
        }

        // If HIDE is defined, hide those topics
        if (hide && Array.isArray(hide) && hide.length > 0) {
            hide.forEach(topic => {
                delete filtered[topic];
            });
        }

        return filtered;
    }

    /**
     * Format value based on key
     */
    formatValue(key, value) {
        if (typeof value === 'number') {
            if (key === 'latitude' || key === 'longitude') {
                return value.toFixed(6);
            }
            return value.toFixed(2);
        }
        return value;
    }

    /**
     * Format value with optional unit suffix
     */
    formatValueWithUnit(key, value, units) {
        const formattedValue = this.formatValue(key, value);
        if (units && units[key]) {
            return `${formattedValue}${units[key]}`;
        }
        return formattedValue;
    }
}

// Global instance
window.dashboardRenderer = new DashboardRenderer();
