/**
 * Settings-Tab: WLAN (Status, Hotspot, Scan, gespeicherte Netzwerke)
 *
 * Die WiFi-Logik lebt in js/wifi.js (BoatOS.wifi.*) — dieses Modul liefert
 * nur das Markup und stößt Refreshes an. Das Passwort-Modal (#wifi-pw-modal)
 * ist global in index.html.
 */

export const id = 'wifi';

export const html = `
                <!-- Current Status -->
                <div class="setting-group" id="wifi-status-group">
                    <h4 data-i18n="settings_wifi_status_h4">Verbindungsstatus</h4>
                    <div id="wifi-status-display" style="padding: 12px; background: var(--bg-card); border-radius: 8px; margin-bottom: 10px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div id="wifi-status-dot" style="width:10px;height:10px;border-radius:50%;background:var(--text-dim);flex-shrink:0"></div>
                            <div>
                                <div id="wifi-status-ssid" style="font-weight:600;color:var(--text)">Lade…</div>
                                <div id="wifi-status-ip" style="font-size:12px;color:var(--text-dim)"></div>
                            </div>
                            <div id="wifi-signal-bars" style="margin-left:auto;font-size:18px;"></div>
                        </div>
                    </div>
                    <button onclick="BoatOS.wifi.disconnect()" id="btn-wifi-disconnect" data-i18n="settings_wifi_disconnect"
                        style="display:none; width:100%; padding:10px; background:var(--danger); color:#fff; border:none; border-radius:8px; font-size:14px; cursor:pointer;">
                        Trennen
                    </button>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <button onclick="BoatOS.wifi.startHotspot()" id="btn-hotspot-start" data-i18n="settings_wifi_hotspot_start"
                            style="flex:1; padding:10px; background:transparent; color:#FF9800; border:1px solid #5C2D00; border-radius:8px; font-size:13px; cursor:pointer;">
                            📡 Hotspot starten
                        </button>
                        <button onclick="BoatOS.wifi.stopHotspot()" id="btn-hotspot-stop" data-i18n="settings_wifi_hotspot_stop"
                            style="display:none; flex:1; padding:10px; background:transparent; color:var(--text-dim); border:1px solid var(--border); border-radius:8px; font-size:13px; cursor:pointer;">
                            Stoppen
                        </button>
                        <button onclick="BoatOS.wifi.reinitAdapter()" id="btn-wifi-reinit" data-i18n="settings_wifi_adapter_restart"
                            style="flex:1; padding:10px; background:transparent; color:var(--text-dim); border:1px solid var(--border); border-radius:8px; font-size:13px; cursor:pointer;">
                            ↺ Adapter neu starten
                        </button>
                    </div>
                </div>

                <!-- Scan -->
                <div class="setting-group">
                    <h4 data-i18n="settings_wifi_available_h4">Verfügbare Netzwerke</h4>
                    <button onclick="BoatOS.wifi.scan()" id="btn-wifi-scan" data-i18n="settings_wifi_scan_btn"
                        style="width:100%; padding:10px; background:var(--accent); color:#fff; border:none; border-radius:8px; font-size:14px; cursor:pointer; margin-bottom:12px;">
                        Netzwerke scannen
                    </button>
                    <div id="wifi-scan-list" style="display:flex; flex-direction:column; gap:6px;"></div>
                </div>

                <!-- Saved Networks -->
                <div class="setting-group">
                    <h4 data-i18n="settings_wifi_saved_h4">Gespeicherte Netzwerke</h4>
                    <div id="wifi-saved-list" style="display:flex; flex-direction:column; gap:6px;">
                        <div style="color:var(--text-dim);font-size:13px;">Lade…</div>
                    </div>
                </div>
`;

export function init(ctx) {
    // WiFi-Logik läuft über BoatOS.wifi (js/wifi.js)
}

export function load(settings) {
    // keine Settings-Felder in diesem Tab
}

export function collect(settings) {
    // keine Settings-Felder in diesem Tab
}

export function onShow(ctx) {
    if (window.BoatOS?.wifi) {
        window.BoatOS.wifi.loadStatus();
        window.BoatOS.wifi.loadSaved();
    }
}
