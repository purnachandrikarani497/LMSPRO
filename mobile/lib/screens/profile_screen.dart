import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../widgets/learnhub_app_bar.dart";

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

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

    return Scaffold(
      backgroundColor: LearnHubTheme.background,
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: LearnHubTheme.foreground),
          onPressed: () => context.canPop() ? context.pop() : context.go("/home"),
        ),
        titleText: "Profile",
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
          const SizedBox(height: 28),
          _tile(
            context,
            icon: Icons.receipt_long_outlined,
            label: "My orders",
            subtitle: "Enrollments & payments",
            onTap: () => context.push("/my-orders"),
          ),
          _tile(
            context,
            icon: Icons.school_outlined,
            label: "My learning",
            onTap: () => context.push("/my-learning"),
          ),
          _tile(
            context,
            icon: Icons.menu_book_outlined,
            label: "Browse courses",
            onTap: () => context.push("/courses"),
          ),
          _tile(
            context,
            icon: Icons.home_outlined,
            label: "Home",
            onTap: () => context.go("/home"),
          ),
          _tile(
            context,
            icon: Icons.dns_outlined,
            label: "API server",
            onTap: () => context.push("/setup-api"),
          ),
          const SizedBox(height: 16),
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

  Widget _tile(
    BuildContext context, {
    required IconData icon,
    required String label,
    String? subtitle,
    required VoidCallback onTap,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: LearnHubTheme.border),
            ),
            child: Row(
              children: [
                Icon(icon, color: LearnHubTheme.navy, size: 24),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(label, style: LhText.body(fontWeight: FontWeight.w700, fontSize: 16)),
                      if (subtitle != null) Text(subtitle, style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground)),
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
