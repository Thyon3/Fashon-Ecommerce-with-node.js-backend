import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:frontend/core/services/injection_container.dart';
import 'package:frontend/core/services/router.dart';
import 'package:frontend/provider/theme_provider.dart';
import 'package:frontend/theme/theme.dart';

Future<void> main() async {
  await init();
  WidgetsFlutterBinding.ensureInitialized();
  runApp(ProviderScope(child: const MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeProviderNotifier = ref.watch(themeProvider);
    return MaterialApp.router(
      routerConfig: router,
      themeMode: themeProviderNotifier,
      theme: lightTheme,
      darkTheme: darkTheme,
    );
  }
}
