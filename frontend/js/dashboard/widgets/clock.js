/**
 * Dashboard-Widget: CLOCK (Uhrzeit + Datum)
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'CLOCK',
        label: 'Uhr',
        render: (w, ctx) => ctx.r.renderClockWidget(w, ctx.size),
        icon: () => '🕐',
        name: () => 'Uhr',
        dsl: (w, o) => 'CLOCK' + (o.withSize && w.size > 1 ? ` SIZE ${w.size}` : ''),
    });
})();
