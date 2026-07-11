/**
 * Dashboard-Widget: COMPASS (aktuell Platzhalter-Icon)
 * Die Markup unterscheidet sich zwischen Screen-Slot (ctx.slot, ohne Grid-Span)
 * und Grid-Reihe (mit grid-column span) — 1:1 wie zuvor in den beiden Switches.
 * Wird später zum echten Kreis-Instrument ausgebaut.
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'COMPASS',
        label: 'Kompass',
        render: (w, ctx) => ctx.slot
            ? `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:var(--fs-4xl);">🧭</div>`
            : `<div style="grid-column: span ${ctx.size}; display:flex; align-items:center; justify-content:center; color:var(--text-dim); font-size:var(--fs-4xl); padding:var(--space-3xl);">🧭</div>`,
        icon: () => '🧭',
        name: () => 'Kompass',
        dsl: (w, o) => 'COMPASS' + (o.withSize && w.size > 1 ? ` SIZE ${w.size}` : ''),
    });
})();
