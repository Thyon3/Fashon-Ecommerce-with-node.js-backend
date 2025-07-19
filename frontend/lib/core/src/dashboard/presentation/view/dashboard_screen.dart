import 'package:flutter/material.dart';
import 'package:frontend/core/src/dashboard/presentation/utils/dashboard_utils.dart';
import 'package:go_router/go_router.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key, required this.state, required this.child});
  final Widget child;
  final GoRouterState state;

  @override
  Widget build(BuildContext context) {
    return Scaffold(key: DashboardUtils.ScaffoldKey, body: child);
  }
}
