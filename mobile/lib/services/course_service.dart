import "api_client.dart";

/// Public course list/detail — matches `GET /courses` and `GET /courses/:id`.
class CourseService {
  CourseService(this._api);

  final ApiClient _api;

  Future<List<Map<String, dynamic>>> fetchCourses() async {
    final raw = await _api.getList("/courses");
    return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }

  Future<Map<String, dynamic>> fetchCourse(String id) async {
    return _api.getMap("/courses/$id");
  }

  Future<List<Map<String, dynamic>>> fetchCategories() async {
    try {
      final raw = await _api.getList("/categories");
      return raw.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    } catch (_) {
      return [];
    }
  }

  Future<Map<String, dynamic>> submitReview(
    String courseId, {
    required int rating,
    required String comment,
  }) async {
    return _api.postJson("courses/$courseId/reviews", {
      "rating": rating,
      "comment": comment,
    });
  }
}
