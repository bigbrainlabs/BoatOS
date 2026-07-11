/**
 * Dashboard-Widget: TEXT (statischer Text-Block)
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 * editor(w, {ed, idx}) liefert das typ-spezifische Property-Feld.
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'TEXT',
        label: 'Text',
        render: (w, ctx) => ctx.r.renderTextWidget(w, ctx.size),
        icon: () => '📝',
        name: (w) => w.text ? (w.text.substring(0, 20) + (w.text.length > 20 ? '...' : '')) : 'Text',
        dsl: (w, o) => {
            let line = `TEXT "${w.text || ''}"`;
            if (o.withSize && w.size > 1) line += ` SIZE ${w.size}`;
            if (w.style && w.style !== 'normal') line += ` STYLE ${w.style}`;
            if (w.color && w.color !== 'cyan') line += ` COLOR ${w.color}`;
            return line;
        },
        editor: (w, ctx) => `
                <div>
                    <label style="display: block; color: var(--text-dim); font-size: 11px; margin-bottom: 4px;">Text</label>
                    <input type="text" value="${w.text || ''}"
                           onchange="window.dashboardEditor.updateWidget(${ctx.idx}, 'text', this.value)"
                           style="width: 100%; padding: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text); font-size: 13px;">
                </div>
        `,
    });
})();
