import "package:cached_network_image/cached_network_image.dart";
import "package:flutter/material.dart";

import "../theme/learnhub_theme.dart";

/// Same idea as web `HeroSection.tsx`: photo + navy overlay (not flat red/maroon gradient).
class LearnHubMarketing {
  LearnHubMarketing._();

  /// Library / learners — matches marketing hero vibe when local `hero-bg.jpg` isn’t bundled.
  static const String heroPhotoUrl =
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1920&q=80";
}

/// Full-screen background: cover image + horizontal navy gradient overlay.
class LearnHubHeroBackground extends StatelessWidget {
  const LearnHubHeroBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    // `expand` inside scroll views (unbounded height) forces children to infinite height → blank hero.
    return Stack(
      fit: StackFit.loose,
      alignment: Alignment.topCenter,
      clipBehavior: Clip.hardEdge,
      children: [
        Positioned.fill(
          child: CachedNetworkImage(
            imageUrl: LearnHubMarketing.heroPhotoUrl,
            fit: BoxFit.cover,
            fadeInDuration: const Duration(milliseconds: 300),
            placeholder: (_, __) => ColoredBox(color: LearnHubTheme.navyDark),
            errorWidget: (_, __, ___) => ColoredBox(color: LearnHubTheme.navyDark),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  const Color(0xFF0F2744).withValues(alpha: 0.82),
                  LearnHubTheme.navy.withValues(alpha: 0.78),
                  LearnHubTheme.navyDark.withValues(alpha: 0.88),
                ],
              ),
            ),
          ),
        ),
        child,
      ],
    );
  }
}
