import "package:cached_network_image/cached_network_image.dart";
import "../theme/lh_text.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../config/api_config.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../utils/formatters.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";

/// Parity with web `AdminDashboard.tsx`: stats from courses + enrollments, searchable course table, delete.
class AdminDashboardScreen extends StatefulWidget {
  const AdminDashboardScreen({super.key});

  @override
  State<AdminDashboardScreen> createState() => _AdminDashboardScreenState();
}

class _AdminDashboardScreenState extends State<AdminDashboardScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final TextEditingController _search = TextEditingController();

  List<Map<String, dynamic>> _courses = [];
  List<Map<String, dynamic>> _enrollments = [];
  bool _loading = true;
  String? _loadError;

  String _sortBy = "course"; // course | category | students | price | rating
  bool _sortAsc = true;
  int _page = 1;
  static const int _pageSize = 8;

  static const String _fallbackThumb =
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=600&h=400&fit=crop";

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final app = context.read<AppState>();
    if (app.user?.role != "admin") return;
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final courses = await app.courses.fetchCourses();
      final enrollments = await app.admin.fetchAllEnrollments();
      if (!mounted) return;
      setState(() {
        _courses = courses;
        _enrollments = enrollments;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _loadError = e.toString();
        _loading = false;
      });
    }
  }

  int _uniqueStudents() {
    final ids = <String>{};
    for (final e in _enrollments) {
      final s = e["student"];
      if (s is Map && s["_id"] != null) {
        ids.add(s["_id"].toString());
      }
    }
    return ids.length;
  }

  String _avgRating() {
    if (_courses.isEmpty) return "0.0";
    double sum = 0;
    for (final c in _courses) {
      sum += _rating(c["rating"]);
    }
    return (sum / _courses.length).toStringAsFixed(1);
  }

  List<Map<String, dynamic>> _filteredSorted() {
    var list = List<Map<String, dynamic>>.from(_courses);
    final q = _search.text.trim().toLowerCase();
    if (q.isNotEmpty) {
      list = list.where((c) {
        return "${c["title"]}".toLowerCase().contains(q) ||
            "${c["instructor"]}".toLowerCase().contains(q) ||
            "${c["category"]}".toLowerCase().contains(q);
      }).toList();
    }
    list.sort((a, b) {
      int cmp = 0;
      switch (_sortBy) {
        case "course":
          cmp = "${a["title"]}".compareTo("${b["title"]}");
          break;
        case "category":
          cmp = "${a["category"]}".compareTo("${b["category"]}");
          break;
        case "students":
          cmp = _students(a["students"]).compareTo(_students(b["students"]));
          break;
        case "price":
          cmp = _priceNum(a["price"]).compareTo(_priceNum(b["price"]));
          break;
        case "rating":
          cmp = _rating(a["rating"]).compareTo(_rating(b["rating"]));
          break;
        default:
          cmp = 0;
      }
      return _sortAsc ? cmp : -cmp;
    });
    return list;
  }

  void _showCourseActions(Map<String, dynamic> course) {
    final id = _courseId(course);
    if (id.isEmpty) return;
    final title = "${course["title"] ?? "Course"}";
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
              child: Text(title, maxLines: 2, overflow: TextOverflow.ellipsis, style: LhText.display(fontSize: 16, fontWeight: FontWeight.w800)),
            ),
            ListTile(
              leading: Icon(Icons.settings_outlined, color: LearnHubTheme.navy),
              title: Text("Manage content", style: LhText.body(fontWeight: FontWeight.w700)),
              subtitle: Text("Sections, lessons, uploads in the app", style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground)),
              onTap: () {
                Navigator.pop(ctx);
                context.push("/admin/course/$id/manage");
              },
            ),
            ListTile(
              leading: Icon(Icons.edit_outlined, color: LearnHubTheme.navy),
              title: Text("Edit details", style: LhText.body(fontWeight: FontWeight.w700)),
              subtitle: Text("Title, price, thumbnail, category…", style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground)),
              onTap: () {
                Navigator.pop(ctx);
                context.push("/admin/course/$id/edit").then((saved) {
                  if (saved == true && mounted) _load();
                });
              },
            ),
            ListTile(
              leading: Icon(Icons.visibility_outlined, color: LearnHubTheme.mutedForeground),
              title: Text("Preview as student", style: LhText.body(fontWeight: FontWeight.w700)),
              subtitle: Text("Open the public course page", style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground)),
              onTap: () {
                Navigator.pop(ctx);
                context.push("/course/$id");
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline_rounded, color: Color(0xFFDC2626)),
              title: Text("Delete course", style: LhText.body(fontWeight: FontWeight.w700, color: const Color(0xFFDC2626))),
              onTap: () {
                Navigator.pop(ctx);
                _confirmDelete(course);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(Map<String, dynamic> course) async {
    final id = _courseId(course);
    if (id.isEmpty) return;
    final title = "${course["title"] ?? "Course"}";
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Delete course?", style: LhText.display(fontWeight: FontWeight.w700)),
        content: Text(
          "Remove “$title”? This cannot be undone.",
          style: LhText.body(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Cancel")),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: const Color(0xFFDC2626)),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("Delete"),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    try {
      await context.read<AppState>().admin.deleteCourse(id);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("Deleted “$title”", style: LhText.body())),
      );
      await _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Could not delete: $e", style: LhText.body()),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (app.user?.role != "admin") {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go("/courses");
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    final filtered = _filteredSorted();
    final totalPages = (filtered.length / _pageSize).ceil().clamp(1, 9999);
    if (_page > totalPages) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _page = totalPages);
      });
    }
    final start = (_page - 1) * _pageSize;
    final pageSlice = filtered.length <= start
        ? <Map<String, dynamic>>[]
        : filtered.sublist(start, (start + _pageSize).clamp(0, filtered.length));

    return Scaffold(
      key: _scaffoldKey,
      drawer: const LearnHubDrawer(),
      backgroundColor: LearnHubTheme.background,
      resizeToAvoidBottomInset: true,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final saved = await context.push<bool>("/admin/course/new");
          if (saved == true && context.mounted) await _load();
        },
        icon: const Icon(Icons.add_rounded),
        label: Text("Add course", style: LhText.body(fontWeight: FontWeight.w800)),
        backgroundColor: LearnHubTheme.amber500,
        foregroundColor: LearnHubTheme.navy,
      ),
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        titleText: "Admin",
        actions: [
          IconButton(
            tooltip: "Users & activity",
            icon: Icon(Icons.people_outline, color: LearnHubTheme.mutedForeground),
            onPressed: () => context.push("/admin/users"),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: LearnHubTheme.amber500,
        onRefresh: _load,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  20,
                  20,
                  20,
                  20 + MediaQuery.paddingOf(context).bottom + 88,
                ),
                children: [
                  Text(
                    "Admin Dashboard",
                    style: LhText.display(
                      fontSize: 28,
                      fontWeight: FontWeight.w800,
                      color: LearnHubTheme.foreground,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "Manage courses and performance — same metrics as the web admin.",
                    style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
                  ),
                  if (_loadError != null) ...[
                    const SizedBox(height: 12),
                    Text(
                      _loadError!,
                      style: LhText.body(color: const Color(0xFFDC2626), fontSize: 13),
                    ),
                  ],
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: _StatCard(
                          title: "Total Courses",
                          value: "${_courses.length}",
                          icon: Icons.menu_book_outlined,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: _StatCard(
                          title: "Total Students",
                          value: "${_uniqueStudents()}",
                          icon: Icons.people_outline,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  _StatCard(
                    title: "Avg Rating",
                    value: _avgRating(),
                    icon: Icons.trending_up_rounded,
                    fullWidth: true,
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => context.push("/admin/users"),
                          icon: const Icon(Icons.people_outline, size: 18),
                          label: const Text("Users & activity"),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => context.go("/courses"),
                          icon: const Icon(Icons.storefront_outlined, size: 18),
                          label: const Text("Course catalog"),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                  "Tap a course for actions. Edit details or Manage for sections & lessons.",
                  style: LhText.body(fontSize: 12, height: 1.4, color: LearnHubTheme.gray600),
                ),
                  const SizedBox(height: 20),
                  Text(
                    "Courses",
                    style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _search,
                    onChanged: (_) => setState(() {
                      _page = 1;
                    }),
                    decoration: InputDecoration(
                      hintText: "Search by course, instructor, category…",
                      prefixIcon: Icon(Icons.search_rounded, color: LearnHubTheme.mutedForeground),
                      filled: true,
                      fillColor: Colors.white,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: LearnHubTheme.border),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide(color: LearnHubTheme.border),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "Sort by",
                              style: LhText.body(
                                fontSize: 12,
                                color: LearnHubTheme.mutedForeground,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: LearnHubTheme.border),
                              ),
                              child: DropdownButtonHideUnderline(
                                child: DropdownButton<String>(
                                  isExpanded: true,
                                  value: _sortBy,
                                  items: const [
                                    DropdownMenuItem(value: "course", child: Text("Course")),
                                    DropdownMenuItem(value: "category", child: Text("Category")),
                                    DropdownMenuItem(value: "students", child: Text("Students")),
                                    DropdownMenuItem(value: "price", child: Text("Price")),
                                    DropdownMenuItem(value: "rating", child: Text("Rating")),
                                  ],
                                  onChanged: (v) {
                                    if (v == null) return;
                                    setState(() {
                                      _sortBy = v;
                                      _page = 1;
                                    });
                                  },
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        tooltip: _sortAsc ? "Ascending" : "Descending",
                        style: IconButton.styleFrom(
                          backgroundColor: LearnHubTheme.gray100,
                        ),
                        onPressed: () => setState(() => _sortAsc = !_sortAsc),
                        icon: Icon(_sortAsc ? Icons.arrow_upward_rounded : Icons.arrow_downward_rounded),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  if (pageSlice.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 24),
                      child: Text(
                        "No courses match your search.",
                        style: LhText.body(color: LearnHubTheme.mutedForeground),
                      ),
                    )
                  else
                    ...pageSlice.map(
                          (c) => _CourseAdminRow(
                            course: c,
                            thumb: _thumbUrl(c),
                            onCardTap: () => _showCourseActions(c),
                          ),
                        ),
                  if (filtered.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        IconButton(
                          onPressed: _page > 1 ? () => setState(() => _page--) : null,
                          icon: const Icon(Icons.chevron_left_rounded),
                        ),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            "Page $_page of $totalPages",
                            style: LhText.body(fontWeight: FontWeight.w600),
                          ),
                        ),
                        IconButton(
                          onPressed: _page < totalPages ? () => setState(() => _page++) : null,
                          icon: const Icon(Icons.chevron_right_rounded),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
      ),
    );
  }

  String _thumbUrl(Map<String, dynamic> c) {
    final t = c["thumbnail"]?.toString().trim();
    if (t == null || t.isEmpty) return _fallbackThumb;
    if (t.startsWith("http")) return t;
    if (t.startsWith("thumbnails/")) {
      final base = ApiConfig.baseUrl.replaceAll(RegExp(r"/api/?$"), "");
      return "$base/api/upload/thumb?key=${Uri.encodeComponent(t)}";
    }
    return t;
  }
}

String _courseId(Map<String, dynamic> c) => c["_id"]?.toString() ?? c["id"]?.toString() ?? "";

double _rating(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

int _students(dynamic v) {
  if (v == null) return 0;
  if (v is int) return v;
  if (v is num) return v.toInt();
  return int.tryParse(v.toString()) ?? 0;
}

double _priceNum(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    this.fullWidth = false,
  });

  final String title;
  final String value;
  final IconData icon;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: fullWidth ? double.infinity : null,
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: LearnHubTheme.border),
        boxShadow: [
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: LearnHubTheme.amber500.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: LearnHubTheme.amber600, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground)),
                const SizedBox(height: 4),
                Text(value, style: LhText.display(fontSize: 24, fontWeight: FontWeight.w800)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _CourseAdminRow extends StatelessWidget {
  const _CourseAdminRow({
    required this.course,
    required this.thumb,
    required this.onCardTap,
  });

  final Map<String, dynamic> course;
  final String thumb;
  final VoidCallback onCardTap;

  @override
  Widget build(BuildContext context) {
    final title = "${course["title"] ?? "—"}";
    final instructor = "${course["instructor"] ?? ""}";
    final category = "${course["category"] ?? ""}";
    final price = formatPrice(course["price"]);
    final rating = _rating(course["rating"]);
    final studs = _students(course["students"]);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: LearnHubTheme.border),
      ),
      child: InkWell(
        onTap: onCardTap,
        borderRadius: BorderRadius.circular(12),
        child: SizedBox(
          height: 108,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 8, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    width: 112,
                    height: 63,
                    child: CachedNetworkImage(
                      imageUrl: thumb,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: LearnHubTheme.gray200),
                      errorWidget: (_, __, ___) => Container(
                        color: LearnHubTheme.gray200,
                        child: Icon(Icons.image_not_supported_outlined, color: LearnHubTheme.mutedForeground),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: LhText.body(fontWeight: FontWeight.w700, fontSize: 15, height: 1.15),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        instructor,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: LhText.body(fontSize: 13, color: LearnHubTheme.mutedForeground),
                      ),
                      if (category.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: LearnHubTheme.gray100,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              category,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: LhText.body(fontSize: 11, fontWeight: FontWeight.w600),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              "$studs students",
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: LhText.body(fontSize: 12, color: LearnHubTheme.gray600),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(price, style: LhText.body(fontSize: 12, fontWeight: FontWeight.w600)),
                          const SizedBox(width: 8),
                          Text(
                            "${rating.toStringAsFixed(1)} ★",
                            style: LhText.body(fontSize: 12, color: LearnHubTheme.amber600),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded, color: LearnHubTheme.gray400),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
