const cors = require('cors');

class CORS {
  static middleware(options = {}) {
    const defaults = {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true,
      optionsSuccessStatus: 200
    };

    const corsOptions = { ...defaults, ...options };
    
    return cors(corsOptions);
  }

  static configure(app, options = {}) {
    app.use(this.middleware(options));
  }
}

module.exports = CORS;
