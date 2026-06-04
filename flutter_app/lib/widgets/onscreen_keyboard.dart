import 'package:flutter/material.dart';
import '../l10n/l10n_ext.dart';

Future<void> showKeyboard(
  BuildContext context,
  TextEditingController controller, {
  bool numeric = false,
  bool obscure = false,
  bool multiline = false,
  String label = '',
}) {
  return showModalBottomSheet<void>(
    context: context,
    isDismissible: true,
    enableDrag: false,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _KbSheet(
      controller: controller,
      numeric: numeric,
      obscure: obscure,
      multiline: multiline,
      label: label,
    ),
  );
}

// ── Sheet ────────────────────────────────────────────────────────────────────

class _KbSheet extends StatefulWidget {
  final TextEditingController controller;
  final bool numeric;
  final bool obscure;
  final bool multiline;
  final String label;

  const _KbSheet({
    required this.controller,
    required this.numeric,
    required this.obscure,
    required this.multiline,
    required this.label,
  });

  @override
  State<_KbSheet> createState() => _KbSheetState();
}

class _KbSheetState extends State<_KbSheet> with SingleTickerProviderStateMixin {
  late TextEditingController _ctrl;
  late AnimationController _cursorBlink;
  bool _caps  = false;
  bool _shift = false;

  bool get _upper => _caps ^ _shift;

  @override
  void initState() {
    super.initState();
    _ctrl = TextEditingController(text: widget.controller.text);
    _ctrl.selection = TextSelection.collapsed(offset: _ctrl.text.length);
    _cursorBlink = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _cursorBlink.dispose();
    _ctrl.dispose();
    super.dispose();
  }

  void _type(String ch) {
    final v     = _ctrl.value;
    final start = v.selection.start < 0 ? v.text.length : v.selection.start;
    final end   = v.selection.end   < 0 ? v.text.length : v.selection.end;
    _ctrl.value = TextEditingValue(
      text: v.text.substring(0, start) + ch + v.text.substring(end),
      selection: TextSelection.collapsed(offset: start + ch.length),
    );
    if (_shift) setState(() => _shift = false);
  }

  void _backspace() {
    final v     = _ctrl.value;
    final start = v.selection.start < 0 ? v.text.length : v.selection.start;
    final end   = v.selection.end   < 0 ? v.text.length : v.selection.end;
    if (start == end && start > 0) {
      _ctrl.value = TextEditingValue(
        text: v.text.substring(0, start - 1) + v.text.substring(end),
        selection: TextSelection.collapsed(offset: start - 1),
      );
    } else if (start != end) {
      _ctrl.value = TextEditingValue(
        text: v.text.substring(0, start) + v.text.substring(end),
        selection: TextSelection.collapsed(offset: start),
      );
    }
  }

  void _done() {
    widget.controller.value = _ctrl.value;
    Navigator.pop(context);
  }

  void _toggleShift() {
    setState(() {
      if (!_shift && !_caps)       _shift = true;
      else if (_shift && !_caps) { _shift = false; _caps = true; }
      else                       { _caps  = false; _shift = false; }
    });
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF161B22),
        border: Border(top: BorderSide(color: Color(0xFF30363D))),
        borderRadius: BorderRadius.vertical(top: Radius.circular(12)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // drag handle
          Container(
            margin: const EdgeInsets.only(top: 8, bottom: 4),
            width: 36, height: 4,
            decoration: BoxDecoration(
              color: const Color(0xFF30363D),
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          _inputBar(context),
          Padding(
            padding: const EdgeInsets.fromLTRB(3, 2, 3, 12),
            child: widget.numeric ? _numpad() : _qwertz(),
          ),
        ],
      ),
    );
  }

  Widget _inputBar(BuildContext context) {
    final l = context.l10n;
    return Padding(
      padding: const EdgeInsets.fromLTRB(10, 4, 10, 6),
      child: Row(children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: const Color(0xFF0A0E1A),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFF4FC3F7), width: 1.5),
            ),
            child: Row(children: [
              if (widget.label.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: Text('${widget.label}:',
                      style: const TextStyle(fontSize: 13, color: Color(0xFF8B949E))),
                ),
              Expanded(
                child: AnimatedBuilder(
                  animation: Listenable.merge([_ctrl, _cursorBlink]),
                  builder: (_, __) {
                    final v = _ctrl.value;
                    final raw = widget.obscure ? '•' * v.text.length : v.text;
                    final showCursor = _cursorBlink.value > 0.5;
                    final cursorPos = v.selection.isValid
                        ? v.selection.baseOffset.clamp(0, raw.length)
                        : raw.length;
                    final before = raw.substring(0, cursorPos);
                    final after  = raw.substring(cursorPos);
                    const cursorStyle = TextStyle(
                      fontSize: 15,
                      color: Color(0xFF4FC3F7),
                      fontWeight: FontWeight.w300,
                    );
                    const textStyle = TextStyle(
                      fontSize: 15,
                      color: Color(0xFFE6EDF3),
                      fontWeight: FontWeight.w500,
                    );
                    if (raw.isEmpty) {
                      return Text.rich(
                        TextSpan(children: [
                          TextSpan(
                            text: showCursor ? '|' : '​',
                            style: cursorStyle,
                          ),
                          TextSpan(
                            text: l.keyboardHint,
                            style: const TextStyle(
                                fontSize: 15, color: Color(0xFF555555)),
                          ),
                        ]),
                        overflow: TextOverflow.ellipsis,
                        maxLines: 1,
                      );
                    }
                    return Text.rich(
                      TextSpan(style: textStyle, children: [
                        TextSpan(text: before),
                        TextSpan(
                          text: showCursor ? '|' : '​',
                          style: cursorStyle,
                        ),
                        TextSpan(text: after),
                      ]),
                      overflow: TextOverflow.ellipsis,
                      maxLines: 1,
                    );
                  },
                ),
              ),
            ]),
          ),
        ),
        const SizedBox(width: 10),
        GestureDetector(
          onTap: _done,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 13),
            decoration: BoxDecoration(
              color: const Color(0xFF1565C0),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(l.btnDone,
                style: const TextStyle(
                    fontSize: 15, color: Colors.white, fontWeight: FontWeight.w600)),
          ),
        ),
      ]),
    );
  }

  // ── Numpad ──────────────────────────────────────────────────────────────────

  Widget _numpad() => Column(children: [
        _kr(['7', '8', '9']),
        _kr(['4', '5', '6']),
        _kr(['1', '2', '3']),
        _kr(['.', '0', '⌫']),
      ]);

  // ── QWERTZ ─────────────────────────────────────────────────────────────────

  static const _r1 = ['q','w','e','r','t','z','u','i','o','p'];
  static const _r2 = ['a','s','d','f','g','h','j','k','l'];
  static const _r3 = ['y','x','c','v','b','n','m'];

  Widget _qwertz() {
    final u = _upper;
    String c(String s) => u ? s.toUpperCase() : s;
    return Column(children: [
      _kr(['1','2','3','4','5','6','7','8','9','0']),
      _kr(_r1.map(c).toList()),
      Row(children: [
        ..._r2.map((s) => _k(c(s))),
        _k('↵', onTap: widget.multiline ? () => _type('\n') : _done, bg: const Color(0xFF1565C0), flex: 2),
      ]),
      Row(children: [
        _k(
          _caps ? '⇪' : '⇧',
          onTap: _toggleShift,
          bg: (_caps || _shift) ? const Color(0xFF1565C0) : const Color(0xFF2D333B),
        ),
        ..._r3.map((s) => _k(c(s))),
        _k('⌫', onTap: _backspace, bg: const Color(0xFF2D333B)),
      ]),
      Row(children: [
        ...['@', '/', ':', '-'].map((s) => _k(s)),
        _k(' ', onTap: () => _type(' '), flex: 4),
        ...['_', '.', '!', '?'].map((s) => _k(s)),
      ]),
    ]);
  }

  // ── Row helper ──────────────────────────────────────────────────────────────

  Widget _kr(List<String> chars) => Row(
        children: chars
            .map((c) => _k(c, onTap: c == '⌫' ? _backspace : () => _type(c)))
            .toList(),
      );

  Widget _k(String label, {VoidCallback? onTap, Color? bg, int flex = 1}) =>
      Expanded(
        flex: flex,
        child: Padding(
          padding: const EdgeInsets.all(2.5),
          child: Material(
            color: bg ?? const Color(0xFF2D333B),
            borderRadius: BorderRadius.circular(6),
            child: InkWell(
              borderRadius: BorderRadius.circular(6),
              onTap: onTap ?? () => _type(label),
              child: SizedBox(
                height: 52,
                child: Center(
                  child: Text(
                    label,
                    style: TextStyle(
                      fontSize: label.length == 1 ? 17 : 13,
                      color: Colors.white,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      );
}
