import 'dart:developer' as developer;
import 'package:logger/logger.dart';
import 'package:flutter/foundation.dart';

class LoggingService {
  static final LoggingService _instance = LoggingService._internal();
  factory LoggingService() => _instance;
  LoggingService._internal();

  late Logger _logger;

  void init() {
    _logger = Logger(
      printer: PrettyPrinter(
        methodCount: 2,
        errorMethodCount: 8,
        lineLength: 120,
        colors: true,
        printEmojis: true,
        printTime: true,
      ),
      level: kDebugMode ? Level.debug : Level.info,
      output: MultiOutput([
        if (kDebugMode) ConsoleOutput(),
        FileOutput(),
      ]),
    );
  }

  void debug(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.d(message, error: error, stackTrace: stackTrace);
  }

  void info(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.i(message, error: error, stackTrace: stackTrace);
  }

  void warning(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.w(message, error: error, stackTrace: stackTrace);
  }

  void error(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.e(message, error: error, stackTrace: stackTrace);
  }

  void fatal(String message, {Object? error, StackTrace? stackTrace}) {
    _logger.f(message, error: error, stackTrace: stackTrace);
  }

  // Network logging
  void logRequest(String method, String url, {Map<String, dynamic>? data}) {
    final message = '🌐 $method $url';
    if (data != null) {
      _logger.d('$message\nData: $data');
    } else {
      _logger.d(message);
    }
  }

  void logResponse(String method, String url, int statusCode, {dynamic data}) {
    final message = '📡 $method $url - $statusCode';
    if (data != null && kDebugMode) {
      _logger.d('$message\nResponse: $data');
    } else {
      _logger.i(message);
    }
  }

  void logError(String method, String url, String error, {int? statusCode}) {
    final statusInfo = statusCode != null ? ' - $statusCode' : '';
    _logger.e('❌ $method $url$statusInfo\nError: $error');
  }

  // User action logging
  void logUserAction(String action, {Map<String, dynamic>? context}) {
    final message = '👤 User Action: $action';
    if (context != null) {
      _logger.i('$message\nContext: $context');
    } else {
      _logger.i(message);
    }
  }

  // Performance logging
  void logPerformance(String operation, Duration duration, {Map<String, dynamic>? context}) {
    final message = '⏱️ $operation took ${duration.inMilliseconds}ms';
    if (context != null) {
      _logger.i('$message\nContext: $context');
    } else {
      _logger.i(message);
    }
  }

  // Security logging
  void logSecurityEvent(String event, {Map<String, dynamic>? context}) {
    final message = '🔒 Security Event: $event';
    if (context != null) {
      _logger.w('$message\nContext: $context');
    } else {
      _logger.w(message);
    }
  }

  // Analytics logging
  void logAnalytics(String event, {Map<String, dynamic>? parameters}) {
    final message = '📊 Analytics: $event';
    if (parameters != null) {
      _logger.i('$message\nParameters: $parameters');
    } else {
      _logger.i(message);
    }
  }

  // Crash logging
  void logCrash(String error, StackTrace stackTrace, {Map<String, dynamic>? context}) {
    final message = '💥 App Crash: $error';
    if (context != null) {
      _logger.f('$message\nContext: $context\nStackTrace: $stackTrace');
    } else {
      _logger.f('$message\nStackTrace: $stackTrace');
    }
  }

  // Developer logging (only in debug mode)
  void devLog(String message, {Object? error, StackTrace? stackTrace}) {
    if (kDebugMode) {
      developer.log(message, name: 'Fashon', error: error, stackTrace: stackTrace);
    }
  }
}

class FileOutput extends LogOutput {
  @override
  void output(OutputEvent event) {
    // In a real app, you'd write to a file
    // For now, just print to console in debug mode
    if (kDebugMode) {
      print('${event.level.name}: ${event.message}');
    }
  }
}

final loggingServiceProvider = Provider((ref) => LoggingService());
