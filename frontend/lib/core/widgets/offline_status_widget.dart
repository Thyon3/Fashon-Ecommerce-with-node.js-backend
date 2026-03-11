import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/offline_service.dart';

class OfflineStatusWidget extends ConsumerStatefulWidget {
  const OfflineStatusWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<OfflineStatusWidget> createState() => _OfflineStatusWidgetState();
}

class _OfflineStatusWidgetState extends ConsumerState<OfflineStatusWidget> {
  Map<String, dynamic>? _stats;
  bool _isLoading = false;
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _loadStats();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _loadStats());
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadStats() async {
    setState(() => _isLoading = true);
    
    try {
      final offlineService = OfflineService();
      await offlineService.init();
      final stats = await offlineService.getOfflineStats();
      setState(() {
        _stats = stats;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _syncNow() async {
    try {
      final offlineService = OfflineService();
      await offlineService.init();
      final pending = await offlineService.getPendingOperations();
      
      // In a real implementation, sync with backend
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Syncing ${pending.length} pending operations...')),
      );
      
      await _loadStats();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Sync failed: $e')),
      );
    }
  }

  Future<void> _clearOfflineData() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Offline Data'),
        content: const Text('Are you sure you want to clear all offline data?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text('Clear'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      try {
        final offlineService = OfflineService();
        await offlineService.init();
        await offlineService.clearOfflineData();
        await offlineService.clearQueue();
        await _loadStats();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Offline data cleared')),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to clear data: $e')),
        );
      }
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
                const Icon(Icons.cloud_off, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Offline Status',
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
                  PopupMenuButton<String>(
                    onSelected: (value) {
                      switch (value) {
                        case 'sync':
                          _syncNow();
                          break;
                        case 'clear':
                          _clearOfflineData();
                          break;
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'sync',
                        child: Row(
                          children: [
                            const Icon(Icons.sync),
                            const SizedBox(width: 8),
                            const Text('Sync Now'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'clear',
                        child: Row(
                          children: [
                            const Icon(Icons.clear_all),
                            const SizedBox(width: 8),
                            const Text('Clear Data'),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 16),
            
            if (_stats != null) ...[
              _buildStatRow('Total Operations', '${_stats!['total_operations'] ?? 0}'),
              _buildStatRow('Pending Operations', '${_stats!['pending_operations'] ?? 0}'),
              _buildStatRow('Completed Operations', '${_stats!['completed_operations'] ?? 0}'),
              _buildStatRow('Failed Operations', '${_stats!['failed_operations'] ?? 0}'),
              _buildStatRow('Offline Data Items', '${_stats!['offline_data_count'] ?? 0}'),
              const SizedBox(height: 16),
              
              // Sync progress
              if (_stats!['pending_operations'] > 0) ...[
                Text(
                  'Sync Progress',
                  style: Theme.of(context).textTheme.titleSmall,
                ),
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: (_stats!['completed_operations'] ?? 0) / 
                         (_stats!['total_operations'] ?? 1),
                  backgroundColor: Colors.grey[300],
                  valueColor: AlwaysStoppedAnimation<Color>(
                    _getSyncStatusColor(_stats!),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${(_stats!['completed_operations'] ?? 0)} of ${_stats!['total_operations']} synced',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ] else if (!_isLoading) ...[
                const Center(
                  child: Text('Unable to load offline status'),
                ),
              ],
          ],
        ),
      ),
    );
  }

  Widget _buildStatRow(String label, String value) {
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

  Color _getSyncStatusColor(Map<String, dynamic> stats) {
    final pending = stats['pending_operations'] ?? 0;
    final failed = stats['failed_operations'] ?? 0;
    
    if (failed > 0) return Colors.red;
    if (pending > 0) return Colors.orange;
    return Colors.green;
  }
}
