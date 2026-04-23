import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";

/// Replaces the old logout icon in app bars: tap → profile.
class ProfileMenuButton extends StatelessWidget {
  const ProfileMenuButton({super.key});

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final name = app.user?.name ?? "?";
    final initial = name.trim().isNotEmpty ? name.trim()[0].toUpperCase() : "?";

    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: () => context.push("/profile"),
          customBorder: const CircleBorder(),
          child: Ink(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(color: LearnHubTheme.border, width: 1.5),
              color: LearnHubTheme.gray100,
            ),
            child: SizedBox(
              width: 40,
              height: 40,
              child: Center(
                child: Text(
                  initial,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: LearnHubTheme.navy,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
