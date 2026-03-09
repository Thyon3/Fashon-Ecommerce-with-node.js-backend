const rateLimit = require('express-rate-limit');
const { RateLimiterMemory } = require('rate-limiter-flexible');

class UserRateLimit {
  static createRateLimit(options = {}) {
    const {
      windowMs = 15 * 60 * 1000, // 15 minutes
      max = 100, // 100 requests per window
      message = 'Too many requests from this user, please try again later.',
      keyGenerator = (req) => req.user?.id || req.ip
    } = options;
    
    return rateLimit({
      windowMs,
      max,
      message: {
        error: 'Rate Limit Exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000)
      },
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator,
      handler: (req, res) => {
        res.status(429).json({
          error: 'Rate Limit Exceeded',
          message,
          retryAfter: Math.ceil(windowMs / 1000),
          userId: req.user?.id || 'anonymous'
        });
      }
    });
  }
  
  // Predefined rate limiters for different user types
  static rateLimiters = {
    // Anonymous users - more restrictive
    anonymous: this.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 50, // 50 requests per 15 minutes
      message: 'Too many requests from anonymous users, please login or wait.',
      keyGenerator: (req) => req.ip
    }),
    
    // Regular users
    user: this.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200, // 200 requests per 15 minutes
      message: 'Too many requests, please try again later.',
      keyGenerator: (req) => req.user?.id || req.ip
    }),
    
    // Premium users
    premium: this.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 500, // 500 requests per 15 minutes
      message: 'Too many requests, please try again later.',
      keyGenerator: (req) => req.user?.id || req.ip
    }),
    
    // Admin users - less restrictive
    admin: this.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // 1000 requests per 15 minutes
      message: 'Too many requests, please try again later.',
      keyGenerator: (req) => req.user?.id || req.ip
    }),
    
    // Authentication endpoints - very restrictive
    auth: this.createRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 attempts per 15 minutes
      message: 'Too many authentication attempts, please try again later.',
      keyGenerator: (req) => req.ip
    }),
    
    // Password reset - very restrictive
    passwordReset: this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 3, // 3 attempts per hour
      message: 'Too many password reset attempts, please try again later.',
      keyGenerator: (req) => req.ip
    }),
    
    // File upload - restrictive
    upload: this.createRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 20, // 20 uploads per hour
      message: 'Too many upload attempts, please try again later.',
      keyGenerator: (req) => req.user?.id || req.ip
    }),
    
    // Search - moderate
    search: this.createRateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30, // 30 searches per minute
      message: 'Too many search requests, please try again later.',
      keyGenerator: (req) => req.user?.id || req.ip
    })
  };
  
  // Get appropriate rate limiter based on user role
  static getRateLimiter(req) {
    if (!req.user) {
      return this.rateLimiters.anonymous;
    }
    
    if (req.user.isAdmin) {
      return this.rateLimiters.admin;
    }
    
    if (req.user.isPremium) {
      return this.rateLimiters.premium;
    }
    
    return this.rateLimiters.user;
  }
  
  // Middleware that applies rate limiting based on user type
  static middleware() {
    return (req, res, next) => {
      const limiter = this.getRateLimiter(req);
      limiter(req, res, next);
    };
  }
  
  // Get rate limit status for a user
  static async getRateLimitStatus(userId) {
    // This would typically use Redis or a database to track rate limits
    // For now, return a placeholder
    return {
      userId,
      remaining: 100,
      resetTime: new Date(Date.now() + 15 * 60 * 1000),
      limit: 100
    };
  }
}

module.exports = UserRateLimit;
