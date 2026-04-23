import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "config/api_config.dart";
import "providers/app_state.dart";
import "screens/admin_course_edit_screen.dart";
import "screens/admin_course_manage_screen.dart";
import "screens/admin_dashboard_screen.dart";
import "screens/admin_settings_screen.dart";
import "screens/admin_users_screen.dart";
import "screens/course_detail_screen.dart";
import "screens/course_learn_screen.dart";
import "screens/courses_screen.dart";
import "screens/home_screen.dart";
import "screens/login_screen.dart";
import "screens/my_learning_screen.dart";
import "screens/my_orders_screen.dart";
import "screens/profile_screen.dart";
import "screens/setup_api_screen.dart";
import "screens/splash_screen.dart";

/// [app] drives auth redirects; must be the same instance as [ChangeNotifierProvider].
GoRouter createAppRouter(AppState app) {
  return GoRouter(
    initialLocation: ApiConfig.needsLanSetup ? "/setup-api" : "/splash",
    refreshListenable: app,
    redirect: (BuildContext context, GoRouterState state) {
      final loggedIn = app.user != null;
      final path = state.uri.path;
      final role = app.user?.role;

      final isPublic = path == "/login" || path == "/splash" || path == "/setup-api";

      if (!loggedIn && !isPublic) {
        return "/login";
      }
      if (loggedIn && path == "/login") {
        return role == "admin" ? "/admin" : "/home";
      }
      if (loggedIn && path.startsWith("/admin") && role != "admin") {
        return "/home";
      }
      return null;
    },
    routes: [
      GoRoute(
        path: "/setup-api",
        builder: (_, __) => const SetupApiScreen(),
      ),
      GoRoute(
        path: "/splash",
        builder: (_, __) => const SplashScreen(),
      ),
      GoRoute(
        path: "/login",
        builder: (_, __) => const LoginScreen(),
      ),
      GoRoute(
        path: "/admin",
        builder: (_, __) => const AdminDashboardScreen(),
      ),
      GoRoute(
        path: "/admin/users",
        builder: (_, __) => const AdminUsersScreen(),
      ),
      GoRoute(
        path: "/admin/settings",
        builder: (_, __) => const AdminSettingsScreen(),
      ),
      GoRoute(
        path: "/admin/course/new",
        builder: (_, __) => const AdminCourseEditScreen(),
      ),
      GoRoute(
        path: "/admin/course/:id/manage",
        builder: (_, st) {
          final id = st.pathParameters["id"] ?? "";
          return AdminCourseManageScreen(courseId: id);
        },
      ),
      GoRoute(
        path: "/admin/course/:id/edit",
        builder: (_, st) {
          final id = st.pathParameters["id"] ?? "";
          return AdminCourseEditScreen(courseId: id);
        },
      ),
      GoRoute(
        path: "/home",
        builder: (_, __) => const HomeScreen(),
      ),
      GoRoute(
        path: "/courses",
        builder: (_, __) => const CoursesScreen(),
      ),
      GoRoute(
        path: "/profile",
        builder: (_, __) => const ProfileScreen(),
      ),
      GoRoute(
        path: "/my-orders",
        builder: (_, __) => const MyOrdersScreen(),
      ),
      GoRoute(
        path: "/course/:id",
        builder: (_, st) {
          final id = st.pathParameters["id"] ?? "";
          return CourseDetailScreen(courseId: id);
        },
      ),
      GoRoute(
        path: "/course/:id/learn",
        builder: (_, st) {
          final id = st.pathParameters["id"] ?? "";
          final lessonId = st.uri.queryParameters["lesson"];
          return CourseLearnScreen(courseId: id, initialLessonId: lessonId);
        },
      ),
      GoRoute(
        path: "/my-learning",
        builder: (_, __) => const MyLearningScreen(),
      ),
    ],
  );
}
