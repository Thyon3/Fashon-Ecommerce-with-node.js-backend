const crypto = require('crypto');

class Encryption {
  constructor() {
    this.algorithm = 'aes-256-gcm';
    this.keyLength = 32;
    this.ivLength = 16;
    this.tagLength = 16;
    this.secretKey = this.getEncryptionKey();
  }

  // Get encryption key from environment
  getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    
    if (!key) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }
    
    // Ensure key is correct length
    return crypto.scryptSync(key, 'salt', this.keyLength);
  }

  // Encrypt data
  encrypt(text) {
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipher(this.algorithm, this.secretKey);
      cipher.setAAD(Buffer.from('additional-data', 'utf8'));
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex')
      };
      
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  // Decrypt data
  decrypt(encryptedData) {
    try {
      const { encrypted, iv, tag } = encryptedData;
      
      const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
      decipher.setAAD(Buffer.from('additional-data', 'utf8'));
      decipher.setAuthTag(Buffer.from(tag, 'hex'));
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
      
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // Encrypt sensitive fields in an object
  encryptObject(obj, sensitiveFields = []) {
    const encryptedObj = JSON.parse(JSON.stringify(obj));
    
    sensitiveFields.forEach(field => {
      if (encryptedObj[field]) {
        const value = encryptedObj[field];
        encryptedObj[field] = this.encrypt(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    });
    
    return encryptedObj;
  }

  // Decrypt sensitive fields in an object
  decryptObject(obj, sensitiveFields = []) {
    const decryptedObj = JSON.parse(JSON.stringify(obj));
    
    sensitiveFields.forEach(field => {
      if (decryptedObj[field] && typeof decryptedObj[field] === 'object') {
        try {
          const decrypted = this.decrypt(decryptedObj[field]);
          decryptedObj[field] = decrypted;
        } catch (error) {
          // If decryption fails, keep original value
          console.warn(`Failed to decrypt field ${field}:`, error.message);
        }
      }
    });
    
    return decryptedObj;
  }

  // Hash password
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    
    return {
      hash,
      salt
    };
  }

  // Verify password
  verifyPassword(password, hash, salt) {
    const hashVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === hashVerify;
  }

  // Generate secure token
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  // Generate secure random string
  generateRandomString(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }

  // Create HMAC signature
  createHmac(data, secret = null) {
    const hmacSecret = secret || process.env.HMAC_SECRET || this.secretKey;
    const hmac = crypto.createHmac('sha256', hmacSecret);
    hmac.update(data);
    return hmac.digest('hex');
  }

  // Verify HMAC signature
  verifyHmac(data, signature, secret = null) {
    const expectedSignature = this.createHmac(data, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Encrypt JWT payload
  encryptJWTPayload(payload) {
    const payloadString = JSON.stringify(payload);
    return this.encrypt(payloadString);
  }

  // Decrypt JWT payload
  decryptJWTPayload(encryptedPayload) {
    const decryptedString = this.decrypt(encryptedPayload);
    return JSON.parse(decryptedString);
  }

  // Encrypt sensitive data for database storage
  encryptForDatabase(data) {
    const sensitiveFields = [
      'creditCard',
      'ssn',
      'bankAccount',
      'password',
      'secret',
      'token',
      'key'
    ];
    
    return this.encryptObject(data, sensitiveFields);
  }

  // Decrypt sensitive data from database
  decryptFromDatabase(data) {
    const sensitiveFields = [
      'creditCard',
      'ssn',
      'bankAccount',
      'password',
      'secret',
      'token',
      'key'
    ];
    
    return this.decryptObject(data, sensitiveFields);
  }

  // Generate secure session ID
  generateSessionId() {
    return this.generateToken(64);
  }

  // Generate API key
  generateApiKey() {
    const prefix = 'fk_'; // fashon key
    const key = this.generateRandomString(32);
    return prefix + key;
  }

  // Validate API key format
  validateApiKey(apiKey) {
    return typeof apiKey === 'string' && 
           apiKey.startsWith('fk_') && 
           apiKey.length === 35;
  }

  // Encrypt file content
  encryptFile(buffer) {
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipher(this.algorithm, this.secretKey);
    
    let encrypted = cipher.update(buffer);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  // Decrypt file content
  decryptFile(encryptedData) {
    const { encrypted, iv, tag } = encryptedData;
    
    const decipher = crypto.createDecipher(this.algorithm, this.secretKey);
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  // Get encryption info
  getEncryptionInfo() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      tagLength: this.tagLength
    };
  }

  // Test encryption/decryption
  test() {
    try {
      const testData = 'This is a test message';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      
      return testData === decrypted;
      
    } catch (error) {
      console.error('Encryption test failed:', error);
      return false;
    }
  }

  // Rotate encryption key (placeholder - would require re-encrypting all data)
  rotateKey() {
    console.warn('Key rotation not implemented - would require re-encrypting all encrypted data');
    return false;
  }
}

// Create singleton instance
const encryption = new Encryption();

module.exports = encryption;
