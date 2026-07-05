/**
 * Settings-Tab: Allgemein (Anzeige, Sprache, Einheiten, Formate, Töne)
 */

import { setLang } from '../../i18n.js';

export const id = 'general';

export const html = `
                <div class="setting-group">
                    <h4 data-i18n="settings_section_display">Anzeige</h4>
                    <div class="setting-item">
                        <span>Dark Mode</span>
                        <div class="toggle" id="toggle-darkmode" onclick="BoatOS.ui.toggleSettingToggle(this, 'darkMode')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="setting_language_label">Sprache</span>
                        <select class="setting-select" id="setting-language">
                            <option value="de">Deutsch</option>
                            <option value="en">English</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_section_units">Einheiten</h4>
                    <div class="setting-item">
                        <span data-i18n="unit_speed">Geschwindigkeit</span>
                        <select class="setting-select" id="setting-speed-unit">
                            <option value="kn">Knoten (kn)</option>
                            <option value="kmh">km/h</option>
                            <option value="mph">mph</option>
                            <option value="ms">m/s</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_distance_label">Distanz</span>
                        <select class="setting-select" id="setting-distance-unit">
                            <option value="nm">Nautische Meilen (NM)</option>
                            <option value="km">Kilometer (km)</option>
                            <option value="mi">Meilen (mi)</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="unit_depth">Tiefe</span>
                        <select class="setting-select" id="setting-depth-unit">
                            <option value="m">Meter (m)</option>
                            <option value="ft">Fuß (ft)</option>
                            <option value="fathom">Faden</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="unit_temperature">Temperatur</span>
                        <select class="setting-select" id="setting-temperature-unit">
                            <option value="c">Celsius (°C)</option>
                            <option value="f">Fahrenheit (°F)</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="unit_pressure">Luftdruck</span>
                        <select class="setting-select" id="setting-pressure-unit">
                            <option value="hpa">hPa</option>
                            <option value="mbar">mbar</option>
                            <option value="inhg">inHg</option>
                        </select>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="unit_volume">Volumen</span>
                        <select class="setting-select" id="setting-volume-unit">
                            <option value="l">Liter (L)</option>
                            <option value="gal">Gallonen (gal)</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_section_formats">Formate</h4>
                    <div class="setting-item">
                        <span data-i18n="unit_coordinates">Koordinaten</span>
                        <select class="setting-select" id="setting-coordinate-format">
                            <option value="decimal">Dezimal (51.6162)</option>
                            <option value="dm">Grad/Min (51° 36.97')</option>
                            <option value="dms">Grad/Min/Sek (51° 36' 58")</option>
                        </select>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_section_sounds">Töne</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_alarms_toggle">Alarme</span>
                        <div class="toggle active" id="toggle-alarms" onclick="BoatOS.ui.toggleSettingToggle(this, 'alarms')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_notif_toggle">Benachrichtigungen</span>
                        <div class="toggle active" id="toggle-notifications" onclick="BoatOS.ui.toggleSettingToggle(this, 'notifications')"></div>
                    </div>
                </div>
`;

export function init(ctx) {
    // keine tab-spezifischen Aktionen
}

export function load(settings) {
    if (settings.units) {
        const speedUnit = document.getElementById('setting-speed-unit');
        const distanceUnit = document.getElementById('setting-distance-unit');
        const depthUnit = document.getElementById('setting-depth-unit');
        const temperatureUnit = document.getElementById('setting-temperature-unit');
        const pressureUnit = document.getElementById('setting-pressure-unit');
        const volumeUnit = document.getElementById('setting-volume-unit');

        if (speedUnit && settings.units.speed) speedUnit.value = settings.units.speed;
        if (distanceUnit && settings.units.distance) distanceUnit.value = settings.units.distance;
        if (depthUnit && settings.units.depth) depthUnit.value = settings.units.depth;
        if (temperatureUnit && settings.units.temperature) temperatureUnit.value = settings.units.temperature;
        if (pressureUnit && settings.units.pressure) pressureUnit.value = settings.units.pressure;
        if (volumeUnit && settings.units.volume) volumeUnit.value = settings.units.volume;
    }

    const coordFormat = document.getElementById('setting-coordinate-format');
    if (coordFormat && settings.coordFormat) coordFormat.value = settings.coordFormat;

    const langSelect = document.getElementById('setting-language');
    if (langSelect && settings.language) langSelect.value = settings.language;
}

export function collect(settings) {
    settings.units = settings.units || {};

    const speedUnit = document.getElementById('setting-speed-unit');
    const distanceUnit = document.getElementById('setting-distance-unit');
    const depthUnit = document.getElementById('setting-depth-unit');
    const temperatureUnit = document.getElementById('setting-temperature-unit');
    const pressureUnit = document.getElementById('setting-pressure-unit');
    const volumeUnit = document.getElementById('setting-volume-unit');

    if (speedUnit) settings.units.speed = speedUnit.value;
    if (distanceUnit) settings.units.distance = distanceUnit.value;
    if (depthUnit) settings.units.depth = depthUnit.value;
    if (temperatureUnit) settings.units.temperature = temperatureUnit.value;
    if (pressureUnit) settings.units.pressure = pressureUnit.value;
    if (volumeUnit) settings.units.volume = volumeUnit.value;

    const coordFormat = document.getElementById('setting-coordinate-format');
    if (coordFormat) settings.coordFormat = coordFormat.value;

    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        settings.language = langSelect.value;
        settings.ui = { ...(settings.ui || {}), language: langSelect.value };
        setLang(langSelect.value);
    }
}
