import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import '../services/cache_service.dart';
import '../services/logging_service.dart';
import '../services/monitoring_service.dart';
import '../services/notification_service.dart';
import '../services/search_service.dart';
import '../services/validation_service.dart';

final apiServiceProvider = Provider((ref) => ApiService());
final authServiceProvider = Provider((ref) {
  final apiService = ref.read(apiServiceProvider);
  return AuthService(apiService);
});
final cacheServiceProvider = Provider((ref) => CacheService());
final loggingServiceProvider = Provider((ref) => LoggingService());
final monitoringServiceProvider = Provider((ref) => MonitoringService());
final notificationServiceProvider = Provider((ref) => NotificationService());
final searchServiceProvider = Provider((ref) {
  final apiService = ref.read(apiServiceProvider);
  return SearchService(apiService);
});
final validationServiceProvider = Provider((ref) => ValidationService());
