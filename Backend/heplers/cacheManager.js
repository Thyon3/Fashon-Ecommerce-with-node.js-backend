const NodeCache = require('node-cache');

class CacheManager {
  constructor(options = {}) {
    this.cache = new NodeCache({
      stdTTL: options.ttl || 300, // 5 minutes default
      checkperiod: options.checkPeriod || 60, // Check for expired keys every minute
      useClones: false,
      deleteOnExpire: true,
      enableLegacyCallbacks: false,
      maxKeys: options.maxKeys || 1000
    });
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.cache.on('set', (key, value) => {
      console.log(`[CACHE] Set: ${key}`);
    });

    this.cache.on('del', (key, value) => {
      console.log(`[CACHE] Deleted: ${key}`);
    });

    this.cache.on('expired', (key, value) => {
      console.log(`[CACHE] Expired: ${key}`);
    });
  }

  // Set cache value
  set(key, value, ttl) {
    return this.cache.set(key, value, ttl);
  }

  // Get cache value
  get(key) {
    return this.cache.get(key);
  }

  // Get multiple values
  mget(keys) {
    return this.cache.mget(keys);
  }

  // Delete cache value
  del(key) {
    return this.cache.del(key);
  }

  // Delete multiple values
  del(keys) {
    return this.cache.del(keys);
  }

  // Check if key exists
  has(key) {
    return this.cache.has(key);
  }

  // Get all keys
  keys() {
    return this.cache.keys();
  }

  // Clear all cache
  flush() {
    return this.cache.flushAll();
  }

  // Get cache statistics
  getStats() {
    return this.cache.getStats();
  }

  // Get cache size
  size() {
    return this.cache.keys().length;
  }

  // Check if cache is empty
  isEmpty() {
    return this.size() === 0;
  }

  // Get value with fallback
  getOrSet(key, fetchFunction, ttl) {
    const cachedValue = this.get(key);
    
    if (cachedValue !== undefined) {
      return Promise.resolve(cachedValue);
    }

    return Promise.resolve(fetchFunction()).then(value => {
      this.set(key, value, ttl);
      return value;
    });
  }

  // Set with expiration callback
  setWithCallback(key, value, ttl, callback) {
    const success = this.set(key, value, ttl);
    
    if (success && callback) {
      setTimeout(() => {
        callback(key, value);
      }, ttl * 1000);
    }
    
    return success;
  }

  // Increment value
  increment(key, delta = 1) {
    return this.cache.increment(key, delta);
  }

  // Decrement value
  decrement(key, delta = 1) {
    return this.cache.decrement(key, delta);
  }

  // Get TTL for key
  getTTL(key) {
    return this.cache.getTTL(key);
  }

  // Set TTL for key
  setTTL(key, ttl) {
    return this.cache.setTTL(key, ttl);
  }

  // Get cache dump (all keys and values)
  dump() {
    return this.cache.dump();
  }

  // Load cache from dump
  load(dump) {
    return this.cache.load(dump);
  }

  // Close cache
  close() {
    this.cache.close();
  }

  // Middleware for caching API responses
  middleware(options = {}) {
    const {
      ttl = options.ttl || 300,
      keyGenerator = (req) => req.originalUrl,
      condition = () => true,
      skipCache = (req) => false
    } = options;

    return (req, res, next) => {
      // Skip cache if condition not met
      if (!condition(req) || skipCache(req)) {
        return next();
      }

      const cacheKey = keyGenerator(req);
      const cachedResponse = this.get(cacheKey);

      if (cachedResponse) {
        console.log(`[CACHE] Cache hit: ${cacheKey}`);
        res.set(cachedResponse.headers);
        return res.status(cachedResponse.status).json(cachedResponse.data);
      }

      // Override res.json to cache response
      const originalJson = res.json;
      const originalStatus = res.status;

      res.json = function(data) {
        const response = {
          status: res.statusCode,
          headers: res.getHeaders(),
          data
        };

        this.set(cacheKey, response, ttl);
        console.log(`[CACHE] Cache set: ${cacheKey}`);
        
        return originalJson.call(this, data);
      }.bind(this);

      next();
    };
  }

  // Cache invalidation pattern
  invalidatePattern(pattern) {
    const keys = this.keys();
    const regex = new RegExp(pattern);
    const keysToDelete = keys.filter(key => regex.test(key));
    
    if (keysToDelete.length > 0) {
      this.del(keysToDelete);
      console.log(`[CACHE] Invalidated ${keysToDelete.length} keys matching pattern: ${pattern}`);
    }
    
    return keysToDelete.length;
  }

  // Cache warming
  async warmCache(dataSources) {
    const results = [];
    
    for (const source of dataSources) {
      try {
        const { key, fetchFunction, ttl } = source;
        const value = await fetchFunction();
        
        this.set(key, value, ttl);
        results.push({ key, success: true });
        
        console.log(`[CACHE] Warmed: ${key}`);
      } catch (error) {
        results.push({ key: source.key, success: false, error: error.message });
        console.error(`[CACHE] Failed to warm: ${source.key}`, error);
      }
    }
    
    return results;
  }

  // Get cache health
  getHealth() {
    const stats = this.getStats();
    
    return {
      status: 'healthy',
      size: this.size(),
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hits / (stats.hits + stats.misses) * 100,
      keys: stats.keys,
      ksize: stats.ksize,
      vsize: stats.vsize
    };
  }
}

// Create singleton instance
const cacheManager = new CacheManager();

module.exports = cacheManager;
