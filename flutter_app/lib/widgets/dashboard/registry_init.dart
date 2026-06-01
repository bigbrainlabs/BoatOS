// lib/widgets/dashboard/registry_init.dart
//
// Registers all built-in dashboard widget types.
// Call initDashWidgetRegistry() once before runApp().

import 'gauge_widget.dart';
import 'sensor_widget.dart';
import 'clock_widget.dart';
import 'compass_widget.dart';
import 'text_widget.dart';
import 'spacer_widget.dart';
import 'horizon_widget.dart';

void initDashWidgetRegistry() {
  GaugeDashWidget.registerSelf();
  SensorDashWidget.registerSelf();
  ClockDashWidget.registerSelf();
  CompassDashWidget.registerSelf();
  TextDashWidget.registerSelf();
  SpacerDashWidget.registerSelf();
  HorizonDashWidget.registerSelf();
}
