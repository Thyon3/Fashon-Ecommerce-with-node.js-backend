class APIMetrics {
  constructor() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      responseTime: [],
      statusCode: new Map(),
      endpoints: new Map()
    };
    this.startTime = Date.now();
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      const endpoint = `${req.method}:${req.route?.path || req.originalUrl}`;

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(...args) {
        const duration = Date.now() - startTime;
        
        // Record metrics
        req.metrics.recordRequest(endpoint, res.statusCode, duration);
        
        originalEnd.apply(this, args);
      };

      req.metrics = this;
      next();
    };
  }

  recordRequest(endpoint, statusCode, duration) {
    // Total requests
    this.metrics.requests.set('total', (this.metrics.requests.get('total') || 0) + 1);
    
    // Endpoint requests
    this.metrics.endpoints.set(endpoint, (this.metrics.endpoints.get(endpoint) || 0) + 1);
    
    // Status codes
    this.metrics.statusCode.set(statusCode, (this.metrics.statusCode.get(statusCode) || 0) + 1);
    
    // Response time
    this.metrics.responseTime.push(duration);
    if (this.metrics.responseTime.length > 1000) {
      this.metrics.responseTime.shift();
    }
    
    // Errors
    if (statusCode >= 400) {
      this.metrics.errors.set(statusCode, (this.metrics.errors.get(statusCode) || 0) + 1);
    }
  }

  getMetrics() {
    const totalRequests = this.metrics.requests.get('total') || 0;
    const totalErrors = Array.from(this.metrics.errors.values()).reduce((a, b) => a + b, 0);
    
    return {
      uptime: Date.now() - this.startTime,
      totalRequests,
      totalErrors,
      errorRate: totalRequests > 0 ? (totalErrors / totalRequests * 100).toFixed(2) + '%' : '0%',
      averageResponseTime: this.metrics.responseTime.length > 0 ? 
        Math.round(this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length) : 0,
      statusCodeDistribution: Object.fromEntries(this.metrics.statusCode),
      topEndpoints: this.getTopEndpoints(10)
    };
  }

  getTopEndpoints(limit = 10) {
    return Array.from(this.metrics.endpoints.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  reset() {
    this.metrics = {
      requests: new Map(),
      errors: new Map(),
      responseTime: [],
      statusCode: new Map(),
      endpoints: new Map()
    };
    this.startTime = Date.now();
  }
}

module.exports = new APIMetrics();
