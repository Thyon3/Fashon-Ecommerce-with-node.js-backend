class Maintenance {
  static isActive = false;
  static message = 'System is under maintenance. Please try again later.';
  static allowedPaths = ['/health', '/health/live', '/health/ready'];

  static enable(message = this.message) {
    this.isActive = true;
    this.message = message;
    console.log('[MAINTENANCE] Mode enabled');
  }

  static disable() {
    this.isActive = false;
    console.log('[MAINTENANCE] Mode disabled');
  }

  static isAllowed(path) {
    return this.allowedPaths.some(allowedPath => path.startsWith(allowedPath));
  }

  static middleware() {
    return (req, res, next) => {
      if (this.isActive && !this.isAllowed(req.originalUrl)) {
        return res.status(503).json({
          success: false,
          error: this.message,
          timestamp: new Date().toISOString()
        });
      }

      next();
    };
  }

  static status() {
    return {
      active: this.isActive,
      message: this.isActive ? this.message : null,
      allowedPaths: this.allowedPaths
    };
  }

  static toggle() {
    if (this.isActive) {
      this.disable();
    } else {
      this.enable();
    }
    return this.status();
  }
}

module.exports = Maintenance;
