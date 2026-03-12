const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class APIRateLimiting extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
      maxRequests: options.maxRequests || 100,
      keyGenerator: options.keyGenerator || this.defaultKeyGenerator,
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
      enableHeaders: options.enableHeaders !== false,
      enableDraftPolishHeader: options.enableDraftPolishHeader || false,
      enableRedis: options.enableRedis || false,
      redis: options.redis || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      },
      enablePersistence: options.enablePersistence || false,
      persistenceFile: options.persistenceFile || path.join(process.cwd(), 'data', 'rate-limits.json'),
      enableMetrics: options.enableMetrics !== false,
      enableWhitelist: options.enableWhitelist || false,
      whitelist: options.whitelist || [],
      enableBlacklist: options.enableBlacklist || false,
      blacklist: options.blacklist || [],
      enableDynamicLimits: options.enableDynamicLimits || false,
      dynamicLimits: options.dynamicLimits || {},
      enableBurstProtection: options.enableBurstProtection || false,
      burstLimit: options.burstLimit || 10,
      burstWindowMs: options.burstWindowMs || 1000,
      ...options
    };
    
    this.limits = new Map();
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      allowedRequests: 0,
      rateLimitedRequests: 0,
      requestsByIP: new Map(),
      requestsByEndpoint: new Map(),
      requestsByHour: new Map()
    };
    
    this.init();
  }

  init() {
    if (this.options.enablePersistence) {
      this.loadPersistedLimits();
    }
    
    console.log(`[API_RATE_LIMITING] Rate limiting initialized: ${this.options.maxRequests} requests per ${this.options.windowMs}ms`);
  }

  defaultKeyGenerator(req) {
    return req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
  }

  async loadPersistedLimits() {
    try {
      const content = await fs.readFile(this.options.persistenceFile, 'utf8');
      const data = JSON.parse(content);
      
      this.limits = new Map(data.limits || []);
      
      console.log(`[API_RATE_LIMITING] Loaded ${this.limits.size} persisted rate limits`);
    } catch (error) {
      console.log('[API_RATE_LIMITING] No persisted limits found');
    }
  }

  async persistLimits() {
    if (!this.options.enablePersistence) return;
    
    try {
      const data = {
        limits: Array.from(this.limits.entries()),
        metrics: this.metrics,
        timestamp: Date.now()
      };
      
      const dataDir = path.dirname(this.options.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      await fs.writeFile(this.options.persistenceFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[API_RATE_LIMITING] Failed to persist limits:', error);
    }
  }

  async checkLimit(req, res, next) {
    const key = this.options.keyGenerator(req);
    
    // Check whitelist
    if (this.options.enableWhitelist && this.isWhitelisted(req)) {
      return next();
    }
    
    // Check blacklist
    if (this.options.enableBlacklist && this.isBlacklisted(req)) {
      return this.blockRequest(req, res, 'blacklisted');
    }
    
    // Get dynamic limit if enabled
    const limit = this.getDynamicLimit(req);
    
    // Check main rate limit
    const result = await this.checkRateLimit(key, limit);
    
    // Check burst protection if enabled
    if (this.options.enableBurstProtection && result.allowed) {
      const burstResult = await this.checkBurstLimit(key);
      if (!burstResult.allowed) {
        return this.blockRequest(req, res, 'burst_exceeded', burstResult);
      }
    }
    
    if (!result.allowed) {
      return this.blockRequest(req, res, 'rate_limit_exceeded', result);
    }
    
    // Add rate limit headers
    if (this.options.enableHeaders) {
      this.addRateLimitHeaders(res, result);
    }
    
    // Update metrics
    this.updateMetrics(req, result);
    
    next();
  }

  async checkRateLimit(key, maxRequests = this.options.maxRequests) {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    let limitData = this.limits.get(key);
    
    if (!limitData) {
      limitData = {
        requests: [],
        resetTime: now + this.options.windowMs
      };
      this.limits.set(key, limitData);
    }
    
    // Remove old requests outside the window
    limitData.requests = limitData.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if limit exceeded
    const allowed = limitData.requests.length < maxRequests;
    
    if (allowed) {
      limitData.requests.push(now);
    }
    
    return {
      allowed,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - limitData.requests.length),
      resetTime: limitData.resetTime,
      windowMs: this.options.windowMs,
      totalRequests: limitData.requests.length
    };
  }

  async checkBurstLimit(key) {
    const now = Date.now();
    const windowStart = now - this.options.burstWindowMs;
    
    const burstKey = `${key}:burst`;
    let limitData = this.limits.get(burstKey);
    
    if (!limitData) {
      limitData = {
        requests: [],
        resetTime: now + this.options.burstWindowMs
      };
      this.limits.set(burstKey, limitData);
    }
    
    // Remove old requests outside the burst window
    limitData.requests = limitData.requests.filter(timestamp => timestamp > windowStart);
    
    // Check if burst limit exceeded
    const allowed = limitData.requests.length < this.options.burstLimit;
    
    if (allowed) {
      limitData.requests.push(now);
    }
    
    return {
      allowed,
      limit: this.options.burstLimit,
      remaining: Math.max(0, this.options.burstLimit - limitData.requests.length),
      resetTime: limitData.resetTime,
      windowMs: this.options.burstWindowMs,
      totalRequests: limitData.requests.length
    };
  }

  blockRequest(req, res, reason, limitData = null) {
    this.metrics.blockedRequests++;
    this.metrics.rateLimitedRequests++;
    
    const error = {
      error: 'Too Many Requests',
      message: this.getErrorMessage(reason),
      code: 429,
      reason,
      retryAfter: limitData ? Math.ceil((limitData.resetTime - Date.now()) / 1000) : this.options.windowMs / 1000
    };
    
    this.emit('request:blocked', {
      request: {
        ip: req.ip,
        method: req.method,
        path: req.path,
        userAgent: req.get('User-Agent')
      },
      reason,
      limitData
    });
    
    res.status(429).json(error);
  }

  getErrorMessage(reason) {
    switch (reason) {
      case 'rate_limit_exceeded':
        return 'Rate limit exceeded. Please try again later.';
      case 'burst_exceeded':
        return 'Too many requests in short time. Please slow down.';
      case 'blacklisted':
        return 'Access denied. Your IP has been blocked.';
      default:
        return 'Too many requests. Please try again later.';
    }
  }

  addRateLimitHeaders(res, limitData) {
    res.set('X-RateLimit-Limit', limitData.limit);
    res.set('X-RateLimit-Remaining', limitData.remaining);
    res.set('X-RateLimit-Reset', Math.ceil(limitData.resetTime / 1000));
    
    if (this.options.enableDraftPolishHeader) {
      res.set('X-RateLimit-Draft-Polish', 'draft-polish');
    }
  }

  isWhitelisted(req) {
    const ip = req.ip || req.connection.remoteAddress;
    
    for (const whitelistItem of this.options.whitelist) {
      if (typeof whitelistItem === 'string') {
        if (ip === whitelistItem) return true;
      } else if (whitelistItem instanceof RegExp) {
        if (whitelistItem.test(ip)) return true;
      } else if (typeof whitelistItem === 'object') {
        if (whitelistItem.ip && whitelistItem.ip === ip) return true;
        if (whitelistItem.path && req.path.startsWith(whitelistItem.path)) return true;
        if (whitelistItem.method && req.method === whitelistItem.method) return true;
      }
    }
    
    return false;
  }

  isBlacklisted(req) {
    const ip = req.ip || req.connection.remoteAddress;
    
    for (const blacklistItem of this.options.blacklist) {
      if (typeof blacklistItem === 'string') {
        if (ip === blacklistItem) return true;
      } else if (blacklistItem instanceof RegExp) {
        if (blacklistItem.test(ip)) return true;
      } else if (typeof blacklistItem === 'object') {
        if (blacklistItem.ip && blacklistItem.ip === ip) return true;
        if (blacklistItem.path && req.path.startsWith(blacklistItem.path)) return true;
        if (blacklistItem.method && req.method === blacklistItem.method) return true;
      }
    }
    
    return false;
  }

  getDynamicLimit(req) {
    if (!this.options.enableDynamicLimits) {
      return this.options.maxRequests;
    }
    
    for (const [condition, limit] of Object.entries(this.options.dynamicLimits)) {
      if (this.matchesCondition(req, condition)) {
        return limit;
      }
    }
    
    return this.options.maxRequests;
  }

  matchesCondition(req, condition) {
    if (condition.ip && req.ip === condition.ip) return true;
    if (condition.path && req.path.startsWith(condition.path)) return true;
    if (condition.method && req.method === condition.method) return true;
    if (condition.userAgent && req.get('User-Agent')?.includes(condition.userAgent)) return true;
    if (condition.header && req.get(condition.header.name) === condition.header.value) return true;
    
    return false;
  }

  updateMetrics(req, limitData) {
    this.metrics.totalRequests++;
    
    if (limitData.allowed) {
      this.metrics.allowedRequests++;
    }
    
    // Update requests by IP
    const ip = req.ip || req.connection.remoteAddress;
    const ipCount = this.metrics.requestsByIP.get(ip) || 0;
    this.metrics.requestsByIP.set(ip, ipCount + 1);
    
    // Update requests by endpoint
    const endpoint = `${req.method} ${req.path}`;
    const endpointCount = this.metrics.requestsByEndpoint.get(endpoint) || 0;
    this.metrics.requestsByEndpoint.set(endpoint, endpointCount + 1);
    
    // Update requests by hour
    const hour = new Date().getHours();
    const hourCount = this.metrics.requestsByHour.get(hour) || 0;
    this.metrics.requestsByHour.set(hour, hourCount + 1);
  }

  async addWhitelist(item) {
    this.options.whitelist.push(item);
    console.log(`[API_RATE_LIMITING] Added to whitelist:`, item);
  }

  async removeWhitelist(item) {
    const index = this.options.whitelist.indexOf(item);
    if (index > -1) {
      this.options.whitelist.splice(index, 1);
      console.log(`[API_RATE_LIMITING] Removed from whitelist:`, item);
    }
  }

  async addBlacklist(item) {
    this.options.blacklist.push(item);
    console.log(`[API_RATE_LIMITING] Added to blacklist:`, item);
  }

  async removeBlacklist(item) {
    const index = this.options.blacklist.indexOf(item);
    if (index > -1) {
      this.options.blacklist.splice(index, 1);
      console.log(`[API_RATE_LIMITING] Removed from blacklist:`, item);
    }
  }

  async setDynamicLimit(condition, limit) {
    this.options.dynamicLimits[condition] = limit;
    console.log(`[API_RATE_LIMITING] Set dynamic limit:`, { condition, limit });
  }

  async removeDynamicLimit(condition) {
    delete this.options.dynamicLimits[condition];
    console.log(`[API_RATE_LIMITING] Removed dynamic limit:`, condition);
  }

  async resetLimit(key) {
    this.limits.delete(key);
    console.log(`[API_RATE_LIMITING] Reset limit for key: ${key}`);
  }

  async resetAllLimits() {
    this.limits.clear();
    console.log('[API_RATE_LIMITING] Reset all limits');
  }

  getLimit(key) {
    return this.limits.get(key);
  }

  getAllLimits() {
    return Array.from(this.limits.entries()).map(([key, data]) => ({
      key,
      requests: data.requests.length,
      limit: this.getDynamicLimit({ ip: key }) || this.options.maxRequests,
      remaining: Math.max(0, (this.getDynamicLimit({ ip: key }) || this.options.maxRequests) - data.requests.length),
      resetTime: data.resetTime,
      resetIn: Math.max(0, Math.ceil((data.resetTime - Date.now()) / 1000))
    }));
  }

  getMetrics() {
    return {
      ...this.metrics,
      totalKeys: this.limits.size,
      averageRequestsPerKey: this.limits.size > 0 
        ? Array.from(this.limits.values()).reduce((sum, data) => sum + data.requests.length, 0) / this.limits.size 
        : 0,
      blockRate: this.metrics.totalRequests > 0 
        ? (this.metrics.blockedRequests / this.metrics.totalRequests) * 100 
        : 0
    };
  }

  getTopBlockedIPs(limit = 10) {
    return Array.from(this.metrics.requestsByIP.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getTopEndpoints(limit = 10) {
    return Array.from(this.metrics.requestsByEndpoint.entries())
      .map(([endpoint, count]) => ({ endpoint, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getHourlyStats() {
    return Array.from(this.metrics.requestsByHour.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
  }

  async cleanupExpiredLimits() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, data] of this.limits.entries()) {
      if (data.resetTime < now) {
        this.limits.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[API_RATE_LIMITING] Cleaned up ${cleaned} expired limits`);
    }
    
    return cleaned;
  }

  async exportData() {
    return {
      config: {
        windowMs: this.options.windowMs,
        maxRequests: this.options.maxRequests,
        enableBurstProtection: this.options.enableBurstProtection,
        burstLimit: this.options.burstLimit,
        whitelist: this.options.whitelist,
        blacklist: this.options.blacklist,
        dynamicLimits: this.options.dynamicLimits
      },
      limits: this.getAllLimits(),
      metrics: this.getMetrics()
    };
  }

  middleware(customOptions = {}) {
    const options = { ...this.options, ...customOptions };
    
    return async (req, res, next) => {
      await this.checkLimit(req, res, next);
    };
  }

  // Static method to create rate limiter
  static create(options = {}) {
    return new APIRateLimiting(options);
  }
}

module.exports = APIRateLimiting;
