class ApiThrottling {
  constructor() {
    this.clients = new Map();
    this.globalLimit = 10000; // Global requests per minute
    this.globalCounter = 0;
    this.globalResetTime = Date.now() + 60000; // 1 minute from now
  }

  // Create throttling middleware
  static createThrottler(options = {}) {
    const {
      windowMs = 60000, // 1 minute
      max = 100, // Max requests per window
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      keyGenerator = (req) => req.ip,
      onLimitReached = (req, res) => {
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'API rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
    } = options;

    const throttler = new ApiThrottling();

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      
      // Get or create client record
      let client = throttler.clients.get(key);
      
      if (!client) {
        client = {
          requests: [],
          resetTime: now + windowMs
        };
        throttler.clients.set(key, client);
      }
      
      // Reset if window expired
      if (now > client.resetTime) {
        client.requests = [];
        client.resetTime = now + windowMs;
      }
      
      // Check global limit
      if (throttler.globalCounter >= throttler.globalLimit) {
        return onLimitReached(req, res);
      }
      
      // Check client limit
      if (client.requests.length >= max) {
        const retryAfter = Math.ceil((client.resetTime - now) / 1000);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded for this client',
          retryAfter,
          limit: max,
          windowMs
        });
      }
      
      // Record request
      client.requests.push(now);
      throttler.globalCounter++;
      
      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, max - client.requests.length));
      res.setHeader('X-RateLimit-Reset', new Date(client.resetTime).toISOString());
      
      // Override res.end to track successful/failed requests
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        // Don't count if configured to skip
        if ((skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400)) {
          client.requests.pop();
          throttler.globalCounter--;
        }
        
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    };
  }

  // Create progressive throttling (increasingly strict limits)
  static createProgressiveThrottler(options = {}) {
    const tiers = [
      { max: 100, windowMs: 60000 },    // 100 requests per minute
      { max: 500, windowMs: 300000 },   // 500 requests per 5 minutes
      { max: 1000, windowMs: 600000 },  // 1000 requests per 10 minutes
      { max: 5000, windowMs: 3600000 }  // 5000 requests per hour
    ];
    
    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();
      
      // Check each tier
      for (const tier of tiers) {
        const tierKey = `${key}:${tier.windowMs}`;
        let client = this.clients.get(tierKey);
        
        if (!client) {
          client = {
            requests: [],
            resetTime: now + tier.windowMs
          };
          this.clients.set(tierKey, client);
        }
        
        if (now > client.resetTime) {
          client.requests = [];
          client.resetTime = now + tier.windowMs;
        }
        
        if (client.requests.length >= tier.max) {
          const retryAfter = Math.ceil((client.resetTime - now) / 1000);
          
          return res.status(429).json({
            error: 'Too Many Requests',
            message: `Rate limit exceeded: ${tier.max} requests per ${tier.windowMs / 60000} minutes`,
            retryAfter,
            tier: `${tier.max}/${tier.windowMs / 60000}min`
          });
        }
        
        client.requests.push(now);
      }
      
      next();
    };
  }

  // Create adaptive throttling (adjusts based on system load)
  static createAdaptiveThrottler(options = {}) {
    const {
      baseLimit = 100,
      maxLimit = 1000,
      loadThreshold = 0.8,
      checkInterval = 10000
    } = options;
    
    let currentLimit = baseLimit;
    
    // Monitor system load and adjust limits
    setInterval(() => {
      const load = this.getSystemLoad();
      
      if (load > loadThreshold) {
        // Reduce limit under high load
        currentLimit = Math.max(baseLimit, currentLimit * 0.8);
      } else {
        // Increase limit under normal load
        currentLimit = Math.min(maxLimit, currentLimit * 1.1);
      }
      
      console.log(`[THROTTLE] Adaptive limit: ${Math.round(currentLimit)} (load: ${load.toFixed(2)})`);
    }, checkInterval);
    
    return this.createThrottler({ max: currentLimit });
  }

  // Get system load (placeholder)
  static getSystemLoad() {
    const usage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const freeMem = require('os').freemem();
    
    // Simple load calculation based on memory usage
    return (totalMem - freeMem) / totalMem;
  }

  // Create endpoint-specific throttling
  static createEndpointThrottler(configs = {}) {
    const defaultConfig = {
      max: 100,
      windowMs: 60000
    };
    
    return (req, res, next) => {
      const endpoint = req.route?.path || req.originalUrl;
      const config = configs[endpoint] || defaultConfig;
      
      const key = `${req.ip}:${endpoint}`;
      const now = Date.now();
      
      let client = this.clients.get(key);
      
      if (!client) {
        client = {
          requests: [],
          resetTime: now + config.windowMs
        };
        this.clients.set(key, client);
      }
      
      if (now > client.resetTime) {
        client.requests = [];
        client.resetTime = now + config.windowMs;
      }
      
      if (client.requests.length >= config.max) {
        const retryAfter = Math.ceil((client.resetTime - now) / 1000);
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${endpoint}`,
          retryAfter,
          limit: config.max,
          endpoint
        });
      }
      
      client.requests.push(now);
      
      res.setHeader('X-RateLimit-Limit', config.max);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - client.requests.length));
      res.setHeader('X-RateLimit-Reset', new Date(client.resetTime).toISOString());
      
      next();
    };
  }

  // Get throttling statistics
  static getStats() {
    const stats = {
      totalClients: this.clients.size,
      globalCounter: this.globalCounter,
      globalLimit: this.globalLimit,
      clients: []
    };
    
    this.clients.forEach((client, key) => {
      stats.clients.push({
        key,
        requests: client.requests.length,
        resetTime: client.resetTime
      });
    });
    
    return stats;
  }

  // Reset throttling counters
  static reset() {
    this.clients.clear();
    this.globalCounter = 0;
    this.globalResetTime = Date.now() + 60000;
    console.log('[THROTTLE] Throttling counters reset');
  }

  // Clean up expired clients
  static cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, client] of this.clients.entries()) {
      if (now > client.resetTime) {
        this.clients.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[THROTTLE] Cleaned up ${cleaned} expired clients`);
    }
    
    return cleaned;
  }

  // Get client status
  static getClientStatus(ip) {
    const client = this.clients.get(ip);
    
    if (!client) {
      return {
        ip,
        requests: 0,
        limit: 100,
        resetTime: null
      };
    }
    
    return {
      ip,
      requests: client.requests.length,
      limit: 100,
      resetTime: client.resetTime,
      retryAfter: Math.max(0, Math.ceil((client.resetTime - Date.now()) / 1000))
    };
  }
}

module.exports = ApiThrottling;
