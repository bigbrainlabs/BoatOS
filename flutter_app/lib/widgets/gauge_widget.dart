// lib/widgets/gauge_widget.dart
import 'dart:math' as math;
import 'package:flutter/material.dart';

// ─── Enums ───────────────────────────────────────────────────────────────────

enum GaugeStyle { arc180, arc270, arc360, bar }
enum SensorCardStyle { card, hero, compact }

// ─── Color helpers ───────────────────────────────────────────────────────────

const Map<String, Color> kDashColors = {
  'cyan':   Color(0xFF64FFDA),
  'blue':   Color(0xFF4FC3F7),
  'green':  Color(0xFF2ECC71),
  'orange': Color(0xFFE67E22),
  'purple': Color(0xFF9B59B6),
  'red':    Color(0xFFE74C3C),
  'yellow': Color(0xFFF1C40F),
};

Color parseDashColor(String name) => kDashColors[name] ?? const Color(0xFF64FFDA);

// ─────────────────────────────────────────────────────────────────────────────
// GaugeWidget  (animated needle/bar)
// ─────────────────────────────────────────────────────────────────────────────

class GaugeWidget extends StatefulWidget {
  final double value;
  final double min, max;
  final String unit, label;
  final GaugeStyle style;
  final Color color;
  final int decimals;

  const GaugeWidget({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.unit,
    this.label = '',
    required this.style,
    required this.color,
    this.decimals = 1,
  });

  @override
  State<GaugeWidget> createState() => _GaugeWidgetState();
}

class _GaugeWidgetState extends State<GaugeWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;

  double _toPct(double v) => widget.max > widget.min
      ? ((v - widget.min) / (widget.max - widget.min)).clamp(0.0, 1.0)
      : 0.0;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    final p = _toPct(widget.value);
    _anim = Tween<double>(begin: p, end: p)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void didUpdateWidget(GaugeWidget old) {
    super.didUpdateWidget(old);
    if (old.value != widget.value) {
      final from = _anim.value;
      final to   = _toPct(widget.value);
      _anim = Tween<double>(begin: from, end: to)
          .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
      _ctrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) {
        if (widget.style == GaugeStyle.bar) {
          return _BarGauge(
            pct: _anim.value, value: widget.value,
            min: widget.min, max: widget.max,
            unit: widget.unit, label: widget.label,
            color: widget.color, decimals: widget.decimals,
          );
        }
        return _ArcGauge(
          pct: _anim.value, value: widget.value,
          min: widget.min, max: widget.max,
          unit: widget.unit, label: widget.label,
          style: widget.style, color: widget.color, decimals: widget.decimals,
        );
      },
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _ArcGauge
// ─────────────────────────────────────────────────────────────────────────────

class _ArcGauge extends StatelessWidget {
  final double pct, value, min, max;
  final String unit, label;
  final GaugeStyle style;
  final Color color;
  final int decimals;

  const _ArcGauge({
    required this.pct, required this.value,
    required this.min, required this.max,
    required this.unit, required this.label, required this.style,
    required this.color, required this.decimals,
  });

  @override
  Widget build(BuildContext context) {
    final valueStr = value.toStringAsFixed(decimals);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF21262D)),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F1623), Color(0xFF0A0E1A)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 10),
      child: Column(
        children: [
          if (label.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                label,
                style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                overflow: TextOverflow.ellipsis,
                maxLines: 1,
                textAlign: TextAlign.center,
              ),
            ),
          Expanded(
            child: LayoutBuilder(
              builder: (_, bc) {
                final s = math.min(bc.maxWidth, bc.maxHeight);
                return Center(
                  child: SizedBox.square(
                    dimension: s,
                    child: CustomPaint(
                      painter: _ArcPainter(
                        percentage: pct,
                        style: style,
                        accentColor: color,
                        min: min, max: max,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                valueStr,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: color,
                ),
              ),
              if (unit.isNotEmpty) ...[
                const SizedBox(width: 3),
                Text(unit, style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
              ],
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// _ArcPainter
// ─────────────────────────────────────────────────────────────────────────────

class _ArcPainter extends CustomPainter {
  final double percentage;
  final GaugeStyle style;
  final Color accentColor;
  final double min, max;

  const _ArcPainter({
    required this.percentage,
    required this.style,
    required this.accentColor,
    required this.min,
    required this.max,
  });

  // (startAngle, sweepAngle) in radians — clockwise, 0=right
  (double, double) get _angles {
    switch (style) {
      case GaugeStyle.arc180: return (math.pi, math.pi);
      case GaugeStyle.arc270: return (3 * math.pi / 4, 3 * math.pi / 2);
      case GaugeStyle.arc360: return (-math.pi / 2, 2 * math.pi);
      default:                return (math.pi, math.pi);
    }
  }

  (Offset center, double radius) _layout(Size size) {
    if (style == GaugeStyle.arc180) {
      // Square canvas: center at 70% so the arch (top half of circle) is vertically centered
      final r = math.max(math.min(size.width * 0.42, size.height * 0.42), 10.0);
      return (Offset(size.width / 2, size.height * 0.70), r);
    }
    final r = math.max(math.min(size.width, size.height) * 0.42, 10.0);
    return (Offset(size.width / 2, size.height / 2), r);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final (center, radius) = _layout(size);
    final (startAngle, sweepAngle) = _angles;
    final canvasHalf = math.min(size.width, size.height) / 2;

    _drawBezel(canvas, center, radius);
    _drawTrack(canvas, center, radius, startAngle, sweepAngle);
    if (percentage > 0.01) {
      _drawGlow(canvas, center, radius, startAngle, sweepAngle);
      _drawValueArc(canvas, center, radius, startAngle, sweepAngle);
    }
    _drawTicks(canvas, center, radius, startAngle, sweepAngle, canvasHalf);
    _drawNeedle(canvas, center, radius, startAngle, sweepAngle);
    _drawCap(canvas, center);
  }

  void _drawBezel(Canvas canvas, Offset center, double radius) {
    if (style == GaugeStyle.arc180) {
      // Only draw the arc portion of the bezel, not a full circle
      const start = math.pi - 0.08;
      const sweep = math.pi + 0.16;
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius + 11),
          start, sweep, false, Paint()
            ..color = const Color(0xFF21262D)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 5);
      canvas.drawArc(Rect.fromCircle(center: center, radius: radius + 2),
          start, sweep, false, Paint()
            ..color = const Color(0xFF30363D)
            ..style = PaintingStyle.stroke
            ..strokeWidth = 1);
    } else {
      canvas.drawCircle(center, radius + 11, Paint()
        ..color = const Color(0xFF21262D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 5);
      canvas.drawCircle(center, radius + 2, Paint()
        ..color = const Color(0xFF30363D)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1);
    }
  }

  void _drawTrack(Canvas canvas, Offset center, double r, double start, double sweep) {
    canvas.drawArc(Rect.fromCircle(center: center, radius: r), start, sweep, false,
      Paint()
        ..color = const Color(0xFF1C2430)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round);
  }

  void _drawGlow(Canvas canvas, Offset center, double r, double start, double sweep) {
    canvas.drawArc(Rect.fromCircle(center: center, radius: r),
      start, sweep * percentage, false,
      Paint()
        ..color = accentColor.withOpacity(0.22)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 18
        ..strokeCap = StrokeCap.round);
  }

  void _drawValueArc(Canvas canvas, Offset center, double r, double start, double sweep) {
    canvas.drawArc(Rect.fromCircle(center: center, radius: r),
      start, sweep * percentage, false,
      Paint()
        ..color = accentColor
        ..style = PaintingStyle.stroke
        ..strokeWidth = 10
        ..strokeCap = StrokeCap.round);
  }

  void _drawTicks(Canvas canvas, Offset center, double radius, double startAngle, double sweepAngle, double canvasHalf) {
    const numMajor = 5;
    const numMinor = 4;
    final total = numMajor * (numMinor + 1);

    for (int i = 0; i <= total; i++) {
      final isMajor = i % (numMinor + 1) == 0;
      final angle = startAngle + (i / total) * sweepAngle;
      final innerR = radius + 13;
      final outerR = radius + (isMajor ? 21 : 17);

      canvas.drawLine(
        Offset(center.dx + math.cos(angle) * innerR, center.dy + math.sin(angle) * innerR),
        Offset(center.dx + math.cos(angle) * outerR, center.dy + math.sin(angle) * outerR),
        Paint()
          ..color = isMajor ? const Color(0xFF4A5568) : const Color(0xFF2D333B)
          ..strokeWidth = isMajor ? 1.5 : 1.0,
      );

      if (isMajor && style != GaugeStyle.arc180 && radius >= 60 && radius + 33 < canvasHalf) {
        final tickVal = min + (i / total) * (max - min);
        _drawLabel(canvas, center, radius, angle, _fmtTick(tickVal));
      }
    }
  }

  String _fmtTick(double v) {
    if (v == 0) return '0';
    if (v.abs() >= 1000) return '${(v / 1000).toStringAsFixed(0)}k';
    if (v == v.roundToDouble()) return v.toInt().toString();
    return v.toStringAsFixed(1);
  }

  void _drawLabel(Canvas canvas, Offset center, double radius, double angle, String text) {
    final labelR = radius + 33;
    final pos = Offset(
      center.dx + math.cos(angle) * labelR,
      center.dy + math.sin(angle) * labelR,
    );
    final tp = TextPainter(
      text: TextSpan(text: text, style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280))),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(pos.dx - tp.width / 2, pos.dy - tp.height / 2));
  }

  void _drawNeedle(Canvas canvas, Offset center, double radius, double startAngle, double sweepAngle) {
    final angle = startAngle + percentage * sweepAngle;
    final tipR   = radius * 0.82;
    final tailR  = radius * 0.18;
    final tip    = Offset(center.dx + math.cos(angle) * tipR,  center.dy + math.sin(angle) * tipR);
    final tail   = Offset(center.dx - math.cos(angle) * tailR, center.dy - math.sin(angle) * tailR);

    canvas.drawLine(tail, tip, Paint()
      ..color = Colors.black.withOpacity(0.35)
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round);
    canvas.drawLine(tail, tip, Paint()
      ..color = const Color(0xFFE6EDF3)
      ..strokeWidth = 2.5
      ..strokeCap = StrokeCap.round);
  }

  void _drawCap(Canvas canvas, Offset center) {
    canvas.drawCircle(center, 8,   Paint()..color = const Color(0xFF1565C0));
    canvas.drawCircle(center, 5,   Paint()..color = const Color(0xFF4FC3F7));
    canvas.drawCircle(center, 2.5, Paint()..color = Colors.white.withOpacity(0.8));
  }

  @override
  bool shouldRepaint(_ArcPainter old) =>
      old.percentage != percentage || old.accentColor != accentColor;
}

// ─────────────────────────────────────────────────────────────────────────────
// _BarGauge
// ─────────────────────────────────────────────────────────────────────────────

class _BarGauge extends StatelessWidget {
  final double pct, value, min, max;
  final String unit, label;
  final Color color;
  final int decimals;

  const _BarGauge({
    required this.pct, required this.value,
    required this.min, required this.max,
    required this.unit, required this.label,
    required this.color, required this.decimals,
  });

  @override
  Widget build(BuildContext context) {
    final valueStr = value.toStringAsFixed(decimals);

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF21262D)),
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF0F1623), Color(0xFF0A0E1A)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 14),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (label.isNotEmpty)
                Expanded(
                  child: Text(label,
                      style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
                      overflow: TextOverflow.ellipsis),
                ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(valueStr,
                      style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: color)),
                  if (unit.isNotEmpty) ...[
                    const SizedBox(width: 3),
                    Text(unit, style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
                  ],
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Stack(children: [
            Container(
              height: 10,
              decoration: BoxDecoration(
                color: const Color(0xFF1C2430),
                borderRadius: BorderRadius.circular(5),
              ),
            ),
            FractionallySizedBox(
              widthFactor: pct.clamp(0.0, 1.0),
              child: Container(
                height: 10,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(5),
                  gradient: LinearGradient(colors: [color.withOpacity(0.6), color]),
                  boxShadow: [BoxShadow(color: color.withOpacity(0.35), blurRadius: 4)],
                ),
              ),
            ),
          ]),
          const SizedBox(height: 5),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('${min.toStringAsFixed(decimals)} $unit',
                  style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280))),
              Text('${max.toStringAsFixed(decimals)} $unit',
                  style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280))),
            ],
          ),
        ],
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SensorCard
// ─────────────────────────────────────────────────────────────────────────────

class SensorCard extends StatelessWidget {
  final String path;
  final String alias;
  final SensorCardStyle cardStyle;
  final Color color;
  final List<String> showFields;
  final List<String> hideFields;
  final Map<String, dynamic>? sensorData;

  const SensorCard({
    super.key,
    required this.path,
    this.alias = '',
    this.cardStyle = SensorCardStyle.card,
    this.color = const Color(0xFF64FFDA),
    this.showFields = const [],
    this.hideFields = const [],
    this.sensorData,
  });

  String get _displayName {
    if (alias.isNotEmpty) return alias;
    final raw = sensorData?['name'] as String? ?? path;
    final parts = raw.split(' › ');
    return parts.reversed.take(2).toList().reversed.join(' › ');
  }

  List<MapEntry<String, dynamic>> _filteredValues() {
    final values = (sensorData?['values'] as Map<String, dynamic>?) ?? {};
    var entries = values.entries
        .where((e) => e.value is num || e.value is String)
        .toList();
    if (showFields.isNotEmpty) {
      entries = entries.where((e) => showFields.contains(e.key)).toList();
    }
    if (hideFields.isNotEmpty) {
      entries = entries.where((e) => !hideFields.contains(e.key)).toList();
    }
    return entries;
  }

  Color get _statusColor {
    final status = sensorData?['status'] as String? ?? 'offline';
    return status == 'online'
        ? const Color(0xFF2ECC71)
        : status == 'standby'
            ? Colors.orange
            : const Color(0xFFE74C3C);
  }

  static String _fmt(dynamic v) {
    if (v is double) return v.toStringAsFixed(v.abs() >= 100 ? 0 : 1);
    if (v is int) return v.toString();
    if (v is String) {
      final d = double.tryParse(v.trim());
      if (d != null) return d.toStringAsFixed(d.abs() >= 100 ? 0 : 1);
      return v.trim();
    }
    return v?.toString() ?? '—';
  }

  @override
  Widget build(BuildContext context) {
    final entries = _filteredValues();
    final statusColor = _statusColor;

    if (cardStyle == SensorCardStyle.hero) {
      return _buildHero(entries, statusColor);
    }
    return _buildCard(entries, statusColor);
  }

  Widget _buildCard(List<MapEntry<String, dynamic>> entries, Color statusColor) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF21262D)),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(statusColor),
          const SizedBox(height: 8),
          entries.isEmpty
              ? const Text('—', style: TextStyle(fontSize: 20, color: Color(0xFF444C56)))
              : Wrap(
                  spacing: 16,
                  runSpacing: 6,
                  children: entries
                      .map((e) => _ValueChip(fieldName: e.key, value: e.value, color: color))
                      .toList(),
                ),
        ],
      ),
    );
  }

  Widget _buildHero(List<MapEntry<String, dynamic>> entries, Color statusColor) {
    final primary   = entries.isNotEmpty ? entries.first : null;
    final secondary = entries.length > 1 ? entries.sublist(1) : const <MapEntry<String, dynamic>>[];

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF21262D)),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _header(statusColor),
          if (primary != null) ...[
            const SizedBox(height: 6),
            Text(
              _fmt(primary.value),
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: color),
            ),
            Text(primary.key,
                style: const TextStyle(fontSize: 10, color: Color(0xFF6B7280))),
          ],
          if (secondary.isNotEmpty) ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 16,
              runSpacing: 4,
              children: secondary
                  .map((e) => _ValueChip(fieldName: e.key, value: e.value, color: color))
                  .toList(),
            ),
          ],
        ],
      ),
    );
  }

  Widget _header(Color statusColor) => Row(children: [
        Container(
          width: 7, height: 7,
          decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
        ),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            _displayName,
            style: const TextStyle(fontSize: 12, color: Color(0xFF8B949E)),
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ]);
}

class _ValueChip extends StatelessWidget {
  final String fieldName;
  final dynamic value;
  final Color color;

  const _ValueChip({required this.fieldName, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          SensorCard._fmt(value),
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600, color: color),
        ),
        Text(fieldName, style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280))),
      ],
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HorizonWidget  (artificial horizon / attitude indicator)
// ─────────────────────────────────────────────────────────────────────────────

class HorizonWidget extends StatefulWidget {
  final double roll;   // degrees, positive = starboard roll
  final double pitch;  // degrees, positive = bow up

  const HorizonWidget({super.key, required this.roll, required this.pitch});

  @override
  State<HorizonWidget> createState() => _HorizonWidgetState();
}

class _HorizonWidgetState extends State<HorizonWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _rollAnim;
  late Animation<double> _pitchAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500));
    _rollAnim = Tween<double>(begin: widget.roll, end: widget.roll)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
    _pitchAnim = Tween<double>(begin: widget.pitch, end: widget.pitch)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
  }

  @override
  void didUpdateWidget(HorizonWidget old) {
    super.didUpdateWidget(old);
    if (old.roll != widget.roll || old.pitch != widget.pitch) {
      _rollAnim = Tween<double>(begin: _rollAnim.value, end: widget.roll)
          .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
      _pitchAnim = Tween<double>(begin: _pitchAnim.value, end: widget.pitch)
          .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeOut));
      _ctrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) =>
          _HorizonDisplay(roll: _rollAnim.value, pitch: _pitchAnim.value),
    );
  }
}

class _HorizonDisplay extends StatelessWidget {
  final double roll, pitch;
  const _HorizonDisplay({required this.roll, required this.pitch});

  @override
  Widget build(BuildContext context) {
    final rs = roll  >= 0 ? '+' : '';
    final ps = pitch >= 0 ? '+' : '';
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF21262D)),
        gradient: const LinearGradient(
          begin: Alignment.topLeft, end: Alignment.bottomRight,
          colors: [Color(0xFF0A0E1A), Color(0xFF0D1117)],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 8),
      child: Column(
        children: [
          const Text('Lage',
              style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
          const SizedBox(height: 4),
          Expanded(
            child: LayoutBuilder(builder: (_, bc) {
              final dim = math.min(bc.maxWidth, bc.maxHeight);
              return Center(
                child: SizedBox.square(
                  dimension: dim,
                  child: CustomPaint(
                      painter: _HorizonPainter(roll: roll, pitch: pitch)),
                ),
              );
            }),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _val('$rs${roll.toStringAsFixed(1)}°', 'Roll'),
              const SizedBox(width: 20),
              _val('$ps${pitch.toStringAsFixed(1)}°', 'Pitch'),
            ],
          ),
          const SizedBox(height: 2),
        ],
      ),
    );
  }

  Widget _val(String v, String label) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(v,
              style: const TextStyle(
                  fontSize: 13, fontWeight: FontWeight.bold,
                  color: Color(0xFF4FC3F7), fontFamily: 'monospace')),
          Text(label,
              style: const TextStyle(fontSize: 9, color: Color(0xFF6B7280))),
        ],
      );
}

// ─────────────────────────────────────────────────────────────────────────────
// _HorizonPainter
// ─────────────────────────────────────────────────────────────────────────────

class _HorizonPainter extends CustomPainter {
  final double roll, pitch;
  const _HorizonPainter({required this.roll, required this.pitch});

  static const double _kDegPerR = 30.0;

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final r  = math.min(cx, cy) - 14.0;
    if (r < 10) return;

    final rollRad = roll  * math.pi / 180;
    final pitchPx = pitch * r / _kDegPerR;
    final bigR    = r * 2.4;
    final c       = Offset(cx, cy);

    // ── Clip + rotating sky/sea ───────────────────────────────────────────────
    canvas.save();
    canvas.clipPath(Path()..addOval(Rect.fromCircle(center: c, radius: r)));

    canvas.save();
    canvas.translate(cx, cy);
    canvas.rotate(rollRad);
    canvas.translate(0, pitchPx);

    // Sky gradient
    final skyRect = Rect.fromLTWH(-bigR, -bigR * 2, bigR * 2, bigR * 2);
    canvas.drawRect(skyRect, Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFF051220), Color(0xFF1565C0)],
      ).createShader(skyRect));

    // Sea gradient
    final seaRect = Rect.fromLTWH(-bigR, 0, bigR * 2, bigR * 2);
    canvas.drawRect(seaRect, Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter, end: Alignment.bottomCenter,
        colors: [Color(0xFF0C4F72), Color(0xFF020B18)],
      ).createShader(seaRect));

    // Pitch scale lines
    _drawPitchLines(canvas, r);

    // Horizon glow
    canvas.drawLine(Offset(-bigR, 0), Offset(bigR, 0), Paint()
      ..color = Colors.white.withOpacity(0.18)
      ..strokeWidth = 7
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3));
    // Horizon line
    canvas.drawLine(Offset(-bigR, 0), Offset(bigR, 0), Paint()
      ..color = Colors.white.withOpacity(0.92)
      ..strokeWidth = 1.8);

    // Roll indicator triangle (rotates with horizon, no pitch offset)
    canvas.translate(0, -pitchPx);
    final triPath = Path()
      ..moveTo(0, -(r - 6))
      ..lineTo(-5, -(r - 16))
      ..lineTo(5,  -(r - 16))
      ..close();
    canvas.drawPath(triPath, Paint()
      ..color = Colors.white.withOpacity(0.92)..style = PaintingStyle.fill);
    canvas.drawPath(triPath, Paint()
      ..color = Colors.black.withOpacity(0.4)
      ..style = PaintingStyle.stroke..strokeWidth = 1.0);

    canvas.restore(); // end rotate+pitch
    canvas.restore(); // end clip

    // ── Roll scale (outside clip, around rim) ─────────────────────────────────
    _drawRollScale(canvas, c, r);

    // ── Bezel ring ────────────────────────────────────────────────────────────
    canvas.drawCircle(c, r, Paint()
      ..color = const Color(0xFF1E3A5F)
      ..style = PaintingStyle.stroke..strokeWidth = 2.5);

    // ── Fixed reticle (re-clipped) ────────────────────────────────────────────
    canvas.save();
    canvas.clipPath(
        Path()..addOval(Rect.fromCircle(center: c, radius: r - 1)));
    _drawFixedReticle(canvas, c, r);
    canvas.restore();
  }

  void _drawPitchLines(Canvas canvas, double r) {
    final pxPerDeg = r / _kDegPerR;
    final major = Paint()
      ..color = Colors.white.withOpacity(0.55)..strokeWidth = 1.5;
    final minor = Paint()
      ..color = Colors.white.withOpacity(0.28)..strokeWidth = 1.0;

    for (int deg = -60; deg <= 60; deg += 5) {
      if (deg == 0) continue;
      final y  = -deg * pxPerDeg;
      final isMajor = deg % 10 == 0;
      final hl = isMajor ? r * 0.28 : r * 0.14;
      canvas.drawLine(Offset(-hl, y), Offset(hl, y), isMajor ? major : minor);
      if (isMajor) {
        final tp = TextPainter(
          text: TextSpan(
              text: deg.abs().toString(),
              style: const TextStyle(fontSize: 9, color: Color(0xBBFFFFFF))),
          textDirection: TextDirection.ltr,
        )..layout();
        tp.paint(canvas, Offset(hl + 3, y - tp.height / 2));
        tp.paint(canvas, Offset(-hl - tp.width - 3, y - tp.height / 2));
      }
    }
  }

  void _drawRollScale(Canvas canvas, Offset c, double r) {
    const kAngles = [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60];
    for (final deg in kAngles) {
      final rad     = (deg - 90.0) * math.pi / 180;
      final isMajor = deg % 30 == 0 || deg == 0;
      final len     = isMajor ? 9.0 : 5.5;
      final inner   = r + 2.0;
      final outer   = inner + len;
      canvas.drawLine(
        Offset(c.dx + math.cos(rad) * inner, c.dy + math.sin(rad) * inner),
        Offset(c.dx + math.cos(rad) * outer, c.dy + math.sin(rad) * outer),
        Paint()
          ..color = Colors.white.withOpacity(isMajor ? 0.65 : 0.38)
          ..strokeWidth = isMajor ? 1.5 : 1.0,
      );
    }
    // Fixed 0° reference marker (downward-pointing triangle at 12 o'clock)
    final topY = c.dy - r - 2;
    final fixPath = Path()
      ..moveTo(c.dx, topY + 12)
      ..lineTo(c.dx - 5, topY + 2)
      ..lineTo(c.dx + 5, topY + 2)
      ..close();
    canvas.drawPath(fixPath, Paint()..color = Colors.white.withOpacity(0.80));
  }

  void _drawFixedReticle(Canvas canvas, Offset c, double r) {
    final shadow = Paint()
      ..color = Colors.black.withOpacity(0.35)
      ..strokeWidth = 3.0
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final white = Paint()
      ..color = Colors.white.withOpacity(0.60)
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;
    final fill = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..style = PaintingStyle.fill;

    // Boat silhouette — front/cross-section view
    // center c.dy ≈ waterline, hull above + keel below
    final hw = r * 0.44;             // half-width at gunwale
    final gY = c.dy - r * 0.14;     // gunwale Y (deck level)
    final kY = c.dy + r * 0.22;     // keel Y
    final cHW = r * 0.15;           // cabin half-width
    final cT = gY - r * 0.20;       // cabin top Y
    final mY = cT - r * 0.16;       // mast top Y

    // Hull V-shape: gunwale → bilge → keel → bilge → gunwale (closed for fill)
    final hullFill = Path()
      ..moveTo(c.dx - hw,          gY)
      ..lineTo(c.dx - hw * 0.50,  kY)
      ..lineTo(c.dx,               kY + r * 0.06)
      ..lineTo(c.dx + hw * 0.50,  kY)
      ..lineTo(c.dx + hw,          gY)
      ..close();

    // Hull outline (open — same V without closing line)
    final hull = Path()
      ..moveTo(c.dx - hw,          gY)
      ..lineTo(c.dx - hw * 0.50,  kY)
      ..lineTo(c.dx,               kY + r * 0.06)
      ..lineTo(c.dx + hw * 0.50,  kY)
      ..lineTo(c.dx + hw,          gY);

    // Deck line (horizontal top of hull)
    final deck = Path()
      ..moveTo(c.dx - hw, gY)
      ..lineTo(c.dx + hw, gY);

    // Cabin: trapezoid
    final cabin = Path()
      ..moveTo(c.dx - cHW * 1.4,  gY)
      ..lineTo(c.dx - cHW,         cT)
      ..lineTo(c.dx + cHW,         cT)
      ..lineTo(c.dx + cHW * 1.4,  gY);

    // Mast / antenna
    final mast = Path()
      ..moveTo(c.dx, cT)
      ..lineTo(c.dx, mY);

    // Fill hull body first
    canvas.drawPath(hullFill, fill);

    // Shadow pass then white pass
    for (final p in [hull, deck, cabin, mast]) canvas.drawPath(p, shadow);
    for (final p in [hull, deck, cabin, mast]) canvas.drawPath(p, white);

    // Waterline marker (center dot)
    canvas.drawCircle(c, 6, Paint()
      ..color = Colors.black.withOpacity(0.5)
      ..style = PaintingStyle.stroke..strokeWidth = 4);
    canvas.drawCircle(c, 6, Paint()
      ..color = Colors.white.withOpacity(0.90)
      ..style = PaintingStyle.stroke..strokeWidth = 2);
    canvas.drawCircle(c, 2.5, Paint()..color = Colors.white);
  }

  @override
  bool shouldRepaint(_HorizonPainter old) =>
      old.roll != roll || old.pitch != pitch;
}
