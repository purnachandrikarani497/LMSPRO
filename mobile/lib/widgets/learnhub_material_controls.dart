import 'dart:async';

import 'package:chewie/src/center_play_button.dart';
import 'package:chewie/src/center_seek_button.dart';
import 'package:chewie/src/chewie_player.dart';
import 'package:chewie/src/chewie_progress_colors.dart';
import 'package:chewie/src/helpers/utils.dart';
import 'learnhub_video_progress_bar.dart';
import 'package:chewie/src/material/widgets/options_dialog.dart';
import 'package:chewie/src/material/widgets/playback_speed_dialog.dart';
import 'package:chewie/src/models/option_item.dart';
import 'package:chewie/src/models/subtitle_model.dart';
import 'package:chewie/src/notifiers/index.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:video_player/video_player.dart';

import '../theme/learnhub_theme.dart';

/// Chewie [MaterialControls] fork: slim scrubber, Notes + PiP + fullscreen along bottom row (Udemy-style).
class LearnHubMaterialControls extends StatefulWidget {
  const LearnHubMaterialControls({
    super.key,
    this.showPlayButton = true,
    this.onOpenNotes,
    this.onMiniPlayer,
  });

  final bool showPlayButton;
  final VoidCallback? onOpenNotes;
  final VoidCallback? onMiniPlayer;

  @override
  State<StatefulWidget> createState() {
    return _LearnHubMaterialControlsState();
  }
}

class _LearnHubMaterialControlsState extends State<LearnHubMaterialControls>
    with SingleTickerProviderStateMixin {
  late PlayerNotifier notifier;
  late VideoPlayerValue _latestValue;
  double? _latestVolume;
  Timer? _hideTimer;
  Timer? _initTimer;
  late var _subtitlesPosition = Duration.zero;
  bool _subtitleOn = false;
  Timer? _showAfterExpandCollapseTimer;
  bool _dragging = false;
  bool _displayTapped = false;
  Timer? _bufferingDisplayTimer;
  bool _displayBufferingIndicator = false;
  /// Some devices report position/duration sparsely; refresh time + scrubber while controls are visible.
  Timer? _positionUiTimer;

  final barHeight = 48.0 * 1.5;
  final marginSize = 5.0;

  late VideoPlayerController controller;
  ChewieController? _chewieController;

  // We know that _chewieController is set in didChangeDependencies
  ChewieController get chewieController => _chewieController!;

  @override
  void initState() {
    super.initState();
    notifier = Provider.of<PlayerNotifier>(context, listen: false);
  }

  @override
  Widget build(BuildContext context) {
    if (_latestValue.hasError) {
      return chewieController.errorBuilder?.call(
            context,
            chewieController.videoPlayerController.value.errorDescription!,
          ) ??
          const Center(child: Icon(Icons.error, color: Colors.white, size: 42));
    }

    return MouseRegion(
      onHover: (_) {
        _cancelAndRestartTimer();
      },
      child: GestureDetector(
        onTap: () => _cancelAndRestartTimer(),
        child: AbsorbPointer(
          absorbing: notifier.hideStuff,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_displayBufferingIndicator)
                _chewieController?.bufferingBuilder?.call(context) ??
                    const Center(child: CircularProgressIndicator())
              else
                _buildHitArea(),
              _buildActionBar(),
              // Must be Positioned — a loose Column in a Stack defaults to center and breaks layout.
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: <Widget>[
                    if (_subtitleOn)
                      Transform.translate(
                        offset: Offset(
                          0.0,
                          notifier.hideStuff ? barHeight * 0.8 : 0.0,
                        ),
                        child: _buildSubtitles(
                          context,
                          chewieController.subtitle!,
                        ),
                      ),
                    _buildBottomBar(context),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _dispose();
    super.dispose();
  }

  void _dispose() {
    controller.removeListener(_updateState);
    _hideTimer?.cancel();
    _initTimer?.cancel();
    _showAfterExpandCollapseTimer?.cancel();
    _positionUiTimer?.cancel();
  }

  @override
  void didChangeDependencies() {
    final oldController = _chewieController;
    _chewieController = ChewieController.of(context);
    controller = chewieController.videoPlayerController;

    if (oldController != chewieController) {
      _dispose();
      _initialize();
    }

    super.didChangeDependencies();
  }

  Widget _buildActionBar() {
    return Positioned(
      top: 0,
      right: 0,
      child: SafeArea(
        child: AnimatedOpacity(
          opacity: notifier.hideStuff ? 0.0 : 1.0,
          duration: const Duration(milliseconds: 250),
          child: Row(
            children: [
              _buildSubtitleToggle(),
              if (chewieController.showOptions) _buildOptionsButton(),
            ],
          ),
        ),
      ),
    );
  }

  List<OptionItem> _buildOptions(BuildContext context) {
    final options = <OptionItem>[
      OptionItem(
        onTap: (context) async {
          Navigator.pop(context);
          _onSpeedButtonTap();
        },
        iconData: Icons.speed,
        title:
            chewieController.optionsTranslation?.playbackSpeedButtonText ??
            'Playback speed',
      ),
    ];

    if (chewieController.additionalOptions != null &&
        chewieController.additionalOptions!(context).isNotEmpty) {
      options.addAll(chewieController.additionalOptions!(context));
    }
    return options;
  }

  Widget _buildOptionsButton() {
    return AnimatedOpacity(
      opacity: notifier.hideStuff ? 0.0 : 1.0,
      duration: const Duration(milliseconds: 250),
      child: IconButton(
        onPressed: () async {
          _hideTimer?.cancel();

          if (chewieController.optionsBuilder != null) {
            await chewieController.optionsBuilder!(
              context,
              _buildOptions(context),
            );
          } else {
            await showModalBottomSheet<OptionItem>(
              context: context,
              isScrollControlled: true,
              useRootNavigator: chewieController.useRootNavigator,
              builder: (context) => OptionsDialog(
                options: _buildOptions(context),
                cancelButtonText:
                    chewieController.optionsTranslation?.cancelButtonText,
              ),
            );
          }

          if (_latestValue.isPlaying) {
            _startHideTimer();
          }
        },
        icon: const Icon(Icons.more_vert, color: Colors.white),
      ),
    );
  }

  Widget _buildSubtitles(BuildContext context, Subtitles subtitles) {
    if (!_subtitleOn) {
      return const SizedBox();
    }
    final currentSubtitle = subtitles.getByPosition(_subtitlesPosition);
    if (currentSubtitle.isEmpty) {
      return const SizedBox();
    }

    if (chewieController.subtitleBuilder != null) {
      return chewieController.subtitleBuilder!(
        context,
        currentSubtitle.first!.text,
      );
    }

    return Padding(
      padding: EdgeInsets.all(marginSize),
      child: Container(
        padding: const EdgeInsets.all(5),
        decoration: BoxDecoration(
          color: const Color(0x96000000),
          borderRadius: BorderRadius.circular(10.0),
        ),
        child: Text(
          currentSubtitle.first!.text.toString(),
          style: const TextStyle(fontSize: 18),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  /// Udemy-style: time row, then one row [Notes | scrubber | PiP | fullscreen].
  /// Uses fixed min height so [VideoProgressBar] gets bounded constraints (required for painting).
  AnimatedOpacity _buildBottomBar(BuildContext context) {
    final iconColor = Theme.of(context).textTheme.labelLarge!.color;

    return AnimatedOpacity(
      opacity: notifier.hideStuff ? 0.0 : 1.0,
      duration: const Duration(milliseconds: 300),
      child: Padding(
        padding: EdgeInsets.only(
          left: 10,
          right: 10,
          bottom: !chewieController.isFullScreen ? 8.0 : 0,
        ),
        child: SafeArea(
          top: false,
          bottom: chewieController.isFullScreen,
          minimum: chewieController.controlsSafeAreaMinimum,
          child: ConstrainedBox(
            constraints: BoxConstraints(
              minHeight: chewieController.isFullScreen ? 48 : 44,
              maxHeight: chewieController.isFullScreen ? 72 : 56,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (chewieController.isLive)
                  Row(
                    children: [
                      const Expanded(
                        child: Text('LIVE', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
                      ),
                      if (chewieController.allowMuting) _buildMuteButton(controller),
                    ],
                  )
                else
                  // One tight row: time + mute sit directly beside the scrubber (avoids ~72px mute stretching layout).
                  SizedBox(
                    height: 40,
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        if (widget.onOpenNotes != null) _buildNotesButton(),
                        if (widget.onOpenNotes != null) const SizedBox(width: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: _buildPosition(iconColor),
                        ),
                        if (chewieController.allowMuting) ...[
                          const SizedBox(width: 6),
                          _buildMuteButton(controller),
                        ],
                        const SizedBox(width: 8),
                        Expanded(child: _buildProgressBarCore()),
                        if (widget.onMiniPlayer != null) ...[
                          const SizedBox(width: 6),
                          _buildMiniPlayerButton(),
                        ],
                        if (chewieController.allowFullScreen) ...[
                          const SizedBox(width: 2),
                          _buildExpandButton(),
                        ],
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  GestureDetector _buildMuteButton(VideoPlayerController controller) {
    return GestureDetector(
      onTap: () {
        _cancelAndRestartTimer();

        if (_latestValue.volume == 0) {
          controller.setVolume(_latestVolume ?? 0.5);
        } else {
          _latestVolume = controller.value.volume;
          controller.setVolume(0.0);
        }
      },
      child: AnimatedOpacity(
        opacity: notifier.hideStuff ? 0.0 : 1.0,
        duration: const Duration(milliseconds: 300),
        child: SizedBox(
          height: 36,
          width: 40,
          child: Icon(
            _latestValue.volume > 0 ? Icons.volume_up : Icons.volume_off,
            color: Colors.white,
            size: 22,
          ),
        ),
      ),
    );
  }

  GestureDetector _buildExpandButton() {
    return GestureDetector(
      onTap: _onExpandCollapse,
      child: AnimatedOpacity(
        opacity: notifier.hideStuff ? 0.0 : 1.0,
        duration: const Duration(milliseconds: 300),
        child: SizedBox(
          height: 36,
          width: 40,
          child: Center(
            child: Icon(
              chewieController.isFullScreen ? Icons.fullscreen_exit : Icons.fullscreen,
              color: Colors.white,
              size: 22,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHitArea() {
    final bool isFinished =
        (_latestValue.position >= _latestValue.duration) &&
        _latestValue.duration.inSeconds > 0;
    final bool showPlayButton =
        widget.showPlayButton && !_dragging && !notifier.hideStuff;

    return GestureDetector(
      onTap: () {
        if (_latestValue.isPlaying) {
          if (_chewieController?.pauseOnBackgroundTap ?? false) {
            _playPause();
            _cancelAndRestartTimer();
          } else {
            if (_displayTapped) {
              setState(() {
                notifier.hideStuff = true;
              });
            } else {
              _cancelAndRestartTimer();
            }
          }
        } else {
          _playPause();

          setState(() {
            notifier.hideStuff = true;
          });
        }
      },
      child: Container(
        alignment: Alignment.center,
        color: Colors
            .transparent, // The Gesture Detector doesn't expand to the full size of the container without this; Not sure why!
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (!isFinished && !chewieController.isLive)
              CenterSeekButton(
                iconData: Icons.replay_10,
                backgroundColor: Colors.black54,
                iconColor: Colors.white,
                show: showPlayButton,
                fadeDuration: chewieController.materialSeekButtonFadeDuration,
                iconSize: chewieController.materialSeekButtonSize,
                onPressed: _seekBackward,
              ),
            Container(
              margin: EdgeInsets.symmetric(horizontal: marginSize),
              child: CenterPlayButton(
                backgroundColor: Colors.black54,
                iconColor: Colors.white,
                isFinished: isFinished,
                isPlaying: controller.value.isPlaying,
                show: showPlayButton,
                onPressed: _playPause,
              ),
            ),
            if (!isFinished && !chewieController.isLive)
              CenterSeekButton(
                iconData: Icons.forward_10,
                backgroundColor: Colors.black54,
                iconColor: Colors.white,
                show: showPlayButton,
                fadeDuration: chewieController.materialSeekButtonFadeDuration,
                iconSize: chewieController.materialSeekButtonSize,
                onPressed: _seekForward,
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _onSpeedButtonTap() async {
    _hideTimer?.cancel();

    final chosenSpeed = await showModalBottomSheet<double>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: chewieController.useRootNavigator,
      builder: (context) => PlaybackSpeedDialog(
        speeds: chewieController.playbackSpeeds,
        selected: _latestValue.playbackSpeed,
      ),
    );

    if (chosenSpeed != null) {
      controller.setPlaybackSpeed(chosenSpeed);
    }

    if (_latestValue.isPlaying) {
      _startHideTimer();
    }
  }

  Widget _buildPosition(Color? iconColor) {
    final v = controller.value;
    final position = v.position;
    final duration = v.duration;
    final bufEnd =
        v.buffered.isEmpty ? Duration.zero : v.buffered.last.end;

    final String posLabel;
    if (!v.isInitialized) {
      posLabel = "--:--";
    } else {
      posLabel = formatDuration(position);
    }

    final String durLabel;
    if (duration.inMilliseconds > 0) {
      durLabel = formatDuration(duration);
    } else if (bufEnd.inMilliseconds > position.inMilliseconds) {
      durLabel = "~${formatDuration(bufEnd)}";
    } else if (v.isPlaying) {
      durLabel = "…";
    } else {
      durLabel = "…";
    }

    return RichText(
      text: TextSpan(
        text: "$posLabel ",
        children: <InlineSpan>[
          TextSpan(
            text: "/ $durLabel",
            style: TextStyle(
              fontSize: 14.0,
              color: Colors.white.withValues(alpha: .75),
              fontWeight: FontWeight.normal,
            ),
          ),
        ],
        style: const TextStyle(
          fontSize: 14.0,
          color: Colors.white,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildSubtitleToggle() {
    //if don't have subtitle hiden button
    if (chewieController.subtitle?.isEmpty ?? true) {
      return const SizedBox();
    }
    return GestureDetector(
      onTap: _onSubtitleTap,
      child: Container(
        height: barHeight,
        color: Colors.transparent,
        padding: const EdgeInsets.only(left: 12.0, right: 12.0),
        child: Icon(
          _subtitleOn
              ? Icons.closed_caption
              : Icons.closed_caption_off_outlined,
          color: _subtitleOn ? Colors.white : Colors.grey[700],
        ),
      ),
    );
  }

  void _onSubtitleTap() {
    setState(() {
      _subtitleOn = !_subtitleOn;
    });
  }

  void _cancelAndRestartTimer() {
    _hideTimer?.cancel();
    _startHideTimer();

    setState(() {
      notifier.hideStuff = false;
      _displayTapped = true;
    });
  }

  Future<void> _initialize() async {
    _subtitleOn =
        chewieController.showSubtitles &&
        (chewieController.subtitle?.isNotEmpty ?? false);
    controller.addListener(_updateState);

    _updateState();

    _positionUiTimer?.cancel();
    _positionUiTimer = Timer.periodic(const Duration(milliseconds: 320), (_) {
      if (!mounted) return;
      if (notifier.hideStuff) return;
      final val = controller.value;
      if (!val.isInitialized) return;
      setState(() {});
    });

    if (controller.value.isPlaying || chewieController.autoPlay) {
      _startHideTimer();
    }

    if (chewieController.showControlsOnInitialize) {
      _initTimer = Timer(const Duration(milliseconds: 200), () {
        setState(() {
          notifier.hideStuff = false;
        });
      });
    }
  }

  void _onExpandCollapse() {
    setState(() {
      notifier.hideStuff = true;

      chewieController.toggleFullScreen();
      _showAfterExpandCollapseTimer = Timer(
        const Duration(milliseconds: 300),
        () {
          setState(() {
            _cancelAndRestartTimer();
          });
        },
      );
    });
  }

  void _playPause() {
    final bool isFinished =
        (_latestValue.position >= _latestValue.duration) &&
        _latestValue.duration.inSeconds > 0;

    setState(() {
      if (controller.value.isPlaying) {
        notifier.hideStuff = false;
        _hideTimer?.cancel();
        controller.pause();
      } else {
        _cancelAndRestartTimer();

        if (!controller.value.isInitialized) {
          controller.initialize().then((_) {
            controller.play();
          });
        } else {
          if (isFinished) {
            controller.seekTo(Duration.zero);
          }
          controller.play();
        }
      }
    });
  }

  void _seekRelative(Duration relativeSeek) {
    _cancelAndRestartTimer();
    final position = _latestValue.position + relativeSeek;
    final duration = _latestValue.duration;
    final knownTotal = duration.inMilliseconds > 0;

    if (position < Duration.zero) {
      controller.seekTo(Duration.zero);
    } else if (knownTotal && position > duration) {
      controller.seekTo(duration);
    } else {
      // Duration often stays 0 until metadata/buffer is ready; still seek ahead.
      controller.seekTo(position);
    }
  }

  void _seekBackward() {
    _seekRelative(const Duration(seconds: -10));
  }

  void _seekForward() {
    _seekRelative(const Duration(seconds: 10));
  }

  void _startHideTimer() {
    final hideControlsTimer = chewieController.hideControlsTimer.isNegative
        ? ChewieController.defaultHideControlsTimer
        : chewieController.hideControlsTimer;
    _hideTimer = Timer(hideControlsTimer, () {
      setState(() {
        notifier.hideStuff = true;
      });
    });
  }

  void _bufferingTimerTimeout() {
    _displayBufferingIndicator = true;
    if (mounted) {
      setState(() {});
    }
  }

  void _updateState() {
    if (!mounted) return;

    final bool buffering = getIsBuffering(controller);

    // display the progress bar indicator only after the buffering delay if it has been set
    if (chewieController.progressIndicatorDelay != null) {
      if (buffering) {
        _bufferingDisplayTimer ??= Timer(
          chewieController.progressIndicatorDelay!,
          _bufferingTimerTimeout,
        );
      } else {
        _bufferingDisplayTimer?.cancel();
        _bufferingDisplayTimer = null;
        _displayBufferingIndicator = false;
      }
    } else {
      _displayBufferingIndicator = buffering;
    }

    setState(() {
      _latestValue = controller.value;
      _subtitlesPosition = controller.value.position;
    });
  }

  Widget _buildNotesButton() {
    return Tooltip(
      message: "Notes",
      child: GestureDetector(
        onTap: () {
          _cancelAndRestartTimer();
          widget.onOpenNotes?.call();
        },
        child: AnimatedOpacity(
          opacity: notifier.hideStuff ? 0.0 : 1.0,
          duration: const Duration(milliseconds: 300),
          child: const SizedBox(
            height: 36,
            width: 40,
            child: Center(
              child: Icon(Icons.edit_note_rounded, color: Colors.white, size: 24),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMiniPlayerButton() {
    return Tooltip(
      message: "Mini player",
      child: GestureDetector(
        onTap: () {
          _cancelAndRestartTimer();
          widget.onMiniPlayer?.call();
        },
        child: AnimatedOpacity(
          opacity: notifier.hideStuff ? 0.0 : 1.0,
          duration: const Duration(milliseconds: 300),
          child: SizedBox(
            height: 36,
            width: 40,
            child: const Center(
              child: Icon(Icons.picture_in_picture_alt_outlined, color: Colors.white, size: 22),
            ),
          ),
        ),
      ),
    );
  }

  ChewieProgressColors get _progressColors =>
      chewieController.materialProgressColors ??
      ChewieProgressColors(
        playedColor: LearnHubTheme.amber500,
        handleColor: LearnHubTheme.amber500,
        bufferedColor: Colors.white.withValues(alpha: 0.28),
        backgroundColor: Colors.white.withValues(alpha: 0.18),
      );

  Widget _buildProgressBarCore() {
    return LearnHubSafeVideoProgressBar(
      controller,
      barHeight: 3,
      handleHeight: 5,
      drawShadow: false,
      onDragStart: () {
        setState(() {
          _dragging = true;
        });

        _hideTimer?.cancel();
      },
      onDragUpdate: () {
        _hideTimer?.cancel();
      },
      onDragEnd: () {
        setState(() {
          _dragging = false;
        });

        _startHideTimer();
      },
      colors: _progressColors,
      draggableProgressBar: chewieController.draggableProgressBar,
    );
  }
}
