import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';

import 'screens/map_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/logbook_screen.dart';
import 'services/api_service.dart';
import 'services/favorites_service.dart';
import 'services/logbook_service.dart';
import 'services/settings_service.dart';
import 'services/websocket_service.dart';

void main() {
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => WebSocketService()..connect()),
        Provider(create: (_) => ApiService()),
        ChangeNotifierProvider(create: (_) => SettingsService()..load()),
        ChangeNotifierProvider(create: (_) => LogbookService()..startPolling()),
        ChangeNotifierProvider(create: (_) => FavoritesService()..fetch()),
      ],
      child: const BoatOSApp(),
    ),
  );
}

class BoatOSApp extends StatelessWidget {
  const BoatOSApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'BoatOS',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF4FC3F7),
          secondary: Color(0xFF00B4D8),
          surface: Color(0xFF0D1117),
          onSurface: Color(0xFFE6EDF3),
        ),
        scaffoldBackgroundColor: const Color(0xFF0A0E1A),
        cardColor: const Color(0xFF161B22),
        dividerColor: const Color(0xFF30363D),
      ),
      home: const ScreensaverWrapper(child: MainShell()),
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _currentIndex = 0;
  LogbookService? _logbookSvc;
  bool _updateAvailable = false;
  Timer? _updateCheckTimer;
  Map<String, dynamic>? _hotspotInfo;
  bool _hotspotDismissed = false;
  Timer? _hotspotTimer;

  final List<Widget> _screens = const [
    MapScreen(),
    DashboardScreen(),
    LogbookScreen(),
  ];

  @override
  void initState() {
    super.initState();
    _checkForUpdate();
    _updateCheckTimer = Timer.periodic(const Duration(hours: 6), (_) => _checkForUpdate());
    _checkHotspot();
    _hotspotTimer = Timer.periodic(const Duration(seconds: 30), (_) => _checkHotspot());
  }

  Future<void> _checkHotspot() async {
    try {
      final res = await http
          .get(Uri.parse('http://localhost:8000/api/wifi/hotspot'))
          .timeout(const Duration(seconds: 5));
      if (res.statusCode == 200 && mounted) {
        final d = json.decode(res.body) as Map<String, dynamic>;
        final active = d['active'] == true;
        setState(() {
          _hotspotInfo = active ? d : null;
          if (!active) _hotspotDismissed = false;
        });
      }
    } catch (_) {}
  }

  Future<void> _checkForUpdate() async {
    try {
      final res = await http
          .get(Uri.parse('http://localhost:8000/api/system/version'))
          .timeout(const Duration(seconds: 10));
      if (res.statusCode == 200) {
        final d = json.decode(res.body) as Map<String, dynamic>;
        final upToDate = d['up_to_date'] as bool? ?? true;
        if (mounted) setState(() => _updateAvailable = !upToDate);
      }
    } catch (_) {}
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final svc = context.read<LogbookService>();
    if (_logbookSvc != svc) {
      _logbookSvc?.removeListener(_onLogbook);
      _logbookSvc = svc;
      svc.addListener(_onLogbook);
    }
  }

  void _onLogbook() {
    final svc = _logbookSvc;
    if (svc == null) return;
    if (svc.wantsMapView && mounted) {
      svc.consumeMapViewRequest();
      setState(() => _currentIndex = 0);
    }
  }

  @override
  void dispose() {
    _updateCheckTimer?.cancel();
    _hotspotTimer?.cancel();
    _logbookSvc?.removeListener(_onLogbook);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hotspot = _hotspotInfo;
    return Scaffold(
      body: Stack(
        children: [
          IndexedStack(
            index: _currentIndex,
            children: _screens,
          ),
          if (hotspot != null && !_hotspotDismissed)
            Positioned(
              top: 16,
              left: 16,
              right: 16,
              child: Material(
                color: Colors.transparent,
                child: Container(
                  padding: const EdgeInsets.fromLTRB(16, 12, 12, 14),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1200),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFFF9800).withValues(alpha: 0.7)),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        const Icon(Icons.wifi_tethering, size: 16, color: Color(0xFFFF9800)),
                        const SizedBox(width: 8),
                        const Expanded(
                          child: Text('Hotspot aktiv',
                              style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFFFF9800))),
                        ),
                        TextButton(
                          style: TextButton.styleFrom(
                            foregroundColor: const Color(0xFF8B949E),
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                          ),
                          onPressed: () async {
                            await http.post(Uri.parse('http://localhost:8000/api/wifi/hotspot/stop'))
                                .timeout(const Duration(seconds: 10));
                            if (mounted) setState(() { _hotspotInfo = null; _hotspotDismissed = false; });
                          },
                          child: const Text('Stoppen', style: TextStyle(fontSize: 12)),
                        ),
                        const SizedBox(width: 4),
                        GestureDetector(
                          onTap: () => setState(() => _hotspotDismissed = true),
                          child: const Icon(Icons.close, size: 18, color: Color(0xFF8B949E)),
                        ),
                      ]),
                      const SizedBox(height: 10),
                      _HotspotInfoRow(label: 'SSID', value: hotspot['ssid'] as String? ?? ''),
                      const SizedBox(height: 4),
                      _HotspotInfoRow(label: 'Passwort', value: hotspot['password'] as String? ?? ''),
                      const SizedBox(height: 4),
                      _HotspotInfoRow(label: 'IP', value: hotspot['ip'] as String? ?? '192.168.4.1'),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
      bottomNavigationBar: Stack(
        clipBehavior: Clip.none,
        children: [
          NavigationBar(
            backgroundColor: const Color(0xFF161B22),
            indicatorColor: Color.fromRGBO(79, 195, 247, 0.2),
            selectedIndex: _currentIndex,
            onDestinationSelected: (i) => setState(() => _currentIndex = i),
            destinations: const [
              NavigationDestination(
                icon: Icon(Icons.map_outlined),
                selectedIcon: Icon(Icons.map),
                label: 'Karte',
              ),
              NavigationDestination(
                icon: Icon(Icons.speed_outlined),
                selectedIcon: Icon(Icons.speed),
                label: 'Dashboard',
              ),
              NavigationDestination(
                icon: Icon(Icons.book_outlined),
                selectedIcon: Icon(Icons.book),
                label: 'Logbuch',
              ),
            ],
          ),
          if (_updateAvailable)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF59E0B),
                    borderRadius: const BorderRadius.vertical(bottom: Radius.circular(10)),
                  ),
                  child: const Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.system_update_alt, size: 12, color: Color(0xFF1A1200)),
                      SizedBox(width: 5),
                      Text('Update verfügbar',
                          style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Color(0xFF1A1200))),
                    ],
                  ),
                ),
              ),
            ),
          if (_currentIndex == 1 && Platform.isLinux)
            const Positioned.fill(
              child: Align(
                alignment: Alignment.centerRight,
                child: Padding(
                  padding: EdgeInsets.only(right: 12),
                  child: _ShutdownNavButton(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ── Shutdown nav button (Pi / Linux only) ────────────────────────────────────

class _ShutdownNavButton extends StatefulWidget {
  const _ShutdownNavButton();

  @override
  State<_ShutdownNavButton> createState() => _ShutdownNavButtonState();
}

class _ShutdownNavButtonState extends State<_ShutdownNavButton> {
  bool _busy = false;

  Future<void> _confirmAction() async {
    final action = await showDialog<String>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: const Color(0xFF161B22),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: const Row(children: [
          Icon(Icons.power_settings_new, color: Color(0xFFEF5350), size: 20),
          SizedBox(width: 10),
          Text('System', style: TextStyle(fontSize: 16, color: Color(0xFFE6EDF3))),
        ]),
        content: const Text(
          'Was soll das BoatOS-System jetzt tun?',
          style: TextStyle(fontSize: 13, color: Color(0xFF8B949E), height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, null),
            child: const Text('Abbrechen',
                style: TextStyle(color: Color(0xFF8B949E))),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF1A3A5C),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.restart_alt, size: 16),
            label: const Text('Neu starten'),
            onPressed: () => Navigator.pop(context, 'reboot'),
          ),
          ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF7D1A1A),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8)),
            ),
            icon: const Icon(Icons.power_settings_new, size: 16),
            label: const Text('Herunterfahren'),
            onPressed: () => Navigator.pop(context, 'shutdown'),
          ),
        ],
      ),
    );

    if (action == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final endpoint = action == 'reboot' ? 'reboot' : 'shutdown';
      await http.post(Uri.parse('http://localhost:8000/api/system/$endpoint'));
    } catch (_) {}
    if (mounted) setState(() => _busy = false);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _busy ? null : _confirmAction,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFF1C1010),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF3D1A1A)),
        ),
        child: _busy
            ? const SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Color(0xFFEF5350)))
            : const Icon(Icons.power_settings_new,
                size: 20, color: Color(0xFFEF5350)),
      ),
    );
  }
}

// ── Hotspot info row ─────────────────────────────────────────────────────────

class _HotspotInfoRow extends StatelessWidget {
  final String label;
  final String value;
  const _HotspotInfoRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Row(children: [
      SizedBox(
        width: 72,
        child: Text(label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
      ),
      Expanded(
        child: Text(value,
            style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFFE6EDF3),
                fontFamily: 'monospace')),
      ),
    ]);
  }
}

// ── Screensaver ──────────────────────────────────────────────────────────────

class ScreensaverWrapper extends StatefulWidget {
  final Widget child;
  const ScreensaverWrapper({required this.child, super.key});

  @override
  State<ScreensaverWrapper> createState() => _ScreensaverWrapperState();
}

class _ScreensaverWrapperState extends State<ScreensaverWrapper> {
  Timer? _overlayTimer;
  Timer? _hwOffTimer;
  bool _overlayVisible = false;
  bool _hwOff = false;
  SettingsService? _settings;
  int _cachedTimeout = -1;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final s = context.read<SettingsService>();
    if (_settings != s) {
      _settings?.removeListener(_onSettingsChanged);
      _settings = s;
      s.addListener(_onSettingsChanged);
      _startTimers();
    }
  }

  @override
  void dispose() {
    _settings?.removeListener(_onSettingsChanged);
    _overlayTimer?.cancel();
    _hwOffTimer?.cancel();
    super.dispose();
  }

  void _onSettingsChanged() {
    final newTimeout = _settings?.screensaverTimeout ?? 15;
    if (newTimeout != _cachedTimeout) {
      _cachedTimeout = newTimeout;
      _startTimers();
    }
  }

  void _startTimers() {
    _overlayTimer?.cancel();
    _hwOffTimer?.cancel();
    final min = _settings?.screensaverTimeout ?? 15;
    if (min == 0) return;
    _overlayTimer = Timer(Duration(minutes: min), _activateOverlay);
    _hwOffTimer = Timer(
      Duration(minutes: min) + const Duration(seconds: 60),
      _activateHwOff,
    );
  }

  void _activateOverlay() {
    if (!mounted) return;
    setState(() => _overlayVisible = true);
  }

  void _activateHwOff() {
    if (!mounted) return;
    setState(() => _hwOff = true);
    Process.run('vcgencmd', ['display_power', '0']);
  }

  void _wake(PointerDownEvent event) {
    if (_hwOff) {
      Process.run('vcgencmd', ['display_power', '1']);
      setState(() => _hwOff = false);
    }
    if (_overlayVisible) {
      setState(() => _overlayVisible = false);
    }
    _startTimers();
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: _wake,
      behavior: HitTestBehavior.translucent,
      child: Stack(
        children: [
          widget.child,
          IgnorePointer(
            ignoring: !_overlayVisible,
            child: AnimatedOpacity(
              opacity: _overlayVisible ? 1.0 : 0.0,
              duration: const Duration(milliseconds: 800),
              child: const ColoredBox(
                color: Colors.black,
                child: SizedBox.expand(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
