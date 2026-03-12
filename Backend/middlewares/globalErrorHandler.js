const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class GlobalErrorHandler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableLogging: options.enableLogging !== false,
      logFile: options.logFile || path.join(process.cwd(), 'logs', 'errors.log'),
      enableMetrics: options.enableMetrics !== false,
      enableReporting: options.enableReporting || false,
      reportingService: options.reportingService || null,
      enableStackTrace: options.enableStackTrace !== false,
      enableContext: options.enableContext !== false,
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: options.maxLogFiles || 5,
      enableErrorClassification: options.enableErrorClassification || false,
      enableRateLimiting: options.enableRateLimiting || false,
      errorRateLimit: options.errorRateLimit || 100, // errors per minute
      enableCircuitBreaker: options.enableCircuitBreaker || false,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 50,
      enableRecovery: options.enableRecovery || false,
      recoveryStrategies: options.recoveryStrategies || {},
      enableAlerting: options.enableAlerting || false,
      alertThreshold: options.alertThreshold || 10, // errors in 5 minutes
      ...options
    };
    
    this.metrics = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByEndpoint: new Map(),
      errorsByHour: new Map(),
      criticalErrors: 0,
      recoverableErrors: 0,
      unrecoverableErrors: 0,
      errorsReported: 0,
      alertsTriggered: 0
    };
    
    this.errorHistory = [];
    this.errorRate = [];
    this.circuitBreakerState = 'closed';
    
    this.init();
  }

  init() {
    if (this.options.enableLogging) {
      this.setupLogging();
    }
    
    if (this.options.enableRateLimiting) {
      this.startRateLimiting();
    }
    
    console.log('[GLOBAL_ERROR_HANDLER] Global error handler initialized');
  }

  setupLogging() {
    // Ensure log directory exists
    fs.mkdir(path.dirname(this.options.logFile), { recursive: true })
      .catch(error => console.error('[GLOBAL_ERROR_HANDLER] Failed to create log directory:', error));
  }

  startRateLimiting() {
    setInterval(() => {
      this.calculateErrorRate();
    }, 60000); // Every minute
  }

  calculateErrorRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneMinuteAgo);
    const rate = recentErrors.length;
    
    this.errorRate.push({
      timestamp: now,
      rate,
      errors: recentErrors
    });
    
    // Keep only last 60 minutes of rate data
    if (this.errorRate.length > 60) {
      this.errorRate = this.errorRate.slice(-60);
    }
    
    // Check rate limit
    if (rate > this.options.errorRateLimit) {
      this.handleRateLimitExceeded(rate);
    }
    
    // Check alert threshold
    if (this.options.enableAlerting) {
      const fiveMinutesAgo = now - 300000; // 5 minutes
      const errorsIn5Minutes = this.errorHistory.filter(error => error.timestamp > fiveMinutesAgo);
      
      if (errorsIn5Minutes.length >= this.options.alertThreshold) {
        this.triggerAlert(errorsIn5Minutes);
      }
    }
  }

  handleRateLimitExceeded(rate) {
    console.warn(`[GLOBAL_ERROR_HANDLER] Error rate limit exceeded: ${rate} errors/minute`);
    
    if (this.options.enableCircuitBreaker) {
      this.openCircuitBreaker();
    }
    
    this.emit('rate_limit_exceeded', { rate, timestamp: Date.now() });
  }

  triggerAlert(errors) {
    this.metrics.alertsTriggered++;
    
    const alert = {
      timestamp: Date.now(),
      count: errors.length,
      errors: errors.slice(-10), // Last 10 errors
      severity: 'high'
    };
    
    console.error(`[GLOBAL_ERROR_HANDLER] Alert triggered: ${errors.length} errors in 5 minutes`);
    
    this.emit('alert:triggered', alert);
    
    if (this.options.enableReporting && this.options.reportingService) {
      this.reportAlert(alert);
    }
  }

  openCircuitBreaker() {
    this.circuitBreakerState = 'open';
    console.error('[GLOBAL_ERROR_HANDLER] Circuit breaker opened due to high error rate');
    
    this.emit('circuit_breaker:opened', {
      timestamp: Date.now(),
      threshold: this.options.circuitBreakerThreshold
    });
    
    // Auto-close after 5 minutes
    setTimeout(() => {
      this.closeCircuitBreaker();
    }, 300000);
  }

  closeCircuitBreaker() {
    this.circuitBreakerState = 'closed';
    console.log('[GLOBAL_ERROR_HANDLER] Circuit breaker closed');
    
    this.emit('circuit_breaker:closed', {
      timestamp: Date.now()
    });
  }

  handleError(error, req = null, res = null) {
    const errorInfo = this.createErrorInfo(error, req, res);
    
    // Update metrics
    this.updateMetrics(errorInfo);
    
    // Log error
    if (this.options.enableLogging) {
      this.logError(errorInfo);
    }
    
    // Classify error
    if (this.options.enableErrorClassification) {
      this.classifyError(errorInfo);
    }
    
    // Attempt recovery
    if (this.options.enableRecovery) {
      this.attemptRecovery(errorInfo, req, res);
    }
    
    // Report error
    if (this.options.enableReporting) {
      this.reportError(errorInfo);
    }
    
    // Emit event
    this.emit('error:handled', errorInfo);
    
    return errorInfo;
  }

  createErrorInfo(error, req, res) {
    const errorInfo = {
      id: this.generateErrorId(),
      timestamp: Date.now(),
      message: error.message,
      stack: this.options.enableStackTrace ? error.stack : null,
      name: error.name,
      code: error.code || 'UNKNOWN_ERROR',
      severity: this.determineSeverity(error),
      recoverable: this.isRecoverable(error),
      context: this.options.enableContext ? this.extractContext(req, res) : null,
      classification: null,
      recoveryAttempted: false,
      recoverySuccessful: false,
      reported: false
    };
    
    return errorInfo;
  }

  generateErrorId() {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  determineSeverity(error) {
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return 'low';
    }
    
    if (error.name === 'UnauthorizedError' || error.name === 'ForbiddenError') {
      return 'medium';
    }
    
    if (error.name === 'MongoError' || error.name === 'DatabaseError') {
      return 'high';
    }
    
    if (error.name === 'SystemError' || error.name === 'ProcessError') {
      return 'critical';
    }
    
    return 'medium';
  }

  isRecoverable(error) {
    const recoverableErrors = [
      'ValidationError',
      'CastError',
      'TimeoutError',
      'NetworkError',
      'RateLimitError'
    ];
    
    return recoverableErrors.includes(error.name);
  }

  extractContext(req, res) {
    if (!req) return null;
    
    return {
      request: {
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        query: req.query,
        params: req.params,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        referer: req.get('Referer'),
        headers: this.sanitizeHeaders(req.headers),
        timestamp: new Date().toISOString()
      },
      response: res ? {
        statusCode: res.statusCode,
        headers: res.getHeaders()
      } : null,
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : null,
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      }
    };
  }

  sanitizeHeaders(headers) {
    const sanitized = { ...headers };
    
    // Remove sensitive headers
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token'
    ];
    
    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  updateMetrics(errorInfo) {
    this.metrics.totalErrors++;
    
    // Update errors by type
    const typeCount = this.metrics.errorsByType.get(errorInfo.name) || 0;
    this.metrics.errorsByType.set(errorInfo.name, typeCount + 1);
    
    // Update errors by endpoint
    if (errorInfo.context && errorInfo.context.request) {
      const endpoint = `${errorInfo.context.request.method} ${errorInfo.context.request.path}`;
      const endpointCount = this.metrics.errorsByEndpoint.get(endpoint) || 0;
      this.metrics.errorsByEndpoint.set(endpoint, endpointCount + 1);
    }
    
    // Update errors by hour
    const hour = new Date().getHours();
    const hourCount = this.metrics.errorsByHour.get(hour) || 0;
    this.metrics.errorsByHour.set(hour, hourCount + 1);
    
    // Update severity metrics
    if (errorInfo.severity === 'critical') {
      this.metrics.criticalErrors++;
    }
    
    if (errorInfo.recoverable) {
      this.metrics.recoverableErrors++;
    } else {
      this.metrics.unrecoverableErrors++;
    }
    
    // Add to error history
    this.errorHistory.push(errorInfo);
    
    // Keep only last 1000 errors
    if (this.errorHistory.length > 1000) {
      this.errorHistory = this.errorHistory.slice(-1000);
    }
  }

  async logError(errorInfo) {
    try {
      const logEntry = this.formatLogEntry(errorInfo);
      
      await fs.appendFile(this.options.logFile, logEntry + '\n');
      
      // Rotate log if needed
      await this.rotateLogIfNeeded();
    } catch (loggingError) {
      console.error('[GLOBAL_ERROR_HANDLER] Failed to log error:', loggingError);
    }
  }

  formatLogEntry(errorInfo) {
    const logData = {
      id: errorInfo.id,
      timestamp: new Date(errorInfo.timestamp).toISOString(),
      level: this.getLogLevel(errorInfo.severity),
      message: errorInfo.message,
      name: errorInfo.name,
      code: errorInfo.code,
      severity: errorInfo.severity,
      recoverable: errorInfo.recoverable,
      context: errorInfo.context
    };
    
    if (errorInfo.stack) {
      logData.stack = errorInfo.stack;
    }
    
    return JSON.stringify(logData);
  }

  getLogLevel(severity) {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warn';
      case 'low': return 'info';
      default: return 'info';
    }
  }

  async rotateLogIfNeeded() {
    try {
      const stats = await fs.stat(this.options.logFile);
      
      if (stats.size > this.options.maxLogSize) {
        await this.rotateLog();
      }
    } catch (error) {
      // Log file might not exist yet
    }
  }

  async rotateLog() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = `${this.options.logFile}.${timestamp}`;
    
    try {
      await fs.rename(this.options.logFile, rotatedFile);
      
      // Clean up old log files
      await this.cleanupOldLogs();
      
      console.log(`[GLOBAL_ERROR_HANDLER] Error log rotated: ${rotatedFile}`);
    } catch (error) {
      console.error('[GLOBAL_ERROR_HANDLER] Failed to rotate error log:', error);
    }
  }

  async cleanupOldLogs() {
    try {
      const logDir = path.dirname(this.options.logFile);
      const files = await fs.readdir(logDir);
      
      const logFiles = files
        .filter(file => file.startsWith(path.basename(this.options.logFile)) && file !== path.basename(this.options.logFile))
        .map(file => path.join(logDir, file))
        .sort((a, b) => b.localeCompare(a));
      
      // Keep only the most recent files
      const filesToDelete = logFiles.slice(this.options.maxLogFiles);
      
      for (const file of filesToDelete) {
        await fs.unlink(file);
      }
      
      if (filesToDelete.length > 0) {
        console.log(`[GLOBAL_ERROR_HANDLER] Cleaned up ${filesToDelete.length} old error log files`);
      }
    } catch (error) {
      console.error('[GLOBAL_ERROR_HANDLER] Failed to cleanup old error logs:', error);
    }
  }

  classifyError(errorInfo) {
    const classification = this.classifyByPattern(errorInfo);
    
    errorInfo.classification = classification;
    
    this.emit('error:classified', errorInfo);
  }

  classifyByPattern(errorInfo) {
    const patterns = {
      'validation': {
        patterns: ['validation', 'invalid', 'required', 'missing'],
        category: 'input_validation'
      },
      'authentication': {
        patterns: ['unauthorized', 'authentication', 'login', 'token'],
        category: 'security'
      },
      'authorization': {
        patterns: ['forbidden', 'permission', 'access', 'role'],
        category: 'security'
      },
      'database': {
        patterns: ['database', 'connection', 'query', 'mongodb', 'mysql'],
        category: 'infrastructure'
      },
      'network': {
        patterns: ['network', 'timeout', 'connection', 'dns'],
        category: 'infrastructure'
      },
      'business': {
        patterns: ['business', 'logic', 'rule', 'constraint'],
        category: 'business_logic'
      }
    };
    
    const message = errorInfo.message.toLowerCase();
    const stack = errorInfo.stack ? errorInfo.stack.toLowerCase() : '';
    
    for (const [classification, config] of Object.entries(patterns)) {
      for (const pattern of config.patterns) {
        if (message.includes(pattern) || stack.includes(pattern)) {
          return {
            type: classification,
            category: config.category,
            confidence: 0.8
          };
        }
      }
    }
    
    return {
      type: 'unknown',
      category: 'general',
      confidence: 0.1
    };
  }

  attemptRecovery(errorInfo, req, res) {
    if (!errorInfo.recoverable || !this.options.recoveryStrategies[errorInfo.name]) {
      return;
    }
    
    const strategy = this.options.recoveryStrategies[errorInfo.name];
    
    try {
      if (typeof strategy === 'function') {
        const result = strategy(errorInfo, req, res);
        
        errorInfo.recoveryAttempted = true;
        errorInfo.recoverySuccessful = result;
        
        if (result) {
          console.log(`[GLOBAL_ERROR_HANDLER] Recovery successful for error ${errorInfo.id}`);
          this.emit('recovery:successful', errorInfo);
        } else {
          console.log(`[GLOBAL_ERROR_HANDLER] Recovery failed for error ${errorInfo.id}`);
          this.emit('recovery:failed', errorInfo);
        }
      }
    } catch (recoveryError) {
      console.error('[GLOBAL_ERROR_HANDLER] Recovery strategy failed:', recoveryError);
      errorInfo.recoveryAttempted = true;
      errorInfo.recoverySuccessful = false;
    }
  }

  reportError(errorInfo) {
    if (!this.options.reportingService) {
      return;
    }
    
    try {
      this.options.reportingService.report(errorInfo);
      errorInfo.reported = true;
      this.metrics.errorsReported++;
      
      this.emit('error:reported', errorInfo);
    } catch (reportingError) {
      console.error('[GLOBAL_ERROR_HANDLER] Failed to report error:', reportingError);
    }
  }

  reportAlert(alert) {
    if (!this.options.reportingService) {
      return;
    }
    
    try {
      this.options.reportingService.reportAlert(alert);
    } catch (reportingError) {
      console.error('[GLOBAL_ERROR_HANDLER] Failed to report alert:', reportingError);
    }
  }

  getStats() {
    return {
      ...this.metrics,
      errorsByType: Object.fromEntries(this.metrics.errorsByType),
      errorsByEndpoint: Object.fromEntries(this.metrics.errorsByEndpoint),
      errorsByHour: Object.fromEntries(this.metrics.errorsByHour),
      currentErrorRate: this.getCurrentErrorRate(),
      circuitBreakerState: this.circuitBreakerState,
      averageErrorsPerHour: this.calculateAverageErrorsPerHour()
    };
  }

  getCurrentErrorRate() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    const recentErrors = this.errorHistory.filter(error => error.timestamp > oneMinuteAgo);
    return recentErrors.length;
  }

  calculateAverageErrorsPerHour() {
    if (this.metrics.errorsByHour.size === 0) return 0;
    
    const total = Array.from(this.metrics.errorsByHour.values()).reduce((sum, count) => sum + count, 0);
    return total / this.metrics.errorsByHour.size;
  }

  getRecentErrors(limit = 50) {
    return this.errorHistory
      .slice(-limit)
      .reverse();
  }

  getErrorsByType(type, limit = 20) {
    return this.errorHistory
      .filter(error => error.name === type)
      .slice(-limit)
      .reverse();
  }

  getCriticalErrors(limit = 20) {
    return this.errorHistory
      .filter(error => error.severity === 'critical')
      .slice(-limit)
      .reverse();
  }

  clearHistory() {
    this.errorHistory = [];
    this.metrics = {
      totalErrors: 0,
      errorsByType: new Map(),
      errorsByEndpoint: new Map(),
      errorsByHour: new Map(),
      criticalErrors: 0,
      recoverableErrors: 0,
      unrecoverableErrors: 0,
      errorsReported: 0,
      alertsTriggered: 0
    };
    
    console.log('[GLOBAL_ERROR_HANDLER] Error history and metrics cleared');
  }

  middleware() {
    return (error, req, res, next) => {
      // Handle the error
      const errorInfo = this.handleError(error, req, res);
      
      // Send appropriate response
      if (!res.headersSent) {
        const statusCode = this.getStatusCode(errorInfo);
        const response = this.formatErrorResponse(errorInfo);
        
        res.status(statusCode).json(response);
      }
      
      // Don't call next() to prevent further error handling
    };
  }

  getStatusCode(errorInfo) {
    const statusCodes = {
      'ValidationError': 400,
      'CastError': 400,
      'UnauthorizedError': 401,
      'ForbiddenError': 403,
      'NotFoundError': 404,
      'ConflictError': 409,
      'RateLimitError': 429,
      'TimeoutError': 408,
      'NetworkError': 503,
      'DatabaseError': 500,
      'SystemError': 500
    };
    
    return statusCodes[errorInfo.name] || 500;
  }

  formatErrorResponse(errorInfo) {
    const response = {
      error: true,
      message: errorInfo.message,
      code: errorInfo.code,
      timestamp: new Date(errorInfo.timestamp).toISOString(),
      requestId: errorInfo.context?.request?.headers?.['x-request-id'] || null
    };
    
    // Add error ID for debugging
    if (errorInfo.id) {
      response.errorId = errorInfo.id;
    }
    
    // Add stack trace in development
    if (process.env.NODE_ENV === 'development' && errorInfo.stack) {
      response.stack = errorInfo.stack;
    }
    
    // Add recovery information
    if (errorInfo.recoveryAttempted) {
      response.recovery = {
        attempted: true,
        successful: errorInfo.recoverySuccessful
      };
    }
    
    return response;
  }

  // Static method to create global error handler
  static create(options = {}) {
    return new GlobalErrorHandler(options);
  }
}

module.exports = GlobalErrorHandler;
