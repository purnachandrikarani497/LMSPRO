import "package:chewie/chewie.dart";
import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:video_player/video_player.dart";

import "../config/api_config.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../widgets/learnhub_chewie_chrome.dart";

String _streamReferrerOrigin() {
  final o = ApiConfig.streamReferrerOrigin.trim();
  if (o.isNotEmpty) {
    final u = Uri.tryParse(o);
    if (u != null && u.hasScheme && u.host.isNotEmpty) return u.origin;
  }
  return Uri.parse(ApiConfig.baseUrl).origin;
}

/// Headers for authenticated lesson/video fetches (works with older APIs that require Referer).
Map<String, String> _lessonStreamHeaders(String qpToken) {
  final origin = _streamReferrerOrigin();
  return <String, String>{
    "Authorization": "Bearer $qpToken",
    "X-LMS-Stream-Token": qpToken,
    "Referer": "$origin/",
    "Origin": origin,
  };
}

/// Owns [VideoPlayerController] + [ChewieController] so playback survives route changes.
/// Udemy-style: [enterMiniMode] shows video only in the global overlay; course learn shows an empty slot.
class CourseMiniPlayerService extends ChangeNotifier {
  VideoPlayerController? _video;
  ChewieController? _chewie;
  String? _uri;
  VoidCallback? _listener;
  void Function(double position, double duration)? _progressCallback;

  bool _miniMode = false;
  String? activeCourseId;
  String? activeLessonId;

  bool get isMiniMode => _miniMode;
  bool get hasVideo => _chewie != null && _video != null;
  String? get activeUri => _uri;

  ChewieController? get chewie => _chewie;

  void enterMiniMode() {
    if (!hasVideo) return;
    _miniMode = true;
    notifyListeners();
  }

  void exitMiniMode() {
    _miniMode = false;
    notifyListeners();
  }

  /// Called when [CourseLearnScreen] is disposed. If not in mini mode, release the player.
  void onLearnScreenDisposed({required String courseId}) {
    if (!_miniMode && activeCourseId == courseId) {
      disposePlayer();
    }
  }

  /// Stop mini player and release resources (e.g. close chip).
  void closeMiniPlayer() {
    disposePlayer();
  }

  void setProgressCallback(
      void Function(double position, double duration)? cb) {
    _progressCallback = cb;
  }

  Future<void> seekToSeconds(double seconds) async {
    final v = _video;
    if (v == null || !v.value.isInitialized) return;
    await v.seekTo(Duration(milliseconds: (seconds * 1000).round()));
    await v.play();
  }

  Future<void> ensureVideo({
    required String courseId,
    required String lessonId,
    required String uri,
    required double initialSeconds,
    required void Function(double position, double duration) onVideoProgress,
    required VoidCallback? onOpenNotes,
  }) async {
    if (_uri == uri && _chewie != null) {
      activeCourseId = courseId;
      activeLessonId = lessonId;
      _progressCallback = onVideoProgress;
      notifyListeners();
      return;
    }

    await _disposeVideoOnly();

    try {
      activeCourseId = courseId;
      activeLessonId = lessonId;
      _progressCallback = onVideoProgress;
      // ExoPlayer often sends follow-up Range requests; some stacks omit ?token=… on those
      // requests. The API accepts Bearer on all lesson/video stream endpoints — prefer it.
      final parsed = Uri.parse(uri);
      final qpToken = parsed.queryParameters["token"]?.trim();
      final VideoPlayerController c = (qpToken != null && qpToken.isNotEmpty)
          ? VideoPlayerController.networkUrl(
              parsed,
              httpHeaders: _lessonStreamHeaders(qpToken),
            )
          : VideoPlayerController.networkUrl(parsed);
      await c.initialize();
      _video = c;
      if (initialSeconds > 1) {
        await c.seekTo(Duration(milliseconds: (initialSeconds * 1000).round()));
      }
      final ar = c.value.aspectRatio > 0 ? c.value.aspectRatio : 16 / 9;

      _chewie = ChewieController(
        videoPlayerController: c,
        autoPlay: false,
        looping: false,
        aspectRatio: ar,
        allowFullScreen: true,
        allowMuting: true,
        allowPlaybackSpeedChanging: true,
        showControls: true,
        customControls: LearnHubChewiePlayerChrome(
          onOpenNotes: onOpenNotes,
          onMiniPlayer: () => enterMiniMode(),
        ),
        playbackSpeeds: const [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
        deviceOrientationsOnEnterFullScreen: const [
          DeviceOrientation.landscapeLeft,
          DeviceOrientation.landscapeRight,
        ],
        deviceOrientationsAfterFullScreen: DeviceOrientation.values,
        materialProgressColors: ChewieProgressColors(
          playedColor: LearnHubTheme.amber500,
          handleColor: LearnHubTheme.amber500,
          backgroundColor: LearnHubTheme.gray700,
          bufferedColor: LearnHubTheme.gray500,
        ),
        errorBuilder: (_, __) => Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline_rounded,
                  size: 44, color: LearnHubTheme.amber500),
              const SizedBox(height: 10),
              Text(
                "Video could not be loaded",
                style: LhText.body(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    fontSize: 15),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );

      _uri = uri;
      _listener = () {
        final v = _video;
        if (v == null || !v.value.isInitialized) return;
        _progressCallback?.call(
          v.value.position.inMilliseconds / 1000.0,
          v.value.duration.inMilliseconds / 1000.0,
        );
      };
      c.addListener(_listener!);
      notifyListeners();
    } catch (e, st) {
      debugPrint("CourseMiniPlayerService.ensureVideo: $e\n$st");
      await _disposeVideoOnly();
      rethrow;
    }
  }

  Future<void> _disposeVideoOnly() async {
    if (_listener != null) {
      _video?.removeListener(_listener!);
    }
    _listener = null;
    _progressCallback = null;
    _chewie?.dispose();
    _chewie = null;
    await _video?.dispose();
    _video = null;
    _uri = null;
  }

  Future<void> disposePlayer() async {
    _miniMode = false;
    activeCourseId = null;
    activeLessonId = null;
    await _disposeVideoOnly();
    notifyListeners();
  }
}
