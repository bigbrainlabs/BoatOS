import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import '../services/settings_service.dart';
import '../widgets/gauge_widget.dart';
import '../widgets/onscreen_keyboard.dart';
import '../widgets/dashboard/dash_widget.dart';
import '../widgets/dashboard/registry.dart';
import '../widgets/dashboard/sensor_widget.dart' show SensorDashWidget;
import '../main.dart' show MainShellState;

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  static const _sections = <(IconData, String)>[
    (Icons.directions_boat, 'Schiff'),
    (Icons.map_outlined, 'Karte'),
    (Icons.navigation, 'Navigation'),
    (Icons.gps_fixed, 'GPS'),
    (Icons.radar, 'AIS'),
    (Icons.straighten, 'Einheiten'),
    (Icons.sensors, 'MQTT'),
    (Icons.lock, 'Schleusen'),
    (Icons.layers_outlined, 'ENC-Karten'),
    (Icons.dashboard_customize, 'Dashboard'),
    (Icons.storage, 'Daten'),
    (Icons.brightness_2, 'Display'),
    (Icons.system_update_alt, 'System'),
  ];

  int _sel = 0;
  bool _saving = false;
  bool _initialized = false;

  // Network info (for MQTT section)
  List<String> _piIps = [];

  // System / Update
  String _verCurrent = '…';
  String _verLatest  = '…';
  bool _verUpToDate  = false;
  bool _verLoading   = false;
  bool _updateRunning = false;
  List<String> _updateLog = [];
  Timer? _updatePollTimer;
  final _updateScrollCtrl = ScrollController();

  // Schiff
  late TextEditingController _boatName, _boatLength, _boatBeam, _boatDraft,
      _boatHeight, _boatSpeed, _boatFuel, _boatFuelConsumption;
  String _boatIcon = 'yacht';
  static const _boatIcons = <(String, IconData, String)>[
    ('yacht',     Icons.anchor,          'Yacht'),
    ('motorboat', Icons.directions_boat, 'Motorboot'),
    ('sailboat',  Icons.sailing,         'Segelboot'),
    ('kayak',     Icons.kayaking,        'Kajak'),
  ];

  // GPS
  late TextEditingController _gpsPort, _signalkUrl, _lowSatThreshold;
  int _gpsBaud = 4800;

  // AIS
  late TextEditingController _aisKey, _aisRange, _minCpa;

  // Navigation
  late TextEditingController _defaultSpeed, _dayStartTime, _osrmUrl;
  static const _rivers = ['Rhein', 'Mosel', 'Main', 'Elbe', 'Saale', 'Donau'];
  static const _riverTypes = ['river', 'canal', 'stream', 'lake'];
  static const _riverTypeLabels = ['Fluss', 'Kanal', 'Bach', 'See'];
  final Map<String, TextEditingController> _riverCtrl = {};
  final Map<String, TextEditingController> _riverTypeCtrl = {};

  // MQTT
  late TextEditingController _mqttUrl, _mqttUser, _mqttPass, _depthAlarm;

  @override
  void initState() {
    super.initState();
    _boatName         = TextEditingController();
    _boatLength       = TextEditingController();
    _boatBeam         = TextEditingController();
    _boatDraft        = TextEditingController();
    _boatHeight       = TextEditingController();
    _boatSpeed        = TextEditingController();
    _boatFuel         = TextEditingController();
    _boatFuelConsumption = TextEditingController();
    _gpsPort          = TextEditingController();
    _signalkUrl       = TextEditingController();
    _lowSatThreshold  = TextEditingController();
    _aisKey           = TextEditingController();
    _aisRange         = TextEditingController();
    _minCpa           = TextEditingController();
    _defaultSpeed     = TextEditingController();
    _dayStartTime     = TextEditingController();
    _osrmUrl          = TextEditingController();
    _mqttUrl          = TextEditingController();
    _mqttUser         = TextEditingController();
    _mqttPass         = TextEditingController();
    _depthAlarm       = TextEditingController();
    for (final r in _rivers)      _riverCtrl[r]     = TextEditingController();
    for (final t in _riverTypes)  _riverTypeCtrl[t] = TextEditingController();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final s = context.read<SettingsService>();
      await s.load();
      _populate(s);
      if (mounted) setState(() => _initialized = true);
    });
  }

  void _populate(SettingsService s) {
    final boat     = s.raw['boat']       as Map? ?? {};
    final gps      = s.raw['gps']        as Map? ?? {};
    final ais      = s.raw['ais']        as Map? ?? {};
    final nav      = s.raw['navigation'] as Map? ?? {};
    final sensors  = s.raw['sensors']    as Map? ?? {};
    final routing  = s.raw['routing']    as Map? ?? {};
    final currents = routing['currents'] as Map? ?? {};
    final curtypes = routing['currentTypes'] as Map? ?? {};

    _boatName.text          = '${boat['name']            ?? ''}';
    _boatLength.text        = '${boat['length']           ?? ''}';
    _boatBeam.text          = '${boat['beam']             ?? ''}';
    _boatDraft.text         = '${boat['draft']            ?? ''}';
    _boatHeight.text        = '${boat['height']           ?? ''}';
    _boatSpeed.text         = '${boat['cruiseSpeed']      ?? ''}';
    _boatFuel.text          = '${boat['fuelCapacity']     ?? ''}';
    _boatFuelConsumption.text = '${boat['fuelConsumption'] ?? ''}';
    _boatIcon               = (boat['icon'] as String?)   ?? 'yacht';

    _gpsPort.text          = s.gpsPort;
    _gpsBaud               = s.gpsBaud;
    _signalkUrl.text       = '${gps['signalkUrl']             ?? 'http://localhost:3000'}';
    _lowSatThreshold.text  = '${gps['lowSatelliteThreshold']  ?? '15'}';

    _aisKey.text   = '${ais['apiKey'] ?? ''}';
    _aisRange.text = '${ais['range']  ?? '20'}';
    _minCpa.text   = '${ais['minCpa'] ?? '0.5'}';

    _defaultSpeed.text = '${nav['defaultSpeed']    ?? '8'}';
    _dayStartTime.text = '${nav['dayStartTime']    ?? '10:00'}';
    _osrmUrl.text      = '${routing['osrmUrl']     ?? 'http://127.0.0.1:5000'}';

    _mqttUrl.text    = '${sensors['mqttUrl']    ?? ''}';
    _mqttUser.text   = '${sensors['mqttUser']   ?? ''}';
    _mqttPass.text   = '${sensors['mqttPass']   ?? ''}';
    _depthAlarm.text = '${sensors['depthAlarm'] ?? '2'}';

    for (final r in _rivers)      _riverCtrl[r]!.text     = '${currents[r.toLowerCase()] ?? ''}';
    for (final t in _riverTypes)  _riverTypeCtrl[t]!.text = '${curtypes[t] ?? ''}';
  }

  @override
  void dispose() {
    for (final c in [
      _boatName, _boatLength, _boatBeam, _boatDraft, _boatHeight,
      _boatSpeed, _boatFuel, _boatFuelConsumption,
      _gpsPort, _signalkUrl, _lowSatThreshold,
      _aisKey, _aisRange, _minCpa,
      _defaultSpeed, _dayStartTime, _osrmUrl,
      _mqttUrl, _mqttUser, _mqttPass, _depthAlarm,
    ]) c.dispose();
    for (final c in _riverCtrl.values)     c.dispose();
    for (final c in _riverTypeCtrl.values) c.dispose();
    _updatePollTimer?.cancel();
    _updateScrollCtrl.dispose();
    super.dispose();
  }

  void _applyText(SettingsService s) {
    s.set('boat', 'name',            _boatName.text);
    s.set('boat', 'icon',            _boatIcon);
    _setNum(s, 'boat', 'length',          _boatLength.text);
    _setNum(s, 'boat', 'beam',            _boatBeam.text);
    _setNum(s, 'boat', 'draft',           _boatDraft.text);
    _setNum(s, 'boat', 'height',          _boatHeight.text);
    _setNum(s, 'boat', 'cruiseSpeed',     _boatSpeed.text);
    _setNum(s, 'boat', 'fuelCapacity',    _boatFuel.text);
    _setNum(s, 'boat', 'fuelConsumption', _boatFuelConsumption.text);

    s.set('gps', 'signalkUrl',            _signalkUrl.text);
    _setInt(s, 'gps', 'lowSatelliteThreshold', _lowSatThreshold.text);

    s.set('ais', 'apiKey', _aisKey.text);
    _setInt(s,  'ais', 'range',  _aisRange.text);
    _setNum(s,  'ais', 'minCpa', _minCpa.text);

    _setNum(s, 'navigation', 'defaultSpeed', _defaultSpeed.text);
    s.set('navigation', 'dayStartTime', _dayStartTime.text);

    s.set('sensors', 'mqttUrl',  _mqttUrl.text);
    s.set('sensors', 'mqttUser', _mqttUser.text);
    s.set('sensors', 'mqttPass', _mqttPass.text);
    _setNum(s, 'sensors', 'depthAlarm', _depthAlarm.text);

    final routing  = Map<String, dynamic>.from(s.raw['routing']  as Map? ?? {});
    final currents = Map<String, dynamic>.from(routing['currents']     as Map? ?? {});
    final curtypes = Map<String, dynamic>.from(routing['currentTypes'] as Map? ?? {});
    for (final r in _rivers) {
      final v = double.tryParse(_riverCtrl[r]!.text);
      if (v != null) currents[r.toLowerCase()] = v;
    }
    for (final t in _riverTypes) {
      final v = double.tryParse(_riverTypeCtrl[t]!.text);
      if (v != null) curtypes[t] = v;
    }
    routing['currents']     = currents;
    routing['currentTypes'] = curtypes;
    routing['osrmUrl']      = _osrmUrl.text;
    s.raw['routing'] = routing;

    // waterCurrent sync (format expected by backend water_current_service)
    const nameMap = {
      'rhein': 'Rhein', 'mosel': 'Mosel', 'main': 'Main',
      'elbe': 'Elbe',   'saale': 'Saale', 'donau': 'Donau',
    };
    final wc = Map<String, dynamic>.from(s.raw['waterCurrent'] as Map? ?? {});
    wc['enabled'] = (s.raw['routing'] as Map?)?['waterCurrentEnabled'] ?? true;
    wc['byName']  = {};
    wc['byType']  = curtypes;
    for (final r in _rivers) {
      final key = r.toLowerCase();
      final v = double.tryParse(_riverCtrl[r]!.text);
      if (v != null && v > 0) {
        (wc['byName'] as Map)[nameMap[key]!] = {'current_kmh': v, 'type': 'river'};
      }
    }
    s.raw['waterCurrent'] = wc;
  }

  void _setNum(SettingsService s, String sec, String key, String text) {
    final v = double.tryParse(text);
    if (v != null) s.set(sec, key, v);
  }

  void _setInt(SettingsService s, String sec, String key, String text) {
    final v = int.tryParse(text);
    if (v != null) s.set(sec, key, v);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    final s = context.read<SettingsService>();
    _applyText(s);
    final ok = await s.save();
    if (mounted) {
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(ok ? 'Gespeichert' : 'Fehler beim Speichern'),
        duration: const Duration(seconds: 2),
        backgroundColor: ok ? const Color(0xFF1A472A) : const Color(0xFF7D1A1A),
      ));
    }
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0E1A),
      appBar: AppBar(
        backgroundColor: const Color(0xFF161B22),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Color(0xFF8B949E)),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Einstellungen',
            style: TextStyle(color: Color(0xFFE6EDF3), fontSize: 16, fontWeight: FontWeight.w600)),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(1),
          child: Divider(color: Color(0xFF30363D), height: 1),
        ),
        actions: [
          if (_saving)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF4FC3F7))),
            )
          else
            TextButton.icon(
              onPressed: _save,
              icon: const Icon(Icons.save_outlined, size: 16, color: Color(0xFF4FC3F7)),
              label: const Text('Speichern',
                  style: TextStyle(color: Color(0xFF4FC3F7), fontSize: 14)),
            ),
          const SizedBox(width: 8),
        ],
      ),
      body: !_initialized
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF4FC3F7)))
          : LayoutBuilder(builder: (_, constraints) {
              if (constraints.maxWidth >= 600) {
                return Row(children: [
                  SizedBox(width: 220, child: _sidebar()),
                  const VerticalDivider(color: Color(0xFF30363D), width: 1, thickness: 1),
                  Expanded(child: _content()),
                ]);
              }
              return Column(children: [
                SizedBox(height: 52, child: _tabBar()),
                Expanded(child: _content()),
              ]);
            }),
    );
  }

  Widget _sidebar() => Container(
        color: const Color(0xFF0D1117),
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 8),
          itemCount: _sections.length,
          itemBuilder: (_, i) {
            final (icon, label) = _sections[i];
            final sel = i == _sel;
            return InkWell(
              onTap: () { setState(() => _sel = i); if (i == 12) _checkVersion(); if (i == 6) _fetchPiIps(); },
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
                decoration: BoxDecoration(
                  color: sel ? const Color(0xFF1565C0).withValues(alpha: 0.2) : Colors.transparent,
                  border: Border(
                    left: BorderSide(
                      color: sel ? const Color(0xFF4FC3F7) : Colors.transparent,
                      width: 3,
                    ),
                  ),
                ),
                child: Row(children: [
                  Icon(icon, size: 18,
                      color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF8B949E)),
                  const SizedBox(width: 12),
                  Text(label,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: sel ? FontWeight.w600 : FontWeight.normal,
                        color: sel ? const Color(0xFFE6EDF3) : const Color(0xFF8B949E),
                      )),
                ]),
              ),
            );
          },
        ),
      );

  Widget _tabBar() => Container(
        color: const Color(0xFF0D1117),
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          itemCount: _sections.length,
          itemBuilder: (_, i) {
            final (icon, label) = _sections[i];
            final sel = i == _sel;
            return Padding(
              padding: const EdgeInsets.only(right: 4),
              child: GestureDetector(
                onTap: () { setState(() => _sel = i); if (i == 12) _checkVersion(); if (i == 6) _fetchPiIps(); },
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: sel ? const Color(0xFF1565C0) : const Color(0xFF161B22),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                        color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(icon, size: 14,
                        color: sel ? Colors.white : const Color(0xFF8B949E)),
                    const SizedBox(width: 6),
                    Text(label,
                        style: TextStyle(
                            fontSize: 12,
                            color: sel ? Colors.white : const Color(0xFF8B949E))),
                  ]),
                ),
              ),
            );
          },
        ),
      );

  Widget _content() => Consumer<SettingsService>(builder: (context, svc, _) {
        Widget inner;
        switch (_sel) {
          case 7:  inner = const _SchleusenSection();          break;
          case 8:  inner = const _ENCSection();                break;
          case 9:  inner = const _DashboardSection();          break;
          case 10: inner = _DatenSection(svc: svc);            break;
          default:
            final widgets = switch (_sel) {
              0  => _schiff(svc),
              1  => _karte(svc),
              2  => _navigation(svc),
              3  => _gps(svc),
              4  => _ais(svc),
              5  => _einheiten(svc),
              6  => _mqtt(svc),
              11 => _display(svc),
              12 => _system(),
              _  => <Widget>[],
            };
            inner = Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: widgets,
            );
        }
        return SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 660),
              child: inner,
            ),
          ),
        );
      });

  // ── Section: Schiff ─────────────────────────────────────────────────────────

  List<Widget> _schiff(SettingsService s) {
    final boat = s.raw['boat'] as Map? ?? {};
    return [
      _header('Schiff'),
      _textRow('Name', _boatName),
      _dropRow<String>(
        label: 'Typ',
        value: (boat['type'] as String?) ?? 'motorboat',
        items: const ['motorboat', 'sailboat', 'kayak'],
        labels: const ['Motorboot', 'Segelboot', 'Kajak'],
        onChanged: (v) { if (v != null) { s.set('boat', 'type', v); s.save(); } },
      ),
      _header('Boot-Icon'),
      Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: Wrap(
          spacing: 12,
          runSpacing: 12,
          children: _boatIcons.map(((String, IconData, String) opt) {
            final (key, icon, label) = opt;
            final sel = _boatIcon == key;
            return GestureDetector(
              onTap: () => setState(() => _boatIcon = key),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                width: 110,
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 8),
                decoration: BoxDecoration(
                  color: sel
                      ? const Color(0xFF1565C0).withValues(alpha: 0.2)
                      : const Color(0xFF161B22),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(
                    color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
                    width: sel ? 2 : 1,
                  ),
                ),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  Icon(icon, size: 36,
                      color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF8B949E)),
                  const SizedBox(height: 8),
                  Text(label,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 12,
                        color: sel ? const Color(0xFFE6EDF3) : const Color(0xFF8B949E),
                        fontWeight: sel ? FontWeight.w600 : FontWeight.normal,
                      )),
                ]),
              ),
            );
          }).toList(),
        ),
      ),
      _header('Abmessungen'),
      _textRow('Länge (m)',    _boatLength, numeric: true),
      _textRow('Breite (m)',   _boatBeam,   numeric: true),
      _textRow('Tiefgang (m)', _boatDraft,  numeric: true),
      _textRow('Höhe (m)',     _boatHeight, numeric: true),
      _header('Antrieb'),
      _textRow('Reisegeschw. (km/h)',  _boatSpeed,          numeric: true),
      _textRow('Kraftstoff (L)',       _boatFuel,           numeric: true),
      _textRow('Verbrauch (L/h)',      _boatFuelConsumption, numeric: true),
    ];
  }

  // ── Section: Karte ──────────────────────────────────────────────────────────

  List<Widget> _karte(SettingsService s) {
    final m = s.raw['map'] as Map? ?? {};
    bool b(String k, bool def) => (m[k] as bool?) ?? def;
    return [
      _header('Karte'),
      _switchRow('OpenSeaMap',             b('openSeaMap', true),  (v) { s.set('map', 'openSeaMap', v);  s.save(); }),
      _switchRow('Schleusen anzeigen',     b('showLocks',  true),  (v) { s.set('map', 'showLocks',  v);  s.save(); }),
      _switchRow('Pegelstände anzeigen',   b('showPegel',  false), (v) { s.set('map', 'showPegel',  v);  s.save(); }),
      _switchRow('Track anzeigen',         b('showTrack',  true),  (v) { s.set('map', 'showTrack',  v);  s.save(); }),
      _switchRow('Auto-Zentrieren',        b('autoCenter', true),  (v) { s.set('map', 'autoCenter', v);  s.save(); }),
      _switchRow('Kurs-Oben (Heading-Up)', b('headingUp',  true),  (v) { s.set('map', 'headingUp',  v);  s.save(); }),
      _header('Anzeige'),
      _sliderRow(
        'UI-Skalierung',
        s.uiScale,
        min: 0.7, max: 1.3,
        divisions: 6,
        displayLabel: (v) => '${(v * 100).round()}%',
        onChanged: (v) { s.setUiScale(v); s.save(); },
      ),
    ];
  }

  // ── Section: Navigation ─────────────────────────────────────────────────────

  List<Widget> _navigation(SettingsService s) {
    final nav     = s.raw['navigation'] as Map? ?? {};
    final routing = s.raw['routing']    as Map? ?? {};
    bool   b(String k, bool   def) => (nav[k] as bool?)   ?? def;
    int    i(String k, int    def) => (nav[k] as int?)    ?? def;
    double d(String k, double def) => ((nav[k] as num?)?.toDouble()) ?? def;
    return [
      _header('Track'),
      _switchRow('Auto-Track', b('autoTrack', false),
          (v) { s.set('navigation', 'autoTrack', v); s.save(); }),
      _dropRow<int>(
        label: 'Track-Intervall',
        value: i('trackInterval', 10),
        items: const [5, 10, 30, 60],
        labels: const ['5 s', '10 s', '30 s', '60 s'],
        onChanged: (v) { if (v != null) { s.set('navigation', 'trackInterval', v); s.save(); } },
      ),
      _header('Ankunft'),
      _switchRow('Ankunftsalarm', b('arrivalAlarm', true),
          (v) { s.set('navigation', 'arrivalAlarm', v); s.save(); }),
      _dropRow<double>(
        label: 'Alarm-Radius',
        value: d('alarmDistance', 0.1),
        items: const [0.05, 0.1, 0.2, 0.5],
        labels: const ['50 m', '100 m', '200 m', '500 m'],
        onChanged: (v) { if (v != null) { s.set('navigation', 'alarmDistance', v); s.save(); } },
      ),
      _header('Tagesplanung'),
      _textRow('Standardgeschw. (km/h)', _defaultSpeed, numeric: true),
      _dropRow<int>(
        label: 'Tagesreise max.',
        value: i('dailyTravelHours', 8),
        items: const [4, 6, 8, 10, 12],
        labels: const ['4 h', '6 h', '8 h', '10 h', '12 h'],
        onChanged: (v) { if (v != null) { s.set('navigation', 'dailyTravelHours', v); s.save(); } },
      ),
      _textRow('Tagesstart (HH:MM)', _dayStartTime),
      _header('Routing'),
      _switchRow('Wasserstraßen bevorzugen', b('preferWaterways', true),
          (v) { s.set('navigation', 'preferWaterways', v); s.save(); }),
      _switchRow('Strömung berücksichtigen',
          (routing['waterCurrentEnabled'] as bool?) ?? true,
          (v) { s.set('routing', 'waterCurrentEnabled', v); s.save(); }),
      _textRow('OSRM URL', _osrmUrl),
      _header('Strömungen nach Gewässer (km/h)'),
      ..._rivers.map((r) => _textRow(r, _riverCtrl[r]!, numeric: true)),
      _header('Strömungen nach Typ (km/h)'),
      ...List.generate(_riverTypes.length, (i) =>
          _textRow(_riverTypeLabels[i], _riverTypeCtrl[_riverTypes[i]]!, numeric: true)),
      const SizedBox(height: 8),
      const _TrackSensorsSection(),
    ];
  }

  // ── Section: GPS ────────────────────────────────────────────────────────────

  List<Widget> _gps(SettingsService s) {
    final gps = s.raw['gps'] as Map? ?? {};
    return [
      _header('GPS-Gerät (SignalK)'),
      _textRow('Port (device)', _gpsPort),
      Padding(
        padding: const EdgeInsets.only(left: 180, bottom: 8),
        child: Wrap(
          spacing: 8,
          children: ['/dev/ttyUSB0', '/dev/ttyACM0', '/dev/ttyAMA0']
              .map((p) => ActionChip(
                    label: Text(p,
                        style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                    backgroundColor: const Color(0xFF161B22),
                    side: const BorderSide(color: Color(0xFF30363D)),
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    onPressed: () => setState(() => _gpsPort.text = p),
                  ))
              .toList(),
        ),
      ),
      _dropRow<int>(
        label: 'Baudrate',
        value: _gpsBaud,
        items: const [4800, 9600, 38400, 115200],
        labels: const ['4800', '9600', '38400', '115200'],
        onChanged: (v) { if (v != null) setState(() => _gpsBaud = v); },
      ),
      const SizedBox(height: 16),
      SizedBox(
        width: double.infinity,
        child: ElevatedButton.icon(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1565C0),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: const Icon(Icons.refresh, size: 18),
          label: const Text('Übernehmen & SignalK neu starten'),
          onPressed: () async {
            final ok = await s.saveGpsConfig(_gpsPort.text, _gpsBaud);
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                content: Text(ok ? 'GPS-Konfiguration gespeichert' : 'Fehler beim Speichern'),
                duration: const Duration(seconds: 2),
                backgroundColor: ok ? const Color(0xFF1A472A) : const Color(0xFF7D1A1A),
              ));
            }
          },
        ),
      ),
      _header('SignalK'),
      _textRow('SignalK URL', _signalkUrl),
      _dropRow<String>(
        label: 'GPS-Quelle',
        value: (gps['source'] as String?) ?? 'signalk',
        items: const ['signalk', 'gpsd', 'manual'],
        labels: const ['SignalK', 'GPSD', 'Manuell'],
        onChanged: (v) { if (v != null) { s.set('gps', 'source', v); s.save(); } },
      ),
      _textRow('Mindest-Satelliten (Alarm)', _lowSatThreshold, numeric: true),
    ];
  }

  // ── Section: AIS ────────────────────────────────────────────────────────────

  List<Widget> _ais(SettingsService s) {
    final ais = s.raw['ais'] as Map? ?? {};
    bool b(String k, bool def) => (ais[k] as bool?) ?? def;
    return [
      _header('AIS'),
      _switchRow('AIS aktiviert', b('enabled', true),
          (v) { s.set('ais', 'enabled', v); s.save(); }),
      _dropRow<String>(
        label: 'Anbieter',
        value: (ais['provider'] as String?) ?? 'aisstream',
        items: const ['aisstream'],
        labels: const ['AISStream'],
        onChanged: (v) { if (v != null) { s.set('ais', 'provider', v); s.save(); } },
      ),
      _textRow('API-Key', _aisKey),
      _textRow('Reichweite (NM)', _aisRange, numeric: true),
      _dropRow<int>(
        label: 'Update-Intervall',
        value: (ais['updateInterval'] as int?) ?? 60,
        items: const [30, 60, 120, 300],
        labels: const ['30 s', '60 s', '2 min', '5 min'],
        onChanged: (v) { if (v != null) { s.set('ais', 'updateInterval', v); s.save(); } },
      ),
      _switchRow('Schiff-Beschriftungen', b('showLabels', true),
          (v) { s.set('ais', 'showLabels', v); s.save(); }),
      _header('Kollisionsalarm (CPA)'),
      _switchRow('CPA-Alarm aktiviert', b('cpaAlarm', true),
          (v) { s.set('ais', 'cpaAlarm', v); s.save(); }),
      _textRow('Min. CPA-Distanz (NM)', _minCpa, numeric: true),
    ];
  }

  // ── Section: Einheiten ──────────────────────────────────────────────────────

  List<Widget> _einheiten(SettingsService s) {
    final u = s.raw['units'] as Map? ?? {};
    String v(String k, String def) => (u[k] as String?) ?? def;
    return [
      _header('Einheiten'),
      _segRow('Geschwindigkeit', v('speed', 'kmh'),
          const [('kmh', 'km/h'), ('kn', 'Knoten')],
          (x) { s.set('units', 'speed', x); s.save(); }),
      _segRow('Distanz', v('distance', 'km'),
          const [('km', 'km'), ('nm', 'NM')],
          (x) { s.set('units', 'distance', x); s.save(); }),
      _segRow('Tiefe', v('depth', 'm'),
          const [('m', 'm'), ('ft', 'ft')],
          (x) { s.set('units', 'depth', x); s.save(); }),
      _segRow('Temperatur', v('temperature', 'c'),
          const [('c', '°C'), ('f', '°F')],
          (x) { s.set('units', 'temperature', x); s.save(); }),
      _segRow('Druck', v('pressure', 'hpa'),
          const [('hpa', 'hPa'), ('bar', 'bar')],
          (x) { s.set('units', 'pressure', x); s.save(); }),
      _segRow('Volumen', v('volume', 'l'),
          const [('l', 'L'), ('gal', 'gal')],
          (x) { s.set('units', 'volume', x); s.save(); }),
      _header('Anzeige'),
      _dropRow<String>(
        label: 'Koordinatenformat',
        value: (s.raw['coordFormat'] as String?) ?? 'decimal',
        items: const ['decimal', 'dm', 'dms'],
        labels: const ['Dezimal (51.856°)', 'Grad/Min (51° 51.3\')', 'Grad/Min/Sek'],
        onChanged: (v) { if (v != null) { s.raw['coordFormat'] = v; s.save(); } },
      ),
      _dropRow<String>(
        label: 'Sprache',
        value: (s.raw['language'] as String?) ?? 'de',
        items: const ['de', 'en'],
        labels: const ['Deutsch', 'English'],
        onChanged: (v) { if (v != null) { s.raw['language'] = v; s.save(); } },
      ),
    ];
  }

  // ── Section: MQTT ───────────────────────────────────────────────────────────

  Future<void> _fetchPiIps() async {
    try {
      final res = await http
          .get(Uri.parse('http://localhost:8000/api/system/info'))
          .timeout(const Duration(seconds: 5));
      final d = json.decode(res.body) as Map<String, dynamic>;
      setState(() => _piIps = (d['ips'] as List? ?? []).cast<String>());
    } catch (_) {}
  }

  List<Widget> _mqtt(SettingsService s) {
    final sensors = s.raw['sensors'] as Map? ?? {};
    return [
      _header('Externer Zugriff (Sensor-Board)'),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Row(children: [
            Icon(Icons.sensors, size: 14, color: Color(0xFF4FC3F7)),
            SizedBox(width: 8),
            Text('Sensor-Board Verbindung',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                    color: Color(0xFFE6EDF3))),
          ]),
          const SizedBox(height: 10),
          const Text('Broker-Adresse im Sensor eintragen:',
              style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
          const SizedBox(height: 6),
          if (_piIps.isEmpty)
            const Text('— (MQTT-Tab antippen zum Laden)',
                style: TextStyle(fontSize: 13, color: Color(0xFF6A737D)))
          else
            ...(_piIps.map((ip) => Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Row(children: [
                const Icon(Icons.wifi, size: 12, color: Color(0xFF4CAF50)),
                const SizedBox(width: 6),
                Text('$ip  :  1883',
                    style: const TextStyle(fontSize: 14,
                        fontWeight: FontWeight.w700, color: Color(0xFFE6EDF3),
                        fontFamily: 'monospace')),
              ]),
            ))),
        ]),
      ),
      _header('MQTT-Broker'),
      _textRow('Broker URL',   _mqttUrl),
      _textRow('Benutzername', _mqttUser),
      _textRow('Passwort',     _mqttPass, obscure: true),
      const SizedBox(height: 12),
      Row(children: [
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF4FC3F7),
              side: const BorderSide(color: Color(0xFF30363D)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.wifi_tethering, size: 16),
            label: const Text('Verbindung testen'),
            onPressed: () {
              var urlText = _mqttUrl.text.trim();
              if (urlText.startsWith('mqtt://'))  urlText = urlText.substring(7);
              else if (urlText.startsWith('http://')) urlText = urlText.substring(7);
              String host = urlText;
              int port = 1883;
              if (urlText.contains(':')) {
                final parts = urlText.split(':');
                host = parts[0];
                port = int.tryParse(parts[1]) ?? 1883;
              }
              _mqttAction('/api/mqtt/test', {
                'host': host,
                'port': port,
                'username': _mqttUser.text,
                'password': _mqttPass.text,
              }, 'MQTT-Test');
            },
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF8B949E),
              side: const BorderSide(color: Color(0xFF30363D)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.cleaning_services, size: 16),
            label: const Text('Bereinigen'),
            onPressed: () => _mqttAction('/api/mqtt/cleanup', null, 'MQTT-Bereinigung'),
          ),
        ),
      ]),
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF4CAF50),
            side: const BorderSide(color: Color(0xFF30363D)),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: const Icon(Icons.settings_ethernet, size: 16),
          label: const Text('Externen Zugriff aktivieren'),
          onPressed: _fixMqttExternal,
        ),
      ),
      _header('Tiefen-Alarm'),
      _textRow('Alarm bei < (m)', _depthAlarm, numeric: true),
      _switchRow('Tiefenalarm aktiv',
          (sensors['depthAlarmEnable'] as bool?) ?? false,
          (v) { s.set('sensors', 'depthAlarmEnable', v); s.save(); }),
    ];
  }

  Future<void> _mqttAction(String path, Map<String, dynamic>? body, String label) async {
    try {
      final response = body != null
          ? await http.post(Uri.parse('http://localhost:8000$path'),
              headers: {'Content-Type': 'application/json'},
              body: json.encode(body))
          : await http.post(Uri.parse('http://localhost:8000$path'));
      if (mounted) {
        final msg = response.statusCode == 200 ? '$label erfolgreich' : '$label fehlgeschlagen (${response.statusCode})';
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(msg),
          duration: const Duration(seconds: 3),
          backgroundColor: response.statusCode == 200 ? const Color(0xFF1A472A) : const Color(0xFF7D1A1A),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('$label: Verbindungsfehler'),
          backgroundColor: const Color(0xFF7D1A1A),
        ));
      }
    }
  }

  Future<void> _fixMqttExternal() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Externen MQTT-Zugriff aktivieren?',
            style: TextStyle(color: Color(0xFFE6EDF3))),
        content: const Text(
          'Mosquitto wird so konfiguriert, dass externe Geräte (z.B. Sensorboard) '
          'sich auf Port 1883 verbinden können.\n\n'
          'Sudo-Berechtigung muss einmalig per SSH eingerichtet sein.',
          style: TextStyle(color: Color(0xFF8B949E))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Abbrechen')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF4CAF50)),
              child: const Text('Aktivieren')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final res = await http.post(Uri.parse('http://localhost:8000/api/mqtt/fix-external'));
      final data = json.decode(res.body);
      final ok = data['status'] == 'success';
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(data['message'] ?? (ok ? 'Erfolg' : 'Fehlgeschlagen')),
          duration: const Duration(seconds: 5),
          backgroundColor: ok ? const Color(0xFF1A472A) : const Color(0xFF7D1A1A),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Verbindungsfehler'),
          backgroundColor: Color(0xFF7D1A1A),
        ));
      }
    }
  }

  // ── Primitive row widgets ────────────────────────────────────────────────────

  // ── Section: Display / Screensaver ──────────────────────────────────────────

  List<Widget> _display(SettingsService s) {
    return [
      _header('Bildschirmschoner'),
      _dropRow<int>(
        label: 'Timeout',
        value: s.screensaverTimeout,
        items: const [0, 5, 10, 15, 30],
        labels: const ['Aus', '5 Min', '10 Min', '15 Min', '30 Min'],
        onChanged: (v) {
          if (v != null) {
            s.set('ui', 'screensaverTimeout', v);
            s.save();
          }
        },
      ),
      const SizedBox(height: 20),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: const Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(Icons.info_outline, size: 14, color: Color(0xFF4FC3F7)),
            SizedBox(width: 8),
            Text('Zweistufiger Bildschirmschoner',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFE6EDF3))),
          ]),
          SizedBox(height: 8),
          Text(
            'Stufe 1: App-Overlay (schwarz) nach dem Timeout.\n'
            'Stufe 2: Display aus (Hardware) 60 Sekunden später.\n'
            'Jede Berührung weckt beides wieder auf.',
            style: TextStyle(fontSize: 12, color: Color(0xFF8B949E), height: 1.6),
          ),
        ]),
      ),
    ];
  }

  // ── Section: System / Update ────────────────────────────────────────────────

  List<Widget> _system() {
    return [
      _header('Software-Version'),
      Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          _verRow('Installiert', _verCurrent),
          const SizedBox(height: 8),
          _verRow('Verfügbar',   _verLatest),
          if (!_verLoading) ...[
            const SizedBox(height: 10),
            Text(
              _verUpToDate
                  ? '✅ System ist aktuell'
                  : (_verLatest == '…' ? '' : '🆕 Update verfügbar'),
              style: TextStyle(
                fontSize: 12,
                color: _verUpToDate
                    ? const Color(0xFF4CAF50)
                    : const Color(0xFF4FC3F7),
              ),
            ),
          ],
        ]),
      ),
      const SizedBox(height: 12),
      _sysBtn(
        icon: Icons.refresh,
        label: _verLoading ? 'Prüfe…' : 'Auf Updates prüfen',
        color: const Color(0xFF21262D),
        textColor: const Color(0xFFE6EDF3),
        onTap: _verLoading ? null : _checkVersion,
      ),
      if (!_verUpToDate && _verLatest != '…' && !_updateRunning) ...[
        const SizedBox(height: 10),
        _sysBtn(
          icon: Icons.system_update_alt,
          label: 'Jetzt aktualisieren',
          color: const Color(0xFF1565C0),
          textColor: Colors.white,
          onTap: _startUpdate,
        ),
      ],

      if (_updateRunning || _updateLog.isNotEmpty) ...[
        _header('Update-Fortschritt'),
        Container(
          height: 220,
          decoration: BoxDecoration(
            color: const Color(0xFF0D1117),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: ListView.builder(
            controller: _updateScrollCtrl,
            padding: const EdgeInsets.all(10),
            itemCount: _updateLog.length,
            itemBuilder: (_, i) => Text(
              _updateLog[i],
              style: const TextStyle(
                  fontSize: 11, color: Color(0xFF4FC3F7),
                  fontFamily: 'monospace', height: 1.5),
            ),
          ),
        ),
        if (_updateRunning)
          const Padding(
            padding: EdgeInsets.only(top: 10),
            child: Row(children: [
              SizedBox(width: 14, height: 14,
                  child: CircularProgressIndicator(strokeWidth: 2)),
              SizedBox(width: 10),
              Text('Update läuft…',
                  style: TextStyle(fontSize: 12, color: Color(0xFF8B949E))),
            ]),
          ),
      ],

      _header('System'),
      _sysBtn(
        icon: Icons.power_settings_new,
        label: 'Pi herunterfahren',
        color: const Color(0xFF6B1A1A),
        textColor: Colors.white,
        onTap: _shutdown,
      ),
    ];
  }

  Widget _verRow(String label, String value) => Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
          Text(value,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.w600,
                  color: Color(0xFFE6EDF3))),
        ],
      );

  Widget _sysBtn({
    required IconData icon,
    required String label,
    required Color color,
    required Color textColor,
    required VoidCallback? onTap,
  }) =>
      GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(children: [
            Icon(icon, color: textColor, size: 18),
            const SizedBox(width: 12),
            Text(label,
                style: TextStyle(
                    fontSize: 14, fontWeight: FontWeight.w600,
                    color: textColor)),
          ]),
        ),
      );

  Future<void> _checkVersion() async {
    setState(() { _verLoading = true; _verCurrent = '…'; _verLatest = '…'; });
    try {
      final res = await http
          .get(Uri.parse('http://localhost:8000/api/system/version'))
          .timeout(const Duration(seconds: 8));
      final d = json.decode(res.body) as Map<String, dynamic>;
      setState(() {
        _verCurrent  = d['current'] as String? ?? '—';
        _verLatest   = d['latest']  as String? ?? '—';
        _verUpToDate = d['up_to_date'] as bool? ?? false;
      });
    } catch (_) {
      setState(() { _verCurrent = '—'; _verLatest = '—'; });
    } finally {
      setState(() => _verLoading = false);
    }
  }

  Future<void> _startUpdate() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('System aktualisieren',
            style: TextStyle(color: Color(0xFFE6EDF3))),
        content: const Text(
            'Der Pi lädt alle Änderungen und startet danach automatisch neu.',
            style: TextStyle(color: Color(0xFF8B949E))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen')),
          TextButton(onPressed: () => Navigator.pop(context, true),
              child: const Text('Aktualisieren',
                  style: TextStyle(color: Color(0xFF4FC3F7)))),
        ],
      ),
    );
    if (ok != true || !mounted) return;

    // Badge sofort ausblenden — wird nach Reboot ohnehin neu geprüft
    context.findAncestorStateOfType<MainShellState>()?.dismissUpdateBadge();

    setState(() { _updateRunning = true; _updateLog = ['[System] Update wird gestartet…']; });
    try {
      await http.post(Uri.parse('http://localhost:8000/api/system/update'));
    } catch (_) {}
    _updatePollTimer = Timer.periodic(const Duration(seconds: 2), (_) => _pollUpdate());
  }

  Future<void> _pollUpdate() async {
    try {
      final res = await http
          .get(Uri.parse('http://localhost:8000/api/system/update/status'))
          .timeout(const Duration(seconds: 5));
      final d = json.decode(res.body) as Map<String, dynamic>;
      final log = (d['log'] as List).cast<String>();
      setState(() {
        _updateLog    = log;
        _updateRunning = d['running'] as bool? ?? false;
      });
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_updateScrollCtrl.hasClients) {
          _updateScrollCtrl.jumpTo(_updateScrollCtrl.position.maxScrollExtent);
        }
      });
      if (!_updateRunning) _updatePollTimer?.cancel();
    } catch (_) {
      // Pi neugestartet
      if (mounted) {
        setState(() {
          _updateLog.add('[System] Verbindung getrennt — Pi startet neu…');
          _updateRunning = false;
        });
      }
      _updatePollTimer?.cancel();
    }
  }

  Future<void> _shutdown() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Pi herunterfahren',
            style: TextStyle(color: Color(0xFFE6EDF3))),
        content: const Text('Jetzt herunterfahren?',
            style: TextStyle(color: Color(0xFF8B949E))),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen')),
          TextButton(onPressed: () => Navigator.pop(context, true),
              child: const Text('Herunterfahren',
                  style: TextStyle(color: Color(0xFFEF5350)))),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await http.post(Uri.parse('http://localhost:8000/api/system/shutdown'));
    } catch (_) {}
  }

  Widget _header(String title) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title,
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w700,
                  color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Divider(color: Color(0xFF30363D), height: 1, thickness: 1),
        ]),
      );

  Widget _sliderRow(
    String label,
    double value, {
    required double min,
    required double max,
    required int divisions,
    required String Function(double) displayLabel,
    required ValueChanged<double> onChanged,
  }) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          SizedBox(
              width: 180,
              child: Text(label,
                  style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3)))),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Slider(
                value: value,
                min: min,
                max: max,
                divisions: divisions,
                activeColor: const Color(0xFF4FC3F7),
                inactiveColor: const Color(0xFF30363D),
                onChanged: onChanged,
              ),
              Text(displayLabel(value),
                  style: const TextStyle(fontSize: 12, color: Color(0xFF8B949E))),
            ]),
          ),
        ]),
      );

  Widget _switchRow(String label, bool value, ValueChanged<bool> onChanged) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(children: [
          Expanded(child: Text(label,
              style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3)))),
          Switch(value: value, onChanged: onChanged,
              activeColor: const Color(0xFF4FC3F7),
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap),
        ]),
      );

  Widget _textRow(String label, TextEditingController ctrl,
          {bool numeric = false, bool obscure = false}) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          SizedBox(
              width: 180,
              child: Text(label,
                  style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3)))),
          Expanded(
            child: GestureDetector(
              onTap: () => showKeyboard(context, ctrl,
                  numeric: numeric, obscure: obscure, label: label),
              child: AbsorbPointer(
                child: SizedBox(
                  height: 40,
                  child: TextField(
                    controller: ctrl,
                    readOnly: true,
                    obscureText: obscure,
                    style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding:
                          const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                      filled: true,
                      fillColor: const Color(0xFF161B22),
                      border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(6),
                          borderSide: const BorderSide(color: Color(0xFF30363D))),
                      enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(6),
                          borderSide: const BorderSide(color: Color(0xFF30363D))),
                      focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(6),
                          borderSide: const BorderSide(color: Color(0xFF4FC3F7))),
                      suffixIcon: const Icon(Icons.edit_outlined,
                          size: 14, color: Color(0xFF8B949E)),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ]),
      );

  Widget _dropRow<T>({
    required String label,
    required T value,
    required List<T> items,
    required List<String> labels,
    required ValueChanged<T?> onChanged,
  }) {
    final safeValue = items.contains(value) ? value : items.first;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(children: [
        SizedBox(width: 180,
            child: Text(label,
                style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3)))),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(6),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<T>(
              value: safeValue,
              dropdownColor: const Color(0xFF1C2128),
              style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
              items: List.generate(items.length, (i) =>
                  DropdownMenuItem(value: items[i], child: Text(labels[i]))),
              onChanged: onChanged,
            ),
          ),
        ),
      ]),
    );
  }

  Widget _segRow(String label, String value, List<(String, String)> options,
      ValueChanged<String> onChanged) =>
      Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(children: [
          SizedBox(width: 180,
              child: Text(label,
                  style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3)))),
          Container(
            decoration: BoxDecoration(
              color: const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: options.map(((String, String) opt) {
                final (key, lbl) = opt;
                final sel = value == key;
                return GestureDetector(
                  onTap: () => onChanged(key),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 150),
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 9),
                    decoration: BoxDecoration(
                      color: sel ? const Color(0xFF1565C0) : Colors.transparent,
                      borderRadius: BorderRadius.circular(5),
                    ),
                    child: Text(lbl,
                        style: TextStyle(
                          fontSize: 13,
                          color: sel ? Colors.white : const Color(0xFF8B949E),
                          fontWeight: sel ? FontWeight.w600 : FontWeight.normal,
                        )),
                  ),
                );
              }).toList(),
            ),
          ),
        ]),
      );
}

// ── Track Sensors Section ────────────────────────────────────────────────────

class _TrackSensorsSection extends StatefulWidget {
  const _TrackSensorsSection();
  @override
  State<_TrackSensorsSection> createState() => _TrackSensorsSectionState();
}

class _TrackSensorsSectionState extends State<_TrackSensorsSection> {
  static const _base = 'http://localhost:8000';
  static const _skipPaths = {
    'navigation/position',
    'navigation/speed',
    'navigation/heading',
  };

  // path → display name (from /api/sensors/list)
  Map<String, String> _sensorNames = {};
  // path → unit
  Map<String, String> _sensorUnits = {};
  // paths found in dashboard layout (in order)
  List<String> _dashPaths = [];
  Set<String> _selected = {};
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        http.get(Uri.parse('$_base/api/dashboard/layout')),
        http.get(Uri.parse('$_base/api/sensors/list')),
        http.get(Uri.parse('$_base/api/settings')),
      ]);

      // Parse layout DSL to extract sensor paths
      if (results[0].statusCode == 200) {
        final body = json.decode(results[0].body) as Map<String, dynamic>;
        final dsl = (body['layout'] as String?) ?? '';
        _dashPaths = _extractPathsFromDsl(dsl);
      }

      // Build name/unit lookup from sensor list
      if (results[1].statusCode == 200) {
        final body = json.decode(results[1].body) as Map<String, dynamic>;
        final list = (body['sensors'] as List? ?? []).cast<Map<String, dynamic>>();
        for (final e in list) {
          final base = e['base_name'] as String?;
          if (base != null) {
            _sensorNames[base] = (e['name'] as String?) ?? base;
            _sensorUnits[base] = (e['unit'] as String?) ?? '';
          }
        }
      }

      // Load currently saved track sensor selection
      if (results[2].statusCode == 200) {
        final settings = json.decode(results[2].body) as Map<String, dynamic>;
        final track = settings['trackSensors'];
        if (track is List) {
          _selected = track.map((e) => e.toString()).toSet();
        }
      }
    } catch (_) {}
    if (mounted) setState(() => _loading = false);
  }

  List<String> _extractPathsFromDsl(String dsl) {
    final paths = <String>[];
    final seen = <String>{};
    // Match SENSOR <path> or GAUGE <path> at start of trimmed line
    final re = RegExp(r'^\s*(?:SENSOR|GAUGE)\s+(\S+)', multiLine: true);
    for (final m in re.allMatches(dsl)) {
      final path = m.group(1)!;
      if (!_skipPaths.contains(path) && !seen.contains(path)) {
        seen.add(path);
        paths.add(path);
      }
    }
    return paths;
  }

  Future<void> _save() async {
    try {
      final r = await http.get(Uri.parse('$_base/api/settings'));
      if (r.statusCode != 200) return;
      final settings = json.decode(r.body) as Map<String, dynamic>;
      settings['trackSensors'] = _selected.toList();
      await http.post(
        Uri.parse('$_base/api/settings'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(settings),
      );
      // Keep SettingsService cache in sync so other saves don't overwrite
      if (mounted) {
        context.read<SettingsService>().setRaw('trackSensors', _selected.toList());
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Track-Sensoren aufzeichnen',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
                  color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
          const SizedBox(height: 4),
          const Text('Welche Dashboard-Sensoren sollen pro Track-Punkt gespeichert werden?',
              style: TextStyle(fontSize: 12, color: Color(0xFF8B949E))),
          const SizedBox(height: 6),
          const Divider(color: Color(0xFF30363D), height: 1, thickness: 1),
        ]),
      ),
      if (_loading)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Center(child: CircularProgressIndicator(color: Color(0xFF4FC3F7), strokeWidth: 2)),
        )
      else if (_dashPaths.isEmpty)
        const Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: Text('Keine Sensoren im Dashboard konfiguriert.',
              style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
        )
      else
        ..._dashPaths.map((path) {
          final name    = _sensorNames[path] ?? path;
          final unit    = _sensorUnits[path] ?? '';
          final enabled = _selected.contains(path);
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(name, style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3))),
                  Text(unit.isNotEmpty ? '$path · $unit' : path,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                ]),
              ),
              Switch(
                value: enabled,
                onChanged: (v) {
                  setState(() {
                    if (v) _selected.add(path); else _selected.remove(path);
                  });
                  _save();
                },
                activeColor: const Color(0xFF4FC3F7),
                materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
            ]),
          );
        }),
    ]);
  }
}

// ── Schleusen Section ────────────────────────────────────────────────────────

class _SchleusenSection extends StatefulWidget {
  const _SchleusenSection();
  @override
  State<_SchleusenSection> createState() => _SchleusenSectionState();
}

class _SchleusenSectionState extends State<_SchleusenSection> {
  static const _base = 'http://localhost:8000';
  bool _busy = false;
  String _status = '';
  bool _statusOk = true;

  Future<void> _run(String path, String label, {bool confirm = true}) async {
    if (confirm) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: const Color(0xFF161B22),
          title: Text(label, style: const TextStyle(color: Color(0xFFE6EDF3))),
          content: Text('Vorgang starten?',
              style: const TextStyle(color: Color(0xFF8B949E))),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Abbrechen', style: TextStyle(color: Color(0xFF8B949E)))),
            ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1565C0)),
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Starten')),
          ],
        ),
      );
      if (ok != true) return;
    }

    setState(() { _busy = true; _status = '$label läuft…'; _statusOk = true; });
    try {
      final r = await http.post(Uri.parse('$_base$path'))
          .timeout(const Duration(minutes: 5));
      final body = json.decode(r.body) as Map<String, dynamic>? ?? {};
      final ok = body['success'] == true || r.statusCode == 200;
      String msg = '';
      if (body['imported'] != null) msg = '${body['imported']} importiert, ${body['updated'] ?? 0} aktualisiert';
      else if (body['enriched'] != null) msg = '${body['enriched']} angereichert — VHF: ${body['vhf_coverage'] ?? '?'}';
      else if (body['checked'] != null) msg = '${body['checked']} geprüft, ${body['fixed'] ?? 0} korrigiert';
      else if (body['total'] != null) {
        msg = 'Gesamt: ${body['total']} Schleusen\n'
            'VHF: ${body['vhf_count']}/${body['total']} (${body['vhf_percentage']})\n'
            'Telefon: ${body['phone_count']}/${body['total']}\n'
            'Abmessungen: ${body['dimensions_count']}/${body['total']}';
      }
      else msg = ok ? 'Erfolgreich' : (body['error']?.toString() ?? 'Fehler');
      setState(() { _status = '$label: $msg'; _statusOk = ok; });
    } catch (e) {
      setState(() { _status = '$label: Fehler — $e'; _statusOk = false; });
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _h('Schleusen-Datenbank'),
      const SizedBox(height: 8),
      _btn('Aus OpenStreetMap importieren', Icons.download,
          () => _run('/api/locks/import-osm', 'OSM-Import')),
      const SizedBox(height: 10),
      _btn('VHF & Kontaktdaten anreichern', Icons.auto_fix_high,
          () => _run('/api/locks/enrich', 'Datenanreicherung')),
      const SizedBox(height: 10),
      _btn('Qualitätsbericht anzeigen', Icons.bar_chart,
          () => _run('/api/locks/quality', 'Qualitätsbericht', confirm: false)),
      const SizedBox(height: 10),
      _btn('Positionen überprüfen & korrigieren', Icons.my_location,
          () => _run('/api/locks/verify-positions', 'Positions-Check')),
      if (_busy) ...[
        const SizedBox(height: 20),
        const Row(children: [
          SizedBox(width: 20, height: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF4FC3F7))),
          SizedBox(width: 12),
          Text('Bitte warten…',
              style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
        ]),
      ],
      if (_status.isNotEmpty) ...[
        const SizedBox(height: 16),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: _statusOk
                ? const Color(0xFF0F2D1A)
                : const Color(0xFF2D0F0F),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: _statusOk ? const Color(0xFF1A5C2E) : const Color(0xFF5C1A1A),
            ),
          ),
          child: Text(_status,
              style: TextStyle(
                fontSize: 13,
                color: _statusOk ? const Color(0xFF4CAF50) : const Color(0xFFEF5350),
                height: 1.5,
              )),
        ),
      ],
    ]);
  }

  Widget _h(String t) => Padding(
        padding: const EdgeInsets.only(top: 4, bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t, style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Divider(color: Color(0xFF30363D), height: 1, thickness: 1),
        ]),
      );

  Widget _btn(String label, IconData icon, VoidCallback onTap) =>
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFFE6EDF3),
            side: const BorderSide(color: Color(0xFF30363D)),
            padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
            alignment: Alignment.centerLeft,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: Icon(icon, size: 18, color: const Color(0xFF4FC3F7)),
          label: Text(label, style: const TextStyle(fontSize: 14)),
          onPressed: _busy ? null : onTap,
        ),
      );
}

// ── ENC-Karten Section ────────────────────────────────────────────────────────

class _ENCSection extends StatefulWidget {
  const _ENCSection();
  @override
  State<_ENCSection> createState() => _ENCSectionState();
}

class _ENCSectionState extends State<_ENCSection> {
  static const _base = 'http://localhost:8000';

  List<Map<String, dynamic>> _installed = [];
  List<Map<String, dynamic>> _catalog   = [];
  bool _loadingInstalled = true;
  bool _loadingCatalog   = false;
  bool _catalogLoaded    = false;
  final Set<String> _downloading = {};

  @override
  void initState() {
    super.initState();
    _loadInstalled();
  }

  Future<void> _loadInstalled() async {
    setState(() => _loadingInstalled = true);
    try {
      final r = await http.get(Uri.parse('$_base/api/charts'));
      if (r.statusCode == 200) {
        _installed = (json.decode(r.body) as List)
            .map((e) => e as Map<String, dynamic>)
            .toList();
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingInstalled = false);
  }

  Future<void> _loadCatalog() async {
    setState(() => _loadingCatalog = true);
    try {
      final r = await http.get(Uri.parse('$_base/api/enc/catalog'));
      if (r.statusCode == 200) {
        _catalog = (json.decode(r.body) as List)
            .map((e) => e as Map<String, dynamic>)
            .toList();
        _catalogLoaded = true;
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingCatalog = false);
  }

  Future<void> _download(Map<String, dynamic> item) async {
    final id = item['id'] as String;
    setState(() => _downloading.add(id));
    try {
      await http.post(
        Uri.parse('$_base/api/enc/download'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(item),
      ).timeout(const Duration(minutes: 10));
      await _loadInstalled();
    } catch (_) {}
    if (mounted) setState(() => _downloading.remove(id));
  }

  Future<void> _delete(String chartId, String name) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: Text('$name löschen?',
            style: const TextStyle(color: Color(0xFFE6EDF3))),
        content: const Text('Karte wird dauerhaft entfernt.',
            style: TextStyle(color: Color(0xFF8B949E))),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen', style: TextStyle(color: Color(0xFF8B949E)))),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7D1A1A)),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Löschen')),
        ],
      ),
    );
    if (ok != true) return;
    await http.delete(Uri.parse('$_base/api/charts/$chartId'));
    await _loadInstalled();
  }

  bool _isInstalled(String id) => _installed.any((c) => c['name'] == id || c['id'] == id);

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _h('Installierte ENC-Karten'),
      if (_loadingInstalled)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Center(child: CircularProgressIndicator(color: Color(0xFF4FC3F7), strokeWidth: 2)),
        )
      else if (_installed.isEmpty)
        const Padding(
          padding: EdgeInsets.only(top: 8, bottom: 16),
          child: Text('Keine Karten installiert.',
              style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
        )
      else
        ..._installed.map((chart) => _chartTile(chart)),

      const SizedBox(height: 16),
      _h('Verfügbare Karten (ELWIS)'),
      if (!_catalogLoaded)
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFF4FC3F7),
              side: const BorderSide(color: Color(0xFF30363D)),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            icon: _loadingCatalog
                ? const SizedBox(width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF4FC3F7)))
                : const Icon(Icons.cloud_download_outlined, size: 18),
            label: Text(_loadingCatalog ? 'Lädt…' : 'Katalog laden'),
            onPressed: _loadingCatalog ? null : _loadCatalog,
          ),
        )
      else
        ..._catalog.map((item) => _catalogTile(item)),
    ]);
  }

  Widget _h(String t) => Padding(
        padding: const EdgeInsets.only(top: 4, bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t, style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Divider(color: Color(0xFF30363D), height: 1, thickness: 1),
        ]),
      );

  Widget _chartTile(Map<String, dynamic> chart) {
    final name     = chart['name'] as String? ?? chart['id'] as String? ?? '?';
    final id       = chart['id']   as String? ?? '';
    final files    = chart['enc_files'] as int? ?? 0;
    final converted = chart['converted'] as bool? ?? false;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Row(children: [
        const Icon(Icons.layers, size: 18, color: Color(0xFF4FC3F7)),
        const SizedBox(width: 10),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(name,
                style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3),
                    fontWeight: FontWeight.w500)),
            Text('$files Dateien${converted ? ' · konvertiert' : ''}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
          ]),
        ),
        IconButton(
          icon: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF8B949E)),
          onPressed: () => _delete(id, name),
          tooltip: 'Löschen',
          constraints: const BoxConstraints(),
          padding: const EdgeInsets.all(6),
        ),
      ]),
    );
  }

  Widget _catalogTile(Map<String, dynamic> item) {
    final id        = item['id']   as String? ?? '';
    final name      = item['name'] as String? ?? id;
    final installed = _isInstalled(id);
    final loading   = _downloading.contains(id);
    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
          color: installed ? const Color(0xFF1A5C2E) : const Color(0xFF30363D),
        ),
      ),
      child: Row(children: [
        Icon(installed ? Icons.check_circle : Icons.radio_button_unchecked,
            size: 16,
            color: installed ? const Color(0xFF4CAF50) : const Color(0xFF8B949E)),
        const SizedBox(width: 10),
        Expanded(
          child: Text(name,
              style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3))),
        ),
        if (!installed)
          SizedBox(
            height: 30,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1565C0),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              ),
              onPressed: loading ? null : () => _download(item),
              child: loading
                  ? const SizedBox(width: 14, height: 14,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Laden', style: TextStyle(fontSize: 12)),
            ),
          ),
        if (installed)
          const Text('Installiert',
              style: TextStyle(fontSize: 12, color: Color(0xFF4CAF50))),
      ]),
    );
  }
}

// ── Dashboard data models — use shared public types from dash_widget.dart ──────
// DashWidget and DashRow are imported from '../widgets/dashboard/dash_widget.dart'

class _ScreenEditorData {
  String name;
  String layoutId;
  Map<String, DashWidget> slots;
  _ScreenEditorData({required this.name, required this.layoutId, required this.slots});
}

// ── Dashboard Section ─────────────────────────────────────────────────────────

class _DashboardSection extends StatefulWidget {
  const _DashboardSection();
  @override
  State<_DashboardSection> createState() => _DashboardSectionState();
}

class _DashboardSectionState extends State<_DashboardSection> {
  static const _base = 'http://localhost:8000';

  int  _tab     = 0;   // 0 = visual, 1 = DSL, 2 = sensors
  int  _gridCols = 2;
  List<DashRow> _rows = [];
  late TextEditingController _dslCtrl;

  bool _loading = true;
  bool _saving  = false;
  String? _saveMsg;
  bool    _saveOk = true;
  String? _parseMsg;
  bool    _parseOk = true;

  // sensor metadata from /api/sensors/list
  List<Map<String, dynamic>> _availSensors = [];

  // grouped sensors for add-widget palette
  List<Map<String, dynamic>> _sensorGroupsPalette = [];

  // sensor management (tab 2)
  List<Map<String, dynamic>> _sensorGroups = [];
  bool _sensorsLoading = false;
  String? _sensorsError;

  // screen-format editor
  bool _isScreenFormat = false;
  List<_ScreenEditorData> _screens = [];
  int _curScreen = 0;

  // impact alert
  @override
  void initState() {
    super.initState();
    _dslCtrl = TextEditingController();
    _loadAll();
  }

  @override
  void dispose() {
    _dslCtrl.dispose();
    super.dispose();
  }

  // ── Load ──────────────────────────────────────────────────────────────────

  Future<void> _loadAll() async {
    await Future.wait([
      _loadLayout(),
      _loadAvailSensors(),
      _loadSensorGroupsPaletteData(),
    ]);
    if (mounted) setState(() => _loading = false);
  }

  Future<void> _loadLayout() async {
    try {
      final r = await http.get(Uri.parse('$_base/api/dashboard/layout'));
      if (r.statusCode == 200) {
        final body = json.decode(r.body) as Map<String, dynamic>;
        final dsl = (body['layout'] as String?) ?? '';
        _dslCtrl.text = dsl;
        _detectAndParse(dsl);
      }
    } catch (_) {}
  }

  void _detectAndParse(String dsl) {
    _isScreenFormat = dsl.trim().toUpperCase().startsWith('SCREEN');
    if (_isScreenFormat) {
      _parseDslToScreenState(dsl);
    } else {
      _parseDslToState(dsl);
    }
  }

  Future<void> _loadAvailSensors() async {
    try {
      final r = await http.get(Uri.parse('$_base/api/sensors/list'));
      if (r.statusCode == 200) {
        final body = json.decode(r.body) as Map<String, dynamic>;
        _availSensors = ((body['sensors'] as List?) ?? [])
            .cast<Map<String, dynamic>>()
            .where((e) => e['base_name'] != null)
            .toList();
      }
    } catch (_) {}
  }

  Future<void> _loadSensorGroupsPaletteData() async {
    try {
      final r = await http.get(Uri.parse('$_base/api/sensors/grouped'));
      if (r.statusCode == 200) {
        final body = json.decode(r.body) as Map<String, dynamic>;
        _sensorGroupsPalette = ((body['groups'] as List?) ?? [])
            .cast<Map<String, dynamic>>()
            .toList();
      }
    } catch (_) {}
  }

  // ── Sensor Management ─────────────────────────────────────────────────────

  Future<void> _loadSensorGroups() async {
    if (_sensorsLoading) return;
    setState(() { _sensorsLoading = true; _sensorsError = null; });
    try {
      final r = await http.get(Uri.parse('$_base/api/sensors/grouped'));
      if (r.statusCode == 200) {
        final body = json.decode(r.body) as Map<String, dynamic>;
        final groups = (body['groups'] as List?) ?? [];
        setState(() {
          _sensorGroups = groups.cast<Map<String, dynamic>>();
          _sensorsLoading = false;
        });
      } else {
        setState(() { _sensorsError = 'Fehler ${r.statusCode}'; _sensorsLoading = false; });
      }
    } catch (e) {
      if (mounted) setState(() { _sensorsError = 'Fehler: $e'; _sensorsLoading = false; });
    }
  }

  Future<void> _deleteSensorTopic(String topic, int groupIdx, int sensorIdx) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Sensor löschen', style: TextStyle(color: Color(0xFFE6EDF3), fontSize: 16)),
        content: Text('Topic "$topic" wirklich entfernen?',
            style: const TextStyle(color: Color(0xFF8B949E), fontSize: 13)),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen', style: TextStyle(color: Color(0xFF8B949E)))),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFB71C1C)),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Löschen')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      final r = await http.delete(
          Uri.parse('$_base/api/sensors/topic').replace(queryParameters: {'topic': topic}));
      if (r.statusCode == 200 && mounted) {
        setState(() {
          _sensorGroups[groupIdx]['sensors'].removeAt(sensorIdx);
          if ((_sensorGroups[groupIdx]['sensors'] as List).isEmpty) {
            _sensorGroups.removeAt(groupIdx);
          }
        });
      }
    } catch (_) {}
  }

  // ── DSL Parse ─────────────────────────────────────────────────────────────

  void _parseDslToState(String dsl) {
    final rows    = <DashRow>[];
    int   cols    = 2;
    DashRow? cur;

    for (var line in dsl.split('\n')) {
      line = line.trim();
      if (line.isEmpty || line.startsWith('#')) continue;

      if (line.startsWith('GRID ')) {
        cols = int.tryParse(line.substring(5).trim()) ?? 2;
        continue;
      }
      if (line.startsWith('ROW')) {
        final parts = line.split(RegExp(r'\s+'));
        String name = '';
        int h = 1;
        if (parts.length > 1 && parts[1].toUpperCase() != 'HEIGHT') name = parts[1];
        for (int pi = 1; pi < parts.length - 1; pi++) {
          if (parts[pi].toUpperCase() == 'HEIGHT') {
            h = int.tryParse(parts[pi + 1]) ?? 1;
          }
        }
        cur = DashRow(name: name, widgets: [], height: h.clamp(1, 4));
        rows.add(cur);
        continue;
      }

      cur ??= () {
        final r = DashRow(name: '', widgets: []);
        rows.add(r);
        return r;
      }();

      final w = _parseWidgetLine(line);
      if (w != null) cur.widgets.add(w);
    }

    _gridCols = cols.clamp(1, 4);
    _rows     = rows;
  }

  void _parseDslToScreenState(String dsl) {
    final result = <_ScreenEditorData>[];
    _ScreenEditorData? cur;
    for (var line in dsl.split('\n')) {
      line = line.trim();
      if (line.isEmpty || line.startsWith('#')) continue;
      final tokens = _tokenise(line);
      if (tokens.isEmpty) continue;
      if (tokens[0].toUpperCase() == 'SCREEN') {
        cur = _ScreenEditorData(
          name: tokens.length > 1 ? _stripQuotes(tokens[1]) : 'Screen',
          layoutId: 'full',
          slots: {},
        );
        for (int i = 2; i < tokens.length - 1; i++) {
          if (tokens[i].toUpperCase() == 'LAYOUT' && i + 1 < tokens.length) {
            cur.layoutId = tokens[i + 1];
          }
        }
        result.add(cur);
      } else if (cur != null &&
          tokens[0].length == 1 &&
          RegExp(r'[A-Za-z]').hasMatch(tokens[0])) {
        final slot = tokens[0].toUpperCase();
        final w = _parseWidgetLine(tokens.sublist(1).join(' '));
        if (w != null) cur.slots[slot] = w;
      }
    }
    _screens = result.isEmpty
        ? [_ScreenEditorData(name: 'Screen 1', layoutId: 'full', slots: {})]
        : result;
    _curScreen = _curScreen.clamp(0, (_screens.length - 1).clamp(0, 999));
  }

  DashWidget? _parseWidgetLine(String line) {
    if (line == 'SPACER') return DashWidget(type: 'SPACER');
    if (line == 'CLOCK')  return DashWidget(type: 'CLOCK');
    if (line == 'COMPASS') return DashWidget(type: 'COMPASS');

    if (line.startsWith('HORIZON')) {
      final tokens = _tokenise(line);
      final w = DashWidget(type: 'HORIZON');
      bool hasKv = false;
      for (int i = 1; i < tokens.length; i++) {
        final t = tokens[i];
        if (t.contains('=')) {
          hasKv = true;
          final eq = t.indexOf('=');
          final k = t.substring(0, eq);
          final v = t.substring(eq + 1);
          switch (k) {
            case 'rollSensor':   w.rollSensor  = v;
            case 'rollField':    w.rollField   = v;
            case 'pitchSensor':  w.pitchSensor = v;
            case 'pitchField':   w.pitchField  = v;
            case 'impactSensor': w.impactSensor = v;
            case 'impactField':  w.impactField  = v;
          }
        } else if (t.toUpperCase() == 'SIZE' && i + 1 < tokens.length) {
          w.size = int.tryParse(tokens[++i]) ?? 1;
        }
      }
      if (!hasKv && tokens.length > 1) w.sensor = tokens[1];
      return w;
    }

    if (line.startsWith('TEXT ')) {
      final t = _stripQuotes(line.substring(5).trim());
      return DashWidget(type: 'TEXT', text: t);
    }

    if (line.startsWith('SENSOR ') || line.startsWith('GAUGE ')) {
      final isGauge = line.startsWith('GAUGE ');
      final w = DashWidget(type: isGauge ? 'GAUGE' : 'SENSOR');
      // tokenise: respect quoted strings
      final tokens = _tokenise(line);
      if (tokens.length < 2) return w;
      w.sensor = tokens[1];
      for (int i = 2; i < tokens.length; i++) {
        switch (tokens[i].toUpperCase()) {
          case 'AS':
            if (i + 1 < tokens.length) w.alias = _stripQuotes(tokens[++i]);
          case 'LABEL':
            if (i + 1 < tokens.length) w.label = _stripQuotes(tokens[++i]);
          case 'UNIT':
            if (i + 1 < tokens.length) w.unit  = _stripQuotes(tokens[++i]);
          case 'STYLE':
            if (i + 1 < tokens.length) w.style = tokens[++i];
          case 'SIZE':
            if (i + 1 < tokens.length) w.size = int.tryParse(tokens[++i]) ?? 1;
          case 'MIN':
            if (i + 1 < tokens.length) w.min = double.tryParse(tokens[++i]);
          case 'MAX':
            if (i + 1 < tokens.length) w.max = double.tryParse(tokens[++i]);
          case 'DECIMALS':
            if (i + 1 < tokens.length) w.decimals = int.tryParse(tokens[++i]);
          case 'COLOR':
            if (i + 1 < tokens.length) i++; // skip value — not stored
        }
      }
      return w;
    }
    return null;
  }

  List<String> _tokenise(String line) {
    final tokens = <String>[];
    final re = RegExp(r'"[^"]*"|\S+');
    for (final m in re.allMatches(line)) tokens.add(m.group(0)!);
    return tokens;
  }

  String _stripQuotes(String s) {
    if (s.length >= 2 && s.startsWith('"') && s.endsWith('"')) {
      return s.substring(1, s.length - 1);
    }
    return s;
  }

  // ── DSL Generation ────────────────────────────────────────────────────────

  String _toWidgetDsl(DashWidget w) => DashWidgetRegistry.toDsl(w);

  String _toFullDsl() {
    final buf = StringBuffer('GRID $_gridCols\n');
    for (final row in _rows) {
      final hSuffix = row.height > 1 ? ' HEIGHT ${row.height}' : '';
      buf.write('\nROW ${row.name}$hSuffix\n');
      for (final w in row.widgets) {
        buf.write('${_toWidgetDsl(w)}\n');
      }
    }
    return buf.toString().trimRight();
  }

  String _toScreenDsl() {
    final buf = StringBuffer();
    for (int i = 0; i < _screens.length; i++) {
      final s = _screens[i];
      if (i > 0) buf.write('\n');
      buf.write('SCREEN "${s.name}" LAYOUT ${s.layoutId}\n');
      for (final e in s.slots.entries) {
        buf.write('${e.key} ${_toWidgetDsl(e.value)}\n');
      }
    }
    return buf.toString().trimRight();
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  Future<void> _saveLayout() async {
    setState(() { _saving = true; _saveMsg = null; });
    try {
      final String dsl;
      if (_tab == 1) {
        dsl = _dslCtrl.text;
      } else if (_isScreenFormat) {
        dsl = _toScreenDsl();
      } else {
        dsl = _toFullDsl();
      }
      final r = await http.post(
        Uri.parse('$_base/api/dashboard/layout'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'layout': dsl}),
      );
      setState(() {
        _saveMsg = r.statusCode == 200 ? 'Layout gespeichert' : 'Fehler (${r.statusCode})';
        _saveOk  = r.statusCode == 200;
        if (_saveOk) {
          _dslCtrl.text = dsl;
          _detectAndParse(dsl);
          context.read<SettingsService>().setRaw('dashboard_layout', dsl);
        }
      });
    } catch (e) {
      setState(() { _saveMsg = 'Fehler: $e'; _saveOk = false; });
    }
    if (mounted) setState(() => _saving = false);
  }

  Future<void> _parseDsl() async {
    setState(() { _parseMsg = null; });
    try {
      final r = await http.post(
        Uri.parse('$_base/api/dashboard/parse'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'layout': _dslCtrl.text}),
      );
      setState(() {
        _parseOk  = r.statusCode == 200;
        _parseMsg = r.statusCode == 200 ? 'DSL gültig' : 'Fehler: ${r.body}';
      });
    } catch (e) {
      setState(() { _parseOk = false; _parseMsg = 'Fehler: $e'; });
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _h('Dashboard-Editor'),
      if (_loading)
        const Center(child: CircularProgressIndicator(color: Color(0xFF4FC3F7), strokeWidth: 2))
      else ...[
        // Tab bar
        Row(children: [
          _tabBtn(0, Icons.grid_view, 'Visuell'),
          const SizedBox(width: 8),
          _tabBtn(1, Icons.code, 'DSL-Code'),
          const SizedBox(width: 8),
          _tabBtn(2, Icons.sensors, 'Sensoren'),
          const Spacer(),
          if (_tab != 2) ...[
            if (_saving)
              const SizedBox(width: 20, height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF4FC3F7)))
            else
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1565C0),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.save_outlined, size: 16),
                label: const Text('Speichern'),
                onPressed: _saveLayout,
              ),
          ] else
            IconButton(
              icon: const Icon(Icons.refresh, color: Color(0xFF4FC3F7)),
              tooltip: 'Neu laden',
              onPressed: _loadSensorGroups,
            ),
        ]),
        const SizedBox(height: 4),
        if (_saveMsg != null && _tab != 2) _statusBanner(_saveMsg!, _saveOk),
        const SizedBox(height: 12),
        if (_tab == 0) _buildVisual()
        else if (_tab == 1) _buildDsl()
        else _buildSensors(),
      ],
    ]);
  }

  Widget _tabBtn(int idx, IconData icon, String label) => GestureDetector(
        onTap: () {
          if (_tab == 0 && idx == 1) {
            _dslCtrl.text = _isScreenFormat ? _toScreenDsl() : _toFullDsl();
          } else if (_tab == 1 && idx == 0) {
            _detectAndParse(_dslCtrl.text);
          }
          setState(() => _tab = idx);
          if (idx == 2 && _sensorGroups.isEmpty && !_sensorsLoading) {
            _loadSensorGroups();
          }
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: _tab == idx ? const Color(0xFF1565C0) : const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: _tab == idx ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
            ),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 15,
                color: _tab == idx ? Colors.white : const Color(0xFF8B949E)),
            const SizedBox(width: 6),
            Text(label, style: TextStyle(
                fontSize: 13,
                color: _tab == idx ? Colors.white : const Color(0xFF8B949E),
                fontWeight: _tab == idx ? FontWeight.w600 : FontWeight.normal)),
          ]),
        ),
      );

  // ── Visual Tab ────────────────────────────────────────────────────────────

  Widget _buildVisual() {
    if (_isScreenFormat) return _buildScreenVisual();
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // GRID cols selector
      Row(children: [
        const Text('Spalten:', style: TextStyle(fontSize: 13, color: Color(0xFFE6EDF3))),
        const SizedBox(width: 12),
        ...List.generate(4, (i) {
          final n = i + 1;
          final sel = _gridCols == n;
          return Padding(
            padding: const EdgeInsets.only(right: 6),
            child: GestureDetector(
              onTap: () => setState(() => _gridCols = n),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 120),
                width: 44, height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: sel ? const Color(0xFF1565C0) : const Color(0xFF161B22),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
                  ),
                ),
                child: Text('$n', style: TextStyle(
                    fontSize: 15, fontWeight: FontWeight.w600,
                    color: sel ? Colors.white : const Color(0xFF8B949E))),
              ),
            ),
          );
        }),
      ]),
      const SizedBox(height: 16),

      // Rows
      ..._rows.asMap().entries.map((entry) => _buildRowCard(entry.key, entry.value)),

      // Add row
      const SizedBox(height: 8),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF4FC3F7),
            side: const BorderSide(color: Color(0xFF30363D)),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: const Icon(Icons.add, size: 18),
          label: const Text('Zeile hinzufügen'),
          onPressed: () => setState(() {
            _rows.add(DashRow(name: 'Zeile ${_rows.length + 1}', widgets: []));
          }),
        ),
      ),
    ]);
  }

  // ── Screen-Format Editor ─────────────────────────────────────────────────

  static const _kTmplAreas = {
    'full':        'A',        'split-h':     'A B',
    'split-v':     'A\nB',     'thirds-h':    'A B C',
    'hero-right':  'A B\nA C', 'hero-left':   'B A\nC A',
    'hero-top':    'A A\nB C', 'hero-bottom': 'B C\nA A',
    'grid-4':      'A B\nC D', 'mosaic-4':    'A B\nA C\nA D',
    'grid-6':      'A B C\nD E F', 'mosaic-5': 'A B C\nA D E',
  };

  List<String> _getTemplateSlots(String layoutId) {
    final areas = _kTmplAreas[layoutId] ?? 'A';
    final seen = <String>{};
    final slots = <String>[];
    for (final part in areas.split(RegExp(r'[\s\n]+'))) {
      if (part.isNotEmpty && seen.add(part)) slots.add(part);
    }
    return slots;
  }

  Widget _buildScreenVisual() {
    if (_screens.isEmpty) {
      return const Center(child: Text('Kein Layout', style: TextStyle(color: Color(0xFF8B949E))));
    }
    final screen = _screens[_curScreen];
    final slots = _getTemplateSlots(screen.layoutId);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Screen pager row
      Row(children: [
        Expanded(
          child: Text(screen.name,
              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFFE6EDF3))),
        ),
        if (_screens.length > 1) ...[
          GestureDetector(
            onTap: _curScreen > 0 ? () => setState(() => _curScreen--) : null,
            child: Icon(Icons.chevron_left, size: 20,
                color: _curScreen > 0 ? const Color(0xFF8B949E) : const Color(0xFF30363D)),
          ),
          Text('${_curScreen + 1}/${_screens.length}',
              style: const TextStyle(fontSize: 12, color: Color(0xFF8B949E))),
          GestureDetector(
            onTap: _curScreen < _screens.length - 1 ? () => setState(() => _curScreen++) : null,
            child: Icon(Icons.chevron_right, size: 20,
                color: _curScreen < _screens.length - 1 ? const Color(0xFF8B949E) : const Color(0xFF30363D)),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: () => setState(() {
              _screens.removeAt(_curScreen);
              _curScreen = (_curScreen - 1).clamp(0, _screens.length - 1);
            }),
            child: const Icon(Icons.delete_outline, size: 16, color: Color(0xFF8B949E)),
          ),
          const SizedBox(width: 8),
        ],
        GestureDetector(
          onTap: () => setState(() {
            _screens.add(_ScreenEditorData(
                name: 'Screen ${_screens.length + 1}', layoutId: 'full', slots: {}));
            _curScreen = _screens.length - 1;
          }),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFF1565C0).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: const Color(0xFF1565C0)),
            ),
            child: const Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.add, size: 14, color: Color(0xFF4FC3F7)),
              SizedBox(width: 4),
              Text('+Screen', style: TextStyle(fontSize: 12, color: Color(0xFF4FC3F7))),
            ]),
          ),
        ),
      ]),
      const SizedBox(height: 14),
      const Text('VORLAGE', style: TextStyle(
          fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
      const SizedBox(height: 8),
      _buildTemplatePicker(screen),
      const SizedBox(height: 16),
      const Text('SLOTS', style: TextStyle(
          fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
      const SizedBox(height: 8),
      ...slots.map((slot) => _buildSlotCard(slot, screen)),
    ]);
  }

  Widget _buildTemplatePicker(_ScreenEditorData screen) {
    const templates = [
      ('full',        'Vollbild',   'A'),
      ('split-h',     'Split H',    'A B'),
      ('split-v',     'Split V',    'A\nB'),
      ('thirds-h',    '3 Spalten',  'A B C'),
      ('hero-right',  'Hero R',     'A B\nA C'),
      ('hero-left',   'Hero L',     'B A\nC A'),
      ('hero-top',    'Hero O',     'A A\nB C'),
      ('hero-bottom', 'Hero U',     'B C\nA A'),
      ('grid-4',      'Grid 2×2',   'A B\nC D'),
      ('mosaic-4',    'Mosaik 4',   'A B\nA C\nA D'),
      ('grid-6',      'Grid 2×3',   'A B C\nD E F'),
      ('mosaic-5',    'Mosaik 5',   'A B C\nA D E'),
    ];
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: templates.map((t) {
        final (id, label, areas) = t;
        final sel = screen.layoutId == id;
        return GestureDetector(
          onTap: () => setState(() => _screens[_curScreen].layoutId = id),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.all(5),
            decoration: BoxDecoration(
              color: sel
                  ? const Color(0xFF1565C0).withValues(alpha: 0.2)
                  : const Color(0xFF161B22),
              borderRadius: BorderRadius.circular(6),
              border: Border.all(
                color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
                width: sel ? 2 : 1,
              ),
            ),
            child: Column(mainAxisSize: MainAxisSize.min, children: [
              _miniTemplateGrid(areas),
              const SizedBox(height: 4),
              Text(label, style: TextStyle(
                  fontSize: 9,
                  color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF8B949E))),
            ]),
          ),
        );
      }).toList(),
    );
  }

  Widget _miniTemplateGrid(String areas) {
    const colors = {
      'A': Color(0xFF1565C0), 'B': Color(0xFF1B5E20),
      'C': Color(0xFF6A1B9A), 'D': Color(0xFF7B4500),
      'E': Color(0xFF006064), 'F': Color(0xFF880E4F),
    };
    final rows = areas.split('\n').map((r) => r.trim().split(RegExp(r'\s+'))).toList();
    final numCols = rows.fold<int>(0, (m, r) => r.length > m ? r.length : m);
    return SizedBox(
      width: 52,
      height: 32,
      child: Column(
        children: rows.map((rowSlots) => Expanded(
          child: Row(
            children: List.generate(numCols, (i) {
              final slot = i < rowSlots.length ? rowSlots[i] : '';
              return Expanded(
                child: Container(
                  margin: const EdgeInsets.all(1),
                  decoration: BoxDecoration(
                    color: slot.isEmpty ? Colors.transparent : (colors[slot] ?? const Color(0xFF30363D)),
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: slot.isEmpty ? null : Center(
                    child: Text(slot, style: const TextStyle(
                        fontSize: 7, color: Colors.white, fontWeight: FontWeight.bold)),
                  ),
                ),
              );
            }),
          ),
        )).toList(),
      ),
    );
  }

  Widget _buildSlotCard(String slot, _ScreenEditorData screen) {
    final w = screen.slots[slot];
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: InkWell(
        onTap: () => _editSlotWidget(slot, screen),
        borderRadius: BorderRadius.circular(10),
        child: Row(crossAxisAlignment: CrossAxisAlignment.center, children: [
          Container(
            width: 36,
            height: 60,
            alignment: Alignment.center,
            decoration: const BoxDecoration(
              color: Color(0xFF0D1117),
              borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(9), bottomLeft: Radius.circular(9)),
            ),
            child: Text(slot, style: const TextStyle(
                fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF4FC3F7))),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              child: w == null
                  ? const Row(children: [
                      Icon(Icons.add_circle_outline, size: 18, color: Color(0xFF8B949E)),
                      SizedBox(width: 8),
                      Text('Widget hinzufügen',
                          style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
                    ])
                  : _buildWidgetPreview(w),
            ),
          ),
          const Padding(
            padding: EdgeInsets.all(12),
            child: Icon(Icons.edit_outlined, size: 16, color: Color(0xFF8B949E)),
          ),
        ]),
      ),
    );
  }

  Widget _buildWidgetPreview(DashWidget w) {
    final (icon, color) = _widgetMeta(w.type);
    final detail = switch (w.type) {
      'GAUGE'  => '${w.label ?? _shortPath(w.sensor ?? '')}  '
                  '${w.min?.toInt() ?? 0}–${w.max?.toInt() ?? 100} ${w.unit ?? ''}  '
                  '(${w.style ?? 'arc180'})',
      'SENSOR' => w.alias ?? _shortPath(w.sensor ?? ''),
      'TEXT'   => '"${w.text ?? ''}"',
      _        => w.type,
    };
    return Row(children: [
      Icon(icon, size: 20, color: color),
      const SizedBox(width: 10),
      Expanded(
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(w.type, style: TextStyle(
              fontSize: 10, color: color, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
          const SizedBox(height: 2),
          Text(detail, style: const TextStyle(fontSize: 12, color: Color(0xFFE6EDF3)),
              maxLines: 1, overflow: TextOverflow.ellipsis),
          if ((w.type == 'GAUGE' || w.type == 'SENSOR') && w.sensor != null)
            Text(w.sensor!,
                style: const TextStyle(fontSize: 10, color: Color(0xFF8B949E)),
                maxLines: 1, overflow: TextOverflow.ellipsis),
        ]),
      ),
    ]);
  }

  void _editSlotWidget(String slot, _ScreenEditorData screen) async {
    final current = screen.slots[slot] ?? DashWidget(type: 'SENSOR');
    final saved = await showDialog<DashWidget>(
      context: context,
      builder: (_) => _WidgetEditDialog(widget: current, sensors: _availSensors),
    );
    if (saved != null && mounted) {
      setState(() => _screens[_curScreen].slots[slot] = saved);
    }
  }

  Widget _buildRowCard(int rowIdx, DashRow row) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // Row header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: const BoxDecoration(
            border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
          ),
          child: Row(children: [
            const Icon(Icons.table_rows_outlined, size: 16, color: Color(0xFF4FC3F7)),
            const SizedBox(width: 8),
            Expanded(
              child: GestureDetector(
                onTap: () => _renameRow(rowIdx),
                child: Text(
                  row.name.isNotEmpty ? row.name : '(ohne Titel)',
                  style: TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600,
                    color: row.name.isNotEmpty
                        ? const Color(0xFFE6EDF3) : const Color(0xFF8B949E),
                  ),
                ),
              ),
            ),
            // Height selector H1-H4
            ...List.generate(4, (i) {
              final n = i + 1;
              final sel = row.height == n;
              return GestureDetector(
                onTap: () => setState(() => _rows[rowIdx].height = n),
                child: Container(
                  width: 26, height: 26,
                  margin: const EdgeInsets.only(left: 4),
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(
                      color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
                    ),
                  ),
                  child: Text('H$n', style: TextStyle(
                    fontSize: 9, fontWeight: FontWeight.w700,
                    color: sel ? Colors.white : const Color(0xFF8B949E),
                  )),
                ),
              );
            }),
            const SizedBox(width: 6),
            // Add widget button
            GestureDetector(
              onTap: () => _addWidget(rowIdx),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: const Color(0xFF1565C0).withValues(alpha: 0.25),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: const Color(0xFF1565C0)),
                ),
                child: const Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(Icons.add, size: 14, color: Color(0xFF4FC3F7)),
                  SizedBox(width: 4),
                  Text('Widget', style: TextStyle(fontSize: 12, color: Color(0xFF4FC3F7))),
                ]),
              ),
            ),
            const SizedBox(width: 8),
            // Delete row
            GestureDetector(
              onTap: () => setState(() => _rows.removeAt(rowIdx)),
              child: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF8B949E)),
            ),
          ]),
        ),

        // Widget list
        if (row.widgets.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Text('Keine Widgets — tippe auf "Widget +" um eines hinzuzufügen',
                style: TextStyle(fontSize: 12, color: Color(0xFF8B949E))),
          )
        else
          Padding(
            padding: const EdgeInsets.all(10),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: row.widgets.asMap().entries
                  .map((e) => _buildWidgetChip(rowIdx, e.key, e.value))
                  .toList(),
            ),
          ),
      ]),
    );
  }

  Widget _buildWidgetChip(int rowIdx, int wIdx, DashWidget w) {
    final (icon, color) = _widgetMeta(w.type);
    final label = _widgetChipLabel(w);
    final widgets = _rows[rowIdx].widgets;
    return GestureDetector(
      onTap: () => _editWidget(rowIdx, wIdx),
      child: Container(
        constraints: const BoxConstraints(minWidth: 90, minHeight: 52),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Column(mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
            Text(w.type, style: TextStyle(fontSize: 10, color: color,
                fontWeight: FontWeight.w700)),
            if (w.size > 1) ...[
              const SizedBox(width: 4),
              Text('×${w.size}', style: const TextStyle(
                  fontSize: 10, color: Color(0xFF8B949E))),
            ],
            const SizedBox(width: 4),
            if (wIdx > 0)
              GestureDetector(
                onTap: () => setState(() {
                  final tmp = widgets.removeAt(wIdx);
                  widgets.insert(wIdx - 1, tmp);
                }),
                child: const Icon(Icons.arrow_back_ios, size: 11, color: Color(0xFF8B949E)),
              ),
            if (wIdx < widgets.length - 1)
              GestureDetector(
                onTap: () => setState(() {
                  final tmp = widgets.removeAt(wIdx);
                  widgets.insert(wIdx + 1, tmp);
                }),
                child: const Icon(Icons.arrow_forward_ios, size: 11, color: Color(0xFF8B949E)),
              ),
            const SizedBox(width: 2),
            GestureDetector(
              onTap: () => setState(() => _rows[rowIdx].widgets.removeAt(wIdx)),
              child: const Icon(Icons.close, size: 13, color: Color(0xFF8B949E)),
            ),
          ]),
          if (label.isNotEmpty) ...[
            const SizedBox(height: 3),
            Text(label,
                maxLines: 2, overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, color: Color(0xFFE6EDF3))),
          ],
        ]),
      ),
    );
  }

  (IconData, Color) _widgetMeta(String type) => switch (type) {
        'SENSOR'  => (Icons.sensors,       const Color(0xFF4FC3F7)),
        'GAUGE'   => (Icons.speed,         const Color(0xFF81C784)),
        'HORIZON' => (Icons.landscape,     const Color(0xFF1565C0)),
        'TEXT'    => (Icons.title,         const Color(0xFFFFB74D)),
        'CLOCK'   => (Icons.access_time,   const Color(0xFFBA68C8)),
        'COMPASS' => (Icons.explore,       const Color(0xFF4FC3F7)),
        'SPACER'  => (Icons.space_bar,     const Color(0xFF8B949E)),
        _         => (Icons.widgets,       const Color(0xFF8B949E)),
      };

  String _widgetChipLabel(DashWidget w) {
    switch (w.type) {
      case 'SENSOR':  return w.alias ?? _shortPath(w.sensor ?? '');
      case 'GAUGE':   return w.label ?? _shortPath(w.sensor ?? '');
      case 'TEXT':    return w.text ?? '';
      case 'HORIZON': return _shortPath(w.rollSensor ?? w.sensor ?? 'lage');
      default:        return '';
    }
  }

  String _shortPath(String path) {
    final parts = path.split('/');
    return parts.last;
  }

  void _renameRow(int rowIdx) async {
    final ctrl = TextEditingController(text: _rows[rowIdx].name);
    final result = await showDialog<String>(
      context: context,
      builder: (_) => _SimpleInputDialog(
        title: 'Zeile umbenennen',
        ctrl: ctrl,
        onSave: () => Navigator.pop(context, ctrl.text),
      ),
    );
    ctrl.dispose();
    if (result != null) setState(() => _rows[rowIdx].name = result);
  }

  void _addWidget(int rowIdx) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0D1117),
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(16))),
      builder: (sheetCtx) => _AddWidgetSheet(
        sensorGroups: _sensorGroupsPalette,
        onAdd: (w) {
          setState(() => _rows[rowIdx].widgets.add(w));
          Navigator.pop(sheetCtx);
        },
      ),
    );
  }

  void _editWidget(int rowIdx, int wIdx) async {
    final w = _rows[rowIdx].widgets[wIdx].copy();
    final saved = await showDialog<DashWidget>(
      context: context,
      builder: (_) => _WidgetEditDialog(widget: w, sensors: _availSensors),
    );
    if (saved != null) setState(() => _rows[rowIdx].widgets[wIdx] = saved);
  }

  // ── DSL Tab ───────────────────────────────────────────────────────────────

  Widget _buildDsl() {
    return Column(children: [
      GestureDetector(
        onTap: () => showKeyboard(context, _dslCtrl, multiline: true, label: 'Layout DSL'),
        child: AbsorbPointer(
          child: TextField(
            controller: _dslCtrl,
            readOnly: true,
            maxLines: 18,
            style: const TextStyle(
              fontSize: 12, color: Color(0xFFE6EDF3),
              fontFamily: 'monospace', height: 1.5,
            ),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.all(12),
              filled: true,
              fillColor: const Color(0xFF0D1117),
              border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF30363D))),
              enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: const BorderSide(color: Color(0xFF30363D))),
              hintText: 'GRID 2\nROW Fahrt\nSENSOR navigation/speedOverGround\n...',
              hintStyle: const TextStyle(fontSize: 12, color: Color(0xFF444D56)),
            ),
          ),
        ),
      ),
      const SizedBox(height: 10),
      Row(children: [
        OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF8B949E),
            side: const BorderSide(color: Color(0xFF30363D)),
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: const Icon(Icons.check_circle_outline, size: 16),
          label: const Text('Prüfen'),
          onPressed: _parseDsl,
        ),
      ]),
      if (_parseMsg != null) ...[
        const SizedBox(height: 8),
        _statusBanner(_parseMsg!, _parseOk),
      ],
    ]);
  }

  // ── Sensors Tab ───────────────────────────────────────────────────────────

  Widget _buildSensors() {
    if (_sensorsLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(32),
          child: CircularProgressIndicator(color: Color(0xFF4FC3F7), strokeWidth: 2),
        ),
      );
    }
    if (_sensorsError != null) {
      return _statusBanner(_sensorsError!, false);
    }
    if (_sensorGroups.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(24),
        child: Text('Keine Sensoren gefunden.',
            style: TextStyle(color: Color(0xFF8B949E), fontSize: 13)),
      );
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: _sensorGroups.asMap().entries.map((groupEntry) {
        final groupIdx = groupEntry.key;
        final group = groupEntry.value;
        final groupName = group['label'] as String? ?? 'Unbekannt';
        final sensors = (group['sensors'] as List?)?.cast<Map<String, dynamic>>() ?? [];
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: Theme(
            data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
            child: ExpansionTile(
              tilePadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 2),
              childrenPadding: EdgeInsets.zero,
              collapsedIconColor: const Color(0xFF8B949E),
              iconColor: const Color(0xFF4FC3F7),
              title: Row(children: [
                const Icon(Icons.folder_outlined, size: 16, color: Color(0xFF4FC3F7)),
                const SizedBox(width: 8),
                Text(groupName, style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFFE6EDF3))),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1565C0).withValues(alpha: 0.25),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text('${sensors.length}',
                      style: const TextStyle(fontSize: 11, color: Color(0xFF4FC3F7))),
                ),
              ]),
              children: sensors.asMap().entries.map((sEntry) {
                final sIdx = sEntry.key;
                final s = sEntry.value;
                final topic = s['topic'] as String? ?? '';
                final label = s['label'] as String? ?? topic.split('/').last;
                final unit  = s['unit']  as String? ?? '';
                final value = s['value'];
                return Container(
                  decoration: const BoxDecoration(
                    border: Border(top: BorderSide(color: Color(0xFF30363D))),
                  ),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  child: Row(children: [
                    const Icon(Icons.sensors_outlined, size: 14, color: Color(0xFF8B949E)),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(label, style: const TextStyle(
                            fontSize: 13, color: Color(0xFFE6EDF3))),
                        Text(topic, style: const TextStyle(
                            fontSize: 10, color: Color(0xFF8B949E)),
                            maxLines: 1, overflow: TextOverflow.ellipsis),
                      ]),
                    ),
                    if (value != null) ...[
                      Text('$value${unit.isNotEmpty ? ' $unit' : ''}',
                          style: const TextStyle(fontSize: 12, color: Color(0xFF4FC3F7))),
                      const SizedBox(width: 8),
                    ],
                    GestureDetector(
                      onTap: () => _deleteSensorTopic(topic, groupIdx, sIdx),
                      child: const Icon(Icons.delete_outline, size: 18, color: Color(0xFF8B949E)),
                    ),
                  ]),
                );
              }).toList(),
            ),
          ),
        );
      }).toList(),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  Widget _statusBanner(String msg, bool ok) => Container(
        width: double.infinity,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: ok ? const Color(0xFF0F2D1A) : const Color(0xFF2D0F0F),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: ok ? const Color(0xFF1A5C2E) : const Color(0xFF5C1A1A)),
        ),
        child: Text(msg, style: TextStyle(
            fontSize: 13, color: ok ? const Color(0xFF4CAF50) : const Color(0xFFEF5350))),
      );

  Widget _h(String t) => Padding(
        padding: const EdgeInsets.only(top: 4, bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t, style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Divider(color: Color(0xFF30363D), height: 1, thickness: 1),
        ]),
      );
}

// ── Simple Input Dialog ───────────────────────────────────────────────────────

class _SimpleInputDialog extends StatelessWidget {
  final String title;
  final TextEditingController ctrl;
  final VoidCallback onSave;
  const _SimpleInputDialog({required this.title, required this.ctrl, required this.onSave});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF161B22),
      title: Text(title, style: const TextStyle(color: Color(0xFFE6EDF3), fontSize: 16)),
      content: GestureDetector(
        onTap: () => showKeyboard(context, ctrl, label: title),
        child: AbsorbPointer(
          child: TextField(
            controller: ctrl,
            readOnly: true,
            style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3)),
            decoration: InputDecoration(
              isDense: true,
              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
              filled: true,
              fillColor: const Color(0xFF0D1117),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                  borderSide: const BorderSide(color: Color(0xFF30363D))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                  borderSide: const BorderSide(color: Color(0xFF30363D))),
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Abbrechen', style: TextStyle(color: Color(0xFF8B949E)))),
        ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF1565C0)),
            onPressed: onSave,
            child: const Text('OK')),
      ],
    );
  }
}

// ── Add Widget Sheet ──────────────────────────────────────────────────────────

class _AddWidgetSheet extends StatelessWidget {
  final List<Map<String, dynamic>> sensorGroups;
  final void Function(DashWidget) onAdd;
  const _AddWidgetSheet({required this.sensorGroups, required this.onAdd});

  Future<void> _pickType(BuildContext ctx, String topic, String label, String unit) async {
    final type = await showDialog<String>(
      context: ctx,
      builder: (dCtx) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: Text(label,
            style: const TextStyle(color: Color(0xFFE6EDF3), fontSize: 15),
            maxLines: 2, overflow: TextOverflow.ellipsis),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          _typeOption(dCtx, 'SENSOR', Icons.bar_chart, 'Sensor-Karte',
              'Zeigt den aktuellen Wert'),
          const SizedBox(height: 8),
          _typeOption(dCtx, 'GAUGE', Icons.speed, 'Gauge',
              'Zeiger- oder Bogenanzeige'),
        ]),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(dCtx),
              child: const Text('Abbrechen',
                  style: TextStyle(color: Color(0xFF8B949E)))),
        ],
      ),
    );
    if (type == null) return;
    final w = DashWidget(type: type, sensor: topic);
    if (type == 'GAUGE') {
      w.label = label;
      w.unit = unit.isEmpty ? null : unit;
      w.min = 0;
      w.max = 100;
    } else {
      w.alias = label;
    }
    onAdd(w);
  }

  Widget _typeOption(BuildContext ctx, String type, IconData icon,
      String title, String subtitle) {
    return GestureDetector(
      onTap: () => Navigator.pop(ctx, type),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Row(children: [
          Icon(icon, size: 22, color: const Color(0xFF4FC3F7)),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(title, style: const TextStyle(
                color: Color(0xFFE6EDF3), fontSize: 13,
                fontWeight: FontWeight.w600)),
            Text(subtitle, style: const TextStyle(
                color: Color(0xFF8B949E), fontSize: 11)),
          ]),
        ]),
      ),
    );
  }

  Widget _specialBtn(BuildContext ctx, String type, IconData icon, String label) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          final w = DashWidget(type: type);
          if (type == 'TEXT')    w.text   = 'Text';
          if (type == 'HORIZON') w.sensor = 'boot/sensoren/lage';
          onAdd(w);
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 4),
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, size: 18, color: const Color(0xFF8B949E)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(
                fontSize: 10, color: Color(0xFF8B949E))),
          ]),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.75,
      maxChildSize: 0.95,
      minChildSize: 0.45,
      expand: false,
      builder: (ctx, scrollCtrl) => Column(children: [
        // Drag handle
        Container(
          margin: const EdgeInsets.only(top: 10, bottom: 12),
          width: 40, height: 4,
          decoration: BoxDecoration(
            color: const Color(0xFF30363D),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        // Special widgets
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: Row(children: [
            _specialBtn(ctx, 'SPACER',  Icons.space_bar,    'Spacer'),
            _specialBtn(ctx, 'CLOCK',   Icons.access_time,  'Uhr'),
            _specialBtn(ctx, 'TEXT',    Icons.title,        'Text'),
            _specialBtn(ctx, 'COMPASS', Icons.explore,      'Kompass'),
            _specialBtn(ctx, 'HORIZON', Icons.landscape,    'Horizont'),
          ]),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          child: Divider(color: Color(0xFF30363D), height: 1),
        ),
        // Sensor groups
        Expanded(
          child: sensorGroups.isEmpty
              ? const Center(
                  child: Text('Keine Sensoren geladen.',
                      style: TextStyle(color: Color(0xFF8B949E), fontSize: 13)))
              : ListView(
                  controller: scrollCtrl,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  children: sensorGroups.map((group) {
                    final groupName = group['label'] as String? ?? 'Unbekannt';
                    final icon = group['icon'] as String? ?? '📡';
                    final sensors = (group['sensors'] as List?)
                            ?.cast<Map<String, dynamic>>() ??
                        [];
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      decoration: BoxDecoration(
                        color: const Color(0xFF161B22),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF30363D)),
                      ),
                      child: Theme(
                        data: Theme.of(ctx).copyWith(
                            dividerColor: Colors.transparent),
                        child: ExpansionTile(
                          tilePadding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 0),
                          childrenPadding: EdgeInsets.zero,
                          collapsedIconColor: const Color(0xFF8B949E),
                          iconColor: const Color(0xFF4FC3F7),
                          title: Row(children: [
                            Text(icon,
                                style: const TextStyle(fontSize: 15)),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(groupName,
                                  style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: Color(0xFFE6EDF3))),
                            ),
                            Text('${sensors.length}',
                                style: const TextStyle(
                                    fontSize: 11, color: Color(0xFF8B949E))),
                          ]),
                          children: sensors.map((s) {
                            final topic = s['topic'] as String? ?? '';
                            final label = s['label'] as String? ??
                                topic.split('/').last;
                            final unit = s['unit'] as String? ?? '';
                            final value = s['value'];
                            return InkWell(
                              onTap: () => _pickType(ctx, topic, label, unit),
                              child: Container(
                                decoration: const BoxDecoration(
                                  border: Border(
                                      top: BorderSide(
                                          color: Color(0xFF30363D))),
                                ),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 10),
                                child: Row(children: [
                                  const Icon(Icons.sensors_outlined,
                                      size: 14, color: Color(0xFF8B949E)),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(label,
                                              style: const TextStyle(
                                                  fontSize: 12,
                                                  color: Color(0xFFE6EDF3))),
                                          Text(topic,
                                              style: const TextStyle(
                                                  fontSize: 10,
                                                  color: Color(0xFF8B949E)),
                                              maxLines: 1,
                                              overflow: TextOverflow.ellipsis),
                                        ]),
                                  ),
                                  if (value != null)
                                    Text(
                                        '$value${unit.isNotEmpty ? ' $unit' : ''}',
                                        style: const TextStyle(
                                            fontSize: 11,
                                            color: Color(0xFF4FC3F7))),
                                ]),
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    );
                  }).toList(),
                ),
        ),
        const SizedBox(height: 12),
      ]),
    );
  }
}

// ── Widget Edit Dialog ────────────────────────────────────────────────────────

class _WidgetEditDialog extends StatefulWidget {
  final DashWidget widget;
  final List<Map<String, dynamic>> sensors;
  const _WidgetEditDialog({required this.widget, required this.sensors});
  @override
  State<_WidgetEditDialog> createState() => _WidgetEditDialogState();
}

class _WidgetEditDialogState extends State<_WidgetEditDialog> {
  late DashWidget _w;
  final _aliasCtrl = TextEditingController();
  final _labelCtrl = TextEditingController();
  final _unitCtrl  = TextEditingController();
  final _textCtrl  = TextEditingController();
  final _minCtrl   = TextEditingController();
  final _maxCtrl   = TextEditingController();
  final _searchCtrl = TextEditingController();
  String _search = '';

  static const _types = ['SENSOR', 'GAUGE', 'HORIZON', 'TEXT', 'SPACER', 'CLOCK', 'COMPASS'];
  static const _sensorStyles = ['card', 'minimal', 'compact', 'hero'];
  static const _gaugeStyles  = ['arc180', 'arc270', 'arc360', 'bar'];

  @override
  void initState() {
    super.initState();
    _w = widget.widget.copy();
    _aliasCtrl.text = _w.alias ?? '';
    _labelCtrl.text = _w.label ?? '';
    _unitCtrl.text  = _w.unit  ?? '';
    _textCtrl.text  = _w.text  ?? '';
    _minCtrl.text   = _w.min   != null ? _fmtNum(_w.min!) : '';
    _maxCtrl.text   = _w.max   != null ? _fmtNum(_w.max!) : '';
    _searchCtrl.addListener(() => setState(() => _search = _searchCtrl.text));
  }

  @override
  void dispose() {
    _aliasCtrl.dispose(); _labelCtrl.dispose(); _unitCtrl.dispose();
    _textCtrl.dispose();  _minCtrl.dispose();   _maxCtrl.dispose();
    _searchCtrl.dispose();
    super.dispose();
  }

  String _fmtNum(double v) =>
      v == v.truncateToDouble() ? v.toInt().toString() : v.toString();

  void _commit() {
    if (_w.type != 'SENSOR') {
      _w.alias = _aliasCtrl.text.isEmpty ? null : _aliasCtrl.text;
    }
    _w.label    = _labelCtrl.text.isEmpty ? null : _labelCtrl.text;
    _w.unit     = _unitCtrl.text.isEmpty  ? null : _unitCtrl.text;
    _w.text     = _textCtrl.text.isEmpty  ? null : _textCtrl.text;
    _w.min      = double.tryParse(_minCtrl.text);
    _w.max      = double.tryParse(_maxCtrl.text);
    Navigator.pop(context, _w);
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF161B22),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 500, maxHeight: 640),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          // Header
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: const BoxDecoration(
              border: Border(bottom: BorderSide(color: Color(0xFF30363D))),
            ),
            child: Row(children: [
              const Icon(Icons.widgets_outlined, size: 18, color: Color(0xFF4FC3F7)),
              const SizedBox(width: 8),
              const Text('Widget bearbeiten',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600,
                      color: Color(0xFFE6EDF3))),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, size: 18, color: Color(0xFF8B949E)),
                onPressed: () => Navigator.pop(context),
                constraints: const BoxConstraints(),
                padding: EdgeInsets.zero,
              ),
            ]),
          ),
          // Body
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Type selector
                _label('Typ'),
                const SizedBox(height: 6),
                SizedBox(
                  height: 44,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: _types.map((t) {
                      final sel = _w.type == t;
                      return Padding(
                        padding: const EdgeInsets.only(right: 6),
                        child: GestureDetector(
                          onTap: () => setState(() {
                            _w.type = t;
                            if (t == 'SENSOR' && _w.style != null &&
                                !_sensorStyles.contains(_w.style)) {
                              _w.style = null;
                            }
                            if (t == 'GAUGE' && _w.style != null &&
                                !_gaugeStyles.contains(_w.style)) {
                              _w.style = null;
                            }
                          }),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 120),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                  color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
                            ),
                            child: Text(t, style: TextStyle(
                                fontSize: 13,
                                color: sel ? Colors.white : const Color(0xFF8B949E),
                                fontWeight: sel ? FontWeight.w600 : FontWeight.normal)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 14),

                // Type-specific fields
                if (_w.type == 'SENSOR') ...[
                  SensorDashWidget.buildEditor(_w, setState, widget.sensors),
                  const SizedBox(height: 10),
                  _label('Stil'),
                  const SizedBox(height: 6),
                  _stylePicker(_sensorStyles),
                ],
                if (_w.type == 'GAUGE') ...[
                  _label('Sensor'),
                  const SizedBox(height: 6),
                  _sensorPicker(),
                  const SizedBox(height: 10),
                  if (_w.sensor != null) ...[
                    _label('Feld'),
                    const SizedBox(height: 6),
                    Builder(builder: (_) {
                      final fields = ((widget.sensors
                          .firstWhere((s) => s['base_name'] == _w.sensor,
                              orElse: () => <String, dynamic>{})['values']
                          as Map<String, dynamic>?)?.keys.toList()) ?? <String>[];
                      if (fields.isEmpty) return const SizedBox.shrink();
                      final cur = (_w.field != null && fields.contains(_w.field))
                          ? _w.field!
                          : fields.first;
                      return DropdownButton<String>(
                        value: cur,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF161B22),
                        style: const TextStyle(color: Color(0xFFE6EDF3), fontSize: 13),
                        underline: Container(height: 1, color: const Color(0xFF30363D)),
                        items: fields.map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
                        onChanged: (v) { if (v != null) setState(() => _w.field = v); },
                      );
                    }),
                    const SizedBox(height: 2),
                  ],
                  const SizedBox(height: 2),
                ],
                if (_w.type == 'GAUGE') ...[
                  Row(children: [
                    Expanded(child: _inputRow('Min', _minCtrl, numeric: true)),
                    const SizedBox(width: 10),
                    Expanded(child: _inputRow('Max', _maxCtrl, numeric: true)),
                  ]),
                  const SizedBox(height: 10),
                  _inputRow('Einheit', _unitCtrl),
                  const SizedBox(height: 10),
                  _inputRow('Label', _labelCtrl),
                  const SizedBox(height: 10),
                  _label('Stil'),
                  const SizedBox(height: 6),
                  _stylePicker(_gaugeStyles),
                  const SizedBox(height: 12),
                  _label('Vorschau'),
                  const SizedBox(height: 6),
                  SizedBox(
                    height: 160,
                    child: GaugeWidget(
                      value: (_w.min ?? 0) + ((_w.max ?? 100) - (_w.min ?? 0)) * 0.65,
                      min: _w.min ?? 0,
                      max: _w.max ?? 100,
                      unit: _w.unit ?? '',
                      label: _w.label ?? (_w.sensor?.split('/').last ?? ''),
                      style: _gaugeStyleOf(_w.style),
                      color: const Color(0xFF4FC3F7),
                      decimals: _w.decimals ?? 1,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _label('Dezimalstellen'),
                  const SizedBox(height: 6),
                  _decimalsPicker(),
                ],
                if (_w.type == 'TEXT') ...[
                  _inputRow('Text', _textCtrl),
                ],
                if (_w.type == 'HORIZON') ...[
                  Builder(builder: (_) {
                    // Flat list of all full topic paths: base_name/field
                    final allPaths = <Map<String, String>>[];
                    for (final s in widget.sensors) {
                      final base = s['base_name'] as String? ?? '';
                      final sensorName = s['name'] as String? ?? base;
                      final vals = (s['values'] as Map<dynamic, dynamic>?) ?? {};
                      for (final field in vals.keys) {
                        allPaths.add({
                          'full': '$base/$field',
                          'label': '$sensorName › $field',
                        });
                      }
                    }
                    String? rollFull = (_w.rollSensor?.isNotEmpty == true && _w.rollField != null)
                        ? '${_w.rollSensor}/${_w.rollField}'
                        : null;
                    if (rollFull != null && !allPaths.any((p) => p['full'] == rollFull)) rollFull = null;
                    String? pitchFull = (_w.pitchSensor?.isNotEmpty == true && _w.pitchField != null)
                        ? '${_w.pitchSensor}/${_w.pitchField}'
                        : null;
                    if (pitchFull != null && !allPaths.any((p) => p['full'] == pitchFull)) pitchFull = null;
                    String? impactFull = (_w.impactSensor?.isNotEmpty == true && _w.impactField != null)
                        ? '${_w.impactSensor}/${_w.impactField}'
                        : null;
                    if (impactFull != null && !allPaths.any((p) => p['full'] == impactFull)) impactFull = null;

                    void setPath(String which, String? full) {
                      if (full == null) return;
                      final idx = full.lastIndexOf('/');
                      final base = idx >= 0 ? full.substring(0, idx) : full;
                      final field = idx >= 0 ? full.substring(idx + 1) : '';
                      setState(() {
                        if (which == 'roll') { _w.rollSensor = base; _w.rollField = field; }
                        else if (which == 'pitch') { _w.pitchSensor = base; _w.pitchField = field; }
                        else if (which == 'impact') { _w.impactSensor = base; _w.impactField = field; }
                      });
                    }

                    DropdownButton<String> pathDropdown(String which, String? cur, String hint) =>
                        DropdownButton<String>(
                          value: cur,
                          hint: Text(hint, style: const TextStyle(color: Color(0xFF8B949E))),
                          isExpanded: true,
                          dropdownColor: const Color(0xFF161B22),
                          style: const TextStyle(color: Color(0xFFE6EDF3), fontSize: 13),
                          underline: Container(height: 1, color: const Color(0xFF30363D)),
                          items: allPaths.map((p) => DropdownMenuItem<String>(
                            value: p['full'],
                            child: Text(p['label'] ?? p['full'] ?? '', overflow: TextOverflow.ellipsis),
                          )).toList(),
                          onChanged: (v) => setPath(which, v),
                        );

                    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Roll-Topic'),
                      const SizedBox(height: 6),
                      pathDropdown('roll', rollFull, 'Roll-Topic wählen…'),
                      const SizedBox(height: 14),
                      _label('Pitch-Topic'),
                      const SizedBox(height: 6),
                      pathDropdown('pitch', pitchFull, 'Pitch-Topic wählen…'),
                      const SizedBox(height: 14),
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF0D1117),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: const Color(0xFF30363D)),
                        ),
                        child: SwitchListTile(
                          dense: true,
                          activeColor: const Color(0xFF4FC3F7),
                          title: const Text('Impact-Alarm',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                                  color: Color(0xFFE6EDF3))),
                          subtitle: const Text('Horizont blinkt rot bei Erschütterung',
                              style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                          value: _w.impactSensor != null,
                          onChanged: (on) => setState(() {
                            _w.impactSensor = on ? '' : null;
                            _w.impactField  = on ? 'aktiv' : null;
                          }),
                        ),
                      ),
                      if (_w.impactSensor != null) ...[
                        const SizedBox(height: 10),
                        _label('Impact-Topic'),
                        const SizedBox(height: 6),
                        pathDropdown('impact', impactFull, 'Impact-Topic wählen…'),
                      ],
                      const SizedBox(height: 10),
                      _label('Breite (Spalten)'),
                      const SizedBox(height: 6),
                      _sizePicker(),
                    ]);
                  }),
                ],
                if (_w.type == 'CLOCK' || _w.type == 'COMPASS' || _w.type == 'SPACER') ...[
                  _label('Breite (Spalten)'),
                  const SizedBox(height: 6),
                  _sizePicker(),
                ],
              ]),
            ),
          ),
          // Footer
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFF30363D))),
            ),
            child: Row(children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF8B949E),
                    side: const BorderSide(color: Color(0xFF30363D)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Abbrechen'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1565C0),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: _commit,
                  child: const Text('Speichern'),
                ),
              ),
            ]),
          ),
        ]),
      ),
    );
  }

  Widget _sensorPicker() {
    final filtered = _search.isEmpty
        ? widget.sensors
        : widget.sensors.where((s) {
            final name = '${s['name'] ?? ''} ${s['base_name'] ?? ''}'.toLowerCase();
            return name.contains(_search.toLowerCase());
          }).toList();
    final showSearch = widget.sensors.length > 8;

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(children: [
        if (showSearch)
          Padding(
            padding: const EdgeInsets.all(8),
            child: GestureDetector(
              onTap: () => showKeyboard(context, _searchCtrl, label: 'Sensor suchen'),
              child: AbsorbPointer(
                child: TextField(
                  controller: _searchCtrl,
                  readOnly: true,
                  style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
                  decoration: InputDecoration(
                    isDense: true,
                    hintText: 'Suchen…',
                    hintStyle: const TextStyle(color: Color(0xFF8B949E)),
                    prefixIcon: const Icon(Icons.search, size: 16, color: Color(0xFF8B949E)),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                    filled: true,
                    fillColor: const Color(0xFF161B22),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(color: Color(0xFF30363D))),
                    enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(6),
                        borderSide: const BorderSide(color: Color(0xFF30363D))),
                  ),
                ),
              ),
            ),
          ),
        SizedBox(
          height: 180,
          child: ListView.builder(
            padding: EdgeInsets.zero,
            itemCount: filtered.length,
            itemBuilder: (_, i) {
              final s    = filtered[i];
              final path = s['base_name'] as String;
              final name = s['name'] as String? ?? path;
              final unit = s['unit'] as String? ?? '';
              final sel  = _w.sensor == path;
              return GestureDetector(
                onTap: () => setState(() => _w.sensor = path),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: sel ? const Color(0xFF1565C0).withValues(alpha: 0.2) : Colors.transparent,
                    border: Border(
                      left: BorderSide(
                        color: sel ? const Color(0xFF4FC3F7) : Colors.transparent,
                        width: 3,
                      ),
                    ),
                  ),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(name, style: TextStyle(
                          fontSize: 13,
                          color: sel ? const Color(0xFFE6EDF3) : const Color(0xFF8B949E),
                          fontWeight: sel ? FontWeight.w600 : FontWeight.normal)),
                      Text(unit.isNotEmpty ? '$path · $unit' : path,
                          style: const TextStyle(fontSize: 10, color: Color(0xFF8B949E))),
                    ])),
                    if (sel)
                      const Icon(Icons.check, size: 16, color: Color(0xFF4FC3F7)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }

  Widget _stylePicker(List<String> styles) {
    return Wrap(
      spacing: 6,
      runSpacing: 6,
      children: styles.map((s) {
        final sel = _w.style == s;
        return GestureDetector(
          onTap: () => setState(() => _w.style = sel ? null : s),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
            ),
            child: Text(s, style: TextStyle(
                fontSize: 13,
                color: sel ? Colors.white : const Color(0xFF8B949E),
                fontWeight: sel ? FontWeight.w600 : FontWeight.normal)),
          ),
        );
      }).toList(),
    );
  }

  Widget _decimalsPicker() {
    return Row(
      children: List.generate(4, (i) {
        final sel = _w.decimals == i;
        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: GestureDetector(
            onTap: () => setState(() => _w.decimals = sel ? null : i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
              ),
              child: Text('$i', style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600,
                  color: sel ? Colors.white : const Color(0xFF8B949E))),
            ),
          ),
        );
      }),
    );
  }

  Widget _sizePicker() {
    return Row(
      children: List.generate(4, (i) {
        final n = i + 1;
        final sel = _w.size == n;
        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: GestureDetector(
            onTap: () => setState(() => _w.size = n),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
              ),
              child: Text('$n', style: TextStyle(
                  fontSize: 14, fontWeight: FontWeight.w600,
                  color: sel ? Colors.white : const Color(0xFF8B949E))),
            ),
          ),
        );
      }),
    );
  }

  GaugeStyle _gaugeStyleOf(String? s) => switch (s) {
    'arc180' => GaugeStyle.arc180,
    'arc270' => GaugeStyle.arc270,
    'arc360' => GaugeStyle.arc360,
    'bar'    => GaugeStyle.bar,
    _        => GaugeStyle.arc270,
  };

  Widget _label(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));

  Widget _inputRow(String label, TextEditingController ctrl, {bool numeric = false}) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _label(label),
        const SizedBox(height: 5),
        GestureDetector(
          onTap: () => showKeyboard(context, ctrl, numeric: numeric, label: label),
          child: AbsorbPointer(
            child: SizedBox(
              height: 44,
              child: TextField(
                controller: ctrl,
                readOnly: true,
                style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
                decoration: InputDecoration(
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
                  filled: true,
                  fillColor: const Color(0xFF0D1117),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                      borderSide: const BorderSide(color: Color(0xFF30363D))),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                      borderSide: const BorderSide(color: Color(0xFF30363D))),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
                      borderSide: const BorderSide(color: Color(0xFF4FC3F7))),
                  suffixIcon: const Icon(Icons.edit_outlined, size: 14, color: Color(0xFF8B949E)),
                ),
              ),
            ),
          ),
        ),
      ]);
}

// ── Daten Section ────────────────────────────────────────────────────────────

class _DatenSection extends StatefulWidget {
  final SettingsService svc;
  const _DatenSection({required this.svc});
  @override
  State<_DatenSection> createState() => _DatenSectionState();
}

class _DatenSectionState extends State<_DatenSection> {
  static const _base = 'http://localhost:8000';
  String _exportText = '';
  bool _showExport = false;
  bool _resetting = false;

  void _toggleExport() {
    setState(() {
      _showExport = !_showExport;
      if (_showExport) {
        try {
          _exportText = const JsonEncoder.withIndent('  ').convert(widget.svc.raw);
        } catch (_) {
          _exportText = 'Fehler beim Exportieren';
        }
      }
    });
  }

  Future<void> _resetToDefaults() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        title: const Text('Auf Werkseinstellungen zurücksetzen?',
            style: TextStyle(color: Color(0xFFE6EDF3))),
        content: const Text(
            'Alle Einstellungen werden auf die Standardwerte zurückgesetzt. '
            'Dieser Vorgang kann nicht rückgängig gemacht werden.',
            style: TextStyle(color: Color(0xFF8B949E))),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Abbrechen', style: TextStyle(color: Color(0xFF8B949E)))),
          ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF7D1A1A)),
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Zurücksetzen')),
        ],
      ),
    );
    if (ok != true) return;
    setState(() => _resetting = true);
    try {
      await http.post(Uri.parse('$_base/api/settings/reset'));
      await widget.svc.load();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
          content: Text('Einstellungen zurückgesetzt'),
          duration: Duration(seconds: 2),
          backgroundColor: Color(0xFF1A472A),
        ));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Fehler: $e'),
          backgroundColor: const Color(0xFF7D1A1A),
        ));
      }
    }
    if (mounted) setState(() => _resetting = false);
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _h('Einstellungen exportieren'),
      const Text('Aktuelle Konfiguration als JSON anzeigen.',
          style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
      const SizedBox(height: 12),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFF4FC3F7),
            side: const BorderSide(color: Color(0xFF30363D)),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: Icon(_showExport ? Icons.visibility_off : Icons.visibility, size: 16),
          label: Text(_showExport ? 'Ausblenden' : 'JSON anzeigen'),
          onPressed: _toggleExport,
        ),
      ),
      if (_showExport) ...[
        const SizedBox(height: 12),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF0D1117),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Text(_exportText,
                style: const TextStyle(
                    fontSize: 11, color: Color(0xFF8B949E),
                    fontFamily: 'monospace', height: 1.5)),
          ),
        ),
      ],
      _h('Zurücksetzen'),
      const Text('Alle Einstellungen auf Standardwerte zurücksetzen.',
          style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
      const SizedBox(height: 12),
      SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          style: OutlinedButton.styleFrom(
            foregroundColor: const Color(0xFFEF5350),
            side: const BorderSide(color: Color(0xFF5C1A1A)),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
          icon: _resetting
              ? const SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFFEF5350)))
              : const Icon(Icons.restore, size: 16),
          label: Text(_resetting ? 'Setzt zurück…' : 'Auf Werkseinstellungen zurücksetzen'),
          onPressed: _resetting ? null : _resetToDefaults,
        ),
      ),
    ]);
  }

  Widget _h(String t) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 10),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(t, style: const TextStyle(
              fontSize: 11, fontWeight: FontWeight.w700,
              color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
          const SizedBox(height: 6),
          const Divider(color: Color(0xFF30363D), height: 1, thickness: 1),
        ]),
      );
}
