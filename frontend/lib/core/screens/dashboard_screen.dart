import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../widgets/health_status_widget.dart';
import '../widgets/metrics_widget.dart';
import '../widgets/search_widget.dart';
import '../widgets/notification_widget.dart';
import '../widgets/cache_status_widget.dart';
import '../services/monitoring_service.dart';

class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  @override
  void initState() {
    super.initState();
    _trackScreenView();
  }

  void _trackScreenView() {
    final monitoringService = ref.read(monitoringServiceProvider);
    monitoringService.recordScreenView('dashboard');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fashon Dashboard'),
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => _showSettings(context),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search Section
            const Text(
              'Search',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            SearchWidget(
              onProductSelected: (product) {
                _showProductDetails(context, product);
              },
            ),
            const SizedBox(height: 24),
            
            // System Status Section
            const Text(
              'System Status',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const HealthStatusWidget(),
            const SizedBox(height: 24),
            
            // Metrics Section
            const Text(
              'API Metrics',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const MetricsWidget(),
            const SizedBox(height: 24),
            
            // Cache Status Section
            const Text(
              'Cache Status',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            const CacheStatusWidget(),
            const SizedBox(height: 24),
            
            // Notifications Section
            const Text(
              'Notifications',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 300,
              child: const NotificationWidget(),
            ),
            const SizedBox(height: 24),
            
            // Quick Actions Section
            const Text(
              'Quick Actions',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            _buildQuickActions(),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: 16,
      mainAxisSpacing: 16,
      childAspectRatio: 2,
      children: [
        _buildActionCard(
          'Clear Cache',
          Icons.cleaning_services,
          Colors.blue,
          () => _clearCache(),
        ),
        _buildActionCard(
          'Test Notification',
          Icons.notifications,
          Colors.green,
          () => _testNotification(),
        ),
        _buildActionCard(
          'System Health',
          Icons.health_and_safety,
          Colors.orange,
          () => _checkSystemHealth(),
        ),
        _buildActionCard(
          'View Logs',
          Icons.list_alt,
          Colors.purple,
          () => _viewLogs(),
        ),
      ],
    );
  }

  Widget _buildActionCard(String title, IconData icon, Color color, VoidCallback onTap) {
    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.all(16),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 32),
              const SizedBox(height: 8),
              Text(
                title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _clearCache() async {
    try {
      final cacheService = ref.read(cacheServiceProvider);
      await cacheService.clear();
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Cache cleared successfully')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to clear cache: $e')),
      );
    }
  }

  void _testNotification() async {
    try {
      final notificationService = ref.read(notificationServiceProvider);
      await notificationService.showLocalNotification(
        title: 'Test Notification',
        body: 'This is a test notification from Fashon',
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send notification: $e')),
      );
    }
  }

  void _checkSystemHealth() async {
    try {
      final apiService = ref.read(apiServiceProvider);
      final health = await apiService.checkHealth();
      
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          title: const Text('System Health'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Status: ${health['status'] ?? 'Unknown'}'),
              const SizedBox(height: 8),
              if (health['checks'] != null) ...[
                const Text('Service Checks:'),
                ...health['checks'].entries.map((entry) => 
                  Padding(
                    padding: const EdgeInsets.only(left: 16, top: 4),
                    child: Text('${entry.key}: ${entry.value['status']}'),
                  ),
                ),
              ],
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Close'),
            ),
          ],
        ),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to check health: $e')),
      );
    }
  }

  void _viewLogs() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Application Logs'),
        content: const Text(
          'Logs would be displayed here in a real implementation.\n'
          'This would include error logs, performance logs, and user action logs.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showProductDetails(BuildContext context, Map<String, dynamic> product) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(product['name'] ?? 'Product'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Price: \$${product['price'] ?? '0.00'}'),
            Text('Category: ${product['category'] ?? 'Unknown'}'),
            Text('Description: ${product['description'] ?? 'No description'}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showSettings(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Settings'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.notifications),
              title: const Text('Notification Settings'),
              onTap: () {
                Navigator.of(context).pop();
                _showNotificationSettings(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.storage),
              title: const Text('Cache Settings'),
              onTap: () {
                Navigator.of(context).pop();
                _showCacheSettings(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.analytics),
              title: const Text('Analytics Settings'),
              onTap: () {
                Navigator.of(context).pop();
                _showAnalyticsSettings(context);
              },
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showNotificationSettings(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Notification Settings'),
        content: const Text(
          'Notification settings would be displayed here.\n'
          'This would include push notifications, in-app notifications, etc.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showCacheSettings(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Cache Settings'),
        content: const Text(
          'Cache settings would be displayed here.\n'
          'This would include cache size, TTL settings, etc.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  void _showAnalyticsSettings(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Analytics Settings'),
        content: const Text(
          'Analytics settings would be displayed here.\n'
          'This would include data collection preferences, etc.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
}
