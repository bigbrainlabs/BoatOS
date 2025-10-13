/**
 * BoatOS Units Management
 * Handles unit conversions and settings
 * Integrated with settings.js
 */

// Get current units from settings (settings.js manages the storage)
function getCurrentUnits() {
    // Check if currentSettings from settings.js is available
    if (typeof currentSettings !== 'undefined' && currentSettings.general) {
        return {
            distance: currentSettings.general.distanceUnit || 'nm',
            speed: currentSettings.general.speedUnit || 'kn',
            depth: currentSettings.general.depthUnit || 'm',
            temperature: currentSettings.general.temperatureUnit || 'c',
            pressure: currentSettings.general.pressureUnit || 'hpa',
            coordinateFormat: currentSettings.general.coordinateFormat || 'decimal',
            dateFormat: currentSettings.general.dateFormat || 'dd.mm.yyyy'
        };
    }

    // Fallback to default units
    return {
        distance: 'nm',
        speed: 'kn',
        depth: 'm',
        temperature: 'c',
        pressure: 'hpa',
        coordinateFormat: 'decimal',
        dateFormat: 'dd.mm.yyyy'
    };
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
        case 'kmh': return knots * 1.852; // km/h
        case 'mph': return knots * 1.15078; // Statute Miles per Hour
        case 'ms': return knots * 0.514444; // meters per second
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
        case 'c': return celsius; // Celsius
        case 'f': return (celsius * 9/5) + 32; // Fahrenheit
        default: return celsius;
    }
}

function convertPressure(hpa, targetUnit) {
    switch (targetUnit) {
        case 'hpa': return hpa; // Hectopascal
        case 'mbar': return hpa; // Millibar (same as hPa)
        case 'inhg': return hpa * 0.02953; // Inches of Mercury
        default: return hpa;
    }
}

// ==================== COORDINATE FORMATTING ====================

function formatCoordinates(lat, lon, format) {
    format = format || getCurrentUnits().coordinateFormat;

    switch (format) {
        case 'decimal':
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;

        case 'dm': // Degrees and decimal minutes
            const latDM = decimalToDM(lat, 'lat');
            const lonDM = decimalToDM(lon, 'lon');
            return `${latDM}, ${lonDM}`;

        case 'dms': // Degrees, minutes, seconds
            const latDMS = decimalToDMS(lat, 'lat');
            const lonDMS = decimalToDMS(lon, 'lon');
            return `${latDMS}, ${lonDMS}`;

        default:
            return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
}

function decimalToDM(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutes = (absolute - degrees) * 60;
    const direction = type === 'lat'
        ? (decimal >= 0 ? 'N' : 'S')
        : (decimal >= 0 ? 'E' : 'W');
    return `${degrees}° ${minutes.toFixed(3)}' ${direction}`;
}

function decimalToDMS(decimal, type) {
    const absolute = Math.abs(decimal);
    const degrees = Math.floor(absolute);
    const minutesDecimal = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesDecimal);
    const seconds = (minutesDecimal - minutes) * 60;
    const direction = type === 'lat'
        ? (decimal >= 0 ? 'N' : 'S')
        : (decimal >= 0 ? 'E' : 'W');
    return `${degrees}° ${minutes}' ${seconds.toFixed(1)}" ${direction}`;
}

// ==================== DATE FORMATTING ====================

function formatDate(date, format) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }

    format = format || getCurrentUnits().dateFormat;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    switch (format) {
        case 'dd.mm.yyyy':
            return `${day}.${month}.${year}`;
        case 'mm/dd/yyyy':
            return `${month}/${day}/${year}`;
        case 'yyyy-mm-dd':
            return `${year}-${month}-${day}`;
        case 'iso':
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
        default:
            return `${day}.${month}.${year}`;
    }
}

function formatDateTime(date, format) {
    if (!(date instanceof Date)) {
        date = new Date(date);
    }

    format = format || getCurrentUnits().dateFormat;

    const dateStr = formatDate(date, format);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    // ISO format already includes time
    if (format === 'iso') {
        return dateStr;
    }

    return `${dateStr} ${hours}:${minutes}`;
}

// ==================== FORMATTING ====================

function formatDistance(meters, decimals = 2) {
    const units = getCurrentUnits();
    const value = convertDistance(meters, units.distance);
    return value.toFixed(decimals) + ' ' + getUnitLabel('distance');
}

function formatSpeed(knots, decimals = 1) {
    const units = getCurrentUnits();
    const value = convertSpeed(knots, units.speed);
    return value.toFixed(decimals) + ' ' + getUnitLabel('speed');
}

function formatDepth(meters, decimals = 1) {
    const units = getCurrentUnits();
    const value = convertDepth(meters, units.depth);
    return value.toFixed(decimals) + ' ' + getUnitLabel('depth');
}

function formatTemperature(celsius, decimals = 1) {
    const units = getCurrentUnits();
    const value = convertTemperature(celsius, units.temperature);
    return value.toFixed(decimals) + getUnitLabel('temperature');
}

function formatPressure(hpa, decimals = 0) {
    const units = getCurrentUnits();
    const value = convertPressure(hpa, units.pressure);
    return value.toFixed(decimals) + ' ' + getUnitLabel('pressure');
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
    const units = getCurrentUnits();

    switch (type) {
        case 'distance':
            if (units.distance === 'nm') return 'NM';
            if (units.distance === 'km') return 'km';
            if (units.distance === 'mi') return 'mi';
            if (units.distance === 'm') return 'm';
            return units.distance.toUpperCase();

        case 'speed':
            if (units.speed === 'kn') return 'kn';
            if (units.speed === 'kmh') return 'km/h';
            if (units.speed === 'mph') return 'mph';
            if (units.speed === 'ms') return 'm/s';
            return units.speed.toUpperCase();

        case 'depth':
            if (units.depth === 'm') return 'm';
            if (units.depth === 'ft') return 'ft';
            if (units.depth === 'fathom') return 'fathom';
            return units.depth;

        case 'temperature':
            const tempUnit = units.temperature === 'c' ? 'C' : 'F';
            return '°' + tempUnit;

        case 'pressure':
            if (units.pressure === 'hpa') return 'hPa';
            if (units.pressure === 'mbar') return 'mbar';
            if (units.pressure === 'inhg') return 'inHg';
            return units.pressure;

        default:
            return '';
    }
}
