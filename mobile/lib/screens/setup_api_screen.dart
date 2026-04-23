import "package:flutter/material.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";

import "../config/api_config.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../widgets/learnhub_hero_background.dart";

/// Shown on first launch on a physical Android device so the user can enter the PC LAN IP.
class SetupApiScreen extends StatefulWidget {
  const SetupApiScreen({super.key});

  @override
  State<SetupApiScreen> createState() => _SetupApiScreenState();
}

class _SetupApiScreenState extends State<SetupApiScreen> {
  final _controller = TextEditingController();
  String? _error;

  @override
  void initState() {
    super.initState();
    final hint = ApiConfig.manualEntryHint;
    if (hint.isNotEmpty) {
      _controller.text = hint;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _useUsbReverseTunnel() async {
    _controller.text = "127.0.0.1:5000";
    await _save();
  }

  Future<void> _save() async {
    setState(() => _error = null);
    try {
      await ApiConfig.saveManualBaseUrl(_controller.text);
      if (!mounted) return;
      final app = context.read<AppState>();
      app.refreshApiBaseUrl();
      final ok = await app.tryPingBackend();
      if (!mounted) return;
      if (!ok) {
        final base = ApiConfig.baseUrl;
        final usb = base.contains("127.0.0.1");
        setState(() {
          _error = usb
              ? "Phone could not reach the API at $base.\n\n"
                    "1) On the PC, in backend folder: npm start (port 5000).\n"
                    "2) With USB debugging on, open PowerShell in the mobile folder and run:\n"
                    "   adb reverse tcp:5000 tcp:5000\n"
                    "   (or .\\scripts\\adb_reverse_api.ps1)\n"
                    "3) Unplug/replug USB and run the command again if needed.\n"
                    "4) In Chrome on the phone, try: http://127.0.0.1:5000/api/health"
              : "Could not reach $base. Check PC IP, npm start, and Windows Firewall (port 5000).";
        });
        return;
      }
      if (context.canPop()) {
        context.pop();
      } else {
        context.go("/login");
      }
    } on ArgumentError catch (e) {
      setState(() => _error = e.message ?? e.toString());
    } catch (e) {
      setState(() => _error = e.toString().replaceFirst("Exception: ", ""));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: LearnHubHeroBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 16),
                Text(
                  "API server on your PC",
                  style: LhText.display(
                    fontSize: 24,
                    fontWeight: FontWeight.w700,
                    color: LearnHubTheme.onHero,
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  r"Easiest with a USB cable: run .\scripts\flutter_run_android_safe.ps1 (or "
                  r".\scripts\adb_reverse_api.ps1) on the PC, then tap “Use 127.0.0.1 (USB)” below — "
                  "no Wi‑Fi IP or firewall rule needed.\n\n"
                  "Otherwise enter this PC’s IPv4 from ipconfig (same Wi‑Fi as the phone). "
                  "USB tethering: use the PC’s tether/RNDIS IPv4 (Windows often 192.168.137.1). "
                  "Backend must be running on port 5000.",
                  style: LhText.body(
                    fontSize: 14,
                    height: 1.45,
                    color: LearnHubTheme.onHero.withValues(alpha: 0.9),
                  ),
                ),
                const SizedBox(height: 28),
                Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        TextField(
                          controller: _controller,
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: "PC address",
                            hintText: "192.168.1.10 or 192.168.137.1",
                            helperText:
                                "Wi‑Fi LAN IP, or USB tether host (often 192.168.137.1 on Windows)",
                          ),
                        ),
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Text(_error!, style: TextStyle(color: LearnHubTheme.messageWarning, fontSize: 13)),
                        ],
                        const SizedBox(height: 16),
                        FilledButton(
                          onPressed: _save,
                          child: const Text("Continue"),
                        ),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _useUsbReverseTunnel,
                          child: const Text("Use 127.0.0.1 (USB + adb reverse)"),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          "Requires USB debugging and adb reverse tcp:5000 on the PC "
                          "(flutter_run_android_safe.ps1 runs this for you).",
                          style: LhText.body(
                            fontSize: 12,
                            height: 1.35,
                            color: LearnHubTheme.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
