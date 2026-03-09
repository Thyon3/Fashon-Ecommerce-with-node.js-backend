const validator = require('validator');

class EmailValidator {
  constructor() {
    this.disposableDomains = new Set([
      '10minutemail.com', 'mailinator.com', 'guerrillamail.com',
      'tempmail.org', 'yopmail.com', 'maildrop.cc'
    ]);
    this.suspiciousPatterns = [
      /\+.*\d+/, // email+123@domain.com
      /^[a-z]{1,2}\d+/, // ab123@domain.com
      /test\d*@/i, // test123@domain.com
      /dummy/i, // dummy@domain.com
      /fake/i, // fake@domain.com
      /temp/i // temp@domain.com
    ];
  }

  // Basic email validation
  isValid(email) {
    if (!email || typeof email !== 'string') {
      return false;
    }

    // Use validator library for basic validation
    return validator.isEmail(email);
  }

  // Advanced email validation
  validateAdvanced(email) {
    const result = {
      email: email,
      isValid: false,
      isDisposable: false,
      isSuspicious: false,
      hasValidDomain: false,
      hasValidFormat: false,
      errors: [],
      score: 0
    };

    // Basic format validation
    if (!this.isValid(email)) {
      result.errors.push('Invalid email format');
      return result;
    }

    result.hasValidFormat = true;
    result.score += 25;

    // Extract domain
    const domain = email.split('@')[1].toLowerCase();
    
    // Check domain format
    if (!validator.isFQDN(domain)) {
      result.errors.push('Invalid domain format');
      return result;
    }

    result.hasValidDomain = true;
    result.score += 25;

    // Check for disposable email domains
    if (this.isDisposableDomain(domain)) {
      result.isDisposable = true;
      result.errors.push('Disposable email domain detected');
      result.score -= 20;
    }

    // Check for suspicious patterns
    if (this.isSuspicious(email)) {
      result.isSuspicious = true;
      result.errors.push('Suspicious email pattern detected');
      result.score -= 15;
    }

    // Check email length
    if (email.length > 50) {
      result.errors.push('Email address too long');
      result.score -= 10;
    }

    // Check for common typos in popular domains
    const commonTypos = this.checkCommonTypos(domain);
    if (commonTypos) {
      result.errors.push(`Possible typo: did you mean ${commonTypos}?`);
      result.score -= 5;
    }

    // Final validation
    result.isValid = result.score >= 50 && result.errors.length === 0;

    return result;
  }

  // Check if domain is disposable
  isDisposableDomain(domain) {
    return this.disposableDomains.has(domain);
  }

  // Check for suspicious patterns
  isSuspicious(email) {
    return this.suspiciousPatterns.some(pattern => pattern.test(email));
  }

  // Check for common domain typos
  checkCommonTypos(domain) {
    const commonDomains = {
      'gamil.com': 'gmail.com',
      'gmial.com': 'gmail.com',
      'gnail.com': 'gmail.com',
      'yahooo.com': 'yahoo.com',
      'yhoo.com': 'yahoo.com',
      'hotmial.com': 'hotmail.com',
      'hotmai.com': 'hotmail.com',
      'outlok.com': 'outlook.com',
      'outlook.co': 'outlook.com'
    };

    return commonDomains[domain] || null;
  }

  // Normalize email
  normalize(email) {
    if (!this.isValid(email)) {
      return null;
    }

    const normalized = email.toLowerCase().trim();
    
    // Remove dots from Gmail addresses
    if (normalized.includes('@gmail.com')) {
      const [local, domain] = normalized.split('@');
      return local.replace(/\./g, '') + '@' + domain;
    }

    return normalized;
  }

  // Check if two emails are equivalent (after normalization)
  areEquivalent(email1, email2) {
    const normalized1 = this.normalize(email1);
    const normalized2 = this.normalize(email2);
    
    return normalized1 === normalized2;
  }

  // Extract domain from email
  getDomain(email) {
    if (!this.isValid(email)) {
      return null;
    }

    return email.split('@')[1].toLowerCase();
  }

  // Extract local part from email
  getLocalPart(email) {
    if (!this.isValid(email)) {
      return null;
    }

    return email.split('@')[0].toLowerCase();
  }

  // Check if email is from a specific domain
  isFromDomain(email, domain) {
    const emailDomain = this.getDomain(email);
    return emailDomain === domain.toLowerCase();
  }

  // Check if email is from a specific domain list
  isFromDomains(email, domains) {
    const emailDomain = this.getDomain(email);
    return domains.some(domain => emailDomain === domain.toLowerCase());
  }

  // Get email suggestions for common typos
  getSuggestions(email) {
    const suggestions = [];
    const domain = this.getDomain(email);
    
    if (!domain) {
      return suggestions;
    }

    const commonTypos = this.checkCommonTypos(domain);
    if (commonTypos) {
      const localPart = this.getLocalPart(email);
      suggestions.push(`${localPart}@${commonTypos}`);
    }

    return suggestions;
  }

  // Validate multiple emails
  validateMultiple(emails) {
    return emails.map(email => this.validateAdvanced(email));
  }

  // Get validation statistics
  getStats(emails) {
    const results = this.validateMultiple(emails);
    
    return {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      disposable: results.filter(r => r.isDisposable).length,
      suspicious: results.filter(r => r.isSuspicious).length,
      averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length
    };
  }

  // Add disposable domain
  addDisposableDomain(domain) {
    this.disposableDomains.add(domain.toLowerCase());
    console.log(`[EMAIL_VALIDATOR] Added disposable domain: ${domain}`);
  }

  // Remove disposable domain
  removeDisposableDomain(domain) {
    this.disposableDomains.delete(domain.toLowerCase());
    console.log(`[EMAIL_VALIDATOR] Removed disposable domain: ${domain}`);
  }

  // Add suspicious pattern
  addSuspiciousPattern(pattern) {
    this.suspiciousPatterns.push(new RegExp(pattern));
    console.log(`[EMAIL_VALIDATOR] Added suspicious pattern: ${pattern}`);
  }

  // Export configuration
  exportConfig() {
    return {
      disposableDomains: Array.from(this.disposableDomains),
      suspiciousPatterns: this.suspiciousPatterns.map(p => p.source)
    };
  }

  // Import configuration
  importConfig(config) {
    try {
      if (config.disposableDomains && Array.isArray(config.disposableDomains)) {
        this.disposableDomains = new Set(config.disposableDomains);
      }
      
      if (config.suspiciousPatterns && Array.isArray(config.suspiciousPatterns)) {
        this.suspiciousPatterns = config.suspiciousPatterns.map(p => new RegExp(p));
      }
      
      console.log('[EMAIL_VALIDATOR] Configuration imported successfully');
      
    } catch (error) {
      console.error('[EMAIL_VALIDATOR] Error importing configuration:', error);
      throw error;
    }
  }

  // Middleware for email validation
  middleware(options = {}) {
    const {
      field = 'email',
      required = true,
      advanced = true,
      allowDisposable = false,
      allowSuspicious = false
    } = options;

    return (req, res, next) => {
      const email = req.body[field];

      if (required && !email) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_REQUIRED',
            message: 'Email address is required'
          }
        });
      }

      if (!email) {
        return next();
      }

      const validation = advanced ? this.validateAdvanced(email) : { isValid: this.isValid(email) };

      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_INVALID',
            message: 'Invalid email address',
            details: validation.errors || []
          }
        });
      }

      if (!allowDisposable && validation.isDisposable) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_DISPOSABLE',
            message: 'Disposable email addresses are not allowed'
          }
        });
      }

      if (!allowSuspicious && validation.isSuspicious) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'EMAIL_SUSPICIOUS',
            message: 'Email address appears suspicious'
          }
        });
      }

      // Add validation result to request
      req.emailValidation = validation;
      
      next();
    };
  }
}

// Create singleton instance
const emailValidator = new EmailValidator();

module.exports = emailValidator;
