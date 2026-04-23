# Google Cloud: Android OAuth client for Google Sign-In (detailed)

This project uses **Sign in with Google** on the **web** and in the **Flutter Android app**. The web app only needs a **Web application** OAuth client. The Android app needs **that same Web client ID** at build time **plus** a separate **Android** OAuth client in the **same Google Cloud project**.

Use this document when you set up a new environment or **change your public domain** so you know what to change in Google Cloud versus what stays the same.

---

## 1. How the pieces fit together

| Piece | Purpose |
|--------|---------|
| **OAuth consent screen** | Defines app name, branding, scopes, and (if app is in *Testing*) which Google accounts may sign in. |
| **Web client ID** (`…apps.googleusercontent.com`) | Used by the **website** (JavaScript origins) and passed into the mobile app as `GOOGLE_CLIENT_ID`. The **backend** verifies Google ID tokens against this same client ID (`GOOGLE_CLIENT_ID` in `backend/.env`). |
| **Android OAuth client** | Tells Google which **Android package name** and **signing certificate (SHA-1)** are allowed to obtain tokens for your project. It does **not** embed your API domain. |

The mobile app initializes Google Sign-In with the **Web** client ID as `serverClientId` so Google returns an **ID token** your API can verify with `google-auth-library` (`POST /auth/google`).

---

## 2. Changing to a different domain

**What you usually update:**

1. **Web OAuth client** → **Authorized JavaScript origins**  
   Add your new site origin, e.g. `https://new-domain.com` (and keep `http://localhost:8080` for local web dev if you still use it).

2. **Backend and web `.env`**  
   Point deployment, `API_BASE_URL`, CORS, and any public URLs at the new host.

3. **Mobile builds**  
   Rebuild with `--dart-define=API_BASE_URL=https://new-domain.com/api/` (see `PRODUCTION_AND_PLAY_STORE.md`).

**What often stays the same:**

- The **same Google Cloud project** and often the **same Web client ID**, as long as you still want one pool of users.
- The **Android OAuth client**: it is keyed by **package name + SHA-1**, not by your website domain. You **do not** need a new Android client **just** because the domain changed.

**When you must touch the Android client again:**

- You **change `applicationId`** in `mobile/android/app/build.gradle.kts`.
- You use a **new signing key** (new debug machine, new release keystore, or Play App Signing certificate differs from what you registered). Then add the new **SHA-1** (see section 6).

---

## 3. Prerequisites in Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select your project (e.g. **learnhub**).

2. Enable **Google Identity** usage as needed (if the console prompts you). For standard Sign-In, APIs are usually available once billing/consent is in order.

3. **APIs & Services → OAuth consent screen**  
   - Choose **External** (typical) unless you use Google Workspace-only internal apps.  
   - Fill **App name**, **User support email**, **Developer contact**.  
   - Scopes: for “Sign in with Google”, default openid/email/profile style usage is standard.  
   - If **Publishing status** is **Testing**, add every tester’s Google account under **Test users**. Users not listed cannot complete sign-in.

4. **Credentials**  
   You should already have a **Web application** client ID shared with `VITE_GOOGLE_CLIENT_ID` (frontend) and `GOOGLE_CLIENT_ID` (backend). The Android steps below add the **Android** client.

---

## 4. Create the Android OAuth client (step by step)

1. **APIs & Services → Credentials**.

2. **+ Create credentials → OAuth client ID**.

3. If prompted, configure the **OAuth consent screen** first (section 3).

4. **Application type:** **Android**.

5. **Name**  
   Any label you prefer, e.g. `LearnHub Android (debug)` or `LearnHub Android release`.

6. **Package name**  
   Must match the Flutter/Android **application id** exactly. In this repo it is:

   ```text
   com.learnhub.lmspro.lmspro_mobile
   ```

   (Defined in `mobile/android/app/build.gradle.kts` as `applicationId`.)

7. **SHA-1 certificate fingerprint**  
   See section 5–6. Paste the **SHA1** fingerprint from `keytool` (colon-separated form is fine).

8. **Create**.  
   Google may show a **Client ID** for this Android client; you **do not** paste that into `backend/.env` or `GOOGLE_CLIENT_ID` dart-define. The app still uses the **Web** client ID for server token exchange. The Android client only registers your app + certificate with Google.

9. Wait **a few minutes** after saving. Then reinstall the app and test **Continue with Google** again.

---

## 5. Getting the SHA-1 fingerprint with `keytool`

`keytool` ships with a JDK (Android Studio’s JBR, or a standalone JDK).

### 5.1 Default debug keystore (Windows / macOS / Linux)

Flutter’s default Android debug keystore:

| OS | Typical path |
|----|----------------|
| Windows | `%USERPROFILE%\.android\debug.keystore` |
| macOS / Linux | `~/.android/debug.keystore` |

Default alias: `androiddebugkey`  
Default passwords: `android` / `android`

**PowerShell (Windows):**

```powershell
keytool -list -v `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -alias androiddebugkey `
  -storepass android `
  -keypass android
```

**bash (macOS / Linux):**

```bash
keytool -list -v \
  -keystore ~/.android/debug.keystore \
  -alias androiddebugkey \
  -storepass android \
  -keypass android
```

In the output, find **Certificate fingerprints → SHA1**. Copy that entire value into the Cloud Console **SHA-1** field.

**If `keytool` is not on PATH**, invoke it from Android Studio’s bundled JBR, for example on Windows:

```powershell
& "$env:ProgramFiles\Android\Android Studio\jbr\bin\keytool.exe" -list -v `
  -keystore "$env:USERPROFILE\.android\debug.keystore" `
  -alias androiddebugkey `
  -storepass android `
  -keypass android
```

### 5.2 Release / upload keystore

When you sign release builds with your own keystore (`.jks` / `.keystore`), run `keytool -list -v` with **that file**, the correct **alias**, and the **real store/password** (not published here):

```text
keytool -list -v -keystore path\to\your-release.keystore -alias YOUR_ALIAS
```

Use the SHA-1 from that certificate in Google Cloud. You can add **multiple** SHA-1 fingerprints to the same Android OAuth client so **debug** and **release** builds both work.

### 5.3 Play App Signing

If the app is on Google Play with **Play App Signing**, Google re-signs the APK with their key. For OAuth you often need the **App signing certificate** SHA-1 from **Play Console → Your app → Setup → App integrity**, in addition to your **upload key** SHA-1 if applicable. Follow Google’s current documentation for “SHA-1 certificate fingerprint” and Play.

---

## 6. This repository’s current signing note

In `mobile/android/app/build.gradle.kts`, **release** may be configured to use the **debug** signing config for convenience. If so, **debug** and **release** APKs built that way share the **same** SHA-1 (from the debug keystore). When you switch release to a **production keystore**, register that keystore’s SHA-1 in the Android OAuth client as well.

---

## 7. Wiring the Web client ID into the mobile build

The **Web** client ID must be compiled into the app:

- **Manual:**  
  `--dart-define=GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com`

- **This repo:**  
  `mobile/scripts/build_release_apk_from_backend_env.ps1` reads `GOOGLE_CLIENT_ID` from `backend/.env` and passes it as `--dart-define` (and sets `GOOGLE_CLIENT_ID` for Gradle `default_web_client_id`).  
  **Never** put `GOOGLE_CLIENT_SECRET` in the mobile app; it is server-only.

The value must be the **same** as `GOOGLE_CLIENT_ID` on the backend so `POST /auth/google` can verify the ID token.

---

## 8. Quick troubleshooting

| Symptom | Things to check |
|---------|-------------------|
| Web works, Android does not | Android OAuth client missing, wrong **package name**, or wrong **SHA-1** for the APK you installed. |
| “Google sign-in is not configured on the server” | Backend `GOOGLE_CLIENT_ID` unset or wrong. |
| App asks to add `GOOGLE_CLIENT_ID` at build time | Rebuild with `--dart-define=GOOGLE_CLIENT_ID=...` (or use the PowerShell script above). |
| “Access blocked” / consent errors | OAuth consent screen: **Testing** vs **Production**, **Test users**, or app verification if you requested sensitive scopes. |

---

## 9. Related docs in this repo

- `mobile/docs/PRODUCTION_AND_PLAY_STORE.md` — production API URL, Play Store, and high-level Google Sign-In build flags.  
- `frontend/README.md` — Web OAuth client and `VITE_GOOGLE_CLIENT_ID`.  
- `backend/.env.example` — `GOOGLE_CLIENT_ID` for token verification.

---

*Last updated to match LearnHub LMS mobile package `com.learnhub.lmspro.lmspro_mobile` and dual Web + Android OAuth usage.*
