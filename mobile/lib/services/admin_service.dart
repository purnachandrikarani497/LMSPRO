import "api_client.dart";

/// Admin-only routes (`requireRole(["admin"])`).
class AdminService {
  AdminService(this._api);

  final ApiClient _api;

  Future<List<Map<String, dynamic>>> fetchUsers() async {
    final raw = await _api.getList("users");
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  /// Same data as web `api.getAllEnrollments()` — unique student count for stats.
  Future<List<Map<String, dynamic>>> fetchAllEnrollments() async {
    final raw = await _api.getList("enrollments/all");
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<void> deleteCourse(String id) async {
    await _api.deletePath("courses/$id");
  }
}
