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
      showFields: w.fields ?? [],
      fieldAliases: w.fieldAliases ?? {},
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
    if (w.fields != null && w.fields!.isNotEmpty) buf.write(' SHOW "${w.fields!.join(',')}"');
    if (w.fieldAliases != null && w.fieldAliases!.isNotEmpty) {
      final fa = w.fieldAliases!.entries.map((e) => '${e.key}:${e.value}').join(',');
      buf.write(' FIELDALIAS "$fa"');
    }
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
  final Map<String, TextEditingController> _fieldAliasCtrl = {};
  static const _sensorStyles = ['card', 'minimal', 'compact', 'hero'];

  @override
  void initState() {
    super.initState();
    _aliasCtrl = TextEditingController(text: widget.w.alias ?? '');
    _rebuildFieldAliasCtrl();
  }

  void _rebuildFieldAliasCtrl() {
    for (final c in _fieldAliasCtrl.values) c.dispose();
    _fieldAliasCtrl.clear();
    final aliases = widget.w.fieldAliases ?? {};
    for (final field in _availableFields()) {
      _fieldAliasCtrl[field] = TextEditingController(text: aliases[field] ?? '');
    }
  }

  List<String> _availableFields() {
    final sensorEntry = widget.allSensors.cast<Map<String, dynamic>?>()
        .firstWhere((s) => s?['base_name'] == widget.w.sensor, orElse: () => null);
    return sensorEntry != null
        ? ((sensorEntry['values'] as Map<dynamic, dynamic>?) ?? {}).keys.cast<String>().toList()
        : <String>[];
  }

  @override
  void dispose() {
    _aliasCtrl.dispose();
    for (final c in _fieldAliasCtrl.values) c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final availableFields = _availableFields();
    final selectedFields = widget.w.fields ?? [];

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _lbl('Sensor'), const SizedBox(height: 6),
      DashSensorListPicker(
        sensors: widget.allSensors,
        selected: widget.w.sensor,
        onSelect: (path) => widget.setState(() {
          widget.w.sensor = path;
          widget.w.fields = null;
          widget.w.fieldAliases = null;
          _rebuildFieldAliasCtrl();
        }),
      ),
      if (widget.w.sensor != null && availableFields.isNotEmpty) ...[
        const SizedBox(height: 12),
        _lbl('Angezeigte Werte'), const SizedBox(height: 6),
        Container(
          decoration: BoxDecoration(
            color: const Color(0xFF0D1117),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF30363D)),
          ),
          child: Column(
            children: availableFields.map((field) {
              final checked = selectedFields.contains(field);
              if (!_fieldAliasCtrl.containsKey(field)) {
                _fieldAliasCtrl[field] = TextEditingController(
                    text: widget.w.fieldAliases?[field] ?? '');
              }
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: checked
                      ? const Color(0xFF1565C0).withValues(alpha: 0.15)
                      : Colors.transparent,
                  border: Border(bottom: BorderSide(
                    color: field == availableFields.last
                        ? Colors.transparent
                        : const Color(0xFF21262D),
                  )),
                ),
                child: Row(children: [
                  GestureDetector(
                    onTap: () => widget.setState(() {
                      final cur = List<String>.from(widget.w.fields ?? []);
                      if (checked) cur.remove(field); else cur.add(field);
                      widget.w.fields = cur.isEmpty ? null : cur;
                    }),
                    child: Row(mainAxisSize: MainAxisSize.min, children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 120),
                        width: 18, height: 18,
                        decoration: BoxDecoration(
                          color: checked ? const Color(0xFF1565C0) : const Color(0xFF161B22),
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: checked ? const Color(0xFF4FC3F7) : const Color(0xFF30363D),
                          ),
                        ),
                        child: checked
                            ? const Icon(Icons.check, size: 12, color: Colors.white)
                            : null,
                      ),
                      const SizedBox(width: 8),
                      Text(field, style: const TextStyle(fontSize: 12, color: Color(0xFFE6EDF3))),
                    ]),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _fieldAliasCtrl[field],
                      style: const TextStyle(fontSize: 11, color: Color(0xFFE6EDF3)),
                      onChanged: (v) => widget.setState(() {
                        final aliases = Map<String, String>.from(widget.w.fieldAliases ?? {});
                        if (v.isEmpty) aliases.remove(field); else aliases[field] = v;
                        widget.w.fieldAliases = aliases.isEmpty ? null : aliases;
                      }),
                      decoration: _inputDec('Anzeigename'),
                    ),
                  ),
                ]),
              );
            }).toList(),
          ),
        ),
      ],
      const SizedBox(height: 12),
      _lbl('Anzeigename (Titel)'), const SizedBox(height: 4),
      TextField(
        controller: _aliasCtrl,
        style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
        onChanged: (v) =>
            widget.setState(() => widget.w.alias = v.isEmpty ? null : v),
        decoration: _inputDec(),
      ),
    ]);
  }

  Widget _lbl(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));

  InputDecoration _inputDec([String? hint]) => InputDecoration(
        hintText: hint,
        hintStyle: const TextStyle(fontSize: 11, color: Color(0xFF444C56)),
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
