class AuthUser {
  AuthUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.phone,
  });

  final String id;
  final String name;
  final String email;
  final String role;
  final String? phone;

  factory AuthUser.fromJson(Map<String, dynamic> j) {
    final u = j["user"] as Map<String, dynamic>? ?? j;
    return AuthUser(
      id: u["id"]?.toString() ?? u["_id"]?.toString() ?? "",
      name: u["name"]?.toString() ?? "",
      email: u["email"]?.toString() ?? "",
      role: u["role"]?.toString() ?? "student",
      phone: u["phone"]?.toString(),
    );
  }
}
