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

enum _WidgetType { gauge, sensor, text, clock, spacer, compass, horizon }

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

class _SimpleCfg {
  final int size;
  final String text;
  const _SimpleCfg({this.size = 1, this.text = ''});
}

class _HorizonCfg {
  final String path;
  final int size;
  const _HorizonCfg({required this.path, this.size = 1});
}

class _DashWidget {
  final _WidgetType type;
  final _GaugeCfg? gauge;
  final _SensorCfg? sensor;
  final _SimpleCfg? simple;
  final _HorizonCfg? horizonCfg;

  int get size {
    if (type == _WidgetType.gauge)   return gauge!.size;
    if (type == _WidgetType.sensor)  return sensor!.size;
    if (type == _WidgetType.horizon) return horizonCfg!.size;
    return simple?.size ?? 1;
  }

  const _DashWidget.gauge(_GaugeCfg cfg)
      : type = _WidgetType.gauge, gauge = cfg, sensor = null, simple = null, horizonCfg = null;
  const _DashWidget.sensor(_SensorCfg cfg)
      : type = _WidgetType.sensor, gauge = null, sensor = cfg, simple = null, horizonCfg = null;
  const _DashWidget.simple(_WidgetType t, _SimpleCfg cfg)
      : type = t, gauge = null, sensor = null, simple = cfg, horizonCfg = null;
  const _DashWidget.horizon(_HorizonCfg cfg)
      : type = _WidgetType.horizon, gauge = null, sensor = null, simple = null, horizonCfg = cfg;
}

class _LayoutRow {
  final int height;
  final List<_DashWidget> widgets;
  const _LayoutRow({this.height = 1, required this.widgets});
}

class _Layout {
  final int columns;
  final List<_LayoutRow> rows;
  const _Layout({required this.columns, required this.rows});
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN/LAYOUT template models
// ─────────────────────────────────────────────────────────────────────────────

class _TemplateInfo {
  final String id, cols, rows, areas;
  const _TemplateInfo({required this.id, required this.cols, required this.rows, required this.areas});
}

class _DashScreen {
  final String name;
  final String layoutId;
  final _TemplateInfo template;
  final Map<String, _DashWidget> widgets; // slot letter → widget
  const _DashScreen({required this.name, required this.layoutId, required this.template, required this.widgets});
}

const _kTemplates = <String, _TemplateInfo>{
  'full':        _TemplateInfo(id: 'full',        cols: '1fr',         rows: '1fr',         areas: 'A'),
  'split-h':     _TemplateInfo(id: 'split-h',     cols: '1fr 1fr',     rows: '1fr',         areas: 'A B'),
  'split-v':     _TemplateInfo(id: 'split-v',     cols: '1fr',         rows: '1fr 1fr',     areas: 'A\nB'),
  'thirds-h':    _TemplateInfo(id: 'thirds-h',    cols: '1fr 1fr 1fr', rows: '1fr',         areas: 'A B C'),
  'hero-right':  _TemplateInfo(id: 'hero-right',  cols: '2fr 1fr',     rows: '1fr 1fr',     areas: 'A B\nA C'),
  'hero-left':   _TemplateInfo(id: 'hero-left',   cols: '1fr 2fr',     rows: '1fr 1fr',     areas: 'B A\nC A'),
  'hero-top':    _TemplateInfo(id: 'hero-top',    cols: '1fr 1fr',     rows: '2fr 1fr',     areas: 'A A\nB C'),
  'hero-bottom': _TemplateInfo(id: 'hero-bottom', cols: '1fr 1fr',     rows: '1fr 2fr',     areas: 'B C\nA A'),
  'grid-4':      _TemplateInfo(id: 'grid-4',      cols: '1fr 1fr',     rows: '1fr 1fr',     areas: 'A B\nC D'),
  'mosaic-4':    _TemplateInfo(id: 'mosaic-4',    cols: '2fr 1fr',     rows: '1fr 1fr 1fr', areas: 'A B\nA C\nA D'),
  'grid-6':      _TemplateInfo(id: 'grid-6',      cols: '1fr 1fr 1fr', rows: '1fr 1fr',     areas: 'A B C\nD E F'),
  'mosaic-5':    _TemplateInfo(id: 'mosaic-5',    cols: '2fr 1fr 1fr', rows: '1fr 1fr',     areas: 'A B C\nA D E'),
};

// ─────────────────────────────────────────────────────────────────────────────
// DSL parser (old ROW/GRID format)
// ─────────────────────────────────────────────────────────────────────────────

_Layout _parseDSL(String dsl) {
  int columns = 3;
  final rows = <_LayoutRow>[];
  int currentHeight = 1;
  List<_DashWidget>? currentWidgets;

  void flushRow() {
    if (currentWidgets != null && currentWidgets.isNotEmpty) {
      rows.add(_LayoutRow(height: currentHeight, widgets: currentWidgets));
    }
  }

  for (final rawLine in dsl.split('\n')) {
    final line = rawLine.trim();
    if (line.isEmpty || line.startsWith('#')) continue;

    final tokens = _tokenize(line);
    if (tokens.isEmpty) continue;

    switch (tokens[0].toUpperCase()) {
      case 'GRID':
        if (tokens.length > 1) columns = int.tryParse(tokens[1]) ?? 3;
      case 'ROW':
        flushRow();
        currentHeight = 1;
        currentWidgets = [];
        for (int i = 1; i < tokens.length - 1; i++) {
          if (tokens[i].toUpperCase() == 'HEIGHT') {
            currentHeight = int.tryParse(tokens[i + 1]) ?? 1;
          }
        }
      case 'GAUGE':
        currentWidgets ??= [];
        if (tokens.length > 1) currentWidgets.add(_DashWidget.gauge(_parseGauge(tokens)));
      case 'SENSOR':
        currentWidgets ??= [];
        if (tokens.length > 1) currentWidgets.add(_DashWidget.sensor(_parseSensor(tokens)));
      case 'TEXT':
        currentWidgets ??= [];
        final text = tokens.length > 1 ? tokens[1] : '';
        int tSize = 1;
        for (int i = 2; i < tokens.length - 1; i += 2) {
          if (tokens[i].toUpperCase() == 'SIZE') tSize = int.tryParse(tokens[i + 1]) ?? 1;
        }
        currentWidgets.add(_DashWidget.simple(_WidgetType.text, _SimpleCfg(text: text, size: tSize)));
      case 'CLOCK':
      case 'SPACER':
      case 'COMPASS':
        currentWidgets ??= [];
        int sSize = 1;
        for (int i = 1; i < tokens.length - 1; i += 2) {
          if (tokens[i].toUpperCase() == 'SIZE') sSize = int.tryParse(tokens[i + 1]) ?? 1;
        }
        final sType = switch (tokens[0].toUpperCase()) {
          'CLOCK'   => _WidgetType.clock,
          'SPACER'  => _WidgetType.spacer,
          _         => _WidgetType.compass,
        };
        currentWidgets.add(_DashWidget.simple(sType, _SimpleCfg(size: sSize)));
      case 'HORIZON':
        currentWidgets ??= [];
        if (tokens.length > 1) {
          int hSize = 1;
          for (int i = 2; i < tokens.length - 1; i += 2) {
            if (tokens[i].toUpperCase() == 'SIZE') hSize = int.tryParse(tokens[i + 1]) ?? 1;
          }
          currentWidgets.add(_DashWidget.horizon(
              _HorizonCfg(path: tokens[1], size: hSize)));
        }
    }
  }
  flushRow();
  return _Layout(columns: columns, rows: rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN/LAYOUT DSL parser (new format)
// ─────────────────────────────────────────────────────────────────────────────

List<_DashScreen> _parseScreenDSL(String dsl) {
  final screens = <_DashScreen>[];
  String? currentName;
  String? currentLayoutId;
  Map<String, _DashWidget>? currentWidgets;

  void flushScreen() {
    final name = currentName;
    if (name != null) {
      final layoutId = currentLayoutId ?? 'full';
      final tmpl = _kTemplates[layoutId] ?? _kTemplates['full']!;
      screens.add(_DashScreen(
        name: name,
        layoutId: layoutId,
        template: tmpl,
        widgets: currentWidgets ?? {},
      ));
    }
  }

  for (final rawLine in dsl.split('\n')) {
    final line = rawLine.trim();
    if (line.isEmpty || line.startsWith('#')) continue;

    final tokens = _tokenize(line);
    if (tokens.isEmpty) continue;

    if (tokens[0].toUpperCase() == 'SCREEN') {
      flushScreen();
      currentName = tokens.length > 1 ? tokens[1] : 'Screen';
      currentLayoutId = 'full';
      currentWidgets = {};
      for (int i = 2; i < tokens.length - 1; i++) {
        if (tokens[i].toUpperCase() == 'LAYOUT') currentLayoutId = tokens[i + 1];
      }
    } else if (currentWidgets != null &&
        tokens[0].length == 1 &&
        RegExp(r'[A-Za-z]').hasMatch(tokens[0])) {
      // Slot assignment: "A  SENSOR ..." or "B  GAUGE ..."
      final slot = tokens[0].toUpperCase();
      // Re-tokenize from the rest of the line (after slot letter)
      final widgetLine = line.substring(tokens[0].length).trim();
      final wTokens = _tokenize(widgetLine);
      if (wTokens.isEmpty) continue;
      final widget = _parseWidgetFromTokens(wTokens);
      if (widget != null) currentWidgets[slot] = widget;
    }
  }
  flushScreen();
  return screens;
}

_DashWidget? _parseWidgetFromTokens(List<String> tokens) {
  if (tokens.isEmpty) return null;
  switch (tokens[0].toUpperCase()) {
    case 'SENSOR':
      if (tokens.length > 1) return _DashWidget.sensor(_parseSensor(tokens));
    case 'GAUGE':
      if (tokens.length > 1) return _DashWidget.gauge(_parseGauge(tokens));
    case 'HORIZON':
      if (tokens.length > 1) {
        int hSize = 1;
        for (int i = 2; i < tokens.length - 1; i += 2) {
          if (tokens[i].toUpperCase() == 'SIZE') hSize = int.tryParse(tokens[i + 1]) ?? 1;
        }
        return _DashWidget.horizon(_HorizonCfg(path: tokens[1], size: hSize));
      }
    case 'CLOCK':
      return _DashWidget.simple(_WidgetType.clock, const _SimpleCfg());
    case 'COMPASS':
      return _DashWidget.simple(_WidgetType.compass, const _SimpleCfg());
    case 'SPACER':
      return _DashWidget.simple(_WidgetType.spacer, const _SimpleCfg());
    case 'TEXT':
      return _DashWidget.simple(_WidgetType.text,
          _SimpleCfg(text: tokens.length > 1 ? tokens[1] : ''));
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer & sub-parsers
// ─────────────────────────────────────────────────────────────────────────────

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
      case 'AS':
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
    final base = entry.key;
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
  final PageController _pageCtrl = PageController();
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _fetchSensors();
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _fetchSensors());
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageCtrl.dispose();
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
  Widget build(BuildContext context) => _buildContent(context);

  Widget _buildContent(BuildContext context) {
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

    // Detect format: if first non-comment, non-empty line starts with 'SCREEN'
    bool isScreen = false;
    for (final line in dsl.split('\n')) {
      final t = line.trim();
      if (t.isEmpty || t.startsWith('#')) continue;
      isScreen = t.toUpperCase().startsWith('SCREEN');
      break;
    }

    if (isScreen) {
      // New SCREEN/LAYOUT format
      final screens = _parseScreenDSL(dsl);
      if (screens.isEmpty) {
        return const Center(
          child: Text('Keine Screens im Layout.',
              style: TextStyle(color: Color(0xFF8B949E))),
        );
      }
      return LayoutBuilder(
        builder: (ctx, bc) => _buildScreenLayout(screens, bc),
      );
    } else {
      // Existing old-format code (ROW/GRID)
      final layout = _parseDSL(dsl);
      if (layout.rows.isEmpty || layout.rows.every((r) => r.widgets.isEmpty)) {
        return const Center(
          child: Text('Keine Widgets im Layout.',
              style: TextStyle(color: Color(0xFF8B949E))),
        );
      }

      const double kBaseRowH = 160.0;
      const double gap = 10.0;
      const double kDotsH = 28.0;

      return LayoutBuilder(builder: (ctx, constraints) {
        final totalW = constraints.maxWidth - 24.0;
        final colW = (totalW - gap * (layout.columns - 1)) / layout.columns;

        // Flatten DSL rows into visual lines (each line = one row of widgets at a fixed height)
        final lineWidgets = <List<_DashWidget>>[];
        final lineHeights = <double>[];
        for (final row in layout.rows) {
          final rowH = kBaseRowH * row.height;
          var cur = <_DashWidget>[];
          var used = 0;
          for (final w in row.widgets) {
            final span = w.size.clamp(1, layout.columns);
            if (used + span > layout.columns && cur.isNotEmpty) {
              lineWidgets.add(cur); lineHeights.add(rowH);
              cur = [w]; used = span;
            } else { cur.add(w); used += span; }
          }
          if (cur.isNotEmpty) { lineWidgets.add(cur); lineHeights.add(rowH); }
        }

        // Group lines into pages — each page fits within available height
        final pageH = constraints.maxHeight - 24.0 - kDotsH;
        final pageStarts = <int>[];
        final pageEnds = <int>[];
        var si = 0;
        while (si < lineWidgets.length) {
          var usedH = 0.0;
          var ei = si;
          while (ei < lineWidgets.length) {
            final next = ei == si ? lineHeights[ei] : usedH + gap + lineHeights[ei];
            if (next > pageH && ei > si) break;
            usedH = next; ei++;
          }
          pageStarts.add(si);
          pageEnds.add(ei == si ? si + 1 : ei);
          si = pageEnds.last;
        }
        final pageCount = pageStarts.length;

        Widget buildLine(int li, bool isLast) => Padding(
          padding: EdgeInsets.only(bottom: isLast ? 0 : gap),
          child: SizedBox(
            height: lineHeights[li],
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: lineWidgets[li].asMap().entries.map((e) {
                final i = e.key;
                final w = e.value;
                final span = w.size.clamp(1, layout.columns);
                return Padding(
                  padding: EdgeInsets.only(left: i > 0 ? gap : 0),
                  child: SizedBox(
                    width: colW * span + gap * (span - 1),
                    child: _buildWidget(w),
                  ),
                );
              }).toList(),
            ),
          ),
        );

        Widget buildPage(int p) {
          final s = pageStarts[p];
          final e = pageEnds[p];
          return Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: List.generate(e - s, (i) => buildLine(s + i, i == e - s - 1)),
            ),
          );
        }

        if (pageCount <= 1) {
          return SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 80),
            child: pageCount == 0 ? const SizedBox() : buildPage(0),
          );
        }

        // Reset page index if DSL changed and pages decreased
        if (_currentPage >= pageCount) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) { _pageCtrl.jumpToPage(0); setState(() => _currentPage = 0); }
          });
        }

        return Column(
          children: [
            Expanded(
              child: PageView.builder(
                controller: _pageCtrl,
                itemCount: pageCount,
                onPageChanged: (p) => setState(() => _currentPage = p),
                itemBuilder: (_, p) => buildPage(p),
              ),
            ),
            _buildDots(pageCount, _currentPage.clamp(0, pageCount - 1)),
          ],
        );
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREEN/LAYOUT rendering
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildScreenLayout(List<_DashScreen> screens, BoxConstraints constraints) {
    if (screens.length == 1) {
      return _buildOneScreen(screens[0], constraints);
    }

    // Reset page index if screen count decreased
    if (_currentPage >= screens.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) { _pageCtrl.jumpToPage(0); setState(() => _currentPage = 0); }
      });
    }

    return Column(children: [
      Expanded(
        child: PageView.builder(
          controller: _pageCtrl,
          itemCount: screens.length,
          onPageChanged: (p) => setState(() => _currentPage = p),
          itemBuilder: (_, i) => _buildOneScreen(screens[i], constraints),
        ),
      ),
      _buildScreenDots(screens),
    ]);
  }

  Widget _buildOneScreen(_DashScreen screen, BoxConstraints constraints) {
    return Padding(
      padding: const EdgeInsets.all(8.0),
      child: LayoutBuilder(
        builder: (ctx, bc) => _buildTemplateGrid(
          screen,
          Size(bc.maxWidth, bc.maxHeight),
        ),
      ),
    );
  }

  Widget _buildTemplateGrid(_DashScreen screen, Size size) {
    const gap = 10.0;
    final tmpl = screen.template;

    final colFracs = _parseFrList(tmpl.cols);
    final rowFracs = _parseFrList(tmpl.rows);
    final numCols = colFracs.length;
    final numRows = rowFracs.length;

    final areaRows = tmpl.areas
        .split('\n')
        .map((r) => r.trim().split(RegExp(r'\s+')))
        .toList();

    final totalW = size.width  - gap * (numCols - 1);
    final totalH = size.height - gap * (numRows - 1);

    final colWidths  = colFracs.map((f) => f * totalW).toList();
    final rowHeights = rowFracs.map((f) => f * totalH).toList();

    // Cumulative x/y positions (one extra entry = right/bottom edge)
    final colX = <double>[0.0];
    for (int i = 0; i < numCols; i++) { colX.add(colX.last + colWidths[i] + gap); }
    final rowY = <double>[0.0];
    for (int i = 0; i < numRows; i++) { rowY.add(rowY.last + rowHeights[i] + gap); }

    final children = <Widget>[];
    final processedSlots = <String>{};

    for (int r = 0; r < areaRows.length && r < numRows; r++) {
      final row = areaRows[r];
      for (int c = 0; c < row.length && c < numCols; c++) {
        final slot = row[c].toUpperCase();
        if (processedSlots.contains(slot)) continue;
        processedSlots.add(slot);

        // Find bounding box of this slot across all area cells
        int minC = numCols, maxC = 0, minR = numRows, maxR = 0;
        for (int rr = 0; rr < areaRows.length && rr < numRows; rr++) {
          final rrow = areaRows[rr];
          for (int cc = 0; cc < rrow.length && cc < numCols; cc++) {
            if (rrow[cc].toUpperCase() == slot) {
              if (cc < minC) minC = cc;
              if (cc + 1 > maxC) maxC = cc + 1;
              if (rr < minR) minR = rr;
              if (rr + 1 > maxR) maxR = rr + 1;
            }
          }
        }

        if (maxC <= minC || maxR <= minR) continue;

        final left   = colX[minC];
        final top    = rowY[minR];
        final right  = colX[maxC - 1] + colWidths[maxC - 1];
        final bottom = rowY[maxR - 1] + rowHeights[maxR - 1];
        final w = right - left;
        final h = bottom - top;

        final widget = screen.widgets[slot];
        if (widget == null) {
          // Empty slot — invisible placeholder
          continue;
        }

        children.add(Positioned(
          left: left, top: top, width: w, height: h,
          child: ClipRect(
            child: SizedBox(
              width: w, height: h,
              child: _buildWidget(widget, slotHeight: h),
            ),
          ),
        ));
      }
    }

    return SizedBox(
      width: size.width,
      height: size.height,
      child: Stack(children: children),
    );
  }

  List<double> _parseFrList(String frStr) {
    final trimmed = frStr.trim();
    if (trimmed.isEmpty) return [1.0];
    final parts = trimmed.split(RegExp(r'\s+'));
    final values = parts.map((p) {
      if (p.endsWith('fr')) return double.tryParse(p.replaceAll('fr', '')) ?? 1.0;
      return 1.0;
    }).toList();
    final total = values.fold(0.0, (a, b) => a + b);
    return total > 0 ? values.map((v) => v / total).toList() : [1.0];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Dots indicators
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildDots(int count, int current) {
    return SizedBox(
      height: 28,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(count, (i) {
          final active = i == current;
          return AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: active ? 20.0 : 8.0,
            height: 8.0,
            margin: const EdgeInsets.symmetric(horizontal: 3),
            decoration: BoxDecoration(
              color: active ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
              borderRadius: BorderRadius.circular(4),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildScreenDots(List<_DashScreen> screens) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: screens.asMap().entries.map((e) {
        final isActive = e.key == _currentPage;
        final name = e.value.name;
        final label = name.length > 5 ? name.substring(0, 5) : name;
        return GestureDetector(
          onTap: () => _pageCtrl.animateToPage(
            e.key,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          ),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            width: isActive ? 40 : 8,
            height: 8,
            decoration: BoxDecoration(
              color: isActive ? const Color(0xFF4FC3F7) : Colors.white24,
              borderRadius: BorderRadius.circular(4),
            ),
            alignment: Alignment.center,
            child: isActive && name.isNotEmpty
                ? Text(label,
                    style: const TextStyle(
                        fontSize: 8,
                        color: Colors.white,
                        fontWeight: FontWeight.bold))
                : null,
          ),
        );
      }).toList(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Widget builder
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildWidget(_DashWidget w, {double? slotHeight}) {
    switch (w.type) {
      case _WidgetType.gauge:
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
      case _WidgetType.sensor:
        final scfg = w.sensor!;
        return SensorCard(
          path: scfg.path,
          alias: scfg.alias,
          cardStyle: scfg.style,
          color: scfg.color,
          showFields: scfg.show,
          hideFields: scfg.hide,
          sensorData: _sensors[scfg.path],
        );
      case _WidgetType.text:
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Text(w.simple!.text,
              style: const TextStyle(
                  fontSize: 16, fontWeight: FontWeight.w600,
                  color: Color(0xFF4FC3F7))),
        );
      case _WidgetType.clock:
        final now = DateTime.now();
        final hm = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
        final sec = now.second.toString().padLeft(2, '0');
        final date = '${_weekday(now.weekday)}, ${now.day.toString().padLeft(2, '0')}.${now.month.toString().padLeft(2, '0')}.${now.year}';
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0D2040), Color(0xFF0A1828)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: const Color(0xFF1E3A5F)),
          ),
          child: Column(mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.center, children: [
            Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text(hm, style: const TextStyle(
                  fontSize: 36, fontWeight: FontWeight.w700,
                  color: Color(0xFF4FC3F7), fontFamily: 'monospace',
                  letterSpacing: 3)),
              Text(':$sec', style: const TextStyle(
                  fontSize: 24, fontWeight: FontWeight.w400,
                  color: Color(0xFF1E6FA0), fontFamily: 'monospace',
                  letterSpacing: 2)),
            ]),
            const SizedBox(height: 4),
            Text(date, style: const TextStyle(
                fontSize: 11, color: Color(0xFF8B949E))),
          ]),
        );
      case _WidgetType.spacer:
        return const SizedBox(height: 8);
      case _WidgetType.compass:
        return Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: const Color(0xFF161B22),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: const Icon(Icons.explore, size: 48, color: Color(0xFF4FC3F7)),
        );
      case _WidgetType.horizon:
        final hcfg = w.horizonCfg!;
        final roll  = _getValue(_sensors, '${hcfg.path}/schlagseite');
        final pitch = _getValue(_sensors, '${hcfg.path}/neigung');
        return HorizonWidget(roll: roll, pitch: pitch);
    }
  }

  String _weekday(int d) => const ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][d - 1];
}
