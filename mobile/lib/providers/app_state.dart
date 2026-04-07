import "package:flutter/foundation.dart";

import "../models/auth_user.dart";
import "../services/api_client.dart";
import "../services/auth_service.dart";
import "../services/course_service.dart";
import "../services/admin_service.dart";
import "../services/enrollment_service.dart";
import "../services/progress_service.dart";

class AppState extends ChangeNotifier {
  AppState() {
    _api = ApiClient();
    auth = AuthService(_api);
    courses = CourseService(_api);
    enrollments = EnrollmentService(_api);
    admin = AdminService(_api);
    progress = ProgressService(_api);
  }

  late final ApiClient _api;
  late final AuthService auth;
  late final CourseService courses;
  late final EnrollmentService enrollments;
  late final AdminService admin;
  late final ProgressService progress;

  AuthUser? user;

  /// Populated from `GET /api/enrollments` (current user's enrollments).
  List<Map<String, dynamic>> enrollmentList = [];

  void setUser(AuthUser? u) {
    user = u;
    if (u == null) {
      enrollmentList = [];
    }
    notifyListeners();
  }

  /// Reload enrollments after login or enrollment change (students).
  Future<void> refreshEnrollments() async {
    if (user == null) {
      enrollmentList = [];
      notifyListeners();
      return;
    }
    try {
      enrollmentList = await enrollments.fetchMine();
    } catch (_) {
      enrollmentList = [];
    }
    notifyListeners();
  }

  /// Whether the user has an enrollment row for this course id.
  bool isEnrolledInCourse(String courseId) {
    for (final e in enrollmentList) {
      final id = _courseIdFromEnrollment(e);
      if (id != null && id == courseId) return true;
    }
    return false;
  }

  static String? _courseIdFromEnrollment(Map<String, dynamic> e) {
    final c = e["course"];
    if (c is Map) {
      return c["_id"]?.toString() ?? c["id"]?.toString();
    }
    return c?.toString();
  }

  /// After saving API URL in [SetupApiScreen], point Dio at [ApiConfig.baseUrl].
  void refreshApiBaseUrl() {
    _api.refreshBaseUrl();
  }

  /// Returns true if `GET /api/health` succeeds (backend up + reachable).
  Future<bool> tryPingBackend() => _api.tryPingHealth();

  /// `POST /enrollments`. Free courses return enrollment; paid return `orderId` (Razorpay).
  Future<Map<String, dynamic>> enrollInCourse(String courseId) async {
    final data = await enrollments.enroll(courseId);
    if (!data.containsKey("orderId")) {
      await refreshEnrollments();
    }
    return data;
  }
}
