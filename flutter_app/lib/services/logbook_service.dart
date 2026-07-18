import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

import '../models/logbook_models.dart';

class LogbookService extends ChangeNotifier {
  static const String _base = 'http://localhost:8000';

  TrackStatus _status = const TrackStatus(recording: false, paused: false, points: 0, distanceNm: 0);
  List<TripSummary> _trips = [];
  List<CrewMember> _crew = [];
  bool _loadingTrips = false;
  bool _loadingCrew = false;
  String? _error;
  DateTime? _tripStartTime;

  // Trip track display on map
  List<LatLng>? _tripDisplayTrack;
  String? _tripDisplayLabel;
  bool _wantsMapView = false;

  Timer? _statusTimer;

  TrackStatus get status => _status;
  List<TripSummary> get trips => _trips;
  List<CrewMember> get crew => _crew;
  bool get loadingTrips => _loadingTrips;
  bool get loadingCrew => _loadingCrew;
  String? get error => _error;
  DateTime? get tripStartTime => _tripStartTime;
  List<LatLng>? get tripDisplayTrack => _tripDisplayTrack;
  String? get tripDisplayLabel => _tripDisplayLabel;
  bool get wantsMapView => _wantsMapView;

  void displayTripOnMap(List<LatLng> points, String label) {
    _tripDisplayTrack = points;
    _tripDisplayLabel = label;
    _wantsMapView = true;
    notifyListeners();
  }

  void consumeMapViewRequest() {
    _wantsMapView = false;
    notifyListeners();
  }

  void clearTripTrack() {
    _tripDisplayTrack = null;
    _tripDisplayLabel = null;
    notifyListeners();
  }

  void startPolling() {
    refreshStatus();
    loadCrew();
    _scheduleNext();
  }

  void _scheduleNext() {
    _statusTimer?.cancel();
    final interval = _status.recording ? 5 : 30;
    _statusTimer = Timer(Duration(seconds: interval), () async {
      await refreshStatus();
      _scheduleNext();
    });
  }

  void stopPolling() {
    _statusTimer?.cancel();
    _statusTimer = null;
  }

  @override
  void dispose() {
    stopPolling();
    super.dispose();
  }

  Future<void> refreshStatus() async {
    try {
      final r = await http.get(Uri.parse('$_base/api/track/status'));
      if (r.statusCode == 200) {
        final wasRecording = _status.recording;
        _status = TrackStatus.fromJson(json.decode(r.body) as Map<String, dynamic>);
        if (_status.recording && !wasRecording) {
          // Transition into recording — fetch actual start time from session entries
          _fetchTripStartTime();
        } else if (_status.recording && _tripStartTime == null) {
          // App started while already recording
          _fetchTripStartTime();
        }
        if (!_status.recording) {
          _tripStartTime = null;
        }
        notifyListeners();
      }
    } catch (_) {}
  }

  Future<void> _fetchTripStartTime() async {
    try {
      final r = await http.get(Uri.parse('$_base/api/logbook'));
      if (r.statusCode == 200) {
        final data = json.decode(r.body);
        final entries = data is List ? data : (data['entries'] as List<dynamic>? ?? []);
        for (final e in entries.reversed) {
          final m = e as Map<String, dynamic>;
          if (m['type'] == 'trip_start') {
            final ts = m['timestamp'] as String?;
            if (ts != null) {
              _tripStartTime = DateTime.tryParse(ts);
              notifyListeners();
            }
            break;
          }
        }
      }
    } catch (_) {}
  }

  Future<void> loadTrips() async {
    _loadingTrips = true;
    _error = null;
    notifyListeners();

    // Retry bei Verbindungsfehlern — beim Boot kann das Backend noch nicht
    // bereit sein (Boot-Race). Auf eine echte Server-Antwort NICHT weiter hämmern.
    const maxAttempts = 8;
    const retryDelay = Duration(seconds: 2);
    for (int attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        final r = await http
            .get(Uri.parse('$_base/api/logbook/trips'))
            .timeout(const Duration(seconds: 5));
        if (r.statusCode == 200) {
          final data = json.decode(r.body);
          final list = data is List ? data : (data['trips'] as List<dynamic>? ?? []);
          _trips = list.map((e) => TripSummary.fromJson(e as Map<String, dynamic>)).toList();
          _error = null;
        }
        break; // Server hat geantwortet — fertig
      } catch (e) {
        _error = e.toString();
        if (attempt < maxAttempts - 1) {
          await Future.delayed(retryDelay);
        }
      }
    }

    _loadingTrips = false;
    notifyListeners();
  }

  Future<TripDetail?> loadTripDetail(int id) async {
    try {
      final r = await http.get(Uri.parse('$_base/api/logbook/trip/$id'));
      if (r.statusCode == 200) {
        return TripDetail.fromJson(json.decode(r.body) as Map<String, dynamic>);
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return null;
  }

  Future<void> loadCrew() async {
    _loadingCrew = true;
    _error = null;
    notifyListeners();
    try {
      final r = await http.get(Uri.parse('$_base/api/crew'));
      if (r.statusCode == 200) {
        final data = json.decode(r.body);
        final list = data is List ? data : (data['crew'] as List<dynamic>? ?? []);
        _crew = list.map((e) => CrewMember.fromJson(e as Map<String, dynamic>)).toList();
      }
    } catch (e) {
      _error = e.toString();
    }
    _loadingCrew = false;
    notifyListeners();
  }

  Future<bool> startTrip(List<int> crewIds) async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/track/start'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'crew_ids': crewIds}),
      );
      if (r.statusCode == 200) {
        _tripStartTime = DateTime.now();
        await refreshStatus();
        return true;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return false;
  }

  Future<bool> stopTrip() async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/track/stop'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({}),
      );
      if (r.statusCode == 200) {
        _tripStartTime = null;
        await refreshStatus();
        await loadTrips();
        return true;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return false;
  }

  Future<bool> pauseTrip() async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/track/pause'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({}),
      );
      if (r.statusCode == 200) {
        await refreshStatus();
        return true;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return false;
  }

  Future<bool> resumeTrip() async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/track/resume'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({}),
      );
      if (r.statusCode == 200) {
        await refreshStatus();
        return true;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return false;
  }

  Future<CrewMember?> createCrewMember(Map<String, dynamic> data) async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/crew'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(data),
      );
      if (r.statusCode == 200 || r.statusCode == 201) {
        final member = CrewMember.fromJson(json.decode(r.body) as Map<String, dynamic>);
        await loadCrew();
        return member;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return null;
  }

  Future<CrewMember?> updateCrewMember(int id, Map<String, dynamic> data) async {
    try {
      final r = await http.put(
        Uri.parse('$_base/api/crew/$id'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode(data),
      );
      if (r.statusCode == 200) {
        final member = CrewMember.fromJson(json.decode(r.body) as Map<String, dynamic>);
        await loadCrew();
        return member;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return null;
  }

  Future<bool> deleteCrewMember(int id) async {
    try {
      final r = await http.delete(Uri.parse('$_base/api/crew/$id'));
      if (r.statusCode == 200 || r.statusCode == 204) {
        await loadCrew();
        return true;
      }
    } catch (e) {
      _error = e.toString();
      notifyListeners();
    }
    return false;
  }

  Future<bool> addManualEntry(String notes) async {
    try {
      final r = await http.post(
        Uri.parse('$_base/api/logbook'),
        headers: {'Content-Type': 'application/json'},
        body: json.encode({'type': 'manual', 'notes': notes}),
      );
      return r.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  // Returns local file path on success, null on failure
  Future<String?> downloadGpx(int tripId) async {
    try {
      final r = await http.get(Uri.parse('$_base/api/track/export/$tripId'))
          .timeout(const Duration(seconds: 15));
      if (r.statusCode == 200) {
        final path = '/tmp/trip_$tripId.gpx';
        await File(path).writeAsBytes(r.bodyBytes);
        return path;
      }
    } catch (_) {}
    return null;
  }
}
