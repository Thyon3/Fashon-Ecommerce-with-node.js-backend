const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class FileCache {
  constructor(options = {}) {
    this.options = {
      cacheDir: options.cacheDir || path.join(process.cwd(), 'cache'),
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB
      ttl: options.ttl || 3600000, // 1 hour
      maxFiles: options.maxFiles || 10000,
      compressionEnabled: options.compressionEnabled || false,
      ...options
    };
    
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
    
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.options.cacheDir, { recursive: true });
      await this.cleanupExpired();
      console.log('[CACHE] File cache initialized');
    } catch (error) {
      console.error('[CACHE] Failed to initialize cache:', error);
    }
  }

  getCachePath(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const subdir = hash.substring(0, 2);
    return path.join(this.options.cacheDir, subdir, `${hash}.cache`);
  }

  getMetaPath(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const subdir = hash.substring(0, 2);
    return path.join(this.options.cacheDir, subdir, `${hash}.meta`);
  }

  async get(key) {
    try {
      const cachePath = this.getCachePath(key);
      const metaPath = this.getMetaPath(key);
      
      // Check if file exists
      try {
        await fs.access(cachePath);
        await fs.access(metaPath);
      } catch (error) {
        this.stats.misses++;
        return null;
      }
      
      // Read metadata
      const metaContent = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaContent);
      
      // Check if expired
      if (meta.expiresAt && Date.now() > meta.expiresAt) {
        await this.delete(key);
        this.stats.misses++;
        return null;
      }
      
      // Read cached data
      let data = await fs.readFile(cachePath);
      
      // Decompress if needed
      if (meta.compressed) {
        data = await this.decompress(data);
      }
      
      // Update access time
      meta.lastAccessed = Date.now();
      meta.accessCount++;
      await fs.writeFile(metaPath, JSON.stringify(meta));
      
      this.stats.hits++;
      
      return meta.type === 'json' ? JSON.parse(data) : data;
      
    } catch (error) {
      console.error(`[CACHE] Error getting key '${key}':`, error);
      this.stats.misses++;
      return null;
    }
  }

  async set(key, value, options = {}) {
    try {
      const cachePath = this.getCachePath(key);
      const metaPath = this.getMetaPath(key);
      
      // Create subdirectory if needed
      const subdir = path.dirname(cachePath);
      await fs.mkdir(subdir, { recursive: true });
      
      // Prepare data
      let data = value;
      let type = 'string';
      
      if (typeof value === 'object') {
        data = JSON.stringify(value);
        type = 'json';
      }
      
      data = Buffer.from(data);
      
      // Compress if enabled and data is large enough
      let compressed = false;
      if (this.options.compressionEnabled && data.length > 1024) {
        data = await this.compress(data);
        compressed = true;
      }
      
      // Prepare metadata
      const ttl = options.ttl || this.options.ttl;
      const meta = {
        key,
        type,
        size: data.length,
        createdAt: Date.now(),
        lastAccessed: Date.now(),
        accessCount: 0,
        expiresAt: ttl > 0 ? Date.now() + ttl : null,
        compressed,
        tags: options.tags || []
      };
      
      // Check cache size and evict if necessary
      await this.ensureCapacity(data.length);
      
      // Write cache file and metadata
      await fs.writeFile(cachePath, data);
      await fs.writeFile(metaPath, JSON.stringify(meta));
      
      this.stats.sets++;
      
      console.log(`[CACHE] Set key '${key}' (${data.length} bytes)`);
      
      return true;
      
    } catch (error) {
      console.error(`[CACHE] Error setting key '${key}':`, error);
      return false;
    }
  }

  async delete(key) {
    try {
      const cachePath = this.getCachePath(key);
      const metaPath = this.getMetaPath(key);
      
      await fs.unlink(cachePath);
      await fs.unlink(metaPath);
      
      this.stats.deletes++;
      
      console.log(`[CACHE] Deleted key '${key}'`);
      return true;
      
    } catch (error) {
      // File might not exist
      return false;
    }
  }

  async exists(key) {
    try {
      const cachePath = this.getCachePath(key);
      const metaPath = this.getMetaPath(key);
      
      await fs.access(cachePath);
      await fs.access(metaPath);
      
      // Check expiry
      const metaContent = await fs.readFile(metaPath, 'utf8');
      const meta = JSON.parse(metaContent);
      
      if (meta.expiresAt && Date.now() > meta.expiresAt) {
        await this.delete(key);
        return false;
      }
      
      return true;
      
    } catch (error) {
      return false;
    }
  }

  async clear() {
    try {
      const files = await fs.readdir(this.options.cacheDir, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(this.options.cacheDir, file);
        const stat = await fs.stat(filePath);
        
        if (stat.isFile()) {
          await fs.unlink(filePath);
        }
      }
      
      // Reset stats
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        evictions: 0
      };
      
      console.log('[CACHE] Cache cleared');
      
    } catch (error) {
      console.error('[CACHE] Error clearing cache:', error);
    }
  }

  async cleanupExpired() {
    try {
      const files = await fs.readdir(this.options.cacheDir, { recursive: true });
      let cleaned = 0;
      
      for (const file of files) {
        if (!file.endsWith('.meta')) continue;
        
        const metaPath = path.join(this.options.cacheDir, file);
        const cachePath = metaPath.replace('.meta', '.cache');
        
        try {
          const metaContent = await fs.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaContent);
          
          if (meta.expiresAt && Date.now() > meta.expiresAt) {
            await fs.unlink(metaPath);
            await fs.unlink(cachePath);
            cleaned++;
          }
        } catch (error) {
          // Invalid metadata file, remove it
          await fs.unlink(metaPath).catch(() => {});
          await fs.unlink(cachePath).catch(() => {});
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        console.log(`[CACHE] Cleaned up ${cleaned} expired cache entries`);
      }
      
    } catch (error) {
      console.error('[CACHE] Error during cleanup:', error);
    }
  }

  async ensureCapacity(requiredSize) {
    try {
      const currentSize = await this.getCurrentSize();
      
      if (currentSize + requiredSize <= this.options.maxSize) {
        return;
      }
      
      // Get all cache entries sorted by last accessed time
      const entries = await this.getAllEntries();
      entries.sort((a, b) => a.meta.lastAccessed - b.meta.lastAccessed);
      
      // Evict entries until we have enough space
      let freedSize = 0;
      for (const entry of entries) {
        await this.delete(entry.meta.key);
        freedSize += entry.meta.size;
        this.stats.evictions++;
        
        if (currentSize - freedSize + requiredSize <= this.options.maxSize) {
          break;
        }
      }
      
      console.log(`[CACHE] Evicted ${this.stats.evictions} entries, freed ${freedSize} bytes`);
      
    } catch (error) {
      console.error('[CACHE] Error ensuring capacity:', error);
    }
  }

  async getCurrentSize() {
    try {
      const files = await fs.readdir(this.options.cacheDir, { recursive: true });
      let totalSize = 0;
      
      for (const file of files) {
        if (file.endsWith('.cache')) {
          const filePath = path.join(this.options.cacheDir, file);
          const stat = await fs.stat(filePath);
          totalSize += stat.size;
        }
      }
      
      return totalSize;
      
    } catch (error) {
      return 0;
    }
  }

  async getAllEntries() {
    const entries = [];
    
    try {
      const files = await fs.readdir(this.options.cacheDir, { recursive: true });
      
      for (const file of files) {
        if (!file.endsWith('.meta')) continue;
        
        const metaPath = path.join(this.options.cacheDir, file);
        try {
          const metaContent = await fs.readFile(metaPath, 'utf8');
          const meta = JSON.parse(metaContent);
          
          entries.push({ meta, path: metaPath });
        } catch (error) {
          // Skip invalid metadata
        }
      }
      
    } catch (error) {
      console.error('[CACHE] Error getting entries:', error);
    }
    
    return entries;
  }

  async getStats() {
    const entries = await this.getAllEntries();
    const totalSize = await this.getCurrentSize();
    
    return {
      ...this.stats,
      entries: entries.length,
      totalSize,
      maxSize: this.options.maxSize,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
        : 0
    };
  }

  async getByTag(tag) {
    const entries = await this.getAllEntries();
    const results = [];
    
    for (const entry of entries) {
      if (entry.meta.tags && entry.meta.tags.includes(tag)) {
        const value = await this.get(entry.meta.key);
        if (value !== null) {
          results.push({ key: entry.meta.key, value, meta: entry.meta });
        }
      }
    }
    
    return results;
  }

  async deleteByTag(tag) {
    const entries = await this.getAllEntries();
    let deleted = 0;
    
    for (const entry of entries) {
      if (entry.meta.tags && entry.meta.tags.includes(tag)) {
        await this.delete(entry.meta.key);
        deleted++;
      }
    }
    
    return deleted;
  }

  async compress(data) {
    // Simple compression - in production, use zlib
    return data;
  }

  async decompress(data) {
    // Simple decompression - in production, use zlib
    return data;
  }

  // Static methods for convenience
  static async create(options) {
    const cache = new FileCache(options);
    await cache.init();
    return cache;
  }
}

module.exports = FileCache;
