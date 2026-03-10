class Version {
  static version = process.env.APP_VERSION || '1.0.0';
  static buildNumber = process.env.BUILD_NUMBER || 'dev';
  static buildDate = process.env.BUILD_DATE || new Date().toISOString();

  static middleware() {
    return (req, res, next) => {
      res.setHeader('X-API-Version', this.version);
      res.setHeader('X-Build-Number', this.buildNumber);
      res.setHeader('X-Build-Date', this.buildDate);
      next();
    };
  }

  static info() {
    return {
      version: this.version,
      buildNumber: this.buildNumber,
      buildDate: this.buildDate,
      nodeVersion: process.version,
      environment: process.env.NODE_ENV || 'development'
    };
  }

  static endpoint(req, res) {
    res.json({
      success: true,
      data: this.info(),
      timestamp: new Date().toISOString()
    });
  }

  static compare(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  static isCompatible(requiredVersion) {
    return this.compare(this.version, requiredVersion) >= 0;
  }
}

module.exports = Version;
