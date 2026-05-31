// lib/widgets/dashboard/spacer_widget.dart
//
// Dashboard Spacer widget.

import 'package:flutter/material.dart';
import 'dash_widget.dart';
import 'registry.dart';
import 'gauge_widget.dart' show DashSizePicker;

class SpacerDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'SPACER',
      label: 'Spacer',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    return const SizedBox(height: 8);
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Unsichtbarer Platzhalter. Nur Größe relevant.',
          style: TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
      const SizedBox(height: 10),
      const Text('BREITE (SPALTEN)',
          style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
              color: Color(0xFF4FC3F7), letterSpacing: 0.6)),
      const SizedBox(height: 6),
      DashSizePicker(
        value: w.size,
        onSelect: (n) => setState(() => w.size = n),
      ),
    ]);
  }

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('SPACER');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    return buf.toString();
  }
}
