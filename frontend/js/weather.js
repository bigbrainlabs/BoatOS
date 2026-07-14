/**
 * BoatOS Weather Modul
 * Verwaltet Wetterdaten, Anzeige und Aktualisierung
 *
 * Benötigt:
 * - API_URL aus core.js
 * - getLanguage() aus i18n.js
 * - formatTemperature(), formatSpeed(), formatPressure(), formatDistance() aus units.js
 */

// ==================== IMPORTS ====================
// Diese Variablen müssen aus core.js importiert werden, wenn das Modul-System verwendet wird
// import { API_URL } from './core.js';

import {
    setRouteWind, setCurrentWind, windColor,
    isWindOverlayVisible,
} from './weather-map.js';

// ==================== STATE ====================
// Wetterdaten werden hier gecached
let weatherData = null;

// Wetter-Aktualisierungsintervall (30 Minuten in Millisekunden)
let weatherInterval = null;
const WEATHER_UPDATE_INTERVAL = 1800000; // 30 Minuten

// ==================== WETTERDATEN LADEN ====================

/**
 * Lädt Wetterdaten vom Backend API
 * Wird regelmäßig aufgerufen, um aktuelle Daten zu erhalten
 */
/**
 * Aktuelle Bootsposition als Query-Parameter — damit Wetter und Warnungen vom
 * TATSAECHLICHEN Standort kommen und nicht vom Aken-Fallback.
 *
 * Das Frontend kennt teils Positionen, die das Backend nicht hat (Browser-
 * Geolocation). Fehlt sie, entscheidet das Backend selbst (Backend-GPS, sonst
 * Fallback).
 */
function posQuery() {
    const p = window.currentPosition;
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return '';
    if (p.lat === 0 && p.lon === 0) return '';
    return `&lat=${p.lat.toFixed(5)}&lon=${p.lon.toFixed(5)}`;
}

async function fetchWeather() {
    try {
        // Sprache aus i18n.js holen, Fallback auf Deutsch
        const lang = typeof getLanguage === 'function' ? getLanguage() : 'de';

        // API_URL sollte global verfügbar sein (aus core.js oder app.js)
        const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';

        const response = await fetch(`${apiUrl}/api/weather?lang=${lang}${posQuery()}`);
        if (response.ok) {
            const data = await response.json();

            // Backend meldet jetzt fehlenden/ungueltigen Key, statt still leer zu bleiben
            if (data && data.error) {
                weatherData = null;
                showWeatherProblem(data.message || 'Wetterdaten nicht verfügbar');
                return;
            }

            weatherData = data;
            rememberFetchPos();      // Bezugspunkt fuer den Bewegungs-Watcher
            showWeatherProblem(null);
            updateWeatherDisplay();
            renderWeatherAlerts();   // eigener Wind-Alarm haengt am aktuellen Wind
            pushCurrentWindToMap();  // Wind-Pfeil am Boot aktualisieren
            console.log('Wetterdaten geladen:', weatherData);
        } else {
            console.warn('Wetter API antwortet nicht:', response.status);
        }
    } catch (error) {
        console.error('Wetter abrufen fehlgeschlagen:', error);
    }
}

/**
 * Lädt Wetterdaten initial
 * Wrapper-Funktion für externe Aufrufe
 */
function loadWeatherData() {
    fetchWeather();
    fetchWeatherAlerts();
}

/**
 * Zeigt in der Wetter-Sektion an, WARUM keine Daten da sind (statt leerem Panel).
 * Der haeufigste Fall: kein OpenWeather-API-Key hinterlegt — ein frisch
 * installiertes BoatOS hat nur den Platzhalter aus .env.example.
 */
function showWeatherProblem(message) {
    const box = document.getElementById('weather-problem');
    if (!box) return;
    if (!message) {
        box.style.display = 'none';
        return;
    }
    box.style.display = 'block';
    box.innerHTML = `
        <div style="background:var(--bg-card); border:1px solid var(--warning, #f59e0b);
                    border-left:4px solid var(--warning, #f59e0b);
                    border-radius:var(--radius-md); padding:var(--space-md);
                    margin-bottom:var(--space-sm); font-size:var(--fs-sm); color:var(--text);">
            ⚠ ${_esc(message)}
            <div style="margin-top:6px;">
                <button class="btn-secondary" style="padding:4px 10px; font-size:12px;"
                        onclick="BoatOS.settings.open('weather')">Einstellungen öffnen</button>
            </div>
        </div>`;
}

// ==================== WETTER-WARNUNGEN ====================
//
// Zwei Quellen, bewusst getrennt:
//  1. AMTLICH — DWD über Bright Sky (Backend /api/weather/alerts), vier Stufen.
//     Standardmäßig aktiv; das ist der Default-Alarm.
//  2. EIGENER SCHWELLWERT — optional. Alarm, sobald der aktuelle Wind den in den
//     Settings gesetzten Wert erreicht. Default 0 = aus.
// Windwerte sind überall in KNOTEN; umgerechnet wird nur für die Anzeige.

let officialAlerts = [];
let alertsInterval = null;
const ALERTS_UPDATE_INTERVAL = 900000;   // 15 Minuten

const SEVERITY_COLOR = {
    Minor:    '#FFD700',
    Moderate: '#FF8C00',
    Severe:   '#FF4500',
    Extreme:  '#8B0000',
};

function _weatherSettings() {
    const s = (typeof window.loadSettings === 'function') ? (window.loadSettings() || {}) : {};
    return s.weather || {};
}

/**
 * Eigener Wind-Alarm — nur wenn ein Schwellwert gesetzt ist und der aktuelle
 * Wind ihn erreicht. Gibt ein Alert-Objekt im selben Format wie die amtlichen
 * zurück, damit die Anzeige nicht zwei Fälle kennen muss.
 */
function getOwnWindAlert() {
    const threshold = Number(_weatherSettings().windAlertKn) || 0;
    const wind = weatherData?.current?.wind_speed;
    if (!threshold || typeof wind !== 'number' || wind < threshold) return null;

    const fmt = (kn) => (window.formatSpeed ? window.formatSpeed(kn, 0) : `${kn.toFixed(0)} kn`);
    return {
        id: 'own-wind',
        own: true,
        event: 'Wind-Alarm',
        headline: `Wind ${fmt(wind)} — Schwelle ${fmt(threshold)} erreicht`,
        description: '',
        instruction: '',
        severity: 'Moderate',
        severity_level: 2,
        color: SEVERITY_COLOR.Moderate,
    };
}

/** Alle aktiven Warnungen (amtlich + eigener Schwellwert), stärkste zuerst. */
function getActiveAlerts() {
    const w = _weatherSettings();
    const list = (w.alertsEnabled !== false) ? [...officialAlerts] : [];
    const own = getOwnWindAlert();
    if (own) list.push(own);
    return list.sort((a, b) => (b.severity_level || 1) - (a.severity_level || 1));
}

let alertsPlace = '';    // Ort/Warnzelle, für die die Warnungen gelten
let alertsSource = 'dwd';

async function fetchWeatherAlerts() {
    try {
        const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';
        const res = await fetch(`${apiUrl}/api/weather/alerts?_${posQuery()}`, { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            officialAlerts = data.alerts || [];
            alertsSource = data.source || 'dwd';
            // DWD/Bright Sky liefert die amtliche Warnzelle mit Namen; OpenWeather
            // kennt keinen Ortsnamen — dann den Ort der Wetterdaten verwenden.
            alertsPlace = data.location?.name || weatherData?.current?.location || '';
        }
    } catch (e) {
        console.warn('Wetter-Warnungen konnten nicht geladen werden:', e.message);
    }
    renderWeatherAlerts();
}

/** Warnungen in der Wetter-Sektion + Badge in der Kopfzeile aktualisieren. */
function renderWeatherAlerts() {
    const alerts = getActiveAlerts();

    // --- Badge oben (nur die stärkste Warnung) ---
    const badge = document.getElementById('weather-alert-badge');
    if (badge) {
        if (alerts.length) {
            const top = alerts[0];
            badge.style.display = 'flex';
            badge.style.background = top.color || SEVERITY_COLOR.Minor;
            badge.style.color = (top.severity === 'Minor') ? '#1A1200' : '#ffffff';
            badge.textContent = `⚠ ${top.event}` + (alerts.length > 1 ? ` +${alerts.length - 1}` : '');
            badge.title = top.headline || top.event;
        } else {
            badge.style.display = 'none';
        }
    }

    // --- Liste in der Wetter-Sektion ---
    const box = document.getElementById('weather-alerts');
    if (!box) return;

    if (!alerts.length) {
        box.innerHTML = '';
        return;
    }

    // Wofür gilt das? Ohne Ortsangabe ist eine Warnung wertlos.
    const srcLabel = (alertsSource === 'owm') ? 'OpenWeather' : 'DWD';
    const head = `
        <div style="font-size:var(--fs-xs); color:var(--text-dim); margin-bottom:var(--space-xs);">
            Warnungen${alertsPlace ? ` für <strong>${_esc(alertsPlace)}</strong>` : ''} · Quelle ${srcLabel}
        </div>`;

    box.innerHTML = head + alerts.map(a => {
        const when = _alertTimeRange(a);
        return `
        <div style="border-left:4px solid ${a.color || SEVERITY_COLOR.Minor};
                    background:var(--bg-card); border:1px solid var(--border);
                    border-radius:var(--radius-md); padding:var(--space-md);
                    margin-bottom:var(--space-sm);">
            <div style="font-weight:600; color:var(--text);">
                ⚠ ${_esc(a.event)}${a.own ? '' : ` <span style="font-weight:400;color:var(--text-dim);font-size:var(--fs-xs);">(DWD)</span>`}
            </div>
            ${a.headline ? `<div style="font-size:var(--fs-sm); color:var(--text); margin-top:2px;">${_esc(a.headline)}</div>` : ''}
            ${when ? `<div style="font-size:var(--fs-xs); color:var(--text-dim); margin-top:2px;">${when}</div>` : ''}
            ${a.instruction ? `<div style="font-size:var(--fs-xs); color:var(--text-dim); margin-top:6px;">${_esc(a.instruction)}</div>` : ''}
        </div>`;
    }).join('');
}

function _alertTimeRange(a) {
    const fmt = (iso) => {
        try {
            return new Date(iso).toLocaleString('de-DE',
                { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch { return null; }
    };
    const from = a.onset || a.effective;
    const to = a.expires;
    if (from && to) return `${fmt(from)} – ${fmt(to)}`;
    if (from) return `ab ${fmt(from)}`;
    return '';
}

function _esc(s) {
    return String(s ?? '').replace(/[&<>"']/g,
        c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Badge-Klick → Wetter-Panel öffnen. */
function openWeatherAlerts() {
    const tab = document.querySelector('.qa-section[onclick*="\'weather\'"]');
    if (window.BoatOS?.ui?.showSection) window.BoatOS.ui.showSection('weather', tab);
}

/**
 * Settings geändert (Warnquelle, Schwellwert, API-Key) → sofort neu auswerten.
 *
 * Ohne das blieb nach einem Quellenwechsel die ALTE Warnung stehen, bis der
 * 15-Minuten-Takt das nächste Mal lief — man stellt auf DWD um und sieht weiter
 * die OpenWeather-Warnung. Genauso greift ein frisch eingetragener API-Key erst
 * dann, wenn die Wetterdaten neu geholt werden.
 */
window.addEventListener('settingsChanged', () => {
    fetchWeather();          // neuer API-Key / neue Einheiten
    fetchWeatherAlerts();    // neue Quelle / neuer Schwellwert
});

function startAlertUpdates() {
    stopAlertUpdates();
    fetchWeatherAlerts();
    alertsInterval = setInterval(fetchWeatherAlerts, ALERTS_UPDATE_INTERVAL);
}

function stopAlertUpdates() {
    if (alertsInterval) { clearInterval(alertsInterval); alertsInterval = null; }
}

// ==================== WETTER UI AKTUALISIEREN ====================

/**
 * Aktualisiert die Wetter-Anzeige im Dashboard-Tile
 * Zeigt Temperatur, Beschreibung und Icon an
 */
const COMPASS_16 = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO',
                    'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function windDirLabel(deg) {
    if (typeof deg !== 'number' || Number.isNaN(deg)) return '--';
    const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16;
    return `${COMPASS_16[idx]} (${Math.round(deg)}°)`;
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

/**
 * Füllt das Wetter-Panel.
 *
 * ACHTUNG, das war komplett kaputt: Die alte Fassung schrieb den Wind nach
 * "#wind" (existiert nicht — im Panel heißt es "weather-wind"), setzte .src auf
 * das Icon (das ist ein <div> mit Emoji, kein <img>) und füllte Ort, Richtung,
 * Feuchte, Druck und Vorhersage überhaupt nicht. Die restliche Render-Logik lag
 * in updateWeatherPanel()/renderWeatherForecast(), die auf IDs einer längst
 * abgelösten UI zeigen (weather-panel-*, #weather-forecast) und nie aufgerufen
 * wurden. Deshalb kam nur Temperatur und Beschreibung an.
 */
function updateWeatherDisplay() {
    if (!weatherData || !weatherData.current) return;
    const c = weatherData.current;

    // Icon ist ein <div> mit Emoji — kein <img>
    const iconEl = document.getElementById('weather-icon');
    if (iconEl) iconEl.textContent = getWeatherEmoji(c.icon);

    setText('weather-temp', `${c.temp.toFixed(1)}°C`);
    setText('weather-desc', c.description || '--');
    setText('weather-location', c.location ? `📍 ${c.location}` : '📍 --');

    // Wind in der eingestellten Einheit
    const units = (typeof window.getUnitSettings === 'function')
        ? window.getUnitSettings() : { speed: 'kn' };
    const label = { kn: 'kn', kmh: 'km/h', mph: 'mph', ms: 'm/s' }[units.speed] || 'kn';
    const factor = { kn: 1, kmh: 1.852, mph: 1.15078, ms: 0.514444 }[units.speed] || 1;

    if (typeof c.wind_speed === 'number') {
        setText('weather-wind', (c.wind_speed * factor).toFixed(1));
        setText('weather-wind-label', `Wind (${label})`);
    }
    setText('weather-wind-dir', windDirLabel(c.wind_deg));
    setText('weather-humidity', `${c.humidity ?? '--'}%`);
    setText('weather-pressure', `${c.pressure ?? '--'}`);
    setText('weather-precip', `${(c.precip ?? 0).toFixed(1)} mm`);

    renderForecastList();
}

/**
 * Vorhersage in die tatsächlich vorhandene Liste (#forecast-list) rendern.
 *
 * WICHTIG: .forecast-list ist ein HORIZONTALER Scroller mit schmalen
 * Hochkant-Kacheln (.forecast-item, min-width ~60-70px, mit .time/.icon/.temp).
 * Breite Zeilen mit Beschreibungstext werden darin zerquetscht — deshalb hier
 * bewusst kompakt: Tag, Symbol, Temperatur, Wind. Die ausführliche Beschreibung
 * hängt im title-Tooltip.
 */
function renderForecastList() {
    const el = document.getElementById('forecast-list');
    if (!el || !weatherData?.forecast?.length) return;

    const units = (typeof window.getUnitSettings === 'function')
        ? window.getUnitSettings() : { speed: 'kn' };
    const label = { kn: 'kn', kmh: 'km/h', mph: 'mph', ms: 'm/s' }[units.speed] || 'kn';
    const factor = { kn: 1, kmh: 1.852, mph: 1.15078, ms: 0.514444 }[units.speed] || 1;

    el.innerHTML = weatherData.forecast.map(f => {
        const day = new Date(f.date).toLocaleDateString('de-DE', { weekday: 'short' });
        const wind = (typeof f.wind_speed === 'number')
            ? `${(f.wind_speed * factor).toFixed(0)} ${label}` : '--';
        const rain = (f.precip > 0) ? `<div class="fc-rain">🌧️ ${f.precip.toFixed(1)}</div>` : '';
        return `
        <div class="forecast-item" title="${_esc(f.description || '')}">
            <div class="time">${day}</div>
            <div class="icon">${getWeatherEmoji(f.icon)}</div>
            <div class="temp">${f.temp.toFixed(0)}°</div>
            <div class="fc-wind">💨 ${wind}</div>
            ${rain}
        </div>`;
    }).join('');
}

/**
 * Öffnet/Schließt das Wetter-Panel mit Details
 */
function toggleWeatherPanel() {
    const panel = document.getElementById('weather-panel');
    if (!panel) return;

    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'block';
        updateWeatherPanel();
    } else {
        panel.style.display = 'none';
    }
}

/**
 * Aktualisiert das erweiterte Wetter-Panel mit allen Details
 * Zeigt aktuelle Wetterdaten und Vorhersage an
 */
function updateWeatherPanel() {
    if (!weatherData || !weatherData.current) return;

    const current = weatherData.current;

    // Formatierung mit Einheitensystem (falls verfügbar)
    const tempFormatted = typeof formatTemperature === 'function'
        ? formatTemperature(current.temp)
        : `${current.temp.toFixed(1)}°C`;

    const feelsFormatted = typeof formatTemperature === 'function'
        ? formatTemperature(current.feels_like)
        : `${current.feels_like.toFixed(1)}°C`;

    const windFormatted = typeof window.formatSpeed === 'function'
        ? window.formatSpeed(current.wind_speed)
        : `${current.wind_speed.toFixed(1)} kn`;

    const pressureFormatted = typeof formatPressure === 'function'
        ? formatPressure(current.pressure)
        : `${current.pressure} hPa`;

    const visibilityFormatted = typeof formatDistance === 'function'
        ? formatDistance(current.visibility * 1852) // Umrechnung von NM in Meter
        : `${current.visibility.toFixed(1)} NM`;

    // Panel-Elemente aktualisieren
    setElementText('weather-panel-temp', tempFormatted);
    setElementText('weather-panel-feels', feelsFormatted);
    setElementText('weather-panel-desc', current.description);
    setElementText('weather-panel-wind', windFormatted);
    setElementText('weather-panel-pressure', pressureFormatted);
    setElementText('weather-panel-humidity', `${current.humidity}%`);
    setElementText('weather-panel-visibility', visibilityFormatted);
    setElementText('weather-panel-clouds', `${current.clouds}%`);

    // Vorhersage rendern
    renderWeatherForecast();
}

/**
 * Rendert die Wettervorhersage im Panel
 */
function renderWeatherForecast() {
    if (!weatherData || !weatherData.forecast) return;

    const forecastElement = document.getElementById('weather-forecast');
    if (!forecastElement) return;

    const forecastHtml = weatherData.forecast.map(f => {
        // Formatierung mit Einheitensystem
        const fTempFormatted = typeof formatTemperature === 'function'
            ? formatTemperature(f.temp)
            : `${f.temp.toFixed(1)}°C`;

        const fWindFormatted = typeof window.formatSpeed === 'function'
            ? window.formatSpeed(f.wind_speed)
            : `${f.wind_speed.toFixed(0)} kn`;

        return `
            <div class="forecast-item">
                <div class="forecast-date">${f.date}</div>
                <img src="https://openweathermap.org/img/wn/${f.icon}.png" alt="${f.description}" style="width:50px">
                <div class="forecast-temp">${fTempFormatted}</div>
                <div class="forecast-wind">${fWindFormatted}</div>
            </div>
        `;
    }).join('');

    forecastElement.innerHTML = forecastHtml;
}

// ==================== WETTER ICON MAPPING ====================

/**
 * Mappt OpenWeatherMap Icon-Codes auf lokale Icons oder Emoji
 * @param {string} iconCode - OpenWeatherMap Icon Code (z.B. "01d", "10n")
 * @returns {string} Icon oder Emoji für das Wetter
 */
function getWeatherIcon(iconCode) {
    const iconMap = {
        // Klarer Himmel
        '01d': 'sunny',      // Tag, klar
        '01n': 'clear_night', // Nacht, klar

        // Wenig Wolken
        '02d': 'partly_cloudy_day',
        '02n': 'partly_cloudy_night',

        // Bewölkt
        '03d': 'cloud',
        '03n': 'cloud',
        '04d': 'cloud',
        '04n': 'cloud',

        // Regen
        '09d': 'rainy',
        '09n': 'rainy',
        '10d': 'rainy',
        '10n': 'rainy',

        // Gewitter
        '11d': 'thunderstorm',
        '11n': 'thunderstorm',

        // Schnee
        '13d': 'ac_unit',
        '13n': 'ac_unit',

        // Nebel
        '50d': 'foggy',
        '50n': 'foggy'
    };

    return iconMap[iconCode] || 'cloud';
}

/**
 * Gibt ein Emoji für den Wetter-Icon-Code zurück
 * @param {string} iconCode - OpenWeatherMap Icon Code
 * @returns {string} Wetter-Emoji
 */
function getWeatherEmoji(iconCode) {
    const emojiMap = {
        '01d': '\u2600\uFE0F',      // Sonne
        '01n': '\uD83C\uDF19',      // Mondsichel
        '02d': '\u26C5',             // Sonne mit Wolke
        '02n': '\u2601\uFE0F',      // Wolke
        '03d': '\u2601\uFE0F',      // Wolke
        '03n': '\u2601\uFE0F',
        '04d': '\u2601\uFE0F',      // Bewölkt
        '04n': '\u2601\uFE0F',
        '09d': '\uD83C\uDF27\uFE0F', // Regenwolke
        '09n': '\uD83C\uDF27\uFE0F',
        '10d': '\uD83C\uDF26\uFE0F', // Sonne mit Regen
        '10n': '\uD83C\uDF27\uFE0F',
        '11d': '\u26C8\uFE0F',      // Gewitter
        '11n': '\u26C8\uFE0F',
        '13d': '\uD83C\uDF28\uFE0F', // Schnee
        '13n': '\uD83C\uDF28\uFE0F',
        '50d': '\uD83C\uDF2B\uFE0F', // Nebel
        '50n': '\uD83C\uDF2B\uFE0F'
    };

    return emojiMap[iconCode] || '\u2601\uFE0F';
}

// ==================== HILFSFUNKTIONEN ====================

/**
 * Setzt den Textinhalt eines Elements sicher
 * @param {string} elementId - ID des DOM-Elements
 * @param {string} text - Zu setzender Text
 */
function setElementText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
    }
}

/**
 * Gibt die aktuellen Wetterdaten zurück
 * @returns {Object|null} Wetterdaten oder null
 */
function getWeatherData() {
    return weatherData;
}

/**
 * Gibt die aktuelle Temperatur zurück
 * @returns {number|null} Temperatur in Celsius oder null
 */
function getCurrentTemperature() {
    if (weatherData && weatherData.current) {
        return weatherData.current.temp;
    }
    return null;
}

/**
 * Gibt die aktuelle Windgeschwindigkeit zurück
 * @returns {number|null} Windgeschwindigkeit in Knoten oder null
 */
function getCurrentWindSpeed() {
    if (weatherData && weatherData.current) {
        return weatherData.current.wind_speed;
    }
    return null;
}

// ==================== INTERVALL-MANAGEMENT ====================

/**
 * Startet das automatische Wetter-Update
 * Lädt Wetter sofort und dann alle 30 Minuten
 */
// Position, fuer die zuletzt geholt wurde — plus Bewegungswaechter
let lastFetchPos = null;
let moveWatchInterval = null;
const WEATHER_MOVE_KM = 10;      // ab hier gelten Wetter/Warnungen als ortsfremd

/** Merkt sich, fuer WELCHEN Ort die aktuellen Daten geholt wurden. */
function rememberFetchPos() {
    const p = window.currentPosition;
    if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
    if (p.lat === 0 && p.lon === 0) return;
    lastFetchPos = { lat: p.lat, lon: p.lon };
}

function _kmBetween(a, b) {
    const R = 6371, rad = (d) => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 +
              Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Bewegungswaechter: Wetter und Warnungen gelten fuer einen ORT. Faehrt man
 * weiter, sind sie irgendwann schlicht falsch — 30 Minuten Warten reicht dann
 * nicht. Ab 10 km Ortsveraenderung wird sofort neu geholt.
 */
function startMoveWatch() {
    if (moveWatchInterval) clearInterval(moveWatchInterval);
    moveWatchInterval = setInterval(() => {
        const p = window.currentPosition;
        if (!p || typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
        if (p.lat === 0 && p.lon === 0) return;
        if (lastFetchPos && _kmBetween(lastFetchPos, p) < WEATHER_MOVE_KM) return;

        rememberFetchPos();
        console.log('Standort deutlich geaendert → Wetter + Warnungen neu holen');
        fetchWeather();
        fetchWeatherAlerts();
    }, 60000);
}

function startWeatherUpdates() {
    // Wetter sofort laden
    fetchWeather();

    // Altes Intervall stoppen falls vorhanden
    if (weatherInterval) {
        clearInterval(weatherInterval);
    }

    // Neues Intervall starten (alle 30 Minuten)
    weatherInterval = setInterval(fetchWeather, WEATHER_UPDATE_INTERVAL);

    // Warnungen laufen in ihrem eigenen, schnelleren Takt (15 min) — eine
    // Unwetterwarnung darf nicht bis zu 30 Minuten alt sein.
    startAlertUpdates();

    // …und beides zusaetzlich, sobald sich der Standort deutlich aendert
    startMoveWatch();

    console.log('Wetter-Updates gestartet (Wetter: 30 min, Warnungen: 15 min, +Ortswechsel)');
}

/**
 * Stoppt das automatische Wetter-Update
 */
function stopWeatherUpdates() {
    if (weatherInterval) {
        clearInterval(weatherInterval);
        weatherInterval = null;
        console.log('Wetter-Updates gestoppt');
    }
}

// ==================== EXPORTS ====================
// ==================== ROUTE-WETTER (Forecast entlang der Route, offline-fähig) ====================

async function showRouteWeather() {
    const coords = (window.BoatOS?.navigation?.getCurrentRouteCoordinates?.() || []);
    if (!coords || coords.length < 2) {
        if (window.BoatOS?.ui?.showNotification) window.BoatOS.ui.showNotification('Keine Route geplant', 'warning');
        else alert('Keine Route geplant');
        return;
    }
    const overlay = _routeWxOverlay();
    overlay.querySelector('.rw-body').innerHTML =
        '<div style="padding:24px;text-align:center;color:var(--text-dim)">Wetter wird geladen…</div>';
    overlay.style.display = 'flex';

    const data = await fetchRouteWeather(coords);
    if (!data) {
        overlay.querySelector('.rw-body').innerHTML =
            '<div style="padding:24px;text-align:center;color:var(--danger)">Fehler beim Laden.</div>';
        return;
    }
    overlay.querySelector('.rw-body').innerHTML = _renderRouteWx(data);

    // Dieselben Punkte auch auf die Karte — wenn das Overlay eingeschaltet ist.
    if (data.available && isWindOverlayVisible()) setRouteWind(data.points || []);
}

function _routeWxOverlay() {
    let ov = document.getElementById('route-weather-overlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'route-weather-overlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:none;align-items:center;justify-content:center;';
    ov.innerHTML = `
        <div style="background:var(--bg-panel,#0d1117);border:1px solid var(--border);border-radius:14px;width:min(560px,94vw);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;">
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid var(--border);">
                <span style="font-size:1rem;font-weight:600;color:var(--text);">🌦 Route-Wetter</span>
                <button onclick="document.getElementById('route-weather-overlay').style.display='none'" style="background:none;border:none;color:var(--text-dim);font-size:1.3rem;cursor:pointer;">✕</button>
            </div>
            <div class="rw-body" style="overflow-y:auto;padding:2px 4px;"></div>
        </div>`;
    ov.addEventListener('click', (e) => { if (e.target === ov) ov.style.display = 'none'; });
    document.body.appendChild(ov);
    return ov;
}

// Eine Quelle fuer die Farbskala — Liste und Karten-Pfeile duerfen nicht
// auseinanderlaufen (gruen <11 kn, gelb <22 kn, rot darueber).
function _windColor(kn) {
    return windColor(kn);
}

/**
 * Wind-Pfeil am Boot: nimmt die aktuelle Bootsposition; ohne GPS die Position,
 * fuer die das Backend das Wetter geholt hat (`_pos`) — dann steht der Pfeil
 * ehrlich dort, wo die Daten herkommen, statt gar nicht.
 */
function pushCurrentWindToMap() {
    const c = weatherData?.current;
    if (!c) return setCurrentWind(null, null, null, null);

    const p = window.currentPosition;
    let lat = null, lon = null;
    if (p && typeof p.lat === 'number' && typeof p.lon === 'number' && !(p.lat === 0 && p.lon === 0)) {
        lat = p.lat; lon = p.lon;
    } else if (Array.isArray(weatherData._pos) && weatherData._pos.length === 2) {
        lat = weatherData._pos[0]; lon = weatherData._pos[1];
    }
    setCurrentWind(lat, lon, c.wind_speed, c.wind_deg, c.gust ?? null);
}

/**
 * Wird beim Einschalten des Overlays gerufen: aktuellen Wind sofort setzen und
 * — sofern eine Route existiert — den Routen-Forecast nachladen, damit der
 * Nutzer die Pfeile nicht erst ueber den Route-Wetter-Dialog "freischalten" muss.
 */
async function refreshWindOverlay() {
    if (!isWindOverlayVisible()) return;
    pushCurrentWindToMap();

    const coords = (window.BoatOS?.navigation?.getCurrentRouteCoordinates?.() || []);
    if (!coords || coords.length < 2) {
        setRouteWind([]);
        return;
    }
    const data = await fetchRouteWeather(coords);
    if (data && data.available) setRouteWind(data.points || []);
}

/** Holt den Routen-Forecast (POST /api/weather/route) — von Dialog UND Overlay genutzt. */
async function fetchRouteWeather(coords) {
    const apiUrl = window.BoatOS?.getApiUrl ? window.BoatOS.getApiUrl() : '';
    const depEl = document.getElementById('departure-datetime');
    let departure = null;
    if (depEl && depEl.value) { try { departure = new Date(depEl.value).toISOString(); } catch (_) {} }
    const rd = window.BoatOS?.navigation?.getCurrentRouteData?.();
    const speedKn = (rd && rd.plannedSpeed) ? rd.plannedSpeed : 6;
    try {
        const res = await fetch(`${apiUrl}/api/weather/route`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ coords: coords.map(c => [c.lat, c.lon]), departure, speedKn }),
        });
        return await res.json();
    } catch (e) {
        console.warn('Route-Wetter fehlgeschlagen:', e);
        return null;
    }
}

function _renderRouteWx(data) {
    if (!data || !data.available) {
        return `<div style="padding:24px;text-align:center;color:var(--text-dim)">${data?.reason || 'Kein Wetter verfügbar.'}</div>`;
    }
    const src = data.offline
        ? `<span style="color:#e3b341">⚠ Offline · Cache (${data.cache_age_min ?? '?'} min alt)</span>`
        : `<span style="color:var(--text-dim)">Live · ${new Date(data.generated_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>`;
    const rows = (data.points || []).map(p => {
        const t = p.eta ? new Date(p.eta).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '--:--';
        const emoji = (p.icon ? getWeatherEmoji(p.icon) : '') || '';
        // Einheiten aus den Settings (Backend liefert kn/°C/km kanonisch)
        const fmtSpd = (window.formatSpeed || ((k) => `${k} kn`));
        const wind = p.wind_speed != null ? fmtSpd(p.wind_speed, 0) : '–';
        const gust = p.gust ? ` <span style="color:var(--text-dim)">(${fmtSpd(p.gust, 0)})</span>` : '';
        const arrow = (p.wind_deg != null)
            ? `<span style="display:inline-block;transform:rotate(${(p.wind_deg + 180) % 360}deg);color:${_windColor(p.wind_speed)}">↑</span>`
            : '';
        const precip = p.precip ? ` · 💧${p.precip} mm` : '';
        const temp = (p.temp != null)
            ? (typeof formatTemperature === 'function' ? formatTemperature(p.temp) : `${p.temp}°`)
            : '';
        const dist = (window.formatDistance ? window.formatDistance(p.km / 1.852) : `${p.km} km`);
        return `
            <div style="display:flex;align-items:center;gap:10px;padding:9px 8px;border-bottom:1px solid var(--border);">
                <div style="min-width:56px;text-align:right;">
                    <div style="font-weight:600;color:var(--text);">${t}</div>
                    <div style="font-size:0.7rem;color:var(--text-dim);">${dist}</div>
                </div>
                <div style="font-size:1.3rem;">${emoji}</div>
                <div style="flex:1;min-width:0;">
                    <div style="color:var(--text);font-size:0.85rem;">${p.description || ''} ${temp}</div>
                    <div style="font-size:0.8rem;color:${_windColor(p.wind_speed)};">${arrow} ${wind}${gust}${precip}</div>
                </div>
            </div>`;
    }).join('');
    return `<div style="padding:6px 8px;font-size:0.75rem;">${src}</div>${rows || '<div style="padding:24px;text-align:center;color:var(--text-dim)">Keine Punkte.</div>'}`;
}

// Bei Verwendung als ES6 Modul diese Exports aktivieren:

export {
    showRouteWeather,
    // Hauptfunktionen
    fetchWeather,
    loadWeatherData,
    updateWeatherDisplay,
    toggleWeatherPanel,
    updateWeatherPanel,

    // Icon-Funktionen
    getWeatherIcon,
    getWeatherEmoji,

    // Getter-Funktionen
    getWeatherData,
    getCurrentTemperature,
    getCurrentWindSpeed,

    // Warnungen
    fetchWeatherAlerts,
    renderWeatherAlerts,
    getActiveAlerts,
    openWeatherAlerts,
    startAlertUpdates,
    stopAlertUpdates,

    // Wind-Overlay auf der Karte
    refreshWindOverlay,
    pushCurrentWindToMap,

    // Intervall-Management
    startWeatherUpdates,
    stopWeatherUpdates,
    weatherInterval,
    WEATHER_UPDATE_INTERVAL,

    // State (für externe Zugriffe)
    weatherData
};
