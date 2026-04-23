import "dart:convert";
import "dart:typed_data";

import "package:dio/dio.dart";

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

  /// Authenticated PDF bytes (`GET /api/upload/stream/pdf/...`).
  /// Sends the same JWT avenues as lesson video: Bearer, `?token=`, and `X-LMS-Stream-Token`.
  Future<Uint8List> fetchLessonPdfBytes(
    String courseId,
    String lessonId,
    String token,
  ) async {
    try {
      return await _api.getBytes(
        "upload/stream/pdf/$courseId/$lessonId",
        accept: "application/pdf,*/*",
        streamToken: token,
        queryParameters: {"token": token},
        legacyDeployedStreamWorkaround: true,
      );
    } on DioException catch (e) {
      final code = e.response?.statusCode;
      final data = e.response?.data;
      String? fromBody;
      if (data is String && data.trim().isNotEmpty) {
        try {
          final j = jsonDecode(data);
          if (j is Map && j["message"] != null) {
            fromBody = j["message"]?.toString();
          }
        } catch (_) {
          final t = data.trim();
          fromBody = t.length <= 200 ? t : t.substring(0, 200);
        }
      } else if (data is List<int> && data.isNotEmpty) {
        try {
          final s = utf8.decode(data);
          final j = jsonDecode(s);
          if (j is Map && j["message"] != null) {
            fromBody = j["message"]?.toString();
          }
        } catch (_) {}
      }
      if (fromBody != null) {
        throw Exception("$fromBody${code != null ? " ($code)" : ""}");
      }
      throw Exception(e.message ?? "Could not download PDF (${code ?? "?"})");
    }
  }
}
