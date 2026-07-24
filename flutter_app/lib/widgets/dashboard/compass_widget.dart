// lib/widgets/dashboard/compass_widget.dart
//
// COMPASS → Navigations-Master-Instrument (Motorboot), Helm-Zwilling zum Deck.
// Runde Kompassrose (North-up) + COG-Zeiger + großer SOG-Mittelwert + Boxen:
// COG · Pegel(Name) · Tiefe Rinne(+Vorausschau-Warnung) · Echolot · Strömung · → WP.
// SOG/COG live aus WebSocketService; Tiefe/Pegel/Strömung/Vorausschau aus
// /api/nav/point (throttled). Segel/Wind/Polar erst v2/v3.

import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../../services/settings_service.dart';
import '../../services/websocket_service.dart';
import 'dash_widget.dart';
import 'registry.dart';

// ─── Geo-Helfer (Restweg entlang Route + Peilung zum Ziel) ───────────────────
double _hav(double lat1, double lon1, double lat2, double lon2) {
  const r = 6371000.0;
  final dLat = (lat2 - lat1) * math.pi / 180;
  final dLon = (lon2 - lon1) * math.pi / 180;
  final sLat = math.sin(dLat / 2), sLon = math.sin(dLon / 2);
  final a = sLat * sLat +
      math.cos(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) * sLon * sLon;
  return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
}

double _bearing(double lat1, double lon1, double lat2, double lon2) {
  final dLon = (lon2 - lon1) * math.pi / 180;
  final y = math.sin(dLon) * math.cos(lat2 * math.pi / 180);
  final x = math.cos(lat1 * math.pi / 180) * math.sin(lat2 * math.pi / 180) -
      math.sin(lat1 * math.pi / 180) * math.cos(lat2 * math.pi / 180) * math.cos(dLon);
  return (math.atan2(y, x) * 180 / math.pi + 360) % 360;
}

/// Restweg (m) entlang der Route-Polyline ab dem nächstgelegenen Stützpunkt.
double? _remainingM(List<List<double>> coords, double lat, double lon) {
  if (coords.length < 2) return null;
  int best = 0;
  double bestD = double.infinity;
  for (int i = 0; i < coords.length; i++) {
    final d = _hav(lat, lon, coords[i][0], coords[i][1]);
    if (d < bestD) { bestD = d; best = i; }
  }
  double rem = bestD;
  for (int i = best; i < coords.length - 1; i++) {
    rem += _hav(coords[i][0], coords[i][1], coords[i + 1][0], coords[i + 1][1]);
  }
  return rem;
}

class CompassDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'COMPASS',
      label: 'Navi-Instrument',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
          {bool impactMuted = false}) =>
      _NavInstrument(sensors: sensors);

  static Widget buildEditor(DashWidget w, StateSetter setState,
          List<Map<String, dynamic>> allSensors) =>
      const Text(
        'Navi-Instrument: SOG/COG, Fahrrinnen-Tiefe (+ Vorausschau-Warnung), '
        'Pegel, Strömung. Keine weiteren Einstellungen nötig.',
        style: TextStyle(fontSize: 13, color: Color(0xFF8B949E)),
      );

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('COMPASS');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    return buf.toString();
  }
}

// ─────────────────────────────────────────────────────────────────────────────

const String _apiBase = 'http://localhost:8000';

class _NavInstrument extends StatefulWidget {
  final Map<String, dynamic> sensors;
  const _NavInstrument({required this.sensors});

  @override
  State<_NavInstrument> createState() => _NavInstrumentState();
}

class _NavInstrumentState extends State<_NavInstrument> {
  Timer? _timer;
  Map<String, dynamic>? _nav; // Antwort von /api/nav/point
  double _lastLat = 0, _lastLon = 0;
  DateTime _lastFetch = DateTime.fromMillisecondsSinceEpoch(0);
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 2), (_) => _maybeFetch());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _maybeFetch() {
    final gps = context.read<WebSocketService>().gps;
    if (gps == null) return;
    final now = DateTime.now();
    if (now.difference(_lastFetch).inMilliseconds < 5000) return; // max 1×/5s
    final moved = _lastLat == 0 ||
        (gps.lat - _lastLat).abs() > 0.0004 ||
        (gps.lon - _lastLon).abs() > 0.0004; // ~40 m
    if (!moved && now.difference(_lastFetch).inSeconds < 15) return;
    if (_busy) return;
    _busy = true;
    _lastFetch = now;
    _lastLat = gps.lat;
    _lastLon = gps.lon;
    final url = Uri.parse(
        '$_apiBase/api/nav/point?lat=${gps.lat}&lon=${gps.lon}&cog=${gps.heading}');
    http.get(url).timeout(const Duration(seconds: 12)).then((r) {
      if (!mounted) return;
      try {
        setState(() => _nav = jsonDecode(r.body) as Map<String, dynamic>);
      } catch (_) {}
    }).catchError((_) {}).whenComplete(() => _busy = false);
  }

  // Echolot (Tiefenmesser) aus dem Sensor-Map lesen (übliche Pfade).
  double? _sounder() {
    double? fromBase(String base) {
      final s = widget.sensors[base];
      if (s is Map) {
        final vals = (s['values'] as Map?) ?? {};
        for (final v in vals.values) {
          final d = v is num ? v.toDouble() : double.tryParse(v.toString().trim());
          if (d != null) return d;
        }
      }
      return null;
    }

    double? fromPath(String path) {
      final i = path.lastIndexOf('/');
      if (i < 0) return fromBase(path);
      final s = widget.sensors[path.substring(0, i)];
      if (s is Map) {
        final raw = ((s['values'] as Map?) ?? {})[path.substring(i + 1)];
        return raw is num ? raw.toDouble() : double.tryParse(raw?.toString().trim() ?? '');
      }
      return null;
    }

    for (final p in ['depth', 'tiefe', 'boot/tiefe',
      'environment/depth/belowKeel', 'navigation/depth/belowKeel']) {
      final v = p.contains('/') ? fromPath(p) : fromBase(p);
      if (v != null) return v;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final ws = context.watch<WebSocketService>();
    final gps = ws.gps;
    final settings = context.watch<SettingsService>();
    final coords = ws.route; // aktive Route (Backend-broadcast, Deck ↔ Helm)

    // Restweg + Peilung (zum Ziel) aus der aktiven Route + Position
    double? remainingM, wpBearing;
    if (gps != null && coords.length >= 2) {
      remainingM = _remainingM(coords, gps.lat, gps.lon);
      final dest = coords.last;
      wpBearing = _bearing(gps.lat, gps.lon, dest[0], dest[1]);
    }

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      padding: const EdgeInsets.all(6),
      child: LayoutBuilder(builder: (_, bc) {
        final s = math.min(bc.maxWidth, bc.maxHeight);
        return Center(
          child: SizedBox(
            width: s,
            height: s,
            child: CustomPaint(
              painter: _NavPainter(
                gps: gps,
                nav: _nav,
                sounder: _sounder(),
                isKmh: settings.isKmh,
                distanceKm: settings.isKm,
                remainingM: remainingM,
                wpBearing: wpBearing,
              ),
            ),
          ),
        );
      }),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────

class _NavPainter extends CustomPainter {
  final GpsData? gps;
  final Map<String, dynamic>? nav;
  final double? sounder;
  final bool isKmh;
  final bool distanceKm;
  final double? remainingM;
  final double? wpBearing;

  _NavPainter({
    required this.gps,
    required this.nav,
    required this.sounder,
    required this.isKmh,
    required this.distanceKm,
    required this.remainingM,
    required this.wpBearing,
  });

  double? _numAt(dynamic m, String key) {
    if (m is Map && m[key] is num) return (m[key] as num).toDouble();
    return null;
  }

  void _text(Canvas c, String str, Offset o, double px, Color col,
      {TextAlign align = TextAlign.center, FontWeight weight = FontWeight.w700}) {
    final tp = TextPainter(
      text: TextSpan(text: str, style: TextStyle(color: col, fontSize: px, fontWeight: weight)),
      textDirection: TextDirection.ltr,
    )..layout();
    double dx = o.dx;
    if (align == TextAlign.center) dx -= tp.width / 2;
    else if (align == TextAlign.right) dx -= tp.width;
    tp.paint(c, Offset(dx, o.dy - tp.height / 2));
  }

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.width;
    if (s <= 0) return;
    final cx = s / 2, cy = s * 0.40, R = s * 0.30;
    double a(double deg) => (deg - 90) * math.pi / 180;

    // Live-Daten
    final sogKn = gps?.speed;
    double? cog = gps?.heading;
    if (cog != null) cog = (cog % 360 + 360) % 360;

    final depthM = _numAt(nav?['depth'], 'current_depth') ?? _numAt(nav?['depth'], 'depth');
    final gauge = nav?['gauge'];
    final pegelCm = _numAt(gauge, 'w_cm');
    final pegelName = (gauge is Map && gauge['name'] != null) ? gauge['name'].toString() : null;
    final currentKmh = _numAt(nav, 'current_kmh');
    final ahead = nav?['ahead'];
    final aheadDepth = _numAt(ahead, 'current_depth');
    final aheadDist = _numAt(ahead, 'distance_m');
    final aheadShallow = (ahead is Map && ahead['shallow'] == true);

    // Hintergrund-Scheibe
    final bgRect = Rect.fromCircle(center: Offset(cx, cy), radius: R * 1.1);
    canvas.drawCircle(
      Offset(cx, cy), R * 1.04,
      Paint()..shader = RadialGradient(
        center: const Alignment(-0.3, -0.35),
        colors: const [Color(0xFF1A3350), Color(0xFF0A1526)],
      ).createShader(bgRect),
    );
    canvas.drawCircle(Offset(cx, cy), R * 1.04,
        Paint()..style = PaintingStyle.stroke..strokeWidth = math.max(1.0, s * 0.006)
          ..color = const Color(0xFF64B4FF).withOpacity(0.28));

    // Ticks
    for (int d = 0; d < 360; d += 5) {
      final major = d % 30 == 0;
      final len = major ? R * 0.12 : R * 0.06;
      final ang = a(d.toDouble());
      canvas.drawLine(
        Offset(cx + (R - len) * math.cos(ang), cy + (R - len) * math.sin(ang)),
        Offset(cx + R * math.cos(ang), cy + R * math.sin(ang)),
        Paint()
          ..strokeWidth = major ? math.max(1.5, s * 0.008) : math.max(0.75, s * 0.004)
          ..color = major ? const Color(0xFFC8DCFF).withOpacity(0.75)
                          : const Color(0xFF96B4DC).withOpacity(0.35),
      );
    }

    // Grad-/Kardinal-Beschriftung
    final labelR = R - R * 0.24;
    for (int d = 0; d < 360; d += 30) {
      final ang = a(d.toDouble());
      final o = Offset(cx + labelR * math.cos(ang), cy + labelR * math.sin(ang));
      final card = d % 90 == 0;
      String txt;
      Color col;
      if (d == 0) { txt = 'N'; col = const Color(0xFFFF5B52); }
      else if (d == 90) { txt = 'E'; col = const Color(0xFFD4E6FF); }
      else if (d == 180) { txt = 'S'; col = const Color(0xFFD4E6FF); }
      else if (d == 270) { txt = 'W'; col = const Color(0xFFD4E6FF); }
      else { txt = d.toString().padLeft(3, '0'); col = const Color(0xFFB9CDEB).withOpacity(0.6); }
      _text(canvas, txt, o, s * (card ? 0.058 : 0.038), col,
          weight: card ? FontWeight.w700 : FontWeight.w400);
    }

    // COG-Zeiger
    if (cog != null) {
      canvas.save();
      canvas.translate(cx, cy);
      canvas.rotate(a(cog) + math.pi / 2);
      final tip = -(R - R * 0.04), base = -(R - R * 0.20), hw = R * 0.06;
      final path = Path()
        ..moveTo(0, tip)..lineTo(-hw, base)..lineTo(hw, base)..close();
      canvas.drawPath(path, Paint()..color = const Color(0xFF4FC3F7));
      canvas.restore();
    }

    // WP-Peilungs-Marker (Steuer-Hinweis zum Ziel) — Raute auf dem Ring
    if (wpBearing != null) {
      final ang = a(wpBearing!);
      final mr = R - R * 0.02, d = R * 0.06;
      canvas.save();
      canvas.translate(cx + mr * math.cos(ang), cy + mr * math.sin(ang));
      canvas.rotate(ang + math.pi / 2);
      final path = Path()
        ..moveTo(0, -d)..lineTo(d * 0.7, 0)..lineTo(0, d)..lineTo(-d * 0.7, 0)..close();
      canvas.drawPath(path, Paint()..color = const Color(0xFFC9A0FF));
      canvas.restore();
    }

    // Mittelwert SOG (kn → km/h; v1 fest km/h wie Deck-Binnen-Default)
    String numStr = '–', unitStr = 'SOG';
    if (sogKn != null) {
      if (isKmh) { numStr = (sogKn * 1.852).toStringAsFixed(1); unitStr = 'km/h'; }
      else { numStr = sogKn.toStringAsFixed(1); unitStr = 'kn'; }
    }
    _text(canvas, 'SOG', Offset(cx, cy - R * 0.36), s * 0.04,
        const Color(0xFF96AAC8).withOpacity(0.7), weight: FontWeight.w600);
    _text(canvas, numStr, Offset(cx, cy), s * 0.15, const Color(0xFFEEF4FF));
    _text(canvas, unitStr, Offset(cx, cy + R * 0.30), s * 0.045,
        const Color(0xFF9FB2CC), weight: FontWeight.w500);

    // Boxen
    String fmtM(double v) => '${v.toStringAsFixed(1)} m';
    final labelCol = const Color(0xFFA0B4D2).withOpacity(0.62);
    void stat(double x, double yl, double yv, TextAlign al, String label, String val, Color col) {
      _text(canvas, label, Offset(x, yl), s * 0.030, labelCol, align: al, weight: FontWeight.w600);
      _text(canvas, val, Offset(x, yv), s * 0.052, col, align: al);
    }

    // Vorausschau-Warnung ersetzt die Rinnen-Tiefe
    final rinneLabel = aheadShallow ? '⚠ flach in ${aheadDist?.round()} m' : 'Tiefe Rinne';
    final rinneVal = aheadShallow
        ? (aheadDepth != null ? fmtM(aheadDepth) : '–')
        : (depthM != null ? fmtM(depthM) : '–');
    final rinneCol = aheadShallow ? const Color(0xFFFF6B6B) : const Color(0xFF5FD6E6);

    // 2 obere Ecken
    stat(s * 0.035, s * 0.05, s * 0.105, TextAlign.left, 'COG',
        cog != null ? '${cog.round()}°' : '–', const Color(0xFF7FE0A0));
    stat(s * 0.965, s * 0.05, s * 0.105, TextAlign.right,
        pegelName != null ? 'Pegel ($pegelName)' : 'Pegel',
        pegelCm != null ? '${pegelCm.round()} cm' : '–', const Color(0xFF7FBFFF));

    // Unten 2×2-Grid
    final colL = s * 0.27, colR = s * 0.73;
    stat(colL, s * 0.755, s * 0.815, TextAlign.center, rinneLabel, rinneVal, rinneCol);
    stat(colR, s * 0.755, s * 0.815, TextAlign.center, 'Echolot',
        sounder != null ? fmtM(sounder!) : '–', const Color(0xFF9FD0FF));
    stat(colL, s * 0.885, s * 0.945, TextAlign.center, 'Strömung',
        currentKmh != null ? '${currentKmh.toStringAsFixed(1)} km/h' : '–', const Color(0xFFFFD479));
    final restStr = remainingM != null
        ? (distanceKm
            ? '${(remainingM! / 1000).toStringAsFixed(1)} km'
            : '${(remainingM! / 1852).toStringAsFixed(1)} NM')
        : '–';
    stat(colR, s * 0.885, s * 0.945, TextAlign.center,
        wpBearing != null ? '→ ${wpBearing!.round()}°' : '→ WP', restStr, const Color(0xFFC9A0FF));
  }

  @override
  bool shouldRepaint(_NavPainter old) =>
      old.gps != gps || old.nav != nav || old.sounder != sounder ||
      old.remainingM != remainingM || old.wpBearing != wpBearing ||
      old.isKmh != isKmh || old.distanceKm != distanceKm;
}
