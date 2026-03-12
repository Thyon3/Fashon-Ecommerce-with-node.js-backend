const EventEmitter = require('events');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

class APIGateway extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableRateLimiting: options.enableRateLimiting !== false,
      enableSecurity: options.enableSecurity !== false,
      enableCaching: options.enableCaching || false,
      enableLogging: options.enableLogging !== false,
      enableMetrics: options.enableMetrics || false,
      rateLimitWindow: options.rateLimitWindow || 15 * 60 * 1000, // 15 minutes
      rateLimitMax: options.rateLimitMax || 100,
      securityHeaders: options.securityHeaders || {},
      ...options
    };
    
    this.routes = new Map();
    this.services = new Map();
    this.middleware = [];
    this.metrics = {
      requests: 0,
      errors: 0,
      responseTime: [],
      rateLimitHits: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    
    this.init();
  }

  init() {
    console.log('[API_GATEWAY] API Gateway initialized');
    
    // Setup default middleware
    this.setupDefaultMiddleware();
  }

  setupDefaultMiddleware() {
    // Security middleware
    if (this.options.enableSecurity) {
      this.use(helmet(this.options.securityHeaders));
    }
    
    // Rate limiting middleware
    if (this.options.enableRateLimiting) {
      const limiter = rateLimit({
        windowMs: this.options.rateLimitWindow,
        max: this.options.rateLimitMax,
        message: {
          error: 'Too many requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(this.options.rateLimitWindow / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        handler: (req, res) => {
          this.metrics.rateLimitHits++;
          this.emit('rate_limit:hit', req.ip, req.path);
          res.status(429).json(limiter.message);
        }
      });
      
      this.use(limiter);
    }
    
    // Logging middleware
    if (this.options.enableLogging) {
      this.use(this.loggingMiddleware());
    }
    
    // Metrics middleware
    if (this.options.enableMetrics) {
      this.use(this.metricsMiddleware());
    }
  }

  use(middleware) {
    this.middleware.push(middleware);
  }

  loggingMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Store original end method
      const originalEnd = res.end;
      
      res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Log request
        this.emit('request:logged', {
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime,
          userAgent: req.get('User-Agent'),
          ip: req.ip,
          timestamp: new Date().toISOString()
        });
        
        // Call original end
        originalEnd.apply(this, args);
      }.bind(this);
      
      next();
    };
  }

  metricsMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Store original end method
      const originalEnd = res.end;
      
      res.end = function(...args) {
        const responseTime = Date.now() - startTime;
        
        // Update metrics
        this.metrics.requests++;
        this.metrics.responseTime.push(responseTime);
        
        // Keep only last 1000 response times
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
        }
        
        if (res.statusCode >= 400) {
          this.metrics.errors++;
        }
        
        // Add metrics to response headers
        res.set('X-Metrics-Requests', this.metrics.requests);
        res.set('X-Metrics-Errors', this.metrics.errors);
        res.set('X-Metrics-ResponseTime', responseTime);
        
        // Call original end
        originalEnd.apply(this, args);
      }.bind(this);
      
      next();
    };
  }

  registerService(name, config) {
    const service = {
      name,
      baseUrl: config.baseUrl,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      healthCheck: config.healthCheck,
      circuitBreaker: {
        enabled: config.circuitBreaker?.enabled || false,
        threshold: config.circuitBreaker?.threshold || 5,
        timeout: config.circuitBreaker?.timeout || 60000,
        state: 'closed',
        failures: 0,
        lastFailure: null
      },
      loadBalancing: {
        strategy: config.loadBalancing?.strategy || 'round-robin',
        instances: config.loadBalancing?.instances || [],
        currentIndex: 0
      },
      metadata: config.metadata || {}
    };
    
    this.services.set(name, service);
    
    console.log(`[API_GATEWAY] Registered service: ${name}`);
    
    // Start health checking if enabled
    if (service.healthCheck) {
      this.startHealthCheck(service);
    }
    
    return service;
  }

  startHealthCheck(service) {
    setInterval(async () => {
      try {
        const healthy = await this.checkServiceHealth(service);
        
        if (healthy && service.circuitBreaker.state === 'open') {
          service.circuitBreaker.state = 'closed';
          service.circuitBreaker.failures = 0;
          this.emit('circuit_breaker:closed', service.name);
        }
      } catch (error) {
        service.circuitBreaker.failures++;
        service.circuitBreaker.lastFailure = Date.now();
        
        if (service.circuitBreaker.failures >= service.circuitBreaker.threshold) {
          service.circuitBreaker.state = 'open';
          this.emit('circuit_breaker:opened', service.name);
        }
      }
    }, 30000); // Check every 30 seconds
  }

  async checkServiceHealth(service) {
    // Simulate health check
    // In production, this would make actual HTTP requests
    return Math.random() > 0.1; // 90% success rate
  }

  route(path, config) {
    const route = {
      path,
      method: config.method || 'GET',
      service: config.service,
      targetPath: config.targetPath || path,
      middleware: config.middleware || [],
      cache: config.cache || { enabled: false },
      authentication: config.authentication || { required: false },
      validation: config.validation || {},
      transformation: config.transformation || {},
      metadata: config.metadata || {}
    };
    
    this.routes.set(path, route);
    
    console.log(`[API_GATEWAY] Registered route: ${config.method} ${path} -> ${config.service}`);
    
    return route;
  }

  async handleRequest(req, res, next) {
    const route = this.findRoute(req.method, req.path);
    
    if (!route) {
      return next();
    }
    
    try {
      // Authentication
      if (route.authentication.required) {
        const authResult = await this.authenticate(req, route.authentication);
        if (!authResult.authenticated) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: authResult.message
          });
        }
        req.user = authResult.user;
      }
      
      // Validation
      if (Object.keys(route.validation).length > 0) {
        const validationResult = await this.validateRequest(req, route.validation);
        if (!validationResult.valid) {
          return res.status(400).json({
            error: 'Validation Error',
            message: validationResult.message,
            details: validationResult.errors
          });
        }
      }
      
      // Check cache
      if (route.cache.enabled) {
        const cachedResponse = await this.getCachedResponse(req, route);
        if (cachedResponse) {
          this.metrics.cacheHits++;
          return res.send(cachedResponse);
        }
        this.metrics.cacheMisses++;
      }
      
      // Circuit breaker check
      const service = this.services.get(route.service);
      if (!service) {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: `Service ${route.service} not found`
        });
      }
      
      if (service.circuitBreaker.enabled && service.circuitBreaker.state === 'open') {
        return res.status(503).json({
          error: 'Service Unavailable',
          message: `Service ${route.service} circuit breaker is open`
        });
      }
      
      // Transform request
      if (Object.keys(route.transformation.request).length > 0) {
        req = await this.transformRequest(req, route.transformation.request);
      }
      
      // Forward request to service
      const response = await this.forwardRequest(req, route, service);
      
      // Transform response
      if (Object.keys(route.transformation.response).length > 0) {
        response.data = await this.transformResponse(response.data, route.transformation.response);
      }
      
      // Cache response
      if (route.cache.enabled) {
        await this.cacheResponse(req, route, response.data);
      }
      
      // Send response
      res.status(response.status).json(response.data);
      
      this.emit('request:completed', {
        route: route.path,
        service: route.service,
        status: response.status,
        responseTime: response.responseTime
      });
      
    } catch (error) {
      this.emit('request:error', {
        route: route.path,
        service: route.service,
        error: error.message
      });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'An error occurred while processing your request'
      });
    }
  }

  findRoute(method, path) {
    for (const [routePath, route] of this.routes.entries()) {
      if (route.method === method && this.pathMatches(routePath, path)) {
        return route;
      }
    }
    return null;
  }

  pathMatches(routePath, requestPath) {
    // Simple path matching
    // In production, use proper path-to-regexp
    if (routePath === requestPath) return true;
    
    // Handle wildcard routes
    if (routePath.includes('*')) {
      const pattern = routePath.replace('*', '.*');
      const regex = new RegExp('^' + pattern + '$');
      return regex.test(requestPath);
    }
    
    return false;
  }

  async authenticate(req, authConfig) {
    // Simulate authentication
    // In production, implement proper JWT validation
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return { authenticated: false, message: 'No token provided' };
    }
    
    // Mock user data
    return {
      authenticated: true,
      user: {
        id: '123',
        email: 'user@example.com',
        role: 'user'
      }
    };
  }

  async validateRequest(req, validation) {
    // Simulate validation
    // In production, use proper validation library
    const errors = [];
    
    if (validation.body && req.body) {
      // Validate body
    }
    
    if (validation.query && req.query) {
      // Validate query parameters
    }
    
    if (validation.params && req.params) {
      // Validate path parameters
    }
    
    return {
      valid: errors.length === 0,
      message: errors.length > 0 ? 'Validation failed' : 'Validation passed',
      errors
    };
  }

  async transformRequest(req, transformation) {
    // Simulate request transformation
    // In production, implement proper transformation logic
    return req;
  }

  async transformResponse(data, transformation) {
    // Simulate response transformation
    // In production, implement proper transformation logic
    return data;
  }

  async forwardRequest(req, route, service) {
    // Simulate forwarding request to service
    // In production, use actual HTTP client
    const startTime = Date.now();
    
    // Simulate service response
    const response = {
      status: 200,
      data: {
        message: 'Response from service',
        service: service.name,
        path: route.targetPath,
        timestamp: new Date().toISOString()
      },
      responseTime: Date.now() - startTime
    };
    
    // Simulate occasional failures for circuit breaker testing
    if (Math.random() < 0.05) { // 5% failure rate
      service.circuitBreaker.failures++;
      if (service.circuitBreaker.failures >= service.circuitBreaker.threshold) {
        service.circuitBreaker.state = 'open';
      }
      throw new Error('Service temporarily unavailable');
    }
    
    return response;
  }

  async getCachedResponse(req, route) {
    // Simulate cache retrieval
    // In production, use proper caching system
    return null;
  }

  async cacheResponse(req, route, data) {
    // Simulate cache storage
    // In production, use proper caching system
  }

  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;
    
    return {
      ...this.metrics,
      averageResponseTime: avgResponseTime,
      errorRate: this.metrics.requests > 0 ? (this.metrics.errors / this.metrics.requests) * 100 : 0,
      cacheHitRate: (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
        : 0,
      services: Array.from(this.services.values()).map(service => ({
        name: service.name,
        circuitBreakerState: service.circuitBreaker.state,
        failures: service.circuitBreaker.failures
      }))
    };
  }

  getServiceStatus() {
    const services = [];
    
    for (const [name, service] of this.services.entries()) {
      services.push({
        name,
        baseUrl: service.baseUrl,
        circuitBreaker: {
          state: service.circuitBreaker.state,
          failures: service.circuitBreaker.failures,
          lastFailure: service.circuitBreaker.lastFailure
        },
        loadBalancing: {
          strategy: service.loadBalancing.strategy,
          instances: service.loadBalancing.instances.length
        },
        healthy: service.circuitBreaker.state === 'closed'
      });
    }
    
    return services;
  }

  resetCircuitBreaker(serviceName) {
    const service = this.services.get(serviceName);
    if (service) {
      service.circuitBreaker.state = 'closed';
      service.circuitBreaker.failures = 0;
      service.circuitBreaker.lastFailure = null;
      
      this.emit('circuit_breaker:reset', serviceName);
      
      console.log(`[API_GATEWAY] Circuit breaker reset for service: ${serviceName}`);
      return true;
    }
    
    return false;
  }

  middleware() {
    return (req, res, next) => {
      // Apply gateway middleware
      let index = 0;
      
      const runMiddleware = () => {
        if (index < this.middleware.length) {
          const middleware = this.middleware[index++];
          middleware(req, res, runMiddleware);
        } else {
          // Handle request through gateway
          this.handleRequest(req, res, next);
        }
      };
      
      runMiddleware();
    };
  }

  // Static method to create API gateway
  static create(options = {}) {
    return new APIGateway(options);
  }
}

module.exports = APIGateway;
