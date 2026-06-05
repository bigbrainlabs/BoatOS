import 'package:flutter/material.dart';
import '../l10n/l10n_ext.dart';
import '../services/websocket_service.dart';

Future<void> showGpsPanel(BuildContext context, GpsData? gps) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (_) => _GpsPanel(gps: gps),
  );
}

class _GpsPanel extends StatelessWidget {
  final GpsData? gps;
  const _GpsPanel({required this.gps});

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final fix = gps?.hasFix == true;
    final sat = gps?.satellites ?? 0;

    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0D1117),
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // Handle
        Center(
          child: Container(
            width: 40, height: 4,
            margin: const EdgeInsets.only(bottom: 16),
            decoration: BoxDecoration(
              color: const Color(0xFF30363D),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
        // Header
        Row(children: [
          Icon(Icons.satellite_alt,
              color: fix ? const Color(0xFF4FC3F7) : const Color(0xFF8B949E),
              size: 20),
          const SizedBox(width: 10),
          Text(l.gpsStatusTitle,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                  color: Color(0xFFE6EDF3))),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: fix
                  ? const Color(0xFF1A472A)
                  : const Color(0xFF3D1A1A),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.circle,
                  size: 8,
                  color: fix ? const Color(0xFF4CAF50) : const Color(0xFFEF5350)),
              const SizedBox(width: 6),
              Text(fix ? l.gpsFix : l.gpsNoFix,
                  style: TextStyle(
                      fontSize: 12, fontWeight: FontWeight.w600,
                      color: fix
                          ? const Color(0xFF4CAF50)
                          : const Color(0xFFEF5350))),
            ]),
          ),
        ]),
        const SizedBox(height: 16),
        const Divider(color: Color(0xFF30363D), height: 1),
        const SizedBox(height: 16),
        // Stats grid
        if (gps == null)
          Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Text(l.gpsNoData,
                  style: const TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
            ),
          )
        else
          Column(children: [
            Row(children: [
              _tile(l.gpsSatellites, '$sat', Icons.satellite_alt),
              const SizedBox(width: 12),
              _tile('SOG', fix ? '${(gps!.speed * 1.852).toStringAsFixed(1)} km/h' : '--', Icons.speed),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              _tile('COG', fix ? '${gps!.heading.toStringAsFixed(0)}°' : '--', Icons.explore),
              const SizedBox(width: 12),
              _tile(l.gpsAltitude, fix ? '${gps!.altitude.toStringAsFixed(0)} m' : '--', Icons.terrain),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              _tile('HDOP', _hdopText(gps!.hdop, l), Icons.gps_fixed),
              const SizedBox(width: 12),
              _tile(l.gpsPosition, fix
                  ? '${gps!.lat.toStringAsFixed(5)}\n${gps!.lon.toStringAsFixed(5)}'
                  : '--', Icons.location_on),
            ]),
          ]),
      ]),
    );
  }

  String _hdopText(double? hdop, AppLocalizations l) {
    if (hdop == null) return '--';
    if (hdop <= 1.0) return '${hdop.toStringAsFixed(1)} (${l.gpsQualityVeryGood})';
    if (hdop <= 2.0) return '${hdop.toStringAsFixed(1)} (${l.gpsQualityGood})';
    if (hdop <= 5.0) return '${hdop.toStringAsFixed(1)} (${l.gpsQualityOk})';
    return '${hdop.toStringAsFixed(1)} (${l.gpsQualityBad})';
  }

  Widget _tile(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Icon(icon, size: 12, color: const Color(0xFF4FC3F7)),
            const SizedBox(width: 4),
            Text(label,
                style: const TextStyle(
                    fontSize: 10, color: Color(0xFF8B949E),
                    fontWeight: FontWeight.w500, letterSpacing: 0.5)),
          ]),
          const SizedBox(height: 4),
          Text(value,
              style: const TextStyle(
                  fontSize: 14, color: Color(0xFFE6EDF3),
                  fontWeight: FontWeight.w600)),
        ]),
      ),
    );
  }
}
