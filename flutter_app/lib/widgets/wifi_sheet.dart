import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'onscreen_keyboard.dart';

const _base = 'http://localhost:8000';

Future<void> showWifiSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => const _WifiSheet(),
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

class _WifiSheet extends StatefulWidget {
  const _WifiSheet();
  @override
  State<_WifiSheet> createState() => _WifiSheetState();
}

class _WifiSheetState extends State<_WifiSheet> {
  Map<String, dynamic>? _status;
  List<Map<String, dynamic>> _networks = [];
  bool _loadingStatus = true;
  bool _scanning = false;
  String? _connecting;
  bool _disconnecting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _scan();
  }

  Future<void> _loadStatus() async {
    if (mounted) setState(() => _loadingStatus = true);
    try {
      final r = await http
          .get(Uri.parse('$_base/api/wifi/status'))
          .timeout(const Duration(seconds: 5));
      if (mounted && r.statusCode == 200) {
        setState(() {
          _status = json.decode(r.body) as Map<String, dynamic>;
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _loadingStatus = false);
  }

  Future<void> _scan() async {
    if (mounted) setState(() => _scanning = true);
    try {
      final r = await http
          .get(Uri.parse('$_base/api/wifi/scan'))
          .timeout(const Duration(seconds: 20));
      if (mounted && r.statusCode == 200) {
        final data = json.decode(r.body) as Map<String, dynamic>;
        setState(() {
          _networks = List<Map<String, dynamic>>.from(
              data['networks'] as List? ?? []);
        });
      }
    } catch (_) {}
    if (mounted) setState(() => _scanning = false);
  }

  Future<void> _connect(String ssid, String security) async {
    String password = '';
    if (security == 'wpa') {
      final pw = await _showPasswordDialog(ssid);
      if (pw == null || !mounted) return;
      password = pw;
    }
    setState(() { _connecting = ssid; _error = null; });
    try {
      final r = await http
          .post(
            Uri.parse('$_base/api/wifi/connect'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({'ssid': ssid, 'password': password}),
          )
          .timeout(const Duration(seconds: 25));
      if (!mounted) return;
      final data = json.decode(r.body) as Map<String, dynamic>;
      if (data['status'] == 'ok') {
        await _loadStatus();
        await _scan();
      } else {
        setState(() => _error = data['message'] as String?);
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
    if (mounted) setState(() => _connecting = null);
  }

  Future<void> _disconnect() async {
    setState(() { _disconnecting = true; _error = null; });
    try {
      await http
          .post(Uri.parse('$_base/api/wifi/disconnect'))
          .timeout(const Duration(seconds: 10));
      await _loadStatus();
      await _scan();
    } catch (_) {}
    if (mounted) setState(() => _disconnecting = false);
  }

  Future<String?> _showPasswordDialog(String ssid) {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (_) => _PasswordDialog(ssid: ssid, ctrl: ctrl),
    );
  }

  IconData _signalIcon(int s) {
    if (s >= 80) return Icons.signal_wifi_4_bar;
    if (s >= 60) return Icons.network_wifi_3_bar;
    if (s >= 40) return Icons.network_wifi_2_bar;
    if (s >= 20) return Icons.network_wifi_1_bar;
    return Icons.signal_wifi_0_bar;
  }

  Color _signalColor(int s) {
    if (s >= 60) return const Color(0xFF4CAF50);
    if (s >= 30) return const Color(0xFFFF9800);
    return const Color(0xFFEF5350);
  }

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.65,
      minChildSize: 0.4,
      maxChildSize: 0.95,
      builder: (_, scrollCtrl) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0D1117),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Column(children: [
          // Drag handle
          Container(
            margin: const EdgeInsets.only(top: 8),
            width: 40, height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF30363D),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 8, 8),
            child: Row(children: [
              const Icon(Icons.wifi, color: Color(0xFF4FC3F7), size: 20),
              const SizedBox(width: 10),
              const Text('WLAN',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                      color: Color(0xFFE6EDF3))),
              const Spacer(),
              IconButton(
                icon: const Icon(Icons.close, color: Color(0xFF8B949E)),
                onPressed: () => Navigator.pop(context),
              ),
            ]),
          ),
          const Divider(color: Color(0xFF30363D), height: 1),
          // Body
          Expanded(
            child: ListView(
              controller: scrollCtrl,
              padding: const EdgeInsets.all(16),
              children: [
                _buildStatusCard(),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3D1A1A),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(_error!,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFFEF5350))),
                  ),
                ],
                const SizedBox(height: 20),
                Row(children: [
                  const Text('Verfügbare Netzwerke',
                      style: TextStyle(
                          fontSize: 11, fontWeight: FontWeight.w700,
                          color: Color(0xFF4FC3F7), letterSpacing: 0.8)),
                  const Spacer(),
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _scanning ? null : _scan,
                    child: Padding(
                      padding: const EdgeInsets.all(8),
                      child: _scanning
                          ? const SizedBox(
                              width: 16, height: 16,
                              child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Color(0xFF4FC3F7)))
                          : const Icon(Icons.refresh,
                              size: 18, color: Color(0xFF4FC3F7)),
                    ),
                  ),
                ]),
                const Divider(color: Color(0xFF30363D), height: 8),
                if (_scanning && _networks.isEmpty)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 32),
                    child: Center(
                      child: Column(children: [
                        CircularProgressIndicator(color: Color(0xFF4FC3F7)),
                        SizedBox(height: 12),
                        Text('Suche Netzwerke…',
                            style: TextStyle(
                                fontSize: 13, color: Color(0xFF8B949E))),
                      ]),
                    ),
                  )
                else
                  ..._networks.map(_buildNetworkTile),
              ],
            ),
          ),
        ]),
      ),
    );
  }

  Widget _buildStatusCard() {
    if (_loadingStatus) {
      return const Center(
          child: Padding(
        padding: EdgeInsets.all(16),
        child: CircularProgressIndicator(color: Color(0xFF4FC3F7)),
      ));
    }
    final connected = _status?['connected'] == true;
    // SSID from status API; fallback to in_use network from scan list
    String ssid = (_status?['ssid'] as String?) ?? '';
    if (ssid.isEmpty && connected) {
      ssid = (_networks.firstWhere(
        (n) => n['in_use'] == true,
        orElse: () => {},
      )['ssid'] as String?) ?? '';
    }
    final ip       = (_status?['ip']     as String?) ?? '';
    final signal   = (_status?['signal'] as int?);

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF161B22),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: connected
              ? const Color(0xFF1565C0).withValues(alpha: 0.5)
              : const Color(0xFF30363D),
        ),
      ),
      child: Row(children: [
        Icon(
          connected ? Icons.wifi : Icons.wifi_off,
          color: connected
              ? const Color(0xFF4FC3F7)
              : const Color(0xFF8B949E),
          size: 28,
        ),
        const SizedBox(width: 12),
        Expanded(
          child: connected
              ? Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(ssid.isNotEmpty ? ssid : 'Verbunden',
                      style: const TextStyle(
                          fontSize: 14, fontWeight: FontWeight.w600,
                          color: Color(0xFFE6EDF3))),
                  if (ip.isNotEmpty)
                    Text(ip,
                        style: const TextStyle(
                            fontSize: 12, color: Color(0xFF8B949E))),
                  if (signal != null)
                    Text('Signal: $signal%',
                        style: TextStyle(
                            fontSize: 12, color: _signalColor(signal))),
                ])
              : const Text('Nicht verbunden',
                  style: TextStyle(fontSize: 14, color: Color(0xFF8B949E))),
        ),
        if (connected)
          OutlinedButton(
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFEF5350),
              side: const BorderSide(color: Color(0xFF5C1A1A)),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(6)),
            ),
            onPressed: _disconnecting ? null : _disconnect,
            child: _disconnecting
                ? const SizedBox(
                    width: 14, height: 14,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Color(0xFFEF5350)))
                : const Text('Trennen', style: TextStyle(fontSize: 12)),
          ),
      ]),
    );
  }

  Widget _buildNetworkTile(Map<String, dynamic> n) {
    final ssid     = n['ssid']     as String;
    final signal   = (n['signal']  as num?)?.toInt() ?? 0;
    final security = (n['security'] as String?) ?? 'open';
    final inUse    = n['in_use']   == true;
    final isConnecting = _connecting == ssid;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: isConnecting ? null : () => _connect(ssid, security),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 11),
        margin: const EdgeInsets.only(bottom: 4),
        decoration: BoxDecoration(
          color: inUse
              ? const Color(0xFF1565C0).withValues(alpha: 0.12)
              : const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: inUse
                ? const Color(0xFF1565C0).withValues(alpha: 0.4)
                : const Color(0xFF30363D),
          ),
        ),
        child: Row(children: [
          Icon(_signalIcon(signal), size: 20, color: _signalColor(signal)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(ssid,
                style: TextStyle(
                    fontSize: 14,
                    fontWeight:
                        inUse ? FontWeight.w600 : FontWeight.normal,
                    color: const Color(0xFFE6EDF3))),
          ),
          if (security == 'wpa')
            const Padding(
              padding: EdgeInsets.only(right: 8),
              child: Icon(Icons.lock_outline,
                  size: 14, color: Color(0xFF8B949E)),
            ),
          if (inUse)
            const Icon(Icons.check_circle,
                size: 18, color: Color(0xFF4CAF50))
          else if (isConnecting)
            const SizedBox(
                width: 18, height: 18,
                child: CircularProgressIndicator(
                    strokeWidth: 2, color: Color(0xFF4FC3F7)))
          else
            const Icon(Icons.chevron_right,
                size: 18, color: Color(0xFF8B949E)),
        ]),
      ),
    );
  }
}

// ── Password dialog ───────────────────────────────────────────────────────────

class _PasswordDialog extends StatelessWidget {
  final String ssid;
  final TextEditingController ctrl;
  const _PasswordDialog({required this.ssid, required this.ctrl});

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF161B22),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      title: Text('Verbinden mit "$ssid"',
          style: const TextStyle(fontSize: 15, color: Color(0xFFE6EDF3))),
      content: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () => showKeyboard(context, ctrl,
            obscure: true, label: 'WLAN-Passwort'),
        child: ValueListenableBuilder<TextEditingValue>(
          valueListenable: ctrl,
          builder: (_, v, __) => Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: BoxDecoration(
              color: const Color(0xFF0D1117),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF30363D)),
            ),
            child: Row(children: [
              Expanded(
                child: Text(
                  v.text.isEmpty ? 'Passwort eingeben…' : '•' * v.text.length,
                  style: TextStyle(
                      fontSize: 14,
                      color: v.text.isEmpty
                          ? const Color(0xFF8B949E)
                          : const Color(0xFFE6EDF3)),
                ),
              ),
              const Icon(Icons.keyboard,
                  size: 16, color: Color(0xFF8B949E)),
            ]),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Abbrechen',
              style: TextStyle(color: Color(0xFF8B949E))),
        ),
        ElevatedButton(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1565C0),
            shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8)),
          ),
          onPressed: () => Navigator.pop(context, ctrl.text),
          child: const Text('Verbinden'),
        ),
      ],
    );
  }
}
