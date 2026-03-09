const crypto = require('crypto');
const mongoose = require('mongoose');

// Define URL schema
const urlSchema = new mongoose.Schema({
  originalUrl: {
    type: String,
    required: true,
    index: true
  },
  shortCode: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  customAlias: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  clickCount: {
    type: Number,
    default: 0
  },
  lastClickAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    referer: String
  },
  analytics: {
    dailyClicks: [{
      date: Date,
      clicks: Number
    }],
    countryStats: [{
      country: String,
      clicks: Number
    }],
    referrerStats: [{
      referrer: String,
      clicks: Number
    }]
  }
});

// Create TTL index for expiration
urlSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Url = mongoose.model('Url', urlSchema);

class URLShortener {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    this.codeLength = 6;
    this.maxAttempts = 10;
    this.defaultExpiration = 365 * 24 * 60 * 60 * 1000; // 1 year
  }

  // Create short URL
  async createShortUrl(originalUrl, options = {}) {
    const {
      customAlias,
      expirationDays,
      userId,
      metadata = {}
    } = options;

    // Validate URL
    if (!this.isValidUrl(originalUrl)) {
      throw new Error('Invalid URL format');
    }

    // Check if custom alias is available
    if (customAlias) {
      const existing = await Url.findOne({ 
        $or: [
          { shortCode: customAlias },
          { customAlias: customAlias }
        ]
      });
      
      if (existing) {
        throw new Error('Custom alias already exists');
      }
    }

    // Generate short code
    let shortCode = customAlias;
    let attempts = 0;

    while (!shortCode && attempts < this.maxAttempts) {
      const candidate = this.generateShortCode();
      
      const existing = await Url.findOne({ shortCode: candidate });
      if (!existing) {
        shortCode = candidate;
        break;
      }
      
      attempts++;
    }

    if (!shortCode) {
      throw new Error('Failed to generate unique short code');
    }

    // Calculate expiration
    const expiresAt = expirationDays ? 
      new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000) : 
      new Date(Date.now() + this.defaultExpiration);

    // Create URL document
    const urlDoc = new Url({
      originalUrl,
      shortCode,
      customAlias: customAlias || null,
      expiresAt,
      createdBy: userId,
      metadata
    });

    await urlDoc.save();

    return {
      id: urlDoc._id,
      originalUrl: urlDoc.originalUrl,
      shortCode: urlDoc.shortCode,
      customAlias: urlDoc.customAlias,
      shortUrl: `${this.baseUrl}/${urlDoc.shortCode}`,
      expiresAt: urlDoc.expiresAt,
      createdAt: urlDoc.createdAt
    };
  }

  // Get original URL from short code
  async getOriginalUrl(shortCode, options = {}) {
    const { trackClick = true, userAgent, ipAddress, referer } = options;

    const urlDoc = await Url.findOne({
      $or: [
        { shortCode: shortCode },
        { customAlias: shortCode }
      ],
      isActive: true,
      $or: [
        { expiresAt: { $gt: new Date() } },
        { expiresAt: null }
      ]
    });

    if (!urlDoc) {
      throw new Error('Short URL not found or expired');
    }

    // Track click if enabled
    if (trackClick) {
      await this.trackClick(urlDoc._id, { userAgent, ipAddress, referer });
    }

    return urlDoc.originalUrl;
  }

  // Track click analytics
  async trackClick(urlId, metadata = {}) {
    const updateData = {
      $inc: { clickCount: 1 },
      $set: { lastClickAt: new Date() }
    };

    // Update daily clicks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    updateData.$push = {
      'analytics.dailyClicks': {
        $each: [{ date: today, clicks: 1 }],
        $slice: -365 // Keep only last 365 days
      }
    };

    // Update country stats if provided
    if (metadata.country) {
      updateData.$push = updateData.$push || {};
      updateData.$push['analytics.countryStats'] = {
        $each: [{ country: metadata.country, clicks: 1 }],
        $slice: -50 // Keep top 50 countries
      };
    }

    // Update referrer stats if provided
    if (metadata.referer) {
      updateData.$push = updateData.$push || {};
      updateData.$push['analytics.referrerStats'] = {
        $each: [{ referrer: metadata.referer, clicks: 1 }],
        $slice: -50 // Keep top 50 referrers
      };
    }

    await Url.findByIdAndUpdate(urlId, updateData);
  }

  // Get URL statistics
  async getUrlStats(shortCode) {
    const urlDoc = await Url.findOne({
      $or: [
        { shortCode: shortCode },
        { customAlias: shortCode }
      ]
    });

    if (!urlDoc) {
      throw new Error('Short URL not found');
    }

    return {
      id: urlDoc._id,
      originalUrl: urlDoc.originalUrl,
      shortCode: urlDoc.shortCode,
      customAlias: urlDoc.customAlias,
      shortUrl: `${this.baseUrl}/${urlDoc.shortCode}`,
      createdAt: urlDoc.createdAt,
      expiresAt: urlDoc.expiresAt,
      clickCount: urlDoc.clickCount,
      lastClickAt: urlDoc.lastClickAt,
      isActive: urlDoc.isActive,
      analytics: urlDoc.analytics
    };
  }

  // Get user URLs
  async getUserUrls(userId, options = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const urls = await Url.find({ createdBy: userId })
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .select('-analytics');

    const total = await Url.countDocuments({ createdBy: userId });

    return {
      urls: urls.map(url => ({
        id: url._id,
        originalUrl: url.originalUrl,
        shortCode: url.shortCode,
        customAlias: url.customAlias,
        shortUrl: `${this.baseUrl}/${url.shortCode}`,
        createdAt: url.createdAt,
        expiresAt: url.expiresAt,
        clickCount: url.clickCount,
        lastClickAt: url.lastClickAt,
        isActive: url.isActive
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  // Update URL
  async updateUrl(shortCode, updates, userId) {
    const urlDoc = await Url.findOne({
      $or: [
        { shortCode: shortCode },
        { customAlias: shortCode }
      ],
      createdBy: userId
    });

    if (!urlDoc) {
      throw new Error('URL not found or access denied');
    }

    // Prevent changing short code or custom alias
    delete updates.shortCode;
    delete updates.customAlias;

    Object.assign(urlDoc, updates);
    await urlDoc.save();

    return {
      id: urlDoc._id,
      originalUrl: urlDoc.originalUrl,
      shortCode: urlDoc.shortCode,
      customAlias: urlDoc.customAlias,
      shortUrl: `${this.baseUrl}/${urlDoc.shortCode}`,
      expiresAt: urlDoc.expiresAt,
      isActive: urlDoc.isActive
    };
  }

  // Delete URL
  async deleteUrl(shortCode, userId) {
    const result = await Url.deleteOne({
      $or: [
        { shortCode: shortCode },
        { customAlias: shortCode }
      ],
      createdBy: userId
    });

    if (result.deletedCount === 0) {
      throw new Error('URL not found or access denied');
    }

    return true;
  }

  // Toggle URL active status
  async toggleUrlStatus(shortCode, userId) {
    const urlDoc = await Url.findOne({
      $or: [
        { shortCode: shortCode },
        { customAlias: shortCode }
      ],
      createdBy: userId
    });

    if (!urlDoc) {
      throw new Error('URL not found or access denied');
    }

    urlDoc.isActive = !urlDoc.isActive;
    await urlDoc.save();

    return {
      id: urlDoc._id,
      shortCode: urlDoc.shortCode,
      isActive: urlDoc.isActive
    };
  }

  // Generate short code
  generateShortCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < this.codeLength; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  // Validate URL format
  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Check if custom alias is available
  async isCustomAliasAvailable(alias) {
    const existing = await Url.findOne({
      $or: [
        { shortCode: alias },
        { customAlias: alias }
      ]
    });
    
    return !existing;
  }

  // Get system statistics
  async getSystemStats() {
    const totalUrls = await Url.countDocuments();
    const activeUrls = await Url.countDocuments({ isActive: true });
    const expiredUrls = await Url.countDocuments({ 
      expiresAt: { $lt: new Date() } 
    });
    const totalClicks = await Url.aggregate([
      { $group: { _id: null, total: { $sum: '$clickCount' } } }
    ]);

    return {
      totalUrls,
      activeUrls,
      expiredUrls,
      totalClicks: totalClicks[0]?.total || 0,
      averageClicksPerUrl: totalUrls > 0 ? (totalClicks[0]?.total || 0) / totalUrls : 0
    };
  }

  // Cleanup expired URLs
  async cleanupExpiredUrls() {
    const result = await Url.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    console.log(`[URL_SHORTENER] Cleaned up ${result.deletedCount} expired URLs`);
    return result.deletedCount;
  }

  // Export user URLs
  async exportUserUrls(userId) {
    const urls = await Url.find({ createdBy: userId })
      .sort({ createdAt: -1 });

    return urls.map(url => ({
      originalUrl: url.originalUrl,
      shortCode: url.shortCode,
      customAlias: url.customAlias,
      shortUrl: `${this.baseUrl}/${url.shortCode}`,
      createdAt: url.createdAt,
      expiresAt: url.expiresAt,
      clickCount: url.clickCount,
      lastClickAt: url.lastClickAt,
      isActive: url.isActive
    }));
  }

  // Middleware for URL shortening
  middleware() {
    return (req, res, next) => {
      req.urlShortener = this;
      next();
    };
  }
}

// Create singleton instance
const urlShortener = new URLShortener();

module.exports = urlShortener;
