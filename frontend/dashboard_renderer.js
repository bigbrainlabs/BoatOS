/**
 * Dashboard Renderer
 * Renders dashboard from parsed DSL layout
 */

class DashboardRenderer {
    constructor() {
        this.sensors = {};
        this.layout = null;
    }

    /**
     * Load and render dashboard layout
     */
    async loadAndRender() {
        try {
            // Load layout DSL
            const layoutResponse = await fetch('/api/dashboard/layout');
            const layoutData = await layoutResponse.json();
            const dslText = layoutData.layout;

            // Parse DSL
            const parseResponse = await fetch('/api/dashboard/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dslText })
            });
            this.layout = await parseResponse.json();

            // Load current sensors
            const sensorsResponse = await fetch('/api/sensors/list');
            const sensorsData = await sensorsResponse.json();

            // Index sensors by base_name for quick lookup
            this.sensors = {};
            sensorsData.sensors.forEach(sensor => {
                this.sensors[sensor.base_name] = sensor;
            });

            // Render
            this.render();
        } catch (error) {
            console.error('Error loading dashboard:', error);
        }
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
        const sensor = this.sensors[widget.sensor];

        if (!sensor) {
            return this.renderUnknownWidget(widget, size);
        }

        const style = widget.style || 'card';
        const color = widget.color || 'cyan';
        const icon = widget.icon || sensor.icon;
        const name = widget.alias || sensor.name;

        // Filter topics based on SHOW/HIDE
        let filteredValues = this.filterTopics(sensor.values, widget.show, widget.hide);

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
     * Render gauge widget
     */
    renderGaugeWidget(widget, size) {
        const sensor = this.sensors[widget.sensor];
        const value = sensor ? Object.values(sensor.values)[0] : 0;
        const numValue = parseFloat(value) || 0;

        const min = widget.min || 0;
        const max = widget.max || 100;
        const unit = widget.unit || '';
        const color = widget.color || 'cyan';

        const percentage = ((numValue - min) / (max - min)) * 100;

        const textColorMap = {
            cyan: '#64ffda',
            blue: '#3498db',
            orange: '#e67e22',
            green: '#2ecc71',
            purple: '#9b59b6'
        };
        const textColor = textColorMap[color] || textColorMap.cyan;

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
                <div style="font-size: 48px; font-weight: 700; color: ${textColor}; font-family: monospace; margin-bottom: 10px;">
                    ${numValue.toFixed(1)}
                    <span style="font-size: 20px; color: #8892b0;">${unit}</span>
                </div>
                <div style="
                    width: 100%;
                    height: 10px;
                    background: rgba(10, 14, 39, 0.5);
                    border-radius: 5px;
                    overflow: hidden;
                    margin-bottom: 10px;
                ">
                    <div style="
                        width: ${Math.min(100, Math.max(0, percentage))}%;
                        height: 100%;
                        background: ${textColor};
                        transition: width 0.3s ease;
                    "></div>
                </div>
                <div style="display: flex; justify-content: space-between; color: #8892b0; font-size: 11px;">
                    <span>${min} ${unit}</span>
                    <span>${max} ${unit}</span>
                </div>
            </div>
        `;
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
