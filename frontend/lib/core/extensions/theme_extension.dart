import 'package:flutter/material.dart';

// a dart extension on the dart enum ThemeMode
extension themeModeExt on ThemeMode {
  String get getStringValue {
    // switching the current ThemeMode enum values
    return switch (this) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      _ => 'system',
    };
  }
}
