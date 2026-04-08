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

  /// Full course document for admins (sections, lessons, etc.) — `GET /courses/:id/admin`.
  Future<Map<String, dynamic>> fetchCourseForAdmin(String id) async {
    return _api.getMap("courses/$id/admin");
  }

  Future<Map<String, dynamic>> createCourse(Map<String, dynamic> body) async {
    return _api.postJson("courses", body);
  }

  Future<Map<String, dynamic>> updateCourse(String id, Map<String, dynamic> body) async {
    return _api.putJson("courses/$id", body);
  }

  Future<Map<String, dynamic>> uploadThumbnail(String localPath) async {
    return _api.postMultipartFile("upload/thumbnail", localPath);
  }

  Future<Map<String, dynamic>> uploadPdf(String localPath) async {
    return _api.postMultipartFile("upload/pdf", localPath);
  }

  Future<Map<String, dynamic>> uploadVideo(String localPath) async {
    return _api.postMultipartFile("upload/video", localPath);
  }

  Future<Map<String, dynamic>> createSection(String courseId, String title) async {
    return _api.postJson("courses/$courseId/sections", {"title": title});
  }

  Future<Map<String, dynamic>> updateSection(String courseId, String sectionId, String title) async {
    return _api.putJson("courses/$courseId/sections/$sectionId", {"title": title});
  }

  Future<void> deleteSection(String courseId, String sectionId) async {
    await _api.deletePath("courses/$courseId/sections/$sectionId");
  }

  Future<Map<String, dynamic>> addLessonToSection(
    String courseId,
    String sectionId,
    Map<String, dynamic> body,
  ) async {
    return _api.postJson("courses/$courseId/sections/$sectionId/lessons", body);
  }

  Future<Map<String, dynamic>> addFlatLesson(String courseId, Map<String, dynamic> body) async {
    return _api.postJson("courses/$courseId/lessons", body);
  }

  Future<Map<String, dynamic>> updateLesson(String courseId, String lessonId, Map<String, dynamic> body) async {
    return _api.putJson("courses/$courseId/lessons/$lessonId", body);
  }

  Future<void> deleteLesson(String courseId, String lessonId) async {
    await _api.deletePath("courses/$courseId/lessons/$lessonId");
  }

  /// `GET /api/settings` — admin email mask, integration flags (same as web Admin Settings).
  Future<Map<String, dynamic>> fetchSettings() async {
    return _api.getMap("settings");
  }

  /// `POST /api/settings/categories/seed` — load default categories if missing.
  Future<Map<String, dynamic>> seedCategoriesDefaults() async {
    return _api.postJson("settings/categories/seed", <String, dynamic>{});
  }

  Future<Map<String, dynamic>> createCategory(String name, {String? icon}) async {
    final body = <String, dynamic>{"name": name};
    final i = icon?.trim();
    if (i != null && i.isNotEmpty) body["icon"] = i;
    return _api.postJson("categories", body);
  }

  Future<Map<String, dynamic>> updateCategory(String id, String name, {required String icon}) async {
    return _api.putJson("categories/$id", {"name": name, "icon": icon.trim()});
  }

  Future<void> deleteCategory(String id) async {
    await _api.deletePath("categories/$id");
  }
}
