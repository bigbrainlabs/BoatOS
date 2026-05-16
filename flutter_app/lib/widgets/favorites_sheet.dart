import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/favorites_service.dart';
import 'onscreen_keyboard.dart';

// ─── Public entry points ────────────────────────────────────────────────────

Future<void> showFavoritesSheet(
  BuildContext context, {
  required void Function(double lat, double lon) onFlyTo,
  required void Function(double lat, double lon) onAddWaypoint,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _FavoritesSheet(onFlyTo: onFlyTo, onAddWaypoint: onAddWaypoint),
  );
}

Future<void> showAddFavoriteSheet(
  BuildContext context, {
  required double lat,
  required double lon,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _AddFavoriteSheet(lat: lat, lon: lon),
  );
}

Future<void> showFavoriteDetailSheet(
  BuildContext context,
  Favorite fav, {
  required void Function(double lat, double lon) onFlyTo,
  required void Function(double lat, double lon) onAddWaypoint,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => _FavoriteDetailSheet(
      fav: fav,
      onFlyTo: onFlyTo,
      onAddWaypoint: onAddWaypoint,
    ),
  );
}

// ─── Favorites list ─────────────────────────────────────────────────────────

class _FavoritesSheet extends StatelessWidget {
  final void Function(double, double) onFlyTo;
  final void Function(double, double) onAddWaypoint;

  const _FavoritesSheet({required this.onFlyTo, required this.onAddWaypoint});

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.9,
      builder: (ctx, scroll) => Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0D1117),
          borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        ),
        child: Consumer<FavoritesService>(
          builder: (ctx, svc, _) {
            final favs = svc.favorites;
            return Column(children: [
              // Handle
              Center(
                child: Container(
                  width: 40, height: 4,
                  margin: const EdgeInsets.only(top: 12, bottom: 4),
                  decoration: BoxDecoration(
                    color: const Color(0xFF30363D),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // Header
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 12, 8),
                child: Row(children: [
                  const Icon(Icons.star, color: Color(0xFFF0C040), size: 20),
                  const SizedBox(width: 10),
                  Text(
                    'Favoriten (${favs.length})',
                    style: const TextStyle(
                        fontSize: 16, fontWeight: FontWeight.w600,
                        color: Color(0xFFE6EDF3)),
                  ),
                  const Spacer(),
                  IconButton(
                    icon: const Icon(Icons.refresh,
                        color: Color(0xFF8B949E), size: 20),
                    onPressed: svc.fetch,
                  ),
                ]),
              ),
              const Divider(color: Color(0xFF30363D), height: 1),
              // List
              Expanded(
                child: svc.loading
                    ? const Center(child: CircularProgressIndicator())
                    : favs.isEmpty
                        ? const Center(
                            child: Text('Keine Favoriten gespeichert',
                                style: TextStyle(
                                    fontSize: 14, color: Color(0xFF8B949E))),
                          )
                        : ListView.separated(
                            controller: scroll,
                            padding: const EdgeInsets.symmetric(vertical: 8),
                            itemCount: favs.length,
                            separatorBuilder: (_, __) =>
                                const Divider(color: Color(0xFF21262D), height: 1),
                            itemBuilder: (ctx, i) =>
                                _FavoriteListItem(
                                  fav: favs[i],
                                  onTap: () {
                                    Navigator.pop(ctx);
                                    onFlyTo(favs[i].lat, favs[i].lon);
                                  },
                                  onDetail: () {
                                    Navigator.pop(ctx);
                                    showFavoriteDetailSheet(
                                      context,
                                      favs[i],
                                      onFlyTo: onFlyTo,
                                      onAddWaypoint: onAddWaypoint,
                                    );
                                  },
                                ),
                          ),
              ),
            ]);
          },
        ),
      ),
    );
  }
}

class _FavoriteListItem extends StatelessWidget {
  final Favorite fav;
  final VoidCallback onTap;
  final VoidCallback onDetail;

  const _FavoriteListItem({
    required this.fav,
    required this.onTap,
    required this.onDetail,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        child: Row(children: [
          Text(fav.icon, style: const TextStyle(fontSize: 22)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(fav.name,
                  style: const TextStyle(
                      fontSize: 14, fontWeight: FontWeight.w600,
                      color: Color(0xFFE6EDF3))),
              const SizedBox(height: 2),
              Text(
                '${fav.categoryName}  ·  ${fav.lat.toStringAsFixed(4)}, ${fav.lon.toStringAsFixed(4)}',
                style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
              ),
              if (fav.notes != null && fav.notes!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(fav.notes!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                          fontSize: 11, color: Color(0xFF6A737D),
                          fontStyle: FontStyle.italic)),
                ),
            ]),
          ),
          IconButton(
            icon: const Icon(Icons.info_outline,
                color: Color(0xFF4FC3F7), size: 20),
            onPressed: onDetail,
          ),
        ]),
      ),
    );
  }
}

// ─── Add favorite ────────────────────────────────────────────────────────────

class _AddFavoriteSheet extends StatefulWidget {
  final double lat;
  final double lon;

  const _AddFavoriteSheet({required this.lat, required this.lon});

  @override
  State<_AddFavoriteSheet> createState() => _AddFavoriteSheetState();
}

class _AddFavoriteSheetState extends State<_AddFavoriteSheet> {
  final _nameCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();
  String _category = 'other';
  bool _saving = false;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final name = _nameCtrl.text.trim();
    if (name.isEmpty) return;
    setState(() => _saving = true);
    final svc = context.read<FavoritesService>();
    final ok = await svc.add(
      name: name,
      lat: widget.lat,
      lon: widget.lon,
      category: _category,
      notes: _notesCtrl.text.trim(),
    );
    if (mounted) {
      Navigator.pop(context);
      if (!ok) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Fehler beim Speichern')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: MediaQuery.of(context).viewInsets,
      child: Container(
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
          // Title
          Row(children: [
            const Icon(Icons.star, color: Color(0xFFF0C040), size: 20),
            const SizedBox(width: 10),
            const Text('Favorit hinzufügen',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600,
                    color: Color(0xFFE6EDF3))),
            const Spacer(),
            Text(
              '${widget.lat.toStringAsFixed(4)}, ${widget.lon.toStringAsFixed(4)}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E)),
            ),
          ]),
          const SizedBox(height: 16),
          const Divider(color: Color(0xFF30363D), height: 1),
          const SizedBox(height: 16),

          // Name field
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => showKeyboard(context, _nameCtrl, label: 'Name'),
            child: _inputField(_nameCtrl, 'Name *'),
          ),
          const SizedBox(height: 12),

          // Category grid
          const Align(
            alignment: Alignment.centerLeft,
            child: Text('Kategorie',
                style: TextStyle(fontSize: 12, color: Color(0xFF8B949E))),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: Favorite.categories.map((cat) {
              final selected = cat == _category;
              return GestureDetector(
                onTap: () => setState(() => _category = cat),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: selected
                        ? const Color(0xFF1565C0)
                        : const Color(0xFF161B22),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: selected
                          ? const Color(0xFF4FC3F7)
                          : const Color(0xFF30363D),
                    ),
                  ),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Text(Favorite.categoryIcons[cat]!,
                        style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: 6),
                    Text(Favorite.categoryNames[cat]!,
                        style: TextStyle(
                            fontSize: 12,
                            color: selected
                                ? const Color(0xFFE6EDF3)
                                : const Color(0xFF8B949E))),
                  ]),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 12),

          // Notes field
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => showKeyboard(context, _notesCtrl, label: 'Notizen'),
            child: _inputField(_notesCtrl, 'Notizen (optional)'),
          ),
          const SizedBox(height: 20),

          // Save button
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _save,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1565C0),
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Speichern',
                      style: TextStyle(
                          fontSize: 15, fontWeight: FontWeight.w600)),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _inputField(TextEditingController ctrl, String hint) {
    return ValueListenableBuilder<TextEditingValue>(
      valueListenable: ctrl,
      builder: (_, val, __) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF161B22),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFF30363D)),
        ),
        child: Row(children: [
          Expanded(
            child: Text(
              val.text.isEmpty ? hint : val.text,
              style: TextStyle(
                fontSize: 14,
                color: val.text.isEmpty
                    ? const Color(0xFF6A737D)
                    : const Color(0xFFE6EDF3),
              ),
            ),
          ),
          const Icon(Icons.keyboard, size: 16, color: Color(0xFF8B949E)),
        ]),
      ),
    );
  }
}

// ─── Favorite detail ─────────────────────────────────────────────────────────

class _FavoriteDetailSheet extends StatelessWidget {
  final Favorite fav;
  final void Function(double, double) onFlyTo;
  final void Function(double, double) onAddWaypoint;

  const _FavoriteDetailSheet({
    required this.fav,
    required this.onFlyTo,
    required this.onAddWaypoint,
  });

  @override
  Widget build(BuildContext context) {
    final svc = context.read<FavoritesService>();
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
          Text(fav.icon, style: const TextStyle(fontSize: 28)),
          const SizedBox(width: 14),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(fav.name,
                  style: const TextStyle(
                      fontSize: 18, fontWeight: FontWeight.w700,
                      color: Color(0xFFE6EDF3))),
              Text(fav.categoryName,
                  style: const TextStyle(
                      fontSize: 12, color: Color(0xFF8B949E))),
            ]),
          ),
        ]),
        const SizedBox(height: 16),
        const Divider(color: Color(0xFF30363D), height: 1),
        const SizedBox(height: 16),

        // Coordinates
        _infoRow(Icons.location_on, 'Position',
            '${fav.lat.toStringAsFixed(5)}, ${fav.lon.toStringAsFixed(5)}'),
        if (fav.notes != null && fav.notes!.isNotEmpty) ...[
          const SizedBox(height: 12),
          _infoRow(Icons.notes, 'Notizen', fav.notes!),
        ],
        const SizedBox(height: 24),

        // Actions
        Row(children: [
          Expanded(
            child: _actionBtn(
              context,
              icon: Icons.my_location,
              label: 'Zur Position',
              color: const Color(0xFF1565C0),
              onTap: () {
                Navigator.pop(context);
                onFlyTo(fav.lat, fav.lon);
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _actionBtn(
              context,
              icon: Icons.flag,
              label: 'Als Wegpunkt',
              color: const Color(0xFF1A472A),
              onTap: () {
                Navigator.pop(context);
                onAddWaypoint(fav.lat, fav.lon);
              },
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: _actionBtn(
              context,
              icon: Icons.delete_outline,
              label: 'Löschen',
              color: const Color(0xFF6B1A1A),
              onTap: () async {
                Navigator.pop(context);
                await svc.delete(fav.id);
              },
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _infoRow(IconData icon, String label, String value) {
    return Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, size: 16, color: const Color(0xFF4FC3F7)),
      const SizedBox(width: 10),
      Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label,
            style: const TextStyle(fontSize: 11, color: Color(0xFF8B949E))),
        const SizedBox(height: 2),
        Text(value,
            style: const TextStyle(fontSize: 14, color: Color(0xFFE6EDF3))),
      ]),
    ]);
  }

  Widget _actionBtn(
    BuildContext context, {
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: const Color(0xFFE6EDF3), size: 20),
          const SizedBox(height: 4),
          Text(label,
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w600,
                  color: Color(0xFFE6EDF3))),
        ]),
      ),
    );
  }
}
