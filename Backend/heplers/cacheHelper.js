const NodeCache = require('node-cache');

// Create cache instances
const productCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 minutes
const categoryCache = new NodeCache({ stdTTL: 600, checkperiod: 120 }); // 10 minutes
const userCache = new NodeCache({ stdTTL: 1800, checkperiod: 300 }); // 30 minutes
const searchCache = new NodeCache({ stdTTL: 120, checkperiod: 60 }); // 2 minutes

class CacheHelper {
  // Get cached data
  static get(cacheType, key) {
    const cache = this.getCacheInstance(cacheType);
    return cache.get(key);
  }

  // Set cached data
  static set(cacheType, key, value, ttl) {
    const cache = this.getCacheInstance(cacheType);
    return cache.set(key, value, ttl);
  }

  // Delete cached data
  static del(cacheType, key) {
    const cache = this.getCacheInstance(cacheType);
    return cache.del(key);
  }

  // Clear all cache
  static flush(cacheType) {
    const cache = this.getCacheInstance(cacheType);
    return cache.flushAll();
  }

  // Get cache instance
  static getCacheInstance(cacheType) {
    switch (cacheType) {
      case 'product':
        return productCache;
      case 'category':
        return categoryCache;
      case 'user':
        return userCache;
      case 'search':
        return searchCache;
      default:
        return productCache;
    }
  }

  // Get cache statistics
  static getStats(cacheType) {
    const cache = this.getCacheInstance(cacheType);
    return cache.getStats();
  }

  // Cache middleware factory
  static middleware(cacheType, ttl) {
    return (req, res, next) => {
      const cacheKey = this.generateCacheKey(req);
      const cachedData = this.get(cacheType, cacheKey);

      if (cachedData) {
        return res.status(200).json({
          ...cachedData,
          cached: true,
          cacheTimestamp: new Date().toISOString()
        });
      }

      // Override res.json to cache the response
      const originalJson = res.json;
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode === 200) {
          CacheHelper.set(cacheType, cacheKey, data, ttl);
        }
        return originalJson.call(this, data);
      };

      next();
    };
  }

  // Generate cache key from request
  static generateCacheKey(req) {
    const { method, originalUrl, query } = req;
    const queryString = new URLSearchParams(query).toString();
    return `${method}:${originalUrl}:${queryString}`;
  }

  // Invalidate cache by pattern
  static invalidateByPattern(cacheType, pattern) {
    const cache = this.getCacheInstance(cacheType);
    const keys = cache.keys();
    
    keys.forEach(key => {
      if (key.includes(pattern)) {
        cache.del(key);
      }
    });
  }

  // Product-specific cache operations
  static cacheProduct(productId, productData) {
    const key = `product:${productId}`;
    return this.set('product', key, productData, 300); // 5 minutes
  }

  static getCachedProduct(productId) {
    const key = `product:${productId}`;
    return this.get('product', key);
  }

  static invalidateProduct(productId) {
    const key = `product:${productId}`;
    this.del('product', key);
    
    // Also invalidate related cache entries
    this.invalidateByPattern('product', productId);
    this.invalidateByPattern('search', productId);
  }

  // Category-specific cache operations
  static cacheCategory(categoryId, categoryData) {
    const key = `category:${categoryId}`;
    return this.set('category', key, categoryData, 600); // 10 minutes
  }

  static getCachedCategory(categoryId) {
    const key = `category:${categoryId}`;
    return this.get('category', key);
  }

  static invalidateCategory(categoryId) {
    const key = `category:${categoryId}`;
    this.del('category', key);
    
    // Invalidate related cache entries
    this.invalidateByPattern('category', categoryId);
    this.invalidateByPattern('search', categoryId);
    this.invalidateByPattern('product', categoryId);
  }

  // User-specific cache operations
  static cacheUserProfile(userId, userData) {
    const key = `user:profile:${userId}`;
    return this.set('user', key, userData, 1800); // 30 minutes
  }

  static getCachedUserProfile(userId) {
    const key = `user:profile:${userId}`;
    return this.get('user', key);
  }

  static invalidateUserProfile(userId) {
    const key = `user:profile:${userId}`;
    this.del('user', key);
  }

  // Search cache operations
  static cacheSearch(searchQuery, searchResults) {
    const key = `search:${searchQuery}`;
    return this.set('search', key, searchResults, 120); // 2 minutes
  }

  static getCachedSearch(searchQuery) {
    const key = `search:${searchQuery}`;
    return this.get('search', key);
  }

  static invalidateSearch(pattern) {
    this.invalidateByPattern('search', pattern);
  }

  // Cache warming (pre-populate cache with frequently accessed data)
  static async warmCache() {
    try {
      // This would typically be called during application startup
      // or by a scheduled job to pre-populate cache with hot data
      
      console.log('Cache warming completed');
    } catch (error) {
      console.error('Cache warming error:', error);
    }
  }

  // Cache cleanup
  static cleanup() {
    productCache.flushAll();
    categoryCache.flushAll();
    userCache.flushAll();
    searchCache.flushAll();
    console.log('Cache cleanup completed');
  }

  // Get memory usage
  static getMemoryUsage() {
    return {
      product: productCache.getStats(),
      category: categoryCache.getStats(),
      user: userCache.getStats(),
      search: searchCache.getStats()
    };
  }

  // Cache health check
  static healthCheck() {
    const stats = this.getMemoryUsage();
    const totalKeys = Object.values(stats).reduce((sum, stat) => sum + stat.keys, 0);
    const totalHits = Object.values(stats).reduce((sum, stat) => sum + stat.hits, 0);
    const totalMisses = Object.values(stats).reduce((sum, stat) => sum + stat.misses, 0);
    
    return {
      status: 'healthy',
      totalKeys,
      totalHits,
      totalMisses,
      hitRate: totalHits + totalMisses > 0 ? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2) : 0,
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = CacheHelper;
