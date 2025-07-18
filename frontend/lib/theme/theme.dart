import 'package:flutter/material.dart';

final lightTheme = ThemeData.light().copyWith(
  primaryColor: Color(0xFFFAFAFA),
  brightness: Brightness.light,
  colorScheme: ColorScheme.light(
    primary: Color.fromARGB(26, 255, 255, 255),
    secondary: Colors.white,
    surface: Colors.white30,
    onSecondary: Colors.black,
    onPrimary: const Color.fromARGB(202, 0, 0, 0),
  ),
);
final darkTheme = ThemeData.dark().copyWith(
  primaryColor: Color(0xFF1a1a16),
  brightness: Brightness.dark,
  colorScheme: ColorScheme.dark(
    primary: Color.fromARGB(31, 0, 0, 0),
    secondary: Colors.black,
    surface: Colors.black38,
    onPrimary: Colors.white70,
  ),
);
