import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:google_sign_in/google_sign_in.dart";
import "package:provider/provider.dart";

import "app_router.dart";
import "config/api_config.dart";
import "providers/app_state.dart";
import "providers/course_mini_player_service.dart";
import "theme/learnhub_theme.dart";
import "widgets/global_mini_player_overlay.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiConfig.initialize();
  await GoogleSignIn.instance.initialize(
    serverClientId: ApiConfig.googleWebClientId.isNotEmpty
        ? ApiConfig.googleWebClientId
        : null,
  );
  final appState = AppState();
  runApp(LmsProApp(appState: appState));
}

class LmsProApp extends StatefulWidget {
  const LmsProApp({super.key, required this.appState});

  final AppState appState;

  @override
  State<LmsProApp> createState() => _LmsProAppState();
}

class _LmsProAppState extends State<LmsProApp> {
  late final GoRouter _router;
  late final CourseMiniPlayerService _miniPlayer;

  @override
  void initState() {
    super.initState();
    _miniPlayer = CourseMiniPlayerService();
    _router = createAppRouter(widget.appState);
  }

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: widget.appState),
        ChangeNotifierProvider.value(value: _miniPlayer),
      ],
      child: MaterialApp.router(
        title: "LearnHub LMS",
        debugShowCheckedModeBanner: false,
        theme: LearnHubTheme.light(),
        routerConfig: _router,
        builder: (context, child) {
          return Stack(
            clipBehavior: Clip.none,
            fit: StackFit.passthrough,
            children: [
              if (child != null) child,
              const GlobalMiniPlayerOverlay(),
            ],
          );
        },
      ),
    );
  }
}
