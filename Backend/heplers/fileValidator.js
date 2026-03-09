const path = require('path');
const fs = require('fs');

class FileValidator {
  constructor() {
    this.allowedMimeTypes = new Set([
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/json',
      'application/xml', 'text/xml', 'text/csv'
    ]);
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.allowedExtensions = new Set([
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.pdf', '.txt', '.json', '.xml', '.csv'
    ]);
    this.dangerousExtensions = new Set([
      '.exe', '.bat', '.cmd', '.com', '.pif', '.scr',
      '.vbs', '.js', '.jar', '.app', '.deb', '.pkg',
      '.dmg', '.rpm', '.msi', '.php', '.asp', '.jsp'
    ]);
  }

  // Validate file
  validateFile(file, options = {}) {
    const config = {
      maxSize: options.maxSize || this.maxFileSize,
      allowedMimeTypes: options.allowedMimeTypes || this.allowedMimeTypes,
      allowedExtensions: options.allowedExtensions || this.allowedExtensions,
      checkContent: options.checkContent !== false
    };

    const result = {
      filename: file.originalname || file.name,
      size: file.size || 0,
      mimetype: file.mimetype,
      extension: this.getExtension(file.originalname || file.name),
      isValid: false,
      errors: [],
      warnings: [],
      metadata: {}
    };

    // Check file size
    if (result.size > config.maxSize) {
      result.errors.push(`File size (${this.formatBytes(result.size)}) exceeds maximum allowed size (${this.formatBytes(config.maxSize)})`);
    } else {
      result.metadata.sizeOk = true;
    }

    // Check file extension
    if (!config.allowedExtensions.has(result.extension.toLowerCase())) {
      result.errors.push(`File extension ${result.extension} is not allowed`);
    } else {
      result.metadata.extensionOk = true;
    }

    // Check for dangerous extensions
    if (this.dangerousExtensions.has(result.extension.toLowerCase())) {
      result.errors.push(`File extension ${result.extension} is dangerous and not allowed`);
    }

    // Check MIME type
    if (!config.allowedMimeTypes.has(result.mimetype)) {
      result.errors.push(`MIME type ${result.mimetype} is not allowed`);
    } else {
      result.metadata.mimeTypeOk = true;
    }

    // Check MIME type and extension consistency
    if (result.metadata.extensionOk && result.metadata.mimeTypeOk) {
      const expectedMime = this.getMimeTypeFromExtension(result.extension);
      if (expectedMime && expectedMime !== result.mimetype) {
        result.warnings.push(`MIME type ${result.mimetype} does not match extension ${result.extension}`);
        result.metadata.mimeExtensionMismatch = true;
      }
    }

    // Check filename for suspicious patterns
    const filenameAnalysis = this.analyzeFilename(result.filename);
    result.metadata.filenameAnalysis = filenameAnalysis;
    
    if (filenameAnalysis.isSuspicious) {
      result.warnings.push('Filename contains suspicious patterns');
    }

    // Content validation (if file buffer is available)
    if (config.checkContent && file.buffer) {
      const contentAnalysis = this.analyzeContent(file.buffer, result.mimetype);
      result.metadata.contentAnalysis = contentAnalysis;
      
      if (contentAnalysis.isSuspicious) {
        result.errors.push('File content appears suspicious');
      }
    }

    // Final validation
    result.isValid = result.errors.length === 0;

    return result;
  }

  // Get file extension
  getExtension(filename) {
    return path.extname(filename).toLowerCase();
  }

  // Get MIME type from extension
  getMimeTypeFromExtension(extension) {
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.xml': 'application/xml',
      '.csv': 'text/csv'
    };

    return mimeTypes[extension.toLowerCase()];
  }

  // Analyze filename for suspicious patterns
  analyzeFilename(filename) {
    const analysis = {
      isSuspicious: false,
      issues: [],
      score: 0
    };

    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      analysis.isSuspicious = true;
      analysis.issues.push('Contains dangerous characters');
      analysis.score -= 20;
    }

    // Check for double extensions
    const parts = filename.split('.');
    if (parts.length > 2) {
      analysis.isSuspicious = true;
      analysis.issues.push('Multiple extensions detected');
      analysis.score -= 15;
    }

    // Check for executable patterns
    const executablePatterns = /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar)$/i;
    if (executablePatterns.test(filename)) {
      analysis.isSuspicious = true;
      analysis.issues.push('Executable file pattern detected');
      analysis.score -= 25;
    }

    // Check for script patterns
    const scriptPatterns = /\.(php|asp|jsp|rb|py|pl|sh)$/i;
    if (scriptPatterns.test(filename)) {
      analysis.isSuspicious = true;
      analysis.issues.push('Script file pattern detected');
      analysis.score -= 20;
    }

    // Check for very long filenames
    if (filename.length > 255) {
      analysis.isSuspicious = true;
      analysis.issues.push('Filename too long');
      analysis.score -= 10;
    }

    // Check for reserved names (Windows)
    const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i;
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    if (reservedNames.test(nameWithoutExt)) {
      analysis.isSuspicious = true;
      analysis.issues.push('Reserved filename detected');
      analysis.score -= 15;
    }

    return analysis;
  }

  // Analyze file content
  analyzeContent(buffer, mimetype) {
    const analysis = {
      isSuspicious: false,
      issues: [],
      score: 0,
      actualMimeType: null
    };

    // Basic content type detection
    analysis.actualMimeType = this.detectContentType(buffer);

    // Check if actual MIME type matches declared MIME type
    if (analysis.actualMimeType && analysis.actualMimeType !== mimetype) {
      analysis.isSuspicious = true;
      analysis.issues.push(`Declared MIME type (${mimetype}) does not match actual content type (${analysis.actualMimeType})`);
      analysis.score -= 20;
    }

    // Check for executable content in non-executable files
    if (this.hasExecutableContent(buffer)) {
      analysis.isSuspicious = true;
      analysis.issues.push('File contains executable content');
      analysis.score -= 25;
    }

    // Check for script content
    if (this.hasScriptContent(buffer)) {
      analysis.isSuspicious = true;
      analysis.issues.push('File contains script content');
      analysis.score -= 20;
    }

    // Check for suspicious strings
    const suspiciousStrings = this.findSuspiciousStrings(buffer);
    if (suspiciousStrings.length > 0) {
      analysis.isSuspicious = true;
      analysis.issues.push(`File contains suspicious strings: ${suspiciousStrings.join(', ')}`);
      analysis.score -= 15;
    }

    return analysis;
  }

  // Detect content type from buffer
  detectContentType(buffer) {
    if (!buffer || buffer.length < 4) return null;

    // Check file signatures
    const signatures = {
      [0x89504E47]: 'image/png',
      [0xFFD8FF]: 'image/jpeg',
      [0x47494638]: 'image/gif',
      [0x25504446]: 'application/pdf',
      [0x504B0304]: 'application/zip',
      [0x4D5A9000]: 'application/x-msdownload' // PE executable
    };

    const signature = buffer.readUInt32BE(0);
    return signatures[signature] || null;
  }

  // Check for executable content
  hasExecutableContent(buffer) {
    if (!buffer || buffer.length < 2) return false;

    // Check for PE header
    if (buffer[0] === 0x4D && buffer[1] === 0x5A) { // MZ header
      return true;
    }

    // Check for ELF header
    if (buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
      return true;
    }

    return false;
  }

  // Check for script content
  hasScriptContent(buffer) {
    if (!buffer) return false;

    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    
    const scriptPatterns = [
      /<script/i,
      /<%/i,
      /<\?php/i,
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i
    ];

    return scriptPatterns.some(pattern => pattern.test(content));
  }

  // Find suspicious strings
  findSuspiciousStrings(buffer) {
    if (!buffer) return [];

    const content = buffer.toString('utf8', 0, Math.min(buffer.length, 2048));
    const suspiciousStrings = [];

    const patterns = [
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /document\./i,
      /window\./i
    ];

    patterns.forEach(pattern => {
      if (pattern.test(content)) {
        suspiciousStrings.push(pattern.source);
      }
    });

    return suspiciousStrings;
  }

  // Format bytes to human readable format
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Sanitize filename
  sanitizeFilename(filename) {
    // Remove dangerous characters
    let sanitized = filename.replace(/[<>:"|?*\x00-\x1f]/g, '_');
    
    // Remove leading/trailing spaces and dots
    sanitized = sanitized.trim().replace(/^\.+/, '');
    
    // Limit length
    if (sanitized.length > 255) {
      const ext = path.extname(sanitized);
      const name = path.basename(sanitized, ext);
      const maxNameLength = 255 - ext.length;
      sanitized = name.substring(0, maxNameLength) + ext;
    }
    
    // Ensure it's not empty
    if (sanitized === '') {
      sanitized = 'file';
    }
    
    return sanitized;
  }

  // Generate safe filename
  generateSafeFilename(originalFilename) {
    const ext = path.extname(originalFilename);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    
    return `${timestamp}_${random}${ext}`;
  }

  // Update configuration
  updateConfig(options) {
    if (options.allowedMimeTypes) {
      this.allowedMimeTypes = new Set(options.allowedMimeTypes);
    }
    
    if (options.maxFileSize) {
      this.maxFileSize = options.maxFileSize;
    }
    
    if (options.allowedExtensions) {
      this.allowedExtensions = new Set(options.allowedExtensions);
    }
    
    console.log('[FILE_VALIDATOR] Configuration updated');
  }

  // Get configuration
  getConfig() {
    return {
      allowedMimeTypes: Array.from(this.allowedMimeTypes),
      maxFileSize: this.maxFileSize,
      allowedExtensions: Array.from(this.allowedExtensions),
      dangerousExtensions: Array.from(this.dangerousExtensions)
    };
  }

  // Middleware for file validation
  middleware(options = {}) {
    const {
      field = 'file',
      required = false,
      multiple = false
    } = options;

    return (req, res, next) => {
      const files = multiple ? (req.files?.[field] || []) : [req.file].filter(Boolean);

      if (required && files.length === 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_REQUIRED',
            message: 'File is required'
          }
        });
      }

      if (files.length === 0) {
        return next();
      }

      const validations = files.map(file => this.validateFile(file, options));
      const invalidFiles = validations.filter(v => !v.isValid);

      if (invalidFiles.length > 0) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'FILE_VALIDATION_FAILED',
            message: 'File validation failed',
            invalidFiles
          }
        });
      }

      // Add validation results to request
      req.fileValidations = validations;
      
      next();
    };
  }

  // Export configuration
  exportConfig() {
    return this.getConfig();
  }

  // Import configuration
  importConfig(config) {
    try {
      this.updateConfig(config);
      console.log('[FILE_VALIDATOR] Configuration imported successfully');
    } catch (error) {
      console.error('[FILE_VALIDATOR] Error importing configuration:', error);
      throw error;
    }
  }
}

// Create singleton instance
const fileValidator = new FileValidator();

module.exports = fileValidator;
