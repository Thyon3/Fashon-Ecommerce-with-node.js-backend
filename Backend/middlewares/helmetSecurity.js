const helmet = require('helmet');

class HelmetSecurity {
  static middleware() {
    return helmet({
      // Content Security Policy
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          manifestSrc: ["'self'"]
        }
      },
      
      // Cross-Origin Embedder Policy
      crossOriginEmbedderPolicy: false,
      
      // Cross-Origin Opener Policy
      crossOriginOpenerPolicy: { policy: "same-origin" },
      
      // Cross-Origin Resource Policy
      crossOriginResourcePolicy: { policy: "cross-origin" },
      
      // DNS Prefetch Control
      dnsPrefetchControl: { allow: false },
      
      // Expect-CT
      expectCt: {
        maxAge: 86400,
        enforce: false
      },
      
      // Hide Powered-By Header
      hidePoweredBy: true,
      
      // HSTS
      hsts: {
        maxAge: 31536000,
        includeSubDomains: false,
        preload: false
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
          gyroscope: ["'none'"],
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
      
      // X-Frame-Options
      xFrameOptions: { action: 'deny' },
      
      // X-Permitted-Cross-Domain-Policies
      xPermittedCrossDomainPolicies: false,
      
      // X-XSS-Protection
      xXssProtection: { enabled: true, mode: 'block' }
    });
  }
}

module.exports = HelmetSecurity;
