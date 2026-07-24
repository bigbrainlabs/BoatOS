/**
 * Dashboard Widget Registry (Deck)
 * ---------------------------------
 * Spiegelt Helms DashWidgetRegistry
 * (flutter_app/lib/widgets/dashboard/registry.dart).
 *
 * Ein Widget-Typ = ein selbst-registrierendes Modul unter js/dashboard/widgets/.
 * Jedes Modul ruft beim Laden window.dashWidgets.register({...}) auf.
 *
 * Deck ist non-module → globale Registry auf window.dashWidgets
 * (bewusst NICHT unter window.BoatOS, das main.js später neu zuweist).
 * Muss VOR dashboard_renderer.js geladen werden.
 *
 * Widget-Vertrag (analog Helm builder/editor/dsl):
 *   register({
 *     type,                       // kanonisch UPPERCASE (wie DSL/Helm)
 *     label,                      // Anzeigename
 *     render(widget, ctx),        // → HTML-String   (ctx = { r: renderer, size })
 *     editor(widget, ctx),        // → Property-Panel-HTML (ctx = editor)
 *     icon(widget, ctx),          // → Emoji für die Editor-Liste
 *     name(widget, ctx),          // → Anzeigename für die Editor-Liste
 *     dsl(widget),                // → DSL-Zeile
 *   })
 */
(function () {
    'use strict';
    window.BoatOS = window.BoatOS || {};

    // Legacy-Kleinschreibung ('sensor') → kanonisch UPPERCASE ('SENSOR').
    function normType(type) {
        return String(type || '').trim().toUpperCase();
    }

    const registry = {
        _defs: {},

        register(def) {
            if (!def || !def.type) return;
            const type = normType(def.type);
            this._defs[type] = Object.assign({}, def, { type });
        },

        get(widgetOrType) {
            const type = (widgetOrType && typeof widgetOrType === 'object')
                ? widgetOrType.type
                : widgetOrType;
            return this._defs[normType(type)] || null;
        },

        isRegistered(type) { return !!this._defs[normType(type)]; },
        get registeredTypes() { return Object.keys(this._defs); },
        labelFor(type) { const d = this.get(type); return d ? d.label : normType(type); },

        // ── Rendering ──────────────────────────────────────────────────────────
        // ctx = { r: <DashboardRenderer instance>, size: <grid span> }
        render(widget, ctx) {
            const d = this.get(widget);
            if (!d || typeof d.render !== 'function') return '';
            return d.render(widget, ctx) || '';
        },

        // ── Editor (Property-Panel) ─────────────────────────────────────────────
        buildEditor(widget, ctx) {
            const d = this.get(widget);
            return (d && typeof d.editor === 'function') ? (d.editor(widget, ctx) || '') : '';
        },

        // ── Editor-Listen-Metadaten ─────────────────────────────────────────────
        iconFor(widget, ctx) {
            const d = this.get(widget);
            if (d && typeof d.icon === 'function') return d.icon(widget, ctx);
            return '📦';
        },
        nameFor(widget, ctx) {
            const d = this.get(widget);
            if (d && typeof d.name === 'function') return d.name(widget, ctx);
            return (widget && widget.type) || '';
        },

        // ── DSL-Serialisierung ──────────────────────────────────────────────────
        // opts.withSize = true → Grid-Modus (SIZE anhängen); false → Screen-Slot.
        toDsl(widget, opts) {
            const d = this.get(widget);
            return (d && typeof d.dsl === 'function') ? (d.dsl(widget, opts || {}) || '') : '';
        },
    };

    // ── Geteilte Value-Lookup-Helfer (analog Helm dashGetValue/dashGetLabel) ─────
    // Auf window.dashWidgets exponiert, damit Widget-Module (v.a. künftige)
    // Sensorwerte einheitlich auslesen. Bestehende Module nutzen weiter die
    // Renderer-eigenen Lookups (Verhalten identisch).
    registry.getValue = function (sensors, path) {
        if (!sensors || !path) return null;
        const direct = sensors[path];
        if (direct && direct.values) {
            for (const v of Object.values(direct.values)) {
                if (typeof v === 'number') return v;
                const d = parseFloat(String(v).trim());
                if (!isNaN(d)) return d;
            }
            return null;
        }
        for (const base of Object.keys(sensors)) {
            if (path.startsWith(base + '/')) {
                const field = path.slice(base.length + 1);
                const raw = (sensors[base].values || {})[field];
                if (typeof raw === 'number') return raw;
                const d = parseFloat(String(raw).trim());
                return isNaN(d) ? null : d;
            }
        }
        return null;
    };

    // Maßgebliches Global: window.dashWidgets (wie window.dashboardRenderer).
    // NICHT unter window.BoatOS ablegen — main.js weist window.BoatOS später
    // komplett neu zu und würde die Registry sonst löschen.
    window.dashWidgets = registry;
})();
