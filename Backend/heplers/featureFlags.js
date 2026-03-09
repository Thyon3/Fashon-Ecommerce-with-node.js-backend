class FeatureFlags {
  constructor() {
    this.flags = new Map();
    this.loadDefaultFlags();
  }

  // Load default feature flags
  loadDefaultFlags() {
    const defaultFlags = {
      // User features
      'user.registration': {
        enabled: true,
        description: 'Allow user registration',
        rolloutPercentage: 100
      },
      'user.social_login': {
        enabled: false,
        description: 'Enable social media login',
        rolloutPercentage: 0
      },
      'user.two_factor_auth': {
        enabled: false,
        description: 'Enable two-factor authentication',
        rolloutPercentage: 0
      },
      
      // Product features
      'product.reviews': {
        enabled: true,
        description: 'Enable product reviews',
        rolloutPercentage: 100
      },
      'product.wishlist': {
        enabled: true,
        description: 'Enable wishlist functionality',
        rolloutPercentage: 100
      },
      'product.comparison': {
        enabled: true,
        description: 'Enable product comparison',
        rolloutPercentage: 100
      },
      'product.recommendations': {
        enabled: true,
        description: 'Enable product recommendations',
        rolloutPercentage: 100
      },
      
      // Order features
      'order.tracking': {
        enabled: true,
        description: 'Enable order tracking',
        rolloutPercentage: 100
      },
      'order.real_time_updates': {
        enabled: false,
        description: 'Enable real-time order updates',
        rolloutPercentage: 0
      },
      'order.guest_checkout': {
        enabled: false,
        description: 'Enable guest checkout',
        rolloutPercentage: 0
      },
      
      // Payment features
      'payment.stripe': {
        enabled: true,
        description: 'Enable Stripe payments',
        rolloutPercentage: 100
      },
      'payment.paypal': {
        enabled: false,
        description: 'Enable PayPal payments',
        rolloutPercentage: 0
      },
      'payment.crypto': {
        enabled: false,
        description: 'Enable cryptocurrency payments',
        rolloutPercentage: 0
      },
      
      // Admin features
      'admin.analytics': {
        enabled: true,
        description: 'Enable admin analytics dashboard',
        rolloutPercentage: 100
      },
      'admin.bulk_operations': {
        enabled: false,
        description: 'Enable bulk operations',
        rolloutPercentage: 0
      },
      'admin.advanced_search': {
        enabled: true,
        description: 'Enable advanced search',
        rolloutPercentage: 100
      },
      
      // System features
      'system.caching': {
        enabled: true,
        description: 'Enable response caching',
        rolloutPercentage: 100
      },
      'system.rate_limiting': {
        enabled: true,
        description: 'Enable rate limiting',
        rolloutPercentage: 100
      },
      'system.audit_logging': {
        enabled: true,
        description: 'Enable audit logging',
        rolloutPercentage: 100
      },
      'system.performance_monitoring': {
        enabled: true,
        description: 'Enable performance monitoring',
        rolloutPercentage: 100
      },
      
      // Beta features
      'beta.new_ui': {
        enabled: false,
        description: 'Enable new UI (beta)',
        rolloutPercentage: 10
      },
      'beta.ai_search': {
        enabled: false,
        description: 'Enable AI-powered search (beta)',
        rolloutPercentage: 5
      },
      'beta.voice_search': {
        enabled: false,
        description: 'Enable voice search (beta)',
        rolloutPercentage: 0
      }
    };

    defaultFlags.forEach((flag, key) => {
      this.flags.set(key, flag);
    });
  }

  // Check if feature is enabled for a user
  isEnabled(featureName, user = null) {
    const flag = this.flags.get(featureName);
    
    if (!flag) {
      console.warn(`Feature flag '${featureName}' not found`);
      return false;
    }

    // If feature is completely disabled
    if (!flag.enabled) {
      return false;
    }

    // If rollout is 100%, enabled for everyone
    if (flag.rolloutPercentage >= 100) {
      return true;
    }

    // If rollout is 0%, disabled for everyone
    if (flag.rolloutPercentage <= 0) {
      return false;
    }

    // For partial rollout, check user ID
    if (user && user.id) {
      const hash = this.hashUserId(user.id);
      return hash < flag.rolloutPercentage;
    }

    // Default to disabled for anonymous users in partial rollout
    return false;
  }

  // Hash user ID for consistent rollout
  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) % 100;
  }

  // Get feature flag details
  getFlag(featureName) {
    return this.flags.get(featureName);
  }

  // Get all feature flags
  getAllFlags() {
    const result = {};
    this.flags.forEach((flag, key) => {
      result[key] = {
        enabled: flag.enabled,
        description: flag.description,
        rolloutPercentage: flag.rolloutPercentage
      };
    });
    return result;
  }

  // Update feature flag
  updateFlag(featureName, updates) {
    const flag = this.flags.get(featureName);
    
    if (!flag) {
      throw new Error(`Feature flag '${featureName}' not found`);
    }

    const updatedFlag = { ...flag, ...updates };
    this.flags.set(featureName, updatedFlag);
    
    console.log(`Feature flag '${featureName}' updated:`, updates);
    
    return updatedFlag;
  }

  // Enable/disable feature flag
  setEnabled(featureName, enabled) {
    return this.updateFlag(featureName, { enabled });
  }

  // Set rollout percentage
  setRolloutPercentage(featureName, percentage) {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }
    
    return this.updateFlag(featureName, { rolloutPercentage: percentage });
  }

  // Add new feature flag
  addFlag(featureName, options = {}) {
    if (this.flags.has(featureName)) {
      throw new Error(`Feature flag '${featureName}' already exists`);
    }

    const flag = {
      enabled: options.enabled || false,
      description: options.description || '',
      rolloutPercentage: options.rolloutPercentage || 0,
      ...options
    };

    this.flags.set(featureName, flag);
    
    console.log(`Feature flag '${featureName}' added`);
    
    return flag;
  }

  // Remove feature flag
  removeFlag(featureName) {
    const removed = this.flags.delete(featureName);
    
    if (removed) {
      console.log(`Feature flag '${featureName}' removed`);
    }
    
    return removed;
  }

  // Get feature flag statistics
  getStats() {
    const stats = {
      total: this.flags.size,
      enabled: 0,
      disabled: 0,
      partialRollout: 0,
      fullRollout: 0
    };

    this.flags.forEach(flag => {
      if (flag.enabled) {
        stats.enabled++;
      } else {
        stats.disabled++;
      }

      if (flag.rolloutPercentage > 0 && flag.rolloutPercentage < 100) {
        stats.partialRollout++;
      } else if (flag.rolloutPercentage === 100) {
        stats.fullRollout++;
      }
    });

    return stats;
  }

  // Export feature flags
  export() {
    const exported = {};
    this.flags.forEach((flag, key) => {
      exported[key] = flag;
    });
    return JSON.stringify(exported, null, 2);
  }

  // Import feature flags
  import(data) {
    try {
      const imported = JSON.parse(data);
      
      Object.keys(imported).forEach(key => {
        this.flags.set(key, imported[key]);
      });
      
      console.log('Feature flags imported successfully');
      
    } catch (error) {
      console.error('Error importing feature flags:', error);
      throw error;
    }
  }

  // Middleware to check feature flags
  middleware(featureName, options = {}) {
    return (req, res, next) => {
      const isEnabled = this.isEnabled(featureName, req.user);
      
      if (!isEnabled) {
        if (options.return404) {
          return res.status(404).json({
            error: 'Feature Not Available',
            message: 'This feature is currently unavailable'
          });
        } else {
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'This feature is temporarily unavailable'
          });
        }
      }
      
      // Add feature flag info to request
      req.featureFlags = req.featureFlags || {};
      req.featureFlags[featureName] = isEnabled;
      
      next();
    };
  }
}

// Create singleton instance
const featureFlags = new FeatureFlags();

module.exports = featureFlags;
