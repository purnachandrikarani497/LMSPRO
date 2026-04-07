import "api_client.dart";

/// Matches `GET/POST /api/enrollments` (see `backend/src/routes/enrollments.js`).
class EnrollmentService {
  EnrollmentService(this._api);

  final ApiClient _api;

  Future<List<Map<String, dynamic>>> fetchMine() async {
    final raw = await _api.getList("/enrollments");
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Returns either a completed enrollment (free course) or Razorpay order payload (paid).
  Future<Map<String, dynamic>> enroll(String courseId) async {
    return _api.postJson("/enrollments", {"courseId": courseId.trim()});
  }
}
