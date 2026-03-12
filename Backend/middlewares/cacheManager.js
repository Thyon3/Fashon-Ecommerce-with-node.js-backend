const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class CacheManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      strategy: options.strategy || 'memory', // memory, redis, file
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB
      ttl: options.ttl || 3600000, // 1 hour
      enablePersistence: options.enablePersistence || false,
      enableCompression: options.enableCompression || false,
      enableMetrics: options.enableMetrics !== false,
      enableClustering: options.enableClustering || false,
      cacheDir: options.cacheDir || path.join(process.cwd(), 'cache'),
      redis: options.redis || {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      },
      ...options
    };
    
    this.cache = new Map();
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0,
      size: 0,
      hitRate: 0
    };
    
    this.init();
  }

  async init() {
    try {
      switch (this.options.strategy) {
        case 'redis':
          await this.initRedis();
          break;
        case 'file':
          await this.initFileCache();
          break;
        default:
          this.initMemoryCache();
      }
      
      if (this.options.enablePersistence) {
        await this.loadPersistedCache();
      }
      
      console.log(`[CACHE_MANAGER] Cache manager initialized with strategy: ${this.options.strategy}`);
    } catch (error) {
      console.error('[CACHE_MANAGER] Failed to initialize:', error);
    }
  }

  initMemoryCache() {
    // Memory cache is already initialized with Map
    console.log('[CACHE_MANAGER] Using in-memory cache');
  }

  async initRedis() {
    // Simulate Redis initialization
    // In production, use actual Redis client
    console.log('[CACHE_MANAGER] Redis cache initialized');
  }

  async initFileCache() {
    try {
      await fs.mkdir(this.options.cacheDir, { recursive: true });
      console.log('[CACHE_MANAGER] File cache initialized');
    } catch (error) {
      console.error('[CACHE_MANAGER] Failed to initialize file cache:', error);
    }
  }

  async loadPersistedCache() {
    try {
      const cacheFile = path.join(this.options.cacheDir, 'cache-backup.json');
      const content = await fs.readFile(cacheFile, 'utf8');
      const data = JSON.parse(content);
      
      for (const [key, value] of Object.entries(data.cache)) {
        if (value.expiresAt && Date.now() > value.expiresAt) {
          continue; // Skip expired entries
        }
        
        this.cache.set(key, value);
      }
      
      this.metrics = data.metrics || this.metrics;
      
      console.log(`[CACHE_MANAGER] Loaded ${this.cache.size} cached entries`);
    } catch (error) {
      console.log('[CACHE_MANAGER] No persisted cache found');
    }
  }

  async persistCache() {
    if (!this.options.enablePersistence) return;
    
    try {
      const cacheData = {
        cache: Object.fromEntries(this.cache),
        metrics: this.metrics,
        timestamp: Date.now()
      };
      
      const cacheFile = path.join(this.options.cacheDir, 'cache-backup.json');
      await fs.writeFile(cacheFile, JSON.stringify(cacheData, null, 2));
    } catch (error) {
      console.error('[CACHE_MANAGER] Failed to persist cache:', error);
    }
  }

  async set(key, value, options = {}) {
    const ttl = options.ttl || this.options.ttl;
    const expiresAt = ttl > 0 ? Date.now() + ttl : null;
    
    const cacheEntry = {
      value,
      createdAt: Date.now(),
      expiresAt,
      accessCount: 0,
      lastAccessed: Date.now(),
      size: this.calculateSize(value),
      metadata: options.metadata || {}
    };
    
    // Compress if enabled and value is large enough
    if (this.options.enableCompression && cacheEntry.size > 1024) {
      cacheEntry.value = await this.compress(value);
      cacheEntry.compressed = true;
    }
    
    await this.ensureCapacity(cacheEntry.size);
    
    this.cache.set(key, cacheEntry);
    this.metrics.sets++;
    this.metrics.size += cacheEntry.size;
    
    this.emit('cache:set', key, cacheEntry);
    
    if (this.options.enablePersistence) {
      await this.persistCache();
    }
    
    return true;
  }

  async get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }
    
    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      this.metrics.misses++;
      this.updateHitRate();
      return null;
    }
    
    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Decompress if needed
    let value = entry.value;
    if (entry.compressed) {
      value = await this.decompress(value);
    }
    
    this.metrics.hits++;
    this.updateHitRate();
    
    this.emit('cache:get', key, entry);
    
    return value;
  }

  async delete(key) {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.cache.delete(key);
      this.metrics.deletes++;
      this.metrics.size -= entry.size;
      
      this.emit('cache:delete', key, entry);
      
      if (this.options.enablePersistence) {
        await this.persistCache();
      }
      
      return true;
    }
    
    return false;
  }

  async clear() {
    const cleared = this.cache.size;
    this.cache.clear();
    
    this.metrics.deletes += cleared;
    this.metrics.size = 0;
    
    this.emit('cache:cleared', cleared);
    
    if (this.options.enablePersistence) {
      await this.persistCache();
    }
    
    console.log(`[CACHE_MANAGER] Cache cleared: ${cleared} entries`);
    
    return cleared;
  }

  async ensureCapacity(requiredSize) {
    if (this.metrics.size + requiredSize <= this.options.maxSize) {
      return;
    }
    
    // Implement LRU eviction
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    let freedSpace = 0;
    
    for (const [key, entry] of entries) {
      this.cache.delete(key);
      this.metrics.size -= entry.size;
      this.metrics.evictions++;
      freedSpace += entry.size;
      
      if (this.metrics.size + requiredSize <= this.options.maxSize) {
        break;
      }
    }
    
    console.log(`[CACHE_MANAGER] Evicted ${entries.length} entries, freed ${freedSpace} bytes`);
  }

  calculateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2; // UTF-16
    } else if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    } else {
      return 8; // Approximate size for primitives
    }
  }

  async compress(data) {
    // Simulate compression
    // In production, use zlib or similar
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data);
    return Buffer.from(jsonString, 'utf8');
  }

  async decompress(data) {
    // Simulate decompression
    // In production, use zlib or similar
    if (Buffer.isBuffer(data)) {
      return data.toString('utf8');
    }
    return data;
  }

  async getMultiple(keys) {
    const results = {};
    
    for (const key of keys) {
      const value = await this.get(key);
      if (value !== null) {
        results[key] = value;
      }
    }
    
    return results;
  }

  async setMultiple(entries, options = {}) {
    const results = {};
    
    for (const [key, value] of Object.entries(entries)) {
      results[key] = await this.set(key, value, options);
    }
    
    return results;
  }

  async deleteMultiple(keys) {
    const results = {};
    
    for (const key of keys) {
      results[key] = await this.delete(key);
    }
    
    return results;
  }

  async exists(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    // Check expiration
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      await this.delete(key);
      return false;
    }
    
    return true;
  }

  async getOrSet(key, factory, options = {}) {
    let value = await this.get(key);
    
    if (value === null) {
      value = await factory();
      await this.set(key, value, options);
    }
    
    return value;
  }

  async ttl(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return -1;
    }
    
    if (!entry.expiresAt) {
      return -1;
    }
    
    const remaining = entry.expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
  }

  async expire(key, ttl) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }
    
    entry.expiresAt = Date.now() + (ttl * 1000);
    
    if (this.options.enablePersistence) {
      await this.persistCache();
    }
    
    return true;
  }

  async increment(key, amount = 1) {
    const value = await this.get(key);
    
    if (value === null) {
      await this.set(key, amount);
      return amount;
    }
    
    if (typeof value === 'number') {
      const newValue = value + amount;
      await this.set(key, newValue);
      return newValue;
    }
    
    throw new Error('Cannot increment non-numeric value');
  }

  async decrement(key, amount = 1) {
    return await this.increment(key, -amount);
  }

  getKeys(pattern = '*') {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return Array.from(this.cache.keys()).filter(key => regex.test(key));
  }

  getSize() {
    return this.cache.size;
  }

  getMemoryUsage() {
    return {
      entries: this.cache.size,
      totalSize: this.metrics.size,
      maxSize: this.options.maxSize,
      utilization: (this.metrics.size / this.options.maxSize) * 100
    };
  }

  getStats() {
    this.updateHitRate();
    
    return {
      ...this.metrics,
      entries: this.cache.size,
      memoryUsage: this.getMemoryUsage(),
      strategy: this.options.strategy
    };
  }

  updateHitRate() {
    const total = this.metrics.hits + this.metrics.misses;
    this.metrics.hitRate = total > 0 ? (this.metrics.hits / total) * 100 : 0;
  }

  async warmUp(data) {
    console.log('[CACHE_MANAGER] Starting cache warm-up...');
    
    let warmed = 0;
    
    for (const [key, value] of Object.entries(data)) {
      await this.set(key, value);
      warmed++;
    }
    
    console.log(`[CACHE_MANAGER] Cache warm-up completed: ${warmed} entries`);
    
    return warmed;
  }

  async invalidatePattern(pattern) {
    const keys = this.getKeys(pattern);
    const results = await this.deleteMultiple(keys);
    
    console.log(`[CACHE_MANAGER] Invalidated ${Object.values(results).filter(Boolean).length} entries matching pattern: ${pattern}`);
    
    return results;
  }

  async getEntryInfo(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    return {
      key,
      size: entry.size,
      createdAt: new Date(entry.createdAt).toISOString(),
      expiresAt: entry.expiresAt ? new Date(entry.expiresAt).toISOString() : null,
      accessCount: entry.accessCount,
      lastAccessed: new Date(entry.lastAccessed).toISOString(),
      compressed: entry.compressed,
      metadata: entry.metadata,
      ttl: entry.expiresAt ? Math.max(0, entry.expiresAt - Date.now()) : null
    };
  }

  async getHotKeys(limit = 10) {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        size: entry.size
      }))
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, limit);
    
    return entries;
  }

  async getColdKeys(limit = 10) {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({
        key,
        accessCount: entry.accessCount,
        lastAccessed: entry.lastAccessed,
        size: entry.size
      }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed)
      .slice(0, limit);
    
    return entries;
  }

  async cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        await this.delete(key);
        cleaned++;
      }
    }
    
    console.log(`[CACHE_MANAGER] Cleanup completed: ${cleaned} expired entries removed`);
    
    return cleaned;
  }

  async export() {
    const exportData = {
      timestamp: new Date().toISOString(),
      strategy: this.options.strategy,
      stats: this.getStats(),
      entries: {}
    };
    
    for (const [key, entry] of this.cache.entries()) {
      exportData.entries[key] = {
        value: entry.compressed ? await this.decompress(entry.value) : entry.value,
        createdAt: entry.createdAt,
        expiresAt: entry.expiresAt,
        accessCount: entry.accessCount,
        metadata: entry.metadata
      };
    }
    
    return exportData;
  }

  async import(data) {
    console.log('[CACHE_MANAGER] Starting cache import...');
    
    await this.clear();
    
    let imported = 0;
    
    for (const [key, entryData] of Object.entries(data.entries)) {
      await this.set(key, entryData.value, {
        ttl: entryData.expiresAt ? entryData.expiresAt - Date.now() : null,
        metadata: entryData.metadata
      });
      imported++;
    }
    
    console.log(`[CACHE_MANAGER] Import completed: ${imported} entries`);
    
    return imported;
  }

  middleware(options = {}) {
    const defaultTTL = options.ttl || this.options.ttl;
    const keyGenerator = options.keyGenerator || ((req) => req.originalUrl);
    
    return async (req, res, next) => {
      const cacheKey = keyGenerator(req);
      
      // Try to get from cache
      const cachedResponse = await this.get(cacheKey);
      
      if (cachedResponse) {
        res.set('X-Cache', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        return res.json(cachedResponse);
      }
      
      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data) {
        // Cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          this.set(cacheKey, data, { ttl: defaultTTL });
        }
        
        res.set('X-Cache', 'MISS');
        res.set('X-Cache-Key', cacheKey);
        
        return originalJson.call(this, data);
      }.bind(this);
      
      next();
    };
  }

  // Static method to create cache manager
  static async create(options = {}) {
    const cacheManager = new CacheManager(options);
    await cacheManager.init();
    return cacheManager;
  }
}

module.exports = CacheManager;
