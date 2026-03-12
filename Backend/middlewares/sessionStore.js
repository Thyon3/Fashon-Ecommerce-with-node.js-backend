const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class SessionStore extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      store: options.store || 'memory', // memory, file, redis, database
      secret: options.secret || process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
      maxAge: options.maxAge || 24 * 60 * 60 * 1000, // 24 hours
      rolling: options.rolling || false,
      resave: options.resave || false,
      saveUninitialized: options.saveUninitialized || false,
      touchAfter: options.touchAfter || 0,
      cookie: {
        path: options.cookie?.path || '/',
        httpOnly: options.cookie?.httpOnly !== false,
        secure: options.cookie?.secure || false,
        sameSite: options.cookie?.sameSite || 'lax',
        maxAge: options.cookie?.maxAge || options.maxAge,
        domain: options.cookie?.domain
      },
      name: options.name || 'sessionId',
      enableMetrics: options.enableMetrics !== false,
      enableCleanup: options.enableCleanup !== false,
      cleanupInterval: options.cleanupInterval || 60 * 60 * 1000, // 1 hour
      enableEncryption: options.enableEncryption || false,
      enableCompression: options.enableCompression || false,
      ...options
    };
    
    this.sessions = new Map();
    this.metrics = {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      createdSessions: 0,
      destroyedSessions: 0,
      touchedSessions: 0,
      averageSessionDuration: 0,
      sessionsByHour: new Map()
    };
    
    this.sessionDurations = [];
    
    this.init();
  }

  init() {
    if (this.options.enableCleanup) {
      this.startCleanup();
    }
    
    console.log(`[SESSION_STORE] Session store initialized with strategy: ${this.options.store}`);
  }

  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  encryptSession(session) {
    if (!this.options.enableEncryption) {
      return session;
    }
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.options.secret, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(session), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  decryptSession(encryptedData) {
    if (!this.options.enableEncryption) {
      return encryptedData;
    }
    
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.options.secret, 'salt', 32);
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipher(algorithm, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  compressSession(session) {
    if (!this.options.enableCompression) {
      return session;
    }
    
    const jsonString = JSON.stringify(session);
    return Buffer.from(jsonString, 'utf8').toString('base64');
  }

  decompressSession(compressedData) {
    if (!this.options.enableCompression) {
      return compressedData;
    }
    
    const buffer = Buffer.from(compressedData, 'base64');
    return JSON.parse(buffer.toString('utf8'));
  }

  async createSession(data = {}) {
    const sessionId = this.generateSessionId();
    const now = Date.now();
    
    const session = {
      id: sessionId,
      data: {
        ...data,
        createdAt: now,
        lastTouched: now,
        cookie: {
          originalMaxAge: this.options.maxAge,
          originalSecure: this.options.cookie.secure,
          originalHttpOnly: this.options.cookie.httpOnly,
          originalPath: this.options.cookie.path,
          originalDomain: this.options.cookie.domain
        }
      }
    };
    
    // Process session based on store type
    let processedSession = session;
    
    if (this.options.enableCompression) {
      processedSession = this.compressSession(session);
    }
    
    if (this.options.enableEncryption) {
      processedSession = this.encryptSession(processedSession);
    }
    
    // Store session
    await this.storeSession(sessionId, processedSession);
    
    // Update metrics
    this.metrics.totalSessions++;
    this.metrics.activeSessions++;
    this.metrics.createdSessions++;
    this.sessionDurations.push({ createdAt: now, duration: 0 });
    
    this.emit('session:created', session);
    
    return session;
  }

  async storeSession(sessionId, sessionData) {
    switch (this.options.store) {
      case 'memory':
        this.sessions.set(sessionId, sessionData);
        break;
      case 'file':
        await this.storeSessionToFile(sessionId, sessionData);
        break;
      case 'redis':
        await this.storeSessionToRedis(sessionId, sessionData);
        break;
      case 'database':
        await this.storeSessionToDatabase(sessionId, sessionData);
        break;
    }
  }

  async storeSessionToFile(sessionId, sessionData) {
    try {
      const sessionDir = path.join(process.cwd(), 'sessions');
      await fs.mkdir(sessionDir, { recursive: true });
      
      const sessionFile = path.join(sessionDir, `${sessionId}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
    } catch (error) {
      console.error('[SESSION_STORE] Failed to store session to file:', error);
    }
  }

  async storeSessionToRedis(sessionId, sessionData) {
    // Simulate Redis storage
    // In production, use actual Redis client
    console.log(`[SESSION_STORE] Storing session to Redis: ${sessionId}`);
  }

  async storeSessionToDatabase(sessionId, sessionData) {
    // Simulate database storage
    // In production, use actual database client
    console.log(`[SESSION_STORE] Storing session to database: ${sessionId}`);
  }

  async getSession(sessionId) {
    let sessionData;
    
    switch (this.options.store) {
      case 'memory':
        sessionData = this.sessions.get(sessionId);
        break;
      case 'file':
        sessionData = await this.getSessionFromFile(sessionId);
        break;
      case 'redis':
        sessionData = await this.getSessionFromRedis(sessionId);
        break;
      case 'database':
        sessionData = await this.getSessionFromDatabase(sessionId);
        break;
    }
    
    if (!sessionData) {
      return null;
    }
    
    // Decompress if needed
    if (this.options.enableCompression) {
      sessionData = this.decompressSession(sessionData);
    }
    
    // Decrypt if needed
    if (this.options.enableEncryption) {
      sessionData = this.decryptSession(sessionData);
    }
    
    // Check if session is expired
    const now = Date.now();
    const sessionAge = now - sessionData.data.createdAt;
    
    if (sessionAge > this.options.maxAge) {
      await this.destroySession(sessionId);
      this.metrics.expiredSessions++;
      return null;
    }
    
    // Touch session if needed
    if (this.options.rolling || (this.options.touchAfter > 0 && sessionAge > this.options.touchAfter)) {
      sessionData.data.lastTouched = now;
      await this.storeSession(sessionId, sessionData);
      this.metrics.touchedSessions++;
    }
    
    return sessionData;
  }

  async getSessionFromFile(sessionId) {
    try {
      const sessionFile = path.join(process.cwd(), 'sessions', `${sessionId}.json`);
      const content = await fs.readFile(sessionFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  async getSessionFromRedis(sessionId) {
    // Simulate Redis retrieval
    // In production, use actual Redis client
    console.log(`[SESSION_STORE] Getting session from Redis: ${sessionId}`);
    return null;
  }

  async getSessionFromDatabase(sessionId) {
    // Simulate database retrieval
    // In production, use actual database client
    console.log(`[SESSION_STORE] Getting session from database: ${sessionId}`);
    return null;
  }

  async destroySession(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return false;
    }
    
    // Remove from store
    switch (this.options.store) {
      case 'memory':
        this.sessions.delete(sessionId);
        break;
      case 'file':
        await this.destroySessionFromFile(sessionId);
        break;
      case 'redis':
        await this.destroySessionFromRedis(sessionId);
        break;
      case 'database':
        await this.destroySessionFromDatabase(sessionId);
        break;
    }
    
    // Update metrics
    this.metrics.activeSessions--;
    this.metrics.destroyedSessions++;
    
    // Update session duration
    const duration = Date.now() - session.data.createdAt;
    this.sessionDurations.push({ createdAt: session.data.createdAt, duration });
    
    // Keep only last 1000 durations
    if (this.sessionDurations.length > 1000) {
      this.sessionDurations = this.sessionDurations.slice(-1000);
    }
    
    this.emit('session:destroyed', session);
    
    return true;
  }

  async destroySessionFromFile(sessionId) {
    try {
      const sessionFile = path.join(process.cwd(), 'sessions', `${sessionId}.json`);
      await fs.unlink(sessionFile);
    } catch (error) {
      console.error('[SESSION_STORE] Failed to destroy session from file:', error);
    }
  }

  async destroySessionFromRedis(sessionId) {
    // Simulate Redis deletion
    console.log(`[SESSION_STORE] Destroying session from Redis: ${sessionId}`);
  }

  async destroySessionFromDatabase(sessionId) {
    // Simulate database deletion
    console.log(`[SESSION_STORE] Destroying session from database: ${sessionId}`);
  }

  async updateSession(sessionId, data) {
    const session = await this.getSession(sessionId);
    
    if (!session) {
      return null;
    }
    
    // Update session data
    Object.assign(session.data, data);
    session.data.lastTouched = Date.now();
    
    // Store updated session
    let processedSession = session;
    
    if (this.options.enableCompression) {
      processedSession = this.compressSession(session);
    }
    
    if (this.options.enableEncryption) {
      processedSession = this.encryptSession(processedSession);
    }
    
    await this.storeSession(sessionId, processedSession);
    
    this.emit('session:updated', session);
    
    return session;
  }

  async touchSession(sessionId) {
    const session = await this.getSession(sessionId);
    
    if (session) {
      session.data.lastTouched = Date.now();
      
      let processedSession = session;
      
      if (this.options.enableCompression) {
        processedSession = this.compressSession(session);
      }
      
      if (this.options.enableEncryption) {
        processedSession = this.encryptSession(processedSession);
      }
      
      await this.storeSession(sessionId, processedSession);
      this.metrics.touchedSessions++;
    }
    
    return session;
  }

  async getAllSessions() {
    const sessions = [];
    
    switch (this.options.store) {
      case 'memory':
        for (const [sessionId, sessionData] of this.sessions.entries()) {
          const session = await this.getSession(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
        break;
      case 'file':
        const sessionDir = path.join(process.cwd(), 'sessions');
        try {
          const files = await fs.readdir(sessionDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const sessionId = path.basename(file, '.json');
              const session = await this.getSession(sessionId);
              if (session) {
                sessions.push(session);
              }
            }
          }
        } catch (error) {
          console.error('[SESSION_STORE] Failed to read sessions from file:', error);
        }
        break;
      default:
        // For Redis and database, implement accordingly
        break;
    }
    
    return sessions;
  }

  async getActiveSessionsCount() {
    let count = 0;
    
    switch (this.options.store) {
      case 'memory':
        count = this.sessions.size;
        break;
      case 'file':
        const sessionDir = path.join(process.cwd(), 'sessions');
        try {
          const files = await fs.readdir(sessionDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const sessionId = path.basename(file, '.json');
              const session = await this.getSession(sessionId);
              if (session) {
                count++;
              }
            }
          }
        } catch (error) {
          console.error('[SESSION_STORE] Failed to count sessions from file:', error);
        }
        break;
      default:
        count = this.metrics.activeSessions;
        break;
    }
    
    return count;
  }

  startCleanup() {
    setInterval(async () => {
      await this.cleanupExpiredSessions();
    }, this.options.cleanupInterval);
    
    console.log('[SESSION_STORE] Session cleanup started');
  }

  async cleanupExpiredSessions() {
    const now = Date.now();
    let cleaned = 0;
    
    switch (this.options.store) {
      case 'memory':
        for (const [sessionId, sessionData] of this.sessions.entries()) {
          const session = await this.getSession(sessionId);
          if (!session) {
            cleaned++;
          }
        }
        break;
      case 'file':
        const sessionDir = path.join(process.cwd(), 'sessions');
        try {
          const files = await fs.readdir(sessionDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              const sessionId = path.basename(file, '.json');
              const session = await this.getSession(sessionId);
              if (!session) {
                await this.destroySessionFromFile(sessionId);
                cleaned++;
              }
            }
          }
        } catch (error) {
          console.error('[SESSION_STORE] Failed to cleanup sessions from file:', error);
        }
        break;
      default:
        // For Redis and database, implement accordingly
        break;
    }
    
    if (cleaned > 0) {
      console.log(`[SESSION_STORE] Cleaned up ${cleaned} expired sessions`);
    }
  }

  getStats() {
    const avgDuration = this.sessionDurations.length > 0
      ? this.sessionDurations.reduce((sum, d) => sum + d.duration, 0) / this.sessionDurations.length
      : 0;
    
    return {
      ...this.metrics,
      averageSessionDuration: avgDuration,
      store: this.options.store,
      maxAge: this.options.maxAge,
      storeType: this.options.store
    };
  }

  async clearAllSessions() {
    switch (this.options.store) {
      case 'memory':
        this.sessions.clear();
        break;
      case 'file':
        const sessionDir = path.join(process.cwd(), 'sessions');
        try {
          const files = await fs.readdir(sessionDir);
          
          for (const file of files) {
            if (file.endsWith('.json')) {
              await fs.unlink(path.join(sessionDir, file));
            }
          }
        } catch (error) {
          console.error('[SESSION_STORE] Failed to clear sessions from file:', error);
        }
        break;
      default:
        // For Redis and database, implement accordingly
        break;
    }
    
    // Reset metrics
    this.metrics.activeSessions = 0;
    
    console.log('[SESSION_STORE] All sessions cleared');
  }

  middleware() {
    return (req, res, next) => {
      // Add session methods to request
      req.sessionStore = this;
      
      // Generate session ID if not present
      if (!req.sessionId) {
        req.sessionId = this.generateSessionId();
      }
      
      next();
    };
  }

  // Static method to create session store
  static create(options = {}) {
    return new SessionStore(options);
  }
}

module.exports = SessionStore;
