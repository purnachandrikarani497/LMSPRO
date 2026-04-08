import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../utils/formatters.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";

/// Parity with web `AdminUsers.tsx` — `GET /api/users` (students + enrollments + progress).
class AdminUsersScreen extends StatefulWidget {
  const AdminUsersScreen({super.key});

  @override
  State<AdminUsersScreen> createState() => _AdminUsersScreenState();
}

class _AdminUsersScreenState extends State<AdminUsersScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final TextEditingController _search = TextEditingController();
  Future<List<Map<String, dynamic>>>? _usersFuture;
  final Set<String> _expanded = {};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _reload());
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _reload() async {
    final app = context.read<AppState>();
    if (app.user?.role != "admin") return;
    final f = app.admin.fetchUsers();
    setState(() => _usersFuture = f);
    await f;
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

    return Scaffold(
      key: _scaffoldKey,
      drawer: const LearnHubDrawer(),
      backgroundColor: LearnHubTheme.background,
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        titleText: "Users & activity",
      ),
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "Track enrollments and learning activity",
                  style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: "Search by name or email…",
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
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: LearnHubTheme.amber500,
              onRefresh: _reload,
              child: FutureBuilder<List<Map<String, dynamic>>>(
                future: _usersFuture,
                builder: (context, snap) {
                  if (snap.connectionState == ConnectionState.waiting && !snap.hasData) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  if (snap.hasError) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(24),
                      children: [
                        Text(
                          "Could not load users. Check API and admin role.",
                          style: LhText.body(color: LearnHubTheme.mutedForeground),
                        ),
                      ],
                    );
                  }
                  final all = snap.data ?? [];
                  final q = _search.text.trim().toLowerCase();
                  final filtered = q.isEmpty
                      ? all
                      : all.where((u) {
                          final name = (u["name"] ?? "").toString().toLowerCase();
                          final email = (u["email"] ?? "").toString().toLowerCase();
                          return name.contains(q) || email.contains(q);
                        }).toList();

                  if (filtered.isEmpty) {
                    return ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.all(24),
                      children: [
                        Text(
                          "No users found.",
                          style: LhText.body(color: LearnHubTheme.mutedForeground),
                        ),
                      ],
                    );
                  }

                  return ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
                    itemCount: filtered.length + 1,
                    itemBuilder: (context, i) {
                      if (i == filtered.length) {
                        return Padding(
                          padding: const EdgeInsets.only(top: 12),
                          child: Text(
                            "${filtered.length} of ${all.length} users",
                            style: LhText.body(fontSize: 13, color: LearnHubTheme.mutedForeground),
                          ),
                        );
                      }
                      final user = filtered[i];
                      final id = user["_id"]?.toString() ?? "";
                      final open = _expanded.contains(id);
                      final enrollmentsCount = user["enrollmentsCount"] is int
                          ? user["enrollmentsCount"] as int
                          : int.tryParse("${user["enrollmentsCount"]}") ?? 0;
                      final progress = user["progress"];
                      final progressLen = progress is List ? progress.length : 0;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 10),
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: LearnHubTheme.border),
                        ),
                        child: Column(
                          children: [
                            InkWell(
                              onTap: () {
                                setState(() {
                                  if (open) {
                                    _expanded.remove(id);
                                  } else {
                                    _expanded.add(id);
                                  }
                                });
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(14),
                                child: Row(
                                  children: [
                                    Icon(
                                      open ? Icons.expand_less_rounded : Icons.expand_more_rounded,
                                      color: LearnHubTheme.mutedForeground,
                                    ),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            "${user["name"] ?? "—"}",
                                            style: LhText.body(
                                              fontWeight: FontWeight.w700,
                                              fontSize: 15,
                                            ),
                                          ),
                                          Text(
                                            "${user["email"] ?? ""}",
                                            style: LhText.body(
                                              fontSize: 13,
                                              color: LearnHubTheme.mutedForeground,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Text(
                                          formatShortDate(user["createdAt"]),
                                          style: LhText.body(
                                            fontSize: 12,
                                            color: LearnHubTheme.mutedForeground,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: LearnHubTheme.amber500.withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            "$enrollmentsCount courses",
                                            style: LhText.body(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: LearnHubTheme.amber600,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          "$progressLen in progress",
                                          style: LhText.body(
                                            fontSize: 12,
                                            color: LearnHubTheme.mutedForeground,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            if (open) _UserDetailPanel(user: user),
                          ],
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _UserDetailPanel extends StatelessWidget {
  const _UserDetailPanel({required this.user});

  final Map<String, dynamic> user;

  @override
  Widget build(BuildContext context) {
    final enrollments = user["enrollments"];
    final progress = user["progress"];
    final eList = enrollments is List ? enrollments : const [];
    final pList = progress is List ? progress : const [];

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      decoration: BoxDecoration(
        color: LearnHubTheme.gray50,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(12)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Divider(height: 1),
          const SizedBox(height: 12),
          Text(
            "Enrollments",
            style: LhText.body(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(height: 8),
          if (eList.isEmpty)
            Text(
              "No enrollments yet.",
              style: LhText.body(fontSize: 13, color: LearnHubTheme.mutedForeground),
            )
          else
            ...eList.map((e) {
              final m = Map<String, dynamic>.from(e as Map);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: LearnHubTheme.border),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text(
                          "${m["course"] ?? "—"}",
                          style: LhText.body(fontWeight: FontWeight.w600, fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        "${formatPrice(m["price"])} · ${formatShortDate(m["enrolledAt"])}",
                        style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
                      ),
                    ],
                  ),
                ),
              );
            }),
          const SizedBox(height: 8),
          Text(
            "Progress",
            style: LhText.body(fontWeight: FontWeight.w700, fontSize: 13),
          ),
          const SizedBox(height: 8),
          if (pList.isEmpty)
            Text(
              "No progress yet.",
              style: LhText.body(fontSize: 13, color: LearnHubTheme.mutedForeground),
            )
          else
            ...pList.map((p) {
              final m = Map<String, dynamic>.from(p as Map);
              final status = "${m["status"] ?? ""}";
              final label = status == "in_progress" ? "In Progress" : (status == "completed" ? "Completed" : status);
              return Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: LearnHubTheme.border),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          "${m["course"] ?? "—"}",
                          style: LhText.body(fontWeight: FontWeight.w600, fontSize: 13),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          "${m["lessonsCompleted"] ?? 0} lessons · $label · ${formatMonthDay(m["lastActivity"])}",
                          textAlign: TextAlign.end,
                          style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }
}
