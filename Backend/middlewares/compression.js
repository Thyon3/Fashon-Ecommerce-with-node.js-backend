const compression = require('compression');

class CompressionMiddleware {
  static middleware() {
    return compression({
      // Compress only text-based responses
      filter: (req, res) => {
        if (req.headers['x-no-compression']) {
          return false;
        }
        
        // Only compress responses with these content types
        const contentType = res.getHeader('Content-Type');
        if (!contentType) return false;
        
        const compressibleTypes = [
          'text/',
          'application/json',
          'application/javascript',
          'application/xml',
          'text/html',
          'text/css',
          'text/plain',
          'text/xml'
        ];
        
        return compressibleTypes.some(type => contentType.includes(type));
      },
      
      // Compression level (1-9, where 9 is highest compression)
      level: 6,
      
      // Threshold for compression (only compress responses larger than this)
      threshold: 1024,
      
      // Compression options
      chunkSize: 16 * 1024, // 16KB chunks
      windowBits: 15,
      memLevel: 8
    });
  }
}

module.exports = CompressionMiddleware;
