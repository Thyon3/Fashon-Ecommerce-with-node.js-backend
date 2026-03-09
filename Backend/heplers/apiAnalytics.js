class ApiAnalytics {
  constructor() {
    this.analytics = new Map();
    this.realTimeData = new Map();
    this.aggregationInterval = 60000; // 1 minute
    this.retentionPeriod = 7 * 24 * 60 * 60 * 1000; // 7 days
    this.startAggregation();
  }

  // Start aggregation process
  startAggregation() {
    setInterval(() => {
      this.aggregateData();
      this.cleanupOldData();
    }, this.aggregationInterval);
  }

  // Record API call
  recordCall(req, res, duration) {
    const endpoint = this.getEndpointKey(req);
    const timestamp = new Date().toISOString();
    
    // Update real-time data
    if (!this.realTimeData.has(endpoint)) {
      this.realTimeData.set(endpoint, {
        endpoint,
        calls: 0,
        errors: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        lastCall: null
      });
    }
    
    const realTime = this.realTimeData.get(endpoint);
    realTime.calls++;
    realTime.totalDuration += duration;
    realTime.minDuration = Math.min(realTime.minDuration, duration);
    realTime.maxDuration = Math.max(realTime.maxDuration, duration);
    realTime.lastCall = timestamp;
    
    if (res.statusCode >= 400) {
      realTime.errors++;
    }
    
    // Store detailed analytics
    const analyticsKey = `${endpoint}:${new Date().toISOString().split('T')[0]}`;
    
    if (!this.analytics.has(analyticsKey)) {
      this.analytics.set(analyticsKey, {
        date: new Date().toISOString().split('T')[0],
        endpoint,
        calls: 0,
        errors: 0,
        totalDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        statusCodes: new Map(),
        hourlyData: new Map(),
        userAgents: new Map(),
        ipAddresses: new Map()
      });
    }
    
    const analytics = this.analytics.get(analyticsKey);
    analytics.calls++;
    analytics.totalDuration += duration;
    analytics.minDuration = Math.min(analytics.minDuration, duration);
    analytics.maxDuration = Math.max(analytics.maxDuration, duration);
    
    // Track status codes
    const statusCodeCount = analytics.statusCodes.get(res.statusCode) || 0;
    analytics.statusCodes.set(res.statusCode, statusCodeCount + 1);
    
    // Track user agents
    const userAgent = req.get('User-Agent') || 'Unknown';
    const userAgentCount = analytics.userAgents.get(userAgent) || 0;
    analytics.userAgents.set(userAgent, userAgentCount + 1);
    
    // Track IP addresses
    const ipAddress = req.ip || req.connection.remoteAddress || 'Unknown';
    const ipCount = analytics.ipAddresses.get(ipAddress) || 0;
    analytics.ipAddresses.set(ipAddress, ipCount + 1);
    
    // Track hourly data
    const hour = new Date().getHours();
    const hourlyCount = analytics.hourlyData.get(hour) || 0;
    analytics.hourlyData.set(hour, hourlyCount + 1);
  }

  // Get endpoint key
  getEndpointKey(req) {
    const path = req.route?.path || req.originalUrl.split('?')[0];
    return `${req.method}:${path}`;
  }

  // Get real-time analytics
  getRealTimeAnalytics() {
    const data = {};
    
    this.realTimeData.forEach((analytics, endpoint) => {
      data[endpoint] = {
        ...analytics,
        averageDuration: analytics.calls > 0 ? analytics.totalDuration / analytics.calls : 0,
        errorRate: analytics.calls > 0 ? (analytics.errors / analytics.calls) * 100 : 0
      };
    });
    
    return data;
  }

  // Get analytics summary
  getAnalyticsSummary(timeRange = '24h') {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const filteredAnalytics = Array.from(this.analytics.values())
      .filter(analytics => new Date(analytics.date) >= startDate);
    
    // Aggregate data
    const summary = {
      totalCalls: 0,
      totalErrors: 0,
      totalDuration: 0,
      averageDuration: 0,
      errorRate: 0,
      topEndpoints: [],
      statusCodes: new Map(),
      hourlyDistribution: new Array(24).fill(0),
      uniqueUsers: new Set(),
      uniqueIPs: new Set()
    };
    
    filteredAnalytics.forEach(analytics => {
      summary.totalCalls += analytics.calls;
      summary.totalErrors += analytics.errors;
      summary.totalDuration += analytics.totalDuration;
      
      // Aggregate status codes
      analytics.statusCodes.forEach((count, code) => {
        const current = summary.statusCodes.get(code) || 0;
        summary.statusCodes.set(code, current + count);
      });
      
      // Aggregate hourly distribution
      analytics.hourlyData.forEach((count, hour) => {
        summary.hourlyDistribution[hour] += count;
      });
      
      // Count unique users and IPs
      analytics.ipAddresses.forEach((count, ip) => {
        if (ip !== 'Unknown') {
          summary.uniqueIPs.add(ip);
        }
      });
      
      // Track top endpoints
      summary.topEndpoints.push({
        endpoint: analytics.endpoint,
        calls: analytics.calls,
        errors: analytics.errors,
        averageDuration: analytics.totalDuration / analytics.calls,
        errorRate: (analytics.errors / analytics.calls) * 100
      });
    });
    
    // Calculate averages
    if (summary.totalCalls > 0) {
      summary.averageDuration = summary.totalDuration / summary.totalCalls;
      summary.errorRate = (summary.totalErrors / summary.totalCalls) * 100;
    }
    
    // Sort top endpoints
    summary.topEndpoints.sort((a, b) => b.calls - a.calls);
    summary.topEndpoints = summary.topEndpoints.slice(0, 10);
    
    // Convert Sets to counts
    summary.uniqueUsers = summary.uniqueUsers.size;
    summary.uniqueIPs = summary.uniqueIPs.size;
    
    return {
      timeRange,
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
      ...summary
    };
  }

  // Get endpoint analytics
  getEndpointAnalytics(endpoint, timeRange = '24h') {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const endpointAnalytics = Array.from(this.analytics.values())
      .filter(analytics => analytics.endpoint === endpoint && new Date(analytics.date) >= startDate);
    
    if (endpointAnalytics.length === 0) {
      return null;
    }
    
    // Aggregate endpoint data
    const aggregated = {
      endpoint,
      totalCalls: 0,
      totalErrors: 0,
      totalDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      statusCodes: new Map(),
      hourlyData: new Array(24).fill(0),
      userAgents: new Map(),
      ipAddresses: new Map(),
      dailyData: new Map()
    };
    
    endpointAnalytics.forEach(analytics => {
      aggregated.totalCalls += analytics.calls;
      aggregated.totalErrors += analytics.errors;
      aggregated.totalDuration += analytics.totalDuration;
      aggregated.minDuration = Math.min(aggregated.minDuration, analytics.minDuration);
      aggregated.maxDuration = Math.max(aggregated.maxDuration, analytics.maxDuration);
      
      // Aggregate status codes
      analytics.statusCodes.forEach((count, code) => {
        const current = aggregated.statusCodes.get(code) || 0;
        aggregated.statusCodes.set(code, current + count);
      });
      
      // Aggregate hourly data
      analytics.hourlyData.forEach((count, hour) => {
        aggregated.hourlyData[hour] += count;
      });
      
      // Aggregate user agents
      analytics.userAgents.forEach((count, userAgent) => {
        const current = aggregated.userAgents.get(userAgent) || 0;
        aggregated.userAgents.set(userAgent, current + count);
      });
      
      // Aggregate IP addresses
      analytics.ipAddresses.forEach((count, ip) => {
        const current = aggregated.ipAddresses.get(ip) || 0;
        aggregated.ipAddresses.set(ip, current + count);
      });
      
      // Aggregate daily data
      aggregated.dailyData.set(analytics.date, {
        calls: analytics.calls,
        errors: analytics.errors,
        averageDuration: analytics.totalDuration / analytics.calls
      });
    });
    
    // Calculate averages
    aggregated.averageDuration = aggregated.totalCalls > 0 ? aggregated.totalDuration / aggregated.totalCalls : 0;
    aggregated.errorRate = aggregated.totalCalls > 0 ? (aggregated.totalErrors / aggregated.totalCalls) * 100 : 0;
    
    // Convert Maps to arrays for easier consumption
    aggregated.statusCodes = Array.from(aggregated.statusCodes.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    
    aggregated.userAgents = Array.from(aggregated.userAgents.entries())
      .map(([userAgent, count]) => ({ userAgent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    aggregated.ipAddresses = Array.from(aggregated.ipAddresses.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    aggregated.dailyData = Array.from(aggregated.dailyData.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    return aggregated;
  }

  // Get performance analytics
  getPerformanceAnalytics(timeRange = '24h') {
    const summary = this.getAnalyticsSummary(timeRange);
    
    const performance = {
      slowEndpoints: [],
      fastEndpoints: [],
      averageResponseTime: summary.averageDuration,
      responseTimeDistribution: {
        under100ms: 0,
        under500ms: 0,
        under1s: 0,
        over1s: 0
      }
    };
    
    // Analyze endpoint performance
    summary.topEndpoints.forEach(endpoint => {
      if (endpoint.averageDuration > 1000) {
        performance.slowEndpoints.push(endpoint);
      } else if (endpoint.averageDuration < 100) {
        performance.fastEndpoints.push(endpoint);
      }
    });
    
    // Calculate response time distribution
    this.realTimeData.forEach((analytics) => {
      if (analytics.averageDuration < 100) {
        performance.responseTimeDistribution.under100ms++;
      } else if (analytics.averageDuration < 500) {
        performance.responseTimeDistribution.under500ms++;
      } else if (analytics.averageDuration < 1000) {
        performance.responseTimeDistribution.under1s++;
      } else {
        performance.responseTimeDistribution.over1s++;
      }
    });
    
    return performance;
  }

  // Get error analytics
  getErrorAnalytics(timeRange = '24h') {
    const summary = this.getAnalyticsSummary(timeRange);
    
    const errorAnalytics = {
      totalErrors: summary.totalErrors,
      errorRate: summary.errorRate,
      topErrors: [],
      errorTrends: [],
      statusCodes: Array.from(summary.statusCodes.entries())
        .filter(([code]) => code >= 400)
        .map(([code, count]) => ({ code, count }))
        .sort((a, b) => b.count - a.count)
    };
    
    // Get top error endpoints
    errorAnalytics.topErrors = summary.topEndpoints
      .filter(endpoint => endpoint.errors > 0)
      .sort((a, b) => b.errors - a.errors)
      .slice(0, 10);
    
    // Generate error trends (mock data for now)
    const hours = 24;
    for (let i = 0; i < hours; i++) {
      errorAnalytics.errorTrends.push({
        hour: i,
        errors: Math.floor(Math.random() * 50),
        timestamp: new Date(Date.now() - (i * 60 * 60 * 1000)).toISOString()
      });
    }
    
    return errorAnalytics;
  }

  // Get user analytics
  getUserAnalytics(timeRange = '24h') {
    const summary = this.getAnalyticsSummary(timeRange);
    
    return {
      uniqueUsers: summary.uniqueUsers,
      uniqueIPs: summary.uniqueIPs,
      averageRequestsPerUser: summary.totalCalls / Math.max(summary.uniqueUsers, 1),
      topUserAgents: this.getTopUserAgents(),
      topIPAddresses: this.getTopIPAddresses()
    };
  }

  // Get top user agents
  getTopUserAgents() {
    const userAgents = new Map();
    
    this.realTimeData.forEach((analytics) => {
      // This would need to be tracked at the analytics level
      // For now, return mock data
    });
    
    return [
      { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', count: 1250 },
      { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', count: 890 },
      { userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36', count: 450 }
    ];
  }

  // Get top IP addresses
  getTopIPAddresses() {
    const ipAddresses = new Map();
    
    this.realTimeData.forEach((analytics) => {
      // This would need to be tracked at the analytics level
      // For now, return mock data
    });
    
    return [
      { ip: '192.168.1.1', count: 450 },
      { ip: '10.0.0.1', count: 320 },
      { ip: '172.16.0.1', count: 180 }
    ];
  }

  // Aggregate data
  aggregateData() {
    console.log('[ANALYTICS] Aggregating analytics data');
    
    // This would typically write aggregated data to a database
    // For now, just log the aggregation
    const summary = this.getAnalyticsSummary('1h');
    console.log(`[ANALYTICS] 1h summary: ${summary.totalCalls} calls, ${summary.errorRate.toFixed(2)}% error rate`);
  }

  // Clean up old data
  cleanupOldData() {
    const cutoffDate = new Date(Date.now() - this.retentionPeriod);
    let deleted = 0;
    
    for (const [key, analytics] of this.analytics.entries()) {
      if (new Date(analytics.date) < cutoffDate) {
        this.analytics.delete(key);
        deleted++;
      }
    }
    
    if (deleted > 0) {
      console.log(`[ANALYTICS] Cleaned up ${deleted} old analytics records`);
    }
  }

  // Export analytics data
  exportData(timeRange = '24h', format = 'json') {
    const data = this.getAnalyticsSummary(timeRange);
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        return JSON.stringify(data, null, 2);
    }
  }

  // Convert to CSV format
  convertToCSV(data) {
    const csv = [
      'Metric,Value',
      `Total Calls,${data.totalCalls}`,
      `Total Errors,${data.totalErrors}`,
      `Average Duration,${data.averageDuration}`,
      `Error Rate,${data.errorRate}`,
      `Unique Users,${data.uniqueUsers}`,
      `Unique IPs,${data.uniqueIPs}`
    ].join('\n');
    
    return csv;
  }

  // Reset analytics
  reset() {
    this.analytics.clear();
    this.realTimeData.clear();
    console.log('[ANALYTICS] Analytics data reset');
  }

  // Get analytics statistics
  getStats() {
    return {
      totalEndpoints: this.realTimeData.size,
      totalAnalytics: this.analytics.size,
      retentionPeriod: this.retentionPeriod,
      aggregationInterval: this.aggregationInterval
    };
  }
}

// Create singleton instance
const apiAnalytics = new ApiAnalytics();

module.exports = apiAnalytics;
