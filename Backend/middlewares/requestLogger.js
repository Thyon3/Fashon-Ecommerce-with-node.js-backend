const { v4: uuidv4 } = require('uuid');

class RequestLogger {
  static middleware() {
    return (req, res, next) => {
      // Generate unique request ID
      req.requestId = uuidv4();
      
      // Add request ID to response headers
      res.setHeader('X-Request-ID', req.requestId);
      
      // Log request start
      const startTime = Date.now();
      const logData = {
        requestId: req.requestId,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString(),
        startTime
      };
      
      // Log request details
      console.log(`[${logData.requestId}] ${logData.method} ${logData.url} - ${logData.ip}`);
      
      // Override res.end to log response
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const responseLog = {
          requestId: req.requestId,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          timestamp: new Date().toISOString()
        };
        
        console.log(`[${responseLog.requestId}] ${res.statusCode} - ${responseLog.duration}`);
        
        // Log slow requests
        if (duration > 1000) {
          console.warn(`[SLOW] [${responseLog.requestId}] ${req.method} ${req.originalUrl} took ${responseLog.duration}`);
        }
        
        // Log error responses
        if (res.statusCode >= 400) {
          console.error(`[ERROR] [${responseLog.requestId}] ${res.statusCode} - ${req.method} ${req.originalUrl}`);
        }
        
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    };
  }
}

module.exports = RequestLogger;
