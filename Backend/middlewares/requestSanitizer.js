const sanitizeHtml = require('sanitize-html');

class RequestSanitizer {
  static middleware() {
    return (req, res, next) => {
      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }

      next();
    };
  }

  static sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];

        if (typeof value === 'string') {
          sanitized[key] = this.sanitizeString(value);
        } else if (Array.isArray(value)) {
          sanitized[key] = value.map(item => 
            typeof item === 'string' ? this.sanitizeString(item) : item
          );
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = this.sanitizeObject(value);
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  static sanitizeString(str) {
    // Remove HTML tags and sanitize
    const clean = sanitizeHtml(str, {
      allowedTags: [],
      allowedAttributes: {},
      textFilter: (text) => text.replace(/[<>]/g, '')
    });

    // Remove potential XSS patterns
    return clean
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<script/gi, '')
      .replace(/<\/script>/gi, '')
      .trim();
  }

  static sanitizeEmail(email) {
    if (typeof email !== 'string') return email;
    
    // Basic email sanitization
    return email.toLowerCase().trim().replace(/[^\w@.-]/g, '');
  }

  static sanitizePhone(phone) {
    if (typeof phone !== 'string') return phone;
    
    // Keep only digits and basic phone characters
    return phone.replace(/[^\d+\-\s()]/g, '');
  }

  static sanitizeFilename(filename) {
    if (typeof filename !== 'string') return filename;
    
    // Remove dangerous characters from filenames
    return filename.replace(/[^\w\s.-]/g, '').replace(/\s+/g, '_');
  }
}

module.exports = RequestSanitizer;
