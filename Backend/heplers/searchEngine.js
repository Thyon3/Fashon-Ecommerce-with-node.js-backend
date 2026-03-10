class SearchEngine {
  constructor() {
    this.index = new Map();
    this.documents = new Map();
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'under', 'along', 'following',
      'across', 'behind', 'beyond', 'plus', 'except', 'but', 'yet', 'so', 'nor',
      'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'shall', 'this', 'that', 'these', 'those', 'i', 'you',
      'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
      'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
      'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
      'so', 'than', 'too', 'very', 'just', 'now'
    ]);
    this.minWordLength = 2;
    this.maxWordLength = 50;
  }

  // Add document to index
  addDocument(id, content, metadata = {}) {
    const document = {
      id,
      content: content.toString(),
      metadata,
      words: this.tokenize(content),
      indexedAt: new Date()
    };

    // Remove existing document if it exists
    this.removeDocument(id);

    // Add to documents collection
    this.documents.set(id, document);

    // Index words
    document.words.forEach((word, index) => {
      if (!this.index.has(word)) {
        this.index.set(word, new Map());
      }
      
      const wordIndex = this.index.get(word);
      
      if (!wordIndex.has(id)) {
        wordIndex.set(id, []);
      }
      
      wordIndex.get(id).push(index);
    });

    console.log(`[SEARCH] Indexed document: ${id} (${document.words.length} words)`);
    
    return document;
  }

  // Remove document from index
  removeDocument(id) {
    const document = this.documents.get(id);
    
    if (document) {
      // Remove from word index
      document.words.forEach(word => {
        const wordIndex = this.index.get(word);
        if (wordIndex) {
          wordIndex.delete(id);
          
          if (wordIndex.size === 0) {
            this.index.delete(word);
          }
        }
      });
      
      // Remove from documents
      this.documents.delete(id);
      
      console.log(`[SEARCH] Removed document: ${id}`);
    }
    
    return document;
  }

  // Tokenize text into words
  tokenize(text) {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => 
        word.length >= this.minWordLength &&
        word.length <= this.maxWordLength &&
        !this.stopWords.has(word) &&
        !/^\d+$/.test(word) // Remove pure numbers
      );

    return words;
  }

  // Search documents
  search(query, options = {}) {
    const {
      limit = 10,
      offset = 0,
      sortBy = 'relevance',
      filters = {},
      fuzzy = false,
      boost = {}
    } = options;

    const queryWords = this.tokenize(query);
    
    if (queryWords.length === 0) {
      return {
        query,
        results: [],
        total: 0,
        offset,
        limit
      };
    }

    // Find matching documents
    const matches = this.findMatches(queryWords, fuzzy);
    
    // Apply filters
    const filteredMatches = this.applyFilters(matches, filters);
    
    // Calculate relevance scores
    const scoredResults = this.calculateScores(filteredMatches, queryWords, boost);
    
    // Sort results
    const sortedResults = this.sortResults(scoredResults, sortBy);
    
    // Apply pagination
    const paginatedResults = sortedResults.slice(offset, offset + limit);
    
    return {
      query,
      results: paginatedResults,
      total: sortedResults.length,
      offset,
      limit,
      queryWords,
      searchTime: Date.now()
    };
  }

  // Find matching documents
  findMatches(queryWords, fuzzy = false) {
    const matches = new Map();
    
    queryWords.forEach(word => {
      let matchingWords = [word];
      
      // Add fuzzy matches if enabled
      if (fuzzy) {
        matchingWords = matchingWords.concat(this.findFuzzyMatches(word));
      }
      
      matchingWords.forEach(matchWord => {
        const wordIndex = this.index.get(matchWord);
        
        if (wordIndex) {
          wordIndex.forEach((positions, docId) => {
            if (!matches.has(docId)) {
              matches.set(docId, {
                id: docId,
                document: this.documents.get(docId),
                matches: new Map(),
                totalMatches: 0
              });
            }
            
            const match = matches.get(docId);
            match.matches.set(matchWord, positions);
            match.totalMatches += positions.length;
          });
        }
      });
    });
    
    return Array.from(matches.values());
  }

  // Find fuzzy matches
  findFuzzyMatches(word) {
    const fuzzyWords = [];
    const maxDistance = Math.max(1, Math.floor(word.length * 0.2)); // 20% of word length
    
    for (const indexedWord of this.index.keys()) {
      const distance = this.levenshteinDistance(word, indexedWord);
      
      if (distance <= maxDistance && distance > 0) {
        fuzzyWords.push(indexedWord);
      }
    }
    
    return fuzzyWords;
  }

  // Calculate Levenshtein distance
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Apply filters to matches
  applyFilters(matches, filters) {
    return matches.filter(match => {
      const doc = match.document;
      
      // Check metadata filters
      for (const [key, value] of Object.entries(filters)) {
        if (doc.metadata[key] !== value) {
          return false;
        }
      }
      
      return true;
    });
  }

  // Calculate relevance scores
  calculateScores(matches, queryWords, boost = {}) {
    return matches.map(match => {
      let score = 0;
      
      // Base score from total matches
      score += match.totalMatches * 10;
      
      // Bonus for exact word matches
      queryWords.forEach(word => {
        const positions = match.matches.get(word);
        if (positions) {
          score += positions.length * 20;
        }
      });
      
      // Bonus for word proximity (words close together)
      score += this.calculateProximityBonus(match.matches, queryWords);
      
      // Bonus for document metadata
      if (boost[match.document.metadata.type]) {
        score *= boost[match.document.metadata.type];
      }
      
      // Bonus for recent documents
      const daysOld = (Date.now() - match.document.indexedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysOld < 7) {
        score *= 1.2; // 20% boost for recent documents
      }
      
      return {
        ...match,
        score: Math.round(score * 100) / 100 // Round to 2 decimal places
      };
    });
  }

  // Calculate proximity bonus
  calculateProximityBonus(matches, queryWords) {
    let bonus = 0;
    
    if (queryWords.length < 2) {
      return bonus;
    }
    
    // Simple proximity calculation: check if words appear close together
    const positions = new Map();
    
    queryWords.forEach(word => {
      const wordPositions = matches.get(word);
      if (wordPositions) {
        positions.set(word, wordPositions);
      }
    });
    
    if (positions.size < 2) {
      return bonus;
    }
    
    // Check proximity between all word pairs
    const wordPairs = Array.from(positions.keys());
    
    for (let i = 0; i < wordPairs.length; i++) {
      for (let j = i + 1; j < wordPairs.length; j++) {
        const word1 = wordPairs[i];
        const word2 = wordPairs[j];
        const positions1 = positions.get(word1);
        const positions2 = positions.get(word2);
        
        // Find minimum distance between any positions
        let minDistance = Infinity;
        
        positions1.forEach(pos1 => {
          positions2.forEach(pos2 => {
            const distance = Math.abs(pos1 - pos2);
            if (distance < minDistance) {
              minDistance = distance;
            }
          });
        });
        
        // Add bonus based on proximity
        if (minDistance < 5) {
          bonus += 50;
        } else if (minDistance < 10) {
          bonus += 25;
        } else if (minDistance < 20) {
          bonus += 10;
        }
      }
    }
    
    return bonus;
  }

  // Sort results
  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'relevance':
        return results.sort((a, b) => b.score - a.score);
      case 'date':
        return results.sort((a, b) => b.document.indexedAt - a.document.indexedAt);
      case 'matches':
        return results.sort((a, b) => b.totalMatches - a.totalMatches);
      default:
        return results.sort((a, b) => b.score - a.score);
    }
  }

  // Get suggestions for autocomplete
  getSuggestions(partial, limit = 5) {
    const partialLower = partial.toLowerCase();
    const suggestions = [];
    
    for (const word of this.index.keys()) {
      if (word.startsWith(partialLower) && suggestions.length < limit) {
        suggestions.push(word);
      }
    }
    
    return suggestions.sort();
  }

  // Get popular search terms
  getPopularTerms(limit = 10) {
    const termCounts = new Map();
    
    for (const [word, documents] of this.index.entries()) {
      termCounts.set(word, documents.size);
    }
    
    return Array.from(termCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([term, count]) => ({ term, count }));
  }

  // Get index statistics
  getStats() {
    const totalDocuments = this.documents.size;
    const totalWords = this.index.size;
    let totalWordOccurrences = 0;
    
    for (const documents of this.index.values()) {
      for (const positions of documents.values()) {
        totalWordOccurrences += positions.length;
      }
    }
    
    return {
      totalDocuments,
      totalWords,
      totalWordOccurrences,
      averageWordsPerDocument: totalDocuments > 0 ? totalWordOccurrences / totalDocuments : 0,
      indexSize: this.index.size,
      stopWordsCount: this.stopWords.size
    };
  }

  // Optimize index
  optimizeIndex() {
    // Remove words that appear in too many documents (not useful for search)
    const maxDocumentRatio = 0.8; // If a word appears in more than 80% of documents, remove it
    const totalDocuments = this.documents.size;
    const wordsToRemove = [];
    
    for (const [word, documents] of this.index.entries()) {
      if (documents.size / totalDocuments > maxDocumentRatio) {
        wordsToRemove.push(word);
      }
    }
    
    wordsToRemove.forEach(word => {
      this.index.delete(word);
    });
    
    console.log(`[SEARCH] Optimized index: removed ${wordsToRemove.length} common words`);
    
    return wordsToRemove.length;
  }

  // Export index
  exportIndex() {
    const exportData = {
      index: {},
      documents: {},
      metadata: {
        exportedAt: new Date(),
        totalDocuments: this.documents.size,
        totalWords: this.index.size
      }
    };
    
    // Export index
    for (const [word, documents] of this.index.entries()) {
      exportData.index[word] = Object.fromEntries(documents);
    }
    
    // Export documents (without content to save space)
    for (const [id, document] of this.documents.entries()) {
      exportData.documents[id] = {
        id: document.id,
        metadata: document.metadata,
        indexedAt: document.indexedAt,
        wordCount: document.words.length
      };
    }
    
    return exportData;
  }

  // Import index
  importIndex(exportData) {
    // Clear existing index
    this.index.clear();
    this.documents.clear();
    
    // Import documents
    for (const [id, docData] of Object.entries(exportData.documents)) {
      this.documents.set(id, {
        id: docData.id,
        content: '', // Content not exported
        metadata: docData.metadata,
        words: [], // Words not exported
        indexedAt: new Date(docData.indexedAt)
      });
    }
    
    // Import index
    for (const [word, documents] of Object.entries(exportData.index)) {
      this.index.set(word, new Map(Object.entries(documents)));
    }
    
    console.log(`[SEARCH] Imported index: ${exportData.metadata.totalDocuments} documents, ${exportData.metadata.totalWords} words`);
  }

  // Clear index
  clearIndex() {
    this.index.clear();
    this.documents.clear();
    console.log('[SEARCH] Index cleared');
  }

  // Add stop word
  addStopWord(word) {
    this.stopWords.add(word.toLowerCase());
    console.log(`[SEARCH] Added stop word: ${word}`);
  }

  // Remove stop word
  removeStopWord(word) {
    this.stopWords.delete(word.toLowerCase());
    console.log(`[SEARCH] Removed stop word: ${word}`);
  }

  // Get stop words
  getStopWords() {
    return Array.from(this.stopWords);
  }
}

// Create singleton instance
const searchEngine = new SearchEngine();

module.exports = searchEngine;
