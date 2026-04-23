import "package:flutter/material.dart";

import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";

/// LearnHub mark — orange tile + white book (matches web header / marketing).
class LearnHubLogoMark extends StatelessWidget {
  const LearnHubLogoMark({super.key, this.size = 40, this.borderRadius = 10});

  final double size;
  final double borderRadius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: LearnHubTheme.brandOrange,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: [
          BoxShadow(
            color: LearnHubTheme.brandOrange.withValues(alpha: 0.35),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Icon(Icons.menu_book_rounded, color: Colors.white, size: size * 0.52),
    );
  }
}

class LearnHubLogoRow extends StatelessWidget {
  const LearnHubLogoRow({
    super.key,
    this.markSize = 40,
    this.titleSize = 20,
    this.titleColor,
    this.compact = false,
  });

  final double markSize;
  final double titleSize;
  final Color? titleColor;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final fg = titleColor ?? LearnHubTheme.foreground;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        LearnHubLogoMark(size: markSize, borderRadius: compact ? 8 : 10),
        SizedBox(width: compact ? 8 : 10),
        Flexible(
          child: Text(
            "LearnHub",
            overflow: TextOverflow.ellipsis,
            style: LhText.display(
              fontWeight: FontWeight.w800,
              fontSize: titleSize,
              color: fg,
            ),
          ),
        ),
      ],
    );
  }
}
