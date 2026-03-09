const os = require('os');
const mongoose = require('mongoose');
const apiMetrics = require('../heplers/apiMetrics');
const performanceMonitoring = require('../middlewares/performanceMonitoring');
const HealthCheck = require('./health');

class MonitoringController {
  // Get system metrics
  static async getSystemMetrics(req, res) {
    try {
      const systemMetrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        loadAverage: os.loadavg(),
        freeMemory: os.freemem(),
        totalMemory: os.totalmem(),
        cpus: os.cpus().length,
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      };

      res.success(systemMetrics, 'System metrics retrieved successfully');
      
    } catch (error) {
      console.error('Error getting system metrics:', error);
      res.error('Failed to get system metrics', 'SYSTEM_METRICS_ERROR', error.message);
    }
  }

  // Get application metrics
  static async getApplicationMetrics(req, res) {
    try {
      const appMetrics = {
        timestamp: new Date().toISOString(),
        api: apiMetrics.getRealTimeMetrics(),
        performance: performanceMonitoring.getSystemMetrics(),
        health: await HealthCheck.getHealthStatus(),
        database: await this.getDatabaseMetrics()
      };

      res.success(appMetrics, 'Application metrics retrieved successfully');
      
    } catch (error) {
      console.error('Error getting application metrics:', error);
      res.error('Failed to get application metrics', 'APP_METRICS_ERROR', error.message);
    }
  }

  // Get database metrics
  static async getDatabaseMetrics() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      const admin = db.admin();
      const serverStatus = await admin.serverStatus();

      return {
        name: stats.db,
        collections: stats.collections,
        objects: stats.objects,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize,
        avgObjSize: stats.avgObjSize,
        connections: serverStatus.connections,
        opcounters: serverStatus.opcounters,
        network: serverStatus.network
      };
      
    } catch (error) {
      console.error('Error getting database metrics:', error);
      return null;
    }
  }

  // Get API metrics
  static async getApiMetrics(req, res) {
    try {
      const { timeRange = '1h' } = req.query;
      
      let metrics;
      switch (timeRange) {
        case '1h':
          metrics = apiMetrics.getMetricsByTimeRange(60);
          break;
        case '24h':
          metrics = apiMetrics.getMetricsByTimeRange(1440);
          break;
        case '7d':
          metrics = apiMetrics.getMetricsByTimeRange(10080);
          break;
        default:
          metrics = apiMetrics.getAllMetrics();
      }

      res.success({
        timeRange,
        metrics,
        summary: apiMetrics.getSummary()
      }, 'API metrics retrieved successfully');
      
    } catch (error) {
      console.error('Error getting API metrics:', error);
      res.error('Failed to get API metrics', 'API_METRICS_ERROR', error.message);
    }
  }

  // Get error metrics
  static async getErrorMetrics(req, res) {
    try {
      const errorMetrics = apiMetrics.getErrorMetrics();
      const summary = {
        totalErrors: errorMetrics.reduce((sum, e) => sum + e.errorCalls, 0),
        averageErrorRate: errorMetrics.reduce((sum, e) => sum + e.errorRate, 0) / errorMetrics.length,
        topErrors: errorMetrics.slice(0, 10)
      };

      res.success({
        errors: errorMetrics,
        summary
      }, 'Error metrics retrieved successfully');
      
    } catch (error) {
      console.error('Error getting error metrics:', error);
      res.error('Failed to get error metrics', 'ERROR_METRICS_ERROR', error.message);
    }
  }

  // Get performance metrics
  static async getPerformanceMetrics(req, res) {
    try {
      const performanceMetrics = performanceMonitoring.getPerformanceMetrics();
      const summary = {
        slowEndpoints: performanceMetrics.length,
        averageDuration: performanceMetrics.reduce((sum, p) => sum + p.averageDuration, 0) / performanceMetrics.length,
        worstEndpoint: performanceMetrics[0] || null
      };

      res.success({
        performance: performanceMetrics,
        summary
      }, 'Performance metrics retrieved successfully');
      
    } catch (error) {
      console.error('Error getting performance metrics:', error);
      res.error('Failed to get performance metrics', 'PERFORMANCE_METRICS_ERROR', error.message);
    }
  }

  // Get dashboard data
  static async getDashboardData(req, res) {
    try {
      const dashboardData = {
        timestamp: new Date().toISOString(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          loadAverage: os.loadavg()
        },
        health: await HealthCheck.getHealthStatus(),
        api: apiMetrics.getSummary(),
        database: await this.getDatabaseMetrics(),
        alerts: await this.getActiveAlerts()
      };

      res.success(dashboardData, 'Dashboard data retrieved successfully');
      
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      res.error('Failed to get dashboard data', 'DASHBOARD_ERROR', error.message);
    }
  }

  // Get active alerts
  static async getActiveAlerts() {
    try {
      const alerts = [];
      const systemMetrics = performanceMonitoring.getSystemMetrics();
      const errorMetrics = apiMetrics.getErrorMetrics();
      
      // Memory alerts
      const memoryUsage = systemMetrics.process.memory.heapUsed / 1024 / 1024;
      if (memoryUsage > 500) {
        alerts.push({
          type: 'memory',
          severity: 'high',
          message: `High memory usage: ${memoryUsage.toFixed(2)}MB`,
          timestamp: new Date().toISOString()
        });
      }
      
      // CPU alerts
      const loadAverage = os.loadavg()[0];
      if (loadAverage > os.cpus().length * 0.8) {
        alerts.push({
          type: 'cpu',
          severity: 'medium',
          message: `High CPU load: ${loadAverage.toFixed(2)}`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Error rate alerts
      const errorRate = apiMetrics.getSummary().errorRate;
      if (errorRate > 5) {
        alerts.push({
          type: 'error_rate',
          severity: 'high',
          message: `High error rate: ${errorRate.toFixed(2)}%`,
          timestamp: new Date().toISOString()
        });
      }
      
      // Slow request alerts
      const slowEndpoints = performanceMonitoring.getPerformanceMetrics();
      if (slowEndpoints.length > 0) {
        alerts.push({
          type: 'slow_requests',
          severity: 'medium',
          message: `${slowEndpoints.length} slow endpoints detected`,
          timestamp: new Date().toISOString()
        });
      }
      
      return alerts;
      
    } catch (error) {
      console.error('Error getting active alerts:', error);
      return [];
    }
  }

  // Get metrics history
  static async getMetricsHistory(req, res) {
    try {
      const { period = '24h', interval = '1h' } = req.query;
      
      // In production, this would query a time-series database
      // For now, return placeholder data
      const history = this.generateMockHistory(period, interval);
      
      res.success(history, 'Metrics history retrieved successfully');
      
    } catch (error) {
      console.error('Error getting metrics history:', error);
      res.error('Failed to get metrics history', 'METRICS_HISTORY_ERROR', error.message);
    }
  }

  // Generate mock history data
  static generateMockHistory(period, interval) {
    const now = new Date();
    const data = [];
    let points;
    let timeStep;
    
    switch (period) {
      case '1h':
        points = 60;
        timeStep = 1 * 60 * 1000; // 1 minute
        break;
      case '24h':
        points = 24;
        timeStep = 60 * 60 * 1000; // 1 hour
        break;
      case '7d':
        points = 7;
        timeStep = 24 * 60 * 60 * 1000; // 1 day
        break;
      default:
        points = 24;
        timeStep = 60 * 60 * 1000;
    }
    
    for (let i = points - 1; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * timeStep));
      
      data.push({
        timestamp: timestamp.toISOString(),
        requests: Math.floor(Math.random() * 1000) + 500,
        errors: Math.floor(Math.random() * 50),
        responseTime: Math.random() * 500 + 100,
        memory: Math.random() * 200 + 100,
        cpu: Math.random() * 80 + 20
      });
    }
    
    return {
      period,
      interval,
      data
    };
  }

  // Get real-time updates
  static async getRealTimeUpdates(req, res) {
    try {
      // Set up Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      });
      
      const sendUpdate = () => {
        const data = {
          timestamp: new Date().toISOString(),
          metrics: apiMetrics.getRealTimeMetrics(),
          system: performanceMonitoring.getSystemMetrics()
        };
        
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };
      
      // Send initial data
      sendUpdate();
      
      // Send updates every 5 seconds
      const interval = setInterval(sendUpdate, 5000);
      
      // Clean up on disconnect
      req.on('close', () => {
        clearInterval(interval);
      });
      
    } catch (error) {
      console.error('Error setting up real-time updates:', error);
      res.error('Failed to set up real-time updates', 'REALTIME_ERROR', error.message);
    }
  }

  // Export metrics
  static async exportMetrics(req, res) {
    try {
      const { format = 'json', period = '24h' } = req.query;
      
      let data;
      
      switch (format) {
        case 'json':
          data = JSON.stringify({
            timestamp: new Date().toISOString(),
            period,
            system: performanceMonitoring.getSystemMetrics(),
            api: apiMetrics.getAllMetrics(),
            health: await HealthCheck.getHealthStatus()
          }, null, 2);
          break;
        case 'csv':
          data = this.generateCsvExport();
          break;
        default:
          throw new Error('Unsupported export format');
      }
      
      const filename = `metrics_${new Date().toISOString().split('T')[0]}.${format}`;
      
      res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(data);
      
    } catch (error) {
      console.error('Error exporting metrics:', error);
      res.error('Failed to export metrics', 'EXPORT_ERROR', error.message);
    }
  }

  // Generate CSV export
  static generateCsvExport() {
    const metrics = apiMetrics.getAllMetrics();
    
    let csv = 'Endpoint,Method,Total Calls,Success Rate,Avg Duration (ms),Min Duration (ms),Max Duration (ms),Unique Users\n';
    
    metrics.forEach(metric => {
      csv += `${metric.route},${metric.method},${metric.totalCalls},${metric.successRate.toFixed(2)},${metric.averageDuration.toFixed(2)},${metric.minDuration},${metric.maxDuration},${metric.uniqueUsers}\n`;
    });
    
    return csv;
  }
}

module.exports = MonitoringController;
