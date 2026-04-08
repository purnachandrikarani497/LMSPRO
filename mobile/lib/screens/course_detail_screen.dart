import "package:cached_network_image/cached_network_image.dart";
import "../theme/lh_text.dart";
import "package:dio/dio.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:provider/provider.dart";
import "package:razorpay_flutter/razorpay_flutter.dart";

import "../config/api_config.dart";
import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../utils/formatters.dart";
import "../widgets/learnhub_app_bar.dart";
import "../widgets/learnhub_drawer.dart";
import "../widgets/profile_menu_button.dart";

/// Visual parity with `CourseDetail.tsx` non-enrolled landing (hero + sidebar card + content list).
class CourseDetailScreen extends StatefulWidget {
  const CourseDetailScreen({super.key, required this.courseId});

  final String courseId;

  @override
  State<CourseDetailScreen> createState() => _CourseDetailScreenState();
}

class _CourseDetailScreenState extends State<CourseDetailScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  Future<Map<String, dynamic>>? _future;
  bool _started = false;
  bool _enrolling = false;
  final Set<String> _expanded = {};
  Razorpay? _razorpay;

  @override
  void initState() {
    super.initState();
    _razorpay = Razorpay();
    _razorpay!.on(Razorpay.EVENT_PAYMENT_SUCCESS, _onRazorpaySuccess);
    _razorpay!.on(Razorpay.EVENT_PAYMENT_ERROR, _onRazorpayError);
    _razorpay!.on(Razorpay.EVENT_EXTERNAL_WALLET, _onRazorpayExternalWallet);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppState>().refreshEnrollments();
    });
  }

  @override
  void dispose() {
    _razorpay?.clear();
    super.dispose();
  }

  Future<void> _onRazorpaySuccess(PaymentSuccessResponse response) async {
    final paymentId = response.paymentId;
    final orderId = response.orderId;
    final signature = response.signature;
    if (paymentId == null || orderId == null || signature == null) {
      if (mounted) {
        setState(() => _enrolling = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("Incomplete payment response.", style: LhText.body())),
        );
      }
      return;
    }
    final app = context.read<AppState>();
    try {
      await app.enrollments.verifyEnrollment(
        courseId: widget.courseId,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: signature,
      );
      await app.refreshEnrollments();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("Payment successful. You're enrolled!", style: LhText.body()),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
      setState(() {});
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("$e", style: LhText.body())),
        );
      }
    } finally {
      if (mounted) setState(() => _enrolling = false);
    }
  }

  void _onRazorpayError(PaymentFailureResponse response) {
    if (mounted) setState(() => _enrolling = false);
    if (response.code == Razorpay.PAYMENT_CANCELLED) return;
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(response.message ?? "Payment failed", style: LhText.body())),
    );
  }

  void _onRazorpayExternalWallet(ExternalWalletResponse response) {
    if (mounted) setState(() => _enrolling = false);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;
    _future = context.read<AppState>().courses.fetchCourse(widget.courseId);
  }

  String _thumbUrl(dynamic thumb) {
    if (thumb == null) return "";
    final s = thumb.toString();
    if (s.isEmpty) return "";
    if (s.startsWith("http")) return s;
    if (s.startsWith("thumbnails/")) {
      final base = ApiConfig.baseUrl.replaceAll(RegExp(r"/api/?$"), "");
      return "$base/api/upload/thumb?key=${Uri.encodeComponent(s)}";
    }
    return s;
  }

  double _rating(Map<String, dynamic> c) {
    final r = c["rating"];
    if (r is num) return r.toDouble();
    return double.tryParse(r?.toString() ?? "") ?? 0;
  }

  Future<void> _onEnroll(BuildContext context) async {
    final app = context.read<AppState>();
    if (app.user == null) {
      context.go("/login");
      return;
    }
    if (app.isEnrolledInCourse(widget.courseId)) return;

    setState(() => _enrolling = true);
    try {
      final data = await app.enrollInCourse(widget.courseId);
      if (!context.mounted) return;
      if (data.containsKey("orderId")) {
        final key = data["key"]?.toString();
        final orderId = data["orderId"]?.toString();
        final amount = data["amount"];
        if (key == null || orderId == null || amount == null) {
          if (mounted) setState(() => _enrolling = false);
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Invalid payment session from server.", style: LhText.body())),
          );
          return;
        }
        final options = <String, dynamic>{
          "key": key,
          "amount": (amount as num).toInt(),
          "currency": data["currency"]?.toString() ?? "INR",
          "name": "LearnHub",
          "description": "Course enrollment",
          "order_id": orderId,
          "prefill": {
            "email": app.user?.email ?? "",
            "name": app.user?.name ?? "",
          },
        };
        _razorpay!.open(options);
        if (mounted) setState(() => _enrolling = false);
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text("You're enrolled! Scroll down for lessons.", style: LhText.body()),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    } on DioException catch (e) {
      if (!context.mounted) return;
      final data = e.response?.data;
      final msg = data is Map ? data["message"]?.toString() : e.message;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(msg ?? "Could not enroll")),
      );
    } finally {
      if (mounted) setState(() => _enrolling = false);
    }
  }

  int _lessonCount(List<dynamic> sections) {
    var n = 0;
    for (final s in sections) {
      final m = Map<String, dynamic>.from(s as Map);
      final lessons = m["lessons"] as List<dynamic>? ?? [];
      n += lessons.length;
    }
    return n;
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    final isAdmin = app.user?.role == "admin";
    return Scaffold(
      key: _scaffoldKey,
      drawer: const LearnHubDrawer(),
      backgroundColor: LearnHubTheme.gray50,
      appBar: LearnHubAppBar(
        leadingWidth: 112,
        leading: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: Icon(Icons.menu_rounded, color: LearnHubTheme.foreground),
              onPressed: () => _scaffoldKey.currentState?.openDrawer(),
            ),
            IconButton(
              icon: Icon(Icons.arrow_back_rounded, color: LearnHubTheme.foreground),
              onPressed: () => context.canPop() ? context.pop() : context.go("/courses"),
            ),
          ],
        ),
        actions: [
          if (isAdmin)
            TextButton(
              onPressed: () => context.push("/admin"),
              child: Text(
                "Admin",
                style: LhText.body(fontWeight: FontWeight.w600, color: LearnHubTheme.navy),
              ),
            )
          else
            const ProfileMenuButton(),
        ],
      ),
      body: _future == null
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : FutureBuilder<Map<String, dynamic>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)));
                }
                if (snap.hasError) {
                  return Center(
                    child: Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(
                        "Could not load course: ${snap.error}",
                        style: LhText.body(color: LearnHubTheme.gray700),
                      ),
                    ),
                  );
                }
                final c = snap.data ?? {};
                final title = c["title"]?.toString() ?? "Course";
                final subtitle = (c["subtitle"] ?? c["description"])?.toString() ?? "";
                final instructor = c["instructor"]?.toString() ?? "";
                final category = c["category"]?.toString() ?? "General";
                final level = c["level"]?.toString() ?? "Beginner";
                final rating = _rating(c);
                final rc = int.tryParse(c["ratingCount"]?.toString() ?? "") ?? 0;
                final price = c["price"];
                final priceNum = num.tryParse(price?.toString() ?? "") ?? 0;
                final enrolled = context.read<AppState>().isEnrolledInCourse(widget.courseId);
                final thumb = _thumbUrl(c["thumbnail"]);
                final sections = c["sections"] as List<dynamic>? ?? [];
                final lessonsN = c["lessons"] is int
                    ? c["lessons"] as int
                    : (c["lessons"] is num ? (c["lessons"] as num).toInt() : _lessonCount(sections));
                final fullStars = rating.floor().clamp(0, 5);
                final bestseller = rating >= 4.7;

                return SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Container(
                        color: LearnHubTheme.gray900,
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 36),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            TextButton.icon(
                              onPressed: () => context.go("/courses"),
                              icon: Icon(Icons.arrow_back, size: 18, color: LearnHubTheme.gray400),
                              label: Text(
                                "Back to Courses",
                                style: LhText.body(
                                  fontSize: 14,
                                  color: LearnHubTheme.gray300,
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  category.toUpperCase(),
                                  style: LhText.body(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 1.1,
                                    color: LearnHubTheme.amber500.withValues(alpha: 0.9),
                                  ),
                                ),
                                Icon(Icons.chevron_right, size: 14, color: LearnHubTheme.gray600),
                                Text(
                                  level,
                                  style: LhText.body(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: LearnHubTheme.amber500.withValues(alpha: 0.9),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Expanded(
                                  child: Text(
                                    title,
                                    style: LhText.display(
                                      fontSize: 26,
                                      fontWeight: FontWeight.w800,
                                      height: 1.15,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                                if (bestseller) ...[
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                    decoration: BoxDecoration(
                                      color: LearnHubTheme.amber500.withValues(alpha: 0.12),
                                      borderRadius: BorderRadius.circular(4),
                                      border: Border.all(
                                        color: LearnHubTheme.amber500.withValues(alpha: 0.25),
                                      ),
                                    ),
                                    child: Text(
                                      "BESTSELLER",
                                      style: LhText.body(
                                        fontSize: 9,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 0.8,
                                        color: LearnHubTheme.amber500,
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 12),
                            Text(
                              subtitle,
                              style: LhText.body(
                                fontSize: 16,
                                height: 1.45,
                                color: LearnHubTheme.gray400,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Row(
                              children: [
                                Text(
                                  rating.toStringAsFixed(1),
                                  style: LhText.body(
                                    fontWeight: FontWeight.w700,
                                    color: LearnHubTheme.amber400,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                ...List.generate(
                                  5,
                                  (i) => Icon(
                                    Icons.star_rounded,
                                    size: 18,
                                    color: i < fullStars ? LearnHubTheme.amber400 : LearnHubTheme.gray600,
                                  ),
                                ),
                                const SizedBox(width: 8),
                                Text(
                                  "($rc ratings)",
                                  style: LhText.body(fontSize: 13, color: LearnHubTheme.gray400),
                                ),
                              ],
                            ),
                            const SizedBox(height: 12),
                            if (instructor.isNotEmpty)
                              Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: "Created by ",
                                      style: LhText.body(fontSize: 13, color: LearnHubTheme.gray400),
                                    ),
                                    TextSpan(
                                      text: instructor,
                                      style: LhText.body(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w600,
                                        color: LearnHubTheme.amber400,
                                        decoration: TextDecoration.underline,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Material(
                              color: Colors.white,
                              elevation: 2,
                              shadowColor: Colors.black.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  if (thumb.isNotEmpty)
                                    ClipRRect(
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(8)),
                                      child: AspectRatio(
                                        aspectRatio: 16 / 9,
                                        child: CachedNetworkImage(
                                          imageUrl: thumb,
                                          fit: BoxFit.cover,
                                          placeholder: (_, __) => Container(color: LearnHubTheme.gray100),
                                          errorWidget: (_, __, ___) => Container(
                                            color: LearnHubTheme.gray100,
                                            child: Icon(Icons.play_circle_outline, size: 56, color: LearnHubTheme.gray400),
                                          ),
                                        ),
                                      ),
                                    ),
                                  Padding(
                                    padding: const EdgeInsets.all(20),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        Text(
                                          formatPrice(price),
                                          style: LhText.display(
                                            fontSize: 28,
                                            fontWeight: FontWeight.w800,
                                            color: LearnHubTheme.gray900,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        SizedBox(
                                          width: double.infinity,
                                          child: enrolled
                                              ? Column(
                                                  crossAxisAlignment: CrossAxisAlignment.stretch,
                                                  children: [
                                                    FilledButton(
                                                      onPressed: () {
                                                        context.push("/course/${widget.courseId}/learn");
                                                      },
                                                      style: FilledButton.styleFrom(
                                                        backgroundColor: const Color(0xFF10B981),
                                                        foregroundColor: Colors.white,
                                                        padding: const EdgeInsets.symmetric(vertical: 16),
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                      ),
                                                      child: Text(
                                                        "Continue learning",
                                                        style: LhText.body(
                                                          fontWeight: FontWeight.w700,
                                                          fontSize: 17,
                                                        ),
                                                      ),
                                                    ),
                                                    if (isAdmin) ...[
                                                      const SizedBox(height: 10),
                                                      OutlinedButton.icon(
                                                        onPressed: () => context.push("/admin/course/${widget.courseId}/manage"),
                                                        icon: Icon(Icons.settings_outlined, color: LearnHubTheme.navy, size: 20),
                                                        label: Text("Manage course", style: LhText.body(fontWeight: FontWeight.w700, color: LearnHubTheme.navy)),
                                                      ),
                                                    ],
                                                  ],
                                                )
                                              : isAdmin
                                                  ? Column(
                                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                                      children: [
                                                        FilledButton.icon(
                                                          onPressed: () =>
                                                              context.push("/admin/course/${widget.courseId}/manage"),
                                                          icon: const Icon(Icons.settings_outlined),
                                                          label: Text("Manage content", style: LhText.body(fontWeight: FontWeight.w800)),
                                                          style: FilledButton.styleFrom(
                                                            backgroundColor: LearnHubTheme.navy,
                                                            foregroundColor: Colors.white,
                                                            padding: const EdgeInsets.symmetric(vertical: 14),
                                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                          ),
                                                        ),
                                                        const SizedBox(height: 10),
                                                        OutlinedButton.icon(
                                                          onPressed: () => context.push("/admin/course/${widget.courseId}/edit"),
                                                          icon: Icon(Icons.edit_outlined, color: LearnHubTheme.navy, size: 20),
                                                          label: Text("Edit details", style: LhText.body(fontWeight: FontWeight.w700, color: LearnHubTheme.navy)),
                                                        ),
                                                        const SizedBox(height: 6),
                                                        TextButton(
                                                          onPressed: _enrolling ? null : () => _onEnroll(context),
                                                          child: _enrolling
                                                              ? SizedBox(
                                                                  height: 20,
                                                                  width: 20,
                                                                  child: CircularProgressIndicator(strokeWidth: 2, color: LearnHubTheme.amber500),
                                                                )
                                                              : Text(
                                                                  "Enroll as student (preview)",
                                                                  style: LhText.body(
                                                                    fontWeight: FontWeight.w600,
                                                                    color: LearnHubTheme.mutedForeground,
                                                                  ),
                                                                ),
                                                        ),
                                                      ],
                                                    )
                                                  : FilledButton(
                                                      onPressed: _enrolling ? null : () => _onEnroll(context),
                                                      style: FilledButton.styleFrom(
                                                        backgroundColor: LearnHubTheme.amber500,
                                                        foregroundColor: Colors.white,
                                                        padding: const EdgeInsets.symmetric(vertical: 16),
                                                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                                      ),
                                                      child: _enrolling
                                                          ? const SizedBox(
                                                              height: 22,
                                                              width: 22,
                                                              child: CircularProgressIndicator(
                                                                strokeWidth: 2,
                                                                color: Colors.white,
                                                              ),
                                                            )
                                                          : Text(
                                                              priceNum <= 0 ? "Enroll free" : "Enroll now",
                                                              style: LhText.body(
                                                                fontWeight: FontWeight.w700,
                                                                fontSize: 17,
                                                              ),
                                                            ),
                                                    ),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          "30-day money-back guarantee",
                                          textAlign: TextAlign.center,
                                          style: LhText.body(fontSize: 11, color: LearnHubTheme.gray500),
                                        ),
                                        const SizedBox(height: 16),
                                        Divider(color: LearnHubTheme.gray200),
                                        const SizedBox(height: 12),
                                        Text(
                                          "This course includes:",
                                          style: LhText.body(
                                            fontWeight: FontWeight.w700,
                                            color: LearnHubTheme.gray900,
                                          ),
                                        ),
                                        const SizedBox(height: 12),
                                        _includeRow(Icons.play_circle_outline, "Expert-led lessons"),
                                        _includeRow(Icons.menu_book_rounded, "$lessonsN lessons"),
                                        _includeRow(Icons.verified_outlined, "Certificate of completion"),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 28),
                            Text(
                              "Course content",
                              style: LhText.display(
                                fontSize: 20,
                                fontWeight: FontWeight.w800,
                                color: LearnHubTheme.gray900,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              "${sections.length} sections · $lessonsN lessons",
                              style: LhText.body(fontSize: 13, color: LearnHubTheme.gray500),
                            ),
                            const SizedBox(height: 8),
                            if (sections.isEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 24),
                                child: Text(
                                  "No sections published yet.",
                                  style: LhText.body(color: LearnHubTheme.gray500),
                                ),
                              )
                            else
                              Container(
                                decoration: BoxDecoration(
                                  color: Colors.white,
                                  borderRadius: BorderRadius.circular(8),
                                  border: Border.all(color: LearnHubTheme.gray200),
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Column(
                                  children: [
                                    for (final sec in sections)
                                      _sectionBlock(Map<String, dynamic>.from(sec as Map)),
                                  ],
                                ),
                              ),
                            const SizedBox(height: 40),
                          ],
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _sectionBlock(Map<String, dynamic> m) {
    final stTitle = m["title"]?.toString() ?? "Section";
    final sectionLessons = (m["lessons"] as List<dynamic>?) ?? [];
    final expanded = _expanded.contains(stTitle);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Material(
          color: LearnHubTheme.gray100,
          child: InkWell(
            onTap: () => setState(() {
              if (expanded) {
                _expanded.remove(stTitle);
              } else {
                _expanded.add(stTitle);
              }
            }),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Icon(
                    expanded ? Icons.expand_more : Icons.chevron_right,
                    size: 20,
                    color: LearnHubTheme.gray600,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      stTitle,
                      style: LhText.body(
                        fontWeight: FontWeight.w700,
                        fontSize: 13,
                        color: LearnHubTheme.gray900,
                      ),
                    ),
                  ),
                  Text(
                    "${sectionLessons.length} lessons",
                    style: LhText.body(
                      fontSize: 12,
                      color: LearnHubTheme.gray500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (expanded)
          for (final l in sectionLessons)
            Container(
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: LearnHubTheme.gray200)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  Icon(Icons.play_circle_outline, size: 18, color: LearnHubTheme.gray400),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      Map<String, dynamic>.from(l as Map)["title"]?.toString() ?? "Lesson",
                      style: LhText.body(
                        fontSize: 13,
                        color: LearnHubTheme.gray600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
      ],
    );
  }

  Widget _includeRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: LearnHubTheme.gray400),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              text,
              style: LhText.body(fontSize: 13, color: LearnHubTheme.gray600),
            ),
          ),
        ],
      ),
    );
  }
}
