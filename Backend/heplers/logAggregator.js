const fs = require('fs');
const path = require('path');

class LogAggregator {
  constructor() {
    this.logs = [];
    this.maxLogs = 10000; // Keep last 10,000 logs in memory
    this.logFile = path.join(__dirname, '../logs/aggregated.log');
    this.rotationSize = 10 * 1024 * 1024; // 10MB
    this.ensureLogDirectory();
  }

  // Ensure log directory exists
  ensureLogDirectory() {
    const logDir = path.dirname(this.logFile);
    
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Add log entry
  addLog(level, message, metadata = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      message,
      metadata,
      pid: process.pid,
      hostname: require('os').hostname(),
      service: 'fashon-api'
    };

    // Add to memory
    this.logs.push(logEntry);
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Write to file
    this.writeToFile(logEntry);
    
    // Send to external service (in production)
    if (process.env.NODE_ENV === 'production') {
      this.sendToLogService(logEntry);
    }
    
    // Console output for development
    if (process.env.NODE_ENV !== 'production') {
      this.consoleLog(logEntry);
    }
  }

  // Write log to file
  writeToFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      
      // Check if we need to rotate the file
      if (this.shouldRotateFile()) {
        this.rotateLogFile();
      }
      
      fs.appendFileSync(this.logFile, logLine);
      
    } catch (error) {
      console.error('[LOG_AGGREGATOR] Error writing to log file:', error);
    }
  }

  // Check if log file needs rotation
  shouldRotateFile() {
    try {
      if (!fs.existsSync(this.logFile)) {
        return false;
      }
      
      const stats = fs.statSync(this.logFile);
      return stats.size >= this.rotationSize;
      
    } catch (error) {
      return false;
    }
  }

  // Rotate log file
  rotateLogFile() {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rotatedFile = this.logFile.replace('.log', `-${timestamp}.log`);
      
      // Move current log file
      if (fs.existsSync(this.logFile)) {
        fs.renameSync(this.logFile, rotatedFile);
      }
      
      console.log(`[LOG_AGGREGATOR] Log file rotated: ${rotatedFile}`);
      
      // Clean up old log files
      this.cleanupOldLogFiles();
      
    } catch (error) {
      console.error('[LOG_AGGREGATOR] Error rotating log file:', error);
    }
  }

  // Clean up old log files
  cleanupOldLogFiles() {
    try {
      const logDir = path.dirname(this.logFile);
      const files = fs.readdirSync(logDir);
      const logFiles = files.filter(file => file.startsWith('aggregated-') && file.endsWith('.log'));
      
      // Keep only the last 10 log files
      if (logFiles.length > 10) {
        logFiles
          .sort()
          .slice(0, logFiles.length - 10)
          .forEach(file => {
            const filePath = path.join(logDir, file);
            fs.unlinkSync(filePath);
            console.log(`[LOG_AGGREGATOR] Deleted old log file: ${file}`);
          });
      }
      
    } catch (error) {
      console.error('[LOG_AGGREGATOR] Error cleaning up old log files:', error);
    }
  }

  // Send to external log service
  sendToLogService(logEntry) {
    // In production, this would send to services like:
    // - ELK Stack
    // - Splunk
    // - Loggly
    // - Papertrail
    // - Custom log aggregation endpoint
    
    try {
      // Placeholder for external service integration
      console.log('[LOG_SERVICE]', JSON.stringify({
        service: 'fashon-api',
        log: logEntry
      }));
      
    } catch (error) {
      console.error('[LOG_AGGREGATOR] Error sending to log service:', error);
    }
  }

  // Console log with colors
  consoleLog(logEntry) {
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[37m', // White
      RESET: '\x1b[0m'
    };
    
    const color = colors[logEntry.level] || colors.RESET;
    const reset = colors.RESET;
    
    console.log(`${color}[${logEntry.level}]${reset} ${logEntry.timestamp} - ${logEntry.message}`);
    
    if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
      console.log(`${color}[METADATA]${reset}`, logEntry.metadata);
    }
  }

  // Get logs with filtering
  getLogs(options = {}) {
    const {
      level,
      startTime,
      endTime,
      limit = 100,
      offset = 0,
      search
    } = options;

    let filteredLogs = [...this.logs];
    
    // Filter by level
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
    }
    
    // Filter by time range
    if (startTime) {
      const start = new Date(startTime);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= start);
    }
    
    if (endTime) {
      const end = new Date(endTime);
      filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= end);
    }
    
    // Search in message and metadata
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLogs = filteredLogs.filter(log => 
        log.message.toLowerCase().includes(searchLower) ||
        JSON.stringify(log.metadata).toLowerCase().includes(searchLower)
      );
    }
    
    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const paginatedLogs = filteredLogs.slice(offset, offset + limit);
    
    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      offset,
      limit
    };
  }

  // Get log statistics
  getLogStats(timeRange = '24h') {
    const now = new Date();
    let startTime;
    
    switch (timeRange) {
      case '1h':
        startTime = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
    
    const recentLogs = this.logs.filter(log => new Date(log.timestamp) >= startTime);
    
    const stats = {
      totalLogs: recentLogs.length,
      levels: {
        ERROR: 0,
        WARN: 0,
        INFO: 0,
        DEBUG: 0
      },
      timeRange,
      startTime: startTime.toISOString(),
      endTime: now.toISOString()
    };
    
    recentLogs.forEach(log => {
      if (stats.levels[log.level] !== undefined) {
        stats.levels[log.level]++;
      }
    });
    
    // Calculate error rate
    stats.errorRate = stats.totalLogs > 0 ? (stats.levels.ERROR / stats.totalLogs) * 100 : 0;
    
    // Get top error messages
    const errorLogs = recentLogs.filter(log => log.level === 'ERROR');
    const errorCounts = {};
    
    errorLogs.forEach(log => {
      const key = log.message;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });
    
    stats.topErrors = Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([message, count]) => ({ message, count }));
    
    return stats;
  }

  // Get error trends
  getErrorTrends(hours = 24) {
    const now = new Date();
    const trends = [];
    
    for (let i = hours - 1; i >= 0; i--) {
      const hourStart = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const hourEnd = new Date(now.getTime() - ((i - 1) * 60 * 60 * 1000));
      
      const hourLogs = this.logs.filter(log => {
        const logTime = new Date(log.timestamp);
        return logTime >= hourStart && logTime < hourEnd;
      });
      
      const errors = hourLogs.filter(log => log.level === 'ERROR');
      const warnings = hourLogs.filter(log => log.level === 'WARN');
      
      trends.push({
        hour: hourStart.toISOString(),
        total: hourLogs.length,
        errors: errors.length,
        warnings: warnings.length
      });
    }
    
    return trends;
  }

  // Export logs
  exportLogs(options = {}) {
    const logs = this.getLogs(options);
    const exportData = {
      exportedAt: new Date().toISOString(),
      options,
      logs: logs.logs
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  // Export logs to CSV
  exportLogsToCSV(options = {}) {
    const logs = this.getLogs(options);
    const csvHeader = 'Timestamp,Level,Message,Metadata,PID,Hostname,Service\n';
    
    const csvRows = logs.logs.map(log => {
      const metadata = JSON.stringify(log.metadata).replace(/"/g, '""');
      return `"${log.timestamp}","${log.level}","${log.message}","${metadata}","${log.pid}","${log.hostname}","${log.service}"`;
    }).join('\n');
    
    return csvHeader + csvRows;
  }

  // Clear logs
  clearLogs() {
    this.logs = [];
    console.log('[LOG_AGGREGATOR] In-memory logs cleared');
  }

  // Get log file information
  getLogFileInfo() {
    try {
      if (!fs.existsSync(this.logFile)) {
        return {
          exists: false,
          size: 0,
          modified: null
        };
      }
      
      const stats = fs.statSync(this.logFile);
      
      return {
        exists: true,
        size: stats.size,
        sizeFormatted: this.formatBytes(stats.size),
        modified: stats.mtime.toISOString(),
        path: this.logFile
      };
      
    } catch (error) {
      console.error('[LOG_AGGREGATOR] Error getting log file info:', error);
      return {
        exists: false,
        size: 0,
        modified: null,
        error: error.message
      };
    }
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Search logs
  searchLogs(query, options = {}) {
    return this.getLogs({
      ...options,
      search: query
    });
  }

  // Get logs by level
  getLogsByLevel(level, options = {}) {
    return this.getLogs({
      ...options,
      level
    });
  }

  // Get recent logs
  getRecentLogs(count = 100) {
    return this.getLogs({
      limit: count
    });
  }
}

// Create singleton instance
const logAggregator = new LogAggregator();

module.exports = logAggregator;
