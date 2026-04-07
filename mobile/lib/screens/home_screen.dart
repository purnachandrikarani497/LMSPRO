import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../config/api_config.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../widgets/course_card.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";
import "../widgets/profile_menu_button.dart";

/// Student home — aligned with web `Index.tsx` (hero, category grid, featured, why us, CTA).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Future<({List<Map<String, dynamic>> courses, List<Map<String, dynamic>> categories})>? _future;
  bool _started = false;

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
    app.refreshEnrollments();
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

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final isAdmin = app.user?.role == "admin";
    final w = MediaQuery.sizeOf(context).width;
    final catCross = w >= 600 ? 3 : 2;

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
              child: Text("Admin", style: LhText.body(fontWeight: FontWeight.w600, color: LearnHubTheme.navy)),
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
                  return Center(child: Text("Could not load: ${snap.error}", style: LhText.body(color: LearnHubTheme.gray700)));
                }
                final data = snap.data!;
                final courses = data.courses;
                final apiCats = data.categories;
                final totalCourses = courses.length;
                int totalStudents = 0;
                for (final c in courses) {
                  final s = c["students"];
                  if (s is num) totalStudents += s.toInt();
                }
                final categoryCounts = <String, int>{};
                for (final c in courses) {
                  final name = (c["category"]?.toString().trim().isNotEmpty == true)
                      ? c["category"].toString().trim()
                      : "General";
                  categoryCounts[name] = (categoryCounts[name] ?? 0) + 1;
                }

                final dynamicCategories = <({String name, String icon, int count})>[];
                if (apiCats.isNotEmpty) {
                  for (final e in apiCats) {
                    final n = (e["name"] ?? "").toString();
                    if (n.isEmpty) continue;
                    dynamicCategories.add((
                      name: n,
                      icon: (e["icon"] ?? "📚").toString(),
                      count: categoryCounts[n] ?? 0,
                    ));
                  }
                } else {
                  for (final e in categoryCounts.entries) {
                    dynamicCategories.add((name: e.key, icon: "📚", count: e.value));
                  }
                }

                final featured = courses.take(3).toList();

                return RefreshIndicator(
                  color: LearnHubTheme.amber500,
                  onRefresh: () => app.refreshEnrollments(),
                  child: CustomScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    slivers: [
                      SliverToBoxAdapter(child: _HeroBlock(totalCourses: totalCourses, totalStudents: totalStudents)),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                        sliver: SliverToBoxAdapter(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                "Explore Categories",
                                textAlign: TextAlign.center,
                                style: LhText.display(fontSize: 22, fontWeight: FontWeight.w800, color: LearnHubTheme.foreground),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                "Find the perfect course for your learning journey",
                                textAlign: TextAlign.center,
                                style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
                              ),
                              const SizedBox(height: 16),
                              GridView.count(
                                crossAxisCount: catCross,
                                shrinkWrap: true,
                                physics: const NeverScrollableScrollPhysics(),
                                mainAxisSpacing: 10,
                                crossAxisSpacing: 10,
                                childAspectRatio: 0.95,
                                children: [
                                  _CategoryTile(
                                    icon: "📚",
                                    label: "All Courses",
                                    count: totalCourses,
                                    onTap: () => context.push("/courses"),
                                  ),
                                  ...dynamicCategories.map(
                                    (c) => _CategoryTile(
                                      icon: c.icon,
                                      label: c.name,
                                      count: c.count,
                                      onTap: () => context.push("/courses?category=${Uri.encodeComponent(c.name)}"),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      SliverToBoxAdapter(
                        child: Container(
                          color: LearnHubTheme.gray100.withValues(alpha: 0.65),
                          padding: const EdgeInsets.fromLTRB(16, 24, 16, 28),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          "Featured Courses",
                                          style: LhText.display(fontSize: 22, fontWeight: FontWeight.w800, color: LearnHubTheme.foreground),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          "Hand-picked from your latest published courses",
                                          style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
                                        ),
                                      ],
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: () => context.push("/courses"),
                                    child: Text("View all", style: LhText.body(fontWeight: FontWeight.w700, color: LearnHubTheme.navy)),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (featured.isEmpty)
                                Text("No courses yet.", style: LhText.body(color: LearnHubTheme.mutedForeground))
                              else
                                LayoutBuilder(
                                  builder: (context, c) {
                                    final cw = c.maxWidth;
                                    final cols = cw >= 900 ? 3 : (cw >= 520 ? 2 : 1);
                                    return GridView.builder(
                                      shrinkWrap: true,
                                      physics: const NeverScrollableScrollPhysics(),
                                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                                        crossAxisCount: cols,
                                        mainAxisSpacing: 12,
                                        crossAxisSpacing: 12,
                                        childAspectRatio: 0.78,
                                      ),
                                      itemCount: featured.length,
                                      itemBuilder: (context, i) {
                                        final c = featured[i];
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
                                    );
                                  },
                                ),
                            ],
                          ),
                        ),
                      ),
                      SliverPadding(
                        padding: const EdgeInsets.fromLTRB(16, 24, 16, 16),
                        sliver: SliverToBoxAdapter(child: _WhyUsGrid()),
                      ),
                      SliverToBoxAdapter(child: _CtaBlock()),
                      const SliverToBoxAdapter(child: SizedBox(height: 32)),
                    ],
                  ),
                );
              },
            ),
    );
  }
}

class _HeroBlock extends StatelessWidget {
  const _HeroBlock({required this.totalCourses, required this.totalStudents});

  final int totalCourses;
  final int totalStudents;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(gradient: LearnHubTheme.heroGradient),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 32),
          child: Column(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: LearnHubTheme.goldStart.withValues(alpha: 0.35)),
                  color: LearnHubTheme.goldStart.withValues(alpha: 0.12),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.star_rounded, size: 18, color: LearnHubTheme.goldStart),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(
                        totalStudents > 0
                            ? "Trusted by ${totalStudents.toString()}+ learners worldwide"
                            : "Trusted by learners worldwide",
                        style: LhText.body(fontSize: 13, fontWeight: FontWeight.w600, color: LearnHubTheme.goldStart),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                "Unlock Your Potential with ",
                textAlign: TextAlign.center,
                style: LhText.display(
                  fontSize: 26,
                  fontWeight: FontWeight.w800,
                  height: 1.15,
                  color: LearnHubTheme.onHero,
                ),
              ),
              ShaderMask(
                blendMode: BlendMode.srcIn,
                shaderCallback: (bounds) => LearnHubTheme.goldGradient.createShader(bounds),
                child: Text(
                  "World-Class Learning",
                  textAlign: TextAlign.center,
                  style: LhText.display(fontSize: 26, fontWeight: FontWeight.w900, height: 1.15, color: Colors.white),
                ),
              ),
              const SizedBox(height: 14),
              Text(
                totalCourses > 0
                    ? "Access $totalCourses+ expert-led courses designed to help you master new skills, advance your career, and achieve your goals."
                    : "Access expert-led courses designed to help you master new skills, advance your career, and achieve your goals.",
                textAlign: TextAlign.center,
                style: LhText.body(fontSize: 15, height: 1.45, color: LearnHubTheme.onHero.withValues(alpha: 0.75)),
              ),
              const SizedBox(height: 22),
              FilledButton.icon(
                onPressed: () => context.push("/courses"),
                style: FilledButton.styleFrom(
                  backgroundColor: LearnHubTheme.amber500,
                  foregroundColor: LearnHubTheme.navy,
                  padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 14),
                ),
                icon: const Icon(Icons.arrow_forward_rounded, size: 20),
                label: Text("Explore Courses", style: LhText.body(fontWeight: FontWeight.w800, fontSize: 15)),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => context.push("/my-orders"),
                child: Text(
                  "My orders",
                  style: LhText.body(fontWeight: FontWeight.w700, fontSize: 14, color: LearnHubTheme.onHero.withValues(alpha: 0.9)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryTile extends StatelessWidget {
  const _CategoryTile({
    required this.icon,
    required this.label,
    required this.count,
    required this.onTap,
  });

  final String icon;
  final String label;
  final int count;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: LearnHubTheme.border),
            boxShadow: [
              BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 8, offset: const Offset(0, 2)),
            ],
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(icon, style: const TextStyle(fontSize: 28)),
              const SizedBox(height: 6),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: LhText.body(fontWeight: FontWeight.w700, fontSize: 12, color: LearnHubTheme.foreground),
              ),
              const SizedBox(height: 4),
              Text(
                "$count courses",
                style: LhText.body(fontSize: 11, color: LearnHubTheme.mutedForeground),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WhyUsGrid extends StatelessWidget {
  final _items = const [
    ("Expert Instructors", "Learn from industry professionals with real-world experience"),
    ("Lifetime Access", "Access your courses forever, learn at your own pace"),
    ("Certificate of Completion", "Earn certificates to showcase your achievements"),
    ("Project-Based Learning", "Build real projects and portfolios as you learn"),
    ("Community Support", "Join a global community of learners and mentors"),
    ("Money-Back Guarantee", "30-day refund policy if you're not satisfied"),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          "Why Learn with Us?",
          textAlign: TextAlign.center,
          style: LhText.display(fontSize: 22, fontWeight: FontWeight.w800, color: LearnHubTheme.foreground),
        ),
        const SizedBox(height: 6),
        Text(
          "We provide everything you need to succeed",
          textAlign: TextAlign.center,
          style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
        ),
        const SizedBox(height: 18),
        LayoutBuilder(
          builder: (context, c) {
            final w = c.maxWidth;
            final cols = w >= 700 ? 2 : 1;
            return GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: cols,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: cols == 1 ? 3.2 : 2.8,
              ),
              itemCount: _items.length,
              itemBuilder: (context, i) {
                final it = _items[i];
                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: LearnHubTheme.border),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(Icons.check_circle_rounded, size: 20, color: LearnHubTheme.amber600),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(it.$1, style: LhText.body(fontWeight: FontWeight.w700, fontSize: 14, color: LearnHubTheme.foreground)),
                            const SizedBox(height: 4),
                            Text(it.$2, style: LhText.body(fontSize: 12, height: 1.35, color: LearnHubTheme.mutedForeground)),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }
}

class _CtaBlock extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      decoration: BoxDecoration(
        gradient: LearnHubTheme.heroGradient,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Text(
            "Start Learning Today",
            textAlign: TextAlign.center,
            style: LhText.display(fontSize: 22, fontWeight: FontWeight.w800, color: LearnHubTheme.onHero),
          ),
          const SizedBox(height: 10),
          Text(
            "Join thousands of learners who are already building their future with LearnHub.",
            textAlign: TextAlign.center,
            style: LhText.body(fontSize: 14, height: 1.4, color: LearnHubTheme.onHero.withValues(alpha: 0.72)),
          ),
          const SizedBox(height: 18),
          FilledButton(
            onPressed: () => context.push("/courses"),
            style: FilledButton.styleFrom(
              backgroundColor: LearnHubTheme.amber500,
              foregroundColor: LearnHubTheme.navy,
              padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 14),
            ),
            child: Text("Browse catalog", style: LhText.body(fontWeight: FontWeight.w800)),
          ),
        ],
      ),
    );
  }
}
