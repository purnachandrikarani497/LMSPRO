import "dart:typed_data";

import "package:dio/dio.dart";
import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "../config/api_config.dart";

const _kTokenKey = "lms_token";

class ApiClient {
  ApiClient() {
    _dio = Dio(
      BaseOptions(
        baseUrl: ApiConfig.baseUrl,
        // LAN dev should connect in seconds; long waits usually mean wrong IP or firewall.
        connectTimeout: const Duration(seconds: 20),
        receiveTimeout: const Duration(seconds: 120),
        sendTimeout: const Duration(seconds: 45),
        headers: {"Accept": "application/json"},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _storage.read(key: _kTokenKey);
          if (token != null && token.isNotEmpty) {
            options.headers["Authorization"] = "Bearer $token";
          }
          handler.next(options);
        },
        onError: (err, handler) async {
          if (err.response?.statusCode == 401) {
            await _storage.delete(key: _kTokenKey);
          }
          handler.next(err);
        },
      ),
    );
  }

  late final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Dio get dio => _dio;

  /// Call after [ApiConfig.saveManualBaseUrl] so requests use the new base URL.
  void refreshBaseUrl() {
    _dio.options.baseUrl = ApiConfig.baseUrl;
  }

  /// Quick check that [GET /api/health] works (USB adb reverse, LAN, or emulator).
  Future<bool> tryPingHealth() async {
    try {
      final res = await _dio.get<dynamic>(
        _apiPath("health"),
        options: Options(
          connectTimeout: const Duration(seconds: 8),
          receiveTimeout: const Duration(seconds: 12),
          sendTimeout: const Duration(seconds: 12),
        ),
      );
      return res.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  /// Dio merges [path] with [baseUrl]. A path starting with `/` replaces the path of [baseUrl],
  /// so `baseUrl=http://h/api/` + `/auth/login` wrongly becomes `http://h/auth/login`. We keep
  /// [baseUrl] ending with `/api/` and pass paths without a leading slash.
  String _apiPath(String path) =>
      path.startsWith("/") ? path.substring(1) : path;

  Future<void> saveToken(String token) async {
    await _storage.write(key: _kTokenKey, value: token);
  }

  Future<void> clearToken() async {
    await _storage.delete(key: _kTokenKey);
  }

  Future<String?> getToken() => _storage.read(key: _kTokenKey);

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final res = await _dio.post<Map<String, dynamic>>(_apiPath(path), data: body);
    final d = res.data;
    if (d == null) throw Exception("Empty response");
    return d;
  }

  Future<Map<String, dynamic>> putJson(String path, Map<String, dynamic> body) async {
    final res = await _dio.put<Map<String, dynamic>>(_apiPath(path), data: body);
    final d = res.data;
    if (d == null) throw Exception("Empty response");
    return d;
  }

  Future<List<dynamic>> getList(String path) async {
    final res = await _dio.get<dynamic>(_apiPath(path));
    final data = res.data;
    if (data is List) return data;
    return [];
  }

  Future<Map<String, dynamic>> getMap(String path) async {
    final res = await _dio.get<Map<String, dynamic>>(_apiPath(path));
    final d = res.data;
    if (d == null) throw Exception("Empty response");
    return d;
  }

  Future<void> deletePath(String path) async {
    await _dio.delete<void>(_apiPath(path));
  }

  /// Binary GET (e.g. full PDF download) — auth via interceptor Bearer token.
  Future<Uint8List> getBytes(String path) async {
    final res = await _dio.get<List<int>>(
      _apiPath(path),
      options: Options(
        responseType: ResponseType.bytes,
        receiveTimeout: const Duration(minutes: 5),
      ),
    );
    final data = res.data;
    if (data == null) return Uint8List(0);
    return Uint8List.fromList(data);
  }
}
