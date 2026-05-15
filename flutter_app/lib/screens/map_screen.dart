import 'dart:async';
import 'dart:convert';
import 'dart:math' show pi, sqrt, sin, cos, atan2; // ignore: unused_shown_name — pi used in bearing/haversine math below
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:provider/provider.dart';
import 'package:vector_map_tiles/vector_map_tiles.dart';
import 'package:vector_tile_renderer/vector_tile_renderer.dart' hide TileLayer;

import '../services/logbook_service.dart';
import '../services/settings_service.dart';
import '../services/websocket_service.dart';
import '../widgets/route_planner.dart';
import 'settings_screen.dart';
import '../widgets/wifi_sheet.dart';
import '../widgets/gps_panel.dart';

// ---------------------------------------------------------------------------
// Data models
// ---------------------------------------------------------------------------

class _AisVessel {
  final int mmsi;
  final String name;
  final double lat, lon, sog, cog;
  final int heading, navstat, length;
  final String callsign, destination;

  const _AisVessel({
    required this.mmsi,
    required this.name,
    required this.lat,
    required this.lon,
    required this.sog,
    required this.cog,
    required this.heading,
    required this.navstat,
    required this.length,
    required this.callsign,
    required this.destination,
  });

  factory _AisVessel.fromJson(Map<String, dynamic> j) => _AisVessel(
        mmsi: int.tryParse(j['mmsi']?.toString() ?? '') ?? (j['mmsi'] as num?)?.toInt() ?? 0,
        name: (j['name'] ?? '') as String,
        lat: (j['lat'] as num?)?.toDouble() ?? 0.0,
        lon: (j['lon'] as num?)?.toDouble() ?? 0.0,
        sog: (j['sog'] as num?)?.toDouble() ?? 0.0,
        cog: (j['cog'] as num?)?.toDouble() ?? 0.0,
        heading: (j['heading'] as num?)?.toInt() ?? 511,
        navstat: (j['navstat'] as num?)?.toInt() ?? 15,
        length: (j['length'] as num?)?.toInt() ?? 0,
        callsign: (j['callsign'] ?? '') as String,
        destination: (j['destination'] ?? '') as String,
      );
}

class _InfraPoi {
  final int id;
  final String type, name;
  final double lat, lon;
  final Map<String, dynamic> properties;

  const _InfraPoi({
    required this.id,
    required this.type,
    required this.name,
    required this.lat,
    required this.lon,
    required this.properties,
  });

  // ignore: unused_element
  factory _InfraPoi.fromJson(Map<String, dynamic> j) => _InfraPoi(
        id: (j['id'] ?? 0) as int,
        type: (j['type'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        lat: (j['lat'] ?? 0.0).toDouble(),
        lon: (j['lon'] ?? 0.0).toDouble(),
        properties: (j['properties'] as Map<String, dynamic>?) ?? {},
      );
}

class _PegelGauge {
  final String id, name, water;
  final double lat, lon, waterLevelM;
  final int waterLevelCm;

  const _PegelGauge({
    required this.id,
    required this.name,
    required this.water,
    required this.lat,
    required this.lon,
    required this.waterLevelM,
    required this.waterLevelCm,
  });

  factory _PegelGauge.fromJson(Map<String, dynamic> j) => _PegelGauge(
        id: (j['id'] ?? '') as String,
        name: (j['name'] ?? '') as String,
        water: (j['water'] ?? '') as String,
        lat: (j['lat'] as num?)?.toDouble() ?? 0.0,
        lon: (j['lon'] as num?)?.toDouble() ?? 0.0,
        waterLevelM: (j['water_level_m'] as num?)?.toDouble() ?? 0.0,
        waterLevelCm: (j['water_level_cm'] as num?)?.toInt() ?? 0,
      );
}

// ---------------------------------------------------------------------------
// AIS triangle painter
// ---------------------------------------------------------------------------

class _AisTrianglePainter extends CustomPainter {
  final Color color;
  const _AisTrianglePainter(this.color);

  @override
  void paint(ui.Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final path = ui.Path()
      ..moveTo(w / 2, 0)
      ..lineTo(w, h)
      ..lineTo(w / 2, h * 0.7)
      ..lineTo(0, h)
      ..close();

    canvas.drawPath(path, Paint()..color = color);
    canvas.drawPath(
      path,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );
  }

  @override
  bool shouldRepaint(_AisTrianglePainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final MapController _mapController = MapController();
  bool _autoFollow = true;
  Style? _mapStyle;
  String? _styleError;

  // Layer toggles
  bool _showSeamarks = true;
  bool _showAIS = true;
  bool _showLocks = true;
  bool _showPegel = false;
  bool _showTrack = true;
  bool _satelliteMode = false;

  // Layer data
  final List<LatLng> _trackPoints = [];
  List<_AisVessel> _aisVessels = [];
  List<_InfraPoi> _infraPois = [];
  List<_PegelGauge> _pegelGauges = [];

  // Polling / throttle
  Timer? _aisTimer;
  Timer? _infraTimer;
  DateTime? _lastInfraFetch;
  DateTime? _lastPegelFetch;

  // Stream subscription for map events (must be cancelled in dispose)
  StreamSubscription<MapEvent>? _mapEventSub;

  // Selected items for detail panels
  _AisVessel? _selectedVessel;
  _InfraPoi? _selectedPoi;

  // Last known GPS position for viewport queries
  LatLng _lastBoatPos = const LatLng(51.855, 12.046);

  static const LatLng _defaultPos = LatLng(51.855, 12.046);
  static const String _tileUrl = 'http://localhost:8081/germany/{z}/{x}/{y}';
  static const String _apiBase = 'http://localhost:8000';

  // ── Routing ──────────────────────────────────────────────────────────────
  bool _routeMode = false;
  List<RouteWaypoint> _waypoints = [];
  RouteResult? _routeResult;
  bool _routeLoading = false;

  // ── Navigation ───────────────────────────────────────────────────────────
  bool _navActive = false;
  int _navNextWpIdx = 0;
  double _navDistToNextNm = 0;
  double _navBearing = 0;

  // ── GPS smoothing & animation ─────────────────────────────────────────────
  LatLng? _lastGpsRaw;
  LatLng _emaBoatPos  = _defaultPos;
  LatLng _animBoatPos = _defaultPos;
  Timer? _boatAnimTimer;
  static const double _emaAlpha  = 0.35;
  static const double _lerpAlpha = 0.055; // ~4s ease-out at 60ms interval

  // ── Simulation ───────────────────────────────────────────────────────────
  bool _simRunning = false;
  double _simSpeed = 25;
  int _simSegIdx = 0;
  double _simSegFraction = 0.0;
  LatLng? _simSavedPos;
  Timer? _simTimer;

  // ── Saved routes ─────────────────────────────────────────────────────────
  bool _showSavedRoutes = false;
  bool _savedRoutesLoading = false;
  List<SavedRoute> _savedRoutes = [];

  // ── Departure ────────────────────────────────────────────────────────────
  DateTime _departure = DateTime.now();

  // ── Save dialog ──────────────────────────────────────────────────────────
  bool _showSaveDialog = false;

  // ── Waypoint delete confirmation ──────────────────────────────────────────
  RouteWaypoint? _confirmDeleteWp;

  // ── Waypoint drag ─────────────────────────────────────────────────────────
  final GlobalKey _mapKey = GlobalKey();
  RouteWaypoint? _draggingWp;
  LatLng? _draggingLatLng;

  @override
  void initState() {
    super.initState();
    _boatAnimTimer = Timer.periodic(const Duration(milliseconds: 60), _boatAnimTick);
    _buildStyle();
    _loadSettings();
  }

  @override
  void dispose() {
    _aisTimer?.cancel();
    _infraTimer?.cancel();
    _mapEventSub?.cancel();
    _simTimer?.cancel();
    _boatAnimTimer?.cancel();
    super.dispose();
  }

  void _boatAnimTick(Timer _) {
    if (!mounted || _simRunning) return;
    final dLat = _emaBoatPos.latitude  - _animBoatPos.latitude;
    final dLon = _emaBoatPos.longitude - _animBoatPos.longitude;
    if (dLat.abs() < 1e-9 && dLon.abs() < 1e-9) return;
    final next = LatLng(
      _animBoatPos.latitude  + dLat * _lerpAlpha,
      _animBoatPos.longitude + dLon * _lerpAlpha,
    );
    setState(() => _animBoatPos = next);
    if (_autoFollow) _mapController.move(next, _mapController.camera.zoom);
  }

  // -------------------------------------------------------------------------
  // Map ready — initial data fetch with real viewport bounds
  // -------------------------------------------------------------------------

  void _onMapReady() {
    _mapEventSub = _mapController.mapEventStream.listen((event) {
      if (event is MapEventMoveEnd || event is MapEventScrollWheelZoom) {
        _refreshViewportLayers();
      }
    });

    // Initial fetch: delay slightly so the camera bounds are stable.
    Future.delayed(const Duration(milliseconds: 800), () {
      if (!mounted) return;
      if (_showAIS) _fetchAIS();
      if (_showLocks) _fetchInfra();
      if (_showPegel) _fetchPegel();
    });

    // Periodic refresh for locks and pegel (every 60s).
    _infraTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (_showLocks) _fetchInfra();
      if (_showPegel) _fetchPegel();
    });
  }

  // -------------------------------------------------------------------------
  // Style
  // -------------------------------------------------------------------------

  void _buildStyle() {
    try {
      final theme = ThemeReader().read(_v1Style());
      final providers = TileProviders({
        'openmaptiles': NetworkVectorTileProvider(
          urlTemplate: _tileUrl,
          maximumZoom: 14,
          minimumZoom: 0,
        ),
      });
      setState(() {
        _mapStyle = Style(theme: theme, providers: providers);
        _styleError = null;
      });
    } catch (e) {
      setState(() => _styleError = e.toString());
      debugPrint('Style error: $e');
    }
  }

  // -------------------------------------------------------------------------
  // Settings
  // -------------------------------------------------------------------------

  Future<void> _loadSettings() async {
    try {
      final resp = await http
          .get(Uri.parse('$_apiBase/api/settings'))
          .timeout(const Duration(seconds: 5));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final ais = data['ais'] as Map<String, dynamic>? ?? {};
        final map = data['map'] as Map<String, dynamic>? ?? {};
        final intervalSec = (ais['updateInterval'] ?? 60) as int;
        setState(() {
          _showAIS = ais['enabled'] == true;
          _showSeamarks = map['openSeaMap'] != false;
          _showLocks = map['showLocks'] != false;
          _showPegel = map['showPegel'] == true;
          _showTrack = map['showTrack'] != false;
        });
        _startAisTimer(intervalSec);
      }
    } catch (e) {
      debugPrint('Settings load error: $e');
      // Use defaults; still start AIS polling
      _startAisTimer(60);
    }
  }

  // -------------------------------------------------------------------------
  // AIS
  // -------------------------------------------------------------------------

  void _startAisTimer(int intervalSec) {
    _aisTimer?.cancel();
    _aisTimer = null;
    if (_showAIS) {
      _aisTimer = Timer.periodic(Duration(seconds: intervalSec), (_) {
        if (_showAIS) _fetchAIS();
      });
      // Don't fetch here — _onMapReady() triggers the first fetch with real
      // viewport bounds. If the map is already ready (e.g. settings reload),
      // also trigger immediately.
      _fetchAIS();
    }
  }

  Future<void> _fetchAIS() async {
    if (!_showAIS) return;
    final bounds = _currentBounds();
    try {
      final uri =
          Uri.parse('$_apiBase/api/ais/vessels').replace(queryParameters: {
        'lat_min': bounds[0].toString(),
        'lon_min': bounds[1].toString(),
        'lat_max': bounds[2].toString(),
        'lon_max': bounds[3].toString(),
      });
      final resp = await http.get(uri).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final list = (data['vessels'] as List<dynamic>? ?? [])
            .map((e) => _AisVessel.fromJson(e as Map<String, dynamic>))
            .toList();
        if (mounted) setState(() => _aisVessels = list);
      } else {
        debugPrint('AIS fetch failed: HTTP ${resp.statusCode}');
      }
    } catch (e) {
      debugPrint('AIS fetch error: $e');
    }
  }

  // -------------------------------------------------------------------------
  // Infrastructure POIs
  // -------------------------------------------------------------------------

  Future<void> _fetchInfra() async {
    if (!_showLocks) return;
    // Use a wide fixed area (±1.5°) centred on boat position for locks —
    // lock density is low and they don't change, so covering a large area
    // is cheap and avoids missing locks when the viewport is zoomed in tight.
    final lat = _lastBoatPos.latitude;
    final lon = _lastBoatPos.longitude;
    const d = 1.5;
    try {
      final uri =
          Uri.parse('$_apiBase/api/locks/bounds').replace(queryParameters: {
        'lat_min': (lat - d).toString(),
        'lon_min': (lon - d).toString(),
        'lat_max': (lat + d).toString(),
        'lon_max': (lon + d).toString(),
      });
      debugPrint('Locks query: lat ${lat - d}..${lat + d} lon ${lon - d}..${lon + d}');
      final resp = await http.get(uri).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final list = (data['locks'] as List<dynamic>? ?? [])
            .map((e) {
              final m = e as Map<String, dynamic>;
              return _InfraPoi(
                id: (m['id'] as num?)?.toInt() ?? 0,
                type: 'lock',
                name: (m['name'] ?? '') as String,
                lat: (m['lat'] as num?)?.toDouble() ?? 0.0,
                lon: (m['lon'] as num?)?.toDouble() ?? 0.0,
                properties: {
                  'waterway':      m['waterway'],
                  'river_km':      m['river_km'],
                  'phone':         m['phone'],
                  'vhf_channel':   m['vhf_channel'],
                  'email':         m['email'],
                  'website':       m['website'],
                  'opening_hours': m['opening_hours'],
                  'max_length':    m['max_length'],
                  'max_width':     m['max_width'],
                  'max_draft':     m['max_draft'],
                  'max_height':    m['max_height'],
                  'avg_duration':  m['avg_duration'],
                  'notes':         m['notes'],
                },
              );
            })
            .toList();
        if (mounted) setState(() => _infraPois = list);
        debugPrint('Locks fetched: ${list.length}');
      } else {
        debugPrint('Locks fetch failed: HTTP ${resp.statusCode}');
      }
    } catch (e) {
      debugPrint('Locks fetch error: $e');
    }
  }

  // -------------------------------------------------------------------------
  // Pegel / gauges
  // -------------------------------------------------------------------------

  Future<void> _fetchPegel() async {
    if (!_showPegel) return;
    final bounds = _currentBounds();
    try {
      final uri =
          Uri.parse('$_apiBase/api/gauges').replace(queryParameters: {
        'lat_min': bounds[0].toString(),
        'lon_min': bounds[1].toString(),
        'lat_max': bounds[2].toString(),
        'lon_max': bounds[3].toString(),
      });
      final resp = await http.get(uri).timeout(const Duration(seconds: 8));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final list = (data['gauges'] as List<dynamic>? ?? [])
            .map((e) => _PegelGauge.fromJson(e as Map<String, dynamic>))
            .toList();
        if (mounted) setState(() => _pegelGauges = list);
      } else {
        debugPrint('Pegel fetch failed: HTTP ${resp.statusCode}');
      }
    } catch (e) {
      debugPrint('Pegel fetch error: $e');
    }
  }

  // -------------------------------------------------------------------------
  // Viewport refresh (throttled, called on map move/zoom end)
  // -------------------------------------------------------------------------

  void _refreshViewportLayers() {
    final now = DateTime.now();

    if (_showLocks) {
      if (_lastInfraFetch == null ||
          now.difference(_lastInfraFetch!) > const Duration(seconds: 2)) {
        _lastInfraFetch = now;
        _fetchInfra();
      }
    }

    if (_showPegel) {
      if (_lastPegelFetch == null ||
          now.difference(_lastPegelFetch!) > const Duration(seconds: 5)) {
        _lastPegelFetch = now;
        _fetchPegel();
      }
    }

    // AIS is always refreshed on move so vessels reflect current viewport.
    if (_showAIS) _fetchAIS();
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /// Returns [latMin, lonMin, latMax, lonMax], expanded by [factor] beyond the
  /// visible viewport so markers just off-screen are still fetched.
  List<double> _currentBounds({double factor = 2.0}) {
    try {
      final b = _mapController.camera.visibleBounds;
      final dLat = (b.north - b.south) * (factor - 1) / 2;
      final dLon = (b.east  - b.west)  * (factor - 1) / 2;
      return [b.south - dLat, b.west - dLon, b.north + dLat, b.east + dLon];
    } catch (_) {
      return [
        _lastBoatPos.latitude  - 0.5,
        _lastBoatPos.longitude - 0.5,
        _lastBoatPos.latitude  + 0.5,
        _lastBoatPos.longitude + 0.5,
      ];
    }
  }

  // -------------------------------------------------------------------------
  // Haversine distance in NM
  // -------------------------------------------------------------------------

  double _distNm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371000.0; // metres
    final dLat = (lat2 - lat1) * pi / 180;
    final dLon = (lon2 - lon1) * pi / 180;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180) *
            cos(lat2 * pi / 180) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return (r * c) / 1852.0;
  }

  double _bearingDeg(double lat1, double lon1, double lat2, double lon2) {
    final dLon = (lon2 - lon1) * pi / 180;
    final y = sin(dLon) * cos(lat2 * pi / 180);
    final x = cos(lat1 * pi / 180) * sin(lat2 * pi / 180) -
        sin(lat1 * pi / 180) * cos(lat2 * pi / 180) * cos(dLon);
    return (atan2(y, x) * 180 / pi + 360) % 360;
  }

  // -------------------------------------------------------------------------
  // AIS colors
  // -------------------------------------------------------------------------

  Color _aisColor(int navstat) => switch (navstat) {
        0 => const Color(0xFF3498DB),
        1 => const Color(0xFF2ECC71),
        5 => const Color(0xFF2ECC71),
        6 => const Color(0xFFE74C3C),
        7 => const Color(0xFF9B59B6),
        8 => const Color(0xFF1ABC9C),
        _ => const Color(0xFF95A5A6),
      };

  String _navstatText(int ns) => switch (ns) {
        0 => 'Unter Maschine',
        1 => 'Geankert',
        2 => 'Nicht manövrierfähig',
        3 => 'Eingeschränkt manövrierfähig',
        5 => 'Festgemacht',
        6 => 'Auf Grund',
        7 => 'Fischerei',
        8 => 'Under sail',
        _ => 'Unbekannt',
      };

  // -------------------------------------------------------------------------
  // Marker widgets
  // -------------------------------------------------------------------------

  Widget _buildAisMarker(_AisVessel v) {
    final color = _aisColor(v.navstat);
    final sz = v.length > 100 ? 24.0 : 16.0;
    final angle =
        (v.heading > 0 && v.heading < 511 ? v.heading.toDouble() : v.cog) *
            pi /
            180;
    return GestureDetector(
      onTap: () => setState(() {
        _selectedVessel = v;
        _selectedPoi = null;
      }),
      child: Transform.rotate(
        angle: angle,
        child: CustomPaint(
          size: Size(sz, sz),
          painter: _AisTrianglePainter(color),
        ),
      ),
    );
  }

  Widget _buildPoiMarker(_InfraPoi poi) {
    final (icon, color) = switch (poi.type) {
      'lock'   => (Icons.lock,         const Color(0xFF1565C0)),
      'bridge' => (Icons.architecture, const Color(0xFF3498DB)),
      'harbor' => (Icons.anchor,       const Color(0xFF2ECC71)),
      'weir'   => (Icons.water,        const Color(0xFF9B59B6)),
      _        => (Icons.place,        const Color(0xFF95A5A6)),
    };
    return GestureDetector(
      onTap: () => setState(() {
        _selectedPoi = poi;
        _selectedVessel = null;
      }),
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(6),
        ),
        child: Icon(icon, color: Colors.white, size: 18),
      ),
    );
  }

  Widget _buildPegelMarker(_PegelGauge g) => Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
          decoration: BoxDecoration(
            color: const Color(0xEE0A0E1A),
            borderRadius: BorderRadius.circular(5),
            border: Border.all(color: const Color(0xFF3498DB), width: 0.5),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Text(
                g.name.length > 10 ? g.name.substring(0, 10) : g.name,
                style: const TextStyle(fontSize: 8, color: Color(0xFF8B949E)),
                textAlign: TextAlign.center,
              ),
              Text(
                '${g.waterLevelCm} cm',
                style: const TextStyle(
                  fontSize: 10,
                  color: Color(0xFF64FFDA),
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );

  // -------------------------------------------------------------------------
  // Layer toggle button
  // -------------------------------------------------------------------------

  Widget _layerBtn(
      IconData icon, String label, bool active, ValueChanged<bool> onChanged,
      {double scale = 1.0}) {
    final sz = 36.0 * scale;
    return Padding(
      padding: EdgeInsets.only(bottom: 6 * scale),
      child: Tooltip(
        message: label,
        child: GestureDetector(
          onTap: () => onChanged(!active),
          child: Container(
            width: sz,
            height: sz,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active
                  ? const Color(0xFF1565C0)
                  : const Color(0xFF161B22),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Icon(icon, size: 18 * scale, color: Colors.white),
          ),
        ),
      ),
    );
  }

  // =========================================================================
  // Route planner logic
  // =========================================================================

  void _addWaypoint(LatLng pos) {
    setState(() {
      _waypoints = [
        ..._waypoints,
        RouteWaypoint(
          index: _waypoints.length,
          lat: pos.latitude,
          lon: pos.longitude,
        ),
      ];
    });
    if (_waypoints.length >= 2) _calculateRoute();
  }

  void _updateWaypointPosition(RouteWaypoint wp, LatLng newPos) {
    setState(() {
      _waypoints = _waypoints
          .map((w) => w.index == wp.index
              ? RouteWaypoint(index: w.index, lat: newPos.latitude, lon: newPos.longitude, name: w.name)
              : w)
          .toList();
    });
    if (_waypoints.length >= 2) _calculateRoute();
  }

  void _removeWaypoint(RouteWaypoint wp) {
    if (_navActive) return;
    setState(() {
      final updated = _waypoints
          .where((w) => w.index != wp.index)
          .toList();
      // Re-index
      _waypoints = updated
          .asMap()
          .entries
          .map((e) => e.value.copyWith(index: e.key))
          .toList();
      if (_waypoints.length < 2) _routeResult = null;
    });
    if (_waypoints.length >= 2) _calculateRoute();
  }

  Future<void> _calculateRoute() async {
    if (_waypoints.length < 2) return;
    setState(() => _routeLoading = true);
    try {
      final wps = _waypoints.map((w) => [w.lon, w.lat]).toList();
      final resp = await http
          .post(
            Uri.parse('$_apiBase/api/route'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({'waypoints': wps}),
          )
          .timeout(const Duration(seconds: 30));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final geom = data['geometry'] as Map<String, dynamic>;
        final props = data['properties'] as Map<String, dynamic>;
        final coords = (geom['coordinates'] as List)
            .map((c) => LatLng(
                  (c[1] as num).toDouble(),
                  (c[0] as num).toDouble(),
                ))
            .toList();
        final dh = ((props['duration_adjusted_h'] ?? props['duration_h']) as num?)
                ?.toDouble() ??
            0.0;
        final locks = (props['locks_from_db'] as List<dynamic>? ?? [])
            .map((e) => e as Map<String, dynamic>)
            .toList();
        if (mounted) {
          setState(() {
            _routeResult = RouteResult(
              coords: coords,
              distanceNm:
                  (props['distance_nm'] as num?)?.toDouble() ?? 0.0,
              durationH: dh,
              routingType:
                  (props['routing_type'] ?? 'direct') as String,
              locks: locks,
            );
          });
        }
      } else {
        debugPrint('Route failed: HTTP ${resp.statusCode}');
      }
    } catch (e) {
      debugPrint('Route error: $e');
    } finally {
      if (mounted) setState(() => _routeLoading = false);
    }
  }

  // ── Navigation ─────────────────────────────────────────────────────────

  void _startNavigation() {
    if (_routeResult == null || _waypoints.isEmpty) return;
    setState(() {
      _navActive = true;
      _navNextWpIdx = 0;
      _autoFollow = true;
    });
    _updateNavigation(_lastBoatPos.latitude, _lastBoatPos.longitude);
  }

  void _stopNavigation() {
    setState(() {
      _navActive = false;
      _navNextWpIdx = 0;
      _navDistToNextNm = 0;
      _navBearing = 0;
    });
  }

  void _updateNavigation(double lat, double lon) {
    if (!_navActive || _waypoints.isEmpty) return;
    if (_navNextWpIdx >= _waypoints.length) {
      _stopNavigation();
      return;
    }
    final wp = _waypoints[_navNextWpIdx];
    final dist = _distNm(lat, lon, wp.lat, wp.lon);
    final bearing = _bearingDeg(lat, lon, wp.lat, wp.lon);

    if (dist < 0.05) {
      // Arrived — advance to next waypoint
      if (_navNextWpIdx + 1 < _waypoints.length) {
        setState(() {
          _navNextWpIdx++;
          _navDistToNextNm = 0;
          _navBearing = 0;
        });
      } else {
        _stopNavigation();
        return;
      }
    } else {
      setState(() {
        _navDistToNextNm = dist;
        _navBearing = bearing;
      });
    }
  }

  // ── Simulation ──────────────────────────────────────────────────────────

  void _startSimulation() {
    if (_routeResult == null || _routeResult!.coords.isEmpty) return;
    setState(() {
      _simSavedPos = _lastBoatPos;
      _simRunning = true;
      _simSegIdx = 0;
      _simSegFraction = 0.0;
    });
    _simTimer = Timer.periodic(const Duration(milliseconds: 100), _simTick);
  }

  void _stopSimulation() {
    _simTimer?.cancel();
    _simTimer = null;
    setState(() {
      _simRunning = false;
      if (_simSavedPos != null) {
        _lastBoatPos = _simSavedPos!;
        _emaBoatPos  = _simSavedPos!;
        _animBoatPos = _simSavedPos!;
      }
      _simSavedPos = null;
    });
  }

  void _simTick(Timer t) {
    if (!_simRunning || _routeResult == null) return;
    final coords = _routeResult!.coords;
    if (coords.length < 2) return;

    // step in metres per 100ms tick
    // formula: multiplier × 10m × 1.852 / 36000  →  ×1 ≈ 0.28 m/tick (≈1 kn)
    double stepM = _simSpeed * 10 * 1852 / 36000;

    int segIdx = _simSegIdx;
    double frac = _simSegFraction;

    while (stepM > 0 && segIdx < coords.length - 1) {
      final from = coords[segIdx];
      final to   = coords[segIdx + 1];
      final segLenM = _distNm(
              from.latitude, from.longitude, to.latitude, to.longitude) *
          1852.0;
      if (segLenM < 0.001) {
        segIdx++;
        frac = 0.0;
        continue;
      }
      final remaining = segLenM * (1.0 - frac);
      if (stepM >= remaining) {
        stepM -= remaining;
        segIdx++;
        frac = 0.0;
      } else {
        frac += stepM / segLenM;
        stepM = 0;
      }
    }

    if (segIdx >= coords.length - 1) {
      // Reached end of route
      _stopSimulation();
      return;
    }

    final from = coords[segIdx];
    final to   = coords[segIdx + 1];
    final simPos = LatLng(
      from.latitude  + (to.latitude  - from.latitude)  * frac,
      from.longitude + (to.longitude - from.longitude) * frac,
    );

    setState(() {
      _simSegIdx = segIdx;
      _simSegFraction = frac;
      _lastBoatPos = simPos;
    });

    if (_navActive) {
      _updateNavigation(simPos.latitude, simPos.longitude);
    }
    if (_autoFollow) {
      _mapController.move(simPos, _mapController.camera.zoom);
    }
  }

  // ── Saved routes ────────────────────────────────────────────────────────

  Future<void> _loadSavedRoutes() async {
    setState(() {
      _showSavedRoutes = true;
      _savedRoutesLoading = true;
    });
    try {
      final resp = await http
          .get(Uri.parse('$_apiBase/api/saved-routes'))
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final list = (data['routes'] as List<dynamic>? ?? [])
            .map((e) => SavedRoute.fromJson(e as Map<String, dynamic>))
            .toList();
        if (mounted) setState(() => _savedRoutes = list);
      }
    } catch (e) {
      debugPrint('Saved routes load error: $e');
    } finally {
      if (mounted) setState(() => _savedRoutesLoading = false);
    }
  }

  Future<void> _deleteSavedRoute(String id) async {
    try {
      await http
          .delete(Uri.parse('$_apiBase/api/saved-routes/$id'))
          .timeout(const Duration(seconds: 8));
      if (mounted) {
        setState(() => _savedRoutes.removeWhere((r) => r.id == id));
      }
    } catch (e) {
      debugPrint('Delete route error: $e');
    }
  }

  void _loadSavedRouteIntoPlanner(SavedRoute sr) {
    _stopNavigation();
    _stopSimulation();
    setState(() {
      _showSavedRoutes = false;
      _waypoints = sr.waypoints;
      _routeResult = null;
    });
    if (_waypoints.length >= 2) _calculateRoute();
  }

  void _saveRoute(String name) async {
    if (_waypoints.isEmpty) return;
    final wps = _waypoints.map((w) => {
      'lat': w.lat,
      'lon': w.lon,
      if (w.name.isNotEmpty) 'name': w.name,
    }).toList();
    try {
      final body = json.encode({
        'name': name,
        'waypoints': wps,
        'totalDistanceNM': _routeResult?.distanceNm ?? 0.0,
      });
      final resp = await http
          .post(
            Uri.parse('$_apiBase/api/saved-routes'),
            headers: {'Content-Type': 'application/json'},
            body: body,
          )
          .timeout(const Duration(seconds: 10));
      if (resp.statusCode == 200) {
        debugPrint('Route saved OK');
      } else {
        debugPrint('Save route failed: HTTP ${resp.statusCode}');
      }
    } catch (e) {
      debugPrint('Save route error: $e');
    }
  }

  // ── Clear all ────────────────────────────────────────────────────────────

  void _clearRoute() {
    _stopNavigation();
    _stopSimulation();
    setState(() {
      _waypoints = [];
      _routeResult = null;
      _routeMode = false;
    });
  }

  // =========================================================================
  // Build
  // =========================================================================

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<WebSocketService>();
    final settings = context.watch<SettingsService>();
    final (tripTrack, tripLabel) = context.select<LogbookService, (List<LatLng>?, String?)>(
        (s) => (s.tripDisplayTrack, s.tripDisplayLabel));
    final scale = settings.uiScale;
    final distanceUnit = settings.distanceUnit;
    double sc(double v) => v * scale;
    final gps = ws.gps;

    // Apply EMA filter when GPS position changes; animation timer drives the display.
    if (gps != null && !_simRunning) {
      final raw = LatLng(gps.lat, gps.lon);
      if (_lastGpsRaw == null ||
          (_lastGpsRaw!.latitude  - raw.latitude ).abs() > 1e-9 ||
          (_lastGpsRaw!.longitude - raw.longitude).abs() > 1e-9) {
        _lastGpsRaw  = raw;
        _lastBoatPos = raw; // raw for track recording
        _emaBoatPos  = LatLng(
          _emaAlpha * raw.latitude  + (1 - _emaAlpha) * _emaBoatPos.latitude,
          _emaAlpha * raw.longitude + (1 - _emaAlpha) * _emaBoatPos.longitude,
        );
        if (_navActive) _updateNavigation(gps.lat, gps.lon);
      }
    }

    final boatPos = _simRunning ? _lastBoatPos : _animBoatPos;

    // ETA for status bar
    String? etaStatusStr;
    if (_routeResult != null) {
      final eta = _departure.add(Duration(
        hours: _routeResult!.durationH.truncate(),
        minutes: ((_routeResult!.durationH % 1) * 60).round(),
      ));
      final now = DateTime.now();
      final isToday = eta.day == now.day &&
          eta.month == now.month &&
          eta.year == now.year;
      final hh = eta.hour.toString().padLeft(2, '0');
      final mm = eta.minute.toString().padLeft(2, '0');
      etaStatusStr = isToday
          ? '$hh:$mm'
          : '${eta.day}.${eta.month} $hh:$mm';
    }

    // Track recording
    if (gps != null && _showTrack) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        final pos = LatLng(gps.lat, gps.lon);
        if (_trackPoints.isEmpty || _trackPoints.last != pos) {
          setState(() {
            _trackPoints.add(pos);
            if (_trackPoints.length > 500) _trackPoints.removeAt(0);
          });
        }
      });
    }

    return Stack(
      children: [
        // ----------------------------------------------------------------
        // Map
        // ----------------------------------------------------------------
        FlutterMap(
          key: _mapKey,
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _defaultPos,
            initialZoom: 13,
            backgroundColor: const Color(0xFFE0E0E0),
            interactionOptions: InteractionOptions(
              flags: _draggingWp != null
                  ? InteractiveFlag.none
                  : InteractiveFlag.all & ~InteractiveFlag.rotate,
            ),
            onMapReady: _onMapReady,
            onLongPress: (tapPos, latLng) {
              if (_routeMode && !_navActive) {
                _addWaypoint(latLng);
              }
            },
            onMapEvent: (event) {
              if (event is MapEventMoveStart &&
                  event.source != MapEventSource.mapController) {
                setState(() => _autoFollow = false);
              }
            },
          ),
          children: [
            // 1. Vector base layer (hidden when satellite mode is active)
            if (!_satelliteMode && _mapStyle != null)
              VectorTileLayer(
                tileProviders: _mapStyle!.providers,
                theme: _mapStyle!.theme,
                layerMode: VectorTileLayerMode.raster,
              )
            else if (!_satelliteMode && _styleError != null)
              ColoredBox(
                color: const Color(0xFFE0E0E0),
                child: Center(
                  child: Text(_styleError!,
                      style:
                          const TextStyle(color: Colors.red, fontSize: 12)),
                ),
              )
            else if (!_satelliteMode)
              const ColoredBox(color: Color(0xFFE0E0E0)),

            // 1b. ESRI Satellite imagery (only when satellite mode active)
            if (_satelliteMode)
              TileLayer(
                urlTemplate:
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                userAgentPackageName: 'de.boatos.ui',
                tileDimension: 256,
              ),

            // 2. OpenSeaMap seamark overlay
            if (_showSeamarks)
              TileLayer(
                urlTemplate:
                    'https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png',
                userAgentPackageName: 'de.boatos.ui',
                tileDimension: 256,
              ),

            // 3. Track polyline
            if (_showTrack && _trackPoints.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: List<LatLng>.from(_trackPoints),
                    color: const Color(0xFF4CAF50),
                    strokeWidth: 3,
                  ),
                ],
              ),

            // 4. Archived trip track (from logbook)
            if (tripTrack != null && tripTrack.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: tripTrack,
                    color: const Color(0xFFFF9800),
                    strokeWidth: 3.5,
                  ),
                ],
              ),

            // 5. Route polyline
            if (_routeResult != null && _routeResult!.coords.length >= 2)
              PolylineLayer(
                polylines: [
                  Polyline(
                    points: _routeResult!.coords,
                    color: _routeResult!.routingType == 'osrm'
                        ? const Color(0xFF2ECC71)
                        : const Color(0xFF3498DB),
                    strokeWidth: 4,
                  ),
                ],
              ),

            // 5. Pegel markers
            if (_showPegel && _pegelGauges.isNotEmpty)
              MarkerLayer(
                markers: _pegelGauges
                    .map((g) => Marker(
                          point: LatLng(g.lat, g.lon),
                          width: 76,
                          height: 36,
                          child: _buildPegelMarker(g),
                        ))
                    .toList(),
              ),

            // 6. Infra POI markers
            if (_showLocks && _infraPois.isNotEmpty)
              MarkerLayer(
                markers: _infraPois
                    .map((p) => Marker(
                          point: LatLng(p.lat, p.lon),
                          width: 28,
                          height: 28,
                          child: _buildPoiMarker(p),
                        ))
                    .toList(),
              ),

            // 7. AIS vessel markers
            if (_showAIS && _aisVessels.isNotEmpty)
              MarkerLayer(
                markers: _aisVessels
                    .map((v) => Marker(
                          point: LatLng(v.lat, v.lon),
                          width: v.length > 100 ? 28.0 : 20.0,
                          height: v.length > 100 ? 28.0 : 20.0,
                          child: _buildAisMarker(v),
                        ))
                    .toList(),
              ),

            // 8. Waypoint markers
            if (_waypoints.isNotEmpty)
              MarkerLayer(
                markers: _waypoints
                    .map((wp) {
                      final isDragging = _draggingWp?.index == wp.index;
                      return Marker(
                        point: isDragging && _draggingLatLng != null
                            ? _draggingLatLng!
                            : LatLng(wp.lat, wp.lon),
                        width: isDragging ? 36 : 28,
                        height: isDragging ? 36 : 28,
                        child: _buildWaypointMarker(wp),
                      );
                    })
                    .toList(),
              ),

            // 9. Boat marker
            MarkerLayer(
              markers: [
                Marker(
                  point: boatPos,
                  width: 36,
                  height: 36,
                  child: Transform.rotate(
                    angle: (gps?.heading ?? 0) * (pi / 180),
                    child: Icon(
                      Icons.navigation,
                      color: _simRunning
                          ? const Color(0xFFFF9800)
                          : const Color(0xFF1565C0),
                      size: 36,
                      shadows: const [
                        Shadow(color: Colors.black38, blurRadius: 4)
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),

        // ----------------------------------------------------------------
        // Status bar (top)
        // ----------------------------------------------------------------
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: Container(
            color: const Color(0xEEFFFFFF),
            padding: EdgeInsets.symmetric(
                horizontal: sc(16), vertical: sc(8)),
            child: Row(
              children: [
                _statBox(
                    'SOG',
                    gps?.hasFix == true
                        ? (gps!.speed * 1.852).toStringAsFixed(1)
                        : '--',
                    'km/h',
                    scale: scale),
                SizedBox(width: sc(20)),
                _statBox(
                    'COG',
                    gps?.hasFix == true
                        ? gps!.heading.toStringAsFixed(0)
                        : '--',
                    '°',
                    scale: scale),
                SizedBox(width: sc(20)),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => showGpsPanel(context, gps),
                  child: _satBadge(gps, sc),
                ),
                if (etaStatusStr != null) ...[
                  SizedBox(width: sc(20)),
                  _statBox('ETA', etaStatusStr, '', scale: scale),
                ],
                const Spacer(),
                // Route mode indicator
                if (_routeMode)
                  Padding(
                    padding: EdgeInsets.only(right: sc(8)),
                    child: Container(
                      padding: EdgeInsets.symmetric(
                          horizontal: sc(8), vertical: sc(2)),
                      decoration: BoxDecoration(
                        color: const Color(0x221565C0),
                        borderRadius: BorderRadius.circular(sc(4)),
                        border: Border.all(color: const Color(0xFF1565C0)),
                      ),
                      child: Text('Route',
                          style: TextStyle(
                              fontSize: sc(10),
                              color: const Color(0xFF1565C0))),
                    ),
                  ),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => showWifiSheet(context),
                  child: Padding(
                    padding: EdgeInsets.all(sc(10)),
                    child: Icon(
                      ws.connected ? Icons.wifi : Icons.wifi_off,
                      color: ws.connected
                          ? const Color(0xFF1565C0)
                          : Colors.orange,
                      size: sc(18),
                    ),
                  ),
                ),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const SettingsScreen(),
                      fullscreenDialog: true,
                    ),
                  ),
                  child: Padding(
                    padding: EdgeInsets.all(sc(10)),
                    child: Icon(
                      Icons.settings_outlined,
                      color: const Color(0xFF666666),
                      size: sc(18),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),

        // ----------------------------------------------------------------
        // Navigation card (top-center, when nav active)
        // ----------------------------------------------------------------
        if (_navActive && _navNextWpIdx < _waypoints.length)
          NavCard(
            nextWaypoint: _waypoints[_navNextWpIdx],
            distToNextNm: _navDistToNextNm,
            bearingDeg: _navBearing,
            distanceUnit: distanceUnit,
            scale: scale,
          ),

        // ----------------------------------------------------------------
        // Sim speed bar (top, when sim running)
        // ----------------------------------------------------------------
        if (_simRunning)
          SimSpeedBar(
            speed: _simSpeed,
            onChanged: (v) => setState(() => _simSpeed = v),
            scale: scale,
          ),

        // ----------------------------------------------------------------
        // Layer toggle buttons (bottom-left)
        // ----------------------------------------------------------------
        Positioned(
          bottom: sc(60),
          left: sc(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Route mode button — first in column
              _layerBtn(Icons.edit_road, 'Route planen', _routeMode, (v) {
                if (!v) _clearRoute();
                setState(() => _routeMode = v);
              }, scale: scale),
              _layerBtn(Icons.waves, 'Seamark', _showSeamarks,
                  (v) => setState(() => _showSeamarks = v), scale: scale),
              _layerBtn(Icons.directions_boat, 'AIS', _showAIS, (v) {
                setState(() => _showAIS = v);
                if (v) {
                  _startAisTimer(60);
                } else {
                  _aisTimer?.cancel();
                  _aisTimer = null;
                  setState(() => _aisVessels = []);
                }
              }, scale: scale),
              _layerBtn(Icons.lock, 'Schleusen', _showLocks, (v) {
                setState(() => _showLocks = v);
                if (v) {
                  _fetchInfra();
                } else {
                  setState(() => _infraPois = []);
                }
              }, scale: scale),
              _layerBtn(Icons.water, 'Pegel', _showPegel, (v) {
                setState(() => _showPegel = v);
                if (v) {
                  _fetchPegel();
                } else {
                  setState(() => _pegelGauges = []);
                }
              }, scale: scale),
              _layerBtn(Icons.route, 'Track', _showTrack,
                  (v) => setState(() => _showTrack = v), scale: scale),
            ],
          ),
        ),

        // ----------------------------------------------------------------
        // Bottom-right FAB stack: satellite toggle + auto-follow
        // ----------------------------------------------------------------
        Positioned(
          bottom: sc(16),
          right: sc(16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              // Satellite toggle button
              Transform.scale(
                scale: scale,
                alignment: Alignment.bottomRight,
                child: FloatingActionButton.small(
                  heroTag: 'satellite',
                  backgroundColor: _satelliteMode
                      ? const Color(0xFF1565C0)
                      : const Color(0xFF2D2D2D),
                  foregroundColor: Colors.white,
                  onPressed: () => setState(() => _satelliteMode = !_satelliteMode),
                  child: const Icon(Icons.satellite_alt),
                ),
              ),
              // Position / auto-follow button (always visible)
              SizedBox(height: sc(8)),
              Transform.scale(
                scale: scale,
                alignment: Alignment.bottomRight,
                child: FloatingActionButton.small(
                  heroTag: 'myLocation',
                  backgroundColor: _autoFollow
                      ? const Color(0xFF1565C0)
                      : const Color(0xFF2D2D2D),
                  foregroundColor: Colors.white,
                  onPressed: () {
                    setState(() => _autoFollow = true);
                    if (gps != null) _mapController.move(boatPos, 14);
                  },
                  child: const Icon(Icons.my_location),
                ),
              ),
            ],
          ),
        ),

        // ----------------------------------------------------------------
        // Trip track banner
        // ----------------------------------------------------------------
        if (tripTrack != null)
          Positioned(
            top: sc(44),
            left: 0, right: 0,
            child: Center(
              child: GestureDetector(
                onTap: () => context.read<LogbookService>().clearTripTrack(),
                child: Container(
                  padding: EdgeInsets.symmetric(horizontal: sc(14), vertical: sc(6)),
                  decoration: BoxDecoration(
                    color: const Color(0xEE161B22),
                    borderRadius: BorderRadius.circular(sc(20)),
                    border: Border.all(color: const Color(0xFFFF9800)),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Container(width: sc(10), height: sc(3),
                        color: const Color(0xFFFF9800)),
                    SizedBox(width: sc(8)),
                    Text(
                      tripLabel ?? 'Fahrt',
                      style: TextStyle(fontSize: sc(12), color: const Color(0xFFFF9800)),
                    ),
                    SizedBox(width: sc(8)),
                    Icon(Icons.close, size: sc(14), color: const Color(0xFFFF9800)),
                  ]),
                ),
              ),
            ),
          ),

        // ----------------------------------------------------------------
        // Route panel (bottom sheet)
        // ----------------------------------------------------------------
        if (_routeMode && !_showSavedRoutes && !_showSaveDialog)
          RoutePanel(
            waypoints: _waypoints,
            routeResult: _routeResult,
            navActive: _navActive,
            navNextWpIdx: _navNextWpIdx,
            routeLoading: _routeLoading,
            simRunning: _simRunning,
            routeMode: _routeMode,
            departure: _departure,
            distanceUnit: distanceUnit,
            onStartNav: _startNavigation,
            onStopNav: _stopNavigation,
            onStartSim: _startSimulation,
            onStopSim: _stopSimulation,
            onSave: () => setState(() => _showSaveDialog = true),
            onShowSaved: _loadSavedRoutes,
            onClearAll: _clearRoute,
            onRemoveWaypoint: _removeWaypoint,
            onDepartureHourDelta: (delta) {
              setState(() {
                if (delta == 0) {
                  _departure = DateTime.now();
                } else {
                  _departure = _departure.add(Duration(hours: delta));
                }
              });
            },
            onDepartureMinuteDelta: (delta) {
              setState(() =>
                  _departure = _departure.add(Duration(minutes: delta)));
            },
            scale: scale,
          ),

        // ----------------------------------------------------------------
        // Saved routes sheet
        // ----------------------------------------------------------------
        if (_showSavedRoutes)
          SavedRoutesSheet(
            routes: _savedRoutes,
            loading: _savedRoutesLoading,
            onClose: () => setState(() => _showSavedRoutes = false),
            onLoad: _loadSavedRouteIntoPlanner,
            onDelete: _deleteSavedRoute,
            distanceUnit: distanceUnit,
            scale: scale,
          ),

        // ----------------------------------------------------------------
        // Save dialog
        // ----------------------------------------------------------------
        if (_showSaveDialog)
          SaveRouteDialog(
            scale: scale,
            onCancel: () => setState(() => _showSaveDialog = false),
            onConfirm: (name) {
              _saveRoute(name);
              setState(() => _showSaveDialog = false);
            },
          ),

        // ----------------------------------------------------------------
        // Waypoint delete confirmation
        // ----------------------------------------------------------------
        if (_confirmDeleteWp != null)
          Positioned(
            bottom: 0, left: 0, right: 0,
            child: Container(
              padding: EdgeInsets.fromLTRB(16 * scale, 16 * scale, 16 * scale, 20 * scale),
              decoration: const BoxDecoration(
                color: Color(0xF5161B22),
                border: Border(top: BorderSide(color: Color(0xFF30363D))),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Wegpunkt ${_confirmDeleteWp!.index + 1} löschen?',
                    style: TextStyle(
                        fontSize: 15 * scale,
                        color: const Color(0xFFE6EDF3),
                        fontWeight: FontWeight.bold),
                  ),
                  Text(
                    '${_confirmDeleteWp!.lat.toStringAsFixed(5)}, ${_confirmDeleteWp!.lon.toStringAsFixed(5)}',
                    style: TextStyle(fontSize: 11 * scale, color: const Color(0xFF8B949E)),
                  ),
                  SizedBox(height: 14 * scale),
                  Row(
                    children: [
                      Expanded(
                        child: GestureDetector(
                          onTap: () => setState(() => _confirmDeleteWp = null),
                          child: Container(
                            padding: EdgeInsets.symmetric(vertical: 12 * scale),
                            decoration: BoxDecoration(
                              color: const Color(0xFF30363D),
                              borderRadius: BorderRadius.circular(8 * scale),
                            ),
                            child: Center(child: Text('Abbrechen',
                                style: TextStyle(fontSize: 14 * scale, color: const Color(0xFFE6EDF3)))),
                          ),
                        ),
                      ),
                      SizedBox(width: 12 * scale),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            final wp = _confirmDeleteWp!;
                            setState(() => _confirmDeleteWp = null);
                            _removeWaypoint(wp);
                          },
                          child: Container(
                            padding: EdgeInsets.symmetric(vertical: 12 * scale),
                            decoration: BoxDecoration(
                              color: const Color(0xFFB71C1C),
                              borderRadius: BorderRadius.circular(8 * scale),
                            ),
                            child: Center(child: Text('Löschen',
                                style: TextStyle(fontSize: 14 * scale,
                                    color: Colors.white, fontWeight: FontWeight.bold))),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),

        // ----------------------------------------------------------------
        // AIS detail panel
        // ----------------------------------------------------------------
        if (_selectedVessel != null)
          _AisDetailPanel(
            vessel: _selectedVessel!,
            navstatText: _navstatText(_selectedVessel!.navstat),
            onClose: () => setState(() => _selectedVessel = null),
            scale: scale,
          ),

        // ----------------------------------------------------------------
        // POI detail panel
        // ----------------------------------------------------------------
        if (_selectedPoi != null)
          _PoiDetailPanel(
            poi: _selectedPoi!,
            onClose: () => setState(() => _selectedPoi = null),
            scale: scale,
          ),
      ],
    );
  }

  // -------------------------------------------------------------------------
  // Waypoint marker widget
  // -------------------------------------------------------------------------

  LatLng _globalToLatLng(Offset global) {
    final box = _mapKey.currentContext?.findRenderObject() as RenderBox?;
    if (box == null) return _lastBoatPos;
    final local = box.globalToLocal(global);
    return _mapController.camera.offsetToCrs(local);
  }

  Widget _buildWaypointMarker(RouteWaypoint wp) {
    final isNext = _navActive && wp.index == _navNextWpIdx;
    final isDragging = _draggingWp?.index == wp.index;
    final sz = isDragging ? 36.0 : 28.0;
    return GestureDetector(
      onTap: _navActive ? null : () {
        if (_draggingWp == null) setState(() => _confirmDeleteWp = wp);
      },
      onLongPressStart: _navActive ? null : (d) {
        setState(() {
          _confirmDeleteWp = null;
          _draggingWp = wp;
          _draggingLatLng = LatLng(wp.lat, wp.lon);
        });
      },
      onLongPressMoveUpdate: (d) {
        if (_draggingWp?.index == wp.index) {
          setState(() => _draggingLatLng = _globalToLatLng(d.globalPosition));
        }
      },
      onLongPressEnd: (d) {
        if (_draggingWp?.index == wp.index && _draggingLatLng != null) {
          final newPos = _draggingLatLng!;
          setState(() { _draggingWp = null; _draggingLatLng = null; });
          _updateWaypointPosition(wp, newPos);
        }
      },
      onLongPressCancel: () {
        if (_draggingWp?.index == wp.index) {
          setState(() { _draggingWp = null; _draggingLatLng = null; });
        }
      },
      child: Container(
        width: sz,
        height: sz,
        decoration: BoxDecoration(
          color: isDragging
              ? const Color(0xFFFF6F00)
              : isNext
                  ? const Color(0xFF2ECC71)
                  : const Color(0xFF1565C0),
          shape: BoxShape.circle,
          border: Border.all(
              color: isDragging ? Colors.white : Colors.white,
              width: isDragging ? 3 : 2),
          boxShadow: isDragging
              ? [BoxShadow(color: Colors.black45, blurRadius: 8, spreadRadius: 2)]
              : null,
        ),
        child: Center(
          child: Text(
            '${wp.index + 1}',
            style: TextStyle(
                color: Colors.white,
                fontSize: isDragging ? 15 : 12,
                fontWeight: FontWeight.bold),
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------------
  // Stat box helper
  // -------------------------------------------------------------------------

  Widget _statBox(String label, String value, String unit,
      {double scale = 1.0}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(label,
            style: TextStyle(
                fontSize: 9 * scale, color: const Color(0xFF666666))),
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(value,
                style: TextStyle(
                    fontSize: 15 * scale,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF1565C0))),
            if (unit.isNotEmpty)
              Text(' $unit',
                  style: TextStyle(
                      fontSize: 10 * scale,
                      color: const Color(0xFF888888))),
          ],
        ),
      ],
    );
  }

  Widget _satBadge(GpsData? gps, double sc) {
    final fix = gps?.hasFix == true;
    final sat = gps?.satellites ?? 0;
    final color = fix
        ? const Color(0xFF4CAF50)
        : (gps != null ? const Color(0xFFFF9800) : const Color(0xFF888888));
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Icon(Icons.satellite_alt, size: 11 * sc, color: color),
      SizedBox(width: 3 * sc),
      Text('$sat',
          style: TextStyle(
              fontSize: 15 * sc,
              fontWeight: FontWeight.bold,
              color: color)),
    ]);
  }

  // -------------------------------------------------------------------------
  // V1 map style
  // -------------------------------------------------------------------------

  Map<String, dynamic> _v1Style() => {
        'version': 8,
        'sources': {
          'openmaptiles': {
            'type': 'vector',
            'tiles': [_tileUrl],
            'minzoom': 0,
            'maxzoom': 14,
          },
        },
        'layers': [
          {
            'id': 'background',
            'type': 'background',
            'paint': {'background-color': '#e0e0e0'}
          },
          {
            'id': 'water',
            'type': 'fill',
            'source': 'openmaptiles',
            'source-layer': 'water',
            'paint': {'fill-color': '#80b0d0'}
          },
          {
            'id': 'waterway',
            'type': 'line',
            'source': 'openmaptiles',
            'source-layer': 'waterway',
            'paint': {'line-color': '#80b0d0', 'line-width': 2.0}
          },
          {
            'id': 'landcover',
            'type': 'fill',
            'source': 'openmaptiles',
            'source-layer': 'landcover',
            'paint': {'fill-color': '#c0e0c0', 'fill-opacity': 0.5}
          },
          {
            'id': 'park',
            'type': 'fill',
            'source': 'openmaptiles',
            'source-layer': 'park',
            'paint': {'fill-color': '#a0d0a0', 'fill-opacity': 0.5}
          },
          {
            'id': 'landuse',
            'type': 'fill',
            'source': 'openmaptiles',
            'source-layer': 'landuse',
            'paint': {'fill-color': '#f0f0e0', 'fill-opacity': 0.3}
          },
          {
            'id': 'building',
            'type': 'fill',
            'source': 'openmaptiles',
            'source-layer': 'building',
            'paint': {'fill-color': '#d0d0d0'}
          },
          {
            'id': 'roads',
            'type': 'line',
            'source': 'openmaptiles',
            'source-layer': 'transportation',
            'paint': {'line-color': '#ffffff', 'line-width': 1.0}
          },
          {
            'id': 'roads-motorway',
            'type': 'line',
            'source': 'openmaptiles',
            'source-layer': 'transportation',
            'filter': ['==', 'class', 'motorway'],
            'paint': {'line-color': '#ffcc80', 'line-width': 3.0}
          },
          {
            'id': 'roads-trunk',
            'type': 'line',
            'source': 'openmaptiles',
            'source-layer': 'transportation',
            'filter': ['==', 'class', 'trunk'],
            'paint': {'line-color': '#ffcc80', 'line-width': 3.0}
          },
          {
            'id': 'roads-primary',
            'type': 'line',
            'source': 'openmaptiles',
            'source-layer': 'transportation',
            'filter': ['==', 'class', 'primary'],
            'paint': {'line-color': '#ffcc80', 'line-width': 2.5}
          },
          {
            'id': 'boundary',
            'type': 'line',
            'source': 'openmaptiles',
            'source-layer': 'boundary',
            'paint': {'line-color': '#808080', 'line-width': 1.0}
          },
          {
            'id': 'place-city',
            'type': 'symbol',
            'source': 'openmaptiles',
            'source-layer': 'place',
            'filter': ['==', 'class', 'city'],
            'layout': {
              'text-field': ['get', 'name:de'],
              'text-size': 14.0,
              'text-font': ['Noto Sans Regular'],
            },
            'paint': {
              'text-color': '#333333',
              'text-halo-color': '#ffffff',
              'text-halo-width': 2.0,
            }
          },
          {
            'id': 'place-town',
            'type': 'symbol',
            'source': 'openmaptiles',
            'source-layer': 'place',
            'filter': ['==', 'class', 'town'],
            'layout': {
              'text-field': ['get', 'name:de'],
              'text-size': 12.0,
              'text-font': ['Noto Sans Regular'],
            },
            'paint': {
              'text-color': '#444444',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.5,
            }
          },
          {
            'id': 'place-village',
            'type': 'symbol',
            'source': 'openmaptiles',
            'source-layer': 'place',
            'filter': ['==', 'class', 'village'],
            'layout': {
              'text-field': ['get', 'name:de'],
              'text-size': 11.0,
              'text-font': ['Noto Sans Regular'],
            },
            'paint': {
              'text-color': '#555555',
              'text-halo-color': '#ffffff',
              'text-halo-width': 1.0,
            }
          },
        ],
      };
}

// ---------------------------------------------------------------------------
// AIS Detail Panel
// ---------------------------------------------------------------------------

class _AisDetailPanel extends StatelessWidget {
  final _AisVessel vessel;
  final String navstatText;
  final VoidCallback onClose;
  final double scale;

  const _AisDetailPanel({
    required this.vessel,
    required this.navstatText,
    required this.onClose,
    this.scale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final sc = scale;
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        color: const Color(0xF2161B22),
        padding: EdgeInsets.fromLTRB(16 * sc, 12 * sc, 16 * sc, 16 * sc),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    vessel.name.isNotEmpty
                        ? vessel.name
                        : 'MMSI ${vessel.mmsi}',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16 * sc,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: onClose,
                  child: Icon(Icons.close,
                      color: Colors.white54, size: 20 * sc),
                ),
              ],
            ),
            SizedBox(height: 8 * sc),
            Wrap(
              spacing: 16 * sc,
              runSpacing: 4 * sc,
              children: [
                _detail('MMSI', '${vessel.mmsi}', sc),
                _detail('SOG', '${vessel.sog.toStringAsFixed(1)} kn', sc),
                _detail('COG', '${vessel.cog.toStringAsFixed(0)}°', sc),
                _detail('Heading',
                    vessel.heading < 511 ? '${vessel.heading}°' : '—', sc),
                _detail('Status', navstatText, sc),
                if (vessel.callsign.isNotEmpty)
                  _detail('Rufzeichen', vessel.callsign, sc),
                if (vessel.destination.isNotEmpty)
                  _detail('Ziel', vessel.destination, sc),
                if (vessel.length > 0)
                  _detail('Länge', '${vessel.length} m', sc),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _detail(String label, String value, double sc) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 9 * sc, color: const Color(0xFF888888))),
          Text(value,
              style: TextStyle(
                  fontSize: 13 * sc, color: const Color(0xFF64FFDA))),
        ],
      );
}

// ---------------------------------------------------------------------------
// POI Detail Panel
// ---------------------------------------------------------------------------

class _PoiDetailPanel extends StatefulWidget {
  final _InfraPoi poi;
  final VoidCallback onClose;
  final double scale;

  const _PoiDetailPanel({
    required this.poi,
    required this.onClose,
    this.scale = 1.0,
  });

  @override
  State<_PoiDetailPanel> createState() => _PoiDetailPanelState();
}

class _PoiDetailPanelState extends State<_PoiDetailPanel> {
  static const String _apiBase = 'http://localhost:8000';
  Map<String, dynamic>? _lockStatus;

  @override
  void initState() {
    super.initState();
    if (widget.poi.type == 'lock' && widget.poi.id > 0) {
      _fetchLockStatus();
    }
  }

  @override
  void didUpdateWidget(_PoiDetailPanel old) {
    super.didUpdateWidget(old);
    if (old.poi.id != widget.poi.id) {
      setState(() => _lockStatus = null);
      if (widget.poi.type == 'lock' && widget.poi.id > 0) {
        _fetchLockStatus();
      }
    }
  }

  Future<void> _fetchLockStatus() async {
    try {
      final resp = await http
          .get(Uri.parse('$_apiBase/api/locks/${widget.poi.id}/status'))
          .timeout(const Duration(seconds: 5));
      if (resp.statusCode == 200 && mounted) {
        setState(() => _lockStatus = json.decode(resp.body) as Map<String, dynamic>);
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final sc = widget.scale;
    final poi = widget.poi;
    final p = poi.properties;

    final label = switch (poi.type) {
      'lock'   => 'Schleuse',
      'bridge' => 'Brücke',
      'harbor' => 'Hafen',
      'weir'   => 'Wehr',
      _        => poi.type,
    };

    String? strVal(String key) {
      final v = p[key];
      if (v == null) return null;
      final s = v.toString().trim();
      return s.isEmpty ? null : s;
    }

    String? numVal(String key, String unit) {
      final v = p[key];
      if (v == null) return null;
      final n = (v as num?)?.toDouble();
      if (n == null || n == 0) return null;
      return '${n % 1 == 0 ? n.toInt() : n} $unit';
    }

    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        color: const Color(0xF2161B22),
        padding: EdgeInsets.fromLTRB(16 * sc, 12 * sc, 16 * sc, 16 * sc),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Header ──────────────────────────────────────────────────
            Row(children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(label,
                        style: TextStyle(
                            fontSize: 10 * sc, color: const Color(0xFF888888))),
                    Text(
                      poi.name.isNotEmpty ? poi.name : label,
                      style: TextStyle(
                          color: Colors.white,
                          fontSize: 16 * sc,
                          fontWeight: FontWeight.bold),
                    ),
                    if (strVal('waterway') != null)
                      Text(
                        [strVal('waterway'), strVal('river_km') != null ? 'km ${strVal('river_km')}' : null]
                            .whereType<String>().join('  ·  '),
                        style: TextStyle(
                            fontSize: 11 * sc, color: const Color(0xFF4FC3F7)),
                      ),
                  ],
                ),
              ),
              GestureDetector(
                onTap: widget.onClose,
                child: Icon(Icons.close, color: Colors.white54, size: 20 * sc),
              ),
            ]),

            // ── Status badge (locks only) ────────────────────────────────
            if (poi.type == 'lock') ...[
              SizedBox(height: 8 * sc),
              _buildStatusBadge(sc),
            ],

            // ── Details grid ────────────────────────────────────────────
            if ([
              numVal('max_length', 'm'),
              numVal('max_width',  'm'),
              numVal('max_draft',  'm'),
              numVal('max_height', 'm'),
              strVal('vhf_channel'),
              strVal('phone'),
              strVal('avg_duration'),
            ].any((v) => v != null)) ...[
              SizedBox(height: 8 * sc),
              Wrap(
                spacing: 20 * sc,
                runSpacing: 6 * sc,
                children: [
                  if (numVal('max_length', 'm') != null)
                    _detail('Kammer L.', numVal('max_length', 'm')!, sc),
                  if (numVal('max_width',  'm') != null)
                    _detail('Kammer B.', numVal('max_width',  'm')!, sc),
                  if (numVal('max_draft',  'm') != null)
                    _detail('Max. Tiefgang', numVal('max_draft', 'm')!, sc),
                  if (numVal('max_height', 'm') != null)
                    _detail('Durchfahrtsh.', numVal('max_height', 'm')!, sc),
                  if (strVal('vhf_channel') != null)
                    _detail('VHF', 'Kanal ${strVal('vhf_channel')}', sc),
                  if (strVal('phone') != null)
                    _detail('Telefon', strVal('phone')!, sc),
                  if (p['avg_duration'] != null && (p['avg_duration'] as num?) != null && (p['avg_duration'] as num) > 0)
                    _detail('Ø Wartezeit', '${p['avg_duration']} min', sc),
                ],
              ),
            ],

            // ── Notes ───────────────────────────────────────────────────
            if (strVal('notes') != null) ...[
              SizedBox(height: 6 * sc),
              Text(strVal('notes')!,
                  style: TextStyle(
                      fontSize: 11 * sc, color: const Color(0xFF8B949E))),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatusBadge(double sc) {
    if (_lockStatus == null) {
      return Container(
        padding: EdgeInsets.symmetric(horizontal: 10 * sc, vertical: 4 * sc),
        decoration: BoxDecoration(
          color: const Color(0xFF30363D),
          borderRadius: BorderRadius.circular(6 * sc),
        ),
        child: Text('Status wird geladen…',
            style: TextStyle(fontSize: 11 * sc, color: const Color(0xFF888888))),
      );
    }
    final isOpen = _lockStatus!['is_open'] == true;
    final color = isOpen ? const Color(0xFF2ECC71) : const Color(0xFFE74C3C);
    final statusText = isOpen ? 'OFFEN' : 'GESCHLOSSEN';
    final opensAt  = _lockStatus!['opens_at']  as String?;
    final closesAt = _lockStatus!['closes_at'] as String?;

    return Container(
      padding: EdgeInsets.symmetric(horizontal: 12 * sc, vertical: 6 * sc),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color, width: 1.5),
        borderRadius: BorderRadius.circular(6 * sc),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 8 * sc, height: 8 * sc,
          decoration: BoxDecoration(color: color, shape: BoxShape.circle),
        ),
        SizedBox(width: 6 * sc),
        Text(statusText,
            style: TextStyle(
                fontSize: 13 * sc,
                color: color,
                fontWeight: FontWeight.bold)),
        if (opensAt != null) ...[
          SizedBox(width: 10 * sc),
          Text('öffnet $opensAt',
              style: TextStyle(
                  fontSize: 11 * sc, color: const Color(0xFF64FFDA))),
        ],
        if (closesAt != null) ...[
          SizedBox(width: 10 * sc),
          Text('schließt $closesAt',
              style: TextStyle(
                  fontSize: 11 * sc, color: const Color(0xFFFFB74D))),
        ],
      ]),
    );
  }

  Widget _detail(String label, String value, double sc) => Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(label,
              style: TextStyle(
                  fontSize: 9 * sc, color: const Color(0xFF888888))),
          Text(value,
              style: TextStyle(
                  fontSize: 13 * sc, color: const Color(0xFF64FFDA))),
        ],
      );
}
