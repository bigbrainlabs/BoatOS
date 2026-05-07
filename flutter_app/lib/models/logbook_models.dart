class TripSummary {
  final int id;
  final DateTime tripStart;
  final DateTime? tripEnd;
  final double distanceNm;
  final String duration;
  final int points;
  final List<int> crewIds;

  TripSummary({
    required this.id,
    required this.tripStart,
    this.tripEnd,
    required this.distanceNm,
    required this.duration,
    required this.points,
    required this.crewIds,
  });

  factory TripSummary.fromJson(Map<String, dynamic> json) {
    return TripSummary(
      id: (json['id'] as num).toInt(),
      tripStart: DateTime.parse(json['trip_start'] as String),
      tripEnd: json['trip_end'] != null ? DateTime.parse(json['trip_end'] as String) : null,
      distanceNm: _parseDistNm(json),
      duration: (json['duration'] as String?) ?? '0:00',
      points: (json['points'] as num?)?.toInt() ?? 0,
      crewIds: (json['crew_ids'] as List<dynamic>?)?.map((e) => (e as num).toInt()).toList() ?? [],
    );
  }
}

// Backend stores distance in NM (R=3440.065 haversine). Both 'distance' and 'distance_nm' are NM.
double _parseDistNm(Map<String, dynamic> json) {
  final nm = (json['distance_nm'] as num?)?.toDouble();
  if (nm != null) return nm;
  return (json['distance'] as num?)?.toDouble() ?? 0.0;
}

class TripDetail {
  final int id;
  final DateTime tripStart;
  final DateTime? tripEnd;
  final double distanceNm;
  final String duration;
  final int points;
  final List<int> crewIds;
  final List<LogEntry> entries;
  final List<TrackPoint> trackData;

  TripDetail({
    required this.id,
    required this.tripStart,
    this.tripEnd,
    required this.distanceNm,
    required this.duration,
    required this.points,
    required this.crewIds,
    required this.entries,
    required this.trackData,
  });

  factory TripDetail.fromJson(Map<String, dynamic> json) {
    return TripDetail(
      id: (json['id'] as num).toInt(),
      tripStart: DateTime.parse(json['trip_start'] as String),
      tripEnd: json['trip_end'] != null ? DateTime.parse(json['trip_end'] as String) : null,
      distanceNm: _parseDistNm(json),
      duration: (json['duration'] as String?) ?? '0:00',
      points: (json['points'] as num?)?.toInt() ?? 0,
      crewIds: (json['crew_ids'] as List<dynamic>?)?.map((e) => (e as num).toInt()).toList() ?? [],
      entries: (json['entries'] as List<dynamic>?)
              ?.map((e) => LogEntry.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      trackData: (json['track_data'] as List<dynamic>?)
              ?.map((e) => TrackPoint.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

class LogEntry {
  final int id;
  final String type;
  final DateTime timestamp;
  final Map<String, double>? position;
  final Map<String, dynamic>? weather;
  final List<dynamic>? pegelNearby;
  final String? notes;
  final List<int>? crewIds;

  LogEntry({
    required this.id,
    required this.type,
    required this.timestamp,
    this.position,
    this.weather,
    this.pegelNearby,
    this.notes,
    this.crewIds,
  });

  factory LogEntry.fromJson(Map<String, dynamic> json) {
    Map<String, double>? pos;
    final rawPos = json['position'];
    if (rawPos is Map) {
      final lat = (rawPos['lat'] as num?)?.toDouble();
      final lon = (rawPos['lon'] as num?)?.toDouble();
      if (lat != null && lon != null) pos = {'lat': lat, 'lon': lon};
    }

    return LogEntry(
      id: (json['id'] as num?)?.toInt() ?? 0,
      type: (json['type'] as String?) ?? 'manual',
      timestamp: DateTime.parse(json['timestamp'] as String),
      position: pos,
      weather: json['weather'] as Map<String, dynamic>?,
      pegelNearby: json['pegel_nearby'] as List<dynamic>?,
      notes: json['notes'] as String?,
      crewIds: (json['crew_ids'] as List<dynamic>?)?.map((e) => (e as num).toInt()).toList(),
    );
  }
}

class TrackPoint {
  final double lat;
  final double lon;
  final DateTime timestamp;
  final double? speed;
  final double? heading;
  final Map<String, dynamic>? sensors;
  final List<dynamic>? pegel;

  TrackPoint({
    required this.lat,
    required this.lon,
    required this.timestamp,
    this.speed,
    this.heading,
    this.sensors,
    this.pegel,
  });

  factory TrackPoint.fromJson(Map<String, dynamic> json) {
    return TrackPoint(
      lat: (json['lat'] as num).toDouble(),
      lon: (json['lon'] as num).toDouble(),
      timestamp: DateTime.parse(json['timestamp'] as String),
      speed: (json['speed'] as num?)?.toDouble(),
      heading: (json['heading'] as num?)?.toDouble(),
      sensors: json['sensors'] as Map<String, dynamic>?,
      pegel: json['pegel'] as List<dynamic>?,
    );
  }
}

class CrewMember {
  final int id;
  final String name;
  final String role;
  final String avatar;
  final String? email;
  final String? phone;
  final int trips;

  CrewMember({
    required this.id,
    required this.name,
    required this.role,
    required this.avatar,
    this.email,
    this.phone,
    required this.trips,
  });

  factory CrewMember.fromJson(Map<String, dynamic> json) {
    return CrewMember(
      id: (json['id'] as num).toInt(),
      name: (json['name'] as String?) ?? '',
      role: (json['role'] as String?) ?? 'Crew',
      avatar: (json['avatar'] as String?) ?? '👤',
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      trips: (json['trips'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'role': role,
        'avatar': avatar,
        if (email != null && email!.isNotEmpty) 'email': email,
        if (phone != null && phone!.isNotEmpty) 'phone': phone,
      };
}

class TrackStatus {
  final bool recording;
  final bool paused;
  final int points;
  final double distanceNm;

  const TrackStatus({
    required this.recording,
    required this.paused,
    required this.points,
    required this.distanceNm,
  });

  factory TrackStatus.fromJson(Map<String, dynamic> json) {
    return TrackStatus(
      recording: (json['recording'] as bool?) ?? false,
      paused: (json['paused'] as bool?) ?? false,
      points: (json['points'] as num?)?.toInt() ?? 0,
      distanceNm: _parseDistNm(json),
    );
  }
}
