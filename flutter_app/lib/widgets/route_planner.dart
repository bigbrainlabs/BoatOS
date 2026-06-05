// lib/widgets/route_planner.dart
//
// Route-planner overlay widgets for MapScreen.
// All classes are private-convention (prefixed _) and imported only from
// map_screen.dart.  They receive all data/callbacks as constructor params
// so no BuildContext lookups are needed here beyond basic layout.

import 'package:flutter/material.dart';
import 'package:latlong2/latlong.dart';
import '../l10n/l10n_ext.dart';
import 'onscreen_keyboard.dart';

// ---------------------------------------------------------------------------
// Data models (also used by map_screen.dart)
// ---------------------------------------------------------------------------

class RouteWaypoint {
  final int index;
  final double lat, lon;
  final String name;

  const RouteWaypoint({
    required this.index,
    required this.lat,
    required this.lon,
    this.name = '',
  });

  RouteWaypoint copyWith({int? index, double? lat, double? lon, String? name}) =>
      RouteWaypoint(
        index: index ?? this.index,
        lat: lat ?? this.lat,
        lon: lon ?? this.lon,
        name: name ?? this.name,
      );
}

class RouteResult {
  final List<LatLng> coords;
  final double distanceNm;
  final double durationH;
  final String routingType;
  final List<Map<String, dynamic>> locks;

  const RouteResult({
    required this.coords,
    required this.distanceNm,
    required this.durationH,
    required this.routingType,
    required this.locks,
  });
}

class SavedRoute {
  final String id, name;
  final List<RouteWaypoint> waypoints;
  final double distanceNm;
  final String created;

  const SavedRoute({
    required this.id,
    required this.name,
    required this.waypoints,
    required this.distanceNm,
    this.created = '',
  });

  factory SavedRoute.fromJson(Map<String, dynamic> j) {
    final rawWps = (j['waypoints'] as List<dynamic>? ?? []);
    final waypoints = rawWps.asMap().entries.map((e) {
      final w = e.value;
      if (w is Map) {
        // V1 / canonical format: {lat, lon, name?}
        return RouteWaypoint(
          index: e.key,
          lat: (w['lat'] as num).toDouble(),
          lon: (w['lon'] as num).toDouble(),
          name: (w['name'] as String?) ?? '',
        );
      } else {
        // legacy V2 array format: [lon, lat]
        final c = w as List<dynamic>;
        return RouteWaypoint(
          index: e.key,
          lon: (c[0] as num).toDouble(),
          lat: (c[1] as num).toDouble(),
        );
      }
    }).toList();
    return SavedRoute(
      id: (j['id'] ?? '') as String,
      name: (j['name'] ?? '') as String,
      waypoints: waypoints,
      distanceNm: ((j['distance_nm'] ?? j['totalDistanceNM']) as num?)?.toDouble() ?? 0.0,
      created: (j['created'] ?? '') as String,
    );
  }
}

// ---------------------------------------------------------------------------
// _RoutePanel
// ---------------------------------------------------------------------------

class RoutePanel extends StatefulWidget {
  final List<RouteWaypoint> waypoints;
  final RouteResult? routeResult;
  final bool navActive;
  final int navNextWpIdx;
  final bool routeLoading;
  final bool simRunning;
  final bool routeMode;
  final DateTime departure;
  final String distanceUnit;
  final VoidCallback onStartNav;
  final VoidCallback onStopNav;
  final VoidCallback onStartSim;
  final VoidCallback onStopSim;
  final VoidCallback onSave;
  final VoidCallback onShowSaved;
  final VoidCallback onClearAll;
  final ValueChanged<RouteWaypoint> onRemoveWaypoint;
  final ValueChanged<int> onDepartureHourDelta;
  final ValueChanged<int> onDepartureMinuteDelta;
  final double scale;

  const RoutePanel({
    super.key,
    required this.waypoints,
    required this.routeResult,
    required this.navActive,
    required this.navNextWpIdx,
    required this.routeLoading,
    required this.simRunning,
    required this.routeMode,
    required this.departure,
    required this.onStartNav,
    required this.onStopNav,
    required this.onStartSim,
    required this.onStopSim,
    required this.onSave,
    required this.onShowSaved,
    required this.onClearAll,
    required this.onRemoveWaypoint,
    required this.onDepartureHourDelta,
    required this.onDepartureMinuteDelta,
    this.distanceUnit = 'nm',
    this.scale = 1.0,
  });

  @override
  State<RoutePanel> createState() => _RoutePanelState();
}

class _RoutePanelState extends State<RoutePanel> {
  bool _expanded = true;

  static const Color _bg    = Color(0xF2161B22);
  static const Color _border = Color(0xFF30363D);
  static const Color _txt   = Color(0xFFE6EDF3);
  static const Color _sec   = Color(0xFF8B949E);
  static const Color _blue  = Color(0xFF4FC3F7);
  static const Color _green = Color(0xFF2ECC71);
  static const Color _teal  = Color(0xFF64FFDA);

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final s = widget.scale;
    final hasRoute = widget.routeResult != null;
    final hasWps   = widget.waypoints.isNotEmpty;

    if (!widget.routeMode && !hasWps && !hasRoute) return const SizedBox.shrink();

    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        decoration: BoxDecoration(
          color: _bg,
          border: const Border(top: BorderSide(color: _border, width: 1)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // ── Drag handle / collapse toggle ──────────────────────────
            GestureDetector(
              onTap: () => setState(() => _expanded = !_expanded),
              child: Container(
                height: 28 * s,
                color: Colors.transparent,
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 36 * s,
                        height: 4 * s,
                        decoration: BoxDecoration(
                          color: _border,
                          borderRadius: BorderRadius.circular(2 * s),
                        ),
                      ),
                      SizedBox(height: 2 * s),
                      Icon(
                        _expanded
                            ? Icons.keyboard_arrow_down
                            : Icons.keyboard_arrow_up,
                        size: 14 * s,
                        color: _sec,
                      ),
                    ],
                  ),
                ),
              ),
            ),

            if (_expanded) ...[
              Padding(
                padding: EdgeInsets.fromLTRB(12 * s, 0, 12 * s, 8 * s),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ── Route loading indicator ────────────────────────
                    if (widget.routeLoading)
                      Padding(
                        padding: EdgeInsets.only(bottom: 8 * s),
                        child: LinearProgressIndicator(
                          color: _blue,
                          backgroundColor: _border,
                          minHeight: 2 * s,
                        ),
                      ),

                    // ── Empty-state hint ──────────────────────────────
                    if (!hasWps && !hasRoute)
                      Padding(
                        padding: EdgeInsets.symmetric(vertical: 6 * s),
                        child: Row(children: [
                          Icon(Icons.touch_app_outlined,
                              size: 14 * s, color: _sec),
                          SizedBox(width: 6 * s),
                          Text(
                            l.mapLongTapHint,
                            style: TextStyle(fontSize: 11 * s, color: _sec),
                          ),
                        ]),
                      ),

                    // ── Waypoint list ──────────────────────────────────
                    if (hasWps)
                      ConstrainedBox(
                        constraints: BoxConstraints(maxHeight: 120 * s),
                        child: ListView.builder(
                          shrinkWrap: true,
                          padding: EdgeInsets.zero,
                          itemCount: widget.waypoints.length,
                          itemBuilder: (_, i) {
                            final wp = widget.waypoints[i];
                            final isCurrent = widget.navActive &&
                                i == widget.navNextWpIdx;
                            return _WaypointRow(
                              waypoint: wp,
                              isCurrent: isCurrent,
                              navActive: widget.navActive,
                              onRemove: () => widget.onRemoveWaypoint(wp),
                              scale: s,
                            );
                          },
                        ),
                      ),

                    // ── Route stats ────────────────────────────────────
                    if (hasRoute) ...[
                      SizedBox(height: 8 * s),
                      _buildStatsRow(s, l),
                    ],

                    // ── Departure row ──────────────────────────────────
                    if (hasRoute) ...[
                      SizedBox(height: 6 * s),
                      _buildDepartureRow(s, l),
                    ],

                    // ── Action buttons ─────────────────────────────────
                    SizedBox(height: 8 * s),
                    _buildActionRow(s, hasRoute, l),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ── Stats row ─────────────────────────────────────────────────────────────

  Widget _buildStatsRow(double s, AppLocalizations l) {
    final r = widget.routeResult!;
    final totalMin = (r.durationH * 60).round();
    final h = totalMin ~/ 60;
    final m = totalMin % 60;
    final durationStr = h > 0 ? '${h}h ${m}min' : '${m}min';

    final eta = widget.departure.add(Duration(
      hours: r.durationH.truncate(),
      minutes: ((r.durationH % 1) * 60).round(),
    ));
    final now = DateTime.now();
    final isToday = eta.day == now.day &&
        eta.month == now.month &&
        eta.year == now.year;
    final etaStr = isToday
        ? '${l.mapToday} ${_twoDigit(eta.hour)}:${_twoDigit(eta.minute)}'
        : '${_weekday(eta.weekday)}. ${_twoDigit(eta.hour)}:${_twoDigit(eta.minute)}';

    final isKm = widget.distanceUnit == 'km';
    final distDisplay = isKm
        ? '${(r.distanceNm * 1.852).toStringAsFixed(1)} km'
        : '${r.distanceNm.toStringAsFixed(1)} NM';

    return Wrap(
      spacing: 20 * s,
      runSpacing: 4 * s,
      children: [
        _statChip(Icons.straighten, distDisplay, _teal, s),
        _statChip(Icons.schedule,   durationStr,   _blue, s),
        _statChip(Icons.flag,       'ETA $etaStr',  _sec,  s),
        if (r.locks.isNotEmpty)
          _statChip(Icons.lock, '${r.locks.length} Schleuse${r.locks.length > 1 ? 'n' : ''}', const Color(0xFFFFB74D), s),
        if (r.routingType != 'osrm')
          _statChip(Icons.alt_route, l.mapDirect, const Color(0xFFE74C3C), s),
      ],
    );
  }

  Widget _statChip(IconData icon, String text, Color color, double s) => Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 11 * s, color: color),
          SizedBox(width: 3 * s),
          Text(text,
              style: TextStyle(fontSize: 11 * s, color: color)),
        ],
      );

  // ── Departure row ─────────────────────────────────────────────────────────

  Widget _buildDepartureRow(double s, AppLocalizations l) {
    final dep = widget.departure;
    final depStr =
        '${_weekday(dep.weekday)}. ${_twoDigit(dep.day)}.${_twoDigit(dep.month)}  ${_twoDigit(dep.hour)}:${_twoDigit(dep.minute)}';

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(l.mapDeparture, style: TextStyle(fontSize: 10 * s, color: _sec)),
        SizedBox(width: 6 * s),
        Text(depStr,
            style: TextStyle(
                fontSize: 11 * s,
                color: _txt,
                fontWeight: FontWeight.w500)),
        SizedBox(width: 8 * s),
        _depBtn(Icons.remove, () => widget.onDepartureHourDelta(-1), s),
        SizedBox(width: 2 * s),
        Text('-1h/+1h', style: TextStyle(fontSize: 9 * s, color: _sec)),
        SizedBox(width: 2 * s),
        _depBtn(Icons.add, () => widget.onDepartureHourDelta(1), s),
        SizedBox(width: 6 * s),
        _depBtn(Icons.remove, () => widget.onDepartureMinuteDelta(-15), s),
        SizedBox(width: 2 * s),
        Text('±15min', style: TextStyle(fontSize: 9 * s, color: _sec)),
        SizedBox(width: 2 * s),
        _depBtn(Icons.add, () => widget.onDepartureMinuteDelta(15), s),
        SizedBox(width: 6 * s),
        GestureDetector(
          onTap: () {
            // reset to now
            widget.onDepartureHourDelta(0); // triggers a "now" reset in parent
          },
          child: Text(l.mapNow,
              style: TextStyle(
                  fontSize: 10 * s,
                  color: _blue,
                  decoration: TextDecoration.underline)),
        ),
      ],
    );
  }

  Widget _depBtn(IconData icon, VoidCallback onTap, double s) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          width: 22 * s,
          height: 22 * s,
          decoration: BoxDecoration(
            color: const Color(0xFF21262D),
            border: Border.all(color: _border),
            borderRadius: BorderRadius.circular(4 * s),
          ),
          child: Icon(icon, size: 12 * s, color: _sec),
        ),
      );

  // ── Action buttons ────────────────────────────────────────────────────────

  Widget _buildActionRow(double s, bool hasRoute, AppLocalizations l) => SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            if (hasRoute)
              _actionBtn(
                icon: widget.navActive ? Icons.stop : Icons.navigation,
                label: widget.navActive ? l.mapNavStop : l.mapNavigation,
                color: _green,
                onTap:
                    widget.navActive ? widget.onStopNav : widget.onStartNav,
                scale: s,
              ),
            if (hasRoute) SizedBox(width: 8 * s),
            if (hasRoute)
              _actionBtn(
                icon: widget.simRunning
                    ? Icons.stop_circle
                    : Icons.play_circle_outline,
                label: widget.simRunning ? l.mapSimStop : l.mapSimulation,
                color: _blue,
                onTap:
                    widget.simRunning ? widget.onStopSim : widget.onStartSim,
                scale: s,
              ),
            if (hasRoute) SizedBox(width: 8 * s),
            if (hasRoute)
              _actionBtn(
                icon: Icons.save_outlined,
                label: l.btnSave,
                color: _teal,
                onTap: widget.onSave,
                scale: s,
              ),
            if (hasRoute) SizedBox(width: 8 * s),
            _actionBtn(
              icon: Icons.folder_open_outlined,
              label: l.mapSavedRoutesTitle,
              color: _sec,
              onTap: widget.onShowSaved,
              scale: s,
            ),
            SizedBox(width: 8 * s),
            _actionBtn(
              icon: Icons.delete_outline,
              label: l.btnDelete,
              color: const Color(0xFFE74C3C),
              onTap: widget.onClearAll,
              scale: s,
            ),
          ],
        ),
      );

  Widget _actionBtn({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    required double scale,
  }) =>
      GestureDetector(
        onTap: onTap,
        child: Container(
          padding:
              EdgeInsets.symmetric(horizontal: 10 * scale, vertical: 6 * scale),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.15),
            border: Border.all(
                color: color.withValues(alpha: 0.5)),
            borderRadius: BorderRadius.circular(8 * scale),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14 * scale, color: color),
              SizedBox(width: 4 * scale),
              Text(label,
                  style: TextStyle(
                      fontSize: 11 * scale,
                      color: color,
                      fontWeight: FontWeight.w500)),
            ],
          ),
        ),
      );

  // ── Helpers ───────────────────────────────────────────────────────────────

  String _twoDigit(int n) => n.toString().padLeft(2, '0');

  String _weekday(int wd) => const [
        '', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'
      ][wd];
}

// ---------------------------------------------------------------------------
// _WaypointRow  (used inside RoutePanel)
// ---------------------------------------------------------------------------

class _WaypointRow extends StatelessWidget {
  final RouteWaypoint waypoint;
  final bool isCurrent;
  final bool navActive;
  final VoidCallback onRemove;
  final double scale;

  const _WaypointRow({
    required this.waypoint,
    required this.isCurrent,
    required this.navActive,
    required this.onRemove,
    required this.scale,
  });

  @override
  Widget build(BuildContext context) {
    final s = scale;
    final highlight = isCurrent ? const Color(0xFF2ECC71) : const Color(0xFF1565C0);
    final rowBg = isCurrent
        ? const Color(0x1A2ECC71)
        : Colors.transparent;

    return Container(
      margin: EdgeInsets.only(bottom: 3 * s),
      padding: EdgeInsets.symmetric(horizontal: 6 * s, vertical: 3 * s),
      decoration: BoxDecoration(
        color: rowBg,
        borderRadius: BorderRadius.circular(5 * s),
      ),
      child: Row(
        children: [
          Container(
            width: 20 * s,
            height: 20 * s,
            decoration: BoxDecoration(
              color: highlight,
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 1.5 * s),
            ),
            child: Center(
              child: Text(
                '${waypoint.index + 1}',
                style: TextStyle(
                    color: Colors.white,
                    fontSize: 10 * s,
                    fontWeight: FontWeight.bold),
              ),
            ),
          ),
          SizedBox(width: 8 * s),
          Expanded(
            child: Text(
              waypoint.name.isNotEmpty
                  ? waypoint.name
                  : '${waypoint.lat.toStringAsFixed(4)}, ${waypoint.lon.toStringAsFixed(4)}',
              style: TextStyle(
                fontSize: 11 * s,
                color: isCurrent
                    ? const Color(0xFF2ECC71)
                    : const Color(0xFFE6EDF3),
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (isCurrent)
            Padding(
              padding: EdgeInsets.only(right: 6 * s),
              child: Icon(Icons.navigation,
                  size: 12 * s, color: const Color(0xFF2ECC71)),
            ),
          GestureDetector(
            onTap: navActive ? null : onRemove,
            child: Icon(
              Icons.close,
              size: 14 * s,
              color: navActive
                  ? const Color(0xFF30363D)
                  : const Color(0xFF8B949E),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// SimSpeedBar
// ---------------------------------------------------------------------------

class SimSpeedBar extends StatelessWidget {
  final double speed;
  final ValueChanged<double> onChanged;
  final double scale;

  const SimSpeedBar({
    super.key,
    required this.speed,
    required this.onChanged,
    this.scale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final s = scale;
    return Positioned(
      top: 48 * s,
      left: 80 * s,
      right: 80 * s,
      child: Container(
        padding: EdgeInsets.symmetric(horizontal: 12 * s, vertical: 6 * s),
        decoration: BoxDecoration(
          color: const Color(0xF2161B22),
          border: Border.all(color: const Color(0xFF30363D)),
          borderRadius: BorderRadius.circular(10 * s),
        ),
        child: Row(
          children: [
            Icon(Icons.play_circle_outline,
                size: 14 * s, color: const Color(0xFF4FC3F7)),
            SizedBox(width: 6 * s),
            Text('Sim ×${speed.round()}',
                style: TextStyle(
                    fontSize: 12 * s,
                    color: const Color(0xFF4FC3F7),
                    fontWeight: FontWeight.bold)),
            SizedBox(width: 8 * s),
            Expanded(
              child: SliderTheme(
                data: SliderThemeData(
                  trackHeight: 3 * s,
                  thumbShape: RoundSliderThumbShape(
                      enabledThumbRadius: 8 * s),
                  overlayShape:
                      RoundSliderOverlayShape(overlayRadius: 14 * s),
                  activeTrackColor: const Color(0xFF4FC3F7),
                  inactiveTrackColor: const Color(0xFF30363D),
                  thumbColor: const Color(0xFF4FC3F7),
                  overlayColor: const Color(0x224FC3F7),
                ),
                child: Slider(
                  value: speed.clamp(1, 1000),
                  min: 1,
                  max: 1000,
                  divisions: 199,
                  onChanged: onChanged,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// NavCard  (next-waypoint overlay shown when nav is active)
// ---------------------------------------------------------------------------

class NavCard extends StatelessWidget {
  final RouteWaypoint? nextWaypoint;
  final double distToNextNm;
  final double bearingDeg;
  final String distanceUnit;
  final double scale;

  const NavCard({
    super.key,
    required this.nextWaypoint,
    required this.distToNextNm,
    required this.bearingDeg,
    this.distanceUnit = 'nm',
    this.scale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    if (nextWaypoint == null) return const SizedBox.shrink();
    final s = scale;
    final label = nextWaypoint!.name.isNotEmpty
        ? nextWaypoint!.name
        : 'Waypoint ${nextWaypoint!.index + 1}';
    final String distStr;
    if (distToNextNm < 0.1) {
      distStr = '${(distToNextNm * 1852).round()} m';
    } else if (distanceUnit == 'km') {
      distStr = '${(distToNextNm * 1.852).toStringAsFixed(2)} km';
    } else {
      distStr = '${distToNextNm.toStringAsFixed(2)} NM';
    }

    return Positioned(
      top: 44 * s,
      left: 0,
      right: 0,
      child: Center(
        child: Container(
          padding: EdgeInsets.symmetric(
              horizontal: 14 * s, vertical: 7 * s),
          decoration: BoxDecoration(
            color: const Color(0xF2161B22),
            border: Border.all(color: const Color(0xFF2ECC71), width: 1.5),
            borderRadius: BorderRadius.circular(10 * s),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Transform.rotate(
                angle: bearingDeg * (3.14159265 / 180),
                child: Icon(Icons.navigation,
                    size: 16 * s, color: const Color(0xFF2ECC71)),
              ),
              SizedBox(width: 8 * s),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(label,
                      style: TextStyle(
                          fontSize: 11 * s,
                          color: const Color(0xFF8B949E))),
                  Text(distStr,
                      style: TextStyle(
                          fontSize: 14 * s,
                          color: const Color(0xFF2ECC71),
                          fontWeight: FontWeight.bold)),
                ],
              ),
              SizedBox(width: 10 * s),
              Text('${bearingDeg.round()}°',
                  style: TextStyle(
                      fontSize: 12 * s,
                      color: const Color(0xFF4FC3F7))),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// SavedRoutesSheet
// ---------------------------------------------------------------------------

class SavedRoutesSheet extends StatelessWidget {
  final List<SavedRoute> routes;
  final VoidCallback onClose;
  final ValueChanged<SavedRoute> onLoad;
  final ValueChanged<String> onDelete;
  final bool loading;
  final String distanceUnit;
  final double scale;

  const SavedRoutesSheet({
    super.key,
    required this.routes,
    required this.onClose,
    required this.onLoad,
    required this.onDelete,
    this.loading = false,
    this.distanceUnit = 'nm',
    this.scale = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final s = scale;
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        constraints: BoxConstraints(maxHeight: 340 * s),
        decoration: const BoxDecoration(
          color: Color(0xF5161B22),
          border: Border(top: BorderSide(color: Color(0xFF30363D), width: 1)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Header
            Padding(
              padding: EdgeInsets.fromLTRB(14 * s, 10 * s, 8 * s, 6 * s),
              child: Row(
                children: [
                  Icon(Icons.folder_open_outlined,
                      size: 16 * s, color: const Color(0xFF4FC3F7)),
                  SizedBox(width: 6 * s),
                  Text(l.mapSavedRoutesTitle,
                      style: TextStyle(
                          fontSize: 14 * s,
                          color: const Color(0xFFE6EDF3),
                          fontWeight: FontWeight.bold)),
                  const Spacer(),
                  GestureDetector(
                    onTap: onClose,
                    child: Icon(Icons.close,
                        color: const Color(0xFF8B949E), size: 20 * s),
                  ),
                ],
              ),
            ),
            const Divider(color: Color(0xFF30363D), height: 1),
            // Body
            if (loading)
              Padding(
                padding: EdgeInsets.all(16 * s),
                child: const CircularProgressIndicator(
                    color: Color(0xFF4FC3F7)),
              )
            else if (routes.isEmpty)
              Padding(
                padding: EdgeInsets.all(24 * s),
                child: Text(l.mapNoSavedRoutes,
                    style: TextStyle(
                        fontSize: 13 * s,
                        color: const Color(0xFF8B949E))),
              )
            else
              Expanded(
                child: ListView.builder(
                  padding: EdgeInsets.symmetric(vertical: 4 * s),
                  itemCount: routes.length,
                  itemBuilder: (_, i) => _SavedRouteRow(
                    route: routes[i],
                    onLoad: () => onLoad(routes[i]),
                    onDelete: () => onDelete(routes[i].id),
                    distanceUnit: distanceUnit,
                    scale: s,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SavedRouteRow extends StatelessWidget {
  final SavedRoute route;
  final VoidCallback onLoad;
  final VoidCallback onDelete;
  final String distanceUnit;
  final double scale;

  const _SavedRouteRow({
    required this.route,
    required this.onLoad,
    required this.onDelete,
    this.distanceUnit = 'nm',
    required this.scale,
  });

  @override
  Widget build(BuildContext context) {
    final s = scale;
    String dateStr = '';
    if (route.created.isNotEmpty) {
      try {
        final dt = DateTime.parse(route.created).toLocal();
        dateStr =
            '${dt.day}.${dt.month}.${dt.year}';
      } catch (_) {}
    }

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 10 * s, vertical: 3 * s),
      padding: EdgeInsets.symmetric(horizontal: 10 * s, vertical: 8 * s),
      decoration: BoxDecoration(
        color: const Color(0xFF0D1117),
        border: Border.all(color: const Color(0xFF30363D)),
        borderRadius: BorderRadius.circular(7 * s),
      ),
      child: Row(
        children: [
          Icon(Icons.route, size: 16 * s, color: const Color(0xFF4FC3F7)),
          SizedBox(width: 8 * s),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(route.name,
                    style: TextStyle(
                        fontSize: 13 * s,
                        color: const Color(0xFFE6EDF3),
                        fontWeight: FontWeight.w500),
                    overflow: TextOverflow.ellipsis),
                Text(
                  [
                    if (route.distanceNm > 0)
                      distanceUnit == 'km'
                          ? '${(route.distanceNm * 1.852).toStringAsFixed(1)} km'
                          : '${route.distanceNm.toStringAsFixed(1)} NM',
                    if (dateStr.isNotEmpty) dateStr,
                    '${route.waypoints.length} WP',
                  ].join('  ·  '),
                  style: TextStyle(
                      fontSize: 10 * s, color: const Color(0xFF8B949E)),
                ),
              ],
            ),
          ),
          SizedBox(width: 8 * s),
          GestureDetector(
            onTap: onLoad,
            child: Container(
              padding: EdgeInsets.symmetric(
                  horizontal: 10 * s, vertical: 5 * s),
              decoration: BoxDecoration(
                color: const Color(0x1A2ECC71),
                border: Border.all(color: const Color(0x882ECC71)),
                borderRadius: BorderRadius.circular(6 * s),
              ),
              child: Text('Laden',
                  style: TextStyle(
                      fontSize: 11 * s,
                      color: const Color(0xFF2ECC71))),
            ),
          ),
          SizedBox(width: 6 * s),
          GestureDetector(
            onTap: onDelete,
            child: Icon(Icons.delete_outline,
                size: 16 * s, color: const Color(0xFFE74C3C)),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// SaveRouteDialog  (inline name entry — touch-friendly, no native dialog)
// ---------------------------------------------------------------------------

class SaveRouteDialog extends StatefulWidget {
  final VoidCallback onCancel;
  final ValueChanged<String> onConfirm;
  final double scale;

  const SaveRouteDialog({
    super.key,
    required this.onCancel,
    required this.onConfirm,
    this.scale = 1.0,
  });

  @override
  State<SaveRouteDialog> createState() => _SaveRouteDialogState();
}

class _SaveRouteDialogState extends State<SaveRouteDialog> {
  final _ctrl = TextEditingController(text: 'Route');

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final s = widget.scale;
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        padding: EdgeInsets.fromLTRB(16 * s, 16 * s, 16 * s, 20 * s),
        decoration: const BoxDecoration(
          color: Color(0xF5161B22),
          border: Border(top: BorderSide(color: Color(0xFF30363D))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(l.mapSaveRoute,
                style: TextStyle(
                    fontSize: 15 * s,
                    color: const Color(0xFFE6EDF3),
                    fontWeight: FontWeight.bold)),
            SizedBox(height: 10 * s),
            GestureDetector(
              onTap: () => showKeyboard(context, _ctrl, label: 'Name').then((_) => setState(() {})),
              child: ValueListenableBuilder<TextEditingValue>(
                valueListenable: _ctrl,
                builder: (_, v, __) => Container(
                  padding: EdgeInsets.symmetric(horizontal: 12 * s, vertical: 11 * s),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0D1117),
                    borderRadius: BorderRadius.circular(8 * s),
                    border: Border.all(color: const Color(0xFF4FC3F7), width: 1.5),
                  ),
                  child: Text(
                    v.text.isEmpty ? l.mapRouteNameHint : v.text,
                    style: TextStyle(
                        fontSize: 14 * s,
                        color: v.text.isEmpty
                            ? const Color(0xFF555555)
                            : const Color(0xFFE6EDF3)),
                  ),
                ),
              ),
            ),
            SizedBox(height: 12 * s),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                GestureDetector(
                  onTap: widget.onCancel,
                  child: Container(
                    padding: EdgeInsets.symmetric(
                        horizontal: 16 * s, vertical: 8 * s),
                    decoration: BoxDecoration(
                      border: Border.all(
                          color: const Color(0xFF30363D)),
                      borderRadius: BorderRadius.circular(8 * s),
                    ),
                    child: Text(l.btnCancel,
                        style: TextStyle(
                            fontSize: 12 * s,
                            color: const Color(0xFF8B949E))),
                  ),
                ),
                SizedBox(width: 10 * s),
                GestureDetector(
                  onTap: () {
                    final name = _ctrl.text.trim();
                    if (name.isNotEmpty) widget.onConfirm(name);
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(
                        horizontal: 16 * s, vertical: 8 * s),
                    decoration: BoxDecoration(
                      color: const Color(0x1A4FC3F7),
                      border: Border.all(
                          color: const Color(0xFF4FC3F7)),
                      borderRadius: BorderRadius.circular(8 * s),
                    ),
                    child: Text(l.btnSave,
                        style: TextStyle(
                            fontSize: 12 * s,
                            color: const Color(0xFF4FC3F7),
                            fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
