/**
 * Settings-Tab: Navigation (Routing-Präferenzen, Tagesplanung, Alarme)
 */

export const id = 'nav';

export const html = `
                <div class="setting-group">
                    <h4>Routing</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_prefer_waterways">Wasserwege bevorzugen</span>
                        <div class="toggle active" id="toggle-waterways" onclick="BoatOS.ui.toggleSettingToggle(this, 'preferWaterways')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_online_routing_fallback">Online-Routing als Fallback</span>
                        <div class="toggle active" id="toggle-online-routing" onclick="BoatOS.ui.toggleSettingToggle(this, 'onlineRoutingFallback')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_default_speed">Standard-Geschwindigkeit</span>
                        <input type="number" class="setting-input" id="setting-default-speed" value="6" step="0.5"> <span class="unit-speed">kn</span>
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_day_planning">Tagesplanung</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_daily_hours">Tägliche Fahrzeit (0 = unbegrenzt)</span>
                        <div style="display:flex; align-items:center; gap:var(--space-sm);">
                            <input type="number" class="setting-input" id="setting-daily-travel-hours" value="0" min="0" max="24" step="0.5" style="width:60px;">
                            <span style="color:var(--text-dim); font-size:var(--fs-sm);">h</span>
                        </div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_day_start">Fahrtbeginn täglich</span>
                        <input type="time" class="setting-input" id="setting-day-start-time" value="08:00" style="width:90px;">
                    </div>
                </div>

                <div class="setting-group">
                    <h4 data-i18n="settings_section_alarms">Alarme</h4>
                    <div class="setting-item">
                        <span data-i18n="settings_arrival_alarm">Ankunftsalarm</span>
                        <div class="toggle active" id="toggle-arrival-alarm" onclick="BoatOS.ui.toggleSettingToggle(this, 'arrivalAlarm')"></div>
                    </div>
                    <div class="setting-item">
                        <span data-i18n="settings_alarm_distance">Alarm-Distanz</span>
                        <input type="number" class="setting-input" id="setting-alarm-distance" value="0.1" step="0.05"> <span id="setting-alarm-dist-unit" class="unit-distance">NM</span>
                    </div>
                </div>
`;

export function init(ctx) {
    // keine tab-spezifischen Aktionen
}

export function load(settings, ctx) {
    if (!settings.navigation) return;

    const toggleWaterways = document.getElementById('toggle-waterways');
    const defaultSpeed = document.getElementById('setting-default-speed');
    const toggleArrivalAlarm = document.getElementById('toggle-arrival-alarm');
    const alarmDistance = document.getElementById('setting-alarm-distance');

    if (toggleWaterways) toggleWaterways.classList.toggle('active', settings.navigation.preferWaterways !== false);
    if (defaultSpeed && settings.navigation.defaultSpeed) defaultSpeed.value = settings.navigation.defaultSpeed;
    if (toggleArrivalAlarm) toggleArrivalAlarm.classList.toggle('active', settings.navigation.arrivalAlarm !== false);
    if (alarmDistance && settings.navigation.alarmDistance) alarmDistance.value = settings.navigation.alarmDistance;

    const dailyHours = document.getElementById('setting-daily-travel-hours');
    const dayStartTime = document.getElementById('setting-day-start-time');
    if (dailyHours && settings.navigation.dailyTravelHours !== undefined) dailyHours.value = settings.navigation.dailyTravelHours;
    if (dayStartTime && settings.navigation.dayStartTime) dayStartTime.value = settings.navigation.dayStartTime;

    const toggleOnlineRouting = document.getElementById('toggle-online-routing');
    if (toggleOnlineRouting && settings.routing) {
        // Default true — Toggle ist aktiv außer explizit false
        toggleOnlineRouting.classList.toggle('active', settings.routing.onlineRoutingFallback !== false);
    }
    // Hinweis: Weitergabe an navigation.js (setDailyTravelHours etc.) macht sync() im Koordinator
}

export function collect(settings) {
    settings.navigation = settings.navigation || {};

    const toggleWaterways = document.getElementById('toggle-waterways');
    const defaultSpeed = document.getElementById('setting-default-speed');
    const toggleArrivalAlarm = document.getElementById('toggle-arrival-alarm');
    const alarmDistance = document.getElementById('setting-alarm-distance');

    if (toggleWaterways) settings.navigation.preferWaterways = toggleWaterways.classList.contains('active');
    if (defaultSpeed) settings.navigation.defaultSpeed = parseFloat(defaultSpeed.value) || 6;
    if (toggleArrivalAlarm) settings.navigation.arrivalAlarm = toggleArrivalAlarm.classList.contains('active');
    if (alarmDistance) settings.navigation.alarmDistance = parseFloat(alarmDistance.value) || 0.1;

    const dailyHours = document.getElementById('setting-daily-travel-hours');
    const dayStartTime = document.getElementById('setting-day-start-time');
    if (dailyHours) settings.navigation.dailyTravelHours = parseFloat(dailyHours.value) || 0;
    if (dayStartTime) settings.navigation.dayStartTime = dayStartTime.value || '08:00';

    const toggleOnlineRouting = document.getElementById('toggle-online-routing');
    if (toggleOnlineRouting) {
        settings.routing = settings.routing || {};
        settings.routing.onlineRoutingFallback = toggleOnlineRouting.classList.contains('active');
    }
}
