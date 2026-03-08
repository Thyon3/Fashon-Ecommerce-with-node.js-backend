import 'package:flutter/material.dart';
import 'package:frontend/core/common/application/cache_helper.dart';
import 'package:frontend/core/common/singletons/cache.dart';
import 'package:frontend/core/services/injection_container.dart';
import 'package:frontend/core/src/auth/presentation/view/splash_screen.dart';
import 'package:frontend/core/src/dashboard/presentation/view/dashboard_screen.dart';
import 'package:frontend/core/src/home/presentation/view/home_view.dart';
import 'package:frontend/core/src/onboarding/presentation/view/on_boarding.dart';
import 'package:frontend/core/src/auth/presentation/view/login_view.dart';
import 'package:go_router/go_router.dart';

// Placeholder views - these should be created or imported from their actual locations
class RegisterView extends StatelessWidget {
  const RegisterView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Register View')));
}

class ForgotPasswordView extends StatelessWidget {
  const ForgotPasswordView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Forgot Password View')));
}

class ResetPasswordView extends StatelessWidget {
  const ResetPasswordView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Reset Password View')));
}

class ProductsView extends StatelessWidget {
  const ProductsView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Products View')));
}

class ProductDetailView extends StatelessWidget {
  const ProductDetailView({super.key, required this.productId});
  final String productId;
  @override
  Widget build(BuildContext context) => Scaffold(body: Center(child: Text('Product Detail: $productId')));
}

class CartView extends StatelessWidget {
  const CartView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Cart View')));
}

class CheckoutView extends StatelessWidget {
  const CheckoutView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Checkout View')));
}

class OrdersView extends StatelessWidget {
  const OrdersView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Orders View')));
}

class OrderDetailView extends StatelessWidget {
  const OrderDetailView({super.key, required this.orderId});
  final String orderId;
  @override
  Widget build(BuildContext context) => Scaffold(body: Center(child: Text('Order Detail: $orderId')));
}

class ProfileView extends StatelessWidget {
  const ProfileView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Profile View')));
}

class WishlistView extends StatelessWidget {
  const WishlistView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Wishlist View')));
}

class SettingsView extends StatelessWidget {
  const SettingsView({super.key});
  @override
  Widget build(BuildContext context) => const Scaffold(body: Center(child: Text('Settings View')));
}

class ErrorView extends StatelessWidget {
  const ErrorView({super.key, this.error});
  final Exception? error;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text('An error occurred!', style: TextStyle(fontSize: 24)),
          if (error != null) Text(error.toString()),
        ],
      ),
    ),
  );
}

part 'router.main.dart';
