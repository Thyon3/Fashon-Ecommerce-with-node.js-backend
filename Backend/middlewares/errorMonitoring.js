class ErrorMonitoring {
  static middleware() {
    return (error, req, res, next) => {
      // Create error object for monitoring
      const errorData = {
        timestamp: new Date().toISOString(),
        requestId: req.requestId || 'unknown',
        traceId: req.traceId || 'unknown',
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || 'anonymous',
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          code: error.code
        },
        body: req.body,
        query: req.query,
        params: req.params
      };
      
      // Log error for monitoring
      this.logError(errorData);
      
      // Send error to monitoring service (placeholder)
      this.sendToMonitoringService(errorData);
      
      // Send appropriate error response
      if (!res.headersSent) {
        const statusCode = error.statusCode || error.status || 500;
        
        res.status(statusCode).json({
          error: error.name || 'InternalServerError',
          message: process.env.NODE_ENV === 'production' 
            ? 'An unexpected error occurred' 
            : error.message,
          requestId: req.requestId,
          traceId: req.traceId,
          timestamp: errorData.timestamp
        });
      }
    };
  }
  
  static logError(errorData) {
    const logMessage = `[ERROR:${errorData.requestId}] ${errorData.error.name}: ${errorData.error.message}`;
    
    if (errorData.error.statusCode >= 500) {
      console.error(logMessage);
      console.error('Stack:', errorData.error.stack);
    } else {
      console.warn(logMessage);
    }
  }
  
  static sendToMonitoringService(errorData) {
    // In production, this would send to a monitoring service like:
    // - Sentry
    // - New Relic
    // - DataDog
    // - Custom monitoring endpoint
    
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for monitoring service integration
      console.log('MONITORING:', JSON.stringify({
        service: 'fashon-api',
        error: errorData.error.name,
        message: errorData.error.message,
        requestId: errorData.requestId,
        userId: errorData.userId,
        timestamp: errorData.timestamp
      }));
    }
  }
  
  // Track custom metrics
  static trackMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: new Date().toISOString()
    };
    
    console.log('METRIC:', JSON.stringify(metric));
    
    // In production, send to metrics service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for metrics service integration
    }
  }
  
  // Track performance metrics
  static trackPerformance(req, res, duration) {
    this.trackMetric('request.duration', duration, {
      method: req.method,
      route: req.route?.path || req.originalUrl,
      statusCode: res.statusCode,
      userId: req.user?.id || 'anonymous'
    });
    
    // Track slow requests
    if (duration > 1000) {
      this.trackMetric('request.slow', 1, {
        method: req.method,
        route: req.route?.path || req.originalUrl,
        duration: duration.toString()
      });
    }
  }
  
  // Track error rates
  static trackErrorRate(error, req) {
    this.trackMetric('error.count', 1, {
      errorType: error.name,
      method: req.method,
      route: req.route?.path || req.originalUrl,
      userId: req.user?.id || 'anonymous'
    });
  }
}

module.exports = ErrorMonitoring;
