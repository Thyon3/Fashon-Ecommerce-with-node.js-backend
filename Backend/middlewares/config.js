class Config {
  static config = {
    port: process.env.PORT || 3000,
    nodeEnv: process.env.NODE_ENV || 'development',
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fashon',
    jwtSecret: process.env.JWT_SECRET || 'default-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
    corsOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    logLevel: process.env.LOG_LEVEL || 'info',
    uploadDir: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024, // 5MB
    rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    cacheTTL: parseInt(process.env.CACHE_TTL) || 600, // 10 minutes
    backupInterval: parseInt(process.env.BACKUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
    maintenanceMode: process.env.MAINTENANCE_MODE === 'true'
  };

  static get(key) {
    return this.config[key];
  }

  static set(key, value) {
    this.config[key] = value;
  }

  static getAll() {
    return { ...this.config };
  }

  static isDevelopment() {
    return this.config.nodeEnv === 'development';
  }

  static isProduction() {
    return this.config.nodeEnv === 'production';
  }

  static isTest() {
    return this.config.nodeEnv === 'test';
  }

  static validate() {
    const required = ['mongoUri', 'jwtSecret'];
    const missing = [];

    required.forEach(key => {
      if (!this.config[key] || this.config[key] === 'default-secret') {
        missing.push(key);
      }
    });

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
  }

  static loadFromEnv() {
    Object.keys(this.config).forEach(key => {
      const envKey = key.toUpperCase().replace(/([A-Z])/g, '_$1');
      const envValue = process.env[envKey];
      
      if (envValue !== undefined) {
        // Convert string values to appropriate types
        if (envValue === 'true') {
          this.config[key] = true;
        } else if (envValue === 'false') {
          this.config[key] = false;
        } else if (!isNaN(envValue)) {
          this.config[key] = parseInt(envValue);
        } else {
          this.config[key] = envValue;
        }
      }
    });
  }

  static middleware() {
    return (req, res, next) => {
      req.config = this.config;
      next();
    };
  }

  static endpoint(req, res) {
    res.json({
      success: true,
      data: {
        config: {
          port: this.config.port,
          nodeEnv: this.config.nodeEnv,
          corsOrigins: this.config.corsOrigins,
          logLevel: this.config.logLevel,
          maintenanceMode: this.config.maintenanceMode
        },
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Load configuration from environment
Config.loadFromEnv();

module.exports = Config;
