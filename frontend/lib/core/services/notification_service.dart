import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();
  final StreamController<NotificationResponse> _notificationController = 
      StreamController<NotificationResponse>.broadcast();
  
  late SharedPreferences _prefs;
  String? _fcmToken;
  bool _isInitialized = false;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    
    // Initialize local notifications
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    
    await _notifications.initialize(
      initSettings,
      onDidReceiveNotificationResponse: _onNotificationTapped,
    );
    
    // Initialize Firebase Messaging
    await _initFirebaseMessaging();
    
    _isInitialized = true;
  }

  Future<void> _initFirebaseMessaging() async {
    final messaging = FirebaseMessaging.instance;
    
    // Request permission
    final settings = await messaging.requestPermission(
      alert: true,
      announcement: false,
      badge: true,
      carPlay: false,
      criticalAlert: false,
      provisional: false,
      sound: true,
    );
    
    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      // Get FCM token
      _fcmToken = await messaging.getToken();
      await _saveFcmToken();
      
      // Handle token refresh
      messaging.onTokenRefresh.listen((token) {
        _fcmToken = token;
        _saveFcmToken();
      });
      
      // Handle foreground messages
      FirebaseMessaging.onMessage.listen(_handleForegroundMessage);
      
      // Handle background messages
      FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
    }
  }

  Future<void> _saveFcmToken() async {
    if (_fcmToken != null) {
      await _prefs.setString('fcm_token', _fcmToken!);
    }
  }

  static Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
    // Handle background messages
    if (kDebugMode) {
      print('Background message: ${message.messageId}');
    }
  }

  void _handleForegroundMessage(RemoteMessage message) {
    final notification = message.notification;
    if (notification != null) {
      showLocalNotification(
        title: notification.title ?? 'New Notification',
        body: notification.body ?? '',
        payload: message.data.toString(),
      );
    }
  }

  void _onNotificationTapped(NotificationResponse response) {
    _notificationController.add(response);
  }

  // Local notifications
  Future<void> showLocalNotification({
    required String title,
    required String body,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'fashon_channel',
      'Fashon Notifications',
      channelDescription: 'Notifications from Fashon app',
      importance: Importance.high,
      priority: Priority.high,
      showWhen: false,
    );
    
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    
    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
    
    await _notifications.show(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      details,
      payload: payload,
    );
  }

  // Scheduled notifications
  Future<void> scheduleNotification({
    required String title,
    required String body,
    required DateTime scheduledTime,
    String? payload,
  }) async {
    const androidDetails = AndroidNotificationDetails(
      'fashon_channel',
      'Fashon Notifications',
      channelDescription: 'Notifications from Fashon app',
      importance: Importance.high,
      priority: Priority.high,
    );
    
    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );
    
    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );
    
    await _notifications.zonedSchedule(
      DateTime.now().millisecondsSinceEpoch.remainder(100000),
      title,
      body,
      details,
      uiLocalNotificationDate: scheduledTime,
      payload: payload,
    );
  }

  // Cancel notifications
  Future<void> cancelNotification(int id) async {
    await _notifications.cancel(id);
  }

  Future<void> cancelAllNotifications() async {
    await _notifications.cancelAll();
  }

  // Get pending notifications
  Future<List<PendingNotificationRequest>> getPendingNotifications() async {
    return await _notifications.pendingNotificationRequests();
  }

  // Badge management
  Future<void> setBadge(int count) async {
    // This would require additional packages for badge management
    // For now, just log
    if (kDebugMode) {
      print('Setting badge to: $count');
    }
  }

  Future<void> clearBadge() async {
    await setBadge(0);
  }

  // Push notification preferences
  Future<void> setPushNotificationEnabled(bool enabled) async {
    await _prefs.setBool('push_notifications_enabled', enabled);
    
    if (enabled) {
      // Re-register for push notifications
      await _initFirebaseMessaging();
    } else {
      // Unregister from push notifications
      await FirebaseMessaging.instance.deleteToken();
      await _prefs.remove('fcm_token');
    }
  }

  Future<bool> isPushNotificationEnabled() async {
    return _prefs.getBool('push_notifications_enabled') ?? true;
  }

  // Notification categories
  Future<void> setNotificationPreference(String category, bool enabled) async {
    await _prefs.setBool('notification_$category', enabled);
  }

  Future<bool> getNotificationPreference(String category) async {
    return _prefs.getBool('notification_$category') ?? true;
  }

  // In-app notifications
  void showInAppNotification({
    required String title,
    required String message,
    NotificationType type = NotificationType.info,
    Duration duration = const Duration(seconds: 3),
  }) {
    // This would show a custom in-app notification
    // For now, just log
    if (kDebugMode) {
      print('In-app notification: $title - $message');
    }
  }

  // Order notifications
  Future<void> notifyOrderStatus(String orderId, String status) async {
    final title = 'Order Update';
    final body = 'Your order #$orderId is now $status';
    
    await showLocalNotification(
      title: title,
      body: body,
      payload: jsonEncode({'type': 'order', 'orderId': orderId}),
    );
  }

  // Promotional notifications
  Future<void> notifyPromotion(String title, String message, {String? imageUrl}) async {
    await showLocalNotification(
      title: title,
      body: message,
      payload: jsonEncode({'type': 'promotion'}),
    );
  }

  // Security notifications
  Future<void> notifySecurity(String message) async {
    await showLocalNotification(
      title: 'Security Alert',
      body: message,
      payload: jsonEncode({'type': 'security'}),
    );
  }

  // Stream of notification taps
  Stream<NotificationResponse> get notificationTaps => _notificationController.stream;

  // Get notification history
  Future<List<Map<String, dynamic>>> getNotificationHistory() async {
    final historyJson = _prefs.getString('notification_history');
    if (historyJson != null) {
      final List<dynamic> history = jsonDecode(historyJson);
      return history.cast<Map<String, dynamic>>();
    }
    return [];
  }

  Future<void> _saveNotificationToHistory(Map<String, dynamic> notification) async {
    final history = await getNotificationHistory();
    history.insert(0, notification);
    
    // Keep only last 50 notifications
    if (history.length > 50) {
      history.removeRange(50, history.length);
    }
    
    await _prefs.setString('notification_history', jsonEncode(history));
  }

  Future<void> clearNotificationHistory() async {
    await _prefs.remove('notification_history');
  }

  // Get notification settings
  Future<Map<String, bool>> getNotificationSettings() async {
    return {
      'push': await isPushNotificationEnabled(),
      'orders': await getNotificationPreference('orders'),
      'promotions': await getNotificationPreference('promotions'),
      'security': await getNotificationPreference('security'),
      'updates': await getNotificationPreference('updates'),
    };
  }

  bool get isInitialized => _isInitialized;
  String? get fcmToken => _fcmToken;
}

enum NotificationType {
  info,
  success,
  warning,
  error,
  order,
  promotion,
  security,
}
