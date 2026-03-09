const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

class PerformanceProfiler {
  constructor() {
    this.profiles = new Map();
    this.isProfiling = false;
    this.profileDir = path.join(__dirname, '../profiles');
    this.maxProfiles = 100; // Keep last 100 profiles
    this.ensureProfileDirectory();
  }

  // Ensure profile directory exists
  ensureProfileDirectory() {
    if (!fs.existsSync(this.profileDir)) {
      fs.mkdirSync(this.profileDir, { recursive: true });
    }
  }

  // Start profiling
  startProfiling(name, options = {}) {
    if (this.isProfiling) {
      console.warn('[PROFILER] Profiling already in progress');
      return null;
    }

    this.isProfiling = true;
    const profileId = this.generateProfileId(name);
    
    const profile = {
      id: profileId,
      name,
      startTime: process.hrtime.bigint(),
      startCpuUsage: process.cpuUsage(),
      startMemoryUsage: process.memoryUsage(),
      options: {
        includeMemory: options.includeMemory !== false,
        includeCpu: options.includeCpu !== false,
        includeIOWait: options.includeIOWait !== false,
        includeNetwork: options.includeNetwork !== false,
        maxSamples: options.maxSamples || 1000,
        sampleInterval: options.sampleInterval || 100
      },
      samples: [],
      events: []
    };

    this.profiles.set(profileId, profile);

    // Start performance observer
    if (performance && performance.getEntries) {
      this.startPerformanceObserver(profile);
    }

    // Start sampling
    this.startSampling(profile);

    console.log(`[PROFILER] Started profiling: ${name} (${profileId})`);
    
    return profileId;
  }

  // Stop profiling
  stopProfiling(profileId) {
    const profile = this.profiles.get(profileId);
    
    if (!profile) {
      console.warn(`[PROFILER] Profile not found: ${profileId}`);
      return null;
    }

    profile.endTime = process.hrtime.bigint();
    profile.endCpuUsage = process.cpuUsage();
    profile.endMemoryUsage = process.memoryUsage();

    // Stop sampling
    if (profile.samplingInterval) {
      clearInterval(profile.samplingInterval);
    }

    // Calculate metrics
    profile.metrics = this.calculateMetrics(profile);

    // Save profile
    this.saveProfile(profile);

    console.log(`[PROFILER] Stopped profiling: ${profile.name} (${profileId})`);
    
    return profile;
  }

  // Generate profile ID
  generateProfileId(name) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `${name}_${timestamp}_${random}`;
  }

  // Start performance observer
  startPerformanceObserver(profile) {
    try {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          profile.events.push({
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            initiatorType: entry.initiatorType,
            initiator: entry.initiator,
            timestamp: new Date().toISOString()
          });
        });
      });

      observer.observe({ 
        entryTypes: ['measure', 'navigation', 'resource', 'paint', 'layout', 'render'] 
      });

      profile.performanceObserver = observer;
      
    } catch (error) {
      console.warn('[PROFILER] Performance Observer not available:', error.message);
    }
  }

  // Start sampling
  startSampling(profile) {
    const sample = () => {
      const now = process.hrtime.bigint();
      const sampleData = {
        timestamp: now,
        memory: profile.options.includeMemory ? process.memoryUsage() : null,
        cpu: profile.options.includeCpu ? process.cpuUsage() : null,
        activeHandles: profile.options.includeIOWait ? process._getActiveHandles().length : null,
        activeRequests: profile.options.includeNetwork ? process._getActiveRequests().length : null
      };

      profile.samples.push(sampleData);

      // Limit samples
      if (profile.samples.length >= profile.options.maxSamples) {
        profile.samples.shift(); // Remove oldest sample
      }
    };

    profile.samplingInterval = setInterval(sample, profile.options.sampleInterval);
  }

  // Calculate metrics
  calculateMetrics(profile) {
    const duration = Number(profile.endTime - profile.startTime) / 1000000; // Convert to milliseconds

    const metrics = {
      duration,
      cpuUsage: {
        user: profile.endCpuUsage.user - profile.startCpuUsage.user,
        system: profile.endCpuUsage.system - profile.startCpuUsage.system,
        total: (profile.endCpuUsage.user + profile.endCpuUsage.system) - (profile.startCpuUsage.user + profile.startCpuUsage.system)
      },
      memoryUsage: {
        rss: profile.endMemoryUsage.rss - profile.startMemoryUsage.rss,
        heapTotal: profile.endMemoryUsage.heapTotal - profile.startMemoryUsage.heapTotal,
        heapUsed: profile.endMemoryUsage.heapUsed - profile.startMemoryUsage.heapUsed,
        external: profile.endMemoryUsage.external - profile.startMemoryUsage.external
      }
    };

    // Calculate average values from samples
    if (profile.samples.length > 0) {
      metrics.samples = {
        count: profile.samples.length,
        averageMemory: this.calculateAverage(profile.samples, 'memory.heapUsed'),
        maxMemory: this.calculateMax(profile.samples, 'memory.heapUsed'),
        minMemory: this.calculateMin(profile.samples, 'memory.heapUsed'),
        averageCpu: this.calculateAverageCpu(profile.samples),
        maxCpu: this.calculateMaxCpu(profile.samples),
        averageHandles: this.calculateAverage(profile.samples, 'activeHandles'),
        maxHandles: this.calculateMax(profile.samples, 'activeHandles'),
        averageRequests: this.calculateAverage(profile.samples, 'activeRequests'),
        maxRequests: this.calculateMax(profile.samples, 'activeRequests')
      };
    }

    return metrics;
  }

  // Calculate average value from samples
  calculateAverage(samples, property) {
    if (samples.length === 0) return 0;
    
    const values = samples
      .map(sample => sample[property] && typeof sample[property] === 'object' ? sample[property].rss : sample[property])
      .filter(value => typeof value === 'number');
    
    if (values.length === 0) return 0;
    
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  // Calculate maximum value from samples
  calculateMax(samples, property) {
    if (samples.length === 0) return 0;
    
    const values = samples
      .map(sample => sample[property] && typeof sample[property] === 'object' ? sample[property].rss : sample[property])
      .filter(value => typeof value === 'number');
    
    if (values.length === 0) return 0;
    
    return Math.max(...values);
  }

  // Calculate minimum value from samples
  calculateMin(samples, property) {
    if (samples.length === 0) return 0;
    
    const values = samples
      .map(sample => sample[property] && typeof sample[property] === 'object' ? sample[property].rss : sample[property])
      .filter(value => typeof value === 'number');
    
    if (values.length === 0) return 0;
    
    return Math.min(...values);
  }

  // Calculate average CPU usage
  calculateAverageCpu(samples) {
    if (samples.length === 0) return 0;
    
    const totalCpu = samples.reduce((sum, sample) => {
      if (sample.cpu) {
        return sum + sample.cpu.user + sample.cpu.system;
      }
      return sum;
    }, 0);
    
    return totalCpu / samples.length;
  }

  // Save profile to file
  saveProfile(profile) {
    try {
      const profileFile = path.join(this.profileDir, `${profile.id}.json`);
      
      const profileData = {
        id: profile.id,
        name: profile.name,
        startTime: profile.startTime.toString(),
        endTime: profile.endTime.toString(),
        duration: Number(profile.endTime - profile.startTime) / 1000000, // Convert to milliseconds
        options: profile.options,
        metrics: profile.metrics,
        samples: profile.samples,
        events: profile.events,
        timestamp: new Date().toISOString()
      };

      fs.writeFileSync(profileFile, JSON.stringify(profileData, null, 2));
      
      console.log(`[PROFILER] Profile saved: ${profileFile}`);
      
      // Clean up old profiles
      this.cleanupOldProfiles();
      
    } catch (error) {
      console.error('[PROFILER] Error saving profile:', error);
    }
  }

  // Clean up old profiles
  cleanupOldProfiles() {
    try {
      const files = fs.readdirSync(this.profileDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.profileDir, file))
        .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime);

      if (files.length > this.maxProfiles) {
        const filesToDelete = files.slice(0, files.length - this.maxProfiles);
        
        filesToDelete.forEach(file => {
          fs.unlinkSync(file);
          console.log(`[PROFILER] Deleted old profile: ${file}`);
        });
      }
      
    } catch (error) {
      console.error('[PROFILER] Error cleaning up old profiles:', error);
    }
  }

  // Get profile by ID
  getProfile(profileId) {
    try {
      const profileFile = path.join(this.profileDir, `${profileId}.json`);
      
      if (fs.existsSync(profileFile)) {
        return JSON.parse(fs.readFileSync(profileFile, 'utf8'));
      }
      
      return null;
    } catch (error) {
      console.error('[PROFILER] Error getting profile:', error);
      return null;
    }
  }

  // Get all profiles
  getAllProfiles() {
    try {
      const files = fs.readdirSync(this.profileDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.profileDir, file))
        .sort((a, b) => fs.statSync(b).mtime - fs.statSync(a).mtime));

      return files.map(file => {
        try {
          return JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (error) {
          console.error(`[PROFILER] Error reading profile file ${file}:`, error);
          return null;
        }
      }).filter(profile => profile !== null);
      
    } catch (error) {
      console.error('[PROFILER] Error getting all profiles:', error);
      return [];
    }
  }

  // Get profile summary
  getProfileSummary(profileId) {
    const profile = this.getProfile(profileId);
    
    if (!profile) {
      return null;
    }

    return {
      id: profile.id,
      name: profile.name,
      duration: profile.duration,
      timestamp: profile.timestamp,
      metrics: profile.metrics,
      options: profile.options,
      sampleCount: profile.samples ? profile.samples.length : 0,
      eventCount: profile.events ? profile.events.length : 0
    };
  }

  // Delete profile
  deleteProfile(profileId) {
    try {
      const profileFile = path.join(this.profileDir, `${profileId}.json`);
      
      if (fs.existsSync(profileFile)) {
        fs.unlinkSync(profileFile);
        
        // Remove from memory
        this.profiles.delete(profileId);
        
        console.log(`[PROFILER] Deleted profile: ${profileId}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('[PROFILER] Error deleting profile:', error);
      return false;
    }
  }

  // Get profiling status
  getProfilingStatus() {
    return {
      isProfiling: this.isProfiling,
      activeProfiles: Array.from(this.profiles.keys()),
      totalProfiles: this.profiles.size,
      maxProfiles: this.maxProfiles,
      profileDir: this.profileDir
    };
  }

  // Export profile data
  exportProfile(profileId, format = 'json') {
    const profile = this.getProfile(profileId);
    
    if (!profile) {
      throw new Error('Profile not found');
    }

    switch (format) {
      case 'json':
        return JSON.stringify(profile, null, 2);
      case 'csv':
        return this.profileToCSV(profile);
      default:
        return JSON.stringify(profile, null, 2);
    }
  }

  // Convert profile to CSV
  profileToCSV(profile) {
    const csv = [
      'Metric,Value',
      `Name,${profile.name}`,
      `ID,${profile.id}`,
      `Duration,${profile.duration}`,
      `Timestamp,${profile.timestamp}`,
      `CPU Usage (User),${profile.metrics.cpuUsage.user}`,
      `CPU Usage (System),${profile.metrics.cpuUsage.system}`,
      `CPU Usage (Total),${profile.metrics.cpuUsage.total}`,
      `Memory RSS,${profile.metrics.memoryUsage.rss}`,
      `Memory Heap Total,${profile.metrics.memoryUsage.heapTotal}`,
      `Memory Heap Used,${profile.metrics.memoryUsage.heapUsed}`,
      `Memory External,${profile.metrics.memoryUsage.external}`
    ].join('\n');
    
    return csv;
  }

  // Get performance statistics
  getPerformanceStats() {
    const profiles = this.getAllProfiles();
    
    if (profiles.length === 0) {
      return {
        totalProfiles: 0,
        averageDuration: 0,
        averageCpuUsage: 0,
        averageMemoryUsage: 0
      };
    }

    const stats = {
      totalProfiles: profiles.length,
      averageDuration: profiles.reduce((sum, p) => sum + (p.duration || 0), 0) / profiles.length,
      averageCpuUsage: profiles.reduce((sum, p) => sum + (p.metrics?.cpuUsage?.total || 0), 0) / profiles.length,
      averageMemoryUsage: profiles.reduce((sum, p) => sum + (p.metrics?.memoryUsage?.heapUsed || 0), 0) / profiles.length
    };

    return stats;
  }

  // Clear all profiles
  clearProfiles() {
    try {
      const files = fs.readdirSync(this.profileDir)
        .filter(file => file.endsWith('.json'))
        .map(file => path.join(this.profileDir, file));

      files.forEach(file => {
        fs.unlinkSync(file);
      });

      this.profiles.clear();
      
      console.log('[PROFILER] All profiles cleared');
      
    } catch (error) {
      console.error('[PROFILER] Error clearing profiles:', error);
    }
  }

  // Middleware to profile requests
  middleware(options = {}) {
    return (req, res, next) => {
      // Only profile if profiling is enabled
      if (!options.enabled) {
        return next();
      }

      const profileId = this.startProfiling('request', options);
      
      // Override res.end to capture performance
      const originalEnd = res.end;
      const startTime = process.hrtime.bigint();
      
      res.end = function(chunk, encoding) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        
        // Stop profiling
        const profile = this.stopProfiling(profileId);
        
        if (profile) {
          // Add request-specific data
          profile.request = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: duration,
            headers: req.headers,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          };
          
          console.log(`[PROFILER] Request profiled: ${req.method} ${req.originalUrl} - ${duration}ms`);
        }
        
        originalEnd.call(this, chunk, encoding);
      }.bind(this);
      
      next();
    };
  }
}

// Create singleton instance
const performanceProfiler = new PerformanceProfiler();

module.exports = performanceProfiler;
