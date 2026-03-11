import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'api_service.dart';

class SearchService {
  final ApiService _apiService;
  final List<String> _searchHistory = [];
  Timer? _debounceTimer;
  
  SearchService(this._apiService);

  Future<Map<String, dynamic>> searchProducts(String query, {
    int page = 1,
    int limit = 20,
    String? category,
    String? sortBy,
    String? sortOrder,
    double? minPrice,
    double? maxPrice,
  }) async {
    try {
      final params = <String, dynamic>{
        'q': query,
        'page': page,
        'limit': limit,
      };
      
      if (category != null) params['category'] = category;
      if (sortBy != null) params['sort'] = sortBy;
      if (sortOrder != null) params['order'] = sortOrder;
      if (minPrice != null) params['min_price'] = minPrice;
      if (maxPrice != null) params['max_price'] = maxPrice;
      
      final response = await _apiService.get('/search/products', query: params);
      
      // Add to search history
      await _addToSearchHistory(query);
      
      return {
        'success': true,
        'data': response.data['data'],
        'pagination': response.data['pagination'],
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  Future<Map<String, dynamic>> searchSuggestions(String query) async {
    try {
      final response = await _apiService.get('/search/suggestions', query: {
        'q': query,
        'limit': 10,
      });
      
      return {
        'success': true,
        'suggestions': response.data['suggestions'] ?? [],
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'suggestions': <String>[],
      };
    }
  }

  Future<Map<String, dynamic>> getPopularSearches() async {
    try {
      final response = await _apiService.get('/search/popular');
      
      return {
        'success': true,
        'popular': response.data['popular'] ?? [],
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'popular': <String>[],
      };
    }
  }

  Future<Map<String, dynamic>> getTrendingProducts() async {
    try {
      final response = await _apiService.get('/search/trending');
      
      return {
        'success': true,
        'trending': response.data['trending'] ?? [],
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'trending': <dynamic>[],
      };
    }
  }

  Future<Map<String, dynamic>> advancedSearch({
    String? query,
    List<String>? categories,
    List<String>? brands,
    List<String>? sizes,
    List<String>? colors,
    double? minPrice,
    double? maxPrice,
    bool? inStock,
    String? sortBy,
    String? sortOrder,
    int page = 1,
    int limit = 20,
  }) async {
    try {
      final params = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      
      if (query != null && query.isNotEmpty) params['q'] = query;
      if (categories != null && categories.isNotEmpty) params['categories'] = categories.join(',');
      if (brands != null && brands.isNotEmpty) params['brands'] = brands.join(',');
      if (sizes != null && sizes.isNotEmpty) params['sizes'] = sizes.join(',');
      if (colors != null && colors.isNotEmpty) params['colors'] = colors.join(',');
      if (minPrice != null) params['min_price'] = minPrice;
      if (maxPrice != null) params['max_price'] = maxPrice;
      if (inStock != null) params['in_stock'] = inStock;
      if (sortBy != null) params['sort'] = sortBy;
      if (sortOrder != null) params['order'] = sortOrder;
      
      final response = await _apiService.get('/search/advanced', query: params);
      
      return {
        'success': true,
        'data': response.data['data'],
        'pagination': response.data['pagination'],
        'filters': response.data['filters'],
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
      };
    }
  }

  Future<Map<String, dynamic>> searchByImage(String imagePath) async {
    try {
      final formData = FormData.fromMap({
        'image': await MultipartFile.fromFile(imagePath),
      });
      
      final response = await _apiService.upload('/search/image', formData);
      
      return {
        'success': true,
        'results': response.data['results'] ?? [],
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'results': <dynamic>[],
      };
    }
  }

  Future<Map<String, dynamic>> getSearchFilters() async {
    try {
      final response = await _apiService.get('/search/filters');
      
      return {
        'success': true,
        'filters': response.data['filters'] ?? {},
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'filters': {},
      };
    }
  }

  // Debounced search
  void debouncedSearch(
    String query,
    Function(String) onSearch, {
    Duration delay = const Duration(milliseconds: 500),
  }) {
    _debounceTimer?.cancel();
    
    _debounceTimer = Timer(delay, () {
      if (query.trim().isNotEmpty) {
        onSearch(query);
      }
    });
  }

  // Search history management
  Future<void> _addToSearchHistory(String query) async {
    if (query.trim().isEmpty) return;
    
    final prefs = await SharedPreferences.getInstance();
    final history = prefs.getStringList('search_history') ?? [];
    
    // Remove if exists and add to beginning
    history.remove(query);
    history.insert(0, query);
    
    // Keep only last 20 searches
    if (history.length > 20) {
      history.removeRange(20, history.length);
    }
    
    await prefs.setStringList('search_history', history);
  }

  Future<List<String>> getSearchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getStringList('search_history') ?? [];
  }

  Future<void> clearSearchHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('search_history');
  }

  Future<void> removeFromSearchHistory(String query) async {
    final prefs = await SharedPreferences.getInstance();
    final history = prefs.getStringList('search_history') ?? [];
    history.remove(query);
    await prefs.setStringList('search_history', history);
  }

  // Saved searches
  Future<void> saveSearch(String query, Map<String, dynamic> filters) async {
    final prefs = await SharedPreferences.getInstance();
    final savedSearches = prefs.getStringList('saved_searches') ?? [];
    
    final searchData = {
      'query': query,
      'filters': filters,
      'timestamp': DateTime.now().toIso8601String(),
    };
    
    savedSearches.add(jsonEncode(searchData));
    
    // Keep only last 10 saved searches
    if (savedSearches.length > 10) {
      savedSearches.removeRange(10, savedSearches.length);
    }
    
    await prefs.setStringList('saved_searches', savedSearches);
  }

  Future<List<Map<String, dynamic>>> getSavedSearches() async {
    final prefs = await SharedPreferences.getInstance();
    final savedSearches = prefs.getStringList('saved_searches') ?? [];
    
    return savedSearches.map((search) {
      try {
        return jsonDecode(search) as Map<String, dynamic>;
      } catch (e) {
        return null;
      }
    }).where((search) => search != null).cast<Map<String, dynamic>>().toList();
  }

  Future<void> removeSavedSearch(String query) async {
    final prefs = await SharedPreferences.getInstance();
    final savedSearches = prefs.getStringList('saved_searches') ?? [];
    
    final filteredSearches = savedSearches.where((search) {
      try {
        final searchData = jsonDecode(search) as Map<String, dynamic>;
        return searchData['query'] != query;
      } catch (e) {
        return true; // Remove corrupted entries
      }
    }).toList();
    
    await prefs.setStringList('saved_searches', filteredSearches);
  }

  // Search analytics
  Future<Map<String, dynamic>> getSearchAnalytics() async {
    try {
      final response = await _apiService.get('/search/analytics');
      
      return {
        'success': true,
        'analytics': response.data['analytics'] ?? {},
      };
    } catch (e) {
      return {
        'success': false,
        'error': e.toString(),
        'analytics': {},
      };
    }
  }

  void dispose() {
    _debounceTimer?.cancel();
  }
}

final searchServiceProvider = Provider((ref) {
  final apiService = ref.read(apiServiceProvider);
  return SearchService(apiService);
});
