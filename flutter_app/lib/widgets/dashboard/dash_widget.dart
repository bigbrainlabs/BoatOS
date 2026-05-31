// lib/widgets/dashboard/dash_widget.dart
//
// Public config model for dashboard widgets.
// Replaces the private _DashWidget classes in dashboard_screen.dart and settings_screen.dart.

import 'package:flutter/material.dart';
import '../gauge_widget.dart';

export '../gauge_widget.dart' show GaugeStyle, SensorCardStyle, parseDashColor, kDashColors;

// ─────────────────────────────────────────────────────────────────────────────
// DashWidget — unified config model (var fields for editor mutability)
// ─────────────────────────────────────────────────────────────────────────────

class DashWidget {
  String type;       // SENSOR, GAUGE, TEXT, SPACER, CLOCK, COMPASS, HORIZON
  String? sensor;    // primary sensor path (base_name)
  String? field;     // optional field override
  String? alias;
  String? style;
  double? min;
  double? max;
  String? unit;
  String? label;
  int?    decimals;
  String? text;
  int     size;
  String? color;

  // HORIZON-specific
  String? rollSensor;
  String? rollField;
  String? pitchSensor;
  String? pitchField;
  String? impactSensor;
  String? impactField;

  DashWidget({
    required this.type,
    this.sensor,
    this.field,
    this.alias,
    this.style,
    this.min,
    this.max,
    this.unit,
    this.label,
    this.decimals,
    this.text,
    this.size = 1,
    this.color,
    this.rollSensor,
    this.rollField,
    this.pitchSensor,
    this.pitchField,
    this.impactSensor,
    this.impactField,
  });

  DashWidget copy() => DashWidget(
    type: type, sensor: sensor, field: field,
    alias: alias, style: style, min: min, max: max,
    unit: unit, label: label, decimals: decimals,
    text: text, size: size, color: color,
    rollSensor: rollSensor, rollField: rollField,
    pitchSensor: pitchSensor, pitchField: pitchField,
    impactSensor: impactSensor, impactField: impactField,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DashRow — row config used in settings editor
// ─────────────────────────────────────────────────────────────────────────────

class DashRow {
  String name;
  List<DashWidget> widgets;
  int height;
  DashRow({required this.name, required this.widgets, this.height = 1});
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal DSL config models (used by dashboard_screen.dart parser)
// ─────────────────────────────────────────────────────────────────────────────

class GaugeCfg {
  final String path;
  final double min, max;
  final String unit, label;
  final GaugeStyle style;
  final Color color;
  final int decimals, size;

  const GaugeCfg({
    required this.path, required this.min, required this.max,
    required this.unit, required this.label, required this.style,
    required this.color, required this.decimals, required this.size,
  });
}

class SensorCfg {
  final String path, alias;
  final SensorCardStyle style;
  final Color color;
  final int size;
  final List<String> show, hide;

  const SensorCfg({
    required this.path, required this.alias, required this.style,
    required this.color, required this.size,
    this.show = const [], this.hide = const [],
  });
}

class SimpleCfg {
  final int size;
  final String text;
  const SimpleCfg({this.size = 1, this.text = ''});
}
