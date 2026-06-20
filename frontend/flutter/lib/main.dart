import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/router.dart';
import 'config/theme.dart';
import 'providers/auth_provider.dart';
import 'providers/message_provider.dart';
import 'providers/task_provider.dart';
import 'providers/wallet_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  runApp(const FleksiTaskApp());
}

class FleksiTaskApp extends StatelessWidget {
  const FleksiTaskApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()..initialize()),
        ChangeNotifierProvider(create: (_) => TaskProvider()),
        ChangeNotifierProvider(create: (_) => WalletProvider()),
        ChangeNotifierProvider(create: (_) => MessageProvider()),
      ],
      child: const _AppRoot(),
    );
  }
}

class _AppRoot extends StatefulWidget {
  const _AppRoot();

  @override
  State<_AppRoot> createState() => _AppRootState();
}

class _AppRootState extends State<_AppRoot> {
  late final _router = buildRouter(context.read<AuthProvider>());

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'FleksiTask',
      theme: appTheme,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
