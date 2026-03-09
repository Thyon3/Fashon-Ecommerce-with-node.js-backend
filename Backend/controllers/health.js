const mongoose = require('mongoose');
const os = require('os');

class HealthCheck {
  static async getHealthStatus() {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: await this.checkDatabase(),
        memory: this.checkMemory(),
        cpu: this.checkCPU(),
        disk: this.checkDisk()
      }
    };

    const serviceStatuses = Object.values(healthStatus.services);
    const hasUnhealthy = serviceStatuses.some(service => service.status === 'unhealthy');
    const hasDegraded = serviceStatuses.some(service => service.status === 'degraded');

    if (hasUnhealthy) {
      healthStatus.status = 'unhealthy';
    } else if (hasDegraded) {
      healthStatus.status = 'degraded';
    }

    return healthStatus;
  }

  static async checkDatabase() {
    try {
      const startTime = Date.now();
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;

      return {
        status: responseTime < 100 ? 'healthy' : 'degraded',
        responseTime: `${responseTime}ms`,
        connected: mongoose.connection.readyState === 1
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        connected: false
      };
    }
  }

  static checkMemory() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = (usedMem / totalMem) * 100;

    return {
      status: memoryUsage < 80 ? 'healthy' : memoryUsage < 90 ? 'degraded' : 'unhealthy',
      usage: `${memoryUsage.toFixed(2)}%`,
      total: `${(totalMem / 1024 / 1024 / 1024).toFixed(2)}GB`,
      used: `${(usedMem / 1024 / 1024 / 1024).toFixed(2)}GB`,
      free: `${(freeMem / 1024 / 1024 / 1024).toFixed(2)}GB`
    };
  }

  static checkCPU() {
    const loadAverage = os.loadavg();
    const cpuCount = os.cpus().length;
    const currentLoad = loadAverage[0];
    const loadPercentage = (currentLoad / cpuCount) * 100;

    return {
      status: loadPercentage < 70 ? 'healthy' : loadPercentage < 85 ? 'degraded' : 'unhealthy',
      usage: `${loadPercentage.toFixed(2)}%`,
      loadAverage: loadAverage.map(load => load.toFixed(2)),
      cores: cpuCount
    };
  }

  static checkDisk() {
    try {
      const stats = require('fs').statSync('.');
      
      return {
        status: 'healthy',
        available: 'N/A',
        used: 'N/A',
        total: 'N/A'
      };
    } catch (error) {
      return {
        status: 'degraded',
        error: 'Disk check not available',
        available: 'N/A',
        used: 'N/A',
        total: 'N/A'
      };
    }
  }
}

module.exports = HealthCheck;
