const fs = require('fs').promises;
const path = require('path');

class Audit {
  static logsDir = path.join(process.cwd(), 'logs', 'audit');
  static maxLogSize = 10 * 1024 * 1024; // 10MB
  static maxLogFiles = 5;

  static async init() {
    try {
      await fs.mkdir(this.logsDir, { recursive: true });
    } catch (error) {
      console.error('[AUDIT] Failed to create audit logs directory:', error);
    }
  }

  static async log(action, userId, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      userId: userId || 'anonymous',
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      sessionId: details.sessionId || 'unknown',
      method: details.method || 'unknown',
      url: details.url || 'unknown',
      statusCode: details.statusCode || 0,
      responseTime: details.responseTime || 0,
      requestBody: details.requestBody || null,
      responseBody: details.responseBody || null,
      error: details.error || null,
      metadata: details.metadata || {}
    };

    await this.writeLog(logEntry);
  }

  static async writeLog(logEntry) {
    const date = new Date().toISOString().split('T')[0];
    const logFile = path.join(this.logsDir, `audit-${date}.log`);
    
    try {
      // Check log file size and rotate if needed
      await this.rotateLogIfNeeded(logFile);
      
      // Append log entry
      const logLine = JSON.stringify(logEntry) + '\n';
      await fs.appendFile(logFile, logLine);
      
      console.log(`[AUDIT] ${logEntry.action} by ${logEntry.userId}`);
    } catch (error) {
      console.error('[AUDIT] Failed to write audit log:', error);
    }
  }

  static async rotateLogIfNeeded(logFile) {
    try {
      const stats = await fs.stat(logFile);
      
      if (stats.size >= this.maxLogSize) {
        // Rotate log files
        for (let i = this.maxLogFiles - 1; i > 0; i--) {
          const oldFile = `${logFile}.${i}`;
          const newFile = `${logFile}.${i + 1}`;
          
          try {
            await fs.rename(oldFile, newFile);
          } catch (error) {
            // File might not exist, continue
          }
        }
        
        // Move current log to .1
        await fs.rename(logFile, `${logFile}.1`);
      }
    } catch (error) {
      // Log file might not exist yet
    }
  }

  static async searchLogs(query = {}) {
    const logs = [];
    const date = new Date();
    
    // Search last 7 days of logs
    for (let i = 0; i < 7; i++) {
      const logDate = date.toISOString().split('T')[0];
      const logFile = path.join(this.logsDir, `audit-${logDate}.log`);
      
      try {
        const content = await fs.readFile(logFile, 'utf8');
        const lines = content.trim().split('\n');
        
        for (const line of lines) {
          try {
            const logEntry = JSON.parse(line);
            
            // Apply filters
            if (query.action && logEntry.action !== query.action) continue;
            if (query.userId && logEntry.userId !== query.userId) continue;
            if (query.startDate && new Date(logEntry.timestamp) < new Date(query.startDate)) continue;
            if (query.endDate && new Date(logEntry.timestamp) > new Date(query.endDate)) continue;
            
            logs.push(logEntry);
          } catch (parseError) {
            // Skip malformed log entries
          }
        }
      } catch (error) {
        // Log file might not exist
      }
      
      date.setDate(date.getDate() - 1);
    }
    
    return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  static async getAuditStats() {
    const logs = await this.searchLogs();
    const stats = {
      totalLogs: logs.length,
      actions: {},
      users: {},
      hourlyActivity: {},
      errorRate: 0,
      averageResponseTime: 0
    };

    let totalResponseTime = 0;
    let errorCount = 0;

    for (const log of logs) {
      // Count actions
      stats.actions[log.action] = (stats.actions[log.action] || 0) + 1;
      
      // Count users
      stats.users[log.userId] = (stats.users[log.userId] || 0) + 1;
      
      // Hourly activity
      const hour = new Date(log.timestamp).getHours();
      stats.hourlyActivity[hour] = (stats.hourlyActivity[hour] || 0) + 1;
      
      // Response time
      if (log.responseTime) {
        totalResponseTime += log.responseTime;
      }
      
      // Error rate
      if (log.statusCode >= 400) {
        errorCount++;
      }
    }

    stats.averageResponseTime = logs.length > 0 ? totalResponseTime / logs.length : 0;
    stats.errorRate = logs.length > 0 ? (errorCount / logs.length) * 100 : 0;

    return stats;
  }

  static async cleanupOldLogs(daysToKeep = 30) {
    try {
      const files = await fs.readdir(this.logsDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.startsWith('audit-') && file.endsWith('.log')) {
          const filePath = path.join(this.logsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            console.log(`[AUDIT] Cleaned up old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      console.error('[AUDIT] Failed to cleanup old logs:', error);
    }
  }

  static middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Store original end function
      const originalEnd = res.end;
      
      // Override end function to capture response
      res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Log the request
        Audit.log('api_request', req.user?.id, {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.sessionID,
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime,
          requestBody: req.method !== 'GET' ? req.body : null,
          responseBody: res.statusCode >= 400 ? res.locals.error : null,
          error: res.statusCode >= 400 ? res.locals.error : null,
          metadata: {
            headers: req.headers,
            query: req.query,
            params: req.params
          }
        }).catch(error => {
          console.error('[AUDIT] Failed to log request:', error);
        });
        
        // Call original end function
        originalEnd.apply(this, args);
      };
      
      next();
    };
  }

  static async logSecurityEvent(event, details = {}) {
    await this.log('security_event', details.userId || 'system', {
      ...details,
      metadata: {
        ...details.metadata,
        securityLevel: 'high',
        event
      }
    });
  }

  static async logDataAccess(resource, userId, details = {}) {
    await this.log('data_access', userId, {
      ...details,
      metadata: {
        ...details.metadata,
        resource,
        accessType: 'read'
      }
    });
  }

  static async logDataModification(resource, userId, details = {}) {
    await this.log('data_modification', userId, {
      ...details,
      metadata: {
        ...details.metadata,
        resource,
        accessType: 'write'
      }
    });
  }

  static async logAuthentication(action, userId, details = {}) {
    await this.log('authentication', userId || 'anonymous', {
      ...details,
      metadata: {
        ...details.metadata,
        authAction: action
      }
    });
  }

  static async logAuthorization(action, userId, resource, details = {}) {
    await this.log('authorization', userId, {
      ...details,
      metadata: {
        ...details.metadata,
        authzAction: action,
        resource
      }
    });
  }
}

module.exports = Audit;
