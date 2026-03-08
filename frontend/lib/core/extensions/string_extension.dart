import 'package:flutter/material.dart';

extension StringExtension on String {
  ThemeMode get getThemeMode {
    return switch (toLowerCase()) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
  }

  bool get isEmail {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(this);
  }

  bool get isPhoneNumber {
    return RegExp(r'^[\d\s\-\+\(\)]+$').hasMatch(this) && length >= 10;
  }

  bool get isStrongPassword {
    return length >= 8 &&
           RegExp(r'[A-Z]').hasMatch(this) &&
           RegExp(r'[a-z]').hasMatch(this) &&
           RegExp(r'[0-9]').hasMatch(this) &&
           RegExp(r'[!@#$%^&*(),.?":{}|<>]').hasMatch(this);
  }

  String get capitalizeFirst {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1).toLowerCase()}';
  }

  String get capitalizeWords {
    return split(' ').map((word) => word.capitalizeFirst).join(' ');
  }

  String get removeWhitespace {
    return replaceAll(RegExp(r'\s+'), '').trim();
  }

  String get formatCurrency {
    if (isEmpty) return '\$0.00';
    try {
      final value = double.parse(this);
      return '\$${value.toStringAsFixed(2)}';
    } catch (e) {
      return '\$0.00';
    }
  }

  bool get isValidUrl {
    try {
      final uri = Uri.parse(this);
      return uri.hasScheme && (uri.hasAuthority || uri.path.isNotEmpty);
    } catch (e) {
      return false;
    }
  }

  String truncate(int maxLength, {String suffix = '...'}) {
    if (length <= maxLength) return this;
    return '${substring(0, maxLength - suffix.length)}$suffix';
  }

  String get removeHtmlTags {
    return replaceAll(RegExp(r'<[^>]*>'), '');
  }

  String get toTitleCase {
    return replaceAll(RegExp(r'\b\w'), (match) => match.group(0)!.toUpperCase());
  }
}
