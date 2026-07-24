/**
 * Dashboard-Widget: HORIZON (künstlicher Horizont, Canvas)
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 * editor(w, {ed, idx}) liefert die typ-spezifischen Property-Felder.
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'HORIZON',
        label: 'Horizont',
        render: (w, ctx) => ctx.r.renderHorizonWidget(w, ctx.size),
        icon: () => '🌅',
        name: () => 'Horizont',
        dsl: (w, o) => {
            const parts = ['HORIZON'];
            if (w.rollSensor)  parts.push(`rollSensor=${w.rollSensor}`, `rollField=${w.rollField || 'schlagseite'}`);
            if (w.pitchSensor) parts.push(`pitchSensor=${w.pitchSensor}`, `pitchField=${w.pitchField || 'neigung'}`);
            if (w.impactSensor) parts.push(`impactSensor=${w.impactSensor}`, `impactField=${w.impactField || 'aktiv'}`);
            if (!w.rollSensor && !w.pitchSensor) parts.push(w.sensor || 'boot/sensoren/lage');
            let line = parts.join(' ');
            if (o.withSize && w.size > 1) line += ` SIZE ${w.size}`;
            return line;
        },
        editor: (w, ctx) => `
                ${ctx.ed._renderSensorFieldDropdowns(ctx.idx, w, 'rollSensor', 'rollField', 'Roll')}
                ${ctx.ed._renderSensorFieldDropdowns(ctx.idx, w, 'pitchSensor', 'pitchField', 'Pitch')}
                <!-- Impact Alert toggle -->
                <div style="border-top: 1px solid var(--border); padding-top: 12px; margin-top: 4px;">
                    <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                        <input type="checkbox" ${w.impactSensor ? 'checked' : ''}
                            onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'impactSensor', this.checked ? '' : null); window.dashboardEditor.updateWidget(${ctx.idx}, 'impactField', this.checked ? 'aktiv' : null);"
                            style="width:16px;height:16px;accent-color:var(--accent);cursor:pointer;">
                        <span style="font-size: 13px; color: var(--text); font-weight: 600;">Impact-Alarm</span>
                        <span style="font-size: 11px; color: var(--text-dim);">Horizont blinkt rot bei Erschütterung</span>
                    </label>
                    ${w.impactSensor != null ? `
                    <div style="margin-top: 10px;">
                        ${ctx.ed._renderSensorFieldDropdowns(ctx.idx, w, 'impactSensor', 'impactField', 'Impact')}
                    </div>
                    ` : ''}
                </div>
        `,
    });
})();
