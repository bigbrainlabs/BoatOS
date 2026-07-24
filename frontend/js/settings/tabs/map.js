/**
 * Settings-Tab: Karte (Layer, Verhalten, Offline-Karten)
 *
 * Regionen-Verwaltung und MBTiles-Upload laufen weiterhin über ui.js
 * (BoatOS.ui.loadMapRegions / uploadMbtiles / toggleMapRegion / deleteMapRegion).
 */

export const id = 'map';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_map_layers">Kartenlayer</h4>
                    <div class="setting-item">
                        <span>OpenSeaMap</span>
                        <div class="toggle active" id="toggle-openseamap" onclick="BoatOS.ui.toggleSettingToggle(this, 'openSeaMap')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_show_ienc">Amtliche Karten (IENC)</span>
                        <div class="toggle active" id="toggle-ienc" onclick="BoatOS.ui.toggleSettingToggle(this, 'showIENC')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_show_locks">Schleusen anzeigen</span>
                        <div class="toggle active" id="toggle-locks" onclick="BoatOS.ui.toggleSettingToggle(this, 'showLocks')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_show_gauges">Pegelstände anzeigen</span>
                        <div class="toggle" id="toggle-pegel" onclick="BoatOS.ui.toggleSettingToggle(this, 'showPegel')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_show_harbors">Häfen &amp; Ankerplätze</span>
                        <div class="toggle" id="toggle-harbors" onclick="BoatOS.ui.toggleSettingToggle(this, 'showHarbors')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_show_track">Track anzeigen</span>
                        <div class="toggle active" id="toggle-track" onclick="BoatOS.ui.toggleSettingToggle(this, 'showTrack')"></div>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_behavior">Verhalten</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_auto_center">Auto-Zentrierung</span>
                        <div class="toggle active" id="toggle-autocenter" onclick="BoatOS.ui.toggleSettingToggle(this, 'autoCenter')"></div>
                    </div>
                    <div class="setting-item">
                        <span>Heading Up</span>
                        <div class="toggle" id="toggle-headingup" onclick="BoatOS.ui.toggleSettingToggle(this, 'headingUp')"></div>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_offline_maps">Offline-Karten</h4>
                    <p style="font-size:12px;color:var(--text-dim);margin-bottom:10px;" data-i18n="settings_offline_maps_desc">
                        Aktiviere mehrere Regionen für länderübergreifende Navigation. Regionen werden beim Laden einer Kachel der Reihe nach abgefragt.
                    </p>
                    <div id="map-regions-list" style="margin-bottom:10px;">
                        <div style="color:var(--text-dim);font-size:13px;padding:8px 0;" data-i18n="settings_offline_maps_refresh">Wird geladen…</div>
                    </div>
                    <div style="margin-top:10px;">
                        <label style="display:block;font-size:12px;color:var(--text-dim);margin-bottom:6px;"
                               data-i18n="settings_offline_maps_upload_label">
                            .mbtiles-Datei hochladen (z.B. aus dem BoatOS Karten-Tool):
                        </label>
                        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
                            <label id="map-upload-label" class="btn-secondary" style="cursor:pointer;flex:1;text-align:center;min-width:120px;">
                                <span data-i18n="settings_offline_maps_choose">📂 Datei wählen</span>
                                <input type="file" id="map-upload-input" accept=".mbtiles" style="display:none"
                                       onchange="BoatOS.ui.onMbtilesFileSelected(this)">
                            </label>
                            <button id="map-upload-btn" class="btn-primary" style="flex:1;min-width:120px;display:none;"
                                    onclick="BoatOS.ui.uploadMbtiles()"
                                    data-i18n="settings_offline_maps_upload_btn">⬆ Hochladen</button>
                        </div>
                        <div id="map-upload-filename" style="font-size:11px;color:var(--accent);margin-top:4px;display:none;"></div>
                        <div id="map-upload-progress" style="display:none;margin-top:8px;">
                            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-dim);margin-bottom:3px;">
                                <span id="map-upload-status">Hochladen…</span>
                                <span id="map-upload-pct">0%</span>
                            </div>
                            <div style="background:var(--surface-2,rgba(0,0,0,0.3));border-radius:4px;overflow:hidden;height:6px;">
                                <div id="map-upload-bar" style="height:100%;width:0%;background:var(--accent);transition:width 0.2s;"></div>
                            </div>
                        </div>
                    </div>
                    <button onclick="BoatOS.ui.loadMapRegions()" class="btn-secondary" style="width:100%;margin-top:8px;"
                            data-i18n="settings_offline_maps_refresh">↺ Aktualisieren</button>
                </div>
`;

export function init(ctx) {
    // Upload/Region-Handling bleibt in ui.js (inline BoatOS.ui.* Handler)
}

export function load(settings) {
    if (!settings.map) return;

    const mapStyleSelect = document.getElementById('setting-map-style');
    if (mapStyleSelect && settings.map.style) mapStyleSelect.value = settings.map.style;

    const toggles = {
        'toggle-openseamap': settings.map.openSeaMap,
        'toggle-ienc': settings.map.showIENC,
        'toggle-locks': settings.map.showLocks,
        'toggle-pegel': settings.map.showPegel,
        'toggle-harbors': settings.map.showHarbors,
        'toggle-track': settings.map.showTrack,
        'toggle-autocenter': settings.map.autoCenter,
        'toggle-headingup': settings.map.headingUp
    };
    Object.entries(toggles).forEach(([tid, value]) => {
        const el = document.getElementById(tid);
        if (el && value !== undefined) el.classList.toggle('active', value);
    });
}

export function collect(settings) {
    settings.map = settings.map || {};

    const mapStyleSelect = document.getElementById('setting-map-style');
    if (mapStyleSelect) settings.map.style = mapStyleSelect.value;

    const toggleOpenSeaMap = document.getElementById('toggle-openseamap');
    const toggleIENC = document.getElementById('toggle-ienc');
    const toggleLocks = document.getElementById('toggle-locks');
    const togglePegel = document.getElementById('toggle-pegel');
    const toggleHarbors = document.getElementById('toggle-harbors');
    const toggleTrack = document.getElementById('toggle-track');
    const toggleAutoCenter = document.getElementById('toggle-autocenter');
    const toggleHeadingUp = document.getElementById('toggle-headingup');

    if (toggleOpenSeaMap) settings.map.openSeaMap = toggleOpenSeaMap.classList.contains('active');
    if (toggleIENC) settings.map.showIENC = toggleIENC.classList.contains('active');
    if (toggleLocks) settings.map.showLocks = toggleLocks.classList.contains('active');
    if (togglePegel) settings.map.showPegel = togglePegel.classList.contains('active');
    if (toggleHarbors) settings.map.showHarbors = toggleHarbors.classList.contains('active');
    if (toggleTrack) settings.map.showTrack = toggleTrack.classList.contains('active');
    if (toggleAutoCenter) settings.map.autoCenter = toggleAutoCenter.classList.contains('active');
    if (toggleHeadingUp) settings.map.headingUp = toggleHeadingUp.classList.contains('active');
}

export function onShow(ctx) {
    if (window.loadMapRegions) window.loadMapRegions();
}
