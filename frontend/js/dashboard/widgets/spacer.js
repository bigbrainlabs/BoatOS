/**
 * Dashboard-Widget: SPACER (unsichtbarer Grid-Füller)
 * Registriert sich bei window.dashWidgets (registry.js muss vorher laden).
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'SPACER',
        label: 'Spacer',
        render: (w, ctx) => ctx.r.renderSpacerWidget(w, ctx.size),
        icon: () => '⬜',
        name: () => 'Spacer',
        dsl: (w, o) => 'SPACER' + (o.withSize && w.size > 1 ? ` SIZE ${w.size}` : ''),
    });
})();
