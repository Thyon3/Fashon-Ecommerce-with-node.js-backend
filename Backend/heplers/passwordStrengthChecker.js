const zxcvbn = require('zxcvbn');

class PasswordStrengthChecker {
  constructor() {
    this.minLength = 8;
    this.requireUppercase = true;
    this.requireLowercase = true;
    this.requireNumbers = true;
    this.requireSpecialChars = true;
    this.maxLength = 128;
    this.commonPasswords = new Set([
      'password', '123456', '123456789', 'qwerty', 'password123',
      'admin', 'letmein', 'welcome', 'monkey', '1234567890'
    ]);
  }

  // Check password strength
  checkStrength(password) {
    const result = {
      password: password,
      score: 0,
      strength: 'very_weak',
      feedback: [],
      warnings: [],
      suggestions: [],
      timeToCrack: null,
      meetsRequirements: false,
      requirements: {
        length: false,
        uppercase: false,
        lowercase: false,
        numbers: false,
        specialChars: false,
        notCommon: false
      }
    };

    // Check length
    if (password.length >= this.minLength) {
      result.requirements.length = true;
      result.score += 20;
    } else {
      result.feedback.push(`Password must be at least ${this.minLength} characters long`);
    }

    // Check maximum length
    if (password.length > this.maxLength) {
      result.feedback.push(`Password must not exceed ${this.maxLength} characters`);
      return result; // Fail early for too long passwords
    }

    // Check for uppercase letters
    if (this.requireUppercase && /[A-Z]/.test(password)) {
      result.requirements.uppercase = true;
      result.score += 15;
    } else if (this.requireUppercase) {
      result.feedback.push('Password must contain at least one uppercase letter');
    }

    // Check for lowercase letters
    if (this.requireLowercase && /[a-z]/.test(password)) {
      result.requirements.lowercase = true;
      result.score += 15;
    } else if (this.requireLowercase) {
      result.feedback.push('Password must contain at least one lowercase letter');
    }

    // Check for numbers
    if (this.requireNumbers && /\d/.test(password)) {
      result.requirements.numbers = true;
      result.score += 15;
    } else if (this.requireNumbers) {
      result.feedback.push('Password must contain at least one number');
    }

    // Check for special characters
    if (this.requireSpecialChars && /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      result.requirements.specialChars = true;
      result.score += 15;
    } else if (this.requireSpecialChars) {
      result.feedback.push('Password must contain at least one special character');
    }

    // Check for common passwords
    if (!this.commonPasswords.has(password.toLowerCase())) {
      result.requirements.notCommon = true;
      result.score += 20;
    } else {
      result.feedback.push('Password is too common and easily guessable');
      result.warnings.push('This is a commonly used password');
    }

    // Use zxcvbn for advanced analysis
    const zxcvbnResult = zxcvbn(password);
    
    // Add zxcvbn feedback
    result.feedback.push(...zxcvbnResult.feedback.suggestions);
    result.warnings.push(...zxcvbnResult.feedback.warning);
    result.timeToCrack = zxcvbnResult.crack_times_display.offline_slow_hashing_1e4_per_second;

    // Adjust score based on zxcvbn result
    result.score += zxcvbnResult.score * 10;

    // Determine strength level
    if (result.score >= 80) {
      result.strength = 'very_strong';
    } else if (result.score >= 60) {
      result.strength = 'strong';
    } else if (result.score >= 40) {
      result.strength = 'moderate';
    } else if (result.score >= 20) {
      result.strength = 'weak';
    } else {
      result.strength = 'very_weak';
    }

    // Check if all requirements are met
    result.meetsRequirements = Object.values(result.requirements).every(req => req === true);

    return result;
  }

  // Generate password suggestions
  generateSuggestions(length = 12) {
    const suggestions = [];
    
    // Strong password with all requirements
    suggestions.push(this.generatePassword(length, true, true, true, true));
    
    // Passphrase-style password
    suggestions.push(this.generatePassphrase());
    
    // Password with special characters
    suggestions.push(this.generatePassword(length, true, true, true, true, '!@#$%'));
    
    return suggestions;
  }

  // Generate random password
  generatePassword(length, includeUppercase = true, includeLowercase = true, includeNumbers = true, includeSpecial = true, specialChars = '!@#$%^&*') {
    let charset = '';
    let password = '';

    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeNumbers) charset += '0123456789';
    if (includeSpecial) charset += specialChars;

    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }

    return password;
  }

  // Generate passphrase
  generatePassphrase(wordCount = 4) {
    const words = [
      'apple', 'banana', 'orange', 'grape', 'lemon', 'peach', 'berry', 'melon',
      'happy', 'smile', 'laugh', 'joy', 'bright', 'sunny', 'cheer', 'glee',
      'mountain', 'river', 'ocean', 'forest', 'desert', 'valley', 'island', 'cloud',
      'coffee', 'pizza', 'burger', 'salad', 'pasta', 'bread', 'cheese', 'butter'
    ];

    const passphrase = [];
    for (let i = 0; i < wordCount; i++) {
      const randomIndex = Math.floor(Math.random() * words.length);
      passphrase.push(words[randomIndex]);
    }

    // Add a number and special character
    const number = Math.floor(Math.random() * 100);
    const special = '!@#$%^&*'.charAt(Math.floor(Math.random() * 8));

    return passphrase.join('-') + number + special;
  }

  // Check if password is compromised
  isCompromised(password) {
    // This would typically check against haveibeenpwned API
    // For now, just check against our common passwords list
    return this.commonPasswords.has(password.toLowerCase());
  }

  // Calculate entropy
  calculateEntropy(password) {
    const charsetSize = this.getCharsetSize(password);
    const entropy = password.length * Math.log2(charsetSize);
    return entropy;
  }

  // Get charset size
  getCharsetSize(password) {
    let size = 0;
    
    if (/[a-z]/.test(password)) size += 26;
    if (/[A-Z]/.test(password)) size += 26;
    if (/\d/.test(password)) size += 10;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) size += 32;
    
    return size || 1;
  }

  // Check password history
  checkHistory(newPassword, oldPasswords) {
    const results = [];
    
    for (const oldPassword of oldPasswords) {
      const similarity = this.calculateSimilarity(newPassword, oldPassword);
      results.push({
        oldPassword: '***', // Don't expose old passwords
        similarity,
        isTooSimilar: similarity > 0.8
      });
    }
    
    return results;
  }

  // Calculate password similarity
  calculateSimilarity(password1, password2) {
    const longer = password1.length > password2.length ? password1 : password2;
    const shorter = password1.length > password2.length ? password2 : password1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Levenshtein distance
  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  // Get password policy
  getPolicy() {
    return {
      minLength: this.minLength,
      maxLength: this.maxLength,
      requireUppercase: this.requireUppercase,
      requireLowercase: this.requireLowercase,
      requireNumbers: this.requireNumbers,
      requireSpecialChars: this.requireSpecialChars
    };
  }

  // Update password policy
  updatePolicy(options) {
    if (options.minLength !== undefined) this.minLength = options.minLength;
    if (options.maxLength !== undefined) this.maxLength = options.maxLength;
    if (options.requireUppercase !== undefined) this.requireUppercase = options.requireUppercase;
    if (options.requireLowercase !== undefined) this.requireLowercase = options.requireLowercase;
    if (options.requireNumbers !== undefined) this.requireNumbers = options.requireNumbers;
    if (options.requireSpecialChars !== undefined) this.requireSpecialChars = options.requireSpecialChars;
    
    console.log('[PASSWORD_STRENGTH] Password policy updated');
  }

  // Middleware for password validation
  middleware(options = {}) {
    const {
      field = 'password',
      required = true,
      minLength = this.minLength,
      checkStrength = true
    } = options;

    return (req, res, next) => {
      const password = req.body[field];

      if (required && !password) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'PASSWORD_REQUIRED',
            message: 'Password is required'
          }
        });
      }

      if (!password) {
        return next();
      }

      if (checkStrength) {
        const strength = this.checkStrength(password);
        
        if (!strength.meetsRequirements) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'PASSWORD_TOO_WEAK',
              message: 'Password does not meet requirements',
              feedback: strength.feedback,
              suggestions: this.generateSuggestions()
            }
          });
        }

        // Add strength result to request
        req.passwordStrength = strength;
      }

      next();
    };
  }

  // Export configuration
  exportConfig() {
    return {
      policy: this.getPolicy(),
      commonPasswords: Array.from(this.commonPasswords)
    };
  }

  // Import configuration
  importConfig(config) {
    try {
      if (config.policy) {
        this.updatePolicy(config.policy);
      }
      
      if (config.commonPasswords && Array.isArray(config.commonPasswords)) {
        this.commonPasswords = new Set(config.commonPasswords);
      }
      
      console.log('[PASSWORD_STRENGTH] Configuration imported successfully');
      
    } catch (error) {
      console.error('[PASSWORD_STRENGTH] Error importing configuration:', error);
      throw error;
    }
  }
}

// Create singleton instance
const passwordStrengthChecker = new PasswordStrengthChecker();

module.exports = passwordStrengthChecker;
