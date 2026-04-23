import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";

/// Parity with web `AdminSettings.tsx`: read-only integration status + category CRUD.
class AdminSettingsScreen extends StatefulWidget {
  const AdminSettingsScreen({super.key});

  @override
  State<AdminSettingsScreen> createState() => _AdminSettingsScreenState();
}

class _AdminSettingsScreenState extends State<AdminSettingsScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Map<String, dynamic>? _settings;
  List<Map<String, dynamic>> _categories = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  static String _catId(Map<String, dynamic> m) {
    final id = m["_id"];
    if (id is Map && id["\$oid"] != null) return "${id["\$oid"]}";
    return "${id ?? ""}";
  }

  Future<void> _load() async {
    final app = context.read<AppState>();
    if (app.user?.role != "admin") return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final s = await app.admin.fetchSettings();
      final cats = await app.courses.fetchCategories();
      if (!mounted) return;
      setState(() {
        _settings = s;
        _categories = cats;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  void _snack(String msg, {bool err = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: LhText.body()),
        backgroundColor: err ? LearnHubTheme.messageWarning : null,
      ),
    );
  }

  Future<void> _seed() async {
    final app = context.read<AppState>();
    try {
      final res = await app.admin.seedCategoriesDefaults();
      final n = (res["created"] is List) ? (res["created"] as List).length : 0;
      if (mounted) _snack(n > 0 ? "Added $n default categories." : "Defaults already present.");
      await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _openCategoryDialog({Map<String, dynamic>? existing}) async {
    final app = context.read<AppState>();
    final nameCtl = TextEditingController(text: existing == null ? "" : "${existing["name"] ?? ""}");
    final iconCtl = TextEditingController(text: existing == null ? "" : "${existing["icon"] ?? ""}");
    bool? ok;
    String name = "";
    String icon = "";
    try {
      ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text(
            existing == null ? "Add category" : "Edit category",
            style: LhText.display(fontWeight: FontWeight.w800),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: nameCtl,
                  decoration: const InputDecoration(
                    labelText: "Name *",
                    hintText: "e.g. Development",
                    border: OutlineInputBorder(),
                  ),
                  maxLength: 50,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: iconCtl,
                  decoration: const InputDecoration(
                    labelText: "Icon (optional)",
                    hintText: "Emoji or image URL",
                    border: OutlineInputBorder(),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Cancel")),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.brandOrange, foregroundColor: Colors.white),
              child: Text(existing == null ? "Create" : "Save"),
            ),
          ],
        ),
      );
      if (ok == true) {
        name = nameCtl.text.trim();
        icon = iconCtl.text.trim();
      }
    } finally {
      nameCtl.dispose();
      iconCtl.dispose();
    }
    if (ok != true) return;
    if (name.isEmpty) {
      _snack("Name required", err: true);
      return;
    }
    try {
      if (existing == null) {
        await app.admin.createCategory(name, icon: icon.isEmpty ? null : icon);
        if (mounted) _snack("Category created");
      } else {
        final id = _catId(existing);
        await app.admin.updateCategory(id, name, icon: icon);
        if (mounted) _snack("Category updated");
      }
      await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  Future<void> _confirmDelete(Map<String, dynamic> cat) async {
    final app = context.read<AppState>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text("Delete category?", style: LhText.display(fontWeight: FontWeight.w800)),
        content: Text(
          "Remove “${cat["name"]}”? Courses using it will show “General”.",
          style: LhText.body(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text("Cancel")),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: LearnHubTheme.messageWarning, foregroundColor: Colors.white),
            child: const Text("Delete"),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await app.admin.deleteCategory(_catId(cat));
      if (mounted) _snack("Category deleted");
      await _load();
    } catch (e) {
      if (mounted) _snack("$e", err: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (app.user?.role != "admin") {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go("/admin");
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))));
    }

    final padBottom = MediaQuery.paddingOf(context).bottom + 24;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: LearnHubTheme.background,
      drawer: const LearnHubDrawer(),
      appBar: LearnHubAppBar(
        leading: IconButton(
          icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
          onPressed: () => _scaffoldKey.currentState?.openDrawer(),
        ),
        titleText: "Settings",
        actions: [
          IconButton(
            tooltip: "Refresh",
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(_error!, style: LhText.body(color: LearnHubTheme.messageWarning)),
                  ),
                )
              : RefreshIndicator(
                  color: LearnHubTheme.brandOrange,
                  onRefresh: _load,
                  child: ListView(
                    padding: EdgeInsets.fromLTRB(20, 16, 20, padBottom),
                    children: [
                      Text(
                        "View and manage platform configuration.",
                        style: LhText.body(fontSize: 14, color: LearnHubTheme.mutedForeground),
                      ),
                      const SizedBox(height: 20),
                      Text("Admin account", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 10),
                      _SettingTile(
                        icon: Icons.shield_outlined,
                        label: "Admin email",
                        value: "${_settings?["adminEmail"] ?? "—"}",
                      ),
                      const SizedBox(height: 20),
                      Text("Integrations", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
                      const SizedBox(height: 10),
                      _SettingTile(
                        icon: Icons.credit_card_rounded,
                        label: "Razorpay payments",
                        statusOk: _settings?["razorpayConfigured"] == true,
                      ),
                      const SizedBox(height: 8),
                      _SettingTile(
                        icon: Icons.mail_outline_rounded,
                        label: "SMTP email",
                        statusOk: _settings?["smtpConfigured"] == true,
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Icon(Icons.folder_open_rounded, color: LearnHubTheme.amber600, size: 22),
                          const SizedBox(width: 8),
                          Text("Categories", style: LhText.display(fontSize: 18, fontWeight: FontWeight.w800)),
                        ],
                      ),
                      const SizedBox(height: 6),
                      Text(
                        "Used in course filters and on course cards.",
                        style: LhText.body(fontSize: 13, color: LearnHubTheme.mutedForeground),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          OutlinedButton(
                            onPressed: _seed,
                            child: const Text("Load default categories"),
                          ),
                          const SizedBox(width: 8),
                          FilledButton(
                            onPressed: () => _openCategoryDialog(),
                            style: FilledButton.styleFrom(
                              backgroundColor: LearnHubTheme.brandOrange,
                              foregroundColor: Colors.white,
                            ),
                            child: const Text("Add category"),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Card(
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                          side: BorderSide(color: LearnHubTheme.border),
                        ),
                        child: _categories.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.all(24),
                                child: Text(
                                  "No categories yet.",
                                  style: LhText.body(color: LearnHubTheme.mutedForeground),
                                  textAlign: TextAlign.center,
                                ),
                              )
                            : Column(
                                children: [
                                  for (var i = 0; i < _categories.length; i++) ...[
                                    if (i > 0) Divider(height: 1, color: LearnHubTheme.border),
                                    ListTile(
                                      title: Text(
                                        "${_categories[i]["name"] ?? ""}",
                                        style: LhText.body(fontWeight: FontWeight.w600),
                                      ),
                                      leading: Builder(
                                        builder: (context) {
                                          final ic = "${_categories[i]["icon"] ?? ""}".trim();
                                          return ic.isEmpty
                                              ? Icon(Icons.label_outline_rounded, color: LearnHubTheme.mutedForeground)
                                              : Text(ic, style: const TextStyle(fontSize: 22));
                                        },
                                      ),
                                      trailing: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          IconButton(
                                            icon: const Icon(Icons.edit_outlined, size: 20),
                                            onPressed: () => _openCategoryDialog(existing: _categories[i]),
                                          ),
                                          IconButton(
                                            icon: Icon(Icons.delete_outline_rounded, size: 20, color: LearnHubTheme.messageWarning),
                                            onPressed: () => _confirmDelete(_categories[i]),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                      ),
                      const SizedBox(height: 20),
                      Text(
                        "To change Razorpay, SMTP, or admin email, update the backend .env and restart the server.",
                        style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground, height: 1.35),
                      ),
                    ],
                  ),
                ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  const _SettingTile({
    required this.icon,
    required this.label,
    this.value,
    this.statusOk,
  });

  final IconData icon;
  final String label;
  final String? value;
  final bool? statusOk;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: LearnHubTheme.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: LearnHubTheme.amber500.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: LearnHubTheme.amber600, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: LhText.body(fontWeight: FontWeight.w600)),
                if (value != null) Text(value!, style: LhText.body(fontSize: 13, color: LearnHubTheme.mutedForeground)),
              ],
            ),
          ),
          if (statusOk != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: statusOk!
                    ? const Color(0xFF10B981).withValues(alpha: 0.12)
                    : LearnHubTheme.gray100,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                statusOk! ? "Configured" : "Not configured",
                style: LhText.body(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: statusOk! ? const Color(0xFF047857) : LearnHubTheme.mutedForeground,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
