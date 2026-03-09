class PerformanceMonitoring {
  static middleware() {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      const startMemory = process.memoryUsage();
      
      // Override res.end to capture performance metrics
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const endTime = process.hrtime.bigint();
        const endMemory = process.memoryUsage();
        
        // Calculate duration in milliseconds
        const duration = Number(endTime - startTime) / 1000000;
        
        // Calculate memory usage
        const memoryUsage = {
          heapUsed: endMemory.heapUsed - startMemory.heapUsed,
          heapTotal: endMemory.heapTotal - startMemory.heapTotal,
          rss: endMemory.rss - startMemory.rss,
          external: endMemory.external - startMemory.external
        };
        
        // Track performance metrics
        this.trackPerformanceMetrics(req, res, duration, memoryUsage);
        
        // Add performance headers
        res.setHeader('X-Response-Time', `${duration.toFixed(2)}ms`);
        res.setHeader('X-Memory-Used', `${(memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        
        originalEnd.call(this, chunk, encoding);
      }.bind(this);
      
      next();
    };
  }
  
  static trackPerformanceMetrics(req, res, duration, memoryUsage) {
    const metrics = {
      timestamp: new Date().toISOString(),
      requestId: req.requestId || 'unknown',
      traceId: req.traceId || 'unknown',
      method: req.method,
      url: req.originalUrl,
      route: req.route?.path || 'unknown',
      statusCode: res.statusCode,
      duration: duration,
      memory: memoryUsage,
      cpu: process.cpuUsage(),
      system: {
        uptime: process.uptime(),
        loadAverage: require('os').loadavg(),
        freeMemory: require('os').freemem(),
        totalMemory: require('os').totalmem()
      },
      userId: req.user?.id || 'anonymous'
    };
    
    // Log performance metrics
    this.logPerformanceMetrics(metrics);
    
    // Send to monitoring service
    this.sendToMonitoringService(metrics);
    
    // Alert on slow requests
    if (duration > 2000) {
      this.alertSlowRequest(metrics);
    }
    
    // Alert on high memory usage
    if (memoryUsage.heapUsed > 100 * 1024 * 1024) { // 100MB
      this.alertHighMemoryUsage(metrics);
    }
  }
  
  static logPerformanceMetrics(metrics) {
    console.log(`[PERF:${metrics.requestId}] ${metrics.method} ${metrics.route} - ${metrics.duration.toFixed(2)}ms`);
    
    // Log slow requests
    if (metrics.duration > 1000) {
      console.warn(`[SLOW:${metrics.requestId}] Request took ${metrics.duration.toFixed(2)}ms`);
    }
  }
  
  static sendToMonitoringService(metrics) {
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for monitoring service integration
      console.log('PERF_METRIC:', JSON.stringify({
        service: 'fashon-api',
        metric: 'request.duration',
        value: metrics.duration,
        tags: {
          method: metrics.method,
          route: metrics.route,
          statusCode: metrics.statusCode,
          userId: metrics.userId
        },
        timestamp: metrics.timestamp
      }));
    }
  }
  
  static alertSlowRequest(metrics) {
    console.error(`[ALERT:SLOW] ${metrics.method} ${metrics.route} took ${metrics.duration.toFixed(2)}ms`);
    
    // In production, send alert to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for alert service
    }
  }
  
  static alertHighMemoryUsage(metrics) {
    console.error(`[ALERT:MEMORY] High memory usage: ${(metrics.memory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    
    // In production, send alert to monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for alert service
    }
  }
  
  // Get system performance metrics
  static getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: {
          rss: memUsage.rss,
          heapTotal: memUsage.heapTotal,
          heapUsed: memUsage.heapUsed,
          external: memUsage.external,
          arrayBuffers: memUsage.arrayBuffers
        },
        cpu: {
          user: cpuUsage.user,
          system: cpuUsage.system
        }
      },
      system: {
        loadAverage: require('os').loadavg(),
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem(),
        cpus: require('os').cpus().length
      }
    };
  }
}

module.exports = PerformanceMonitoring;
