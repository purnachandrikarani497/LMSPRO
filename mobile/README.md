# LearnHub — Flutter mobile app (`lmspro_mobile`)

Uses the **same LMSPRO backend** as the web app (`/api` routes, JWT in `Authorization`).

The **repository folder** is `LMSPRO`, but the **product name in the UI** is **LearnHub** (same as `frontend/` — see `LearnHub LMS` in `frontend/index.html`). The Flutter app matches that branding and colors, not a separate product.

## Automated setup (Windows — recommended)

1. Install Flutter and add it to **PATH** (you already ran `flutter --version` — good).
2. Open **PowerShell** or **Command Prompt** and run:

```powershell
cd C:\Users\Home\Desktop\LMSPRO\mobile
.\setup.ps1
```

Or double‑click **`setup.bat`** in the `mobile` folder (runs the same script).

The script will:

- Run **`flutter doctor`** (install anything it marks missing).
- Run **`flutter create .`** once to add **`android/`** and **`ios/`** (skipped if they already exist).
- Run **`flutter pub get`**.

**If PowerShell blocks scripts**, run once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**If you just added Flutter to PATH** and the script still says Flutter was not found: `setup.ps1` reloads PATH from Windows so you usually do not need to restart the terminal. If it still fails, close the terminal tab and open a new one, or fully quit and reopen Cursor.

---

## Manual setup (if you prefer not to use the script)

### 1. Flutter SDK

Follow: [Flutter install — Windows](https://docs.flutter.dev/get-started/install/windows), then `flutter doctor`.

### 2. Generate Android / iOS project files

```powershell
cd mobile
flutter create . --project-name lmspro_mobile --org com.learnhub.lmspro --platforms=android,ios
flutter pub get
```

### 3. Point the app at your API

**Physical Android + USB (most reliable on Windows):** use **`adb reverse`** so the phone talks to your PC over USB — **no LAN IP, no firewall rule.**

1. Start the backend (`npm start` in `backend`, port **5000**).
2. From `mobile/`, run **`.\scripts\flutter_run_android_safe.ps1`** (or **`.\scripts\adb_reverse_api.ps1`** if the device is already connected). The script runs `adb reverse tcp:5000 tcp:5000`.
3. In the app, open **API server** and tap **Use 127.0.0.1 (USB + adb reverse)**, or enter **`127.0.0.1:5000`**.

If you skip `adb reverse`, `127.0.0.1` on the phone is only the phone itself — use your PC’s Wi‑Fi IP from **ipconfig** instead.

The app defaults to:

| Target | Default API base |
|--------|------------------|
| Android emulator | `http://10.0.2.2:5000/api/` (your PC’s `localhost:5000`) |
| iOS simulator | `http://127.0.0.1:5000/api/` |

**Physical phone (Wi‑Fi instead):** on first launch the app asks for your PC’s **LAN IP** (or use):

```powershell
flutter run --dart-define=API_BASE_URL=http://192.168.x.x:5000/api/
```

**Quick check:** on the phone’s browser open `http://YOUR_PC_IP:5000/api/health` — if that JSON does not load, fix IP or Windows Firewall before the app can log in. As Administrator: `backend\scripts\allow_port_5000_windows.ps1`.

If login **always times out** (e.g. 2 minutes), the phone was not reaching the API: wrong IP, `localhost`, or firewall — not “slow server.” Use the setup screen or `dart-define` with a real `ipconfig` IPv4.

**USB tethering:** the PC’s address is usually **not** your Wi‑Fi IP. On Windows, check **ipconfig** for the **USB / Ethernet / Remote NDIS** adapter — **192.168.137.1** is common — and use that with port **5000** in the app’s API server field (or **API server** in the drawer / login).

**HTTPS production:** set `API_BASE_URL` to your real API URL (must include `/api` or `/api/`; the app normalizes to `/api/`).

### 4. HTTP (cleartext) on Android (dev)

The app enables **`usesCleartextTraffic`** for local `http://` APIs. Use **HTTPS** in production.

### 5. Backend must be running

Start the Node API (e.g. port **5000**) before `flutter run`, same as for the web app.

---

## What’s implemented (v1)

- **Splash** → restore JWT via `GET /auth/me` or go to login  
- **Login** → `POST /auth/login` → secure storage  
- **Courses** → `GET /courses`  
- **Course detail** → `GET /courses/:id` (sections/lessons list; video player not wired yet)  
- **Logout**

Google OAuth can be added later with `google_sign_in` + your existing `POST /auth/google`.

---

## Run

Start the backend first (`backend` → `npm start` on port 5000).

This app targets **Android and iOS only** (the LMSPRO web UI is the separate `frontend/` project).

**Android device or emulator** (after Android SDK + licenses):

```powershell
flutter run -d android
```

Plain `flutter run` lists devices and asks you to pick one.

### Android: `abb_exec` / `connect error for write: closed` during install

That comes from **ADB’s streamed install** (`flutter run` uses it)—often over a **shaky USB** link. You may also see **`Error retrieving device properties … error: closed`** and **`Android null (API null) (unsupported)`** in `flutter devices`: that means Flutter could not query the phone through adb; same underlying link/driver issue.

**Best workaround — avoid `flutter run`’s streamed install:** the helper scripts never call `adb install --help`. They try in order: **`adb install -r --no-streaming`**, then **`adb install -r`**, then **`adb push` to `/data/local/tmp` + `adb shell pm install -r -t`** (different transport; often works when you see `protocol fault` or `byte write failed` on USB).

One script builds, installs, starts the app, then **`flutter attach`**:

```powershell
cd C:\Users\Home\Desktop\LMSPRO\mobile
.\scripts\flutter_run_android_safe.ps1 -GoogleClientId "YOUR_CLIENT_ID.apps.googleusercontent.com"
```

Use **PowerShell** with `.\script.ps1` — there is no `run` command (`run .\scripts\...` will error).

If the phone **disconnects during the long Gradle build**, build once, then install/attach without rebuilding:

```powershell
.\scripts\flutter_run_android_safe.ps1 -SkipBuild -GoogleClientId "YOUR_CLIENT_ID.apps.googleusercontent.com"
```

If **`byte write failed`** or the device drops **during install**, put the phone on the **same Wi-Fi as this PC** and add **`-WifiAdb`** (USB stays connected briefly for `adb tcpip 5555`, then install goes over Wi-Fi):

```powershell
.\scripts\flutter_run_android_safe.ps1 -WifiAdb -SkipBuild -GoogleClientId "YOUR_CLIENT_ID.apps.googleusercontent.com"
```

The same **`-WifiAdb`** flag exists on `install_android_debug.ps1`.

The scripts **do not** call `adb kill-server` or `adb reconnect` (those reset USB and often drop the device).

If you only need to install (no debugger): `.\scripts\install_android_debug.ps1`

Also try another **USB data cable**, a **rear motherboard port**, **Wireless debugging** + `adb connect` (often more stable than USB), and update **Android SDK Platform-Tools** in Android Studio.

### `adb devices` is empty (no phone listed)

Nothing in the repo can fix that until **Windows ↔ phone** ADB works. Run:

```powershell
cd C:\Users\Home\Desktop\LMSPRO\mobile
.\scripts\check_android_usb.ps1
```

Follow the printed steps (USB data cable, **File transfer** USB mode, accept RSA prompt, drivers, or **Wireless debugging** + `adb pair` / `adb connect`). When `adb devices` shows `device`, run `flutter run` or `install_android_debug.ps1` again.

### `flutter attach` times out (“VM Service was not discovered”)

Attach needs a **debug** build **running** and a **working `adb`** link for port forwarding. If the USB connection drops, use a stable cable/port, wireless `adb connect`, or skip attach and use **`flutter run`** once the device appears in `adb devices`.

### DevTools in the browser says “Cannot connect to VM service”

That page is **not** the app on your phone — it only works while **Flutter is attached** to the same debug session. The `127.0.0.1:PORT/...` link **expires** when the app stops, you hot-restart, or USB/adb drops.

**Fix:** In the terminal where `flutter attach` (or `flutter_run_android_safe.ps1`) is running, wait until you see **“The Dart VM Service … is available at: http://127.0.0.1:…`**, then **copy that exact new URL** into the browser (or press `v` in the terminal if your Flutter version prints DevTools). After any disconnect, **close the old DevTools tab** and use the **new** link from the terminal.

**Exact errors on the phone** appear in the **phone’s screen / Flutter run log in the terminal**, not in DevTools until it connects.

---

## What we need from you

1. **Flutter** on PATH; run **`.\setup.ps1`** once in `mobile/` (or follow the manual steps).  
2. Fix any **`flutter doctor`** issues (Android Studio, SDK licenses, etc.).  
3. Keep the **backend** running and MongoDB reachable.  
4. For a **real device**, pass **`--dart-define=API_BASE_URL=http://YOUR_PC_IP:5000/api`**.

If anything fails, paste the output of `flutter doctor -v` and the first error from `flutter run`.
