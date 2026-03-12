const crypto = require('crypto');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class URLShortener extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      baseUrl: options.baseUrl || 'https://short.ly',
      codeLength: options.codeLength || 6,
      enablePersistence: options.enablePersistence !== false,
      enableAnalytics: options.enableAnalytics !== false,
      enableCustomCodes: options.enableCustomCodes !== false,
      enableExpiration: options.enableExpiration || false,
      defaultExpiration: options.defaultExpiration || 30 * 24 * 60 * 60 * 1000, // 30 days
      maxRedirects: options.maxRedirects || 1000,
      configFile: options.configFile || path.join(process.cwd(), 'data', 'short-urls.json'),
      ...options
    };
    
    this.urls = new Map();
    this.analytics = new Map();
    this.stats = {
      totalUrls: 0,
      totalClicks: 0,
      activeUrls: 0,
      expiredUrls: 0
    };
    
    this.init();
  }

  async init() {
    try {
      await this.loadData();
      
      if (this.options.enablePersistence) {
        this.startPersistence();
      }
      
      // Cleanup expired URLs
      await this.cleanupExpiredUrls();
      
      console.log('[URL_SHORTENER] URL shortener initialized');
    } catch (error) {
      console.error('[URL_SHORTENER] Failed to initialize:', error);
    }
  }

  async loadData() {
    try {
      const configPath = this.options.configFile;
      const content = await fs.readFile(configPath, 'utf8');
      const data = JSON.parse(content);
      
      // Load URLs
      if (data.urls) {
        this.urls = new Map(data.urls);
      }
      
      // Load analytics
      if (data.analytics) {
        this.analytics = new Map(data.analytics);
      }
      
      // Load stats
      if (data.stats) {
        this.stats = data.stats;
      }
      
      console.log(`[URL_SHORTENER] Loaded ${this.urls.size} URLs`);
    } catch (error) {
      console.log('[URL_SHORTENER] No existing data found, starting fresh');
    }
  }

  async saveData() {
    if (!this.options.enablePersistence) return;
    
    try {
      const dataDir = path.dirname(this.options.configFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      const data = {
        urls: Array.from(this.urls.entries()),
        analytics: Array.from(this.analytics.entries()),
        stats: this.stats,
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      };
      
      await fs.writeFile(this.options.configFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[URL_SHORTENER] Failed to save data:', error);
    }
  }

  startPersistence() {
    // Auto-save every 5 minutes
    setInterval(() => {
      this.saveData();
    }, 300000);
  }

  generateCode(length = this.options.codeLength) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return code;
  }

  async createShortUrl(longUrl, options = {}) {
    // Validate URL
    if (!this.isValidUrl(longUrl)) {
      throw new Error('Invalid URL format');
    }
    
    let code;
    
    // Use custom code if provided and enabled
    if (options.customCode && this.options.enableCustomCodes) {
      code = options.customCode;
      
      // Check if code already exists
      if (this.urls.has(code)) {
        throw new Error('Custom code already exists');
      }
    } else {
      // Generate unique code
      do {
        code = this.generateCode();
      } while (this.urls.has(code));
    }
    
    const shortUrl = {
      code,
      longUrl,
      shortUrl: `${this.options.baseUrl}/${code}`,
      createdAt: new Date().toISOString(),
      expiresAt: this.options.enableExpiration 
        ? new Date(Date.now() + (options.expiration || this.options.defaultExpiration)).toISOString()
        : null,
      clicks: 0,
      maxClicks: options.maxClicks || this.options.maxRedirects,
      active: true,
      password: options.password || null,
      metadata: {
        title: options.title,
        description: options.description,
        tags: options.tags || [],
        createdBy: options.createdBy,
        domain: options.domain,
        ...options.metadata
      }
    };
    
    // Store URL
    this.urls.set(code, shortUrl);
    
    // Initialize analytics
    this.analytics.set(code, {
      clicks: [],
      referrers: new Map(),
      countries: new Map(),
      devices: new Map(),
      browsers: new Map(),
      dailyClicks: new Map(),
      hourlyClicks: new Map()
    });
    
    // Update stats
    this.stats.totalUrls++;
    this.stats.activeUrls++;
    
    // Save data
    await this.saveData();
    
    this.emit('url:created', shortUrl);
    console.log(`[URL_SHORTENER] Created short URL: ${shortUrl.shortUrl}`);
    
    return shortUrl;
  }

  async getUrl(code, req = null) {
    const urlData = this.urls.get(code);
    
    if (!urlData) {
      this.emit('url:not_found', code);
      return null;
    }
    
    // Check if URL is active
    if (!urlData.active) {
      this.emit('url:inactive', code);
      return null;
    }
    
    // Check expiration
    if (urlData.expiresAt && new Date(urlData.expiresAt) < new Date()) {
      urlData.active = false;
      this.stats.activeUrls--;
      this.stats.expiredUrls++;
      await this.saveData();
      
      this.emit('url:expired', code);
      return null;
    }
    
    // Check max clicks
    if (urlData.maxClicks && urlData.clicks >= urlData.maxClicks) {
      urlData.active = false;
      this.stats.activeUrls--;
      await this.saveData();
      
      this.emit('url:max_clicks_reached', code);
      return null;
    }
    
    // Check password protection
    if (urlData.password) {
      // In a real implementation, this would be handled by a separate endpoint
      return { ...urlData, passwordProtected: true };
    }
    
    // Increment click count
    urlData.clicks++;
    this.stats.totalClicks++;
    
    // Record analytics
    if (this.options.enableAnalytics && req) {
      await this.recordAnalytics(code, req);
    }
    
    // Save data
    await this.saveData();
    
    this.emit('url:accessed', code, urlData);
    
    return urlData;
  }

  async recordAnalytics(code, req) {
    const analytics = this.analytics.get(code);
    if (!analytics) return;
    
    const now = new Date();
    const clickData = {
      timestamp: now.toISOString(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      referer: req.get('Referer') || 'direct',
      country: this.getCountryFromIP(req.ip),
      device: this.getDeviceFromUserAgent(req.get('User-Agent')),
      browser: this.getBrowserFromUserAgent(req.get('User-Agent'))
    };
    
    // Add to clicks array
    analytics.clicks.push(clickData);
    
    // Update referrers
    const referrerCount = analytics.referrers.get(clickData.referer) || 0;
    analytics.referrers.set(clickData.referer, referrerCount + 1);
    
    // Update countries
    const countryCount = analytics.countries.get(clickData.country) || 0;
    analytics.countries.set(clickData.country, countryCount + 1);
    
    // Update devices
    const deviceCount = analytics.devices.get(clickData.device) || 0;
    analytics.devices.set(clickData.device, deviceCount + 1);
    
    // Update browsers
    const browserCount = analytics.browsers.get(clickData.browser) || 0;
    analytics.browsers.set(clickData.browser, browserCount + 1);
    
    // Update daily clicks
    const date = now.toISOString().split('T')[0];
    const dailyCount = analytics.dailyClicks.get(date) || 0;
    analytics.dailyClicks.set(date, dailyCount + 1);
    
    // Update hourly clicks
    const hour = now.getHours();
    const hourlyCount = analytics.hourlyClicks.get(hour) || 0;
    analytics.hourlyClicks.set(hour, hourlyCount + 1);
  }

  getCountryFromIP(ip) {
    // Simulate GeoIP lookup
    // In production, use a proper GeoIP database or service
    return 'Unknown';
  }

  getDeviceFromUserAgent(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Mobile')) return 'Mobile';
    if (userAgent.includes('Tablet')) return 'Tablet';
    if (userAgent.includes('Android')) return 'Mobile';
    if (userAgent.includes('iPhone')) return 'Mobile';
    if (userAgent.includes('iPad')) return 'Tablet';
    
    return 'Desktop';
  }

  getBrowserFromUserAgent(userAgent) {
    if (!userAgent) return 'Unknown';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Other';
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  async updateUrl(code, updates) {
    const urlData = this.urls.get(code);
    if (!urlData) {
      throw new Error('URL not found');
    }
    
    // Update allowed fields
    const allowedFields = ['title', 'description', 'tags', 'maxClicks', 'expiresAt', 'active'];
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        urlData[field] = updates[field];
      }
    }
    
    // Update metadata
    if (updates.metadata) {
      Object.assign(urlData.metadata, updates.metadata);
    }
    
    urlData.updatedAt = new Date().toISOString();
    
    await this.saveData();
    
    this.emit('url:updated', code, urlData);
    
    return urlData;
  }

  async deleteUrl(code) {
    const urlData = this.urls.get(code);
    if (!urlData) {
      throw new Error('URL not found');
    }
    
    this.urls.delete(code);
    this.analytics.delete(code);
    
    // Update stats
    this.stats.totalUrls--;
    if (urlData.active) {
      this.stats.activeUrls--;
    } else {
      this.stats.expiredUrls--;
    }
    
    await this.saveData();
    
    this.emit('url:deleted', code, urlData);
    
    return true;
  }

  async deactivateUrl(code) {
    return await this.updateUrl(code, { active: false });
  }

  async activateUrl(code) {
    return await this.updateUrl(code, { active: true });
  }

  getUrlInfo(code) {
    return this.urls.get(code) || null;
  }

  getUrlAnalytics(code) {
    const urlData = this.urls.get(code);
    const analytics = this.analytics.get(code);
    
    if (!urlData || !analytics) {
      return null;
    }
    
    return {
      url: urlData,
      analytics: {
        totalClicks: analytics.clicks.length,
        uniqueReferrers: analytics.referrers.size,
        uniqueCountries: analytics.countries.size,
        uniqueDevices: analytics.devices.size,
        uniqueBrowsers: analytics.browsers.size,
        topReferrers: Array.from(analytics.referrers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        topCountries: Array.from(analytics.countries.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        topDevices: Array.from(analytics.devices.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        topBrowsers: Array.from(analytics.browsers.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10),
        dailyClicks: Array.from(analytics.dailyClicks.entries())
          .sort((a, b) => a[0].localeCompare(b[0])),
        hourlyClicks: Array.from(analytics.hourlyClicks.entries())
          .sort((a, b) => a[0] - b[0])
      }
    };
  }

  searchUrls(query, options = {}) {
    const results = [];
    const { limit = 50, offset = 0, tags, createdBy, active } = options;
    
    for (const [code, urlData] of this.urls.entries()) {
      // Apply filters
      if (tags && (!urlData.metadata.tags || !tags.some(tag => urlData.metadata.tags.includes(tag)))) {
        continue;
      }
      
      if (createdBy && urlData.metadata.createdBy !== createdBy) {
        continue;
      }
      
      if (active !== undefined && urlData.active !== active) {
        continue;
      }
      
      // Search in title, description, and URL
      const searchText = query.toLowerCase();
      const matchesTitle = urlData.metadata.title && urlData.metadata.title.toLowerCase().includes(searchText);
      const matchesDescription = urlData.metadata.description && urlData.metadata.description.toLowerCase().includes(searchText);
      const matchesUrl = urlData.longUrl.toLowerCase().includes(searchText);
      
      if (query && !matchesTitle && !matchesDescription && !matchesUrl) {
        continue;
      }
      
      results.push(urlData);
    }
    
    // Sort by creation date (newest first)
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    return results.slice(offset, offset + limit);
  }

  getTopUrls(limit = 10, timeRange = 'all') {
    const urls = Array.from(this.urls.entries())
      .map(([code, urlData]) => urlData)
      .filter(urlData => urlData.active)
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, limit);
    
    return urls;
  }

  getStats() {
    const activeUrls = Array.from(this.urls.values()).filter(url => url.active).length;
    const expiredUrls = Array.from(this.urls.values()).filter(url => !url.active).length;
    
    return {
      ...this.stats,
      activeUrls,
      expiredUrls,
      averageClicksPerUrl: this.stats.totalUrls > 0 ? this.stats.totalClicks / this.stats.totalUrls : 0,
      mostPopularUrl: this.getTopUrls(1)[0]?.shortUrl || null
    };
  }

  async cleanupExpiredUrls() {
    const now = new Date();
    let cleaned = 0;
    
    for (const [code, urlData] of this.urls.entries()) {
      if (urlData.expiresAt && new Date(urlData.expiresAt) < now) {
        urlData.active = false;
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      this.stats.activeUrls -= cleaned;
      this.stats.expiredUrls += cleaned;
      await this.saveData();
      
      console.log(`[URL_SHORTENER] Cleaned up ${cleaned} expired URLs`);
    }
  }

  exportData(format = 'json') {
    const data = {
      urls: Array.from(this.urls.values()),
      analytics: Array.from(this.analytics.entries()).map(([code, analytics]) => ({
        code,
        ...analytics,
        referrers: Array.from(analytics.referrers.entries()),
        countries: Array.from(analytics.countries.entries()),
        devices: Array.from(analytics.devices.entries()),
        browsers: Array.from(analytics.browsers.entries()),
        dailyClicks: Array.from(analytics.dailyClicks.entries()),
        hourlyClicks: Array.from(analytics.hourlyClicks.entries())
      })),
      stats: this.getStats(),
      exportedAt: new Date().toISOString()
    };
    
    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(data.urls);
      case 'json':
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  convertToCSV(urls) {
    if (urls.length === 0) return '';
    
    const headers = ['code', 'shortUrl', 'longUrl', 'createdAt', 'clicks', 'active'];
    const csvRows = [headers.join(',')];
    
    for (const url of urls) {
      const values = [
        url.code,
        url.shortUrl,
        url.longUrl,
        url.createdAt,
        url.clicks,
        url.active
      ];
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  middleware() {
    return async (req, res, next) => {
      const path = req.path;
      
      // Check if this is a short URL redirect
      if (path.startsWith('/') && path.length > 1) {
        const code = path.substring(1);
        
        try {
          const urlData = await this.getUrl(code, req);
          
          if (urlData) {
            if (urlData.passwordProtected) {
              // Return password protection response
              return res.status(401).json({
                error: 'Password Protected',
                message: 'This URL requires a password to access',
                code
              });
            }
            
            // Redirect to long URL
            this.emit('url:redirected', code, urlData);
            return res.redirect(301, urlData.longUrl);
          }
        } catch (error) {
          console.error('[URL_SHORTENER] Error processing redirect:', error);
        }
      }
      
      next();
    };
  }

  // Static method to create URL shortener
  static async create(options = {}) {
    const urlShortener = new URLShortener(options);
    await urlShortener.init();
    return urlShortener;
  }
}

module.exports = URLShortener;
