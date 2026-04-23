import "package:cached_network_image/cached_network_image.dart";
import "../theme/lh_text.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../utils/media_urls.dart";
import "../theme/learnhub_theme.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";
import "../widgets/profile_menu_button.dart";

/// Enrolled courses — mirrors web "My Learning" / dashboard entry point.
class MyLearningScreen extends StatelessWidget {
  const MyLearningScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final rows = app.enrollmentList;
    final isAdmin = app.user?.role == "admin";

    return Scaffold(
      backgroundColor: LearnHubTheme.background,
      drawer: const LearnHubDrawer(),
      appBar: LearnHubAppBar(
        titleText: "My Learning",
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => Scaffold.of(context).openDrawer(),
        ),
        actions: [
          if (isAdmin)
            TextButton(
              onPressed: () => context.push("/admin"),
              child: Text(
                "Admin",
                style: LhText.body(fontWeight: FontWeight.w600, color: LearnHubTheme.navy),
              ),
            )
          else
            const ProfileMenuButton(),
        ],
      ),
      body: rows.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.school_outlined, size: 56, color: LearnHubTheme.gray400),
                    const SizedBox(height: 16),
                    Text(
                      "No enrollments yet",
                      style: LhText.display(
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        color: LearnHubTheme.foreground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      "Browse the catalog and enroll in a course.",
                      textAlign: TextAlign.center,
                      style: LhText.body(color: LearnHubTheme.mutedForeground),
                    ),
                    const SizedBox(height: 24),
                    FilledButton(
                      onPressed: () => context.go("/courses"),
                      style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.amber500),
                      child: Text("Browse courses", style: LhText.body(fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),
            )
          : RefreshIndicator(
              color: LearnHubTheme.amber500,
              onRefresh: () => context.read<AppState>().refreshEnrollments(),
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: rows.length,
                separatorBuilder: (_, __) => const SizedBox(height: 12),
                itemBuilder: (context, i) {
                  final e = rows[i];
                  final c = e["course"];
                  final course = c is Map ? Map<String, dynamic>.from(c) : <String, dynamic>{};
                  final id = course["_id"]?.toString() ?? course["id"]?.toString() ?? "";
                  final title = course["title"]?.toString() ?? "Course";
                  final thumb = MediaUrls.courseThumbnailForUi(course["thumbnail"]);
                  return Material(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    elevation: 1,
                    shadowColor: Colors.black.withValues(alpha: 0.06),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(12),
                      onTap: id.isEmpty ? null : () => context.push("/course/$id/learn"),
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: thumb.isNotEmpty
                                  ? CachedNetworkImage(
                                      imageUrl: thumb,
                                      width: 96,
                                      height: 64,
                                      fit: BoxFit.cover,
                                      placeholder: (_, __) => Container(
                                        width: 96,
                                        height: 64,
                                        color: LearnHubTheme.gray100,
                                      ),
                                    )
                                  : Container(
                                      width: 96,
                                      height: 64,
                                      color: LearnHubTheme.gray100,
                                      child: Icon(Icons.play_circle_outline, color: LearnHubTheme.gray400),
                                    ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    title,
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                    style: LhText.body(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 16,
                                      color: LearnHubTheme.gray900,
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    "Continue learning",
                                    style: LhText.body(
                                      fontSize: 13,
                                      color: LearnHubTheme.amber600,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Icon(Icons.chevron_right_rounded, color: LearnHubTheme.gray400),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
    );
  }
}
