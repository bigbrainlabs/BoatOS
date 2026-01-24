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
async function fetchWeather() {
    try {
        // Sprache aus i18n.js holen, Fallback auf Deutsch
        const lang = typeof getLanguage === 'function' ? getLanguage() : 'de';

        // API_URL sollte global verfügbar sein (aus core.js oder app.js)
        const apiUrl = typeof API_URL !== 'undefined' ? API_URL : '';

        const response = await fetch(`${apiUrl}/api/weather?lang=${lang}`);
        if (response.ok) {
            weatherData = await response.json();
            updateWeatherDisplay();
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
}

// ==================== WETTER UI AKTUALISIEREN ====================

/**
 * Aktualisiert die Wetter-Anzeige im Dashboard-Tile
 * Zeigt Temperatur, Beschreibung und Icon an
 */
function updateWeatherDisplay() {
    if (!weatherData || !weatherData.current) return;

    const current = weatherData.current;

    // Wetter-Tile aktualisieren
    const tempElement = document.getElementById('weather-temp');
    const descElement = document.getElementById('weather-desc');
    const iconElement = document.getElementById('weather-icon');

    if (tempElement) {
        tempElement.textContent = current.temp.toFixed(1);
    }
    if (descElement) {
        descElement.textContent = current.description;
    }
    if (iconElement) {
        iconElement.src = `https://openweathermap.org/img/wn/${current.icon}@2x.png`;
    }

    // Wind im Wind-Tile aktualisieren (falls vorhanden)
    if (current.wind_speed !== undefined) {
        const windElement = document.getElementById('wind');
        if (windElement) {
            // Einheiten aus globalen Settings nutzen
            const units = typeof window.getUnitSettings === 'function' ? window.getUnitSettings() : { speed: 'kn' };
            const speedLabel = units.speed === 'kmh' ? 'km/h' : 'kn';
            const speedValue = units.speed === 'kmh' ? current.wind_speed * 1.852 : current.wind_speed;
            windElement.innerHTML =
                `${speedValue.toFixed(0)}<span class="tile-unit">${speedLabel}</span>`;
        }
    }
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
function startWeatherUpdates() {
    // Wetter sofort laden
    fetchWeather();

    // Altes Intervall stoppen falls vorhanden
    if (weatherInterval) {
        clearInterval(weatherInterval);
    }

    // Neues Intervall starten (alle 30 Minuten)
    weatherInterval = setInterval(fetchWeather, WEATHER_UPDATE_INTERVAL);
    console.log('Wetter-Updates gestartet (Intervall: 30 Minuten)');
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
// Bei Verwendung als ES6 Modul diese Exports aktivieren:

export {
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

    // Intervall-Management
    startWeatherUpdates,
    stopWeatherUpdates,
    weatherInterval,
    WEATHER_UPDATE_INTERVAL,

    // State (für externe Zugriffe)
    weatherData
};
