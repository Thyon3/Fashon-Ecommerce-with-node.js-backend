class ContentFilter {
  constructor() {
    this.bannedWords = new Set([
      'spam', 'scam', 'fraud', 'phishing', 'malware', 'virus',
      'hack', 'crack', 'illegal', 'forbidden', 'banned', 'blocked'
    ]);
    this.suspiciousPatterns = [
      /click here/i,
      /free money/i,
      /guaranteed winner/i,
      /act now/i,
      /limited offer/i,
      /urgent/i,
      /congratulations.*winner/i,
      /you have won/i
    ];
    this.allowedHTMLTags = new Set([
      'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li', 'a', 'span'
    ]);
    this.maxContentLength = 10000; // 10KB
  }

  // Filter content
  filterContent(content, options = {}) {
    const config = {
      removeHTML: options.removeHTML !== false,
      checkBannedWords: options.checkBannedWords !== false,
      checkSuspiciousPatterns: options.checkSuspiciousPatterns !== false,
      maxLength: options.maxLength || this.maxContentLength
    };

    const result = {
      originalContent: content,
      filteredContent: content,
      isClean: true,
      issues: [],
      warnings: [],
      metadata: {
        length: content.length,
        hasHTML: this.hasHTML(content),
        wordCount: this.countWords(content),
        links: this.extractLinks(content)
      }
    };

    // Check content length
    if (result.metadata.length > config.maxLength) {
      result.isClean = false;
      result.issues.push(`Content exceeds maximum length of ${config.maxLength} characters`);
    }

    // Check for banned words
    if (config.checkBannedWords) {
      const bannedWordsFound = this.checkBannedWords(content);
      if (bannedWordsFound.length > 0) {
        result.isClean = false;
        result.issues.push(`Contains banned words: ${bannedWordsFound.join(', ')}`);
        result.metadata.bannedWords = bannedWordsFound;
      }
    }

    // Check for suspicious patterns
    if (config.checkSuspiciousPatterns) {
      const suspiciousPatternsFound = this.checkSuspiciousPatterns(content);
      if (suspiciousPatternsFound.length > 0) {
        result.warnings.push(`Contains suspicious patterns: ${suspiciousPatternsFound.map(p => p.pattern).join(', ')}`);
        result.metadata.suspiciousPatterns = suspiciousPatternsFound;
      }
    }

    // Filter HTML if enabled
    if (config.removeHTML && result.metadata.hasHTML) {
      result.filteredContent = this.removeHTML(content);
      result.metadata.htmlRemoved = true;
    }

    // Check for malicious links
    const maliciousLinks = this.checkMaliciousLinks(result.metadata.links);
    if (maliciousLinks.length > 0) {
      result.isClean = false;
      result.issues.push(`Contains malicious links: ${maliciousLinks.join(', ')}`);
      result.metadata.maliciousLinks = maliciousLinks;
    }

    // Calculate content score
    result.metadata.score = this.calculateContentScore(result);

    return result;
  }

  // Check for banned words
  checkBannedWords(content) {
    const found = [];
    const words = content.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
      if (this.bannedWords.has(word)) {
        found.push(word);
      }
    });
    
    return [...new Set(found)]; // Remove duplicates
  }

  // Check for suspicious patterns
  checkSuspiciousPatterns(content) {
    const found = [];
    
    this.suspiciousPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        found.push({
          pattern: pattern.source,
          matches: matches
        });
      }
    });
    
    return found;
  }

  // Check if content has HTML
  hasHTML(content) {
    return /<[^>]*>/.test(content);
  }

  // Remove HTML from content
  removeHTML(content) {
    // Simple HTML removal - in production, use a proper library
    return content.replace(/<[^>]*>/g, '');
  }

  // Count words in content
  countWords(content) {
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  // Extract links from content
  extractLinks(content) {
    const linkRegex = /https?:\/\/[^\s<>"']+/gi;
    return content.match(linkRegex) || [];
  }

  // Check for malicious links
  checkMaliciousLinks(links) {
    const malicious = [];
    const suspiciousDomains = [
      'bit.ly', 'tinyurl.com', 'goo.gl', 't.co',
      'short.link', 'cutt.ly', 'bit.do'
    ];
    
    links.forEach(link => {
      try {
        const url = new URL(link);
        if (suspiciousDomains.includes(url.hostname.toLowerCase())) {
          malicious.push(link);
        }
      } catch {
        // Invalid URL, might be suspicious
        malicious.push(link);
      }
    });
    
    return malicious;
  }

  // Calculate content score
  calculateContentScore(result) {
    let score = 100;
    
    // Deduct points for issues
    score -= result.issues.length * 20;
    score -= result.warnings.length * 10;
    
    // Deduct points for excessive length
    if (result.metadata.length > this.maxContentLength * 0.8) {
      score -= 10;
    }
    
    // Deduct points for too many links
    if (result.metadata.links.length > 5) {
      score -= 10;
    }
    
    return Math.max(0, score);
  }

  // Sanitize content
  sanitizeContent(content, options = {}) {
    const config = {
      allowedTags: options.allowedTags || this.allowedHTMLTags,
      removeAttributes: options.removeAttributes !== false,
      removeStyles: options.removeStyles !== false
    };

    let sanitized = content;

    // Remove dangerous HTML tags
    if (config.allowedTags) {
      sanitized = this.sanitizeHTML(sanitized, config.allowedTags);
    }

    // Remove dangerous attributes
    if (config.removeAttributes) {
      sanitized = this.removeDangerousAttributes(sanitized);
    }

    // Remove styles
    if (config.removeStyles) {
      sanitized = sanitized.replace(/style="[^"]*"/gi, '');
    }

    return sanitized;
  }

  // Sanitize HTML with allowed tags
  sanitizeHTML(content, allowedTags) {
    // Simple HTML sanitization - in production, use DOMPurify or similar
    const tagPattern = new RegExp(`<(?!\\/?(${Array.from(allowedTags).join('|')})\\s*\/?>)[^>]*>`, 'gi');
    return content.replace(tagPattern, '');
  }

  // Remove dangerous attributes
  removeDangerousAttributes(content) {
    const dangerousAttributes = [
      'onload', 'onerror', 'onclick', 'onmouseover', 'onmouseout',
      'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset',
      'javascript:', 'vbscript:', 'data:', 'src', 'href'
    ];

    let sanitized = content;
    
    dangerousAttributes.forEach(attr => {
      const regex = new RegExp(`${attr}\\s*=\\s*["'][^"']*["']`, 'gi');
      sanitized = sanitized.replace(regex, '');
    });
    
    return sanitized;
  }

  // Check for profanity
  checkProfanity(content) {
    const profanityWords = new Set([
      'damn', 'hell', 'crap', 'stupid', 'idiot', 'fool'
      // Add more as needed
    ]);
    
    const words = content.toLowerCase().split(/\s+/);
    const found = words.filter(word => profanityWords.has(word));
    
    return {
      hasProfanity: found.length > 0,
      words: [...new Set(found)],
      count: found.length
    };
  }

  // Check content quality
  checkQuality(content) {
    const result = {
      score: 0,
      issues: [],
      suggestions: []
    };

    // Check length
    if (content.length < 10) {
      result.issues.push('Content is too short');
      result.score -= 20;
    } else if (content.length > 5000) {
      result.issues.push('Content is very long');
      result.score -= 10;
    }

    // Check word count
    const wordCount = this.countWords(content);
    if (wordCount < 3) {
      result.issues.push('Content has too few words');
      result.score -= 15;
    }

    // Check for repeated characters
    if (/(.)\1{4,}/.test(content)) {
      result.issues.push('Content contains repeated characters');
      result.score -= 10;
    }

    // Check for excessive capitalization
    const uppercaseRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (uppercaseRatio > 0.3) {
      result.issues.push('Content has excessive capitalization');
      result.score -= 10;
      result.suggestions.push('Use normal capitalization');
    }

    // Check for excessive punctuation
    const punctuationRatio = (content.match(/[!?.,;:]/g) || []).length / content.length;
    if (punctuationRatio > 0.1) {
      result.issues.push('Content has excessive punctuation');
      result.score -= 10;
      result.suggestions.push('Use punctuation appropriately');
    }

    result.score = Math.max(0, Math.min(100, result.score + 50)); // Normalize to 0-100

    return result;
  }

  // Add banned word
  addBannedWord(word) {
    this.bannedWords.add(word.toLowerCase());
    console.log(`[CONTENT_FILTER] Added banned word: ${word}`);
  }

  // Remove banned word
  removeBannedWord(word) {
    this.bannedWords.delete(word.toLowerCase());
    console.log(`[CONTENT_FILTER] Removed banned word: ${word}`);
  }

  // Add suspicious pattern
  addSuspiciousPattern(pattern) {
    this.suspiciousPatterns.push(new RegExp(pattern, 'i'));
    console.log(`[CONTENT_FILTER] Added suspicious pattern: ${pattern}`);
  }

  // Get filter statistics
  getStats() {
    return {
      bannedWordsCount: this.bannedWords.size,
      suspiciousPatternsCount: this.suspiciousPatterns.length,
      allowedHTMLTagsCount: this.allowedHTMLTags.size,
      maxContentLength: this.maxContentLength
    };
  }

  // Export configuration
  exportConfig() {
    return {
      bannedWords: Array.from(this.bannedWords),
      suspiciousPatterns: this.suspiciousPatterns.map(p => p.source),
      allowedHTMLTags: Array.from(this.allowedHTMLTags),
      maxContentLength: this.maxContentLength
    };
  }

  // Import configuration
  importConfig(config) {
    try {
      if (config.bannedWords && Array.isArray(config.bannedWords)) {
        this.bannedWords = new Set(config.bannedWords);
      }
      
      if (config.suspiciousPatterns && Array.isArray(config.suspiciousPatterns)) {
        this.suspiciousPatterns = config.suspiciousPatterns.map(p => new RegExp(p, 'i'));
      }
      
      if (config.allowedHTMLTags && Array.isArray(config.allowedHTMLTags)) {
        this.allowedHTMLTags = new Set(config.allowedHTMLTags);
      }
      
      if (config.maxContentLength) {
        this.maxContentLength = config.maxContentLength;
      }
      
      console.log('[CONTENT_FILTER] Configuration imported successfully');
      
    } catch (error) {
      console.error('[CONTENT_FILTER] Error importing configuration:', error);
      throw error;
    }
  }

  // Middleware for content filtering
  middleware(options = {}) {
    const {
      field = 'content',
      required = false,
      sanitize = true,
      checkQuality = true
    } = options;

    return (req, res, next) => {
      const content = req.body[field];

      if (required && !content) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CONTENT_REQUIRED',
            message: 'Content is required'
          }
        });
      }

      if (!content) {
        return next();
      }

      const filterResult = this.filterContent(content, options);

      if (!filterResult.isClean) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'CONTENT_INAPPROPRIATE',
            message: 'Content contains inappropriate material',
            issues: filterResult.issues
          }
        });
      }

      // Sanitize content if enabled
      if (sanitize) {
        req.body[field] = this.sanitizeContent(content, options);
      }

      // Check quality if enabled
      if (checkQuality) {
        const qualityResult = this.checkQuality(content);
        if (qualityResult.score < 30) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'CONTENT_LOW_QUALITY',
              message: 'Content quality is too low',
              issues: qualityResult.issues,
              suggestions: qualityResult.suggestions
            }
          });
        }
      }

      // Add filter result to request
      req.contentFilter = filterResult;
      
      next();
    };
  }
}

// Create singleton instance
const contentFilter = new ContentFilter();

module.exports = contentFilter;
