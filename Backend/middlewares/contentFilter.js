const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class ContentFilter extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      enableProfanityFilter: options.enableProfanityFilter !== false,
      enableSpamFilter: options.enableSpamFilter || false,
      enablePIIFilter: options.enablePIIFilter || false,
      enableCustomFilters: options.enableCustomFilters || false,
      enableLogging: options.enableLogging !== false,
      configFile: options.configFile || path.join(process.cwd(), 'config', 'content-filters.json'),
      action: options.action || 'mask', // 'mask', 'block', 'flag'
      maskCharacter: options.maskCharacter || '*',
      customPatterns: options.customPatterns || [],
      ...options
    };
    
    this.profanityList = new Set();
    this.spamPatterns = new Map();
    this.piiPatterns = new Map();
    this.customFilters = new Map();
    this.stats = {
      totalFiltered: 0,
      profanityFiltered: 0,
      spamFiltered: 0,
      piiFiltered: 0,
      customFiltered: 0
    };
    
    this.init();
  }

  async init() {
    try {
      await this.loadFilters();
      
      // Load default patterns
      this.loadDefaultPatterns();
      
      console.log('[CONTENT_FILTER] Content filter initialized');
    } catch (error) {
      console.error('[CONTENT_FILTER] Failed to initialize:', error);
    }
  }

  async loadFilters() {
    try {
      const configPath = this.options.configFile;
      const content = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(content);
      
      // Load profanity list
      if (config.profanity) {
        config.profanity.forEach(word => this.profanityList.add(word.toLowerCase()));
      }
      
      // Load spam patterns
      if (config.spamPatterns) {
        for (const [name, pattern] of Object.entries(config.spamPatterns)) {
          this.spamPatterns.set(name, new RegExp(pattern, 'gi'));
        }
      }
      
      // Load PII patterns
      if (config.piiPatterns) {
        for (const [name, pattern] of Object.entries(config.piiPatterns)) {
          this.piiPatterns.set(name, new RegExp(pattern, 'gi'));
        }
      }
      
      // Load custom filters
      if (config.customFilters) {
        for (const [name, filter] of Object.entries(config.customFilters)) {
          this.customFilters.set(name, {
            pattern: new RegExp(filter.pattern, 'gi'),
            action: filter.action || this.options.action,
            replacement: filter.replacement
          });
        }
      }
      
      console.log(`[CONTENT_FILTER] Loaded ${this.profanityList.size} profanity words, ${this.spamPatterns.size} spam patterns, ${this.piiPatterns.size} PII patterns`);
    } catch (error) {
      console.log('[CONTENT_FILTER] No existing filters found, using defaults');
    }
  }

  loadDefaultPatterns() {
    // Default profanity words (sample list - in production use comprehensive list)
    const defaultProfanity = [
      'damn', 'hell', 'crap', 'suck', 'stupid', 'idiot', 'fool', 'jerk'
    ];
    
    defaultProfanity.forEach(word => this.profanityList.add(word));
    
    // Default spam patterns
    this.spamPatterns.set('email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g);
    this.spamPatterns.set('phone', /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g);
    this.spamPatterns.set('url', /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g);
    this.spamPatterns.set('excessiveCaps', /[A-Z]{4,}/g);
    this.spamPatterns.set('repeatedChars', /(.)\1{3,}/g);
    
    // Default PII patterns
    this.piiPatterns.set('ssn', /\b\d{3}-\d{2}-\d{4}\b/g);
    this.piiPatterns.set('creditCard', /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g);
    this.piiPatterns.set('ipAddress', /\b(?:\d{1,3}\.){3}\d{1,3}\b/g);
    this.piiPatterns.set('apiKey', /\b[A-Za-z0-9]{20,}\b/g);
  }

  filterContent(content, options = {}) {
    const result = {
      original: content,
      filtered: content,
      filtered: false,
      violations: [],
      metadata: {
        profanityCount: 0,
        spamCount: 0,
        piiCount: 0,
        customCount: 0
      }
    };
    
    let filteredContent = content;
    
    // Filter profanity
    if (this.options.enableProfanityFilter) {
      const profanityResult = this.filterProfanity(filteredContent, options);
      filteredContent = profanityResult.content;
      result.metadata.profanityCount = profanityResult.count;
      
      if (profanityResult.detected.length > 0) {
        result.filtered = true;
        result.violations.push(...profanityResult.detected.map(word => ({
          type: 'profanity',
          value: word,
          action: this.options.action
        })));
      }
    }
    
    // Filter spam
    if (this.options.enableSpamFilter) {
      const spamResult = this.filterSpam(filteredContent, options);
      filteredContent = spamResult.content;
      result.metadata.spamCount = spamResult.count;
      
      if (spamResult.detected.length > 0) {
        result.filtered = true;
        result.violations.push(...spamResult.detected.map(match => ({
          type: 'spam',
          value: match.match,
          pattern: match.pattern,
          action: this.options.action
        })));
      }
    }
    
    // Filter PII
    if (this.options.enablePIIFilter) {
      const piiResult = this.filterPII(filteredContent, options);
      filteredContent = piiResult.content;
      result.metadata.piiCount = piiResult.count;
      
      if (piiResult.detected.length > 0) {
        result.filtered = true;
        result.violations.push(...piiResult.detected.map(match => ({
          type: 'pii',
          value: match.match,
          pattern: match.pattern,
          action: this.options.action
        })));
      }
    }
    
    // Apply custom filters
    if (this.options.enableCustomFilters) {
      const customResult = this.filterCustom(filteredContent, options);
      filteredContent = customResult.content;
      result.metadata.customCount = customResult.count;
      
      if (customResult.detected.length > 0) {
        result.filtered = true;
        result.violations.push(...customResult.detected.map(match => ({
          type: 'custom',
          value: match.match,
          pattern: match.pattern,
          action: match.action
        })));
      }
    }
    
    result.filtered = filteredContent;
    
    // Update stats
    if (result.filtered) {
      this.stats.totalFiltered++;
      this.stats.profanityFiltered += result.metadata.profanityCount;
      this.stats.spamFiltered += result.metadata.spamCount;
      this.stats.piiFiltered += result.metadata.piiCount;
      this.stats.customFiltered += result.metadata.customCount;
    }
    
    // Log filtering
    if (this.options.enableLogging && result.filtered) {
      this.logFiltering(result);
    }
    
    // Emit event
    if (result.filtered) {
      this.emit('content:filtered', result);
    }
    
    return result;
  }

  filterProfanity(content, options = {}) {
    const words = content.split(/\s+/);
    const detected = [];
    let count = 0;
    
    const filteredWords = words.map(word => {
      const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
      
      if (this.profanityList.has(cleanWord)) {
        detected.push(cleanWord);
        count++;
        
        switch (this.options.action) {
          case 'mask':
            return this.maskWord(word);
          case 'block':
            return '[BLOCKED]';
          case 'flag':
            return word;
          default:
            return word;
        }
      }
      
      return word;
    });
    
    return {
      content: filteredWords.join(' '),
      detected,
      count
    };
  }

  filterSpam(content, options = {}) {
    let filteredContent = content;
    const detected = [];
    let count = 0;
    
    for (const [patternName, pattern] of this.spamPatterns.entries()) {
      const matches = filteredContent.match(pattern);
      
      if (matches) {
        detected.push(...matches.map(match => ({ match, pattern: patternName })));
        count += matches.length;
        
        switch (this.options.action) {
          case 'mask':
            filteredContent = filteredContent.replace(pattern, (match) => this.maskContent(match));
            break;
          case 'block':
            return { content: '[SPAM_CONTENT_BLOCKED]', detected, count };
          case 'flag':
            // Keep original content
            break;
        }
      }
    }
    
    return {
      content: filteredContent,
      detected,
      count
    };
  }

  filterPII(content, options = {}) {
    let filteredContent = content;
    const detected = [];
    let count = 0;
    
    for (const [patternName, pattern] of this.piiPatterns.entries()) {
      const matches = filteredContent.match(pattern);
      
      if (matches) {
        detected.push(...matches.map(match => ({ match, pattern: patternName })));
        count += matches.length;
        
        switch (this.options.action) {
          case 'mask':
            filteredContent = filteredContent.replace(pattern, (match) => this.maskContent(match));
            break;
          case 'block':
            return { content: '[PII_CONTENT_BLOCKED]', detected, count };
          case 'flag':
            // Keep original content
            break;
        }
      }
    }
    
    return {
      content: filteredContent,
      detected,
      count
    };
  }

  filterCustom(content, options = {}) {
    let filteredContent = content;
    const detected = [];
    let count = 0;
    
    for (const [filterName, filter] of this.customFilters.entries()) {
      const matches = filteredContent.match(filter.pattern);
      
      if (matches) {
        detected.push(...matches.map(match => ({ match, pattern: filterName, action: filter.action })));
        count += matches.length;
        
        switch (filter.action) {
          case 'mask':
            filteredContent = filteredContent.replace(filter.pattern, filter.replacement || this.maskContent);
            break;
          case 'block':
            return { content: '[CUSTOM_CONTENT_BLOCKED]', detected, count };
          case 'flag':
            // Keep original content
            break;
        }
      }
    }
    
    return {
      content: filteredContent,
      detected,
      count
    };
  }

  maskWord(word) {
    if (word.length <= 2) {
      return this.options.maskCharacter.repeat(word.length);
    }
    
    return word[0] + this.options.maskCharacter.repeat(word.length - 2) + word[word.length - 1];
  }

  maskContent(content) {
    return this.options.maskCharacter.repeat(content.length);
  }

  addProfanityWord(word) {
    this.profanityList.add(word.toLowerCase());
    console.log(`[CONTENT_FILTER] Added profanity word: ${word}`);
  }

  removeProfanityWord(word) {
    return this.profanityList.delete(word.toLowerCase());
  }

  addSpamPattern(name, pattern) {
    this.spamPatterns.set(name, new RegExp(pattern, 'gi'));
    console.log(`[CONTENT_FILTER] Added spam pattern: ${name}`);
  }

  removeSpamPattern(name) {
    return this.spamPatterns.delete(name);
  }

  addPIIPattern(name, pattern) {
    this.piiPatterns.set(name, new RegExp(pattern, 'gi'));
    console.log(`[CONTENT_FILTER] Added PII pattern: ${name}`);
  }

  removePIIPattern(name) {
    return this.piiPatterns.delete(name);
  }

  addCustomFilter(name, pattern, action = 'mask', replacement = null) {
    this.customFilters.set(name, {
      pattern: new RegExp(pattern, 'gi'),
      action,
      replacement
    });
    console.log(`[CONTENT_FILTER] Added custom filter: ${name}`);
  }

  removeCustomFilter(name) {
    return this.customFilters.delete(name);
  }

  isContentSafe(content) {
    const result = this.filterContent(content);
    return !result.filtered;
  }

  getViolationSummary(content) {
    const result = this.filterContent(content);
    
    return {
      safe: !result.filtered,
      violations: result.violations,
      summary: {
        total: result.violations.length,
        profanity: result.metadata.profanityCount,
        spam: result.metadata.spamCount,
        pii: result.metadata.piiCount,
        custom: result.metadata.customCount
      }
    };
  }

  getStats() {
    return {
      ...this.stats,
      profanityWords: this.profanityList.size,
      spamPatterns: this.spamPatterns.size,
      piiPatterns: this.piiPatterns.size,
      customFilters: this.customFilters.size
    };
  }

  exportFilters() {
    return {
      profanity: Array.from(this.profanityList),
      spamPatterns: Object.fromEntries(
        Array.from(this.spamPatterns.entries()).map(([name, pattern]) => [name, pattern.source])
      ),
      piiPatterns: Object.fromEntries(
        Array.from(this.piiPatterns.entries()).map(([name, pattern]) => [name, pattern.source])
      ),
      customFilters: Object.fromEntries(
        Array.from(this.customFilters.entries()).map(([name, filter]) => [
          name,
          {
            pattern: filter.pattern.source,
            action: filter.action,
            replacement: filter.replacement
          }
        ])
      ),
      stats: this.getStats()
    };
  }

  importFilters(filters) {
    if (filters.profanity) {
      this.profanityList.clear();
      filters.profanity.forEach(word => this.profanityList.add(word));
    }
    
    if (filters.spamPatterns) {
      this.spamPatterns.clear();
      for (const [name, pattern] of Object.entries(filters.spamPatterns)) {
        this.spamPatterns.set(name, new RegExp(pattern, 'gi'));
      }
    }
    
    if (filters.piiPatterns) {
      this.piiPatterns.clear();
      for (const [name, pattern] of Object.entries(filters.piiPatterns)) {
        this.piiPatterns.set(name, new RegExp(pattern, 'gi'));
      }
    }
    
    if (filters.customFilters) {
      this.customFilters.clear();
      for (const [name, filter] of Object.entries(filters.customFilters)) {
        this.customFilters.set(name, {
          pattern: new RegExp(filter.pattern, 'gi'),
          action: filter.action,
          replacement: filter.replacement
        });
      }
    }
    
    console.log('[CONTENT_FILTER] Filters imported successfully');
  }

  logFiltering(result) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      violations: result.violations.length,
      types: result.violations.map(v => v.type),
      metadata: result.metadata
    };
    
    console.log(`[CONTENT_FILTER] Content filtered: ${logEntry.violations} violations`, logEntry);
  }

  middleware(options = {}) {
    return (req, res, next) => {
      // Filter request body
      if (req.body && typeof req.body === 'object') {
        req.body = this.filterObject(req.body, options);
      }
      
      // Filter query parameters
      if (req.query && typeof req.query === 'object') {
        req.query = this.filterObject(req.query, options);
      }
      
      // Override res.json to filter response
      const originalJson = res.json;
      res.json = function(data) {
        if (data && typeof data === 'object') {
          data = this.filterObject(data, options);
        }
        return originalJson.call(this, data);
      }.bind(this);
      
      next();
    };
  }

  filterObject(obj, options = {}) {
    const filtered = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const result = this.filterContent(value, options);
        filtered[key] = result.filtered;
      } else if (typeof value === 'object' && value !== null) {
        filtered[key] = this.filterObject(value, options);
      } else {
        filtered[key] = value;
      }
    }
    
    return filtered;
  }

  // Static method to create content filter
  static async create(options = {}) {
    const contentFilter = new ContentFilter(options);
    await contentFilter.init();
    return contentFilter;
  }
}

module.exports = ContentFilter;
