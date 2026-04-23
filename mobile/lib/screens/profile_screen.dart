import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";

/// Account overview (web-style): identity + sign out. Navigation stays in the drawer.
class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user;
    if (user == null) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go("/login");
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))));
    }

    final initial = user.name.trim().isNotEmpty ? user.name.trim()[0].toUpperCase() : "?";
    final roleLabel = user.role == "admin" ? "Administrator" : "Student";

    return Scaffold(
      key: _scaffoldKey,
      drawer: const LearnHubDrawer(),
      backgroundColor: LearnHubTheme.background,
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
        children: [
          Center(
            child: CircleAvatar(
              radius: 48,
              backgroundColor: LearnHubTheme.navy.withValues(alpha: 0.12),
              child: Text(
                initial,
                style: LhText.display(fontSize: 36, fontWeight: FontWeight.w800, color: LearnHubTheme.navy),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(user.name, textAlign: TextAlign.center, style: LhText.display(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(user.email, textAlign: TextAlign.center, style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground)),
          if (user.phone != null && user.phone!.trim().isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              user.phone!.trim(),
              textAlign: TextAlign.center,
              style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
            ),
          ],
          const SizedBox(height: 20),
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: LearnHubTheme.amber500.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: LearnHubTheme.amber500.withValues(alpha: 0.35)),
              ),
              child: Text(
                roleLabel,
                style: LhText.body(fontWeight: FontWeight.w800, fontSize: 12, color: LearnHubTheme.navy),
              ),
            ),
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            onPressed: () async {
              await app.auth.logout();
              app.setUser(null);
              if (context.mounted) context.go("/login");
            },
            style: OutlinedButton.styleFrom(
              foregroundColor: LearnHubTheme.gray700,
              side: BorderSide(color: LearnHubTheme.border),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            icon: const Icon(Icons.logout_rounded, size: 20),
            label: Text("Sign out", style: LhText.body(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
  }
}
