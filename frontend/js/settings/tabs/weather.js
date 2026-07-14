/**
 * Settings-Tab: Wetter
 *
 * Warnungen kommen vom DWD über Bright Sky (amtlich, vier Stufen). Der eigene
 * Wind-Schwellwert ist optional und kommt ZUSÄTZLICH — Default ist 0 = aus, es
 * wird also standardmäßig nur bei einer amtlichen Warnung Alarm gegeben.
 *
 * Der Schwellwert wird intern IMMER in Knoten gespeichert (wie alle Windwerte im
 * Backend) und nur für die Anzeige in die eingestellte Einheit umgerechnet.
 */

export const id = 'weather';

export const html = `
    <div class="settings-section">
        <h3 data-i18n="settings_weather">🌦️ Wetter</h3>

        <div class="setting-group">
            <h4 data-i18n="weather_api_h4">OpenWeather-Zugang</h4>
            <div class="setting-item" style="flex-direction:column; align-items:stretch; gap:6px;">
                <span data-i18n="weather_api_key">API-Key</span>
                <input type="text" class="setting-input" id="setting-openweather-key"
                       placeholder="OpenWeather API-Key" style="width:100%; font-family:monospace;"
                       autocomplete="off" spellcheck="false">
            </div>
            <small style="color: var(--text-dim); font-size: 11px; display: block; margin-bottom: 15px;"
                   data-i18n="weather_api_key_hint">
                Eigener Schlüssel für Wetterdaten — kostenlos auf openweathermap.org. Wird auf diesem Gerät gespeichert und hat Vorrang vor der .env-Datei.
            </small>
        </div>

        <div class="setting-group">
            <h4 data-i18n="weather_alerts_h4">Warnungen</h4>

            <div class="setting-item">
                <span data-i18n="weather_alerts_official">Warnungen aktiv</span>
                <div class="toggle active" id="toggle-weather-alerts"
                     onclick="BoatOS.ui.toggleSettingToggle(this, 'weatherAlertsEnabled')"></div>
            </div>

            <div class="setting-item">
                <span data-i18n="weather_alert_source">Quelle</span>
                <select class="setting-select" id="setting-alert-source">
                    <option value="dwd" data-i18n="weather_alert_source_dwd">DWD (Deutschland, kostenlos)</option>
                    <option value="owm" data-i18n="weather_alert_source_owm">OpenWeather One Call 3.0 (weltweit, Abo nötig)</option>
                </select>
            </div>
            <small style="color: var(--text-dim); font-size: 11px; display: block; margin-bottom: 15px;"
                   data-i18n="weather_alert_source_hint">
                DWD über Bright Sky: amtlich, ohne Schlüssel — deckt aber nur Deutschland ab. OpenWeather deckt auch das Ausland ab, erfordert jedoch ein separates „One Call by Call"-Abo (der normale API-Key allein reicht dafür nicht).
            </small>
            <div id="weather-alert-status" style="font-size:11px; margin-bottom:15px; display:none;"></div>

            <div class="setting-item">
                <span data-i18n="weather_wind_alert">Eigener Wind-Alarm ab</span>
                <div style="display:flex; align-items:center; gap:6px;">
                    <input type="number" class="setting-input" id="setting-wind-alert"
                           value="0" step="1" min="0" style="width: 80px;">
                    <span class="unit-speed" style="color: var(--text-dim); font-size: 12px;">kn</span>
                </div>
            </div>
            <small style="color: var(--text-dim); font-size: 11px; display: block;"
                   data-i18n="weather_wind_alert_hint">
                Zusätzlich zur amtlichen Warnung: Alarm, sobald der Wind diesen Wert erreicht. 0 = aus (nur amtliche Warnungen).
            </small>
        </div>
    </div>
`;

// Umrechnung Knoten ↔ Anzeige-Einheit (gleiche Faktoren wie im Rest der App)
function _speedFactor() {
    const u = (window.getUnitSettings ? window.getUnitSettings().speed : 'kn');
    if (u === 'kmh') return 1.852;
    if (u === 'mph') return 1.15078;
    if (u === 'ms') return 0.514444;
    return 1;
}

export function init(ctx) { /* nichts zu verdrahten */ }

export function load(settings) {
    const w = settings.weather || {};

    const key = document.getElementById('setting-openweather-key');
    if (key) key.value = w.apiKey || '';

    const toggle = document.getElementById('toggle-weather-alerts');
    if (toggle) {
        // Default AN: ohne Einstellung sollen Warnungen kommen
        toggle.classList.toggle('active', w.alertsEnabled !== false);
    }

    const source = document.getElementById('setting-alert-source');
    if (source) source.value = w.alertSource || 'dwd';

    const input = document.getElementById('setting-wind-alert');
    if (input) {
        const kn = Number(w.windAlertKn) || 0;
        input.value = kn ? +(kn * _speedFactor()).toFixed(0) : 0;
    }
}

export function collect(settings) {
    settings.weather = settings.weather || {};

    const key = document.getElementById('setting-openweather-key');
    if (key) settings.weather.apiKey = key.value.trim();

    const toggle = document.getElementById('toggle-weather-alerts');
    if (toggle) settings.weather.alertsEnabled = toggle.classList.contains('active');

    const source = document.getElementById('setting-alert-source');
    if (source) settings.weather.alertSource = source.value;

    const input = document.getElementById('setting-wind-alert');
    if (input) {
        const shown = parseFloat(input.value) || 0;
        // zurück in Knoten — die kanonische Einheit
        settings.weather.windAlertKn = shown > 0 ? +(shown / _speedFactor()).toFixed(2) : 0;
    }
}

/**
 * Beim Öffnen des Tabs den Warn-Endpoint anfragen und melden, wenn die gewählte
 * Quelle nicht funktioniert — sonst wundert man sich stumm über fehlende Alarme
 * (z.B. OpenWeather ohne One-Call-Abo antwortet mit 401).
 */
export async function onShow(ctx) {
    const box = document.getElementById('weather-alert-status');
    if (!box) return;
    try {
        const r = await fetch('/api/weather/alerts', { cache: 'no-store' });
        const d = await r.json();
        if (d.error) {
            box.style.display = 'block';
            box.style.color = 'var(--danger, #ef4444)';
            box.textContent = '⚠ ' + d.error;
        } else {
            box.style.display = 'block';
            box.style.color = 'var(--text-dim)';
            const src = d.source === 'owm' ? 'OpenWeather' : 'DWD';
            box.textContent = `Quelle ${src} erreichbar · ${d.count || 0} aktive Warnung(en)`;
        }
    } catch {
        box.style.display = 'none';
    }
}
