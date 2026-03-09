class EnvValidation {
  static validate() {
    const requiredEnvVars = [
      'NODE_ENV',
      'PORT',
      'HOST',
      'API_URL',
      'MONGODB_URI',
      'ACCESS_TOKEN_SECRETSTRING',
      'REFRESH_TOKEN_SECRETSTRING'
    ];
    
    const optionalEnvVars = [
      'ALLOWED_ORIGINS',
      'EMAIL_HOST',
      'EMAIL_PORT',
      'EMAIL_USER',
      'EMAIL_PASS',
      'REDIS_URL',
      'LOG_LEVEL',
      'WS_PORT'
    ];
    
    const missingRequired = [];
    const missingOptional = [];
    
    // Check required environment variables
    requiredEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        missingRequired.push(envVar);
      }
    });
    
    // Check optional environment variables
    optionalEnvVars.forEach(envVar => {
      if (!process.env[envVar]) {
        missingOptional.push(envVar);
      }
    });
    
    // Log warnings for missing optional variables
    if (missingOptional.length > 0) {
      console.warn('Missing optional environment variables:', missingOptional.join(', '));
    }
    
    // Throw error for missing required variables
    if (missingRequired.length > 0) {
      throw new Error(`Missing required environment variables: ${missingRequired.join(', ')}`);
    }
    
    // Validate specific environment variable formats
    this.validateFormats();
    
    console.log('Environment validation passed');
    return true;
  }
  
  static validateFormats() {
    // Validate PORT
    const port = parseInt(process.env.PORT);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error('PORT must be a valid port number (1-65535)');
    }
    
    // Validate NODE_ENV
    const validEnvs = ['development', 'production', 'test', 'staging'];
    if (!validEnvs.includes(process.env.NODE_ENV)) {
      throw new Error(`NODE_ENV must be one of: ${validEnvs.join(', ')}`);
    }
    
    // Validate MONGODB_URI format
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
      throw new Error('MONGODB_URI must start with mongodb:// or mongodb+srv://');
    }
    
    // Validate API_URL format
    const apiUrl = process.env.API_URL;
    if (!apiUrl.startsWith('/')) {
      throw new Error('API_URL must start with /');
    }
  }
}

module.exports = EnvValidation;
