# LMSPRO mobile app layout

**Targets: Android (primary) and iOS only.** There is no Flutter `web/` or `windows/` (or Linux/macOS) project in this repo; the separate LMSPRO web app lives in `../frontend/`.

**UI parity with web:** `LearnHubTheme` uses the same navy/gold palette as `frontend/src/index.css`. Typography uses **Plus Jakarta Sans** (body) and **Space Grotesk** (headings) via `google_fonts`, matching the web fonts. Lesson PDFs render **in-app** with `pdfx` (pinch-zoom); you can still open the file in another app from the PDF toolbar.

Standard Flutter layout: **only source and config belong in git**. Anything under `build/` is produced by `flutter build` and can be several GB; run `flutter clean` to delete it.

| Path | Purpose |
|------|--------|
| `lib/` | Dart UI and app logic (`main.dart`, `screens/`, `services/`, etc.) |
| `android/` | Android Gradle project (Kotlin, manifests, `build.gradle.kts`) |
| `ios/` | Xcode / iOS project |
| `test/` | Dart tests |
| `scripts/` | PowerShell helpers (`flutter_run_android_safe.ps1`, USB/Gradle fixes) |
| `tools/` | Optional one-off install/debug scripts |

**APK outputs (after a build)** live only under `build/app/outputs/` (e.g. `flutter-apk/app-arm64-v8a-release.apk`). Do not copy APKs into `lib/` or commit them.

**Smallest installable size:** use `-Release` with `flutter_run_android_safe.ps1` (arm64-only default, split-per-abi, R8 + obfuscation). For Play Store long-term, prefer `flutter build appbundle` (AAB) instead of fat APK.

**If PowerShell scripts fail:** use **`build_release_apk.bat`** or **`build_debug_apk.bat`** in this folder (double-click), or run the same `flutter build apk ...` commands from **Command Prompt**.
