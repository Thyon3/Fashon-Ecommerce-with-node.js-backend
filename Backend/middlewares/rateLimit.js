const rateLimit = require('express-rate-limit');

class RateLimit {
  static middleware(options = {}) {
    const defaults = {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false
    };

    return rateLimit({ ...defaults, ...options });
  }

  static configure(app, options = {}) {
    app.use(this.middleware(options));
  }

  static strict() {
    return this.middleware({
      windowMs: 15 * 60 * 1000,
      max: 50,
      message: 'Rate limit exceeded'
    });
  }

  static api() {
    return this.middleware({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 30,
      message: 'API rate limit exceeded'
    });
  }
}

module.exports = RateLimit;
