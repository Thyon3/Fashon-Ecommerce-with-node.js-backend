import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

class OnBoardingView extends StatefulWidget {
  const OnBoardingView({super.key});

  @override
  State<OnBoardingView> createState() => OnBoardingViewState();
}

class OnBoardingViewState extends State<OnBoardingView> {
  @override
  Widget build(BuildContext context) {
    final pageController = PageController();
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: PageView(
            allowImplicitScrolling: true,
            controller: pageController,
            children: const [],
          ),
        ),
      ),
    );
  }
}
