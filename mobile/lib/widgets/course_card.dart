import "package:cached_network_image/cached_network_image.dart";
import "../theme/lh_text.dart";
import "package:flutter/material.dart";

import "../theme/learnhub_theme.dart";
import "../utils/formatters.dart";

/// Mirrors `frontend/src/components/CourseCard.tsx` layout and styling.
class CourseCard extends StatelessWidget {
  const CourseCard({
    super.key,
    required this.title,
    required this.instructor,
    required this.category,
    required this.level,
    required this.rating,
    required this.ratingCount,
    required this.price,
    this.duration,
    required this.thumbnailUrl,
    required this.onTap,
    this.isEnrolled = false,
  });

  final String title;
  final String instructor;
  final String category;
  final String level;
  final double rating;
  final int ratingCount;
  final dynamic price;
  final String? duration;
  final String thumbnailUrl;
  final VoidCallback onTap;
  final bool isEnrolled;

  Color _levelBg() {
    switch (level) {
      case "Intermediate":
        return const Color(0xFFF59E0B).withValues(alpha: 0.95);
      case "Advanced":
        return LearnHubTheme.amber600.withValues(alpha: 0.95);
      default:
        return const Color(0xFF10B981).withValues(alpha: 0.95);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fullStars = rating.floor().clamp(0, 5);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: LearnHubTheme.gray200),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.04),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              AspectRatio(
                aspectRatio: 16 / 9,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    if (thumbnailUrl.isNotEmpty)
                      CachedNetworkImage(
                        imageUrl: thumbnailUrl,
                        fit: BoxFit.cover,
                        placeholder: (_, __) => Container(color: LearnHubTheme.gray100),
                        errorWidget: (_, __, ___) => _thumbFallback(),
                      )
                    else
                      _thumbFallback(),
                    if (isEnrolled)
                      Positioned(
                        right: 8,
                        bottom: 8,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF10B981).withValues(alpha: 0.95),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            "Enrolled",
                            style: LhText.body(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ),
                      ),
                    Positioned(
                      left: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _levelBg(),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          level.isEmpty ? "Beginner" : level,
                          style: LhText.body(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(10, 8, 10, 8),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      (category.isEmpty ? "General" : category).toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: LhText.body(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.1,
                        color: LearnHubTheme.amber600,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: LhText.body(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        height: 1.2,
                        color: LearnHubTheme.gray900,
                      ),
                    ),
                    if (instructor.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        instructor,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: LhText.body(
                          fontSize: 11,
                          color: LearnHubTheme.gray600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Text(
                          rating.toStringAsFixed(1),
                          style: LhText.body(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: LearnHubTheme.gray900,
                          ),
                        ),
                        const SizedBox(width: 6),
                        ...List.generate(5, (i) {
                          return Padding(
                            padding: const EdgeInsets.only(right: 2),
                            child: Icon(
                              Icons.star_rounded,
                              size: 16,
                              color: i < fullStars ? LearnHubTheme.amber400 : LearnHubTheme.gray200,
                            ),
                          );
                        }),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            "($ratingCount)",
                            style: LhText.body(fontSize: 12, color: LearnHubTheme.gray500),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Flexible(
                          child: Text(
                            formatPrice(price),
                            style: LhText.body(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: LearnHubTheme.gray900,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (duration != null && duration!.isNotEmpty)
                          Flexible(
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.schedule, size: 14, color: LearnHubTheme.gray500),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(
                                    duration!,
                                    style: LhText.body(fontSize: 12, color: LearnHubTheme.gray500),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _thumbFallback() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [LearnHubTheme.gray200, LearnHubTheme.gray100],
        ),
      ),
      child: Center(
        child: Icon(Icons.menu_book_rounded, size: 48, color: LearnHubTheme.gray400),
      ),
    );
  }
}
