import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class Favorite {
  final String id;
  final String name;
  final double lat;
  final double lon;
  final String category;
  final String? notes;

  const Favorite({
    required this.id,
    required this.name,
    required this.lat,
    required this.lon,
    required this.category,
    this.notes,
  });

  factory Favorite.fromJson(Map<String, dynamic> j) => Favorite(
        id: j['id'] as String,
        name: j['name'] as String,
        lat: (j['lat'] as num).toDouble(),
        lon: (j['lon'] as num).toDouble(),
        category: (j['category'] as String?) ?? 'other',
        notes: j['notes'] as String?,
      );

  String get icon => categoryIcons[category] ?? '📍';
  String get categoryName => categoryNames[category] ?? 'Sonstiges';

  static const Map<String, String> categoryIcons = {
    'marina':     '⚓',
    'anchorage':  '🔱',
    'fuel':       '⛽',
    'lock':       '🚧',
    'bridge':     '🌉',
    'restaurant': '🍽️',
    'shop':       '🏪',
    'danger':     '⚠️',
    'other':      '📍',
  };

  static const Map<String, String> categoryNames = {
    'marina':     'Marina',
    'anchorage':  'Ankerplatz',
    'fuel':       'Tankstelle',
    'lock':       'Schleuse',
    'bridge':     'Brücke',
    'restaurant': 'Restaurant',
    'shop':       'Geschäft',
    'danger':     'Gefahrenstelle',
    'other':      'Sonstiges',
  };

  static const List<String> categories = [
    'marina', 'anchorage', 'fuel', 'lock', 'bridge',
    'restaurant', 'shop', 'danger', 'other',
  ];
}

class FavoritesService extends ChangeNotifier {
  static const _base = 'http://localhost:8000';

  List<Favorite> _favorites = [];
  bool _loading = false;

  List<Favorite> get favorites => List.unmodifiable(_favorites);
  bool get loading => _loading;

  Future<void> fetch() async {
    _loading = true;
    notifyListeners();
    try {
      final res = await http
          .get(Uri.parse('$_base/api/favorites'))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final data = json.decode(res.body) as Map<String, dynamic>;
        _favorites = (data['favorites'] as List)
            .map((e) => Favorite.fromJson(e as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}
    _loading = false;
    notifyListeners();
  }

  Future<bool> add({
    required String name,
    required double lat,
    required double lon,
    required String category,
    String? notes,
  }) async {
    try {
      final res = await http
          .post(
            Uri.parse('$_base/api/favorites'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'name': name,
              'lat': lat,
              'lon': lon,
              'category': category,
              if (notes != null && notes.isNotEmpty) 'notes': notes,
            }),
          )
          .timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        await fetch();
        return true;
      }
    } catch (_) {}
    return false;
  }

  Future<bool> delete(String id) async {
    try {
      final res = await http
          .delete(Uri.parse('$_base/api/favorites/$id'))
          .timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        _favorites.removeWhere((f) => f.id == id);
        notifyListeners();
        return true;
      }
    } catch (_) {}
    return false;
  }
}
