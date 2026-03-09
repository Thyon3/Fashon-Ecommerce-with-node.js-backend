const crypto = require('crypto');

class RequestDeduplication {
  constructor() {
    this.pendingRequests = new Map();
    this.cache = new Map();
    this.cacheTimeout = 5000; // 5 seconds
    this.cleanupInterval = 10000; // 10 seconds
    this.startCleanup();
  }

  // Start cleanup timer
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.cleanupInterval);
  }

  // Generate cache key for request
  generateCacheKey(req) {
    const keyData = {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      body: req.body,
      userId: req.user?.id || 'anonymous'
    };
    
    const keyString = JSON.stringify(keyData);
    return crypto.createHash('md5').update(keyString).digest('hex');
  }

  // Middleware for request deduplication
  middleware() {
    return (req, res, next) => {
      // Only deduplicate GET requests
      if (req.method !== 'GET') {
        return next();
      }

      const cacheKey = this.generateCacheKey(req);
      
      // Check if request is already pending
      if (this.pendingRequests.has(cacheKey)) {
        console.log(`[DEDUPE] Request deduplicated: ${req.method} ${req.originalUrl}`);
        
        // Wait for the original request to complete
        this.pendingRequests.get(cacheKey).then(response => {
          res.status(response.statusCode).json(response.data);
        }).catch(error => {
          res.status(error.statusCode || 500).json(error.data);
        });
        
        return;
      }

      // Check cache
      const cached = this.cache.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        console.log(`[CACHE] Cache hit: ${req.method} ${req.originalUrl}`);
        res.status(cached.statusCode).json(cached.data);
        return;
      }

      // Create promise for this request
      const requestPromise = new Promise((resolve, reject) => {
        // Override res.json to capture response
        const originalJson = res.json;
        const originalEnd = res.end;
        let responseData = null;
        
        res.json = function(data) {
          responseData = data;
          return originalJson.call(this, data);
        };
        
        res.end = function(chunk, encoding) {
          // Cache the response
          if (res.statusCode < 400 && responseData) {
            this.cache.set(cacheKey, {
              statusCode: res.statusCode,
              data: responseData,
              timestamp: Date.now()
            });
          }
          
          // Resolve the promise
          if (res.statusCode < 400) {
            resolve({ statusCode: res.statusCode, data: responseData });
          } else {
            reject({ statusCode: res.statusCode, data: responseData });
          }
          
          // Remove from pending requests
          this.pendingRequests.delete(cacheKey);
          
          return originalEnd.call(this, chunk, encoding);
        }.bind(this);
      });

      // Store the promise
      this.pendingRequests.set(cacheKey, requestPromise);
      
      next();
    };
  }

  // Clean up old cache entries
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    // Clean cache
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    console.log(`[DEDUPE] Cleaned up ${cleaned} cache entries`);
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
    console.log('[DEDUPE] Cache cleared');
  }

  // Get cache statistics
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheTimeout: this.cacheTimeout,
      cleanupInterval: this.cleanupInterval
    };
  }

  // Invalidate cache for specific pattern
  invalidatePattern(pattern) {
    let invalidated = 0;
    
    for (const [key, value] of this.cache.entries()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    console.log(`[DEDUPE] Invalidated ${invalidated} cache entries for pattern: ${pattern}`);
    return invalidated;
  }

  // Preload cache
  async preloadCache(key, data, statusCode = 200) {
    this.cache.set(key, {
      statusCode,
      data,
      timestamp: Date.now()
    });
    
    console.log(`[DEDUPE] Preloaded cache for key: ${key}`);
  }
}

// Create singleton instance
const requestDeduplication = new RequestDeduplication();

module.exports = requestDeduplication;
