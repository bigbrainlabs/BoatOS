import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class SettingsService extends ChangeNotifier {
  static const String _base = 'http://localhost:8000';

  Map<String, dynamic> _s = {};
  Map<String, dynamic> _gpsDevice = {};
  bool loading = false;
  String? error;

  Map<String, dynamic> get raw => _s;

  // GPS device config (separate endpoint)
  String get gpsPort => (_gpsDevice['device'] as String?) ?? '/dev/ttyUSB0';
  int get gpsBaud => (_gpsDevice['baudrate'] as int?) ?? 4800;

  double get uiScale => ((_s['ui'] as Map?)?['scale'] as num?)?.toDouble() ?? 0.85;

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

  Future<void> load() async {
    loading = true;
    error = null;
    notifyListeners();
    try {
      final r1 = await http.get(Uri.parse('$_base/api/settings'));
      if (r1.statusCode == 200) {
        _s = json.decode(r1.body) as Map<String, dynamic>;
      }
      final r2 = await http.get(Uri.parse('$_base/api/gps/config'));
      if (r2.statusCode == 200) _gpsDevice = json.decode(r2.body) as Map<String, dynamic>;
    } catch (e) {
      error = e.toString();
    }
    loading = false;
    notifyListeners();
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
