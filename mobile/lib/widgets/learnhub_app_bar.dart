import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "../theme/learnhub_theme.dart";
import "learnhub_logo.dart";

/// Sticky-style bar like `Navbar.tsx`: white, bottom border, gold icon + LearnHub.
class LearnHubAppBar extends StatelessWidget implements PreferredSizeWidget {
  const LearnHubAppBar({
    super.key,
    this.leading,
    this.leadingWidth,
    this.titleText,
    this.actions,
    this.centerTitle = false,
  });

  final Widget? leading;
  final double? leadingWidth;
  final String? titleText;
  final List<Widget>? actions;
  final bool centerTitle;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    return AppBar(
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: Colors.white.withValues(alpha: 0.96),
      surfaceTintColor: Colors.transparent,
      shadowColor: LearnHubTheme.navy.withValues(alpha: 0.08),
      shape: Border(bottom: BorderSide(color: LearnHubTheme.border.withValues(alpha: 0.6))),
      leading: leading,
      leadingWidth: leadingWidth,
      automaticallyImplyLeading: false,
      centerTitle: centerTitle,
      title: titleText != null
          ? Text(
              titleText!,
              style: LhText.display(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: LearnHubTheme.foreground,
              ),
            )
          : const LearnHubLogoRow(markSize: 36, titleSize: 20),
      actions: actions,
    );
  }
}
