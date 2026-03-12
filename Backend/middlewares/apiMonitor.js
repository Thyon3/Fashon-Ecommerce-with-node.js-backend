const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class APIMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableMonitoring: options.enableMonitoring !== false,
      enableRealTime: options.enableRealTime || false,
      enableAlerting: options.enableAlerting || false,
      enablePersistence: options.enablePersistence || false,
      persistenceFile: options.persistenceFile || path.join(process.cwd(), 'data', 'api-metrics.json'),
      enableHealthChecks: options.enableHealthChecks !== false,
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      enablePerformanceTracking: options.enablePerformanceTracking !== false,
      enableErrorTracking: options.enableErrorTracking !== false,
      enableUsageTracking: options.enableUsageTracking !== false,
      enableEndpointMetrics: options.enableEndpointMetrics !== false,
      enableUserMetrics: options.enableUserMetrics || false,
      alertThresholds: options.alertThresholds || {
        responseTime: 2000, // 2 seconds
        errorRate: 5, // 5%
        requestRate: 1000, // requests per minute
        memoryUsage: 90, // percentage
        cpuUsage: 80 // percentage
      },
      retentionDays: options.retentionDays || 30,
      enableDashboard: options.enableDashboard || false,
      dashboardPort: options.dashboardPort || 3001,
      ...options
    };
    
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
        byHour: new Map(),
        byDay: new Map(),
        byUser: new Map(),
        byStatus: new Map()
      },
      performance: {
        responseTime: [],
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowestRequests: [],
        fastestRequests: []
      },
      errors: {
        total: 0,
        byType: new Map(),
        byEndpoint: new Map(),
        byHour: new Map(),
        recent: []
      },
      usage: {
        activeUsers: 0,
        totalUsers: 0,
        requestsPerMinute: 0,
        requestsPerHour: 0,
        peakUsage: null,
        usageHistory: []
      },
      system: {
        memoryUsage: [],
        cpuUsage: [],
        uptime: process.uptime(),
        lastRestart: new Date(process.uptime() * 1000).toISOString()
      },
      alerts: {
        triggered: 0,
        active: [],
        history: []
      }
    };
    
    this.startTime = Date.now();
    this.requestHistory = [];
    this.alertRules = new Map();
    
    this.init();
  }

  init() {
    if (this.options.enablePersistence) {
      this.loadPersistedMetrics();
    }
    
    if (this.options.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    if (this.options.enableRealTime) {
      this.startRealTimeUpdates();
    }
    
    if (this.options.enableDashboard) {
      this.startDashboard();
    }
    
    this.setupDefaultAlertRules();
    
    console.log('[API_MONITOR] API monitor initialized');
  }

  async loadPersistedMetrics() {
    try {
      const content = await fs.readFile(this.options.persistenceFile, 'utf8');
      const data = JSON.parse(content);
      
      // Restore metrics
      if (data.metrics) {
        this.metrics = {
          ...this.metrics,
          requests: {
            ...this.metrics.requests,
            byEndpoint: new Map(data.metrics.requests.byEndpoint || []),
            byMethod: new Map(data.metrics.requests.byMethod || []),
            byHour: new Map(data.metrics.requests.byHour || []),
            byDay: new Map(data.metrics.requests.byDay || []),
            byUser: new Map(data.metrics.requests.byUser || []),
            byStatus: new Map(data.metrics.requests.byStatus || [])
          },
          errors: {
            ...this.metrics.errors,
            byType: new Map(data.metrics.errors.byType || []),
            byEndpoint: new Map(data.metrics.errors.byEndpoint || []),
            byHour: new Map(data.metrics.errors.byHour || []),
            recent: data.metrics.errors.recent || []
          },
          usage: {
            ...this.metrics.usage,
            usageHistory: data.metrics.usage.usageHistory || []
          },
          system: {
            ...this.metrics.system,
            memoryUsage: data.metrics.system.memoryUsage || [],
            cpuUsage: data.metrics.system.cpuUsage || []
          }
        };
        
        this.requestHistory = data.requestHistory || [];
      }
      
      console.log('[API_MONITOR] Loaded persisted metrics');
    } catch (error) {
      console.log('[API_MONITOR] No persisted metrics found');
    }
  }

  async persistMetrics() {
    if (!this.options.enablePersistence) return;
    
    try {
      const data = {
        metrics: {
          requests: {
            ...this.metrics.requests,
            byEndpoint: Array.from(this.metrics.requests.byEndpoint.entries()),
            byMethod: Array.from(this.metrics.requests.byMethod.entries()),
            byHour: Array.from(this.metrics.requests.byHour.entries()),
            byDay: Array.from(this.metrics.requests.byDay.entries()),
            byUser: Array.from(this.metrics.requests.byUser.entries()),
            byStatus: Array.from(this.metrics.requests.byStatus.entries())
          },
          performance: {
            ...this.metrics.performance,
            responseTime: this.metrics.performance.responseTime.slice(-1000),
            slowestRequests: this.metrics.performance.slowestRequests.slice(-50),
            fastestRequests: this.metrics.performance.fastestRequests.slice(-50)
          },
          errors: {
            ...this.metrics.errors,
            byType: Array.from(this.metrics.errors.byType.entries()),
            byEndpoint: Array.from(this.metrics.errors.byEndpoint.entries()),
            byHour: Array.from(this.metrics.errors.byHour.entries()),
            recent: this.metrics.errors.recent.slice(-100)
          },
          usage: this.metrics.usage,
          system: {
            ...this.metrics.system,
            memoryUsage: this.metrics.system.memoryUsage.slice(-1000),
            cpuUsage: this.metrics.system.cpuUsage.slice(-1000)
          }
        },
        requestHistory: this.requestHistory.slice(-1000),
        timestamp: Date.now()
      };
      
      const dataDir = path.dirname(this.options.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      await fs.writeFile(this.options.persistenceFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[API_MONITOR] Failed to persist metrics:', error);
    }
  }

  startHealthChecks() {
    setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
    
    console.log('[API_MONITOR] Health checks started');
  }

  startRealTimeUpdates() {
    setInterval(() => {
      this.updateRealTimeMetrics();
      this.emit('metrics:updated', this.getMetrics());
    }, 5000); // Update every 5 seconds
    
    console.log('[API_MONITOR] Real-time updates started');
  }

  startDashboard() {
    // This would start a dashboard server
    // For now, just log that dashboard is enabled
    console.log(`[API_MONITOR] Dashboard enabled on port ${this.options.dashboardPort}`);
  }

  setupDefaultAlertRules() {
    // Response time alert
    this.addAlertRule('high_response_time', {
      condition: (metrics) => metrics.performance.averageResponseTime > this.options.alertThresholds.responseTime,
      message: 'Average response time exceeds threshold',
      severity: 'warning'
    });
    
    // Error rate alert
    this.addAlertRule('high_error_rate', {
      condition: (metrics) => {
        const total = metrics.requests.total;
        const errors = metrics.errors.total;
        return total > 0 && (errors / total) * 100 > this.options.alertThresholds.errorRate;
      },
      message: 'Error rate exceeds threshold',
      severity: 'critical'
    });
    
    // Request rate alert
    this.addAlertRule('high_request_rate', {
      condition: (metrics) => metrics.usage.requestsPerMinute > this.options.alertThresholds.requestRate,
      message: 'Request rate exceeds threshold',
      severity: 'warning'
    });
    
    // Memory usage alert
    this.addAlertRule('high_memory_usage', {
      condition: (metrics) => {
        const memUsage = process.memoryUsage();
        const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        return usagePercent > this.options.alertThresholds.memoryUsage;
      },
      message: 'Memory usage exceeds threshold',
      severity: 'critical'
    });
  }

  addAlertRule(name, rule) {
    this.alertRules.set(name, {
      ...rule,
      enabled: true,
      lastTriggered: null,
      triggerCount: 0
    });
    
    console.log(`[API_MONITOR] Added alert rule: ${name}`);
  }

  removeAlertRule(name) {
    this.alertRules.delete(name);
    console.log(`[API_MONITOR] Removed alert rule: ${name}`);
  }

  trackRequest(req, res, startTime) {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    const requestInfo = {
      id: this.generateRequestId(),
      method: req.method,
      url: req.originalUrl,
      path: req.path,
      statusCode: res.statusCode,
      responseTime,
      timestamp: startTime,
      endTime,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null,
      endpoint: `${req.method} ${req.path}`,
      success: res.statusCode < 400,
      error: res.statusCode >= 400
    };
    
    // Add to request history
    this.requestHistory.push(requestInfo);
    
    // Keep only last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
    
    // Update metrics
    this.updateRequestMetrics(requestInfo);
    this.updatePerformanceMetrics(requestInfo);
    this.updateUsageMetrics(requestInfo);
    
    // Check alerts
    if (this.options.enableAlerting) {
      this.checkAlerts();
    }
    
    // Emit event
    this.emit('request:tracked', requestInfo);
  }

  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updateRequestMetrics(requestInfo) {
    this.metrics.requests.total++;
    
    if (requestInfo.success) {
      this.metrics.requests.successful++;
    } else {
      this.metrics.requests.failed++;
    }
    
    // Update by endpoint
    const endpointCount = this.metrics.requests.byEndpoint.get(requestInfo.endpoint) || 0;
    this.metrics.requests.byEndpoint.set(requestInfo.endpoint, endpointCount + 1);
    
    // Update by method
    const methodCount = this.metrics.requests.byMethod.get(requestInfo.method) || 0;
    this.metrics.requests.byMethod.set(requestInfo.method, methodCount + 1);
    
    // Update by hour
    const hour = new Date(requestInfo.timestamp).getHours();
    const hourCount = this.metrics.requests.byHour.get(hour) || 0;
    this.metrics.requests.byHour.set(hour, hourCount + 1);
    
    // Update by day
    const day = new Date(requestInfo.timestamp).toISOString().split('T')[0];
    const dayCount = this.metrics.requests.byDay.get(day) || 0;
    this.metrics.requests.byDay.set(day, dayCount + 1);
    
    // Update by user
    if (requestInfo.userId) {
      const userCount = this.metrics.requests.byUser.get(requestInfo.userId) || 0;
      this.metrics.requests.byUser.set(requestInfo.userId, userCount + 1);
    }
    
    // Update by status
    const statusCount = this.metrics.requests.byStatus.get(requestInfo.statusCode) || 0;
    this.metrics.requests.byStatus.set(requestInfo.statusCode, statusCount + 1);
  }

  updatePerformanceMetrics(requestInfo) {
    this.metrics.performance.responseTime.push(requestInfo.responseTime);
    
    // Keep only last 1000 response times
    if (this.metrics.performance.responseTime.length > 1000) {
      this.metrics.performance.responseTime = this.metrics.performance.responseTime.slice(-1000);
    }
    
    // Calculate percentiles
    const sortedTimes = [...this.metrics.performance.responseTime].sort((a, b) => a - b);
    const len = sortedTimes.length;
    
    this.metrics.performance.averageResponseTime = sortedTimes.reduce((a, b) => a + b, 0) / len;
    this.metrics.performance.p50ResponseTime = sortedTimes[Math.floor(len * 0.5)];
    this.metrics.performance.p95ResponseTime = sortedTimes[Math.floor(len * 0.95)];
    this.metrics.performance.p99ResponseTime = sortedTimes[Math.floor(len * 0.99)];
    
    // Update slowest and fastest requests
    this.metrics.performance.slowestRequests.push(requestInfo);
    this.metrics.performance.fastestRequests.push(requestInfo);
    
    // Keep only top 50
    this.metrics.performance.slowestRequests = this.metrics.performance.slowestRequests
      .sort((a, b) => b.responseTime - a.responseTime)
      .slice(0, 50);
    
    this.metrics.performance.fastestRequests = this.metrics.performance.fastestRequests
      .sort((a, b) => a.responseTime - b.responseTime)
      .slice(0, 50);
  }

  updateUsageMetrics(requestInfo) {
    // Update active users
    if (requestInfo.userId) {
      this.metrics.usage.activeUsers = this.metrics.requests.byUser.size;
    }
    
    // Calculate requests per minute
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo);
    this.metrics.usage.requestsPerMinute = recentRequests.length;
    
    // Calculate requests per hour
    const oneHourAgo = now - 3600000;
    const hourlyRequests = this.requestHistory.filter(req => req.timestamp > oneHourAgo);
    this.metrics.usage.requestsPerHour = hourlyRequests.length;
    
    // Update peak usage
    if (this.metrics.usage.requestsPerMinute > (this.metrics.usage.peakUsage?.requestsPerMinute || 0)) {
      this.metrics.usage.peakUsage = {
        requestsPerMinute: this.metrics.usage.requestsPerMinute,
        timestamp: now
      };
    }
    
    // Update usage history
    this.metrics.usage.usageHistory.push({
      timestamp: now,
      requestsPerMinute: this.metrics.usage.requestsPerMinute,
      requestsPerHour: this.metrics.usage.requestsPerHour,
      activeUsers: this.metrics.usage.activeUsers
    });
    
    // Keep only last 24 hours of history
    const oneDayAgo = now - 86400000;
    this.metrics.usage.usageHistory = this.metrics.usage.usageHistory.filter(
      entry => entry.timestamp > oneDayAgo
    );
  }

  trackError(error, req = null) {
    const errorInfo = {
      id: this.generateRequestId(),
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code || 'UNKNOWN_ERROR',
      timestamp: Date.now(),
      request: req ? {
        method: req.method,
        url: req.originalUrl,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user?.id || null
      } : null
    };
    
    // Update error metrics
    this.metrics.errors.total++;
    
    // Update by type
    const typeCount = this.metrics.errors.byType.get(errorInfo.name) || 0;
    this.metrics.errors.byType.set(errorInfo.name, typeCount + 1);
    
    // Update by endpoint
    if (req) {
      const endpoint = `${req.method} ${req.path}`;
      const endpointCount = this.metrics.errors.byEndpoint.get(endpoint) || 0;
      this.metrics.errors.byEndpoint.set(endpoint, endpointCount + 1);
    }
    
    // Update by hour
    const hour = new Date(errorInfo.timestamp).getHours();
    const hourCount = this.metrics.errors.byHour.get(hour) || 0;
    this.metrics.errors.byHour.set(hour, hourCount + 1);
    
    // Add to recent errors
    this.metrics.errors.recent.push(errorInfo);
    
    // Keep only last 100 recent errors
    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent = this.metrics.errors.recent.slice(-100);
    }
    
    // Emit event
    this.emit('error:tracked', errorInfo);
  }

  performHealthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: this.getCPUUsage(),
      requests: {
        total: this.metrics.requests.total,
        successful: this.metrics.requests.successful,
        failed: this.metrics.requests.failed,
        rate: this.metrics.usage.requestsPerMinute
      },
      performance: {
        averageResponseTime: this.metrics.performance.averageResponseTime,
        p95ResponseTime: this.metrics.performance.p95ResponseTime
      },
      errors: {
        total: this.metrics.errors.total,
        rate: this.metrics.requests.total > 0 ? (this.metrics.errors.total / this.metrics.requests.total) * 100 : 0
      }
    };
    
    // Determine overall health status
    if (health.errors.rate > this.options.alertThresholds.errorRate) {
      health.status = 'degraded';
    }
    
    if (health.performance.averageResponseTime > this.options.alertThresholds.responseTime) {
      health.status = 'degraded';
    }
    
    if (health.memory.heapUsed / health.memory.heapTotal > 0.9) {
      health.status = 'critical';
    }
    
    // Update system metrics
    this.metrics.system.memoryUsage.push(health.memory.heapUsed / health.memory.heapTotal * 100);
    this.metrics.system.cpuUsage.push(health.cpu);
    
    // Keep only last 1000 entries
    if (this.metrics.system.memoryUsage.length > 1000) {
      this.metrics.system.memoryUsage = this.metrics.system.memoryUsage.slice(-1000);
    }
    
    if (this.metrics.system.cpuUsage.length > 1000) {
      this.metrics.system.cpuUsage = this.metrics.system.cpuUsage.slice(-1000);
    }
    
    this.emit('health:checked', health);
    
    return health;
  }

  getCPUUsage() {
    // Simulate CPU usage
    // In production, use actual CPU monitoring
    return Math.random() * 100;
  }

  updateRealTimeMetrics() {
    // Update system metrics
    const memUsage = process.memoryUsage();
    this.metrics.system.memoryUsage.push(memUsage.heapUsed / memUsage.heapTotal * 100);
    this.metrics.system.cpuUsage.push(this.getCPUUsage());
    
    // Update usage metrics
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentRequests = this.requestHistory.filter(req => req.timestamp > oneMinuteAgo);
    this.metrics.usage.requestsPerMinute = recentRequests.length;
    
    // Update total users
    this.metrics.usage.totalUsers = this.metrics.requests.byUser.size;
  }

  checkAlerts() {
    const metrics = this.getMetrics();
    
    for (const [name, rule] of this.alertRules.entries()) {
      if (!rule.enabled) continue;
      
      try {
        if (rule.condition(metrics)) {
          this.triggerAlert(name, rule);
        }
      } catch (error) {
        console.error(`[API_MONITOR] Error checking alert rule '${name}':`, error);
      }
    }
  }

  triggerAlert(ruleName, rule) {
    const now = Date.now();
    
    // Check if recently triggered (avoid spam)
    if (rule.lastTriggered && now - rule.lastTriggered < 60000) { // 1 minute cooldown
      return;
    }
    
    const alert = {
      id: this.generateRequestId(),
      rule: ruleName,
      message: rule.message,
      severity: rule.severity,
      timestamp: now,
      metrics: this.getMetrics()
    };
    
    // Update rule
    rule.lastTriggered = now;
    rule.triggerCount++;
    
    // Add to active alerts
    this.metrics.alerts.active.push(alert);
    this.metrics.alerts.triggered++;
    
    // Add to history
    this.metrics.alerts.history.push(alert);
    
    // Keep only last 100 alerts in history
    if (this.metrics.alerts.history.length > 100) {
      this.metrics.alerts.history = this.metrics.alerts.history.slice(-100);
    }
    
    console.warn(`[API_MONITOR] Alert triggered: ${rule.message}`);
    
    this.emit('alert:triggered', alert);
  }

  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      startTime: new Date(this.startTime).toISOString(),
      alertRules: Array.from(this.alertRules.entries()).map(([name, rule]) => ({
        name,
        ...rule
      }))
    };
  }

  getEndpointMetrics(endpoint, timeRange = '1h') {
    const now = Date.now();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = now - 3600000;
        break;
      case '24h':
        startTime = now - 86400000;
        break;
      case '7d':
        startTime = now - 604800000;
        break;
      default:
        startTime = now - 3600000;
    }
    
    const endpointRequests = this.requestHistory.filter(req => 
      req.endpoint === endpoint && req.timestamp > startTime
    );
    
    return {
      endpoint,
      timeRange,
      totalRequests: endpointRequests.length,
      successfulRequests: endpointRequests.filter(req => req.success).length,
      failedRequests: endpointRequests.filter(req => req.error).length,
      averageResponseTime: endpointRequests.length > 0 
        ? endpointRequests.reduce((sum, req) => sum + req.responseTime, 0) / endpointRequests.length 
        : 0,
      requestsPerMinute: endpointRequests.filter(req => req.timestamp > now - 60000).length
    };
  }

  getUserMetrics(userId, timeRange = '24h') {
    const now = Date.now();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = now - 3600000;
        break;
      case '24h':
        startTime = now - 86400000;
        break;
      case '7d':
        startTime = now - 604800000;
        break;
      default:
        startTime = now - 86400000;
    }
    
    const userRequests = this.requestHistory.filter(req => 
      req.userId === userId && req.timestamp > startTime
    );
    
    return {
      userId,
      timeRange,
      totalRequests: userRequests.length,
      successfulRequests: userRequests.filter(req => req.success).length,
      failedRequests: userRequests.filter(req => req.error).length,
      averageResponseTime: userRequests.length > 0 
        ? userRequests.reduce((sum, req) => sum + req.responseTime, 0) / userRequests.length 
        : 0,
      mostAccessedEndpoints: this.getMostAccessedEndpoints(userRequests),
      lastActivity: userRequests.length > 0 ? new Date(Math.max(...userRequests.map(req => req.timestamp))).toISOString() : null
    };
  }

  getMostAccessedEndpoints(requests) {
    const endpointCounts = {};
    
    for (const req of requests) {
      endpointCounts[req.endpoint] = (endpointCounts[req.endpoint] || 0) + 1;
    }
    
    return Object.entries(endpointCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  getRecentErrors(limit = 50) {
    return this.metrics.errors.recent.slice(-limit).reverse();
  }

  getTopEndpoints(limit = 10) {
    return Array.from(this.metrics.requests.byEndpoint.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([endpoint, count]) => ({ endpoint, count }));
  }

  getTopErrors(limit = 10) {
    return Array.from(this.metrics.errors.byType.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  clearMetrics() {
    // Reset metrics while keeping configuration
    this.metrics = {
      requests: {
        total: 0,
        successful: 0,
        failed: 0,
        byEndpoint: new Map(),
        byMethod: new Map(),
        byHour: new Map(),
        byDay: new Map(),
        byUser: new Map(),
        byStatus: new Map()
      },
      performance: {
        responseTime: [],
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        slowestRequests: [],
        fastestRequests: []
      },
      errors: {
        total: 0,
        byType: new Map(),
        byEndpoint: new Map(),
        byHour: new Map(),
        recent: []
      },
      usage: {
        activeUsers: 0,
        totalUsers: 0,
        requestsPerMinute: 0,
        requestsPerHour: 0,
        peakUsage: null,
        usageHistory: []
      },
      system: {
        memoryUsage: [],
        cpuUsage: [],
        uptime: process.uptime(),
        lastRestart: new Date(process.uptime() * 1000).toISOString()
      },
      alerts: {
        triggered: 0,
        active: [],
        history: []
      }
    };
    
    this.requestHistory = [];
    this.startTime = Date.now();
    
    console.log('[API_MONITOR] Metrics cleared');
  }

  async exportMetrics(format = 'json') {
    const metrics = this.getMetrics();
    
    switch (format.toLowerCase()) {
      case 'json':
      default:
        return JSON.stringify(metrics, null, 2);
      case 'csv':
        return this.convertToCSV(metrics);
    }
  }

  convertToCSV(metrics) {
    // Convert metrics to CSV format
    const csvData = [];
    
    // Request metrics
    for (const [endpoint, count] of metrics.requests.byEndpoint.entries()) {
      csvData.push({
        type: 'requests',
        endpoint,
        count,
        timestamp: new Date().toISOString()
      });
    }
    
    // Error metrics
    for (const [type, count] of metrics.errors.byType.entries()) {
      csvData.push({
        type: 'errors',
        errorType: type,
        count,
        timestamp: new Date().toISOString()
      });
    }
    
    // Convert to CSV string
    if (csvData.length === 0) return '';
    
    const headers = Object.keys(csvData[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of csvData) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value.replace(/"/g, '""')}"` 
          : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to capture completion
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = Date.now();
        
        // Track the request
        this.trackRequest(req, res, startTime);
        
        // Call original end
        originalEnd.apply(this, args);
      }.bind(this);
      
      next();
    };
  }

  // Static method to create API monitor
  static create(options = {}) {
    return new APIMonitor(options);
  }
}

module.exports = APIMonitor;
