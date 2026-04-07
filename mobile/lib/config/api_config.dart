import "package:device_info_plus/device_info_plus.dart";
import "package:flutter/foundation.dart" show defaultTargetPlatform, TargetPlatform;
import "package:shared_preferences/shared_preferences.dart";

/// Backend API base URL including `/api/` (trailing slash required for Dio path joining).
///
/// **Physical Android phone:** set once in the in-app "API server" screen, or run with:
/// `flutter run --dart-define=API_BASE_URL=http://YOUR_PC_LAN_IP:5000/api/`
///
/// **Android emulator:** defaults to `http://10.0.2.2:5000/api` (host PC localhost).
///
/// **Cleartext HTTP** is enabled for Android debug in `AndroidManifest.xml` for local dev.
class ApiConfig {
  ApiConfig._();

  static const _prefsKey = "api_base_url";
  static const String _fromEnv = String.fromEnvironment("API_BASE_URL", defaultValue: "");

  /// Web OAuth client ID (same as `VITE_GOOGLE_CLIENT_ID` / backend `GOOGLE_CLIENT_ID`).
  /// Pass at build time: `flutter run --dart-define=GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com`
  /// Required on Android for Google Sign-In to return an ID token.
  static const String googleWebClientId = String.fromEnvironment("GOOGLE_CLIENT_ID", defaultValue: "");

  static SharedPreferences? _prefs;
  static bool? _androidPhysical;
  static bool? _iosPhysical;
  static bool _initialized = false;

  static Future<void> initialize() async {
    if (_initialized) return;
    _initialized = true;
    _prefs = await SharedPreferences.getInstance();
    if (defaultTargetPlatform == TargetPlatform.android) {
      final a = await DeviceInfoPlugin().androidInfo;
      _androidPhysical = a.isPhysicalDevice;
    } else if (defaultTargetPlatform == TargetPlatform.iOS) {
      final ios = await DeviceInfoPlugin().iosInfo;
      _iosPhysical = ios.isPhysicalDevice;
    }
  }

  /// True on a physical phone with no URL set (compile-time env or saved prefs).
  static bool get needsLanSetup {
    if (!_initialized) return false;
    if (_fromEnv.isNotEmpty) return false;
    final saved = _prefs?.getString(_prefsKey);
    if (saved != null && saved.isNotEmpty) return false;
    return _androidPhysical == true || _iosPhysical == true;
  }

  static String _normalize(String raw) {
    final t = raw.trim();
    if (t.endsWith("/api/")) return t;
    if (t.endsWith("/api")) return "$t/";
    if (t.endsWith("/")) return "${t}api/";
    return "$t/api/";
  }

  /// Fixes `http://host:5000:5000/api` when users entered `host:5000` and we appended `:5000` again.
  static String _dedupePortInUrl(String url) {
    var t = url.trim();
    while (true) {
      final m = RegExp(r":(\d+):\1").firstMatch(t);
      if (m == null) break;
      t = t.replaceRange(m.start, m.end, ":${m.group(1)}");
    }
    return t;
  }

  /// Common typo: missing dot → `192.1687.6` instead of `192.168.7.6`.
  static String _fixCommonIpv4TyposInUrl(String url) {
    return url.replaceAll("192.1687.6", "192.168.7.6");
  }

  static bool _looksLikeIpv4Host(String host) =>
      host.isNotEmpty && RegExp(r"^[\d.]+$").hasMatch(host) && host.contains(".");

  /// Each part 0–255 and exactly four segments (e.g. not `192.1687.6`).
  static bool _isValidIpv4(String host) {
    final parts = host.split(".");
    if (parts.length != 4) return false;
    for (final p in parts) {
      final n = int.tryParse(p);
      if (n == null || n < 0 || n > 255) return false;
    }
    return true;
  }

  /// Throws [ArgumentError] if the host is numeric IPv4-shaped but invalid.
  static void _validateHttpUrlHost(String url) {
    Uri u;
    try {
      u = Uri.parse(url);
    } catch (_) {
      throw ArgumentError("Invalid URL: $url");
    }
    if (u.host.isEmpty) {
      throw ArgumentError("Missing host in URL");
    }
    if (u.host == "localhost" || u.host == "10.0.2.2") return;
    if (!_looksLikeIpv4Host(u.host)) return;
    if (_isValidIpv4(u.host)) return;
    final parts = u.host.split(".");
    if (parts.length == 3) {
      final mid = int.tryParse(parts[1]);
      if (mid != null && mid > 255) {
        throw ArgumentError(
          "Invalid IPv4: ${u.host}. Use four numbers with dots, e.g. 192.168.7.6 "
          "(not 192.1687.6 — there must be a dot between 168 and 7).",
        );
      }
    }
    throw ArgumentError(
      "Invalid IPv4: ${u.host}. Each part must be 0–255, like 192.168.1.10.",
    );
  }

  /// Bare input without scheme: `192.168.1.5` or `192.168.1.5:5000` (do not add port twice).
  static String _originFromBareHost(String bare) {
    final host = bare.replaceAll(RegExp(r"\s"), "");
    final lastColon = host.lastIndexOf(":");
    if (lastColon > 0 && lastColon < host.length - 1) {
      final tail = host.substring(lastColon + 1);
      if (RegExp(r"^\d+$").hasMatch(tail)) {
        final before = host.substring(0, lastColon);
        if (before.contains(":") && !before.startsWith("[")) {
          // IPv6 or ambiguous — fall through to default port
        } else {
          return "http://$before:$tail";
        }
      }
    }
    return "http://$host:5000";
  }

  /// Saves URL from user input: `192.168.1.5` or `192.168.1.5:5000` or full `http://host:5000/api`.
  static Future<void> saveManualBaseUrl(String input) async {
    final t = input.trim();
    if (t.isEmpty) {
      throw ArgumentError("Enter your computer's IP address");
    }
    String normalized;
    if (t.startsWith("http://") || t.startsWith("https://")) {
      normalized = _normalize(_dedupePortInUrl(_fixCommonIpv4TyposInUrl(t)));
    } else {
      normalized = _normalize(_dedupePortInUrl(_fixCommonIpv4TyposInUrl(_originFromBareHost(t))));
    }
    _validateHttpUrlHost(normalized);
    await _prefs?.setString(_prefsKey, normalized);
  }

  static String get baseUrl {
    if (_fromEnv.isNotEmpty) {
      return _normalize(_dedupePortInUrl(_fixCommonIpv4TyposInUrl(_fromEnv)));
    }
    final saved = _prefs?.getString(_prefsKey);
    if (saved != null && saved.isNotEmpty) {
      var fixed = _dedupePortInUrl(_fixCommonIpv4TyposInUrl(saved));
      if (fixed != saved) {
        _prefs?.setString(_prefsKey, _normalize(fixed));
      }
      fixed = _normalize(fixed);
      return fixed;
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      // 10.0.2.2 is only valid on the Android emulator (host loopback). On a real phone it
      // often yields "no route to host". Physical devices should set the API in setup or dart-define.
      if (_androidPhysical != true) {
        return "http://10.0.2.2:5000/api/";
      }
      // Common Windows USB tethering host IP (ipconfig: "Ethernet" / Remote NDIS). Wi‑Fi users
      // still get the first-launch setup screen; this is only a fallback before prefs exist.
      return "http://192.168.137.1:5000/api/";
    }
    return "http://127.0.0.1:5000/api/";
  }

  /// `host:port` or full origin for pre-filling the setup field (no `/api` suffix).
  static String get manualEntryHint {
    final raw = baseUrl.trim();
    if (raw.isEmpty) return "";
    try {
      final u = Uri.parse(raw);
      if (u.hasPort && u.port != 0) {
        return "${u.host}:${u.port}";
      }
      return u.host;
    } catch (_) {
      return "";
    }
  }
}
