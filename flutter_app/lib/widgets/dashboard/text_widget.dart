// lib/widgets/dashboard/text_widget.dart
//
// Dashboard Text widget.

import 'package:flutter/material.dart';
import 'dash_widget.dart';
import 'registry.dart';

class TextDashWidget {
  static void registerSelf() {
    DashWidgetRegistry.register(
      type: 'TEXT',
      label: 'Text',
      builder: build,
      editor: buildEditor,
      dsl: toDsl,
    );
  }

  static Widget build(DashWidget w, Map<String, dynamic> sensors,
      {bool impactMuted = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Text(
        w.text ?? '',
        style: const TextStyle(
            fontSize: 16, fontWeight: FontWeight.w600, color: Color(0xFF4FC3F7)),
      ),
    );
  }

  static Widget buildEditor(DashWidget w, StateSetter setState,
      List<Map<String, dynamic>> allSensors) {
    return _TextEditorFields(w: w, setState: setState);
  }

  static String toDsl(DashWidget w) {
    final buf = StringBuffer('TEXT "${w.text ?? ''}"');
    if (w.size != 1) buf.write(' SIZE ${w.size}');
    if (w.style != null) buf.write(' STYLE ${w.style}');
    return buf.toString();
  }
}

class _TextEditorFields extends StatefulWidget {
  final DashWidget w;
  final StateSetter setState;
  const _TextEditorFields({required this.w, required this.setState});
  @override
  State<_TextEditorFields> createState() => _TextEditorFieldsState();
}

class _TextEditorFieldsState extends State<_TextEditorFields> {
  late final TextEditingController _textCtrl;

  @override
  void initState() {
    super.initState();
    _textCtrl = TextEditingController(text: widget.w.text ?? '');
  }

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _lbl('Text'), const SizedBox(height: 4),
      TextField(
        controller: _textCtrl,
        style: const TextStyle(fontSize: 13, color: Color(0xFFE6EDF3)),
        onChanged: (v) =>
            widget.setState(() => widget.w.text = v.isEmpty ? null : v),
        decoration: InputDecoration(
          isDense: true,
          contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 10),
          filled: true, fillColor: const Color(0xFF0D1117),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFF30363D))),
          enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFF30363D))),
          focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6),
              borderSide: const BorderSide(color: Color(0xFF4FC3F7))),
        ),
      ),
    ]);
  }

  Widget _lbl(String t) => Text(t,
      style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700,
          color: Color(0xFF4FC3F7), letterSpacing: 0.6));
}
