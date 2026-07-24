/**
 * Dashboard-Widget: CHART (Zeitreihen-Diagramm)
 * render() brückt auf die bestehende Renderer-Implementierung (ctx.r).
 */
(function () {
    'use strict';
    window.dashWidgets.register({
        type: 'CHART',
        label: 'Chart',
        render: (w, ctx) => ctx.r.renderChartWidget(w, ctx.size),
        icon: () => '📈',
        name: (w) => (w.sensor ? w.sensor.split('/').pop() : 'Chart'),
        dsl: (w, o) => {
            let line = `CHART ${w.sensor || ''}`.trim();
            if (w.chart_type && w.chart_type !== 'line') line += ` TYPE ${w.chart_type}`;
            if (w.period && w.period !== 60) line += ` PERIOD ${w.period}`;
            if (o.withSize && w.size > 1) line += ` SIZE ${w.size}`;
            if (w.color && w.color !== 'cyan') line += ` COLOR ${w.color}`;
            return line;
        },
    });
})();
