const fs = require('fs').promises;
const path = require('path');

class Analytics {
  constructor(options = {}) {
    this.options = {
      dataDir: options.dataDir || path.join(process.cwd(), 'analytics'),
      retentionDays: options.retentionDays || 365,
      batchSize: options.batchSize || 1000,
      enableRealTime: options.enableRealTime !== false,
      ...options
    };
    
    this.events = [];
    this.metrics = new Map();
    this.realtimeSubscribers = new Set();
    
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.options.dataDir, { recursive: true });
      await this.loadMetrics();
      
      if (this.options.enableRealTime) {
        this.startRealTimeProcessing();
      }
      
      console.log('[ANALYTICS] Analytics service initialized');
    } catch (error) {
      console.error('[ANALYTICS] Failed to initialize:', error);
    }
  }

  track(event, data = {}, userId = null) {
    const eventData = {
      id: this.generateId(),
      event,
      data,
      userId,
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
      userAgent: data.userAgent,
      ip: data.ip,
      metadata: {
        version: '1.0.0',
        source: 'backend'
      }
    };

    this.events.push(eventData);
    
    // Update metrics
    this.updateMetrics(event, data);
    
    // Emit to real-time subscribers
    if (this.options.enableRealTime) {
      this.emitToSubscribers('event', eventData);
    }
    
    // Batch process events
    if (this.events.length >= this.options.batchSize) {
      this.processBatch();
    }
    
    return eventData.id;
  }

  trackPageView(url, userId = null, data = {}) {
    return this.track('page_view', {
      url,
      referrer: data.referrer,
      title: data.title,
      path: new URL(url).pathname,
      ...data
    }, userId);
  }

  trackUserAction(action, userId = null, data = {}) {
    return this.track('user_action', {
      action,
      category: data.category,
      label: data.label,
      value: data.value,
      ...data
    }, userId);
  }

  trackConversion(type, value = 0, userId = null, data = {}) {
    return this.track('conversion', {
      type,
      value,
      currency: data.currency || 'USD',
      ...data
    }, userId);
  }

  trackError(error, userId = null, data = {}) {
    return this.track('error', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      severity: data.severity || 'error',
      ...data
    }, userId);
  }

  trackPerformance(metric, value, userId = null, data = {}) {
    return this.track('performance', {
      metric,
      value,
      unit: data.unit || 'ms',
      ...data
    }, userId);
  }

  updateMetrics(event, data) {
    const date = new Date().toISOString().split('T')[0];
    
    if (!this.metrics.has(date)) {
      this.metrics.set(date, {
        date,
        events: {},
        users: new Set(),
        sessions: new Set(),
        pageViews: 0,
        conversions: 0,
        errors: 0,
        totalValue: 0,
        uniqueUsers: 0,
        bounceRate: 0,
        avgSessionDuration: 0
      });
    }
    
    const dayMetrics = this.metrics.get(date);
    
    // Update event counts
    dayMetrics.events[event] = (dayMetrics.events[event] || 0) + 1;
    
    // Update user tracking
    if (data.userId) {
      dayMetrics.users.add(data.userId);
    }
    
    if (data.sessionId) {
      dayMetrics.sessions.add(data.sessionId);
    }
    
    // Update specific metrics
    switch (event) {
      case 'page_view':
        dayMetrics.pageViews++;
        break;
      case 'conversion':
        dayMetrics.conversions++;
        dayMetrics.totalValue += data.value || 0;
        break;
      case 'error':
        dayMetrics.errors++;
        break;
    }
    
    // Update derived metrics
    dayMetrics.uniqueUsers = dayMetrics.users.size;
    dayMetrics.bounceRate = this.calculateBounceRate(date);
    dayMetrics.avgSessionDuration = this.calculateAvgSessionDuration(date);
  }

  calculateBounceRate(date) {
    const dayMetrics = this.metrics.get(date);
    if (!dayMetrics || dayMetrics.sessions.size === 0) return 0;
    
    // Simplified bounce rate calculation
    // In production, this would track session duration and page views per session
    const singlePageSessions = Math.floor(dayMetrics.sessions.size * 0.3);
    return (singlePageSessions / dayMetrics.sessions.size) * 100;
  }

  calculateAvgSessionDuration(date) {
    // Simplified average session duration
    // In production, this would track actual session times
    return 180000; // 3 minutes in milliseconds
  }

  async processBatch() {
    if (this.events.length === 0) return;
    
    const batch = this.events.splice(0, this.options.batchSize);
    const date = new Date().toISOString().split('T')[0];
    
    try {
      await this.saveBatch(date, batch);
      await this.saveMetrics();
      
      console.log(`[ANALYTICS] Processed batch of ${batch.length} events`);
    } catch (error) {
      console.error('[ANALYTICS] Failed to process batch:', error);
      
      // Re-add events to the queue for retry
      this.events.unshift(...batch);
    }
  }

  async saveBatch(date, batch) {
    const batchFile = path.join(this.options.dataDir, `events-${date}.json`);
    
    try {
      // Load existing events
      let existingEvents = [];
      try {
        const content = await fs.readFile(batchFile, 'utf8');
        existingEvents = JSON.parse(content);
      } catch (error) {
        // File doesn't exist yet
      }
      
      // Merge with new events
      const allEvents = [...existingEvents, ...batch];
      
      // Save merged events
      await fs.writeFile(batchFile, JSON.stringify(allEvents, null, 2));
    } catch (error) {
      throw error;
    }
  }

  async saveMetrics() {
    const metricsFile = path.join(this.options.dataDir, 'metrics.json');
    
    try {
      const metricsData = Array.from(this.metrics.entries()).map(([date, metrics]) => ({
        ...metrics,
        users: Array.from(metrics.users),
        sessions: Array.from(metrics.sessions)
      }));
      
      await fs.writeFile(metricsFile, JSON.stringify(metricsData, null, 2));
    } catch (error) {
      console.error('[ANALYTICS] Failed to save metrics:', error);
    }
  }

  async loadMetrics() {
    try {
      const metricsFile = path.join(this.options.dataDir, 'metrics.json');
      const content = await fs.readFile(metricsFile, 'utf8');
      const metricsData = JSON.parse(content);
      
      this.metrics = new Map(metricsData.map(item => [
        item.date,
        {
          ...item,
          users: new Set(item.users),
          sessions: new Set(item.sessions)
        }
      ]));
      
      console.log(`[ANALYTICS] Loaded metrics for ${this.metrics.size} days`);
    } catch (error) {
      console.log('[ANALYTICS] No existing metrics found');
    }
  }

  async getMetrics(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const metrics = [];
    
    for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const dayMetrics = this.metrics.get(dateStr);
      
      if (dayMetrics) {
        metrics.push({
          date: dateStr,
          ...dayMetrics,
          users: dayMetrics.users.size,
          sessions: dayMetrics.sessions.size
        });
      }
    }
    
    return metrics;
  }

  async getEventStats(event, startDate, endDate) {
    const metrics = await this.getMetrics(startDate, endDate);
    const stats = {
      event,
      total: 0,
      daily: [],
      trends: {
        direction: 'stable',
        change: 0
      }
    };
    
    for (const day of metrics) {
      const count = day.events[event] || 0;
      stats.total += count;
      stats.daily.push({
        date: day.date,
        count
      });
    }
    
    // Calculate trend
    if (stats.daily.length >= 2) {
      const recent = stats.daily.slice(-7).reduce((sum, d) => sum + d.count, 0) / Math.min(7, stats.daily.length);
      const previous = stats.daily.slice(-14, -7).reduce((sum, d) => sum + d.count, 0) / Math.min(7, stats.daily.length);
      
      const change = ((recent - previous) / previous) * 100;
      
      stats.trends.change = change;
      stats.trends.direction = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';
    }
    
    return stats;
  }

  async getUserMetrics(userId, startDate, endDate) {
    const events = await this.getUserEvents(userId, startDate, endDate);
    
    return {
      userId,
      totalEvents: events.length,
      eventsByType: this.groupEventsByType(events),
      firstEvent: events[0]?.timestamp,
      lastEvent: events[events.length - 1]?.timestamp,
      sessionCount: new Set(events.map(e => e.sessionId)).size,
      pageViews: events.filter(e => e.event === 'page_view').length,
      conversions: events.filter(e => e.event === 'conversion').length,
      errors: events.filter(e => e.event === 'error').length
    };
  }

  async getUserEvents(userId, startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const events = [];
    
    for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const eventFile = path.join(this.options.dataDir, `events-${dateStr}.json`);
      
      try {
        const content = await fs.readFile(eventFile, 'utf8');
        const dayEvents = JSON.parse(content);
        
        const userEvents = dayEvents.filter(event => event.userId === userId);
        events.push(...userEvents);
      } catch (error) {
        // File doesn't exist or is invalid
      }
    }
    
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  groupEventsByType(events) {
    const grouped = {};
    
    for (const event of events) {
      grouped[event.event] = (grouped[event.event] || 0) + 1;
    }
    
    return grouped;
  }

  async getRealTimeStats() {
    const now = new Date();
    const lastHour = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentEvents = this.events.filter(event => 
      new Date(event.timestamp) > lastHour
    );
    
    return {
      activeUsers: new Set(recentEvents.map(e => e.userId)).size,
      activeSessions: new Set(recentEvents.map(e => e.sessionId)).size,
      eventsLastHour: recentEvents.length,
      topEvents: this.getTopEvents(recentEvents, 5),
      timestamp: now.toISOString()
    };
  }

  getTopEvents(events, limit = 10) {
    const eventCounts = {};
    
    for (const event of events) {
      eventCounts[event.event] = (eventCounts[event.event] || 0) + 1;
    }
    
    return Object.entries(eventCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([event, count]) => ({ event, count }));
  }

  startRealTimeProcessing() {
    setInterval(() => {
      this.processBatch();
    }, 60000); // Process every minute
    
    setInterval(() => {
      this.cleanupOldData();
    }, 24 * 60 * 60 * 1000); // Cleanup daily
  }

  async cleanupOldData() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.options.retentionDays);
    
    try {
      const files = await fs.readdir(this.options.dataDir);
      let cleaned = 0;
      
      for (const file of files) {
        if (file.startsWith('events-') && file.endsWith('.json')) {
          const dateStr = file.replace('events-', '').replace('.json', '');
          const fileDate = new Date(dateStr);
          
          if (fileDate < cutoffDate) {
            const filePath = path.join(this.options.dataDir, file);
            await fs.unlink(filePath);
            cleaned++;
            
            // Remove from metrics
            this.metrics.delete(dateStr);
          }
        }
      }
      
      if (cleaned > 0) {
        console.log(`[ANALYTICS] Cleaned up ${cleaned} old data files`);
        await this.saveMetrics();
      }
    } catch (error) {
      console.error('[ANALYTICS] Failed to cleanup old data:', error);
    }
  }

  subscribeToRealTime(callback) {
    const subscriber = {
      id: this.generateId(),
      callback
    };
    
    this.realtimeSubscribers.add(subscriber);
    
    return {
      unsubscribe: () => {
        this.realtimeSubscribers.delete(subscriber);
      }
    };
  }

  emitToSubscribers(type, data) {
    for (const subscriber of this.realtimeSubscribers) {
      try {
        subscriber.callback(type, data);
      } catch (error) {
        console.error('[ANALYTICS] Error in subscriber callback:', error);
      }
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  getSessionId() {
    return Math.random().toString(36).substr(2, 9);
  }

  async exportData(startDate, endDate, format = 'json') {
    const events = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let date = start; date <= end; date.setDate(date.getDate() + 1)) {
      const dateStr = date.toISOString().split('T')[0];
      const eventFile = path.join(this.options.dataDir, `events-${dateStr}.json`);
      
      try {
        const content = await fs.readFile(eventFile, 'utf8');
        const dayEvents = JSON.parse(content);
        events.push(...dayEvents);
      } catch (error) {
        // File doesn't exist or is invalid
      }
    }
    
    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(events);
      case 'json':
      default:
        return JSON.stringify(events, null, 2);
    }
  }

  convertToCSV(events) {
    if (events.length === 0) return '';
    
    const headers = Object.keys(events[0]);
    const csvRows = [headers.join(',')];
    
    for (const event of events) {
      const values = headers.map(header => {
        const value = event[header];
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
      req.analytics = this;
      next();
    };
  }
}

module.exports = Analytics;
