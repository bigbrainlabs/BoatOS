// ignore: unused_import
import 'package:intl/intl.dart' as intl;
import 'app_localizations.dart';

// ignore_for_file: type=lint

/// The translations for English (`en`).
class AppLocalizationsEn extends AppLocalizations {
  AppLocalizationsEn([String locale = 'en']) : super(locale);

  @override
  String get appTitle => 'BoatOS';

  @override
  String get navTabMap => 'Map';

  @override
  String get navTabDashboard => 'Dashboard';

  @override
  String get navTabLogbook => 'Logbook';

  @override
  String get btnCancel => 'Cancel';

  @override
  String get btnSave => 'Save';

  @override
  String get btnDelete => 'Delete';

  @override
  String get btnAdd => 'Add';

  @override
  String get btnStop => 'Stop';

  @override
  String get btnConnect => 'Connect';

  @override
  String get btnDone => 'Done';

  @override
  String get btnEnd => 'End';

  @override
  String get systemDialogTitle => 'System';

  @override
  String get systemDialogBody => 'What should the BoatOS system do now?';

  @override
  String get systemRestart => 'Restart';

  @override
  String get systemShutdown => 'Shut down';

  @override
  String get updateAvailable => 'Update available';

  @override
  String get updateCheck => 'Check for updates';

  @override
  String get updateNow => 'Update now';

  @override
  String get updateProgress => 'Update progress';

  @override
  String get updateRunning => 'Update running…';

  @override
  String get updateChecking => 'Checking…';

  @override
  String get updateUpToDate => '✅ System is up to date';

  @override
  String get updateAvailableStatus => '🆕 Update available';

  @override
  String get updateRestarting => 'Connection lost — Pi is restarting…';

  @override
  String get hotspotActive => 'Hotspot active';

  @override
  String get hotspotSsid => 'SSID';

  @override
  String get hotspotPassword => 'Password';

  @override
  String get hotspotIp => 'IP';

  @override
  String get wifiTitle => 'Wi-Fi';

  @override
  String get wifiAdapterRestart => 'Restart adapter';

  @override
  String get wifiAvailableNetworks => 'Available networks';

  @override
  String get wifiSearching => 'Searching for networks…';

  @override
  String get wifiConnected => 'Connected';

  @override
  String get wifiNotConnected => 'Not connected';

  @override
  String get wifiConnectedSaved => 'Connected · Saved';

  @override
  String get wifiSaved => 'Saved';

  @override
  String get wifiStartHotspot => 'Start hotspot';

  @override
  String get wifiDisconnect => 'Disconnect';

  @override
  String wifiSignal(int percent) {
    return 'Signal: $percent%';
  }

  @override
  String get wifiForget => 'Forget';

  @override
  String wifiForgetTitle(String ssid) {
    return 'Forget \"$ssid\"?';
  }

  @override
  String get wifiForgetBody => 'The saved profile will be deleted.';

  @override
  String wifiConnectTo(String ssid) {
    return 'Connect to \"$ssid\"';
  }

  @override
  String get wifiPasswordLabel => 'Wi-Fi password';

  @override
  String get wifiPasswordHint => 'Enter password…';

  @override
  String get gpsStatusTitle => 'GPS Status';

  @override
  String get gpsFix => 'Fix';

  @override
  String get gpsNoFix => 'No Fix';

  @override
  String get gpsSatellites => 'Satellites';

  @override
  String get gpsAltitude => 'Altitude';

  @override
  String get gpsPosition => 'Position';

  @override
  String get gpsNoData => 'No GPS data received';

  @override
  String get gpsQualityVeryGood => 'very good';

  @override
  String get gpsQualityGood => 'good';

  @override
  String get gpsQualityOk => 'ok';

  @override
  String get gpsQualityBad => 'poor';

  @override
  String get dashboardNoLayout => 'No dashboard layout configured.';

  @override
  String get dashboardNoScreens => 'No screens in layout.';

  @override
  String get dashboardNoWidgets => 'No widgets in layout.';

  @override
  String get dashboardAlarmMute => 'Mute alarm';

  @override
  String get mapOfflineFallback =>
      '⚠ Offline maps unavailable · Online fallback (OpenStreetMap)';

  @override
  String get mapLayerLocks => 'Locks';

  @override
  String get mapLayerGauge => 'Gauge';

  @override
  String get mapLayerFavorites => 'Favorites';

  @override
  String get mapPlanRoute => 'Plan route';

  @override
  String mapDeleteWaypointTitle(int index) {
    return 'Delete waypoint $index?';
  }

  @override
  String get mapSavedRoutesTitle => 'Saved routes';

  @override
  String get mapNoSavedRoutes => 'No saved routes.';

  @override
  String get mapSaveRoute => 'Save route';

  @override
  String get mapRouteNameHint => 'Enter name…';

  @override
  String get mapSimulation => 'Simulation';

  @override
  String get mapSimStop => 'Sim Stop';

  @override
  String get mapNavigation => 'Navigation';

  @override
  String get mapNavStop => 'Stop';

  @override
  String get mapNow => 'Now';

  @override
  String get mapToday => 'today';

  @override
  String get mapDeparture => 'Departure:';

  @override
  String get mapDirect => 'Direct';

  @override
  String get mapLongTapHint => 'Long-tap the map to set a waypoint';

  @override
  String get mapMobTitle => '🆘 SOS / Man Over Board';

  @override
  String get mapMobConfirm => 'Set current GPS position as MOB marker?';

  @override
  String get mapMobSet => 'SET MOB';

  @override
  String get navstatEngine => 'Under engine';

  @override
  String get navstatAnchored => 'At anchor';

  @override
  String get navstatNUC => 'Not under command';

  @override
  String get navstatRestricted => 'Restricted manoeuvrability';

  @override
  String get navstatMoored => 'Moored';

  @override
  String get navstatAground => 'Aground';

  @override
  String get navstatFishing => 'Fishing';

  @override
  String get navstatUnknown => 'Unknown';

  @override
  String get routePlannerHint => 'Long-tap the map → set waypoint';

  @override
  String get logbookTitle => 'Logbook';

  @override
  String get logbookTabTrip => 'Trip';

  @override
  String get logbookTabArchive => 'Archive';

  @override
  String get logbookTabCrew => 'Crew';

  @override
  String get logbookNoActiveTrip => 'No active trip recording';

  @override
  String get logbookStartTrip => 'Start trip';

  @override
  String get logbookDistance => 'Distance';

  @override
  String get logbookDuration => 'Duration';

  @override
  String get logbookPoints => 'Points';

  @override
  String get logbookAvgSpeed => 'Avg Speed';

  @override
  String get logbookPause => 'Pause';

  @override
  String get logbookResume => 'Resume';

  @override
  String get logbookEndTrip => 'End trip';

  @override
  String get logbookAddNote => 'Add note';

  @override
  String get logbookEndTripTitle => 'End trip?';

  @override
  String get logbookEndTripBody => 'Recording will be stopped and saved.';

  @override
  String get logbookStopFailed => 'Stop failed';

  @override
  String get logbookStartFailed => 'Start failed';

  @override
  String get logbookPauseFailed => 'Pause failed';

  @override
  String get logbookResumeFailed => 'Resume failed';

  @override
  String get logbookNoteHint => 'Note...';

  @override
  String get logbookNoteSaveFailed => 'Note could not be saved';

  @override
  String get logbookPaused => 'Paused';

  @override
  String get logbookRecording => 'Recording';

  @override
  String get logbookNoTrips => 'No trips saved';

  @override
  String get logbookCrewForTrip => 'Crew for this trip';

  @override
  String get logbookCrewOptional => 'Optional — can be left empty';

  @override
  String get logbookNoCrewAvailable => 'No crew members available.';

  @override
  String get logbookLoadError => 'Loading failed.';

  @override
  String get logbookWeatherStart => 'Weather (Start)';

  @override
  String get logbookWaterLevels => 'Water levels';

  @override
  String get logbookStats => 'Statistics';

  @override
  String get logbookMaxSpeed => 'Max Speed';

  @override
  String get logbookAvgSpeedStat => 'Avg Speed';

  @override
  String get logbookEntries => 'Log entries';

  @override
  String get logbookOnMap => 'On map';

  @override
  String logbookGpxSaved(String path) {
    return 'GPX saved: $path';
  }

  @override
  String get logbookGpxFailed => 'GPX export failed';

  @override
  String get logbookStart => 'Start';

  @override
  String get logbookEnd => 'End';

  @override
  String get logbookContinue => 'Continued';

  @override
  String get logbookNote => 'Note';

  @override
  String get logbookTripsCount => 'trips';

  @override
  String get crewAddTitle => 'Add crew';

  @override
  String get crewEditTitle => 'Edit crew';

  @override
  String get crewAvatar => 'Avatar';

  @override
  String get crewName => 'Name';

  @override
  String get crewRole => 'Role';

  @override
  String get crewEmail => 'E-mail (optional)';

  @override
  String get crewPhone => 'Phone (optional)';

  @override
  String get crewNameRequired => 'Name required';

  @override
  String crewDeleteTitle(String name) {
    return 'Delete $name?';
  }

  @override
  String get crewDeleteBody => 'Crew member will be removed.';

  @override
  String get crewDeleteFailed => 'Delete failed';

  @override
  String get crewEmpty => 'No crew members';

  @override
  String favoritesTitle(int count) {
    return 'Favorites ($count)';
  }

  @override
  String get favoritesEmpty => 'No favorites saved';

  @override
  String get favoritesAdd => 'Add favorite';

  @override
  String get favoritesCategory => 'Category';

  @override
  String get favoritesMarina => 'Marina';

  @override
  String get favoritesAnchor => 'Anchorage';

  @override
  String get favoritesFuel => 'Fuel station';

  @override
  String get favoritesLock => 'Lock';

  @override
  String get favoritesBridge => 'Bridge';

  @override
  String get favoritesRestaurant => 'Restaurant';

  @override
  String get favoritesShop => 'Shop';

  @override
  String get favoritesDanger => 'Hazard';

  @override
  String get favoritesOther => 'Other';

  @override
  String get favoritesNotes => 'Notes (optional)';

  @override
  String get favoritesSaveFailed => 'Save failed';

  @override
  String get favoritesGoTo => 'Go to';

  @override
  String get favoritesAsWaypoint => 'As waypoint';

  @override
  String get favoritesPosition => 'Position';

  @override
  String get keyboardHint => 'Enter…';

  @override
  String get settingsTitle => 'Settings';

  @override
  String get settingsSaved => 'Saved';

  @override
  String get settingsSectionShip => 'Vessel';

  @override
  String get settingsSectionMap => 'Map';

  @override
  String get settingsSectionNavigation => 'Navigation';

  @override
  String get settingsSectionGPS => 'GPS';

  @override
  String get settingsSectionAIS => 'AIS';

  @override
  String get settingsSectionUnits => 'Units';

  @override
  String get settingsSectionMQTT => 'MQTT';

  @override
  String get settingsSectionLocks => 'Locks';

  @override
  String get settingsSectionENC => 'ENC Charts';

  @override
  String get settingsSectionDashboard => 'Dashboard';

  @override
  String get settingsSectionData => 'Data';

  @override
  String get settingsSectionDisplay => 'Display';

  @override
  String get settingsSectionSystem => 'System';

  @override
  String get shipIconLabel => 'Boat icon';

  @override
  String get shipYacht => 'Yacht';

  @override
  String get shipMotorboat => 'Motorboat';

  @override
  String get shipSailboat => 'Sailboat';

  @override
  String get shipKayak => 'Kayak';

  @override
  String get shipDimensions => 'Dimensions';

  @override
  String get shipLength => 'Length (m)';

  @override
  String get shipBeam => 'Beam (m)';

  @override
  String get shipDraft => 'Draft (m)';

  @override
  String get shipHeight => 'Air draft (m)';

  @override
  String get shipDrive => 'Propulsion';

  @override
  String get shipCruiseSpeed => 'Cruise speed (km/h)';

  @override
  String get shipFuelCapacity => 'Fuel capacity (L)';

  @override
  String get shipFuelConsumption => 'Consumption (L/h)';

  @override
  String get mapSettingsOpenSeaMap => 'OpenSeaMap';

  @override
  String get mapSettingsShowLocks => 'Show locks';

  @override
  String get mapSettingsShowGauges => 'Show water levels';

  @override
  String get mapSettingsShowTrack => 'Show track';

  @override
  String get mapSettingsAutoCenter => 'Auto-center';

  @override
  String get mapSettingsHeadingUp => 'Heading-Up mode';

  @override
  String get mapSettingsDisplay => 'Display';

  @override
  String get mapSettingsUiScale => 'UI scale';

  @override
  String get navSettingsTrack => 'Track';

  @override
  String get navSettingsAutoTrack => 'Auto-Track';

  @override
  String get navSettingsTrackInterval => 'Track interval';

  @override
  String get navSettingsArrival => 'Arrival';

  @override
  String get navSettingsArrivalAlarm => 'Arrival alarm';

  @override
  String get navSettingsAlarmRadius => 'Alarm radius';

  @override
  String get navSettingsDayPlanning => 'Day planning';

  @override
  String get navSettingsDefaultSpeed => 'Default speed (km/h)';

  @override
  String get navSettingsMaxDayTrip => 'Max daily trip';

  @override
  String get navSettingsDayStart => 'Day start (HH:MM)';

  @override
  String get navSettingsRouting => 'Routing';

  @override
  String get navSettingsPreferWaterways => 'Prefer waterways';

  @override
  String get navSettingsConsiderCurrent => 'Consider current';

  @override
  String get navSettingsOsrmUrl => 'OSRM URL';

  @override
  String get navSettingsCurrentByRiver => 'Current by river (km/h)';

  @override
  String get navSettingsCurrentByType => 'Current by type (km/h)';

  @override
  String get navRiverTypeFluss => 'River';

  @override
  String get navRiverTypeKanal => 'Canal';

  @override
  String get navRiverTypeBach => 'Stream';

  @override
  String get navRiverTypeSee => 'Lake';

  @override
  String get gpsSettingsDevice => 'GPS device (SignalK)';

  @override
  String get gpsSettingsPort => 'Port (device)';

  @override
  String get gpsSettingsBaudrate => 'Baud rate';

  @override
  String get gpsSettingsApply => 'Apply & restart SignalK';

  @override
  String get gpsSettingsConfigSaved => 'GPS configuration saved';

  @override
  String get gpsSettingsSource => 'GPS source';

  @override
  String get gpsSettingsMinSat => 'Min satellites (alarm)';

  @override
  String get aisSettingsEnabled => 'AIS enabled';

  @override
  String get aisSettingsProvider => 'Provider';

  @override
  String get aisSettingsApiKey => 'API key';

  @override
  String get aisSettingsRange => 'Range (NM)';

  @override
  String get aisSettingsInterval => 'Update interval';

  @override
  String get aisSettingsLabels => 'Vessel labels';

  @override
  String get aisSettingsCpaAlarm => 'Collision alarm (CPA)';

  @override
  String get aisSettingsCpaEnabled => 'CPA alarm enabled';

  @override
  String get aisSettingsCpaDistance => 'Min. CPA distance (NM)';

  @override
  String get unitsSpeed => 'Speed';

  @override
  String get unitsDistance => 'Distance';

  @override
  String get unitsDepth => 'Depth';

  @override
  String get unitsTemperature => 'Temperature';

  @override
  String get unitsPressure => 'Pressure';

  @override
  String get unitsVolume => 'Volume';

  @override
  String get unitsCoordFormat => 'Coordinate format';

  @override
  String get unitsCoordDecimal => 'Decimal (51.856°)';

  @override
  String get unitsCoordDegMin => 'Deg/Min (51° 51.3\')';

  @override
  String get unitsCoordDegMinSec => 'Deg/Min/Sec';

  @override
  String get unitsLanguage => 'Language';

  @override
  String get unitsLangDE => 'Deutsch';

  @override
  String get unitsLangEN => 'English';

  @override
  String get mqttExternalAccess => 'External access (sensor board)';

  @override
  String get mqttSensorBoardConn => 'Sensor board connection';

  @override
  String get mqttBrokerHint => 'Enter broker address in sensor:';

  @override
  String get mqttBrokerLoading => '— (tap MQTT tab to load)';

  @override
  String get mqttBrokerSection => 'MQTT Broker';

  @override
  String get mqttBrokerUrl => 'Broker URL';

  @override
  String get mqttUsername => 'Username';

  @override
  String get mqttPassword => 'Password';

  @override
  String get mqttTestBtn => 'Test connection';

  @override
  String get mqttCleanBtn => 'Clean up';

  @override
  String get mqttEnableExternal => 'Enable external access';

  @override
  String get mqttTestSuccess => 'MQTT test successful';

  @override
  String get mqttTestFailed => 'MQTT test failed';

  @override
  String get mqttCleanSuccess => 'MQTT cleanup successful';

  @override
  String get mqttCleanFailed => 'MQTT cleanup failed';

  @override
  String get mqttEnableExternalTitle => 'Enable external MQTT access?';

  @override
  String get mqttEnableExternalBody =>
      'Mosquitto will be configured to allow external devices (e.g. sensor board) to connect on port 1883.\n\nSudo permission must be set up once via SSH.';

  @override
  String get mqttActivate => 'Activate';

  @override
  String get mqttDepthAlarm => 'Depth alarm';

  @override
  String get mqttDepthThreshold => 'Alarm at < (m)';

  @override
  String get mqttDepthAlarmEnabled => 'Depth alarm active';

  @override
  String get displayScreensaver => 'Screen saver';

  @override
  String get displayTimeout => 'Timeout';

  @override
  String get displayTimeoutOff => 'Off';

  @override
  String get displayTimeout5 => '5 min';

  @override
  String get displayTimeout10 => '10 min';

  @override
  String get displayTimeout15 => '15 min';

  @override
  String get displayTimeout30 => '30 min';

  @override
  String get displayTwoStage => 'Two-stage screen saver';

  @override
  String get displayTwoStageInfo =>
      'Stage 1: App overlay (black) after timeout.\nStage 2: Display off (hardware) 60 seconds later.\nAny touch wakes both up.';

  @override
  String get systemVersionTitle => 'Software version';

  @override
  String get systemInstalled => 'Installed';

  @override
  String get systemAvailable => 'Available';

  @override
  String get systemShutdownPiBtn => 'Shut down Pi';

  @override
  String get systemShutdownTitle => 'Shut down now?';

  @override
  String get systemShutdownBody =>
      'The Pi will save all changes and then automatically restart.';

  @override
  String get systemUpdateBtn => 'Update system';

  @override
  String get locksDb => 'Lock database';

  @override
  String get locksImportOSM => 'Import from OpenStreetMap';

  @override
  String get locksOSMImport => 'OSM import';

  @override
  String get locksEnrich => 'Enrich with VHF & contact data';

  @override
  String get locksDataEnrichment => 'Data enrichment';

  @override
  String get locksQualityReport => 'Show quality report';

  @override
  String get locksQualityTitle => 'Quality report';

  @override
  String get locksCheckPositions => 'Check & fix positions';

  @override
  String get locksPosCheck => 'Position check';

  @override
  String get locksPleaseWait => 'Please wait…';

  @override
  String get encInstalled => 'Installed ENC charts';

  @override
  String get encNoCharts => 'No charts installed.';

  @override
  String get encAvailable => 'Available charts (ELWIS)';

  @override
  String get encLoadCatalog => 'Load catalog';

  @override
  String get encLoading => 'Loading…';

  @override
  String get encInstalledLabel => 'Installed';

  @override
  String get dashSettingsTrackSensors => 'Record track sensors';

  @override
  String get dashSettingsTrackSensorsDesc =>
      'Which dashboard sensors should be saved per track point?';

  @override
  String get dashSettingsNoSensors => 'No sensors configured in dashboard.';
}
