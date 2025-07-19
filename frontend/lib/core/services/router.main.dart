part of 'router.dart';

// this file is the part of the router.dart file

final _router = GoRouter(
  initialLocation: '/',
  debugLogDiagnostics: true,
  routes: [
    GoRoute(path: '/', builder: (context, state) => SplashScreen()),
    ShellRoute(
      builder: (context, state, child) {
        return DashboardScreen(state: state, child: child);
      },
      routes: const [


    ]
  ),
  ],
);

GoRouter get router => _router;
