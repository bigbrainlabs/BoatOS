import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import '../services/settings_service.dart';
import '../widgets/dashboard/dash_widget.dart';
import '../widgets/dashboard/registry.dart';

// ─────────────────────────────────────────────────────────────────────────────
// ROW/GRID format internal models
// ─────────────────────────────────────────────────────────────────────────────

class _LayoutRow {
  final int height;
  final List<DashWidget> widgets;
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
  const _TemplateInfo(
      {required this.id,
      required this.cols,
      required this.rows,
      required this.areas});
}

class _DashScreen {
  final String name;
  final String layoutId;
  final _TemplateInfo template;
  final Map<String, DashWidget> widgets;
  const _DashScreen(
      {required this.name,
      required this.layoutId,
      required this.template,
      required this.widgets});
}

const _kTemplates = <String, _TemplateInfo>{
  'full':
      _TemplateInfo(id: 'full', cols: '1fr', rows: '1fr', areas: 'A'),
  'split-h':
      _TemplateInfo(id: 'split-h', cols: '1fr 1fr', rows: '1fr', areas: 'A B'),
  'split-v':
      _TemplateInfo(id: 'split-v', cols: '1fr', rows: '1fr 1fr', areas: 'A\nB'),
  'thirds-h':
      _TemplateInfo(id: 'thirds-h', cols: '1fr 1fr 1fr', rows: '1fr', areas: 'A B C'),
  'hero-right':
      _TemplateInfo(id: 'hero-right', cols: '2fr 1fr', rows: '1fr 1fr', areas: 'A B\nA C'),
  'hero-left':
      _TemplateInfo(id: 'hero-left', cols: '1fr 2fr', rows: '1fr 1fr', areas: 'B A\nC A'),
  'hero-top':
      _TemplateInfo(id: 'hero-top', cols: '1fr 1fr', rows: '2fr 1fr', areas: 'A A\nB C'),
  'hero-bottom':
      _TemplateInfo(id: 'hero-bottom', cols: '1fr 1fr', rows: '1fr 2fr', areas: 'B C\nA A'),
  'grid-4':
      _TemplateInfo(id: 'grid-4', cols: '1fr 1fr', rows: '1fr 1fr', areas: 'A B\nC D'),
  'mosaic-4':
      _TemplateInfo(id: 'mosaic-4', cols: '2fr 1fr', rows: '1fr 1fr 1fr', areas: 'A B\nA C\nA D'),
  'grid-6':
      _TemplateInfo(id: 'grid-6', cols: '1fr 1fr 1fr', rows: '1fr 1fr', areas: 'A B C\nD E F'),
  'mosaic-5':
      _TemplateInfo(id: 'mosaic-5', cols: '2fr 1fr 1fr', rows: '1fr 1fr', areas: 'A B C\nA D E'),
};

// ─────────────────────────────────────────────────────────────────────────────
// Tokenizer
// ─────────────────────────────────────────────────────────────────────────────

List<String> _tokenize(String line) {
  final tokens = <String>[];
  final buf = StringBuffer();
  bool inQuote = false;
  for (final c in line.split('')) {
    if (c == '"') {
      inQuote = !inQuote;
    } else if (c == ' ' && !inQuote) {
      if (buf.isNotEmpty) {
        tokens.add(buf.toString());
        buf.clear();
      }
    } else {
      buf.write(c);
    }
  }
  if (buf.isNotEmpty) tokens.add(buf.toString());
  return tokens;
}

// ─────────────────────────────────────────────────────────────────────────────
// Widget token parsers
// ─────────────────────────────────────────────────────────────────────────────

DashWidget _parseGaugeDW(List<String> t) {
  final path = t[1];
  double min = 0, max = 100;
  String unit = '', label = '', color = 'cyan', style = 'arc270';
  int decimals = 1, size = 1;
  for (int i = 2; i < t.length - 1; i += 2) {
    final k = t[i].toUpperCase();
    final v = t[i + 1];
    switch (k) {
      case 'MIN':
        min = double.tryParse(v) ?? 0;
      case 'MAX':
        max = double.tryParse(v) ?? 100;
      case 'UNIT':
        unit = v;
      case 'LABEL':
        label = v;
      case 'DECIMALS':
        decimals = int.tryParse(v) ?? 1;
      case 'SIZE':
        size = int.tryParse(v) ?? 1;
      case 'COLOR':
        color = v;
      case 'STYLE':
        style = v.toLowerCase();
    }
  }
  return DashWidget(
    type: 'GAUGE',
    sensor: path,
    min: min,
    max: max,
    unit: unit.isEmpty ? null : unit,
    label: label.isEmpty ? null : label,
    style: style,
    color: color,
    decimals: decimals,
    size: size,
  );
}

DashWidget _parseSensorDW(List<String> t) {
  final path = t[1];
  String alias = '', color = 'cyan', style = 'card';
  int size = 1;
  List<String>? fields;
  Map<String, String>? fieldAliases;
  for (int i = 2; i < t.length - 1; i += 2) {
    final k = t[i].toUpperCase();
    final v = t[i + 1];
    switch (k) {
      case 'AS':
      case 'ALIAS':
        alias = v;
      case 'SIZE':
        size = int.tryParse(v) ?? 1;
      case 'COLOR':
        color = v;
      case 'STYLE':
        style = v.toLowerCase();
      case 'SHOW':
        final clean = v.replaceAll('"', '').trim();
        if (clean.isNotEmpty) {
          fields = clean.split(',').map((f) => f.trim()).where((f) => f.isNotEmpty).toList();
        }
      case 'FIELDALIAS':
        final clean = v.replaceAll('"', '').trim();
        if (clean.isNotEmpty) {
          fieldAliases = {};
          for (final pair in clean.split(',')) {
            final idx = pair.indexOf(':');
            if (idx > 0) {
              fieldAliases![pair.substring(0, idx).trim()] = pair.substring(idx + 1).trim();
            }
          }
        }
    }
  }
  return DashWidget(
    type: 'SENSOR',
    sensor: path,
    alias: alias.isEmpty ? null : alias,
    style: style,
    color: color,
    size: size,
    fields: fields,
    fieldAliases: fieldAliases,
  );
}

DashWidget _parseHorizonDW(List<String> tokens) {
  String rollS = '', rollF = 'schlagseite';
  String pitchS = '', pitchF = 'neigung';
  String impS = '', impF = 'aktiv';
  int hSize = 1;
  bool hasKv = false;

  for (int i = 1; i < tokens.length; i++) {
    final t = tokens[i];
    if (t.contains('=')) {
      hasKv = true;
      final eq = t.indexOf('=');
      final k = t.substring(0, eq);
      final v = t.substring(eq + 1);
      switch (k) {
        case 'rollSensor':
          rollS = v;
        case 'rollField':
          rollF = v;
        case 'pitchSensor':
          pitchS = v;
        case 'pitchField':
          pitchF = v;
        case 'impactSensor':
          impS = v;
        case 'impactField':
          impF = v;
      }
    } else if (t.toUpperCase() == 'SIZE' && i + 1 < tokens.length) {
      hSize = int.tryParse(tokens[++i]) ?? 1;
    }
  }
  if (!hasKv && tokens.length > 1) {
    rollS = tokens[1];
    pitchS = tokens[1];
  }
  return DashWidget(
    type: 'HORIZON',
    size: hSize,
    rollSensor: rollS.isNotEmpty ? rollS : null,
    rollField: rollF,
    pitchSensor: pitchS.isNotEmpty ? pitchS : null,
    pitchField: pitchF,
    impactSensor: impS.isNotEmpty ? impS : null,
    impactField: impS.isNotEmpty ? impF : null,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DSL parser — old ROW/GRID format
// ─────────────────────────────────────────────────────────────────────────────

_Layout _parseDSL(String dsl) {
  int columns = 3;
  final rows = <_LayoutRow>[];
  int currentHeight = 1;
  List<DashWidget>? currentWidgets;

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
        if (tokens.length > 1) currentWidgets.add(_parseGaugeDW(tokens));
      case 'SENSOR':
        currentWidgets ??= [];
        if (tokens.length > 1) currentWidgets.add(_parseSensorDW(tokens));
      case 'TEXT':
        currentWidgets ??= [];
        {
          final text = tokens.length > 1 ? tokens[1] : '';
          int tSize = 1;
          for (int i = 2; i < tokens.length - 1; i += 2) {
            if (tokens[i].toUpperCase() == 'SIZE') tSize = int.tryParse(tokens[i + 1]) ?? 1;
          }
          currentWidgets.add(DashWidget(type: 'TEXT', text: text, size: tSize));
        }
      case 'CLOCK':
      case 'SPACER':
      case 'COMPASS':
        currentWidgets ??= [];
        {
          int sSize = 1;
          for (int i = 1; i < tokens.length - 1; i += 2) {
            if (tokens[i].toUpperCase() == 'SIZE') sSize = int.tryParse(tokens[i + 1]) ?? 1;
          }
          currentWidgets.add(DashWidget(type: tokens[0].toUpperCase(), size: sSize));
        }
      case 'HORIZON':
        currentWidgets ??= [];
        currentWidgets.add(_parseHorizonDW(tokens));
    }
  }
  flushRow();
  return _Layout(columns: columns, rows: rows);
}

// ─────────────────────────────────────────────────────────────────────────────
// DSL parser — new SCREEN/LAYOUT format
// ─────────────────────────────────────────────────────────────────────────────

List<_DashScreen> _parseScreenDSL(String dsl) {
  final screens = <_DashScreen>[];
  String? currentName;
  String? currentLayoutId;
  Map<String, DashWidget>? currentWidgets;

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
      final slot = tokens[0].toUpperCase();
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

DashWidget? _parseWidgetFromTokens(List<String> tokens) {
  if (tokens.isEmpty) return null;
  switch (tokens[0].toUpperCase()) {
    case 'SENSOR':
      if (tokens.length > 1) return _parseSensorDW(tokens);
    case 'GAUGE':
      if (tokens.length > 1) return _parseGaugeDW(tokens);
    case 'HORIZON':
      return _parseHorizonDW(tokens);
    case 'CLOCK':
    case 'COMPASS':
    case 'SPACER':
      return DashWidget(type: tokens[0].toUpperCase());
    case 'TEXT':
      return DashWidget(type: 'TEXT', text: tokens.length > 1 ? tokens[1] : '');
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers for impact detection
// ─────────────────────────────────────────────────────────────────────────────

String _getRawString(Map<String, dynamic> sensors, String basePath, String field) {
  final entry = sensors[basePath];
  if (entry == null) return '';
  final values = entry['values'] as Map<String, dynamic>? ?? {};
  return values[field]?.toString().trim() ?? '';
}

bool _isTruthy(String v) {
  if (v.isEmpty) return false;
  final l = v.toLowerCase();
  return l != '0' && l != 'false' && l != 'null' && l != 'no';
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

  bool _impactMuted     = false;
  bool _impactWasActive = false;

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
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsService>();
    final dsl = settings.raw['dashboard_layout'] as String? ?? '';

    final anyImpactActive = _computeImpactActive(dsl);

    // Rising-edge detection — new alarm event resets mute so it fires again
    if (anyImpactActive != _impactWasActive) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        if (anyImpactActive && !_impactWasActive) {
          setState(() { _impactMuted = false; _impactWasActive = true; });
        } else if (!anyImpactActive && _impactWasActive) {
          setState(() { _impactWasActive = false; });
        }
      });
    }

    final content = _buildContent(context, dsl);
    if (!anyImpactActive && !_impactMuted) return content;

    return Stack(
      fit: StackFit.expand,
      children: [
        content,
        if (anyImpactActive && !_impactMuted)
          Positioned(
            bottom: 24, left: 0, right: 0,
            child: Center(child: _buildMuteButton()),
          ),
      ],
    );
  }

  bool _computeImpactActive(String dsl) {
    if (!dsl.contains('impactSensor=')) return false;
    bool isScreen = false;
    for (final line in dsl.split('\n')) {
      final t = line.trim();
      if (t.isEmpty || t.startsWith('#')) continue;
      isScreen = t.toUpperCase().startsWith('SCREEN');
      break;
    }
    final widgets = <DashWidget>[];
    if (isScreen) {
      for (final s in _parseScreenDSL(dsl)) widgets.addAll(s.widgets.values);
    } else {
      for (final r in _parseDSL(dsl).rows) widgets.addAll(r.widgets);
    }
    return widgets.any((w) =>
        w.type == 'HORIZON' &&
        (w.impactSensor?.isNotEmpty == true) &&
        _isTruthy(_getRawString(_sensors, w.impactSensor!, w.impactField ?? 'aktiv')));
  }

  Widget _buildMuteButton() => GestureDetector(
    onTap: () => setState(() => _impactMuted = true),
    child: Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFB71C1C),
        borderRadius: BorderRadius.circular(28),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFEF5350).withValues(alpha: 0.5),
            blurRadius: 16,
            spreadRadius: 2,
          ),
        ],
      ),
      child: const Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.notifications_off_outlined, color: Colors.white, size: 18),
          SizedBox(width: 8),
          Text('Alarm stumm',
              style: TextStyle(
                  color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
        ],
      ),
    ),
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // Content dispatcher
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildContent(BuildContext context, String dsl) {
    if (_firstLoad) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF4FC3F7)));
    }
    if (dsl.isEmpty) {
      return const Center(
        child: Text('Kein Dashboard-Layout konfiguriert.',
            style: TextStyle(color: Color(0xFF8B949E))),
      );
    }

    // Detect format from first non-comment line
    bool isScreen = false;
    for (final line in dsl.split('\n')) {
      final t = line.trim();
      if (t.isEmpty || t.startsWith('#')) continue;
      isScreen = t.toUpperCase().startsWith('SCREEN');
      break;
    }

    if (isScreen) {
      final screens = _parseScreenDSL(dsl);
      if (screens.isEmpty) {
        return const Center(
          child: Text('Keine Screens im Layout.',
              style: TextStyle(color: Color(0xFF8B949E))),
        );
      }
      return LayoutBuilder(
          builder: (ctx, bc) => _buildScreenLayout(screens, bc));
    } else {
      // ROW/GRID format
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

        // Break DSL rows into visual lines that respect column overflow
        final lineWidgets = <List<DashWidget>>[];
        final lineHeights = <double>[];
        for (final row in layout.rows) {
          final rowH = kBaseRowH * row.height;
          var cur = <DashWidget>[];
          var used = 0;
          for (final w in row.widgets) {
            final span = w.size.clamp(1, layout.columns);
            if (used + span > layout.columns && cur.isNotEmpty) {
              lineWidgets.add(cur);
              lineHeights.add(rowH);
              cur = [w];
              used = span;
            } else {
              cur.add(w);
              used += span;
            }
          }
          if (cur.isNotEmpty) { lineWidgets.add(cur); lineHeights.add(rowH); }
        }

        // Group lines into pages that fit within available height
        final pageH = constraints.maxHeight - 24.0 - kDotsH;
        final pageStarts = <int>[];
        final pageEnds = <int>[];
        var si = 0;
        while (si < lineWidgets.length) {
          var usedH = 0.0;
          var ei = si;
          while (ei < lineWidgets.length) {
            final next = ei == si
                ? lineHeights[ei]
                : usedH + gap + lineHeights[ei];
            if (next > pageH && ei > si) break;
            usedH = next;
            ei++;
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
              children:
                  List.generate(e - s, (i) => buildLine(s + i, i == e - s - 1)),
            ),
          );
        }

        if (pageCount <= 1) {
          return SingleChildScrollView(
            padding: const EdgeInsets.only(bottom: 80),
            child: pageCount == 0 ? const SizedBox() : buildPage(0),
          );
        }

        if (_currentPage >= pageCount) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              _pageCtrl.jumpToPage(0);
              setState(() => _currentPage = 0);
            }
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

  Widget _buildScreenLayout(
      List<_DashScreen> screens, BoxConstraints constraints) {
    if (screens.length == 1) {
      return _buildOneScreen(screens[0], constraints);
    }

    if (_currentPage >= screens.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _pageCtrl.jumpToPage(0);
          setState(() => _currentPage = 0);
        }
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
        builder: (ctx, bc) =>
            _buildTemplateGrid(screen, Size(bc.maxWidth, bc.maxHeight)),
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

    final totalW = size.width - gap * (numCols - 1);
    final totalH = size.height - gap * (numRows - 1);
    final colWidths = colFracs.map((f) => f * totalW).toList();
    final rowHeights = rowFracs.map((f) => f * totalH).toList();

    final colX = <double>[0.0];
    for (int i = 0; i < numCols; i++) {
      colX.add(colX.last + colWidths[i] + gap);
    }
    final rowY = <double>[0.0];
    for (int i = 0; i < numRows; i++) {
      rowY.add(rowY.last + rowHeights[i] + gap);
    }

    final children = <Widget>[];
    final processedSlots = <String>{};

    for (int r = 0; r < areaRows.length && r < numRows; r++) {
      final row = areaRows[r];
      for (int c = 0; c < row.length && c < numCols; c++) {
        final slot = row[c].toUpperCase();
        if (processedSlots.contains(slot)) continue;
        processedSlots.add(slot);

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
        if (widget == null) continue;

        children.add(Positioned(
          left: left, top: top, width: w, height: h,
          child: ClipRect(
            child: SizedBox(width: w, height: h, child: _buildWidget(widget)),
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
  // Page indicator dots
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
            child: null,
          ),
        );
      }).toList(),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Widget builder — delegates to registry
  // ─────────────────────────────────────────────────────────────────────────────

  Widget _buildWidget(DashWidget w) {
    return DashWidgetRegistry.build(w, _sensors, impactMuted: _impactMuted);
  }
}
