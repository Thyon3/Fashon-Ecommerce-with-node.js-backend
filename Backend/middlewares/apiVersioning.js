class ApiVersioning {
  static middleware() {
    return (req, res, next) => {
      // Get version from header, query parameter, or default to v1
      const version = req.headers['api-version'] || 
                      req.query.version || 
                      req.headers['x-api-version'] || 
                      'v1';
      
      // Validate version format
      if (!version.match(/^v\d+$/)) {
        return res.status(400).json({
          error: 'Invalid API version format. Use format: v1, v2, etc.',
          supportedVersions: ['v1']
        });
      }
      
      // Set version on request object
      req.apiVersion = version;
      
      // Add version info to response headers
      res.setHeader('API-Version', version);
      res.setHeader('Supported-Versions', 'v1');
      
      // Add version to response
      const originalJson = res.json;
      res.json = function(data) {
        if (typeof data === 'object' && data !== null) {
          data.apiVersion = version;
        }
        return originalJson.call(this, data);
      };
      
      next();
    };
  }
}

module.exports = ApiVersioning;
