import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../screens/auth/login_screen.dart';
import '../screens/auth/register_screen.dart';
import '../screens/auth/forgot_password_screen.dart';
import '../screens/history/history_screen.dart';
import '../screens/home/home_screen.dart';
import '../screens/applications/my_applications_screen.dart';
import '../screens/messages/messages_screen.dart';
import '../screens/profile/profile_screen.dart';
import '../screens/tasks/task_detail_screen.dart';
import '../screens/tasks/task_tracking_screen.dart';
import '../screens/wallet/wallet_screen.dart';
import '../screens/main_shell.dart';

GoRouter buildRouter(AuthProvider authProvider) {
  return GoRouter(
    initialLocation: '/',
    refreshListenable: authProvider,
    redirect: (context, state) {
      final loggedIn = authProvider.status == AuthStatus.authenticated;
      final isAuth = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/forgot-password';

      // Still loading → no redirect
      if (authProvider.status == AuthStatus.unknown) return null;

      // Protected routes
      final protected = ['/my-applications', '/messages', '/wallet', '/profile', '/history'];
      final isProtected = protected.any((p) => state.matchedLocation.startsWith(p));

      if (!loggedIn && isProtected) return '/login';
      if (loggedIn && isAuth) return '/';
      return null;
    },
    routes: [
      // Shell (bottom nav)
      ShellRoute(
        builder: (context, state, child) => MainShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
          GoRoute(path: '/my-applications', builder: (_, __) => const MyApplicationsScreen()),
          GoRoute(path: '/messages', builder: (_, __) => const MessagesScreen()),
          GoRoute(path: '/wallet', builder: (_, __) => const WalletScreen()),
          GoRoute(path: '/profile', builder: (_, __) => const ProfileScreen()),
          GoRoute(path: '/history', builder: (_, __) => const HistoryScreen()),
        ],
      ),

      // Non-shell routes (full screen)
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/register', builder: (_, __) => const RegisterScreen()),
      GoRoute(path: '/forgot-password', builder: (_, __) => const ForgotPasswordScreen()),
      GoRoute(
        path: '/tasks/:id',
        builder: (_, state) => TaskDetailScreen(taskId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/tracking/:applicationId',
        builder: (_, state) => TaskTrackingScreen(applicationId: state.pathParameters['applicationId']!),
      ),
    ],
  );
}
