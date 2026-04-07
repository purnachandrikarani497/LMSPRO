import "dart:async";
import "dart:io";
import "dart:math" as math;
import "dart:typed_data";

import "package:chewie/chewie.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:open_file/open_file.dart";
import "package:path_provider/path_provider.dart";
import "package:pdfx/pdfx.dart";
import "package:provider/provider.dart";
import "package:screen_protector/screen_protector.dart";
import "package:video_player/video_player.dart";
import "package:webview_flutter/webview_flutter.dart";

import "../models/auth_user.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../utils/media_urls.dart";
import "../widgets/learnhub_app_bar.dart";

class CourseLearnScreen extends StatefulWidget {
  const CourseLearnScreen({super.key, required this.courseId, this.initialLessonId});

  final String courseId;
  final String? initialLessonId;

  @override
  State<CourseLearnScreen> createState() => _CourseLearnScreenState();
}

String formatWatchTime(double seconds) {
  if (!seconds.isFinite || seconds < 0) return "0:00";
  final m = seconds ~/ 60;
  final s = (seconds % 60).floor();
  return "$m:${s.toString().padLeft(2, "0")}";
}

double parseDurationToSeconds(String? duration) {
  if (duration == null || duration.trim().isEmpty) return 0;
  final parts = duration.trim().split(":").map((p) => int.tryParse(p.replaceAll(RegExp(r"\D"), "")) ?? 0).toList();
  if (parts.length == 2) return (parts[0] * 60 + parts[1]).toDouble();
  if (parts.length >= 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]).toDouble();
  if (parts.length == 1) return parts[0].toDouble();
  return 0;
}

String formatTotalDurationLabel(double totalSeconds) {
  if (totalSeconds <= 0 || !totalSeconds.isFinite) return "—";
  final h = totalSeconds ~/ 3600;
  final m = ((totalSeconds % 3600) / 60).floor();
  if (h > 0 && m > 0) return "$h hr $m min total";
  if (h > 0) return "$h hr total";
  return "$m min total";
}

class _LearnData {
  _LearnData({
    required this.course,
    required this.timestamps,
    required this.durations,
    required this.notesByLesson,
    required this.completedLessonIds,
  });

  final Map<String, dynamic> course;
  final Map<String, double> timestamps;
  final Map<String, double> durations;
  final Map<String, List<Map<String, dynamic>>> notesByLesson;
  final Set<String> completedLessonIds;
}

class _CourseLearnScreenState extends State<CourseLearnScreen> with SingleTickerProviderStateMixin {
  Future<_LearnData>? _learnFuture;
  bool _started = false;
  String? _selectedLessonId;
  late TabController _tabController;
  final ValueNotifier<double> _videoTimeNotifier = ValueNotifier<double>(0);
  void Function(double seconds)? _seekVideo;

  Timer? _saveDebounce;
  double _lastSavedAt = -1;

  /// Live watch positions — updated without [setState] so the video layer does not rebuild every save.
  final ValueNotifier<Map<String, double>> _liveTimestamps = ValueNotifier<Map<String, double>>({});
  Map<String, List<Map<String, dynamic>>>? _notesRefresh;
  Map<String, dynamic>? _courseRefresh;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      context.read<AppState>().refreshEnrollments();
      try {
        await ScreenProtector.protectDataLeakageOn();
        await ScreenProtector.preventScreenshotOn();
      } catch (_) {}
    });
  }

  @override
  void dispose() {
    _saveDebounce?.cancel();
    _tabController.dispose();
    _videoTimeNotifier.dispose();
    _liveTimestamps.dispose();
    unawaited(_disableScreenProtection());
    super.dispose();
  }

  Future<void> _disableScreenProtection() async {
    try {
      await ScreenProtector.preventScreenshotOff();
      await ScreenProtector.protectDataLeakageOff();
    } catch (_) {}
  }

  void _onBackFromLearn(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go("/course/${widget.courseId}");
    }
  }

  void _openMoreSubpage(BuildContext context, String title, Widget body) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (ctx) => Scaffold(
          backgroundColor: LearnHubTheme.background,
          appBar: AppBar(
            backgroundColor: LearnHubTheme.navy,
            foregroundColor: LearnHubTheme.onHero,
            elevation: 0,
            title: Text(title, style: LhText.body(fontWeight: FontWeight.w600, color: LearnHubTheme.onHero)),
          ),
          body: body,
        ),
      ),
    );
  }

  Future<_LearnData> _loadLearnData(AppState app) async {
    final course = await app.courses.fetchCourse(widget.courseId);
    final bundle = await app.progress.fetchWatchBundle(widget.courseId);
    final prog = await app.progress.fetchProgress(widget.courseId);

    final ts = <String, double>{};
    bundle.timestamps.forEach((k, v) {
      final n = (v is num) ? v.toDouble() : double.tryParse("$v") ?? 0;
      ts["$k"] = n;
    });
    final dur = <String, double>{};
    bundle.durations.forEach((k, v) {
      final n = (v is num) ? v.toDouble() : double.tryParse("$v") ?? 0;
      dur["$k"] = n;
    });

    final notes = <String, List<Map<String, dynamic>>>{};
    bundle.notes.forEach((lessonId, raw) {
      final list = <Map<String, dynamic>>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is Map) list.add(Map<String, dynamic>.from(e));
        }
      }
      notes["$lessonId"] = list;
    });

    final completed = <String>{};
    final lc = prog?["lessonsCompleted"];
    if (lc is List) {
      for (final id in lc) {
        completed.add("$id");
      }
    }

    return _LearnData(
      course: course,
      timestamps: ts,
      durations: dur,
      notesByLesson: notes,
      completedLessonIds: completed,
    );
  }

  void _debouncedSaveProgress(
    AppState app,
    String lessonId,
    double position,
    double duration,
  ) {
    _saveDebounce?.cancel();
    _saveDebounce = Timer(const Duration(milliseconds: 450), () async {
      if ((position - _lastSavedAt).abs() < 0.25 && _lastSavedAt >= 0) return;
      _lastSavedAt = position;
      try {
        await app.progress.saveWatchTimestamp(widget.courseId, lessonId, position, duration > 0 ? duration : null);
        if (mounted) {
          _liveTimestamps.value = {..._liveTimestamps.value, lessonId: position};
        }
      } catch (_) {}
    });
  }

  Future<void> _syncNotesFromServer(AppState app) async {
    final bundle = await app.progress.fetchWatchBundle(widget.courseId);
    final notes = <String, List<Map<String, dynamic>>>{};
    bundle.notes.forEach((lessonId, raw) {
      final list = <Map<String, dynamic>>[];
      if (raw is List) {
        for (final e in raw) {
          if (e is Map) list.add(Map<String, dynamic>.from(e));
        }
      }
      notes["$lessonId"] = list;
    });
    if (mounted) setState(() => _notesRefresh = notes);
  }

  _LearnData _blendLearn(_LearnData data) {
    return _LearnData(
      course: _courseRefresh ?? data.course,
      timestamps: {...data.timestamps, ..._liveTimestamps.value},
      durations: data.durations,
      notesByLesson: _notesRefresh ?? data.notesByLesson,
      completedLessonIds: data.completedLessonIds,
    );
  }

  bool _isPdfLesson(Map<String, dynamic> lesson) {
    final t = lesson["lessonType"]?.toString();
    if (t == "pdf") return (lesson["pdfUrl"]?.toString() ?? "").isNotEmpty;
    final pdf = lesson["pdfUrl"]?.toString();
    final v = lesson["videoUrl"]?.toString();
    return pdf != null && pdf.isNotEmpty && (v == null || v.isEmpty);
  }

  List<({String sectionTitle, Map<String, dynamic> lesson})> _lessonsWithSections(Map<String, dynamic> course) {
    final out = <({String sectionTitle, Map<String, dynamic> lesson})>[];
    final sections = course["sections"] as List<dynamic>? ?? [];
    if (sections.isNotEmpty) {
      for (final s in sections) {
        final m = Map<String, dynamic>.from(s as Map);
        final title = m["title"]?.toString() ?? "Section";
        final lessons = m["lessons"] as List<dynamic>? ?? [];
        for (final l in lessons) {
          out.add((sectionTitle: title, lesson: Map<String, dynamic>.from(l as Map)));
        }
      }
      return out;
    }
    final top = course["lessons"] as List<dynamic>? ?? [];
    for (final l in top) {
      out.add((sectionTitle: "Lessons", lesson: Map<String, dynamic>.from(l as Map)));
    }
    return out;
  }

  List<({String title, List<Map<String, dynamic>> lessons})> _sectionGroups(Map<String, dynamic> course) {
    final sections = course["sections"] as List<dynamic>? ?? [];
    if (sections.isNotEmpty) {
      return sections.map((raw) {
        final m = Map<String, dynamic>.from(raw as Map);
        final lessonList = m["lessons"] as List<dynamic>? ?? [];
        return (
          title: m["title"]?.toString() ?? "Section",
          lessons: [for (final l in lessonList) Map<String, dynamic>.from(l as Map)],
        );
      }).toList();
    }
    final top = course["lessons"] as List<dynamic>? ?? [];
    return [
      (
        title: "Lessons",
        lessons: [for (final l in top) Map<String, dynamic>.from(l as Map)],
      ),
    ];
  }

  bool _isLessonComplete(
    Map<String, dynamic> lesson,
    _LearnData data,
  ) {
    final lid = lesson["_id"]?.toString();
    if (lid == null) return false;
    if (data.completedLessonIds.contains(lid)) return true;
    if (_isPdfLesson(lesson)) return false;
    final dur = data.durations[lid] ?? parseDurationToSeconds(lesson["duration"]?.toString());
    final ts = data.timestamps[lid] ?? 0;
    return dur > 0 && ts / dur >= 0.9;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final app = context.read<AppState>();
    _learnFuture = _loadLearnData(app);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();

    if (app.user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go("/login");
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))));
    }

    if (!app.isEnrolledInCourse(widget.courseId)) {
      return Scaffold(
        backgroundColor: LearnHubTheme.background,
        appBar: LearnHubAppBar(
          titleText: "Course",
          leading: IconButton(
            icon: Icon(Icons.arrow_back_rounded, color: LearnHubTheme.foreground),
            onPressed: () => context.canPop() ? context.pop() : context.go("/courses"),
          ),
        ),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  "Enroll to watch lessons",
                  style: LhText.display(fontSize: 22, fontWeight: FontWeight.w800),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  "Open this course and tap Enroll to get access.",
                  textAlign: TextAlign.center,
                  style: LhText.body(color: LearnHubTheme.mutedForeground, height: 1.4),
                ),
                const SizedBox(height: 24),
                FilledButton(
                  onPressed: () => context.go("/course/${widget.courseId}"),
                  style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.amber500),
                  child: Text("View course", style: LhText.body(fontWeight: FontWeight.w600)),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: LearnHubTheme.background,
      body: _learnFuture == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : FutureBuilder<_LearnData>(
              future: _learnFuture,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
                }
                if (snap.hasError || snap.data == null) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        "Could not load course: ${snap.error}",
                        style: LhText.body(color: LearnHubTheme.gray700),
                      ),
                    ),
                  );
                }
                final data = snap.data!;
                final blended = _blendLearn(data);
                final course = blended.course;
                final flat = _lessonsWithSections(course);
                if (flat.isEmpty) {
                  return Center(
                    child: Text("No lessons in this course yet.", style: LhText.body(color: LearnHubTheme.mutedForeground)),
                  );
                }

                final ids = flat.map((e) => e.lesson["_id"]?.toString()).whereType<String>().toList();
                final initial = widget.initialLessonId != null && ids.contains(widget.initialLessonId!)
                    ? widget.initialLessonId!
                    : ids.first;
                final effectiveId = _selectedLessonId ?? initial;
                final current = flat.map((e) => e.lesson).firstWhere(
                      (l) => l["_id"]?.toString() == effectiveId,
                      orElse: () => flat.first.lesson,
                    );

                final courseTitle = course["title"]?.toString() ?? "Course";
                final groups = _sectionGroups(course);

                final idx = flat.indexWhere((e) => e.lesson["_id"]?.toString() == effectiveId);
                final prevLesson = idx > 0 ? flat[idx - 1].lesson : null;
                final nextLesson = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1].lesson : null;

                final totalDur = flat.fold<double>(0, (sum, e) => sum + parseDurationToSeconds(e.lesson["duration"]?.toString()));

                return FutureBuilder<String?>(
                  future: app.auth.getToken(),
                  builder: (context, tokSnap) {
                    if (tokSnap.connectionState == ConnectionState.waiting) {
                      return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
                    }
                    final token = tokSnap.data;
                    if (token == null || token.isEmpty) {
                      return Center(
                        child: Text(
                          "Session expired. Sign in again.",
                          style: LhText.body(color: LearnHubTheme.mutedForeground),
                        ),
                      );
                    }
                    final isPdf = _isPdfLesson(current);
                    final initialSec = blended.timestamps[effectiveId] ?? 0;

                    final media = _LessonContent(
                      key: ValueKey<String>("$effectiveId-${isPdf ? "p" : "v"}"),
                      courseId: widget.courseId,
                      lesson: current,
                      token: token,
                      isPdf: isPdf,
                      app: app,
                      initialVideoSeconds: initialSec,
                      onVideoProgress: (pos, dur) {
                        _videoTimeNotifier.value = pos;
                        _debouncedSaveProgress(app, effectiveId, pos, dur);
                      },
                      onSeekReady: (fn) {
                        WidgetsBinding.instance.addPostFrameCallback((_) {
                          if (mounted) _seekVideo = fn;
                        });
                      },
                    );

                    final lessonTitle = current["title"]?.toString() ?? "Lesson";

                    return LayoutBuilder(
                      builder: (context, constraints) {
                        final mq = MediaQuery.of(context);
                        final maxH = constraints.maxHeight;
                        final pdfH = math.min(440.0, math.max(220.0, maxH * 0.38));
                        final hPad = (mq.size.width * 0.04).clamp(10.0, 22.0);
                        final sideNav = math.max(6.0, mq.padding.left + 4.0);
                        final compact = mq.size.width < 360;

                        return Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            SafeArea(
                              bottom: false,
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  border: Border(bottom: BorderSide(color: LearnHubTheme.border)),
                                ),
                                child: SizedBox(
                                  height: kToolbarHeight,
                                  child: Row(
                                    children: [
                                      SizedBox(width: math.max(0.0, hPad - 8)),
                                      IconButton(
                                        icon: Icon(Icons.arrow_back_rounded, color: LearnHubTheme.foreground, size: compact ? 22 : 24),
                                        onPressed: () => _onBackFromLearn(context),
                                        tooltip: "Back to course",
                                        padding: const EdgeInsets.all(12),
                                        constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                                      ),
                                      Expanded(
                                        child: Text(
                                          courseTitle,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: LhText.display(
                                            fontSize: compact ? 15 : 16,
                                            fontWeight: FontWeight.w800,
                                            color: LearnHubTheme.foreground,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(width: 8),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            RepaintBoundary(
                              child: ColoredBox(
                                color: Colors.black,
                                child: isPdf
                                    ? SizedBox(
                                        height: pdfH,
                                        width: double.infinity,
                                        child: Stack(
                                          fit: StackFit.expand,
                                          clipBehavior: Clip.hardEdge,
                                          children: [
                                            Positioned.fill(child: media),
                                            Positioned(
                                              left: 12,
                                              top: 8,
                                              right: 16,
                                              child: Align(
                                                alignment: Alignment.topLeft,
                                                child: _LearnPlayerLessonLabel(text: lessonTitle, compact: compact),
                                              ),
                                            ),
                                          ],
                                        ),
                                      )
                                    : AspectRatio(
                                        aspectRatio: 16 / 9,
                                        child: Stack(
                                          fit: StackFit.expand,
                                          clipBehavior: Clip.hardEdge,
                                          children: [
                                            Positioned.fill(child: media),
                                            Positioned(
                                              left: 12,
                                              top: 8,
                                              right: 72,
                                              child: Align(
                                                alignment: Alignment.topLeft,
                                                child: _LearnPlayerLessonLabel(text: lessonTitle, compact: compact),
                                              ),
                                            ),
                                            Positioned(
                                              left: sideNav,
                                              top: 0,
                                              bottom: 0,
                                              child: Center(
                                                child: _RoundNavIcon(
                                                  compact: compact,
                                                  icon: Icons.chevron_left_rounded,
                                                  enabled: prevLesson != null,
                                                  onTap: prevLesson == null
                                                      ? null
                                                      : () => setState(() => _selectedLessonId = prevLesson["_id"]?.toString()),
                                                ),
                                              ),
                                            ),
                                            Positioned(
                                              right: sideNav,
                                              top: 0,
                                              bottom: 0,
                                              child: Center(
                                                child: _RoundNavIcon(
                                                  compact: compact,
                                                  icon: Icons.chevron_right_rounded,
                                                  enabled: nextLesson != null,
                                                  onTap: nextLesson == null
                                                      ? null
                                                      : () => setState(() => _selectedLessonId = nextLesson["_id"]?.toString()),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                              ),
                            ),
                            ValueListenableBuilder<Map<String, double>>(
                              valueListenable: _liveTimestamps,
                              builder: (context, liveTs, _) {
                                final blended = _LearnData(
                                  course: _courseRefresh ?? data.course,
                                  timestamps: {...data.timestamps, ...liveTs},
                                  durations: data.durations,
                                  notesByLesson: _notesRefresh ?? data.notesByLesson,
                                  completedLessonIds: data.completedLessonIds,
                                );
                                return Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      Material(
                                        color: Colors.white,
                                        child: TabBar(
                                          controller: _tabController,
                                          labelColor: LearnHubTheme.navy,
                                          unselectedLabelColor: LearnHubTheme.mutedForeground,
                                          indicatorColor: LearnHubTheme.amber500,
                                          indicatorWeight: 3,
                                          labelStyle: LhText.body(fontWeight: FontWeight.w800, fontSize: 14),
                                          unselectedLabelStyle: LhText.body(fontWeight: FontWeight.w600, fontSize: 14),
                                          tabs: const [
                                            Tab(text: "Lectures"),
                                            Tab(text: "More"),
                                          ],
                                        ),
                                      ),
                                      Expanded(
                                        child: ColoredBox(
                                          color: LearnHubTheme.gray50,
                                          child: TabBarView(
                                            controller: _tabController,
                                            children: [
                                              _UdemyLecturesTab(
                                                groups: groups,
                                                effectiveLessonId: effectiveId,
                                                blended: blended,
                                                onSelectLesson: (id) => setState(() => _selectedLessonId = id),
                                                isPdfLesson: _isPdfLesson,
                                                isLessonComplete: (l) => _isLessonComplete(l, blended),
                                              ),
                                              _UdemyMoreTab(
                                                onOpenOverview: () => _openMoreSubpage(
                                                  context,
                                                  "Overview",
                                                  _OverviewTab(
                                                    course: course,
                                                    currentLessonTitle: current["title"]?.toString() ?? "",
                                                    totalDurationLabel: formatTotalDurationLabel(totalDur),
                                                  ),
                                                ),
                                                onOpenNotes: () => _openMoreSubpage(
                                                  context,
                                                  "Notes",
                                                  _NotesTab(
                                                    courseId: widget.courseId,
                                                    lessonId: effectiveId,
                                                    videoTime: _videoTimeNotifier,
                                                    notes: blended.notesByLesson[effectiveId] ?? [],
                                                    onReload: () => _syncNotesFromServer(app),
                                                    seekVideo: _seekVideo,
                                                  ),
                                                ),
                                                onOpenAnnouncements: () => _openMoreSubpage(
                                                  context,
                                                  "Announcements",
                                                  _AnnouncementsTab(course: course),
                                                ),
                                                onOpenReviews: () => _openMoreSubpage(
                                                  context,
                                                  "Reviews",
                                                  _ReviewsTab(
                                                    course: course,
                                                    courseId: widget.courseId,
                                                    currentUser: app.user,
                                                    onReviewSubmitted: () async {
                                                      try {
                                                        final c = await app.courses.fetchCourse(widget.courseId);
                                                        if (mounted) setState(() => _courseRefresh = c);
                                                      } catch (_) {}
                                                    },
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                );
                              },
                            ),
                          ],
                        );
                      },
                    );
                  },
                );
              },
            ),
    );
  }
}

class _UdemyLecturesTab extends StatefulWidget {
  const _UdemyLecturesTab({
    required this.groups,
    required this.effectiveLessonId,
    required this.blended,
    required this.onSelectLesson,
    required this.isPdfLesson,
    required this.isLessonComplete,
  });

  final List<({String title, List<Map<String, dynamic>> lessons})> groups;
  final String effectiveLessonId;
  final _LearnData blended;
  final void Function(String id) onSelectLesson;
  final bool Function(Map<String, dynamic> lesson) isPdfLesson;
  final bool Function(Map<String, dynamic> lesson) isLessonComplete;

  @override
  State<_UdemyLecturesTab> createState() => _UdemyLecturesTabState();
}

class _UdemyLecturesTabState extends State<_UdemyLecturesTab> {
  late Set<int> _expandedSectionIndexes;

  Set<int> _initialExpanded() {
    final open = <int>{};
    for (var i = 0; i < widget.groups.length; i++) {
      final g = widget.groups[i];
      if (g.lessons.any((l) => l["_id"]?.toString() == widget.effectiveLessonId)) {
        open.add(i);
      }
    }
    if (open.isEmpty && widget.groups.isNotEmpty) {
      open.add(0);
    }
    return open;
  }

  @override
  void initState() {
    super.initState();
    _expandedSectionIndexes = _initialExpanded();
  }

  @override
  void didUpdateWidget(covariant _UdemyLecturesTab oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.effectiveLessonId != widget.effectiveLessonId ||
        oldWidget.groups.length != widget.groups.length) {
      final gi = widget.groups.indexWhere(
        (g) => g.lessons.any((l) => l["_id"]?.toString() == widget.effectiveLessonId),
      );
      if (gi >= 0) {
        setState(() => _expandedSectionIndexes.add(gi));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: LearnHubTheme.gray50,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 32),
        children: [
          for (var gi = 0; gi < widget.groups.length; gi++) ...[
            Material(
              color: Colors.white,
              child: InkWell(
                onTap: () {
                  setState(() {
                    if (_expandedSectionIndexes.contains(gi)) {
                      _expandedSectionIndexes.remove(gi);
                    } else {
                      _expandedSectionIndexes.add(gi);
                    }
                  });
                },
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 14, 12, 14),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        _expandedSectionIndexes.contains(gi) ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                        color: LearnHubTheme.navy,
                        size: 22,
                      ),
                      const SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          widget.groups[gi].title,
                          style: LhText.body(fontWeight: FontWeight.w800, fontSize: 15, color: LearnHubTheme.foreground),
                        ),
                      ),
                      Text(
                        "${widget.groups[gi].lessons.length} lectures",
                        style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (_expandedSectionIndexes.contains(gi))
              for (var i = 0; i < widget.groups[gi].lessons.length; i++)
                _UdemyLectureRow(
                  lesson: widget.groups[gi].lessons[i],
                  isActive: widget.groups[gi].lessons[i]["_id"]?.toString() == widget.effectiveLessonId,
                  isPdf: widget.isPdfLesson(widget.groups[gi].lessons[i]),
                  onTap: () {
                    final id = widget.groups[gi].lessons[i]["_id"]?.toString();
                    if (id != null && id.isNotEmpty) widget.onSelectLesson(id);
                  },
                  data: widget.blended,
                  isComplete: widget.isLessonComplete(widget.groups[gi].lessons[i]),
                ),
            Divider(height: 1, color: LearnHubTheme.gray200),
          ],
        ],
      ),
    );
  }
}

class _UdemyLectureRow extends StatelessWidget {
  const _UdemyLectureRow({
    required this.lesson,
    required this.isActive,
    required this.isPdf,
    required this.onTap,
    required this.data,
    required this.isComplete,
  });

  final Map<String, dynamic> lesson;
  final bool isActive;
  final bool isPdf;
  final VoidCallback onTap;
  final _LearnData data;
  final bool isComplete;

  @override
  Widget build(BuildContext context) {
    final t = lesson["title"]?.toString() ?? "Lesson";
    final dur = lesson["duration"]?.toString() ?? "";
    final lid = lesson["_id"]?.toString() ?? "";
    final total = data.durations[lid] ?? parseDurationToSeconds(dur);
    final watched = data.timestamps[lid] ?? 0;
    double frac = 0;
    if (total > 0) frac = (watched / total).clamp(0.0, 1.0);
    if (isComplete) frac = 1;

    final showResume = !isPdf && total > 0 && watched > 5 && frac < 0.92;
    final meta = isPdf
        ? "PDF"
        : (dur.isNotEmpty ? "Video · $dur" : "Video");

    final accent = isActive ? LearnHubTheme.navy : LearnHubTheme.gray500;
    final bg = isActive ? LearnHubTheme.amber500.withValues(alpha: 0.08) : Colors.transparent;

    return Material(
      color: bg,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              SizedBox(
                width: 32,
                child: isComplete
                    ? Icon(Icons.check_circle_rounded, size: 22, color: LearnHubTheme.amber500)
                    : Icon(
                        isPdf ? Icons.picture_as_pdf_outlined : Icons.play_circle_outline_rounded,
                        size: 22,
                        color: accent,
                      ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t,
                      style: LhText.body(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: LearnHubTheme.foreground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      meta,
                      style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
                    ),
                    if (!isPdf && total > 0) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(3),
                        child: LinearProgressIndicator(
                          value: frac,
                          minHeight: 3,
                          backgroundColor: LearnHubTheme.gray200,
                          color: LearnHubTheme.amber500,
                        ),
                      ),
                    ],
                    if (showResume)
                      Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text(
                          "Resume at ${formatWatchTime(watched)}",
                          style: LhText.body(fontSize: 11, fontWeight: FontWeight.w600, color: LearnHubTheme.amber500),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _UdemyMoreTab extends StatelessWidget {
  const _UdemyMoreTab({
    required this.onOpenOverview,
    required this.onOpenNotes,
    required this.onOpenAnnouncements,
    required this.onOpenReviews,
  });

  final VoidCallback onOpenOverview;
  final VoidCallback onOpenNotes;
  final VoidCallback onOpenAnnouncements;
  final VoidCallback onOpenReviews;

  @override
  Widget build(BuildContext context) {
    Widget tile(String label, IconData icon, VoidCallback onTap) {
      return ListTile(
        contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 4),
        leading: Icon(icon, color: LearnHubTheme.mutedForeground),
        title: Text(label, style: LhText.body(fontWeight: FontWeight.w600, color: LearnHubTheme.foreground)),
        trailing: Icon(Icons.chevron_right_rounded, color: LearnHubTheme.gray400),
        onTap: onTap,
      );
    }

    return ColoredBox(
      color: Colors.white,
      child: ListView(
        children: [
          tile("Overview", Icons.info_outline_rounded, onOpenOverview),
          Divider(height: 1, color: LearnHubTheme.gray200),
          tile("Notes", Icons.note_alt_outlined, onOpenNotes),
          Divider(height: 1, color: LearnHubTheme.gray200),
          tile("Announcements", Icons.campaign_outlined, onOpenAnnouncements),
          Divider(height: 1, color: LearnHubTheme.gray200),
          tile("Reviews", Icons.star_outline_rounded, onOpenReviews),
        ],
      ),
    );
  }
}

class _RoundNavIcon extends StatelessWidget {
  const _RoundNavIcon({
    required this.icon,
    required this.enabled,
    this.onTap,
    this.compact = false,
  });

  final IconData icon;
  final bool enabled;
  final VoidCallback? onTap;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final iconSize = compact ? 28.0 : 32.0;
    return Material(
      color: Colors.black.withValues(alpha: 0.35),
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: enabled ? onTap : null,
        child: Padding(
          padding: const EdgeInsets.all(3),
          child: Icon(icon, color: enabled ? Colors.white : Colors.white38, size: iconSize),
        ),
      ),
    );
  }
}

class _OverviewTab extends StatelessWidget {
  const _OverviewTab({
    required this.course,
    required this.currentLessonTitle,
    required this.totalDurationLabel,
  });

  final Map<String, dynamic> course;
  final String currentLessonTitle;
  final String totalDurationLabel;

  @override
  Widget build(BuildContext context) {
    final rating = (course["rating"] is num) ? (course["rating"] as num).toDouble() : double.tryParse("${course["rating"]}") ?? 0;
    final rc = course["ratingCount"] ?? course["reviews"]?.length ?? 0;
    final rcn = rc is num ? rc.toInt() : int.tryParse("$rc") ?? 0;
    final desc = course["description"]?.toString() ?? "";
    final instructor = course["instructor"]?.toString() ?? "Instructor";
    final bio = course["instructorBio"]?.toString();
    final title = course["instructorTitle"]?.toString();

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        if (currentLessonTitle.isNotEmpty)
          Text(currentLessonTitle, style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(rating.toStringAsFixed(1), style: LhText.body(fontWeight: FontWeight.w800, fontSize: 16, color: LearnHubTheme.amber600)),
            const SizedBox(width: 6),
            Row(
              children: List.generate(5, (i) {
                return Icon(
                  i < rating.floor() ? Icons.star_rounded : Icons.star_border_rounded,
                  size: 18,
                  color: i < rating.floor() ? const Color(0xFFFBBF24) : LearnHubTheme.gray300,
                );
              }),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text("($rcn ratings)", style: LhText.body(fontSize: 13, color: LearnHubTheme.gray600)),
            ),
            Text(totalDurationLabel, style: LhText.body(fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ),
        const SizedBox(height: 20),
        Text("About this course", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text(desc.isEmpty ? "No description available." : desc, style: LhText.body(height: 1.45, fontSize: 14, color: LearnHubTheme.gray700)),
        const SizedBox(height: 24),
        Text("Instructor", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            CircleAvatar(
              radius: 28,
              backgroundColor: LearnHubTheme.gray200,
              child: Text(instructor.isNotEmpty ? instructor[0].toUpperCase() : "?", style: LhText.display(fontWeight: FontWeight.w800)),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(instructor, style: LhText.body(fontWeight: FontWeight.w800, fontSize: 16)),
                  if (title != null && title.isNotEmpty)
                    Text(title, style: LhText.body(fontSize: 13, color: LearnHubTheme.amber600, fontWeight: FontWeight.w600)),
                  if (bio != null && bio.isNotEmpty) ...[
                    const SizedBox(height: 8),
                    Text(bio, style: LhText.body(fontSize: 13, height: 1.4, color: LearnHubTheme.gray600)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _NotesTab extends StatefulWidget {
  const _NotesTab({
    required this.courseId,
    required this.lessonId,
    required this.videoTime,
    required this.notes,
    required this.onReload,
    required this.seekVideo,
  });

  final String courseId;
  final String lessonId;
  final ValueNotifier<double> videoTime;
  final List<Map<String, dynamic>> notes;
  final Future<void> Function() onReload;
  final void Function(double)? seekVideo;

  @override
  State<_NotesTab> createState() => _NotesTabState();
}

class _NotesTabState extends State<_NotesTab> {
  final TextEditingController _controller = TextEditingController();
  bool _saving = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _save(AppState app) async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;
    setState(() => _saving = true);
    try {
      await app.progress.saveNote(widget.courseId, widget.lessonId, text, widget.videoTime.value);
      _controller.clear();
      await widget.onReload();
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text("Notes", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        ValueListenableBuilder<double>(
          valueListenable: widget.videoTime,
          builder: (_, t, __) {
            return Text(
              "Saved at ${formatWatchTime(t)}",
              style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
            );
          },
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _controller,
          maxLines: 5,
          maxLength: 1000,
          decoration: InputDecoration(
            hintText: "Add a note for this lecture…",
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            filled: true,
            fillColor: LearnHubTheme.gray50,
          ),
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: FilledButton(
            onPressed: _saving ? null : () => _save(app),
            style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.amber600),
            child: _saving
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text("Save note", style: LhText.body(fontWeight: FontWeight.w700)),
          ),
        ),
        const SizedBox(height: 20),
        Text("This lecture", style: LhText.body(fontWeight: FontWeight.w700)),
        const SizedBox(height: 8),
        if (widget.notes.isEmpty)
          Text("No notes yet.", style: LhText.body(color: LearnHubTheme.mutedForeground))
        else
          ...widget.notes.asMap().entries.map((e) {
            final i = e.key;
            final n = e.value;
            final ts = (n["videoTimestamp"] is num) ? (n["videoTimestamp"] as num).toDouble() : double.tryParse("${n["videoTimestamp"]}") ?? 0;
            return Card(
              margin: const EdgeInsets.only(bottom: 10),
              child: ListTile(
                title: Text(n["text"]?.toString() ?? "", style: LhText.body(height: 1.35)),
                subtitle: Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: TextButton(
                    onPressed: () => widget.seekVideo?.call(ts),
                    child: Text("Jump to ${formatWatchTime(ts)}", style: LhText.body(fontWeight: FontWeight.w700, color: LearnHubTheme.amber600)),
                  ),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline_rounded),
                  onPressed: () async {
                    await app.progress.deleteNote(widget.courseId, widget.lessonId, i);
                    await widget.onReload();
                  },
                ),
              ),
            );
          }),
      ],
    );
  }
}

class _AnnouncementsTab extends StatelessWidget {
  const _AnnouncementsTab({required this.course});

  final Map<String, dynamic> course;

  @override
  Widget build(BuildContext context) {
    final raw = course["announcements"];
    final list = raw is List ? raw : const [];
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text("Announcements", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 12),
        if (list.isEmpty)
          Text("No announcements yet.", style: LhText.body(color: LearnHubTheme.mutedForeground))
        else
          ...list.map((a) {
            final m = Map<String, dynamic>.from(a as Map);
            return Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(m["title"]?.toString() ?? "", style: LhText.body(fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(m["content"]?.toString() ?? "", style: LhText.body(height: 1.35)),
                    if (m["postedAt"] != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          "Posted ${_formatDate(m["postedAt"])}",
                          style: LhText.body(fontSize: 11, color: LearnHubTheme.mutedForeground),
                        ),
                      ),
                  ],
                ),
              ),
            );
          }),
      ],
    );
  }

  String _formatDate(dynamic v) {
    final d = v is String ? DateTime.tryParse(v) : null;
    if (d == null) return "";
    return "${d.day}/${d.month}/${d.year}";
  }
}

class _ReviewsTab extends StatefulWidget {
  const _ReviewsTab({
    required this.course,
    required this.courseId,
    required this.currentUser,
    required this.onReviewSubmitted,
  });

  final Map<String, dynamic> course;
  final String courseId;
  final AuthUser? currentUser;
  final Future<void> Function() onReviewSubmitted;

  @override
  State<_ReviewsTab> createState() => _ReviewsTabState();
}

class _ReviewsTabState extends State<_ReviewsTab> {
  int _rating = 0;
  final TextEditingController _comment = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  Map<String, dynamic>? _userReview(List<dynamic>? reviews, String? uid) {
    if (reviews == null || uid == null) return null;
    for (final r in reviews) {
      if (r is! Map) continue;
      final u = r["user"];
      String? id;
      if (u is Map) id = u["_id"]?.toString() ?? u["id"]?.toString();
      if (id == uid) return Map<String, dynamic>.from(r);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    final reviews = widget.course["reviews"] as List<dynamic>? ?? [];
    final uid = widget.currentUser?.id;
    final mine = _userReview(reviews, uid);
    final rating = (widget.course["rating"] is num) ? (widget.course["rating"] as num).toDouble() : 0;

    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
      children: [
        Text("Student feedback", style: LhText.display(fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 16),
        Center(
          child: Column(
            children: [
              Text(rating.toStringAsFixed(1), style: LhText.display(fontSize: 44, fontWeight: FontWeight.w800, color: LearnHubTheme.amber500)),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(5, (i) {
                  return Icon(
                    i < rating.floor() ? Icons.star_rounded : Icons.star_border_rounded,
                    color: i < rating.floor() ? const Color(0xFFFBBF24) : LearnHubTheme.gray300,
                  );
                }),
              ),
              Text("Average rating", style: LhText.body(color: LearnHubTheme.mutedForeground)),
            ],
          ),
        ),
        const SizedBox(height: 24),
        if (mine != null)
          Card(
            color: LearnHubTheme.amber500.withValues(alpha: 0.08),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text("Your review", style: LhText.body(fontWeight: FontWeight.w800)),
                  const SizedBox(height: 8),
                  Text(mine["comment"]?.toString() ?? "", style: LhText.body(height: 1.35)),
                ],
              ),
            ),
          )
        else ...[
          Text("Rate this course", style: LhText.body(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Row(
            children: List.generate(5, (i) {
              final star = i + 1;
              return IconButton(
                onPressed: () => setState(() => _rating = star),
                icon: Icon(star <= _rating ? Icons.star_rounded : Icons.star_border_rounded),
                color: star <= _rating ? const Color(0xFFFBBF24) : LearnHubTheme.gray400,
              );
            }),
          ),
          TextField(
            controller: _comment,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: "Write your review…",
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 8),
          FilledButton(
            onPressed: _submitting || _rating < 1 || _comment.text.trim().isEmpty
                ? null
                : () async {
                    setState(() => _submitting = true);
                    try {
                      await app.courses.submitReview(widget.courseId, rating: _rating, comment: _comment.text.trim());
                      await widget.onReviewSubmitted();
                    } finally {
                      if (mounted) setState(() => _submitting = false);
                    }
                  },
            style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.amber600),
            child: Text(_submitting ? "Submitting…" : "Submit review", style: LhText.body(fontWeight: FontWeight.w700)),
          ),
        ],
        const SizedBox(height: 20),
        Text("Reviews", style: LhText.body(fontWeight: FontWeight.w800, fontSize: 16)),
        const SizedBox(height: 8),
        ...reviews.map((r) {
          if (r is! Map) return const SizedBox.shrink();
          final m = Map<String, dynamic>.from(r);
          final name = m["user"] is Map ? (m["user"] as Map)["name"]?.toString() ?? "Student" : "Student";
          final rr = (m["rating"] is num) ? (m["rating"] as num).toInt() : int.tryParse("${m["rating"]}") ?? 0;
          return Padding(
            padding: const EdgeInsets.only(bottom: 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: LhText.body(fontWeight: FontWeight.w700)),
                Row(
                  children: List.generate(5, (i) => Icon(i < rr ? Icons.star_rounded : Icons.star_border_rounded, size: 16, color: const Color(0xFFFBBF24))),
                ),
                const SizedBox(height: 4),
                Text(m["comment"]?.toString() ?? "", style: LhText.body(height: 1.35, color: LearnHubTheme.gray700)),
                const Divider(height: 24),
              ],
            ),
          );
        }),
      ],
    );
  }
}

class _LessonContent extends StatelessWidget {
  const _LessonContent({
    super.key,
    required this.courseId,
    required this.lesson,
    required this.token,
    required this.isPdf,
    required this.app,
    required this.initialVideoSeconds,
    required this.onVideoProgress,
    required this.onSeekReady,
  });

  final String courseId;
  final Map<String, dynamic> lesson;
  final String token;
  final bool isPdf;
  final AppState app;
  final double initialVideoSeconds;
  final void Function(double position, double duration) onVideoProgress;
  final void Function(void Function(double) seek) onSeekReady;

  @override
  Widget build(BuildContext context) {
    final lessonId = lesson["_id"]?.toString() ?? "";

    if (isPdf) {
      if (lessonId.isEmpty) return _msg("Invalid lesson");
      return _PdfLessonViewer(courseId: courseId, lessonId: lessonId, app: app);
    }

    final raw = lesson["videoUrl"]?.toString() ?? "";
    if (raw.isEmpty) return _msg("This lesson has no video yet.");

    if (isOurHostedVideo(raw)) {
      if (lessonId.isEmpty) return _msg("Invalid lesson");
      final uri = MediaUrls.lessonStreamUrl(courseId, lessonId, token);
      return _ChewieNetwork(
        uri: uri,
        initialSeconds: initialVideoSeconds,
        onVideoProgress: onVideoProgress,
        onSeekReady: onSeekReady,
      );
    }

    if (isEmbedHost(raw)) {
      final yt = extractYoutubeId(raw);
      if (yt != null) {
        return _EmbedWebView(url: "https://www.youtube.com/embed/$yt?playsinline=1");
      }
      final vm = extractVimeoId(raw);
      if (vm != null) {
        return _EmbedWebView(url: "https://player.vimeo.com/video/$vm");
      }
      return _EmbedWebView(url: raw);
    }

    final proxied = MediaUrls.secureVideoProxy(raw, token) ?? raw;
    return _ChewieNetwork(
      uri: proxied,
      initialSeconds: initialVideoSeconds,
      onVideoProgress: onVideoProgress,
      onSeekReady: onSeekReady,
    );
  }

  static Widget _msg(String text) {
    return Container(
      color: LearnHubTheme.gray900,
      alignment: Alignment.center,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 40, color: LearnHubTheme.amber500),
            const SizedBox(height: 12),
            Text(text, textAlign: TextAlign.center, style: LhText.body(color: Colors.white, fontWeight: FontWeight.w500)),
          ],
        ),
      ),
    );
  }
}

class _PdfLessonViewer extends StatefulWidget {
  const _PdfLessonViewer({required this.courseId, required this.lessonId, required this.app});

  final String courseId;
  final String lessonId;
  final AppState app;

  @override
  State<_PdfLessonViewer> createState() => _PdfLessonViewerState();
}

class _PdfLessonViewerState extends State<_PdfLessonViewer> {
  String? _error;
  bool _loading = true;
  PdfController? _pdfController;
  String? _tempPdfPath;

  @override
  void initState() {
    super.initState();
    _loadPdf();
  }

  Future<void> _loadPdf() async {
    try {
      final Uint8List bytes =
          await widget.app.progress.fetchLessonPdfBytes(widget.courseId, widget.lessonId);
      if (bytes.lengthInBytes < 16) {
        if (mounted) {
          setState(() {
            _error = "Empty PDF";
            _loading = false;
          });
        }
        return;
      }
      final dir = await getTemporaryDirectory();
      final f = File("${dir.path}/lesson_${widget.lessonId}.pdf");
      await f.writeAsBytes(bytes, flush: true);
      _tempPdfPath = f.path;

      if (!mounted) return;
      _pdfController?.dispose();
      _pdfController = PdfController(
        document: PdfDocument.openData(bytes),
      );
      setState(() => _loading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = "$e";
          _loading = false;
        });
      }
    }
  }

  @override
  void dispose() {
    _pdfController?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Container(
        color: LearnHubTheme.gray100,
        alignment: Alignment.center,
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline_rounded, size: 40, color: LearnHubTheme.amber500),
            const SizedBox(height: 12),
            Text(_error!, textAlign: TextAlign.center, style: LhText.body(color: LearnHubTheme.gray700)),
            if (_tempPdfPath != null) ...[
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => OpenFile.open(_tempPdfPath!),
                icon: const Icon(Icons.open_in_new_rounded, size: 20),
                label: const Text("Try external viewer"),
              ),
            ],
          ],
        ),
      );
    }
    if (_loading || _pdfController == null) {
      return ColoredBox(
        color: LearnHubTheme.background,
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(color: Color(0xFFF59E0B)),
              const SizedBox(height: 16),
              Text("Loading PDF…", style: LhText.body(color: LearnHubTheme.gray600)),
            ],
          ),
        ),
      );
    }
    final c = _pdfController!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: LearnHubTheme.navy,
          elevation: 1,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(8, 6, 4, 6),
            child: Row(
              children: [
                Icon(Icons.picture_as_pdf_rounded, color: LearnHubTheme.onHero, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    "Lesson PDF",
                    overflow: TextOverflow.ellipsis,
                    style: LhText.body(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                      color: LearnHubTheme.onHero,
                    ),
                  ),
                ),
                ValueListenableBuilder<int>(
                  valueListenable: c.pageListenable,
                  builder: (context, page, _) {
                    final total = c.pagesCount;
                    final suffix = total != null ? "$page / $total" : "$page";
                    return Text(
                      suffix,
                      style: LhText.body(
                        fontSize: 12,
                        color: LearnHubTheme.onHero.withValues(alpha: 0.92),
                      ),
                    );
                  },
                ),
                IconButton(
                  tooltip: "Open externally",
                  padding: const EdgeInsets.all(8),
                  constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
                  onPressed: _tempPdfPath == null ? null : () => OpenFile.open(_tempPdfPath!),
                  icon: Icon(Icons.open_in_new_rounded, color: LearnHubTheme.onHero, size: 22),
                ),
              ],
            ),
          ),
        ),
        Expanded(
          child: PdfView(
            controller: c,
            scrollDirection: Axis.vertical,
            pageSnapping: true,
            physics: const ClampingScrollPhysics(),
            backgroundDecoration: BoxDecoration(color: LearnHubTheme.gray50),
            onDocumentError: (err) {
              if (mounted) {
                setState(() => _error = err.toString());
              }
            },
          ),
        ),
      ],
    );
  }
}

class _ChewieNetwork extends StatefulWidget {
  const _ChewieNetwork({
    required this.uri,
    required this.initialSeconds,
    required this.onVideoProgress,
    required this.onSeekReady,
  });

  final String uri;
  final double initialSeconds;
  final void Function(double position, double duration) onVideoProgress;
  final void Function(void Function(double) seek) onSeekReady;

  @override
  State<_ChewieNetwork> createState() => _ChewieNetworkState();
}

class _ChewieNetworkState extends State<_ChewieNetwork> {
  VideoPlayerController? _video;
  ChewieController? _chewie;
  String? _error;
  VoidCallback? _listener;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      final c = VideoPlayerController.networkUrl(Uri.parse(widget.uri));
      await c.initialize();
      if (!mounted) return;
      _video = c;
      if (widget.initialSeconds > 1) {
        await c.seekTo(Duration(milliseconds: (widget.initialSeconds * 1000).round()));
      }
      final ar = c.value.aspectRatio > 0 ? c.value.aspectRatio : 16 / 9;
      // Chewie material controls: play/pause, scrubber, fullscreen, mute, overflow menu
      // (quality/speed when the source supports them), buffer bar, themed colors.
      _chewie = ChewieController(
        videoPlayerController: c,
        autoPlay: false,
        looping: false,
        aspectRatio: ar,
        allowFullScreen: true,
        allowMuting: true,
        showControls: true,
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
              Icon(Icons.error_outline_rounded, size: 44, color: LearnHubTheme.amber500),
              const SizedBox(height: 10),
              Text(
                "Video could not be loaded",
                style: LhText.body(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      );
      widget.onSeekReady((sec) {
        final v = _video;
        if (v == null) return;
        v.seekTo(Duration(milliseconds: (sec * 1000).round()));
        v.play();
      });
      _listener = () {
        final v = _video!;
        if (!v.value.isInitialized) return;
        widget.onVideoProgress(
          v.value.position.inMilliseconds / 1000.0,
          v.value.duration.inMilliseconds / 1000.0,
        );
      };
      c.addListener(_listener!);
      setState(() {});
    } catch (e) {
      setState(() => _error = e.toString());
    }
  }

  @override
  void dispose() {
    if (_listener != null) _video?.removeListener(_listener!);
    _chewie?.dispose();
    _video?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null) {
      return Container(
        color: LearnHubTheme.gray900,
        padding: const EdgeInsets.all(16),
        alignment: Alignment.center,
        child: Text(_error!, style: LhText.body(color: Colors.white70, fontSize: 13), textAlign: TextAlign.center),
      );
    }
    if (_chewie == null || _video == null) {
      return Container(
        color: Colors.black,
        alignment: Alignment.center,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(color: Color(0xFFF59E0B)),
            const SizedBox(height: 14),
            Text("Loading video…", style: LhText.body(color: Colors.white70, fontSize: 13)),
          ],
        ),
      );
    }
    return RepaintBoundary(
      child: ColoredBox(color: Colors.black, child: Chewie(controller: _chewie!)),
    );
  }
}

/// Lesson title on the top-left of the video / PDF player (course title stays in the app bar).
class _LearnPlayerLessonLabel extends StatelessWidget {
  const _LearnPlayerLessonLabel({required this.text, this.compact = false});

  final String text;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Material(
        color: Colors.transparent,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(6),
          ),
          child: Text(
            text,
            maxLines: compact ? 2 : 3,
            overflow: TextOverflow.ellipsis,
            style: LhText.body(
              fontWeight: FontWeight.w700,
              fontSize: compact ? 12 : 13,
              color: Colors.white,
              height: 1.25,
            ),
          ),
        ),
      ),
    );
  }
}

class _EmbedWebView extends StatefulWidget {
  const _EmbedWebView({required this.url});

  final String url;

  @override
  State<_EmbedWebView> createState() => _EmbedWebViewState();
}

class _EmbedWebViewState extends State<_EmbedWebView> {
  late final WebViewController _controller = WebViewController()
    ..setJavaScriptMode(JavaScriptMode.unrestricted)
    ..setBackgroundColor(Colors.black)
    ..loadRequest(Uri.parse(widget.url));

  @override
  Widget build(BuildContext context) {
    return WebViewWidget(controller: _controller);
  }
}
