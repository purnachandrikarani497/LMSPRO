import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "learnhub_logo.dart";

/// Side menu aligned with web `MainLayout` / `Navbar` (Home, Courses, My Learning / Admin links).
class LearnHubDrawer extends StatelessWidget {
  const LearnHubDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final user = app.user;
    final isAdmin = user?.role == "admin";

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const LearnHubLogoRow(markSize: 40, titleSize: 18),
                  if (user != null) ...[
                    const SizedBox(height: 10),
                    Text(
                      user.email,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
                    ),
                  ],
                ],
              ),
            ),
            const Divider(height: 1),
            if (!isAdmin) ...[
              _DrawerTile(
                icon: Icons.home_outlined,
                label: "Home",
                onTap: () {
                  Navigator.pop(context);
                  context.go("/home");
                },
              ),
              _DrawerTile(
                icon: Icons.menu_book_outlined,
                label: "Courses",
                onTap: () {
                  Navigator.pop(context);
                  context.go("/courses");
                },
              ),
              _DrawerTile(
                icon: Icons.school_outlined,
                label: "My Learning",
                onTap: () {
                  Navigator.pop(context);
                  context.push("/my-learning");
                },
              ),
              _DrawerTile(
                icon: Icons.person_outline_rounded,
                label: "Profile",
                onTap: () {
                  Navigator.pop(context);
                  context.push("/profile");
                },
              ),
              _DrawerTile(
                icon: Icons.receipt_long_outlined,
                label: "My orders",
                onTap: () {
                  Navigator.pop(context);
                  context.push("/my-orders");
                },
              ),
            ] else ...[
              _DrawerTile(
                icon: Icons.dashboard_outlined,
                label: "Dashboard",
                onTap: () {
                  Navigator.pop(context);
                  context.go("/admin");
                },
              ),
              _DrawerTile(
                icon: Icons.people_outline,
                label: "Users & activity",
                onTap: () {
                  Navigator.pop(context);
                  context.push("/admin/users");
                },
              ),
              _DrawerTile(
                icon: Icons.settings_outlined,
                label: "Settings",
                onTap: () {
                  Navigator.pop(context);
                  context.push("/admin/settings");
                },
              ),
              _DrawerTile(
                icon: Icons.storefront_outlined,
                label: "Course catalog",
                onTap: () {
                  Navigator.pop(context);
                  context.go("/courses");
                },
              ),
            ],
            const Spacer(),
            const Divider(height: 1),
            _DrawerTile(
              icon: Icons.dns_outlined,
              label: "API server",
              onTap: () {
                Navigator.pop(context);
                context.push("/setup-api");
              },
            ),
            if (user != null)
              ListTile(
                leading: Icon(Icons.logout_rounded, color: LearnHubTheme.mutedForeground, size: 22),
                title: Text("Sign out", style: LhText.body(fontWeight: FontWeight.w600, fontSize: 15)),
                onTap: () async {
                  Navigator.pop(context);
                  await app.auth.logout();
                  app.setUser(null);
                  if (context.mounted) context.go("/login");
                },
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            SizedBox(height: 8 + MediaQuery.paddingOf(context).bottom),
          ],
        ),
      ),
    );
  }
}

class _DrawerTile extends StatelessWidget {
  const _DrawerTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = LearnHubTheme.foreground;
    return ListTile(
      leading: Icon(icon, color: color, size: 22),
      title: Text(
        label,
        style: LhText.body(fontWeight: FontWeight.w600, fontSize: 15, color: color),
      ),
      onTap: onTap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
    );
  }
}
