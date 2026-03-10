class Timeout {
  static middleware(timeoutMs = 30000) {
    return (req, res, next) => {
      const timeout = setTimeout(() => {
        if (!res.headersSent) {
          res.status(408).json({
            success: false,
            error: 'Request timeout'
          });
        }
      }, timeoutMs);

      res.on('finish', () => clearTimeout(timeout));
      res.on('close', () => clearTimeout(timeout));

      next();
    };
  }

  static short() {
    return this.middleware(5000); // 5 seconds
  }

  static long() {
    return this.middleware(120000); // 2 minutes
  }
}

module.exports = Timeout;
