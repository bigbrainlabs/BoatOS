/**
 * BoatOS Units Management
 * Handles unit conversions and settings
 */

// Default units
const DEFAULT_UNITS = {
    distance: 'nm',  // nm, km, sm (statute miles)
    speed: 'kn',     // kn, km/h, mph
    depth: 'm',      // m, ft, fathom
    temperature: 'C' // C, F
};

// Load units from localStorage or use defaults
let currentUnits = JSON.parse(localStorage.getItem('boatos_units')) || DEFAULT_UNITS;

// Save units to localStorage
function saveUnits() {
    localStorage.setItem('boatos_units', JSON.stringify(currentUnits));
}

// ==================== CONVERSION FUNCTIONS ====================

function convertDistance(meters, targetUnit) {
    switch (targetUnit) {
        case 'nm': return meters / 1852; // Nautical Miles
        case 'km': return meters / 1000; // Kilometers
        case 'sm': return meters / 1609.34; // Statute Miles
        default: return meters / 1852;
    }
}

function convertSpeed(knots, targetUnit) {
    switch (targetUnit) {
        case 'kn': return knots; // Knots
        case 'km/h': return knots * 1.852; // km/h
        case 'mph': return knots * 1.15078; // Statute Miles per Hour
        default: return knots;
    }
}

function convertDepth(meters, targetUnit) {
    switch (targetUnit) {
        case 'm': return meters; // Meters
        case 'ft': return meters * 3.28084; // Feet
        case 'fathom': return meters * 0.546807; // Fathoms
        default: return meters;
    }
}

function convertTemperature(celsius, targetUnit) {
    switch (targetUnit) {
        case 'C': return celsius; // Celsius
        case 'F': return (celsius * 9/5) + 32; // Fahrenheit
        default: return celsius;
    }
}

// ==================== FORMATTING ====================

function formatDistance(meters, decimals = 2) {
    const value = convertDistance(meters, currentUnits.distance);
    return value.toFixed(decimals) + ' ' + currentUnits.distance.toUpperCase();
}

function formatSpeed(knots, decimals = 1) {
    const value = convertSpeed(knots, currentUnits.speed);
    const unit = currentUnits.speed === 'km/h' ? 'km/h' : currentUnits.speed.toUpperCase();
    return value.toFixed(decimals) + ' ' + unit;
}

function formatDepth(meters, decimals = 1) {
    const value = convertDepth(meters, currentUnits.depth);
    return value.toFixed(decimals) + ' ' + currentUnits.depth;
}

function formatTemperature(celsius, decimals = 1) {
    const value = convertTemperature(celsius, currentUnits.temperature);
    return value.toFixed(decimals) + '°' + currentUnits.temperature;
}

// ==================== SETTINGS UI ====================

function openUnitsSettings() {
    document.getElementById('units-modal').style.display = 'block';

    // Update UI with current settings
    document.getElementById('unit-distance').value = currentUnits.distance;
    document.getElementById('unit-speed').value = currentUnits.speed;
    document.getElementById('unit-depth').value = currentUnits.depth;
    document.getElementById('unit-temperature').value = currentUnits.temperature;
}

function closeUnitsSettings() {
    document.getElementById('units-modal').style.display = 'none';
}

function saveUnitsSettings() {
    // Read values from UI
    currentUnits.distance = document.getElementById('unit-distance').value;
    currentUnits.speed = document.getElementById('unit-speed').value;
    currentUnits.depth = document.getElementById('unit-depth').value;
    currentUnits.temperature = document.getElementById('unit-temperature').value;

    // Save to localStorage
    saveUnits();

    // Close modal
    closeUnitsSettings();

    // Show notification
    showNotification('⚙️ Einstellungen gespeichert');

    // Refresh route display if route exists
    if (typeof waypoints !== 'undefined' && waypoints.length >= 2) {
        updateRoute();
    }
}

// Get unit label for display
function getUnitLabel(type) {
    switch (type) {
        case 'distance':
            return currentUnits.distance.toUpperCase();
        case 'speed':
            return currentUnits.speed === 'km/h' ? 'km/h' : currentUnits.speed.toUpperCase();
        case 'depth':
            return currentUnits.depth;
        case 'temperature':
            return '°' + currentUnits.temperature;
        default:
            return '';
    }
}
