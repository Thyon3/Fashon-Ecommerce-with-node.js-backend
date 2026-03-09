const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor() {
    this.config = {};
    this.watchers = [];
    this.configFile = path.join(__dirname, '../config/app.json');
    this.loadConfig();
  }

  // Load configuration
  loadConfig() {
    try {
      // Load default configuration
      this.config = this.getDefaultConfig();
      
      // Load from file if exists
      if (fs.existsSync(this.configFile)) {
        const fileConfig = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
        this.config = this.mergeConfig(this.config, fileConfig);
      }
      
      // Override with environment variables
      this.config = this.mergeWithEnvVars(this.config);
      
      console.log('[CONFIG] Configuration loaded successfully');
      
    } catch (error) {
      console.error('[CONFIG] Error loading configuration:', error);
      this.config = this.getDefaultConfig();
    }
  }

  // Get default configuration
  getDefaultConfig() {
    return {
      app: {
        name: 'Fashon E-commerce API',
        version: '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: parseInt(process.env.PORT) || 3000,
        host: process.env.HOST || 'localhost'
      },
      database: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/fashon',
        options: {
          maxPoolSize: 10,
          minPoolSize: 2,
          maxIdleTimeMS: 30000
        }
      },
      security: {
        jwtSecret: process.env.ACCESS_TOKEN_SECRETSTRING || 'default-secret',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
        refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12,
        encryptionKey: process.env.ENCRYPTION_KEY || 'default-encryption-key'
      },
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      },
      rateLimiting: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
        max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
        message: 'Too many requests from this IP, please try again later'
      },
      email: {
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: process.env.EMAIL_SECURE === 'true',
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASS || '',
        from: process.env.EMAIL_FROM || 'noreply@fashon.com'
      },
      upload: {
        maxSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024, // 5MB
        allowedTypes: process.env.UPLOAD_ALLOWED_TYPES ? process.env.UPLOAD_ALLOWED_TYPES.split(',') : ['image/jpeg', 'image/png', 'image/gif'],
        destination: process.env.UPLOAD_DESTINATION || 'public/uploads'
      },
      logging: {
        level: process.env.LOG_LEVEL || 'info',
        format: process.env.LOG_FORMAT || 'combined',
        file: process.env.LOG_FILE || 'logs/app.log',
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: parseInt(process.env.LOG_MAX_FILES) || 14
      },
      cache: {
        enabled: process.env.CACHE_ENABLED === 'true',
        ttl: parseInt(process.env.CACHE_TTL) || 300, // 5 minutes
        checkPeriod: parseInt(process.env.CHECK_PERIOD) || 600 // 10 minutes
      },
      monitoring: {
        enabled: process.env.MONITORING_ENABLED === 'true',
        metricsInterval: parseInt(process.env.METRICS_INTERVAL) || 60000, // 1 minute
        healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000 // 30 seconds
      },
      backup: {
        enabled: process.env.BACKUP_ENABLED === 'true',
        schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
        destination: process.env.BACKUP_DESTINATION || './backups'
      },
      features: {
        registration: process.env.FEATURE_REGISTRATION !== 'false',
        socialLogin: process.env.FEATURE_SOCIAL_LOGIN === 'true',
        twoFactorAuth: process.env.FEATURE_2FA === 'true',
        reviews: process.env.FEATURE_REVIEWS !== 'false',
        wishlist: process.env.FEATURE_WISHLIST !== 'false',
        comparison: process.env.FEATURE_COMPARISON !== 'false',
        recommendations: process.env.FEATURE_RECOMMENDATIONS !== 'false',
        tracking: process.env.FEATURE_TRACKING !== 'false',
        notifications: process.env.FEATURE_NOTIFICATIONS !== 'false'
      }
    };
  }

  // Merge configurations
  mergeConfig(defaultConfig, overrideConfig) {
    return this.deepMerge(defaultConfig, overrideConfig);
  }

  // Deep merge objects
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }
    
    return result;
  }

  // Merge with environment variables
  mergeWithEnvVars(config) {
    const envConfig = {};
    
    // Map environment variables to config structure
    const envMappings = {
      'MONGODB_URI': 'database.uri',
      'JWT_EXPIRES_IN': 'security.jwtExpiresIn',
      'REFRESH_TOKEN_EXPIRES_IN': 'security.refreshTokenExpiresIn',
      'BCRYPT_ROUNDS': 'security.bcryptRounds',
      'ENCRYPTION_KEY': 'security.encryptionKey',
      'ALLOWED_ORIGINS': 'cors.origin',
      'RATE_LIMIT_WINDOW_MS': 'rateLimiting.windowMs',
      'RATE_LIMIT_MAX': 'rateLimiting.max',
      'EMAIL_HOST': 'email.host',
      'EMAIL_PORT': 'email.port',
      'EMAIL_SECURE': 'email.secure',
      'EMAIL_USER': 'email.user',
      'EMAIL_PASS': 'email.pass',
      'EMAIL_FROM': 'email.from',
      'UPLOAD_MAX_SIZE': 'upload.maxSize',
      'UPLOAD_ALLOWED_TYPES': 'upload.allowedTypes',
      'UPLOAD_DESTINATION': 'upload.destination',
      'LOG_LEVEL': 'logging.level',
      'LOG_FORMAT': 'logging.format',
      'LOG_FILE': 'logging.file',
      'CACHE_ENABLED': 'cache.enabled',
      'CACHE_TTL': 'cache.ttl',
      'MONITORING_ENABLED': 'monitoring.enabled',
      'BACKUP_ENABLED': 'backup.enabled',
      'BACKUP_SCHEDULE': 'backup.schedule',
      'FEATURE_REGISTRATION': 'features.registration',
      'FEATURE_SOCIAL_LOGIN': 'features.socialLogin',
      'FEATURE_2FA': 'features.twoFactorAuth'
    };
    
    Object.keys(envMappings).forEach(envVar => {
      const configPath = envMappings[envVar];
      const value = process.env[envVar];
      
      if (value !== undefined) {
        this.setNestedValue(envConfig, configPath, value);
      }
    });
    
    return this.mergeConfig(config, envConfig);
  }

  // Set nested value in object
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  // Get configuration value
  get(path, defaultValue = null) {
    const keys = path.split('.');
    let current = this.config;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  // Set configuration value
  set(path, value) {
    this.setNestedValue(this.config, path, value);
    this.saveConfig();
    this.notifyWatchers(path, value);
  }

  // Save configuration to file
  saveConfig() {
    try {
      const configDir = path.dirname(this.configFile);
      
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      fs.writeFileSync(this.configFile, JSON.stringify(this.config, null, 2));
      console.log('[CONFIG] Configuration saved to file');
      
    } catch (error) {
      console.error('[CONFIG] Error saving configuration:', error);
    }
  }

  // Watch for configuration changes
  watch(callback) {
    this.watchers.push(callback);
    
    if (this.watchers.length === 1) {
      fs.watchFile(this.configFile, (curr, prev) => {
        if (curr.mtime !== prev.mtime) {
          this.loadConfig();
          this.notifyWatchers('config', this.config);
        }
      });
    }
  }

  // Notify watchers of changes
  notifyWatchers(path, value) {
    this.watchers.forEach(callback => {
      try {
        callback(path, value);
      } catch (error) {
        console.error('[CONFIG] Watcher callback error:', error);
      }
    });
  }

  // Validate configuration
  validate() {
    const errors = [];
    
    // Validate required fields
    const requiredFields = [
      'app.name',
      'app.version',
      'database.uri',
      'security.jwtSecret'
    ];
    
    requiredFields.forEach(field => {
      if (!this.get(field)) {
        errors.push(`Missing required configuration: ${field}`);
      }
    });
    
    // Validate data types
    if (this.get('app.port') && isNaN(this.get('app.port'))) {
      errors.push('app.port must be a number');
    }
    
    if (this.get('database.options.maxPoolSize') && isNaN(this.get('database.options.maxPoolSize'))) {
      errors.push('database.options.maxPoolSize must be a number');
    }
    
    // Validate URLs
    const dbUri = this.get('database.uri');
    if (dbUri && !dbUri.startsWith('mongodb://') && !dbUri.startsWith('mongodb+srv://')) {
      errors.push('database.uri must be a valid MongoDB URI');
    }
    
    if (errors.length > 0) {
      console.error('[CONFIG] Configuration validation errors:', errors);
      return false;
    }
    
    console.log('[CONFIG] Configuration validation passed');
    return true;
  }

  // Get configuration as JSON
  toJSON(sensitive = false) {
    const config = { ...this.config };
    
    if (!sensitive) {
      return JSON.stringify(config, null, 2);
    }
    
    // Remove sensitive data
    const sensitiveFields = [
      'security.jwtSecret',
      'security.encryptionKey',
      'email.pass'
    ];
    
    sensitiveFields.forEach(field => {
      this.setNestedValue(config, field, '[REDACTED]');
    });
    
    return JSON.stringify(config, null, 2);
  }

  // Export configuration
  export() {
    return this.toJSON();
  }

  // Import configuration
  import(configData) {
    try {
      const config = JSON.parse(configData);
      this.config = this.mergeConfig(this.config, config);
      this.saveConfig();
      this.notifyWatchers('config', this.config);
      
      console.log('[CONFIG] Configuration imported successfully');
      
    } catch (error) {
      console.error('[CONFIG] Error importing configuration:', error);
      throw error;
    }
  }

  // Reset to default configuration
  reset() {
    this.config = this.getDefaultConfig();
    this.saveConfig();
    this.notifyWatchers('config', this.config);
    
    console.log('[CONFIG] Configuration reset to defaults');
  }

  // Get environment-specific configuration
  getEnvironmentConfig() {
    const env = this.get('app.environment', 'development');
    const envConfig = {};
    
    // Add environment-specific overrides
    switch (env) {
      case 'production':
        envConfig.logging = { level: 'warn' };
        envConfig.cache = { enabled: true };
        envConfig.monitoring = { enabled: true };
        break;
      case 'development':
        envConfig.logging = { level: 'debug' };
        envConfig.cache = { enabled: false };
        envConfig.monitoring = { enabled: true };
        break;
      case 'test':
        envConfig.logging = { level: 'error' };
        envConfig.cache = { enabled: false };
        envConfig.monitoring = { enabled: false };
        break;
    }
    
    return envConfig;
  }

  // Get configuration summary
  getSummary() {
    return {
      environment: this.get('app.environment'),
      version: this.get('app.version'),
      features: {
        enabled: Object.values(this.get('features')).filter(f => f).length,
        total: Object.keys(this.get('features')).length
      },
      services: {
        database: !!this.get('database.uri'),
        email: !!this.get('email.user'),
        monitoring: this.get('monitoring.enabled'),
        backup: this.get('backup.enabled')
      }
    };
  }
}

// Create singleton instance
const configManager = new ConfigManager();

module.exports = configManager;
