// Render-Test: prüft, dass die IENC-Style-JSON (ienc_style.dart) mit dem
// vector_tile_renderer fehlerfrei parst UND eine echte IENC-Kachel zu
// sichtbaren (farbigen) Pixeln rendert. Deckt das Hauptrisiko ab, das sich
// auf dem flutter-pi (keine Screen-Grabs möglich) nicht prüfen lässt.
//
// Fixture: eine echte z14-Kachel bei Aken/Elbe (Tiefen + Fahrrinne).

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter_test/flutter_test.dart';
import 'package:vector_tile/vector_tile.dart';
import 'package:vector_tile_renderer/vector_tile_renderer.dart';

import 'package:boatos_ui/screens/ienc_style.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('IENC-Style parst und rendert eine echte Kachel zu sichtbaren Pixeln',
      () async {
    // 1. Theme aus der App-Style-JSON — wirft bei ungültigem Ausdruck
    final theme = ThemeReader().read(buildIencStyleJson());
    expect(theme.layers, isNotEmpty);

    // 2. Echte IENC-Kachel laden und dekodieren
    final bytes = await File('test/fixtures/ienc_z14_8739_5421.mvt')
        .readAsBytes();
    final vectorTile = VectorTile.fromBytes(bytes: Uint8List.fromList(bytes));
    expect(vectorTile.layers, isNotEmpty);

    // 3. Tileset für Source 'ienc' bauen, vorverarbeiten
    final tile = TileFactory(theme, const Logger.noop()).create(vectorTile);
    var tileset = Tileset({iencSourceId: tile});
    tileset = TilesetPreprocessor(theme).preprocess(tileset, zoom: 14);
    final source = TileSource(tileset: tileset);

    // 4. Rendern
    final image = await ImageRenderer(theme: theme, scale: 2)
        .render(source, zoom: 14);
    expect(image.width, greaterThan(0));

    // 5. Nicht-leer? Anteil nicht-transparenter Pixel prüfen
    final data =
        await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    final px = data!.buffer.asUint8List();
    var painted = 0;
    for (var i = 3; i < px.length; i += 4) {
      if (px[i] != 0) painted++;
    }
    final ratio = painted / (px.length / 4);
    // ignore: avoid_print
    print('IENC-Render: ${image.width}x${image.height}, '
        '${(ratio * 100).toStringAsFixed(1)}% Pixel bemalt');
    expect(ratio, greaterThan(0.02),
        reason: 'Kachel wurde praktisch leer gerendert — Style greift nicht');

    // PNG zur Sichtprüfung ablegen
    final png = await image.toPng();
    await File('test/fixtures/ienc_render_out.png').writeAsBytes(png);
  });
}
