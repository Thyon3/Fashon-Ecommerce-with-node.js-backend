const mongoose = require("mongoose");

const activityLogSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'login',
      'logout',
      'register',
      'profile_update',
      'password_change',
      'password_reset',
      'email_verification',
      'product_view',
      'product_search',
      'cart_add',
      'cart_remove',
      'cart_clear',
      'wishlist_add',
      'wishlist_remove',
      'order_create',
      'order_cancel',
      'order_view',
      'payment_success',
      'payment_failed',
      'review_create',
      'review_update',
      'address_add',
      'address_update',
      'address_delete',
      'settings_update',
      'account_delete',
      'file_upload',
      'data_export',
      'api_call',
      'security_alert',
      'system_error',
      'other'
    ]
  },
  resourceType: {
    type: String,
    enum: ['user', 'product', 'order', 'cart', 'wishlist', 'review', 'address', 'payment', 'file', 'system', 'other'],
    default: 'other'
  },
  resourceId: {
    type: mongoose.Schema.ObjectId,
    default: null
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  deviceInfo: {
    platform: String,
    browser: String,
    os: String,
    mobile: Boolean,
    tablet: Boolean,
    desktop: Boolean
  },
  location: {
    country: String,
    city: String,
    region: String,
    latitude: Number,
    longitude: Number
  },
  sessionId: {
    type: String,
    default: null
  },
  success: {
    type: Boolean,
    default: true
  },
  errorCode: {
    type: String,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
  duration: {
    type: Number, // in milliseconds
    default: null
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  level: {
    type: String,
    enum: ['info', 'warning', 'error', 'critical'],
    default: 'info'
  }
});

// Indexes for efficient queries
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
activityLogSchema.index({ ipAddress: 1, timestamp: -1 });
activityLogSchema.index({ level: 1, timestamp: -1 });
activityLogSchema.index({ timestamp: -1 });

// TTL index to automatically delete old logs (90 days)
activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Pre-save middleware to set level based on action
activityLogSchema.pre('save', function(next) {
  if (this.action === 'login' && !this.success) {
    this.level = 'warning';
  } else if (this.action === 'account_delete') {
    this.level = 'warning';
  } else if (this.action === 'security_alert') {
    this.level = 'critical';
  } else if (this.action === 'system_error') {
    this.level = 'error';
  }
  
  next();
});

// Instance methods
activityLogSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

// Static methods
activityLogSchema.statics.logActivity = function(activityData) {
  return this.create(activityData);
};

activityLogSchema.statics.logUserActivity = function(userId, action, description, metadata = {}) {
  return this.create({
    userId,
    action,
    description,
    metadata,
    ipAddress: metadata.ip || metadata.ipAddress || 'unknown',
    userAgent: metadata.userAgent || 'unknown',
    deviceInfo: metadata.deviceInfo || {},
    location: metadata.location || {},
    sessionId: metadata.sessionId || null,
    success: metadata.success !== false,
    errorCode: metadata.errorCode || null,
    errorMessage: metadata.errorMessage || null,
    duration: metadata.duration || null,
    level: metadata.level || 'info'
  });
};

activityLogSchema.statics.logSecurityEvent = function(userId, action, description, metadata = {}) {
  return this.create({
    userId,
    action,
    description,
    metadata,
    ipAddress: metadata.ip || 'unknown',
    userAgent: metadata.userAgent || 'unknown',
    deviceInfo: metadata.deviceInfo || {},
    location: metadata.location || {},
    sessionId: metadata.sessionId || null,
    success: metadata.success !== false,
    level: 'critical',
    resourceType: 'security'
  });
};

activityLogSchema.statics.logError = function(userId, action, description, error, metadata = {}) {
  return this.create({
    userId,
    action,
    description,
    metadata: {
      ...metadata,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    },
    ipAddress: metadata.ip || 'unknown',
    userAgent: metadata.userAgent || 'unknown',
    deviceInfo: metadata.deviceInfo || {},
    location: metadata.location || {},
    sessionId: metadata.sessionId || null,
    success: false,
    errorCode: error.name,
    errorMessage: error.message,
    level: 'error',
    resourceType: 'system'
  });
};

activityLogSchema.statics.getUserActivity = function(userId, options = {}) {
  const {
    page = 1,
    limit = 50,
    action,
    resourceType,
    level,
    startDate,
    endDate,
    sortBy = 'timestamp',
    sortOrder = -1
  } = options;

  const filter = { userId };
  
  if (action) filter.action = action;
  if (resourceType) filter.resourceType = resourceType;
  if (level) filter.level = level;
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = parseInt(sortOrder);

  return this.find(filter)
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));
};

activityLogSchema.statics.getActivityStats = function(userId, timeRange = '24h') {
  const now = new Date();
  let startDate;
  
  switch (timeRange) {
    case '1h':
      startDate = new Date(now.getTime() - 60 * 60 * 1000);
      break;
    case '24h':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }

  return this.aggregate([
    { $match: { userId, timestamp: { $gte: startDate } } },
    { $group: {
      _id: '$action',
      count: { $sum: 1 },
      successCount: { $sum: { $cond: ['$success', 1, 0] } },
      errorCount: { $sum: { $cond: ['$success', 0, 1] } }
    }},
    { $sort: { count: -1 } }
  ]);
};

activityLogSchema.statics.getSecurityEvents = function(options = {}) {
  const {
    page = 1,
    limit = 50,
    level = 'critical',
    startDate,
    endDate
  } = options;

  const filter = { level };
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  return this.find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .populate('userId', 'name email');
};

activityLogSchema.statics.cleanupOldLogs = function(daysToKeep = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
};

const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);

module.exports = ActivityLog;
