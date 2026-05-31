// lib/widgets/dashboard/clock_widget.dart
//
// Dashboard Clock widget — shows current time and date.

import 'package:flutter/material.dart';
import 'dash_widget.dart';
import 'registry.dart';
import 'gauge_widget.dart' show DashSizePicker;

class ClockDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'CLOCK',
      label: 'Uhr',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    final now = DateTime.now();
    final hm = '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
    final sec = now.second.toString().padLeft(2, '0');
    final date =
        '${_weekday(now.weekday)}, ${now.day.toString().padLeft(2, '0')}.${now.month.toString().padLeft(2, '0')}.${now.year}';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0D2040), Color(0xFF0A1828)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFF1E3A5F)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Row(mainAxisAlignment: MainAxisAlignment.center, children: [
            Text(hm,
                style: const TextStyle(
                    fontSize: 36, fontWeight: FontWeight.w700,
                    color: Color(0xFF4FC3F7), fontFamily: 'monospace',
                    letterSpacing: 3)),
            Text(':$sec',
                style: const TextStyle(
                    fontSize: 24, fontWeight: FontWeight.w400,
                    color: Color(0xFF1E6FA0), fontFamily: 'monospace',
                    letterSpacing: 2)),
          ]),
          const SizedBox(height: 4),
          Text(date,
              style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
        ],
      ),
    );
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      const Text('Zeigt Systemzeit und Datum an.',
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
    final buf = StringBuffer('CLOCK');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    return buf.toString();
  }

  static String _weekday(int d) =>
      const ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][d - 1];
}
