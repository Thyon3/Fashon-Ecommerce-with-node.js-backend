const bodyParser = require('body-parser');

class RequestSizeLimit {
  static middleware(options = {}) {
    const {
      jsonLimit = '10mb',
      urlencodedLimit = '10mb',
      textLimit = '10mb',
      rawLimit = '10mb'
    } = options;
    
    return [
      // JSON body parser with size limit
      bodyParser.json({
        limit: jsonLimit,
        verify: (req, res, buf) => {
          this.checkRequestSize(req, buf.length, 'json', jsonLimit);
        }
      }),
      
      // URL-encoded body parser with size limit
      bodyParser.urlencoded({
        extended: true,
        limit: urlencodedLimit,
        verify: (req, res, buf) => {
          this.checkRequestSize(req, buf.length, 'urlencoded', urlencodedLimit);
        }
      }),
      
      // Text body parser with size limit
      bodyParser.text({
        limit: textLimit,
        verify: (req, res, buf) => {
          this.checkRequestSize(req, buf.length, 'text', textLimit);
        }
      }),
      
      // Raw body parser with size limit
      bodyParser.raw({
        limit: rawLimit,
        verify: (req, res, buf) => {
          this.checkRequestSize(req, buf.length, 'raw', rawLimit);
        }
      })
    ];
  }
  
  static checkRequestSize(req, size, type, limit) {
    const limitInBytes = this.parseLimit(limit);
    
    if (size > limitInBytes) {
      const error = {
        error: 'Request Too Large',
        message: `Request body too large. Maximum size is ${limit}`,
        actualSize: size,
        maxSize: limitInBytes,
        type: type
      };
      
      console.warn(`[SIZE_LIMIT] Request rejected: ${req.method} ${req.originalUrl} - Size: ${size} bytes, Limit: ${limit}`);
      
      // This will be handled by the error middleware
      throw new Error(`Request entity too large: ${size} bytes, limit is ${limit}`);
    }
  }
  
  static parseLimit(limit) {
    if (typeof limit === 'number') {
      return limit;
    }
    
    const units = {
      'b': 1,
      'kb': 1024,
      'mb': 1024 * 1024,
      'gb': 1024 * 1024 * 1024
    };
    
    const match = limit.toString().toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
    
    if (!match) {
      throw new Error(`Invalid limit format: ${limit}`);
    }
    
    const value = parseFloat(match[1]);
    const unit = match[2] || 'b';
    
    return value * units[unit];
  }
  
  // Get request size statistics
  static getSizeStats() {
    return {
      jsonLimit: '10mb',
      urlencodedLimit: '10mb',
      textLimit: '10mb',
      rawLimit: '10mb',
      maxSize: this.parseLimit('10mb')
    };
  }
}

module.exports = RequestSizeLimit;
