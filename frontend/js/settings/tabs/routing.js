/**
 * Settings-Tab: Routing (Provider, OSRM-Server, Routing-Graphen, Strömung)
 *
 * Routing-Graph-Upload läuft weiterhin über ui.js (BoatOS.ui.onRoutingFileSelected /
 * uploadRoutingFile), die Graph-Liste über window.loadRoutingGraphs.
 * Der frühere OSRM-Regionen-Wechsel wurde entfernt — das Routing läuft global
 * über das germany-waterways-Profil + .routing-Graphen (grenzüberschreitend).
 */

export const id = 'routing';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_routing_method_h4">Routing-Methode</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_routing_provider_label">Anbieter</span>
                        <select class="setting-select" id="setting-routing-provider">
                            <option value="osrm">OSRM (Lokal, Offline)</option>
                            <option value="graphhopper">GraphHopper (Cloud API)</option>
                            <option value="direct">Direkte Linie (Rhumbline)</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group" id="osrm-settings">
                    <h4>OSRM Server</h4>
                    <div class="setting-item">
                        <span>Server-URL</span>
                        <input type="text" class="setting-input" id="setting-osrm-url" value="http://127.0.0.1:5000" placeholder="http://127.0.0.1:5000" style="width: 100%;">
                    </div>
                </div>

                <div class="setting-group" id="graphhopper-settings" style="display: none;">
                    <h4>GraphHopper</h4>
                    <div class="setting-item">
                        <span>API-Key</span>
                        <input type="text" class="setting-input" id="setting-graphhopper-api-key" placeholder="Kostenlos auf graphhopper.com" style="width: 100%;">
                    </div>
                    <small style="color: var(--text-dim); font-size: 11px;">
                        🔗 API-Key bei graphhopper.com registrieren (500 Anfragen/Tag kostenlos)
                    </small>
                </div>

                <div class="setting-group">
                    <h4>Routing-Region</h4>
                    <p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">
                        Welcher Routing-Graph im OSRM-Dienst geladen ist. Der Wechsel ist neustartfest.
                    </p>
                    <div style="font-size:12px;margin-bottom:8px;">
                        Aktiv: <strong id="routing-region-active" style="color:var(--accent);">Wird geladen…</strong>
                    </div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <select class="setting-select" id="setting-routing-region" style="flex:1;min-width:160px;"></select>
                        <button id="routing-region-btn" class="btn-primary" style="min-width:120px;"
                                onclick="BoatOS.ui.switchRoutingRegion()">Wechseln</button>
                    </div>
                    <div id="routing-region-status" style="font-size:11px;margin-top:6px;display:none;"></div>
                </div>

                <div class="setting-group">
                    <h4>Routing-Daten (grenzüberschreitend)</h4>
                    <p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;">
                        .routing-Dateien aus dem MBTiles Creator hochladen — ermöglicht Routen über Ländergrenzen.
                    </p>
                    <div id="routing-graphs-list" style="margin-bottom:10px;font-size:12px;color:var(--text-dim);">Wird geladen…</div>
                    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                        <label class="btn-secondary" style="cursor:pointer;flex:1;text-align:center;min-width:120px;">
                            📂 .routing-Datei wählen
                            <input type="file" id="routing-upload-input" accept=".routing" style="display:none"
                                   onchange="BoatOS.ui.onRoutingFileSelected(this)">
                        </label>
                        <button id="routing-upload-btn" class="btn-primary" style="flex:1;min-width:120px;display:none;"
                                onclick="BoatOS.ui.uploadRoutingFile()">⬆ Hochladen</button>
                    </div>
                    <div id="routing-upload-filename" style="font-size:11px;color:var(--accent);margin-top:4px;display:none;"></div>
                    <div id="routing-upload-progress" style="display:none;margin-top:8px;">
                        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-bottom:3px;">
                            <span id="routing-upload-status">Hochladen…</span>
                            <span id="routing-upload-pct">0%</span>
                        </div>
                        <div style="background:var(--surface-2,rgba(0,0,0,0.3));border-radius:4px;overflow:hidden;height:6px;">
                            <div id="routing-upload-bar" style="height:100%;width:0%;background:var(--accent);transition:width 0.2s;"></div>
                        </div>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_water_current_h4">🌊 Fließgeschwindigkeiten</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_consider_current">Strömung berücksichtigen</span>
                        <div class="toggle" id="toggle-water-current" onclick="BoatOS.ui.toggleSettingToggle(this, 'waterCurrentEnabled')"></div>
                    </div>
                    <small style="color: var(--text-dim); font-size: 11px; display: block; margin-bottom: 15px;">
                        Berücksichtigt Fließgeschwindigkeiten für genauere ETA-Berechnungen
                    </small>

                    <div id="water-current-settings">
                        <div style="background: var(--bg-card); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                <h5 style="margin:0;color:var(--accent);">Gewässer</h5>
                                <button class="btn-secondary" style="padding:4px 10px;font-size:12px;"
                                        onclick="BoatOS.ui.addWaterway()">+ Gewässer</button>
                            </div>
                            <small style="color:var(--text-dim);font-size:11px;display:block;margin-bottom:10px;">
                                Strömung in <strong>km/h</strong>. Über 🌍 auch die Geografie setzen:
                                die <em>Bounding-Box</em> grenzt ein, wo das Gewässer liegen kann, die <em>Mündung</em>
                                bestimmt die Fließrichtung (berg/tal). Leere Geo-Felder = eingebauter Standard.
                            </small>
                            <div id="waterway-list" style="font-size:12px;">Wird geladen…</div>
                        </div>

                        <div style="background: var(--bg-card); padding: 15px; border-radius: 8px;">
                            <h5 style="margin: 0 0 10px 0; color: var(--accent);">Standard nach Typ (<span class="unit-speed">kn</span>)</h5>
                            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                                <div class="setting-item" style="margin: 0;">
                                    <span style="font-size: 12px;">Fluss</span>
                                    <input type="number" class="setting-input" id="setting-current-type-river" value="1.1" step="0.1" min="0" style="width: 70px;">
                                </div>
                                <div class="setting-item" style="margin: 0;">
                                    <span style="font-size: 12px;">Kanal</span>
                                    <input type="number" class="setting-input" id="setting-current-type-canal" value="0.0" step="0.1" min="0" style="width: 70px;">
                                </div>
                                <div class="setting-item" style="margin: 0;">
                                    <span style="font-size: 12px;">Bach</span>
                                    <input type="number" class="setting-input" id="setting-current-type-stream" value="0.5" step="0.1" min="0" style="width: 70px;">
                                </div>
                                <div class="setting-item" style="margin: 0;">
                                    <span style="font-size: 12px;">See</span>
                                    <input type="number" class="setting-input" id="setting-current-type-lake" value="0.0" step="0.1" min="0" style="width: 70px;">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style="margin-top: 15px; padding: 12px; background: rgba(100, 200, 100, 0.1); border-radius: 8px; font-size: 11px; color: var(--text-dim);">
                        <strong>ℹ️ Berechnung:</strong><br>
                        • Stromabwärts: Geschwindigkeit + Strömung<br>
                        • Stromaufwärts: Geschwindigkeit - Strömung<br>
                        • Live-Daten von PEGELONLINE (falls verfügbar)
                    </div>
                </div>
`;

let API_URL = '';

export function init(ctx) {
    API_URL = ctx.API_URL || '';

    const provider = document.getElementById('setting-routing-provider');
    if (provider) provider.addEventListener('change', updateRoutingProviderVisibility);
}

export function load(settings) {
    if (settings.routing) {
        const routingProvider = document.getElementById('setting-routing-provider');
        const osrmUrl = document.getElementById('setting-osrm-url');
        const graphhopperApiKey = document.getElementById('setting-graphhopper-api-key');
        const toggleWaterCurrent = document.getElementById('toggle-water-current');

        if (routingProvider && settings.routing.provider) routingProvider.value = settings.routing.provider;
        if (osrmUrl && settings.routing.osrmUrl) osrmUrl.value = settings.routing.osrmUrl;
        if (graphhopperApiKey && settings.routing.graphhopperApiKey) graphhopperApiKey.value = settings.routing.graphhopperApiKey;
        if (toggleWaterCurrent) toggleWaterCurrent.classList.toggle('active', settings.routing.waterCurrentEnabled === true);

        // Gewässer-Liste kommt dynamisch aus /api/routing/waterways (siehe onShow),
        // nicht mehr aus fest verdrahteten Feldern.
        if (settings.routing.currentTypes) {
            ['river', 'canal', 'stream', 'lake'].forEach(type => {
                const el = document.getElementById(`setting-current-type-${type}`);
                if (el && settings.routing.currentTypes[type] !== undefined) el.value = settings.routing.currentTypes[type];
            });
        }
    }

    updateRoutingProviderVisibility();
}

export function collect(settings) {
    settings.routing = settings.routing || {};

    const routingProvider = document.getElementById('setting-routing-provider');
    const osrmUrl = document.getElementById('setting-osrm-url');
    const graphhopperApiKey = document.getElementById('setting-graphhopper-api-key');
    const toggleWaterCurrent = document.getElementById('toggle-water-current');

    if (routingProvider) settings.routing.provider = routingProvider.value;
    if (osrmUrl) settings.routing.osrmUrl = osrmUrl.value;
    if (graphhopperApiKey) settings.routing.graphhopperApiKey = graphhopperApiKey.value;
    if (toggleWaterCurrent) settings.routing.waterCurrentEnabled = toggleWaterCurrent.classList.contains('active');

    // Fließgeschwindigkeiten — nach Typ
    settings.routing.currentTypes = settings.routing.currentTypes || {};
    ['river', 'canal', 'stream', 'lake'].forEach(type => {
        const el = document.getElementById(`setting-current-type-${type}`);
        if (el) settings.routing.currentTypes[type] = parseFloat(el.value) || 0;
    });

    // waterCurrent = einzige Quelle fürs Backend (water_current_service).
    // byName kommt aus dem dynamischen Gewässer-Editor (inkl. bbox/mouth/flow_bearing);
    // nur gesetzte Geo-Felder werden geschrieben — leere lassen die Code-Defaults greifen.
    const byName = (window.collectWaterways ? window.collectWaterways() : null);
    settings.waterCurrent = {
        enabled: settings.routing.waterCurrentEnabled === true,
        byName: byName || (settings.waterCurrent?.byName ?? {}),
        byType: settings.routing.currentTypes || {}
    };
}

export function onShow(ctx) {
    if (window.loadRoutingGraphs) window.loadRoutingGraphs();
    if (window.loadRoutingRegions) window.loadRoutingRegions();
    if (window.loadWaterways) window.loadWaterways();
}

// ==================== AKTIONEN ====================

export function updateRoutingProviderVisibility() {
    const provider = document.getElementById('setting-routing-provider')?.value || 'osrm';
    const osrmSettings = document.getElementById('osrm-settings');
    const graphhopperSettings = document.getElementById('graphhopper-settings');

    if (osrmSettings) osrmSettings.style.display = provider === 'osrm' ? 'block' : 'none';
    if (graphhopperSettings) graphhopperSettings.style.display = provider === 'graphhopper' ? 'block' : 'none';
}

