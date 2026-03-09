class IPWhitelist {
  constructor() {
    this.allowedIPs = new Set();
    this.blockedIPs = new Set();
    this.whitelistEnabled = false;
    this.blacklistEnabled = false;
    this.loadConfig();
  }

  loadConfig() {
    // Load from environment variables
    const whitelist = process.env.IP_WHITELIST;
    const blacklist = process.env.IP_BLACKLIST;
    
    if (whitelist) {
      this.allowedIPs = new Set(whitelist.split(',').map(ip => ip.trim()));
      this.whitelistEnabled = true;
    }
    
    if (blacklist) {
      this.blockedIPs = new Set(blacklist.split(',').map(ip => ip.trim()));
      this.blacklistEnabled = true;
    }
  }

  // Add IP to whitelist
  addToWhitelist(ip) {
    this.allowedIPs.add(ip);
    this.whitelistEnabled = true;
    console.log(`[IP_WHITELIST] Added to whitelist: ${ip}`);
  }

  // Remove IP from whitelist
  removeFromWhitelist(ip) {
    this.allowedIPs.delete(ip);
    if (this.allowedIPs.size === 0) {
      this.whitelistEnabled = false;
    }
    console.log(`[IP_WHITELIST] Removed from whitelist: ${ip}`);
  }

  // Add IP to blacklist
  addToBlacklist(ip) {
    this.blockedIPs.add(ip);
    this.blacklistEnabled = true;
    console.log(`[IP_BLACKLIST] Added to blacklist: ${ip}`);
  }

  // Remove IP from blacklist
  removeFromBlacklist(ip) {
    this.blockedIPs.delete(ip);
    if (this.blockedIPs.size === 0) {
      this.blacklistEnabled = false;
    }
    console.log(`[IP_BLACKLIST] Removed from blacklist: ${ip}`);
  }

  // Check if IP is allowed
  isAllowed(ip) {
    // Check blacklist first
    if (this.blacklistEnabled && this.blockedIPs.has(ip)) {
      return false;
    }
    
    // Check whitelist
    if (this.whitelistEnabled && !this.allowedIPs.has(ip)) {
      return false;
    }
    
    return true;
  }

  // Get client IP from request
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           '127.0.0.1';
  }

  // Middleware for IP filtering
  middleware(options = {}) {
    const {
      message = 'Access denied',
      whitelistOnly = false,
      skipPaths = ['/health', '/health/live', '/health/ready']
    } = options;

    return (req, res, next) => {
      // Skip certain paths
      if (skipPaths.some(path => req.originalUrl.startsWith(path))) {
        return next();
      }

      const clientIP = this.getClientIP(req);
      
      // Log IP access
      console.log(`[IP_FILTER] Request from ${clientIP} to ${req.originalUrl}`);

      // Check if IP is allowed
      if (!this.isAllowed(clientIP)) {
        console.warn(`[IP_FILTER] Blocked IP: ${clientIP}`);
        
        return res.status(403).json({
          success: false,
          error: {
            code: 'IP_BLOCKED',
            message,
            ip: clientIP
          }
        });
      }

      // Add IP to request for later use
      req.clientIP = clientIP;
      
      next();
    };
  }

  // Get whitelist status
  getWhitelistStatus() {
    return {
      enabled: this.whitelistEnabled,
      count: this.allowedIPs.size,
      ips: Array.from(this.allowedIPs)
    };
  }

  // Get blacklist status
  getBlacklistStatus() {
    return {
      enabled: this.blacklistEnabled,
      count: this.blockedIPs.size,
      ips: Array.from(this.blockedIPs)
    }
  }

  // Get all IP lists
  getAllLists() {
    return {
      whitelist: this.getWhitelistStatus(),
      blacklist: this.getBlacklistStatus()
    };
  }

  // Clear all lists
  clearAll() {
    this.allowedIPs.clear();
    this.blockedIPs.clear();
    this.whitelistEnabled = false;
    this.blacklistEnabled = false;
    console.log('[IP_FILTER] All IP lists cleared');
  }

  // Check if IP is in CIDR range
  isIPInCIDR(ip, cidr) {
    const [network, prefixLength] = cidr.split('/');
    const ipInt = this.ipToInt(ip);
    const networkInt = this.ipToInt(network);
    const mask = (0xffffffff << (32 - parseInt(prefixLength))) >>> 0;
    
    return (ipInt & mask) === (networkInt & mask);
  }

  // Convert IP to integer
  ipToInt(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  // Add CIDR range to whitelist
  addCIDRToWhitelist(cidr) {
    // For simplicity, we'll just add the CIDR as a string
    // In production, you'd want to expand this to individual IPs
    this.allowedIPs.add(cidr);
    this.whitelistEnabled = true;
    console.log(`[IP_WHITELIST] Added CIDR to whitelist: ${cidr}`);
  }

  // Add CIDR range to blacklist
  addCIDRToBlacklist(cidr) {
    this.blockedIPs.add(cidr);
    this.blacklistEnabled = true;
    console.log(`[IP_BLACKLIST] Added CIDR to blacklist: ${cidr}`);
  }

  // Check if IP is in any CIDR range
  isIPInAnyCIDR(ip, cidrList) {
    return cidrList.some(cidr => this.isIPInCIDR(ip, cidr));
  }

  // Enhanced IP check with CIDR support
  isAllowedEnhanced(ip) {
    // Check blacklist first
    if (this.blacklistEnabled) {
      for (const blockedIP of this.blockedIPs) {
        if (blockedIP.includes('/') && this.isIPInCIDR(ip, blockedIP)) {
          return false;
        } else if (blockedIP === ip) {
          return false;
        }
      }
    }
    
    // Check whitelist
    if (this.whitelistEnabled) {
      for (const allowedIP of this.allowedIPs) {
        if (allowedIP.includes('/') && this.isIPInCIDR(ip, allowedIP)) {
          return true;
        } else if (allowedIP === ip) {
          return true;
        }
      }
      return false; // Not found in whitelist
    }
    
    return true;
  }

  // Get IP statistics
  getStats() {
    return {
      whitelistEnabled: this.whitelistEnabled,
      blacklistEnabled: this.blacklistEnabled,
      totalWhitelisted: this.allowedIPs.size,
      totalBlacklisted: this.blockedIPs.size,
      totalRules: this.allowedIPs.size + this.blockedIPs.size
    };
  }

  // Export IP lists
  exportLists() {
    return {
      timestamp: new Date().toISOString(),
      whitelist: Array.from(this.allowedIPs),
      blacklist: Array.from(this.blockedIPs),
      stats: this.getStats()
    };
  }

  // Import IP lists
  importLists(data) {
    try {
      if (data.whitelist && Array.isArray(data.whitelist)) {
        this.allowedIPs = new Set(data.whitelist);
        this.whitelistEnabled = data.whitelist.length > 0;
      }
      
      if (data.blacklist && Array.isArray(data.blacklist)) {
        this.blockedIPs = new Set(data.blacklist);
        this.blacklistEnabled = data.blacklist.length > 0;
      }
      
      console.log('[IP_FILTER] IP lists imported successfully');
      
    } catch (error) {
      console.error('[IP_FILTER] Error importing IP lists:', error);
      throw error;
    }
  }
}

// Create singleton instance
const ipWhitelist = new IPWhitelist();

module.exports = ipWhitelist;
