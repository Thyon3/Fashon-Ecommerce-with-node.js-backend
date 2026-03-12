const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class ServiceRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableAutoDiscovery: options.enableAutoDiscovery !== false,
      enableHealthChecks: options.enableHealthChecks !== false,
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      enableLoadBalancing: options.enableLoadBalancing || false,
      loadBalancingStrategy: options.loadBalancingStrategy || 'round-robin',
      enableServiceVersioning: options.enableServiceVersioning || false,
      enableMetrics: options.enableMetrics !== false,
      enablePersistence: options.enablePersistence || false,
      persistenceFile: options.persistenceFile || path.join(process.cwd(), 'data', 'services.json'),
      enableCircuitBreaker: options.enableCircuitBreaker || false,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 3,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000, // 1 minute
      enableServiceDiscovery: options.enableServiceDiscovery || false,
      discoveryProtocol: options.discoveryProtocol || 'consul',
      enableServiceMesh: options.enableServiceMesh || false,
      enableAPIVersioning: options.enableAPIVersioning || false,
      defaultAPIVersion: options.defaultAPIVersion || 'v1',
      enableServiceGroups: options.enableServiceGroups || false,
      enableServiceTags: options.enableServiceTags !== false,
      enableServiceMetadata: options.enableServiceMetadata !== false,
      enableServiceDependencies: options.enableServiceDependencies || false,
      enableServiceMetrics: options.enableServiceMetrics !== false,
      enableServiceLogging: options.enableServiceLogging !== false,
      enableServiceSecurity: options.enableServiceSecurity || false,
      enableServiceRateLimiting: options.enableServiceRateLimiting || false,
      enableServiceCaching: options.enableServiceCaching || false,
      ...options
    };
    
    this.services = new Map();
    this.serviceGroups = new Map();
    this.serviceTags = new Map();
    this.serviceDependencies = new Map();
    this.serviceMetrics = new Map();
    this.circuitBreakers = new Map();
    this.loadBalancers = new Map();
    this.healthCheckers = new Map();
    
    this.metrics = {
      totalServices: 0,
      healthyServices: 0,
      unhealthyServices: 0,
      servicesByGroup: new Map(),
      servicesByTag: new Map(),
      requestsByService: new Map(),
      responseTimeByService: new Map(),
      errorRateByService: new Map(),
      circuitBreakerTrips: 0,
      loadBalancingDecisions: 0,
      healthChecksPerformed: 0,
      servicesRegistered: 0,
      servicesUnregistered: 0,
      servicesUpdated: 0
    };
    
    this.init();
  }

  init() {
    if (this.options.enablePersistence) {
      this.loadPersistedServices();
    }
    
    if (this.options.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    if (this.options.enableAutoDiscovery) {
      this.startAutoDiscovery();
    }
    
    console.log('[SERVICE_REGISTRY] Service registry initialized');
  }

  async loadPersistedServices() {
    try {
      const content = await fs.readFile(this.options.persistenceFile, 'utf8');
      const data = JSON.parse(content);
      
      // Restore services
      if (data.services) {
        for (const [id, service] of Object.entries(data.services)) {
          this.services.set(id, {
            ...service,
            status: 'unknown', // Reset status on startup
            lastHealthCheck: null
          });
        }
      }
      
      // Restore service groups
      if (data.serviceGroups) {
        this.serviceGroups = new Map(Object.entries(data.serviceGroups));
      }
      
      // Restore service tags
      if (data.serviceTags) {
        this.serviceTags = new Map(Object.entries(data.serviceTags));
      }
      
      // Restore service dependencies
      if (data.serviceDependencies) {
        this.serviceDependencies = new Map(Object.entries(data.serviceDependencies));
      }
      
      this.metrics.totalServices = this.services.size;
      
      console.log(`[SERVICE_REGISTRY] Loaded ${this.services.size} persisted services`);
    } catch (error) {
      console.log('[SERVICE_REGISTRY] No persisted services found');
    }
  }

  async persistServices() {
    if (!this.options.enablePersistence) return;
    
    try {
      const data = {
        services: Object.fromEntries(this.services),
        serviceGroups: Object.fromEntries(this.serviceGroups),
        serviceTags: Object.fromEntries(this.serviceTags),
        serviceDependencies: Object.fromEntries(this.serviceDependencies),
        timestamp: Date.now()
      };
      
      const dataDir = path.dirname(this.options.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      await fs.writeFile(this.options.persistenceFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[SERVICE_REGISTRY] Failed to persist services:', error);
    }
  }

  startHealthChecks() {
    setInterval(() => {
      this.performHealthChecks();
    }, this.options.healthCheckInterval);
    
    console.log('[SERVICE_REGISTRY] Health checks started');
  }

  startAutoDiscovery() {
    // Auto-discovery implementation would go here
    // For now, just log that it's enabled
    console.log('[SERVICE_REGISTRY] Auto-discovery enabled');
  }

  registerService(serviceConfig) {
    const service = {
      id: serviceConfig.id || this.generateServiceId(),
      name: serviceConfig.name,
      version: serviceConfig.version || this.options.defaultAPIVersion,
      host: serviceConfig.host,
      port: serviceConfig.port,
      protocol: serviceConfig.protocol || 'http',
      path: serviceConfig.path || '',
      endpoints: serviceConfig.endpoints || [],
      healthCheck: serviceConfig.healthCheck || {
        path: '/health',
        method: 'GET',
        interval: this.options.healthCheckInterval,
        timeout: 5000,
        retries: 3
      },
      loadBalancing: serviceConfig.loadBalancing || {
        strategy: this.options.loadBalancingStrategy,
        weight: 1
      },
      circuitBreaker: serviceConfig.circuitBreaker || {
        enabled: this.options.enableCircuitBreaker,
        threshold: this.options.circuitBreakerThreshold,
        timeout: this.options.circuitBreakerTimeout
      },
      metadata: serviceConfig.metadata || {},
      tags: serviceConfig.tags || [],
      group: serviceConfig.group || 'default',
      dependencies: serviceConfig.dependencies || [],
      registeredAt: new Date().toISOString(),
      lastHealthCheck: null,
      status: 'unknown',
      consecutiveFailures: 0,
      metrics: {
        requests: 0,
        errors: 0,
        responseTime: [],
        lastRequest: null
      }
    };
    
    // Validate service configuration
    if (!this.validateServiceConfig(service)) {
      throw new Error('Invalid service configuration');
    }
    
    // Add to services map
    this.services.set(service.id, service);
    
    // Update service groups
    if (this.options.enableServiceGroups) {
      this.updateServiceGroups(service);
    }
    
    // Update service tags
    if (this.options.enableServiceTags) {
      this.updateServiceTags(service);
    }
    
    // Update service dependencies
    if (this.options.enableServiceDependencies) {
      this.updateServiceDependencies(service);
    }
    
    // Initialize circuit breaker
    if (service.circuitBreaker.enabled) {
      this.initializeCircuitBreaker(service);
    }
    
    // Initialize load balancer
    if (this.options.enableLoadBalancing) {
      this.initializeLoadBalancer(service);
    }
    
    // Initialize health checker
    if (this.options.enableHealthChecks) {
      this.initializeHealthChecker(service);
    }
    
    // Update metrics
    this.metrics.totalServices++;
    this.metrics.servicesRegistered++;
    
    // Persist services
    this.persistServices();
    
    console.log(`[SERVICE_REGISTRY] Registered service: ${service.name} (${service.id})`);
    
    this.emit('service:registered', service);
    
    return service;
  }

  generateServiceId() {
    return `svc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateServiceConfig(service) {
    if (!service.name || !service.host || !service.port) {
      return false;
    }
    
    if (typeof service.port !== 'number' || service.port < 1 || service.port > 65535) {
      return false;
    }
    
    if (!['http', 'https', 'tcp', 'udp'].includes(service.protocol)) {
      return false;
    }
    
    return true;
  }

  updateServiceGroups(service) {
    const group = this.serviceGroups.get(service.group) || new Set();
    group.add(service.id);
    this.serviceGroups.set(service.group, group);
  }

  updateServiceTags(service) {
    for (const tag of service.tags) {
      const taggedServices = this.serviceTags.get(tag) || new Set();
      taggedServices.add(service.id);
      this.serviceTags.set(tag, taggedServices);
    }
  }

  updateServiceDependencies(service) {
    this.serviceDependencies.set(service.id, new Set(service.dependencies));
  }

  initializeCircuitBreaker(service) {
    const circuitBreaker = {
      state: 'closed',
      failures: 0,
      lastFailureTime: null,
      nextAttemptTime: null,
      serviceId: service.id
    };
    
    this.circuitBreakers.set(service.id, circuitBreaker);
  }

  initializeLoadBalancer(service) {
    const loadBalancer = {
      strategy: service.loadBalancing.strategy,
      currentIndex: 0,
      weights: new Map(),
      serviceId: service.id
    };
    
    this.loadBalancers.set(service.id, loadBalancer);
  }

  initializeHealthChecker(service) {
    const healthChecker = {
      interval: service.healthCheck.interval,
      timeout: service.healthCheck.timeout,
      retries: service.healthCheck.retries,
      currentRetries: 0,
      serviceId: service.id
    };
    
    this.healthCheckers.set(service.id, healthChecker);
  }

  unregisterService(serviceId) {
    const service = this.services.get(serviceId);
    
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    
    // Remove from services map
    this.services.delete(serviceId);
    
    // Remove from service groups
    if (this.options.enableServiceGroups) {
      const group = this.serviceGroups.get(service.group);
      if (group) {
        group.delete(serviceId);
        if (group.size === 0) {
          this.serviceGroups.delete(service.group);
        }
      }
    }
    
    // Remove from service tags
    if (this.options.enableServiceTags) {
      for (const tag of service.tags) {
        const taggedServices = this.serviceTags.get(tag);
        if (taggedServices) {
          taggedServices.delete(serviceId);
          if (taggedServices.size === 0) {
            this.serviceTags.delete(tag);
          }
        }
      }
    }
    
    // Remove from service dependencies
    if (this.options.enableServiceDependencies) {
      this.serviceDependencies.delete(serviceId);
    }
    
    // Remove circuit breaker
    this.circuitBreakers.delete(serviceId);
    
    // Remove load balancer
    this.loadBalancers.delete(serviceId);
    
    // Remove health checker
    this.healthCheckers.delete(serviceId);
    
    // Update metrics
    this.metrics.totalServices--;
    this.metrics.servicesUnregistered++;
    
    // Persist services
    this.persistServices();
    
    console.log(`[SERVICE_REGISTRY] Unregistered service: ${service.name} (${serviceId})`);
    
    this.emit('service:unregistered', service);
    
    return true;
  }

  updateService(serviceId, updates) {
    const service = this.services.get(serviceId);
    
    if (!service) {
      throw new Error(`Service not found: ${serviceId}`);
    }
    
    const oldService = { ...service };
    
    // Apply updates
    Object.assign(service, updates);
    service.updatedAt = new Date().toISOString();
    
    // Re-initialize components if configuration changed
    if (updates.circuitBreaker) {
      this.initializeCircuitBreaker(service);
    }
    
    if (updates.loadBalancing) {
      this.initializeLoadBalancer(service);
    }
    
    if (updates.healthCheck) {
      this.initializeHealthChecker(service);
    }
    
    // Update metrics
    this.metrics.servicesUpdated++;
    
    // Persist services
    this.persistServices();
    
    console.log(`[SERVICE_REGISTRY] Updated service: ${service.name} (${serviceId})`);
    
    this.emit('service:updated', { oldService, newService: service });
    
    return service;
  }

  async performHealthChecks() {
    const healthCheckPromises = [];
    
    for (const [serviceId, service] of this.services.entries()) {
      healthCheckPromises.push(this.checkServiceHealth(service));
    }
    
    await Promise.allSettled(healthCheckPromises);
    
    this.metrics.healthChecksPerformed++;
  }

  async checkServiceHealth(service) {
    const healthChecker = this.healthCheckers.get(service.id);
    
    if (!healthChecker) {
      return;
    }
    
    const startTime = Date.now();
    
    try {
      const healthUrl = `${service.protocol}://${service.host}:${service.port}${service.path}${service.healthCheck.path}`;
      
      // Perform health check
      const response = await this.makeHealthCheckRequest(healthUrl, healthChecker);
      
      const responseTime = Date.now() - startTime;
      
      // Update service health status
      service.status = 'healthy';
      service.lastHealthCheck = new Date().toISOString();
      service.healthCheckResponseTime = responseTime;
      service.consecutiveFailures = 0;
      
      // Reset circuit breaker
      this.resetCircuitBreaker(service.id);
      
      this.metrics.healthyServices++;
      
      this.emit('service:healthy', service);
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Update service health status
      service.status = 'unhealthy';
      service.lastHealthCheck = new Date().toISOString();
      service.healthCheckError = error.message;
      service.consecutiveFailures++;
      service.healthCheckResponseTime = responseTime;
      
      // Trigger circuit breaker if threshold exceeded
      if (service.circuitBreaker.enabled) {
        this.triggerCircuitBreaker(service.id);
      }
      
      this.metrics.unhealthyServices++;
      
      this.emit('service:unhealthy', service);
    }
  }

  async makeHealthCheckRequest(url, healthChecker) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), healthChecker.timeout);
    
    try {
      const response = await fetch(url, {
        method: healthChecker.method || 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Health check failed: ${response.status}`);
      }
      
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  triggerCircuitBreaker(serviceId) {
    const circuitBreaker = this.circuitBreakers.get(serviceId);
    
    if (!circuitBreaker) {
      return;
    }
    
    circuitBreaker.failures++;
    circuitBreaker.lastFailureTime = Date.now();
    
    if (circuitBreaker.failures >= circuitBreaker.threshold) {
      circuitBreaker.state = 'open';
      circuitBreaker.nextAttemptTime = Date.now() + circuitBreaker.timeout;
      
      this.metrics.circuitBreakerTrips++;
      
      console.log(`[SERVICE_REGISTRY] Circuit breaker opened for service: ${serviceId}`);
      
      this.emit('circuit-breaker:opened', { serviceId, circuitBreaker });
    }
  }

  resetCircuitBreaker(serviceId) {
    const circuitBreaker = this.circuitBreakers.get(serviceId);
    
    if (!circuitBreaker) {
      return;
    }
    
    circuitBreaker.state = 'closed';
    circuitBreaker.failures = 0;
    circuitBreaker.lastFailureTime = null;
    circuitBreaker.nextAttemptTime = null;
    
    this.emit('circuit-breaker:closed', { serviceId, circuitBreaker });
  }

  getService(serviceId) {
    return this.services.get(serviceId);
  }

  getServicesByName(name) {
    return Array.from(this.services.values()).filter(service => service.name === name);
  }

  getServicesByGroup(group) {
    const groupServiceIds = this.serviceGroups.get(group);
    
    if (!groupServiceIds) {
      return [];
    }
    
    return Array.from(groupServiceIds).map(id => this.services.get(id)).filter(Boolean);
  }

  getServicesByTag(tag) {
    const taggedServiceIds = this.serviceTags.get(tag);
    
    if (!taggedServiceIds) {
      return [];
    }
    
    return Array.from(taggedServiceIds).map(id => this.services.get(id)).filter(Boolean);
  }

  getHealthyServices() {
    return Array.from(this.services.values()).filter(service => service.status === 'healthy');
  }

  getUnhealthyServices() {
    return Array.from(this.services.values()).filter(service => service.status === 'unhealthy');
  }

  getServicesByStatus(status) {
    return Array.from(this.services.values()).filter(service => service.status === status);
  }

  selectService(serviceName, options = {}) {
    const services = this.getServicesByName(serviceName);
    
    if (services.length === 0) {
      throw new Error(`No services found with name: ${serviceName}`);
    }
    
    // Filter healthy services
    const healthyServices = services.filter(service => service.status === 'healthy');
    
    if (healthyServices.length === 0) {
      throw new Error(`No healthy services found with name: ${serviceName}`);
    }
    
    // Apply circuit breaker filter
    const availableServices = healthyServices.filter(service => {
      const circuitBreaker = this.circuitBreakers.get(service.id);
      
      if (!circuitBreaker) {
        return true;
      }
      
      if (circuitBreaker.state === 'open') {
        // Check if timeout has passed
        if (Date.now() >= circuitBreaker.nextAttemptTime) {
          circuitBreaker.state = 'half-open';
          return true;
        }
        return false;
      }
      
      return true;
    });
    
    if (availableServices.length === 0) {
      throw new Error(`No available services found with name: ${serviceName}`);
    }
    
    // Apply load balancing strategy
    const selectedService = this.applyLoadBalancing(availableServices, options);
    
    this.metrics.loadBalancingDecisions++;
    
    this.emit('service:selected', selectedService);
    
    return selectedService;
  }

  applyLoadBalancing(services, options) {
    const strategy = options.strategy || this.options.loadBalancingStrategy;
    
    switch (strategy) {
      case 'round-robin':
        return this.roundRobinLoadBalancing(services);
      case 'random':
        return this.randomLoadBalancing(services);
      case 'weighted':
        return this.weightedLoadBalancing(services);
      case 'least-connections':
        return this.leastConnectionsLoadBalancing(services);
      case 'response-time':
        return this.responseTimeLoadBalancing(services);
      default:
        return this.roundRobinLoadBalancing(services);
    }
  }

  roundRobinLoadBalancing(services) {
    const service = services[0];
    const loadBalancer = this.loadBalancers.get(service.id);
    
    if (loadBalancer) {
      loadBalancer.currentIndex = (loadBalancer.currentIndex + 1) % services.length;
      return services[loadBalancer.currentIndex];
    }
    
    return services[0];
  }

  randomLoadBalancing(services) {
    const randomIndex = Math.floor(Math.random() * services.length);
    return services[randomIndex];
  }

  weightedLoadBalancing(services) {
    const totalWeight = services.reduce((sum, service) => sum + (service.loadBalancing.weight || 1), 0);
    let random = Math.random() * totalWeight;
    
    for (const service of services) {
      random -= (service.loadBalancing.weight || 1);
      if (random <= 0) {
        return service;
      }
    }
    
    return services[services.length - 1];
  }

  leastConnectionsLoadBalancing(services) {
    return services.reduce((min, service) => {
      const connections = service.metrics.requests || 0;
      const minConnections = min.metrics.requests || 0;
      return connections < minConnections ? service : min;
    });
  }

  responseTimeLoadBalancing(services) {
    return services.reduce((fastest, service) => {
      const avgResponseTime = this.getAverageResponseTime(service);
      const fastestAvgResponseTime = this.getAverageResponseTime(fastest);
      return avgResponseTime < fastestAvgResponseTime ? service : fastest;
    });
  }

  getAverageResponseTime(service) {
    const responseTimes = service.metrics.responseTime || [];
    
    if (responseTimes.length === 0) {
      return 0;
    }
    
    return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
  }

  recordServiceRequest(serviceId, responseTime, success = true) {
    const service = this.services.get(serviceId);
    
    if (!service) {
      return;
    }
    
    // Update service metrics
    service.metrics.requests++;
    service.metrics.lastRequest = new Date().toISOString();
    
    if (success) {
      service.metrics.responseTime.push(responseTime);
      
      // Keep only last 100 response times
      if (service.metrics.responseTime.length > 100) {
        service.metrics.responseTime = service.metrics.responseTime.slice(-100);
      }
    } else {
      service.metrics.errors++;
    }
    
    // Update global metrics
    const requests = this.metrics.requestsByService.get(serviceId) || 0;
    this.metrics.requestsByService.set(serviceId, requests + 1);
    
    const responseTimes = this.metrics.responseTimeByService.get(serviceId) || [];
    responseTimes.push(responseTime);
    this.metrics.responseTimeByService.set(serviceId, responseTimes);
    
    const errorRate = (service.metrics.errors / service.metrics.requests) * 100;
    this.metrics.errorRateByService.set(serviceId, errorRate);
    
    // Update circuit breaker on failure
    if (!success && service.circuitBreaker.enabled) {
      this.triggerCircuitBreaker(serviceId);
    }
    
    this.emit('service:request', { serviceId, responseTime, success });
  }

  getServiceDependencies(serviceId) {
    const dependencies = this.serviceDependencies.get(serviceId);
    
    if (!dependencies) {
      return [];
    }
    
    return Array.from(dependencies).map(depId => this.services.get(depId)).filter(Boolean);
  }

  getServiceDependents(serviceId) {
    const dependents = [];
    
    for (const [id, dependencies] of this.serviceDependencies.entries()) {
      if (dependencies.has(serviceId)) {
        const service = this.services.get(id);
        if (service) {
          dependents.push(service);
        }
      }
    }
    
    return dependents;
  }

  getStats() {
    return {
      ...this.metrics,
      servicesByGroup: Object.fromEntries(
        Array.from(this.serviceGroups.entries()).map(([group, services]) => [
          group,
          services.size
        ])
      ),
      servicesByTag: Object.fromEntries(
        Array.from(this.serviceTags.entries()).map(([tag, services]) => [
          tag,
          services.size
        ])
      ),
      requestsByService: Object.fromEntries(this.metrics.requestsByService),
      averageResponseTime: this.calculateAverageResponseTime(),
      overallErrorRate: this.calculateOverallErrorRate(),
      circuitBreakerStates: this.getCircuitBreakerStates()
    };
  }

  calculateAverageResponseTime() {
    const allResponseTimes = [];
    
    for (const responseTimes of this.metrics.responseTimeByService.values()) {
      allResponseTimes.push(...responseTimes);
    }
    
    if (allResponseTimes.length === 0) {
      return 0;
    }
    
    return allResponseTimes.reduce((sum, time) => sum + time, 0) / allResponseTimes.length;
  }

  calculateOverallErrorRate() {
    let totalRequests = 0;
    let totalErrors = 0;
    
    for (const service of this.services.values()) {
      totalRequests += service.metrics.requests;
      totalErrors += service.metrics.errors;
    }
    
    if (totalRequests === 0) {
      return 0;
    }
    
    return (totalErrors / totalRequests) * 100;
  }

  getCircuitBreakerStates() {
    const states = {};
    
    for (const [serviceId, circuitBreaker] of this.circuitBreakers.entries()) {
      states[serviceId] = {
        state: circuitBreaker.state,
        failures: circuitBreaker.failures,
        lastFailureTime: circuitBreaker.lastFailureTime,
        nextAttemptTime: circuitBreaker.nextAttemptTime
      };
    }
    
    return states;
  }

  clearMetrics() {
    this.metrics = {
      totalServices: this.services.size,
      healthyServices: 0,
      unhealthyServices: 0,
      servicesByGroup: new Map(),
      servicesByTag: new Map(),
      requestsByService: new Map(),
      responseTimeByService: new Map(),
      errorRateByService: new Map(),
      circuitBreakerTrips: 0,
      loadBalancingDecisions: 0,
      healthChecksPerformed: 0,
      servicesRegistered: 0,
      servicesUnregistered: 0,
      servicesUpdated: 0
    };
    
    // Clear service metrics
    for (const service of this.services.values()) {
      service.metrics = {
        requests: 0,
        errors: 0,
        responseTime: [],
        lastRequest: null
      };
    }
    
    console.log('[SERVICE_REGISTRY] Metrics cleared');
  }

  // Static method to create service registry
  static create(options = {}) {
    return new ServiceRegistry(options);
  }
}

module.exports = ServiceRegistry;
