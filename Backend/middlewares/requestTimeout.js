class RequestTimeout {
  static middleware(timeout = 30000) {
    return (req, res, next) => {
      // Set timeout for the request
      req.setTimeout(timeout, () => {
        if (!res.headersSent) {
          res.status(408).json({
            error: 'Request Timeout',
            message: `Request took longer than ${timeout}ms`,
            timeout: timeout
          });
        }
      });
      
      // Add timeout to response headers
      res.setHeader('X-Request-Timeout', timeout);
      
      // Clear timeout when response is sent
      res.on('finish', () => {
        clearTimeout(req.socket?.timeout);
      });
      
      next();
    };
  }
}

module.exports = RequestTimeout;
