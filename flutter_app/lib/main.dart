import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/map_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/logbook_screen.dart';
import 'services/api_service.dart';
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
      home: const MainShell(),
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

  final List<Widget> _screens = const [
    MapScreen(),
    DashboardScreen(),
    LogbookScreen(),
  ];

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
    _logbookSvc?.removeListener(_onLogbook);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
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
    );
  }
}
