const EventEmitter = require('events');

class ConnectionPool extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxConnections: options.maxConnections || 10,
      minConnections: options.minConnections || 2,
      acquireTimeout: options.acquireTimeout || 30000, // 30 seconds
      idleTimeout: options.idleTimeout || 300000, // 5 minutes
      acquireRetryInterval: options.acquireRetryInterval || 1000, // 1 second
      maxAcquireRetries: options.maxAcquireRetries || 3,
      enableMetrics: options.enableMetrics !== false,
      enableHealthCheck: options.enableHealthCheck !== false,
      healthCheckInterval: options.healthCheckInterval || 60000, // 1 minute
      enableAutoScaling: options.enableAutoScaling || false,
      scalingThreshold: options.scalingThreshold || 0.8, // 80%
      scalingCooldown: options.scalingCooldown || 300000, // 5 minutes
      enableConnectionValidation: options.enableConnectionValidation !== false,
      enableConnectionLogging: options.enableConnectionLogging !== false,
      enableGracefulShutdown: options.enableGracefulShutdown !== false,
      shutdownTimeout: options.shutdownTimeout || 30000, // 30 seconds
      enableConnectionRecovery: options.enableConnectionRecovery || false,
      recoveryInterval: options.recoveryInterval || 5000, // 5 seconds
      enableLoadBalancing: options.enableLoadBalancing || false,
      loadBalancingStrategy: options.loadBalancingStrategy || 'round-robin',
      enableConnectionAffinity: options.enableConnectionAffinity || false,
      enableConnectionDraining: options.enableConnectionDraining || false,
      ...options
    };
    
    this.connections = new Map();
    this.availableConnections = [];
    this.activeConnections = new Map();
    this.pendingRequests = [];
    this.connectionFactory = null;
    this.connectionValidator = null;
    this.connectionDestroyer = null;
    
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      availableConnections: 0,
      pendingRequests: 0,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      connectionsAcquired: 0,
      connectionsReleased: 0,
      connectionsTimedOut: 0,
      connectionsValidated: 0,
      connectionsRecovered: 0,
      averageAcquireTime: 0,
      peakConnections: 0,
      poolUtilization: 0,
      errors: 0,
      lastError: null,
      lastScalingEvent: null
    };
    
    this.isShuttingDown = false;
    this.lastScalingTime = 0;
    this.loadBalancerIndex = 0;
    
    this.init();
  }

  init() {
    if (this.options.enableHealthCheck) {
      this.startHealthCheck();
    }
    
    if (this.options.enableAutoScaling) {
      this.startAutoScaling();
    }
    
    if (this.options.enableConnectionRecovery) {
      this.startConnectionRecovery();
    }
    
    if (this.options.enableGracefulShutdown) {
      this.setupGracefulShutdown();
    }
    
    console.log('[CONNECTION_POOL] Connection pool initialized');
  }

  setConnectionFactory(factory) {
    this.connectionFactory = factory;
  }

  setConnectionValidator(validator) {
    this.connectionValidator = validator;
  }

  setConnectionDestroyer(destroyer) {
    this.connectionDestroyer = destroyer;
  }

  async initialize() {
    if (!this.connectionFactory) {
      throw new Error('Connection factory not set');
    }
    
    const initPromises = [];
    
    // Create minimum connections
    for (let i = 0; i < this.options.minConnections; i++) {
      initPromises.push(this.createConnection());
    }
    
    await Promise.allSettled(initPromises);
    
    console.log(`[CONNECTION_POOL] Initialized with ${this.connections.size} connections`);
  }

  async createConnection() {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }
    
    const connectionId = this.generateConnectionId();
    const startTime = Date.now();
    
    try {
      const connection = await this.connectionFactory();
      
      const connectionInfo = {
        id: connectionId,
        connection,
        created: Date.now(),
        lastUsed: Date.now(),
        lastValidated: Date.now(),
        usageCount: 0,
        isValid: true,
        isAcquired: false,
        errorCount: 0
      };
      
      this.connections.set(connectionId, connectionInfo);
      this.availableConnections.push(connectionId);
      
      this.metrics.totalConnections++;
      this.metrics.availableConnections++;
      this.metrics.connectionsCreated++;
      
      if (this.connections.size > this.metrics.peakConnections) {
        this.metrics.peakConnections = this.connections.size;
      }
      
      this.updatePoolUtilization();
      
      const createTime = Date.now() - startTime;
      this.updateAverageAcquireTime(createTime);
      
      if (this.options.enableConnectionLogging) {
        console.log(`[CONNECTION_POOL] Created connection: ${connectionId} (${createTime}ms)`);
      }
      
      this.emit('connection:created', connectionInfo);
      
      return connectionId;
      
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = error.message;
      
      console.error(`[CONNECTION_POOL] Failed to create connection:`, error);
      
      this.emit('connection:create:error', error);
      
      throw error;
    }
  }

  async acquireConnection(options = {}) {
    if (this.isShuttingDown) {
      throw new Error('Pool is shutting down');
    }
    
    const startTime = Date.now();
    const timeout = options.timeout || this.options.acquireTimeout;
    const affinityKey = options.affinityKey;
    
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = this.pendingRequests.findIndex(req => req.resolve === resolve);
        if (index > -1) {
          this.pendingRequests.splice(index, 1);
          this.metrics.connectionsTimedOut++;
          reject(new Error('Connection acquire timeout'));
        }
      }, timeout);
      
      const request = {
        resolve: (connection) => {
          clearTimeout(timeoutId);
          resolve(connection);
        },
        reject: (error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        startTime,
        affinityKey
      };
      
      this.pendingRequests.push(request);
      this.metrics.pendingRequests++;
      
      this.processPendingRequests();
    });
  }

  async processPendingRequests() {
    while (this.pendingRequests.length > 0 && this.availableConnections.length > 0) {
      const request = this.pendingRequests.shift();
      this.metrics.pendingRequests--;
      
      try {
        const connectionId = this.selectConnection(request.affinityKey);
        const connectionInfo = this.connections.get(connectionId);
        
        if (!connectionInfo) {
          request.reject(new Error('Connection not found'));
          continue;
        }
        
        // Validate connection if enabled
        if (this.options.enableConnectionValidation) {
          const isValid = await this.validateConnection(connectionInfo);
          
          if (!isValid) {
            // Remove invalid connection and try to create a new one
            await this.destroyConnection(connectionId);
            
            // Try to create a new connection
            try {
              const newConnectionId = await this.createConnection();
              const newConnectionInfo = this.connections.get(newConnectionId);
              
              if (newConnectionInfo) {
                this.assignConnection(newConnectionInfo, request);
              } else {
                request.reject(new Error('Failed to create replacement connection'));
              }
            } catch (error) {
              request.reject(error);
            }
            
            continue;
          }
        }
        
        this.assignConnection(connectionInfo, request);
        
      } catch (error) {
        request.reject(error);
      }
    }
  }

  selectConnection(affinityKey) {
    if (affinityKey && this.options.enableConnectionAffinity) {
      // Try to find connection with affinity
      for (const connectionId of this.availableConnections) {
        const connectionInfo = this.connections.get(connectionId);
        if (connectionInfo && connectionInfo.affinityKey === affinityKey) {
          return connectionId;
        }
      }
    }
    
    // Apply load balancing strategy
    switch (this.options.loadBalancingStrategy) {
      case 'round-robin':
        return this.roundRobinSelection();
      case 'least-used':
        return this.leastUsedSelection();
      case 'random':
        return this.randomSelection();
      default:
        return this.availableConnections[0];
    }
  }

  roundRobinSelection() {
    const connectionId = this.availableConnections[this.loadBalancerIndex];
    this.loadBalancerIndex = (this.loadBalancerIndex + 1) % this.availableConnections.length;
    return connectionId;
  }

  leastUsedSelection() {
    let leastUsedConnectionId = this.availableConnections[0];
    let leastUsedCount = this.connections.get(leastUsedConnectionId)?.usageCount || 0;
    
    for (const connectionId of this.availableConnections) {
      const connectionInfo = this.connections.get(connectionId);
      if (connectionInfo && connectionInfo.usageCount < leastUsedCount) {
        leastUsedConnectionId = connectionId;
        leastUsedCount = connectionInfo.usageCount;
      }
    }
    
    return leastUsedConnectionId;
  }

  randomSelection() {
    const randomIndex = Math.floor(Math.random() * this.availableConnections.length);
    return this.availableConnections[randomIndex];
  }

  assignConnection(connectionInfo, request) {
    const acquireTime = Date.now() - request.startTime;
    
    // Update connection info
    connectionInfo.isAcquired = true;
    connectionInfo.lastUsed = Date.now();
    connectionInfo.usageCount++;
    
    // Remove from available connections
    const index = this.availableConnections.indexOf(connectionInfo.id);
    if (index > -1) {
      this.availableConnections.splice(index, 1);
    }
    
    // Add to active connections
    this.activeConnections.set(connectionInfo.id, {
      ...connectionInfo,
      acquireTime,
      requestStartTime: Date.now(),
      affinityKey: request.affinityKey
    });
    
    // Update metrics
    this.metrics.availableConnections--;
    this.metrics.activeConnections++;
    this.metrics.connectionsAcquired++;
    
    this.updateAverageAcquireTime(acquireTime);
    this.updatePoolUtilization();
    
    if (this.options.enableConnectionLogging) {
      console.log(`[CONNECTION_POOL] Acquired connection: ${connectionInfo.id} (${acquireTime}ms)`);
    }
    
    this.emit('connection:acquired', connectionInfo);
    
    // Resolve with connection and release function
    const release = () => this.releaseConnection(connectionInfo.id);
    request.resolve({
      connection: connectionInfo.connection,
      connectionId: connectionInfo.id,
      release
    });
  }

  async releaseConnection(connectionId) {
    const activeConnection = this.activeConnections.get(connectionId);
    
    if (!activeConnection) {
      console.warn(`[CONNECTION_POOL] Attempted to release non-active connection: ${connectionId}`);
      return;
    }
    
    const connectionInfo = this.connections.get(connectionId);
    
    if (!connectionInfo) {
      console.warn(`[CONNECTION_POOL] Connection not found for release: ${connectionId}`);
      this.activeConnections.delete(connectionId);
      return;
    }
    
    // Update connection info
    connectionInfo.isAcquired = false;
    connectionInfo.lastUsed = Date.now();
    
    // Remove from active connections
    this.activeConnections.delete(connectionId);
    
    // Add back to available connections
    this.availableConnections.push(connectionId);
    
    // Update metrics
    this.metrics.activeConnections--;
    this.metrics.availableConnections++;
    this.metrics.connectionsReleased++;
    
    this.updatePoolUtilization();
    
    if (this.options.enableConnectionLogging) {
      const usageTime = Date.now() - activeConnection.requestStartTime;
      console.log(`[CONNECTION_POOL] Released connection: ${connectionId} (${usageTime}ms)`);
    }
    
    this.emit('connection:released', connectionInfo);
    
    // Process pending requests
    this.processPendingRequests();
  }

  async validateConnection(connectionInfo) {
    if (!this.connectionValidator) {
      return true; // Assume valid if no validator
    }
    
    try {
      const isValid = await this.connectionValidator(connectionInfo.connection);
      
      connectionInfo.lastValidated = Date.now();
      connectionInfo.isValid = isValid;
      
      if (isValid) {
        this.metrics.connectionsValidated++;
      } else {
        connectionInfo.errorCount++;
      }
      
      return isValid;
      
    } catch (error) {
      connectionInfo.isValid = false;
      connectionInfo.errorCount++;
      this.metrics.errors++;
      this.metrics.lastError = error.message;
      
      console.error(`[CONNECTION_POOL] Connection validation failed:`, error);
      
      this.emit('connection:validation:error', { connectionInfo, error });
      
      return false;
    }
  }

  async destroyConnection(connectionId) {
    const connectionInfo = this.connections.get(connectionId);
    
    if (!connectionInfo) {
      return;
    }
    
    try {
      // Remove from all collections
      this.connections.delete(connectionId);
      
      const availableIndex = this.availableConnections.indexOf(connectionId);
      if (availableIndex > -1) {
        this.availableConnections.splice(availableIndex, 1);
        this.metrics.availableConnections--;
      }
      
      if (this.activeConnections.has(connectionId)) {
        this.activeConnections.delete(connectionId);
        this.metrics.activeConnections--;
      }
      
      // Destroy connection if destroyer is provided
      if (this.connectionDestroyer) {
        await this.connectionDestroyer(connectionInfo.connection);
      }
      
      // Update metrics
      this.metrics.totalConnections--;
      this.metrics.connectionsDestroyed++;
      
      this.updatePoolUtilization();
      
      if (this.options.enableConnectionLogging) {
        console.log(`[CONNECTION_POOL] Destroyed connection: ${connectionId}`);
      }
      
      this.emit('connection:destroyed', connectionInfo);
      
    } catch (error) {
      this.metrics.errors++;
      this.metrics.lastError = error.message;
      
      console.error(`[CONNECTION_POOL] Failed to destroy connection:`, error);
      
      this.emit('connection:destroy:error', { connectionInfo, error });
    }
  }

  startHealthCheck() {
    setInterval(async () => {
      await this.performHealthCheck();
    }, this.options.healthCheckInterval);
    
    console.log('[CONNECTION_POOL] Health check started');
  }

  async performHealthCheck() {
    const healthCheckPromises = [];
    
    // Check available connections
    for (const connectionId of this.availableConnections) {
      healthCheckPromises.push(this.checkConnectionHealth(connectionId));
    }
    
    await Promise.allSettled(healthCheckPromises);
  }

  async checkConnectionHealth(connectionId) {
    const connectionInfo = this.connections.get(connectionId);
    
    if (!connectionInfo) {
      return;
    }
    
    try {
      const isValid = await this.validateConnection(connectionInfo);
      
      if (!isValid) {
        await this.destroyConnection(connectionId);
      }
      
    } catch (error) {
      console.error(`[CONNECTION_POOL] Health check failed for connection ${connectionId}:`, error);
      await this.destroyConnection(connectionId);
    }
  }

  startAutoScaling() {
    setInterval(() => {
      this.checkAutoScaling();
    }, 30000); // Check every 30 seconds
    
    console.log('[CONNECTION_POOL] Auto-scaling started');
  }

  checkAutoScaling() {
    const now = Date.now();
    
    // Check cooldown period
    if (now - this.lastScalingTime < this.options.scalingCooldown) {
      return;
    }
    
    const utilization = this.metrics.poolUtilization;
    
    // Scale up if utilization is high
    if (utilization > this.options.scalingThreshold && this.connections.size < this.options.maxConnections) {
      this.scaleUp();
      this.lastScalingTime = now;
    }
    
    // Scale down if utilization is low
    if (utilization < (this.options.scalingThreshold / 2) && this.connections.size > this.options.minConnections) {
      this.scaleDown();
      this.lastScalingTime = now;
    }
  }

  async scaleUp() {
    const connectionsToAdd = Math.min(2, this.options.maxConnections - this.connections.size);
    
    console.log(`[CONNECTION_POOL] Scaling up: adding ${connectionsToAdd} connections`);
    
    const createPromises = [];
    for (let i = 0; i < connectionsToAdd; i++) {
      createPromises.push(this.createConnection());
    }
    
    await Promise.allSettled(createPromises);
    
    this.metrics.lastScalingEvent = {
      type: 'scale-up',
      connectionsAdded: connectionsToAdd,
      timestamp: Date.now()
    };
    
    this.emit('pool:scaled-up', { connectionsAdded: connectionsToAdd });
  }

  async scaleDown() {
    const connectionsToRemove = Math.min(2, this.connections.size - this.options.minConnections);
    
    console.log(`[CONNECTION_POOL] Scaling down: removing ${connectionsToRemove} connections`);
    
    // Remove idle connections
    const idleConnections = this.availableConnections
      .map(id => this.connections.get(id))
      .filter(Boolean)
      .sort((a, b) => a.lastUsed - b.lastUsed)
      .slice(0, connectionsToRemove);
    
    const destroyPromises = [];
    for (const connectionInfo of idleConnections) {
      destroyPromises.push(this.destroyConnection(connectionInfo.id));
    }
    
    await Promise.allSettled(destroyPromises);
    
    this.metrics.lastScalingEvent = {
      type: 'scale-down',
      connectionsRemoved: connectionsToRemove,
      timestamp: Date.now()
    };
    
    this.emit('pool:scaled-down', { connectionsRemoved: connectionsToRemove });
  }

  startConnectionRecovery() {
    setInterval(async () => {
      await this.recoverConnections();
    }, this.options.recoveryInterval);
    
    console.log('[CONNECTION_POOL] Connection recovery started');
  }

  async recoverConnections() {
    const targetConnections = Math.max(this.options.minConnections, this.activeConnections.size + 1);
    const connectionsNeeded = targetConnections - this.connections.size;
    
    if (connectionsNeeded > 0) {
      console.log(`[CONNECTION_POOL] Recovering ${connectionsNeeded} connections`);
      
      const createPromises = [];
      for (let i = 0; i < connectionsNeeded; i++) {
        createPromises.push(this.createConnection());
      }
      
      await Promise.allSettled(createPromises);
      
      this.metrics.connectionsRecovered += connectionsNeeded;
      
      this.emit('connections:recovered', { connectionsRecovered: connectionsNeeded });
    }
  }

  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`[CONNECTION_POOL] Received ${signal}, shutting down gracefully`);
      await this.shutdown();
      process.exit(0);
    };
    
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    console.log('[CONNECTION_POOL] Graceful shutdown setup completed');
  }

  async shutdown() {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    console.log('[CONNECTION_POOL] Starting shutdown');
    
    // Reject all pending requests
    for (const request of this.pendingRequests) {
      request.reject(new Error('Pool is shutting down'));
    }
    this.pendingRequests = [];
    
    // Wait for active connections to be released or timeout
    const shutdownStartTime = Date.now();
    
    while (this.activeConnections.size > 0 && (Date.now() - shutdownStartTime) < this.options.shutdownTimeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Force destroy remaining active connections
    for (const connectionId of this.activeConnections.keys()) {
      await this.destroyConnection(connectionId);
    }
    
    // Destroy all available connections
    for (const connectionId of this.availableConnections) {
      await this.destroyConnection(connectionId);
    }
    
    console.log('[CONNECTION_POOL] Shutdown completed');
    
    this.emit('pool:shutdown');
  }

  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  updatePoolUtilization() {
    this.metrics.poolUtilization = this.connections.size > 0 
      ? (this.activeConnections.size / this.connections.size) * 100 
      : 0;
  }

  updateAverageAcquireTime(acquireTime) {
    const totalAcquires = this.metrics.connectionsAcquired;
    const currentAverage = this.metrics.averageAcquireTime;
    
    this.metrics.averageAcquireTime = ((currentAverage * (totalAcquires - 1)) + acquireTime) / totalAcquires;
  }

  getStats() {
    return {
      ...this.metrics,
      connections: {
        total: this.connections.size,
        active: this.activeConnections.size,
        available: this.availableConnections.size,
        pending: this.pendingRequests.length
      },
      pool: {
        utilization: this.metrics.poolUtilization,
        peakConnections: this.metrics.peakConnections,
        minConnections: this.options.minConnections,
        maxConnections: this.options.maxConnections
      },
      configuration: {
        acquireTimeout: this.options.acquireTimeout,
        idleTimeout: this.options.idleTimeout,
        healthCheckInterval: this.options.healthCheckInterval,
        autoScaling: this.options.enableAutoScaling,
        loadBalancingStrategy: this.options.loadBalancingStrategy
      }
    };
  }

  getActiveConnections() {
    return Array.from(this.activeConnections.values());
  }

  getAvailableConnections() {
    return this.availableConnections.map(id => this.connections.get(id)).filter(Boolean);
  }

  // Static method to create connection pool
  static create(options = {}) {
    return new ConnectionPool(options);
  }
}

module.exports = ConnectionPool;
