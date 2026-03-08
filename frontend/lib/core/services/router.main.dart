part of 'router.dart';

final _router = GoRouter(
  initialLocation: '/',
  debugLogDiagnostics: true,
  redirect: (context, state) {
    final cacheHelper = sl<CacheHelper>();
    final token = cacheHelper.getData(key: 'token');
    
    // Check if user is authenticated
    final isAuthenticated = token != null && token.isNotEmpty;
    
    // Define protected routes
    final protectedRoutes = ['/dashboard', '/profile', '/cart', '/orders'];
    final authRoutes = ['/login', '/register', '/forgot-password'];
    
    final currentPath = state.location;
    
    // If not authenticated and trying to access protected route, redirect to login
    if (!isAuthenticated && protectedRoutes.any((route) => currentPath.startsWith(route))) {
      return '/login';
    }
    
    // If authenticated and trying to access auth route, redirect to dashboard
    if (isAuthenticated && authRoutes.any((route) => currentPath.startsWith(route))) {
      return '/dashboard';
    }
    
    return null;
  },
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const SplashScreen(),
    ),
    GoRoute(
      path: '/onboarding',
      builder: (context, state) => const OnBoardingScreen(),
    ),
    GoRoute(
      path: '/login',
      builder: (context, state) => const LoginView(),
    ),
    GoRoute(
      path: '/register',
      builder: (context, state) => const RegisterView(),
    ),
    GoRoute(
      path: '/forgot-password',
      builder: (context, state) => const ForgotPasswordView(),
    ),
    GoRoute(
      path: '/reset-password',
      builder: (context, state) => const ResetPasswordView(),
    ),
    ShellRoute(
      builder: (context, state, child) {
        return DashboardScreen(state: state, child: child);
      },
      routes: [
        GoRoute(
          path: '/dashboard',
          builder: (context, state) => const HomeView(),
        ),
        GoRoute(
          path: '/products',
          builder: (context, state) => const ProductsView(),
        ),
        GoRoute(
          path: '/product/:id',
          builder: (context, state) {
            final productId = state.pathParameters['id']!;
            return ProductDetailView(productId: productId);
          },
        ),
        GoRoute(
          path: '/cart',
          builder: (context, state) => const CartView(),
        ),
        GoRoute(
          path: '/checkout',
          builder: (context, state) => const CheckoutView(),
        ),
        GoRoute(
          path: '/orders',
          builder: (context, state) => const OrdersView(),
        ),
        GoRoute(
          path: '/order/:id',
          builder: (context, state) {
            final orderId = state.pathParameters['id']!;
            return OrderDetailView(orderId: orderId);
          },
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) => const ProfileView(),
        ),
        GoRoute(
          path: '/wishlist',
          builder: (context, state) => const WishlistView(),
        ),
        GoRoute(
          path: '/settings',
          builder: (context, state) => const SettingsView(),
        ),
      ],
    ),
  ],
  errorBuilder: (context, state) => ErrorView(error: state.error),
);

GoRouter get router => _router;
