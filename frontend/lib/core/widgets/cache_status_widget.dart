import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/cache_service.dart';

class CacheStatusWidget extends ConsumerStatefulWidget {
  const CacheStatusWidget({Key? key}) : super(key: key);

  @override
  ConsumerState<CacheStatusWidget> createState() => _CacheStatusWidgetState();
}

class _CacheStatusWidgetState extends ConsumerState<CacheStatusWidget> {
  Map<String, dynamic>? _cacheStats;
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadCacheStats();
  }

  Future<void> _loadCacheStats() async {
    setState(() => _isLoading = true);
    
    try {
      final cacheService = ref.read(cacheServiceProvider);
      final stats = await cacheService.getCacheStats();
      setState(() {
        _cacheStats = stats;
        _isLoading = false;
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _clearCache() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear Cache'),
        content: const Text('Are you sure you want to clear all cached data?'),
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
        final cacheService = ref.read(cacheServiceProvider);
        await cacheService.clear();
        await _loadCacheStats();
        
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cache cleared successfully')),
        );
      } catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to clear cache: $e')),
        );
      }
    }
  }

  Future<void> _clearExpiredCache() async {
    try {
      final cacheService = ref.read(cacheServiceProvider);
      await cacheService.clearExpiredCache();
      await _loadCacheStats();
      
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Expired cache cleared')),
      );
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to clear expired cache: $e')),
      );
    }
  }

  String _formatBytes(int bytes) {
    if (bytes < 1024) {
      return '${bytes}B';
    } else if (bytes < 1024 * 1024) {
      return '${(bytes / 1024).toStringAsFixed(1)}KB';
    } else {
      return '${(bytes / (1024 * 1024)).toStringAsFixed(1)}MB';
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
                const Icon(Icons.storage, size: 24),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Cache Status',
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
                        case 'clear_all':
                          _clearCache();
                          break;
                        case 'clear_expired':
                          _clearExpiredCache();
                          break;
                      }
                    },
                    itemBuilder: (context) => [
                      const PopupMenuItem(
                        value: 'clear_all',
                        child: Row(
                          children: [
                            const Icon(Icons.clear_all),
                            const SizedBox(width: 8),
                            const Text('Clear All'),
                          ],
                        ),
                      ),
                      const PopupMenuItem(
                        value: 'clear_expired',
                        child: Row(
                          children: [
                            const Icon(Icons.cleaning_services),
                            const SizedBox(width: 8),
                            const Text('Clear Expired'),
                          ],
                        ),
                      ),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 16),
            
            if (_cacheStats != null) ...[
              _buildStatRow('Total Keys', '${_cacheStats!['totalKeys'] ?? 0}'),
              _buildStatRow('Cache Size', _formatBytes(_cacheStats!['cacheSize'] ?? 0)),
              if (_cacheStats!['lastCleared'] != null)
                _buildStatRow(
                  'Last Cleared',
                  _formatDateTime(_cacheStats!['lastCleared']),
                ),
              const SizedBox(height: 16),
              
              // Cache breakdown
              Text(
                'Cache Breakdown',
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(height: 8),
              _buildCacheBreakdown(),
            ] else if (!_isLoading) ...[
                const Center(
                  child: Text('Unable to load cache stats'),
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

  Widget _buildCacheBreakdown() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          _buildCacheItem(
            'Products',
            Icons.shopping_bag,
            Colors.blue,
            45, // Placeholder count
          ),
          _buildCacheItem(
            'User Data',
            Icons.person,
            Colors.green,
            12, // Placeholder count
          ),
          _buildCacheItem(
            'Images',
            Icons.image,
            Colors.orange,
            128, // Placeholder count
          ),
        ],
      ),
    );
  }

  Widget _buildCacheItem(String label, IconData icon, Color color, int count) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Icon(icon, color: color, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              '$count',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: color,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  String _formatDateTime(String dateTimeString) {
    try {
      final dateTime = DateTime.parse(dateTimeString);
      final now = DateTime.now();
      final difference = now.difference(dateTime);
      
      if (difference.inDays > 0) {
        return '${difference.inDays} days ago';
      } else if (difference.inHours > 0) {
        return '${difference.inHours} hours ago';
      } else if (difference.inMinutes > 0) {
        return '${difference.inMinutes} minutes ago';
      } else {
        return 'Just now';
      }
    } catch (e) {
      return dateTimeString;
    }
  }
}
