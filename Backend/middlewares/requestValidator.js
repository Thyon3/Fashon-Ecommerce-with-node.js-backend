const EventEmitter = require('events');
const Joi = require('joi');

class RequestValidator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableValidation: options.enableValidation !== false,
      strictMode: options.strictMode || false,
      enableSanitization: options.enableSanitization || false,
      enableCustomValidators: options.enableCustomValidators || false,
      customValidators: options.customValidators || {},
      enableMetrics: options.enableMetrics !== false,
      enableDetailedErrors: options.enableDetailedErrors || false,
      enableCache: options.enableCache || false,
      cacheMaxSize: options.cacheMaxSize || 1000,
      enableLogging: options.enableLogging !== false,
      logLevel: options.logLevel || 'warn',
      ...options
    };
    
    this.schemas = new Map();
    this.validators = new Map();
    this.cache = new Map();
    this.metrics = {
      totalValidations: 0,
      successfulValidations: 0,
      failedValidations: 0,
      sanitizations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      validationsByEndpoint: new Map(),
      errorsByType: new Map()
    };
    
    this.init();
  }

  init() {
    this.setupDefaultValidators();
    
    if (this.options.enableCustomValidators) {
      this.setupCustomValidators();
    }
    
    console.log('[REQUEST_VALIDATOR] Request validator initialized');
  }

  setupDefaultValidators() {
    // Common validation schemas
    this.addSchema('user', {
      id: Joi.string().uuid().optional(),
      email: Joi.string().email().required(),
      password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
      name: Joi.string().min(2).max(50).required(),
      phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).optional(),
      role: Joi.string().valid('customer', 'admin', 'manager').default('customer'),
      preferences: Joi.object().optional()
    });
    
    this.addSchema('product', {
      id: Joi.string().uuid().optional(),
      name: Joi.string().min(1).max(100).required(),
      description: Joi.string().min(10).max(1000).required(),
      price: Joi.number().positive().precision(2).required(),
      category: Joi.string().required(),
      tags: Joi.array().items(Joi.string()).optional(),
      images: Joi.array().items(Joi.string().uri()).optional(),
      inStock: Joi.boolean().default(true),
      quantity: Joi.number().integer().min(0).default(0),
      metadata: Joi.object().optional()
    });
    
    this.addSchema('order', {
      id: Joi.string().uuid().optional(),
      userId: Joi.string().uuid().required(),
      items: Joi.array().items(Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().positive().precision(2).required()
      })).min(1).required(),
      shippingAddress: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required()
      }).required(),
      paymentMethod: Joi.string().required(),
      status: Joi.string().valid('pending', 'confirmed', 'shipped', 'delivered', 'cancelled').default('pending'),
      total: Joi.number().positive().precision(2).required()
    });
    
    this.addSchema('review', {
      id: Joi.string().uuid().optional(),
      productId: Joi.string().uuid().required(),
      userId: Joi.string().uuid().required(),
      rating: Joi.number().integer().min(1).max(5).required(),
      title: Joi.string().min(1).max(100).required(),
      content: Joi.string().min(10).max(1000).required(),
      images: Joi.array().items(Joi.string().uri()).optional(),
      verified: Joi.boolean().default(false),
      helpful: Joi.number().integer().min(0).default(0)
    });
    
    this.addSchema('category', {
      id: Joi.string().uuid().optional(),
      name: Joi.string().min(1).max(50).required(),
      description: Joi.string().max(500).optional(),
      parent: Joi.string().uuid().optional(),
      image: Joi.string().uri().optional(),
      metadata: Joi.object().optional()
    });
    
    this.addSchema('cart', {
      userId: Joi.string().uuid().required(),
      items: Joi.array().items(Joi.object({
        productId: Joi.string().uuid().required(),
        quantity: Joi.number().integer().min(1).required(),
        addedAt: Joi.date().default(() => new Date())
      })).optional()
    });
    
    this.addSchema('payment', {
      orderId: Joi.string().uuid().required(),
      amount: Joi.number().positive().precision(2).required(),
      method: Joi.string().valid('credit_card', 'debit_card', 'paypal', 'stripe', 'apple_pay', 'google_pay').required(),
      currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD', 'AUD').default('USD'),
      cardDetails: Joi.when('method', {
        is: Joi.string().valid('credit_card', 'debit_card'),
        then: Joi.object({
          number: Joi.string().pattern(/^[0-9]{16}$/).required(),
          expiryMonth: Joi.number().integer().min(1).max(12).required(),
          expiryYear: Joi.number().integer().min(new Date().getFullYear()).required(),
          cvv: Joi.string().pattern(/^[0-9]{3,4}$/).required(),
          holderName: Joi.string().min(2).max(50).required()
        }).required(),
        otherwise: Joi.forbidden()
      }),
      billingAddress: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
        country: Joi.string().required()
      }).optional()
    });
  }

  setupCustomValidators() {
    // Add custom validation functions
    this.addValidator('uniqueEmail', async (value, helpers) => {
      // Simulate database check
      const isUnique = Math.random() > 0.1; // 90% chance of being unique
      
      if (!isUnique) {
        return helpers.error('custom.uniqueEmail');
      }
      
      return value;
    }, 'Email must be unique');
    
    this.addValidator('strongPassword', (value, helpers) => {
      const hasUpperCase = /[A-Z]/.test(value);
      const hasLowerCase = /[a-z]/.test(value);
      const hasNumbers = /\d/.test(value);
      const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(value);
      
      if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
        return helpers.error('custom.strongPassword');
      }
      
      return value;
    }, 'Password must contain uppercase, lowercase, number, and special character');
    
    this.addValidator('validPhoneNumber', (value, helpers) => {
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      const cleanPhone = value.replace(/[\s\-\(\)]/g, '');
      
      if (!phoneRegex.test(cleanPhone)) {
        return helpers.error('custom.validPhoneNumber');
      }
      
      return value;
    }, 'Invalid phone number format');
    
    this.addValidator('noHtmlTags', (value, helpers) => {
      const htmlRegex = /<[^>]*>/g;
      
      if (htmlRegex.test(value)) {
        return helpers.error('custom.noHtmlTags');
      }
      
      return value;
    }, 'HTML tags are not allowed');
    
    this.addValidator('validSlug', (value, helpers) => {
      const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
      
      if (!slugRegex.test(value)) {
        return helpers.error('custom.validSlug');
      }
      
      return value;
    }, 'Invalid slug format');
  }

  addSchema(name, schema) {
    const compiledSchema = Joi.object(schema);
    
    this.schemas.set(name, compiledSchema);
    
    console.log(`[REQUEST_VALIDATOR] Added schema: ${name}`);
  }

  addValidator(name, validator, message) {
    this.validators.set(name, { validator, message });
    
    // Add to Joi
    Joi.extend({
      type: 'string',
      messages: {
        [`string.${name}`]: message
      },
      rules: {
        [name]: {
          validate: validator,
          args: []
        }
      }
    });
  }

  validate(schemaName, data, options = {}) {
    const validationOptions = {
      abortEarly: options.abortEarly !== false,
      allowUnknown: options.allowUnknown !== false,
      stripUnknown: options.stripUnknown !== false,
      convert: options.convert !== false,
      ...options
    };
    
    const schema = this.schemas.get(schemaName);
    
    if (!schema) {
      throw new Error(`Schema '${schemaName}' not found`);
    }
    
    const startTime = Date.now();
    
    try {
      const result = schema.validate(data, validationOptions);
      const validationTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(schemaName, true, validationTime);
      
      if (result.error) {
        this.handleValidationError(schemaName, result.error, data);
        return { valid: false, error: result.error, data: null };
      }
      
      // Sanitize data if enabled
      let sanitizedData = result.value;
      if (this.options.enableSanitization) {
        sanitizedData = this.sanitizeData(sanitizedData);
        this.metrics.sanitizations++;
      }
      
      return { valid: true, error: null, data: sanitizedData };
      
    } catch (error) {
      const validationTime = Date.now() - startTime;
      
      // Update metrics
      this.updateMetrics(schemaName, false, validationTime);
      
      console.error(`[REQUEST_VALIDATOR] Validation error for schema '${schemaName}':`, error);
      
      return { valid: false, error: error.message, data: null };
    }
  }

  sanitizeData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const sanitized = Array.isArray(data) ? [] : {};
    
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string') {
        // Remove HTML tags
        sanitized[key] = value.replace(/<[^>]*>/g, '');
        
        // Trim whitespace
        sanitized[key] = sanitized[key].trim();
        
        // Escape special characters
        sanitized[key] = this.escapeHtml(sanitized[key]);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeData(value);
      } else {
        sanitized[key] = value;
      }
    }
    
    return sanitized;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  handleValidationError(schemaName, error, data) {
    const errorInfo = {
      schema: schemaName,
      errors: error.details,
      timestamp: new Date().toISOString(),
      data: this.options.enableDetailedErrors ? data : null
    };
    
    // Update error metrics
    const errorType = error.details[0]?.type || 'unknown';
    const errorCount = this.metrics.errorsByType.get(errorType) || 0;
    this.metrics.errorsByType.set(errorType, errorCount + 1);
    
    // Log error if enabled
    if (this.options.enableLogging) {
      console.warn(`[REQUEST_VALIDATOR] Validation failed for schema '${schemaName}':`, error.message);
    }
    
    // Emit event
    this.emit('validation:failed', errorInfo);
  }

  updateMetrics(schemaName, success, validationTime) {
    this.metrics.totalValidations++;
    
    if (success) {
      this.metrics.successfulValidations++;
    } else {
      this.metrics.failedValidations++;
    }
    
    // Update validations by endpoint
    const endpointCount = this.metrics.validationsByEndpoint.get(schemaName) || 0;
    this.metrics.validationsByEndpoint.set(schemaName, endpointCount + 1);
  }

  middleware(schemaName, options = {}) {
    return (req, res, next) => {
      if (!this.options.enableValidation) {
        return next();
      }
      
      // Determine what to validate
      let dataToValidate;
      let source;
      
      if (options.body !== false && req.body) {
        dataToValidate = req.body;
        source = 'body';
      } else if (options.query && req.query) {
        dataToValidate = req.query;
        source = 'query';
      } else if (options.params && req.params) {
        dataToValidate = req.params;
        source = 'params';
      } else {
        // Default to body
        dataToValidate = req.body;
        source = 'body';
      }
      
      if (!dataToValidate) {
        return next();
      }
      
      // Check cache if enabled
      const cacheKey = this.generateCacheKey(schemaName, dataToValidate);
      
      if (this.options.enableCache) {
        const cached = this.cache.get(cacheKey);
        if (cached) {
          this.metrics.cacheHits++;
          req.validatedData = cached.data;
          req.validationErrors = cached.errors;
          return next();
        }
        
        this.metrics.cacheMisses++;
      }
      
      // Perform validation
      const result = this.validate(schemaName, dataToValidate, options);
      
      if (result.valid) {
        req.validatedData = result.data;
        req.validationErrors = null;
        
        // Cache result if enabled
        if (this.options.enableCache) {
          this.cache.set(cacheKey, result);
          
          // Limit cache size
          if (this.cache.size > this.options.cacheMaxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
          }
        }
        
        next();
      } else {
        req.validatedData = null;
        req.validationErrors = result.error;
        
        const errorResponse = {
          error: 'Validation Error',
          message: 'Request validation failed',
          details: this.options.enableDetailedErrors ? result.error.details : result.error.message,
          timestamp: new Date().toISOString()
        };
        
        res.status(400).json(errorResponse);
      }
    };
  }

  generateCacheKey(schemaName, data) {
    const dataString = JSON.stringify(data);
    return `${schemaName}_${require('crypto').createHash('md5').update(dataString).digest('hex')}`;
  }

  validateBody(schemaName, options = {}) {
    return this.middleware(schemaName, { ...options, body: true });
  }

  validateQuery(schemaName, options = {}) {
    return this.middleware(schemaName, { ...options, query: true });
  }

  validateParams(schemaName, options = {}) {
    return this.middleware(schemaName, { ...options, params: true });
  }

  getSchema(name) {
    return this.schemas.get(name);
  }

  getAllSchemas() {
    return Array.from(this.schemas.keys());
  }

  getValidator(name) {
    return this.validators.get(name);
  }

  getAllValidators() {
    return Array.from(this.validators.keys());
  }

  getStats() {
    return {
      ...this.metrics,
      schemasCount: this.schemas.size,
      validatorsCount: this.validators.size,
      cacheSize: this.cache.size,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
        : 0,
      successRate: this.metrics.totalValidations > 0
        ? (this.metrics.successfulValidations / this.metrics.totalValidations) * 100
        : 0,
      validationsByEndpoint: Object.fromEntries(this.metrics.validationsByEndpoint),
      errorsByType: Object.fromEntries(this.metrics.errorsByType)
    };
  }

  clearCache() {
    this.cache.clear();
    console.log('[REQUEST_VALIDATOR] Validation cache cleared');
  }

  exportSchemas() {
    const schemas = {};
    
    for (const [name, schema] of this.schemas.entries()) {
      schemas[name] = schema.describe();
    }
    
    return schemas;
  }

  importSchemas(schemas) {
    for (const [name, schemaDescription] of Object.entries(schemas)) {
      try {
        const schema = Joi.object(schemaDescription);
        this.schemas.set(name, schema);
      } catch (error) {
        console.error(`[REQUEST_VALIDATOR] Failed to import schema '${name}':`, error);
      }
    }
    
    console.log(`[REQUEST_VALIDATOR] Imported ${Object.keys(schemas).length} schemas`);
  }

  // Static method to create request validator
  static create(options = {}) {
    return new RequestValidator(options);
  }
}

module.exports = RequestValidator;
