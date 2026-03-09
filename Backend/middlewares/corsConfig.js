const cors = require('cors');

class CorsConfig {
  static middleware() {
    const corsOptions = {
      // Allow specific origins
      origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS 
          ? process.env.ALLOWED_ORIGINS.split(',')
          : [
              'http://localhost:3000',
              'http://localhost:3001',
              'http://localhost:8080',
              'http://localhost:8081'
            ];
        
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) === -1) {
          const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
          return callback(new Error(msg), false);
        }
        
        return callback(null, true);
      },
      
      // Allow credentials
      credentials: true,
      
      // Allowed methods
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
      
      // Allowed headers
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-API-Version',
        'X-Request-ID'
      ],
      
      // Exposed headers
      exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'X-Request-ID',
        'API-Version'
      ],
      
      // Preflight cache duration
      maxAge: 86400, // 24 hours
      
      // Pass preflight to next handler
      preflightContinue: false,
      
      // Options success status
      optionsSuccessStatus: 200
    };
    
    return cors(corsOptions);
  }
}

module.exports = CorsConfig;
