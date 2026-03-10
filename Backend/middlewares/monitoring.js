class Monitoring {
  static metrics = {
    requests: 0,
    errors: 0,
    responseTime: [],
    activeConnections: 0,
    startTime: Date.now()
  };

  static middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      this.metrics.requests++;
      this.metrics.activeConnections++;

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.metrics.responseTime.push(duration);
        
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime.shift();
        }

        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }

        this.metrics.activeConnections--;
      });

      next();
    };
  }

  static getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0 ? 
      Math.round(this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length) : 0;

    return {
      uptime: Date.now() - this.metrics.startTime,
      requests: this.metrics.requests,
      errors: this.metrics.errors,
      errorRate: this.metrics.requests > 0 ? 
        Math.round((this.metrics.errors / this.metrics.requests) * 100) : 0,
      averageResponseTime: avgResponseTime,
      activeConnections: this.metrics.activeConnections,
      memory: process.memoryUsage(),
      cpu: process.cpuUsage()
    };
  }

  static reset() {
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      activeConnections: 0,
      startTime: Date.now()
    };
  }

  static middleware(req, res) {
    res.json({
      success: true,
      data: this.getMetrics(),
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = Monitoring;
