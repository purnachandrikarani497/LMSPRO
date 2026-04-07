import "package:go_router/go_router.dart";

import "config/api_config.dart";
import "screens/admin_dashboard_screen.dart";
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

GoRouter createAppRouter() {
  return GoRouter(
    initialLocation: ApiConfig.needsLanSetup ? "/setup-api" : "/splash",
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
