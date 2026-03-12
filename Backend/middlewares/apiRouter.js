const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class APIRouter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableVersioning: options.enableVersioning !== false,
      defaultVersion: options.defaultVersion || 'v1',
      enablePrefix: options.enablePrefix !== false,
      prefix: options.prefix || '/api',
      enableDocumentation: options.enableDocumentation !== false,
      enableMetrics: options.enableMetrics !== false,
      enableCaching: options.enableCaching || false,
      enableRateLimiting: options.enableRateLimiting || false,
      enableAuthentication: options.enableAuthentication !== false,
      enableAuthorization: options.enableAuthorization || false,
      enableValidation: options.enableValidation !== false,
      enableErrorHandling: options.enableErrorHandling !== false,
      enableCORS: options.enableCORS !== false,
      enableLogging: options.enableLogging !== false,
      enableCompression: options.enableCompression || false,
      enableSecurity: options.enableSecurity !== false,
      enableMonitoring: options.enableMonitoring !== false,
      enableHealthCheck: options.enableHealthCheck !== false,
      enableMetricsEndpoint: options.enableMetricsEndpoint !== false,
      enableAPIKey: options.enableAPIKey || false,
      enableWebhooks: options.enableWebhooks || false,
      enableBatching: options.enableBatching || false,
      enablePagination: options.enablePagination !== false,
      enableSorting: options.enableSorting !== false,
      enableFiltering: options.enableFiltering !== false,
      enableSearch: options.enableSearch !== false,
      enableAggregation: options.enableAggregation || false,
      enableExport: options.enableExport || false,
      enableImport: options.enableImport || false,
      enableBulkOperations: options.enableBulkOperations || false,
      enableAsyncOperations: options.enableAsyncOperations || false,
      enableStreaming: options.enableStreaming || false,
      enableWebSocket: options.enableWebSocket || false,
      enableGraphQL: options.enableGraphQL || false,
      enableREST: options.enableREST !== false,
      ...options
    };
    
    this.routes = new Map();
    this.versions = new Map();
    this.middleware = [];
    this.globalMiddleware = [];
    this.metrics = {
      totalRoutes: 0,
      totalVersions: 0,
      totalMiddleware: 0,
      requestsByRoute: new Map(),
      requestsByVersion: new Map(),
      requestsByMethod: new Map(),
      responseTimeByRoute: new Map()
    };
    
    this.init();
  }

  init() {
    this.setupDefaultRoutes();
    this.setupDefaultMiddleware();
    
    console.log('[API_ROUTER] API router initialized');
  }

  setupDefaultRoutes() {
    // Health check endpoint
    this.addRoute('GET', '/health', {
      handler: this.healthCheckHandler.bind(this),
      middleware: [],
      version: 'v1',
      description: 'Health check endpoint',
      tags: ['system'],
      authentication: false,
      rateLimiting: false,
      caching: false,
      validation: false
    });
    
    // Metrics endpoint
    this.addRoute('GET', '/metrics', {
      handler: this.metricsHandler.bind(this),
      middleware: [],
      version: 'v1',
      description: 'API metrics endpoint',
      tags: ['system'],
      authentication: true,
      authorization: ['admin'],
      rateLimiting: true,
      caching: false,
      validation: false
    });
    
    // API documentation endpoint
    this.addRoute('GET', '/docs', {
      handler: this.docsHandler.bind(this),
      middleware: [],
      version: 'v1',
      description: 'API documentation endpoint',
      tags: ['documentation'],
      authentication: false,
      rateLimiting: false,
      caching: true,
      validation: false
    });
    
    // Version info endpoint
    this.addRoute('GET', '/version', {
      handler: this.versionHandler.bind(this),
      middleware: [],
      version: 'v1',
      description: 'API version information',
      tags: ['system'],
      authentication: false,
      rateLimiting: false,
      caching: true,
      validation: false
    });
  }

  setupDefaultMiddleware() {
    // Add default global middleware based on options
    
    if (this.options.enableCORS) {
      this.addGlobalMiddleware('cors', this.corsMiddleware.bind(this));
    }
    
    if (this.options.enableCompression) {
      this.addGlobalMiddleware('compression', this.compressionMiddleware.bind(this));
    }
    
    if (this.options.enableSecurity) {
      this.addGlobalMiddleware('security', this.securityMiddleware.bind(this));
    }
    
    if (this.options.enableLogging) {
      this.addGlobalMiddleware('logging', this.loggingMiddleware.bind(this));
    }
    
    if (this.options.enableMetrics) {
      this.addGlobalMiddleware('metrics', this.metricsMiddleware.bind(this));
    }
    
    if (this.options.enableMonitoring) {
      this.addGlobalMiddleware('monitoring', this.monitoringMiddleware.bind(this));
    }
  }

  addRoute(method, path, config) {
    const route = {
      method: method.toUpperCase(),
      path,
      handler: config.handler,
      middleware: config.middleware || [],
      version: config.version || this.options.defaultVersion,
      description: config.description || '',
      tags: config.tags || [],
      authentication: config.authentication !== false,
      authorization: config.authorization || [],
      rateLimiting: config.rateLimiting !== false,
      caching: config.caching || false,
      validation: config.validation !== false,
      pagination: config.pagination || false,
      sorting: config.sorting || false,
      filtering: config.filtering || false,
      search: config.search || false,
      aggregation: config.aggregation || false,
      export: config.export || false,
      import: config.import || false,
      bulk: config.bulk || false,
      async: config.async || false,
      streaming: config.streaming || false,
      metadata: config.metadata || {},
      addedAt: new Date().toISOString()
    };
    
    const routeKey = `${route.version}:${route.method}:${route.path}`;
    this.routes.set(routeKey, route);
    
    // Update version routes
    if (!this.versions.has(route.version)) {
      this.versions.set(route.version, new Map());
    }
    this.versions.get(route.version).set(routeKey, route);
    
    this.metrics.totalRoutes++;
    
    this.emit('route:added', route);
    
    return route;
  }

  removeRoute(method, path, version = this.options.defaultVersion) {
    const routeKey = `${version}:${method.toUpperCase()}:${path}`;
    const route = this.routes.get(routeKey);
    
    if (route) {
      this.routes.delete(routeKey);
      
      // Remove from version routes
      const versionRoutes = this.versions.get(version);
      if (versionRoutes) {
        versionRoutes.delete(routeKey);
      }
      
      this.metrics.totalRoutes--;
      
      this.emit('route:removed', route);
      
      return true;
    }
    
    return false;
  }

  addMiddleware(name, middleware) {
    this.middleware.push({ name, middleware });
    this.metrics.totalMiddleware++;
    
    console.log(`[API_ROUTER] Added middleware: ${name}`);
  }

  addGlobalMiddleware(name, middleware) {
    this.globalMiddleware.push({ name, middleware });
    
    console.log(`[API_ROUTER] Added global middleware: ${name}`);
  }

  removeMiddleware(name) {
    const index = this.middleware.findIndex(m => m.name === name);
    if (index > -1) {
      this.middleware.splice(index, 1);
      this.metrics.totalMiddleware--;
      console.log(`[API_ROUTER] Removed middleware: ${name}`);
      return true;
    }
    
    return false;
  }

  removeGlobalMiddleware(name) {
    const index = this.globalMiddleware.findIndex(m => m.name === name);
    if (index > -1) {
      this.globalMiddleware.splice(index, 1);
      console.log(`[API_ROUTER] Removed global middleware: ${name}`);
      return true;
    }
    
    return false;
  }

  async handleRequest(req, res) {
    const startTime = Date.now();
    
    try {
      // Parse request
      const parsedRequest = this.parseRequest(req);
      
      // Find matching route
      const route = this.findRoute(parsedRequest);
      
      if (!route) {
        return this.sendError(res, 404, 'Route not found');
      }
      
      // Apply global middleware
      for (const { name, middleware } of this.globalMiddleware) {
        await middleware(req, res, () => {});
      }
      
      // Apply route-specific middleware
      for (const middleware of route.middleware) {
        await middleware(req, res, () => {});
      }
      
      // Apply feature middleware based on route configuration
      await this.applyFeatureMiddleware(req, res, route);
      
      // Execute handler
      const result = await route.handler(req, res);
      
      // Send response
      this.sendResponse(res, result, route);
      
      // Update metrics
      this.updateMetrics(route, Date.now() - startTime);
      
    } catch (error) {
      this.handleError(error, req, res);
    }
  }

  parseRequest(req) {
    const url = req.url;
    const method = req.method;
    
    // Extract version from URL or header
    let version = this.options.defaultVersion;
    
    if (this.options.enableVersioning) {
      // Try to get version from URL path
      const versionMatch = url.match(/^\/api\/([^\/]+)/);
      if (versionMatch) {
        version = versionMatch[1];
      } else {
        // Try to get version from header
        version = req.get('API-Version') || req.get('Accept-Version') || this.options.defaultVersion;
      }
    }
    
    // Remove prefix and version from path
    let path = url;
    
    if (this.options.enablePrefix && path.startsWith(this.options.prefix)) {
      path = path.substring(this.options.prefix.length);
    }
    
    if (this.options.enableVersioning && path.startsWith(`/${version}`)) {
      path = path.substring(version.length + 1);
    }
    
    return {
      method,
      path,
      version,
      url,
      query: req.query,
      params: req.params,
      body: req.body,
      headers: req.headers,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent')
    };
  }

  findRoute(parsedRequest) {
    const routeKey = `${parsedRequest.version}:${parsedRequest.method}:${parsedRequest.path}`;
    
    // Exact match
    let route = this.routes.get(routeKey);
    
    if (route) {
      return route;
    }
    
    // Pattern matching (simplified)
    for (const [key, routeCandidate] of this.routes.entries()) {
      if (this.pathMatches(parsedRequest.path, routeCandidate.path) && 
          routeCandidate.method === parsedRequest.method &&
          routeCandidate.version === parsedRequest.version) {
        return routeCandidate;
      }
    }
    
    return null;
  }

  pathMatches(requestPath, routePath) {
    // Simple path matching with parameters
    // In production, use proper path-to-regexp
    
    const requestParts = requestPath.split('/').filter(p => p);
    const routeParts = routePath.split('/').filter(p => p);
    
    if (requestParts.length !== routeParts.length) {
      return false;
    }
    
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const requestPart = requestParts[i];
      
      if (routePart.startsWith(':')) {
        // Parameter match
        continue;
      } else if (routePart !== requestPart) {
        return false;
      }
    }
    
    return true;
  }

  async applyFeatureMiddleware(req, res, route) {
    // Authentication middleware
    if (route.authentication && this.options.enableAuthentication) {
      await this.authenticationMiddleware(req, res, () => {});
    }
    
    // Authorization middleware
    if (route.authorization.length > 0 && this.options.enableAuthorization) {
      await this.authorizationMiddleware(req, res, route.authorization, () => {});
    }
    
    // Rate limiting middleware
    if (route.rateLimiting && this.options.enableRateLimiting) {
      await this.rateLimitingMiddleware(req, res, () => {});
    }
    
    // Validation middleware
    if (route.validation && this.options.enableValidation) {
      await this.validationMiddleware(req, res, () => {});
    }
    
    // Caching middleware
    if (route.caching && this.options.enableCaching) {
      await this.cachingMiddleware(req, res, () => {});
    }
    
    // Pagination middleware
    if (route.pagination && this.options.enablePagination) {
      await this.paginationMiddleware(req, res, () => {});
    }
    
    // Sorting middleware
    if (route.sorting && this.options.enableSorting) {
      await this.sortingMiddleware(req, res, () => {});
    }
    
    // Filtering middleware
    if (route.filtering && this.options.enableFiltering) {
      await this.filteringMiddleware(req, res, () => {});
    }
    
    // Search middleware
    if (route.search && this.options.enableSearch) {
      await this.searchMiddleware(req, res, () => {});
    }
  }

  sendResponse(res, result, route) {
    // Add route metadata to response headers
    res.set('X-API-Version', route.version);
    res.set('X-Route', `${route.method} ${route.path}`);
    res.set('X-Response-Time', Date.now() - (result.startTime || Date.now()));
    
    // Handle different response types
    if (route.streaming && result.stream) {
      // Streaming response
      result.stream.pipe(res);
    } else if (route.export && req.query.export) {
      // Export response
      this.sendExportResponse(res, result, req.query.export);
    } else {
      // JSON response
      res.json(result);
    }
  }

  sendError(res, statusCode, message, details = null) {
    const error = {
      error: true,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
      requestId: res.get('X-Request-ID') || null
    };
    
    if (details) {
      error.details = details;
    }
    
    res.status(statusCode).json(error);
  }

  handleError(error, req, res) {
    console.error('[API_ROUTER] Request handling error:', error);
    
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    
    this.sendError(res, statusCode, message, process.env.NODE_ENV === 'development' ? error.stack : null);
  }

  // Default handlers
  async healthCheckHandler(req, res) {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: this.options.defaultVersion,
      routes: this.metrics.totalRoutes,
      middleware: this.metrics.totalMiddleware
    };
  }

  async metricsHandler(req, res) {
    return {
      metrics: this.getMetrics(),
      routes: this.getRoutes(),
      versions: this.getVersions(),
      middleware: this.getMiddleware()
    };
  }

  async docsHandler(req, res) {
    return {
      title: 'API Documentation',
      version: this.options.defaultVersion,
      baseUrl: `${req.protocol}://${req.get('host')}${this.options.prefix || ''}`,
      routes: this.getRoutes(),
      versions: this.getVersions(),
      authentication: this.options.enableAuthentication,
      rateLimiting: this.options.enableRateLimiting,
      caching: this.options.enableCaching
    };
  }

  async versionHandler(req, res) {
    return {
      version: this.options.defaultVersion,
      availableVersions: Array.from(this.versions.keys()),
      features: {
        versioning: this.options.enableVersioning,
        prefix: this.options.enablePrefix,
        documentation: this.options.enableDocumentation,
        metrics: this.options.enableMetrics,
        authentication: this.options.enableAuthentication,
        authorization: this.options.enableAuthorization,
        rateLimiting: this.options.enableRateLimiting,
        caching: this.options.enableCaching,
        validation: this.options.enableValidation,
        cors: this.options.enableCORS,
        compression: this.options.enableCompression,
        security: this.options.enableSecurity,
        monitoring: this.options.enableMonitoring,
        healthCheck: this.options.enableHealthCheck,
        metricsEndpoint: this.options.enableMetricsEndpoint
      }
    };
  }

  // Middleware implementations (simplified)
  corsMiddleware(req, res, next) {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  }

  compressionMiddleware(req, res, next) {
    // Compression logic would be implemented here
    next();
  }

  securityMiddleware(req, res, next) {
    // Security headers would be set here
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Frame-Options', 'DENY');
    res.set('X-XSS-Protection', '1; mode=block');
    next();
  }

  loggingMiddleware(req, res, next) {
    console.log(`[API_ROUTER] ${req.method} ${req.path} - ${req.ip}`);
    next();
  }

  metricsMiddleware(req, res, next) {
    // Metrics collection would be implemented here
    next();
  }

  monitoringMiddleware(req, res, next) {
    // Monitoring logic would be implemented here
    next();
  }

  authenticationMiddleware(req, res, next) {
    // Authentication logic would be implemented here
    next();
  }

  authorizationMiddleware(req, res, roles, next) {
    // Authorization logic would be implemented here
    next();
  }

  rateLimitingMiddleware(req, res, next) {
    // Rate limiting logic would be implemented here
    next();
  }

  validationMiddleware(req, res, next) {
    // Validation logic would be implemented here
    next();
  }

  cachingMiddleware(req, res, next) {
    // Caching logic would be implemented here
    next();
  }

  paginationMiddleware(req, res, next) {
    // Pagination logic would be implemented here
    next();
  }

  sortingMiddleware(req, res, next) {
    // Sorting logic would be implemented here
    next();
  }

  filteringMiddleware(req, res, next) {
    // Filtering logic would be implemented here
    next();
  }

  searchMiddleware(req, res, next) {
    // Search logic would be implemented here
    next();
  }

  updateMetrics(route, responseTime) {
    // Update route metrics
    const routeKey = `${route.version}:${route.method}:${route.path}`;
    const routeMetrics = this.metrics.requestsByRoute.get(routeKey) || { count: 0, totalTime: 0 };
    
    routeMetrics.count++;
    routeMetrics.totalTime += responseTime;
    this.metrics.requestsByRoute.set(routeKey, routeMetrics);
    
    // Update version metrics
    const versionMetrics = this.metrics.requestsByVersion.get(route.version) || 0;
    this.metrics.requestsByVersion.set(route.version, versionMetrics + 1);
    
    // Update method metrics
    const methodMetrics = this.metrics.requestsByMethod.get(route.method) || 0;
    this.metrics.requestsByMethod.set(route.method, methodMetrics + 1);
    
    // Update response time metrics
    const responseTimeMetrics = this.metrics.responseTimeByRoute.get(routeKey) || [];
    responseTimeMetrics.push(responseTime);
    this.metrics.responseTimeByRoute.set(routeKey, responseTimeMetrics);
  }

  getMetrics() {
    return {
      ...this.metrics,
      requestsByRoute: Object.fromEntries(this.metrics.requestsByRoute),
      requestsByVersion: Object.fromEntries(this.metrics.requestsByVersion),
      requestsByMethod: Object.fromEntries(this.metrics.requestsByMethod),
      averageResponseTime: this.calculateAverageResponseTime()
    };
  }

  calculateAverageResponseTime() {
    const allResponseTimes = [];
    
    for (const times of this.metrics.responseTimeByRoute.values()) {
      allResponseTimes.push(...times);
    }
    
    if (allResponseTimes.length === 0) return 0;
    
    return allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
  }

  getRoutes() {
    return Array.from(this.routes.values()).map(route => ({
      method: route.method,
      path: route.path,
      version: route.version,
      description: route.description,
      tags: route.tags,
      authentication: route.authentication,
      authorization: route.authorization,
      rateLimiting: route.rateLimiting,
      caching: route.caching,
      validation: route.validation
    }));
  }

  getVersions() {
    return {
      default: this.options.defaultVersion,
      available: Array.from(this.versions.keys()),
      routesByVersion: Object.fromEntries(
        Array.from(this.versions.entries()).map(([version, routes]) => [
          version,
          Array.from(routes.keys()).length
        ])
      )
    };
  }

  getMiddleware() {
    return {
      global: this.globalMiddleware.map(m => m.name),
      routeSpecific: this.middleware.map(m => m.name)
    };
  }

  middleware() {
    return async (req, res, next) => {
      await this.handleRequest(req, res);
    };
  }

  // Static method to create API router
  static create(options = {}) {
    return new APIRouter(options);
  }
}

module.exports = APIRouter;
