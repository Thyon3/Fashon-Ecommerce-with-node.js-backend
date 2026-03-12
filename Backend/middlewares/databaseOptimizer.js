const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class DatabaseOptimizer extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableAutoOptimization: options.enableAutoOptimization !== false,
      optimizationInterval: options.optimizationInterval || 24 * 60 * 60 * 1000, // 24 hours
      enableIndexAnalysis: options.enableIndexAnalysis !== false,
      enableQueryOptimization: options.enableQueryOptimization !== false,
      enableConnectionPooling: options.enableConnectionPooling !== false,
      maxConnections: options.maxConnections || 10,
      enableSlowQueryLogging: options.enableSlowQueryLogging !== false,
      slowQueryThreshold: options.slowQueryThreshold || 1000, // 1 second
      enableProfiling: options.enableProfiling || false,
      profilingDuration: options.profilingDuration || 30000, // 30 seconds
      enableStatistics: options.enableStatistics !== false,
      statisticsInterval: options.statisticsInterval || 60000, // 1 minute
      ...options
    };
    
    this.stats = {
      optimizations: 0,
      indexesCreated: 0,
      indexesDropped: 0,
      queriesOptimized: 0,
      slowQueries: 0,
      averageQueryTime: 0,
      totalQueries: 0,
      connectionPoolStats: {
        active: 0,
        idle: 0,
        total: 0
      }
    };
    
    this.queryTimes = [];
    this.indexUsage = new Map();
    this.slowQueries = [];
    this.connectionPool = [];
    
    this.init();
  }

  init() {
    if (this.options.enableAutoOptimization) {
      this.startAutoOptimization();
    }
    
    if (this.options.enableStatistics) {
      this.startStatisticsCollection();
    }
    
    console.log('[DATABASE_OPTIMIZER] Database optimizer initialized');
  }

  startAutoOptimization() {
    setInterval(async () => {
      try {
        await this.performOptimization();
      } catch (error) {
        console.error('[DATABASE_OPTIMIZER] Auto optimization failed:', error);
      }
    }, this.options.optimizationInterval);
  }

  startStatisticsCollection() {
    setInterval(async () => {
      try {
        await this.collectStatistics();
      } catch (error) {
        console.error('[DATABASE_OPTIMIZER] Statistics collection failed:', error);
      }
    }, this.options.statisticsInterval);
  }

  async performOptimization() {
    console.log('[DATABASE_OPTIMIZER] Starting database optimization...');
    
    const optimizationResults = {
      indexOptimization: null,
      queryOptimization: null,
      connectionOptimization: null,
      statistics: null
    };
    
    // Index optimization
    if (this.options.enableIndexAnalysis) {
      optimizationResults.indexOptimization = await this.optimizeIndexes();
    }
    
    // Query optimization
    if (this.options.enableQueryOptimization) {
      optimizationResults.queryOptimization = await this.optimizeQueries();
    }
    
    // Connection pool optimization
    if (this.options.enableConnectionPooling) {
      optimizationResults.connectionOptimization = await this.optimizeConnectionPool();
    }
    
    // Collect statistics
    if (this.options.enableStatistics) {
      optimizationResults.statistics = await this.collectStatistics();
    }
    
    this.stats.optimizations++;
    this.emit('optimization:completed', optimizationResults);
    
    console.log('[DATABASE_OPTIMIZER] Database optimization completed');
    
    return optimizationResults;
  }

  async optimizeIndexes() {
    console.log('[DATABASE_OPTIMIZER] Analyzing indexes...');
    
    const results = {
      analyzed: 0,
      created: 0,
      dropped: 0,
      recommendations: []
    };
    
    try {
      // Get collection statistics (MongoDB example)
      const collections = await this.getCollections();
      results.analyzed = collections.length;
      
      for (const collection of collections) {
        const indexAnalysis = await this.analyzeCollectionIndexes(collection);
        
        // Create recommended indexes
        for (const recommendation of indexAnalysis.recommendations) {
          if (recommendation.action === 'create') {
            await this.createIndex(collection.name, recommendation.index);
            results.created++;
            this.stats.indexesCreated++;
          } else if (recommendation.action === 'drop') {
            await this.dropIndex(collection.name, recommendation.indexName);
            results.dropped++;
            this.stats.indexesDropped++;
          }
          
          results.recommendations.push(recommendation);
        }
      }
      
    } catch (error) {
      console.error('[DATABASE_OPTIMIZER] Index optimization failed:', error);
    }
    
    return results;
  }

  async getCollections() {
    // Simulate getting collections
    // In production, use actual database driver
    return [
      { name: 'users', count: 1000, size: 1024000 },
      { name: 'products', count: 500, size: 2048000 },
      { name: 'orders', count: 2000, size: 5120000 },
      { name: 'categories', count: 50, size: 102400 }
    ];
  }

  async analyzeCollectionIndexes(collection) {
    const analysis = {
      collection: collection.name,
      currentIndexes: [],
      recommendations: [],
      unusedIndexes: [],
      missingIndexes: []
    };
    
    // Simulate index analysis
    const commonQueries = this.getCommonQueries(collection.name);
    
    // Check for missing indexes
    for (const query of commonQueries) {
      if (!this.hasIndexForQuery(collection.name, query)) {
        analysis.missingIndexes.push({
          query,
          index: query.fields,
          reason: 'Frequently queried field without index'
        });
        
        analysis.recommendations.push({
          action: 'create',
          index: query.fields,
          reason: `Improve performance for ${query.description}`
        });
      }
    }
    
    // Check for unused indexes
    const unusedIndexes = await this.getUnusedIndexes(collection.name);
    analysis.unusedIndexes = unusedIndexes;
    
    for (const unusedIndex of unusedIndexes) {
      analysis.recommendations.push({
        action: 'drop',
        indexName: unusedIndex.name,
        reason: 'Index is not being used'
      });
    }
    
    return analysis;
  }

  getCommonQueries(collectionName) {
    const queryPatterns = {
      users: [
        { fields: { email: 1 }, description: 'User login by email' },
        { fields: { 'profile.settings': 1 }, description: 'User profile settings' },
        { fields: { createdAt: 1 }, description: 'User registration date queries' }
      ],
      products: [
        { fields: { category: 1, price: 1 }, description: 'Product search by category and price' },
        { fields: { tags: 1 }, description: 'Product tag search' },
        { fields: { 'stock.quantity': 1 }, description: 'Low stock queries' }
      ],
      orders: [
        { fields: { userId: 1, createdAt: -1 }, description: 'User order history' },
        { fields: { status: 1, createdAt: -1 }, description: 'Order status queries' },
        { fields: { 'items.productId': 1 }, description: 'Product order analytics' }
      ],
      categories: [
        { fields: { parent: 1 }, description: 'Category hierarchy' },
        { fields: { name: 1 }, description: 'Category search' }
      ]
    };
    
    return queryPatterns[collectionName] || [];
  }

  hasIndexForQuery(collectionName, query) {
    // Simulate index check
    // In production, use actual database index information
    return Math.random() > 0.5; // 50% chance of having index
  }

  async getUnusedIndexes(collectionName) {
    // Simulate unused index detection
    const indexes = await this.getCollectionIndexes(collectionName);
    return indexes.filter(index => Math.random() > 0.7); // 30% chance of being unused
  }

  async getCollectionIndexes(collectionName) {
    // Simulate getting collection indexes
    return [
      { name: '_id_', fields: { _id: 1 }, usage: 100 },
      { name: 'email_1', fields: { email: 1 }, usage: 50 },
      { name: 'createdAt_-1', fields: { createdAt: -1 }, usage: 25 },
      { name: 'category_1_price_1', fields: { category: 1, price: 1 }, usage: 80 },
      { name: 'unused_index', fields: { unused: 1 }, usage: 0 }
    ];
  }

  async createIndex(collectionName, indexFields) {
    // Simulate index creation
    console.log(`[DATABASE_OPTIMIZER] Creating index on ${collectionName}:`, indexFields);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return { created: true, index: indexFields };
  }

  async dropIndex(collectionName, indexName) {
    // Simulate index dropping
    console.log(`[DATABASE_OPTIMIZER] Dropping index ${indexName} on ${collectionName}`);
    
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 50));
    
    return { dropped: true, indexName };
  }

  async optimizeQueries() {
    console.log('[DATABASE_OPTIMIZER] Optimizing queries...');
    
    const results = {
      analyzed: 0,
      optimized: 0,
      recommendations: []
    };
    
    try {
      // Get slow queries
      const slowQueries = this.getSlowQueries();
      results.analyzed = slowQueries.length;
      
      for (const query of slowQueries) {
        const optimization = await this.optimizeQuery(query);
        
        if (optimization.recommended) {
          results.optimized++;
          results.recommendations.push(optimization);
          this.stats.queriesOptimized++;
        }
      }
      
    } catch (error) {
      console.error('[DATABASE_OPTIMIZER] Query optimization failed:', error);
    }
    
    return results;
  }

  getSlowQueries() {
    // Return recent slow queries
    return this.slowQueries.slice(-10);
  }

  async optimizeQuery(query) {
    const optimization = {
      originalQuery: query.query,
      executionTime: query.executionTime,
      recommended: false,
      suggestions: []
    };
    
    // Analyze query and suggest optimizations
    if (query.executionTime > this.options.slowQueryThreshold * 2) {
      optimization.recommended = true;
      
      // Suggest adding indexes
      if (!query.hasIndex) {
        optimization.suggestions.push({
          type: 'index',
          description: 'Add index for frequently queried fields',
          fields: query.fields
        });
      }
      
      // Suggest query rewrite
      if (query.query.includes('$or') && query.query.split('$or').length > 3) {
        optimization.suggestions.push({
          type: 'rewrite',
          description: 'Consider using $in instead of multiple $or conditions'
        });
      }
      
      // Suggest aggregation pipeline optimization
      if (query.query.includes('$lookup')) {
        optimization.suggestions.push({
          type: 'aggregation',
          description: 'Optimize aggregation pipeline stages'
        });
      }
    }
    
    return optimization;
  }

  async optimizeConnectionPool() {
    console.log('[DATABASE_OPTIMIZER] Optimizing connection pool...');
    
    const results = {
      currentSize: this.connectionPool.length,
      recommendedSize: 0,
      optimizations: []
    };
    
    try {
      // Analyze connection pool usage
      const usage = this.analyzeConnectionPoolUsage();
      
      // Recommend optimal pool size
      const recommendedSize = Math.max(
        usage.peakConnections + 2,
        this.options.maxConnections
      );
      
      results.recommendedSize = recommendedSize;
      
      if (recommendedSize !== this.options.maxConnections) {
        results.optimizations.push({
          type: 'pool_size',
          current: this.options.maxConnections,
          recommended: recommendedSize,
          reason: 'Adjust pool size based on usage patterns'
        });
      }
      
      // Check for connection leaks
      if (usage.longLivedConnections > 0) {
        results.optimizations.push({
          type: 'connection_leaks',
          count: usage.longLivedConnections,
          reason: 'Detected potential connection leaks'
        });
      }
      
    } catch (error) {
      console.error('[DATABASE_OPTIMIZER] Connection pool optimization failed:', error);
    }
    
    return results;
  }

  analyzeConnectionPoolUsage() {
    // Simulate connection pool analysis
    return {
      peakConnections: Math.floor(Math.random() * this.options.maxConnections),
      averageConnections: this.options.maxConnections * 0.6,
      longLivedConnections: Math.floor(Math.random() * 3),
      connectionErrors: Math.floor(Math.random() * 2)
    };
  }

  async collectStatistics() {
    const stats = {
      timestamp: new Date().toISOString(),
      queries: {
        total: this.stats.totalQueries,
        averageTime: this.calculateAverageQueryTime(),
        slowQueries: this.stats.slowQueries
      },
      indexes: {
        total: this.stats.indexesCreated + this.stats.indexesDropped,
        created: this.stats.indexesCreated,
        dropped: this.stats.indexesDropped
      },
      connections: {
        active: this.connectionPool.filter(c => c.active).length,
        idle: this.connectionPool.filter(c => !c.active).length,
        total: this.connectionPool.length
      },
      memory: {
        used: this.getMemoryUsage(),
        cacheSize: this.getCacheSize()
      }
    };
    
    this.emit('statistics:collected', stats);
    
    return stats;
  }

  calculateAverageQueryTime() {
    if (this.queryTimes.length === 0) return 0;
    
    const sum = this.queryTimes.reduce((a, b) => a + b, 0);
    return sum / this.queryTimes.length;
  }

  getMemoryUsage() {
    // Simulate memory usage
    return {
      heap: Math.floor(Math.random() * 100000000), // 0-100MB
      cache: Math.floor(Math.random() * 50000000),   // 0-50MB
      connections: this.connectionPool.length * 1024 // 1KB per connection
    };
  }

  getCacheSize() {
    // Simulate cache size
    return Math.floor(Math.random() * 10000000); // 0-10MB
  }

  recordQuery(query, executionTime, hasIndex = false) {
    const queryRecord = {
      query,
      executionTime,
      hasIndex,
      timestamp: new Date().toISOString(),
      fields: this.extractQueryFields(query)
    };
    
    this.queryTimes.push(executionTime);
    this.stats.totalQueries++;
    
    // Keep only last 1000 query times
    if (this.queryTimes.length > 1000) {
      this.queryTimes = this.queryTimes.slice(-1000);
    }
    
    // Log slow queries
    if (executionTime > this.options.slowQueryThreshold) {
      this.slowQueries.push(queryRecord);
      this.stats.slowQueries++;
      
      // Keep only last 100 slow queries
      if (this.slowQueries.length > 100) {
        this.slowQueries = this.slowQueries.slice(-100);
      }
      
      this.emit('slow_query:detected', queryRecord);
    }
    
    if (this.options.enableSlowQueryLogging) {
      console.log(`[DATABASE_OPTIMIZER] Slow query detected: ${executionTime}ms`, query);
    }
  }

  extractQueryFields(query) {
    // Simple field extraction from query string
    // In production, use proper query parsing
    const fields = {};
    
    if (query.includes('{')) {
      const match = query.match(/\{([^}]+)\}/);
      if (match) {
        const fieldString = match[1];
        const fieldPairs = fieldString.split(',');
        
        for (const pair of fieldPairs) {
          const [field] = pair.split(':');
          if (field) {
            fields[field.trim().replace(/['"]/g, '')] = 1;
          }
        }
      }
    }
    
    return fields;
  }

  async enableProfiling(duration = this.options.profilingDuration) {
    console.log(`[DATABASE_OPTIMIZER] Enabling profiling for ${duration}ms`);
    
    // Simulate enabling database profiling
    this.emit('profiling:enabled', { duration });
    
    // Disable profiling after duration
    setTimeout(async () => {
      await this.disableProfiling();
    }, duration);
    
    return { enabled: true, duration };
  }

  async disableProfiling() {
    console.log('[DATABASE_OPTIMIZER] Disabling profiling');
    
    // Simulate disabling database profiling
    this.emit('profiling:disabled');
    
    return { disabled: true };
  }

  async getQueryPlan(query) {
    // Simulate getting query execution plan
    return {
      query,
      plan: {
        stage: 'COLLSCAN',
        index: null,
        filter: query,
        executionTime: Math.random() * 100,
        documentsExamined: Math.floor(Math.random() * 1000),
        documentsReturned: Math.floor(Math.random() * 100)
      },
      recommendations: this.getPlanRecommendations(query)
    };
  }

  getPlanRecommendations(query) {
    const recommendations = [];
    
    // Check for collection scan
    if (query.includes('{}') || !this.hasIndexForQuery('collection', { query })) {
      recommendations.push({
        type: 'index',
        description: 'Consider adding an index to avoid collection scan'
      });
    }
    
    // Check for regex queries
    if (query.includes('$regex')) {
      recommendations.push({
        type: 'regex',
        description: 'Regex queries can be slow, consider using indexed fields'
      });
    }
    
    return recommendations;
  }

  getStats() {
    return {
      ...this.stats,
      averageQueryTime: this.calculateAverageQueryTime(),
      slowQueryRate: this.stats.totalQueries > 0 
        ? (this.stats.slowQueries / this.stats.totalQueries) * 100 
        : 0,
      indexEfficiency: this.stats.indexesCreated > 0 
        ? (this.stats.indexesCreated / (this.stats.indexesCreated + this.stats.indexesDropped)) * 100 
        : 0
    };
  }

  async exportOptimizationReport() {
    const report = {
      timestamp: new Date().toISOString(),
      stats: this.getStats(),
      recentOptimizations: this.getRecentOptimizations(),
      slowQueries: this.getSlowQueries(),
      recommendations: this.getOverallRecommendations()
    };
    
    return report;
  }

  getRecentOptimizations() {
    // Simulate recent optimizations
    return [
      {
        type: 'index',
        collection: 'products',
        action: 'created',
        fields: { category: 1, price: 1 },
        timestamp: new Date(Date.now() - 3600000).toISOString()
      },
      {
        type: 'query',
        collection: 'orders',
        action: 'optimized',
        improvement: '45%',
        timestamp: new Date(Date.now() - 7200000).toISOString()
      }
    ];
  }

  getOverallRecommendations() {
    const recommendations = [];
    
    if (this.stats.slowQueries > 10) {
      recommendations.push({
        priority: 'high',
        type: 'performance',
        description: 'High number of slow queries detected, consider adding indexes'
      });
    }
    
    if (this.calculateAverageQueryTime() > 500) {
      recommendations.push({
        priority: 'medium',
        type: 'performance',
        description: 'Average query time is high, review query patterns'
      });
    }
    
    if (this.connectionPool.length > this.options.maxConnections * 0.8) {
      recommendations.push({
        priority: 'low',
        type: 'connections',
        description: 'Connection pool usage is high, consider increasing pool size'
      });
    }
    
    return recommendations;
  }

  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override database query methods to record performance
      const originalQuery = req.db?.query;
      if (originalQuery) {
        req.db.query = async (...args) => {
          const executionTime = Date.now() - startTime;
          this.recordQuery(args[0], executionTime);
          return originalQuery.apply(req.db, args);
        };
      }
      
      next();
    };
  }

  // Static method to create database optimizer
  static create(options = {}) {
    return new DatabaseOptimizer(options);
  }
}

module.exports = DatabaseOptimizer;
