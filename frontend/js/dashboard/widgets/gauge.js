/**
 * Dashboard-Widget: GAUGE (Tacho/Arc/Bar)
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 * editor(w, {ed, idx}) liefert die typ-spezifischen Property-Felder.
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'GAUGE',
        label: 'Gauge',
        render: (w, ctx) => ctx.r.renderGaugeWidget(w, ctx.size),
        icon: () => '🎯',
        name: (w, ed) => {
            const s = window.dashWidgets._findEditorSensor
                ? window.dashWidgets._findEditorSensor(ed, w) : null;
            if (s) return s.name;
            return w.sensor ? w.sensor.split('/').pop() : 'Gauge';
        },
        dsl: (w, o) => {
            let line = `GAUGE ${w.sensor || 'bilge/thermo'}`;
            if (w.min != null && w.min !== 0) line += ` MIN ${w.min}`;
            if (w.max != null && w.max !== 100) line += ` MAX ${w.max}`;
            if (w.unit) line += ` UNIT "${w.unit}"`;
            if (w.label) line += ` LABEL "${w.label}"`;
            if (o.withSize && w.size > 1) line += ` SIZE ${w.size}`;
            // STYLE immer emittieren wenn gesetzt → round-trip-sicher unabhängig
            // vom Parser-Default (die zwei Alt-Serialisierer waren hier uneins).
            if (w.style) line += ` STYLE ${w.style}`;
            if (w.color && w.color !== 'cyan') line += ` COLOR ${w.color}`;
            if (w.decimals != null && w.decimals !== 1) line += ` DECIMALS ${w.decimals}`;
            return line;
        },
        editor: (w, ctx) => `
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Sensor / Feld</label>
                    <select onchange="window.dashboardEditor.updateWidget(${ctx.idx},'sensor',this.value);window.dashboardEditor.updateWidget(${ctx.idx},'field',null);" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        <option value="">— Sensor / Feld wählen —</option>
                        ${(ctx.ed.sensors||[]).map(s => `<option value="${s.full_path}" ${w.sensor===s.full_path?'selected':''}>${s.name||s.full_path}</option>`).join('')}
                    </select>
                </div>
                <!-- Label / Alias -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Label</label>
                    <input type="text" value="${w.label || ''}"
                           onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'label', this.value)"
                           placeholder="${w.sensor?.split('/').pop() || 'Label'}"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>
                <!-- Gauge Style -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Gauge-Stil</label>
                    <select onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'style', this.value)" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        <option value="arc180" ${w.style === 'arc180' ? 'selected' : ''}>Halbkreis (180°)</option>
                        <option value="arc270" ${w.style === 'arc270' ? 'selected' : ''}>Dreiviertel (270°)</option>
                        <option value="arc360" ${w.style === 'arc360' ? 'selected' : ''}>Vollkreis (360°)</option>
                        <option value="bar" ${w.style === 'bar' ? 'selected' : ''}>Balken</option>
                    </select>
                </div>
                <!-- Min/Max Values -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <div>
                        <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Min</label>
                        <input type="number" value="${w.min || 0}"
                               onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'min', parseFloat(this.value))"
                               style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                    </div>
                    <div>
                        <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Max</label>
                        <input type="number" value="${w.max || 100}"
                               onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'max', parseFloat(this.value))"
                               style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                    </div>
                </div>
                <!-- Unit -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Einheit</label>
                    <input type="text" value="${w.unit || ''}"
                           onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'unit', this.value)"
                           placeholder="z.B. °C, %, kn"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>
                <!-- Decimals -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Dezimalstellen</label>
                    <select onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'decimals', parseInt(this.value))" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        ${[0,1,2,3].map(n => `<option value="${n}" ${(w.decimals || 1) === n ? 'selected' : ''}>${n}</option>`).join('')}
                    </select>
                </div>
        `,
    });
})();
