// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for German (`de`).
class AppLocalizationsDe extends AppLocalizations {
  AppLocalizationsDe([String locale = 'de']) : super(locale);

  @override
  String get appTitle => 'BoatOS';

  @override
  String get navTabMap => 'Karte';

  @override
  String get navTabDashboard => 'Dashboard';

  @override
  String get navTabLogbook => 'Logbuch';

  @override
  String get btnCancel => 'Abbrechen';

  @override
  String get btnSave => 'Speichern';

  @override
  String get btnDelete => 'Löschen';

  @override
  String get btnAdd => 'Hinzufügen';

  @override
  String get btnStop => 'Stoppen';

  @override
  String get btnConnect => 'Verbinden';

  @override
  String get btnDone => 'Fertig';

  @override
  String get btnEnd => 'Beenden';

  @override
  String get systemDialogTitle => 'System';

  @override
  String get systemDialogBody => 'Was soll das BoatOS-System jetzt tun?';

  @override
  String get systemRestart => 'Neu starten';

  @override
  String get systemShutdown => 'Herunterfahren';

  @override
  String get updateAvailable => 'Update verfügbar';

  @override
  String get updateCheck => 'Auf Updates prüfen';

  @override
  String get updateNow => 'Jetzt aktualisieren';

  @override
  String get updateProgress => 'Update-Fortschritt';

  @override
  String get updateRunning => 'Update läuft…';

  @override
  String get updateChecking => 'Prüfe…';

  @override
  String get updateUpToDate => '✅ System ist aktuell';

  @override
  String get updateAvailableStatus => '🆕 Update verfügbar';

  @override
  String get updateRestarting => 'Verbindung getrennt — Pi startet neu…';

  @override
  String get hotspotActive => 'Hotspot aktiv';

  @override
  String get hotspotSsid => 'SSID';

  @override
  String get hotspotPassword => 'Passwort';

  @override
  String get hotspotIp => 'IP';

  @override
  String get wifiTitle => 'WLAN';

  @override
  String get wifiAdapterRestart => 'Adapter neu starten';

  @override
  String get wifiAvailableNetworks => 'Verfügbare Netzwerke';

  @override
  String get wifiSearching => 'Suche Netzwerke…';

  @override
  String get wifiConnected => 'Verbunden';

  @override
  String get wifiNotConnected => 'Nicht verbunden';

  @override
  String get wifiConnectedSaved => 'Verbunden · Gespeichert';

  @override
  String get wifiSaved => 'Gespeichert';

  @override
  String get wifiStartHotspot => 'Hotspot starten';

  @override
  String get wifiDisconnect => 'Trennen';

  @override
  String wifiSignal(String signal) {
    return 'Signal: $signal%';
  }

  @override
  String get wifiForget => 'Vergessen';

  @override
  String wifiForgetTitle(String ssid) {
    return '\"$ssid\" vergessen?';
  }

  @override
  String get wifiForgetBody => 'Das gespeicherte Profil wird gelöscht.';

  @override
  String wifiConnectTo(String ssid) {
    return 'Verbinden mit \"$ssid\"';
  }

  @override
  String get wifiPasswordLabel => 'WLAN-Passwort';

  @override
  String get wifiPasswordHint => 'Passwort eingeben…';

  @override
  String get gpsStatusTitle => 'GPS Status';

  @override
  String get gpsFix => 'Fix';

  @override
  String get gpsNoFix => 'Kein Fix';

  @override
  String get gpsSatellites => 'Satelliten';

  @override
  String get gpsAltitude => 'Höhe';

  @override
  String get gpsPosition => 'Position';

  @override
  String get gpsNoData => 'Keine GPS-Daten empfangen';

  @override
  String get gpsQualityVeryGood => 'sehr gut';

  @override
  String get gpsQualityGood => 'gut';

  @override
  String get gpsQualityOk => 'ok';

  @override
  String get gpsQualityBad => 'schlecht';

  @override
  String get dashboardNoLayout => 'Kein Dashboard-Layout konfiguriert.';

  @override
  String get dashboardNoScreens => 'Keine Screens im Layout.';

  @override
  String get dashboardNoWidgets => 'Keine Widgets im Layout.';

  @override
  String get dashboardAlarmMute => 'Alarm stumm';

  @override
  String get mapOfflineFallback =>
      '⚠ Offline-Karten nicht verfügbar · Online-Fallback (OpenStreetMap)';

  @override
  String get mapLayerLocks => 'Schleusen';

  @override
  String get mapLayerGauge => 'Pegel';

  @override
  String get mapLayerFavorites => 'Favoriten';

  @override
  String get mapPlanRoute => 'Route planen';

  @override
  String mapDeleteWaypointTitle(int index) {
    return 'Wegpunkt $index löschen?';
  }

  @override
  String get mapSavedRoutesTitle => 'Gespeicherte Routen';

  @override
  String get mapNoSavedRoutes => 'Keine gespeicherten Routen.';

  @override
  String get mapSaveRoute => 'Route speichern';

  @override
  String get mapRouteNameHint => 'Name eingeben…';

  @override
  String get mapSimulation => 'Simulation';

  @override
  String get mapSimStop => 'Sim Stop';

  @override
  String get mapNavigation => 'Navigation';

  @override
  String get mapNavStop => 'Stopp';

  @override
  String get mapNow => 'Jetzt';

  @override
  String get mapToday => 'heute';

  @override
  String get mapDeparture => 'Abfahrt:';

  @override
  String get mapDirect => 'Direkt';

  @override
  String get mapLongTapHint =>
      'Langer Tipp auf die Karte, um Wegpunkt zu setzen';

  @override
  String get mapMobTitle => '🆘 SOS / Man Over Board';

  @override
  String get mapMobConfirm => 'GPS-Position jetzt als MOB-Marker setzen?';

  @override
  String get mapMobSet => 'MOB SETZEN';

  @override
  String get navstatEngine => 'Unter Maschine';

  @override
  String get navstatAnchored => 'Geankert';

  @override
  String get navstatNUC => 'Nicht manövrierfähig';

  @override
  String get navstatRestricted => 'Eingeschränkt manövrierfähig';

  @override
  String get navstatMoored => 'Festgemacht';

  @override
  String get navstatAground => 'Auf Grund';

  @override
  String get navstatFishing => 'Fischerei';

  @override
  String get navstatUnknown => 'Unbekannt';

  @override
  String get routePlannerHint => 'Langer Tipp auf die Karte → Wegpunkt setzen';

  @override
  String get logbookTitle => 'Logbuch';

  @override
  String get logbookTabTrip => 'Fahrt';

  @override
  String get logbookTabArchive => 'Archiv';

  @override
  String get logbookTabCrew => 'Crew';

  @override
  String get logbookNoActiveTrip => 'Keine aktive Fahrtaufzeichnung';

  @override
  String get logbookStartTrip => 'Fahrt starten';

  @override
  String get logbookDistance => 'Distanz';

  @override
  String get logbookDuration => 'Dauer';

  @override
  String get logbookPoints => 'Punkte';

  @override
  String get logbookAvgSpeed => 'Ø Geschw.';

  @override
  String get logbookPause => 'Pause';

  @override
  String get logbookResume => 'Weiter';

  @override
  String get logbookEndTrip => 'Fahrt beenden';

  @override
  String get logbookAddNote => 'Notiz hinzufügen';

  @override
  String get logbookEndTripTitle => 'Fahrt beenden?';

  @override
  String get logbookEndTripBody =>
      'Die Aufzeichnung wird gestoppt und gespeichert.';

  @override
  String get logbookStopFailed => 'Stop fehlgeschlagen';

  @override
  String get logbookStartFailed => 'Start fehlgeschlagen';

  @override
  String get logbookPauseFailed => 'Pause fehlgeschlagen';

  @override
  String get logbookResumeFailed => 'Fortsetzen fehlgeschlagen';

  @override
  String get logbookNoteHint => 'Notiz...';

  @override
  String get logbookNoteSaveFailed => 'Notiz konnte nicht gespeichert werden';

  @override
  String get logbookPaused => 'Pausiert';

  @override
  String get logbookRecording => 'Aufzeichnung läuft';

  @override
  String get logbookNoTrips => 'Keine Fahrten gespeichert';

  @override
  String get logbookCrewForTrip => 'Crew für diese Fahrt';

  @override
  String get logbookCrewOptional => 'Optional — kann leer bleiben';

  @override
  String get logbookNoCrewAvailable => 'Keine Crew-Mitglieder vorhanden.';

  @override
  String get logbookLoadError => 'Fehler beim Laden.';

  @override
  String get logbookWeatherStart => 'Wetter (Start)';

  @override
  String get logbookWaterLevels => 'Pegelstände';

  @override
  String get logbookStats => 'Statistiken';

  @override
  String get logbookMaxSpeed => 'Max Speed';

  @override
  String get logbookAvgSpeedStat => 'Ø Speed';

  @override
  String get logbookEntries => 'Logeinträge';

  @override
  String get logbookOnMap => 'Auf Karte';

  @override
  String logbookGpxSaved(String path) {
    return 'GPX gespeichert: $path';
  }

  @override
  String get logbookGpxFailed => 'GPX-Export fehlgeschlagen';

  @override
  String get logbookStart => 'Start';

  @override
  String get logbookEnd => 'Ende';

  @override
  String get logbookContinue => 'Weiterfahrt';

  @override
  String get logbookNote => 'Notiz';

  @override
  String get logbookTripsCount => 'Fahrten';

  @override
  String get crewAddTitle => 'Crew hinzufügen';

  @override
  String get crewEditTitle => 'Crew bearbeiten';

  @override
  String get crewAvatar => 'Avatar';

  @override
  String get crewName => 'Name';

  @override
  String get crewRole => 'Rolle';

  @override
  String get crewEmail => 'E-Mail (optional)';

  @override
  String get crewPhone => 'Telefon (optional)';

  @override
  String get crewNameRequired => 'Name erforderlich';

  @override
  String crewDeleteTitle(String name) {
    return '$name löschen?';
  }

  @override
  String get crewDeleteBody => 'Crew-Mitglied wird entfernt.';

  @override
  String get crewDeleteFailed => 'Löschen fehlgeschlagen';

  @override
  String get crewEmpty => 'Keine Crew-Mitglieder';

  @override
  String favoritesTitle(int count) {
    return 'Favoriten ($count)';
  }

  @override
  String get favoritesEmpty => 'Keine Favoriten gespeichert';

  @override
  String get favoritesAdd => 'Favorit hinzufügen';

  @override
  String get favoritesCategory => 'Kategorie';

  @override
  String get favoritesMarina => 'Marina';

  @override
  String get favoritesAnchor => 'Ankerplatz';

  @override
  String get favoritesFuel => 'Tankstelle';

  @override
  String get favoritesLock => 'Schleuse';

  @override
  String get favoritesBridge => 'Brücke';

  @override
  String get favoritesRestaurant => 'Restaurant';

  @override
  String get favoritesShop => 'Geschäft';

  @override
  String get favoritesDanger => 'Gefahrenstelle';

  @override
  String get favoritesOther => 'Sonstiges';

  @override
  String get favoritesNotes => 'Notizen (optional)';

  @override
  String get favoritesSaveFailed => 'Fehler beim Speichern';

  @override
  String get favoritesGoTo => 'Zur Position';

  @override
  String get favoritesAsWaypoint => 'Als Wegpunkt';

  @override
  String get favoritesPosition => 'Position';

  @override
  String get keyboardHint => 'Eingabe…';

  @override
  String get settingsTitle => 'Einstellungen';

  @override
  String get settingsSaved => 'Gespeichert';

  @override
  String get settingsSectionShip => 'Schiff';

  @override
  String get settingsSectionMap => 'Karte';

  @override
  String get settingsSectionNavigation => 'Navigation';

  @override
  String get settingsSectionGPS => 'GPS';

  @override
  String get settingsSectionAIS => 'AIS';

  @override
  String get settingsSectionUnits => 'Einheiten';

  @override
  String get settingsSectionMQTT => 'MQTT';

  @override
  String get settingsSectionLocks => 'Schleusen';

  @override
  String get settingsSectionENC => 'ENC-Karten';

  @override
  String get settingsSectionDashboard => 'Dashboard';

  @override
  String get settingsSectionData => 'Daten';

  @override
  String get settingsSectionDisplay => 'Display';

  @override
  String get settingsSectionSystem => 'System';

  @override
  String get shipIconLabel => 'Boot-Icon';

  @override
  String get shipYacht => 'Yacht';

  @override
  String get shipMotorboat => 'Motorboot';

  @override
  String get shipSailboat => 'Segelboot';

  @override
  String get shipKayak => 'Kajak';

  @override
  String get shipDimensions => 'Abmessungen';

  @override
  String get shipLength => 'Länge (m)';

  @override
  String get shipBeam => 'Breite (m)';

  @override
  String get shipDraft => 'Tiefgang (m)';

  @override
  String get shipHeight => 'Höhe (m)';

  @override
  String get shipDrive => 'Antrieb';

  @override
  String get shipCruiseSpeed => 'Reisegeschw. (km/h)';

  @override
  String get shipFuelCapacity => 'Kraftstoff (L)';

  @override
  String get shipFuelConsumption => 'Verbrauch (L/h)';

  @override
  String get mapSettingsOpenSeaMap => 'OpenSeaMap';

  @override
  String get mapSettingsShowLocks => 'Schleusen anzeigen';

  @override
  String get mapSettingsShowGauges => 'Pegelstände anzeigen';

  @override
  String get mapSettingsShowTrack => 'Track anzeigen';

  @override
  String get mapSettingsAutoCenter => 'Auto-Zentrieren';

  @override
  String get mapSettingsHeadingUp => 'Kurs-Oben (Heading-Up)';

  @override
  String get mapSettingsDisplay => 'Anzeige';

  @override
  String get mapSettingsUiScale => 'UI-Skalierung';

  @override
  String get navSettingsTrack => 'Track';

  @override
  String get navSettingsAutoTrack => 'Auto-Track';

  @override
  String get navSettingsTrackInterval => 'Track-Intervall';

  @override
  String get navSettingsArrival => 'Ankunft';

  @override
  String get navSettingsArrivalAlarm => 'Ankunftsalarm';

  @override
  String get navSettingsAlarmRadius => 'Alarm-Radius';

  @override
  String get navSettingsDayPlanning => 'Tagesplanung';

  @override
  String get navSettingsDefaultSpeed => 'Standardgeschw. (km/h)';

  @override
  String get navSettingsMaxDayTrip => 'Tagesreise max.';

  @override
  String get navSettingsDayStart => 'Tagesstart (HH:MM)';

  @override
  String get navSettingsRouting => 'Routing';

  @override
  String get navSettingsPreferWaterways => 'Wasserstraßen bevorzugen';

  @override
  String get navSettingsConsiderCurrent => 'Strömung berücksichtigen';

  @override
  String get navSettingsOsrmUrl => 'OSRM URL';

  @override
  String get navSettingsCurrentByRiver => 'Strömungen nach Gewässer (km/h)';

  @override
  String get navSettingsCurrentByType => 'Strömungen nach Typ (km/h)';

  @override
  String get navRiverTypeFluss => 'Fluss';

  @override
  String get navRiverTypeKanal => 'Kanal';

  @override
  String get navRiverTypeBach => 'Bach';

  @override
  String get navRiverTypeSee => 'See';

  @override
  String get gpsSettingsDevice => 'GPS-Gerät (SignalK)';

  @override
  String get gpsSettingsPort => 'Port (device)';

  @override
  String get gpsSettingsBaudrate => 'Baudrate';

  @override
  String get gpsSettingsApply => 'Übernehmen & SignalK neu starten';

  @override
  String get gpsSettingsConfigSaved => 'GPS-Konfiguration gespeichert';

  @override
  String get gpsSettingsSource => 'GPS-Quelle';

  @override
  String get gpsSettingsMinSat => 'Mindest-Satelliten (Alarm)';

  @override
  String get aisSettingsEnabled => 'AIS aktiviert';

  @override
  String get aisSettingsProvider => 'Anbieter';

  @override
  String get aisSettingsApiKey => 'API-Key';

  @override
  String get aisSettingsRange => 'Reichweite (NM)';

  @override
  String get aisSettingsInterval => 'Update-Intervall';

  @override
  String get aisSettingsLabels => 'Schiff-Beschriftungen';

  @override
  String get aisSettingsCpaAlarm => 'Kollisionsalarm (CPA)';

  @override
  String get aisSettingsCpaEnabled => 'CPA-Alarm aktiviert';

  @override
  String get aisSettingsCpaDistance => 'Min. CPA-Distanz (NM)';

  @override
  String get unitsSpeed => 'Geschwindigkeit';

  @override
  String get unitsDistance => 'Distanz';

  @override
  String get unitsDepth => 'Tiefe';

  @override
  String get unitsTemperature => 'Temperatur';

  @override
  String get unitsPressure => 'Druck';

  @override
  String get unitsVolume => 'Volumen';

  @override
  String get unitsCoordFormat => 'Koordinatenformat';

  @override
  String get unitsCoordDecimal => 'Dezimal (51.856°)';

  @override
  String get unitsCoordDegMin => 'Grad/Min (51° 51.3\')';

  @override
  String get unitsCoordDegMinSec => 'Grad/Min/Sek';

  @override
  String get unitsLanguage => 'Sprache';

  @override
  String get unitsLangDE => 'Deutsch';

  @override
  String get unitsLangEN => 'English';

  @override
  String get mqttExternalAccess => 'Externer Zugriff (Sensor-Board)';

  @override
  String get mqttSensorBoardConn => 'Sensor-Board Verbindung';

  @override
  String get mqttBrokerHint => 'Broker-Adresse im Sensor eintragen:';

  @override
  String get mqttBrokerLoading => '— (MQTT-Tab antippen zum Laden)';

  @override
  String get mqttBrokerSection => 'MQTT-Broker';

  @override
  String get mqttBrokerUrl => 'Broker URL';

  @override
  String get mqttUsername => 'Benutzername';

  @override
  String get mqttPassword => 'Passwort';

  @override
  String get mqttTestBtn => 'Verbindung testen';

  @override
  String get mqttCleanBtn => 'Bereinigen';

  @override
  String get mqttEnableExternal => 'Externen Zugriff aktivieren';

  @override
  String get mqttTestSuccess => 'MQTT-Test erfolgreich';

  @override
  String get mqttTestFailed => 'MQTT-Test fehlgeschlagen';

  @override
  String get mqttCleanSuccess => 'MQTT-Bereinigung erfolgreich';

  @override
  String get mqttCleanFailed => 'MQTT-Bereinigung fehlgeschlagen';

  @override
  String get mqttEnableExternalTitle => 'Externen MQTT-Zugriff aktivieren?';

  @override
  String get mqttEnableExternalBody =>
      'Mosquitto wird so konfiguriert, dass externe Geräte (z.B. Sensorboard) sich auf Port 1883 verbinden können.\n\nSudo-Berechtigung muss einmalig per SSH eingerichtet sein.';

  @override
  String get mqttActivate => 'Aktivieren';

  @override
  String get mqttDepthAlarm => 'Tiefen-Alarm';

  @override
  String get mqttDepthThreshold => 'Alarm bei < (m)';

  @override
  String get mqttDepthAlarmEnabled => 'Tiefenalarm aktiv';

  @override
  String get displayScreensaver => 'Bildschirmschoner';

  @override
  String get displayTimeout => 'Timeout';

  @override
  String get displayTimeoutOff => 'Aus';

  @override
  String get displayTimeout5 => '5 Min';

  @override
  String get displayTimeout10 => '10 Min';

  @override
  String get displayTimeout15 => '15 Min';

  @override
  String get displayTimeout30 => '30 Min';

  @override
  String get displayTwoStage => 'Zweistufiger Bildschirmschoner';

  @override
  String get displayTwoStageInfo =>
      'Stufe 1: App-Overlay (schwarz) nach dem Timeout.\nStufe 2: Display aus (Hardware) 60 Sekunden später.\nJede Berührung weckt beides wieder auf.';

  @override
  String get systemVersionTitle => 'Software-Version';

  @override
  String get systemInstalled => 'Installiert';

  @override
  String get systemAvailable => 'Verfügbar';

  @override
  String get systemShutdownPiBtn => 'Pi herunterfahren';

  @override
  String get systemShutdownTitle => 'Jetzt herunterfahren?';

  @override
  String get systemShutdownBody =>
      'Der Pi lädt alle Änderungen und startet danach automatisch neu.';

  @override
  String get systemUpdateBtn => 'System aktualisieren';

  @override
  String get locksDb => 'Schleusen-Datenbank';

  @override
  String get locksImportOSM => 'Aus OpenStreetMap importieren';

  @override
  String get locksOSMImport => 'OSM-Import';

  @override
  String get locksEnrich => 'VHF & Kontaktdaten anreichern';

  @override
  String get locksDataEnrichment => 'Datenanreicherung';

  @override
  String get locksQualityReport => 'Qualitätsbericht anzeigen';

  @override
  String get locksQualityTitle => 'Qualitätsbericht';

  @override
  String get locksCheckPositions => 'Positionen überprüfen & korrigieren';

  @override
  String get locksPosCheck => 'Positions-Check';

  @override
  String get locksPleaseWait => 'Bitte warten…';

  @override
  String get encInstalled => 'Installierte ENC-Karten';

  @override
  String get encNoCharts => 'Keine Karten installiert.';

  @override
  String get encAvailable => 'Verfügbare Karten (ELWIS)';

  @override
  String get encLoadCatalog => 'Katalog laden';

  @override
  String get encLoading => 'Lädt…';

  @override
  String get encInstalledLabel => 'Installiert';

  @override
  String get dashSettingsTrackSensors => 'Track-Sensoren aufzeichnen';

  @override
  String get dashSettingsTrackSensorsDesc =>
      'Welche Dashboard-Sensoren sollen pro Track-Punkt gespeichert werden?';

  @override
  String get dashSettingsNoSensors =>
      'Keine Sensoren im Dashboard konfiguriert.';

  @override
  String get mobDistance => 'Distanz';

  @override
  String get mobBearing => 'Peilung';

  @override
  String get mobTime => 'Zeit';

  @override
  String get mobNavigate => 'Navigieren';

  @override
  String get mobClear => 'MOB Löschen';

  @override
  String get aisCallsign => 'Rufzeichen';

  @override
  String get aisDestination => 'Ziel';

  @override
  String get aisVesselLength => 'Länge';

  @override
  String get dashWidgetLog => 'Im Logbuch aufzeichnen';

  @override
  String get dashWidgetLogHint => 'Wert wird pro Track-Punkt mitgespeichert';

  @override
  String get mapHazardBridge => 'Brücke';

  @override
  String get mapHazardCable => 'Freileitung';

  @override
  String get mapHazardDepth => 'Flachstelle';

  @override
  String get mapHazardWeir => 'Wehr / Sperrtor';

  @override
  String mapHazardDepthDetail(String depth, String required) {
    return 'Kartentiefe bis $depth m — benötigt $required m';
  }

  @override
  String mapHazardCurrentApprox(String current, String gauge, String offset) {
    return 'aktuell ≈ $current m ($gauge $offset m)';
  }

  @override
  String mapHazardClearanceDetail(String clearance, String required) {
    return 'Durchfahrtshöhe $clearance m — benötigt $required m';
  }

  @override
  String get mapHazardsNoneChecked =>
      '✓ Route geprüft (IENC) — keine Hindernisse';

  @override
  String get mapPoiHarbor => 'Hafen';

  @override
  String get mapPoiWeir => 'Wehr';

  @override
  String get mapPoiPhone => 'Telefon';

  @override
  String mapPoiVhfChannel(String channel) {
    return 'Kanal $channel';
  }

  @override
  String get mapPoiAvgWait => 'Ø Wartezeit';

  @override
  String get mapLockStatusLoading => 'Status wird geladen…';

  @override
  String get mapLockOpen => 'OFFEN';

  @override
  String get mapLockClosed => 'GESCHLOSSEN';

  @override
  String mapLockOpensAt(String time) {
    return 'öffnet $time';
  }

  @override
  String mapLockClosesAt(String time) {
    return 'schließt $time';
  }

  @override
  String get settingsSectionAbout => 'Über';

  @override
  String get aboutThanks => 'Danke an';

  @override
  String get aboutNoSponsors => 'Noch keine Einträge — oder offline.';

  @override
  String get aboutPcbwayDesc =>
      'Sponsert die Platinenfertigung für BoatOpenIO.';

  @override
  String get aboutOrderPcb => 'Platinen direkt bestellen';

  @override
  String get aboutBookDe => 'Buchreihe (DE)';

  @override
  String get aboutBookEn => 'Buchreihe (EN)';

  @override
  String get aboutSupport => 'Unterstützen';

  @override
  String get aboutDisclaimerHeader => 'Haftungsausschluss';

  @override
  String get aboutDisclaimer =>
      'BoatOS wird ohne jede Gewähr bereitgestellt (\"as is\"), die Nutzung erfolgt auf eigenes Risiko. Für Schäden an Hard- oder Software, am Boot, an Personen oder für Folgeschäden wird keine Haftung übernommen. BoatOS ersetzt keine amtlichen Seekarten und keine sorgfältige Navigation — verlasse dich niemals allein auf diese Software.';

  @override
  String get aboutLicense => 'Lizenz: GPL-3.0 · 🐾';

  @override
  String get btnStart => 'Starten';

  @override
  String get btnReset => 'Zurücksetzen';

  @override
  String get btnCheck => 'Prüfen';

  @override
  String get settingsSaveFailed => 'Fehler beim Speichern';

  @override
  String get settingsConnError => 'Verbindungsfehler';

  @override
  String settingsConnErrorLabel(String label) {
    return '$label: Verbindungsfehler';
  }

  @override
  String settingsJobRunning(String label) {
    return '$label läuft…';
  }

  @override
  String settingsJobChecked(String checked, String fixed) {
    return '$checked geprüft, $fixed korrigiert';
  }

  @override
  String get settingsRunning => 'Läuft…';

  @override
  String settingsDeleteQ(String name) {
    return '$name löschen?';
  }

  @override
  String get encElwisUnreachable =>
      'ELWIS aktuell nicht erreichbar — später erneut versuchen.';

  @override
  String encCatalogLoadError(String code) {
    return 'Fehler $code beim Laden des Katalogs.';
  }

  @override
  String get encCatalogTimeout =>
      'ELWIS-Katalog konnte nicht geladen werden (Zeitüberschreitung).';

  @override
  String get encDownloadSelected => 'Ausgewählte herunterladen';

  @override
  String encDownloadSelectedN(String count) {
    return 'Ausgewählte herunterladen ($count)';
  }

  @override
  String get dashSensorDelete => 'Sensor löschen';

  @override
  String get dashDslValid => 'DSL gültig';

  @override
  String dashDslError(String body) {
    return 'Fehler: $body';
  }

  @override
  String get dashAddRow => 'Zeile hinzufügen';

  @override
  String get dashAddWidget => 'Widget hinzufügen';

  @override
  String get dashNoWidgetsHint =>
      'Keine Widgets — tippe auf \"Widget +\" um eines hinzuzufügen';

  @override
  String get dashChooseRoll => 'Roll-Topic wählen…';

  @override
  String get dashChoosePitch => 'Pitch-Topic wählen…';

  @override
  String get dashChooseImpact => 'Impact-Topic wählen…';

  @override
  String get dashImpactHint => 'Horizont blinkt rot bei Erschütterung';

  @override
  String get settingsResetTitle => 'Auf Werkseinstellungen zurücksetzen?';

  @override
  String get settingsResetBody =>
      'Alle Einstellungen werden auf die Standardwerte zurückgesetzt. Dieser Vorgang kann nicht rückgängig gemacht werden.';

  @override
  String get settingsResetDone => 'Einstellungen zurückgesetzt';

  @override
  String get settingsResetHeader => 'Zurücksetzen';

  @override
  String get settingsResetDesc =>
      'Alle Einstellungen auf Standardwerte zurücksetzen.';

  @override
  String get settingsResetting => 'Setzt zurück…';

  @override
  String get settingsFactoryReset => 'Auf Werkseinstellungen zurücksetzen';

  @override
  String get mapDeletePermanent => 'Karte wird dauerhaft entfernt.';

  @override
  String errorWith(String msg) {
    return 'Fehler: $msg';
  }

  @override
  String settingsJobImported(String imported, String updated) {
    return '$imported importiert, $updated aktualisiert';
  }

  @override
  String settingsJobEnriched(String enriched, String coverage) {
    return '$enriched angereichert — VHF: $coverage';
  }

  @override
  String settingsJobQuality(
    String total,
    String vhf,
    String pct,
    String phone,
    String dim,
  ) {
    return 'Gesamt: $total Schleusen\nVHF: $vhf/$total ($pct)\nTelefon: $phone/$total\nAbmessungen: $dim/$total';
  }

  @override
  String get settingsJobSuccess => 'Erfolgreich';

  @override
  String get settingsError => 'Fehler';

  @override
  String settingsJobFailed(String label, String e) {
    return '$label: Fehler — $e';
  }

  @override
  String get commonAll => 'Alle';

  @override
  String get commonNone => 'Keine';

  @override
  String get commonManual => 'Manuell';

  @override
  String get commonRefresh => 'Aktualisieren';

  @override
  String get commonReload => 'Neu laden';

  @override
  String get commonHide => 'Ausblenden';

  @override
  String get unitKnots => 'Knoten';

  @override
  String get boatType => 'Typ';

  @override
  String get settingsShowIENC => 'Amtliche Karten (IENC)';

  @override
  String settingsSuccessLabel(String label) {
    return '$label erfolgreich';
  }

  @override
  String settingsFailedLabel(String label, String code) {
    return '$label fehlgeschlagen ($code)';
  }

  @override
  String get settingsUpdateChannel => 'Update-Kanal';

  @override
  String get settingsBetaDesc =>
      'Beta liefert Vorabversionen (rc) zum Testen — kann instabil sein.';

  @override
  String get settingsUpdateStarting => '[System] Update wird gestartet…';

  @override
  String get settingsShutdown => 'Herunterfahren';

  @override
  String get settingsStartJobQ => 'Vorgang starten?';

  @override
  String get settingsStarting => 'Starte…';

  @override
  String get settingsDownloadNotStarted =>
      'Download konnte nicht gestartet werden.';

  @override
  String settingsDownloadFailed(String e) {
    return 'Download fehlgeschlagen: $e';
  }

  @override
  String get settingsConverting => 'Konvertiere…';

  @override
  String settingsCells(String files) {
    return '$files Zellen';
  }

  @override
  String get settingsUsable => 'aktiv nutzbar';

  @override
  String get settingsNotConverted => 'nicht konvertiert';

  @override
  String settingsErrorCode(String code) {
    return 'Fehler $code';
  }

  @override
  String settingsErrorCodeP(String code) {
    return 'Fehler ($code)';
  }

  @override
  String settingsRemoveTopicQ(String topic) {
    return 'Topic \"$topic\" wirklich entfernen?';
  }

  @override
  String get settingsLayoutSaved => 'Layout gespeichert';

  @override
  String get settingsDashEditor => 'Dashboard-Editor';

  @override
  String get settingsVisual => 'Visuell';

  @override
  String get settingsDslCode => 'DSL-Code';

  @override
  String get settingsSensors => 'Sensoren';

  @override
  String settingsRowN(String n) {
    return 'Zeile $n';
  }

  @override
  String get settingsNoLayout => 'Kein Layout';

  @override
  String get settingsTemplateCaps => 'VORLAGE';

  @override
  String get layout3Cols => '3 Spalten';

  @override
  String get layoutHeroTop => 'Hero O';

  @override
  String get layoutHeroBottom => 'Hero U';

  @override
  String get layoutMosaic4 => 'Mosaik 4';

  @override
  String get layoutMosaic5 => 'Mosaik 5';

  @override
  String get settingsUntitled => '(ohne Titel)';

  @override
  String get settingsNoSensorsFound => 'Keine Sensoren gefunden.';

  @override
  String get settingsNoSensorsLoaded => 'Keine Sensoren geladen.';

  @override
  String get widgetCompass => 'Kompass';

  @override
  String get settingsUnit => 'Einheit';

  @override
  String get settingsDecimals => 'Dezimalstellen';

  @override
  String get settingsRollTopic => 'Roll-Topic';

  @override
  String get settingsPitchTopic => 'Pitch-Topic';

  @override
  String get settingsImpactTopic => 'Impact-Topic';

  @override
  String get settingsImpactAlarm => 'Impact-Alarm';

  @override
  String get settingsWidthCols => 'Breite (Spalten)';

  @override
  String get settingsExportError => 'Fehler beim Exportieren';

  @override
  String get settingsExportSettings => 'Einstellungen exportieren';

  @override
  String get settingsExportDesc => 'Aktuelle Konfiguration als JSON anzeigen.';

  @override
  String get settingsShowJson => 'JSON anzeigen';

  @override
  String get settingsStable => 'Stabil';

  @override
  String get layoutFull => 'Vollbild';

  @override
  String get commonLoad => 'Laden';

  @override
  String get commonSearch => 'Suchen…';

  @override
  String wifiForgetQ(String ssid) {
    return '\"$ssid\" vergessen?';
  }

  @override
  String get wifiRestartAdapter => 'Adapter neu starten';

  @override
  String get wifiStop => 'Stoppen';

  @override
  String get wifiEnterPassword => 'Passwort eingeben…';

  @override
  String get attitudeTitle => 'Lage';

  @override
  String get compassDesc =>
      'Navi-Instrument: SOG/COG, Fahrrinnen-Tiefe (+ Vorausschau-Warnung), Pegel, Strömung. Keine weiteren Einstellungen nötig.';

  @override
  String get compassDeepChannel => 'Tiefe Rinne';

  @override
  String compassShallowAhead(String dist) {
    return '⚠ flach in $dist m';
  }

  @override
  String compassGauge(String name) {
    return 'Pegel ($name)';
  }

  @override
  String get compassGaugeShort => 'Pegel';

  @override
  String get compassEcho => 'Echolot';

  @override
  String get compassCurrent => 'Strömung';

  @override
  String get widgetStyle => 'Stil';

  @override
  String get widgetShownValues => 'Angezeigte Werte';

  @override
  String get widgetDisplayName => 'Anzeigename';

  @override
  String get widgetDisplayNameTitle => 'Anzeigename (Titel)';

  @override
  String get clockDesc => 'Zeigt Systemzeit und Datum an.';

  @override
  String get spacerDesc => 'Unsichtbarer Platzhalter. Nur Größe relevant.';

  @override
  String get favCategoryOther => 'Sonstiges';
}
