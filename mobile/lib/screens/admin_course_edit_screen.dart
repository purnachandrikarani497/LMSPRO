import "package:cached_network_image/cached_network_image.dart";
import "package:dio/dio.dart";
import "package:flutter/material.dart";
import "package:go_router/go_router.dart";
import "package:image_picker/image_picker.dart";
import "package:provider/provider.dart";

import "../providers/app_state.dart";
import "../theme/learnhub_theme.dart";
import "../theme/lh_text.dart";
import "../utils/media_urls.dart";

/// Create or edit course metadata (parity with web admin course dialog).
class AdminCourseEditScreen extends StatefulWidget {
  const AdminCourseEditScreen({super.key, this.courseId});

  final String? courseId;

  bool get isCreate => courseId == null || courseId!.isEmpty;

  @override
  State<AdminCourseEditScreen> createState() => _AdminCourseEditScreenState();
}

class _AdminCourseEditScreenState extends State<AdminCourseEditScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _instructor = TextEditingController();
  final _price = TextEditingController();
  final _thumbnail = TextEditingController();
  final _categoryNew = TextEditingController();

  String _level = "Beginner";
  String? _category;
  List<Map<String, dynamic>> _categoryRows = [];
  bool _loading = true;
  bool _saving = false;
  bool _uploadingThumb = false;
  String? _error;

  static const _levels = ["Beginner", "Intermediate", "Advanced"];

  void _onThumbChanged() {
    if (mounted) setState(() {});
  }

  @override
  void initState() {
    super.initState();
    _thumbnail.addListener(_onThumbChanged);
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  @override
  void dispose() {
    _thumbnail.removeListener(_onThumbChanged);
    _title.dispose();
    _description.dispose();
    _instructor.dispose();
    _price.dispose();
    _thumbnail.dispose();
    _categoryNew.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final app = context.read<AppState>();
    try {
      var rows = await app.courses.fetchCategories();

      if (!widget.isCreate) {
        final c = await app.admin.fetchCourseForAdmin(widget.courseId!);
        if (!mounted) return;
        _title.text = "${c["title"] ?? ""}";
        _description.text = "${c["description"] ?? ""}";
        _instructor.text = "${c["instructor"] ?? ""}";
        final p = c["price"];
        _price.text = p == null ? "" : "${p is num ? p.toInt() : p}";
        _thumbnail.text = "${c["thumbnail"] ?? ""}";
        _level = "${c["level"] ?? "Beginner"}";
        if (!_levels.contains(_level)) _level = "Beginner";
        final cat = "${c["category"] ?? ""}".trim();
        if (cat.isNotEmpty) {
          _category = cat;
          final exists = rows.any((e) => "${e["name"] ?? e["_id"]}" == cat);
          if (!exists) rows = [...rows, {"name": cat}];
        }
      } else {
        if (rows.isEmpty) {
          _category = "__new__";
        } else {
          _category = "${rows.first["name"] ?? rows.first["_id"] ?? "General"}".trim();
          if (_category!.isEmpty) _category = "General";
        }
      }

      if (!mounted) return;
      setState(() {
        _categoryRows = rows;
        _category ??= "General";
      });
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  String? _validateTitle(String? v) {
    final t = (v ?? "").trim();
    if (t.length < 2) return "Title at least 2 characters";
    if (t.length > 50) return "Max 50 characters";
    if (!RegExp(r"^[A-Za-z\s]+$").hasMatch(t)) return "Letters and spaces only";
    return null;
  }

  String? _validateDescription(String? v) {
    final t = (v ?? "").trim();
    if (t.length < 2) return "Description at least 2 characters";
    if (t.length > 500) return "Max 500 characters";
    if (!RegExp(r"^[A-Za-z0-9\s.,'\n-]+$").hasMatch(t)) return "Invalid characters in description";
    return null;
  }

  String? _validateInstructor(String? v) {
    final t = (v ?? "").trim();
    if (t.length < 2) return "Instructor at least 2 characters";
    if (t.length > 50) return "Max 50 characters";
    if (!RegExp(r"^[A-Za-z\s]+$").hasMatch(t)) return "Letters and spaces only";
    return null;
  }

  String? _validatePrice(String? v) {
    final digits = (v ?? "").replaceAll(RegExp(r"\D"), "");
    if (digits.isEmpty) return "Enter a price";
    if (digits.length > 9) return "Price too large";
    final n = int.tryParse(digits);
    if (n == null || n <= 0) return "Price must be positive";
    return null;
  }

  String? _validateThumb(String? v) {
    final t = (v ?? "").trim();
    if (t.length < 2) return "Upload an image or enter a thumbnail URL";
    return null;
  }

  Future<void> _pickAndUploadThumbnail() async {
    final app = context.read<AppState>();
    final picker = ImagePicker();
    final x = await picker.pickImage(source: ImageSource.gallery, maxWidth: 1920, imageQuality: 88);
    if (x == null || !mounted) return;
    setState(() => _uploadingThumb = true);
    try {
      final bytes = await x.readAsBytes();
      if (bytes.isEmpty) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text("Could not read image", style: LhText.body()), backgroundColor: const Color(0xFFDC2626)),
          );
        }
        return;
      }
      var name = x.name;
      if (name.trim().isEmpty) {
        name = "thumbnail.jpg";
      }
      final res = await app.admin.uploadThumbnailBytes(bytes, name);
      if (!mounted) return;
      final url = res["url"]?.toString().trim();
      final key = res["key"]?.toString().trim();
      if (url != null && url.isNotEmpty) {
        setState(() => _thumbnail.text = url);
      } else if (key != null && key.isNotEmpty) {
        setState(() => _thumbnail.text = key);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text("$e", style: LhText.body()), backgroundColor: const Color(0xFFDC2626)),
        );
      }
    } finally {
      if (mounted) setState(() => _uploadingThumb = false);
    }
  }

  String _effectiveCategory() {
    final pick = _category ?? "";
    if (pick == "__new__") {
      return _categoryNew.text.trim();
    }
    return pick;
  }

  String? _validateCategory() {
    final c = _effectiveCategory();
    if (c.length < 2) return "Category at least 2 characters";
    if (c.length > 30) return "Max 30 characters";
    if (!RegExp(r"^[A-Za-z\s]+$").hasMatch(c)) return "Letters and spaces only";
    return null;
  }

  Future<void> _save() async {
    final catErr = _validateCategory();
    if (!_form.currentState!.validate() || catErr != null) {
      if (catErr != null && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(catErr, style: LhText.body()), backgroundColor: const Color(0xFFDC2626)),
        );
      }
      return;
    }

    final app = context.read<AppState>();
    setState(() => _saving = true);
    try {
      final priceDigits = _price.text.replaceAll(RegExp(r"\D"), "");
      final priceNum = int.parse(priceDigits);
      final category = _effectiveCategory();
      final body = <String, dynamic>{
        "title": _title.text.trim(),
        "description": _description.text.trim(),
        "instructor": _instructor.text.trim(),
        "category": category,
        "price": priceNum,
        "level": _level,
        "thumbnail": _thumbnail.text.trim(),
        "isPublished": true,
      };

      if (widget.isCreate) {
        await app.admin.createCourse(body);
      } else {
        await app.admin.updateCourse(widget.courseId!, body);
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(widget.isCreate ? "Course created" : "Course updated", style: LhText.body()),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
      context.pop(true);
    } on DioException catch (e) {
      if (!mounted) return;
      final data = e.response?.data;
      final msg = data is Map ? data["message"]?.toString() : e.message;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(msg ?? "Could not save", style: LhText.body()),
          backgroundColor: const Color(0xFFDC2626),
        ),
      );
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text("$e", style: LhText.body()), backgroundColor: const Color(0xFFDC2626)),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final app = context.watch<AppState>();
    if (app.user?.role != "admin") {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (context.mounted) context.go("/admin");
      });
      return const Scaffold(body: Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B))));
    }

    final categoryNames = <String>{
      ..._categoryRows.map((e) => "${e["name"] ?? e["_id"] ?? ""}".trim()).where((s) => s.isNotEmpty),
      if (_category != null && _category!.isNotEmpty && _category != "__new__") _category!,
    }.toList()
      ..sort();

    String categoryDropdownValue() {
      if (_category == "__new__") return "__new__";
      if (_category != null && categoryNames.contains(_category!)) return _category!;
      if (categoryNames.isNotEmpty) return categoryNames.first;
      return "__new__";
    }

    final catVal = categoryDropdownValue();

    return Scaffold(
      backgroundColor: LearnHubTheme.gray50,
      appBar: AppBar(
        backgroundColor: LearnHubTheme.navy,
        foregroundColor: LearnHubTheme.onHero,
        elevation: 0,
        title: Text(
          widget.isCreate ? "New course" : "Edit course",
          style: LhText.display(
            fontSize: 18,
            fontWeight: FontWeight.w800,
            color: LearnHubTheme.onHero,
            letterSpacing: -0.2,
          ),
        ),
        actions: [
          TextButton(
            onPressed: _saving ? null : _save,
            child: Text(
              "Save",
              style: LhText.body(fontWeight: FontWeight.w800, color: LearnHubTheme.amber500),
            ),
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(_error!, style: LhText.body(color: const Color(0xFFDC2626), fontSize: 13)),
                    ),
                  TextFormField(
                    controller: _title,
                    decoration: _dec("Title *", "e.g. Introduction to Web Development"),
                    validator: _validateTitle,
                    maxLength: 50,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _description,
                    decoration: _dec("Description *", "Shown on course page"),
                    validator: _validateDescription,
                    maxLines: 4,
                    maxLength: 500,
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _instructor,
                    decoration: _dec("Instructor *", "Full name"),
                    validator: _validateInstructor,
                    maxLength: 50,
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey("cat_$catVal"),
                    initialValue: catVal,
                    decoration: _dec("Category *", null),
                    items: [
                      ...categoryNames.map((c) => DropdownMenuItem(value: c, child: Text(c, overflow: TextOverflow.ellipsis))),
                      const DropdownMenuItem(value: "__new__", child: Text("New category…")),
                    ],
                    onChanged: (v) => setState(() => _category = v),
                  ),
                  if (catVal == "__new__") ...[
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: _categoryNew,
                      decoration: _dec("New category name", null),
                      maxLength: 30,
                    ),
                  ],
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    key: ValueKey("lvl_$_level"),
                    initialValue: _level,
                    decoration: _dec("Level", null),
                    items: _levels.map((l) => DropdownMenuItem(value: l, child: Text(l))).toList(),
                    onChanged: (v) => setState(() => _level = v ?? "Beginner"),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _price,
                    decoration: _dec("Price (₹) *", "Numbers only"),
                    validator: _validatePrice,
                    keyboardType: TextInputType.number,
                  ),
                  const SizedBox(height: 12),
                  Text(
                    "Thumbnail",
                    style: LhText.body(fontWeight: FontWeight.w800, fontSize: 13, color: LearnHubTheme.foreground),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    "Upload a cover image or paste a URL. Shown on course cards.",
                    style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground, height: 1.35),
                  ),
                  const SizedBox(height: 12),
                  _thumbnailPreview(),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: _thumbnail,
                    decoration: _dec("Thumbnail URL / path *", "Filled automatically after upload"),
                    validator: _validateThumb,
                    maxLines: 2,
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: (_saving || _uploadingThumb) ? null : _pickAndUploadThumbnail,
                      icon: _uploadingThumb
                          ? SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: LearnHubTheme.navy),
                            )
                          : Icon(Icons.photo_library_outlined, size: 20, color: LearnHubTheme.navy),
                      label: Text(
                        _uploadingThumb ? "Uploading…" : "Choose from gallery",
                        style: LhText.body(fontWeight: FontWeight.w700, color: LearnHubTheme.navy),
                      ),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        side: BorderSide(color: LearnHubTheme.gray300),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  FilledButton(
                    onPressed: _saving ? null : _save,
                    style: FilledButton.styleFrom(
                      backgroundColor: LearnHubTheme.amber500,
                      foregroundColor: LearnHubTheme.navy,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _saving
                        ? SizedBox(
                            height: 22,
                            width: 22,
                            child: CircularProgressIndicator(strokeWidth: 2, color: LearnHubTheme.navy),
                          )
                        : Text("Save course", style: LhText.body(fontWeight: FontWeight.w800)),
                  ),
                ],
              ),
            ),
    );
  }

  InputDecoration _dec(String label, String? hint) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: LearnHubTheme.border),
      ),
    );
  }

  Widget _thumbnailPreview() {
    final url = MediaUrls.courseThumbnailUrl(_thumbnail.text.trim());
    return ClipRRect(
      borderRadius: BorderRadius.circular(12),
      child: AspectRatio(
        aspectRatio: 16 / 9,
        child: url == null
            ? Container(
                color: LearnHubTheme.gray100,
                alignment: Alignment.center,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.image_outlined, size: 40, color: LearnHubTheme.gray400),
                    const SizedBox(height: 8),
                    Text(
                      "No preview yet",
                      style: LhText.body(fontSize: 12, color: LearnHubTheme.mutedForeground),
                    ),
                  ],
                ),
              )
            : CachedNetworkImage(
                imageUrl: url,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  color: LearnHubTheme.gray100,
                  alignment: Alignment.center,
                  child: const CircularProgressIndicator(color: Color(0xFFF59E0B), strokeWidth: 2),
                ),
                errorWidget: (_, __, ___) => Container(
                  color: LearnHubTheme.gray100,
                  alignment: Alignment.center,
                  child: Icon(Icons.broken_image_outlined, size: 36, color: LearnHubTheme.gray400),
                ),
              ),
      ),
    );
  }
}
