/**
 * Weather Alerts Module
 * Fetches and displays DWD weather warnings from Bright Sky API
 */

let weatherAlertsCache = [];
let alertsUpdateInterval = null;

/**
 * Initialize weather alerts system
 */
function initWeatherAlerts() {
    // Fetch alerts immediately
    updateWeatherAlerts();

    // Update every 10 minutes
    alertsUpdateInterval = setInterval(updateWeatherAlerts, 600000);
}

/**
 * Fetch weather alerts from backend
 */
async function updateWeatherAlerts() {
    try {
        const response = await fetch('/api/weather/alerts');
        const data = await response.json();

        if (data && data.alerts) {
            weatherAlertsCache = data.alerts;
            displayWeatherAlerts(data.alerts);
        }
    } catch (error) {
        console.error('Weather alerts fetch error:', error);
    }
}

/**
 * Display weather alerts in UI
 * @param {Array} alerts - Array of alert objects
 */
function displayWeatherAlerts(alerts) {
    const container = document.getElementById('weather-alerts');

    if (!container) return;

    // Hide if no alerts
    if (!alerts || alerts.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
    }

    // Show and build alert boxes
    container.style.display = 'block';
    container.innerHTML = alerts.map(alert => createAlertHTML(alert)).join('');
}

/**
 * Create HTML for a single alert
 * @param {Object} alert - Alert object
 * @returns {string} HTML string
 */
function createAlertHTML(alert) {
    const severityClass = getSeverityClass(alert.severity_level);
    const severityText = getSeverityText(alert.severity);
    const icon = getSeverityIcon(alert.severity_level);

    return `
        <div class="alert-box ${severityClass}">
            <div class="alert-title">
                <span>${icon}</span>
                <span class="alert-severity">${severityText}</span>
            </div>
            <div class="alert-event">${alert.event || 'Wetterwarnung'}</div>
            <div class="alert-desc">${alert.headline || alert.description || ''}</div>
        </div>
    `;
}

/**
 * Get CSS class for severity level
 */
function getSeverityClass(level) {
    if (level === 1) return 'minor';
    if (level === 2) return 'warning';
    return 'severe';  // Level 3 or 4
}

/**
 * Get German severity text
 */
function getSeverityText(severity) {
    const map = {
        'Minor': 'Wetterhinweis',
        'Moderate': 'Warnung',
        'Severe': 'Unwetterwarnung',
        'Extreme': 'Extreme Unwetterwarnung'
    };
    return map[severity] || severity;
}

/**
 * Get icon for severity level
 */
function getSeverityIcon(level) {
    if (level === 1) return '⚠️';
    if (level === 2) return '⚡';
    if (level === 3) return '🌩️';
    return '⛈️';  // Level 4
}

/**
 * Get cached alerts
 */
function getWeatherAlerts() {
    return weatherAlertsCache;
}

/**
 * Clean up intervals
 */
function cleanupWeatherAlerts() {
    if (alertsUpdateInterval) {
        clearInterval(alertsUpdateInterval);
        alertsUpdateInterval = null;
    }
}
