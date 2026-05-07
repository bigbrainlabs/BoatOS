import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

class GpsData {
  final double lat;
  final double lon;
  final double speed;
  final double heading;
  final int satellites;
  final bool hasFix;

  const GpsData({
    required this.lat,
    required this.lon,
    required this.speed,
    required this.heading,
    required this.satellites,
    required this.hasFix,
  });

  factory GpsData.fromJson(Map<String, dynamic> json) {
    return GpsData(
      lat: (json['lat'] ?? 51.855).toDouble(),
      lon: (json['lon'] ?? 12.046).toDouble(),
      speed: (json['speed'] ?? 0.0).toDouble(),
      heading: (json['heading'] ?? 0.0).toDouble(),
      satellites: (json['satellites'] ?? 0) as int,
      hasFix: json['fix'] == true,
    );
  }
}

class WebSocketService extends ChangeNotifier {
  static const String _wsUrl = 'ws://localhost:8000/ws';

  WebSocketChannel? _channel;
  GpsData? _gps;
  bool _connected = false;

  GpsData? get gps => _gps;
  bool get connected => _connected;

  void connect() {
    try {
      _channel = WebSocketChannel.connect(Uri.parse(_wsUrl));
      _connected = true;
      _channel!.stream.listen(
        _onMessage,
        onError: (_) => _scheduleReconnect(),
        onDone: _scheduleReconnect,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _onMessage(dynamic raw) {
    try {
      final data = json.decode(raw as String);
      if (data['type'] == 'gps' && data['data'] != null) {
        _gps = GpsData.fromJson(data['data'] as Map<String, dynamic>);
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
