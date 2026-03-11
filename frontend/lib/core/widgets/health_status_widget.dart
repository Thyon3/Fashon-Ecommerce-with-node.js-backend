import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

class HealthStatusWidget extends ConsumerStatefulWidget {
  const HealthStatusWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<HealthStatusWidget> createState() => _HealthStatusWidgetState();
}

class _HealthStatusWidgetState extends ConsumerState<HealthStatusWidget> {
  Map<String, dynamic>? _healthData;
  bool _isLoading = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _checkHealth();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _checkHealth());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _checkHealth() async {
    setState(() => _isLoading = true);
    
    try {
      final apiService = ref.read(apiServiceProvider);
      final health = await apiService.checkHealth();
      setState(() {
        _healthData = health;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _healthData = {'status': 'unhealthy', 'error': e.toString()};
        _isLoading = false;
      });
    }
  }

  Color _getStatusColor() {
    if (_healthData == null) return Colors.grey;
    
    final status = _healthData!['status'] as String?;
    switch (status) {
      case 'healthy':
        return Colors.green;
      case 'unhealthy':
        return Colors.red;
      case 'degraded':
        return Colors.orange;
      default:
        return Colors.grey;
    }
  }

  IconData _getStatusIcon() {
    if (_healthData == null) return Icons.help_outline;
    
    final status = _healthData!['status'] as String?;
    switch (status) {
      case 'healthy':
        return Icons.check_circle;
      case 'unhealthy':
        return Icons.error;
      case 'degraded':
        return Icons.warning;
      default:
        return Icons.help_outline;
    }
  }

  String _getStatusText() {
    if (_healthData == null) return 'Unknown';
    
    final status = _healthData!['status'] as String?;
    switch (status) {
      case 'healthy':
        return 'All Systems Operational';
      case 'unhealthy':
        return 'System Issues Detected';
      case 'degraded':
        return 'Partial System Issues';
      default:
        return 'Unknown Status';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.all(8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  _getStatusIcon(),
                  color: _getStatusColor(),
                  size: 24,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'System Health',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      Text(
                        _getStatusText(),
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: _getStatusColor(),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
                if (_isLoading)
                  const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                else
                  IconButton(
                    icon: const Icon(Icons.refresh),
                    onPressed: _checkHealth,
                    tooltip: 'Refresh Health Status',
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_healthData != null && _healthData!['checks'] != null) ...[
              Text(
                'Service Status:',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              ...(_healthData!['checks'] as Map<String, dynamic>).entries.map((entry) {
                final checkName = entry.key;
                final checkData = entry.value as Map<String, dynamic>;
                final isHealthy = checkData['status'] == 'healthy';
                
                return Padding(
                  padding: const EdgeInsets.symmetric(vertical: 2),
                  child: Row(
                    children: [
                      Icon(
                        isHealthy ? Icons.check_circle : Icons.error,
                        size: 16,
                        color: isHealthy ? Colors.green : Colors.red,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _formatCheckName(checkName),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      if (checkData['error'] != null)
                        Expanded(
                          child: Text(
                            checkData['error'],
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Colors.red,
                            ),
                            textAlign: TextAlign.end,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                  ),
                );
              }).toList(),
            ],
            if (_healthData != null && _healthData!['uptime'] != null) ...[
              const SizedBox(height: 8),
              Text(
                'Uptime: ${_formatUptime(_healthData!['uptime'])}',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ],
        ),
      ),
    );
  }

  String _formatCheckName(String checkName) {
    switch (checkName) {
      case 'database':
        return 'Database';
      case 'memory':
        return 'Memory Usage';
      case 'disk':
        return 'Disk Space';
      case 'api':
        return 'API Services';
      default:
        return checkName.split('_').map((word) => 
          word[0].toUpperCase() + word.substring(1)
        ).join(' ');
    }
  }

  String _formatUptime(int uptimeSeconds) {
    final days = uptimeSeconds ~/ (24 * 60 * 60);
    final hours = (uptimeSeconds % (24 * 60 * 60)) ~/ (60 * 60);
    final minutes = (uptimeSeconds % (60 * 60)) ~/ 60;
    
    if (days > 0) {
      return '${days}d ${hours}h ${minutes}m';
    } else if (hours > 0) {
      return '${hours}h ${minutes}m';
    } else {
      return '${minutes}m';
    }
  }
}
