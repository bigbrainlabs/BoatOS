import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/intl.dart' as intl;

import 'app_localizations_de.dart';
import 'app_localizations_en.dart';

// ignore_for_file: type=lint

/// Callers can lookup localized strings with an instance of AppLocalizations
/// returned by `AppLocalizations.of(context)`.
///
/// Applications need to include `AppLocalizations.delegate()` in their app's
/// `localizationDelegates` list, and the locales they support in the app's
/// `supportedLocales` list. For example:
///
/// ```dart
/// import 'l10n/app_localizations.dart';
///
/// return MaterialApp(
///   localizationsDelegates: AppLocalizations.localizationsDelegates,
///   supportedLocales: AppLocalizations.supportedLocales,
///   home: MyApplicationHome(),
/// );
/// ```
///
/// ## Update pubspec.yaml
///
/// Please make sure to update your pubspec.yaml to include the following
/// packages:
///
/// ```yaml
/// dependencies:
///   # Internationalization support.
///   flutter_localizations:
///     sdk: flutter
///   intl: any # Use the pinned version from flutter_localizations
///
///   # Rest of dependencies
/// ```
///
/// ## iOS Applications
///
/// iOS applications define key application metadata, including supported
/// locales, in an Info.plist file that is built into the application bundle.
/// To configure the locales supported by your app, you’ll need to edit this
/// file.
///
/// First, open your project’s ios/Runner.xcworkspace Xcode workspace file.
/// Then, in the Project Navigator, open the Info.plist file under the Runner
/// project’s Runner folder.
///
/// Next, select the Information Property List item, select Add Item from the
/// Editor menu, then select Localizations from the pop-up menu.
///
/// Select and expand the newly-created Localizations item then, for each
/// locale your application supports, add a new item and select the locale
/// you wish to add from the pop-up menu in the Value field. This list should
/// be consistent with the languages listed in the AppLocalizations.supportedLocales
/// property.
abstract class AppLocalizations {
  AppLocalizations(String locale)
    : localeName = intl.Intl.canonicalizedLocale(locale.toString());

  final String localeName;

  static AppLocalizations? of(BuildContext context) {
    return Localizations.of<AppLocalizations>(context, AppLocalizations);
  }

  static const LocalizationsDelegate<AppLocalizations> delegate =
      _AppLocalizationsDelegate();

  /// A list of this localizations delegate along with the default localizations
  /// delegates.
  ///
  /// Returns a list of localizations delegates containing this delegate along with
  /// GlobalMaterialLocalizations.delegate, GlobalCupertinoLocalizations.delegate,
  /// and GlobalWidgetsLocalizations.delegate.
  ///
  /// Additional delegates can be added by appending to this list in
  /// MaterialApp. This list does not have to be used at all if a custom list
  /// of delegates is preferred or required.
  static const List<LocalizationsDelegate<dynamic>> localizationsDelegates =
      <LocalizationsDelegate<dynamic>>[
        delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ];

  /// A list of this localizations delegate's supported locales.
  static const List<Locale> supportedLocales = <Locale>[
    Locale('de'),
    Locale('en'),
  ];

  /// Application title
  ///
  /// In de, this message translates to:
  /// **'BoatOS'**
  String get appTitle;

  /// Bottom nav tab: Map
  ///
  /// In de, this message translates to:
  /// **'Karte'**
  String get navTabMap;

  /// Bottom nav tab: Dashboard
  ///
  /// In de, this message translates to:
  /// **'Dashboard'**
  String get navTabDashboard;

  /// Bottom nav tab: Logbook
  ///
  /// In de, this message translates to:
  /// **'Logbuch'**
  String get navTabLogbook;

  /// Generic cancel button
  ///
  /// In de, this message translates to:
  /// **'Abbrechen'**
  String get btnCancel;

  /// Generic save button
  ///
  /// In de, this message translates to:
  /// **'Speichern'**
  String get btnSave;

  /// Generic delete button
  ///
  /// In de, this message translates to:
  /// **'Löschen'**
  String get btnDelete;

  /// Generic add button
  ///
  /// In de, this message translates to:
  /// **'Hinzufügen'**
  String get btnAdd;

  /// Generic stop button
  ///
  /// In de, this message translates to:
  /// **'Stoppen'**
  String get btnStop;

  /// Generic connect button
  ///
  /// In de, this message translates to:
  /// **'Verbinden'**
  String get btnConnect;

  /// Generic done button
  ///
  /// In de, this message translates to:
  /// **'Fertig'**
  String get btnDone;

  /// Generic end/finish button
  ///
  /// In de, this message translates to:
  /// **'Beenden'**
  String get btnEnd;

  /// Shutdown/restart dialog title
  ///
  /// In de, this message translates to:
  /// **'System'**
  String get systemDialogTitle;

  /// Shutdown/restart dialog body text
  ///
  /// In de, this message translates to:
  /// **'Was soll das BoatOS-System jetzt tun?'**
  String get systemDialogBody;

  /// Restart button in system dialog
  ///
  /// In de, this message translates to:
  /// **'Neu starten'**
  String get systemRestart;

  /// Shutdown button in system dialog
  ///
  /// In de, this message translates to:
  /// **'Herunterfahren'**
  String get systemShutdown;

  /// Update available badge in nav bar
  ///
  /// In de, this message translates to:
  /// **'Update verfügbar'**
  String get updateAvailable;

  /// Check for updates button
  ///
  /// In de, this message translates to:
  /// **'Auf Updates prüfen'**
  String get updateCheck;

  /// Update now button
  ///
  /// In de, this message translates to:
  /// **'Jetzt aktualisieren'**
  String get updateNow;

  /// Update progress section title
  ///
  /// In de, this message translates to:
  /// **'Update-Fortschritt'**
  String get updateProgress;

  /// Shown while update is in progress
  ///
  /// In de, this message translates to:
  /// **'Update läuft…'**
  String get updateRunning;

  /// Shown while checking for updates
  ///
  /// In de, this message translates to:
  /// **'Prüfe…'**
  String get updateChecking;

  /// System is up to date status
  ///
  /// In de, this message translates to:
  /// **'✅ System ist aktuell'**
  String get updateUpToDate;

  /// Update available status text
  ///
  /// In de, this message translates to:
  /// **'🆕 Update verfügbar'**
  String get updateAvailableStatus;

  /// Shown after update triggers restart
  ///
  /// In de, this message translates to:
  /// **'Verbindung getrennt — Pi startet neu…'**
  String get updateRestarting;

  /// Hotspot active banner title
  ///
  /// In de, this message translates to:
  /// **'Hotspot aktiv'**
  String get hotspotActive;

  /// Hotspot SSID label
  ///
  /// In de, this message translates to:
  /// **'SSID'**
  String get hotspotSsid;

  /// Hotspot password label
  ///
  /// In de, this message translates to:
  /// **'Passwort'**
  String get hotspotPassword;

  /// Hotspot IP label
  ///
  /// In de, this message translates to:
  /// **'IP'**
  String get hotspotIp;

  /// WiFi sheet title
  ///
  /// In de, this message translates to:
  /// **'WLAN'**
  String get wifiTitle;

  /// Restart WiFi adapter tooltip
  ///
  /// In de, this message translates to:
  /// **'Adapter neu starten'**
  String get wifiAdapterRestart;

  /// Available networks section header
  ///
  /// In de, this message translates to:
  /// **'Verfügbare Netzwerke'**
  String get wifiAvailableNetworks;

  /// Shown while scanning for networks
  ///
  /// In de, this message translates to:
  /// **'Suche Netzwerke…'**
  String get wifiSearching;

  /// Connected status text
  ///
  /// In de, this message translates to:
  /// **'Verbunden'**
  String get wifiConnected;

  /// Not connected status text
  ///
  /// In de, this message translates to:
  /// **'Nicht verbunden'**
  String get wifiNotConnected;

  /// Connected and saved network badge
  ///
  /// In de, this message translates to:
  /// **'Verbunden · Gespeichert'**
  String get wifiConnectedSaved;

  /// Saved network badge
  ///
  /// In de, this message translates to:
  /// **'Gespeichert'**
  String get wifiSaved;

  /// Start hotspot button
  ///
  /// In de, this message translates to:
  /// **'Hotspot starten'**
  String get wifiStartHotspot;

  /// Disconnect from WiFi button
  ///
  /// In de, this message translates to:
  /// **'Trennen'**
  String get wifiDisconnect;

  /// WiFi signal strength
  ///
  /// In de, this message translates to:
  /// **'Signal: {percent}%'**
  String wifiSignal(int percent);

  /// Forget saved network button
  ///
  /// In de, this message translates to:
  /// **'Vergessen'**
  String get wifiForget;

  /// Forget network confirmation dialog title
  ///
  /// In de, this message translates to:
  /// **'\"{ssid}\" vergessen?'**
  String wifiForgetTitle(String ssid);

  /// Forget network confirmation dialog body
  ///
  /// In de, this message translates to:
  /// **'Das gespeicherte Profil wird gelöscht.'**
  String get wifiForgetBody;

  /// Password dialog title
  ///
  /// In de, this message translates to:
  /// **'Verbinden mit \"{ssid}\"'**
  String wifiConnectTo(String ssid);

  /// WiFi password keyboard label
  ///
  /// In de, this message translates to:
  /// **'WLAN-Passwort'**
  String get wifiPasswordLabel;

  /// WiFi password field placeholder
  ///
  /// In de, this message translates to:
  /// **'Passwort eingeben…'**
  String get wifiPasswordHint;

  /// GPS panel title
  ///
  /// In de, this message translates to:
  /// **'GPS Status'**
  String get gpsStatusTitle;

  /// GPS fix status
  ///
  /// In de, this message translates to:
  /// **'Fix'**
  String get gpsFix;

  /// GPS no fix status
  ///
  /// In de, this message translates to:
  /// **'Kein Fix'**
  String get gpsNoFix;

  /// GPS satellites label
  ///
  /// In de, this message translates to:
  /// **'Satelliten'**
  String get gpsSatellites;

  /// GPS altitude label
  ///
  /// In de, this message translates to:
  /// **'Höhe'**
  String get gpsAltitude;

  /// GPS position label
  ///
  /// In de, this message translates to:
  /// **'Position'**
  String get gpsPosition;

  /// No GPS data received message
  ///
  /// In de, this message translates to:
  /// **'Keine GPS-Daten empfangen'**
  String get gpsNoData;

  /// HDOP quality: very good
  ///
  /// In de, this message translates to:
  /// **'sehr gut'**
  String get gpsQualityVeryGood;

  /// HDOP quality: good
  ///
  /// In de, this message translates to:
  /// **'gut'**
  String get gpsQualityGood;

  /// HDOP quality: ok
  ///
  /// In de, this message translates to:
  /// **'ok'**
  String get gpsQualityOk;

  /// HDOP quality: bad
  ///
  /// In de, this message translates to:
  /// **'schlecht'**
  String get gpsQualityBad;

  /// No dashboard layout configured message
  ///
  /// In de, this message translates to:
  /// **'Kein Dashboard-Layout konfiguriert.'**
  String get dashboardNoLayout;

  /// No screens in layout message
  ///
  /// In de, this message translates to:
  /// **'Keine Screens im Layout.'**
  String get dashboardNoScreens;

  /// No widgets in layout message
  ///
  /// In de, this message translates to:
  /// **'Keine Widgets im Layout.'**
  String get dashboardNoWidgets;

  /// Mute impact alarm button
  ///
  /// In de, this message translates to:
  /// **'Alarm stumm'**
  String get dashboardAlarmMute;

  /// Offline maps unavailable banner
  ///
  /// In de, this message translates to:
  /// **'⚠ Offline-Karten nicht verfügbar · Online-Fallback (OpenStreetMap)'**
  String get mapOfflineFallback;

  /// Map layer toggle: Locks
  ///
  /// In de, this message translates to:
  /// **'Schleusen'**
  String get mapLayerLocks;

  /// Map layer toggle: Water levels
  ///
  /// In de, this message translates to:
  /// **'Pegel'**
  String get mapLayerGauge;

  /// Map layer toggle: Favorites
  ///
  /// In de, this message translates to:
  /// **'Favoriten'**
  String get mapLayerFavorites;

  /// Plan route button
  ///
  /// In de, this message translates to:
  /// **'Route planen'**
  String get mapPlanRoute;

  /// Delete waypoint confirmation title
  ///
  /// In de, this message translates to:
  /// **'Wegpunkt {index} löschen?'**
  String mapDeleteWaypointTitle(int index);

  /// Saved routes sheet title
  ///
  /// In de, this message translates to:
  /// **'Gespeicherte Routen'**
  String get mapSavedRoutesTitle;

  /// No saved routes message
  ///
  /// In de, this message translates to:
  /// **'Keine gespeicherten Routen.'**
  String get mapNoSavedRoutes;

  /// Save route button/dialog title
  ///
  /// In de, this message translates to:
  /// **'Route speichern'**
  String get mapSaveRoute;

  /// Route name input placeholder
  ///
  /// In de, this message translates to:
  /// **'Name eingeben…'**
  String get mapRouteNameHint;

  /// Simulation mode label
  ///
  /// In de, this message translates to:
  /// **'Simulation'**
  String get mapSimulation;

  /// Stop simulation button
  ///
  /// In de, this message translates to:
  /// **'Sim Stop'**
  String get mapSimStop;

  /// Navigation mode label
  ///
  /// In de, this message translates to:
  /// **'Navigation'**
  String get mapNavigation;

  /// Stop navigation button
  ///
  /// In de, this message translates to:
  /// **'Stopp'**
  String get mapNavStop;

  /// Departure time: now
  ///
  /// In de, this message translates to:
  /// **'Jetzt'**
  String get mapNow;

  /// Today label in route panel
  ///
  /// In de, this message translates to:
  /// **'heute'**
  String get mapToday;

  /// Departure time label
  ///
  /// In de, this message translates to:
  /// **'Abfahrt:'**
  String get mapDeparture;

  /// Direct route type
  ///
  /// In de, this message translates to:
  /// **'Direkt'**
  String get mapDirect;

  /// Long tap hint in route panel
  ///
  /// In de, this message translates to:
  /// **'Langer Tipp auf die Karte, um Wegpunkt zu setzen'**
  String get mapLongTapHint;

  /// MOB confirmation dialog title
  ///
  /// In de, this message translates to:
  /// **'🆘 SOS / Man Over Board'**
  String get mapMobTitle;

  /// MOB confirmation dialog body
  ///
  /// In de, this message translates to:
  /// **'GPS-Position jetzt als MOB-Marker setzen?'**
  String get mapMobConfirm;

  /// Set MOB button
  ///
  /// In de, this message translates to:
  /// **'MOB SETZEN'**
  String get mapMobSet;

  /// AIS navstat: under way using engine
  ///
  /// In de, this message translates to:
  /// **'Unter Maschine'**
  String get navstatEngine;

  /// AIS navstat: at anchor
  ///
  /// In de, this message translates to:
  /// **'Geankert'**
  String get navstatAnchored;

  /// AIS navstat: not under command
  ///
  /// In de, this message translates to:
  /// **'Nicht manövrierfähig'**
  String get navstatNUC;

  /// AIS navstat: restricted manoeuvrability
  ///
  /// In de, this message translates to:
  /// **'Eingeschränkt manövrierfähig'**
  String get navstatRestricted;

  /// AIS navstat: moored
  ///
  /// In de, this message translates to:
  /// **'Festgemacht'**
  String get navstatMoored;

  /// AIS navstat: aground
  ///
  /// In de, this message translates to:
  /// **'Auf Grund'**
  String get navstatAground;

  /// AIS navstat: fishing
  ///
  /// In de, this message translates to:
  /// **'Fischerei'**
  String get navstatFishing;

  /// AIS navstat: unknown
  ///
  /// In de, this message translates to:
  /// **'Unbekannt'**
  String get navstatUnknown;

  /// Route planner long-tap hint
  ///
  /// In de, this message translates to:
  /// **'Langer Tipp auf die Karte → Wegpunkt setzen'**
  String get routePlannerHint;

  /// Logbook screen title
  ///
  /// In de, this message translates to:
  /// **'Logbuch'**
  String get logbookTitle;

  /// Logbook tab: active trip
  ///
  /// In de, this message translates to:
  /// **'Fahrt'**
  String get logbookTabTrip;

  /// Logbook tab: archive
  ///
  /// In de, this message translates to:
  /// **'Archiv'**
  String get logbookTabArchive;

  /// Logbook tab: crew
  ///
  /// In de, this message translates to:
  /// **'Crew'**
  String get logbookTabCrew;

  /// No active trip recording message
  ///
  /// In de, this message translates to:
  /// **'Keine aktive Fahrtaufzeichnung'**
  String get logbookNoActiveTrip;

  /// Start trip button
  ///
  /// In de, this message translates to:
  /// **'Fahrt starten'**
  String get logbookStartTrip;

  /// Distance stat label
  ///
  /// In de, this message translates to:
  /// **'Distanz'**
  String get logbookDistance;

  /// Duration stat label
  ///
  /// In de, this message translates to:
  /// **'Dauer'**
  String get logbookDuration;

  /// Track points stat label
  ///
  /// In de, this message translates to:
  /// **'Punkte'**
  String get logbookPoints;

  /// Average speed stat label
  ///
  /// In de, this message translates to:
  /// **'Ø Geschw.'**
  String get logbookAvgSpeed;

  /// Pause trip button
  ///
  /// In de, this message translates to:
  /// **'Pause'**
  String get logbookPause;

  /// Resume trip button
  ///
  /// In de, this message translates to:
  /// **'Weiter'**
  String get logbookResume;

  /// End trip button
  ///
  /// In de, this message translates to:
  /// **'Fahrt beenden'**
  String get logbookEndTrip;

  /// Add note button
  ///
  /// In de, this message translates to:
  /// **'Notiz hinzufügen'**
  String get logbookAddNote;

  /// End trip confirmation dialog title
  ///
  /// In de, this message translates to:
  /// **'Fahrt beenden?'**
  String get logbookEndTripTitle;

  /// End trip confirmation dialog body
  ///
  /// In de, this message translates to:
  /// **'Die Aufzeichnung wird gestoppt und gespeichert.'**
  String get logbookEndTripBody;

  /// Trip stop failed error message
  ///
  /// In de, this message translates to:
  /// **'Stop fehlgeschlagen'**
  String get logbookStopFailed;

  /// Trip start failed error message
  ///
  /// In de, this message translates to:
  /// **'Start fehlgeschlagen'**
  String get logbookStartFailed;

  /// Trip pause failed error message
  ///
  /// In de, this message translates to:
  /// **'Pause fehlgeschlagen'**
  String get logbookPauseFailed;

  /// Trip resume failed error message
  ///
  /// In de, this message translates to:
  /// **'Fortsetzen fehlgeschlagen'**
  String get logbookResumeFailed;

  /// Note input placeholder
  ///
  /// In de, this message translates to:
  /// **'Notiz...'**
  String get logbookNoteHint;

  /// Note save failed error message
  ///
  /// In de, this message translates to:
  /// **'Notiz konnte nicht gespeichert werden'**
  String get logbookNoteSaveFailed;

  /// Trip paused status
  ///
  /// In de, this message translates to:
  /// **'Pausiert'**
  String get logbookPaused;

  /// Trip recording status
  ///
  /// In de, this message translates to:
  /// **'Aufzeichnung läuft'**
  String get logbookRecording;

  /// No trips saved message
  ///
  /// In de, this message translates to:
  /// **'Keine Fahrten gespeichert'**
  String get logbookNoTrips;

  /// Crew selection sheet title
  ///
  /// In de, this message translates to:
  /// **'Crew für diese Fahrt'**
  String get logbookCrewForTrip;

  /// Crew selection optional hint
  ///
  /// In de, this message translates to:
  /// **'Optional — kann leer bleiben'**
  String get logbookCrewOptional;

  /// No crew members available
  ///
  /// In de, this message translates to:
  /// **'Keine Crew-Mitglieder vorhanden.'**
  String get logbookNoCrewAvailable;

  /// Load error message
  ///
  /// In de, this message translates to:
  /// **'Fehler beim Laden.'**
  String get logbookLoadError;

  /// Trip detail: weather at start
  ///
  /// In de, this message translates to:
  /// **'Wetter (Start)'**
  String get logbookWeatherStart;

  /// Trip detail: water levels section
  ///
  /// In de, this message translates to:
  /// **'Pegelstände'**
  String get logbookWaterLevels;

  /// Trip detail: statistics section
  ///
  /// In de, this message translates to:
  /// **'Statistiken'**
  String get logbookStats;

  /// Trip stat: max speed
  ///
  /// In de, this message translates to:
  /// **'Max Speed'**
  String get logbookMaxSpeed;

  /// Trip stat: average speed
  ///
  /// In de, this message translates to:
  /// **'Ø Speed'**
  String get logbookAvgSpeedStat;

  /// Trip detail: log entries section
  ///
  /// In de, this message translates to:
  /// **'Logeinträge'**
  String get logbookEntries;

  /// Show trip on map button
  ///
  /// In de, this message translates to:
  /// **'Auf Karte'**
  String get logbookOnMap;

  /// GPX export success message
  ///
  /// In de, this message translates to:
  /// **'GPX gespeichert: {path}'**
  String logbookGpxSaved(String path);

  /// GPX export failed message
  ///
  /// In de, this message translates to:
  /// **'GPX-Export fehlgeschlagen'**
  String get logbookGpxFailed;

  /// Trip log entry type: start
  ///
  /// In de, this message translates to:
  /// **'Start'**
  String get logbookStart;

  /// Trip log entry type: end
  ///
  /// In de, this message translates to:
  /// **'Ende'**
  String get logbookEnd;

  /// Trip log entry type: continue
  ///
  /// In de, this message translates to:
  /// **'Weiterfahrt'**
  String get logbookContinue;

  /// Trip log entry type: note
  ///
  /// In de, this message translates to:
  /// **'Notiz'**
  String get logbookNote;

  /// Crew trip count suffix
  ///
  /// In de, this message translates to:
  /// **'Fahrten'**
  String get logbookTripsCount;

  /// Add crew member dialog title
  ///
  /// In de, this message translates to:
  /// **'Crew hinzufügen'**
  String get crewAddTitle;

  /// Edit crew member dialog title
  ///
  /// In de, this message translates to:
  /// **'Crew bearbeiten'**
  String get crewEditTitle;

  /// Crew avatar label
  ///
  /// In de, this message translates to:
  /// **'Avatar'**
  String get crewAvatar;

  /// Crew member name label
  ///
  /// In de, this message translates to:
  /// **'Name'**
  String get crewName;

  /// Crew member role label
  ///
  /// In de, this message translates to:
  /// **'Rolle'**
  String get crewRole;

  /// Crew member email label
  ///
  /// In de, this message translates to:
  /// **'E-Mail (optional)'**
  String get crewEmail;

  /// Crew member phone label
  ///
  /// In de, this message translates to:
  /// **'Telefon (optional)'**
  String get crewPhone;

  /// Name required validation error
  ///
  /// In de, this message translates to:
  /// **'Name erforderlich'**
  String get crewNameRequired;

  /// Delete crew member confirmation title
  ///
  /// In de, this message translates to:
  /// **'{name} löschen?'**
  String crewDeleteTitle(String name);

  /// Delete crew member confirmation body
  ///
  /// In de, this message translates to:
  /// **'Crew-Mitglied wird entfernt.'**
  String get crewDeleteBody;

  /// Delete crew member failed message
  ///
  /// In de, this message translates to:
  /// **'Löschen fehlgeschlagen'**
  String get crewDeleteFailed;

  /// No crew members message
  ///
  /// In de, this message translates to:
  /// **'Keine Crew-Mitglieder'**
  String get crewEmpty;

  /// Favorites sheet title with count
  ///
  /// In de, this message translates to:
  /// **'Favoriten ({count})'**
  String favoritesTitle(int count);

  /// No favorites saved message
  ///
  /// In de, this message translates to:
  /// **'Keine Favoriten gespeichert'**
  String get favoritesEmpty;

  /// Add favorite sheet title
  ///
  /// In de, this message translates to:
  /// **'Favorit hinzufügen'**
  String get favoritesAdd;

  /// Favorite category label
  ///
  /// In de, this message translates to:
  /// **'Kategorie'**
  String get favoritesCategory;

  /// Favorite category: marina
  ///
  /// In de, this message translates to:
  /// **'Marina'**
  String get favoritesMarina;

  /// Favorite category: anchorage
  ///
  /// In de, this message translates to:
  /// **'Ankerplatz'**
  String get favoritesAnchor;

  /// Favorite category: fuel station
  ///
  /// In de, this message translates to:
  /// **'Tankstelle'**
  String get favoritesFuel;

  /// Favorite category: lock
  ///
  /// In de, this message translates to:
  /// **'Schleuse'**
  String get favoritesLock;

  /// Favorite category: bridge
  ///
  /// In de, this message translates to:
  /// **'Brücke'**
  String get favoritesBridge;

  /// Favorite category: restaurant
  ///
  /// In de, this message translates to:
  /// **'Restaurant'**
  String get favoritesRestaurant;

  /// Favorite category: shop
  ///
  /// In de, this message translates to:
  /// **'Geschäft'**
  String get favoritesShop;

  /// Favorite category: hazard
  ///
  /// In de, this message translates to:
  /// **'Gefahrenstelle'**
  String get favoritesDanger;

  /// Favorite category: other
  ///
  /// In de, this message translates to:
  /// **'Sonstiges'**
  String get favoritesOther;

  /// Favorite notes field placeholder
  ///
  /// In de, this message translates to:
  /// **'Notizen (optional)'**
  String get favoritesNotes;

  /// Favorite save failed message
  ///
  /// In de, this message translates to:
  /// **'Fehler beim Speichern'**
  String get favoritesSaveFailed;

  /// Go to favorite position button
  ///
  /// In de, this message translates to:
  /// **'Zur Position'**
  String get favoritesGoTo;

  /// Add favorite as waypoint button
  ///
  /// In de, this message translates to:
  /// **'Als Wegpunkt'**
  String get favoritesAsWaypoint;

  /// Favorite position label
  ///
  /// In de, this message translates to:
  /// **'Position'**
  String get favoritesPosition;

  /// Onscreen keyboard empty input placeholder
  ///
  /// In de, this message translates to:
  /// **'Eingabe…'**
  String get keyboardHint;

  /// Settings screen title
  ///
  /// In de, this message translates to:
  /// **'Einstellungen'**
  String get settingsTitle;

  /// Settings saved snackbar message
  ///
  /// In de, this message translates to:
  /// **'Gespeichert'**
  String get settingsSaved;

  /// Settings section: vessel
  ///
  /// In de, this message translates to:
  /// **'Schiff'**
  String get settingsSectionShip;

  /// Settings section: map
  ///
  /// In de, this message translates to:
  /// **'Karte'**
  String get settingsSectionMap;

  /// Settings section: navigation
  ///
  /// In de, this message translates to:
  /// **'Navigation'**
  String get settingsSectionNavigation;

  /// Settings section: GPS
  ///
  /// In de, this message translates to:
  /// **'GPS'**
  String get settingsSectionGPS;

  /// Settings section: AIS
  ///
  /// In de, this message translates to:
  /// **'AIS'**
  String get settingsSectionAIS;

  /// Settings section: units
  ///
  /// In de, this message translates to:
  /// **'Einheiten'**
  String get settingsSectionUnits;

  /// Settings section: MQTT
  ///
  /// In de, this message translates to:
  /// **'MQTT'**
  String get settingsSectionMQTT;

  /// Settings section: locks
  ///
  /// In de, this message translates to:
  /// **'Schleusen'**
  String get settingsSectionLocks;

  /// Settings section: ENC charts
  ///
  /// In de, this message translates to:
  /// **'ENC-Karten'**
  String get settingsSectionENC;

  /// Settings section: dashboard
  ///
  /// In de, this message translates to:
  /// **'Dashboard'**
  String get settingsSectionDashboard;

  /// Settings section: data
  ///
  /// In de, this message translates to:
  /// **'Daten'**
  String get settingsSectionData;

  /// Settings section: display
  ///
  /// In de, this message translates to:
  /// **'Display'**
  String get settingsSectionDisplay;

  /// Settings section: system
  ///
  /// In de, this message translates to:
  /// **'System'**
  String get settingsSectionSystem;

  /// Boat icon selector label
  ///
  /// In de, this message translates to:
  /// **'Boot-Icon'**
  String get shipIconLabel;

  /// Boat type: yacht
  ///
  /// In de, this message translates to:
  /// **'Yacht'**
  String get shipYacht;

  /// Boat type: motorboat
  ///
  /// In de, this message translates to:
  /// **'Motorboot'**
  String get shipMotorboat;

  /// Boat type: sailboat
  ///
  /// In de, this message translates to:
  /// **'Segelboot'**
  String get shipSailboat;

  /// Boat type: kayak
  ///
  /// In de, this message translates to:
  /// **'Kajak'**
  String get shipKayak;

  /// Boat dimensions section header
  ///
  /// In de, this message translates to:
  /// **'Abmessungen'**
  String get shipDimensions;

  /// Boat length field label
  ///
  /// In de, this message translates to:
  /// **'Länge (m)'**
  String get shipLength;

  /// Boat beam field label
  ///
  /// In de, this message translates to:
  /// **'Breite (m)'**
  String get shipBeam;

  /// Boat draft field label
  ///
  /// In de, this message translates to:
  /// **'Tiefgang (m)'**
  String get shipDraft;

  /// Boat air draft field label
  ///
  /// In de, this message translates to:
  /// **'Höhe (m)'**
  String get shipHeight;

  /// Boat propulsion section header
  ///
  /// In de, this message translates to:
  /// **'Antrieb'**
  String get shipDrive;

  /// Cruise speed field label
  ///
  /// In de, this message translates to:
  /// **'Reisegeschw. (km/h)'**
  String get shipCruiseSpeed;

  /// Fuel capacity field label
  ///
  /// In de, this message translates to:
  /// **'Kraftstoff (L)'**
  String get shipFuelCapacity;

  /// Fuel consumption field label
  ///
  /// In de, this message translates to:
  /// **'Verbrauch (L/h)'**
  String get shipFuelConsumption;

  /// OpenSeaMap toggle label
  ///
  /// In de, this message translates to:
  /// **'OpenSeaMap'**
  String get mapSettingsOpenSeaMap;

  /// Show locks toggle label
  ///
  /// In de, this message translates to:
  /// **'Schleusen anzeigen'**
  String get mapSettingsShowLocks;

  /// Show water levels toggle label
  ///
  /// In de, this message translates to:
  /// **'Pegelstände anzeigen'**
  String get mapSettingsShowGauges;

  /// Show track toggle label
  ///
  /// In de, this message translates to:
  /// **'Track anzeigen'**
  String get mapSettingsShowTrack;

  /// Auto-center toggle label
  ///
  /// In de, this message translates to:
  /// **'Auto-Zentrieren'**
  String get mapSettingsAutoCenter;

  /// Heading-up mode toggle label
  ///
  /// In de, this message translates to:
  /// **'Kurs-Oben (Heading-Up)'**
  String get mapSettingsHeadingUp;

  /// Map display section header
  ///
  /// In de, this message translates to:
  /// **'Anzeige'**
  String get mapSettingsDisplay;

  /// UI scale slider label
  ///
  /// In de, this message translates to:
  /// **'UI-Skalierung'**
  String get mapSettingsUiScale;

  /// Navigation track section header
  ///
  /// In de, this message translates to:
  /// **'Track'**
  String get navSettingsTrack;

  /// Auto-track toggle label
  ///
  /// In de, this message translates to:
  /// **'Auto-Track'**
  String get navSettingsAutoTrack;

  /// Track interval label
  ///
  /// In de, this message translates to:
  /// **'Track-Intervall'**
  String get navSettingsTrackInterval;

  /// Arrival section header
  ///
  /// In de, this message translates to:
  /// **'Ankunft'**
  String get navSettingsArrival;

  /// Arrival alarm toggle label
  ///
  /// In de, this message translates to:
  /// **'Ankunftsalarm'**
  String get navSettingsArrivalAlarm;

  /// Alarm radius label
  ///
  /// In de, this message translates to:
  /// **'Alarm-Radius'**
  String get navSettingsAlarmRadius;

  /// Day planning section header
  ///
  /// In de, this message translates to:
  /// **'Tagesplanung'**
  String get navSettingsDayPlanning;

  /// Default speed field label
  ///
  /// In de, this message translates to:
  /// **'Standardgeschw. (km/h)'**
  String get navSettingsDefaultSpeed;

  /// Max daily trip label
  ///
  /// In de, this message translates to:
  /// **'Tagesreise max.'**
  String get navSettingsMaxDayTrip;

  /// Day start time field label
  ///
  /// In de, this message translates to:
  /// **'Tagesstart (HH:MM)'**
  String get navSettingsDayStart;

  /// Routing section header
  ///
  /// In de, this message translates to:
  /// **'Routing'**
  String get navSettingsRouting;

  /// Prefer waterways toggle label
  ///
  /// In de, this message translates to:
  /// **'Wasserstraßen bevorzugen'**
  String get navSettingsPreferWaterways;

  /// Consider current toggle label
  ///
  /// In de, this message translates to:
  /// **'Strömung berücksichtigen'**
  String get navSettingsConsiderCurrent;

  /// OSRM URL field label
  ///
  /// In de, this message translates to:
  /// **'OSRM URL'**
  String get navSettingsOsrmUrl;

  /// Current by river section header
  ///
  /// In de, this message translates to:
  /// **'Strömungen nach Gewässer (km/h)'**
  String get navSettingsCurrentByRiver;

  /// Current by type section header
  ///
  /// In de, this message translates to:
  /// **'Strömungen nach Typ (km/h)'**
  String get navSettingsCurrentByType;

  /// River type: river
  ///
  /// In de, this message translates to:
  /// **'Fluss'**
  String get navRiverTypeFluss;

  /// River type: canal
  ///
  /// In de, this message translates to:
  /// **'Kanal'**
  String get navRiverTypeKanal;

  /// River type: stream
  ///
  /// In de, this message translates to:
  /// **'Bach'**
  String get navRiverTypeBach;

  /// River type: lake
  ///
  /// In de, this message translates to:
  /// **'See'**
  String get navRiverTypeSee;

  /// GPS device section header
  ///
  /// In de, this message translates to:
  /// **'GPS-Gerät (SignalK)'**
  String get gpsSettingsDevice;

  /// GPS port field label
  ///
  /// In de, this message translates to:
  /// **'Port (device)'**
  String get gpsSettingsPort;

  /// GPS baud rate field label
  ///
  /// In de, this message translates to:
  /// **'Baudrate'**
  String get gpsSettingsBaudrate;

  /// Apply GPS config button
  ///
  /// In de, this message translates to:
  /// **'Übernehmen & SignalK neu starten'**
  String get gpsSettingsApply;

  /// GPS config saved snackbar
  ///
  /// In de, this message translates to:
  /// **'GPS-Konfiguration gespeichert'**
  String get gpsSettingsConfigSaved;

  /// GPS source section header
  ///
  /// In de, this message translates to:
  /// **'GPS-Quelle'**
  String get gpsSettingsSource;

  /// Min satellites alarm threshold label
  ///
  /// In de, this message translates to:
  /// **'Mindest-Satelliten (Alarm)'**
  String get gpsSettingsMinSat;

  /// AIS enabled toggle label
  ///
  /// In de, this message translates to:
  /// **'AIS aktiviert'**
  String get aisSettingsEnabled;

  /// AIS provider label
  ///
  /// In de, this message translates to:
  /// **'Anbieter'**
  String get aisSettingsProvider;

  /// AIS API key label
  ///
  /// In de, this message translates to:
  /// **'API-Key'**
  String get aisSettingsApiKey;

  /// AIS range field label
  ///
  /// In de, this message translates to:
  /// **'Reichweite (NM)'**
  String get aisSettingsRange;

  /// AIS update interval label
  ///
  /// In de, this message translates to:
  /// **'Update-Intervall'**
  String get aisSettingsInterval;

  /// AIS vessel labels toggle
  ///
  /// In de, this message translates to:
  /// **'Schiff-Beschriftungen'**
  String get aisSettingsLabels;

  /// AIS CPA alarm section header
  ///
  /// In de, this message translates to:
  /// **'Kollisionsalarm (CPA)'**
  String get aisSettingsCpaAlarm;

  /// AIS CPA alarm toggle label
  ///
  /// In de, this message translates to:
  /// **'CPA-Alarm aktiviert'**
  String get aisSettingsCpaEnabled;

  /// AIS min CPA distance label
  ///
  /// In de, this message translates to:
  /// **'Min. CPA-Distanz (NM)'**
  String get aisSettingsCpaDistance;

  /// Units: speed
  ///
  /// In de, this message translates to:
  /// **'Geschwindigkeit'**
  String get unitsSpeed;

  /// Units: distance
  ///
  /// In de, this message translates to:
  /// **'Distanz'**
  String get unitsDistance;

  /// Units: depth
  ///
  /// In de, this message translates to:
  /// **'Tiefe'**
  String get unitsDepth;

  /// Units: temperature
  ///
  /// In de, this message translates to:
  /// **'Temperatur'**
  String get unitsTemperature;

  /// Units: pressure
  ///
  /// In de, this message translates to:
  /// **'Druck'**
  String get unitsPressure;

  /// Units: volume
  ///
  /// In de, this message translates to:
  /// **'Volumen'**
  String get unitsVolume;

  /// Coordinate format label
  ///
  /// In de, this message translates to:
  /// **'Koordinatenformat'**
  String get unitsCoordFormat;

  /// Coordinate format: decimal
  ///
  /// In de, this message translates to:
  /// **'Dezimal (51.856°)'**
  String get unitsCoordDecimal;

  /// Coordinate format: degrees/minutes
  ///
  /// In de, this message translates to:
  /// **'Grad/Min (51° 51.3\')'**
  String get unitsCoordDegMin;

  /// Coordinate format: degrees/minutes/seconds
  ///
  /// In de, this message translates to:
  /// **'Grad/Min/Sek'**
  String get unitsCoordDegMinSec;

  /// Language selector label
  ///
  /// In de, this message translates to:
  /// **'Sprache'**
  String get unitsLanguage;

  /// Language option: German
  ///
  /// In de, this message translates to:
  /// **'Deutsch'**
  String get unitsLangDE;

  /// Language option: English
  ///
  /// In de, this message translates to:
  /// **'English'**
  String get unitsLangEN;

  /// MQTT external access section header
  ///
  /// In de, this message translates to:
  /// **'Externer Zugriff (Sensor-Board)'**
  String get mqttExternalAccess;

  /// Sensor board connection label
  ///
  /// In de, this message translates to:
  /// **'Sensor-Board Verbindung'**
  String get mqttSensorBoardConn;

  /// MQTT broker address hint for sensor board
  ///
  /// In de, this message translates to:
  /// **'Broker-Adresse im Sensor eintragen:'**
  String get mqttBrokerHint;

  /// MQTT IP loading placeholder
  ///
  /// In de, this message translates to:
  /// **'— (MQTT-Tab antippen zum Laden)'**
  String get mqttBrokerLoading;

  /// MQTT broker section header
  ///
  /// In de, this message translates to:
  /// **'MQTT-Broker'**
  String get mqttBrokerSection;

  /// MQTT broker URL field label
  ///
  /// In de, this message translates to:
  /// **'Broker URL'**
  String get mqttBrokerUrl;

  /// MQTT username field label
  ///
  /// In de, this message translates to:
  /// **'Benutzername'**
  String get mqttUsername;

  /// MQTT password field label
  ///
  /// In de, this message translates to:
  /// **'Passwort'**
  String get mqttPassword;

  /// Test MQTT connection button
  ///
  /// In de, this message translates to:
  /// **'Verbindung testen'**
  String get mqttTestBtn;

  /// Clean up MQTT topics button
  ///
  /// In de, this message translates to:
  /// **'Bereinigen'**
  String get mqttCleanBtn;

  /// Enable external MQTT access button
  ///
  /// In de, this message translates to:
  /// **'Externen Zugriff aktivieren'**
  String get mqttEnableExternal;

  /// MQTT test success snackbar
  ///
  /// In de, this message translates to:
  /// **'MQTT-Test erfolgreich'**
  String get mqttTestSuccess;

  /// MQTT test failed snackbar
  ///
  /// In de, this message translates to:
  /// **'MQTT-Test fehlgeschlagen'**
  String get mqttTestFailed;

  /// MQTT cleanup success snackbar
  ///
  /// In de, this message translates to:
  /// **'MQTT-Bereinigung erfolgreich'**
  String get mqttCleanSuccess;

  /// MQTT cleanup failed snackbar
  ///
  /// In de, this message translates to:
  /// **'MQTT-Bereinigung fehlgeschlagen'**
  String get mqttCleanFailed;

  /// Enable external MQTT dialog title
  ///
  /// In de, this message translates to:
  /// **'Externen MQTT-Zugriff aktivieren?'**
  String get mqttEnableExternalTitle;

  /// Enable external MQTT dialog body
  ///
  /// In de, this message translates to:
  /// **'Mosquitto wird so konfiguriert, dass externe Geräte (z.B. Sensorboard) sich auf Port 1883 verbinden können.\n\nSudo-Berechtigung muss einmalig per SSH eingerichtet sein.'**
  String get mqttEnableExternalBody;

  /// Activate button in MQTT dialog
  ///
  /// In de, this message translates to:
  /// **'Aktivieren'**
  String get mqttActivate;

  /// Depth alarm section header
  ///
  /// In de, this message translates to:
  /// **'Tiefen-Alarm'**
  String get mqttDepthAlarm;

  /// Depth alarm threshold label
  ///
  /// In de, this message translates to:
  /// **'Alarm bei < (m)'**
  String get mqttDepthThreshold;

  /// Depth alarm enabled toggle label
  ///
  /// In de, this message translates to:
  /// **'Tiefenalarm aktiv'**
  String get mqttDepthAlarmEnabled;

  /// Screen saver section header
  ///
  /// In de, this message translates to:
  /// **'Bildschirmschoner'**
  String get displayScreensaver;

  /// Screen saver timeout label
  ///
  /// In de, this message translates to:
  /// **'Timeout'**
  String get displayTimeout;

  /// Screen saver timeout: off
  ///
  /// In de, this message translates to:
  /// **'Aus'**
  String get displayTimeoutOff;

  /// Screen saver timeout: 5 minutes
  ///
  /// In de, this message translates to:
  /// **'5 Min'**
  String get displayTimeout5;

  /// Screen saver timeout: 10 minutes
  ///
  /// In de, this message translates to:
  /// **'10 Min'**
  String get displayTimeout10;

  /// Screen saver timeout: 15 minutes
  ///
  /// In de, this message translates to:
  /// **'15 Min'**
  String get displayTimeout15;

  /// Screen saver timeout: 30 minutes
  ///
  /// In de, this message translates to:
  /// **'30 Min'**
  String get displayTimeout30;

  /// Two-stage screen saver toggle label
  ///
  /// In de, this message translates to:
  /// **'Zweistufiger Bildschirmschoner'**
  String get displayTwoStage;

  /// Two-stage screen saver info text
  ///
  /// In de, this message translates to:
  /// **'Stufe 1: App-Overlay (schwarz) nach dem Timeout.\nStufe 2: Display aus (Hardware) 60 Sekunden später.\nJede Berührung weckt beides wieder auf.'**
  String get displayTwoStageInfo;

  /// Software version section header
  ///
  /// In de, this message translates to:
  /// **'Software-Version'**
  String get systemVersionTitle;

  /// Installed version label
  ///
  /// In de, this message translates to:
  /// **'Installiert'**
  String get systemInstalled;

  /// Available version label
  ///
  /// In de, this message translates to:
  /// **'Verfügbar'**
  String get systemAvailable;

  /// Shut down Pi button in settings
  ///
  /// In de, this message translates to:
  /// **'Pi herunterfahren'**
  String get systemShutdownPiBtn;

  /// Shutdown confirmation dialog title
  ///
  /// In de, this message translates to:
  /// **'Jetzt herunterfahren?'**
  String get systemShutdownTitle;

  /// Shutdown confirmation dialog body
  ///
  /// In de, this message translates to:
  /// **'Der Pi lädt alle Änderungen und startet danach automatisch neu.'**
  String get systemShutdownBody;

  /// Update system button
  ///
  /// In de, this message translates to:
  /// **'System aktualisieren'**
  String get systemUpdateBtn;

  /// Lock database section header
  ///
  /// In de, this message translates to:
  /// **'Schleusen-Datenbank'**
  String get locksDb;

  /// Import locks from OSM button
  ///
  /// In de, this message translates to:
  /// **'Aus OpenStreetMap importieren'**
  String get locksImportOSM;

  /// OSM import dialog title
  ///
  /// In de, this message translates to:
  /// **'OSM-Import'**
  String get locksOSMImport;

  /// Enrich lock data button
  ///
  /// In de, this message translates to:
  /// **'VHF & Kontaktdaten anreichern'**
  String get locksEnrich;

  /// Data enrichment dialog title
  ///
  /// In de, this message translates to:
  /// **'Datenanreicherung'**
  String get locksDataEnrichment;

  /// Show quality report button
  ///
  /// In de, this message translates to:
  /// **'Qualitätsbericht anzeigen'**
  String get locksQualityReport;

  /// Quality report dialog title
  ///
  /// In de, this message translates to:
  /// **'Qualitätsbericht'**
  String get locksQualityTitle;

  /// Check and fix positions button
  ///
  /// In de, this message translates to:
  /// **'Positionen überprüfen & korrigieren'**
  String get locksCheckPositions;

  /// Position check dialog title
  ///
  /// In de, this message translates to:
  /// **'Positions-Check'**
  String get locksPosCheck;

  /// Please wait message
  ///
  /// In de, this message translates to:
  /// **'Bitte warten…'**
  String get locksPleaseWait;

  /// Installed ENC charts section header
  ///
  /// In de, this message translates to:
  /// **'Installierte ENC-Karten'**
  String get encInstalled;

  /// No charts installed message
  ///
  /// In de, this message translates to:
  /// **'Keine Karten installiert.'**
  String get encNoCharts;

  /// Available ENC charts section header
  ///
  /// In de, this message translates to:
  /// **'Verfügbare Karten (ELWIS)'**
  String get encAvailable;

  /// Load catalog button
  ///
  /// In de, this message translates to:
  /// **'Katalog laden'**
  String get encLoadCatalog;

  /// Loading indicator text
  ///
  /// In de, this message translates to:
  /// **'Lädt…'**
  String get encLoading;

  /// Installed label on ENC chart
  ///
  /// In de, this message translates to:
  /// **'Installiert'**
  String get encInstalledLabel;

  /// Track sensors section header
  ///
  /// In de, this message translates to:
  /// **'Track-Sensoren aufzeichnen'**
  String get dashSettingsTrackSensors;

  /// Track sensors description
  ///
  /// In de, this message translates to:
  /// **'Welche Dashboard-Sensoren sollen pro Track-Punkt gespeichert werden?'**
  String get dashSettingsTrackSensorsDesc;

  /// No sensors in dashboard message
  ///
  /// In de, this message translates to:
  /// **'Keine Sensoren im Dashboard konfiguriert.'**
  String get dashSettingsNoSensors;
}

class _AppLocalizationsDelegate
    extends LocalizationsDelegate<AppLocalizations> {
  const _AppLocalizationsDelegate();

  @override
  Future<AppLocalizations> load(Locale locale) {
    return SynchronousFuture<AppLocalizations>(lookupAppLocalizations(locale));
  }

  @override
  bool isSupported(Locale locale) =>
      <String>['de', 'en'].contains(locale.languageCode);

  @override
  bool shouldReload(_AppLocalizationsDelegate old) => false;
}

AppLocalizations lookupAppLocalizations(Locale locale) {
  // Lookup logic when only language code is specified.
  switch (locale.languageCode) {
    case 'de':
      return AppLocalizationsDe();
    case 'en':
      return AppLocalizationsEn();
  }

  throw FlutterError(
    'AppLocalizations.delegate failed to load unsupported locale "$locale". This is likely '
    'an issue with the localizations generation tool. Please file an issue '
    'on GitHub with a reproducible sample app and the gen-l10n configuration '
    'that was used.',
  );
}
