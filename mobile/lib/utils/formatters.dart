/// Matches `frontend/src/lib/utils.ts` (`formatPrice`).
String formatPrice(dynamic amount) {
  final n = num.tryParse(amount?.toString() ?? "");
  if (n == null || !n.isFinite) return "₹0.00";
  return "₹${n.toStringAsFixed(2)}";
}

/// Web `AdminUsers` uses `date-fns` `dd MMM yyyy` — close enough for admin lists.
String formatShortDate(dynamic value) {
  if (value == null) return "—";
  DateTime? d;
  if (value is String) {
    d = DateTime.tryParse(value);
  } else if (value is DateTime) {
    d = value;
  }
  if (d == null) return "—";
  const months = <String>[
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  final day = d.day.toString().padLeft(2, "0");
  return "$day ${months[d.month - 1]} ${d.year}";
}

String formatMonthDay(dynamic value) {
  if (value == null) return "—";
  final d = value is String ? DateTime.tryParse(value) : null;
  if (d == null) return "—";
  const months = <String>[
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  final day = d.day.toString().padLeft(2, "0");
  return "$day ${months[d.month - 1]}";
}
