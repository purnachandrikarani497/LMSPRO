import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

/// Matches web: `Plus Jakarta Sans` (body) and `Space Grotesk` (headings) from `frontend/src/index.css`.
abstract final class LhText {
  static TextStyle body({
    double fontSize = 14,
    FontWeight fontWeight = FontWeight.w400,
    Color? color,
    double? height,
    FontStyle? fontStyle,
    double? letterSpacing,
    TextDecoration? decoration,
    Color? decorationColor,
  }) =>
      GoogleFonts.plusJakartaSans(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        height: height,
        fontStyle: fontStyle,
        letterSpacing: letterSpacing,
        decoration: decoration,
        decorationColor: decorationColor,
      );

  static TextStyle display({
    double fontSize = 18,
    FontWeight fontWeight = FontWeight.w800,
    Color? color,
    double? height,
    double? letterSpacing,
    TextDecoration? decoration,
    Color? decorationColor,
  }) =>
      GoogleFonts.spaceGrotesk(
        fontSize: fontSize,
        fontWeight: fontWeight,
        color: color,
        height: height,
        letterSpacing: letterSpacing ?? -0.35,
        decoration: decoration,
        decorationColor: decorationColor,
      );
}
