class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 15 * 60 * 1000; // 15 minutes
    this.maxRequests = options.maxRequests || 100;
    this.bannedIPs = new Set();
    this.ipRequests = new Map();
    this.cleanupInterval = setInterval(() => this.cleanup(), this.windowMs);
  }

  // Check if IP is rate limited
  checkLimit(ip) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Get existing requests for this IP
    let requests = this.ipRequests.get(ip) || [];

    // Remove old requests outside the window
    requests = requests.filter(timestamp => timestamp > windowStart);

    // Check if IP is banned
    if (this.bannedIPs.has(ip)) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + this.windowMs,
        reason: 'banned'
      };
    }

    // Check if rate limit exceeded
    if (requests.length >= this.maxRequests) {
      // Auto-ban if exceeded multiple times
      if (requests.length >= this.maxRequests * 2) {
        this.bannedIPs.add(ip);
        console.log(`[RATE_LIMITER] Auto-banned IP: ${ip}`);
      }

      return {
        allowed: false,
        remaining: 0,
        resetTime: Math.max(...requests) + this.windowMs,
        reason: 'rate_limit_exceeded'
      };
    }

    // Add current request
    requests.push(now);
    this.ipRequests.set(ip, requests);

    return {
      allowed: true,
      remaining: this.maxRequests - requests.length,
      resetTime: windowStart + this.windowMs,
      reason: 'allowed'
    };
  }

  // Clean up old request records
  cleanup() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let cleaned = 0;

    for (const [ip, requests] of this.ipRequests.entries()) {
      const filteredRequests = requests.filter(timestamp => timestamp > windowStart);
      
      if (filteredRequests.length === 0) {
        this.ipRequests.delete(ip);
        cleaned++;
      } else {
        this.ipRequests.set(ip, filteredRequests);
      }
    }

    if (cleaned > 0) {
      console.log(`[RATE_LIMITER] Cleaned up ${cleaned} IPs`);
    }
  }

  // Ban IP manually
  banIP(ip) {
    this.bannedIPs.add(ip);
    console.log(`[RATE_LIMITER] Manually banned IP: ${ip}`);
  }

  // Unban IP
  unbanIP(ip) {
    this.bannedIPs.delete(ip);
    console.log(`[RATE_LIMITER] Unbanned IP: ${ip}`);
  }

  // Get IP status
  getIPStatus(ip) {
    const requests = this.ipRequests.get(ip) || [];
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const recentRequests = requests.filter(timestamp => timestamp > windowStart);

    return {
      ip,
      isBanned: this.bannedIPs.has(ip),
      requestsInWindow: recentRequests.length,
      maxRequests: this.maxRequests,
      remaining: Math.max(0, this.maxRequests - recentRequests.length),
      resetTime: windowStart + this.windowMs
    };
  }

  // Get all banned IPs
  getBannedIPs() {
    return Array.from(this.bannedIPs);
  }

  // Get statistics
  getStats() {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let totalRequests = 0;
    let activeIPs = 0;

    for (const [ip, requests] of this.ipRequests.entries()) {
      const recentRequests = requests.filter(timestamp => timestamp > windowStart);
      totalRequests += recentRequests.length;
      if (recentRequests.length > 0) activeIPs++;
    }

    return {
      totalRequests,
      activeIPs,
      bannedIPs: this.bannedIPs.size,
      windowMs: this.windowMs,
      maxRequests: this.maxRequests
    };
  }

  // Reset IP requests
  resetIP(ip) {
    this.ipRequests.delete(ip);
    console.log(`[RATE_LIMITER] Reset requests for IP: ${ip}`);
  }

  // Clear all data
  clear() {
    this.ipRequests.clear();
    this.bannedIPs.clear();
    console.log('[RATE_LIMITER] All data cleared');
  }

  // Middleware for Express
  middleware(options = {}) {
    const {
      message = 'Too many requests, please try again later',
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      keyGenerator = (req) => req.ip
    } = options;

    return (req, res, next) => {
      const key = keyGenerator(req);
      const result = this.checkLimit(key);

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', this.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));

      if (!result.allowed) {
        console.log(`[RATE_LIMITER] Blocked request from ${key}: ${result.reason}`);
        
        return res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
            reason: result.reason
          }
        });
      }

      // Track response for skip options
      if (skipSuccessfulRequests || skipFailedRequests) {
        const originalEnd = res.end;
        res.end = function(chunk, encoding) {
          const shouldSkip = 
            (skipSuccessfulRequests && res.statusCode < 400) ||
            (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Remove the request from tracking
            const requests = this.ipRequests.get(key) || [];
            requests.pop(); // Remove the last request we added
            if (requests.length === 0) {
              this.ipRequests.delete(key);
            } else {
              this.ipRequests.set(key, requests);
            }
          }

          originalEnd.call(this, chunk, encoding);
        }.bind(this);
      }

      next();
    };
  }

  // Create rate limiter for specific routes
  createRouteLimiter(routeOptions) {
    return new RateLimiter(routeOptions);
  }

  // Check multiple rate limiters
  checkMultipleLimiters(ip, limiters) {
    for (const limiter of limiters) {
      const result = limiter.checkLimit(ip);
      if (!result.allowed) {
        return result;
      }
    }
    return { allowed: true };
  }

  // Adaptive rate limiting based on server load
  adaptiveCheck(ip, serverLoad) {
    // Adjust max requests based on server load
    let adjustedMax = this.maxRequests;
    
    if (serverLoad > 0.8) {
      adjustedMax = Math.floor(this.maxRequests * 0.5); // Reduce by 50%
    } else if (serverLoad > 0.6) {
      adjustedMax = Math.floor(this.maxRequests * 0.7); // Reduce by 30%
    }

    const originalMax = this.maxRequests;
    this.maxRequests = adjustedMax;
    
    const result = this.checkLimit(ip);
    
    // Restore original max
    this.maxRequests = originalMax;
    
    return result;
  }

  // Export data
  export() {
    return {
      timestamp: new Date().toISOString(),
      bannedIPs: Array.from(this.bannedIPs),
      ipRequests: Object.fromEntries(this.ipRequests),
      stats: this.getStats()
    };
  }

  // Import data
  import(data) {
    try {
      if (data.bannedIPs && Array.isArray(data.bannedIPs)) {
        this.bannedIPs = new Set(data.bannedIPs);
      }
      
      if (data.ipRequests && typeof data.ipRequests === 'object') {
        this.ipRequests = new Map(Object.entries(data.ipRequests));
      }
      
      console.log('[RATE_LIMITER] Data imported successfully');
      
    } catch (error) {
      console.error('[RATE_LIMITER] Error importing data:', error);
      throw error;
    }
  }

  // Destroy cleanup interval
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

module.exports = RateLimiter;
