import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";
import "../widgets/profile_menu_button.dart";

/// Lists the current user's enrollments (same data as web purchase history / enrollments).
class MyOrdersScreen extends StatefulWidget {
  const MyOrdersScreen({super.key});

  @override
  State<MyOrdersScreen> createState() => _MyOrdersScreenState();
}

class _MyOrdersScreenState extends State<MyOrdersScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  String _courseTitle(Map<String, dynamic> e) {
    final c = e["course"];
    if (c is Map) return c["title"]?.toString() ?? "Course";
    return "Course";
  }

  String? _courseId(Map<String, dynamic> e) {
    final c = e["course"];
    if (c is Map) return c["_id"]?.toString() ?? c["id"]?.toString();
    return c?.toString();
  }

  String? _paymentLine(Map<String, dynamic> e) {
    final pay = e["razorpayPaymentId"]?.toString();
    final ord = e["razorpayOrderId"]?.toString();
    if (pay != null && pay.isNotEmpty) return "Payment: $pay";
    if (ord != null && ord.isNotEmpty) return "Order: $ord";
    return null;
  }

  String? _dateLine(Map<String, dynamic> e) {
    final raw = e["createdAt"] ?? e["updatedAt"];
    if (raw == null) return null;
    final d = raw is String ? DateTime.tryParse(raw) : null;
    if (d == null) return null;
    final l = d.toLocal();
    return "${l.year}-${l.month.toString().padLeft(2, "0")}-${l.day.toString().padLeft(2, "0")} "
        "${l.hour.toString().padLeft(2, "0")}:${l.minute.toString().padLeft(2, "0")}";
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final list = app.enrollmentList;
    final isAdmin = app.user?.role == "admin";

    return Scaffold(
      key: _scaffoldKey,
      drawer: const LearnHubDrawer(),
      backgroundColor: LearnHubTheme.background,
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        titleText: "My orders",
        centerTitle: true,
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
      body: list.isEmpty
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.receipt_long_outlined, size: 48, color: LearnHubTheme.gray300),
                    const SizedBox(height: 16),
                    Text("No orders yet", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Text(
                      "When you enroll in a course, it will appear here.",
                      textAlign: TextAlign.center,
                      style: LhText.body(color: LearnHubTheme.mutedForeground, height: 1.4),
                    ),
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: () => context.push("/courses"),
                      style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.amber500, foregroundColor: LearnHubTheme.navy),
                      child: Text("Browse courses", style: LhText.body(fontWeight: FontWeight.w800)),
                    ),
                  ],
                ),
              ),
            )
          : ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, i) {
                final e = list[i];
                final title = _courseTitle(e);
                final cid = _courseId(e);
                final pay = _paymentLine(e);
                final when = _dateLine(e);
                return Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  child: InkWell(
                    onTap: cid == null ? null : () => context.push("/course/$cid"),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: LearnHubTheme.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(title, style: LhText.body(fontWeight: FontWeight.w800, fontSize: 16)),
                          const SizedBox(height: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: LearnHubTheme.amber500.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              "Enrolled",
                              style: LhText.body(fontSize: 11, fontWeight: FontWeight.w700, color: LearnHubTheme.navy),
                            ),
                          ),
                          if (when != null) ...[
                            const SizedBox(height: 8),
                            Text(when, style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground)),
                          ],
                          if (pay != null) ...[
                            const SizedBox(height: 4),
                            Text(pay, style: LhText.body(fontSize: 12, color: LearnHubTheme.gray600)),
                          ],
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
    );
  }
}
