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

  /// After Razorpay SDK success — `POST /enrollments/verify`.
  Future<Map<String, dynamic>> verifyEnrollment({
    required String courseId,
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    return _api.postJson("/enrollments/verify", {
      "courseId": courseId.trim(),
      "razorpay_order_id": razorpayOrderId,
      "razorpay_payment_id": razorpayPaymentId,
      "razorpay_signature": razorpaySignature,
    });
  }
}
