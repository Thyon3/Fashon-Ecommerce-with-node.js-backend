import 'package:flutter/material.dart';

class BottomAppBarView extends StatelessWidget implements PreferredSizeWidget {
  const BottomAppBarView({super.key});

  @override
  Widget build(BuildContext context) {
    return PreferredSize(
      preferredSize: preferredSize,
      child: ColoredBox(color: Colors.white60),
    );
  }

  @override
  // TODO: implement preferredSize
  Size get preferredSize => Size.zero;
}
