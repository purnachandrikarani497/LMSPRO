import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "../theme/learnhub_theme.dart";
import "learnhub_logo.dart";

/// Sticky-style bar like `Navbar.tsx`: white, bottom border, gold icon + LearnHub.
///
/// When [titleText] is null, shows the LearnHub brand and centers it between
/// [leading] and a trailing strip matching [leadingWidth] so the logo sits in the middle.
class LearnHubAppBar extends StatelessWidget implements PreferredSizeWidget {
  const LearnHubAppBar({
    super.key,
    this.leading,
    this.leadingWidth = 56,
    this.titleText,
    this.actions,
    this.centerTitle,
  });

  final Widget? leading;
  final double leadingWidth;
  final String? titleText;
  final List<Widget>? actions;

  /// When null and [titleText] is null, defaults to true (centered LearnHub brand).
  final bool? centerTitle;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final hasTitleText = titleText != null && titleText!.trim().isNotEmpty;
    final useCenterBrand = !hasTitleText;
    final effectiveCenter = centerTitle ?? useCenterBrand;

    final List<Widget>? balancedActions = (useCenterBrand && effectiveCenter && leading != null)
        ? [
            SizedBox(
              width: leadingWidth,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: actions ?? const <Widget>[],
              ),
            ),
          ]
        : actions;

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
      centerTitle: effectiveCenter,
      title: hasTitleText
          ? Text(
              titleText!.trim(),
              style: LhText.display(
                fontWeight: FontWeight.w700,
                fontSize: 18,
                color: LearnHubTheme.foreground,
              ),
            )
          : const LearnHubLogoRow(markSize: 36, titleSize: 20),
      actions: balancedActions,
    );
  }
}
