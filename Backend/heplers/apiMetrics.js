class ApiMetrics {
  constructor() {
    this.metrics = new Map();
    this.resetInterval = 60000; // Reset metrics every minute
    this.startMetricsCollection();
  }

  // Start metrics collection
  startMetricsCollection() {
    setInterval(() => {
      this.collectMetrics();
      this.resetMetrics();
    }, this.resetInterval);
  }

  // Record API call
  recordCall(method, route, statusCode, duration, userId = null) {
    const key = `${method}:${route}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, {
        method,
        route,
        totalCalls: 0,
        successCalls: 0,
        errorCalls: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        statusCodes: new Map(),
        users: new Set(),
        lastCalled: null
      });
    }

    const metric = this.metrics.get(key);
    
    metric.totalCalls++;
    metric.totalDuration += duration;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);
    metric.lastCalled = new Date();
    
    if (statusCode >= 200 && statusCode < 400) {
      metric.successCalls++;
    } else {
      metric.errorCalls++;
    }
    
    // Track status codes
    const statusCodeCount = metric.statusCodes.get(statusCode) || 0;
    metric.statusCodes.set(statusCode, statusCodeCount + 1);
    
    // Track unique users
    if (userId) {
      metric.users.add(userId);
    }
  }

  // Get metrics for a specific endpoint
  getMetrics(method, route) {
    const key = `${method}:${route}`;
    const metric = this.metrics.get(key);
    
    if (!metric) {
      return null;
    }

    return {
      method,
      route,
      totalCalls: metric.totalCalls,
      successCalls: metric.successCalls,
      errorCalls: metric.errorCalls,
      successRate: metric.totalCalls > 0 ? (metric.successCalls / metric.totalCalls) * 100 : 0,
      averageDuration: metric.totalCalls > 0 ? metric.totalDuration / metric.totalCalls : 0,
      minDuration: metric.minDuration === Infinity ? 0 : metric.minDuration,
      maxDuration: metric.maxDuration,
      statusCodes: Object.fromEntries(metric.statusCodes),
      uniqueUsers: metric.users.size,
      lastCalled: metric.lastCalled
    };
  }

  // Get all metrics
  getAllMetrics() {
    const allMetrics = [];
    
    this.metrics.forEach((metric, key) => {
      allMetrics.push(this.getMetrics(metric.method, metric.route));
    });
    
    return allMetrics.sort((a, b) => b.totalCalls - a.totalCalls);
  }

  // Get metrics summary
  getSummary() {
    const summary = {
      totalCalls: 0,
      totalErrors: 0,
      totalDuration: 0,
      averageDuration: 0,
      uniqueEndpoints: this.metrics.size,
      topEndpoints: [],
      errorRate: 0,
      slowEndpoints: []
    };

    this.metrics.forEach((metric) => {
      summary.totalCalls += metric.totalCalls;
      summary.totalErrors += metric.errorCalls;
      summary.totalDuration += metric.totalDuration;
    });

    summary.averageDuration = summary.totalCalls > 0 ? summary.totalDuration / summary.totalCalls : 0;
    summary.errorRate = summary.totalCalls > 0 ? (summary.totalErrors / summary.totalCalls) * 100 : 0;

    // Get top endpoints by calls
    summary.topEndpoints = this.getAllMetrics().slice(0, 10);

    // Get slow endpoints
    summary.slowEndpoints = this.getAllMetrics()
      .filter(m => m.averageDuration > 1000)
      .sort((a, b) => b.averageDuration - a.averageDuration)
      .slice(0, 5);

    return summary;
  }

  // Get metrics by time period
  getMetricsByTimeRange(minutes = 60) {
    const now = new Date();
    const startTime = new Date(now.getTime() - minutes * 60 * 1000);
    
    const timeRangeMetrics = [];
    
    this.metrics.forEach((metric, key) => {
      if (metric.lastCalled && metric.lastCalled >= startTime) {
        timeRangeMetrics.push(this.getMetrics(metric.method, metric.route));
      }
    });
    
    return timeRangeMetrics;
  }

  // Get error metrics
  getErrorMetrics() {
    const errorMetrics = [];
    
    this.metrics.forEach((metric, key) => {
      if (metric.errorCalls > 0) {
        const metrics = this.getMetrics(metric.method, metric.route);
        if (metrics.errorRate > 0) {
          errorMetrics.push(metrics);
        }
      }
    });
    
    return errorMetrics.sort((a, b) => b.errorRate - a.errorRate);
  }

  // Get performance metrics
  getPerformanceMetrics() {
    const performanceMetrics = [];
    
    this.metrics.forEach((metric, key) => {
      if (metric.totalCalls > 0) {
        const metrics = this.getMetrics(metric.method, metric.route);
        if (metrics.averageDuration > 500) { // Slow endpoints
          performanceMetrics.push(metrics);
        }
      }
    });
    
    return performanceMetrics.sort((a, b) => b.averageDuration - a.averageDuration);
  }

  // Reset metrics
  resetMetrics() {
    this.metrics.clear();
  }

  // Collect and send metrics to monitoring service
  collectMetrics() {
    const summary = this.getSummary();
    
    // Log metrics summary
    console.log(`[METRICS] Total calls: ${summary.totalCalls}, Error rate: ${summary.errorRate.toFixed(2)}%, Avg duration: ${summary.averageDuration.toFixed(2)}ms`);
    
    // Send to monitoring service (placeholder)
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoringService(summary);
    }
  }

  // Send metrics to monitoring service
  sendToMonitoringService(metrics) {
    // Placeholder for monitoring service integration
    console.log('METRICS_SUMMARY:', JSON.stringify({
      service: 'fashon-api',
      timestamp: new Date().toISOString(),
      metrics: {
        totalCalls: metrics.totalCalls,
        totalErrors: metrics.totalErrors,
        errorRate: metrics.errorRate,
        averageDuration: metrics.averageDuration,
        uniqueEndpoints: metrics.uniqueEndpoints
      }
    }));
  }

  // Export metrics
  export() {
    const exported = {};
    
    this.metrics.forEach((metric, key) => {
      exported[key] = {
        method: metric.method,
        route: metric.route,
        totalCalls: metric.totalCalls,
        successCalls: metric.successCalls,
        errorCalls: metric.errorCalls,
        totalDuration: metric.totalDuration,
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration,
        statusCodes: Object.fromEntries(metric.statusCodes),
        uniqueUsers: metric.users.size,
        lastCalled: metric.lastCalled
      };
    });
    
    return JSON.stringify(exported, null, 2);
  }

  // Middleware to track API calls
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const duration = Date.now() - startTime;
        
        // Record the call
        this.recordCall(
          req.method,
          req.route?.path || req.originalUrl,
          res.statusCode,
          duration,
          req.user?.id || null
        );
        
        originalEnd.call(this, chunk, encoding);
      }.bind(this);
      
      next();
    };
  }

  // Get real-time metrics
  getRealTimeMetrics() {
    return {
      timestamp: new Date().toISOString(),
      summary: this.getSummary(),
      topEndpoints: this.getSummary().topEndpoints.slice(0, 5),
      errors: this.getErrorMetrics().slice(0, 5),
      performance: this.getPerformanceMetrics().slice(0, 5)
    };
  }
}

// Create singleton instance
const apiMetrics = new ApiMetrics();

module.exports = apiMetrics;
