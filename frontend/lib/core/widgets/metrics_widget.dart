import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/api_service.dart';

class MetricsWidget extends ConsumerStatefulWidget {
  const MetricsWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<MetricsWidget> createState() => _MetricsWidgetState();
}

class _MetricsWidgetState extends ConsumerState<MetricsWidget> {
  Map<String, dynamic>? _metrics;
  bool _isLoading = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadMetrics();
    _refreshTimer = Timer.periodic(const Duration(seconds: 10), (_) => _loadMetrics());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadMetrics() async {
    setState(() => _isLoading = true);
    
    try {
      final apiService = ref.read(apiServiceProvider);
      final metrics = await apiService.getMetrics();
      setState(() {
        _metrics = metrics['data'];
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
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
                const Icon(Icons.analytics, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'API Metrics',
                    style: Theme.of(context).textTheme.titleMedium,
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
                    onPressed: _loadMetrics,
                    tooltip: 'Refresh Metrics',
                  ),
              ],
            ),
            const SizedBox(height: 16),
            if (_metrics != null) ...[
              _buildMetricRow('Total Requests', '${_metrics!['requests'] ?? 0}'),
              _buildMetricRow('Error Rate', '${_metrics!['errorRate'] ?? '0.0'}%'),
              _buildMetricRow('Avg Response Time', '${_metrics!['averageResponseTime'] ?? 0}ms'),
              _buildMetricRow('Active Connections', '${_metrics!['activeConnections'] ?? 0}'),
              _buildMetricRow('Uptime', _formatUptime(_metrics!['uptime'] ?? 0)),
              const SizedBox(height: 16),
              _buildMemoryUsage(),
              const SizedBox(height: 16),
              _buildCpuUsage(),
            ] else if (!_isLoading) ...[
                const Center(
                  child: Text('Unable to load metrics'),
                ),
              ],
          ],
        ),
      ),
    );
  }

  Widget _buildMetricRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          Text(
            value,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemoryUsage() {
    final memory = _metrics!['memory'] as Map<String, dynamic>?;
    if (memory == null) return const SizedBox();
    
    final used = (memory['used'] as String?) ?? '0MB';
    final total = (memory['total'] as String?) ?? '0MB';
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Memory Usage',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: _calculateMemoryPercentage(used, total),
          backgroundColor: Colors.grey[300],
          valueColor: AlwaysStoppedAnimation<Color>(
            _getMemoryColor(_calculateMemoryPercentage(used, total)),
          ),
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Used: $used'),
            Text('Total: $total'),
          ],
        ),
      ],
    );
  }

  Widget _buildCpuUsage() {
    final cpu = _metrics!['cpu'] as Map<String, dynamic>?;
    if (cpu == null) return const SizedBox();
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'CPU Usage',
          style: Theme.of(context).textTheme.titleSmall,
        ),
        const SizedBox(height: 8),
        LinearProgressIndicator(
          value: 0.3, // Placeholder - would calculate actual CPU usage
          backgroundColor: Colors.grey[300],
          valueColor: const AlwaysStoppedAnimation<Color>(Colors.blue),
        ),
        const SizedBox(height: 4),
        Text('CPU: 30%'), // Placeholder
      ],
    );
  }

  double _calculateMemoryPercentage(String used, String total) {
    try {
      final usedMB = double.parse(used.replaceAll('MB', ''));
      final totalMB = double.parse(total.replaceAll('MB', ''));
      return usedMB / totalMB;
    } catch (e) {
      return 0.0;
    }
  }

  Color _getMemoryColor(double percentage) {
    if (percentage < 0.5) return Colors.green;
    if (percentage < 0.8) return Colors.orange;
    return Colors.red;
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
