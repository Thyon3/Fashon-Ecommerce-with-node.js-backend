const helmet = require('helmet');

// Security headers configuration
const securityHeaders = helmet({
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "https://api.stripe.com", "https://js.stripe.com"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      manifestSrc: ["'self'"],
      workerSrc: ["'self'"],
      upgradeInsecureRequests: [],
    },
  },

  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: { policy: "require-corp" },

  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: "same-origin" },

  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: "cross-origin" },

  // DNS Prefetch Control
  dnsPrefetchControl: { allow: false },

  // Expect-CT
  expectCt: {
    maxAge: 86400,
    enforce: true
  },

  // Feature Policy
  permittedCrossDomainPolicies: false,

  // Hide Powered-By Header
  hidePoweredBy: true,

  // HSTS
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // IE No Open
  ieNoOpen: true,

  // No Sniff
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permissions Policy
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      geolocation: ["'none'"],
      microphone: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      accelerometer: ["'none'"],
      autoplay: ["'none'"],
      encryptedMedia: ["'none'"],
      fullscreen: ["'none'"],
      gyroscope: ["'none" ],
      magnetometer: ["'none'"],
      midi: ["'none'"],
      pictureInPicture: ["'none'"],
      publickeyCredentialsGet: ["'none'"],
      screenWakeLock: ["'none'"],
      syncXhr: ["'none'"],
      xr: ["'none'"]
    }
  },

  // Referrer Policy
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },

  // X-Content-Type-Options
  xContentTypeOptions: true,

  // X-DNS-Prefetch-Control
  xDnsPrefetchControl: { allow: false },

  // X-Download-Options
  xDownloadOptions: true,

  // X-Frame-Options
  xFrameOptions: { action: 'deny' },

  // X-Permitted-Cross-Domain-Policies
  xPermittedCrossDomainPolicies: false,

  // X-XSS-Protection
  xXssProtection: { enabled: true, mode: 'block' }
});

// Rate limiting for security-sensitive endpoints
const createRateLimit = (windowMs, max, message) => {
  const rateLimit = require('express-rate-limit');
  
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many authentication attempts, please try again later'
);

const passwordResetRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Too many password reset attempts, please try again later'
);

const uploadRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads
  'Too many upload attempts, please try again later'
);

const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // 100 requests
  'Too many requests, please try again later'
);

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000', 'http://localhost:3001'];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count']
};

// Security middleware for API routes
const apiSecurity = (req, res, next) => {
  // Add security headers
  securityHeaders(req, res, () => {
    // Additional custom security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    // Add custom headers
    res.setHeader('X-API-Version', '1.0.0');
    res.setHeader('X-Response-Time', Date.now());
    
    next();
  });
};

// Input validation middleware
const validateInput = (req, res, next) => {
  // Check for common attack patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*<\/script>)/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ];

  const checkValue = (value) => {
    if (typeof value === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(v => checkValue(v));
    }
    return false;
  };

  // Check query parameters
  for (const [key, value] of Object.entries(req.query)) {
    if (checkValue(value)) {
      return res.status(400).json({
        error: 'Invalid input detected',
        field: key
      });
    }
  }

  // Check request body
  if (req.body) {
    if (checkValue(req.body)) {
      return res.status(400).json({
        error: 'Invalid input detected in request body'
      });
    }
  }

  next();
};

// IP whitelist middleware (optional)
const ipWhitelist = (req, res, next) => {
  const allowedIPs = process.env.ALLOWED_IPS 
    ? process.env.ALLOWED_IPS.split(',')
    : [];

  if (allowedIPs.length > 0) {
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      return res.status(403).json({
        error: 'Access denied from this IP address'
      });
    }
  }

  next();
};

// Request logging for security monitoring
const securityLogger = (req, res, next) => {
  const start = Date.now();
  
  // Log request details
  console.log(`Security Log: ${req.method} ${req.originalUrl} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent')}`);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - start;
    console.log(`Security Log: ${req.method} ${req.originalUrl} - Status: ${res.statusCode} - Duration: ${duration}ms`);
    
    // Log suspicious activities
    if (res.statusCode >= 400) {
      console.warn(`Security Alert: ${req.method} ${req.originalUrl} returned ${res.statusCode} from IP ${req.ip}`);
    }
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

module.exports = {
  securityHeaders,
  authRateLimit,
  passwordResetRateLimit,
  uploadRateLimit,
  generalRateLimit,
  corsOptions,
  apiSecurity,
  validateInput,
  ipWhitelist,
  securityLogger
};
