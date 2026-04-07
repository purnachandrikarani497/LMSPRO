import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:google_sign_in/google_sign_in.dart";
import "package:provider/provider.dart";

import "app_router.dart";
import "config/api_config.dart";
import "providers/app_state.dart";
import "theme/learnhub_theme.dart";

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiConfig.initialize();
  await GoogleSignIn.instance.initialize(
    serverClientId: ApiConfig.googleWebClientId.isNotEmpty ? ApiConfig.googleWebClientId : null,
  );
  runApp(const LmsProApp());
}

class LmsProApp extends StatefulWidget {
  const LmsProApp({super.key});

  @override
  State<LmsProApp> createState() => _LmsProAppState();
}

class _LmsProAppState extends State<LmsProApp> {
  /// Single router instance for the app lifetime (do not recreate on rebuild).
  late final GoRouter _router = createAppRouter();

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState(),
      child: MaterialApp.router(
        title: "LearnHub LMS",
        debugShowCheckedModeBanner: false,
        theme: LearnHubTheme.light(),
        routerConfig: _router,
      ),
    );
  }
}
