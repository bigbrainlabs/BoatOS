// lib/widgets/dashboard/compass_widget.dart
//
// Dashboard Compass widget placeholder.

import 'package:flutter/material.dart';
import 'dash_widget.dart';
import 'registry.dart';
import 'gauge_widget.dart' show DashSizePicker;

class CompassDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'COMPASS',
      label: 'Kompass',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
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
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Kompass-Anzeige.',
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
    final buf = StringBuffer('COMPASS');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    return buf.toString();
  }
}
