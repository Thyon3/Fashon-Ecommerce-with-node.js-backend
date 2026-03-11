import 'package:flutter/foundation.dart';
import '../services/logging_service.dart';
import '../services/monitoring_service.dart';

class ErrorHandler {
  static final LoggingService _logger = LoggingService();
  static final MonitoringService _monitoring = MonitoringService();

  static void handleException(
    Exception exception,
    StackTrace stackTrace, {
    String? context,
    bool fatal = false,
  }) {
    final message = exception.toString();
    
    // Log to logging service
    if (fatal) {
      _logger.fatal(message, error: exception, stackTrace: stackTrace);
    } else {
      _logger.error(message, error: exception, stackTrace: stackTrace);
    }
    
    // Report to monitoring service
    _monitoring.recordError(message, stackTrace.toString(), context: context);
    
    // In debug mode, print to console
    if (kDebugMode) {
      debugPrint('Error: $message');
      debugPrint('Context: $context');
      debugPrint('StackTrace: $stackTrace');
    }
    
    // In release mode, report crash if fatal
    if (fatal && !kDebugMode) {
      _monitoring.reportCrash(message, stackTrace.toString());
    }
  }

  static void handleError(
    String error, {
    String? context,
    bool fatal = false,
  }) {
    // Log to logging service
    if (fatal) {
      _logger.fatal(error);
    } else {
      _logger.error(error);
    }
    
    // Report to monitoring service
    _monitoring.recordError(error, '', context: context);
    
    // In debug mode, print to console
    if (kDebugMode) {
      debugPrint('Error: $error');
      debugPrint('Context: $context');
    }
    
    // In release mode, report crash if fatal
    if (fatal && !kDebugMode) {
      _monitoring.reportCrash(error, '');
    }
  }

  static void handleNetworkError(
    String error,
    String url, {
    int? statusCode,
    Map<String, dynamic>? data,
  }) {
    final context = 'Network request to $url';
    final fullError = statusCode != null 
        ? 'Network Error ($statusCode): $error' 
        : 'Network Error: $error';
    
    _logger.error(fullError, error: data);
    _monitoring.recordError(fullError, '', context: context);
    
    if (kDebugMode) {
      debugPrint('Network Error: $error');
      debugPrint('URL: $url');
      debugPrint('Status Code: $statusCode');
      if (data != null) {
        debugPrint('Data: $data');
      }
    }
  }

  static void handleValidationError(
    String error,
    String field, {
    dynamic value,
  }) {
    final context = 'Validation error for field: $field';
    final fullError = 'Validation Error: $error';
    
    _logger.warning(fullError);
    _monitoring.recordError(fullError, '', context: context);
    
    if (kDebugMode) {
      debugPrint('Validation Error: $error');
      debugPrint('Field: $field');
      debugPrint('Value: $value');
    }
  }

  static void handleSecurityError(
    String error, {
    Map<String, dynamic>? context,
  }) {
    final fullError = 'Security Error: $error';
    
    _logger.error(fullError, error: context);
    _monitoring.recordError(fullError, '', context: 'Security: ${context?.toString()}');
    
    // Security errors are always important
    if (!kDebugMode) {
      _monitoring.reportCrash(fullError, '');
    }
    
    if (kDebugMode) {
      debugPrint('Security Error: $error');
      if (context != null) {
        debugPrint('Context: $context');
      }
    }
  }

  static void handlePerformanceIssue(
    String operation,
    Duration duration, {
    Map<String, dynamic>? context,
  }) {
    if (duration.inMilliseconds > 5000) { // Log slow operations
      final message = 'Performance Issue: $operation took ${duration.inMilliseconds}ms';
      
      _logger.warning(message);
      _monitoring.recordPerformance(operation, duration, context: context);
      
      if (kDebugMode) {
        debugPrint('Performance Issue: $operation');
        debugPrint('Duration: ${duration.inMilliseconds}ms');
        if (context != null) {
          debugPrint('Context: $context');
        }
      }
    }
  }

  static void handleUserActionError(
    String action,
    String error, {
    Map<String, dynamic>? context,
  }) {
    final fullError = 'User Action Error: $action failed - $error';
    
    _logger.error(fullError, error: context);
    _monitoring.recordError(fullError, '', context: 'User Action: $action');
    
    if (kDebugMode) {
      debugPrint('User Action Error: $action');
      debugPrint('Error: $error');
      if (context != null) {
        debugPrint('Context: $context');
      }
    }
  }

  static void handleCacheError(
    String operation,
    String error, {
    String? key,
  }) {
    final context = key != null ? 'Cache operation: $operation on key: $key' : 'Cache operation: $operation';
    final fullError = 'Cache Error: $error';
    
    _logger.error(fullError, error: context);
    _monitoring.recordError(fullError, '', context: context);
    
    if (kDebugMode) {
      debugPrint('Cache Error: $operation');
      debugPrint('Error: $error');
      if (key != null) {
        debugPrint('Key: $key');
      }
    }
  }

  static void handleNotificationError(
    String operation,
    String error, {
    String? notificationId,
  }) {
    final context = notificationId != null 
        ? 'Notification operation: $operation for ID: $notificationId' 
        : 'Notification operation: $operation';
    final fullError = 'Notification Error: $error';
    
    _logger.error(fullError, error: context);
    _monitoring.recordError(fullError, '', context: context);
    
    if (kDebugMode) {
      debugPrint('Notification Error: $operation');
      debugPrint('Error: $error');
      if (notificationId != null) {
        debugPrint('Notification ID: $notificationId');
      }
    }
  }
}
