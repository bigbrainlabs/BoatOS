/**
 * Dashboard Visual Editor
 * Drag & Drop interface for dashboard configuration
 */

class DashboardVisualEditor {
    constructor() {
        this.currentLayout = null;
        this.sensors = [];
        this.gridColumns = 3;
        this.widgets = [];
        this.rows = ['main']; // Available row names
        this.history = []; // Undo history
        this.historyIndex = -1; // Current position in history
        this.maxHistorySize = 50; // Maximum history entries
    }

    /**
     * Initialize visual editor
     */
    async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Visual editor container not found');
            return;
        }

        // Load current layout
        await this.loadLayout();

        // Load available sensors
        await this.loadSensors();

        // Render editor
        this.render();

        // Setup keyboard shortcuts for undo/redo
        this.setupKeyboardShortcuts();

        // Save initial state
        this.saveHistory();
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle if visual editor is visible
            const visualContainer = document.getElementById('visual-editor-container');
            if (!visualContainer || visualContainer.style.display === 'none') {
                return;
            }

            // Ctrl+Z or Cmd+Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y = Redo
            if (((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) ||
                ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
                e.preventDefault();
                this.redo();
            }
        });
    }

    /**
     * Save current state to history
     */
    saveHistory() {
        // Create deep copy of current state
        const state = {
            widgets: JSON.parse(JSON.stringify(this.widgets)),
            rows: [...this.rows],
            gridColumns: this.gridColumns
        };

        // Remove any history after current index (when making new change after undo)
        this.history = this.history.slice(0, this.historyIndex + 1);

        // Add new state
        this.history.push(state);

        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    /**
     * Undo last change
     */
    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
            console.log('↩️ Undo');
        } else {
            console.log('❌ Nothing to undo');
        }
    }

    /**
     * Redo last undone change
     */
    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
            console.log('↪️ Redo');
        } else {
            console.log('❌ Nothing to redo');
        }
    }

    /**
     * Restore state from history
     */
    restoreState(state) {
        this.widgets = JSON.parse(JSON.stringify(state.widgets));
        this.rows = [...state.rows];
        this.gridColumns = state.gridColumns;
        this.render();
    }

    /**
     * Load current dashboard layout
     */
    async loadLayout() {
        try {
            const response = await fetch('/api/dashboard/layout');
            const data = await response.json();
            const dslText = data.layout;

            await this.loadFromDSL(dslText);
        } catch (error) {
            console.error('Error loading layout:', error);
        }
    }

    /**
     * Load layout from DSL text (for Code → Visual sync)
     */
    async loadFromDSL(dslText) {
        try {
            // Parse DSL
            const parseResponse = await fetch('/api/dashboard/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dslText })
            });
            this.currentLayout = await parseResponse.json();
            this.gridColumns = this.currentLayout.grid || 3;

            // Extract widgets from rows and collect row names
            this.widgets = [];
            this.rows = [];
            this.currentLayout.rows.forEach(row => {
                // Add row name to rows list
                if (!this.rows.includes(row.name)) {
                    this.rows.push(row.name);
                }

                // Add widgets with row info
                row.widgets.forEach(widget => {
                    this.widgets.push({
                        ...widget,
                        rowName: row.name
                    });
                });
            });

            // Ensure 'main' is always available
            if (!this.rows.includes('main')) {
                this.rows.push('main');
            }

            // Re-render with new widgets
            this.render();
        } catch (error) {
            console.error('Error parsing DSL:', error);
            alert('❌ Fehler beim Parsen des DSL-Codes');
        }
    }

    /**
     * Load available sensors
     */
    async loadSensors() {
        try {
            const response = await fetch('/api/sensors/list');
            const data = await response.json();
            this.sensors = data.sensors;
        } catch (error) {
            console.error('Error loading sensors:', error);
        }
    }

    /**
     * Render visual editor
     */
    render() {
        this.container.innerHTML = `
            <div class="visual-editor" style="
                display: flex;
                gap: 20px;
                height: calc(100vh - 200px);
                background: rgba(10, 14, 39, 0.5);
                border-radius: 16px;
                padding: 20px;
            ">
                <!-- Widget Palette (Left) -->
                <div class="widget-palette" style="
                    width: 300px;
                    background: rgba(30, 60, 114, 0.6);
                    border-radius: 12px;
                    padding: 20px;
                    overflow-y: auto;
                ">
                    <h3 style="color: white; margin: 0 0 20px 0; font-size: 18px;">
                        📦 Widgets
                    </h3>
                    ${this.renderWidgetPalette()}
                </div>

                <!-- Canvas (Center) -->
                <div class="editor-canvas" style="
                    flex: 1;
                    background: rgba(10, 14, 39, 0.8);
                    border-radius: 12px;
                    padding: 20px;
                    overflow-y: auto;
                    position: relative;
                ">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                        <h3 style="color: white; margin: 0; font-size: 18px;">
                            🎨 Dashboard Canvas
                        </h3>
                        <div style="display: flex; gap: 10px;">
                            <button onclick="window.visualEditor.saveLayout()" style="
                                background: #2ecc71;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                            ">💾 Speichern</button>
                            <button onclick="window.visualEditor.preview()" style="
                                background: #3498db;
                                color: white;
                                border: none;
                                padding: 8px 16px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                            ">👁️ Vorschau</button>
                        </div>
                    </div>

                    <!-- Grid Settings -->
                    <div style="margin-bottom: 20px;">
                        <label style="color: #8892b0; font-size: 12px; margin-right: 10px;">
                            Grid Spalten:
                        </label>
                        <select id="grid-columns" onchange="window.visualEditor.updateGridColumns(this.value)" style="
                            background: rgba(30, 60, 114, 0.6);
                            color: white;
                            border: 1px solid rgba(100, 255, 218, 0.3);
                            padding: 6px 12px;
                            border-radius: 6px;
                        ">
                            <option value="1" ${this.gridColumns === 1 ? 'selected' : ''}>1</option>
                            <option value="2" ${this.gridColumns === 2 ? 'selected' : ''}>2</option>
                            <option value="3" ${this.gridColumns === 3 ? 'selected' : ''}>3</option>
                            <option value="4" ${this.gridColumns === 4 ? 'selected' : ''}>4</option>
                        </select>
                    </div>

                    <!-- Canvas Grid -->
                    <div id="canvas-grid" style="
                        display: grid;
                        grid-template-columns: repeat(${this.gridColumns}, 1fr);
                        gap: 16px;
                        min-height: 400px;
                        background: linear-gradient(90deg, rgba(100, 255, 218, 0.05) 1px, transparent 1px),
                                    linear-gradient(rgba(100, 255, 218, 0.05) 1px, transparent 1px);
                        background-size: ${100/this.gridColumns}% 100px;
                    ">
                        ${this.renderCanvasWidgets()}
                    </div>
                </div>

                <!-- Properties Panel (Right) -->
                <div class="properties-panel" style="
                    width: 300px;
                    background: rgba(30, 60, 114, 0.6);
                    border-radius: 12px;
                    padding: 20px;
                    overflow-y: auto;
                ">
                    <h3 style="color: white; margin: 0 0 20px 0; font-size: 18px;">
                        ⚙️ Eigenschaften
                    </h3>
                    <div id="properties-content" style="color: #8892b0; font-size: 14px;">
                        Wähle ein Widget zum Bearbeiten
                    </div>
                </div>
            </div>
        `;

        // Initialize drag & drop
        this.initDragDrop();
    }

    /**
     * Render widget palette
     */
    renderWidgetPalette() {
        return `
            <div style="color: #8892b0; font-size: 13px; margin-bottom: 16px;">
                Ziehe Widgets auf das Canvas
            </div>

            <!-- Sensor Widgets -->
            <div style="margin-bottom: 20px;">
                <div style="color: white; font-weight: 600; font-size: 14px; margin-bottom: 10px;">
                    🔌 Sensoren
                </div>
                ${this.sensors.map(sensor => `
                    <div class="palette-widget" data-type="sensor" data-sensor="${sensor.base_name}" style="
                        background: rgba(100, 255, 218, 0.1);
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 8px;
                        cursor: move;
                        transition: all 0.2s;
                    " onmouseover="this.style.background='rgba(100, 255, 218, 0.2)'"
                       onmouseout="this.style.background='rgba(100, 255, 218, 0.1)'">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 20px;">${sensor.icon}</span>
                            <div style="flex: 1;">
                                <div style="color: white; font-size: 13px; font-weight: 600;">${sensor.name}</div>
                                <div style="color: #8892b0; font-size: 11px;">${sensor.base_name}</div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>

            <!-- Other Widgets -->
            <div>
                <div style="color: white; font-weight: 600; font-size: 14px; margin-bottom: 10px;">
                    📊 Andere
                </div>
                <div class="palette-widget" data-type="text" style="
                    background: rgba(52, 152, 219, 0.1);
                    border: 1px solid rgba(52, 152, 219, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 8px;
                    cursor: move;
                ">
                    <div style="color: white; font-size: 13px;">📝 Text</div>
                </div>
                <div class="palette-widget" data-type="gauge" style="
                    background: rgba(230, 126, 34, 0.1);
                    border: 1px solid rgba(230, 126, 34, 0.3);
                    border-radius: 8px;
                    padding: 12px;
                    margin-bottom: 8px;
                    cursor: move;
                ">
                    <div style="color: white; font-size: 13px;">📊 Gauge</div>
                </div>
            </div>
        `;
    }

    /**
     * Render canvas widgets
     */
    renderCanvasWidgets() {
        if (this.widgets.length === 0) {
            return `
                <div style="
                    grid-column: 1 / -1;
                    text-align: center;
                    color: #8892b0;
                    padding: 60px 20px;
                    font-size: 16px;
                ">
                    👆 Ziehe Widgets aus der Palette hierher
                </div>
            `;
        }

        // Group widgets by row
        const widgetsByRow = {};
        this.widgets.forEach((widget, index) => {
            const rowName = widget.rowName || 'main';
            if (!widgetsByRow[rowName]) {
                widgetsByRow[rowName] = [];
            }
            widgetsByRow[rowName].push({ widget, index });
        });

        // Render each row with header
        let html = '';
        Object.entries(widgetsByRow).forEach(([rowName, items]) => {
            // Row header
            html += `
                <div class="row-header" data-row-name="${rowName}" style="
                    grid-column: 1 / -1;
                    color: #64ffda;
                    font-size: 13px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    padding: 8px 0;
                    margin-top: 16px;
                    border-bottom: 1px solid rgba(100, 255, 218, 0.2);
                ">
                    📍 ROW ${rowName}
                </div>
            `;

            // Widgets in this row
            items.forEach(({ widget, index }) => {
                html += this.renderCanvasWidget(widget, index);
            });
        });

        return html;
    }

    /**
     * Render single canvas widget
     */
    renderCanvasWidget(widget, index) {
        const size = widget.size || 1;
        const style = widget.style || 'card';
        const color = widget.color || 'cyan';

        const colorMap = {
            cyan: 'rgba(100, 255, 218, 0.2)',
            blue: 'rgba(52, 152, 219, 0.2)',
            orange: 'rgba(230, 126, 34, 0.2)',
            green: 'rgba(46, 204, 113, 0.2)',
            purple: 'rgba(155, 89, 182, 0.2)'
        };

        return `
            <div class="canvas-widget" data-index="${index}" style="
                grid-column: span ${size};
                background: ${colorMap[color]};
                border: 2px solid rgba(100, 255, 218, 0.3);
                border-radius: 12px;
                padding: 16px;
                cursor: move;
                position: relative;
                transition: all 0.2s ease;
            " onclick="window.visualEditor.selectWidget(${index})">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <div style="color: white; font-weight: 600; font-size: 14px;">
                        ${widget.type === 'sensor' ? (widget.alias || this.getSensorName(widget.sensor)) : widget.type.toUpperCase()}
                    </div>
                    <button onclick="event.stopPropagation(); window.visualEditor.deleteWidget(${index})" style="
                        background: rgba(231, 76, 60, 0.8);
                        color: white;
                        border: none;
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        cursor: pointer;
                        font-size: 18px;
                        line-height: 1;
                        touch-action: manipulation;
                        -webkit-tap-highlight-color: transparent;
                    ">×</button>
                </div>
                <div style="color: #8892b0; font-size: 11px; margin-bottom: 4px;">
                    Style: ${style} | Size: ${size}
                </div>
                ${widget.type === 'sensor' ? `
                    <div style="color: #8892b0; font-size: 10px;">
                        ${widget.sensor}
                    </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get sensor name by base_name
     */
    getSensorName(baseName) {
        const sensor = this.sensors.find(s => s.base_name === baseName);
        return sensor ? sensor.name : baseName;
    }

    /**
     * Initialize drag & drop
     */
    initDragDrop() {
        const canvasGrid = document.getElementById('canvas-grid');

        if (!canvasGrid || typeof Sortable === 'undefined') {
            console.error('Sortable not loaded or canvas not found');
            return;
        }

        // Make canvas sortable
        new Sortable(canvasGrid, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            draggable: '.canvas-widget', // Only widgets, not row headers
            filter: '.row-header', // Don't drag row headers
            preventOnFilter: false,
            touchStartThreshold: 5, // px before drag starts (prevents accidental drags)
            delay: 200, // 200ms delay for touch (distinguish between tap and drag)
            delayOnTouchOnly: true, // Only apply delay on touch devices
            forceFallback: false, // Use native HTML5 drag on desktop

            onEnd: (evt) => {
                // Get all canvas widgets in their new DOM order
                const allWidgets = Array.from(canvasGrid.querySelectorAll('.canvas-widget'));

                // Extract the data-index values to build new order
                const newOrder = allWidgets.map(el => parseInt(el.getAttribute('data-index')));

                // Detect which row each widget is now in
                allWidgets.forEach((widgetEl, domIndex) => {
                    const widgetIndex = parseInt(widgetEl.getAttribute('data-index'));

                    // Find the nearest row header before this widget
                    let currentRow = 'main';
                    let prevElement = widgetEl.previousElementSibling;
                    while (prevElement) {
                        if (prevElement.classList && prevElement.classList.contains('row-header')) {
                            currentRow = prevElement.getAttribute('data-row-name') || 'main';
                            break;
                        }
                        prevElement = prevElement.previousElementSibling;
                    }

                    // Update widget's rowName if it changed
                    if (this.widgets[widgetIndex]) {
                        this.widgets[widgetIndex].rowName = currentRow;
                    }
                });

                // Reorder widgets array based on new DOM order
                const reorderedWidgets = newOrder.map(index => this.widgets[index]);

                // Check if order actually changed
                const orderChanged = !newOrder.every((idx, i) => idx === i);

                if (orderChanged) {
                    this.widgets = reorderedWidgets;
                }

                // Always save and update (row might have changed even if order didn't)
                this.saveHistory();
                this.updateCanvas();
            }
        });

        // Make palette draggable to canvas
        const paletteItems = document.querySelectorAll('.palette-widget');
        paletteItems.forEach(item => {
            item.draggable = true;
            item.addEventListener('dragstart', (e) => {
                const type = item.getAttribute('data-type');
                const sensor = item.getAttribute('data-sensor');
                e.dataTransfer.setData('widget-type', type);
                e.dataTransfer.setData('source', 'palette'); // Mark as palette drag
                if (sensor) e.dataTransfer.setData('widget-sensor', sensor);
            });
        });

        canvasGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
        });

        canvasGrid.addEventListener('drop', (e) => {
            e.preventDefault();

            // Only handle drops from palette, not from sortable reordering
            const source = e.dataTransfer.getData('source');
            if (source !== 'palette') {
                return; // Ignore drops from canvas reordering
            }

            const type = e.dataTransfer.getData('widget-type');
            const sensor = e.dataTransfer.getData('widget-sensor');

            if (type) {
                this.addWidget(type, sensor);
            }
        });
    }

    /**
     * Add widget to canvas
     */
    addWidget(type, sensor) {
        const newWidget = {
            type: type,
            size: 1,
            style: 'card',
            color: 'cyan'
        };

        if (type === 'sensor') {
            newWidget.sensor = sensor;
        } else if (type === 'text') {
            newWidget.text = 'Text hier eingeben';
        } else if (type === 'gauge') {
            newWidget.sensor = sensor || 'boat/navigation/speedOverGround';
            newWidget.min = 0;
            newWidget.max = 100;
            newWidget.unit = '';
        }

        this.widgets.push(newWidget);
        this.saveHistory();
        this.updateCanvas();
    }

    /**
     * Delete widget
     */
    deleteWidget(index) {
        this.widgets.splice(index, 1);
        this.saveHistory();
        // Clear properties panel when deleting selected widget
        const propertiesContent = document.getElementById('properties-content');
        if (propertiesContent) {
            propertiesContent.innerHTML = '<div style="color: #8892b0;">Wähle ein Widget zum Bearbeiten</div>';
        }
        this.updateCanvas();
    }

    /**
     * Render sensor-specific properties
     */
    renderSensorProperties(widget, index) {
        // Find sensor data to get available topics
        const sensor = this.sensors.find(s => s.base_name === widget.sensor);
        const availableTopics = sensor ? Object.keys(sensor.values) : [];

        return `
            <!-- Alias -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 6px;">
                    Name (Optional)
                </label>
                <input type="text" value="${widget.alias || ''}" placeholder="Standard-Name verwenden"
                    onchange="window.visualEditor.updateWidgetProperty(${index}, 'alias', this.value)"
                    style="
                        width: 100%;
                        background: rgba(10, 14, 39, 0.8);
                        color: white;
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        padding: 8px;
                        border-radius: 6px;
                    ">
            </div>

            ${availableTopics.length > 0 ? `
                <!-- SHOW Topics -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 8px;">
                        🔍 Angezeigte Topics
                    </label>
                    <div style="
                        background: rgba(10, 14, 39, 0.8);
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        border-radius: 6px;
                        padding: 8px;
                        max-height: 150px;
                        overflow-y: auto;
                    ">
                        ${availableTopics.map(topic => {
                            const isShown = !widget.show || widget.show.includes(topic);
                            const isHidden = widget.hide && widget.hide.includes(topic);
                            const checked = isShown && !isHidden;
                            return `
                                <label style="display: flex; align-items: center; padding: 4px 0; cursor: pointer;">
                                    <input type="checkbox"
                                        ${checked ? 'checked' : ''}
                                        onchange="window.visualEditor.toggleTopic(${index}, '${topic}', this.checked)"
                                        style="margin-right: 8px; cursor: pointer;">
                                    <span style="color: white; font-size: 13px;">${topic}</span>
                                </label>
                            `;
                        }).join('')}
                    </div>
                    <div style="color: #8892b0; font-size: 11px; margin-top: 6px;">
                        💡 Wähle welche Topics angezeigt werden sollen
                    </div>
                </div>

                <!-- UNITS -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 8px;">
                        📏 Einheiten (Units)
                    </label>
                    <div style="
                        background: rgba(10, 14, 39, 0.8);
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        border-radius: 6px;
                        padding: 8px;
                        max-height: 200px;
                        overflow-y: auto;
                    ">
                        ${availableTopics.map(topic => {
                            const unit = widget.units && widget.units[topic] ? widget.units[topic] : '';
                            return `
                                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                                    <span style="color: #8892b0; font-size: 12px; min-width: 80px;">${topic}:</span>
                                    <input type="text"
                                        value="${unit}"
                                        placeholder="z.B. °C, %, V"
                                        onchange="window.visualEditor.updateUnit(${index}, '${topic}', this.value)"
                                        style="
                                            flex: 1;
                                            background: rgba(10, 14, 39, 0.6);
                                            color: white;
                                            border: 1px solid rgba(100, 255, 218, 0.2);
                                            padding: 6px;
                                            border-radius: 4px;
                                            font-size: 12px;
                                        ">
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div style="color: #8892b0; font-size: 11px; margin-top: 6px;">
                        💡 Füge Einheiten wie °C, %, kn, V hinzu
                    </div>
                </div>
            ` : ''}
        `;
    }

    /**
     * Select widget for editing
     */
    selectWidget(index) {
        const widget = this.widgets[index];
        const propertiesContent = document.getElementById('properties-content');

        propertiesContent.innerHTML = `
            <div style="color: white; font-weight: 600; margin-bottom: 16px;">
                ${widget.type.toUpperCase()} Widget
            </div>

            <!-- Row Selection -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 6px;">
                    📍 Reihe (Row)
                </label>
                <div style="display: flex; gap: 8px;">
                    <select onchange="window.visualEditor.updateWidgetProperty(${index}, 'rowName', this.value)"
                        style="
                            flex: 1;
                            background: rgba(10, 14, 39, 0.8);
                            color: white;
                            border: 1px solid rgba(100, 255, 218, 0.3);
                            padding: 8px;
                            border-radius: 6px;
                        ">
                        ${this.rows.map(row => `
                            <option value="${row}" ${(widget.rowName || 'main') === row ? 'selected' : ''}>${row}</option>
                        `).join('')}
                    </select>
                    <button onclick="window.visualEditor.promptNewRow(${index})" style="
                        background: rgba(100, 255, 218, 0.2);
                        color: #64ffda;
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        padding: 8px 12px;
                        border-radius: 6px;
                        cursor: pointer;
                        white-space: nowrap;
                    ">+ Neu</button>
                </div>
            </div>

            <!-- Size -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 6px;">
                    Breite (Grid Columns)
                </label>
                <input type="number" min="1" max="${this.gridColumns}" value="${widget.size || 1}"
                    onchange="window.visualEditor.updateWidgetProperty(${index}, 'size', parseInt(this.value))"
                    style="
                        width: 100%;
                        background: rgba(10, 14, 39, 0.8);
                        color: white;
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        padding: 8px;
                        border-radius: 6px;
                    ">
            </div>

            <!-- Style -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 6px;">
                    Stil
                </label>
                <select onchange="window.visualEditor.updateWidgetProperty(${index}, 'style', this.value)"
                    style="
                        width: 100%;
                        background: rgba(10, 14, 39, 0.8);
                        color: white;
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        padding: 8px;
                        border-radius: 6px;
                    ">
                    <option value="card" ${widget.style === 'card' ? 'selected' : ''}>Card</option>
                    <option value="hero" ${widget.style === 'hero' ? 'selected' : ''}>Hero</option>
                    <option value="compact" ${widget.style === 'compact' ? 'selected' : ''}>Compact</option>
                </select>
            </div>

            <!-- Color -->
            <div style="margin-bottom: 16px;">
                <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 6px;">
                    Farbe
                </label>
                <select onchange="window.visualEditor.updateWidgetProperty(${index}, 'color', this.value)"
                    style="
                        width: 100%;
                        background: rgba(10, 14, 39, 0.8);
                        color: white;
                        border: 1px solid rgba(100, 255, 218, 0.3);
                        padding: 8px;
                        border-radius: 6px;
                    ">
                    <option value="cyan" ${widget.color === 'cyan' ? 'selected' : ''}>Cyan</option>
                    <option value="blue" ${widget.color === 'blue' ? 'selected' : ''}>Blue</option>
                    <option value="orange" ${widget.color === 'orange' ? 'selected' : ''}>Orange</option>
                    <option value="green" ${widget.color === 'green' ? 'selected' : ''}>Green</option>
                    <option value="purple" ${widget.color === 'purple' ? 'selected' : ''}>Purple</option>
                </select>
            </div>

            ${widget.type === 'sensor' ? this.renderSensorProperties(widget, index) : ''}

            ${widget.type === 'text' ? `
                <!-- Text Content -->
                <div style="margin-bottom: 16px;">
                    <label style="display: block; color: #8892b0; font-size: 12px; margin-bottom: 6px;">
                        Text
                    </label>
                    <textarea onchange="window.visualEditor.updateWidgetProperty(${index}, 'text', this.value)"
                        style="
                            width: 100%;
                            height: 100px;
                            background: rgba(10, 14, 39, 0.8);
                            color: white;
                            border: 1px solid rgba(100, 255, 218, 0.3);
                            padding: 8px;
                            border-radius: 6px;
                            resize: vertical;
                        ">${widget.text || ''}</textarea>
                </div>
            ` : ''}
        `;
    }

    /**
     * Update widget property
     */
    updateWidgetProperty(index, property, value) {
        if (value === '') {
            delete this.widgets[index][property];
        } else {
            this.widgets[index][property] = value;
        }
        this.saveHistory();
        // Only update canvas, not properties panel (to keep focus)
        this.updateCanvas();
    }

    /**
     * Toggle topic visibility (SHOW/HIDE)
     */
    toggleTopic(index, topic, checked) {
        const widget = this.widgets[index];

        // Initialize arrays if needed
        if (!widget.show) widget.show = [];
        if (!widget.hide) widget.hide = [];

        if (checked) {
            // Show topic: add to show, remove from hide
            if (!widget.show.includes(topic)) {
                widget.show.push(topic);
            }
            widget.hide = widget.hide.filter(t => t !== topic);
        } else {
            // Hide topic: add to hide, remove from show
            if (!widget.hide.includes(topic)) {
                widget.hide.push(topic);
            }
            widget.show = widget.show.filter(t => t !== topic);
        }

        // Clean up empty arrays
        if (widget.show.length === 0) delete widget.show;
        if (widget.hide.length === 0) delete widget.hide;

        this.saveHistory();
        this.updateCanvas();
    }

    /**
     * Update unit for a topic
     */
    updateUnit(index, topic, value) {
        const widget = this.widgets[index];

        if (!widget.units) {
            widget.units = {};
        }

        if (value.trim() === '') {
            delete widget.units[topic];
            // Clean up empty units object
            if (Object.keys(widget.units).length === 0) {
                delete widget.units;
            }
        } else {
            widget.units[topic] = value.trim();
        }

        this.saveHistory();
        this.updateCanvas();
    }

    /**
     * Update only the canvas (without destroying properties panel)
     */
    updateCanvas() {
        const canvasGrid = document.getElementById('canvas-grid');
        if (canvasGrid) {
            canvasGrid.innerHTML = this.renderCanvasWidgets();
            // Re-initialize drag & drop for new widgets
            this.initDragDrop();
        }
    }

    /**
     * Prompt for new row name
     */
    promptNewRow(widgetIndex) {
        const rowName = prompt('Name der neuen Reihe (z.B. "hero", "sensors", "details"):');
        if (rowName && rowName.trim() !== '') {
            const cleanName = rowName.trim().replace(/\s+/g, '_');
            if (!this.rows.includes(cleanName)) {
                this.rows.push(cleanName);
            }
            this.widgets[widgetIndex].rowName = cleanName;
            this.saveHistory();
            // Re-render properties to update dropdown
            this.selectWidget(widgetIndex);
            this.updateCanvas();
        }
    }

    /**
     * Update grid columns
     */
    updateGridColumns(columns) {
        this.gridColumns = parseInt(columns);
        this.saveHistory();
        // Update canvas grid
        this.updateCanvas();
        // Also need to update the grid-template-columns style
        const canvasGrid = document.getElementById('canvas-grid');
        if (canvasGrid) {
            canvasGrid.style.gridTemplateColumns = `repeat(${this.gridColumns}, 1fr)`;
            canvasGrid.style.backgroundSize = `${100/this.gridColumns}% 100px`;
        }
    }

    /**
     * Convert widgets to DSL
     */
    toDSL() {
        let dsl = `GRID ${this.gridColumns}\n\n`;

        // Group widgets by row
        const widgetsByRow = {};
        this.widgets.forEach(widget => {
            const rowName = widget.rowName || 'main';
            if (!widgetsByRow[rowName]) {
                widgetsByRow[rowName] = [];
            }
            widgetsByRow[rowName].push(widget);
        });

        // Generate DSL for each row
        Object.entries(widgetsByRow).forEach(([rowName, rowWidgets]) => {
            dsl += `ROW ${rowName}\n`;

            rowWidgets.forEach(widget => {
                dsl += `  ${widget.type.toUpperCase()} `;

                if (widget.type === 'sensor') {
                    dsl += widget.sensor;
                } else if (widget.type === 'text') {
                    dsl += `"${widget.text || 'Text'}"`;
                } else if (widget.type === 'gauge') {
                    dsl += widget.sensor;
                }

                if (widget.size && widget.size !== 1) dsl += ` SIZE ${widget.size}`;
                if (widget.style && widget.style !== 'card') dsl += ` STYLE ${widget.style}`;
                if (widget.color && widget.color !== 'cyan') dsl += ` COLOR ${widget.color}`;
                if (widget.alias) dsl += ` ALIAS "${widget.alias}"`;
                if (widget.icon) dsl += ` ICON ${widget.icon}`;
                if (widget.show && widget.show.length > 0) dsl += ` SHOW ${widget.show.join(',')}`;
                if (widget.hide && widget.hide.length > 0) dsl += ` HIDE ${widget.hide.join(',')}`;
                if (widget.units) {
                    const unitsStr = Object.entries(widget.units).map(([k, v]) => `${k}:${v}`).join(',');
                    dsl += ` UNITS "${unitsStr}"`;
                }

                dsl += '\n';
            });

            dsl += '\n';
        });

        return dsl;
    }

    /**
     * Save layout
     */
    async saveLayout() {
        const dsl = this.toDSL();

        try {
            const response = await fetch('/api/dashboard/layout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dsl })
            });

            if (response.ok) {
                alert('✅ Dashboard gespeichert!');
                // Reload dashboard
                if (window.dashboardRenderer) {
                    await window.dashboardRenderer.loadAndRender();
                }
            } else {
                alert('❌ Fehler beim Speichern');
            }
        } catch (error) {
            console.error('Save error:', error);
            alert('❌ Fehler beim Speichern');
        }
    }

    /**
     * Preview dashboard
     */
    async preview() {
        const dsl = this.toDSL();

        // Parse DSL
        try {
            const parseResponse = await fetch('/api/dashboard/parse', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dsl })
            });
            const parsed = await parseResponse.json();

            if (parsed.errors && parsed.errors.length > 0) {
                alert('❌ Fehler:\n' + parsed.errors.join('\n'));
                return;
            }

            // Show preview in modal
            const modal = document.createElement('div');
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.9);
                z-index: 10000;
                display: flex;
                flex-direction: column;
                padding: 20px;
            `;

            modal.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h2 style="color: white; margin: 0;">👁️ Vorschau</h2>
                    <button onclick="this.closest('.preview-modal').remove()" style="
                        background: #e74c3c;
                        color: white;
                        border: none;
                        padding: 10px 20px;
                        border-radius: 8px;
                        cursor: pointer;
                        font-weight: 600;
                    ">Schließen</button>
                </div>
                <div id="preview-container" style="flex: 1; overflow-y: auto; background: linear-gradient(135deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%); border-radius: 16px; padding: 20px;"></div>
            `;
            modal.className = 'preview-modal';

            document.body.appendChild(modal);

            // Render preview
            const tempRenderer = new DashboardRenderer();
            tempRenderer.layout = parsed;
            tempRenderer.sensors = this.sensors.reduce((acc, sensor) => {
                acc[sensor.base_name] = sensor;
                return acc;
            }, {});

            const previewContainer = document.getElementById('preview-container');
            previewContainer.innerHTML = tempRenderer.renderToHTML();

        } catch (error) {
            console.error('Preview error:', error);
            alert('❌ Fehler bei Vorschau');
        }
    }
}

// Global instance
window.DashboardVisualEditor = DashboardVisualEditor;
window.visualEditor = null;
