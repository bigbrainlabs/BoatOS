/**
 * Settings-Tab: AIS (Empfang, Anzeige, Kollisionswarnung)
 */

export const id = 'ais';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_ais_reception">AIS Empfang</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_ais_active">AIS aktiviert</span>
                        <div class="toggle" id="toggle-ais" onclick="BoatOS.ui.toggleSettingToggle(this, 'aisEnabled')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_ais_provider_label">Anbieter</span>
                        <select class="setting-input" id="setting-ais-provider">
                            <option value="aisstream">AISstream</option>
                            <option value="aishub">AISHub</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span>API-Key</span>
                        <input type="text" class="setting-input" id="setting-ais-apikey" placeholder="API-Key eingeben">
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_ais_range">Reichweite</span>
                        <input type="number" class="setting-input" id="setting-ais-range" value="20"> <span id="setting-ais-range-unit" class="unit-distance">NM</span>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_ais_interval">Update-Intervall (Sek.)</span>
                        <input type="number" class="setting-input" id="setting-ais-interval" value="60" min="10" max="300" step="10">
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_section_display">Anzeige</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_show_vessel_names">Schiffsnamen anzeigen</span>
                        <div class="toggle active" id="toggle-ais-labels" onclick="BoatOS.ui.toggleSettingToggle(this, 'aisLabels')"></div>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_collision_warning">Kollisionswarnung</h4>
                    <div class="setting-item">
                        <span>CPA Alarm</span>
                        <div class="toggle active" id="toggle-cpa" onclick="BoatOS.ui.toggleSettingToggle(this, 'cpaAlarm')"></div>
                    </div>
                    <div class="setting-item">
                        <span>Min. CPA</span>
                        <input type="number" class="setting-input" id="setting-min-cpa" value="0.5" step="0.1"> <span id="setting-cpa-unit" class="unit-distance">NM</span>
                    </div>
                </div>
`;

export function init(ctx) {
    // keine tab-spezifischen Aktionen
}

export function load(settings) {
    if (!settings.ais) return;

    const toggleAis = document.getElementById('toggle-ais');
    const aisProvider = document.getElementById('setting-ais-provider');
    const aisApiKey = document.getElementById('setting-ais-apikey');
    const aisRange = document.getElementById('setting-ais-range');
    const aisInterval = document.getElementById('setting-ais-interval');
    const toggleAisLabels = document.getElementById('toggle-ais-labels');
    const toggleCpa = document.getElementById('toggle-cpa');
    const minCpa = document.getElementById('setting-min-cpa');

    if (toggleAis) toggleAis.classList.toggle('active', settings.ais.enabled === true);
    if (aisProvider && settings.ais.provider) aisProvider.value = settings.ais.provider;
    if (aisApiKey && settings.ais.apiKey) aisApiKey.value = settings.ais.apiKey;
    if (aisRange && settings.ais.range) aisRange.value = settings.ais.range;
    if (aisInterval && settings.ais.updateInterval) aisInterval.value = settings.ais.updateInterval;
    if (toggleAisLabels) toggleAisLabels.classList.toggle('active', settings.ais.showLabels !== false);
    if (toggleCpa) toggleCpa.classList.toggle('active', settings.ais.cpaAlarm !== false);
    if (minCpa && settings.ais.minCpa) minCpa.value = settings.ais.minCpa;
}

export function collect(settings) {
    settings.ais = settings.ais || {};

    const toggleAis = document.getElementById('toggle-ais');
    const aisProvider = document.getElementById('setting-ais-provider');
    const aisApiKey = document.getElementById('setting-ais-apikey');
    const aisRange = document.getElementById('setting-ais-range');
    const aisInterval = document.getElementById('setting-ais-interval');
    const toggleAisLabels = document.getElementById('toggle-ais-labels');
    const toggleCpa = document.getElementById('toggle-cpa');
    const minCpa = document.getElementById('setting-min-cpa');

    if (toggleAis) settings.ais.enabled = toggleAis.classList.contains('active');
    if (aisProvider) settings.ais.provider = aisProvider.value;
    if (aisApiKey) settings.ais.apiKey = aisApiKey.value;
    if (aisRange) settings.ais.range = parseInt(aisRange.value) || 20;
    if (aisInterval) settings.ais.updateInterval = parseInt(aisInterval.value) || 60;
    if (toggleAisLabels) settings.ais.showLabels = toggleAisLabels.classList.contains('active');
    if (toggleCpa) settings.ais.cpaAlarm = toggleCpa.classList.contains('active');
    if (minCpa) settings.ais.minCpa = parseFloat(minCpa.value) || 0.5;
}
