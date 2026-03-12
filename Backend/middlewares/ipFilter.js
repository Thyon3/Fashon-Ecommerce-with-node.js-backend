const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class IPFilter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableWhitelist: options.enableWhitelist || false,
      enableBlacklist: options.enableBlacklist || true,
      configFile: options.configFile || path.join(process.cwd(), 'config', 'ip-rules.json'),
      enablePersistence: options.enablePersistence !== false,
      enableLogging: options.enableLogging !== false,
      defaultAction: options.defaultAction || 'deny',
      enableGeoIP: options.enableGeoIP || false,
      enableRateLimitByIP: options.enableRateLimitByIP || false,
      maxRequestsPerIP: options.maxRequestsPerIP || 1000,
      windowMs: options.windowMs || 3600000, // 1 hour
      ...options
    };
    
    this.whitelist = new Set();
    this.blacklist = new Set();
    this.geoRules = new Map();
    this.ipStats = new Map();
    this.requestCounts = new Map();
    
    this.init();
  }

  async init() {
    try {
      await this.loadRules();
      
      if (this.options.enablePersistence) {
        this.startPersistence();
      }
      
      if (this.options.enableRateLimitByIP) {
        this.startRateLimitCleanup();
      }
      
      console.log('[IP_FILTER] IP filter initialized');
    } catch (error) {
      console.error('[IP_FILTER] Failed to initialize:', error);
    }
  }

  async loadRules() {
    try {
      const configPath = this.options.configFile;
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      
      // Load whitelist
      if (config.whitelist) {
        config.whitelist.forEach(ip => this.whitelist.add(ip));
      }
      
      // Load blacklist
      if (config.blacklist) {
        config.blacklist.forEach(ip => this.blacklist.add(ip));
      }
      
      // Load geo rules
      if (config.geoRules) {
        for (const [country, rule] of Object.entries(config.geoRules)) {
          this.geoRules.set(country, rule);
        }
      }
      
      console.log(`[IP_FILTER] Loaded ${this.whitelist.size} whitelist entries, ${this.blacklist.size} blacklist entries`);
    } catch (error) {
      console.log('[IP_FILTER] No existing rules found, starting with empty configuration');
    }
  }

  async saveRules() {
    if (!this.options.enablePersistence) return;
    
    try {
      const configDir = path.dirname(this.options.configFile);
      await fs.mkdir(configDir, { recursive: true });
      
      const config = {
        whitelist: Array.from(this.whitelist),
        blacklist: Array.from(this.blacklist),
        geoRules: Object.fromEntries(this.geoRules),
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      };
      
      await fs.writeFile(this.options.configFile, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('[IP_FILTER] Failed to save rules:', error);
    }
  }

  startPersistence() {
    // Auto-save every 5 minutes
    setInterval(() => {
      this.saveRules();
    }, 300000);
  }

  startRateLimitCleanup() {
    // Clean up old request counts every hour
    setInterval(() => {
      this.cleanupRequestCounts();
    }, 3600000);
  }

  addToWhitelist(ip, options = {}) {
    this.whitelist.add(ip);
    
    // Remove from blacklist if it exists there
    this.blacklist.delete(ip);
    
    this.emit('ip:whitelisted', ip, options);
    this.logAction('whitelist', ip, options);
    
    console.log(`[IP_FILTER] Added ${ip} to whitelist`);
    
    return true;
  }

  addToBlacklist(ip, options = {}) {
    this.blacklist.add(ip);
    
    // Remove from whitelist if it exists there
    this.whitelist.delete(ip);
    
    this.emit('ip:blacklisted', ip, options);
    this.logAction('blacklist', ip, options);
    
    console.log(`[IP_FILTER] Added ${ip} to blacklist`);
    
    return true;
  }

  removeFromWhitelist(ip) {
    const removed = this.whitelist.delete(ip);
    
    if (removed) {
      this.emit('ip:removed_from_whitelist', ip);
      this.logAction('remove_from_whitelist', ip);
      console.log(`[IP_FILTER] Removed ${ip} from whitelist`);
    }
    
    return removed;
  }

  removeFromBlacklist(ip) {
    const removed = this.blacklist.delete(ip);
    
    if (removed) {
      this.emit('ip:removed_from_blacklist', ip);
      this.logAction('remove_from_blacklist', ip);
      console.log(`[IP_FILTER] Removed ${ip} from blacklist`);
    }
    
    return removed;
  }

  isWhitelisted(ip) {
    return this.whitelist.has(ip) || this.isIPInCIDR(ip, this.whitelist);
  }

  isBlacklisted(ip) {
    return this.blacklist.has(ip) || this.isIPInCIDR(ip, this.blacklist);
  }

  isIPInCIDR(ip, ipSet) {
    // Check if IP matches any CIDR notation in the set
    for (const rule of ipSet) {
      if (rule.includes('/')) {
        if (this.isIPInCIDRRange(ip, rule)) {
          return true;
        }
      }
    }
    return false;
  }

  isIPInCIDRRange(ip, cidr) {
    // Simple CIDR check implementation
    // In production, use a proper IP address library
    const [network, prefixLength] = cidr.split('/');
    const prefix = parseInt(prefixLength, 10);
    
    // This is a simplified implementation
    // Real implementation would convert IPs to numbers and check ranges
    return ip.startsWith(network.split('.').slice(0, Math.floor(prefix / 8)).join('.'));
  }

  setGeoRule(country, action, options = {}) {
    this.geoRules.set(country, {
      action,
      description: options.description || `Rule for ${country}`,
      exceptions: options.exceptions || [],
      createdAt: new Date().toISOString()
    });
    
    this.emit('geo:rule_set', country, action, options);
    console.log(`[IP_FILTER] Set geo rule for ${country}: ${action}`);
    
    return true;
  }

  removeGeoRule(country) {
    const removed = this.geoRules.delete(country);
    
    if (removed) {
      this.emit('geo:rule_removed', country);
      console.log(`[IP_FILTER] Removed geo rule for ${country}`);
    }
    
    return removed;
  }

  async getCountryFromIP(ip) {
    // Simulate GeoIP lookup
    // In production, use a proper GeoIP database or service
    const geoMapping = {
      '192.168.': 'Local',
      '10.': 'Local',
      '172.16.': 'Local',
      '127.': 'Local',
      '8.8.8.': 'US',
      '1.1.1.': 'US',
      '208.67.': 'US',
      '9.9.9.': 'US'
    };
    
    for (const [prefix, country] of Object.entries(geoMapping)) {
      if (ip.startsWith(prefix)) {
        return country;
      }
    }
    
    return 'Unknown';
  }

  async checkIP(ip, requestInfo = {}) {
    const result = {
      allowed: true,
      action: this.options.defaultAction,
      reason: '',
      country: null,
      rateLimited: false,
      metadata: {}
    };
    
    // Check whitelist first
    if (this.options.enableWhitelist && this.isWhitelisted(ip)) {
      result.action = 'allow';
      result.reason = 'IP is whitelisted';
      this.emit('ip:allowed', ip, 'whitelist');
      return result;
    }
    
    // Check blacklist
    if (this.options.enableBlacklist && this.isBlacklisted(ip)) {
      result.allowed = false;
      result.action = 'deny';
      result.reason = 'IP is blacklisted';
      this.emit('ip:denied', ip, 'blacklist');
      return result;
    }
    
    // Check rate limiting by IP
    if (this.options.enableRateLimitByIP) {
      const rateLimitResult = this.checkRateLimit(ip);
      if (rateLimitResult.limited) {
        result.allowed = false;
        result.action = 'deny';
        result.reason = 'Rate limit exceeded';
        result.rateLimited = true;
        result.metadata.rateLimit = rateLimitResult;
        this.emit('ip:rate_limited', ip, rateLimitResult);
        return result;
      }
    }
    
    // Check GeoIP rules
    if (this.options.enableGeoIP) {
      const country = await this.getCountryFromIP(ip);
      result.country = country;
      
      const geoRule = this.geoRules.get(country);
      if (geoRule) {
        // Check if IP is in exceptions
        const inExceptions = geoRule.exceptions.includes(ip);
        
        if (!inExceptions) {
          result.allowed = geoRule.action === 'allow';
          result.action = geoRule.action;
          result.reason = `GeoIP rule for ${country}: ${geoRule.action}`;
          result.metadata.geoRule = geoRule;
          
          this.emit('ip:geo_filtered', ip, country, geoRule);
          return result;
        }
      }
    }
    
    // Default action
    result.action = this.options.defaultAction;
    result.allowed = result.action === 'allow';
    result.reason = `Default action: ${result.action}`;
    
    this.emit('ip:processed', ip, result);
    
    return result;
  }

  checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    
    if (!this.requestCounts.has(ip)) {
      this.requestCounts.set(ip, []);
    }
    
    const requests = this.requestCounts.get(ip);
    
    // Remove old requests outside the window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    this.requestCounts.set(ip, validRequests);
    
    const limited = validRequests.length >= this.options.maxRequestsPerIP;
    
    if (limited) {
      this.emit('rate_limit:hit', ip, validRequests.length);
    }
    
    return {
      limited,
      count: validRequests.length,
      maxRequests: this.options.maxRequestsPerIP,
      windowMs: this.options.windowMs,
      resetTime: Math.min(...validRequests) + this.options.windowMs
    };
  }

  recordRequest(ip) {
    if (!this.options.enableRateLimitByIP) return;
    
    const now = Date.now();
    
    if (!this.requestCounts.has(ip)) {
      this.requestCounts.set(ip, []);
    }
    
    this.requestCounts.get(ip).push(now);
    
    // Update IP stats
    if (!this.ipStats.has(ip)) {
      this.ipStats.set(ip, {
        firstSeen: now,
        lastSeen: now,
        requestCount: 0,
        country: null
      });
    }
    
    const stats = this.ipStats.get(ip);
    stats.lastSeen = now;
    stats.requestCount++;
  }

  cleanupRequestCounts() {
    const now = Date.now();
    const windowStart = now - this.options.windowMs;
    let cleaned = 0;
    
    for (const [ip, requests] of this.requestCounts.entries()) {
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length === 0) {
        this.requestCounts.delete(ip);
        cleaned++;
      } else {
        this.requestCounts.set(ip, validRequests);
      }
    }
    
    if (cleaned > 0) {
      console.log(`[IP_FILTER] Cleaned up rate limit data for ${cleaned} IPs`);
    }
  }

  logAction(action, ip, options = {}) {
    if (!this.options.enableLogging) return;
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      ip,
      options,
      userAgent: options.userAgent,
      path: options.path
    };
    
    console.log(`[IP_FILTER] ${action}: ${ip}`, options);
  }

  getStats() {
    return {
      whitelistSize: this.whitelist.size,
      blacklistSize: this.blacklist.size,
      geoRulesCount: this.geoRules.size,
      trackedIPs: this.ipStats.size,
      rateLimitedIPs: this.requestCounts.size,
      totalRequests: Array.from(this.ipStats.values()).reduce((sum, stats) => sum + stats.requestCount, 0)
    };
  }

  getIPStats(ip) {
    return this.ipStats.get(ip) || null;
  }

  getTopIPs(limit = 10) {
    return Array.from(this.ipStats.entries())
      .map(([ip, stats]) => ({ ip, ...stats }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, limit);
  }

  getRateLimitedIPs() {
    const now = Date.now();
    const rateLimitedIPs = [];
    
    for (const [ip, requests] of this.requestCounts.entries()) {
      const windowStart = now - this.options.windowMs;
      const validRequests = requests.filter(timestamp => timestamp > windowStart);
      
      if (validRequests.length >= this.options.maxRequestsPerIP) {
        rateLimitedIPs.push({
          ip,
          count: validRequests.length,
          maxRequests: this.options.maxRequestsPerIP,
          resetTime: Math.min(...validRequests) + this.options.windowMs
        });
      }
    }
    
    return rateLimitedIPs;
  }

  exportRules() {
    return {
      whitelist: Array.from(this.whitelist),
      blacklist: Array.from(this.blacklist),
      geoRules: Object.fromEntries(this.geoRules),
      stats: this.getStats()
    };
  }

  importRules(rules) {
    if (rules.whitelist) {
      this.whitelist.clear();
      rules.whitelist.forEach(ip => this.whitelist.add(ip));
    }
    
    if (rules.blacklist) {
      this.blacklist.clear();
      rules.blacklist.forEach(ip => this.blacklist.add(ip));
    }
    
    if (rules.geoRules) {
      this.geoRules.clear();
      for (const [country, rule] of Object.entries(rules.geoRules)) {
        this.geoRules.set(country, rule);
      }
    }
    
    console.log('[IP_FILTER] Rules imported successfully');
  }

  clearAll() {
    this.whitelist.clear();
    this.blacklist.clear();
    this.geoRules.clear();
    this.ipStats.clear();
    this.requestCounts.clear();
    
    console.log('[IP_FILTER] All rules and stats cleared');
  }

  middleware() {
    return async (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      
      // Record request
      this.recordRequest(ip);
      
      // Check IP
      const result = await this.checkIP(ip, {
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      // Add result to request
      req.ipFilter = result;
      
      // Set headers
      res.set('X-IP-Filter-Action', result.action);
      res.set('X-IP-Filter-Reason', result.reason);
      
      if (result.country) {
        res.set('X-IP-Country', result.country);
      }
      
      // Deny access if not allowed
      if (!result.allowed) {
        const statusCode = result.rateLimited ? 429 : 403;
        
        return res.status(statusCode).json({
          error: 'Access Denied',
          message: result.reason,
          action: result.action,
          country: result.country,
          rateLimited: result.rateLimited,
          metadata: result.metadata
        });
      }
      
      next();
    };
  }

  // Static method to create IP filter
  static async create(options = {}) {
    const ipFilter = new IPFilter(options);
    await ipFilter.init();
    return ipFilter;
  }
}

module.exports = IPFilter;
