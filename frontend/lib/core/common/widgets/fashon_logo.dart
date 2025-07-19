import 'package:flutter/material.dart';
import 'package:frontend/core/common/syles/text.dart';

class FashonLogo extends StatelessWidget {
  const FashonLogo({super.key, this.style});

  final TextStyle? style;

  @override
  Widget build(BuildContext context) {
    return Text.rich(
      TextSpan(
        text: 'Fas',
        style: style ?? Styles.appLogo,
        children: [
          TextSpan(text: 'hon', style: TextStyle(color: Colors.amber)),
        ],
      ),
    );
  }
}
