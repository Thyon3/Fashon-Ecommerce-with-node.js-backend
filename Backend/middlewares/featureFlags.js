const fs = require('fs').promises;
const path = require('path');
const EventEmitter = require('events');

class FeatureFlags extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      configFile: options.configFile || path.join(process.cwd(), 'config', 'feature-flags.json'),
      enablePersistence: options.enablePersistence !== false,
      enableCache: options.enableCache !== false,
      cacheTimeout: options.cacheTimeout || 60000, // 1 minute
      enableMetrics: options.enableMetrics || false,
      ...options
    };
    
    this.flags = new Map();
    this.segments = new Map();
    this.cache = new Map();
    this.metrics = {
      evaluations: 0,
      cacheHits: 0,
      cacheMisses: 0,
      flagChanges: 0
    };
    
    this.init();
  }

  async init() {
    try {
      await this.loadConfig();
      
      if (this.options.enablePersistence) {
        this.startPersistence();
      }
      
      console.log('[FEATURE_FLAGS] Feature flags service initialized');
    } catch (error) {
      console.error('[FEATURE_FLAGS] Failed to initialize:', error);
    }
  }

  async loadConfig() {
    try {
      const configPath = this.options.configFile;
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      
      // Load flags
      if (config.flags) {
        for (const [key, flag] of Object.entries(config.flags)) {
          this.flags.set(key, {
            key,
            enabled: flag.enabled,
            description: flag.description,
            conditions: flag.conditions || [],
            rolloutPercentage: flag.rolloutPercentage || 100,
            segments: flag.segments || [],
            metadata: flag.metadata || {},
            createdAt: flag.createdAt || new Date().toISOString(),
            updatedAt: flag.updatedAt || new Date().toISOString()
          });
        }
      }
      
      // Load segments
      if (config.segments) {
        for (const [key, segment] of Object.entries(config.segments)) {
          this.segments.set(key, {
            key,
            description: segment.description,
            rules: segment.rules || [],
            metadata: segment.metadata || {}
          });
        }
      }
      
      console.log(`[FEATURE_FLAGS] Loaded ${this.flags.size} flags and ${this.segments.size} segments`);
    } catch (error) {
      console.log('[FEATURE_FLAGS] No existing config found, starting with empty configuration');
    }
  }

  async saveConfig() {
    if (!this.options.enablePersistence) return;
    
    try {
      const configDir = path.dirname(this.options.configFile);
      await fs.mkdir(configDir, { recursive: true });
      
      const config = {
        flags: Object.fromEntries(this.flags),
        segments: Object.fromEntries(this.segments),
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      };
      
      await fs.writeFile(this.options.configFile, JSON.stringify(config, null, 2));
    } catch (error) {
      console.error('[FEATURE_FLAGS] Failed to save config:', error);
    }
  }

  startPersistence() {
    // Auto-save every 30 seconds
    setInterval(() => {
      this.saveConfig();
    }, 30000);
  }

  isEnabled(flagKey, context = {}) {
    this.metrics.evaluations++;
    
    // Check cache first
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(flagKey, context);
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
        this.metrics.cacheHits++;
        return cached.value;
      }
      
      this.metrics.cacheMisses++;
    }
    
    const flag = this.flags.get(flagKey);
    if (!flag) {
      return false;
    }
    
    let enabled = flag.enabled;
    
    // Check conditions
    if (enabled && flag.conditions.length > 0) {
      enabled = this.evaluateConditions(flag.conditions, context);
    }
    
    // Check segments
    if (enabled && flag.segments.length > 0) {
      enabled = this.checkSegments(flag.segments, context);
    }
    
    // Check rollout percentage
    if (enabled && flag.rolloutPercentage < 100) {
      enabled = this.checkRollout(flag.rolloutPercentage, context);
    }
    
    // Cache result
    if (this.options.enableCache) {
      const cacheKey = this.getCacheKey(flagKey, context);
      this.cache.set(cacheKey, {
        value: enabled,
        timestamp: Date.now()
      });
    }
    
    return enabled;
  }

  evaluateConditions(conditions, context) {
    for (const condition of conditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false;
      }
    }
    return true;
  }

  evaluateCondition(condition, context) {
    const { field, operator, value } = condition;
    const contextValue = this.getFieldValue(context, field);
    
    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'not_equals':
        return contextValue !== value;
      case 'contains':
        return String(contextValue).includes(String(value));
      case 'not_contains':
        return !String(contextValue).includes(String(value));
      case 'starts_with':
        return String(contextValue).startsWith(String(value));
      case 'ends_with':
        return String(contextValue).endsWith(String(value));
      case 'greater_than':
        return Number(contextValue) > Number(value);
      case 'less_than':
        return Number(contextValue) < Number(value);
      case 'greater_than_or_equal':
        return Number(contextValue) >= Number(value);
      case 'less_than_or_equal':
        return Number(contextValue) <= Number(value);
      case 'in':
        return Array.isArray(value) && value.includes(contextValue);
      case 'not_in':
        return Array.isArray(value) && !value.includes(contextValue);
      case 'regex':
        return new RegExp(value).test(String(contextValue));
      default:
        return true;
    }
  }

  getFieldValue(context, field) {
    const parts = field.split('.');
    let value = context;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  checkSegments(segmentKeys, context) {
    for (const segmentKey of segmentKeys) {
      if (this.isInSegment(segmentKey, context)) {
        return true;
      }
    }
    return false;
  }

  isInSegment(segmentKey, context) {
    const segment = this.segments.get(segmentKey);
    if (!segment) return false;
    
    return this.evaluateConditions(segment.rules, context);
  }

  checkRollout(percentage, context) {
    const identifier = this.getRolloutIdentifier(context);
    const hash = this.hashString(identifier);
    const rolloutValue = hash % 100;
    
    return rolloutValue < percentage;
  }

  getRolloutIdentifier(context) {
    // Use user ID, session ID, or IP address for consistent rollout
    return context.userId || context.sessionId || context.ip || 'anonymous';
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

  getCacheKey(flagKey, context) {
    const identifier = this.getRolloutIdentifier(context);
    return `${flagKey}:${identifier}`;
  }

  createFlag(key, options = {}) {
    if (this.flags.has(key)) {
      throw new Error(`Flag '${key}' already exists`);
    }
    
    const flag = {
      key,
      enabled: options.enabled || false,
      description: options.description || '',
      conditions: options.conditions || [],
      rolloutPercentage: options.rolloutPercentage || 100,
      segments: options.segments || [],
      metadata: options.metadata || {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.flags.set(key, flag);
    this.metrics.flagChanges++;
    
    this.emit('flag:created', flag);
    this.clearCache();
    
    console.log(`[FEATURE_FLAGS] Created flag '${key}'`);
    
    return flag;
  }

  updateFlag(key, updates) {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Flag '${key}' not found`);
    }
    
    const oldEnabled = flag.enabled;
    Object.assign(flag, updates);
    flag.updatedAt = new Date().toISOString();
    
    this.metrics.flagChanges++;
    
    if (oldEnabled !== flag.enabled) {
      this.emit('flag:toggled', flag, oldEnabled);
    }
    
    this.emit('flag:updated', flag);
    this.clearCache();
    
    console.log(`[FEATURE_FLAGS] Updated flag '${key}'`);
    
    return flag;
  }

  deleteFlag(key) {
    const flag = this.flags.get(key);
    if (!flag) {
      throw new Error(`Flag '${key}' not found`);
    }
    
    this.flags.delete(key);
    this.metrics.flagChanges++;
    
    this.emit('flag:deleted', flag);
    this.clearCache();
    
    console.log(`[FEATURE_FLAGS] Deleted flag '${key}'`);
    
    return true;
  }

  enableFlag(key) {
    return this.updateFlag(key, { enabled: true });
  }

  disableFlag(key) {
    return this.updateFlag(key, { enabled: false });
  }

  createSegment(key, options = {}) {
    if (this.segments.has(key)) {
      throw new Error(`Segment '${key}' already exists`);
    }
    
    const segment = {
      key,
      description: options.description || '',
      rules: options.rules || [],
      metadata: options.metadata || {}
    };
    
    this.segments.set(key, segment);
    
    this.emit('segment:created', segment);
    this.clearCache();
    
    console.log(`[FEATURE_FLAGS] Created segment '${key}'`);
    
    return segment;
  }

  updateSegment(key, updates) {
    const segment = this.segments.get(key);
    if (!segment) {
      throw new Error(`Segment '${key}' not found`);
    }
    
    Object.assign(segment, updates);
    
    this.emit('segment:updated', segment);
    this.clearCache();
    
    console.log(`[FEATURE_FLAGS] Updated segment '${key}'`);
    
    return segment;
  }

  deleteSegment(key) {
    const segment = this.segments.get(key);
    if (!segment) {
      throw new Error(`Segment '${key}' not found`);
    }
    
    this.segments.delete(key);
    
    this.emit('segment:deleted', segment);
    this.clearCache();
    
    console.log(`[FEATURE_FLAGS] Deleted segment '${key}'`);
    
    return true;
  }

  getFlag(key) {
    return this.flags.get(key);
  }

  getAllFlags() {
    return Array.from(this.flags.values());
  }

  getSegment(key) {
    return this.segments.get(key);
  }

  getAllSegments() {
    return Array.from(this.segments.values());
  }

  getFlagsForContext(context) {
    const results = [];
    
    for (const flag of this.flags.values()) {
      const enabled = this.isEnabled(flag.key, context);
      results.push({
        key: flag.key,
        enabled,
        description: flag.description,
        metadata: flag.metadata
      });
    }
    
    return results;
  }

  clearCache() {
    this.cache.clear();
  }

  getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.evaluations > 0 
        ? (this.metrics.cacheHits / this.metrics.evaluations) * 100 
        : 0,
      totalFlags: this.flags.size,
      totalSegments: this.segments.size,
      enabledFlags: Array.from(this.flags.values()).filter(f => f.enabled).length
    };
  }

  async exportData() {
    return {
      flags: Object.fromEntries(this.flags),
      segments: Object.fromEntries(this.segments),
      metrics: this.getMetrics(),
      exportedAt: new Date().toISOString()
    };
  }

  async importData(data) {
    if (data.flags) {
      this.flags.clear();
      for (const [key, flag] of Object.entries(data.flags)) {
        this.flags.set(key, flag);
      }
    }
    
    if (data.segments) {
      this.segments.clear();
      for (const [key, segment] of Object.entries(data.segments)) {
        this.segments.set(key, segment);
      }
    }
    
    this.clearCache();
    await this.saveConfig();
    
    console.log('[FEATURE_FLAGS] Imported configuration data');
  }

  middleware() {
    return (req, res, next) => {
      req.featureFlags = this;
      next();
    };
  }

  // Static method to create feature flags instance
  static async create(options = {}) {
    const featureFlags = new FeatureFlags(options);
    await featureFlags.init();
    return featureFlags;
  }
}

module.exports = FeatureFlags;
