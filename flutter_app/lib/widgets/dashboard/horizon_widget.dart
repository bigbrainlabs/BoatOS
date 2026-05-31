// lib/widgets/dashboard/horizon_widget.dart
//
// Dashboard wrapper for the Horizon (artificial horizon) widget.

import 'package:flutter/material.dart';
import '../gauge_widget.dart' show HorizonWidget;
import 'dash_widget.dart';
import 'gauge_widget.dart' show DashSizePicker;
import 'registry.dart';

class HorizonDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'HORIZON',
      label: 'Horizont',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    final rollS  = w.rollSensor  ?? w.sensor ?? '';
    final rollF  = w.rollField   ?? 'schlagseite';
    final pitchS = w.pitchSensor ?? w.sensor ?? '';
    final pitchF = w.pitchField  ?? 'neigung';
    final impS   = w.impactSensor ?? '';
    final impF   = w.impactField  ?? 'aktiv';

    double _field(String base, String field) {
      if (base.isEmpty) return 0;
      final sensor = sensors[base];
      if (sensor == null) return 0;
      final vals = sensor['values'] as Map<String, dynamic>? ?? {};
      final raw = vals[field];
      if (raw is num) return raw.toDouble();
      if (raw is String) return double.tryParse(raw.trim()) ?? 0;
      return 0;
    }

    bool _truthy(String base, String field) {
      if (base.isEmpty) return false;
      final sensor = sensors[base];
      if (sensor == null) return false;
      final vals = sensor['values'] as Map<String, dynamic>? ?? {};
      final raw = vals[field]?.toString().toLowerCase() ?? '';
      return raw == 'true' || raw == '1' || raw == 'yes' || raw == 'aktiv';
    }

    final roll  = _field(rollS,  rollF);
    final pitch = _field(pitchS, pitchF);
    final impactActive = impS.isNotEmpty && _truthy(impS, impF) && !impactMuted;

    return HorizonWidget(roll: roll, pitch: pitch, impactActive: impactActive);
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    return _HorizonEditorFields(w: w, allSensors: allSensors, setState: setState);
  }

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('HORIZON');
    final rollS  = w.rollSensor  ?? '';
    final rollF  = w.rollField   ?? 'schlagseite';
    final pitchS = w.pitchSensor ?? '';
    final pitchF = w.pitchField  ?? 'neigung';
    if (rollS.isNotEmpty || pitchS.isNotEmpty) {
      if (rollS.isNotEmpty)  buf.write(' rollSensor=$rollS rollField=$rollF');
      if (pitchS.isNotEmpty) buf.write(' pitchSensor=$pitchS pitchField=$pitchF');
      if (w.impactSensor?.isNotEmpty == true) {
        buf.write(' impactSensor=${w.impactSensor} impactField=${w.impactField ?? 'aktiv'}');
      }
    } else if (w.sensor?.isNotEmpty == true) {
      buf.write(' ${w.sensor}');
    }
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    return buf.toString();
  }
}

// ─── Editor widget ─────────────────────────────────────────────────────────

class _HorizonEditorFields extends StatelessWidget {
  final DashWidget w;
  final List<Map<String, dynamic>> allSensors;
  final StateSetter setState;

  const _HorizonEditorFields(
      {required this.w, required this.allSensors, required this.setState});

  @override
  Widget build(BuildContext context) {
    // Build flat list of all full topic paths: base_name/field
    final allPaths = <Map<String, String>>[];
    for (final s in allSensors) {
      final base = s['base_name'] as String? ?? '';
      final sName = s['name'] as String? ?? base;
      final vals = (s['values'] as Map<dynamic, dynamic>?) ?? {};
      for (final field in vals.keys) {
        allPaths.add({'full': '$base/$field', 'label': '$sName › $field'});
      }
    }

    String? rollFull = (w.rollSensor?.isNotEmpty == true && w.rollField != null)
        ? '${w.rollSensor}/${w.rollField}' : null;
    if (rollFull != null && !allPaths.any((p) => p['full'] == rollFull)) rollFull = null;

    String? pitchFull = (w.pitchSensor?.isNotEmpty == true && w.pitchField != null)
        ? '${w.pitchSensor}/${w.pitchField}' : null;
    if (pitchFull != null && !allPaths.any((p) => p['full'] == pitchFull)) pitchFull = null;

    String? impactFull = (w.impactSensor?.isNotEmpty == true && w.impactField != null)
        ? '${w.impactSensor}/${w.impactField}' : null;
    if (impactFull != null && !allPaths.any((p) => p['full'] == impactFull)) impactFull = null;

    void setPath(String which, String? full) {
      if (full == null) return;
      final idx = full.lastIndexOf('/');
      final base  = idx >= 0 ? full.substring(0, idx)  : full;
      final field = idx >= 0 ? full.substring(idx + 1) : '';
      setState(() {
        if (which == 'roll') { w.rollSensor = base; w.rollField = field; }
        else if (which == 'pitch') { w.pitchSensor = base; w.pitchField = field; }
        else if (which == 'impact') { w.impactSensor = base; w.impactField = field; }
      });
    }

    DropdownButton<String> pathDrop(String which, String? cur, String hint) =>
        DropdownButton<String>(
          value: cur,
          hint: Text(hint, style: const TextStyle(color: Color(0xFF8B949E))),
          isExpanded: true,
          dropdownColor: const Color(0xFF161B22),
          style: const TextStyle(color: Color(0xFFE6EDF3), fontSize: 13),
          underline: Container(height: 1, color: const Color(0xFF30363D)),
          items: allPaths.map((p) => DropdownMenuItem<String>(
            value: p['full'],
            child: Text(p['label'] ?? p['full'] ?? '', overflow: TextOverflow.ellipsis),
          )).toList(),
          onChanged: (v) => setPath(which, v),
        );

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _lbl('Roll-Topic'),
      const SizedBox(height: 6),
      pathDrop('roll', rollFull, 'Roll-Topic wählen…'),
      const SizedBox(height: 14),
      _lbl('Pitch-Topic'),
      const SizedBox(height: 6),
      pathDrop('pitch', pitchFull, 'Pitch-Topic wählen…'),
      const SizedBox(height: 14),
      Container(
        decoration: BoxDecoration(
          color: const Color(0xFF0D1117),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: SwitchListTile(
          dense: true,
          activeColor: const Color(0xFF4FC3F7),
          title: const Text('Impact-Alarm',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600,
                  color: Color(0xFFE6EDF3))),
          subtitle: const Text('Horizont blinkt rot bei Erschütterung',
              style: TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
          value: w.impactSensor != null,
          onChanged: (on) => setState(() {
            w.impactSensor = on ? '' : null;
            w.impactField  = on ? 'aktiv' : null;
          }),
        ),
      ),
      if (w.impactSensor != null) ...[
        const SizedBox(height: 10),
        _lbl('Impact-Topic'),
        const SizedBox(height: 6),
        pathDrop('impact', impactFull, 'Impact-Topic wählen…'),
      ],
      const SizedBox(height: 14),
      _lbl('Breite (Spalten)'),
      const SizedBox(height: 6),
      DashSizePicker(
        value: w.size,
        onSelect: (n) => setState(() => w.size = n),
      ),
    ]);
  }

  Widget _lbl(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));
}
