const fs = require('fs').promises;
const path = require('path');

class SearchEngine {
  constructor(options = {}) {
    this.options = {
      indexDir: options.indexDir || path.join(process.cwd(), 'search-index'),
      maxResults: options.maxResults || 50,
      fuzzyThreshold: options.fuzzyThreshold || 0.8,
      enableStemming: options.enableStemming !== false,
      enableSynonyms: options.enableSynonyms || false,
      ...options
    };
    
    this.index = {
      documents: new Map(),
      terms: new Map(),
      metadata: {
        totalDocuments: 0,
        lastUpdated: null,
        version: '1.0.0'
      }
    };
    
    this.synonyms = new Map();
    this.stopWords = new Set();
    
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.options.indexDir, { recursive: true });
      await this.loadStopWords();
      await this.loadSynonyms();
      await this.loadIndex();
      
      console.log('[SEARCH] Search engine initialized');
    } catch (error) {
      console.error('[SEARCH] Failed to initialize search engine:', error);
    }
  }

  async loadStopWords() {
    const commonStopWords = [
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have',
      'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you',
      'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they',
      'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my',
      'one', 'all', 'would', 'there', 'their', 'what', 'so',
      'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go',
      'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just',
      'him', 'know', 'take', 'people', 'into', 'year', 'your',
      'good', 'some', 'could', 'them', 'see', 'other', 'than',
      'then', 'now', 'look', 'only', 'come', 'its', 'over',
      'think', 'also', 'back', 'after', 'use', 'two', 'how',
      'our', 'work', 'first', 'well', 'way', 'even', 'new',
      'want', 'because', 'any', 'these', 'give', 'day', 'most',
      'us', 'is', 'was', 'are', 'been', 'has', 'had', 'were',
      'said', 'did', 'getting', 'made', 'find', 'where', 'much',
      'too', 'very', 'still', 'being', 'going', 'why', 'before',
      'never', 'here', 'more', 'thing', 'long', 'while', 'through',
      'might', 'between', 'both', 'major', 'such', 'however', 'upon',
      'those', 'order', 'often', 'important', 'around', 'without',
      'again', 'against', 'place', 'same', 'few', 'another', 'always',
      'large', 'small', 'old', 'young', 'high', 'low', 'early', 'late',
      'next', 'previous', 'last', 'first', 'best', 'worst', 'better',
      'less', 'more', 'most', 'least', 'only', 'main', 'primary',
      'secondary', 'final', 'initial', 'original', 'current', 'modern',
      'traditional', 'classic', 'contemporary', 'popular', 'famous',
      'well-known', 'unknown', 'rare', 'common', 'usual', 'unusual',
      'normal', 'abnormal', 'regular', 'irregular', 'standard', 'non-standard'
    ];
    
    commonStopWords.forEach(word => this.stopWords.add(word.toLowerCase()));
  }

  async loadSynonyms() {
    // Basic synonym mappings
    const synonymMappings = {
      'dress': ['gown', 'frock', 'attire'],
      'shirt': ['blouse', 'top', 'tee'],
      'pants': ['trousers', 'slacks', 'jeans'],
      'shoes': ['footwear', 'boots', 'sandals'],
      'hat': ['cap', 'headwear', 'beanie'],
      'bag': ['purse', 'handbag', 'backpack'],
      'jacket': ['coat', 'blazer', 'outerwear'],
      'skirt': ['dress', 'garment', 'clothing'],
      'shorts': ['trousers', 'pants', 'bottoms'],
      'socks': ['hosiery', 'footwear', 'stockings'],
      'belt': ['strap', 'waistband', 'sash'],
      'scarf': ['wrap', 'shawl', 'neckwear'],
      'gloves': ['mittens', 'handwear', 'hand-covering'],
      'watch': ['timepiece', 'wristwatch', 'clock'],
      'ring': ['jewelry', 'band', 'circlet'],
      'necklace': ['jewelry', 'chain', 'pendant'],
      'earrings': ['jewelry', 'earwear', 'studs'],
      'bracelet': ['jewelry', 'bangle', 'cuff'],
      'cheap': ['affordable', 'inexpensive', 'budget'],
      'expensive': ['costly', 'pricey', 'premium'],
      'quality': ['premium', 'high-quality', 'excellent'],
      'style': ['fashion', 'design', 'look'],
      'trendy': ['fashionable', 'stylish', 'modern'],
      'classic': ['timeless', 'traditional', 'vintage'],
      'modern': ['contemporary', 'current', 'new'],
      'comfortable': ['cozy', 'relaxed', 'easy'],
      'formal': ['dressy', 'professional', 'business'],
      'casual': ['informal', 'relaxed', 'everyday'],
      'elegant': ['sophisticated', 'refined', 'classy'],
      'colorful': ['vibrant', 'bright', 'multi-colored'],
      'simple': ['basic', 'minimal', 'plain'],
      'decorated': ['ornate', 'embellished', 'detailed']
    };
    
    for (const [term, synonyms] of Object.entries(synonymMappings)) {
      this.synonyms.set(term.toLowerCase(), synonyms);
    }
  }

  tokenize(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 0 && !this.stopWords.has(token));
  }

  stem(word) {
    // Simple stemming rules (in production, use a proper stemming library)
    if (word.endsWith('ing')) return word.slice(0, -3);
    if (word.endsWith('ed')) return word.slice(0, -2);
    if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
    return word;
  }

  expandWithSynonyms(tokens) {
    const expandedTokens = new Set(tokens);
    
    if (this.options.enableSynonyms) {
      for (const token of tokens) {
        const synonyms = this.synonyms.get(token);
        if (synonyms) {
          synonyms.forEach(synonym => expandedTokens.add(synonym));
        }
      }
    }
    
    return Array.from(expandedTokens);
  }

  async addDocument(id, content, metadata = {}) {
    const document = {
      id,
      content,
      metadata,
      terms: this.tokenize(content),
      addedAt: Date.now()
    };
    
    // Apply stemming if enabled
    if (this.options.enableStemming) {
      document.terms = document.terms.map(term => this.stem(term));
    }
    
    // Add to index
    this.index.documents.set(id, document);
    
    // Update term index
    for (const term of document.terms) {
      if (!this.index.terms.has(term)) {
        this.index.terms.set(term, new Set());
      }
      this.index.terms.get(term).add(id);
    }
    
    // Update metadata
    this.index.metadata.totalDocuments = this.index.documents.size;
    this.index.metadata.lastUpdated = Date.now();
    
    // Save index
    await this.saveIndex();
    
    console.log(`[SEARCH] Added document ${id} with ${document.terms.length} terms`);
  }

  async removeDocument(id) {
    const document = this.index.documents.get(id);
    if (!document) return false;
    
    // Remove from term index
    for (const term of document.terms) {
      const termDocs = this.index.terms.get(term);
      if (termDocs) {
        termDocs.delete(id);
        if (termDocs.size === 0) {
          this.index.terms.delete(term);
        }
      }
    }
    
    // Remove from document index
    this.index.documents.delete(id);
    
    // Update metadata
    this.index.metadata.totalDocuments = this.index.documents.size;
    this.index.metadata.lastUpdated = Date.now();
    
    // Save index
    await this.saveIndex();
    
    console.log(`[SEARCH] Removed document ${id}`);
    return true;
  }

  async search(query, options = {}) {
    const {
      limit = this.options.maxResults,
      offset = 0,
      filters = {},
      sortBy = 'relevance',
      sortOrder = 'desc'
    } = options;
    
    // Tokenize and expand query
    const queryTokens = this.tokenize(query);
    const expandedTokens = this.expandWithSynonyms(queryTokens);
    
    // Apply stemming if enabled
    const searchTerms = this.options.enableStemming 
      ? expandedTokens.map(term => this.stem(term))
      : expandedTokens;
    
    // Find matching documents
    const matches = new Map();
    
    for (const term of searchTerms) {
      const termDocs = this.index.terms.get(term);
      if (termDocs) {
        for (const docId of termDocs) {
          const score = matches.get(docId) || 0;
          matches.set(docId, score + 1);
        }
      }
    }
    
    // Convert to array and calculate relevance scores
    const results = [];
    for (const [docId, termMatches] of matches.entries()) {
      const document = this.index.documents.get(docId);
      if (!document) continue;
      
      // Calculate relevance score
      const relevanceScore = termMatches / searchTerms.length;
      
      // Apply filters
      if (!this.matchesFilters(document, filters)) continue;
      
      results.push({
        id: docId,
        score: relevanceScore,
        document,
        highlights: this.generateHighlights(document, searchTerms)
      });
    }
    
    // Sort results
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'date':
          comparison = a.document.addedAt - b.document.addedAt;
          break;
        case 'alphabetical':
          comparison = a.document.content.localeCompare(b.document.content);
          break;
        default:
          comparison = a.score - b.score;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    
    // Apply pagination
    const paginatedResults = results.slice(offset, offset + limit);
    
    console.log(`[SEARCH] Found ${results.length} results for query: "${query}"`);
    
    return {
      query,
      total: results.length,
      limit,
      offset,
      results: paginatedResults,
      searchTerms,
      processingTime: Date.now()
    };
  }

  matchesFilters(document, filters) {
    for (const [field, value] of Object.entries(filters)) {
      const docValue = document.metadata[field];
      
      if (Array.isArray(value)) {
        if (!value.includes(docValue)) return false;
      } else if (docValue !== value) {
        return false;
      }
    }
    
    return true;
  }

  generateHighlights(document, searchTerms) {
    const highlights = [];
    const content = document.content.toLowerCase();
    
    for (const term of searchTerms) {
      const index = content.indexOf(term.toLowerCase());
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(content.length, index + term.length + 50);
        const snippet = document.content.substring(start, end);
        
        highlights.push({
          term,
          snippet: snippet.replace(new RegExp(term, 'gi'), match => `<mark>${match}</mark>`)
        });
      }
    }
    
    return highlights;
  }

  async suggest(query, limit = 10) {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];
    
    const suggestions = new Map();
    
    // Find terms that start with or contain the query
    for (const [term, documents] of this.index.terms.entries()) {
      for (const queryToken of queryTokens) {
        if (term.startsWith(queryToken)) {
          const score = documents.size / this.index.metadata.totalDocuments;
          suggestions.set(term, Math.max(suggestions.get(term) || 0, score));
        }
      }
    }
    
    // Sort by score and return top suggestions
    return Array.from(suggestions.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term, score]) => ({ term, score }));
  }

  async getStats() {
    return {
      ...this.index.metadata,
      totalTerms: this.index.terms.size,
      averageTermsPerDocument: this.index.documents.size > 0 
        ? Array.from(this.index.documents.values())
            .reduce((sum, doc) => sum + doc.terms.length, 0) / this.index.documents.size
        : 0,
      stopWordsCount: this.stopWords.size,
      synonymsCount: this.synonyms.size
    };
  }

  async saveIndex() {
    try {
      const indexPath = path.join(this.options.indexDir, 'search-index.json');
      const indexData = {
        metadata: this.index.metadata,
        documents: Array.from(this.index.documents.entries()),
        terms: Array.from(this.index.terms.entries()).map(([term, docs]) => [term, Array.from(docs)])
      };
      
      await fs.writeFile(indexPath, JSON.stringify(indexData, null, 2));
    } catch (error) {
      console.error('[SEARCH] Failed to save index:', error);
    }
  }

  async loadIndex() {
    try {
      const indexPath = path.join(this.options.indexDir, 'search-index.json');
      const content = await fs.readFile(indexPath, 'utf8');
      const indexData = JSON.parse(content);
      
      this.index.metadata = indexData.metadata;
      this.index.documents = new Map(indexData.documents);
      this.index.terms = new Map(indexData.terms.map(([term, docs]) => [term, new Set(docs)]));
      
      console.log(`[SEARCH] Loaded index with ${this.index.documents.size} documents`);
    } catch (error) {
      console.log('[SEARCH] No existing index found, starting fresh');
    }
  }

  async rebuild() {
    console.log('[SEARCH] Rebuilding index...');
    
    this.index = {
      documents: new Map(),
      terms: new Map(),
      metadata: {
        totalDocuments: 0,
        lastUpdated: Date.now(),
        version: '1.0.0'
      }
    };
    
    await this.saveIndex();
    console.log('[SEARCH] Index rebuilt');
  }
}

module.exports = SearchEngine;
