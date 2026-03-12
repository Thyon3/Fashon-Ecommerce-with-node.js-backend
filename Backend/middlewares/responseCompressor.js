const zlib = require('zlib');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class ResponseCompressor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableCompression: options.enableCompression !== false,
      threshold: options.threshold || 1024, // Only compress responses larger than 1KB
      level: options.level || 6, // Compression level (0-9)
      chunkSize: options.chunkSize || 16 * 1024, // 16KB chunks
      windowBits: options.windowBits || 15,
      memLevel: options.memLevel || 8,
      strategy: options.strategy || 0, // 0: default, 1: filtered, 2: huffman only
      enableMetrics: options.enableMetrics !== false,
      enableCaching: options.enableCaching || false,
      cacheMaxSize: options.cacheMaxSize || 100 * 1024 * 1024, // 100MB
      cacheMaxEntries: options.cacheMaxEntries || 1000,
      enableETag: options.enableETag !== false,
      enableLastModified: options.enableLastModified !== false,
      enableVary: options.enableVary || false,
      enableBrotli: options.enableBrotli || false,
      enableGzip: options.enableGzip !== false,
      enableDeflate: options.enableDeflate || false,
      preferredEncoding: options.preferredEncoding || ['br', 'gzip', 'deflate'],
      skipCompressible: options.skipCompressible !== false,
      skipLargeResponses: options.skipLargeResponses || false,
      maxResponseSize: options.maxResponseSize || 10 * 1024 * 1024, // 10MB
      ...options
    };
    
    this.cache = new Map();
    this.metrics = {
      totalRequests: 0,
      compressedRequests: 0,
      uncompressedRequests: 0,
      totalOriginalSize: 0,
      totalCompressedSize: 0,
      compressionRatio: 0,
      cacheHits: 0,
      cacheMisses: 0,
      compressionTime: []
    };
    
    this.init();
  }

  init() {
    console.log('[RESPONSE_COMPRESSOR] Response compressor initialized');
  }

  shouldCompress(req, res) {
    // Check if compression is enabled
    if (!this.options.enableCompression) {
      return false;
    }
    
    // Check if client accepts compression
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const encodings = acceptEncoding.split(',').map(e => e.trim().toLowerCase());
    
    const hasSupportedEncoding = encodings.some(encoding => 
      this.options.preferredEncoding.includes(encoding)
    );
    
    if (!hasSupportedEncoding) {
      return false;
    }
    
    // Check if response is compressible
    const contentType = res.get('Content-Type') || '';
    if (!this.isCompressibleType(contentType)) {
      return false;
    }
    
    // Check response size threshold
    const contentLength = res.get('Content-Length');
    if (contentLength && parseInt(contentLength) < this.options.threshold) {
      return false;
    }
    
    // Skip if response is too large
    if (this.options.skipLargeResponses && contentLength && parseInt(contentLength) > this.options.maxResponseSize) {
      return false;
    }
    
    return true;
  }

  isCompressibleType(contentType) {
    if (this.options.skipCompressible) {
      return true;
    }
    
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'application/rss+xml',
      'application/atom+xml',
      'application/vnd.ms-fontobject',
      'application/font-woff',
      'application/font-woff2',
      'image/svg+xml',
      'text/css',
      'text/html',
      'text/plain',
      'text/xml',
      'text/javascript',
      'text/csv',
      'text/markdown'
    ];
    
    return compressibleTypes.some(type => contentType.includes(type));
  }

  getBestEncoding(req) {
    const acceptEncoding = req.get('Accept-Encoding') || '';
    const encodings = acceptEncoding.split(',').map(e => e.trim().toLowerCase());
    
    for (const preferred of this.options.preferredEncoding) {
      if (encodings.includes(preferred)) {
        return preferred;
      }
    }
    
    return null;
  }

  generateETag(data) {
    const hash = require('crypto').createHash('md5').update(data).digest('hex');
    return `"${hash}"`;
  }

  async compress(data, encoding) {
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
      
      let compressor;
      switch (encoding) {
        case 'br':
          compressor = zlib.createBrotliCompress({
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: this.options.level,
              [zlib.constants.BROTLI_PARAM_WINDOW_BITS]: this.options.windowBits,
              [zlib.constants.BROTLI_PARAM_BLOCK_SIZE]: 0,
              [zlib.constants.BROTLI_PARAM_MODE]: this.options.strategy
            }
          });
          break;
        case 'gzip':
          compressor = zlib.createGzip({
            level: this.options.level,
            windowBits: this.options.windowBits,
            memLevel: this.options.memLevel,
            strategy: this.options.strategy
          });
          break;
        case 'deflate':
          compressor = zlib.createDeflate({
            level: this.options.level,
            windowBits: this.options.windowBits,
            memLevel: this.options.memLevel,
            strategy: this.options.strategy
          });
          break;
        default:
          reject(new Error(`Unsupported encoding: ${encoding}`));
          return;
      }
      
      const chunks = [];
      
      compressor.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      compressor.on('end', () => {
        const compressed = Buffer.concat(chunks);
        const compressionTime = Date.now() - startTime;
        
        this.metrics.compressionTime.push(compressionTime);
        if (this.metrics.compressionTime.length > 1000) {
          this.metrics.compressionTime = this.metrics.compressionTime.slice(-1000);
        }
        
        resolve(compressed);
      });
      
      compressor.on('error', (error) => {
        reject(error);
      });
      
      compressor.write(buffer);
      compressor.end();
    });
  }

  async decompress(data, encoding) {
    return new Promise((resolve, reject) => {
      let decompressor;
      
      switch (encoding) {
        case 'br':
          decompressor = zlib.createBrotliDecompress();
          break;
        case 'gzip':
          decompressor = zlib.createGunzip();
          break;
        case 'deflate':
          decompressor = zlib.createInflate();
          break;
        default:
          reject(new Error(`Unsupported encoding: ${encoding}`));
          return;
      }
      
      const chunks = [];
      
      decompressor.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      decompressor.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      
      decompressor.on('error', (error) => {
        reject(error);
      });
      
      decompressor.write(data);
      decompressor.end();
    });
  }

  async compressResponse(req, res, data) {
    const originalSize = Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data);
    
    try {
      const encoding = this.getBestEncoding(req);
      const compressed = await this.compress(data, encoding);
      
      // Update metrics
      this.metrics.compressedRequests++;
      this.metrics.totalOriginalSize += originalSize;
      this.metrics.totalCompressedSize += compressed.length;
      
      // Calculate compression ratio
      this.metrics.compressionRatio = this.metrics.totalOriginalSize > 0 
        ? (1 - this.metrics.totalCompressedSize / this.metrics.totalOriginalSize) * 100 
        : 0;
      
      // Set appropriate headers
      res.set('Content-Encoding', encoding);
      res.set('Content-Length', compressed.length);
      
      if (this.options.enableVary) {
        res.set('Vary', 'Accept-Encoding');
      }
      
      return compressed;
      
    } catch (error) {
      console.error('[RESPONSE_COMPRESSOR] Compression failed:', error);
      
      // Return original data on compression failure
      this.metrics.uncompressedRequests++;
      return data;
    }
  }

  getCacheKey(req, data) {
    const url = req.originalUrl || req.url;
    const method = req.method;
    const hash = require('crypto').createHash('md5');
    
    hash.update(method);
    hash.update(url);
    hash.update(JSON.stringify(req.query));
    hash.update(JSON.stringify(req.headers));
    
    if (Buffer.isBuffer(data)) {
      hash.update(data);
    } else {
      hash.update(data);
    }
    
    return hash.digest('hex');
  }

  async getCachedResponse(req, data) {
    if (!this.options.enableCaching) {
      return null;
    }
    
    const key = this.getCacheKey(req, data);
    const cached = this.cache.get(key);
    
    if (cached && cached.expiresAt > Date.now()) {
      this.metrics.cacheHits++;
      return cached.data;
    }
    
    this.metrics.cacheMisses++;
    return null;
  }

  async setCachedResponse(req, data, compressedData) {
    if (!this.options.enableCaching) {
      return;
    }
    
    const key = this.getCacheKey(req, data);
    
    // Check cache size limits
    if (this.cache.size >= this.options.cacheMaxEntries) {
      await this.cleanupCache();
    }
    
    const cacheEntry = {
      data: compressedData,
      originalSize: Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data),
      compressedSize: compressedData.length,
      encoding: this.getBestEncoding(req),
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
      url: req.originalUrl || req.url,
      method: req.method
    };
    
    this.cache.set(key, cacheEntry);
  }

  async cleanupCache() {
    // Remove expired entries
    const now = Date.now();
    let removed = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    // If still over limit, remove oldest entries
    if (this.cache.size >= this.options.cacheMaxEntries) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].createdAt - b[1].createdAt);
      
      const toRemove = entries.slice(0, this.cache.size - this.options.cacheMaxEntries + 1);
      
      for (const [key] of toRemove) {
        this.cache.delete(key);
        removed++;
      }
    }
    
    if (removed > 0) {
      console.log(`[RESPONSE_COMPRESSOR] Cache cleanup: removed ${removed} entries`);
    }
  }

  getStats() {
    const avgCompressionTime = this.metrics.compressionTime.length > 0
      ? this.metrics.compressionTime.reduce((a, b) => a + b, 0) / this.metrics.compressionTime.length
      : 0;
    
    return {
      ...this.metrics,
      averageCompressionTime: avgCompressionTime,
      cacheHitRate: this.metrics.cacheHits + this.metrics.cacheMisses > 0
        ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses)) * 100
        : 0,
      compressionRate: this.metrics.compressionRatio,
      cacheSize: this.cache.size,
      cacheMemoryUsage: this.calculateCacheMemoryUsage()
    };
  }

  calculateCacheMemoryUsage() {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      totalSize += entry.compressedSize;
    }
    
    return totalSize;
  }

  async clearCache() {
    this.cache.clear();
    console.log('[RESPONSE_COMPRESSOR] Cache cleared');
  }

  async warmCache(urls) {
    console.log('[RESPONSE_COMPRESSOR] Warming up cache...');
    
    for (const url of urls) {
      try {
        // Simulate preloading
        console.log(`[RESPONSE_COMPRESSOR] Preloading: ${url}`);
      } catch (error) {
        console.error(`[RESPONSE_COMPRESSOR] Failed to preload ${url}:`, error);
      }
    }
  }

  middleware() {
    return (req, res, next) => {
      // Store original res.write and res.end methods
      const originalWrite = res.write;
      const originalEnd = res.end;
      let responseData = Buffer.alloc(0);
      let isComplete = false;
      
      // Override res.write to capture response data
      res.write = function(chunk, encoding) {
        if (chunk) {
          if (Buffer.isBuffer(chunk)) {
            responseData = Buffer.concat([responseData, chunk]);
          } else {
            responseData = Buffer.concat([responseData, Buffer.from(chunk, encoding)]);
          }
        }
        
        return originalWrite.call(this, chunk, encoding);
      };
      
      // Override res.end to compress response
      res.end = async function(chunk, encoding) {
        if (chunk) {
          res.write(chunk, encoding);
        }
        
        if (!isComplete) {
          isComplete = true;
          
          // Update metrics
          this.metrics.totalRequests++;
          
          // Check if we should compress
          if (this.shouldCompress(req, res)) {
            try {
              // Check cache first
              const cached = await this.getCachedResponse(req, responseData);
              
              if (cached) {
                // Use cached compressed response
                res.set('X-Cache', 'HIT');
                res.set('X-Cache-Key', this.getCacheKey(req, responseData));
                return originalEnd.call(this, cached);
              }
              
              // Compress response
              const compressed = await this.compressResponse(req, res, responseData);
              
              // Cache the compressed response
              await this.setCachedResponse(req, responseData, compressed);
              
              res.set('X-Cache', 'MISS');
              res.set('X-Compression-Ratio', `${((responseData.length - compressed.length) / responseData.length * 100).toFixed(2)}%`);
              
              return originalEnd.call(this, compressed);
            } catch (error) {
              console.error('[RESPONSE_COMPRESSOR] Compression error:', error);
              return originalEnd.call(this, responseData);
            }
          } else {
            // Don't compress, return original
            res.set('X-Cache', 'SKIP');
            return originalEnd.call(this, responseData);
          }
        }
        
        return originalEnd.call(this);
      }.bind(this);
      
      next();
    };
  }

  // Static method to create response compressor
  static create(options = {}) {
    return new ResponseCompressor(options);
  }
}

module.exports = ResponseCompressor;
