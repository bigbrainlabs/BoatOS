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
        weather_precip_label: "Niederschlag",
        weather_api_h4: "OpenWeather-Zugang",
        weather_api_key: "API-Key",
        weather_api_key_hint: "Eigener Schlüssel für Wetterdaten — kostenlos auf openweathermap.org. Wird auf diesem Gerät gespeichert und hat Vorrang vor der .env-Datei.",
        weather_alert_source: "Quelle",
        weather_alert_source_dwd: "DWD (Deutschland, kostenlos)",
        weather_alert_source_owm: "OpenWeather One Call 3.0 (weltweit, Abo nötig)",
        weather_alert_source_hint: "DWD über Bright Sky: amtlich, ohne Schlüssel — deckt aber nur Deutschland ab. OpenWeather deckt auch das Ausland ab, erfordert jedoch ein separates „One Call by Call“-Abo (der normale API-Key allein reicht dafür nicht).",
        weather_alerts_h4: "Warnungen",
        weather_alerts_official: "Warnungen aktiv",
        weather_alerts_official_hint: "Unwetterwarnungen des Deutschen Wetterdienstes für deine Position (Sturm, Gewitter, Starkregen …)",
        weather_wind_alert: "Eigener Wind-Alarm ab",
        weather_wind_alert_hint: "Zusätzlich zur amtlichen Warnung: Alarm, sobald der Wind diesen Wert erreicht. 0 = aus (nur amtliche Warnungen).",
        weather_alerts_none: "Keine Warnungen",
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

        // Map view - overlay buttons
        map_btn_follow: "📍 Folgen",
        // Map view - quick actions
        map_qa_search: "Suche",
        map_qa_favorites: "Favoriten",
        map_qa_routes: "Routen",
        map_qa_locks: "Schleusen",
        ais_layer_toggle: "AIS auf Karte",
        locks_layer_toggle: "Schleusen auf Karte",
        map_qa_gauges: "Pegel",
        map_qa_satellite: "Satellit",
        map_qa_3d: "3D",
        // Bottom sheet tabs
        sheet_tab_route: "Route",
        sheet_tab_weather: "Wetter",
        sheet_tab_tides: "Gezeiten",
        sheet_tab_logbook: "Logbuch",
        sheet_tab_locks: "Schleusen",
        favorites_header: "⭐ Favoriten",
        // Route section
        route_header: "Aktuelle Route",
        route_stat_time: "Zeit",
        route_stat_locks: "Schleusen",
        route_departure_label: "Abfahrt:",
        route_now_btn: "Jetzt",
        route_offline_btn: "Route offline",
        route_area_offline_btn: "Bereich offline",
        route_weather_btn: "Route-Wetter",
        // Weather section
        wind_overlay_btn: "Wind auf Karte",
        weather_direction: "Richtung",
        weather_humidity_label: "Feuchte",
        weather_forecast_label: "Vorhersage",
        // Logbook section
        logbook_recording: "Aufzeichnung läuft",
        logbook_no_active_trip: "Keine aktive Fahrt",
        logbook_ready: "Bereit zum Starten",
        logbook_paused_badge: "⏸️ PAUSIERT",
        logbook_points_label: "Punkte",
        logbook_duration_label: "Dauer",
        logbook_start_btn: "🚢 Fahrt starten",
        logbook_end_btn: "⚓ Beenden",
        logbook_resume_btn: "▶️ Weiter",
        logbook_recent_entries: "Letzte Einträge",
        logbook_no_entries_placeholder: "Noch keine Einträge",
        logbook_loading_trips: "Lade archivierte Fahrten...",
        logbook_add_btn: "+ Hinzufügen",
        logbook_tab_archive: "Archiv",
        // AIS / Locks sections
        ais_none_in_range: "Keine AIS-Ziele in Reichweite.",
        locks_loading: "Schleusen werden geladen...",
        // Modals
        modal_logentry_title: "📝 Logbuch-Eintrag",
        modal_logentry_notes: "Notizen",
        modal_logentry_weather_cb: "🌤️ Aktuelle Wetterdaten anhängen",
        modal_crew_select_title: "👥 Crew auswählen",
        modal_crew_select_desc: "Wer ist bei dieser Fahrt dabei?",
        modal_crew_start_btn: "🚢 Fahrt starten",
        modal_crew_manage_title_new: "Neues Crew-Mitglied",
        modal_crew_avatar: "Avatar",
        modal_crew_name_label: "Name *",
        modal_crew_role_label: "Rolle",
        modal_crew_phone_label: "Telefon",
        modal_crew_email_label: "E-Mail",
        modal_trip_detail_title: "Fahrt Details",
        crew_name_placeholder: "Vollständiger Name",
        modal_btn_cancel: "Abbrechen",
        modal_btn_save: "Speichern",
        // Search
        search_placeholder: "Hafen, Marina, Schleuse...",
        // Dashboard
        dashboard_loading: "Dashboard wird geladen...",
        widget_log_label: "Im Logbuch aufzeichnen",
        widget_log_hint: "Wert wird pro Track-Punkt mitgespeichert",

        // Settings panel - tabs
        settings_tab_map: "Karte",
        settings_tab_charts: "Seekarten",
        settings_tab_data: "Daten",
        settings_tab_wifi: "WLAN",
        settings_tab_nav: "Navigation",
        settings_tab_ais: "AIS",
        settings_tab_gps: "GPS",
        settings_tab_routing: "Routing",
        settings_tab_system: "System",
        // Settings panel - section headers
        settings_section_display: "Anzeige",
        settings_section_units: "Einheiten",
        settings_section_formats: "Formate",
        settings_section_sounds: "Töne",
        settings_section_alarms: "Alarme",
        settings_section_recording: "Aufzeichnung",
        // Settings panel - footer
        settings_btn_save: "Speichern",
        settings_btn_cancel: "Abbrechen",
        // General tab labels
        setting_language_label: "Sprache",
        unit_volume: "Volumen",
        unit_coordinates: "Koordinaten",
        settings_distance_label: "Distanz",
        settings_alarms_toggle: "Alarme",
        settings_notif_toggle: "Benachrichtigungen",
        // Boat tab
        boat_data_section: "Bootsdaten",
        boat_dimensions_section: "Abmessungen",
        boat_tank_section: "Tank & Verbrauch",
        boat_icon_section: "Boot-Symbol",
        boat_type_label: "Bootstyp",
        boat_length_label: "Länge (m)",
        boat_beam_label: "Breite (m)",
        boat_draft_label: "Tiefgang (m)",
        boat_height_label: "Höhe (m)",
        boat_fuel_cap_label: "Tankinhalt (L)",
        boat_consumption_label: "Verbrauch (L/h)",
        boat_speed_label: "Reisegeschw. (km/h)",
        // Map tab
        settings_map_layers: "Kartenlayer",
        settings_show_ienc: "Amtliche Karten (IENC)",
        settings_show_locks: "Schleusen anzeigen",
        settings_show_gauges: "Pegelstände anzeigen",
        settings_show_harbors: "Häfen & Ankerplätze",
        settings_show_track: "Track anzeigen",
        settings_behavior: "Verhalten",
        settings_auto_center: "Auto-Zentrierung",
        settings_offline_maps: "Offline-Karten",
        settings_offline_maps_desc: "Aktiviere mehrere Regionen für länderübergreifende Navigation. Regionen werden beim Laden einer Kachel der Reihe nach abgefragt.",
        settings_offline_maps_upload_label: ".mbtiles-Datei hochladen (z.B. aus dem BoatOS Karten-Tool):",
        settings_offline_maps_choose: "📂 Datei wählen",
        settings_offline_maps_upload_btn: "⬆ Hochladen",
        settings_offline_maps_hint: "Neue Regionen per tilemaker erstellen und als .mbtiles in ~/BoatOS/data/ ablegen.",
        settings_offline_maps_refresh: "↺ Aktualisieren",
        // Nav tab
        settings_prefer_waterways: "Wasserwege bevorzugen",
        settings_online_routing_fallback: "Online-Routing als Fallback",
        settings_default_speed: "Standard-Geschwindigkeit",
        settings_day_planning: "Tagesplanung",
        settings_daily_hours: "Tägliche Fahrzeit (0 = unbegrenzt)",
        settings_day_start: "Fahrtbeginn täglich",
        settings_arrival_alarm: "Ankunftsalarm",
        settings_alarm_distance: "Alarm-Distanz",
        // AIS tab
        settings_ais_reception: "AIS Empfang",
        settings_ais_active: "AIS aktiviert",
        settings_ais_provider_label: "Anbieter",
        settings_ais_range: "Reichweite",
        settings_ais_interval: "Update-Intervall (Sek.)",
        settings_show_vessel_names: "Schiffsnamen anzeigen",
        settings_collision_warning: "Kollisionswarnung",
        // Charts tab
        settings_installed_charts: "Installierte Seekarten",
        settings_no_charts: "Keine Karten installiert",
        settings_chart_files_btn: "Dateien",
        settings_chart_folder_btn: "Ordner",
        settings_chart_upload_btn: "Hochladen",
        // GPS tab
        settings_gps_device_section: "GPS-Gerät",
        settings_gps_apply_btn: "🔄 Übernehmen & SignalK neu starten",
        settings_gps_status_section: "GPS-Status Einstellungen",
        settings_gps_source_section: "GPS-Quelle",
        settings_gps_sat_threshold: "Wartezeit bei wenig Satelliten",
        settings_gps_datasource: "Datenquelle",
        // Data tab
        settings_lock_db_section: "🗄️ Schleusen-Datenbank",
        settings_import_osm: "🌍 Schleusen von OSM importieren",
        settings_enrich_data: "✨ Daten anreichern",
        settings_quality_report: "📊 Qualitätsbericht anzeigen",
        settings_verify_positions: "📍 Positionen überprüfen & korrigieren",
        // Routing tab
        settings_routing_method_h4: "Routing-Methode",
        settings_routing_provider_label: "Anbieter",
        settings_current_region: "Aktuelle Region",
        settings_switch_region_label: "Region wechseln",
        settings_switch_region_btn: "🔄 Region wechseln",
        settings_water_current_h4: "🌊 Fließgeschwindigkeiten",
        settings_consider_current: "Strömung berücksichtigen",
        // WiFi tab
        settings_wifi_status_h4: "Verbindungsstatus",
        settings_wifi_available_h4: "Verfügbare Netzwerke",
        settings_wifi_saved_h4: "Gespeicherte Netzwerke",
        settings_wifi_disconnect: "Trennen",
        settings_wifi_hotspot_start: "📡 Hotspot starten",
        settings_wifi_hotspot_stop: "Stoppen",
        settings_wifi_adapter_restart: "↺ Adapter neu starten",
        settings_wifi_scan_btn: "Netzwerke scannen",
        // WiFi modal
        settings_wifi_modal_title: "Netzwerk verbinden",
        settings_wifi_modal_cancel: "Abbrechen",
        settings_wifi_modal_connect: "Verbinden",
        // System tab
        settings_sys_version_h4: "Software-Version",
        settings_sys_installed: "Installiert",
        settings_sys_available: "Verfügbar",
        settings_sys_check: "🔄 Auf Updates prüfen",
        settings_sys_update: "⬆️ Jetzt aktualisieren",
        settings_sys_channel: "Update-Kanal",
        settings_sys_channel_stable: "Stabil",
        settings_sys_channel_beta: "Beta (Vorabversionen)",
        settings_sys_channel_note: "Beta liefert Vorabversionen (rc) zum Testen — kann instabil sein.",
        settings_sys_update_progress_h4: "Update-Fortschritt",
        settings_sys_update_note: "Der Pi startet automatisch neu sobald das Update abgeschlossen ist.",
        settings_sys_helm_h4: "Helm (Touchscreen-App)",
        settings_sys_helm_display: "Display erkannt",
        settings_sys_helm_running: "Helm läuft",
        settings_sys_helm_autostart: "Automatisch starten (bei Display)",
        settings_sys_helm_start: "▶ Starten",
        settings_sys_helm_stop_btn: "⏹ Stoppen",
        settings_sys_helm_note: "⚠️ Stoppen beendet den Touchscreen — Deck bleibt per Browser erreichbar.",
        settings_sys_reboot: "🔄 Pi neu starten",
        settings_sys_shutdown: "🔴 Pi herunterfahren",
        // GPS popup
        gps_popup_satellites: "Satelliten",
        gps_popup_altitude: "Höhe",

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
        weather_precip_label: "Precipitation",
        weather_api_h4: "OpenWeather access",
        weather_api_key: "API key",
        weather_api_key_hint: "Your own key for weather data — free at openweathermap.org. Stored on this device and takes precedence over the .env file.",
        weather_alert_source: "Source",
        weather_alert_source_dwd: "DWD (Germany, free)",
        weather_alert_source_owm: "OpenWeather One Call 3.0 (worldwide, subscription required)",
        weather_alert_source_hint: "DWD via Bright Sky: official, no key needed — but covers Germany only. OpenWeather also covers other countries, but requires a separate \"One Call by Call\" subscription (the regular API key alone is not enough).",
        weather_alerts_h4: "Warnings",
        weather_alerts_official: "Warnings enabled",
        weather_alerts_official_hint: "Severe-weather warnings from the German Weather Service for your position (storm, thunderstorm, heavy rain …)",
        weather_wind_alert: "Own wind alarm from",
        weather_wind_alert_hint: "In addition to official warnings: alarm as soon as the wind reaches this value. 0 = off (official warnings only).",
        weather_alerts_none: "No warnings",
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

        // Map view - overlay buttons
        map_btn_follow: "📍 Follow",
        // Map view - quick actions
        map_qa_search: "Search",
        map_qa_favorites: "Favorites",
        map_qa_routes: "Routes",
        map_qa_locks: "Locks",
        ais_layer_toggle: "AIS on map",
        locks_layer_toggle: "Locks on map",
        map_qa_gauges: "Gauges",
        map_qa_satellite: "Satellite",
        map_qa_3d: "3D",
        // Bottom sheet tabs
        sheet_tab_route: "Route",
        sheet_tab_weather: "Weather",
        sheet_tab_tides: "Tides",
        sheet_tab_logbook: "Logbook",
        sheet_tab_locks: "Locks",
        favorites_header: "⭐ Favourites",
        // Route section
        route_header: "Current Route",
        route_stat_time: "Time",
        route_stat_locks: "Locks",
        route_departure_label: "Departure:",
        route_now_btn: "Now",
        route_offline_btn: "Route offline",
        route_area_offline_btn: "Area offline",
        route_weather_btn: "Route weather",
        // Weather section
        wind_overlay_btn: "Wind on map",
        weather_direction: "Direction",
        weather_humidity_label: "Humidity",
        weather_forecast_label: "Forecast",
        // Logbook section
        logbook_recording: "Recording...",
        logbook_no_active_trip: "No active trip",
        logbook_ready: "Ready to start",
        logbook_paused_badge: "⏸️ PAUSED",
        logbook_points_label: "Points",
        logbook_duration_label: "Duration",
        logbook_start_btn: "🚢 Start trip",
        logbook_end_btn: "⚓ End",
        logbook_resume_btn: "▶️ Continue",
        logbook_recent_entries: "Recent Entries",
        logbook_no_entries_placeholder: "No entries yet",
        logbook_loading_trips: "Loading archived trips...",
        logbook_add_btn: "+ Add",
        logbook_tab_archive: "Archive",
        // AIS / Locks sections
        ais_none_in_range: "No AIS targets in range.",
        locks_loading: "Loading locks...",
        // Modals
        modal_logentry_title: "📝 Log Entry",
        modal_logentry_notes: "Notes",
        modal_logentry_weather_cb: "🌤️ Attach current weather data",
        modal_crew_select_title: "👥 Select Crew",
        modal_crew_select_desc: "Who is on this trip?",
        modal_crew_start_btn: "🚢 Start trip",
        modal_crew_manage_title_new: "New Crew Member",
        modal_crew_avatar: "Avatar",
        modal_crew_name_label: "Name *",
        modal_crew_role_label: "Role",
        modal_crew_phone_label: "Phone",
        modal_crew_email_label: "E-Mail",
        modal_trip_detail_title: "Trip Details",
        crew_name_placeholder: "Full Name",
        modal_btn_cancel: "Cancel",
        modal_btn_save: "Save",
        // Search
        search_placeholder: "Harbour, Marina, Lock...",
        // Dashboard
        dashboard_loading: "Loading dashboard...",
        widget_log_label: "Log in logbook",
        widget_log_hint: "Value is saved per track point",

        // Settings panel - tabs
        settings_tab_map: "Map",
        settings_tab_charts: "Charts",
        settings_tab_data: "Data",
        settings_tab_wifi: "WiFi",
        settings_tab_nav: "Navigation",
        settings_tab_ais: "AIS",
        settings_tab_gps: "GPS",
        settings_tab_routing: "Routing",
        settings_tab_system: "System",
        // Settings panel - section headers
        settings_section_display: "Display",
        settings_section_units: "Units",
        settings_section_formats: "Formats",
        settings_section_sounds: "Sounds",
        settings_section_alarms: "Alarms",
        settings_section_recording: "Recording",
        // Settings panel - footer
        settings_btn_save: "Save",
        settings_btn_cancel: "Cancel",
        // General tab labels
        setting_language_label: "Language",
        unit_volume: "Volume",
        unit_coordinates: "Coordinates",
        settings_distance_label: "Distance",
        settings_alarms_toggle: "Alarms",
        settings_notif_toggle: "Notifications",
        // Boat tab
        boat_data_section: "Boat Data",
        boat_dimensions_section: "Dimensions",
        boat_tank_section: "Tank & Consumption",
        boat_icon_section: "Boat Icon",
        boat_type_label: "Boat Type",
        boat_length_label: "Length (m)",
        boat_beam_label: "Beam (m)",
        boat_draft_label: "Draft (m)",
        boat_height_label: "Height (m)",
        boat_fuel_cap_label: "Fuel Capacity (L)",
        boat_consumption_label: "Consumption (L/h)",
        boat_speed_label: "Cruise Speed (km/h)",
        // Map tab
        settings_map_layers: "Map Layers",
        settings_show_ienc: "Official charts (IENC)",
        settings_show_locks: "Show Locks",
        settings_show_gauges: "Show Water Levels",
        settings_show_harbors: "Harbours & Anchorages",
        settings_show_track: "Show Track",
        settings_behavior: "Behavior",
        settings_offline_maps: "Offline Maps",
        settings_offline_maps_desc: "Enable multiple regions for cross-border navigation. Regions are queried in order when loading a tile.",
        settings_offline_maps_upload_label: "Upload .mbtiles file (e.g. from the BoatOS map tool):",
        settings_offline_maps_choose: "📂 Choose file",
        settings_offline_maps_upload_btn: "⬆ Upload",
        settings_offline_maps_hint: "Create new regions with tilemaker and place .mbtiles files in ~/BoatOS/data/.",
        settings_offline_maps_refresh: "↺ Refresh",
        settings_auto_center: "Auto Center",
        // Nav tab
        settings_prefer_waterways: "Prefer Waterways",
        settings_online_routing_fallback: "Online routing as fallback",
        settings_default_speed: "Default Speed",
        settings_day_planning: "Day Planning",
        settings_daily_hours: "Daily travel time (0 = unlimited)",
        settings_day_start: "Daily departure",
        settings_arrival_alarm: "Arrival Alarm",
        settings_alarm_distance: "Alarm Distance",
        // AIS tab
        settings_ais_reception: "AIS Reception",
        settings_ais_active: "AIS enabled",
        settings_ais_provider_label: "Provider",
        settings_ais_range: "Range",
        settings_ais_interval: "Update Interval (Sec.)",
        settings_show_vessel_names: "Show Vessel Names",
        settings_collision_warning: "Collision Warning",
        // Charts tab
        settings_installed_charts: "Installed Charts",
        settings_no_charts: "No charts installed",
        settings_chart_files_btn: "Files",
        settings_chart_folder_btn: "Folder",
        settings_chart_upload_btn: "Upload",
        // GPS tab
        settings_gps_device_section: "GPS Device",
        settings_gps_apply_btn: "🔄 Apply & Restart SignalK",
        settings_gps_status_section: "GPS Status Settings",
        settings_gps_source_section: "GPS Source",
        settings_gps_sat_threshold: "Wait time with low satellites",
        settings_gps_datasource: "Data Source",
        // Data tab
        settings_lock_db_section: "🗄️ Lock Database",
        settings_import_osm: "🌍 Import Locks from OSM",
        settings_enrich_data: "✨ Enrich Data",
        settings_quality_report: "📊 Show Quality Report",
        settings_verify_positions: "📍 Verify & Fix Positions",
        // Routing tab
        settings_routing_method_h4: "Routing Method",
        settings_routing_provider_label: "Provider",
        settings_current_region: "Current Region",
        settings_switch_region_label: "Switch Region",
        settings_switch_region_btn: "🔄 Switch Region",
        settings_water_current_h4: "🌊 Flow Speeds",
        settings_consider_current: "Consider Current",
        // WiFi tab
        settings_wifi_status_h4: "Connection Status",
        settings_wifi_available_h4: "Available Networks",
        settings_wifi_saved_h4: "Saved Networks",
        settings_wifi_disconnect: "Disconnect",
        settings_wifi_hotspot_start: "📡 Start Hotspot",
        settings_wifi_hotspot_stop: "Stop",
        settings_wifi_adapter_restart: "↺ Restart Adapter",
        settings_wifi_scan_btn: "Scan Networks",
        // WiFi modal
        settings_wifi_modal_title: "Connect to Network",
        settings_wifi_modal_cancel: "Cancel",
        settings_wifi_modal_connect: "Connect",
        // System tab
        settings_sys_version_h4: "Software Version",
        settings_sys_installed: "Installed",
        settings_sys_available: "Available",
        settings_sys_check: "🔄 Check for Updates",
        settings_sys_update: "⬆️ Update Now",
        settings_sys_channel: "Update channel",
        settings_sys_channel_stable: "Stable",
        settings_sys_channel_beta: "Beta (pre-releases)",
        settings_sys_channel_note: "Beta ships pre-releases (rc) for testing — may be unstable.",
        settings_sys_update_progress_h4: "Update Progress",
        settings_sys_update_note: "The Pi will automatically reboot when the update is complete.",
        settings_sys_helm_h4: "Helm (Touchscreen App)",
        settings_sys_helm_display: "Display detected",
        settings_sys_helm_running: "Helm running",
        settings_sys_helm_autostart: "Auto-start (with display)",
        settings_sys_helm_start: "▶ Start",
        settings_sys_helm_stop_btn: "⏹ Stop",
        settings_sys_helm_note: "⚠️ Stopping ends the touchscreen — Deck remains accessible via browser.",
        settings_sys_reboot: "🔄 Restart Pi",
        settings_sys_shutdown: "🔴 Shut Down Pi",
        // GPS popup
        gps_popup_satellites: "Satellites",
        gps_popup_altitude: "Altitude",

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

function applyI18n(root = document) {
    // Update text content
    root.querySelectorAll("[data-i18n]").forEach(el => {
        el.textContent = t(el.getAttribute("data-i18n"));
    });

    // Update placeholders
    root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
        el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
    });
}
window.applyI18n = applyI18n;

function updateUI() {
    applyI18n(document);
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
