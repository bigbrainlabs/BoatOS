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
  String wifiSignal(String signal) {
    return 'Signal: $signal%';
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

  @override
  String get mobDistance => 'Distance';

  @override
  String get mobBearing => 'Bearing';

  @override
  String get mobTime => 'Time';

  @override
  String get mobNavigate => 'Navigate';

  @override
  String get mobClear => 'Clear MOB';

  @override
  String get aisCallsign => 'Callsign';

  @override
  String get aisDestination => 'Destination';

  @override
  String get aisVesselLength => 'Length';

  @override
  String get dashWidgetLog => 'Log in logbook';

  @override
  String get dashWidgetLogHint => 'Value is saved per track point';

  @override
  String get mapHazardBridge => 'Bridge';

  @override
  String get mapHazardCable => 'Overhead line';

  @override
  String get mapHazardDepth => 'Shoal';

  @override
  String get mapHazardWeir => 'Weir / barrage';

  @override
  String mapHazardDepthDetail(String depth, String required) {
    return 'Charted depth to $depth m — requires $required m';
  }

  @override
  String mapHazardCurrentApprox(String current, String gauge, String offset) {
    return 'current ≈ $current m ($gauge $offset m)';
  }

  @override
  String mapHazardClearanceDetail(String clearance, String required) {
    return 'Clearance $clearance m — requires $required m';
  }

  @override
  String get mapHazardsNoneChecked => '✓ Route checked (IENC) — no hazards';

  @override
  String get mapPoiHarbor => 'Harbour';

  @override
  String get mapPoiWeir => 'Weir';

  @override
  String get mapPoiPhone => 'Phone';

  @override
  String mapPoiVhfChannel(String channel) {
    return 'Channel $channel';
  }

  @override
  String get mapPoiAvgWait => 'Avg. wait';

  @override
  String get mapLockStatusLoading => 'Loading status…';

  @override
  String get mapLockOpen => 'OPEN';

  @override
  String get mapLockClosed => 'CLOSED';

  @override
  String mapLockOpensAt(String time) {
    return 'opens $time';
  }

  @override
  String mapLockClosesAt(String time) {
    return 'closes $time';
  }

  @override
  String get settingsSectionAbout => 'About';

  @override
  String get aboutThanks => 'Thanks to';

  @override
  String get aboutNoSponsors => 'No entries yet — or offline.';

  @override
  String get aboutPcbwayDesc => 'Sponsors PCB manufacturing for BoatOpenIO.';

  @override
  String get aboutOrderPcb => 'Order PCBs directly';

  @override
  String get aboutBookDe => 'Book series (DE)';

  @override
  String get aboutBookEn => 'Book series (EN)';

  @override
  String get aboutSupport => 'Support';

  @override
  String get aboutDisclaimerHeader => 'Disclaimer';

  @override
  String get aboutDisclaimer =>
      'BoatOS is provided without any warranty (\"as is\"); use is at your own risk. No liability is accepted for damage to hardware or software, to the boat, to persons, or for consequential damage. BoatOS does not replace official nautical charts or careful navigation — never rely on this software alone.';

  @override
  String get aboutLicense => 'License: GPL-3.0 · 🐾';

  @override
  String get btnStart => 'Start';

  @override
  String get btnReset => 'Reset';

  @override
  String get btnCheck => 'Check';

  @override
  String get settingsSaveFailed => 'Error while saving';

  @override
  String get settingsConnError => 'Connection error';

  @override
  String settingsConnErrorLabel(String label) {
    return '$label: connection error';
  }

  @override
  String settingsJobRunning(String label) {
    return '$label running…';
  }

  @override
  String settingsJobChecked(String checked, String fixed) {
    return '$checked checked, $fixed fixed';
  }

  @override
  String get settingsRunning => 'Running…';

  @override
  String settingsDeleteQ(String name) {
    return 'Delete $name?';
  }

  @override
  String get encElwisUnreachable =>
      'ELWIS currently unreachable — try again later.';

  @override
  String encCatalogLoadError(String code) {
    return 'Error $code while loading the catalog.';
  }

  @override
  String get encCatalogTimeout => 'Could not load the ELWIS catalog (timeout).';

  @override
  String get encDownloadSelected => 'Download selected';

  @override
  String encDownloadSelectedN(String count) {
    return 'Download selected ($count)';
  }

  @override
  String get dashSensorDelete => 'Delete sensor';

  @override
  String get dashDslValid => 'DSL valid';

  @override
  String dashDslError(String body) {
    return 'Error: $body';
  }

  @override
  String get dashAddRow => 'Add row';

  @override
  String get dashAddWidget => 'Add widget';

  @override
  String get dashNoWidgetsHint => 'No widgets — tap \"Widget +\" to add one';

  @override
  String get dashChooseRoll => 'Choose roll topic…';

  @override
  String get dashChoosePitch => 'Choose pitch topic…';

  @override
  String get dashChooseImpact => 'Choose impact topic…';

  @override
  String get dashImpactHint => 'Horizon flashes red on impact';

  @override
  String get settingsResetTitle => 'Reset to factory settings?';

  @override
  String get settingsResetBody =>
      'All settings will be reset to their default values. This action cannot be undone.';

  @override
  String get settingsResetDone => 'Settings reset';

  @override
  String get settingsResetHeader => 'Reset';

  @override
  String get settingsResetDesc => 'Reset all settings to their default values.';

  @override
  String get settingsResetting => 'Resetting…';

  @override
  String get settingsFactoryReset => 'Reset to factory settings';

  @override
  String get mapDeletePermanent => 'The chart will be permanently removed.';

  @override
  String errorWith(String msg) {
    return 'Error: $msg';
  }

  @override
  String settingsJobImported(String imported, String updated) {
    return '$imported imported, $updated updated';
  }

  @override
  String settingsJobEnriched(String enriched, String coverage) {
    return '$enriched enriched — VHF: $coverage';
  }

  @override
  String settingsJobQuality(
    String total,
    String vhf,
    String pct,
    String phone,
    String dim,
  ) {
    return 'Total: $total locks\nVHF: $vhf/$total ($pct)\nPhone: $phone/$total\nDimensions: $dim/$total';
  }

  @override
  String get settingsJobSuccess => 'Success';

  @override
  String get settingsError => 'Error';

  @override
  String settingsJobFailed(String label, String e) {
    return '$label: error — $e';
  }

  @override
  String get commonAll => 'All';

  @override
  String get commonNone => 'None';

  @override
  String get commonManual => 'Manual';

  @override
  String get commonRefresh => 'Refresh';

  @override
  String get commonReload => 'Reload';

  @override
  String get commonHide => 'Hide';

  @override
  String get unitKnots => 'Knots';

  @override
  String get boatType => 'Type';

  @override
  String get settingsShowIENC => 'Official charts (IENC)';

  @override
  String settingsSuccessLabel(String label) {
    return '$label succeeded';
  }

  @override
  String settingsFailedLabel(String label, String code) {
    return '$label failed ($code)';
  }

  @override
  String get settingsUpdateChannel => 'Update channel';

  @override
  String get settingsBetaDesc =>
      'Beta provides pre-releases (rc) for testing — may be unstable.';

  @override
  String get settingsUpdateStarting => '[System] Starting update…';

  @override
  String get settingsShutdown => 'Shut down';

  @override
  String get settingsStartJobQ => 'Start operation?';

  @override
  String get settingsStarting => 'Starting…';

  @override
  String get settingsDownloadNotStarted => 'Could not start the download.';

  @override
  String settingsDownloadFailed(String e) {
    return 'Download failed: $e';
  }

  @override
  String get settingsConverting => 'Converting…';

  @override
  String settingsCells(String files) {
    return '$files cells';
  }

  @override
  String get settingsUsable => 'ready to use';

  @override
  String get settingsNotConverted => 'not converted';

  @override
  String settingsErrorCode(String code) {
    return 'Error $code';
  }

  @override
  String settingsErrorCodeP(String code) {
    return 'Error ($code)';
  }

  @override
  String settingsRemoveTopicQ(String topic) {
    return 'Really remove topic \"$topic\"?';
  }

  @override
  String get settingsLayoutSaved => 'Layout saved';

  @override
  String get settingsDashEditor => 'Dashboard editor';

  @override
  String get settingsVisual => 'Visual';

  @override
  String get settingsDslCode => 'DSL code';

  @override
  String get settingsSensors => 'Sensors';

  @override
  String settingsRowN(String n) {
    return 'Row $n';
  }

  @override
  String get settingsNoLayout => 'No layout';

  @override
  String get settingsTemplateCaps => 'TEMPLATE';

  @override
  String get layout3Cols => '3 columns';

  @override
  String get layoutHeroTop => 'Hero T';

  @override
  String get layoutHeroBottom => 'Hero B';

  @override
  String get layoutMosaic4 => 'Mosaic 4';

  @override
  String get layoutMosaic5 => 'Mosaic 5';

  @override
  String get settingsUntitled => '(untitled)';

  @override
  String get settingsNoSensorsFound => 'No sensors found.';

  @override
  String get settingsNoSensorsLoaded => 'No sensors loaded.';

  @override
  String get widgetCompass => 'Compass';

  @override
  String get settingsUnit => 'Unit';

  @override
  String get settingsDecimals => 'Decimals';

  @override
  String get settingsRollTopic => 'Roll topic';

  @override
  String get settingsPitchTopic => 'Pitch topic';

  @override
  String get settingsImpactTopic => 'Impact topic';

  @override
  String get settingsImpactAlarm => 'Impact alarm';

  @override
  String get settingsWidthCols => 'Width (columns)';

  @override
  String get settingsExportError => 'Error while exporting';

  @override
  String get settingsExportSettings => 'Export settings';

  @override
  String get settingsExportDesc => 'Show the current configuration as JSON.';

  @override
  String get settingsShowJson => 'Show JSON';

  @override
  String get settingsStable => 'Stable';

  @override
  String get layoutFull => 'Fullscreen';

  @override
  String get commonLoad => 'Load';

  @override
  String get commonSearch => 'Search…';

  @override
  String wifiForgetQ(String ssid) {
    return 'Forget \"$ssid\"?';
  }

  @override
  String get wifiRestartAdapter => 'Restart adapter';

  @override
  String get wifiStop => 'Stop';

  @override
  String get wifiEnterPassword => 'Enter password…';

  @override
  String get attitudeTitle => 'Attitude';

  @override
  String get compassDesc =>
      'Nav instrument: SOG/COG, fairway depth (+ look-ahead warning), water level, current. No further settings needed.';

  @override
  String get compassDeepChannel => 'Deep channel';

  @override
  String compassShallowAhead(String dist) {
    return '⚠ shallow in $dist m';
  }

  @override
  String compassGauge(String name) {
    return 'Gauge ($name)';
  }

  @override
  String get compassGaugeShort => 'Gauge';

  @override
  String get compassEcho => 'Echo sounder';

  @override
  String get compassCurrent => 'Current';

  @override
  String get widgetStyle => 'Style';

  @override
  String get widgetShownValues => 'Shown values';

  @override
  String get widgetDisplayName => 'Display name';

  @override
  String get widgetDisplayNameTitle => 'Display name (title)';

  @override
  String get clockDesc => 'Shows system time and date.';

  @override
  String get spacerDesc => 'Invisible placeholder. Only size matters.';

  @override
  String get favCategoryOther => 'Other';
}
