const EventEmitter = require('events');
const http = require('http');
const https = require('https');

class LoadBalancer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      strategy: options.strategy || 'round-robin', // round-robin, least-connections, weighted, ip-hash
      healthCheckInterval: options.healthCheckInterval || 30000, // 30 seconds
      healthCheckTimeout: options.healthCheckTimeout || 5000,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      enableSessionAffinity: options.enableSessionAffinity || false,
      enableHealthChecks: options.enableHealthChecks !== false,
      enableMetrics: options.enableMetrics !== false,
      circuitBreakerThreshold: options.circuitBreakerThreshold || 5,
      circuitBreakerTimeout: options.circuitBreakerTimeout || 60000,
      ...options
    };
    
    this.servers = new Map();
    this.currentIndex = 0;
    this.sessionAffinity = new Map();
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      activeConnections: 0,
      responseTime: []
    };
    
    this.init();
  }

  init() {
    if (this.options.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    console.log(`[LOAD_BALANCER] Load balancer initialized with strategy: ${this.options.strategy}`);
  }

  addServer(id, config) {
    const server = {
      id,
      host: config.host,
      port: config.port,
      protocol: config.protocol || 'http',
      weight: config.weight || 1,
      maxConnections: config.maxConnections || 1000,
      currentConnections: 0,
      healthy: true,
      lastHealthCheck: null,
      circuitBreaker: {
        state: 'closed',
        failures: 0,
        lastFailure: null
      },
      metadata: config.metadata || {},
      addedAt: new Date().toISOString()
    };
    
    this.servers.set(id, server);
    
    this.emit('server:added', server);
    console.log(`[LOAD_BALANCER] Added server: ${id} (${server.host}:${server.port})`);
    
    return server;
  }

  removeServer(id) {
    const server = this.servers.get(id);
    
    if (server) {
      this.servers.delete(id);
      
      // Clean up session affinity
      for (const [sessionId, serverId] of this.sessionAffinity.entries()) {
        if (serverId === id) {
          this.sessionAffinity.delete(sessionId);
        }
      }
      
      this.emit('server:removed', server);
      console.log(`[LOAD_BALANCER] Removed server: ${id}`);
      
      return true;
    }
    
    return false;
  }

  async selectServer(request) {
    const healthyServers = this.getHealthyServers();
    
    if (healthyServers.length === 0) {
      throw new Error('No healthy servers available');
    }
    
    let selectedServer;
    
    switch (this.options.strategy) {
      case 'round-robin':
        selectedServer = this.selectRoundRobin(healthyServers);
        break;
      case 'least-connections':
        selectedServer = this.selectLeastConnections(healthyServers);
        break;
      case 'weighted':
        selectedServer = this.selectWeighted(healthyServers);
        break;
      case 'ip-hash':
        selectedServer = this.selectIpHash(healthyServers, request);
        break;
      default:
        selectedServer = this.selectRoundRobin(healthyServers);
    }
    
    // Check session affinity
    if (this.options.enableSessionAffinity && request.sessionId) {
      const affinityServerId = this.sessionAffinity.get(request.sessionId);
      if (affinityServerId && this.servers.has(affinityServerId)) {
        const affinityServer = this.servers.get(affinityServerId);
        if (affinityServer.healthy) {
          selectedServer = affinityServer;
        }
      }
    }
    
    return selectedServer;
  }

  selectRoundRobin(servers) {
    const server = servers[this.currentIndex % servers.length];
    this.currentIndex++;
    return server;
  }

  selectLeastConnections(servers) {
    return servers.reduce((min, server) => 
      server.currentConnections < min.currentConnections ? server : min
    );
  }

  selectWeighted(servers) {
    const totalWeight = servers.reduce((sum, server) => sum + server.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const server of servers) {
      random -= server.weight;
      if (random <= 0) {
        return server;
      }
    }
    
    return servers[servers.length - 1];
  }

  selectIpHash(servers, request) {
    const clientIP = request.ip || request.connection.remoteAddress;
    const hash = this.hashString(clientIP);
    const index = hash % servers.length;
    
    return servers[index];
  }

  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  async forwardRequest(request, response, server) {
    const startTime = Date.now();
    
    try {
      // Update server connections
      server.currentConnections++;
      this.metrics.activeConnections++;
      
      // Store session affinity
      if (this.options.enableSessionAffinity && request.sessionId) {
        this.sessionAffinity.set(request.sessionId, server.id);
      }
      
      // Prepare request options
      const requestOptions = {
        hostname: server.host,
        port: server.port,
        path: request.url,
        method: request.method,
        headers: { ...request.headers },
        timeout: this.options.healthCheckTimeout
      };
      
      // Remove host header to avoid conflicts
      delete requestOptions.headers.host;
      
      // Create proxy request
      const proxy = server.protocol === 'https' ? https : http;
      
      const proxyRequest = proxy.request(requestOptions, (proxyResponse) => {
        // Copy response headers
        Object.keys(proxyResponse.headers).forEach(key => {
          response.set(key, proxyResponse.headers[key]);
        });
        
        // Set load balancer headers
        response.set('X-Load-Balancer-Server', server.id);
        response.set('X-Load-Balancer-Strategy', this.options.strategy);
        
        // Pipe response
        proxyResponse.pipe(response);
        
        // Update metrics
        const responseTime = Date.now() - startTime;
        this.metrics.responseTime.push(responseTime);
        this.metrics.successfulRequests++;
        
        // Keep only last 1000 response times
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
        }
        
        this.emit('request:completed', {
          server: server.id,
          responseTime,
          statusCode: proxyResponse.statusCode
        });
      });
      
      proxyRequest.on('error', (error) => {
        server.currentConnections--;
        this.metrics.activeConnections--;
        this.metrics.failedRequests++;
        
        // Update circuit breaker
        server.circuitBreaker.failures++;
        server.circuitBreaker.lastFailure = Date.now();
        
        if (server.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
          server.circuitBreaker.state = 'open';
          this.emit('circuit_breaker:opened', server.id);
        }
        
        this.emit('request:failed', {
          server: server.id,
          error: error.message
        });
        
        if (!response.headersSent) {
          response.status(502).json({
            error: 'Bad Gateway',
            message: 'Server error occurred'
          });
        }
      });
      
      proxyRequest.on('close', () => {
        server.currentConnections--;
        this.metrics.activeConnections--;
      });
      
      // Pipe request body
      request.pipe(proxyRequest);
      
    } catch (error) {
      server.currentConnections--;
      this.metrics.activeConnections--;
      this.metrics.failedRequests++;
      
      this.emit('request:error', {
        server: server.id,
        error: error.message
      });
      
      if (!response.headersSent) {
        response.status(500).json({
          error: 'Internal Server Error',
          message: 'Load balancer error occurred'
        });
      }
    }
  }

  getHealthyServers() {
    return Array.from(this.servers.values()).filter(server => {
      // Check if server is healthy
      if (!server.healthy) return false;
      
      // Check circuit breaker
      if (server.circuitBreaker.state === 'open') {
        // Check if circuit breaker should be half-open
        const timeSinceFailure = Date.now() - server.circuitBreaker.lastFailure;
        if (timeSinceFailure > this.options.circuitBreakerTimeout) {
          server.circuitBreaker.state = 'half-open';
          this.emit('circuit_breaker:half-open', server.id);
        } else {
          return false;
        }
      }
      
      // Check connection limit
      if (server.currentConnections >= server.maxConnections) {
        return false;
      }
      
      return true;
    });
  }

  async performHealthCheck(server) {
    try {
      const requestOptions = {
        hostname: server.host,
        port: server.port,
        path: '/health',
        method: 'GET',
        timeout: this.options.healthCheckTimeout
      };
      
      const proxy = server.protocol === 'https' ? https : http;
      
      return new Promise((resolve, reject) => {
        const req = proxy.request(requestOptions, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                healthy: true,
                statusCode: res.statusCode,
                responseTime: Date.now() - startTime,
                data: data
              });
            } else {
              resolve({
                healthy: false,
                statusCode: res.statusCode,
                responseTime: Date.now() - startTime,
                data: data
              });
            }
          });
        });
        
        req.on('error', (error) => {
          resolve({
            healthy: false,
            error: error.message,
            responseTime: Date.now() - startTime
          });
        });
        
        req.on('timeout', () => {
          req.destroy();
          resolve({
            healthy: false,
            error: 'Health check timeout',
            responseTime: Date.now() - startTime
          });
        });
        
        req.end();
      });
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  async checkServerHealth(server) {
    const startTime = Date.now();
    
    try {
      const result = await this.performHealthCheck(server);
      
      server.lastHealthCheck = new Date().toISOString();
      server.healthy = result.healthy;
      
      if (result.healthy) {
        // Reset circuit breaker on successful health check
        if (server.circuitBreaker.state === 'half-open') {
          server.circuitBreaker.state = 'closed';
          server.circuitBreaker.failures = 0;
          this.emit('circuit_breaker:closed', server.id);
        }
      } else {
        // Increment circuit breaker failures
        server.circuitBreaker.failures++;
        server.circuitBreaker.lastFailure = Date.now();
        
        if (server.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
          server.circuitBreaker.state = 'open';
          this.emit('circuit_breaker:opened', server.id);
        }
      }
      
      this.emit('health:checked', {
        server: server.id,
        healthy: result.healthy,
        responseTime: Date.now() - startTime
      });
      
      return result;
      
    } catch (error) {
      server.lastHealthCheck = new Date().toISOString();
      server.healthy = false;
      
      this.emit('health:failed', {
        server: server.id,
        error: error.message
      });
      
      return { healthy: false, error: error.message };
    }
  }

  startHealthChecks() {
    setInterval(async () => {
      for (const server of this.servers.values()) {
        await this.checkServerHealth(server);
      }
    }, this.options.healthCheckInterval);
    
    console.log('[LOAD_BALANCER] Health checks started');
  }

  getServerStats() {
    return Array.from(this.servers.values()).map(server => ({
      id: server.id,
      host: server.host,
      port: server.port,
      healthy: server.healthy,
      currentConnections: server.currentConnections,
      maxConnections: server.maxConnections,
      weight: server.weight,
      circuitBreaker: {
        state: server.circuitBreaker.state,
        failures: server.circuitBreaker.failures,
        lastFailure: server.circuitBreaker.lastFailure
      },
      lastHealthCheck: server.lastHealthCheck
    }));
  }

  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;
    
    return {
      ...this.metrics,
      averageResponseTime: avgResponseTime,
      successRate: this.metrics.totalRequests > 0 
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100 
        : 0,
      servers: {
        total: this.servers.size,
        healthy: this.getHealthyServers().length,
        unhealthy: this.servers.size - this.getHealthyServers().length
      },
      strategy: this.options.strategy
    };
  }

  resetCircuitBreaker(serverId) {
    const server = this.servers.get(serverId);
    
    if (server) {
      server.circuitBreaker.state = 'closed';
      server.circuitBreaker.failures = 0;
      server.circuitBreaker.lastFailure = null;
      
      this.emit('circuit_breaker:reset', serverId);
      
      console.log(`[LOAD_BALANCER] Circuit breaker reset for server: ${serverId}`);
      
      return true;
    }
    
    return false;
  }

  enableServer(serverId) {
    const server = this.servers.get(serverId);
    
    if (server) {
      server.healthy = true;
      this.emit('server:enabled', serverId);
      console.log(`[LOAD_BALANCER] Server enabled: ${serverId}`);
      return true;
    }
    
    return false;
  }

  disableServer(serverId) {
    const server = this.servers.get(serverId);
    
    if (server) {
      server.healthy = false;
      this.emit('server:disabled', serverId);
      console.log(`[LOAD_BALANCER] Server disabled: ${serverId}`);
      return true;
    }
    
    return false;
  }

  updateServerWeight(serverId, weight) {
    const server = this.servers.get(serverId);
    
    if (server) {
      server.weight = weight;
      this.emit('server:weight_updated', serverId, weight);
      console.log(`[LOAD_BALANCER] Server weight updated: ${serverId} -> ${weight}`);
      return true;
    }
    
    return false;
  }

  middleware() {
    return async (req, res, next) => {
      try {
        const server = await this.selectServer(req);
        
        // Store selected server in request for potential use
        req.loadBalancerServer = server;
        
        // Update request metrics
        this.metrics.totalRequests++;
        
        // Forward request to selected server
        await this.forwardRequest(req, res, server);
        
      } catch (error) {
        this.metrics.failedRequests++;
        
        if (!res.headersSent) {
          res.status(503).json({
            error: 'Service Unavailable',
            message: error.message
          });
        }
      }
    };
  }

  // Static method to create load balancer
  static create(options = {}) {
    return new LoadBalancer(options);
  }
}

module.exports = LoadBalancer;
