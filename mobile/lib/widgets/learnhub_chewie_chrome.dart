import "package:flutter/material.dart";

import "learnhub_material_controls.dart";

/// Chewie skin with Udemy-style bottom row and slim scrubber.
class LearnHubChewiePlayerChrome extends StatelessWidget {
  const LearnHubChewiePlayerChrome({
    super.key,
    this.onOpenNotes,
    this.onMiniPlayer,
  });

  final VoidCallback? onOpenNotes;
  final VoidCallback? onMiniPlayer;

  @override
  Widget build(BuildContext context) {
    return LearnHubMaterialControls(
      onOpenNotes: onOpenNotes,
      onMiniPlayer: onMiniPlayer,
    );
  }
}
