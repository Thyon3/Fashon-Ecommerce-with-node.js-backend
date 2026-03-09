const { v4: uuidv4 } = require('uuid');

class RequestTracing {
  static middleware() {
    return (req, res, next) => {
      // Generate or get trace ID
      const traceId = req.headers['x-trace-id'] || uuidv4();
      
      // Generate span ID
      const spanId = uuidv4();
      
      // Add tracing information to request
      req.traceId = traceId;
      req.spanId = spanId;
      req.startTime = Date.now();
      
      // Add tracing headers to response
      res.setHeader('X-Trace-ID', traceId);
      res.setHeader('X-Span-ID', spanId);
      
      // Log trace start
      console.log(`[TRACE:${traceId}] Starting ${req.method} ${req.originalUrl}`);
      
      // Override res.end to log trace completion
      const originalEnd = res.end;
      res.end = function(chunk, encoding) {
        const duration = Date.now() - req.startTime;
        
        console.log(`[TRACE:${traceId}] Completed ${res.statusCode} in ${duration}ms`);
        
        // Add performance metrics
        res.setHeader('X-Response-Time', `${duration}ms`);
        
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    };
  }
  
  // Create child span for async operations
  static createChildSpan(parentTraceId, operation) {
    return {
      traceId: parentTraceId,
      spanId: uuidv4(),
      operation,
      startTime: Date.now(),
      endTime: null,
      duration: null
    };
  }
  
  // End span and calculate duration
  static endSpan(span) {
    span.endTime = Date.now();
    span.duration = span.endTime - span.startTime;
    
    console.log(`[TRACE:${span.traceId}] ${span.operation} completed in ${span.duration}ms`);
    
    return span;
  }
  
  // Trace database operations
  static traceDatabaseOperation(traceId, operation, collection) {
    const span = this.createChildSpan(traceId, `db:${operation}:${collection}`);
    return this.endSpan(span);
  }
  
  // Trace external API calls
  static traceExternalCall(traceId, url, method) {
    const span = this.createChildSpan(traceId, `external:${method}:${url}`);
    return this.endSpan(span);
  }
}

module.exports = RequestTracing;
