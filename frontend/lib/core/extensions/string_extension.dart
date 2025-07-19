import 'package:flutter/material.dart';

extension StringExtension on String {
  ThemeMode get getThemeMode {
    return switch (toLowerCase()) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }
}
