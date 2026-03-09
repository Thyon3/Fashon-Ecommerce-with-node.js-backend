class ResponseCache {
  static middleware(options = {}) {
    const {
      maxAge = 300, // 5 minutes default
      private = false,
      noStore = false,
      noCache = false,
      mustRevalidate = false,
      etag = true
    } = options;
    
    return (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      // Set cache control headers
      if (noStore) {
        res.setHeader('Cache-Control', 'no-store');
      } else if (noCache) {
        res.setHeader('Cache-Control', 'no-cache');
      } else {
        const directives = [];
        
        if (private) {
          directives.push('private');
        } else {
          directives.push('public');
        }
        
        directives.push(`max-age=${maxAge}`);
        
        if (mustRevalidate) {
          directives.push('must-revalidate');
        }
        
        res.setHeader('Cache-Control', directives.join(', '));
      }
      
      // Set ETag if enabled
      if (etag) {
        res.setHeader('ETag', this.generateETag(req));
      }
      
      // Set expires header
      if (!noStore && !noCache) {
        const expires = new Date();
        expires.setSeconds(expires.getSeconds() + maxAge);
        res.setHeader('Expires', expires.toUTCString());
      }
      
      // Set last modified
      res.setHeader('Last-Modified', new Date().toUTCString());
      
      next();
    };
  }
  
  static generateETag(req) {
    const data = JSON.stringify({
      url: req.originalUrl,
      method: req.method,
      query: req.query,
      timestamp: Date.now()
    });
    
    // Simple ETag generation (in production, use a proper hash function)
    return `"${Buffer.from(data).toString('base64').substr(0, 27)}"`;
  }
  
  // Static cache configurations for different endpoints
  static cacheConfigs = {
    // Static content - cache for 1 hour
    static: {
      maxAge: 3600,
      public: true,
      etag: true
    },
    
    // Product listings - cache for 15 minutes
    products: {
      maxAge: 900,
      public: true,
      etag: true
    },
    
    // Categories - cache for 1 hour
    categories: {
      maxAge: 3600,
      public: true,
      etag: true
    },
    
    // User data - no cache
    user: {
      noStore: true,
      private: true
    },
    
    // Orders - no cache
    orders: {
      noStore: true,
      private: true
    },
    
    // Admin data - no cache
    admin: {
      noStore: true,
      private: true
    }
  };
  
  static getCacheConfig(type) {
    return this.cacheConfigs[type] || this.cacheConfigs.products;
  }
}

module.exports = ResponseCache;
