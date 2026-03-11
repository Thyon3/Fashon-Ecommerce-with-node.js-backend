import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/cache_service.dart';
import '../services/logging_service.dart';
import '../services/monitoring_service.dart';
import '../services/notification_service.dart';
import 'package:firebase_core/firebase_core.dart';

class AppInitializer {
  static bool _isInitialized = false;

  static Future<void> initialize() async {
    if (_isInitialized) return;

    try {
      // Initialize Firebase
      await Firebase.initializeApp();
      
      // Initialize logging
      final loggingService = LoggingService();
      loggingService.init();
      
      // Initialize cache
      final cacheService = CacheService();
      await cacheService.init();
      
      // Initialize monitoring
      final monitoringService = MonitoringService();
      await monitoringService.init();
      
      // Initialize notifications
      final notificationService = NotificationService();
      await notificationService.init();
      
      _isInitialized = true;
      
      if (kDebugMode) {
        print('App initialization completed successfully');
      }
    } catch (e) {
      if (kDebugMode) {
        print('App initialization failed: $e');
      }
      rethrow;
    }
  }

  static bool get isInitialized => _isInitialized;
}
