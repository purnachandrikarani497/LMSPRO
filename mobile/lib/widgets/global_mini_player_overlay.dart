import "package:chewie/chewie.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../providers/course_mini_player_service.dart";
import "../theme/lh_text.dart";

/// Udemy / YouTube–style floating video: bottom-right, above system inset, over any route.
class GlobalMiniPlayerOverlay extends StatelessWidget {
  const GlobalMiniPlayerOverlay({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<CourseMiniPlayerService>(
      builder: (context, svc, _) {
        if (!svc.isMiniMode || !svc.hasVideo || svc.chewie == null) {
          return const SizedBox.shrink();
        }
        final mq = MediaQuery.of(context);
        final maxW = mq.size.width * 0.44;
        final width = maxW.clamp(168.0, 280.0);
        final height = width / (16 / 9) + 36;

        return Positioned(
          right: 10,
          bottom: mq.padding.bottom + 10,
          width: width,
          height: height,
          child: Material(
            elevation: 20,
            borderRadius: BorderRadius.circular(12),
            clipBehavior: Clip.antiAlias,
            color: Colors.black,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Material(
                  color: Colors.black.withValues(alpha: 0.92),
                  child: SizedBox(
                    height: 36,
                    child: Row(
                      children: [
                        const SizedBox(width: 8),
                        Icon(Icons.play_circle_filled_rounded,
                            size: 18,
                            color: Colors.white.withValues(alpha: 0.9)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            "Now playing",
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: LhText.body(
                                color: Colors.white70,
                                fontSize: 12,
                                fontWeight: FontWeight.w600),
                          ),
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: "Open lesson",
                          icon: Icon(Icons.open_in_full_rounded,
                              size: 20,
                              color: Colors.white.withValues(alpha: 0.9)),
                          onPressed: () {
                            final id = svc.activeCourseId;
                            final lid = svc.activeLessonId;
                            svc.exitMiniMode();
                            if (id != null && context.mounted) {
                              final q = (lid != null && lid.isNotEmpty)
                                  ? "?lesson=$lid"
                                  : "";
                              context.go("/course/$id/learn$q");
                            }
                          },
                        ),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          tooltip: "Close",
                          icon: Icon(Icons.close_rounded,
                              size: 22,
                              color: Colors.white.withValues(alpha: 0.9)),
                          onPressed: () => svc.closeMiniPlayer(),
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: ClipRRect(
                    borderRadius: const BorderRadius.only(
                      bottomLeft: Radius.circular(12),
                      bottomRight: Radius.circular(12),
                    ),
                    child: Chewie(controller: svc.chewie!),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
