// lib/widgets/dashboard/gauge_widget.dart
//
// Dashboard wrapper for the Gauge widget.
// Bridges DashWidget config → GaugeWidget Flutter widget.

import 'package:flutter/material.dart';
import '../gauge_widget.dart';
import 'dash_widget.dart';
import 'registry.dart';

// ─────────────────────────────────────────────────────────────────────────────
// Value lookup helpers (shared, declared here, used by other widget wrappers)
// ─────────────────────────────────────────────────────────────────────────────

double dashGetValue(Map<String, dynamic> sensors, String path) {
  if (sensors.containsKey(path)) {
    final values = sensors[path]['values'] as Map<String, dynamic>? ?? {};
    for (final v in values.values) {
      if (v is num) return v.toDouble();
      if (v is String) {
        final d = double.tryParse(v.trim());
        if (d != null) return d;
      }
    }
    return 0;
  }
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

String dashGetLabel(Map<String, dynamic> sensors, String path) {
  final sensor = sensors[path];
  if (sensor == null) return path.split('/').last;
  final name = sensor['name'] as String? ?? path;
  final parts = name.split(' › ');
  return parts.reversed.take(2).toList().reversed.join(' › ');
}

// ─────────────────────────────────────────────────────────────────────────────
// GaugeDashWidget
// ─────────────────────────────────────────────────────────────────────────────

class GaugeDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'GAUGE',
      label: 'Gauge',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    final path = w.sensor ?? '';
    final value = dashGetValue(sensors, path);
    final autoLabel = (w.label?.isNotEmpty == true)
        ? w.label!
        : dashGetLabel(sensors, path);

    GaugeStyle style = GaugeStyle.arc270;
    if (w.style != null) {
      switch (w.style!.toLowerCase()) {
        case 'arc180': style = GaugeStyle.arc180;
        case 'arc270': style = GaugeStyle.arc270;
        case 'arc360': style = GaugeStyle.arc360;
        case 'bar':    style = GaugeStyle.bar;
      }
    }

    return GaugeWidget(
      value: value,
      min: w.min ?? 0,
      max: w.max ?? 100,
      unit: w.unit ?? '',
      label: autoLabel,
      style: style,
      color: parseDashColor(w.color ?? 'cyan'),
      decimals: w.decimals ?? 1,
    );
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    // Editor fields: sensor picker, min/max, unit, label, style, decimals, size
    return _GaugeEditorFields(w: w, allSensors: allSensors, setState: setState);
  }

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('GAUGE ${w.sensor ?? 'unknown'}');
    if (w.min != null) buf.write(' MIN ${_fmtNum(w.min!)}');
    if (w.max != null) buf.write(' MAX ${_fmtNum(w.max!)}');
    if (w.unit != null && w.unit!.isNotEmpty) buf.write(' UNIT "${w.unit}"');
    if (w.label != null && w.label!.isNotEmpty) buf.write(' LABEL "${w.label}"');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    if (w.style != null) buf.write(' STYLE ${w.style}');
    if (w.decimals != null) buf.write(' DECIMALS ${w.decimals}');
    return buf.toString();
  }

  static String _fmtNum(double v) =>
      v == v.truncateToDouble() ? v.toInt().toString() : v.toString();
}

// ─── Editor widget ────────────────────────────────────────────────────────────

class _GaugeEditorFields extends StatefulWidget {
  final DashWidget w;
  final List<Map<String, dynamic>> allSensors;
  final StateSetter setState;
  const _GaugeEditorFields(
      {required this.w, required this.allSensors, required this.setState});
  @override
  State<_GaugeEditorFields> createState() => _GaugeEditorFieldsState();
}

class _GaugeEditorFieldsState extends State<_GaugeEditorFields> {
  late final TextEditingController _minCtrl, _maxCtrl, _unitCtrl, _labelCtrl;
  static const _gaugeStyles = ['arc180', 'arc270', 'arc360', 'bar'];

  @override
  void initState() {
    super.initState();
    _minCtrl   = TextEditingController(text: widget.w.min   != null ? _fmt(widget.w.min!)   : '');
    _maxCtrl   = TextEditingController(text: widget.w.max   != null ? _fmt(widget.w.max!)   : '');
    _unitCtrl  = TextEditingController(text: widget.w.unit  ?? '');
    _labelCtrl = TextEditingController(text: widget.w.label ?? '');
  }

  @override
  void dispose() {
    _minCtrl.dispose(); _maxCtrl.dispose();
    _unitCtrl.dispose(); _labelCtrl.dispose();
    super.dispose();
  }

  String _fmt(double v) =>
      v == v.truncateToDouble() ? v.toInt().toString() : v.toString();

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      // Sensor picker
      _lbl('Sensor'),
      const SizedBox(height: 6),
      DashSensorListPicker(
        sensors: widget.allSensors,
        selected: widget.w.sensor,
        onSelect: (path) => widget.setState(() => widget.w.sensor = path),
      ),
      const SizedBox(height: 12),
      // Min / Max
      Row(children: [
        Expanded(child: _numField('Min', _minCtrl, (v) => widget.w.min = v)),
        const SizedBox(width: 10),
        Expanded(child: _numField('Max', _maxCtrl, (v) => widget.w.max = v)),
      ]),
      const SizedBox(height: 10),
      _textField('Einheit', _unitCtrl, (v) => widget.w.unit = v.isEmpty ? null : v),
      const SizedBox(height: 10),
      _textField('Label', _labelCtrl, (v) => widget.w.label = v.isEmpty ? null : v),
      const SizedBox(height: 10),
      // Style picker
      _lbl('Stil'),
      const SizedBox(height: 6),
      DashStyleChips(
        styles: _gaugeStyles,
        selected: widget.w.style,
        onSelect: (s) => widget.setState(() => widget.w.style = s),
      ),
      const SizedBox(height: 10),
      // Decimals
      _lbl('Dezimalstellen'),
      const SizedBox(height: 6),
      DashDecimalsPicker(
        value: widget.w.decimals,
        onSelect: (d) => widget.setState(() => widget.w.decimals = d),
      ),
      const SizedBox(height: 10),
      // Size
      _lbl('Breite (Spalten)'),
      const SizedBox(height: 6),
      DashSizePicker(
        value: widget.w.size,
        onSelect: (n) => widget.setState(() => widget.w.size = n),
      ),
    ]);
  }

  Widget _lbl(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));

  Widget _numField(String label, TextEditingController ctrl, void Function(double?) cb) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _lbl(label), const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
          onChanged: (v) { widget.setState(() => cb(double.tryParse(v))); },
          decoration: _inputDec(),
        ),
      ]);

  Widget _textField(String label, TextEditingController ctrl, void Function(String) cb) =>
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        _lbl(label), const SizedBox(height: 4),
        TextField(
          controller: ctrl,
          style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
          onChanged: (v) { widget.setState(() => cb(v)); },
          decoration: _inputDec(),
        ),
      ]);

  InputDecoration _inputDec() => InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
        filled: true, fillColor: const Color(0xFF0D1117),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFF30363D))),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFF30363D))),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
            borderSide: const BorderSide(color: Color(0xFF4FC3F7))),
      );
}

// ─── Shared editor sub-widgets ────────────────────────────────────────────────

class DashSensorListPicker extends StatefulWidget {
  final List<Map<String, dynamic>> sensors;
  final String? selected;
  final void Function(String) onSelect;
  const DashSensorListPicker(
      {required this.sensors, required this.selected, required this.onSelect});
  @override
  State<DashSensorListPicker> createState() => DashSensorListPickerState();
}

class DashSensorListPickerState extends State<DashSensorListPicker> {
  String _search = '';

  @override
  Widget build(BuildContext context) {
    final filtered = _search.isEmpty
        ? widget.sensors
        : widget.sensors.where((s) {
            final n = '${s['name'] ?? ''} ${s['base_name'] ?? ''}'.toLowerCase();
            return n.contains(_search.toLowerCase());
          }).toList();

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF30363D)),
      ),
      child: Column(children: [
        if (widget.sensors.length > 6)
          Padding(
            padding: const EdgeInsets.all(8),
            child: TextField(
              style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
              onChanged: (v) => setState(() => _search = v),
              decoration: const InputDecoration(
                isDense: true, hintText: 'Suchen…',
                hintStyle: TextStyle(color: Color(0xFF8B949E)),
                prefixIcon: Icon(Icons.search, size: 16, color: Color(0xFF8B949E)),
                contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                filled: true, fillColor: Color(0xFF161B22),
                border: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF30363D))),
                enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFF30363D))),
              ),
            ),
          ),
        SizedBox(
          height: 160,
          child: ListView.builder(
            padding: EdgeInsets.zero,
            itemCount: filtered.length,
            itemBuilder: (_, i) {
              final s    = filtered[i];
              final path = s['base_name'] as String? ?? '';
              final name = s['name'] as String? ?? path;
              final unit = s['unit'] as String? ?? '';
              final sel  = widget.selected == path;
              return GestureDetector(
                onTap: () => widget.onSelect(path),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: sel
                        ? const Color(0xFF1565C0).withValues(alpha: 0.2)
                        : Colors.transparent,
                    border: Border(
                        left: BorderSide(
                          color: sel ? const Color(0xFF4FC3F7) : Colors.transparent,
                          width: 3,
                        )),
                  ),
                  child: Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                      Text(name, style: TextStyle(fontSize: 13,
                          color: sel ? const Color(0xFFE6EDF3) : const Color(0xFF8B949E),
                          fontWeight: sel ? FontWeight.w600 : FontWeight.normal)),
                      Text(unit.isNotEmpty ? '$path · $unit' : path,
                          style: const TextStyle(fontSize: 10, color: Color(0xFF8B949E))),
                    ])),
                    if (sel)
                      const Icon(Icons.check, size: 16, color: Color(0xFF4FC3F7)),
                  ]),
                ),
              );
            },
          ),
        ),
      ]),
    );
  }
}

class DashStyleChips extends StatelessWidget {
  final List<String> styles;
  final String? selected;
  final void Function(String?) onSelect;
  const DashStyleChips(
      {required this.styles, required this.selected, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 6, runSpacing: 6,
      children: styles.map((s) {
        final sel = selected == s;
        return GestureDetector(
          onTap: () => onSelect(sel ? null : s),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 120),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
            decoration: BoxDecoration(
              color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(
                  color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
            ),
            child: Text(s,
                style: TextStyle(fontSize: 13,
                    color: sel ? Colors.white : const Color(0xFF8B949E),
                    fontWeight: sel ? FontWeight.w600 : FontWeight.normal)),
          ),
        );
      }).toList(),
    );
  }
}

class DashDecimalsPicker extends StatelessWidget {
  final int? value;
  final void Function(int?) onSelect;
  const DashDecimalsPicker({required this.value, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(4, (i) {
        final sel = value == i;
        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: GestureDetector(
            onTap: () => onSelect(sel ? null : i),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
              ),
              child: Text('$i',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                      color: sel ? Colors.white : const Color(0xFF8B949E))),
            ),
          ),
        );
      }),
    );
  }
}

class DashSizePicker extends StatelessWidget {
  final int value;
  final void Function(int) onSelect;
  const DashSizePicker({required this.value, required this.onSelect});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(4, (i) {
        final n = i + 1;
        final sel = value == n;
        return Padding(
          padding: const EdgeInsets.only(right: 6),
          child: GestureDetector(
            onTap: () => onSelect(n),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 120),
              width: 44, height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: sel ? const Color(0xFF1565C0) : const Color(0xFF0D1117),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                    color: sel ? const Color(0xFF4FC3F7) : const Color(0xFF30363D)),
              ),
              child: Text('$n',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600,
                      color: sel ? Colors.white : const Color(0xFF8B949E))),
            ),
          ),
        );
      }),
    );
  }
}
