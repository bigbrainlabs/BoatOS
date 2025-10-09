// BoatOS i18n - Deutsch/English
const translations = {
    de: {
        sensor_speed: "Geschw.", sensor_heading: "Kurs", sensor_depth: "Tiefe", sensor_wind: "Wind",
        btn_waypoint: "📍 Wegpunkt", btn_route: "🛤️ Route", btn_logbook: "📓 Logbuch", btn_sensors: "📊 Sensoren",
        notify_waypoint_added: "📍 Wegpunkt gesetzt",
        notify_route_active: "🛤️ Routenplanung aktiv - Tippe auf Karte",
        notify_route_ended: "🛤️ Routenplanung beendet",
        notify_route_saved: "💾 Route gespeichert",
        notify_logbook_soon: "📓 Logbuch - Demnächst verfügbar\!",
        notify_sensors_soon: "📊 Sensor-Details - Demnächst verfügbar\!",
    },
    en: {
        sensor_speed: "Speed", sensor_heading: "Heading", sensor_depth: "Depth", sensor_wind: "Wind",
        btn_waypoint: "📍 Waypoint", btn_route: "🛤️ Route", btn_logbook: "📓 Logbook", btn_sensors: "📊 Sensors",
        notify_waypoint_added: "📍 Waypoint added",
        notify_route_active: "🛤️ Route planning active - Tap on map",
        notify_route_ended: "🛤️ Route planning ended",
        notify_route_saved: "💾 Route saved",
        notify_logbook_soon: "📓 Logbook - Coming soon\!",
        notify_sensors_soon: "📊 Sensor details - Coming soon\!",
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
