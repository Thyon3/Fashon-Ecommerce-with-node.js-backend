import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'api_service.dart';

class MonitoringService {
  static final MonitoringService _instance = MonitoringService._internal();
  factory MonitoringService() => _instance;
  MonitoringService._internal();

  final ApiService _apiService = ApiService();
  Map<String, dynamic> _deviceInfo = {};
  Map<String, dynamic> _appInfo = {};
  String? _connectivityStatus;
  
  // Performance metrics
  int _requestCount = 0;
  int _errorCount = 0;
  final List<int> _responseTimes = [];
  DateTime? _startTime;
  
  // User metrics
  final List<String> _userActions = [];
  final Map<String, int> _screenViews = {};
  DateTime? _lastInteraction;

  Future<void> init() async {
    _startTime = DateTime.now();
    await _getDeviceInfo();
    await _getAppInfo();
    await _setupConnectivityListener();
    
    // Start periodic reporting
    Timer.periodic(const Duration(minutes: 5), (_) => _reportMetrics());
  }

  Future<void> _getDeviceInfo() async {
    try {
      if (Platform.isIOS) {
        final iosInfo = await DeviceInfoPlugin().iosInfo;
        _deviceInfo = {
          'platform': 'iOS',
          'version': iosInfo.systemVersion,
          'model': iosInfo.model,
          'name': iosInfo.name,
          'localizedModel': iosInfo.localizedModel,
        };
      } else if (Platform.isAndroid) {
        final androidInfo = await DeviceInfoPlugin().androidInfo;
        _deviceInfo = {
          'platform': 'Android',
          'version': androidInfo.version.release,
          'model': androidInfo.model,
          'manufacturer': androidInfo.manufacturer,
          'product': androidInfo.product,
        };
      } else {
        _deviceInfo = {
          'platform': Platform.operatingSystem,
          'version': Platform.operatingSystemVersion,
        };
      }
    } catch (e) {
      _deviceInfo = {'error': e.toString()};
    }
  }

  Future<void> _getAppInfo() async {
    try {
      final packageInfo = await PackageInfo.fromPlatform();
      _appInfo = {
        'appName': packageInfo.appName,
        'version': packageInfo.version,
        'buildNumber': packageInfo.buildNumber,
        'packageName': packageInfo.packageName,
      };
    } catch (e) {
      _appInfo = {'error': e.toString()};
    }
  }

  Future<void> _setupConnectivityListener() async {
    final connectivity = Connectivity();
    
    connectivity.onConnectivityChanged.listen((ConnectivityResult result) {
      _connectivityStatus = result.toString();
      _logEvent('connectivity_change', {
        'status': _connectivityStatus,
        'timestamp': DateTime.now().toIso8601String(),
      });
    });
    
    // Get initial connectivity status
    _connectivityStatus = (await connectivity.checkConnectivity()).toString();
  }

  // Performance monitoring
  void recordRequest(String method, String url, int responseTime, int statusCode) {
    _requestCount++;
    _responseTimes.add(responseTime);
    
    // Keep only last 100 response times
    if (_responseTimes.length > 100) {
      _responseTimes.removeAt(0);
    }
    
    if (statusCode >= 400) {
      _errorCount++;
    }
    
    _logEvent('api_request', {
      'method': method,
      'url': url,
      'responseTime': responseTime,
      'statusCode': statusCode,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void recordError(String error, String stackTrace, {String? context}) {
    _errorCount++;
    
    _logEvent('error', {
      'error': error,
      'stackTrace': stackTrace,
      'context': context,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void recordUserAction(String action, {Map<String, dynamic>? context}) {
    _userActions.add(action);
    _lastInteraction = DateTime.now();
    
    // Keep only last 50 actions
    if (_userActions.length > 50) {
      _userActions.removeAt(0);
    }
    
    _logEvent('user_action', {
      'action': action,
      'context': context,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void recordScreenView(String screenName) {
    _screenViews[screenName] = (_screenViews[screenName] ?? 0) + 1;
    
    _logEvent('screen_view', {
      'screen': screenName,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void recordPerformance(String operation, Duration duration, {Map<String, dynamic>? context}) {
    _logEvent('performance', {
      'operation': operation,
      'duration': duration.inMilliseconds,
      'context': context,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  Future<Map<String, dynamic>> getMetrics() async {
    final now = DateTime.now();
    final uptime = _startTime != null ? now.difference(_startTime!).inSeconds : 0;
    
    final avgResponseTime = _responseTimes.isNotEmpty 
        ? _responseTimes.reduce((a, b) => a + b) / _responseTimes.length 
        : 0.0;
    
    return {
      'uptime': uptime,
      'requestCount': _requestCount,
      'errorCount': _errorCount,
      'errorRate': _requestCount > 0 ? (_errorCount / _requestCount) * 100 : 0.0,
      'averageResponseTime': avgResponseTime,
      'deviceInfo': _deviceInfo,
      'appInfo': _appInfo,
      'connectivity': _connectivityStatus,
      'lastInteraction': _lastInteraction?.toIso8601String(),
      'topScreens': _getTopScreens(),
      'recentActions': _userActions.take(10).toList(),
    };
  }

  List<Map<String, dynamic>> _getTopScreens() {
    return _screenViews.entries
        .map((entry) => {'screen': entry.key, 'views': entry.value})
        .toList()
        ..sort((a, b) => b['views'].compareTo(a['views']))
        .take(5)
        .toList();
  }

  Future<void> _reportMetrics() async {
    if (!kReleaseMode) return; // Only report in release mode
    
    try {
      final metrics = await getMetrics();
      await _apiService.post('/analytics/metrics', data: metrics);
    } catch (e) {
      // Silently fail to avoid affecting user experience
    }
  }

  Future<void> _logEvent(String eventType, Map<String, dynamic> data) async {
    if (!kReleaseMode) return; // Only log in release mode
    
    try {
      await _apiService.post('/analytics/events', data: {
        'type': eventType,
        'data': data,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      // Silently fail to avoid affecting user experience
    }
  }

  Future<Map<String, dynamic>> checkSystemHealth() async {
    try {
      final response = await _apiService.get('/health');
      return response.data;
    } catch (e) {
      return {
        'status': 'unhealthy',
        'error': e.toString(),
        'timestamp': DateTime.now().toIso8601String(),
      };
    }
  }

  Future<void> reportCrash(String error, String stackTrace) async {
    try {
      await _apiService.post('/analytics/crash', data: {
        'error': error,
        'stackTrace': stackTrace,
        'deviceInfo': _deviceInfo,
        'appInfo': _appInfo,
        'timestamp': DateTime.now().toIso8601String(),
      });
    } catch (e) {
      // Can't report crash if network is down
    }
  }

  void resetMetrics() {
    _requestCount = 0;
    _errorCount = 0;
    _responseTimes.clear();
    _userActions.clear();
    _screenViews.clear();
    _startTime = DateTime.now();
  }
}

final monitoringServiceProvider = Provider((ref) => MonitoringService());
