const NodeCache = require('node-cache');

class Cache {
  static cache = new NodeCache({
    stdTTL: 600, // 10 minutes
    checkperiod: 120 // 2 minutes
  });

  static middleware(duration = 600) {
    return (req, res, next) => {
      const key = req.originalUrl;
      const cached = this.cache.get(key);

      if (cached) {
        return res.json(cached);
      }

      const originalJson = res.json;
      res.json = function(data) {
        Cache.cache.set(key, data, duration);
        return originalJson.call(this, data);
      };

      next();
    };
  }

  static get(key) {
    return this.cache.get(key);
  }

  static set(key, value, ttl) {
    return this.cache.set(key, value, ttl);
  }

  static del(key) {
    return this.cache.del(key);
  }

  static flush() {
    return this.cache.flushAll();
  }

  static stats() {
    return this.cache.getStats();
  }
}

module.exports = Cache;
