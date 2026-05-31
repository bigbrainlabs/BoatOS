// lib/widgets/dashboard/sensor_widget.dart
//
// Dashboard wrapper for Sensor card widgets.

import 'package:flutter/material.dart';
import '../gauge_widget.dart' show SensorCard, SensorCardStyle, parseDashColor;
import 'dash_widget.dart';
import 'registry.dart';
import 'gauge_widget.dart';

class SensorDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'SENSOR',
      label: 'Sensor-Karte',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    final path = w.sensor ?? '';

    SensorCardStyle cardStyle = SensorCardStyle.card;
    if (w.style != null) {
      switch (w.style!.toLowerCase()) {
        case 'hero':    cardStyle = SensorCardStyle.hero;
        case 'compact': cardStyle = SensorCardStyle.compact;
        default:        cardStyle = SensorCardStyle.card;
      }
    }

    return SensorCard(
      path: path,
      alias: w.alias ?? '',
      cardStyle: cardStyle,
      color: parseDashColor(w.color ?? 'cyan'),
      sensorData: sensors[path],
    );
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    return _SensorEditorFields(w: w, allSensors: allSensors, setState: setState);
  }

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('SENSOR ${w.sensor ?? 'unknown'}');
    if (w.alias != null && w.alias!.isNotEmpty) buf.write(' AS "${w.alias}"');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    if (w.style != null) buf.write(' STYLE ${w.style}');
    return buf.toString();
  }
}

class _SensorEditorFields extends StatefulWidget {
  final DashWidget w;
  final List<Map<String, dynamic>> allSensors;
  final StateSetter setState;
  const _SensorEditorFields(
      {required this.w, required this.allSensors, required this.setState});
  @override
  State<_SensorEditorFields> createState() => _SensorEditorFieldsState();
}

class _SensorEditorFieldsState extends State<_SensorEditorFields> {
  late final TextEditingController _aliasCtrl;
  static const _sensorStyles = ['card', 'minimal', 'compact', 'hero'];

  @override
  void initState() {
    super.initState();
    _aliasCtrl = TextEditingController(text: widget.w.alias ?? '');
  }

  @override
  void dispose() {
    _aliasCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _lbl('Sensor'), const SizedBox(height: 6),
      DashSensorListPicker(
        sensors: widget.allSensors,
        selected: widget.w.sensor,
        onSelect: (path) => widget.setState(() => widget.w.sensor = path),
      ),
      const SizedBox(height: 12),
      _lbl('Bezeichnung (AS)'), const SizedBox(height: 4),
      TextField(
        controller: _aliasCtrl,
        style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
        onChanged: (v) =>
            widget.setState(() => widget.w.alias = v.isEmpty ? null : v),
        decoration: _inputDec(),
      ),
      const SizedBox(height: 10),
      _lbl('Stil'), const SizedBox(height: 6),
      DashStyleChips(
        styles: _sensorStyles,
        selected: widget.w.style,
        onSelect: (s) => widget.setState(() => widget.w.style = s),
      ),
      const SizedBox(height: 10),
      _lbl('Breite (Spalten)'), const SizedBox(height: 6),
      DashSizePicker(
        value: widget.w.size,
        onSelect: (n) => widget.setState(() => widget.w.size = n),
      ),
    ]);
  }

  Widget _lbl(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));

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
