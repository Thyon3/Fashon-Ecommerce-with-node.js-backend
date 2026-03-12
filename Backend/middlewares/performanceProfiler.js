const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class PerformanceProfiler extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enabled: options.enabled !== false,
      samplingRate: options.samplingRate || 1.0, // 100% sampling
      maxProfiles: options.maxProfiles || 1000,
      profileInterval: options.profileInterval || 10000, // 10 seconds
      enableMemoryProfiling: options.enableMemoryProfiling || false,
      enableCpuProfiling: options.enableCpuProfiling || false,
      outputDir: options.outputDir || path.join(process.cwd(), 'profiles'),
      ...options
    };
    
    this.profiles = new Map();
    this.activeProfiles = new Map();
    this.metrics = {
      totalProfiles: 0,
      averageExecutionTime: 0,
      slowQueries: 0,
      memoryLeaks: 0,
      cpuSpikes: 0
    };
    
    this.init();
  }

  init() {
    if (this.options.enabled) {
      this.startProfiling();
      console.log('[PERFORMANCE_PROFILER] Performance profiler initialized');
    }
  }

  startProfiling() {
    // Start periodic profiling
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.options.profileInterval);
    
    // Cleanup old profiles
    setInterval(() => {
      this.cleanupOldProfiles();
    }, 60000); // Every minute
  }

  async collectSystemMetrics() {
    if (!this.options.enabled) return;
    
    const metrics = {
      timestamp: Date.now(),
      memory: this.getMemoryMetrics(),
      cpu: this.getCpuMetrics(),
      eventLoop: this.getEventLoopMetrics(),
      gc: this.getGCMetrics()
    };
    
    // Check for performance issues
    this.analyzeMetrics(metrics);
    
    // Store metrics
    const profileId = this.generateProfileId();
    this.profiles.set(profileId, {
      id: profileId,
      type: 'system',
      timestamp: new Date(metrics.timestamp).toISOString(),
      metrics,
      alerts: this.detectAlerts(metrics)
    });
    
    this.metrics.totalProfiles++;
    
    // Emit metrics event
    this.emit('metrics:collected', metrics);
  }

  getMemoryMetrics() {
    const memUsage = process.memoryUsage();
    
    return {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      heapUsagePercent: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024)
    };
  }

  getCpuMetrics() {
    const cpuUsage = process.cpuUsage();
    
    return {
      user: cpuUsage.user,
      system: cpuUsage.system,
      userPercent: (cpuUsage.user / 1000000) * 100, // Convert to percentage
      systemPercent: (cpuUsage.system / 1000000) * 100,
      totalPercent: ((cpuUsage.user + cpuUsage.system) / 1000000) * 100
    };
  }

  getEventLoopMetrics() {
    const start = process.hrtime();
    
    // Simulate event loop delay measurement
    setImmediate(() => {
      const delay = process.hrtime(start);
      const delayMs = delay[0] * 1000 + delay[1] / 1000000;
      
      return {
        delay: delayMs,
        delayPercent: (delayMs / 10) * 100 // Assuming 10ms is acceptable
      };
    });
    
    return {
      delay: 0,
      delayPercent: 0
    };
  }

  getGCMetrics() {
    // Simulate GC metrics
    // In production, use --inspect flag to get actual GC stats
    return {
      collections: Math.floor(Math.random() * 10),
      duration: Math.random() * 100,
      reclaimed: Math.random() * 1000000
    };
  }

  analyzeMetrics(metrics) {
    // Check for memory leaks
    if (metrics.memory.heapUsagePercent > 90) {
      this.metrics.memoryLeaks++;
      this.emit('alert:memory_leak', metrics);
    }
    
    // Check for CPU spikes
    if (metrics.cpu.totalPercent > 80) {
      this.metrics.cpuSpikes++;
      this.emit('alert:cpu_spike', metrics);
    }
    
    // Check for event loop lag
    if (metrics.eventLoop.delayPercent > 50) {
      this.emit('alert:event_loop_lag', metrics);
    }
  }

  detectAlerts(metrics) {
    const alerts = [];
    
    if (metrics.memory.heapUsagePercent > 90) {
      alerts.push({
        type: 'memory',
        severity: 'high',
        message: 'High memory usage detected',
        value: metrics.memory.heapUsagePercent
      });
    }
    
    if (metrics.cpu.totalPercent > 80) {
      alerts.push({
        type: 'cpu',
        severity: 'medium',
        message: 'High CPU usage detected',
        value: metrics.cpu.totalPercent
      });
    }
    
    if (metrics.eventLoop.delay > 100) {
      alerts.push({
        type: 'event_loop',
        severity: 'medium',
        message: 'Event loop lag detected',
        value: metrics.eventLoop.delay
      });
    }
    
    return alerts;
  }

  startFunctionProfile(functionName, context = {}) {
    if (!this.options.enabled || Math.random() > this.options.samplingRate) {
      return null; // Skip profiling
    }
    
    const profileId = this.generateProfileId();
    const startTime = process.hrtime.bigint();
    const startMemory = process.memoryUsage();
    
    this.activeProfiles.set(profileId, {
      id: profileId,
      functionName,
      context,
      startTime,
      startMemory,
      startTimestamp: Date.now()
    });
    
    return profileId;
  }

  endFunctionProfile(profileId) {
    if (!profileId || !this.activeProfiles.has(profileId)) {
      return null;
    }
    
    const profile = this.activeProfiles.get(profileId);
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const endTimestamp = Date.now();
    
    const executionTime = Number(endTime - profile.startTime) / 1000000; // Convert to milliseconds
    const memoryDelta = endMemory.heapUsed - profile.startMemory.heapUsed;
    const duration = endTimestamp - profile.startTimestamp;
    
    const completedProfile = {
      id: profileId,
      functionName: profile.functionName,
      context: profile.context,
      executionTime,
      memoryDelta,
      duration,
      startTimestamp: new Date(profile.startTimestamp).toISOString(),
      endTimestamp: new Date(endTimestamp).toISOString(),
      memoryUsage: {
        start: profile.startMemory,
        end: endMemory
      }
    };
    
    // Store completed profile
    this.profiles.set(profileId, {
      ...completedProfile,
      type: 'function'
    });
    
    // Remove from active profiles
    this.activeProfiles.delete(profileId);
    
    // Update metrics
    this.updateExecutionMetrics(executionTime);
    
    // Check for slow execution
    if (executionTime > 1000) { // > 1 second
      this.metrics.slowQueries++;
      this.emit('alert:slow_function', completedProfile);
    }
    
    // Emit profile completed event
    this.emit('profile:completed', completedProfile);
    
    return completedProfile;
  }

  updateExecutionMetrics(executionTime) {
    const totalProfiles = this.metrics.totalProfiles;
    const currentAvg = this.metrics.averageExecutionTime;
    
    // Calculate new average
    this.metrics.averageExecutionTime = 
      (currentAvg * totalProfiles + executionTime) / (totalProfiles + 1);
  }

  profileFunction(functionName, fn) {
    return async (...args) => {
      const profileId = this.startFunctionProfile(functionName, {
        args: args.length,
        timestamp: Date.now()
      });
      
      try {
        const result = await fn(...args);
        this.endFunctionProfile(profileId);
        return result;
      } catch (error) {
        this.endFunctionProfile(profileId);
        throw error;
      }
    };
  }

  profileMiddleware(routeName) {
    return (req, res, next) => {
      const profileId = this.startFunctionProfile(`middleware:${routeName}`, {
        method: req.method,
        url: req.originalUrl,
        userAgent: req.get('User-Agent')
      });
      
      // Override res.end to capture completion
      const originalEnd = res.end;
      res.end = function(...args) {
        this.endFunctionProfile(profileId);
        originalEnd.apply(this, args);
      }.bind(this);
      
      next();
    };
  }

  async getProfile(profileId) {
    return this.profiles.get(profileId);
  }

  async getProfiles(type = null, limit = 100) {
    let profiles = Array.from(this.profiles.values());
    
    if (type) {
      profiles = profiles.filter(profile => profile.type === type);
    }
    
    // Sort by timestamp (newest first)
    profiles.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return profiles.slice(0, limit);
  }

  async getFunctionProfiles(functionName, limit = 50) {
    const profiles = Array.from(this.profiles.values())
      .filter(profile => profile.type === 'function' && profile.functionName === functionName)
      .sort((a, b) => new Date(b.startTimestamp) - new Date(a.startTimestamp));
    
    return profiles.slice(0, limit);
  }

  getFunctionStats(functionName) {
    const profiles = Array.from(this.profiles.values())
      .filter(profile => profile.type === 'function' && profile.functionName === functionName);
    
    if (profiles.length === 0) {
      return null;
    }
    
    const executionTimes = profiles.map(p => p.executionTime);
    const memoryDeltas = profiles.map(p => p.memoryDelta);
    
    return {
      functionName,
      totalExecutions: profiles.length,
      averageExecutionTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      minExecutionTime: Math.min(...executionTimes),
      maxExecutionTime: Math.max(...executionTimes),
      medianExecutionTime: this.median(executionTimes),
      p95ExecutionTime: this.percentile(executionTimes, 95),
      p99ExecutionTime: this.percentile(executionTimes, 99),
      averageMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
      totalMemoryAllocated: memoryDeltas.reduce((a, b) => a + b, 0),
      slowExecutions: profiles.filter(p => p.executionTime > 1000).length,
      errorRate: 0 // Would need error tracking
    };
  }

  median(values) {
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  percentile(values, p) {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getTopSlowFunctions(limit = 10) {
    const functionStats = new Map();
    
    // Group profiles by function name
    for (const profile of this.profiles.values()) {
      if (profile.type !== 'function') continue;
      
      if (!functionStats.has(profile.functionName)) {
        functionStats.set(profile.functionName, {
          functionName: profile.functionName,
          executions: [],
          totalExecutionTime: 0,
          maxExecutionTime: 0
        });
      }
      
      const stats = functionStats.get(profile.functionName);
      stats.executions.push(profile.executionTime);
      stats.totalExecutionTime += profile.executionTime;
      stats.maxExecutionTime = Math.max(stats.maxExecutionTime, profile.executionTime);
    }
    
    // Calculate averages and sort
    const sortedStats = Array.from(functionStats.values())
      .map(stats => ({
        ...stats,
        averageExecutionTime: stats.totalExecutionTime / stats.executions.length,
        executionCount: stats.executions.length
      }))
      .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime);
    
    return sortedStats.slice(0, limit);
  }

  getMemoryTrends(limit = 100) {
    const systemProfiles = Array.from(this.profiles.values())
      .filter(profile => profile.type === 'system')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);
    
    return systemProfiles.map(profile => ({
      timestamp: profile.timestamp,
      heapUsed: profile.metrics.memory.heapUsedMB,
      heapTotal: profile.metrics.memory.heapTotalMB,
      heapUsagePercent: profile.metrics.memory.heapUsagePercent,
      rss: profile.metrics.memory.rssMB
    }));
  }

  getCpuTrends(limit = 100) {
    const systemProfiles = Array.from(this.profiles.values())
      .filter(profile => profile.type === 'system')
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-limit);
    
    return systemProfiles.map(profile => ({
      timestamp: profile.timestamp,
      userPercent: profile.metrics.cpu.userPercent,
      systemPercent: profile.metrics.cpu.systemPercent,
      totalPercent: profile.metrics.cpu.totalPercent
    }));
  }

  getMetrics() {
    return {
      ...this.metrics,
      activeProfiles: this.activeProfiles.size,
      totalProfiles: this.profiles.size,
      averageExecutionTime: Math.round(this.metrics.averageExecutionTime * 100) / 100,
      slowQueryRate: this.metrics.totalProfiles > 0 
        ? (this.metrics.slowQueries / this.metrics.totalProfiles) * 100 
        : 0
    };
  }

  async exportProfiles(format = 'json') {
    const profiles = Array.from(this.profiles.values());
    
    switch (format.toLowerCase()) {
      case 'csv':
        return this.convertToCSV(profiles);
      case 'json':
      default:
        return JSON.stringify(profiles, null, 2);
    }
  }

  convertToCSV(profiles) {
    if (profiles.length === 0) return '';
    
    // For function profiles
    const functionProfiles = profiles.filter(p => p.type === 'function');
    if (functionProfiles.length === 0) return '';
    
    const headers = ['id', 'functionName', 'executionTime', 'memoryDelta', 'startTimestamp', 'endTimestamp'];
    const csvRows = [headers.join(',')];
    
    for (const profile of functionProfiles) {
      const values = [
        profile.id,
        profile.functionName,
        profile.executionTime,
        profile.memoryDelta,
        profile.startTimestamp,
        profile.endTimestamp
      ];
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  async cleanupOldProfiles() {
    if (this.profiles.size <= this.options.maxProfiles) {
      return;
    }
    
    const profilesToRemove = this.profiles.size - this.options.maxProfiles;
    const sortedProfiles = Array.from(this.profiles.entries())
      .sort((a, b) => new Date(a[1].timestamp) - new Date(b[1].timestamp));
    
    for (let i = 0; i < profilesToRemove; i++) {
      const [profileId] = sortedProfiles[i];
      this.profiles.delete(profileId);
    }
    
    console.log(`[PERFORMANCE_PROFILER] Cleaned up ${profilesToRemove} old profiles`);
  }

  async saveProfiles() {
    if (!this.options.outputDir) return;
    
    try {
      await fs.mkdir(this.options.outputDir, { recursive: true });
      
      const profilesFile = path.join(this.options.outputDir, `profiles-${Date.now()}.json`);
      const profiles = Array.from(this.profiles.values());
      
      await fs.writeFile(profilesFile, JSON.stringify(profiles, null, 2));
      
      console.log(`[PERFORMANCE_PROFILER] Saved ${profiles.length} profiles to ${profilesFile}`);
    } catch (error) {
      console.error('[PERFORMANCE_PROFILER] Failed to save profiles:', error);
    }
  }

  generateProfileId() {
    return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Static method to create profiler
  static create(options = {}) {
    return new PerformanceProfiler(options);
  }
}

module.exports = PerformanceProfiler;
