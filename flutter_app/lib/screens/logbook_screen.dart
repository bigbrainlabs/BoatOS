import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:latlong2/latlong.dart';

import '../models/logbook_models.dart';
import '../services/logbook_service.dart';
import '../services/settings_service.dart';

const _kBg = Color(0xFF0A0E1A);
const _kCard = Color(0xFF161B22);
const _kPrimary = Color(0xFF4FC3F7);
const _kBorder = Color(0xFF30363D);
const _kMuted = Color(0xFF8B949E);

const _kAvatars = [
  '👨‍✈️', '👩‍✈️', '🧔‍♂️', '👱‍♀️', '👨‍🍳', '👩‍🍳',
  '👨‍💻', '👩‍💻', '👨', '👩', '🧒', '👴',
];

const _kMonths = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];

String _fmtDate(DateTime dt) =>
    '${dt.day}. ${_kMonths[dt.month - 1]} ${dt.year}, '
    '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} Uhr';

String _fmtTime(DateTime dt) =>
    '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';

String _speedStr(double kn, bool kmh) =>
    kmh ? '${(kn * 1.852).toStringAsFixed(1)} km/h' : '${kn.toStringAsFixed(1)} kn';

String _distStr(double nm, bool km) =>
    km ? '${(nm * 1.852).toStringAsFixed(1)} km' : '${nm.toStringAsFixed(1)} NM';

// ─── Screen ───────────────────────────────────────────────────────────────────

class LogbookScreen extends StatefulWidget {
  const LogbookScreen({super.key});

  @override
  State<LogbookScreen> createState() => _LogbookScreenState();
}

class _LogbookScreenState extends State<LogbookScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tab;
  bool _archiveLoaded = false;
  bool _crewLoaded = false;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
    _tab.addListener(_onTabChanged);
  }

  void _onTabChanged() {
    if (!_tab.indexIsChanging) return;
    final svc = context.read<LogbookService>();
    if (_tab.index == 1 && !_archiveLoaded) {
      _archiveLoaded = true;
      svc.loadTrips();
    }
    if (_tab.index == 2 && !_crewLoaded) {
      _crewLoaded = true;
      svc.loadCrew();
    }
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final settings = context.watch<SettingsService>();
    return Scaffold(
      backgroundColor: _kBg,
      appBar: AppBar(
        backgroundColor: _kCard,
        elevation: 0,
        title: const Text('Logbuch', style: TextStyle(fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tab,
          indicatorColor: _kPrimary,
          labelColor: _kPrimary,
          unselectedLabelColor: _kMuted,
          tabs: const [
            Tab(icon: Icon(Icons.anchor), text: 'Fahrt'),
            Tab(icon: Icon(Icons.list_alt), text: 'Archiv'),
            Tab(icon: Icon(Icons.people), text: 'Crew'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tab,
        children: [
          const _TripTab(),
          _ArchiveTab(isKm: settings.isKm, isKmh: settings.isKmh),
          const _CrewTab(),
        ],
      ),
    );
  }
}

// ─── Tab 0: Aktive Fahrt ──────────────────────────────────────────────────────

class _TripTab extends StatefulWidget {
  const _TripTab();

  @override
  State<_TripTab> createState() => _TripTabState();
}

class _TripTabState extends State<_TripTab> {
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    super.dispose();
  }

  String _formatElapsed(DateTime start) {
    final d = DateTime.now().difference(start);
    final h = d.inHours;
    final m = d.inMinutes.remainder(60).toString().padLeft(2, '0');
    final s = d.inSeconds.remainder(60).toString().padLeft(2, '0');
    return h > 0 ? '${h}h ${m}m' : '${m}m ${s}s';
  }

  double _avgSpeedKn(double nm, DateTime start) {
    final hours = DateTime.now().difference(start).inSeconds / 3600;
    return hours < 0.001 ? 0 : nm / hours;
  }

  void _showCrewSheet(BuildContext context, LogbookService svc) {
    if (svc.crew.isEmpty) svc.loadCrew();
    showModalBottomSheet(
      context: context,
      backgroundColor: _kCard,
      isScrollControlled: true,
      builder: (_) => _CrewSelectionSheet(
        onStart: (ids) async {
          final ok = await svc.startTrip(ids);
          if (!ok && context.mounted) _showSnack(context, 'Start fehlgeschlagen');
        },
      ),
    );
  }

  void _confirmStop(BuildContext context, LogbookService svc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _kCard,
        title: const Text('Fahrt beenden?'),
        content: const Text('Die Aufzeichnung wird gestoppt und gespeichert.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              final ok = await svc.stopTrip();
              if (!ok && context.mounted) _showSnack(context, 'Stop fehlgeschlagen');
            },
            child: const Text('Beenden'),
          ),
        ],
      ),
    );
  }

  void _addNote(BuildContext context, LogbookService svc) {
    final ctrl = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _kCard,
        title: const Text('Notiz hinzufügen'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 3,
          style: const TextStyle(color: Colors.white),
          decoration: const InputDecoration(
            hintText: 'Notiz...',
            hintStyle: TextStyle(color: _kMuted),
            border: OutlineInputBorder(),
            enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: _kBorder)),
            focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: _kPrimary)),
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: _kPrimary, foregroundColor: Colors.black87),
            onPressed: () async {
              final text = ctrl.text.trim();
              Navigator.pop(ctx);
              if (text.isNotEmpty) {
                final ok = await svc.addManualEntry(text);
                if (!ok && context.mounted) _showSnack(context, 'Notiz konnte nicht gespeichert werden');
              }
            },
            child: const Text('Speichern'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final svc = context.watch<LogbookService>();
    final settings = context.watch<SettingsService>();
    final status = svc.status;

    if (!status.recording) {
      return _IdleView(onStart: () => _showCrewSheet(context, svc));
    }

    final elapsedStr = svc.tripStartTime != null ? _formatElapsed(svc.tripStartTime!) : '—';
    final dist = _distStr(status.distanceNm, settings.isKm);
    final spd = svc.tripStartTime != null
        ? _speedStr(_avgSpeedKn(status.distanceNm, svc.tripStartTime!), settings.isKmh)
        : '—';

    return _RecordingView(
      status: status,
      elapsedStr: elapsedStr,
      distStr: dist,
      speedStr: spd,
      onPause: () async {
        final ok = await svc.pauseTrip();
        if (!ok && context.mounted) _showSnack(context, 'Pause fehlgeschlagen');
      },
      onResume: () async {
        final ok = await svc.resumeTrip();
        if (!ok && context.mounted) _showSnack(context, 'Fortsetzen fehlgeschlagen');
      },
      onStop: () => _confirmStop(context, svc),
      onAddNote: () => _addNote(context, svc),
    );
  }
}

class _IdleView extends StatelessWidget {
  final VoidCallback onStart;
  const _IdleView({required this.onStart});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.anchor, size: 80, color: _kMuted.withAlpha(80)),
            const SizedBox(height: 24),
            const Text('Keine aktive Fahrtaufzeichnung',
                style: TextStyle(fontSize: 18, color: _kMuted), textAlign: TextAlign.center),
            const SizedBox(height: 32),
            SizedBox(
              width: 220,
              height: 52,
              child: ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPrimary,
                  foregroundColor: Colors.black87,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.play_arrow),
                label: const Text('Fahrt starten',
                    style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                onPressed: onStart,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RecordingView extends StatelessWidget {
  final TrackStatus status;
  final String elapsedStr;
  final String distStr;
  final String speedStr;
  final VoidCallback onPause;
  final VoidCallback onResume;
  final VoidCallback onStop;
  final VoidCallback onAddNote;

  const _RecordingView({
    required this.status,
    required this.elapsedStr,
    required this.distStr,
    required this.speedStr,
    required this.onPause,
    required this.onResume,
    required this.onStop,
    required this.onAddNote,
  });

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _StatusHeader(recording: status.recording, paused: status.paused),
          const SizedBox(height: 14),
          LayoutBuilder(builder: (_, constraints) {
            final w = (constraints.maxWidth - 12) / 2;
            return Wrap(
              spacing: 12,
              runSpacing: 8,
              children: [
                _StatChip(label: 'Distanz', value: distStr, width: w),
                _StatChip(label: 'Dauer', value: elapsedStr, width: w),
                _StatChip(label: 'Punkte', value: status.points.toString(), width: w),
                _StatChip(label: 'Ø Geschw.', value: speedStr, width: w),
              ],
            );
          }),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: _kPrimary,
                    side: const BorderSide(color: _kPrimary),
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: Icon(status.paused ? Icons.play_arrow : Icons.pause),
                  label: Text(status.paused ? 'Weiter' : 'Pause'),
                  onPressed: status.paused ? onResume : onPause,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.red.shade700,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 13),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  icon: const Icon(Icons.stop),
                  label: const Text('Fahrt beenden'),
                  onPressed: onStop,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          TextButton.icon(
            style: TextButton.styleFrom(foregroundColor: _kMuted),
            icon: const Icon(Icons.edit_note, size: 18),
            label: const Text('Notiz hinzufügen'),
            onPressed: onAddNote,
          ),
        ],
      ),
    );
  }
}

class _StatusHeader extends StatelessWidget {
  final bool recording;
  final bool paused;
  const _StatusHeader({required this.recording, required this.paused});

  @override
  Widget build(BuildContext context) {
    final color = paused ? Colors.orange : Colors.green;
    final label = paused ? 'Pausiert' : 'Aufzeichnung läuft';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: color.withAlpha(25),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: color.withAlpha(80)),
      ),
      child: Row(
        children: [
          Container(width: 9, height: 9,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(color: color, fontWeight: FontWeight.w600, fontSize: 14)),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final String label;
  final String value;
  final double? width;
  const _StatChip({required this.label, required this.value, this.width});

  @override
  Widget build(BuildContext context) {
    final inner = Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: _kCard,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _kBorder),
      ),
      child: Row(
        mainAxisSize: width == null ? MainAxisSize.min : MainAxisSize.max,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: _kMuted)),
          const SizedBox(width: 8),
          Flexible(
            child: Text(value,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                overflow: TextOverflow.ellipsis),
          ),
        ],
      ),
    );
    return width != null ? SizedBox(width: width, child: inner) : inner;
  }
}

// ─── Crew-Auswahl BottomSheet ─────────────────────────────────────────────────

class _CrewSelectionSheet extends StatefulWidget {
  final void Function(List<int> ids) onStart;
  const _CrewSelectionSheet({required this.onStart});

  @override
  State<_CrewSelectionSheet> createState() => _CrewSelectionSheetState();
}

class _CrewSelectionSheetState extends State<_CrewSelectionSheet> {
  final Set<int> _selected = {};

  @override
  Widget build(BuildContext context) {
    final crew = context.watch<LogbookService>().crew;
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Crew für diese Fahrt',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Optional — kann leer bleiben',
              style: TextStyle(fontSize: 12, color: _kMuted)),
          const SizedBox(height: 12),
          if (crew.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Text('Keine Crew-Mitglieder vorhanden.', style: TextStyle(color: _kMuted)),
            )
          else
            ...crew.map((m) => CheckboxListTile(
                  value: _selected.contains(m.id),
                  onChanged: (v) => setState(() {
                    if (v == true) _selected.add(m.id); else _selected.remove(m.id);
                  }),
                  title: Row(children: [
                    Text(m.avatar, style: const TextStyle(fontFamilyFallback: ['NotoColorEmoji'])),
                    const SizedBox(width: 6),
                    Text(m.name),
                  ]),
                  subtitle: Text(m.role, style: const TextStyle(color: _kMuted, fontSize: 12)),
                  activeColor: _kPrimary,
                  controlAffinity: ListTileControlAffinity.leading,
                )),
          const SizedBox(height: 12),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: _kPrimary,
              foregroundColor: Colors.black87,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            icon: const Icon(Icons.play_arrow),
            label: const Text('Fahrt starten', style: TextStyle(fontWeight: FontWeight.bold)),
            onPressed: () {
              Navigator.pop(context);
              widget.onStart(_selected.toList());
            },
          ),
        ],
      ),
    );
  }
}

// ─── Tab 1: Archiv ────────────────────────────────────────────────────────────

class _ArchiveTab extends StatelessWidget {
  final bool isKm;
  final bool isKmh;
  const _ArchiveTab({required this.isKm, required this.isKmh});

  @override
  Widget build(BuildContext context) {
    final svc = context.watch<LogbookService>();

    if (svc.loadingTrips) {
      return const Center(child: CircularProgressIndicator(color: _kPrimary));
    }

    if (svc.trips.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.list_alt, size: 64, color: _kMuted.withAlpha(80)),
            const SizedBox(height: 16),
            const Text('Keine Fahrten gespeichert', style: TextStyle(color: _kMuted)),
          ],
        ),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(12),
      itemCount: svc.trips.length,
      itemBuilder: (ctx, i) {
        final t = svc.trips[i];
        return _TripCard(
          dateStr: _fmtDate(t.tripStart),
          duration: t.duration,
          distStr: _distStr(t.distanceNm, isKm),
          points: t.points,
          onTap: () => _openDetail(ctx, t.id, isKm: isKm, isKmh: isKmh),
        );
      },
    );
  }

  void _openDetail(BuildContext context, int id, {required bool isKm, required bool isKmh}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: _kCard,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (_) => _TripDetailSheet(tripId: id, isKm: isKm, isKmh: isKmh),
    );
  }
}

class _TripCard extends StatelessWidget {
  final String dateStr;
  final String duration;
  final String distStr;
  final int points;
  final VoidCallback onTap;

  const _TripCard({
    required this.dateStr, required this.duration,
    required this.distStr, required this.points, required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: _kCard,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text(dateStr,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15))),
                Text(duration, style: const TextStyle(color: _kMuted, fontSize: 14)),
              ],
            ),
            const SizedBox(height: 6),
            Row(children: [
              const Icon(Icons.route, size: 13, color: _kMuted),
              const SizedBox(width: 4),
              Text(distStr, style: const TextStyle(color: _kPrimary, fontSize: 13)),
              const SizedBox(width: 14),
              const Icon(Icons.location_on, size: 13, color: _kMuted),
              const SizedBox(width: 4),
              Text('$points Punkte', style: const TextStyle(color: _kMuted, fontSize: 13)),
            ]),
          ],
        ),
      ),
    );
  }
}

// ─── Trip Detail Modal ────────────────────────────────────────────────────────

class _TripDetailSheet extends StatefulWidget {
  final int tripId;
  final bool isKm;
  final bool isKmh;
  const _TripDetailSheet({required this.tripId, required this.isKm, required this.isKmh});

  @override
  State<_TripDetailSheet> createState() => _TripDetailSheetState();
}

class _TripDetailSheetState extends State<_TripDetailSheet> {
  TripDetail? _detail;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final svc = context.read<LogbookService>();
    final d = await svc.loadTripDetail(widget.tripId);
    if (mounted) setState(() { _detail = d; _loading = false; });
  }

  Future<void> _downloadGpx(BuildContext context, int tripId) async {
    final svc = context.read<LogbookService>();
    final path = await svc.downloadGpx(tripId);
    if (!mounted) return;
    _showSnack(context, path != null
        ? 'GPX gespeichert: $path'
        : 'GPX-Export fehlgeschlagen');
  }

  double? _maxSpeed(List<TrackPoint> pts) {
    double? max;
    for (final p in pts) {
      if (p.speed != null && (max == null || p.speed! > max)) max = p.speed;
    }
    return max;
  }

  double? _avgSpeedFromTrack(List<TrackPoint> pts, double nm) {
    if (pts.length < 2) return null;
    final dur = pts.last.timestamp.difference(pts.first.timestamp);
    final hours = dur.inSeconds / 3600;
    return hours < 0.001 ? null : nm / hours;
  }

  @override
  Widget build(BuildContext context) {
    final crew = context.watch<LogbookService>().crew;

    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.9,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (ctx, scroll) {
        if (_loading) {
          return const Center(child: CircularProgressIndicator(color: _kPrimary));
        }
        if (_detail == null) {
          return const Center(child: Text('Fehler beim Laden.', style: TextStyle(color: _kMuted)));
        }
        final d = _detail!;
        final startEntry = d.entries.where((e) => e.type == 'trip_start').firstOrNull;
        final maxSpd = _maxSpeed(d.trackData);
        final avgSpd = _avgSpeedFromTrack(d.trackData, d.distanceNm);

        return ListView(
          controller: scroll,
          padding: const EdgeInsets.all(16),
          children: [
            Center(
              child: Container(width: 40, height: 4,
                  decoration: BoxDecoration(color: _kBorder, borderRadius: BorderRadius.circular(2))),
            ),
            const SizedBox(height: 16),
            Text(_fmtDate(d.tripStart),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(Icons.timer_outlined, size: 13, color: _kMuted),
              const SizedBox(width: 4),
              Text(d.duration, style: const TextStyle(color: _kMuted, fontSize: 13)),
              const SizedBox(width: 14),
              const Icon(Icons.route, size: 13, color: _kMuted),
              const SizedBox(width: 4),
              Text(_distStr(d.distanceNm, widget.isKm), style: const TextStyle(color: _kPrimary, fontSize: 13)),
            ]),
            const SizedBox(height: 12),
            Row(children: [
              if (d.trackData.length >= 2)
                Expanded(child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFFFF9800),
                    side: const BorderSide(color: Color(0xFFFF9800)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  icon: const Icon(Icons.map_outlined, size: 16),
                  label: const Text('Auf Karte', style: TextStyle(fontSize: 13)),
                  onPressed: () {
                    final points = d.trackData
                        .map((p) => LatLng(p.lat, p.lon))
                        .toList();
                    context.read<LogbookService>()
                        .displayTripOnMap(points, _fmtDate(d.tripStart));
                    Navigator.pop(context);
                  },
                )),
              if (d.trackData.length >= 2) const SizedBox(width: 10),
              Expanded(child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: _kMuted,
                  side: const BorderSide(color: _kBorder),
                  padding: const EdgeInsets.symmetric(vertical: 8),
                ),
                icon: const Icon(Icons.download_outlined, size: 16),
                label: const Text('GPX', style: TextStyle(fontSize: 13)),
                onPressed: () => _downloadGpx(context, d.id),
              )),
            ]),
            const SizedBox(height: 16),

            if (d.crewIds.isNotEmpty) ...[
              _SectionHeader('Crew'),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: d.crewIds.map((id) {
                  final m = crew.where((c) => c.id == id).firstOrNull;
                  return Chip(
                    backgroundColor: _kBorder,
                    label: m != null
                        ? Row(mainAxisSize: MainAxisSize.min, children: [
                            Text(m.avatar, style: const TextStyle(fontFamilyFallback: ['NotoColorEmoji'])),
                            const SizedBox(width: 4),
                            Text(m.name),
                          ])
                        : Text('ID $id'),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
            ],

            if (startEntry?.weather != null) ...[
              _SectionHeader('Wetter (Start)'),
              _WeatherBlock(weather: startEntry!.weather!, isKmh: widget.isKmh),
              const SizedBox(height: 16),
            ],

            if (startEntry?.pegelNearby != null && startEntry!.pegelNearby!.isNotEmpty) ...[
              _SectionHeader('Pegelstände'),
              _PegelBlock(pegel: startEntry.pegelNearby!),
              const SizedBox(height: 16),
            ],

            if (maxSpd != null || avgSpd != null) ...[
              _SectionHeader('Statistiken'),
              Row(children: [
                if (maxSpd != null)
                  Expanded(child: _DetailStat(
                      label: 'Max Speed', value: _speedStr(maxSpd, widget.isKmh))),
                if (maxSpd != null && avgSpd != null) const SizedBox(width: 10),
                if (avgSpd != null)
                  Expanded(child: _DetailStat(
                      label: 'Ø Speed', value: _speedStr(avgSpd, widget.isKmh))),
              ]),
              const SizedBox(height: 16),
            ],

            if (d.entries.isNotEmpty) ...[
              _SectionHeader('Logeinträge'),
              () {
                final start = d.entries.where((e) => e.type == 'trip_start').firstOrNull;
                final end   = d.entries.where((e) => e.type == 'trip_end').firstOrNull;
                final rest  = d.entries.where((e) => e.type != 'trip_start' && e.type != 'trip_end').toList();
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (start != null || end != null)
                      Row(children: [
                        if (start != null)
                          Expanded(child: _StartEndChip(entry: start)),
                        if (start != null && end != null) const SizedBox(width: 8),
                        if (end != null)
                          Expanded(child: _StartEndChip(entry: end)),
                      ]),
                    if (rest.isNotEmpty) const SizedBox(height: 6),
                    ...rest.map((e) => _LogEntryTile(entry: e)),
                  ],
                );
              }(),
            ],
          ],
        );
      },
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;
  const _SectionHeader(this.title);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Text(title,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
              color: _kMuted, letterSpacing: 0.8)),
    );
  }
}

class _DetailStat extends StatelessWidget {
  final String label;
  final String value;
  const _DetailStat({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: _kBg, borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _kBorder),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 11, color: _kMuted)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
      ]),
    );
  }
}

class _WeatherBlock extends StatelessWidget {
  final Map<String, dynamic> weather;
  final bool isKmh;
  const _WeatherBlock({required this.weather, required this.isKmh});

  @override
  Widget build(BuildContext context) {
    final temp = weather['temperature'] ?? weather['temp'];
    final rawWind = weather['wind_speed'] ?? weather['wind'];
    final desc = weather['description'] ?? weather['condition'];

    String? windStr;
    if (rawWind != null) {
      final kn = (rawWind as num).toDouble();
      windStr = isKmh
          ? '${(kn * 1.852).toStringAsFixed(1)} km/h'
          : '${kn.toStringAsFixed(1)} kn';
    }

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: _kBg, borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _kBorder),
      ),
      child: Wrap(
        spacing: 16, runSpacing: 8,
        children: [
          if (temp != null) Text('🌡 ${temp.toString()}°C', style: const TextStyle(fontSize: 14)),
          if (windStr != null) Text('💨 $windStr', style: const TextStyle(fontSize: 14)),
          if (desc != null) Text('$desc', style: const TextStyle(fontSize: 14, color: _kMuted)),
        ],
      ),
    );
  }
}

class _PegelBlock extends StatelessWidget {
  final List<dynamic> pegel;
  const _PegelBlock({required this.pegel});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: pegel.take(5).map<Widget>((p) {
        if (p is! Map) return const SizedBox.shrink();
        final name = p['name'] ?? '?';
        final cm = p['cm'] ?? p['value'];
        final water = p['water'] ?? '';
        return Container(
          margin: const EdgeInsets.only(bottom: 6),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: _kBg, borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _kBorder),
          ),
          child: Row(
            children: [
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('$name', style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
                if (water.toString().isNotEmpty)
                  Text('$water', style: const TextStyle(fontSize: 11, color: _kMuted)),
              ])),
              if (cm != null)
                Text('$cm cm', style: const TextStyle(color: _kPrimary, fontWeight: FontWeight.bold)),
            ],
          ),
        );
      }).toList(),
    );
  }
}

class _StartEndChip extends StatelessWidget {
  final LogEntry entry;
  const _StartEndChip({required this.entry});

  @override
  Widget build(BuildContext context) {
    final isStart = entry.type == 'trip_start';
    final color   = isStart ? Colors.green : Colors.red;
    final icon    = isStart ? Icons.play_circle : Icons.stop_circle;
    final label   = isStart ? 'Start' : 'Ende';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: color.withAlpha(20),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: color.withAlpha(70)),
      ),
      child: Row(children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 8),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
          Text(_fmtTime(entry.timestamp), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold)),
        ])),
      ]),
    );
  }
}

class _LogEntryTile extends StatelessWidget {
  final LogEntry entry;
  const _LogEntryTile({required this.entry});

  Icon _icon(String type) => switch (type) {
    'trip_start'  => const Icon(Icons.play_circle, color: Colors.green, size: 20),
    'trip_end'    => const Icon(Icons.stop_circle, color: Colors.red, size: 20),
    'trip_pause'  => const Icon(Icons.pause_circle, color: Colors.orange, size: 20),
    'trip_resume' => const Icon(Icons.play_circle_outlined, color: Colors.blue, size: 20),
    'manual'      => const Icon(Icons.edit_note, color: Colors.cyan, size: 20),
    _             => const Icon(Icons.circle, color: Colors.grey, size: 20),
  };

  String _typeLabel(String type) => switch (type) {
    'trip_start'  => 'Start',
    'trip_end'    => 'Ende',
    'trip_pause'  => 'Pause',
    'trip_resume' => 'Weiterfahrt',
    'manual'      => 'Notiz',
    _ => type,
  };

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _icon(entry.type),
          const SizedBox(width: 10),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(_typeLabel(entry.type),
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                const Spacer(),
                Text(_fmtTime(entry.timestamp),
                    style: const TextStyle(color: _kMuted, fontSize: 12)),
              ]),
              if (entry.notes != null && entry.notes!.isNotEmpty &&
                entry.type != 'trip_start' && entry.type != 'trip_end')
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(entry.notes!, style: const TextStyle(fontSize: 13, color: _kMuted)),
                ),
            ],
          )),
        ],
      ),
    );
  }
}

// ─── Tab 2: Crew ──────────────────────────────────────────────────────────────

class _CrewTab extends StatelessWidget {
  const _CrewTab();

  @override
  Widget build(BuildContext context) {
    final svc = context.watch<LogbookService>();

    if (svc.loadingCrew) {
      return const Center(child: CircularProgressIndicator(color: _kPrimary));
    }

    return Scaffold(
      backgroundColor: _kBg,
      body: svc.crew.isEmpty
          ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
              Icon(Icons.people, size: 64, color: _kMuted.withAlpha(80)),
              const SizedBox(height: 16),
              const Text('Keine Crew-Mitglieder', style: TextStyle(color: _kMuted)),
            ]))
          : ListView.builder(
              padding: const EdgeInsets.fromLTRB(12, 12, 12, 80),
              itemCount: svc.crew.length,
              itemBuilder: (ctx, i) => _CrewCard(member: svc.crew[i]),
            ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: _kPrimary,
        foregroundColor: Colors.black87,
        onPressed: () => _openCrewModal(context, null),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _openCrewModal(BuildContext context, CrewMember? member) {
    showModalBottomSheet(
      context: context,
      backgroundColor: _kCard,
      isScrollControlled: true,
      builder: (_) => _CrewModal(member: member),
    );
  }
}

class _CrewCard extends StatelessWidget {
  final CrewMember member;
  const _CrewCard({required this.member});

  Color _roleColor(String role) => switch (role) {
    'Captain' => const Color(0xFFFFD700),
    'Crew' => _kPrimary,
    _ => _kMuted,
  };

  @override
  Widget build(BuildContext context) {
    final svc = context.read<LogbookService>();
    return GestureDetector(
      onTap: () => _openEdit(context),
      onLongPress: () => _confirmDelete(context, svc),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _kCard, borderRadius: BorderRadius.circular(12),
          border: Border.all(color: _kBorder),
        ),
        child: Row(children: [
          Text(member.avatar, style: const TextStyle(fontSize: 32, fontFamilyFallback: ['NotoColorEmoji'])),
          const SizedBox(width: 14),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(member.name,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 2),
            Text('${member.trips} Fahrten',
                style: const TextStyle(fontSize: 12, color: _kMuted)),
          ])),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _roleColor(member.role).withAlpha(30),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _roleColor(member.role).withAlpha(80)),
            ),
            child: Text(member.role,
                style: TextStyle(color: _roleColor(member.role),
                    fontSize: 12, fontWeight: FontWeight.w600)),
          ),
        ]),
      ),
    );
  }

  void _openEdit(BuildContext context) {
    showModalBottomSheet(
      context: context, backgroundColor: _kCard, isScrollControlled: true,
      builder: (_) => _CrewModal(member: member),
    );
  }

  void _confirmDelete(BuildContext context, LogbookService svc) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: _kCard,
        title: Text('${member.name} löschen?'),
        content: const Text('Crew-Mitglied wird entfernt.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Abbrechen')),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () async {
              Navigator.pop(ctx);
              final ok = await svc.deleteCrewMember(member.id);
              if (!ok && ctx.mounted) _showSnack(ctx, 'Löschen fehlgeschlagen');
            },
            child: const Text('Löschen'),
          ),
        ],
      ),
    );
  }
}

// ─── Crew Modal (Add / Edit) ──────────────────────────────────────────────────

class _CrewModal extends StatefulWidget {
  final CrewMember? member;
  const _CrewModal({this.member});

  @override
  State<_CrewModal> createState() => _CrewModalState();
}

class _CrewModalState extends State<_CrewModal> {
  final _formKey = GlobalKey<FormState>();
  late String _avatar;
  late String _role;
  late TextEditingController _name;
  late TextEditingController _email;
  late TextEditingController _phone;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _avatar = widget.member?.avatar ?? _kAvatars[0];
    _role   = widget.member?.role   ?? 'Crew';
    _name   = TextEditingController(text: widget.member?.name  ?? '');
    _email  = TextEditingController(text: widget.member?.email ?? '');
    _phone  = TextEditingController(text: widget.member?.phone ?? '');
  }

  @override
  void dispose() {
    _name.dispose(); _email.dispose(); _phone.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.member != null;
    return Padding(
      padding: EdgeInsets.only(
        left: 16, right: 16, top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 20,
      ),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(isEdit ? 'Crew bearbeiten' : 'Crew hinzufügen',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),

              const Text('Avatar', style: TextStyle(fontSize: 12, color: _kMuted)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8, runSpacing: 8,
                children: _kAvatars.map((a) => GestureDetector(
                  onTap: () => setState(() => _avatar = a),
                  child: Container(
                    width: 48, height: 48,
                    decoration: BoxDecoration(
                      color: _avatar == a ? _kPrimary.withAlpha(40) : _kBg,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(
                        color: _avatar == a ? _kPrimary : _kBorder,
                        width: _avatar == a ? 2 : 1,
                      ),
                    ),
                    child: Center(child: Text(a, style: const TextStyle(fontSize: 24, fontFamilyFallback: ['NotoColorEmoji']))),
                  ),
                )).toList(),
              ),
              const SizedBox(height: 16),

              TextFormField(
                controller: _name,
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco('Name *'),
                validator: (v) => (v == null || v.trim().isEmpty) ? 'Name erforderlich' : null,
              ),
              const SizedBox(height: 12),

              DropdownButtonFormField<String>(
                value: _role,
                dropdownColor: _kCard,
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco('Rolle'),
                items: ['Captain', 'Crew', 'Guest']
                    .map((r) => DropdownMenuItem(value: r, child: Text(r)))
                    .toList(),
                onChanged: (v) { if (v != null) setState(() => _role = v); },
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _email,
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco('E-Mail (optional)'),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),

              TextFormField(
                controller: _phone,
                style: const TextStyle(color: Colors.white),
                decoration: _fieldDeco('Telefon (optional)'),
                keyboardType: TextInputType.phone,
              ),
              const SizedBox(height: 20),

              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: _kPrimary,
                  foregroundColor: Colors.black87,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(width: 20, height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(isEdit ? 'Speichern' : 'Hinzufügen',
                        style: const TextStyle(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  InputDecoration _fieldDeco(String label) => InputDecoration(
    labelText: label,
    labelStyle: const TextStyle(color: _kMuted),
    filled: true, fillColor: _kBg,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: _kBorder)),
    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: _kBorder)),
    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(8),
        borderSide: const BorderSide(color: _kPrimary)),
  );

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final svc = context.read<LogbookService>();
    final data = {
      'name': _name.text.trim(), 'role': _role, 'avatar': _avatar,
      if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
    };
    final ok = widget.member == null
        ? await svc.createCrewMember(data) != null
        : await svc.updateCrewMember(widget.member!.id, data) != null;
    if (mounted) {
      setState(() => _saving = false);
      if (ok) Navigator.pop(context);
      else _showSnack(context, 'Speichern fehlgeschlagen');
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

void _showSnack(BuildContext context, String msg) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(
    content: Text(msg),
    backgroundColor: const Color(0xFF2D333B),
    behavior: SnackBarBehavior.floating,
  ));
}
