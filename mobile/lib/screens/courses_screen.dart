import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../config/api_config.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../widgets/course_card.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";
import "../widgets/profile_menu_button.dart";

/// Matches `frontend/src/pages/Courses.tsx` (catalog + filters + grid).
class CoursesScreen extends StatefulWidget {
  const CoursesScreen({super.key});

  @override
  State<CoursesScreen> createState() => _CoursesScreenState();
}

class _CoursesScreenState extends State<CoursesScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final _search = TextEditingController();
  String _category = "all";
  String _level = "all";

  Future<({List<Map<String, dynamic>> courses, List<Map<String, dynamic>> categories})>? _future;
  bool _started = false;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    final app = context.read<AppState>();
    _future = () async {
      final courses = await app.courses.fetchCourses();
      final categories = await app.courses.fetchCategories();
      return (courses: courses, categories: categories);
    }();
  }

  void _syncCategoryFromRoute(BuildContext context) {
    final routeCat = GoRouterState.of(context).uri.queryParameters["category"];
    if (routeCat == null || routeCat.isEmpty) {
      if (_category != "all") {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) setState(() => _category = "all");
        });
      }
      return;
    }
    if (routeCat != _category) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _category = routeCat);
      });
    }
  }

  void _applyCategory(String value) {
    setState(() => _category = value);
    if (value == "all") {
      context.go("/courses");
    } else {
      context.go("/courses?category=${Uri.encodeComponent(value)}");
    }
  }

  String _thumbUrl(dynamic thumb) {
    if (thumb == null) return "";
    final s = thumb.toString();
    if (s.isEmpty) return "";
    if (s.startsWith("http")) return s;
    if (s.startsWith("thumbnails/")) {
      final base = ApiConfig.baseUrl.replaceAll(RegExp(r"/api/?$"), "");
      return "$base/api/upload/thumb?key=${Uri.encodeComponent(s)}";
    }
    return s;
  }

  double _rating(Map<String, dynamic> c) {
    final r = c["rating"];
    if (r is num) return r.toDouble();
    return double.tryParse(r?.toString() ?? "") ?? 0;
  }

  int _ratingCount(Map<String, dynamic> c) {
    final r = c["ratingCount"];
    if (r is int) return r;
    return int.tryParse(r?.toString() ?? "") ?? 0;
  }

  List<Map<String, dynamic>> _applyFilters(List<Map<String, dynamic>> list) {
    final q = _search.text.trim().toLowerCase();
    return list.where((c) {
      final title = (c["title"] ?? "").toString();
      final instructor = (c["instructor"] ?? "").toString();
      final cat = (c["category"] ?? "General").toString();
      final lev = (c["level"] ?? "Beginner").toString();
      final matchSearch =
          q.isEmpty || title.toLowerCase().contains(q) || instructor.toLowerCase().contains(q);
      final matchCat = _category == "all" || cat == _category;
      final matchLevel = _level == "all" || lev == _level;
      return matchSearch && matchCat && matchLevel;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final isAdmin = app.user?.role == "admin";
    _syncCategoryFromRoute(context);

    return Scaffold(
      key: _scaffoldKey,
      drawer: const LearnHubDrawer(),
      backgroundColor: LearnHubTheme.background,
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        actions: [
          if (isAdmin)
            TextButton(
              onPressed: () => context.push("/admin"),
              child: Text(
                "Admin",
                style: LhText.body(
                  fontWeight: FontWeight.w600,
                  color: LearnHubTheme.navy,
                ),
              ),
            )
          else
            const ProfileMenuButton(),
        ],
      ),
      body: _future == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : FutureBuilder(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
                }
                if (snap.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        "Failed to load courses: ${snap.error}",
                        style: LhText.body(color: LearnHubTheme.gray700),
                      ),
                    ),
                  );
                }
                final data = snap.data!;
                final source = data.courses;
                final apiCats = data.categories;
                final categoryNames = apiCats.isNotEmpty
                    ? apiCats.map((e) => (e["name"] ?? e["_id"]).toString()).where((s) => s.isNotEmpty).toList()
                    : source.map((c) => (c["category"] ?? "General").toString().trim()).toSet().toList()..sort();

                final filtered = _applyFilters(source);
                final w = MediaQuery.sizeOf(context).width;
                final crossAxis = w >= 700 ? 2 : 1;
                final gridAspect = crossAxis >= 2 ? 1.05 : 1.16;

                return RefreshIndicator(
                  color: LearnHubTheme.amber500,
                  onRefresh: () => context.read<AppState>().refreshEnrollments(),
                  child: CustomScrollView(
                  slivers: [
                    SliverPadding(
                      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
                      sliver: SliverToBoxAdapter(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              "All Courses",
                              style: LhText.display(
                                fontSize: 28,
                                fontWeight: FontWeight.w800,
                                color: LearnHubTheme.foreground,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "Browse our full catalog of expert-led courses",
                              style: LhText.body(
                                fontSize: 15,
                                color: LearnHubTheme.mutedForeground,
                              ),
                            ),
                            const SizedBox(height: 24),
                            TextField(
                              controller: _search,
                              onChanged: (_) => setState(() {}),
                              decoration: InputDecoration(
                                hintText: "Search courses...",
                                prefixIcon: Icon(Icons.search, color: LearnHubTheme.mutedForeground),
                                filled: true,
                                fillColor: Colors.white,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide(color: LearnHubTheme.border),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(8),
                                  borderSide: BorderSide(color: LearnHubTheme.border),
                                ),
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: _FilterDropdown<String>(
                                    label: "Category",
                                    value: _category,
                                    items: <(String, String)>[
                                      ("all", "All Categories"),
                                      ...categoryNames.map((n) => (n, n)),
                                    ],
                                    onChanged: (v) => _applyCategory(v ?? "all"),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: _FilterDropdown<String>(
                                    label: "Level",
                                    value: _level,
                                    items: const [
                                      ("all", "All Levels"),
                                      ("Beginner", "Beginner"),
                                      ("Intermediate", "Intermediate"),
                                      ("Advanced", "Advanced"),
                                    ],
                                    onChanged: (v) => setState(() => _level = v ?? "all"),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              "${filtered.length} courses found",
                              style: LhText.body(
                                fontSize: 13,
                                color: LearnHubTheme.mutedForeground,
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],
                        ),
                      ),
                    ),
                    if (filtered.isEmpty)
                      SliverFillRemaining(
                        hasScrollBody: false,
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Text(
                              "No courses found. Try adjusting your filters.",
                              textAlign: TextAlign.center,
                              style: LhText.body(
                                fontSize: 15,
                                color: LearnHubTheme.mutedForeground,
                              ),
                            ),
                          ),
                        ),
                      )
                    else
                      SliverPadding(
                        padding: EdgeInsets.fromLTRB(12, 0, 12, 28 + MediaQuery.paddingOf(context).bottom),
                        sliver: SliverGrid(
                          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: crossAxis,
                            mainAxisSpacing: 12,
                            crossAxisSpacing: 12,
                            childAspectRatio: gridAspect,
                          ),
                          delegate: SliverChildBuilderDelegate(
                            (context, i) {
                              final c = filtered[i];
                              final id = (c["_id"] ?? c["id"])?.toString() ?? "";
                              return CourseCard(
                                title: c["title"]?.toString() ?? "Course",
                                instructor: c["instructor"]?.toString() ?? "",
                                category: c["category"]?.toString() ?? "General",
                                level: c["level"]?.toString() ?? "Beginner",
                                rating: _rating(c),
                                ratingCount: _ratingCount(c),
                                price: c["price"],
                                duration: c["duration"]?.toString(),
                                thumbnailUrl: _thumbUrl(c["thumbnail"]),
                                isEnrolled: app.isEnrolledInCourse(id),
                                onTap: () {
                                  if (app.isEnrolledInCourse(id)) {
                                    context.push("/course/$id/learn");
                                  } else {
                                    context.push("/course/$id");
                                  }
                                },
                              );
                            },
                            childCount: filtered.length,
                          ),
                        ),
                      ),
                  ],
                ),
                );
              },
            ),
    );
  }
}

class _FilterDropdown<T> extends StatelessWidget {
  const _FilterDropdown({
    required this.label,
    required this.value,
    required this.items,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<(T, String)> items;
  final ValueChanged<T?> onChanged;

  @override
  Widget build(BuildContext context) {
    return InputDecorator(
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          isExpanded: true,
          items: items
              .map(
                (e) => DropdownMenuItem<T>(
                  value: e.$1,
                  child: Text(e.$2, overflow: TextOverflow.ellipsis),
                ),
              )
              .toList(),
          onChanged: onChanged,
        ),
      ),
    );
  }
}
