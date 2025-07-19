import 'package:flutter/material.dart';
import 'package:frontend/core/common/widgets/fashon_logo.dart';
import 'package:frontend/core/resource/style/colors.dart';

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.lightThemePrimaryColor,
      body: Center(child: FashonLogo()),
    );
  }
}
