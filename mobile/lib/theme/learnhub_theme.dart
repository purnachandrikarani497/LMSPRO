import "package:flutter/material.dart";

import "lh_text.dart";

/// Matches `frontend/src/index.css` tokens (LearnHub LMS web app).
class LearnHubTheme {
  LearnHubTheme._();

  static Color _hsl(double h, double s, double l) =>
      HSLColor.fromAHSL(1.0, h, s, l).toColor();

  /// Navy hero / primary (same family as web `--primary` / gradient hero).
  static Color get navy => _hsl(222 / 360, 0.6, 0.18);
  static Color get navyDark => _hsl(222 / 360, 0.7, 0.10);

  /// Light text on hero (`--primary-foreground`).
  static Color get onHero => _hsl(45 / 360, 1.0, 0.96);

  /// Gold gradient (`--gradient-gold`).
  static Color get goldStart => _hsl(45 / 360, 0.93, 0.58);
  static Color get goldEnd => _hsl(35 / 360, 0.95, 0.55);

  static Color get border => _hsl(220 / 360, 0.13, 0.90);

  /// Page background (`--background`).
  static Color get background => _hsl(220 / 360, 0.20, 0.97);

  /// Web `gray-50` / course landing.
  static Color get gray50 => const Color(0xFFF9FAFB);

  static Color get gray100 => const Color(0xFFF3F4F6);
  static Color get gray200 => const Color(0xFFE5E7EB);
  static Color get gray300 => const Color(0xFFD1D5DB);
  static Color get gray400 => const Color(0xFF9CA3AF);
  static Color get gray500 => const Color(0xFF6B7280);
  static Color get gray600 => const Color(0xFF4B5563);
  static Color get gray700 => const Color(0xFF374151);
  static Color get gray900 => const Color(0xFF111827);

  static Color get amber400 => const Color(0xFFFBBF24);
  static Color get amber500 => const Color(0xFFF59E0B);
  static Color get amber600 => const Color(0xFFD97706);
  /// Web marketing / header accent (orange book logo, CTAs).
  static Color get brandOrange => amber500;

  /// Web `/auth` page — flat dark navy (no photo).
  static Color get authBackground => navyDark;

  /// Error text on light surfaces — dark amber (template) instead of pure red.
  static Color get messageWarning => const Color(0xFFC2410C);

  /// Foreground text (`--foreground`).
  static Color get foreground => _hsl(222 / 360, 0.47, 0.11);

  static Color get mutedForeground => _hsl(220 / 360, 0.09, 0.46);

  static LinearGradient get heroGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [navy, navyDark],
      );

  static LinearGradient get goldGradient => LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: [goldStart, goldEnd],
      );

  static ThemeData light() {
    final fg = _hsl(222 / 360, 0.47, 0.11);
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: ColorScheme.light(
        primary: navy,
        onPrimary: onHero,
        secondary: goldStart,
        onSecondary: navy,
        surface: Colors.white,
        onSurface: fg,
      ),
      scaffoldBackgroundColor: _hsl(220 / 360, 0.20, 0.97),
      textTheme: TextTheme(
        bodyLarge: LhText.body(fontSize: 16, color: fg),
        bodyMedium: LhText.body(color: fg),
        bodySmall: LhText.body(fontSize: 12, color: mutedForeground),
        titleMedium: LhText.body(fontWeight: FontWeight.w600, color: fg),
        headlineSmall: LhText.display(fontSize: 22, color: fg),
      ),
      primaryTextTheme: TextTheme(
        titleLarge: LhText.display(fontSize: 18, fontWeight: FontWeight.w600, color: onHero),
      ),
      appBarTheme: AppBarTheme(
        elevation: 0,
        centerTitle: false,
        backgroundColor: navy,
        foregroundColor: onHero,
        titleTextStyle: LhText.display(
          fontWeight: FontWeight.w600,
          fontSize: 18,
          color: onHero,
        ),
      ),
      tabBarTheme: TabBarThemeData(
        labelColor: navy,
        unselectedLabelColor: _hsl(220 / 360, 0.09, 0.46),
        indicatorColor: goldStart,
        dividerColor: Colors.transparent,
        labelStyle: LhText.body(fontWeight: FontWeight.w600),
        unselectedLabelStyle: LhText.body(),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: border),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: navy, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          backgroundColor: goldStart,
          foregroundColor: navy,
          textStyle: LhText.body(fontWeight: FontWeight.w600),
        ),
      ),
    );
    return base;
  }
}
