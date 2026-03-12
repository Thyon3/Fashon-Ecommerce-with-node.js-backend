const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class RequestTracker extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enablePersistence: options.enablePersistence || false,
      logLevel: options.logLevel || 'info', // debug, info, warn, error
      logFormat: options.logFormat || 'json', // json, text
      logFile: options.logFile || path.join(process.cwd(), 'logs', 'requests.log'),
      maxLogSize: options.maxLogSize || 10 * 1024 * 1024, // 10MB
      maxLogFiles: options.maxLogFiles || 5,
      enableMetrics: options.enableMetrics !== false,
      enableRealTime: options.enableRealTime || false,
      enableSampling: options.enableSampling || false,
      sampleRate: options.sampleRate || 1.0,
      enableCompression: options.enableCompression || false,
      enableCorrelation: options.enableCorrelation || false,
      excludePaths: options.excludePaths || ['/health', '/metrics'],
      includeHeaders: options.includeHeaders || [],
      excludeHeaders: options.excludeHeaders || ['authorization', 'cookie'],
      ...options
    };
    
    this.requests = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsByPath: new Map(),
      requestsByMethod: new Map(),
      requestsByStatus: new Map(),
      requestsByHour: new Map(),
      activeRequests: 0,
      errorRate: 0
    };
    
    this.requestTimes = [];
    this.subscribers = new Set();
    
    this.init();
  }

  async init() {
    try {
      if (this.options.enablePersistence) {
        await this.ensureLogDirectory();
        await this.rotateLogsIfNeeded();
      }
      
      if (this.options.enableRealTime) {
        this.startRealTimeUpdates();
      }
      
      console.log('[REQUEST_TRACKER] Request tracker initialized');
    } catch (error) {
      console.error('[REQUEST_TRACKER] Failed to initialize:', error);
    }
  }

  async ensureLogDirectory() {
    const logDir = path.dirname(this.options.logFile);
    await fs.mkdir(logDir, { recursive: true });
  }

  async rotateLogsIfNeeded() {
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
      
      console.log(`[REQUEST_TRACKER] Log rotated: ${rotatedFile}`);
    } catch (error) {
      console.error('[REQUEST_TRACKER] Failed to rotate log:', error);
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
        console.log(`[REQUEST_TRACKER] Cleaned up ${filesToDelete.length} old log files`);
      }
    } catch (error) {
      console.error('[REQUEST_TRACKER] Failed to cleanup old logs:', error);
    }
  }

  generateRequestId() {
    return crypto.randomBytes(16).toString('hex');
  }

  generateCorrelationId(request) {
    if (this.options.enableCorrelation) {
      return request.get('X-Correlation-ID') || request.get('X-Request-ID') || this.generateRequestId();
    }
    return null;
  }

  shouldLogRequest(request) {
    // Check sampling rate
    if (this.options.enableSampling && Math.random() > this.options.sampleRate) {
      return false;
    }
    
    // Check excluded paths
    for (const excludePath of this.options.excludePaths) {
      if (request.path.startsWith(excludePath)) {
        return false;
      }
    }
    
    return true;
  }

  extractRequestInfo(request) {
    const info = {
      id: this.generateRequestId(),
      correlationId: this.generateCorrelationId(request),
      method: request.method,
      url: request.originalUrl,
      path: request.path,
      query: request.query,
      params: request.params,
      ip: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent'),
      referer: request.get('Referer'),
      timestamp: new Date().toISOString(),
      headers: {}
    };
    
    // Include specified headers
    for (const header of this.options.includeHeaders) {
      const value = request.get(header);
      if (value) {
        info.headers[header] = value;
      }
    }
    
    // Exclude specified headers
    for (const header of this.options.excludeHeaders) {
      delete info.headers[header.toLowerCase()];
    }
    
    return info;
  }

  extractResponseInfo(response) {
    return {
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      headers: response.getHeaders(),
      contentType: response.get('Content-Type'),
      contentLength: response.get('Content-Length'),
      timestamp: new Date().toISOString()
    };
  }

  async logRequest(request, response, startTime) {
    if (!this.shouldLogRequest(request)) {
      return;
    }
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const logEntry = {
      request: this.extractRequestInfo(request),
      response: this.extractResponseInfo(response),
      performance: {
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        responseTime,
        duration: `${responseTime}ms`
      },
      metadata: {
        success: response.statusCode < 400,
        error: response.statusCode >= 400,
        category: this.categorizeRequest(request, response),
        severity: this.getSeverity(response.statusCode)
      }
    };
    
    // Update metrics
    this.updateMetrics(logEntry);
    
    // Store active request
    this.requests.set(logEntry.request.id, logEntry);
    this.metrics.activeRequests++;
    
    // Log to file if enabled
    if (this.options.enablePersistence) {
      await this.writeLog(logEntry);
    }
    
    // Emit real-time event
    if (this.options.enableRealTime) {
      this.emit('request:logged', logEntry);
    }
    
    // Clean up after some time
    setTimeout(() => {
      this.requests.delete(logEntry.request.id);
      this.metrics.activeRequests--;
    }, 60000); // Keep for 1 minute
  }

  categorizeRequest(request, response) {
    const path = request.path.toLowerCase();
    
    if (path.startsWith('/api/')) {
      if (path.includes('/auth')) return 'authentication';
      if (path.includes('/user')) return 'user';
      if (path.includes('/product')) return 'product';
      if (path.includes('/order')) return 'order';
      if (path.includes('/cart')) return 'cart';
      if (path.includes('/payment')) return 'payment';
      return 'api';
    }
    
    if (path.startsWith('/admin/')) return 'admin';
    if (path.startsWith('/health')) return 'health';
    if (path.startsWith('/metrics')) return 'metrics';
    
    return 'other';
  }

  getSeverity(statusCode) {
    if (statusCode >= 500) return 'error';
    if (statusCode >= 400) return 'warn';
    if (statusCode >= 300) return 'info';
    return 'debug';
  }

  updateMetrics(logEntry) {
    const { request, response, performance } = logEntry;
    
    // Update total requests
    this.metrics.totalRequests++;
    
    // Update success/failure counts
    if (logEntry.metadata.success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }
    
    // Update response time
    this.requestTimes.push(performance.responseTime);
    if (this.requestTimes.length > 1000) {
      this.requestTimes = this.requestTimes.slice(-1000);
    }
    
    // Update average response time
    this.metrics.averageResponseTime = this.requestTimes.reduce((a, b) => a + b, 0) / this.requestTimes.length;
    
    // Update requests by path
    const pathCount = this.metrics.requestsByPath.get(request.path) || 0;
    this.metrics.requestsByPath.set(request.path, pathCount + 1);
    
    // Update requests by method
    const methodCount = this.metrics.requestsByMethod.get(request.method) || 0;
    this.metrics.requestsByMethod.set(request.method, methodCount + 1);
    
    // Update requests by status
    const statusCount = this.metrics.requestsByStatus.get(response.statusCode) || 0;
    this.metrics.requestsByStatus.set(response.statusCode, statusCount + 1);
    
    // Update requests by hour
    const hour = new Date().getHours();
    const hourCount = this.metrics.requestsByHour.get(hour) || 0;
    this.metrics.requestsByHour.set(hour, hourCount + 1);
    
    // Update error rate
    this.metrics.errorRate = this.metrics.totalRequests > 0 
      ? (this.metrics.failedRequests / this.metrics.totalRequests) * 100 
      : 0;
  }

  async writeLog(logEntry) {
    try {
      const logLine = this.formatLog(logEntry);
      
      await this.rotateLogsIfNeeded();
      
      await fs.appendFile(this.options.logFile, logLine + '\n');
    } catch (error) {
      console.error('[REQUEST_TRACKER] Failed to write log:', error);
    }
  }

  formatLog(logEntry) {
    switch (this.options.logFormat) {
      case 'json':
        return JSON.stringify(logEntry);
      case 'text':
        return this.formatTextLog(logEntry);
      default:
        return JSON.stringify(logEntry);
    }
  }

  formatTextLog(logEntry) {
    const { request, response, performance, metadata } = logEntry;
    
    return `[${new Date(logEntry.request.timestamp).toISOString()}] ` +
           `${metadata.severity.toUpperCase()} ` +
           `${request.method} ${request.path} ` +
           `${response.statusCode} ` +
           `${performance.responseTime}ms ` +
           `${request.ip} ` +
           `"${request.userAgent || 'Unknown'}"`;
  }

  startRealTimeUpdates() {
    setInterval(() => {
      const metrics = this.getMetrics();
      this.emit('metrics:updated', metrics);
    }, 1000); // Update every second
  }

  subscribe(callback) {
    const subscription = {
      id: this.generateRequestId(),
      callback
    };
    
    this.subscribers.add(subscription);
    
    return {
      unsubscribe: () => {
        this.subscribers.delete(subscription);
      }
    };
  }

  getMetrics() {
    return {
      ...this.metrics,
      requestsPerSecond: this.calculateRequestsPerSecond(),
      topPaths: this.getTopPaths(10),
      topErrors: this.getTopErrors(10),
      activeRequests: this.metrics.activeRequests
    };
  }

  calculateRequestsPerSecond() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    let recentRequests = 0;
    
    for (const request of this.requests.values()) {
      if (new Date(request.request.timestamp).getTime() > oneSecondAgo) {
        recentRequests++;
      }
    }
    
    return recentRequests;
  }

  getTopPaths(limit = 10) {
    return Array.from(this.metrics.requestsByPath.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([path, count]) => ({ path, count }));
  }

  getTopErrors(limit = 10) {
    return Array.from(this.metrics.requestsByStatus.entries())
      .filter(([statusCode]) => statusCode >= 400)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([statusCode, count]) => ({ statusCode, count }));
  }

  getRequest(id) {
    return this.requests.get(id);
  }

  getRequestsByTimeRange(startTime, endTime) {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    
    return Array.from(this.requests.values()).filter(request => {
      const requestTime = new Date(request.request.timestamp).getTime();
      return requestTime >= start && requestTime <= end;
    });
  }

  getRequestsByPath(path) {
    return Array.from(this.requests.values()).filter(request => 
      request.request.path === path
    );
  }

  getRequestsByUser(userId) {
    return Array.from(this.requests.values()).filter(request => 
      request.request.params.userId === userId
    );
  }

  getErrorRequests() {
    return Array.from(this.requests.values()).filter(request => 
      request.metadata.error
    );
  }

  getSlowRequests(threshold = 1000) {
    return Array.from(this.requests.values()).filter(request => 
      request.performance.responseTime > threshold
    ).sort((a, b) => b.performance.responseTime - a.performance.responseTime);
  }

  async exportLogs(startTime, endTime, format = 'json') {
    const requests = this.getRequestsByTimeRange(startTime, endTime);
    
    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(requests);
      case 'json':
      default:
        return JSON.stringify(requests, null, 2);
    }
  }

  convertToCSV(requests) {
    if (requests.length === 0) return '';
    
    const headers = [
      'id', 'method', 'path', 'statusCode', 'responseTime', 
      'ip', 'userAgent', 'timestamp', 'correlationId'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const request of requests) {
      const values = [
        request.request.id,
        request.request.method,
        request.request.path,
        request.response.statusCode,
        request.performance.responseTime,
        request.request.ip,
        `"${request.request.userAgent || ''}"`,
        request.request.timestamp,
        request.request.correlationId || ''
      ];
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  async clearLogs() {
    this.requests.clear();
    this.requestTimes = [];
    
    // Reset metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      requestsByPath: new Map(),
      requestsByMethod: new Map(),
      requestsByStatus: new Map(),
      requestsByHour: new Map(),
      activeRequests: 0,
      errorRate: 0
    };
    
    console.log('[REQUEST_TRACKER] Logs and metrics cleared');
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Store request ID for correlation
      req.requestId = this.generateRequestId();
      req.correlationId = req.correlationId || this.generateCorrelationId(req);
      
      // Add correlation ID to response headers
      res.set('X-Request-ID', req.requestId);
      if (req.correlationId) {
        res.set('X-Correlation-ID', req.correlationId);
      }
      
      // Override res.end to capture completion
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = Date.now();
        
        // Log the request
        this.logRequest(req, res, startTime).catch(error => {
          console.error('[REQUEST_TRACKER] Failed to log request:', error);
        });
        
        // Call original end
        originalEnd.apply(this, args);
      }.bind(this);
      
      next();
    };
  }

  // Static method to create request tracker
  static create(options = {}) {
    return new RequestTracker(options);
  }
}

module.exports = RequestTracker;
