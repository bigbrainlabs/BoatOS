/**
 * Settings-Tab: GPS (Gerät, SignalK, Status, Quelle)
 */

export const id = 'gps';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_gps_device_section">GPS-Gerät</h4>
                    <div class="setting-item">
                        <span>Port</span>
                        <input type="text" class="setting-input" id="setting-gps-device" value="/dev/ttyUSB0"
                               list="gps-device-list" placeholder="/dev/ttyUSB0" style="width: 130px;">
                        <datalist id="gps-device-list">
                            <option value="/dev/ttyUSB0">
                            <option value="/dev/ttyUSB1">
                            <option value="/dev/ttyACM0">
                            <option value="/dev/ttyACM1">
                        </datalist>
                    </div>
                    <div class="setting-item">
                        <span>Baudrate</span>
                        <select class="setting-select" id="setting-gps-baudrate">
                            <option value="4800">4800</option>
                            <option value="9600">9600</option>
                            <option value="19200">19200</option>
                            <option value="38400">38400</option>
                            <option value="57600">57600</option>
                            <option value="115200">115200</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <button id="btn-gps-apply" class="btn-secondary" data-i18n="settings_gps_apply_btn" style="width:100%;">
                            🔄 Übernehmen & SignalK neu starten
                        </button>
                    </div>
                    <div id="gps-config-status" style="font-size:var(--fs-sm); color:var(--text-dim); margin-top:var(--space-xs); display:none;"></div>
                </div>
                <div class="setting-group">
                    <h4>SignalK Server</h4>
                    <div class="setting-item">
                        <span>Server URL</span>
                        <input type="text" class="setting-input" id="setting-signalk-url" value="http://localhost:3000" placeholder="http://localhost:3000" style="width: 100%;">
                    </div>
                    <small style="color: var(--text-dim); font-size: 11px; display: block; margin-top: 5px;">
                        Adresse des SignalK-Servers für Sensordaten
                    </small>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_gps_status_section">GPS-Status Einstellungen</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_gps_sat_threshold">Wartezeit bei wenig Satelliten</span>
                        <input type="number" class="setting-input" id="setting-low-satellite-threshold" min="5" max="60" value="15" step="5"> Sek.
                    </div>
                    <small style="color: var(--text-dim); font-size: 11px; display: block; margin-top: 5px;">
                        Zeit (in Sekunden), die weniger als 4 Satelliten empfangen werden müssen, bevor der Status auf "Wenig Satelliten" wechselt.
                    </small>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_gps_source_section">GPS-Quelle</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_gps_datasource">Datenquelle</span>
                        <select class="setting-select" id="setting-gps-source">
                            <option value="signalk">SignalK Server</option>
                            <option value="gpsd">GPSD</option>
                            <option value="browser">Browser GPS</option>
                        </select>
                    </div>
                </div>
`;

let API_URL = '';

export function init(ctx) {
    API_URL = ctx.API_URL || '';
    const applyBtn = document.getElementById('btn-gps-apply');
    if (applyBtn) applyBtn.addEventListener('click', applyGpsConfig);
}

export function load(settings) {
    if (settings.gps) {
        const signalkUrl = document.getElementById('setting-signalk-url');
        const lowSatThreshold = document.getElementById('setting-low-satellite-threshold');
        const gpsSource = document.getElementById('setting-gps-source');

        if (signalkUrl && settings.gps.signalkUrl) signalkUrl.value = settings.gps.signalkUrl;
        if (lowSatThreshold && settings.gps.lowSatelliteThreshold) lowSatThreshold.value = settings.gps.lowSatelliteThreshold;
        if (gpsSource && settings.gps.source) gpsSource.value = settings.gps.source;
    }

    // GPS-Geräte-Konfiguration live vom Backend (SignalK-Settings)
    loadGpsDeviceConfig();
}

async function loadGpsDeviceConfig() {
    try {
        const cfgResp = await fetch(`${API_URL}/api/gps/config`);
        const cfg = await cfgResp.json();
        const devEl = document.getElementById('setting-gps-device');
        const baudEl = document.getElementById('setting-gps-baudrate');
        if (devEl && cfg.device) devEl.value = cfg.device;
        if (baudEl && cfg.baudrate) baudEl.value = String(cfg.baudrate);
    } catch (e) {}
}

export function collect(settings) {
    settings.gps = settings.gps || {};

    const signalkUrl = document.getElementById('setting-signalk-url');
    const lowSatThreshold = document.getElementById('setting-low-satellite-threshold');
    const gpsSource = document.getElementById('setting-gps-source');

    if (signalkUrl) settings.gps.signalkUrl = signalkUrl.value;
    if (lowSatThreshold) settings.gps.lowSatelliteThreshold = parseInt(lowSatThreshold.value) || 15;
    if (gpsSource) settings.gps.source = gpsSource.value;
}

export async function applyGpsConfig() {
    const device   = document.getElementById('setting-gps-device')?.value?.trim() || '/dev/ttyUSB0';
    const baudrate = parseInt(document.getElementById('setting-gps-baudrate')?.value || '4800');
    const statusEl = document.getElementById('gps-config-status');

    if (statusEl) { statusEl.textContent = '⏳ Wird übernommen…'; statusEl.style.display = 'block'; }

    try {
        const resp = await fetch(`${API_URL}/api/gps/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device, baudrate })
        });
        const result = await resp.json();
        if (result.status === 'ok') {
            if (statusEl) statusEl.textContent = `✅ ${device} @ ${baudrate} Baud — SignalK neugestartet`;
        } else {
            if (statusEl) statusEl.textContent = `❌ ${result.message || 'Fehler'}`;
        }
    } catch (e) {
        if (statusEl) statusEl.textContent = `❌ Verbindungsfehler`;
    }
}
