import "package:dio/dio.dart";

import "../config/api_config.dart";
import "../models/auth_user.dart";
import "api_client.dart";

class AuthService {
  AuthService(this._api);

  final ApiClient _api;

  Future<AuthUser> login(String email, String password) async {
    try {
      final data = await _api.postJson("/auth/login", {
        "email": email.trim(),
        "password": password,
      });
      final token = data["token"]?.toString();
      if (token == null || token.isEmpty) {
        throw Exception("No token in response");
      }
      await _api.saveToken(token);
      return AuthUser.fromJson(Map<String, dynamic>.from(data));
    } on DioException catch (e) {
      throw _apiException(e);
    }
  }

  Future<AuthUser> register({
    required String name,
    required String email,
    required String phone,
    required String password,
  }) async {
    try {
      final data = await _api.postJson("/auth/register", {
        "name": name.trim(),
        "email": email.trim(),
        "phone": phone.replaceAll(RegExp(r"\D"), ""),
        "password": password,
        "role": "student",
      });
      final token = data["token"]?.toString();
      if (token == null || token.isEmpty) {
        throw Exception("No token in response");
      }
      await _api.saveToken(token);
      return AuthUser.fromJson(Map<String, dynamic>.from(data));
    } on DioException catch (e) {
      throw _apiException(e);
    }
  }

  Exception _apiException(DioException e) {
    final data = e.response?.data;
    if (data is Map && data["message"] != null) {
      return Exception(data["message"].toString());
    }
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return Exception(
          "Timed out reaching ${ApiConfig.baseUrl}. "
          "Set API server to your PC IPv4 from ipconfig, allow TCP 5000 in Windows Firewall, run npm start in backend.",
        );
      case DioExceptionType.connectionError:
        return Exception(
          "Cannot connect to ${ApiConfig.baseUrl}. "
          "Same Wi‑Fi as the phone, correct IP, firewall, and backend on port 5000.",
        );
      default:
        return Exception(e.message ?? "Request failed");
    }
  }

  /// Restore session using stored JWT and `GET /auth/me`.
  Future<AuthUser?> tryRestore() async {
    final t = await _api.getToken();
    if (t == null || t.isEmpty) return null;
    try {
      final data = await _api.getMap("/auth/me");
      final raw = data["user"];
      if (raw is Map) {
        return AuthUser.fromJson(Map<String, dynamic>.from(raw));
      }
    } catch (_) {
      await _api.clearToken();
    }
    return null;
  }

  Future<void> logout() => _api.clearToken();

  Future<String?> getToken() => _api.getToken();

  /// Same as web `POST /auth/google` with `{ credential: <Google ID token> }`.
  Future<AuthUser> signInWithGoogleIdToken(String credential) async {
    try {
      final data = await _api.postJson("/auth/google", {"credential": credential});
      final token = data["token"]?.toString();
      if (token == null || token.isEmpty) {
        throw Exception("No token in response");
      }
      await _api.saveToken(token);
      return AuthUser.fromJson(Map<String, dynamic>.from(data));
    } on DioException catch (e) {
      throw _apiException(e);
    }
  }
}
