import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:web_socket_channel/web_socket_channel.dart';

class GpsData {
  final double lat;
  final double lon;
  final double speed;    // knots
  final double heading;  // degrees
  final int satellites;
  final bool hasFix;
  final double altitude; // metres
  final double? hdop;

  const GpsData({
    required this.lat,
    required this.lon,
    required this.speed,
    required this.heading,
    required this.satellites,
    required this.hasFix,
    required this.altitude,
    this.hdop,
  });

  factory GpsData.fromJson(Map<String, dynamic> json) {
    return GpsData(
      lat:        (json['lat']        ?? 51.855).toDouble(),
      lon:        (json['lon']        ?? 12.046).toDouble(),
      speed:      (json['speed']      ?? 0.0).toDouble(),
      heading:    (json['heading']    ?? 0.0).toDouble(),
      satellites: (json['satellites'] ?? 0) as int,
      hasFix:     json['fix'] == true,
      altitude:   (json['altitude']   ?? 0.0).toDouble(),
      hdop:       (json['hdop']       as num?)?.toDouble(),
    );
  }
}

class WebSocketService extends ChangeNotifier {
  static const String _wsUrl = 'ws://localhost:8000/ws';

  WebSocketChannel? _channel;
  GpsData? _gps;
  bool _connected = false;
  List<List<double>> _route = const []; // aktive Route [[lat, lon], ...]

  GpsData? get gps => _gps;
  bool get connected => _connected;
  List<List<double>> get route => _route; // vom Backend broadcastet (Deck ↔ Helm)

  void connect() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(_wsUrl));
      _connected = true;
      _channel!.stream.listen(
        _onMessage,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
      );
      _fetchInitialRoute(); // aktuelle Route beim (Re-)Connect nachladen
    } catch (_) {
      _scheduleReconnect();
    }
  }

  static List<List<double>> _parseCoords(dynamic raw) {
    final list = (raw as List?) ?? const [];
    return list
        .map<List<double>>((p) => [(p[0] as num).toDouble(), (p[1] as num).toDouble()])
        .toList();
  }

  void _fetchInitialRoute() {
    http.get(Uri.parse('http://localhost:8000/api/nav/route'))
        .timeout(const Duration(seconds: 5))
        .then((r) {
      _route = _parseCoords((json.decode(r.body))['coords']);
      notifyListeners();
    }).catchError((_) {});
  }

  void _onMessage(dynamic raw) {
    try {
      final data = json.decode(raw as String);
      // Backend sends type='gps_update' from gps_service.broadcast_gps_data()
      if ((data['type'] == 'gps_update' || data['type'] == 'gps') &&
          data['data'] != null) {
        _gps = GpsData.fromJson(data['data'] as Map<String, dynamic>);
        notifyListeners();
      } else if (data['type'] == 'route_update' && data['data'] != null) {
        _route = _parseCoords(data['data']['coords']);
        notifyListeners();
      }
    } catch (_) {}
  }

  void _scheduleReconnect() {
    _connected = false;
    notifyListeners();
    Future.delayed(const Duration(seconds: 5), connect);
  }

  @override
  void dispose() {
    _channel?.sink.close();
    super.dispose();
  }
}
