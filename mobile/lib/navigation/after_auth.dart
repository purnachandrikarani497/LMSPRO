import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../providers/app_state.dart";

/// Student → courses catalog; admin → in-app dashboard (same roles as web).
Future<void> goHomeAfterAuth(BuildContext context, AppState app) async {
  await app.refreshEnrollments();
  if (!context.mounted) return;
  final role = app.user?.role ?? "student";
  if (role == "admin") {
    context.go("/admin");
  } else {
    context.go("/home");
  }
}
