// BoatOS i18n - Deutsch/English
const translations = {
    de: {
        // Sensor tiles
        sensor_speed: "Geschw.",
        sensor_heading: "Kurs",
        sensor_depth: "Tiefe",
        sensor_wind: "Wind",

        // Weather
        weather_temperature: "Temperatur",
        weather_feels_like: "Gefühlt",
        weather_description: "Beschreibung",
        weather_wind: "Wind",
        weather_pressure: "Luftdruck",
        weather_humidity: "Luftfeuchtigkeit",
        weather_visibility: "Sichtweite",
        weather_clouds: "Bewölkung",
        weather_details: "🌦️ Wetter-Details",
        weather_forecast_3day: "3-Tage Vorhersage",
        weather_loading: "Lädt...",

        // Main buttons
        btn_waypoint: "📍 Wegpunkt",
        btn_route: "🛤️ Route",
        btn_logbook: "📓 Logbuch",
        btn_sensors: "📊 Sensoren",
        btn_settings: "⚙️ Einstellungen",

        // Header
        header_map: "🗺️ Karte",
        header_signalk: "SignalK",
        header_gps: "GPS",

        // Notifications
        notify_waypoint_added: "📍 Wegpunkt gesetzt",
        notify_route_active: "🛤️ Routenplanung aktiv - Tippe auf Karte",
        notify_route_ended: "🛤️ Routenplanung beendet",
        notify_route_saved: "💾 Route gespeichert",
        notify_logbook_soon: "📓 Logbuch - Demnächst verfügbar!",
        notify_sensors_soon: "📊 Sensor-Details - Demnächst verfügbar!",

        // GPS Panel
        gps_title: "📡 GPS Details",
        gps_satellites: "Satelliten",
        gps_in_view: "sichtbar",
        gps_altitude: "Höhe",
        gps_speed: "Geschwindigkeit",
        gps_heading: "Kurs",
        gps_fix_status: "Fix Status",
        gps_hdop: "HDOP",
        gps_vdop: "VDOP",
        gps_last_update: "Letzte Aktualisierung",
        gps_position: "Position",
        gps_fix: "GPS Fix",
        gps_no_fix: "Kein Fix",

        // AIS Panel
        ais_vessel_details: "🚢 AIS Schiffs-Details",
        ais_name: "Name",
        ais_mmsi: "MMSI",
        ais_callsign: "Rufzeichen",
        ais_type: "Typ",
        ais_speed: "Geschwindigkeit",
        ais_course: "Kurs (COG)",
        ais_heading: "Heading",
        ais_status: "Status",
        ais_destination: "Ziel",
        ais_eta: "ETA",
        ais_length: "Länge",
        ais_width: "Breite",
        ais_draught: "Tiefgang",

        // Infrastructure
        infrastructure_details: "🔒 Infrastruktur-Details",

        // Logbook
        logbook_title: "📓 Logbuch",
        logbook_current_trip: "Aktuelle Fahrt",
        logbook_archive: "Vergangene Fahrten",
        logbook_entries: "Logbuch-Einträge",
        logbook_new_entry: "📝 Neuer Eintrag",
        logbook_no_entries: "Noch keine Logbuch-Einträge",
        logbook_entry_notes: "Notizen",
        logbook_entry_placeholder: "Was möchtest du festhalten?",
        logbook_save_weather: "🌡️ Aktuelles Wetter speichern",

        // Track recording
        track_start: "▶️ Start",
        track_pause: "⏸️ Pause",
        track_resume: "▶️ Resume",
        track_stop: "⏹️ Stop",
        track_points: "Points",
        track_distance: "Distance",
        track_recording: "Aufzeichnung",

        // Trip details
        trip_details: "🚢 Fahrt-Details",
        trip_distance: "Distanz",
        trip_duration: "Dauer",
        trip_track_points: "Track-Punkte",
        trip_entries: "Einträge",
        trip_timeline: "Timeline",

        // Buttons
        btn_save: "✅ Speichern",
        btn_cancel: "❌ Abbrechen",
        btn_close: "Schließen",
        btn_done: "✅ Fertig",

        // Charts
        charts_manager: "📊 Karten-Manager",
        charts_processing: "📊 Verarbeite Karten...",
        charts_initializing: "Initialisiere...",
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

        // Settings
        settings_title: "⚙️ Einstellungen",
        settings_general: "Allgemein",
        settings_charts: "Karten",
        settings_navigation: "Navigation",
        settings_gps: "GPS",
        settings_weather: "Wetter",
        settings_sensors: "Sensoren",
        settings_ais: "AIS",
        settings_routing: "Routing",
        settings_data: "Daten",

        // General settings
        general_settings: "Allgemeine Einstellungen",
        setting_language: "Sprache / Language",
        setting_theme: "Theme",
        theme_auto: "Automatisch (System)",
        theme_light: "Hell",
        theme_dark: "Dunkel",
        theme_night: "Nacht (Rot)",

        // Units
        units_title: "📏 Einheiten",
        unit_speed: "Geschwindigkeit",
        unit_distance: "Distanz / Entfernung",
        unit_depth: "Tiefe",
        unit_temperature: "Temperatur",
        unit_pressure: "Luftdruck",

        // Formats
        formats_title: "🌍 Formate",
        format_coordinates: "Koordinaten-Format",
        format_date: "Datumsformat",

        // Navigation settings
        nav_settings: "Navigations-Einstellungen",
        nav_map_orientation: "Karten-Ausrichtung",
        nav_north_up: "North-Up (Norden oben)",
        nav_course_up: "Course-Up (Kurs oben)",
        nav_show_track_history: "GPS-Track-Historie anzeigen",
        nav_clear_track_history: "🗑️ Track-Historie löschen",
        nav_show_compass_rose: "Kompass-Rose anzeigen",
        nav_infrastructure_layer: "🏗️ Infrastruktur-Layer",
        nav_infrastructure_enabled: "Infrastruktur auf Karte anzeigen",
        nav_infrastructure_desc: "Zeigt Schleusen, Brücken, Häfen und andere Wasserstraßen-Infrastruktur aus OpenStreetMap",
        nav_infrastructure_show: "Anzeigen:",
        nav_infrastructure_locks: "🔒 Schleusen",
        nav_infrastructure_bridges: "🌉 Brücken",
        nav_infrastructure_harbors: "⚓ Häfen/Marinas",
        nav_infrastructure_weirs: "〰️ Wehre",
        nav_infrastructure_dams: "🏗️ Dämme",
        nav_water_level: "📊 Wasserstands-Pegel",
        nav_water_level_enabled: "Wasserstands-Pegel auf Karte anzeigen",
        nav_water_level_desc: "Zeigt aktuelle Wasserstände von PEGELONLINE (Deutsche Wasserstraßen) - Update alle 15 Minuten",

        // GPS settings
        gps_settings: "GPS-Einstellungen",
        gps_signalk_url: "SignalK Server URL",
        gps_satellite_threshold: "GPS-Status Wartezeit bei wenig Satelliten (Sekunden)",
        gps_satellite_threshold_desc: "Zeit, die weniger als 4 Satelliten empfangen werden müssen, bevor der GPS-Status auf \"nicht verbunden\" wechselt (verhindert Blinken)",

        // Weather settings
        weather_settings: "Wetter-Einstellungen",
        weather_update_interval: "Wetter Update-Intervall (Minuten)",

        // Sensor settings
        sensor_settings: "Sensor-Einstellungen",
        sensor_mqtt_url: "MQTT Broker URL",

        // AIS settings
        ais_settings: "🚢 AIS-Einstellungen",
        ais_enabled: "AIS-Integration aktivieren",
        ais_provider: "AIS-Datenquelle",
        ais_api_key: "API-Key",
        ais_info_title: "ℹ️ AIS-Integration",
        ais_info_what: "Was ist AIS?",
        ais_info_what_desc: "AIS (Automatic Identification System) zeigt Positionen und Details anderer Schiffe in Echtzeit auf der Karte.",
        ais_info_features: "Funktionen:",
        ais_info_features_list: "• Schiffspositionen als Icons auf der Karte\n• Schiffsdetails (Name, MMSI, Kurs, Geschwindigkeit)\n• Navigationsstatus (unterwegs, vor Anker, etc.)\n• Auto-Update alle 60 Sekunden",

        // Routing settings
        routing_settings: "🛤️ Routing-Einstellungen",
        routing_method: "Routing-Methode",
        routing_method_desc: "Wähle die Methode zur Routenberechnung",
        routing_osrm: "OSRM (Lokal, Offline)",
        routing_graphhopper: "GraphHopper (Cloud API)",
        routing_direct: "Direkte Linie (Rhumbline)",
        routing_osrm_url: "OSRM Server-URL",
        routing_osrm_url_desc: "URL des lokalen OSRM-Servers",
        routing_graphhopper_key: "GraphHopper API-Key",
        routing_graphhopper_desc: "🌊 Für Cloud-basierte Routen (500 Anfragen/Tag kostenlos)",
        routing_osrm_info_title: "🚀 OSRM Routing (Empfohlen)",
        routing_osrm_info_what: "Was ist OSRM?",
        routing_osrm_info_desc: "Open Source Routing Machine - Lokaler Routing-Server auf dem Raspberry Pi, der speziell für Wasserwege konfiguriert ist.",
        routing_osrm_advantages: "Vorteile:",
        routing_osrm_advantages_list: "⚡ Blitzschnell (< 100ms)\n🌊 Folgt echten Wasserwegen (Flüsse, Kanäle, Fairways)\n📡 Komplett offline\n♾️ Unbegrenzte Anfragen\n🆓 Kostenlos",
        routing_graphhopper_info_title: "☁️ GraphHopper Routing",
        routing_graphhopper_info_what: "Was ist GraphHopper?",
        routing_graphhopper_info_desc: "Cloud-basierter Routing-Service über API.",
        routing_graphhopper_note: "Hinweis:",
        routing_graphhopper_note_list: "⚠️ Kostenlose Version routet über Land, nicht über Wasserwege\n📶 Benötigt Internetverbindung\n🔢 Begrenzt auf 500 Anfragen/Tag",
        routing_direct_info_title: "📏 Direkte Linie (Rhumbline)",
        routing_direct_info_desc: "Einfachste Methode:",
        routing_direct_desc: "Berechnet direkte Linien zwischen Wegpunkten ohne Wasserwege zu berücksichtigen.",
        routing_direct_features: "✅ Funktioniert immer\n📡 Offline\n⚠️ Ignoriert Wasserwege und Hindernisse",

        // Data settings
        data_settings: "Daten-Verwaltung",
        data_export_settings: "📥 Einstellungen exportieren",
        data_import_settings: "📤 Einstellungen importieren",
        data_reset_settings: "🔄 Auf Standardwerte zurücksetzen",

        // Boat settings
        settings_boat: "Boot",
        boat_settings: "🚤 Boot-Einstellungen",
        boat_specs_title: "Boot-Spezifikationen",
        boat_specs_desc: "Diese Daten werden für Routenplanung und Verbrauchsberechnung verwendet",
        boat_length: "Bootslänge",
        boat_length_desc: "Gesamtlänge des Bootes",
        boat_beam: "Bootsbreite (Beam)",
        boat_beam_desc: "Maximale Breite des Bootes",
        boat_draft: "Tiefgang",
        boat_draft_desc: "Tiefe des Bootes unter der Wasserlinie",
        boat_height: "Höhe über Wasserlinie",
        boat_height_desc: "Maximale Höhe über der Wasserlinie (wichtig für Brücken)",
        boat_fuel_consumption: "Kraftstoffverbrauch",
        boat_fuel_consumption_desc: "Durchschnittlicher Verbrauch bei Reisegeschwindigkeit",
        boat_fuel_capacity: "Tankinhalt",
        boat_fuel_capacity_desc: "Gesamtkapazität des Kraftstofftanks",
        boat_cruise_speed: "Reisegeschwindigkeit",
        boat_cruise_speed_desc: "Typische Geschwindigkeit für Routenplanung",
        boat_name: "Bootsname",
        boat_name_desc: "Name Ihres Bootes (optional)",
        boat_type: "Bootstyp",
        boat_type_motorboat: "Motorboot",
        boat_type_sailboat: "Segelboot",
        boat_type_yacht: "Yacht",
        boat_type_cabin_cruiser: "Kabinenkreuzer",
        boat_type_other: "Sonstiges",
        boat_routing_info_title: "ℹ️ Routing-Optimierung",
        boat_routing_info_desc: "Ihre Boot-Spezifikationen werden für die Routenplanung verwendet:",
        boat_routing_info_features: "• Tiefgang → Vermeidung flacher Gewässer\n• Höhe → Vermeidung niedriger Brücken\n• Breite → Vermeidung enger Kanäle\n• Verbrauch → Reichweiten-Berechnung",

        // Common
        common_on: "An",
        common_off: "Aus",
        common_yes: "Ja",
        common_no: "Nein",
    },
    en: {
        // Sensor tiles
        sensor_speed: "Speed",
        sensor_heading: "Heading",
        sensor_depth: "Depth",
        sensor_wind: "Wind",

        // Weather
        weather_temperature: "Temperature",
        weather_feels_like: "Feels like",
        weather_description: "Description",
        weather_wind: "Wind",
        weather_pressure: "Pressure",
        weather_humidity: "Humidity",
        weather_visibility: "Visibility",
        weather_clouds: "Clouds",
        weather_details: "🌦️ Weather Details",
        weather_forecast_3day: "3-Day Forecast",
        weather_loading: "Loading...",

        // Main buttons
        btn_waypoint: "📍 Waypoint",
        btn_route: "🛤️ Route",
        btn_logbook: "📓 Logbook",
        btn_sensors: "📊 Sensors",
        btn_settings: "⚙️ Settings",

        // Header
        header_map: "🗺️ Map",
        header_signalk: "SignalK",
        header_gps: "GPS",

        // Notifications
        notify_waypoint_added: "📍 Waypoint added",
        notify_route_active: "🛤️ Route planning active - Tap on map",
        notify_route_ended: "🛤️ Route planning ended",
        notify_route_saved: "💾 Route saved",
        notify_logbook_soon: "📓 Logbook - Coming soon!",
        notify_sensors_soon: "📊 Sensor details - Coming soon!",

        // GPS Panel
        gps_title: "📡 GPS Details",
        gps_satellites: "Satellites",
        gps_in_view: "in View",
        gps_altitude: "Altitude",
        gps_speed: "Speed",
        gps_heading: "Heading",
        gps_fix_status: "Fix Status",
        gps_hdop: "HDOP",
        gps_vdop: "VDOP",
        gps_last_update: "Last Update",
        gps_position: "Position",
        gps_fix: "GPS Fix",
        gps_no_fix: "No Fix",

        // AIS Panel
        ais_vessel_details: "🚢 AIS Vessel Details",
        ais_name: "Name",
        ais_mmsi: "MMSI",
        ais_callsign: "Callsign",
        ais_type: "Type",
        ais_speed: "Speed",
        ais_course: "Course (COG)",
        ais_heading: "Heading",
        ais_status: "Status",
        ais_destination: "Destination",
        ais_eta: "ETA",
        ais_length: "Length",
        ais_width: "Width",
        ais_draught: "Draught",

        // Infrastructure
        infrastructure_details: "🔒 Infrastructure Details",

        // Logbook
        logbook_title: "📓 Logbook",
        logbook_current_trip: "Current Trip",
        logbook_archive: "Past Trips",
        logbook_entries: "Logbook Entries",
        logbook_new_entry: "📝 New Entry",
        logbook_no_entries: "No logbook entries yet",
        logbook_entry_notes: "Notes",
        logbook_entry_placeholder: "What do you want to record?",
        logbook_save_weather: "🌡️ Save current weather",

        // Track recording
        track_start: "▶️ Start",
        track_pause: "⏸️ Pause",
        track_resume: "▶️ Resume",
        track_stop: "⏹️ Stop",
        track_points: "Points",
        track_distance: "Distance",
        track_recording: "Recording",

        // Trip details
        trip_details: "🚢 Trip Details",
        trip_distance: "Distance",
        trip_duration: "Duration",
        trip_track_points: "Track Points",
        trip_entries: "Entries",
        trip_timeline: "Timeline",

        // Buttons
        btn_save: "✅ Save",
        btn_cancel: "❌ Cancel",
        btn_close: "Close",
        btn_done: "✅ Done",

        // Charts
        charts_manager: "📊 Charts Manager",
        charts_processing: "📊 Processing Charts...",
        charts_initializing: "Initializing...",
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

        // Settings
        settings_title: "⚙️ Settings",
        settings_general: "General",
        settings_charts: "Charts",
        settings_navigation: "Navigation",
        settings_gps: "GPS",
        settings_weather: "Weather",
        settings_sensors: "Sensors",
        settings_ais: "AIS",
        settings_routing: "Routing",
        settings_data: "Data",

        // General settings
        general_settings: "General Settings",
        setting_language: "Language / Sprache",
        setting_theme: "Theme",
        theme_auto: "Automatic (System)",
        theme_light: "Light",
        theme_dark: "Dark",
        theme_night: "Night (Red)",

        // Units
        units_title: "📏 Units",
        unit_speed: "Speed",
        unit_distance: "Distance",
        unit_depth: "Depth",
        unit_temperature: "Temperature",
        unit_pressure: "Pressure",

        // Formats
        formats_title: "🌍 Formats",
        format_coordinates: "Coordinate Format",
        format_date: "Date Format",

        // Navigation settings
        nav_settings: "Navigation Settings",
        nav_map_orientation: "Map Orientation",
        nav_north_up: "North-Up",
        nav_course_up: "Course-Up",
        nav_show_track_history: "Show GPS Track History",
        nav_clear_track_history: "🗑️ Clear Track History",
        nav_show_compass_rose: "Show Compass Rose",
        nav_infrastructure_layer: "🏗️ Infrastructure Layer",
        nav_infrastructure_enabled: "Show infrastructure on map",
        nav_infrastructure_desc: "Shows locks, bridges, harbors and other waterway infrastructure from OpenStreetMap",
        nav_infrastructure_show: "Show:",
        nav_infrastructure_locks: "🔒 Locks",
        nav_infrastructure_bridges: "🌉 Bridges",
        nav_infrastructure_harbors: "⚓ Harbors/Marinas",
        nav_infrastructure_weirs: "〰️ Weirs",
        nav_infrastructure_dams: "🏗️ Dams",
        nav_water_level: "📊 Water Level Gauges",
        nav_water_level_enabled: "Show water level gauges on map",
        nav_water_level_desc: "Shows current water levels from PEGELONLINE (German Waterways) - Updates every 15 minutes",

        // GPS settings
        gps_settings: "GPS Settings",
        gps_signalk_url: "SignalK Server URL",
        gps_satellite_threshold: "GPS Status Wait Time at Low Satellites (Seconds)",
        gps_satellite_threshold_desc: "Time that less than 4 satellites must be received before GPS status changes to \"not connected\" (prevents blinking)",

        // Weather settings
        weather_settings: "Weather Settings",
        weather_update_interval: "Weather Update Interval (Minutes)",

        // Sensor settings
        sensor_settings: "Sensor Settings",
        sensor_mqtt_url: "MQTT Broker URL",

        // AIS settings
        ais_settings: "🚢 AIS Settings",
        ais_enabled: "Enable AIS Integration",
        ais_provider: "AIS Data Source",
        ais_api_key: "API Key",
        ais_info_title: "ℹ️ AIS Integration",
        ais_info_what: "What is AIS?",
        ais_info_what_desc: "AIS (Automatic Identification System) shows positions and details of other vessels in real-time on the map.",
        ais_info_features: "Features:",
        ais_info_features_list: "• Vessel positions as icons on the map\n• Vessel details (name, MMSI, course, speed)\n• Navigation status (underway, at anchor, etc.)\n• Auto-update every 60 seconds",

        // Routing settings
        routing_settings: "🛤️ Routing Settings",
        routing_method: "Routing Method",
        routing_method_desc: "Choose the method for route calculation",
        routing_osrm: "OSRM (Local, Offline)",
        routing_graphhopper: "GraphHopper (Cloud API)",
        routing_direct: "Direct Line (Rhumbline)",
        routing_osrm_url: "OSRM Server URL",
        routing_osrm_url_desc: "URL of the local OSRM server",
        routing_graphhopper_key: "GraphHopper API Key",
        routing_graphhopper_desc: "🌊 For cloud-based routes (500 requests/day free)",
        routing_osrm_info_title: "🚀 OSRM Routing (Recommended)",
        routing_osrm_info_what: "What is OSRM?",
        routing_osrm_info_desc: "Open Source Routing Machine - Local routing server on Raspberry Pi, configured specifically for waterways.",
        routing_osrm_advantages: "Advantages:",
        routing_osrm_advantages_list: "⚡ Lightning fast (< 100ms)\n🌊 Follows real waterways (rivers, canals, fairways)\n📡 Completely offline\n♾️ Unlimited requests\n🆓 Free",
        routing_graphhopper_info_title: "☁️ GraphHopper Routing",
        routing_graphhopper_info_what: "What is GraphHopper?",
        routing_graphhopper_info_desc: "Cloud-based routing service via API.",
        routing_graphhopper_note: "Note:",
        routing_graphhopper_note_list: "⚠️ Free version routes overland, not via waterways\n📶 Requires internet connection\n🔢 Limited to 500 requests/day",
        routing_direct_info_title: "📏 Direct Line (Rhumbline)",
        routing_direct_info_desc: "Simplest method:",
        routing_direct_desc: "Calculates direct lines between waypoints without considering waterways.",
        routing_direct_features: "✅ Always works\n📡 Offline\n⚠️ Ignores waterways and obstacles",

        // Data settings
        data_settings: "Data Management",
        data_export_settings: "📥 Export Settings",
        data_import_settings: "📤 Import Settings",
        data_reset_settings: "🔄 Reset to Defaults",

        // Boat settings
        settings_boat: "Boat",
        boat_settings: "🚤 Boat Settings",
        boat_specs_title: "Boat Specifications",
        boat_specs_desc: "This data is used for route planning and fuel consumption calculations",
        boat_length: "Boat Length",
        boat_length_desc: "Overall length of the boat",
        boat_beam: "Boat Beam (Width)",
        boat_beam_desc: "Maximum width of the boat",
        boat_draft: "Draft",
        boat_draft_desc: "Depth of the boat below the waterline",
        boat_height: "Height Above Waterline",
        boat_height_desc: "Maximum height above waterline (important for bridges)",
        boat_fuel_consumption: "Fuel Consumption",
        boat_fuel_consumption_desc: "Average consumption at cruising speed",
        boat_fuel_capacity: "Fuel Capacity",
        boat_fuel_capacity_desc: "Total capacity of the fuel tank",
        boat_cruise_speed: "Cruising Speed",
        boat_cruise_speed_desc: "Typical speed for route planning",
        boat_name: "Boat Name",
        boat_name_desc: "Name of your boat (optional)",
        boat_type: "Boat Type",
        boat_type_motorboat: "Motorboat",
        boat_type_sailboat: "Sailboat",
        boat_type_yacht: "Yacht",
        boat_type_cabin_cruiser: "Cabin Cruiser",
        boat_type_other: "Other",
        boat_routing_info_title: "ℹ️ Routing Optimization",
        boat_routing_info_desc: "Your boat specifications are used for route planning:",
        boat_routing_info_features: "• Draft → Avoid shallow waters\n• Height → Avoid low bridges\n• Beam → Avoid narrow channels\n• Consumption → Range calculations",

        // Common
        common_on: "On",
        common_off: "Off",
        common_yes: "Yes",
        common_no: "No",
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
    // Update text content
    document.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.getAttribute("data-i18n"));
    });

    // Update placeholders
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
}

function toggleLanguage() {
    const newLang = currentLang === "de" ? "en" : "de";
    setLanguage(newLang);
    const langEl = document.getElementById("current-lang");
    if (langEl) {
        langEl.textContent = newLang === "de" ? "🇩🇪 DE" : "🇬🇧 EN";
    }
    showMsg(newLang === "de" ? "Sprache: Deutsch" : "Language: English");
    // Reload weather with new language
    if (typeof fetchWeather === "function") fetchWeather();
}

window.addEventListener("load", function() {
    const langEl = document.getElementById("current-lang");
    if (langEl) {
        langEl.textContent = currentLang === "de" ? "🇩🇪 DE" : "🇬🇧 EN";
    }
    updateUI();
});
