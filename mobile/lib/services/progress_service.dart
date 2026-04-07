import "dart:typed_data";

import "api_client.dart";

/// Matches web `api.getProgress`, `getWatchTimestamps`, `saveWatchTimestamp`, notes APIs.
class ProgressService {
  ProgressService(this._api);

  final ApiClient _api;

  Future<Map<String, dynamic>?> fetchProgress(String courseId) async {
    try {
      return await _api.getMap("progress/$courseId");
    } catch (_) {
      return null;
    }
  }

  Future<({Map<String, dynamic> timestamps, Map<String, dynamic> durations, Map<String, dynamic> notes})>
      fetchWatchBundle(String courseId) async {
    try {
      final m = await _api.getMap("progress/$courseId/timestamps");
      return (
        timestamps: Map<String, dynamic>.from(m["timestamps"] as Map? ?? const {}),
        durations: Map<String, dynamic>.from(m["durations"] as Map? ?? const {}),
        notes: Map<String, dynamic>.from(m["notes"] as Map? ?? const {}),
      );
    } catch (_) {
      return (timestamps: <String, dynamic>{}, durations: <String, dynamic>{}, notes: <String, dynamic>{});
    }
  }

  Future<void> saveWatchTimestamp(
    String courseId,
    String lessonId,
    double timestampSeconds,
    double? durationSeconds,
  ) async {
    await _api.postJson("progress/$courseId/lessons/$lessonId/timestamp", {
      "timestamp": timestampSeconds,
      if (durationSeconds != null && durationSeconds > 0) "duration": durationSeconds,
    });
  }

  Future<void> saveNote(
    String courseId,
    String lessonId,
    String note,
    double videoTimestamp,
  ) async {
    await _api.postJson("progress/$courseId/lessons/$lessonId/note", {
      "note": note,
      "videoTimestamp": videoTimestamp,
    });
  }

  Future<void> updateNote(
    String courseId,
    String lessonId,
    int noteIndex,
    String note,
  ) async {
    await _api.putJson("progress/$courseId/lessons/$lessonId/notes/$noteIndex", {
      "note": note,
    });
  }

  Future<void> deleteNote(String courseId, String lessonId, int noteIndex) async {
    await _api.deletePath("progress/$courseId/lessons/$lessonId/notes/$noteIndex");
  }

  /// Authenticated PDF bytes (`GET /api/upload/stream/pdf/...` — Bearer via [ApiClient]).
  Future<Uint8List> fetchLessonPdfBytes(String courseId, String lessonId) async {
    return _api.getBytes("upload/stream/pdf/$courseId/$lessonId");
  }
}
