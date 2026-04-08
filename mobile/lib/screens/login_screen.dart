import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "../theme/lh_text.dart";
import "package:go_router/go_router.dart";
import "package:google_sign_in/google_sign_in.dart";
import "package:provider/provider.dart";

import "../config/api_config.dart";
import "../navigation/after_auth.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../widgets/learnhub_logo.dart";

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  final _signInEmail = TextEditingController();
  final _signInPassword = TextEditingController();
  final _signUpName = TextEditingController();
  final _signUpEmail = TextEditingController();
  final _signUpPhone = TextEditingController();
  final _signUpPassword = TextEditingController();

  bool _loading = false;
  String? _error;
  bool _obscureSignIn = true;
  bool _obscureSignUp = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      if (_tabController.indexIsChanging) return;
      setState(() {
        _error = null;
      });
    });
  }

  static const _emailMax = 50;
  static const _passwordMin = 6;
  static const _passwordMax = 12;

  String _networkErrorMessage(Object e) {
    final raw = e.toString();
    final lower = raw.toLowerCase();
    if (lower.contains("no route to host") ||
        lower.contains("connection errored") ||
        lower.contains("connection refused") ||
        lower.contains("connection timed out") ||
        lower.contains("timed out reaching") ||
        lower.contains("longer than") ||
        lower.contains("failed host lookup") ||
        lower.contains("network is unreachable")) {
      return "Cannot reach ${ApiConfig.baseUrl}\n\n"
          "Checklist:\n"
          "• Backend: open a terminal in the backend folder and run: npm start (listen on port 5000).\n"
          "• Correct PC IP: run ipconfig on Windows. Use the IPv4 of the adapter that matches how the phone talks to the PC. "
          "Wi‑Fi (e.g. 192.168.7.x) is not the same subnet as USB tethering — for tether/RNDIS the PC is often 192.168.137.1.\n"
          "• Windows Firewall: allow inbound TCP 5000 (private networks) for Node.js, or add a rule for port 5000.\n\n"
          "Then open API server below and enter that IPv4 (with :5000 if you use host:port).";
    }
    if (raw.contains("DioException")) {
      return "Cannot reach server. Check API URL and that the backend is running.";
    }
    return raw.replaceFirst("Exception: ", "");
  }

  @override
  void dispose() {
    _tabController.dispose();
    _signInEmail.dispose();
    _signInPassword.dispose();
    _signUpName.dispose();
    _signUpEmail.dispose();
    _signUpPhone.dispose();
    _signUpPassword.dispose();
    super.dispose();
  }

  Future<void> _submitSignIn() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final app = context.read<AppState>();
      final user =
          await app.auth.login(_signInEmail.text, _signInPassword.text);
      app.setUser(user);
      if (!mounted) return;
      await goHomeAfterAuth(context, app);
    } catch (e) {
      setState(() => _error = _networkErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitSignUp() async {
    final nameErr = _validateName(_signUpName.text);
    final emailErr = _validateEmail(_signUpEmail.text);
    final phoneErr = _validatePhone(_signUpPhone.text);
    final passErr = _validatePassword(_signUpPassword.text);
    if (nameErr != null ||
        emailErr != null ||
        phoneErr != null ||
        passErr != null) {
      setState(() {
        _error = [nameErr, emailErr, phoneErr, passErr]
            .whereType<String>()
            .join(" ");
      });
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final app = context.read<AppState>();
      final user = await app.auth.register(
        name: _signUpName.text,
        email: _signUpEmail.text,
        phone: _signUpPhone.text,
        password: _signUpPassword.text,
      );
      app.setUser(user);
      if (!mounted) return;
      await goHomeAfterAuth(context, app);
    } catch (e) {
      setState(() => _error = _networkErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _submitGoogle() async {
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final account = await GoogleSignIn.instance.authenticate(
        scopeHint: const <String>["email", "profile"],
      );
      final ga = account.authentication;
      final idToken = ga.idToken;
      if (idToken == null || idToken.isEmpty) {
        setState(() {
          _loading = false;
          _error = ApiConfig.googleWebClientId.isEmpty
              ? "Add your Google OAuth web client ID at build time: --dart-define=GOOGLE_CLIENT_ID=....apps.googleusercontent.com"
              : "Google did not return an ID token. Check SHA-1 in Google Cloud Console for this Android app.";
        });
        return;
      }
      if (!mounted) return;
      final app = context.read<AppState>();
      final user = await app.auth.signInWithGoogleIdToken(idToken);
      app.setUser(user);
      if (!mounted) return;
      await goHomeAfterAuth(context, app);
    } on GoogleSignInException catch (e) {
      if (e.code == GoogleSignInExceptionCode.canceled ||
          e.code == GoogleSignInExceptionCode.interrupted ||
          e.code == GoogleSignInExceptionCode.uiUnavailable) {
        if (mounted) setState(() => _loading = false);
        return;
      }
      if (mounted) {
        setState(() {
          _error = e.description ?? e.toString();
          _loading = false;
        });
      }
    } catch (e) {
      setState(() => _error = _networkErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _validateName(String value) {
    final t = value.trim();
    if (t.isEmpty) return "Enter your full name.";
    if (!RegExp(r"^[a-zA-Z\s]+$").hasMatch(t)) {
      return "Name can only contain letters and spaces.";
    }
    if (t.length > 50) return "Name at most 50 characters.";
    return null;
  }

  String? _validateEmail(String value) {
    final t = value.trim();
    if (t.isEmpty) return "Enter your email.";
    if (!RegExp(r"^[^\s@]+@[^\s@]+\.[^\s@]{2,}$").hasMatch(t)) {
      return "Enter a valid email.";
    }
    if (t.length > _emailMax) return "Email at most $_emailMax characters.";
    return null;
  }

  String? _validatePhone(String value) {
    final d = value.replaceAll(RegExp(r"\D"), "");
    if (d.isEmpty) return "Enter your phone number.";
    if (!RegExp(r"^[6-9]\d{9}$").hasMatch(d)) {
      return "Phone must be 10 digits starting with 6-9.";
    }
    return null;
  }

  String? _validatePassword(String value) {
    final t = value.trim();
    if (t.isEmpty) return "Enter a password.";
    if (t.length < _passwordMin) {
      return "Password at least $_passwordMin characters.";
    }
    if (t.length > _passwordMax) {
      return "Password at most $_passwordMax characters.";
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Color(0xFFF3F4F6),
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: LearnHubTheme.authBackground,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(20, 24, 20, 24 + MediaQuery.viewPaddingOf(context).bottom),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 440),
                child: Column(
                  children: [
                    Center(
                      child: LearnHubLogoRow(
                        markSize: 40,
                        titleSize: 24,
                        titleColor: LearnHubTheme.onHero,
                      ),
                    ),
                    const SizedBox(height: 12),
                    AnimatedBuilder(
                      animation: _tabController,
                      builder: (context, _) {
                        final signup = _tabController.index == 1;
                        return Column(
                          children: [
                            Text(
                              signup ? "Create your account" : "Welcome back",
                              style: LhText.display(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                                color: LearnHubTheme.onHero,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 6),
                            Text(
                              signup
                                  ? "Join LearnHub and start learning today."
                                  : "Sign in to continue to your courses.",
                              style: LhText.body(
                                fontSize: 14,
                                height: 1.4,
                                color: LearnHubTheme.onHero
                                    .withValues(alpha: 0.88),
                              ),
                              textAlign: TextAlign.center,
                            ),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 22),
                    TextButton(
                      onPressed: _loading
                          ? null
                          : () => context.push("/setup-api"),
                      child: Text(
                        "API server address…",
                        style: LhText.body(
                          fontWeight: FontWeight.w600,
                          fontSize: 13,
                          color: LearnHubTheme.onHero,
                          decoration: TextDecoration.underline,
                          decorationColor:
                              LearnHubTheme.onHero.withValues(alpha: 0.85),
                        ),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Material(
                      color: Colors.white,
                      elevation: 0,
                      borderRadius: BorderRadius.circular(16),
                      shadowColor: LearnHubTheme.navy.withValues(alpha: 0.15),
                      child: Container(
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: LearnHubTheme.border),
                          boxShadow: [
                            BoxShadow(
                              color: LearnHubTheme.navy.withValues(alpha: 0.12),
                              blurRadius: 24,
                              offset: const Offset(0, 8),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            TabBar(
                              controller: _tabController,
                              labelStyle: LhText.body(
                                  fontWeight: FontWeight.w700, fontSize: 14),
                              unselectedLabelStyle: LhText.body(
                                  fontWeight: FontWeight.w500, fontSize: 14),
                              indicatorColor: LearnHubTheme.amber500,
                              labelColor: LearnHubTheme.foreground,
                              unselectedLabelColor:
                                  LearnHubTheme.mutedForeground,
                              tabs: const [
                                Tab(text: "Sign In"),
                                Tab(text: "Sign Up"),
                              ],
                            ),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
                              child: SizedBox(
                                height:
                                    (MediaQuery.of(context).size.height * 0.44)
                                        .clamp(340.0, 480.0),
                                child: TabBarView(
                                  controller: _tabController,
                                  children: [
                                    _signInTab(context),
                                    _signUpTab(context),
                                  ],
                                ),
                              ),
                            ),
                            Padding(
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 24),
                              child: Row(
                                children: [
                                  Expanded(
                                      child:
                                          Divider(color: LearnHubTheme.border)),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 12),
                                    child: Text(
                                      "Or continue with Google",
                                      style: LhText.body(
                                        fontSize: 12,
                                        color: LearnHubTheme.mutedForeground,
                                      ),
                                    ),
                                  ),
                                  Expanded(
                                      child:
                                          Divider(color: LearnHubTheme.border)),
                                ],
                              ),
                            ),
                            const SizedBox(height: 12),
                            Padding(
                              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
                              child: OutlinedButton(
                                onPressed: _loading ? null : _submitGoogle,
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: LearnHubTheme.foreground,
                                  side: BorderSide(color: LearnHubTheme.border),
                                  padding:
                                      const EdgeInsets.symmetric(vertical: 14),
                                  shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(8)),
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(
                                      width: 22,
                                      height: 22,
                                      alignment: Alignment.center,
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius: BorderRadius.circular(4),
                                        border: Border.all(
                                            color: LearnHubTheme.border),
                                      ),
                                      child: Text(
                                        "G",
                                        style: LhText.body(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                          color: const Color(0xFF4285F4),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      "Continue with Google",
                                      style: LhText.body(
                                          fontWeight: FontWeight.w600,
                                          fontSize: 15),
                                    ),
                                  ],
                                ),
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
        ),
      ),
    );
  }

  Widget _signInTab(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          TextField(
            controller: _signInEmail,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            maxLength: _emailMax,
            buildCounter: (_,
                    {required currentLength, required isFocused, maxLength}) =>
                Align(
              alignment: Alignment.centerRight,
              child: Text(
                "$currentLength/$maxLength",
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              ),
            ),
            decoration: const InputDecoration(
              labelText: "Email",
              hintText: "Email",
              prefixIcon: Icon(Icons.mail_outline, size: 20),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _signInPassword,
            obscureText: _obscureSignIn,
            maxLength: _passwordMax,
            buildCounter: (_,
                    {required currentLength, required isFocused, maxLength}) =>
                Align(
              alignment: Alignment.centerRight,
              child: Text(
                "$currentLength/$maxLength",
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              ),
            ),
            decoration: InputDecoration(
              labelText: "Password",
              hintText: "Password",
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscureSignIn
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () =>
                    setState(() => _obscureSignIn = !_obscureSignIn),
              ),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(
                      "Password reset is available on the LearnHub website.",
                      style: LhText.body(),
                    ),
                  ),
                );
              },
              child: Text(
                "Forgot password?",
                style: LhText.body(
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                  color: LearnHubTheme.amber600,
                ),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: TextStyle(color: LearnHubTheme.messageWarning, fontSize: 13)),
          ],
          const SizedBox(height: 12),
          _goldButton(
            label: "Sign In",
            loading: _loading,
            onPressed: _submitSignIn,
          ),
        ],
      ),
    );
  }

  Widget _signUpTab(BuildContext context) {
    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 8),
          TextField(
            controller: _signUpName,
            textCapitalization: TextCapitalization.words,
            maxLength: 50,
            buildCounter: (_,
                    {required currentLength, required isFocused, maxLength}) =>
                Align(
              alignment: Alignment.centerRight,
              child: Text(
                "$currentLength/$maxLength",
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              ),
            ),
            decoration: const InputDecoration(
              labelText: "Full name",
              prefixIcon: Icon(Icons.person_outline, size: 20),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _signUpEmail,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            maxLength: _emailMax,
            buildCounter: (_,
                    {required currentLength, required isFocused, maxLength}) =>
                Align(
              alignment: Alignment.centerRight,
              child: Text(
                "$currentLength/$maxLength",
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              ),
            ),
            decoration: const InputDecoration(
              labelText: "Email",
              prefixIcon: Icon(Icons.mail_outline, size: 20),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _signUpPhone,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            decoration: const InputDecoration(
              labelText: "Phone",
              hintText: "10-digit mobile",
              prefixIcon: Icon(Icons.phone_outlined, size: 20),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _signUpPassword,
            obscureText: _obscureSignUp,
            maxLength: _passwordMax,
            buildCounter: (_,
                    {required currentLength, required isFocused, maxLength}) =>
                Align(
              alignment: Alignment.centerRight,
              child: Text(
                "$currentLength/$maxLength",
                style: TextStyle(fontSize: 11, color: Colors.grey[600]),
              ),
            ),
            decoration: InputDecoration(
              labelText: "Password",
              prefixIcon: const Icon(Icons.lock_outline, size: 20),
              suffixIcon: IconButton(
                icon: Icon(_obscureSignUp
                    ? Icons.visibility_outlined
                    : Icons.visibility_off_outlined),
                onPressed: () =>
                    setState(() => _obscureSignUp = !_obscureSignUp),
              ),
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!,
                style: TextStyle(color: LearnHubTheme.messageWarning, fontSize: 13)),
          ],
          const SizedBox(height: 16),
          _goldButton(
            label: "Create account",
            loading: _loading,
            onPressed: _submitSignUp,
          ),
        ],
      ),
    );
  }

  Widget _goldButton({
    required String label,
    required bool loading,
    required VoidCallback onPressed,
  }) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: LearnHubTheme.brandOrange,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: LearnHubTheme.brandOrange.withValues(alpha: 0.38),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: loading ? null : onPressed,
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 14),
            child: Center(
              child: loading
                  ? const SizedBox(
                      height: 22,
                      width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : Text(
                      label,
                      style: LhText.body(
                        fontWeight: FontWeight.w600,
                        fontSize: 15,
                        color: LearnHubTheme.navy,
                      ),
                    ),
            ),
          ),
        ),
      ),
    );
  }
}
