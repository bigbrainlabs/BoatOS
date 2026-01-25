/**
 * Dashboard Renderer
 * Renders dashboard from parsed DSL layout
 */

class DashboardRenderer {
    constructor() {
        this.sensors = {};
        this.layout = null;
        this.updateInterval = null;
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

            // Render
            this.render();

            // Start auto-update
            this.startAutoUpdate();
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
     * Start auto-update interval
     */
    startAutoUpdate() {
        // Clear existing interval
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }

        // Update every 2 seconds
        this.updateInterval = setInterval(async () => {
            await this.updateSensors();
            this.render();
        }, 2000);
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
            <div style="text-align: center; padding: 40px; color: var(--text-dim);">
                <div style="font-size: 48px; margin-bottom: 15px;">⚠️</div>
                <div style="font-size: 16px; color: var(--text); margin-bottom: 10px;">
                    Dashboard konnte nicht geladen werden
                </div>
                <div style="font-size: 13px; margin-bottom: 20px;">
                    Bitte prüfe die Verbindung zum Backend
                </div>
                <button onclick="window.dashboardRenderer.loadAndRender()" style="
                    padding: 12px 24px;
                    background: var(--accent);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 14px;
                    cursor: pointer;
                ">🔄 Erneut versuchen</button>
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
            gap: 20px;
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
     * Render sensor widget
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

        // Hero style
        if (style === 'hero') {
            return `
                <div style="
                    grid-column: span ${size};
                    background: linear-gradient(135deg, rgba(30, 60, 114, 0.8), rgba(42, 82, 152, 0.8));
                    backdrop-filter: blur(15px);
                    border: 1px solid ${border};
                    border-radius: 24px;
                    padding: 35px;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                ">
                    <div style="display: flex; align-items: start; justify-content: space-between; margin-bottom: 25px;">
                        <div style="
                            background: linear-gradient(135deg, ${bg}, ${bg});
                            padding: 18px;
                            border-radius: 20px;
                            font-size: 24px;
                            font-weight: 700;
                            color: ${textColor};
                            font-family: monospace;
                            min-width: 70px;
                            text-align: center;
                        ">${icon}</div>
                        <div style="
                            background: ${statusColors[sensor.status]};
                            color: white;
                            padding: 6px 14px;
                            border-radius: 20px;
                            font-size: 11px;
                            font-weight: 600;
                            text-transform: uppercase;
                        ">${sensor.status}</div>
                    </div>
                    <div style="font-size: 22px; color: white; font-weight: 600; margin-bottom: 15px;">
                        ${name}
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        ${Object.entries(filteredValues).map(([key, value]) => `
                            <div style="
                                background: rgba(10, 14, 39, 0.5);
                                padding: 12px;
                                border-radius: 10px;
                                border: 1px solid ${border};
                            ">
                                <div style="color: #8892b0; font-size: 11px; text-transform: uppercase; margin-bottom: 5px;">
                                    ${key}
                                </div>
                                <div style="color: ${textColor}; font-size: 18px; font-weight: 700; font-family: monospace;">
                                    ${this.formatValueWithUnit(key, value, widget.units)}
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
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                ">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                        <span style="font-size: 20px;">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-size: 13px; color: white; font-weight: 600;">${name}</div>
                            <div style="font-size: 10px; color: #8892b0; text-transform: uppercase;">${sensor.type}</div>
                        </div>
                        <div style="
                            width: 8px;
                            height: 8px;
                            border-radius: 50%;
                            background: ${statusColors[sensor.status]};
                        "></div>
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                        ${Object.entries(filteredValues).map(([key, value]) => `
                            <div style="
                                background: rgba(10, 14, 39, 0.5);
                                padding: 6px 10px;
                                border-radius: 8px;
                                border: 1px solid ${border};
                                flex: 1;
                                min-width: 80px;
                            ">
                                <div style="color: #8892b0; font-size: 9px; text-transform: uppercase; margin-bottom: 2px;">
                                    ${key}
                                </div>
                                <div style="color: ${textColor}; font-size: 13px; font-weight: 700; font-family: monospace;">
                                    ${this.formatValueWithUnit(key, value, widget.units)}
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
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                position: relative;
            ">
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
                ">${sensor.status}</div>

                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
                    <span style="font-size: 36px;">${icon}</span>
                    <div>
                        <div style="font-size: 19px; font-weight: 600; color: white;">${name}</div>
                        <div style="font-size: 11px; color: #8892b0; text-transform: uppercase;">${sensor.type}</div>
                    </div>
                </div>

                <div style="
                    background: rgba(10, 14, 39, 0.5);
                    border-radius: 10px;
                    padding: 14px;
                    border: 1px solid ${border};
                ">
                    ${Object.entries(filteredValues).map(([key, value], index) => `
                        <div style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 8px 0;
                            ${index < Object.keys(filteredValues).length - 1 ? 'border-bottom: 1px solid rgba(255,255,255,0.08);' : ''}
                        ">
                            <span style="color: #8892b0; font-size: 12px; font-weight: 500;">${key}</span>
                            <span style="color: ${textColor}; font-size: 14px; font-weight: 700; font-family: monospace;">
                                ${this.formatValueWithUnit(key, value, widget.units)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render gauge widget with SVG-based analog gauge
     * Supports styles: arc180, arc270, arc360, bar
     */
    renderGaugeWidget(widget, size) {
        // Get value using smart path lookup
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
     * Render linear bar gauge
     */
    renderBarGauge(widget, size, value, min, max, unit, percentage, color, label, decimals) {
        return `
            <div style="
                grid-column: span ${size};
                background: linear-gradient(135deg, rgba(30, 60, 114, 0.6), rgba(42, 82, 152, 0.6));
                backdrop-filter: blur(15px);
                border: 2px solid rgba(100, 255, 218, 0.3);
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                text-align: center;
            ">
                ${label ? `<div style="font-size: 12px; color: #8892b0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px;">${label}</div>` : ''}
                <div style="font-size: 36px; font-weight: 700; color: ${color}; font-family: monospace; margin-bottom: 10px;">
                    ${value.toFixed(decimals)}
                    <span style="font-size: 16px; color: #8892b0;">${unit}</span>
                </div>
                <div style="
                    width: 100%;
                    height: 12px;
                    background: rgba(10, 14, 39, 0.5);
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 10px;
                ">
                    <div style="
                        width: ${percentage}%;
                        height: 100%;
                        background: ${color};
                        transition: width 0.3s ease;
                        border-radius: 6px;
                    "></div>
                </div>
                <div style="display: flex; justify-content: space-between; color: #8892b0; font-size: 11px;">
                    <span>${min}</span>
                    <span>${max} ${unit}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render arc gauge with SVG needle
     * @param {string} style - arc180, arc270, or arc360
     */
    renderArcGauge(widget, size, value, min, max, unit, percentage, color, label, decimals, style) {
        const svgSize = 200;
        const cx = svgSize / 2;
        const cy = svgSize / 2;
        const radius = 80;
        const strokeWidth = 12;

        // Arc configuration based on style
        let startAngle, endAngle, needleOffset;
        switch (style) {
            case 'arc360':
                startAngle = -90;
                endAngle = 270;
                needleOffset = 0;
                break;
            case 'arc270':
                startAngle = -225;
                endAngle = 45;
                needleOffset = 0;
                break;
            case 'arc180':
            default:
                startAngle = -180;
                endAngle = 0;
                needleOffset = 20; // Move center down for 180° gauge
                break;
        }

        const totalAngle = endAngle - startAngle;
        const needleAngle = startAngle + (percentage / 100) * totalAngle;

        // SVG arc path calculation
        const arcPath = this.describeArc(cx, cy + needleOffset, radius, startAngle, endAngle);
        const valueArcPath = this.describeArc(cx, cy + needleOffset, radius, startAngle, startAngle + (percentage / 100) * totalAngle);

        // Needle coordinates
        const needleLength = radius - 15;
        const needleRad = (needleAngle * Math.PI) / 180;
        const needleX = cx + needleLength * Math.cos(needleRad);
        const needleY = (cy + needleOffset) + needleLength * Math.sin(needleRad);

        // Tick marks
        const ticks = this.generateTicks(min, max, startAngle, totalAngle, cx, cy + needleOffset, radius + 8, 5);

        return `
            <div style="
                grid-column: span ${size};
                background: linear-gradient(135deg, rgba(30, 60, 114, 0.6), rgba(42, 82, 152, 0.6));
                backdrop-filter: blur(15px);
                border: 2px solid rgba(100, 255, 218, 0.3);
                border-radius: 16px;
                padding: 20px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                text-align: center;
            ">
                ${label ? `<div style="font-size: 11px; color: #8892b0; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 5px;">${label}</div>` : ''}
                <svg width="${svgSize}" height="${style === 'arc180' ? svgSize * 0.6 : svgSize}" viewBox="0 0 ${svgSize} ${style === 'arc180' ? svgSize * 0.65 : svgSize}" style="display: block; margin: 0 auto;">
                    <!-- Background arc -->
                    <path d="${arcPath}" fill="none" stroke="rgba(100, 255, 218, 0.15)" stroke-width="${strokeWidth}" stroke-linecap="round"/>

                    <!-- Value arc -->
                    <path d="${valueArcPath}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" style="transition: all 0.3s ease;"/>

                    <!-- Tick marks -->
                    ${ticks}

                    <!-- Center circle -->
                    <circle cx="${cx}" cy="${cy + needleOffset}" r="8" fill="rgba(30, 60, 114, 0.9)" stroke="${color}" stroke-width="2"/>

                    <!-- Needle -->
                    <line x1="${cx}" y1="${cy + needleOffset}" x2="${needleX}" y2="${needleY}"
                          stroke="${color}" stroke-width="3" stroke-linecap="round"
                          style="transition: all 0.3s ease; transform-origin: ${cx}px ${cy + needleOffset}px;"/>

                    <!-- Center dot -->
                    <circle cx="${cx}" cy="${cy + needleOffset}" r="4" fill="${color}"/>
                </svg>

                <div style="font-size: 32px; font-weight: 700; color: ${color}; font-family: monospace; margin-top: ${style === 'arc180' ? '-15px' : '10px'};">
                    ${value.toFixed(decimals)}
                    <span style="font-size: 14px; color: #8892b0;">${unit}</span>
                </div>

                <div style="display: flex; justify-content: space-between; color: #8892b0; font-size: 10px; margin-top: 5px; padding: 0 10px;">
                    <span>${min}</span>
                    <span>${max}</span>
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
     * Generate tick marks for gauge
     */
    generateTicks(min, max, startAngle, totalAngle, cx, cy, radius, count) {
        let ticks = '';
        for (let i = 0; i <= count; i++) {
            const angle = startAngle + (i / count) * totalAngle;
            const rad = (angle * Math.PI) / 180;
            const innerRadius = radius - 8;
            const outerRadius = radius;

            const x1 = cx + innerRadius * Math.cos(rad);
            const y1 = cy + innerRadius * Math.sin(rad);
            const x2 = cx + outerRadius * Math.cos(rad);
            const y2 = cy + outerRadius * Math.sin(rad);

            ticks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgba(100, 255, 218, 0.4)" stroke-width="1.5"/>`;
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
                border-radius: 16px;
                padding: 24px;
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                text-align: center;
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 200px;
            ">
                <div>
                    <div style="font-size: 48px; margin-bottom: 10px;">📊</div>
                    <div style="color: white; font-size: 16px;">Chart: ${widget.sensor}</div>
                    <div style="color: #8892b0; font-size: 12px; margin-top: 5px;">
                        Type: ${widget.chart_type} | Period: ${widget.period}min
                    </div>
                    <div style="color: #f39c12; font-size: 11px; margin-top: 10px;">
                        ⚠️ Charts coming in Phase 2
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
            title: { fontSize: '28px', fontWeight: '700' },
            subtitle: { fontSize: '20px', fontWeight: '600' },
            normal: { fontSize: '16px', fontWeight: '500' }
        };
        const textStyle = styleMap[style] || styleMap.normal;

        return `
            <div style="
                grid-column: span ${size};
                padding: 20px;
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
                border-radius: 16px;
                padding: 24px;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 10px;">❓</div>
                <div style="color: #e74c3c; font-size: 16px; font-weight: 600;">
                    Sensor nicht gefunden
                </div>
                <div style="color: #8892b0; font-size: 12px; margin-top: 5px;">
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
