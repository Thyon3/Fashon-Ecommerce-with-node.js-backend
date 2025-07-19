import 'package:flutter/material.dart';
import 'package:frontend/core/common/widgets/bottom_app_bar.dart';

class LoginView extends StatelessWidget {
  const LoginView({super.key});
  final path = '/login';

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Sign in '), bottom: BottomAppBarView()),
    );
  }
}
