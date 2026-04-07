import "../config/api_config.dart";

/// Mirrors `frontend/src/lib/api.ts` helpers for protected media URLs.
class MediaUrls {
  MediaUrls._();

  static String _origin() => ApiConfig.baseUrl.replaceAll(RegExp(r"/api/?$"), "");

  static String lessonStreamUrl(String courseId, String lessonId, String token) {
    final o = _origin();
    return Uri.parse("$o/api/upload/stream/lesson/$courseId/$lessonId")
        .replace(queryParameters: {"token": token})
        .toString();
  }

  static String lessonPdfUrl(String courseId, String lessonId, String token) {
    final o = _origin();
    return Uri.parse("$o/api/upload/stream/pdf/$courseId/$lessonId")
        .replace(queryParameters: {"token": token})
        .toString();
  }

  /// Proxied `videos/...` or `/upload/video?key=` URLs with auth token.
  static String? secureVideoProxy(String? videoUrl, String token) {
    if (videoUrl == null || videoUrl.isEmpty) return null;
    final o = _origin();
    final v = videoUrl.trim();
    if (v.startsWith("videos/")) {
      return Uri.parse("$o/api/upload/video").replace(queryParameters: {"key": v, "token": token}).toString();
    }
    try {
      final uri = Uri.parse(v);
      if (uri.path.contains("/upload/video")) {
        final key = uri.queryParameters["key"];
        if (key != null && key.startsWith("videos/")) {
          return Uri.parse("$o/api/upload/video").replace(queryParameters: {"key": key, "token": token}).toString();
        }
      }
    } catch (_) {}
    return v;
  }
}

String? extractYoutubeId(String url) {
  final u = Uri.tryParse(url);
  if (u == null) return null;
  if (u.host.contains("youtu.be")) {
    return u.pathSegments.isNotEmpty ? u.pathSegments.first : null;
  }
  if (u.host.contains("youtube.com")) {
    final i = u.pathSegments.indexOf("embed");
    if (i >= 0 && i + 1 < u.pathSegments.length) return u.pathSegments[i + 1];
    return u.queryParameters["v"];
  }
  return null;
}

String? extractVimeoId(String url) {
  final m = RegExp(r"vimeo\.com/(?:video/)?(\d+)", caseSensitive: false).firstMatch(url);
  return m?.group(1);
}

bool isOurHostedVideo(String? rawUrl) {
  if (rawUrl == null || rawUrl.isEmpty) return false;
  return rawUrl.startsWith("videos/") ||
      rawUrl.contains("/upload/video") ||
      rawUrl.contains("/upload/stream");
}

bool isEmbedHost(String rawUrl) {
  return RegExp(r"youtube\.com|youtu\.be|vimeo\.com|player\.vimeo", caseSensitive: false).hasMatch(rawUrl) ||
      rawUrl.contains("/embed/");
}
