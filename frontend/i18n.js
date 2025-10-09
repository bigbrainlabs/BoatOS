// BoatOS i18n - Deutsch/English
const translations = {
    de: {
        sensor_speed: "Geschw.", sensor_heading: "Kurs", sensor_depth: "Tiefe", sensor_wind: "Wind",
        weather_temperature: "Temperatur", weather_feels_like: "Gefühlt", weather_description: "Beschreibung",
        weather_wind: "Wind", weather_pressure: "Luftdruck", weather_humidity: "Luftfeuchtigkeit",
        weather_visibility: "Sichtweite", weather_clouds: "Bewölkung",
        btn_waypoint: "📍 Wegpunkt", btn_route: "🛤️ Route", btn_logbook: "📓 Logbuch", btn_sensors: "📊 Sensoren",
        notify_waypoint_added: "📍 Wegpunkt gesetzt",
        notify_route_active: "🛤️ Routenplanung aktiv - Tippe auf Karte",
        notify_route_ended: "🛤️ Routenplanung beendet",
        notify_route_saved: "💾 Route gespeichert",
        notify_logbook_soon: "📓 Logbuch - Demnächst verfügbar\!",
        notify_sensors_soon: "📊 Sensor-Details - Demnächst verfügbar\!",
        gps_hdop: "HDOP", gps_vdop: "VDOP",
        charts_manager: "📊 Karten-Manager",
        elwis_enc_download: "ELWIS ENC herunterladen",
        load_catalog: "Katalog laden",
        select_all: "Alle",
        select_none: "Keine",
        click_load_catalog: "Klicke \"Katalog laden\" um verfügbare Gewässer zu sehen",
        download_selected: "Ausgewählte herunterladen",
        upload_chart: "Karte hochladen",
        select_files: "📄 Dateien wählen",
        select_folder: "📁 Ordner wählen",
        chart_name_optional: "Karten-Name (optional)",
        upload: "📤 Hochladen",
        supported_formats: "Unterstützt: KAP, ENC (.000), ZIP (Tiles), MBTiles, GeoTIFF",
    },
    en: {
        sensor_speed: "Speed", sensor_heading: "Heading", sensor_depth: "Depth", sensor_wind: "Wind",
        weather_temperature: "Temperature", weather_feels_like: "Feels like", weather_description: "Description",
        weather_wind: "Wind", weather_pressure: "Pressure", weather_humidity: "Humidity",
        weather_visibility: "Visibility", weather_clouds: "Clouds",
        btn_waypoint: "📍 Waypoint", btn_route: "🛤️ Route", btn_logbook: "📓 Logbook", btn_sensors: "📊 Sensors",
        notify_waypoint_added: "📍 Waypoint added",
        notify_route_active: "🛤️ Route planning active - Tap on map",
        notify_route_ended: "🛤️ Route planning ended",
        notify_route_saved: "💾 Route saved",
        notify_logbook_soon: "📓 Logbook - Coming soon\!",
        notify_sensors_soon: "📊 Sensor details - Coming soon\!",
        charts_manager: "📊 Charts Manager",
        elwis_enc_download: "Download ELWIS ENC",
        load_catalog: "Load Catalog",
        select_all: "All",
        select_none: "None",
        click_load_catalog: "Click \"Load Catalog\" to see available waterways",
        download_selected: "Download Selected",
        upload_chart: "Upload Chart",
        select_files: "📄 Select Files",
        select_folder: "📁 Select Folder",
        chart_name_optional: "Chart Name (optional)",
        upload: "📤 Upload",
        supported_formats: "Supported: KAP, ENC (.000), ZIP (Tiles), MBTiles, GeoTIFF",
    }
};

let currentLang = localStorage.getItem("boatos_lang") || "de";

function t(key) {
    return translations[currentLang][key] || translations["de"][key] || key;
}

function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("boatos_lang", lang);
    updateUI();
    // Refresh weather data with new language
    if (typeof fetchWeather === 'function') {
        fetchWeather();
    }
}

function getLanguage() {
    return currentLang;
}

function updateUI() {
    document.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.getAttribute("data-i18n"));
    });
}

function toggleLanguage() {
    const newLang = currentLang === "de" ? "en" : "de";
    setLanguage(newLang);
    document.getElementById("current-lang").textContent = newLang === "de" ? "🇩🇪 DE" : "🇬🇧 EN";
    showMsg(newLang === "de" ? "Sprache: Deutsch" : "Language: English");
    // Reload weather with new language
    if (typeof fetchWeather === "function") fetchWeather();
}

window.addEventListener("load", function() {
    document.getElementById("current-lang").textContent = currentLang === "de" ? "🇩🇪 DE" : "🇬🇧 EN";
    updateUI();
});

// Logbook translations
translations.de.logbook_title = '📓 Logbuch';
translations.de.track_start = '▶️ Aufzeichnung starten';
translations.de.track_stop = '⏹️ Aufzeichnung stoppen';
translations.de.track_points = 'Punkte';
translations.de.track_distance = 'Distanz';
translations.de.previous_tracks = 'Vorherige Tracks';
translations.de.no_tracks = 'Noch keine Tracks aufgezeichnet';

translations.en.logbook_title = '📓 Logbook';
translations.en.track_start = '▶️ Start Recording';
translations.en.track_stop = '⏹️ Stop Recording';
translations.en.track_points = 'Points';
translations.en.track_distance = 'Distance';
translations.en.previous_tracks = 'Previous Tracks';
translations.en.no_tracks = 'No tracks recorded yet';

// GPS Panel translations
translations.de.gps_title = '📡 GPS Details';
translations.de.gps_satellites = 'Satelliten';
translations.de.gps_in_view = 'sichtbar';
translations.de.gps_altitude = 'Höhe';
translations.de.gps_speed = 'Geschwindigkeit';
translations.de.gps_heading = 'Kurs';
translations.de.gps_fix_status = 'Fix Status';
translations.de.gps_last_update = 'Letzte Aktualisierung';
translations.de.gps_position = 'Position';
translations.de.gps_fix = 'GPS Fix';
translations.de.gps_no_fix = 'Kein Fix';

translations.en.gps_title = '📡 GPS Details';
translations.en.gps_satellites = 'Satellites';
translations.en.gps_in_view = 'in View';
translations.en.gps_altitude = 'Altitude';
translations.en.gps_speed = 'Speed';
translations.en.gps_heading = 'Heading';
translations.en.gps_fix_status = 'Fix Status';
translations.en.gps_last_update = 'Last Update';
translations.en.gps_position = 'Position';
translations.en.gps_fix = 'GPS Fix';
translations.en.gps_no_fix = 'No Fix';
translations.en.gps_hdop = 'HDOP';
translations.en.gps_vdop = 'VDOP';
