import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/notification_service.dart';

class NotificationWidget extends ConsumerStatefulWidget {
  const NotificationWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<NotificationWidget> createState() => _NotificationWidgetState();
}

class _NotificationWidgetState extends ConsumerState<NotificationWidget> {
  List<Map<String, dynamic>> _notifications = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    setState(() => _isLoading = true);
    
    try {
      final notificationService = ref.read(notificationServiceProvider);
      final history = await notificationService.getNotificationHistory();
      setState(() {
        _notifications = history;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _markAsRead(int index) async {
    setState(() {
      _notifications[index]['read'] = true;
    });
  }

  Future<void> _markAllAsRead() async {
    setState(() {
      for (final notification in _notifications) {
        notification['read'] = true;
      }
    });
  }

  Future<void> _clearAll() async {
    final notificationService = ref.read(notificationServiceProvider);
    await notificationService.clearNotificationHistory();
    setState(() {
      _notifications.clear();
    });
  }

  IconData _getNotificationIcon(String type) {
    switch (type) {
      case 'order':
        return Icons.shopping_bag;
      case 'promotion':
        return Icons.local_offer;
      case 'security':
        return Icons.security;
      case 'info':
      default:
        return Icons.info;
    }
  }

  Color _getNotificationColor(String type) {
    switch (type) {
      case 'order':
        return Colors.blue;
      case 'promotion':
        return Colors.green;
      case 'security':
        return Colors.red;
      case 'info':
      default:
        return Colors.grey;
    }
  }

  String _formatTimestamp(String timestamp) {
    final dateTime = DateTime.parse(timestamp);
    final now = DateTime.now();
    final difference = now.difference(dateTime);
    
    if (difference.inDays > 0) {
      return '${difference.inDays}d ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours}h ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes}m ago';
    } else {
      return 'Just now';
    }
  }

  @override
  Widget build(BuildContext context) {
    final unreadCount = _notifications.where((n) => n['read'] != true).length;
    
    return Card(
      margin: const EdgeInsets.all(8),
      child: Column(
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(Icons.notifications, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Notifications',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                if (unreadCount > 0)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.error,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '$unreadCount',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                PopupMenuButton<String>(
                  onSelected: (value) {
                    switch (value) {
                      case 'mark_all_read':
                        _markAllAsRead();
                        break;
                      case 'clear_all':
                        _clearAll();
                        break;
                    }
                  },
                  itemBuilder: (context) => [
                    const PopupMenuItem(
                      value: 'mark_all_read',
                      child: Row(
                        children: [
                          const Icon(Icons.mark_email_read),
                          const SizedBox(width: 8),
                          const Text('Mark all as read'),
                        ],
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'clear_all',
                      child: Row(
                        children: [
                          const Icon(Icons.clear_all),
                          const SizedBox(width: 8),
                          const Text('Clear all'),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Divider(),
          
          // Notifications list
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _notifications.isEmpty
                    ? const Center(
                        child: Text('No notifications'),
                      )
                    : ListView.builder(
                        itemCount: _notifications.length,
                        itemBuilder: (context, index) {
                          final notification = _notifications[index];
                          final isRead = notification['read'] == true;
                          final type = notification['type'] as String? ?? 'info';
                          
                          return ListTile(
                            leading: CircleAvatar(
                              backgroundColor: _getNotificationColor(type).withOpacity(0.1),
                              child: Icon(
                                _getNotificationIcon(type),
                                color: _getNotificationColor(type),
                                size: 20,
                              ),
                            ),
                            title: Text(
                              notification['title'] ?? 'Notification',
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: isRead ? FontWeight.normal : FontWeight.bold,
                              ),
                            ),
                            subtitle: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  notification['body'] ?? '',
                                  style: Theme.of(context).textTheme.bodySmall,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _formatTimestamp(notification['timestamp'] ?? ''),
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                            trailing: isRead
                                ? const Icon(Icons.mark_email_read, color: Colors.grey)
                                : const Icon(Icons.mark_email_unread, color: Colors.blue),
                            onTap: () => _markAsRead(index),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
