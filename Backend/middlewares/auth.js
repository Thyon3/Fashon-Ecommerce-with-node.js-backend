const jwt = require('jsonwebtoken');

class Auth {
  static generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '24h'
    });
  }

  static verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET);
  }

  static middleware() {
    return (req, res, next) => {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Access denied'
        });
      }

      try {
        const decoded = this.verifyToken(token);
        req.user = decoded;
        next();
      } catch (error) {
        res.status(401).json({
          success: false,
          error: 'Invalid token'
        });
      }
    };
  }

  static optional() {
    return (req, res, next) => {
      const token = req.header('Authorization')?.replace('Bearer ', '');

      if (token) {
        try {
          const decoded = this.verifyToken(token);
          req.user = decoded;
        } catch (error) {
          // Token is invalid but we continue without user
        }
      }

      next();
    };
  }

  static admin() {
    return (req, res, next) => {
      if (!req.user || !req.user.isAdmin) {
        return res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
      }
      next();
    };
  }
}

module.exports = Auth;
