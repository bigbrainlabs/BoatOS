// lib/widgets/dashboard/registry.dart
//
// DashWidgetRegistry — central registry for all dashboard widget types.
// Each widget type registers a builder, editor, and DSL serializer.

import 'package:flutter/material.dart';
import 'dash_widget.dart';

typedef WidgetBuilder = Widget Function(
    DashWidget w, Map<String, dynamic> sensors, {bool impactMuted});
typedef EditorBuilder = Widget Function(
    DashWidget w, StateSetter setState, List<Map<String, dynamic>> allSensors);
typedef DslSerializer = String Function(DashWidget w);

class DashWidgetRegistry {
  static final _builders = <String, WidgetBuilder>{};
  static final _editors  = <String, EditorBuilder>{};
  static final _dslers   = <String, DslSerializer>{};
  static final _labels   = <String, String>{};

  static void register({
    required String type,
    required String label,
    required WidgetBuilder builder,
    required EditorBuilder editor,
    required DslSerializer dsl,
  }) {
    _builders[type] = builder;
    _editors[type]  = editor;
    _dslers[type]   = dsl;
    _labels[type]   = label;
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    final fn = _builders[w.type];
    return fn != null ? fn(w, sensors, impactMuted: impactMuted) : const SizedBox();
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> sensors) {
    final fn = _editors[w.type];
    return fn != null ? fn(w, setState, sensors) : const SizedBox();
  }

  static String toDsl(DashWidget w) {
    final fn = _dslers[w.type];
    return fn != null ? fn(w) : 'SPACER';
  }

  static Iterable<String> get registeredTypes => _builders.keys;
  static String labelFor(String type) => _labels[type] ?? type;
  static bool isRegistered(String type) => _builders.containsKey(type);
}
