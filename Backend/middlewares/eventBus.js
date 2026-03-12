const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class EventBus extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enablePersistence: options.enablePersistence || false,
      persistenceFile: options.persistenceFile || path.join(process.cwd(), 'data', 'events.json'),
      enableMetrics: options.enableMetrics !== false,
      enableEventValidation: options.enableEventValidation || false,
      enableEventFiltering: options.enableEventFiltering || false,
      enableEventTransformation: options.enableEventTransformation || false,
      enableEventReplay: options.enableEventReplay || false,
      enableEventCaching: options.enableEventCaching || false,
      enableEventBatching: options.enableEventBatching || false,
      batchSize: options.batchSize || 100,
      batchTimeout: options.batchTimeout || 5000, // 5 seconds
      enableEventPrioritization: options.enableEventPrioritization || false,
      enableEventDeduplication: options.enableEventDeduplication || false,
      deduplicationWindow: options.deduplicationWindow || 60000, // 1 minute
      enableEventRouting: options.enableEventRouting || false,
      enableEventAggregation: options.enableEventAggregation || false,
      enableEventCompression: options.enableEventCompression || false,
      enableEventEncryption: options.enableEventEncryption || false,
      encryptionKey: options.encryptionKey || null,
      enableEventLogging: options.enableEventLogging !== false,
      enableEventDebugging: options.enableEventDebugging || false,
      enableEventMonitoring: options.enableEventMonitoring || false,
      enableEventRecovery: options.enableEventRecovery || false,
      enableEventDeadLetterQueue: options.enableEventDeadLetterQueue || false,
      deadLetterQueueSize: options.deadLetterQueueSize || 1000,
      maxEventHistory: options.maxEventHistory || 10000,
      enableEventSubscriptions: options.enableEventSubscriptions !== false,
      enableEventWildcards: options.enableEventWildcards !== false,
      enableEventNamespaces: options.enableEventNamespaces || false,
      enableEventVersioning: options.enableEventVersioning || false,
      defaultEventVersion: options.defaultEventVersion || '1.0',
      ...options
    };
    
    this.eventHistory = [];
    this.eventSubscriptions = new Map();
    this.eventFilters = new Map();
    this.eventTransformers = new Map();
    this.eventRoutes = new Map();
    this.eventAggregators = new Map();
    this.deadLetterQueue = [];
    this.eventCache = new Map();
    this.eventDeduplication = new Map();
    this.eventBatches = new Map();
    this.eventMetrics = new Map();
    
    this.metrics = {
      totalEvents: 0,
      eventsByType: new Map(),
      eventsByNamespace: new Map(),
      eventsByVersion: new Map(),
      eventsProcessed: 0,
      eventsFailed: 0,
      eventsFiltered: 0,
      eventsTransformed: 0,
      eventsRerouted: 0,
      eventsAggregated: 0,
      eventsCached: 0,
      eventsDeduplicated: 0,
      eventsBatched: 0,
      eventsReplayed: 0,
      eventsInDeadLetterQueue: 0,
      averageProcessingTime: 0,
      peakEventsPerSecond: 0,
      subscriptionsActive: 0,
      filtersActive: 0,
      transformersActive: 0,
      routesActive: 0,
      aggregatorsActive: 0,
      cacheHits: 0,
      cacheMisses: 0,
      encryptionOperations: 0,
      compressionOperations: 0,
      lastEventTime: null,
      startTime: Date.now()
    };
    
    this.batchTimers = new Map();
    this.processingTimes = [];
    
    this.init();
  }

  init() {
    if (this.options.enablePersistence) {
      this.loadPersistedEvents();
    }
    
    if (this.options.enableEventBatching) {
      this.startBatchProcessing();
    }
    
    if (this.options.enableEventRecovery) {
      this.startEventRecovery();
    }
    
    if (this.options.enableEventMonitoring) {
      this.startEventMonitoring();
    }
    
    console.log('[EVENT_BUS] Event bus initialized');
  }

  async loadPersistedEvents() {
    try {
      const content = await fs.readFile(this.options.persistenceFile, 'utf8');
      const data = JSON.parse(content);
      
      if (data.events) {
        this.eventHistory = data.events.slice(-this.options.maxEventHistory);
      }
      
      if (data.metrics) {
        this.metrics.eventsByType = new Map(data.metrics.eventsByType || []);
        this.metrics.eventsByNamespace = new Map(data.metrics.eventsByNamespace || []);
        this.metrics.eventsByVersion = new Map(data.metrics.eventsByVersion || []);
      }
      
      console.log(`[EVENT_BUS] Loaded ${this.eventHistory.length} persisted events`);
    } catch (error) {
      console.log('[EVENT_BUS] No persisted events found');
    }
  }

  async persistEvents() {
    if (!this.options.enablePersistence) return;
    
    try {
      const data = {
        events: this.eventHistory,
        metrics: {
          eventsByType: Array.from(this.metrics.eventsByType.entries()),
          eventsByNamespace: Array.from(this.metrics.eventsByNamespace.entries()),
          eventsByVersion: Array.from(this.metrics.eventsByVersion.entries())
        },
        timestamp: Date.now()
      };
      
      const dataDir = path.dirname(this.options.persistenceFile);
      await fs.mkdir(dataDir, { recursive: true });
      
      await fs.writeFile(this.options.persistenceFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[EVENT_BUS] Failed to persist events:', error);
    }
  }

  emit(eventType, eventData = {}, options = {}) {
    const startTime = Date.now();
    
    try {
      const event = this.createEvent(eventType, eventData, options);
      
      // Validate event
      if (this.options.enableEventValidation && !this.validateEvent(event)) {
        throw new Error(`Event validation failed: ${eventType}`);
      }
      
      // Deduplication
      if (this.options.enableEventDeduplication && this.isDuplicateEvent(event)) {
        this.metrics.eventsDeduplicated++;
        return false;
      }
      
      // Apply filters
      if (this.options.enableEventFiltering && !this.applyEventFilters(event)) {
        this.metrics.eventsFiltered++;
        return false;
      }
      
      // Apply transformations
      if (this.options.enableEventTransformation) {
        const transformedEvent = this.applyEventTransformations(event);
        if (transformedEvent) {
          Object.assign(event, transformedEvent);
          this.metrics.eventsTransformed++;
        }
      }
      
      // Apply routing
      if (this.options.enableEventRouting) {
        const routedEvents = this.applyEventRouting(event);
        if (routedEvents.length > 0) {
          for (const routedEvent of routedEvents) {
            this.processEvent(routedEvent);
          }
          this.metrics.eventsRerouted += routedEvents.length;
          return true;
        }
      }
      
      // Process event
      this.processEvent(event);
      
      // Update metrics
      const processingTime = Date.now() - startTime;
      this.updateMetrics(event, processingTime);
      
      // Persist events
      this.persistEvents();
      
      return true;
      
    } catch (error) {
      this.metrics.eventsFailed++;
      this.handleEventError(error, eventType, eventData);
      
      if (this.options.enableEventDeadLetterQueue) {
        this.addToDeadLetterQueue(eventType, eventData, error);
      }
      
      return false;
    }
  }

  createEvent(eventType, eventData, options) {
    const event = {
      id: this.generateEventId(),
      type: eventType,
      data: eventData,
      timestamp: Date.now(),
      version: options.version || this.options.defaultEventVersion,
      namespace: options.namespace || 'default',
      priority: options.priority || 'normal',
      source: options.source || 'unknown',
      correlationId: options.correlationId || null,
      causationId: options.causationId || null,
      metadata: options.metadata || {},
      headers: options.headers || {}
    };
    
    // Add encryption if enabled
    if (this.options.enableEventEncryption && this.options.encryptionKey) {
      event.data = this.encryptData(event.data);
      event.encrypted = true;
    }
    
    // Add compression if enabled
    if (this.options.enableEventCompression) {
      event.data = this.compressData(event.data);
      event.compressed = true;
    }
    
    return event;
  }

  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  validateEvent(event) {
    if (!event.type || typeof event.type !== 'string') {
      return false;
    }
    
    if (!event.timestamp || typeof event.timestamp !== 'number') {
      return false;
    }
    
    if (event.version && typeof event.version !== 'string') {
      return false;
    }
    
    return true;
  }

  isDuplicateEvent(event) {
    const deduplicationKey = this.generateDeduplicationKey(event);
    const existingEvent = this.eventDeduplication.get(deduplicationKey);
    
    if (existingEvent) {
      const timeDiff = event.timestamp - existingEvent.timestamp;
      return timeDiff < this.options.deduplicationWindow;
    }
    
    this.eventDeduplication.set(deduplicationKey, event);
    
    // Clean up old deduplication entries
    this.cleanupDeduplication();
    
    return false;
  }

  generateDeduplicationKey(event) {
    const key = `${event.type}:${JSON.stringify(event.data)}:${event.correlationId || ''}`;
    return require('crypto').createHash('md5').update(key).digest('hex');
  }

  cleanupDeduplication() {
    const now = Date.now();
    const cutoffTime = now - this.options.deduplicationWindow;
    
    for (const [key, event] of this.eventDeduplication.entries()) {
      if (event.timestamp < cutoffTime) {
        this.eventDeduplication.delete(key);
      }
    }
  }

  applyEventFilters(event) {
    for (const [filterName, filter] of this.eventFilters.entries()) {
      try {
        if (!filter(event)) {
          if (this.options.enableEventLogging) {
            console.log(`[EVENT_BUS] Event filtered by ${filterName}: ${event.type}`);
          }
          return false;
        }
      } catch (error) {
        console.error(`[EVENT_BUS] Filter ${filterName} failed:`, error);
      }
    }
    
    return true;
  }

  applyEventTransformations(event) {
    let transformedEvent = null;
    
    for (const [transformerName, transformer] of this.eventTransformers.entries()) {
      try {
        const result = transformer(event);
        if (result) {
          transformedEvent = { ...transformedEvent, ...result };
        }
      } catch (error) {
        console.error(`[EVENT_BUS] Transformer ${transformerName} failed:`, error);
      }
    }
    
    return transformedEvent;
  }

  applyEventRouting(event) {
    const routedEvents = [];
    
    for (const [routeName, route] of this.eventRoutes.entries()) {
      try {
        if (route.condition(event)) {
          const routedEvent = {
            ...event,
            type: route.targetType || event.type,
            namespace: route.targetNamespace || event.namespace,
            routed: true,
            originalType: event.type,
            originalNamespace: event.namespace,
            routeName
          };
          
          routedEvents.push(routedEvent);
        }
      } catch (error) {
        console.error(`[EVENT_BUS] Route ${routeName} failed:`, error);
      }
    }
    
    return routedEvents;
  }

  processEvent(event) {
    // Add to event history
    this.eventHistory.push(event);
    
    // Limit event history size
    if (this.eventHistory.length > this.options.maxEventHistory) {
      this.eventHistory = this.eventHistory.slice(-this.options.maxEventHistory);
    }
    
    // Add to cache if enabled
    if (this.options.enableEventCaching) {
      this.eventCache.set(event.id, event);
      
      // Limit cache size
      if (this.eventCache.size > 1000) {
        const firstKey = this.eventCache.keys().next().value;
        this.eventCache.delete(firstKey);
      }
    }
    
    // Batch processing if enabled
    if (this.options.enableEventBatching) {
      this.addToBatch(event);
      return;
    }
    
    // Direct processing
    this.processEventDirect(event);
  }

  processEventDirect(event) {
    try {
      // Decrypt data if needed
      if (event.encrypted) {
        event.data = this.decryptData(event.data);
        event.encrypted = false;
      }
      
      // Decompress data if needed
      if (event.compressed) {
        event.data = this.decompressData(event.data);
        event.compressed = false;
      }
      
      // Apply aggregations
      if (this.options.enableEventAggregation) {
        this.applyEventAggregation(event);
      }
      
      // Emit to subscribers
      this.emitToSubscribers(event);
      
      // Update metrics
      this.metrics.eventsProcessed++;
      this.metrics.lastEventTime = event.timestamp;
      
      if (this.options.enableEventLogging) {
        console.log(`[EVENT_BUS] Processed event: ${event.type} (${event.id})`);
      }
      
      this.emit('event:processed', event);
      
    } catch (error) {
      this.metrics.eventsFailed++;
      this.handleEventError(error, event.type, event);
      
      if (this.options.enableEventDeadLetterQueue) {
        this.addToDeadLetterQueue(event.type, event, error);
      }
    }
  }

  addToBatch(event) {
    const batchKey = this.getBatchKey(event);
    
    if (!this.eventBatches.has(batchKey)) {
      this.eventBatches.set(batchKey, []);
    }
    
    const batch = this.eventBatches.get(batchKey);
    batch.push(event);
    
    // Start batch timer if not already running
    if (!this.batchTimers.has(batchKey)) {
      const timer = setTimeout(() => {
        this.processBatch(batchKey);
      }, this.options.batchTimeout);
      
      this.batchTimers.set(batchKey, timer);
    }
    
    // Process batch immediately if full
    if (batch.length >= this.options.batchSize) {
      this.processBatch(batchKey);
    }
    
    this.metrics.eventsBatched++;
  }

  getBatchKey(event) {
    return `${event.type}:${event.namespace}`;
  }

  processBatch(batchKey) {
    const batch = this.eventBatches.get(batchKey);
    
    if (!batch || batch.length === 0) {
      return;
    }
    
    // Clear batch timer
    if (this.batchTimers.has(batchKey)) {
      clearTimeout(this.batchTimers.get(batchKey));
      this.batchTimers.delete(batchKey);
    }
    
    // Process all events in batch
    for (const event of batch) {
      this.processEventDirect(event);
    }
    
    // Clear batch
    this.eventBatches.delete(batchKey);
    
    if (this.options.enableEventLogging) {
      console.log(`[EVENT_BUS] Processed batch: ${batchKey} (${batch.length} events)`);
    }
  }

  startBatchProcessing() {
    // Process any remaining batches every 10 seconds
    setInterval(() => {
      for (const batchKey of this.eventBatches.keys()) {
        this.processBatch(batchKey);
      }
    }, 10000);
    
    console.log('[EVENT_BUS] Batch processing started');
  }

  applyEventAggregation(event) {
    for (const [aggregatorName, aggregator] of this.eventAggregators.entries()) {
      try {
        if (aggregator.condition(event)) {
          aggregator.aggregate(event);
          this.metrics.eventsAggregated++;
        }
      } catch (error) {
        console.error(`[EVENT_BUS] Aggregator ${aggregatorName} failed:`, error);
      }
    }
  }

  emitToSubscribers(event) {
    const subscriptions = this.getMatchingSubscriptions(event);
    
    for (const subscription of subscriptions) {
      try {
        subscription.listener(event);
      } catch (error) {
        console.error(`[EVENT_BUS] Subscription ${subscription.id} failed:`, error);
      }
    }
  }

  getMatchingSubscriptions(event) {
    const matchingSubscriptions = [];
    
    for (const subscription of this.eventSubscriptions.values()) {
      if (this.subscriptionMatches(subscription, event)) {
        matchingSubscriptions.push(subscription);
      }
    }
    
    return matchingSubscriptions;
  }

  subscriptionMatches(subscription, event) {
    // Check event type
    if (subscription.eventType && subscription.eventType !== event.type) {
      // Check for wildcard
      if (this.options.enableEventWildcards && subscription.eventType.includes('*')) {
        const pattern = subscription.eventType.replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (!regex.test(event.type)) {
          return false;
        }
      } else {
        return false;
      }
    }
    
    // Check namespace
    if (subscription.namespace && subscription.namespace !== event.namespace) {
      return false;
    }
    
    // Check version
    if (subscription.version && subscription.version !== event.version) {
      return false;
    }
    
    // Check filter function
    if (subscription.filter && !subscription.filter(event)) {
      return false;
    }
    
    return true;
  }

  subscribe(eventType, listener, options = {}) {
    const subscription = {
      id: this.generateSubscriptionId(),
      eventType,
      listener,
      namespace: options.namespace || null,
      version: options.version || null,
      filter: options.filter || null,
      once: options.once || false,
      priority: options.priority || 0,
      createdAt: Date.now()
    };
    
    this.eventSubscriptions.set(subscription.id, subscription);
    this.metrics.subscriptionsActive++;
    
    if (this.options.enableEventLogging) {
      console.log(`[EVENT_BUS] Added subscription: ${subscription.id} for ${eventType}`);
    }
    
    return subscription.id;
  }

  unsubscribe(subscriptionId) {
    const subscription = this.eventSubscriptions.get(subscriptionId);
    
    if (subscription) {
      this.eventSubscriptions.delete(subscriptionId);
      this.metrics.subscriptionsActive--;
      
      if (this.options.enableEventLogging) {
        console.log(`[EVENT_BUS] Removed subscription: ${subscription.id}`);
      }
      
      return true;
    }
    
    return false;
  }

  generateSubscriptionId() {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  addFilter(name, filter) {
    this.eventFilters.set(name, filter);
    this.metrics.filtersActive++;
    
    console.log(`[EVENT_BUS] Added filter: ${name}`);
  }

  removeFilter(name) {
    if (this.eventFilters.delete(name)) {
      this.metrics.filtersActive--;
      console.log(`[EVENT_BUS] Removed filter: ${name}`);
      return true;
    }
    
    return false;
  }

  addTransformer(name, transformer) {
    this.eventTransformers.set(name, transformer);
    this.metrics.transformersActive++;
    
    console.log(`[EVENT_BUS] Added transformer: ${name}`);
  }

  removeTransformer(name) {
    if (this.eventTransformers.delete(name)) {
      this.metrics.transformersActive--;
      console.log(`[EVENT_BUS] Removed transformer: ${name}`);
      return true;
    }
    
    return false;
  }

  addRoute(name, condition, targetType, targetNamespace) {
    const route = {
      name,
      condition,
      targetType,
      targetNamespace
    };
    
    this.eventRoutes.set(name, route);
    this.metrics.routesActive++;
    
    console.log(`[EVENT_BUS] Added route: ${name}`);
  }

  removeRoute(name) {
    if (this.eventRoutes.delete(name)) {
      this.metrics.routesActive--;
      console.log(`[EVENT_BUS] Removed route: ${name}`);
      return true;
    }
    
    return false;
  }

  addAggregator(name, condition, aggregateFn) {
    const aggregator = {
      name,
      condition,
      aggregate: aggregateFn,
      events: []
    };
    
    this.eventAggregators.set(name, aggregator);
    this.metrics.aggregatorsActive++;
    
    console.log(`[EVENT_BUS] Added aggregator: ${name}`);
  }

  removeAggregator(name) {
    if (this.eventAggregators.delete(name)) {
      this.metrics.aggregatorsActive--;
      console.log(`[EVENT_BUS] Removed aggregator: ${name}`);
      return true;
    }
    
    return false;
  }

  encryptData(data) {
    // Simple encryption implementation
    // In production, use proper encryption
    const encrypted = JSON.stringify(data);
    this.metrics.encryptionOperations++;
    return encrypted;
  }

  decryptData(encryptedData) {
    // Simple decryption implementation
    // In production, use proper decryption
    const decrypted = JSON.parse(encryptedData);
    this.metrics.encryptionOperations++;
    return decrypted;
  }

  compressData(data) {
    // Simple compression implementation
    // In production, use proper compression
    const compressed = JSON.stringify(data);
    this.metrics.compressionOperations++;
    return compressed;
  }

  decompressData(compressedData) {
    // Simple decompression implementation
    // In production, use proper decompression
    const decompressed = JSON.parse(compressedData);
    this.metrics.compressionOperations++;
    return decompressed;
  }

  addToDeadLetterQueue(eventType, eventData, error) {
    const deadLetterEvent = {
      id: this.generateEventId(),
      type: eventType,
      data: eventData,
      error: error.message,
      timestamp: Date.now(),
      retryCount: 0
    };
    
    this.deadLetterQueue.push(deadLetterEvent);
    
    // Limit dead letter queue size
    if (this.deadLetterQueue.length > this.options.deadLetterQueueSize) {
      this.deadLetterQueue.shift();
    }
    
    this.metrics.eventsInDeadLetterQueue++;
    
    console.error(`[EVENT_BUS] Added to dead letter queue: ${eventType}`);
  }

  handleEventError(error, eventType, eventData) {
    console.error(`[EVENT_BUS] Event processing error:`, error);
    
    this.emit('event:error', {
      error,
      eventType,
      eventData,
      timestamp: Date.now()
    });
  }

  startEventRecovery() {
    setInterval(() => {
      this.recoverDeadLetterEvents();
    }, 30000); // Try to recover every 30 seconds
    
    console.log('[EVENT_BUS] Event recovery started');
  }

  recoverDeadLetterEvents() {
    if (this.deadLetterQueue.length === 0) {
      return;
    }
    
    const eventsToRecover = this.deadLetterQueue.splice(0, 10); // Recover 10 at a time
    
    for (const deadLetterEvent of eventsToRecover) {
      try {
        const success = this.emit(deadLetterEvent.type, deadLetterEvent.data);
        
        if (success) {
          this.metrics.eventsReplayed++;
          console.log(`[EVENT_BUS] Recovered event: ${deadLetterEvent.type}`);
        } else {
          // Put back in queue with increased retry count
          deadLetterEvent.retryCount++;
          if (deadLetterEvent.retryCount < 3) {
            this.deadLetterQueue.push(deadLetterEvent);
          }
        }
      } catch (error) {
        console.error(`[EVENT_BUS] Failed to recover event:`, error);
      }
    }
  }

  startEventMonitoring() {
    setInterval(() => {
      this.updateMonitoringMetrics();
    }, 5000); // Update every 5 seconds
    
    console.log('[EVENT_BUS] Event monitoring started');
  }

  updateMonitoringMetrics() {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    
    const recentEvents = this.eventHistory.filter(event => event.timestamp > oneSecondAgo);
    const eventsPerSecond = recentEvents.length;
    
    if (eventsPerSecond > this.metrics.peakEventsPerSecond) {
      this.metrics.peakEventsPerSecond = eventsPerSecond;
    }
  }

  updateMetrics(event, processingTime) {
    this.metrics.totalEvents++;
    
    // Update events by type
    const typeCount = this.metrics.eventsByType.get(event.type) || 0;
    this.metrics.eventsByType.set(event.type, typeCount + 1);
    
    // Update events by namespace
    const namespaceCount = this.metrics.eventsByNamespace.get(event.namespace) || 0;
    this.metrics.eventsByNamespace.set(event.namespace, namespaceCount + 1);
    
    // Update events by version
    const versionCount = this.metrics.eventsByVersion.get(event.version) || 0;
    this.metrics.eventsByVersion.set(event.version, versionCount + 1);
    
    // Update processing time
    this.processingTimes.push(processingTime);
    
    // Keep only last 1000 processing times
    if (this.processingTimes.length > 1000) {
      this.processingTimes = this.processingTimes.slice(-1000);
    }
    
    // Calculate average processing time
    this.metrics.averageProcessingTime = this.processingTimes.reduce((sum, time) => sum + time, 0) / this.processingTimes.length;
  }

  getStats() {
    return {
      ...this.metrics,
      eventsByType: Object.fromEntries(this.metrics.eventsByType),
      eventsByNamespace: Object.fromEntries(this.metrics.eventsByNamespace),
      eventsByVersion: Object.fromEntries(this.metrics.eventsByVersion),
      uptime: Date.now() - this.metrics.startTime,
      eventHistorySize: this.eventHistory.length,
      deadLetterQueueSize: this.deadLetterQueue.length,
      cacheSize: this.eventCache.size,
      pendingBatches: this.eventBatches.size,
      subscriptions: this.eventSubscriptions.size,
      filters: this.eventFilters.size,
      transformers: this.eventTransformers.size,
      routes: this.eventRoutes.size,
      aggregators: this.eventAggregators.size
    };
  }

  getRecentEvents(limit = 50) {
    return this.eventHistory.slice(-limit).reverse();
  }

  getEventsByType(eventType, limit = 50) {
    return this.eventHistory
      .filter(event => event.type === eventType)
      .slice(-limit)
      .reverse();
  }

  getDeadLetterEvents() {
    return this.deadLetterQueue.slice().reverse();
  }

  replayEvent(eventId) {
    const event = this.eventHistory.find(e => e.id === eventId);
    
    if (event) {
      return this.emit(event.type, event.data);
    }
    
    return false;
  }

  clearHistory() {
    this.eventHistory = [];
    this.eventCache.clear();
    this.deadLetterQueue = [];
    this.eventDeduplication.clear();
    
    console.log('[EVENT_BUS] Event history cleared');
  }

  // Static method to create event bus
  static create(options = {}) {
    return new EventBus(options);
  }
}

module.exports = EventBus;
