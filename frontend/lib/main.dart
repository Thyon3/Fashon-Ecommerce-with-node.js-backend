import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/foundation.dart';
import 'core/services/injection_container.dart';
import 'core/services/router.dart';
import 'core/utils/app_initializer.dart';
import 'core/utils/error_handler.dart';
import 'provider/theme_provider.dart';
import 'theme/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await init();
    await AppInitializer.initialize();
    
    // Set up error handling
    FlutterError.onError = (FlutterErrorDetails details) {
      ErrorHandler.handleException(
        Exception(details.exception),
        details.stack ?? StackTrace.current,
        context: details.context?.toString(),
        fatal: false,
      );
    };
    
    PlatformDispatcher.instance.onError = (error, stack) {
      ErrorHandler.handleException(
        error as Exception,
        stack,
        context: 'Platform error',
        fatal: true,
      );
      return true;
    };
    
    runApp(ProviderScope(child: const MyApp()));
  } catch (e) {
    ErrorHandler.handleException(
      Exception('App initialization failed: $e'),
      StackTrace.current,
      context: 'App initialization',
      fatal: true,
    );
  }
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
