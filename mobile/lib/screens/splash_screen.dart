import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../navigation/after_auth.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../widgets/learnhub_logo.dart";

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _boot());
  }

  Future<void> _boot() async {
    final app = context.read<AppState>();
    final user = await app.auth.tryRestore();
    if (!mounted) return;
    if (user != null) {
      app.setUser(user);
      await goHomeAfterAuth(context, app);
    } else {
      context.go("/login");
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(gradient: LearnHubTheme.heroGradient),
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              LearnHubLogoRow(
                markSize: 56,
                titleSize: 26,
                titleColor: LearnHubTheme.onHero,
              ),
              const SizedBox(height: 8),
              Text(
                "LMS",
                style: LhText.body(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: LearnHubTheme.onHero.withValues(alpha: 0.85),
                  letterSpacing: 1.2,
                ),
              ),
              const SizedBox(height: 32),
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: LearnHubTheme.goldStart,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
