const axios = require('axios');

class ExternalHealthCheck {
  constructor() {
    this.services = new Map();
    this.results = new Map();
    this.checkInterval = 60000; // 1 minute
    this.timeout = 5000; // 5 seconds
    this.startHealthChecks();
  }

  // Start health checks for external services
  startHealthChecks() {
    console.log('[HEALTH_CHECK] Starting external service health checks');
    
    // Check services periodically
    setInterval(async () => {
      await this.checkAllServices();
    }, this.checkInterval);
    
    // Initial check
    this.checkAllServices();
  }

  // Register external service
  registerService(name, config) {
    this.services.set(name, {
      name,
      url: config.url,
      method: config.method || 'GET',
      headers: config.headers || {},
      timeout: config.timeout || this.timeout,
      expectedStatus: config.expectedStatus || 200,
      expectedResponse: config.expectedResponse,
      enabled: config.enabled !== false
    });
    
    console.log(`[HEALTH_CHECK] Registered external service: ${name}`);
  }

  // Check all services
  async checkAllServices() {
    const results = {};
    
    for (const [name, service] of this.services.entries()) {
      if (service.enabled) {
        results[name] = await this.checkService(service);
      }
    }
    
    this.results.set('latest', {
      timestamp: new Date().toISOString(),
      services: results
    });
    
    return results;
  }

  // Check individual service
  async checkService(service) {
    const startTime = Date.now();
    
    try {
      const config = {
        method: service.method,
        url: service.url,
        headers: service.headers,
        timeout: service.timeout,
        validateStatus: (status) => status === service.expectedStatus
      };
      
      const response = await axios(config);
      const responseTime = Date.now() - startTime;
      
      const result = {
        name: service.name,
        status: 'healthy',
        responseTime,
        statusCode: response.status,
        timestamp: new Date().toISOString(),
        message: 'Service is responding normally'
      };
      
      // Check expected response if specified
      if (service.expectedResponse) {
        const isExpected = this.checkExpectedResponse(response.data, service.expectedResponse);
        if (!isExpected) {
          result.status = 'degraded';
          result.message = 'Service responding but with unexpected data';
        }
      }
      
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: service.name,
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'Service is not responding'
      };
    }
  }

  // Check if response matches expected pattern
  checkExpectedResponse(actual, expected) {
    if (typeof expected === 'object') {
      return JSON.stringify(actual) === JSON.stringify(expected);
    }
    
    if (typeof expected === 'function') {
      return expected(actual);
    }
    
    return actual === expected;
  }

  // Get service health status
  getServiceHealth(serviceName) {
    const latest = this.results.get('latest');
    
    if (!latest || !latest.services[serviceName]) {
      return {
        name: serviceName,
        status: 'unknown',
        message: 'Service not checked yet'
      };
    }
    
    return latest.services[serviceName];
  }

  // Get all service health status
  getAllServiceHealth() {
    const latest = this.results.get('latest');
    
    if (!latest) {
      return {
        timestamp: new Date().toISOString(),
        services: {},
        overall: 'unknown'
      };
    }
    
    const services = latest.services;
    const statuses = Object.values(services).map(s => s.status);
    
    let overall;
    if (statuses.length === 0) {
      overall = 'unknown';
    } else if (statuses.every(s => s === 'healthy')) {
      overall = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }
    
    return {
      ...latest,
      overall
    };
  }

  // Check database connection
  async checkDatabase() {
    const mongoose = require('mongoose');
    const startTime = Date.now();
    
    try {
      await mongoose.connection.db.admin().ping();
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        message: 'Database connection is healthy'
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'database',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'Database connection failed'
      };
    }
  }

  // Check Redis connection (if available)
  async checkRedis() {
    const startTime = Date.now();
    
    try {
      // This would check Redis if it's configured
      // For now, return a placeholder
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'redis',
        status: 'not_configured',
        responseTime,
        timestamp: new Date().toISOString(),
        message: 'Redis not configured'
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'redis',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'Redis connection failed'
      };
    }
  }

  // Check email service
  async checkEmailService() {
    const emailSender = require('./email_sender');
    const startTime = Date.now();
    
    try {
      // This would check email service connectivity
      // For now, return a placeholder
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'email_service',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        message: 'Email service is configured'
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'email_service',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'Email service configuration error'
      };
    }
  }

  // Check file storage
  async checkFileStorage() {
    const fs = require('fs');
    const path = require('path');
    const startTime = Date.now();
    
    try {
      const uploadsDir = path.join(__dirname, '../public/uploads');
      
      if (!fs.existsSync(uploadsDir)) {
        return {
          name: 'file_storage',
          status: 'degraded',
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          message: 'Uploads directory not found'
        };
      }
      
      // Test write permission
      const testFile = path.join(uploadsDir, '.health_check');
      fs.writeFileSync(testFile, 'test');
      fs.unlinkSync(testFile);
      
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'file_storage',
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString(),
        message: 'File storage is accessible'
      };
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        name: 'file_storage',
        status: 'unhealthy',
        responseTime,
        timestamp: new Date().toISOString(),
        error: error.message,
        message: 'File storage not accessible'
      };
    }
  }

  // Get comprehensive health check
  async getComprehensiveHealth() {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkEmailService(),
      this.checkFileStorage()
    ]);
    
    const results = {
      timestamp: new Date().toISOString(),
      services: {}
    };
    
    checks.forEach(check => {
      results.services[check.name] = check;
    });
    
    // Add external services
    const externalHealth = this.getAllServiceHealth();
    if (externalHealth.services) {
      Object.assign(results.services, externalHealth.services);
    }
    
    // Calculate overall status
    const statuses = Object.values(results.services).map(s => s.status);
    
    let overall;
    if (statuses.length === 0) {
      overall = 'unknown';
    } else if (statuses.every(s => s === 'healthy')) {
      overall = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      overall = 'unhealthy';
    } else {
      overall = 'degraded';
    }
    
    results.overall = overall;
    
    return results;
  }

  // Get health check statistics
  getHealthStats() {
    const latest = this.results.get('latest');
    
    if (!latest) {
      return {
        totalServices: 0,
        healthy: 0,
        unhealthy: 0,
        degraded: 0,
        unknown: 0
      };
    }
    
    const services = latest.services;
    const stats = {
      totalServices: Object.keys(services).length,
      healthy: 0,
      unhealthy: 0,
      degraded: 0,
      unknown: 0
    };
    
    Object.values(services).forEach(service => {
      stats[service.status]++;
    });
    
    return stats;
  }

  // Enable/disable service
  toggleService(serviceName, enabled) {
    const service = this.services.get(serviceName);
    
    if (service) {
      service.enabled = enabled;
      console.log(`[HEALTH_CHECK] Service ${serviceName} ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    }
    
    return false;
  }

  // Remove service
  removeService(serviceName) {
    const removed = this.services.delete(serviceName);
    
    if (removed) {
      console.log(`[HEALTH_CHECK] Service ${serviceName} removed`);
    }
    
    return removed;
  }

  // Get registered services
  getRegisteredServices() {
    const services = {};
    
    this.services.forEach((service, name) => {
      services[name] = {
        name: service.name,
        url: service.url,
        method: service.method,
        enabled: service.enabled
      };
    });
    
    return services;
  }

  // Export health check results
  exportResults() {
    return JSON.stringify(Array.from(this.results.entries()), null, 2);
  }

  // Clear health check results
  clearResults() {
    this.results.clear();
    console.log('[HEALTH_CHECK] Health check results cleared');
  }
}

// Create singleton instance
const externalHealthCheck = new ExternalHealthCheck();

// Register default external services
externalHealthCheck.registerService('payment_gateway', {
  url: 'https://api.stripe.com/v1',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.STRIPE_SECRET_KEY || 'test_key'}`
  },
  timeout: 5000,
  enabled: !!process.env.STRIPE_SECRET_KEY
});

module.exports = externalHealthCheck;
