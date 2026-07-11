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
        // Horizon smoothing: keyed by container id → { dispRoll, dispPitch, tgtRoll, tgtPitch, lastTs }
        this._horizonState = {};
        this._horizonRafId = null;
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
                position: relative;
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
            .dash-pager { display: flex; flex-direction: column; height: 100%; }
            .dash-track { flex: 1; display: flex; min-height: 0; transition: transform 300ms ease; }
            .dash-page { min-width: 100%; flex-shrink: 0; overflow: hidden; padding: 12px; box-sizing: border-box; height: 100%; }
            .dash-dots { display: flex; justify-content: center; align-items: center; gap: 8px; padding: 10px 0 6px; flex-shrink: 0; }
            .dash-dot { width: 8px; height: 8px; border-radius: 4px; background: rgba(80,100,140,0.5); cursor: pointer; transition: all 200ms ease; flex-shrink: 0; }
            .dash-dot.active { width: 20px; background: #4FC3F7; }
            .horizon-impact-flash {
                position: absolute; inset: 0;
                border-radius: var(--radius-xl);
                border: 3px solid transparent;
                pointer-events: none;
                z-index: 10;
            }
            @keyframes horizon-impact-blink {
                0%, 100% { border-color: transparent; box-shadow: none; }
                50% { border-color: rgba(255,50,50,0.85); box-shadow: 0 0 14px rgba(255,50,50,0.35) inset; }
            }
            .horizon-impact-active .horizon-impact-flash {
                animation: horizon-impact-blink 0.5s ease-in-out infinite;
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
    async loadAndRender(retryCount = 0) {
        const MAX_RETRIES = 4;
        const RETRY_DELAYS = [3000, 5000, 8000, 12000];
        try {
            const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';

            // Load layout DSL
            const layoutResponse = await fetch(`${apiUrl}/api/dashboard/layout`);
            if (!layoutResponse.ok) throw new Error(`HTTP ${layoutResponse.status}`);
            const layoutData = await layoutResponse.json();
            const dslText = layoutData.layout;

            // Parse DSL
            const parseResponse = await fetch(`${apiUrl}/api/dashboard/parse`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ layout: dslText })
            });
            if (!parseResponse.ok) throw new Error(`HTTP ${parseResponse.status}`);
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
            if (retryCount < MAX_RETRIES) {
                const delay = RETRY_DELAYS[retryCount];
                console.log(`Dashboard retry ${retryCount + 1}/${MAX_RETRIES} in ${delay / 1000}s…`);
                this.renderRetrying(retryCount + 1, MAX_RETRIES);
                setTimeout(() => this.loadAndRender(retryCount + 1), delay);
            } else {
                this.renderError();
            }
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

        // Update clock widgets
        document.querySelectorAll('[data-clock="true"]').forEach(el => {
            const now = new Date();
            const timeEl = el.querySelector('.clock-time');
            const dateEl = el.querySelector('.clock-date');
            if (timeEl) timeEl.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            if (dateEl) dateEl.textContent = now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
        });

        // Update navigation instruments (COMPASS) — SOG/COG live neu zeichnen
        this._maybeFetchNavPoint();
        this._drawNavInstruments();

        // Update horizon widgets — only set targets; RAF loop does the drawing
        document.querySelectorAll('[data-horizon-roll-path]').forEach(container => {
            const rollPath   = container.dataset.horizonRollPath;
            const pitchPath  = container.dataset.horizonPitchPath;
            const impactPath = container.dataset.horizonImpactPath || '';
            const roll  = parseFloat(this.getSensorValue(rollPath))  || 0;
            const pitch = parseFloat(this.getSensorValue(pitchPath)) || 0;

            if (!container.id) container.id = 'hz-' + Math.random().toString(36).slice(2);
            const id = container.id;
            if (!this._horizonState[id]) {
                // First time: initialise display values to target so there's no initial sweep
                this._horizonState[id] = { dispRoll: roll, dispPitch: pitch, tgtRoll: roll, tgtPitch: pitch, lastTs: null };
                this._startHorizonRaf();
            } else {
                this._horizonState[id].tgtRoll  = roll;
                this._horizonState[id].tgtPitch = pitch;
            }

            let impactActive = false;
            if (impactPath) {
                const impactRaw = String(this.getSensorValue(impactPath) ?? '').toLowerCase().trim();
                impactActive = impactRaw !== '' && impactRaw !== '0' && impactRaw !== 'false' && impactRaw !== 'null';
            }
            container.classList.toggle('horizon-impact-active', impactActive);
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

    /** Start the horizon RAF loop (idempotent). */
    _startHorizonRaf() {
        if (this._horizonRafId) return;
        const loop = (ts) => {
            this._horizonRafId = requestAnimationFrame(loop);
            this._horizonRafTick(ts);
        };
        this._horizonRafId = requestAnimationFrame(loop);
    }

    /** Called every frame — lerps display values toward targets and redraws. */
    _horizonRafTick(ts) {
        const speed = 4.0; // same as Flutter — reaches ~98% of target per second
        for (const [id, st] of Object.entries(this._horizonState)) {
            if (st.lastTs === null) { st.lastTs = ts; continue; }
            const dt = Math.min((ts - st.lastTs) / 1000, 0.1); // seconds, capped
            st.lastTs = ts;
            const t = 1 - Math.exp(-speed * dt);
            st.dispRoll  += (st.tgtRoll  - st.dispRoll)  * t;
            st.dispPitch += (st.tgtPitch - st.dispPitch) * t;

            const container = document.getElementById(id);
            if (!container) { delete this._horizonState[id]; continue; }

            const cv = container.querySelector('canvas');
            if (cv) {
                const par = cv.parentElement;
                const dim = Math.max(10,
                    cv.offsetWidth ||
                    (par ? Math.min(par.clientWidth, par.clientHeight) : 0) || 200
                );
                if (cv.width !== dim || cv.height !== dim) { cv.width = dim; cv.height = dim; }
                this.drawHorizonCanvas(cv, st.dispRoll, st.dispPitch);
            }
            const fmt = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '°';
            const rollEl  = container.querySelector('[data-horizon-roll]');
            const pitchEl = container.querySelector('[data-horizon-pitch]');
            if (rollEl)  rollEl.textContent = fmt(st.dispRoll);
            if (pitchEl) pitchEl.textContent = fmt(st.dispPitch);
        }
    }

    renderRetrying(attempt, max) {
        const container = document.getElementById('sensor-dashboard');
        if (!container) return;
        container.innerHTML = `
            <div style="text-align:center;padding:var(--space-4xl);color:var(--text-dim);">
                <div style="font-size:var(--fs-5xl);margin-bottom:var(--space-lg);">⏳</div>
                <div style="font-size:var(--fs-xl);color:var(--text);margin-bottom:var(--space-md);">
                    Verbinde mit Backend…
                </div>
                <div style="font-size:var(--fs-md);">Versuch ${attempt} von ${max}</div>
            </div>`;
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
     * Render dashboard from parsed layout — with automatic paging when content overflows
     */
    render() {
        const container = document.getElementById('sensor-dashboard');
        if (!container) {
            console.warn('Dashboard container not found');
            return;
        }
        this.widgetCounter = 0;

        if (this.layout && this.layout.format === 'screen') {
            // Pure CSS height: avoids JS measurement quirks across headless/Cog/browsers.
            container.style.cssText = [
                'height: calc(100vh - var(--topbar-h))',
                'overflow: hidden',
                'padding: 0',
                'box-sizing: border-box',
                'width: 100%',
            ].join('; ');

            const screens = this.layout.screens || [];
            if (screens.length === 0) {
                container.innerHTML = '';
            } else if (screens.length === 1) {
                container.innerHTML = this._renderScreen(screens[0]);
                this._fixGridAreas(container);
            } else {
                container.innerHTML = this._renderScreenPager(screens);
                this._fixGridAreas(container);
                this._setupPager(container);
            }
        } else {
            // Old scrollable format — restore normal flow layout
            container.style.cssText = '';

            const pages = this._buildPages();
            if (pages.length <= 1) {
                container.innerHTML = this.renderToHTML();
            } else {
                container.innerHTML = this._renderPager(pages);
                this._setupPager(container);
            }
        }
        // Canvas widgets need a full layout frame before their parent sizes resolve.
        requestAnimationFrame(() => { this._initHorizonCanvases(); this._drawNavInstruments(); });
    }

    /**
     * Render a single screen using CSS grid-template-areas
     */
    _renderScreen(screen) {
        const tmpl = screen.template || {};
        // CSS grid-template-areas values must be quoted strings — but the outer HTML
        // attribute also uses double quotes, which would break parsing. We build the
        // grid div via DOM to set gridTemplateAreas programmatically after inserting
        // the slot HTML, avoiding any escaping issues.
        const slots = tmpl.slots || Object.keys(screen.widgets || {});

        // Build slot HTML first (uses double-quote attributes, no areas conflict)
        let slotsHtml = '';
        for (const slot of slots) {
            const widget = (screen.widgets || {})[slot];
            if (!widget) {
                slotsHtml += `<div data-slot="${slot}" style="grid-area:${slot};"></div>`;
                continue;
            }
            const widgetHtml = this._renderWidgetFull(widget);
            slotsHtml += `<div data-slot="${slot}" style="grid-area:${slot};overflow:hidden;min-height:0;min-width:0;">${widgetHtml}</div>`;
        }

        // Wrap in a grid container — use a placeholder so we can set gridTemplateAreas via JS
        // after innerHTML injection. We encode the areas as a data attribute (no quotes needed).
        const areasEncoded = encodeURIComponent(
            (tmpl.areas || '').split('\n').map(r => `"${r.trim()}"`).join(' ')
        );
        return `<div
            data-grid-areas="${areasEncoded}"
            style="display:grid;grid-template-columns:${tmpl.cols||'1fr'};grid-template-rows:${tmpl.rows||'1fr'};gap:12px;width:100%;height:100%;padding:12px;box-sizing:border-box;"
        >${slotsHtml}</div>`;
    }

    /**
     * After _renderScreen HTML is injected into DOM, resolve data-grid-areas attributes
     * to actual CSS gridTemplateAreas values (avoids HTML double-quote escaping issue).
     */
    _fixGridAreas(root) {
        root.querySelectorAll('[data-grid-areas]').forEach(el => {
            el.style.gridTemplateAreas = decodeURIComponent(el.dataset.gridAreas);
            delete el.dataset.gridAreas;
        });
    }

    /**
     * Render a widget for use inside a screen slot (no grid-column span needed)
     */
    _renderWidgetFull(widget) {
        // slot determines size, not the widget → size 1, slot:true
        return window.dashWidgets.render(widget, { r: this, size: 1, slot: true });
    }

    /**
     * Render multiple screens as a swipeable pager
     */
    _renderScreenPager(screens) {
        let html = '<div class="dash-pager" style="height:100%;"><div class="dash-track">';
        screens.forEach((screen, i) => {
            html += `<div class="dash-page" data-page="${i}" style="width:100%;height:100%;flex-shrink:0;overflow:hidden;padding:0;">${this._renderScreen(screen)}</div>`;
        });
        html += '</div><div class="dash-dots">';
        screens.forEach((screen, i) => {
            html += `<span class="dash-dot${i === 0 ? ' active' : ''}" data-page="${i}" title="${screen.name || ''}"></span>`;
        });
        return html + '</div></div>';
    }

    // ─── Paging helpers ────────────────────────────────────────────────────────

    _buildPages() {
        const kRowH = 160, kGap = 16;
        const pageH = Math.max(400, (window.innerHeight || 800) - 120);
        const gridCols = this.layout.grid || 3;

        // Flatten DSL rows → visual lines (same split logic as Helm)
        const visualLines = [];
        for (const row of this.layout.rows) {
            const rh = row.height || 1;
            const lineH = rh * kRowH;
            let cur = [], used = 0;
            for (const w of row.widgets) {
                const span = Math.min(w.size || 1, gridCols);
                if (used + span > gridCols && cur.length > 0) {
                    visualLines.push({ widgets: [...cur], lineHeight: lineH, rowHeight: rh });
                    cur = [w]; used = span;
                } else { cur.push(w); used += span; }
            }
            if (cur.length > 0) visualLines.push({ widgets: cur, lineHeight: lineH, rowHeight: rh });
        }

        // Group into pages
        const pages = [];
        let curPage = [], usedH = 0;
        for (const line of visualLines) {
            const next = curPage.length === 0 ? line.lineHeight : usedH + kGap + line.lineHeight;
            if (next > pageH && curPage.length > 0) {
                pages.push(curPage);
                curPage = [line]; usedH = line.lineHeight;
            } else { curPage.push(line); usedH = next; }
        }
        if (curPage.length > 0) pages.push(curPage);
        return pages;
    }

    _renderPageGrid(lines, gridColumns) {
        let html = `<div class="dashboard-grid" style="display:grid;grid-template-columns:repeat(${gridColumns},1fr);grid-auto-rows:160px;gap:var(--space-2xl);max-width:1400px;margin:0 auto;">`;
        for (const line of lines) {
            for (const widget of line.widgets) {
                html += this.renderWidget(widget, gridColumns, line.rowHeight);
            }
        }
        return html + '</div>';
    }

    _renderPager(pages) {
        const gridCols = this.layout.grid || 3;
        let html = '<div class="dash-pager"><div class="dash-track">';
        pages.forEach((lines, p) => {
            html += `<div class="dash-page" data-page="${p}">${this._renderPageGrid(lines, gridCols)}</div>`;
        });
        html += '</div><div class="dash-dots">';
        pages.forEach((_, p) => {
            html += `<span class="dash-dot${p === 0 ? ' active' : ''}" data-page="${p}"></span>`;
        });
        return html + '</div></div>';
    }

    _setupPager(container) {
        const track = container.querySelector('.dash-track');
        const allDots = container.querySelectorAll('.dash-dot');
        const pageCount = allDots.length;
        let cur = 0;
        const goTo = (p) => {
            cur = Math.max(0, Math.min(p, pageCount - 1));
            track.style.transform = `translateX(-${cur * 100}%)`;
            allDots.forEach((d, i) => d.classList.toggle('active', i === cur));
        };
        allDots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));
        let touchX = 0;
        track.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
        track.addEventListener('touchend', e => {
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50) goTo(cur + (dx < 0 ? 1 : -1));
        });
    }

    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Render dashboard to HTML string (for preview mode / editor use)
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
            grid-auto-rows: 160px;
            gap: var(--space-2xl);
            max-width: 1400px;
            margin: 0 auto;
        ">`;

        // Render each row
        this.layout.rows.forEach(row => {
            const rowHeight = row.height || 1;
            row.widgets.forEach(widget => {
                html += this.renderWidget(widget, gridColumns, rowHeight);
            });
        });

        html += '</div>';

        return html;
    }

    /**
     * Render a single widget
     */
    renderWidget(widget, gridColumns, rowHeight = 1) {
        const size = widget.size || 1;
        const rh = rowHeight || 1;

        let html = window.dashWidgets.render(widget, { r: this, size });
        if (rh > 1 && html) {
            html = html.replace(/grid-column: span \d+/, `$&; grid-row: span ${rh}`);
        }
        return html || '';
    }

    /**
     * Render sensor widget with data attributes for partial updates
     */
    renderSensorWidget(widget, size) {
        // Support new widget.sensor (base) + widget.field contract.
        // If widget.field is set, use it as specificValue directly.
        let sensor = this.sensors[widget.sensor];
        let specificValue = widget.field || null;

        if (!sensor) {
            // Backward-compat: try to find by base path (old full-path in widget.sensor)
            const parts = widget.sensor.split('/');
            for (let i = parts.length - 1; i >= 1; i--) {
                const baseName = parts.slice(0, i).join('/');
                if (this.sensors[baseName]) {
                    sensor = this.sensors[baseName];
                    if (!specificValue) specificValue = parts.slice(i).join('/');
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

        // Per-field alias helper
        const fieldLabel = key => (widget.fieldAliases && widget.fieldAliases[key]) || key;

        // Hero style
        if (style === 'hero') {
            return `
                <div style="
                    grid-column: span ${size};
                    height: 100%;
                    background: linear-gradient(135deg, rgba(30, 60, 114, 0.8), rgba(42, 82, 152, 0.8));
                    backdrop-filter: blur(15px);
                    border: 1px solid ${border};
                    border-radius: var(--radius-2xl);
                    padding: var(--space-4xl);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    box-sizing: border-box;
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
                                    ${fieldLabel(key)}
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
                    height: 100%;
                    background: ${bg};
                    border: 1px solid ${border};
                    border-radius: var(--radius-lg);
                    padding: var(--space-xl);
                    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                    box-sizing: border-box;
                ">
                    <div style="display: flex; align-items: center; gap: var(--space-base); margin-bottom: var(--space-sm);">
                        <span style="font-size: var(--fs-3xl);">${icon}</span>
                        <div style="flex: 1;">
                            <div style="font-size: var(--fs-md); color: white; font-weight: 600;">${name}</div>
                            ${sensor.type && sensor.type !== 'unknown' ? `<div style="font-size: var(--fs-xs); color: #8892b0; text-transform: uppercase;">${sensor.type}</div>` : ''}
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
                                    ${fieldLabel(key)}
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
                height: 100%;
                background: ${bg};
                backdrop-filter: blur(15px);
                border: 2px solid ${border};
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                box-shadow: 0 4px 16px rgba(0,0,0,0.2);
                position: relative;
                box-sizing: border-box;
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
                        ${sensor.type && sensor.type !== 'unknown' ? `<div style="font-size: var(--fs-sm); color: #8892b0; text-transform: uppercase;">${sensor.type}</div>` : ''}
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
                            <span style="color: #8892b0; font-size: var(--fs-base); font-weight: 500;">${fieldLabel(key)}</span>
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
     * Resolve the full sensor path for gauge/sensor widgets using widget.sensor + widget.field.
     * Supports:
     *   - New contract: widget.sensor = base_name, widget.field = field key → "base/field"
     *   - Backward-compat: widget.sensor = full path (no widget.field) → return as-is after
     *     verifying the base is known; if field still empty, pick first available key.
     */
    _resolveGaugeSensorPath(widget) {
        if (widget.field) {
            return `${widget.sensor}/${widget.field}`;
        }
        // New-style base_name but no field yet — use first available key
        const group = this.sensors[widget.sensor];
        if (group) {
            const keys = Object.keys(group.values || {});
            if (keys.length > 0) return `${widget.sensor}/${keys[0]}`;
        }
        // Backward-compat: widget.sensor may be a full path like "boot/motor/drehzahl"
        // The getSensorValue() method already handles split-path lookup, so return as-is.
        return widget.sensor;
    }

    /**
     * Render gauge widget with data attributes for smooth updates
     */
    renderGaugeWidget(widget, size) {
        const sensorPath = this._resolveGaugeSensorPath(widget);
        const value = this.getSensorValue(sensorPath);
        const numValue = parseFloat(value) || 0;

        const min = widget.min || 0;
        const max = widget.max || 100;
        const unit = widget.unit || '';
        const color = widget.color || 'cyan';
        const style = widget.style || 'arc180';
        const label = widget.label || widget.field || widget.sensor?.split('/').pop() || '';
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
            return this.renderBarGauge(widget, sensorPath, size, numValue, min, max, unit, percentage, textColor, label, decimals);
        } else {
            return this.renderArcGauge(widget, sensorPath, size, numValue, min, max, unit, percentage, textColor, label, decimals, style);
        }
    }

    /**
     * Render linear bar gauge with glass instrument look
     */
    renderBarGauge(widget, sensorPath, size, value, min, max, unit, percentage, color, label, decimals) {
        const gaugeId = this.generateId('gauge');

        return `
            <div id="${gaugeId}" class="gauge-bar-widget" data-gauge-path="${sensorPath}" data-min="${min}" data-max="${max}"
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
    renderArcGauge(widget, sensorPath, size, value, min, max, unit, percentage, color, label, decimals, style) {
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
            <div id="${gaugeId}" class="gauge-widget" data-gauge-path="${sensorPath}" data-min="${min}" data-max="${max}"
                 data-style="${style}" data-decimals="${decimals}" data-unit="${unit}"
                 data-start-angle="${startAngle}" data-total-angle="${totalAngle}"
                 data-gcx="${gcx}" data-gcy="${gcy}" data-radius="${radius}"
                 style="--gauge-span: ${size}; grid-column: span ${size}; height: 100%;">
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
     * Render spacer widget (invisible grid filler)
     */
    renderSpacerWidget(widget, size) {
        return `<div style="grid-column: span ${size};"></div>`;
    }

    /**
     * Render clock widget showing current time and date
     */
    renderClockWidget(widget, size) {
        const clockId = this.generateId('clock');
        const color = widget.color || 'cyan';
        const textColorMap = {
            cyan: '#64ffda', blue: '#3498db', orange: '#e67e22',
            green: '#2ecc71', purple: '#9b59b6', red: '#e74c3c', yellow: '#f1c40f'
        };
        const textColor = textColorMap[color] || textColorMap.cyan;

        const now = new Date();
        const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = now.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });

        return `
            <div id="${clockId}" class="clock-widget" data-clock="true" style="
                grid-column: span ${size};
                background: radial-gradient(ellipse at 30% 20%, rgba(40, 80, 140, 0.7), rgba(15, 25, 50, 0.85));
                border: 2px solid rgba(100, 180, 255, 0.2);
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
                text-align: center;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                gap: var(--space-sm);
                height: 100%;
            ">
                <div class="clock-time" style="
                    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
                    font-size: clamp(26px, 2.5vw, 44px);
                    font-weight: 700;
                    color: ${textColor};
                    letter-spacing: 3px;
                    text-shadow: 0 0 15px ${textColor}88;
                ">${timeStr}</div>
                <div class="clock-date" style="
                    font-size: var(--fs-base);
                    color: rgba(180, 200, 230, 0.65);
                    letter-spacing: 1px;
                ">${dateStr}</div>
            </div>
        `;
    }

    /**
     * Resolve roll/pitch/impact paths from per-widget fields.
     * Supports new contract (rollSensor/rollField etc.) with old-style fallback (sensor).
     */
    _resolveHorizonPaths(widget) {
        const fallbackBase = widget.sensor || 'boot/sensoren/lage';
        const rollSensor  = widget.rollSensor  || fallbackBase;
        const rollField   = widget.rollField   || 'schlagseite';
        const pitchSensor = widget.pitchSensor || fallbackBase;
        const pitchField  = widget.pitchField  || 'neigung';
        const impactSensor = widget.impactSensor || '';
        const impactField  = widget.impactField  || 'aktiv';
        return {
            rollPath:   `${rollSensor}/${rollField}`,
            pitchPath:  `${pitchSensor}/${pitchField}`,
            impactPath: impactSensor ? `${impactSensor}/${impactField}` : '',
        };
    }

    /**
     * Render artificial horizon widget (Canvas-based)
     */
    renderHorizonWidget(widget, size) {
        const horizonId = this.generateId('horizon');
        const { rollPath, pitchPath, impactPath } = this._resolveHorizonPaths(widget);
        const roll  = parseFloat(this.getSensorValue(rollPath))  || 0;
        const pitch = parseFloat(this.getSensorValue(pitchPath)) || 0;
        const fmt   = v => (v >= 0 ? '+' : '') + v.toFixed(1) + '°';

        return `
            <div data-horizon-roll-path="${rollPath}"
                 data-horizon-pitch-path="${pitchPath}"
                 data-horizon-impact-path="${impactPath}"
                 class="gauge-widget"
                 style="grid-column: span ${size}; height: 100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px 6px 6px;">
                <div class="horizon-impact-flash"></div>
                <div style="font-size:11px; color:#8B949E; margin-bottom:4px; flex-shrink:0; letter-spacing:.5px;">Lage</div>
                <div style="flex:1; min-height:0; width:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    <canvas id="${horizonId}" style="display:block; max-width:100%; max-height:100%; aspect-ratio:1/1;"></canvas>
                </div>
                <div style="display:flex; gap:14px; margin-top:5px; flex-shrink:0;">
                    <div style="text-align:center;">
                        <div data-horizon-roll style="font-family:monospace; font-size:12px; font-weight:700; color:#4FC3F7;">${fmt(roll)}</div>
                        <div style="font-size:9px; color:#6B7280;">Roll</div>
                    </div>
                    <div style="text-align:center;">
                        <div data-horizon-pitch style="font-family:monospace; font-size:12px; font-weight:700; color:#4FC3F7;">${fmt(pitch)}</div>
                        <div style="font-size:9px; color:#6B7280;">Pitch</div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Draw the artificial horizon on a canvas element
     */
    drawHorizonCanvas(canvas, roll, pitch) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width, h = canvas.height;
        const cx = w / 2, cy = h / 2;
        const r = Math.min(cx, cy) - 14;
        if (r < 10) return;

        ctx.clearRect(0, 0, w, h);

        const rollRad  = roll  * Math.PI / 180;
        const kDegPerR = 30;
        const pitchPx  = pitch * r / kDegPerR;
        const bigR     = r * 2.4;

        // ── 1. Clip to circle ─────────────────────────────────────────────────
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();

        // ── 2. Rotating sky/sea in roll+pitch frame ───────────────────────────
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rollRad);
        ctx.translate(0, pitchPx);

        // Sky
        const skyGrad = ctx.createLinearGradient(0, -bigR * 2, 0, 0);
        skyGrad.addColorStop(0, '#051220');
        skyGrad.addColorStop(1, '#1565C0');
        ctx.fillStyle = skyGrad;
        ctx.fillRect(-bigR, -bigR * 2, bigR * 2, bigR * 2);

        // Sea
        const seaGrad = ctx.createLinearGradient(0, 0, 0, bigR * 2);
        seaGrad.addColorStop(0, '#0C4F72');
        seaGrad.addColorStop(1, '#020B18');
        ctx.fillStyle = seaGrad;
        ctx.fillRect(-bigR, 0, bigR * 2, bigR * 2);

        // Pitch scale lines
        const pxPerDeg = r / kDegPerR;
        for (let deg = -60; deg <= 60; deg += 5) {
            if (deg === 0) continue;
            const y = -deg * pxPerDeg;
            const isMajor = deg % 10 === 0;
            const hl = isMajor ? r * 0.28 : r * 0.14;
            ctx.beginPath();
            ctx.moveTo(-hl, y); ctx.lineTo(hl, y);
            ctx.strokeStyle = `rgba(255,255,255,${isMajor ? 0.55 : 0.28})`;
            ctx.lineWidth   = isMajor ? 1.5 : 1.0;
            ctx.stroke();
            if (isMajor) {
                const label = String(Math.abs(deg));
                ctx.fillStyle = 'rgba(255,255,255,0.65)';
                ctx.font      = '9px monospace';
                ctx.textBaseline = 'middle';
                const tw = ctx.measureText(label).width;
                ctx.fillText(label, hl + 3, y);
                ctx.fillText(label, -hl - tw - 3, y);
            }
        }

        // Horizon glow
        ctx.beginPath(); ctx.moveTo(-bigR, 0); ctx.lineTo(bigR, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.18)';
        ctx.lineWidth   = 7;
        ctx.stroke();
        // Horizon line
        ctx.beginPath(); ctx.moveTo(-bigR, 0); ctx.lineTo(bigR, 0);
        ctx.strokeStyle = 'rgba(255,255,255,0.92)';
        ctx.lineWidth   = 1.8;
        ctx.stroke();

        // Roll indicator triangle (no pitch offset)
        ctx.translate(0, -pitchPx);
        const triY = -(r - 6);
        ctx.beginPath();
        ctx.moveTo(0, triY);
        ctx.lineTo(-5, triY + 10);
        ctx.lineTo(5,  triY + 10);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.4)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        ctx.restore(); // end roll+pitch
        ctx.restore(); // end clip

        // ── 3. Roll scale ticks (outside clip) ───────────────────────────────
        const scaleAngles = [-60,-45,-30,-20,-10,0,10,20,30,45,60];
        for (const deg of scaleAngles) {
            const rad     = (deg - 90) * Math.PI / 180;
            const isMajor = deg % 30 === 0 || deg === 0;
            const len     = isMajor ? 9 : 5.5;
            const inner   = r + 2, outer = inner + len;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
            ctx.lineTo(cx + Math.cos(rad) * outer, cy + Math.sin(rad) * outer);
            ctx.strokeStyle = `rgba(255,255,255,${isMajor ? 0.65 : 0.38})`;
            ctx.lineWidth   = isMajor ? 1.5 : 1;
            ctx.stroke();
        }
        // Fixed 0° marker triangle at top
        const topY = cy - r - 2;
        ctx.beginPath();
        ctx.moveTo(cx, topY + 12);
        ctx.lineTo(cx - 5, topY + 2);
        ctx.lineTo(cx + 5, topY + 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255,255,255,0.80)';
        ctx.fill();

        // ── 4. Bezel ring ─────────────────────────────────────────────────────
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#1E3A5F';
        ctx.lineWidth   = 2.5;
        ctx.stroke();

        // ── 5. Fixed boat silhouette (re-clip) ───────────────────────────────
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        ctx.clip();

        // Boat silhouette — front/cross-section view (subtle)
        const hw  = r * 0.44;            // half-width at gunwale
        const gY  = cy - r * 0.14;      // gunwale Y
        const kY  = cy + r * 0.22;      // keel Y
        const cHW = r * 0.15;           // cabin half-width
        const cT  = gY - r * 0.20;      // cabin top Y
        const mY  = cT - r * 0.16;      // mast top Y

        const drawBoatPath = (stroke, lw) => {
            ctx.strokeStyle = stroke; ctx.lineWidth = lw;
            ctx.lineCap = 'round'; ctx.lineJoin = 'round';
            // hull fill
            ctx.beginPath();
            ctx.moveTo(cx - hw,          gY);
            ctx.lineTo(cx - hw * 0.50,  kY);
            ctx.lineTo(cx,               kY + r * 0.06);
            ctx.lineTo(cx + hw * 0.50,  kY);
            ctx.lineTo(cx + hw,          gY);
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill();
            ctx.stroke();
            // deck line
            ctx.beginPath(); ctx.moveTo(cx - hw, gY); ctx.lineTo(cx + hw, gY); ctx.stroke();
            // cabin trapezoid
            ctx.beginPath();
            ctx.moveTo(cx - cHW * 1.4,  gY);
            ctx.lineTo(cx - cHW,         cT);
            ctx.lineTo(cx + cHW,         cT);
            ctx.lineTo(cx + cHW * 1.4,  gY);
            ctx.stroke();
            // mast
            ctx.beginPath(); ctx.moveTo(cx, cT); ctx.lineTo(cx, mY); ctx.stroke();
        };

        drawBoatPath('rgba(0,0,0,0.35)', 3.0);
        drawBoatPath('rgba(255,255,255,0.60)', 1.5);

        // Waterline marker
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.90)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'white'; ctx.fill();

        ctx.restore(); // end silhouette clip
    }

    /**
     * Initialize horizon canvases — must run after a layout frame so percentage-height chains
     * inside the grid have resolved. Measures the canvas's flex-parent, not the canvas itself,
     * because the canvas has no intrinsic size until we set its width/height attributes.
     */
    _initHorizonCanvases() {
        // Reset smoothing state so stale IDs from previous layout don't linger
        this._horizonState = {};
        document.querySelectorAll('[data-horizon-roll-path]').forEach(container => {
            const rollPath  = container.dataset.horizonRollPath;
            const pitchPath = container.dataset.horizonPitchPath;
            const roll  = parseFloat(this.getSensorValue(rollPath))  || 0;
            const pitch = parseFloat(this.getSensorValue(pitchPath)) || 0;
            const cv    = container.querySelector('canvas');
            if (!cv) return;
            const parent = cv.parentElement;
            const pw = parent ? parent.clientWidth  : 0;
            const ph = parent ? parent.clientHeight : 0;
            const dim = Math.max(10, Math.min(pw, ph) || cv.offsetWidth || cv.offsetHeight || 200);
            cv.width = dim; cv.height = dim;
            this.drawHorizonCanvas(cv, roll, pitch);
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COMPASS → Navigations-Master-Instrument (Motorboot)
    // Runde Rose (North-up) + COG-Zeiger + großer SOG-Mittelwert + 4 Eck-Boxen.
    // Segel/Wind/Polar erst v2/v3. Alles per Canvas (kohärente Optik).
    // ─────────────────────────────────────────────────────────────────────────

    /** HTML-Hülle für das Navi-Instrument (Canvas quadratisch, wie Horizont). */
    renderCompassInstrument(widget, size) {
        const navId = this.generateId('nav');
        return `
            <div class="gauge-widget" data-nav-instrument
                 style="grid-column: span ${size}; height:100%; min-height:220px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:8px;">
                <div style="flex:1; min-height:0; width:100%; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                    <canvas id="${navId}" style="display:block; max-width:100%; max-height:100%; aspect-ratio:1/1;"></canvas>
                </div>
            </div>
        `;
    }

    /** Live-Navigationsdaten für das Instrument einsammeln (fehlend → null). */
    _gatherNavData() {
        const c = (window.BoatOS && window.BoatOS.context) || {};
        const sogKn = (typeof c.sog === 'number') ? c.sog : null;
        const cog   = (typeof c.cog === 'number') ? ((c.cog % 360) + 360) % 360 : null;

        // Navi-Punktdaten (aus /api/nav/point, throttled): Fahrrinnentiefe
        // (pegel-korrigiert), nächster Pegel, Strömung.
        const np = c.navPoint || {};
        const dp = np.depth;
        const fairwayDepth = (dp && typeof dp.current_depth === 'number') ? dp.current_depth
            : (dp && typeof dp.depth === 'number' ? dp.depth : null);
        const pegelCm  = (np.gauge && typeof np.gauge.w_cm === 'number') ? np.gauge.w_cm : null;
        const pegelName = (np.gauge && np.gauge.name) ? np.gauge.name : null;
        const currentKmh = (typeof np.current_kmh === 'number') ? np.current_kmh : null;

        // Vorausschau (flachste Tiefe voraus) — Früh-Warnung
        const ah = np.ahead;
        const aheadDepth   = (ah && typeof ah.current_depth === 'number') ? ah.current_depth : null;
        const aheadDist    = (ah && typeof ah.distance_m === 'number') ? ah.distance_m : null;
        const aheadShallow = !!(ah && ah.shallow);

        // Route: Restweg (m) + Peilung (°) zum Ziel (von navigation.updateLiveETA)
        const nav = c.nav || {};
        const remainingM = (typeof nav.remainingM === 'number') ? nav.remainingM : null;
        const wpBearing  = (typeof nav.bearing === 'number' && !isNaN(nav.bearing)) ? nav.bearing : null;

        // Tiefenmesser (Echolot) — Hardware-Sensor, übliche Pfade durchprobieren.
        let sounder = null;
        for (const p of ['depth', 'tiefe', 'environment/depth/belowKeel',
                         'navigation/depth/belowKeel', 'boot/tiefe']) {
            const v = this.getSensorValue(p);
            const n = parseFloat(v);
            if (v != null && v !== '' && !isNaN(n)) { sounder = n; break; }
        }

        return { sogKn, cog, fairwayDepth, pegelCm, pegelName, currentKmh, sounder,
                 aheadDepth, aheadDist, aheadShallow, remainingM, wpBearing };
    }

    /** Navi-Punktdaten (Tiefe/Pegel/Strömung) holen (throttled, 8s / >~40m). */
    _maybeFetchNavPoint() {
        if (!document.querySelector('[data-nav-instrument]')) return;
        const c = (window.BoatOS && window.BoatOS.context) || {};
        const pos = c.currentPosition;
        if (!pos || typeof pos.lat !== 'number') return;
        const st = this._navPointState ||
            (this._navPointState = { t: 0, lat: null, lon: null, busy: false });
        if (st.busy) return;
        const now = Date.now();
        // Nie öfter als alle 5 s (schützt das Backend vor Dauer-Abfragen bei
        // schneller Simulation); ohne nennenswerte Bewegung nur alle 15 s.
        if (now - st.t < 5000) return;
        const moved = st.lat == null ||
            Math.abs(pos.lat - st.lat) > 0.0004 || Math.abs(pos.lon - st.lon) > 0.0004; // ~40 m
        if (!moved && now - st.t < 15000) return;
        st.t = now; st.lat = pos.lat; st.lon = pos.lon; st.busy = true;
        const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
        const cog = (typeof c.cog === 'number') ? `&cog=${c.cog}` : '';
        fetch(`${apiUrl}/api/nav/point?lat=${pos.lat}&lon=${pos.lon}${cog}`)
            .then(r => r.json())
            .then(d => { if (window.BoatOS && window.BoatOS.context) window.BoatOS.context.navPoint = d; })
            .catch(() => {})
            .finally(() => { st.busy = false; });
    }

    /** Zeichnet das Navi-Instrument in ein quadratisches Canvas. */
    drawCompassInstrument(cv) {
        const g = cv.getContext('2d');
        const s = cv.width;
        if (!s) return;
        const cx = s / 2, cy = s * 0.40;    // hochgeschoben (Platz fürs 2×2-Grid unten)
        const R = s * 0.30;                 // Rosen-Radius (Rand frei für Boxen)
        const { sogKn, cog, fairwayDepth, pegelCm, pegelName, currentKmh, sounder,
                aheadDepth, aheadDist, aheadShallow, remainingM, wpBearing } = this._gatherNavData();
        const A = deg => (deg - 90) * Math.PI / 180;   // 0° = oben (Norden)

        g.clearRect(0, 0, s, s);

        // Hintergrund-Scheibe
        g.beginPath(); g.arc(cx, cy, R * 1.04, 0, Math.PI * 2);
        const bg = g.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.1);
        bg.addColorStop(0, '#1a3350');
        bg.addColorStop(1, '#0a1526');
        g.fillStyle = bg; g.fill();
        g.lineWidth = Math.max(1, s * 0.006); g.strokeStyle = 'rgba(100,180,255,0.28)'; g.stroke();

        const rr = R;                        // Ring-Radius
        // Ticks
        for (let d = 0; d < 360; d += 5) {
            const major = d % 30 === 0;
            const len = major ? R * 0.12 : R * 0.06;
            const a = A(d);
            g.beginPath();
            g.moveTo(cx + (rr - len) * Math.cos(a), cy + (rr - len) * Math.sin(a));
            g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
            g.lineWidth = major ? Math.max(1.5, s * 0.008) : Math.max(0.75, s * 0.004);
            g.strokeStyle = major ? 'rgba(200,220,255,0.75)' : 'rgba(150,180,220,0.35)';
            g.stroke();
        }

        // Grad-/Kardinal-Beschriftung
        g.textAlign = 'center'; g.textBaseline = 'middle';
        const labelR = rr - R * 0.24;
        for (let d = 0; d < 360; d += 30) {
            const a = A(d);
            const x = cx + labelR * Math.cos(a), y = cy + labelR * Math.sin(a);
            const card = d % 90 === 0;
            let txt, col;
            if (d === 0) { txt = 'N'; col = '#ff5b52'; }
            else if (d === 90) { txt = 'E'; col = '#d4e6ff'; }
            else if (d === 180) { txt = 'S'; col = '#d4e6ff'; }
            else if (d === 270) { txt = 'W'; col = '#d4e6ff'; }
            else { txt = String(d).padStart(3, '0'); col = 'rgba(185,205,235,0.6)'; }
            g.font = `${card ? 700 : 400} ${Math.round(s * (card ? 0.058 : 0.038))}px system-ui, sans-serif`;
            g.fillStyle = col;
            g.fillText(txt, x, y);
        }

        // COG-Zeiger (Dreieck)
        if (cog != null) {
            const a = A(cog);
            g.save(); g.translate(cx, cy); g.rotate(a + Math.PI / 2);
            const tip = -(rr - R * 0.04), base = -(rr - R * 0.20), hw = R * 0.06;
            g.beginPath();
            g.moveTo(0, tip); g.lineTo(-hw, base); g.lineTo(hw, base); g.closePath();
            g.fillStyle = '#4FC3F7'; g.fill();
            g.restore();
        }

        // WP-Peilungs-Marker (Steuer-Hinweis zum Ziel) — Raute auf dem Ring
        if (wpBearing != null) {
            const a = A(wpBearing);
            const mr = rr - R * 0.02, d = R * 0.06;
            g.save(); g.translate(cx + mr * Math.cos(a), cy + mr * Math.sin(a)); g.rotate(a + Math.PI / 2);
            g.beginPath();
            g.moveTo(0, -d); g.lineTo(d * 0.7, 0); g.lineTo(0, d); g.lineTo(-d * 0.7, 0); g.closePath();
            g.fillStyle = '#c9a0ff'; g.fill();
            g.restore();
        }

        // Mittelwert SOG
        let numStr = '–', unitStr = 'SOG';
        if (sogKn != null && typeof window.convertSpeedFromKn === 'function') {
            numStr = window.convertSpeedFromKn(sogKn).toFixed(1);
            unitStr = (window.getSpeedLabel ? window.getSpeedLabel() : 'kn');
        } else if (sogKn != null) {
            numStr = sogKn.toFixed(1); unitStr = 'kn';
        }
        g.fillStyle = 'rgba(150,170,200,0.7)';
        g.font = `600 ${Math.round(s * 0.04)}px system-ui, sans-serif`;
        g.fillText('SOG', cx, cy - R * 0.36);
        g.fillStyle = '#eef4ff';
        g.font = `700 ${Math.round(s * 0.15)}px system-ui, sans-serif`;
        g.fillText(numStr, cx, cy);
        g.fillStyle = '#9fb2cc';
        g.font = `500 ${Math.round(s * 0.045)}px system-ui, sans-serif`;
        g.fillText(unitStr, cx, cy + R * 0.30);

        const fmtM = v => v.toFixed(1) + ' m';
        const fmtRest = m => (window.formatDistance ? window.formatDistance(m / 1852)
            : (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m'));

        // Tiefe-Rinne-Wert wird zur Früh-Warnung, wenn voraus zu flach:
        const rinne = aheadShallow
            ? { label: `⚠ flach in ${aheadDist} m`, val: (aheadDepth != null ? fmtM(aheadDepth) : '–'), col: '#ff6b6b' }
            : { label: 'Tiefe Rinne', val: (fairwayDepth != null ? fmtM(fairwayDepth) : '–'), col: '#5fd6e6' };

        // Stat-Helfer: kleines Label über größerem Wert
        const drawStat = (x, yLabel, yVal, align, label, val, col) => {
            g.textAlign = align;
            g.fillStyle = 'rgba(160,180,210,0.62)';
            g.font = `600 ${Math.round(s * 0.030)}px system-ui, sans-serif`;
            g.fillText(label, x, yLabel);
            g.fillStyle = col;
            g.font = `700 ${Math.round(s * 0.052)}px system-ui, sans-serif`;
            g.fillText(val, x, yVal);
        };

        // 2 obere Ecken (kurze Werte): COG · Pegel
        drawStat(s * 0.035, s * 0.05, s * 0.105, 'left',  'COG',   (cog != null ? Math.round(cog) + '°' : '–'), '#7fe0a0');
        drawStat(s * 0.965, s * 0.05, s * 0.105, 'right', (pegelName ? `Pegel (${pegelName})` : 'Pegel'), (pegelCm != null ? Math.round(pegelCm) + ' cm' : '–'), '#7fbfff');

        // Unten 2×2-Grid (unter der Rose): Tiefe/Echolot · Strömung/WP
        const colL = s * 0.27, colR = s * 0.73;
        drawStat(colL, s * 0.755, s * 0.815, 'center', rinne.label, rinne.val, rinne.col);
        drawStat(colR, s * 0.755, s * 0.815, 'center', 'Echolot',  (sounder != null ? fmtM(sounder) : '–'), '#9fd0ff');
        drawStat(colL, s * 0.885, s * 0.945, 'center', 'Strömung', (currentKmh != null ? currentKmh.toFixed(1) + ' km/h' : '–'), '#ffd479');
        drawStat(colR, s * 0.885, s * 0.945, 'center', (wpBearing != null ? `→ ${wpBearing}°` : '→ WP'), (remainingM != null ? fmtRest(remainingM) : '–'), '#c9a0ff');
        g.textAlign = 'center';
    }

    /** Alle Navi-Instrument-Canvases (neu) dimensionieren + zeichnen. */
    _drawNavInstruments() {
        document.querySelectorAll('[data-nav-instrument] canvas').forEach(cv => {
            const par = cv.parentElement;
            // Aus dem Eltern-Container skalieren (min aus Breite/Höhe = größtes
            // Quadrat, das reinpasst) — NICHT aus cv.offsetWidth, das bliebe auf
            // der Canvas-Default-Breite (300) hängen. Proportionen bleiben, weil
            // in drawCompassInstrument alles relativ zu s gerechnet wird.
            const pw = par ? par.clientWidth  : 0;
            const ph = par ? par.clientHeight : 0;
            const dim = Math.max(10, Math.min(pw, ph) || cv.offsetWidth || 220);
            if (cv.width !== dim || cv.height !== dim) { cv.width = dim; cv.height = dim; }
            this.drawCompassInstrument(cv);
        });
    }

    /**
     * Render unknown sensor widget
     */
    renderUnknownWidget(widget, size) {
        return `
            <div style="
                grid-column: span ${size};
                height: 100%;
                background: rgba(231, 76, 60, 0.1);
                border: 2px solid rgba(231, 76, 60, 0.3);
                border-radius: var(--radius-xl);
                padding: var(--space-3xl);
                text-align: center;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
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
