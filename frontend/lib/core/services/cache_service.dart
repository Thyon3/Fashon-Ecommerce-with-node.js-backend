import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:hive/hive.dart';
import 'package:hive_flutter/hive_flutter.dart';

class CacheService {
  static const String _cacheBox = 'app_cache';
  static const String _favoritesKey = 'favorites';
  static const String _cartKey = 'cart';
  static const String _recentlyViewedKey = 'recently_viewed';
  static const String _searchHistoryKey = 'search_history';
  static const String _userPreferencesKey = 'user_preferences';

  late Box<String> _cacheBox;
  late SharedPreferences _prefs;

  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
    await Hive.initFlutter();
    _cacheBox = await Hive.openBox<String>(_cacheBox);
  }

  // Generic cache methods
  Future<void> set(String key, dynamic value, {Duration? ttl}) async {
    final cacheData = {
      'value': value,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'ttl': ttl?.inMilliseconds,
    };
    
    await _cacheBox.put(key, jsonEncode(cacheData));
  }

  Future<T?> get<T>(String key) async {
    final cachedData = _cacheBox.get(key);
    if (cachedData == null) return null;

    try {
      final data = jsonDecode(cachedData) as Map<String, dynamic>;
      final timestamp = data['timestamp'] as int;
      final ttl = data['ttl'] as int?;
      
      if (ttl != null) {
        final now = DateTime.now().millisecondsSinceEpoch;
        if (now - timestamp > ttl) {
          await _cacheBox.delete(key);
          return null;
        }
      }
      
      return data['value'] as T?;
    } catch (e) {
      // Remove corrupted cache
      await _cacheBox.delete(key);
      return null;
    }
  }

  Future<void> remove(String key) async {
    await _cacheBox.delete(key);
  }

  Future<void> clear() async {
    await _cacheBox.clear();
  }

  // Favorites
  Future<void> addToFavorites(String productId) async {
    final favorites = await getFavorites();
    if (!favorites.contains(productId)) {
      favorites.add(productId);
      await set(_favoritesKey, favorites);
    }
  }

  Future<void> removeFromFavorites(String productId) async {
    final favorites = await getFavorites();
    favorites.remove(productId);
    await set(_favoritesKey, favorites);
  }

  Future<List<String>> getFavorites() async {
    final favorites = await get<List<String>>(_favoritesKey);
    return favorites ?? [];
  }

  Future<bool> isFavorite(String productId) async {
    final favorites = await getFavorites();
    return favorites.contains(productId);
  }

  // Cart
  Future<void> addToCart(Map<String, dynamic> item) async {
    final cart = await getCart();
    final existingIndex = cart.indexWhere((cartItem) => cartItem['id'] == item['id']);
    
    if (existingIndex != -1) {
      cart[existingIndex]['quantity'] = (cart[existingIndex]['quantity'] ?? 1) + 1;
    } else {
      item['quantity'] = 1;
      cart.add(item);
    }
    
    await set(_cartKey, cart);
  }

  Future<void> updateCartItem(String productId, int quantity) async {
    final cart = await getCart();
    final existingIndex = cart.indexWhere((cartItem) => cartItem['id'] == productId);
    
    if (existingIndex != -1) {
      if (quantity <= 0) {
        cart.removeAt(existingIndex);
      } else {
        cart[existingIndex]['quantity'] = quantity;
      }
      await set(_cartKey, cart);
    }
  }

  Future<void> removeFromCart(String productId) async {
    final cart = await getCart();
    cart.removeWhere((cartItem) => cartItem['id'] == productId);
    await set(_cartKey, cart);
  }

  Future<void> clearCart() async {
    await remove(_cartKey);
  }

  Future<List<Map<String, dynamic>>> getCart() async {
    final cart = await get<List<Map<String, dynamic>>>(_cartKey);
    return cart ?? [];
  }

  Future<double> getCartTotal() async {
    final cart = await getCart();
    double total = 0.0;
    for (final item in cart) {
      final price = (item['price'] ?? 0.0).toDouble();
      final quantity = (item['quantity'] ?? 1).toInt();
      total += price * quantity;
    }
    return total;
  }

  Future<int> getCartItemCount() async {
    final cart = await getCart();
    int count = 0;
    for (final item in cart) {
      count += (item['quantity'] ?? 1).toInt();
    }
    return count;
  }

  // Recently viewed
  Future<void> addToRecentlyViewed(String productId) async {
    final recentlyViewed = await getRecentlyViewed();
    recentlyViewed.remove(productId); // Remove if exists
    recentlyViewed.insert(0, productId); // Add to beginning
    
    // Keep only last 20 items
    if (recentlyViewed.length > 20) {
      recentlyViewed.removeRange(20, recentlyViewed.length);
    }
    
    await set(_recentlyViewedKey, recentlyViewed);
  }

  Future<List<String>> getRecentlyViewed() async {
    final recentlyViewed = await get<List<String>>(_recentlyViewedKey);
    return recentlyViewed ?? [];
  }

  // Search history
  Future<void> addToSearchHistory(String query) async {
    if (query.trim().isEmpty) return;
    
    final searchHistory = await getSearchHistory();
    searchHistory.remove(query); // Remove if exists
    searchHistory.insert(0, query); // Add to beginning
    
    // Keep only last 10 items
    if (searchHistory.length > 10) {
      searchHistory.removeRange(10, searchHistory.length);
    }
    
    await set(_searchHistoryKey, searchHistory);
  }

  Future<List<String>> getSearchHistory() async {
    final searchHistory = await get<List<String>>(_searchHistoryKey);
    return searchHistory ?? [];
  }

  Future<void> clearSearchHistory() async {
    await remove(_searchHistoryKey);
  }

  // User preferences
  Future<void> setUserPreference(String key, dynamic value) async {
    final prefs = await get<Map<String, dynamic>>(_userPreferencesKey) ?? {};
    prefs[key] = value;
    await set(_userPreferencesKey, prefs);
  }

  Future<T?> getUserPreference<T>(String key) async {
    final prefs = await get<Map<String, dynamic>>(_userPreferencesKey);
    return prefs?[key] as T?;
  }

  // Cache statistics
  Future<Map<String, dynamic>> getCacheStats() async {
    return {
      'totalKeys': _cacheBox.length,
      'cacheSize': await _getCacheSize(),
      'lastCleared': _prefs.getString('last_cache_cleared'),
    };
  }

  Future<int> _getCacheSize() async {
    int size = 0;
    for (final key in _cacheBox.keys) {
      final value = _cacheBox.get(key);
      if (value != null) {
        size += value.length;
      }
    }
    return size;
  }

  Future<void> clearExpiredCache() async {
    final now = DateTime.now().millisecondsSinceEpoch;
    final keysToDelete = <String>[];
    
    for (final key in _cacheBox.keys) {
      final cachedData = _cacheBox.get(key);
      if (cachedData == null) continue;
      
      try {
        final data = jsonDecode(cachedData) as Map<String, dynamic>;
        final ttl = data['ttl'] as int?;
        
        if (ttl != null && now - data['timestamp'] > ttl) {
          keysToDelete.add(key);
        }
      } catch (e) {
        keysToDelete.add(key); // Remove corrupted entries
      }
    }
    
    for (final key in keysToDelete) {
      await _cacheBox.delete(key);
    }
    
    await _prefs.setString('last_cache_cleared', DateTime.now().toIso8601String());
  }
}

final cacheServiceProvider = Provider((ref) => CacheService());
