import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';

class AnalyticsService {
  static final AnalyticsService _instance = AnalyticsService._internal();
  factory AnalyticsService() => _instance;
  AnalyticsService._internal();

  final List<Map<String, dynamic>> _events = [];
  Timer? _flushTimer;
  bool _isInitialized = false;

  Future<void> init() async {
    try {
      await _loadStoredEvents();
      _startFlushTimer();
      _isInitialized = true;
    } catch (e) {
      if (kDebugMode) print('Analytics init failed: $e');
    }
  }

  Future<void> _loadStoredEvents() async {
    final prefs = await SharedPreferences.getInstance();
    final eventsJson = prefs.getString('analytics_events');
    if (eventsJson != null) {
      try {
        final eventsList = jsonDecode(eventsJson) as List<dynamic>;
        _events.addAll(eventsList.cast<Map<String, dynamic>>());
      } catch (e) {
        // Clear corrupted data
        await prefs.remove('analytics_events');
      }
    }
  }

  void _startFlushTimer() {
    _flushTimer = Timer.periodic(const Duration(minutes: 5), (_) => _flushEvents());
  }

  Future<void> trackEvent(String eventName, {
    Map<String, dynamic>? parameters,
  }) async {
    final event = {
      'name': eventName,
      'parameters': parameters ?? {},
      'timestamp': DateTime.now().toIso8601String(),
      'sessionId': await _getSessionId(),
    };

    _events.add(event);

    // Keep only last 100 events in memory
    if (_events.length > 100) {
      _events.removeAt(0);
    }

    await _saveEvents();
  }

  Future<void> trackScreenView(String screenName) async {
    await trackEvent('screen_view', parameters: {
      'screen_name': screenName,
    });
  }

  Future<void> trackUserAction(String action, {
    Map<String, dynamic>? context,
  }) async {
    await trackEvent('user_action', parameters: {
      'action': action,
      'context': context,
    });
  }

  Future<void> trackError(String error, {
    String? stackTrace,
    Map<String, dynamic>? context,
  }) async {
    await trackEvent('error', parameters: {
      'error': error,
      'stack_trace': stackTrace,
      'context': context,
    });
  }

  Future<void> trackPerformance(String operation, Duration duration) async {
    await trackEvent('performance', parameters: {
      'operation': operation,
      'duration_ms': duration.inMilliseconds,
    });
  }

  Future<void> trackPurchase(String productId, double price, String currency) async {
    await trackEvent('purchase', parameters: {
      'product_id': productId,
      'price': price,
      'currency': currency,
    });
  }

  Future<void> trackSearch(String query, int resultCount) async {
    await trackEvent('search', parameters: {
      'query': query,
      'result_count': resultCount,
    });
  }

  Future<void> trackAddToCart(String productId, int quantity) async {
    await trackEvent('add_to_cart', parameters: {
      'product_id': productId,
      'quantity': quantity,
    });
  }

  Future<void> trackRemoveFromCart(String productId) async {
    await trackEvent('remove_from_cart', parameters: {
      'product_id': productId,
    });
  }

  Future<void> trackCheckout(String orderId, double total) async {
    await trackEvent('checkout', parameters: {
      'order_id': orderId,
      'total': total,
    });
  }

  Future<void> setUserProperty(String name, String value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('user_property_$name', value);
  }

  Future<String?> getUserProperty(String name) async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('user_property_$name');
  }

  Future<void> setUserId(String userId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('analytics_user_id', userId);
  }

  Future<String?> getUserId() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('analytics_user_id');
  }

  Future<void> _saveEvents() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('analytics_events', jsonEncode(_events));
  }

  Future<void> _flushEvents() async {
    if (_events.isEmpty || !kReleaseMode) return;

    try {
      // In a real implementation, send events to analytics service
      if (kDebugMode) print('Flushing ${_events.length} analytics events');
      
      // Clear stored events after successful flush
      _events.clear();
      await _saveEvents();
    } catch (e) {
      if (kDebugMode) print('Failed to flush analytics: $e');
    }
  }

  Future<String> _getSessionId() async {
    final prefs = await SharedPreferences.getInstance();
    String? sessionId = prefs.getString('analytics_session_id');
    
    if (sessionId == null) {
      sessionId = DateTime.now().millisecondsSinceEpoch.toString();
      await prefs.setString('analytics_session_id', sessionId);
    }
    
    return sessionId;
  }

  Future<Map<String, dynamic>> getDeviceInfo() async {
    try {
      final deviceInfo = DeviceInfoPlugin();
      final packageInfo = await PackageInfo.fromPlatform();
      
      Map<String, dynamic> info = {
        'app_version': packageInfo.version,
        'app_build': packageInfo.buildNumber,
        'app_package': packageInfo.packageName,
      };

      if (defaultTargetPlatform == TargetPlatform.iOS) {
        final iosInfo = await deviceInfo.iosInfo;
        info.addAll({
          'platform': 'iOS',
          'system_version': iosInfo.systemVersion,
          'device_model': iosInfo.model,
          'device_name': iosInfo.name,
        });
      } else if (defaultTargetPlatform == TargetPlatform.android) {
        final androidInfo = await deviceInfo.androidInfo;
        info.addAll({
          'platform': 'Android',
          'system_version': androidInfo.version.release,
          'device_model': androidInfo.model,
          'device_manufacturer': androidInfo.manufacturer,
        });
      }

      return info;
    } catch (e) {
      return {'error': e.toString()};
    }
  }

  Future<List<Map<String, dynamic>>> getEvents() async {
    return List.from(_events);
  }

  Future<void> clearEvents() async {
    _events.clear();
    await _saveEvents();
  }

  Future<void> disable() async {
    _flushTimer?.cancel();
    await clearEvents();
    _isInitialized = false;
  }

  bool get isInitialized => _isInitialized;
}
