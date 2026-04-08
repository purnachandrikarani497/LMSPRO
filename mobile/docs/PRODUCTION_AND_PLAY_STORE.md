# Production API (e.g. lms.speshway.site) and Google Play publishing

This guide explains how to point the LearnHub **Flutter mobile app** at a **public HTTPS backend** (such as `https://lms.speshway.site`) and how to **publish on Google Play**. It does not require editing Dart source files if you use build-time flags or the in-app setup screen.

---

## Part 1 — Connect the app to your deployed domain

Your backend is served at **`https://lms.speshway.site`**. The mobile app expects the **API base URL** to include the **`/api/`** path (see `lib/config/api_config.dart`). A correct value looks like:

```text
https://lms.speshway.site/api/
```

The app normalizes variants (`/api`, no trailing slash, etc.) to end with `/api/`.

### Option A — Build-time URL (recommended for production / Play builds)

Set the compile-time define when you build or run:

```bash
flutter build apk --release ^
  --dart-define=API_BASE_URL=https://lms.speshway.site/api/

# App bundle for Play Store:
flutter build appbundle --release ^
  --dart-define=API_BASE_URL=https://lms.speshway.site/api/
```

On macOS/Linux, use `\` line continuation or a single line.

**Why this is enough:** `ApiConfig.baseUrl` reads `String.fromEnvironment("API_BASE_URL", ...)`. If it is non-empty, it **overrides** the saved manual URL and emulator defaults.

**Files involved (reference only — no edit required):**

| Location | Role |
|----------|------|
| `mobile/lib/config/api_config.dart` | Reads `API_BASE_URL` and SharedPreferences key `api_base_url`; builds `baseUrl` used by `ApiClient` (`lib/services/api_client.dart`). |
| `mobile/lib/main.dart` | Calls `ApiConfig.initialize()` before `runApp`. |
| `mobile/lib/services/api_client.dart` | Dio `baseUrl` from `ApiConfig.baseUrl`. |
| `mobile/lib/utils/media_urls.dart` | Video/stream URLs derived from API origin. |

### Option B — In-app “API server” / setup screen

On a **physical device**, if no `API_BASE_URL` is baked in and no URL is saved, the app can send users to **`/setup-api`** (`SetupApiScreen`). There the user can enter your host, e.g.:

```text
https://lms.speshway.site
```

The app saves it (via `ApiConfig.saveManualBaseUrl`) and normalizes to `https://lms.speshway.site/api/`.

Useful for testers without rebuilding; production Play builds usually use **Option A** so every install hits production by default.

### Google Sign-In (if you use it)

The app uses **`GOOGLE_CLIENT_ID`** as a compile-time define (web OAuth client ID, same idea as `VITE_GOOGLE_CLIENT_ID` on the web app). Example:

```bash
flutter build appbundle --release ^
  --dart-define=API_BASE_URL=https://lms.speshway.site/api/ ^
  --dart-define=GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Ensure in **Google Cloud Console**:

- The OAuth client allows your **Android package name** and **SHA-1** (for release, use your **upload key** / Play App Signing certificate as Google documents).
- Any **authorized redirect URIs** your backend uses match production.

### Backend checklist (not Flutter files, but required for “global” use)

1. **HTTPS** — Production should use TLS (you already have a domain).
2. **CORS** — Relevant for browsers; mobile apps are not browsers but your **admin web** is. Ensure the server allows the web origin you use.
3. **API routes** — Mobile calls paths under the same `/api` prefix your server exposes (consistent with local).
4. **Cookies / auth** — Confirm token/JWT flow works when the client uses `https://lms.speshway.site/api/` (no mixed `http`/`https` issues).

### Android: cleartext HTTP (informational)

`AndroidManifest.xml` sets `usesCleartextTraffic` and a permissive `network_security_config` for **local HTTP** development. For production **HTTPS-only**, traffic to `https://lms.speshway.site` does not need cleartext. Tightening cleartext for release is optional hardening (change manifest/network config when you no longer need HTTP debugging).

---

## Part 2 — Publish on Google Play

High-level steps; exact UI text in Play Console changes over time.

### 1. Prerequisites

- **Google Play Console** account (one-time **registration fee** in supported regions).
- **Legal**: app name, contact email, privacy policy URL (often required for apps that sign in or collect data).

### 2. Create the app in Play Console

1. Go to [Google Play Console](https://play.google.com/console).
2. **Create app** → fill in name, default language, app type, free/paid.

### 3. App signing

- Play can manage **App Signing** with an **upload key** you create (recommended).
- Build a **release** **App Bundle** (`.aab`), not a raw APK, for new listings:

```bash
cd mobile
flutter build appbundle --release ^
  --dart-define=API_BASE_URL=https://lms.speshway.site/api/ ^
  --dart-define=GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Output: `build/app/outputs/bundle/release/app-release.aab`.

Register your **SHA-1** / **SHA-256** fingerprints in Firebase or Google Cloud if you use Google Sign-In.

### 4. Store listing

- **Short / full description**, screenshots (phone, sometimes tablet), feature graphic, icon.
- **Privacy policy** URL.
- **Content rating** questionnaire.
- **Target audience** and **ads** declarations.

### 5. App content & policy

Complete sections such as **Data safety**, **Government apps** (if applicable), **News apps**, etc., truthfully based on what your app does.

### 6. Release track

- Start with **internal testing** or **closed testing**, then **production**.
- Upload the `.aab`, add release notes, roll out.

### 7. Versioning

In `mobile/pubspec.yaml`, bump **`version:`** (e.g. `1.0.0+1` → `1.0.1+2`). Each Play upload must have a **higher version code** (the part after `+`).

### 8. Common gotchas

- **Package name** (`applicationId` in `android/app/build.gradle.kts`) must be **unique** and **stable**; changing it later is painful.
- **ProGuard/R8**: release builds may shrink code; fix rules if a plugin breaks (your project may already ship `proguard-rules.pro`).
- **Testing**: Use internal testers with the production `API_BASE_URL` before promoting to production.

---

## Quick reference — production build command

```bash
cd mobile
flutter pub get
flutter build appbundle --release ^
  --dart-define=API_BASE_URL=https://lms.speshway.site/api/ ^
  --dart-define=GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

Replace the domain if your API is on a different host or path; keep the `/api/` segment consistent with your backend.

---

## Related docs in this repo

- `mobile/README.md` — local dev, `API_BASE_URL`, physical device notes.
