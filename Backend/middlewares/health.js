class Health {
  static checks = new Map();

  static addCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
  }

  static async runChecks() {
    const results = {};
    let overall = 'healthy';

    for (const [name, checkFunction] of this.checks.entries()) {
      try {
        const result = await checkFunction();
        results[name] = { status: 'healthy', ...result };
      } catch (error) {
        results[name] = { status: 'unhealthy', error: error.message };
        overall = 'unhealthy';
      }
    }

    return { overall, checks: results };
  }

  static async middleware(req, res) {
    const health = await this.runChecks();
    const statusCode = health.overall === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status: health.overall,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: health.checks
    });
  }

  static async readiness(req, res) {
    // Check if application is ready to serve traffic
    const health = await this.runChecks();
    const isReady = health.overall === 'healthy';

    res.status(isReady ? 200 : 503).json({
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date().toISOString()
    });
  }

  static liveness(req, res) {
    // Simple liveness check - if we're here, we're alive
    res.status(200).json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  }

  static database() {
    return async () => {
      // Check database connection
      const mongoose = require('mongoose');
      
      if (mongoose.connection.readyState === 1) {
        return { message: 'Database connected' };
      } else {
        throw new Error('Database not connected');
      }
    };
  }

  static memory() {
    return () => {
      const usage = process.memoryUsage();
      const totalMem = require('os').totalmem();
      const freeMem = require('os').freemem();
      
      return {
        memory: {
          used: Math.round(usage.heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(usage.heapTotal / 1024 / 1024) + 'MB',
          systemFree: Math.round(freeMem / 1024 / 1024) + 'MB',
          systemTotal: Math.round(totalMem / 1024 / 1024) + 'MB'
        }
      };
    };
  }

  static disk() {
    return () => {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      return {
        disk: {
          available: 'N/A', // Would need additional library for disk space
          status: 'ok'
        }
      };
    };
  }
}

// Add default health checks
Health.addCheck('database', Health.database());
Health.addCheck('memory', Health.memory());
Health.addCheck('disk', Health.disk());

module.exports = Health;
