import 'dart:convert';
import 'dart:async';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hive/hive.dart';

class OfflineService {
  static const String _offlineQueueKey = 'offline_queue';
  static const String _syncStatusKey = 'sync_status';
  late Box<String> _offlineBox;
  bool _isInitialized = false;

  Future<void> init() async {
    _offlineBox = await Hive.openBox('offline_data');
    _isInitialized = true;
  }

  // Queue management for offline operations
  Future<void> addToQueue(Map<String, dynamic> operation) async {
    final queue = await getQueue();
    final operationWithTimestamp = {
      ...operation,
      'timestamp': DateTime.now().toIso8601String(),
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
    };
    
    queue.add(operationWithTimestamp);
    await _saveQueue(queue);
  }

  Future<List<Map<String, dynamic>>> getQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final queueJson = prefs.getString(_offlineQueueKey);
    
    if (queueJson != null) {
      try {
        final queueList = jsonDecode(queueJson) as List<dynamic>;
        return queueList.cast<Map<String, dynamic>>();
      } catch (e) {
        return [];
      }
    }
    return [];
  }

  Future<void> _saveQueue(List<Map<String, dynamic>> queue) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_offlineQueueKey, jsonEncode(queue));
  }

  Future<void> removeFromQueue(String operationId) async {
    final queue = await getQueue();
    queue.removeWhere((op) => op['id'] == operationId);
    await _saveQueue(queue);
  }

  Future<void> clearQueue() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_offlineQueueKey);
  }

  // Offline data storage
  Future<void> storeOfflineData(String key, dynamic data) async {
    if (data is String) {
      await _offlineBox.put(key, data);
    } else {
      await _offlineBox.put(key, jsonEncode(data));
    }
  }

  Future<T?> getOfflineData<T>(String key) async {
    final data = _offlineBox.get(key);
    if (data == null) return null;
    
    try {
      if (T == String) {
        return data as T?;
      } else {
        return jsonDecode(data) as T?;
      }
    } catch (e) {
      return null;
    }
  }

  Future<void> removeOfflineData(String key) async {
    await _offlineBox.delete(key);
  }

  Future<void> clearOfflineData() async {
    await _offlineBox.clear();
  }

  // Sync status management
  Future<void> setSyncStatus(String entityType, bool isSynced) async {
    final prefs = await SharedPreferences.getInstance();
    final syncStatus = prefs.getString(_syncStatusKey) ?? '{}';
    
    try {
      final statusMap = jsonDecode(syncStatus) as Map<String, dynamic>;
      statusMap[entityType] = isSynced;
      await prefs.setString(_syncStatusKey, jsonEncode(statusMap));
    } catch (e) {
      final statusMap = {entityType: isSynced};
      await prefs.setString(_syncStatusKey, jsonEncode(statusMap));
    }
  }

  Future<bool> getSyncStatus(String entityType) async {
    final prefs = await SharedPreferences.getInstance();
    final syncStatus = prefs.getString(_syncStatusKey) ?? '{}';
    
    try {
      final statusMap = jsonDecode(syncStatus) as Map<String, dynamic>;
      return statusMap[entityType] ?? false;
    } catch (e) {
      return false;
    }
  }

  // Conflict resolution
  Future<Map<String, dynamic>?> resolveConflict(
    String entityType,
    Map<String, dynamic> localData,
    Map<String, dynamic> remoteData,
  ) async {
    // Simple conflict resolution strategy: prefer remote data
    // In production, implement more sophisticated strategies
    
    final localTimestamp = DateTime.tryParse(localData['timestamp'] ?? '');
    final remoteTimestamp = DateTime.tryParse(remoteData['timestamp'] ?? '');
    
    if (localTimestamp != null && remoteTimestamp != null) {
      if (remoteTimestamp.isAfter(localTimestamp)) {
        return remoteData;
      } else {
        return localData;
      }
    }
    
    // Fallback to remote data
    return remoteData;
  }

  // Batch operations
  Future<void> batchStoreOfflineData(Map<String, dynamic> dataMap) async {
    for (final entry in dataMap.entries) {
      await storeOfflineData(entry.key, entry.value);
    }
  }

  Future<Map<String, dynamic>> batchGetOfflineData(List<String> keys) async {
    final result = <String, dynamic>{};
    
    for (final key in keys) {
      final data = await getOfflineData(key);
      if (data != null) {
        result[key] = data;
      }
    }
    
    return result;
  }

  // Cache management for offline mode
  Future<void> cacheForOffline(String url, dynamic data, {Duration? ttl}) async {
    final cacheKey = 'cache_$url';
    final cacheData = {
      'data': data,
      'timestamp': DateTime.now().toIso8601String(),
      'ttl': ttl?.inSeconds,
    };
    
    await storeOfflineData(cacheKey, cacheData);
  }

  Future<T?> getCachedData<T>(String url) async {
    final cacheKey = 'cache_$url';
    final cacheData = await getOfflineData<Map<String, dynamic>>(cacheKey);
    
    if (cacheData == null) return null;
    
    final timestamp = DateTime.tryParse(cacheData['timestamp'] ?? '');
    final ttl = cacheData['ttl'] as int?;
    
    if (timestamp != null && ttl != null) {
      final now = DateTime.now();
      final expiry = timestamp.add(Duration(seconds: ttl));
      
      if (now.isAfter(expiry)) {
        await removeOfflineData(cacheKey);
        return null;
      }
    }
    
    return cacheData['data'] as T?;
  }

  // Offline queue processing
  Future<List<Map<String, dynamic>>> getPendingOperations() async {
    final queue = await getQueue();
    return queue.where((op) => op['status'] != 'completed').toList();
  }

  Future<void> markOperationCompleted(String operationId) async {
    final queue = await getQueue();
    final operation = queue.firstWhere((op) => op['id'] == operationId);
    operation['status'] = 'completed';
    operation['completed_at'] = DateTime.now().toIso8601String();
    
    await _saveQueue(queue);
    
    // Remove completed operations after some time
    Timer(const Duration(hours: 24), () {
      removeFromQueue(operationId);
    });
  }

  Future<void> markOperationFailed(String operationId, String error) async {
    final queue = await getQueue();
    final operation = queue.firstWhere((op) => op['id'] == operationId);
    operation['status'] = 'failed';
    operation['error'] = error;
    operation['failed_at'] = DateTime.now().toIso8601String();
    operation['retry_count'] = (operation['retry_count'] ?? 0) + 1;
    
    await _saveQueue(queue);
  }

  // Statistics
  Future<Map<String, dynamic>> getOfflineStats() async {
    final queue = await getQueue();
    final pending = queue.where((op) => op['status'] != 'completed').length;
    final completed = queue.where((op) => op['status'] == 'completed').length;
    final failed = queue.where((op) => op['status'] == 'failed').length;
    
    return {
      'total_operations': queue.length,
      'pending_operations': pending,
      'completed_operations': completed,
      'failed_operations': failed,
      'offline_data_count': _offlineBox.length,
    };
  }

  // Cleanup
  Future<void> cleanupOldOfflineData({Duration maxAge = const Duration(days: 7)}) async {
    final cutoffDate = DateTime.now().subtract(maxAge);
    
    // Clean old queue items
    final queue = await getQueue();
    final filteredQueue = queue.where((op) {
      final timestamp = DateTime.tryParse(op['timestamp'] ?? '');
      return timestamp != null && timestamp.isAfter(cutoffDate);
    }).toList();
    
    await _saveQueue(filteredQueue);
    
    // Clean old cache data
    final keys = _offlineBox.keys.toList();
    for (final key in keys) {
      if (key.startsWith('cache_')) {
        final cacheData = await getOfflineData<Map<String, dynamic>>(key);
        if (cacheData != null) {
          final timestamp = DateTime.tryParse(cacheData['timestamp'] ?? '');
          if (timestamp != null && timestamp.isBefore(cutoffDate)) {
            await removeOfflineData(key);
          }
        }
      }
    }
  }

  bool get isInitialized => _isInitialized;
}
