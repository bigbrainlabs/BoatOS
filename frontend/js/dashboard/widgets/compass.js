/**
 * Dashboard-Widget: COMPASS → Navigations-Master-Instrument (Motorboot)
 * Runde Kompassrose (North-up) + COG-Zeiger + großer SOG-Mittelwert + Eck-Boxen.
 * render() brückt auf die Renderer-Implementierung (ctx.r.renderCompassInstrument).
 * Segel/Wind/Polar erst v2/v3.
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'COMPASS',
        label: 'Navi-Instrument',
        render: (w, ctx) => ctx.r.renderCompassInstrument(w, ctx.size),
        icon: () => '🧭',
        name: () => 'Navi-Instrument',
        dsl: (w, o) => 'COMPASS' + (o.withSize && w.size > 1 ? ` SIZE ${w.size}` : ''),
    });
})();
