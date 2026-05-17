import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class SettingsService extends ChangeNotifier {
  static const String _base = 'http://localhost:8000';

  Map<String, dynamic> _s = {};
  Map<String, dynamic> _gpsDevice = {};
  bool loading = false;
  String? error;
  Timer? _pollTimer;

  Map<String, dynamic> get raw => _s;

  // GPS device config (separate endpoint)
  String get gpsPort => (_gpsDevice['device'] as String?) ?? '/dev/ttyUSB0';
  int get gpsBaud => (_gpsDevice['baudrate'] as int?) ?? 4800;

  double get uiScale => ((_s['ui'] as Map?)?['scale'] as num?)?.toDouble() ?? 0.85;

  int get screensaverTimeout =>
      (getNested('ui', 'screensaverTimeout') as num?)?.toInt() ?? 15;

  // 'nm' or 'km'
  String get distanceUnit =>
      (getNested('units', 'distance') as String?) ??
      (getNested('general', 'distanceUnit') as String?) ??
      'nm';

  // 'kn' or 'kmh'
  String get speedUnit =>
      (getNested('units', 'speed') as String?) ??
      (getNested('general', 'speedUnit') as String?) ??
      'kn';

  bool get isKm  => distanceUnit.toLowerCase() == 'km';
  bool get isKmh => speedUnit.toLowerCase().contains('km');

  void setUiScale(double v) {
    _s.putIfAbsent('ui', () => <String, dynamic>{});
    (_s['ui'] as Map<String, dynamic>)['scale'] = v;
    notifyListeners();
  }

  dynamic getNested(String section, String key) =>
      (_s[section] as Map<String, dynamic>?)?[key];

  void set(String section, String key, dynamic value) {
    _s.putIfAbsent(section, () => <String, dynamic>{});
    (_s[section] as Map<String, dynamic>)[key] = value;
    notifyListeners();
  }

  void setRaw(String key, dynamic value) {
    _s[key] = value;
    notifyListeners();
  }

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();

    // Retry until backend is ready — on slow boots the service may not be up yet.
    const maxAttempts = 10;
    const retryDelay = Duration(seconds: 3);
    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        final r1 = await http
            .get(Uri.parse('$_base/api/settings'))
            .timeout(const Duration(seconds: 5));
        if (r1.statusCode == 200) {
          _s = json.decode(r1.body) as Map<String, dynamic>;
          final r2 = await http
              .get(Uri.parse('$_base/api/gps/config'))
              .timeout(const Duration(seconds: 5));
          if (r2.statusCode == 200) {
            _gpsDevice = json.decode(r2.body) as Map<String, dynamic>;
          }
          error = null;
          _pollTimer ??= Timer.periodic(
            const Duration(seconds: 60),
            (_) => load(),
          );
          break; // success
        }
      } catch (_) {
        if (attempt < maxAttempts - 1) {
          await Future.delayed(retryDelay);
        }
      }
    }

    loading = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<bool> save() async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/settings'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(_s),
      );
      return r.statusCode == 200;
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return false;
    }
  }

  Future<bool> saveGpsConfig(String port, int baud) async {
    try {
      _gpsDevice = {'device': port, 'baudrate': baud};
      final r = await http.post(
        Uri.parse('$_base/api/gps/config'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(_gpsDevice),
      );
      notifyListeners();
      return r.statusCode == 200;
    } catch (e) {
      error = e.toString();
      notifyListeners();
      return false;
    }
  }
}
