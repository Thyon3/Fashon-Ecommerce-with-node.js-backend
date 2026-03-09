const Session = require('../models/session');
const crypto = require('crypto');

class SessionManager {
  // Create new session
  static async createSession(userId, deviceInfo = {}) {
    try {
      const sessionToken = this.generateToken();
      const refreshToken = this.generateToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      const session = await Session.create({
        userId,
        sessionToken,
        refreshToken,
        deviceInfo,
        expiresAt,
        isActive: true
      });
      
      console.log(`[SESSION] Created session for user ${userId}`);
      
      return {
        sessionId: session._id,
        sessionToken,
        refreshToken,
        expiresAt
      };
      
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }
  
  // Validate session
  static async validateSession(sessionToken) {
    try {
      const session = await Session.findOne({
        sessionToken,
        isActive: true,
        expiresAt: { $gt: new Date() }
      }).populate('userId', 'name email isAdmin');
      
      if (!session) {
        return null;
      }
      
      // Update last activity
      await session.updateLastActivity();
      
      return session;
      
    } catch (error) {
      console.error('Error validating session:', error);
      return null;
    }
  }
  
  // Refresh session
  static async refreshSession(refreshToken) {
    try {
      const session = await Session.findOne({
        refreshToken,
        isActive: true,
        expiresAt: { $gt: new Date() }
      });
      
      if (!session) {
        throw new Error('Invalid or expired refresh token');
      }
      
      // Generate new tokens
      const newSessionToken = this.generateToken();
      const newRefreshToken = this.generateToken();
      const newExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      
      // Update session
      session.sessionToken = newSessionToken;
      session.refreshToken = newRefreshToken;
      session.expiresAt = newExpiresAt;
      await session.save();
      
      console.log(`[SESSION] Refreshed session for user ${session.userId}`);
      
      return {
        sessionId: session._id,
        sessionToken: newSessionToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt
      };
      
    } catch (error) {
      console.error('Error refreshing session:', error);
      throw error;
    }
  }
  
  // Deactivate session
  static async deactivateSession(sessionToken) {
    try {
      const session = await Session.findOne({ sessionToken });
      
      if (session) {
        await session.deactivate();
        console.log(`[SESSION] Deactivated session ${session._id}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error deactivating session:', error);
      return false;
    }
  }
  
  // Deactivate all user sessions
  static async deactivateAllUserSessions(userId) {
    try {
      const result = await Session.deactivateAllUserSessions(userId);
      console.log(`[SESSION] Deactivated ${result.modifiedCount} sessions for user ${userId}`);
      return result.modifiedCount;
      
    } catch (error) {
      console.error('Error deactivating user sessions:', error);
      return 0;
    }
  }
  
  // Get active sessions for user
  static async getUserSessions(userId) {
    try {
      const sessions = await Session.findActiveSessionsByUser(userId);
      return sessions;
      
    } catch (error) {
      console.error('Error getting user sessions:', error);
      return [];
    }
  }
  
  // Get session statistics
  static async getSessionStats() {
    try {
      const totalSessions = await Session.countDocuments();
      const activeSessions = await Session.countDocuments({ isActive: true });
      const expiredSessions = await Session.countDocuments({ 
        isActive: true, 
        expiresAt: { $lt: new Date() } 
      });
      
      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        cleanupNeeded: expiredSessions > 0
      };
      
    } catch (error) {
      console.error('Error getting session stats:', error);
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        cleanupNeeded: false
      };
    }
  }
  
  // Clean up expired sessions
  static async cleanupExpiredSessions() {
    try {
      const result = await Session.deactivateExpiredSessions();
      console.log(`[SESSION] Cleaned up ${result.modifiedCount} expired sessions`);
      return result.modifiedCount;
      
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      return 0;
    }
  }
  
  // Middleware to validate session
  static middleware() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return next();
        }
        
        const token = authHeader.substring(7);
        const session = await this.validateSession(token);
        
        if (session) {
          req.user = session.userId;
          req.session = session;
          req.sessionId = session._id;
        }
        
        next();
        
      } catch (error) {
        console.error('Session middleware error:', error);
        next();
      }
    };
  }
  
  // Middleware to require active session
  static requireSession() {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'SESSION_REQUIRED',
            message: 'Authentication required',
            statusCode: 401
          }
        });
      }
      
      next();
    };
  }
  
  // Generate secure token
  static generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
  
  // Get session by ID
  static async getSessionById(sessionId) {
    try {
      const session = await Session.findById(sessionId).populate('userId', 'name email');
      return session;
      
    } catch (error) {
      console.error('Error getting session by ID:', error);
      return null;
    }
  }
  
  // Update session device info
  static async updateSessionDevice(sessionId, deviceInfo) {
    try {
      const session = await Session.findById(sessionId);
      
      if (session) {
        session.deviceInfo = { ...session.deviceInfo, ...deviceInfo };
        await session.save();
        return true;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error updating session device info:', error);
      return false;
    }
  }
  
  // Check session activity
  static async checkSessionActivity(sessionId) {
    try {
      const session = await Session.findById(sessionId);
      
      if (!session) {
        return null;
      }
      
      const now = new Date();
      const lastActivity = session.lastActivity || session.createdAt;
      const inactiveTime = now - lastActivity;
      
      return {
        sessionId,
        isActive: session.isActive && session.expiresAt > now,
        lastActivity,
        inactiveTime,
        expiresAt: session.expiresAt
      };
      
    } catch (error) {
      console.error('Error checking session activity:', error);
      return null;
    }
  }
}

module.exports = SessionManager;
