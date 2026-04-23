import "package:dio/dio.dart";
import "package:file_picker/file_picker.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";

/// In-app sections & lessons (API parity with web `AdminCoursePage`).
class AdminCourseManageScreen extends StatefulWidget {
  const AdminCourseManageScreen({super.key, required this.courseId});

  final String courseId;

  @override
  State<AdminCourseManageScreen> createState() =>
      _AdminCourseManageScreenState();
}

class _AdminCourseManageScreenState extends State<AdminCourseManageScreen> {
  Map<String, dynamic>? _course;
  bool _loading = true;
  String? _error;

  static String _oid(Map m) {
    final id = m["_id"];
    if (id is Map && id["\$oid"] != null) return "${id["\$oid"]}";
    return "${id ?? m["id"] ?? ""}";
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final app = context.read<AppState>();
    if (app.user?.role != "admin") return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await app.admin.fetchCourseForAdmin(widget.courseId);
      if (mounted) setState(() => _course = data);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  int _lessonTotal(Map<String, dynamic> co) {
    final sections = co["sections"] as List<dynamic>? ?? [];
    var n = 0;
    for (final s in sections) {
      if (s is Map) n += (s["lessons"] as List<dynamic>? ?? []).length;
    }
    final flat = co["lessons"] as List<dynamic>? ?? [];
    if (sections.isEmpty) return flat.length;
    return n;
  }

  void _snack(String msg, {bool err = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: LhText.body()),
        backgroundColor: err ? const Color(0xFFDC2626) : null,
      ),
    );
  }

  Future<String?> _promptText(
      {required String title, String hint = "", String initial = ""}) async {
    final c = TextEditingController(text: initial);
    final r = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title, style: LhText.display(fontWeight: FontWeight.w700)),
        content: TextField(
            controller: c,
            decoration: InputDecoration(hintText: hint),
            autofocus: true),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx), child: const Text("Cancel")),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, c.text.trim()),
              child: const Text("OK")),
        ],
      ),
    );
    c.dispose();
    return r;
  }

  Future<void> _addSection() async {
    final app = context.read<AppState>();
    final title =
        await _promptText(title: "New section", hint: "Section title");
    if (title == null || title.isEmpty) return;
    try {
      await app.admin.createSection(widget.courseId, title);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _renameSection(Map section) async {
    final app = context.read<AppState>();
    final sid = _oid(section);
    final title = await _promptText(
        title: "Rename section", initial: "${section["title"] ?? ""}");
    if (title == null || title.isEmpty) return;
    try {
      await app.admin.updateSection(widget.courseId, sid, title);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _deleteSection(Map section) async {
    final app = context.read<AppState>();
    final sid = _oid(section);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Delete section?",
            style: LhText.display(fontWeight: FontWeight.w700)),
        content: Text("Remove “${section["title"]}” and all its lessons?",
            style: LhText.body()),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text("Cancel")),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Delete"),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await app.admin.deleteSection(widget.courseId, sid);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<Map<String, dynamic>?> _openLessonForm({
    String title = "",
    String lessonType = "video",
    String videoUrl = "",
    String pdfUrl = "",
    String duration = "",
  }) {
    return showDialog<Map<String, dynamic>>(
      context: context,
      builder: (ctx) => _LessonFormDialog(
        initialTitle: title,
        initialType: lessonType,
        initialVideo: videoUrl,
        initialPdf: pdfUrl,
        initialDuration: duration,
      ),
    );
  }

  Future<void> _addLessonToSection(Map section) async {
    final app = context.read<AppState>();
    final sid = _oid(section);
    final body = await _openLessonForm();
    if (body == null) return;
    try {
      await app.admin.addLessonToSection(widget.courseId, sid, body);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _addFlatLesson() async {
    final app = context.read<AppState>();
    final body = await _openLessonForm();
    if (body == null) return;
    try {
      await app.admin.addFlatLesson(widget.courseId, body);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _editLesson(Map lesson) async {
    final app = context.read<AppState>();
    final lid = _oid(lesson);
    final body = await _openLessonForm(
      title: "${lesson["title"] ?? ""}",
      lessonType: "${lesson["lessonType"] ?? "video"}",
      videoUrl: "${lesson["videoUrl"] ?? ""}",
      pdfUrl: "${lesson["pdfUrl"] ?? ""}",
      duration: "${lesson["duration"] ?? ""}",
    );
    if (body == null) return;
    try {
      await app.admin.updateLesson(widget.courseId, lid, body);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _deleteLesson(Map lesson) async {
    final app = context.read<AppState>();
    final lid = _oid(lesson);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Delete lesson?",
            style: LhText.display(fontWeight: FontWeight.w700)),
        content: Text("Remove “${lesson["title"]}”?", style: LhText.body()),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text("Cancel")),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Delete"),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await app.admin.deleteLesson(widget.courseId, lid);
      if (mounted) await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Widget _lessonTile(Map lesson) {
    final t = "${lesson["title"] ?? "Lesson"}";
    final typ = "${lesson["lessonType"] ?? "video"}";
    final isPdf = typ == "pdf";
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: LearnHubTheme.gray100,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPdf
                  ? Icons.picture_as_pdf_outlined
                  : Icons.play_circle_outline_rounded,
              color: LearnHubTheme.navy,
              size: 24,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t,
                  style: LhText.body(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                    color: LearnHubTheme.foreground,
                    height: 1.25,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isPdf ? "PDF lesson" : "Video lesson",
                  style: LhText.body(
                      fontSize: 12, color: LearnHubTheme.mutedForeground),
                ),
              ],
            ),
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert_rounded, color: LearnHubTheme.gray600),
            onSelected: (v) {
              if (v == "e") _editLesson(lesson);
              if (v == "d") _deleteLesson(lesson);
            },
            itemBuilder: (ctx) => [
              PopupMenuItem(
                  value: "e",
                  child: Text("Edit",
                      style: LhText.body(fontWeight: FontWeight.w600))),
              PopupMenuItem(
                value: "d",
                child: Text("Delete",
                    style: LhText.body(
                        color: LearnHubTheme.messageWarning,
                        fontWeight: FontWeight.w600)),
              ),
            ],
          ),
        ],
      ),
    );
  }

  static BoxDecoration _cardDecoration() {
    return BoxDecoration(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: LearnHubTheme.border),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.05),
          blurRadius: 20,
          offset: const Offset(0, 6),
        ),
      ],
    );
  }

  Widget _sectionBlock(Map section) {
    final title = "${section["title"] ?? "Section"}";
    final rawLess = section["lessons"] as List<dynamic>? ?? [];
    final lessons = <Map<String, dynamic>>[];
    for (final e in rawLess) {
      if (e is Map) lessons.add(Map<String, dynamic>.from(e));
    }
    final n = lessons.length;
    return Padding(
      padding: const EdgeInsets.only(bottom: 14),
      child: Material(
        color: Colors.white,
        elevation: 0,
        shadowColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: BorderSide(color: LearnHubTheme.border),
        ),
        clipBehavior: Clip.antiAlias,
        child: Theme(
          data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
          child: ExpansionTile(
            initiallyExpanded: true,
            tilePadding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
            childrenPadding: EdgeInsets.zero,
            backgroundColor: Colors.white,
            collapsedBackgroundColor: Colors.white,
            iconColor: LearnHubTheme.navy,
            collapsedIconColor: LearnHubTheme.mutedForeground,
            shape: const RoundedRectangleBorder(),
            collapsedShape: const RoundedRectangleBorder(),
            title: Text(
              title,
              style: LhText.display(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: LearnHubTheme.foreground,
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                n == 1 ? "1 lesson" : "$n lessons",
                style: LhText.body(
                    fontSize: 13, color: LearnHubTheme.mutedForeground),
              ),
            ),
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 0, 12, 8),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => _addLessonToSection(section),
                    icon: Icon(Icons.add_rounded,
                        size: 20, color: LearnHubTheme.navy),
                    label: Text(
                      "Add lesson",
                      style: LhText.body(
                          fontWeight: FontWeight.w700,
                          color: LearnHubTheme.navy),
                    ),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(color: LearnHubTheme.gray300),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                      backgroundColor: LearnHubTheme.gray50,
                    ),
                  ),
                ),
              ),
              if (lessons.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Divider(height: 1, color: LearnHubTheme.gray200),
                ),
              for (var i = 0; i < lessons.length; i++) ...[
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: _lessonTile(lessons[i]),
                ),
                if (i < lessons.length - 1)
                  Padding(
                    padding: const EdgeInsets.only(left: 62, right: 12),
                    child: Divider(height: 1, color: LearnHubTheme.gray200),
                  ),
              ],
              Padding(
                padding: const EdgeInsets.fromLTRB(4, 8, 4, 12),
                child: Divider(height: 1, color: LearnHubTheme.gray200),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 0, 8, 8),
                child: Row(
                  children: [
                    TextButton.icon(
                      onPressed: () => _renameSection(section),
                      icon: Icon(Icons.edit_outlined,
                          size: 18, color: LearnHubTheme.mutedForeground),
                      label: Text(
                        "Rename",
                        style: LhText.body(
                            fontWeight: FontWeight.w600,
                            color: LearnHubTheme.foreground),
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      onPressed: () => _deleteSection(section),
                      icon: Icon(Icons.delete_outline_rounded,
                          size: 18, color: LearnHubTheme.messageWarning),
                      label: Text(
                        "Delete section",
                        style: LhText.body(
                            fontWeight: FontWeight.w600,
                            color: LearnHubTheme.messageWarning),
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

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (app.user?.role != "admin") {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go("/admin");
      });
      return const Scaffold(
          body: Center(
              child: CircularProgressIndicator(color: Color(0xFFF59E0B))));
    }

    final co = _course;
    final padBottom = MediaQuery.paddingOf(context).bottom + 24;

    return Scaffold(
      backgroundColor: LearnHubTheme.gray50,
      appBar: AppBar(
        backgroundColor: LearnHubTheme.navy,
        foregroundColor: LearnHubTheme.onHero,
        elevation: 0,
        centerTitle: false,
        title: Text(
          co == null ? "Manage course" : "${co["title"] ?? "Course"}",
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: LhText.display(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: LearnHubTheme.onHero,
            letterSpacing: -0.2,
          ),
        ),
        actions: [
          IconButton(
            tooltip: "Refresh",
            onPressed: _loading ? null : _load,
            icon: Icon(Icons.refresh_rounded,
                color: LearnHubTheme.onHero.withValues(alpha: 0.95)),
          ),
        ],
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : _error != null
              ? Center(
                  child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_error!, style: LhText.body())))
              : co == null
                  ? const SizedBox.shrink()
                  : RefreshIndicator(
                      onRefresh: _load,
                      color: LearnHubTheme.amber500,
                      child: ListView(
                        padding: EdgeInsets.fromLTRB(18, 18, 18, padBottom),
                        children: [
                          Container(
                            padding: const EdgeInsets.all(18),
                            decoration: _cardDecoration(),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(10),
                                      decoration: BoxDecoration(
                                        color: LearnHubTheme.amber500
                                            .withValues(alpha: 0.2),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Icon(
                                        Icons.account_tree_outlined,
                                        color: LearnHubTheme.navy,
                                        size: 22,
                                      ),
                                    ),
                                    const SizedBox(width: 14),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            "Course structure",
                                            style: LhText.display(
                                              fontSize: 16,
                                              fontWeight: FontWeight.w700,
                                              color: LearnHubTheme.foreground,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            "${_lessonTotal(co)} lessons · ${(co["sections"] as List?)?.length ?? 0} sections",
                                            style: LhText.body(
                                              fontSize: 13,
                                              color:
                                                  LearnHubTheme.mutedForeground,
                                              height: 1.35,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 18),
                                FilledButton.icon(
                                  onPressed: _addSection,
                                  icon: Icon(Icons.create_new_folder_outlined,
                                      size: 20, color: LearnHubTheme.navy),
                                  label: Text(
                                    "Add section",
                                    style: LhText.body(
                                        fontWeight: FontWeight.w800,
                                        color: LearnHubTheme.navy),
                                  ),
                                  style: FilledButton.styleFrom(
                                    backgroundColor: LearnHubTheme.amber500,
                                    foregroundColor: LearnHubTheme.navy,
                                    padding: const EdgeInsets.symmetric(
                                        vertical: 14),
                                    shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(12)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),
                          ...(co["sections"] as List<dynamic>? ?? [])
                              .whereType<Map>()
                              .map((s) =>
                                  _sectionBlock(Map<String, dynamic>.from(s))),
                          if ((co["sections"] as List?)?.isEmpty != false) ...[
                            if (((co["lessons"] as List?) ?? [])
                                .isNotEmpty) ...[
                              Text(
                                "Lessons (no sections)",
                                style: LhText.display(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: LearnHubTheme.foreground,
                                ),
                              ),
                              const SizedBox(height: 10),
                              FilledButton.icon(
                                onPressed: _addFlatLesson,
                                icon: Icon(Icons.add_rounded,
                                    color: LearnHubTheme.navy),
                                label: Text("Add lesson",
                                    style: LhText.body(
                                        fontWeight: FontWeight.w800,
                                        color: LearnHubTheme.navy)),
                                style: FilledButton.styleFrom(
                                  backgroundColor: LearnHubTheme.amber500,
                                  foregroundColor: LearnHubTheme.navy,
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Container(
                                decoration: _cardDecoration(),
                                padding:
                                    const EdgeInsets.symmetric(vertical: 8),
                                child: Column(
                                  children: () {
                                    final maps = <Map<String, dynamic>>[];
                                    for (final e
                                        in co["lessons"] as List<dynamic>? ??
                                            []) {
                                      if (e is Map)
                                        maps.add(Map<String, dynamic>.from(e));
                                    }
                                    final tiles = <Widget>[];
                                    for (var i = 0; i < maps.length; i++) {
                                      tiles.add(
                                        Padding(
                                          padding: const EdgeInsets.symmetric(
                                              vertical: 4, horizontal: 8),
                                          child: _lessonTile(maps[i]),
                                        ),
                                      );
                                      if (i < maps.length - 1) {
                                        tiles.add(
                                          Padding(
                                            padding: const EdgeInsets.only(
                                                left: 62, right: 12),
                                            child: Divider(
                                                height: 1,
                                                color: LearnHubTheme.gray200),
                                          ),
                                        );
                                      }
                                    }
                                    return tiles;
                                  }(),
                                ),
                              ),
                            ] else if ((co["sections"] as List?)?.isEmpty !=
                                false)
                              Padding(
                                padding: const EdgeInsets.only(top: 8),
                                child: Text(
                                  "No sections yet. Add a section, then add lessons.",
                                  style: LhText.body(
                                    fontSize: 14,
                                    color: LearnHubTheme.mutedForeground,
                                    height: 1.4,
                                  ),
                                ),
                              ),
                          ],
                        ],
                      ),
                    ),
    );
  }
}

class _LessonFormDialog extends StatefulWidget {
  const _LessonFormDialog({
    required this.initialTitle,
    required this.initialType,
    required this.initialVideo,
    required this.initialPdf,
    required this.initialDuration,
  });

  final String initialTitle;
  final String initialType;
  final String initialVideo;
  final String initialPdf;
  final String initialDuration;

  @override
  State<_LessonFormDialog> createState() => _LessonFormDialogState();
}

class _LessonFormDialogState extends State<_LessonFormDialog> {
  late final TextEditingController _title;
  late final TextEditingController _video;
  late final TextEditingController _pdf;
  late final TextEditingController _duration;
  late String _kind;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _title = TextEditingController(text: widget.initialTitle);
    _video = TextEditingController(text: widget.initialVideo);
    _pdf = TextEditingController(text: widget.initialPdf);
    _duration = TextEditingController(text: widget.initialDuration);
    _kind = widget.initialType == "pdf" ? "pdf" : "video";
  }

  @override
  void dispose() {
    _title.dispose();
    _video.dispose();
    _pdf.dispose();
    _duration.dispose();
    super.dispose();
  }

  Future<void> _uploadPdf(AppState app) async {
    final r = await FilePicker.platform
        .pickFiles(type: FileType.custom, allowedExtensions: ["pdf"]);
    final p = r?.files.single.path;
    if (p == null) return;
    setState(() => _busy = true);
    try {
      final up = await app.admin.uploadPdf(p);
      final url = up["url"]?.toString();
      if (url != null && url.isNotEmpty) _pdf.text = url;
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text("$e", style: LhText.body()),
              backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _uploadVideo(AppState app) async {
    final r = await FilePicker.platform.pickFiles(type: FileType.video);
    final p = r?.files.single.path;
    if (p == null) return;
    setState(() => _busy = true);
    try {
      final up = await app.admin.uploadVideo(p);
      final url = up["url"]?.toString();
      if (url != null && url.isNotEmpty) _video.text = url;
    } on DioException catch (e) {
      final data = e.response?.data;
      final msg = data is Map ? data["message"]?.toString() : e.message;
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              msg ??
                  "Video upload requires S3. Paste a hosted video URL instead.",
              style: LhText.body(),
            ),
            backgroundColor: const Color(0xFFDC2626),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text("$e", style: LhText.body()),
              backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _submit() {
    final t = _title.text.trim();
    if (t.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Title required", style: LhText.body())));
      return;
    }
    final body = <String, dynamic>{"title": t, "lessonType": _kind};
    final d = _duration.text.trim();
    if (d.isNotEmpty) body["duration"] = d;
    if (_kind == "video") {
      final v = _video.text.trim();
      if (v.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content:
                Text("Video URL or upload required", style: LhText.body())));
        return;
      }
      body["videoUrl"] = v;
    } else {
      final p = _pdf.text.trim();
      if (p.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
            content: Text("PDF URL or upload required", style: LhText.body())));
        return;
      }
      body["pdfUrl"] = p;
    }
    Navigator.pop(context, body);
  }

  @override
  Widget build(BuildContext context) {
    final app = context.read<AppState>();
    return AlertDialog(
      title: Text("Lesson", style: LhText.display(fontWeight: FontWeight.w800)),
      content: SingleChildScrollView(
        child: SizedBox(
          width: 320,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _title,
                decoration: const InputDecoration(
                    labelText: "Title *", border: OutlineInputBorder()),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _kind,
                decoration: const InputDecoration(
                    labelText: "Type", border: OutlineInputBorder()),
                items: const [
                  DropdownMenuItem(value: "video", child: Text("Video")),
                  DropdownMenuItem(value: "pdf", child: Text("PDF")),
                ],
                onChanged: (v) => setState(() => _kind = v ?? "video"),
              ),
              const SizedBox(height: 10),
              if (_kind == "video") ...[
                TextField(
                  controller: _video,
                  decoration: const InputDecoration(
                    labelText: "Video URL",
                    hintText: "Paste URL or upload",
                    border: OutlineInputBorder(),
                  ),
                  maxLines: 2,
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _uploadVideo(app),
                  icon: const Icon(Icons.video_file_outlined),
                  label: const Text("Upload video file"),
                ),
              ] else ...[
                TextField(
                  controller: _pdf,
                  decoration: const InputDecoration(
                      labelText: "PDF URL", border: OutlineInputBorder()),
                  maxLines: 2,
                ),
                OutlinedButton.icon(
                  onPressed: _busy ? null : () => _uploadPdf(app),
                  icon: const Icon(Icons.picture_as_pdf_outlined),
                  label: const Text("Upload PDF"),
                ),
              ],
              TextField(
                controller: _duration,
                decoration: const InputDecoration(
                  labelText: "Duration (optional)",
                  hintText: "12:34",
                  border: OutlineInputBorder(),
                ),
              ),
              if (_busy) const LinearProgressIndicator(),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Cancel")),
        FilledButton(
            onPressed: _busy ? null : _submit, child: const Text("Save")),
      ],
    );
  }
}
