import "dart:math" as math;

import "package:chewie/chewie.dart";
import "package:flutter/material.dart";
import "package:video_player/video_player.dart";

/// Chewie [VideoProgressBar] behaviour with a safe denominator when [VideoPlayerValue.duration]
/// is still zero (common for long MP4s until metadata/buffer catches up). Avoids divide-by-zero,
/// thumb stuck at 100%, and broken scrubbing.
class LearnHubSafeVideoProgressBar extends StatefulWidget {
  LearnHubSafeVideoProgressBar(
    this.controller, {
    super.key,
    ChewieProgressColors? colors,
    this.onDragEnd,
    this.onDragStart,
    this.onDragUpdate,
    this.draggableProgressBar = true,
    required this.barHeight,
    required this.handleHeight,
    required this.drawShadow,
  }) : colors = colors ?? ChewieProgressColors();

  final VideoPlayerController controller;
  final ChewieProgressColors colors;
  final VoidCallback? onDragStart;
  final VoidCallback? onDragEnd;
  final VoidCallback? onDragUpdate;

  final double barHeight;
  final double handleHeight;
  final bool drawShadow;
  final bool draggableProgressBar;

  @override
  State<LearnHubSafeVideoProgressBar> createState() =>
      _LearnHubSafeVideoProgressBarState();
}

int _effectiveTotalMs(VideoPlayerValue value) {
  final d = value.duration.inMilliseconds;
  if (d > 0) return d;
  final bufEnd = value.buffered.isEmpty
      ? 0
      : value.buffered.last.end.inMilliseconds;
  final pos = value.position.inMilliseconds;
  return math.max(math.max(bufEnd, pos), 1);
}

class _LearnHubSafeVideoProgressBarState extends State<LearnHubSafeVideoProgressBar> {
  void listener() {
    if (!mounted) return;
    setState(() {});
  }

  bool _controllerWasPlaying = false;
  Offset? _latestDraggableOffset;

  VideoPlayerController get controller => widget.controller;

  @override
  void initState() {
    super.initState();
    controller.addListener(listener);
  }

  @override
  void deactivate() {
    controller.removeListener(listener);
    super.deactivate();
  }

  Duration _seekDurationFor(VideoPlayerValue value) {
    final d = value.duration.inMilliseconds;
    if (d > 0) return value.duration;
    return Duration(milliseconds: _effectiveTotalMs(value));
  }

  void _seekToRelativePosition(Offset globalPosition) {
    final v = controller.value;
    final total = _seekDurationFor(v);
    controller.seekTo(
      context.calcLearnHubRelativePosition(total, globalPosition),
    );
  }

  @override
  Widget build(BuildContext context) {
    final child = Center(
      child: _LearnHubStaticProgressBar(
        value: controller.value,
        colors: widget.colors,
        barHeight: widget.barHeight,
        handleHeight: widget.handleHeight,
        drawShadow: widget.drawShadow,
        latestDraggableOffset: _latestDraggableOffset,
      ),
    );

    return widget.draggableProgressBar
        ? GestureDetector(
            onHorizontalDragStart: (details) {
              if (!controller.value.isInitialized) return;
              _controllerWasPlaying = controller.value.isPlaying;
              if (_controllerWasPlaying) controller.pause();
              widget.onDragStart?.call();
            },
            onHorizontalDragUpdate: (details) {
              if (!controller.value.isInitialized) return;
              _latestDraggableOffset = details.globalPosition;
              listener();
              widget.onDragUpdate?.call();
            },
            onHorizontalDragEnd: (details) {
              if (_controllerWasPlaying) controller.play();
              if (_latestDraggableOffset != null) {
                _seekToRelativePosition(_latestDraggableOffset!);
                _latestDraggableOffset = null;
              }
              widget.onDragEnd?.call();
            },
            onTapDown: (details) {
              if (!controller.value.isInitialized) return;
              _seekToRelativePosition(details.globalPosition);
            },
            child: child,
          )
        : child;
  }
}

class _LearnHubStaticProgressBar extends StatelessWidget {
  const _LearnHubStaticProgressBar({
    required this.value,
    required this.colors,
    required this.barHeight,
    required this.handleHeight,
    required this.drawShadow,
    this.latestDraggableOffset,
  });

  final Offset? latestDraggableOffset;
  final VideoPlayerValue value;
  final ChewieProgressColors colors;

  final double barHeight;
  final double handleHeight;
  final bool drawShadow;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth.isFinite ? constraints.maxWidth : 0.0;
        final h = constraints.maxHeight.isFinite && constraints.maxHeight > 0
            ? constraints.maxHeight
            : 36.0;
        final total = _effectiveTotalMs(value);
        final dragPos = latestDraggableOffset != null
            ? context.calcLearnHubRelativePosition(
                Duration(milliseconds: total),
                latestDraggableOffset!,
              )
            : null;

        return SizedBox(
          width: w,
          height: h,
          child: CustomPaint(
            painter: _LearnHubProgressPainter(
              value: value,
              draggableValue: dragPos,
              totalMs: total,
              colors: colors,
              barHeight: barHeight,
              handleHeight: handleHeight,
              drawShadow: drawShadow,
            ),
          ),
        );
      },
    );
  }
}

class _LearnHubProgressPainter extends CustomPainter {
  _LearnHubProgressPainter({
    required this.value,
    required this.colors,
    required this.barHeight,
    required this.handleHeight,
    required this.drawShadow,
    required this.draggableValue,
    required this.totalMs,
  });

  final VideoPlayerValue value;
  final ChewieProgressColors colors;
  final double barHeight;
  final double handleHeight;
  final bool drawShadow;
  final Duration? draggableValue;
  final int totalMs;

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;

  @override
  void paint(Canvas canvas, Size size) {
    final baseOffset = size.height / 2 - barHeight / 2;

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromPoints(
          Offset(0, baseOffset),
          Offset(size.width, baseOffset + barHeight),
        ),
        const Radius.circular(4),
      ),
      colors.backgroundPaint,
    );
    if (!value.isInitialized) return;

    final denom = math.max(totalMs, 1);
    final playedMs = draggableValue != null
        ? draggableValue!.inMilliseconds
        : value.position.inMilliseconds;
    final playedPartPercent = (playedMs / denom).clamp(0.0, 1.0);
    final playedPart = playedPartPercent * size.width;

    for (final DurationRange range in value.buffered) {
      final start =
          (range.start.inMilliseconds / denom).clamp(0.0, 1.0) * size.width;
      final end =
          (range.end.inMilliseconds / denom).clamp(0.0, 1.0) * size.width;
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromPoints(
            Offset(start, baseOffset),
            Offset(end, baseOffset + barHeight),
          ),
          const Radius.circular(4),
        ),
        colors.bufferedPaint,
      );
    }

    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromPoints(
          Offset(0, baseOffset),
          Offset(playedPart, baseOffset + barHeight),
        ),
        const Radius.circular(4),
      ),
      colors.playedPaint,
    );

    if (drawShadow) {
      final shadowPath = Path()
        ..addOval(
          Rect.fromCircle(
            center: Offset(playedPart, baseOffset + barHeight / 2),
            radius: handleHeight,
          ),
        );
      canvas.drawShadow(shadowPath, Colors.black, 0.2, false);
    }

    canvas.drawCircle(
      Offset(playedPart, baseOffset + barHeight / 2),
      handleHeight,
      colors.handlePaint,
    );
  }
}

extension LearnHubRelativePosition on BuildContext {
  Duration calcLearnHubRelativePosition(
      Duration videoDuration, Offset globalPosition) {
    final box = findRenderObject()! as RenderBox;
    final tapPos = box.globalToLocal(globalPosition);
    final relative = (tapPos.dx / box.size.width).clamp(0.0, 1.0);
    return Duration(
        milliseconds:
            (videoDuration.inMilliseconds * relative).round().clamp(0, 1 << 30));
  }
}
