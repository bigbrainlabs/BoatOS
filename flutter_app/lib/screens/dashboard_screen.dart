import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../services/settings_service.dart';
import '../widgets/gauge_widget.dart';

// ─────────────────────────────────────────────────────────────────────────────
// DSL data models
// ─────────────────────────────────────────────────────────────────────────────

enum _WidgetType { gauge, sensor }

class _GaugeCfg {
  final String path;
  final double min, max;
  final String unit, label;
  final GaugeStyle style;
  final Color color;
  final int decimals, size;

  const _GaugeCfg({
    required this.path, required this.min, required this.max,
    required this.unit, required this.label, required this.style,
    required this.color, required this.decimals, required this.size,
  });
}

class _SensorCfg {
  final String path, alias;
  final SensorCardStyle style;
  final Color color;
  final int size;
  final List<String> show, hide;

  const _SensorCfg({
    required this.path, required this.alias, required this.style,
    required this.color, required this.size,
    this.show = const [], this.hide = const [],
  });
}

class _DashWidget {
  final _WidgetType type;
  final _GaugeCfg? gauge;
  final _SensorCfg? sensor;

  int get size => type == _WidgetType.gauge ? gauge!.size : sensor!.size;

  const _DashWidget.gauge(_GaugeCfg cfg) : type = _WidgetType.gauge, gauge = cfg, sensor = null;
  const _DashWidget.sensor(_SensorCfg cfg) : type = _WidgetType.sensor, gauge = null, sensor = cfg;
}

class _Layout {
  final int columns;
  final List<_DashWidget> widgets;
  const _Layout({required this.columns, required this.widgets});
}

// ─────────────────────────────────────────────────────────────────────────────
// DSL parser
// ─────────────────────────────────────────────────────────────────────────────

_Layout _parseDSL(String dsl) {
  int columns = 3;
  final widgets = <_DashWidget>[];

  for (final rawLine in dsl.split('\n')) {
    final line = rawLine.trim();
    if (line.isEmpty || line.startsWith('ROW') || line.startsWith('#')) continue;

    final tokens = _tokenize(line);
    if (tokens.isEmpty) continue;

    switch (tokens[0].toUpperCase()) {
      case 'GRID':
        if (tokens.length > 1) columns = int.tryParse(tokens[1]) ?? 3;
      case 'GAUGE':
        if (tokens.length > 1) widgets.add(_DashWidget.gauge(_parseGauge(tokens)));
      case 'SENSOR':
        if (tokens.length > 1) widgets.add(_DashWidget.sensor(_parseSensor(tokens)));
    }
  }
  return _Layout(columns: columns, widgets: widgets);
}

List<String> _tokenize(String line) {
  final tokens = <String>[];
  final buf = StringBuffer();
  bool inQuote = false;
  for (final c in line.split('')) {
    if (c == '"') {
      inQuote = !inQuote;
    } else if (c == ' ' && !inQuote) {
      if (buf.isNotEmpty) { tokens.add(buf.toString()); buf.clear(); }
    } else {
      buf.write(c);
    }
  }
  if (buf.isNotEmpty) tokens.add(buf.toString());
  return tokens;
}

_GaugeCfg _parseGauge(List<String> t) {
  final path = t[1];
  double min = 0, max = 100;
  String unit = '', label = '';
  GaugeStyle style = GaugeStyle.arc270;
  int decimals = 1, size = 1;
  Color color = parseDashColor('cyan');

  for (int i = 2; i < t.length - 1; i += 2) {
    final k = t[i].toUpperCase();
    final v = t[i + 1];
    switch (k) {
      case 'MIN':      min      = double.tryParse(v) ?? 0;
      case 'MAX':      max      = double.tryParse(v) ?? 100;
      case 'UNIT':     unit     = v;
      case 'LABEL':    label    = v;
      case 'DECIMALS': decimals = int.tryParse(v) ?? 1;
      case 'SIZE':     size     = int.tryParse(v) ?? 1;
      case 'COLOR':    color    = parseDashColor(v);
      case 'STYLE':
        switch (v.toLowerCase()) {
          case 'arc180': style = GaugeStyle.arc180;
          case 'arc270': style = GaugeStyle.arc270;
          case 'arc360': style = GaugeStyle.arc360;
          case 'bar':    style = GaugeStyle.bar;
        }
    }
  }
  return _GaugeCfg(path: path, min: min, max: max, unit: unit, label: label,
      style: style, color: color, decimals: decimals, size: size);
}

_SensorCfg _parseSensor(List<String> t) {
  final path = t[1];
  String alias = '';
  SensorCardStyle style = SensorCardStyle.card;
  Color color = parseDashColor('cyan');
  int size = 1;
  List<String> show = [], hide = [];

  for (int i = 2; i < t.length - 1; i += 2) {
    final k = t[i].toUpperCase();
    final v = t[i + 1];
    switch (k) {
      case 'ALIAS': alias = v;
      case 'SIZE':  size  = int.tryParse(v) ?? 1;
      case 'COLOR': color = parseDashColor(v);
      case 'SHOW':  show  = v.split(',').map((s) => s.trim()).toList();
      case 'HIDE':  hide  = v.split(',').map((s) => s.trim()).toList();
      case 'STYLE':
        switch (v.toLowerCase()) {
          case 'hero':    style = SensorCardStyle.hero;
          case 'compact': style = SensorCardStyle.compact;
          default:        style = SensorCardStyle.card;
        }
    }
  }
  return _SensorCfg(path: path, alias: alias, style: style,
      color: color, size: size, show: show, hide: hide);
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensor value lookup
// ─────────────────────────────────────────────────────────────────────────────

double _getValue(Map<String, dynamic> sensors, String path) {
  // Direct base_name match
  if (sensors.containsKey(path)) {
    final values = sensors[path]['values'] as Map<String, dynamic>? ?? {};
    for (final v in values.values) {
      if (v is num) return v.toDouble();
      if (v is String) { final d = double.tryParse(v.trim()); if (d != null) return d; }
    }
    return 0;
  }
  // base_name/field match
  for (final entry in sensors.entries) {
    final base = entry.key as String;
    if (path.startsWith('$base/')) {
      final field = path.substring(base.length + 1);
      final values = entry.value['values'] as Map<String, dynamic>? ?? {};
      final raw = values[field];
      if (raw is num) return raw.toDouble();
      if (raw is String) return double.tryParse(raw.trim()) ?? 0;
      return 0;
    }
  }
  return 0;
}

String _getSensorLabel(Map<String, dynamic> sensors, String path) {
  final sensor = sensors[path];
  if (sensor == null) return path.split('/').last;
  final name = sensor['name'] as String? ?? path;
  final parts = name.split(' › ');
  return parts.reversed.take(2).toList().reversed.join(' › ');
}

// ─────────────────────────────────────────────────────────────────────────────
// DashboardScreen
// ─────────────────────────────────────────────────────────────────────────────

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  static const _base = 'http://localhost:8000';

  Timer? _timer;
  Map<String, dynamic> _sensors = {};
  bool _firstLoad = true;

  @override
  void initState() {
    super.initState();
    _fetchSensors();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _fetchSensors());
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _fetchSensors() async {
    try {
      final resp = await http
          .get(Uri.parse('$_base/api/sensors/list'))
          .timeout(const Duration(seconds: 5));
      if (resp.statusCode == 200) {
        final data = json.decode(resp.body) as Map<String, dynamic>;
        final list = (data['sensors'] as List<dynamic>? ?? []);
        final map = <String, dynamic>{};
        for (final s in list) {
          final m = s as Map<String, dynamic>;
          map[m['base_name'] as String] = m;
        }
        if (mounted) setState(() { _sensors = map; _firstLoad = false; });
      }
    } catch (_) {
      if (mounted && _firstLoad) setState(() => _firstLoad = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsService>();
    final dsl = settings.raw['dashboard_layout'] as String? ?? '';

    if (_firstLoad) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF4FC3F7)));
    }

    if (dsl.isEmpty) {
      return const Center(
        child: Text('Kein Dashboard-Layout konfiguriert.',
            style: TextStyle(color: Color(0xFF8B949E))),
      );
    }

    final layout = _parseDSL(dsl);
    if (layout.widgets.isEmpty) {
      return const Center(
        child: Text('Keine Widgets im Layout.',
            style: TextStyle(color: Color(0xFF8B949E))),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
      child: LayoutBuilder(builder: (ctx, constraints) {
        final gap = 10.0;
        final totalW = constraints.maxWidth;
        final colW = (totalW - gap * (layout.columns - 1)) / layout.columns;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: layout.widgets.map((w) {
            final span = w.size.clamp(1, layout.columns);
            final itemW = colW * span + gap * (span - 1);
            return SizedBox(
              width: itemW,
              child: _buildWidget(w),
            );
          }).toList(),
        );
      }),
    );
  }

  Widget _buildWidget(_DashWidget w) {
    if (w.type == _WidgetType.gauge) {
      final cfg = w.gauge!;
      final value = _getValue(_sensors, cfg.path);
      final autoLabel = cfg.label.isNotEmpty
          ? cfg.label
          : _getSensorLabel(_sensors, cfg.path);
      return GaugeWidget(
        value: value,
        min: cfg.min, max: cfg.max,
        unit: cfg.unit, label: autoLabel,
        style: cfg.style, color: cfg.color,
        decimals: cfg.decimals,
      );
    } else {
      final cfg = w.sensor!;
      return SensorCard(
        path: cfg.path,
        alias: cfg.alias,
        cardStyle: cfg.style,
        color: cfg.color,
        showFields: cfg.show,
        hideFields: cfg.hide,
        sensorData: _sensors[cfg.path],
      );
    }
  }
}
