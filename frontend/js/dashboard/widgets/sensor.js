/**
 * Dashboard-Widget: SENSOR (Sensor-Karte mit Werten)
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 * editor(w, {ed, idx}) liefert die typ-spezifischen Property-Felder.
 */
(function () {
    'use strict';

    // Editor-Sensor-Lookup (base_name oder full_path) — geteilt mit GAUGE.
    function findSensor(ed, w) {
        return (ed && ed.sensors || []).find(s =>
            s.base_name === w.sensor || s.full_path === w.sensor);
    }

    window.dashWidgets.register({
        type: 'SENSOR',
        label: 'Sensor',
        render: (w, ctx) => ctx.r.renderSensorWidget(w, ctx.size),
        icon: (w, ed) => { const s = findSensor(ed, w); return s ? s.icon : '📊'; },
        name: (w, ed) => {
            const s = findSensor(ed, w);
            if (s) return s.name;
            return w.sensor ? w.sensor.split('/').pop() : 'Sensor';
        },
        dsl: (w, o) => {
            let line = `SENSOR ${w.sensor || 'bilge/thermo'}`;
            if (w.alias) line += ` ALIAS "${w.alias}"`;
            const showFields = (w.fields && w.fields.length) ? w.fields
                : ((w.show && w.show.length) ? w.show : null);
            if (showFields) line += ` SHOW "${showFields.join(',')}"`;
            const fa = (w.fieldAliases && Object.keys(w.fieldAliases).length)
                ? Object.entries(w.fieldAliases).map(([k, v]) => `${k}:${v}`).join(',') : null;
            if (fa) line += ` FIELDALIAS "${fa}"`;
            if (o.withSize && w.size > 1) line += ` SIZE ${w.size}`;
            if (w.style && w.style !== 'card') line += ` STYLE ${w.style}`;
            if (w.color && w.color !== 'cyan') line += ` COLOR ${w.color}`;
            return line;
        },
        editor: (w, ctx) => `
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Sensor</label>
                    <select onchange="window.dashboardEditor.updateWidgetSensor(${ctx.idx}, 'sensor', 'fields', this.value)" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        <option value="">— Sensor wählen —</option>
                        ${(ctx.ed.sensorGroups || []).map(s => `<option value="${s.base_name}" ${w.sensor === s.base_name ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                ${ctx.ed._renderSensorFieldCheckboxes(ctx.idx, w)}
                <!-- Alias -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.5px;">Anzeigename (Titel)</label>
                    <input type="text" value="${w.alias || ''}"
                           onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'alias', this.value)"
                           placeholder="${ctx.ed.getWidgetName(w)}"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>
                <!-- Sensor Style -->
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Style</label>
                    <select onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'style', this.value)" style="
                        width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                        <option value="card" ${w.style === 'card' ? 'selected' : ''}>Card</option>
                        <option value="minimal" ${w.style === 'minimal' ? 'selected' : ''}>Minimal</option>
                        <option value="compact" ${w.style === 'compact' ? 'selected' : ''}>Compact</option>
                        <option value="hero" ${w.style === 'hero' ? 'selected' : ''}>Hero</option>
                    </select>
                </div>
        `,
    });

    // Für GAUGE (gleicher Namens-Lookup) exponieren.
    window.dashWidgets._findEditorSensor = findSensor;
})();
