const mongoose = require("mongoose");

const auditLogSchema = mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: [
      'CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT', 'REGISTER',
      'PASSWORD_CHANGE', 'PASSWORD_RESET', 'EMAIL_VERIFY',
      'ORDER_CREATE', 'ORDER_UPDATE', 'ORDER_CANCEL', 'ORDER_SHIP',
      'PRODUCT_CREATE', 'PRODUCT_UPDATE', 'PRODUCT_DELETE',
      'USER_UPDATE', 'USER_DELETE', 'USER_SUSPEND', 'USER_ACTIVATE',
      'CATEGORY_CREATE', 'CATEGORY_UPDATE', 'CATEGORY_DELETE',
      'COUPON_CREATE', 'COUPON_UPDATE', 'COUPON_DELETE',
      'SYSTEM_BACKUP', 'SYSTEM_RESTORE', 'SYSTEM_MAINTENANCE',
      'SECURITY_ALERT', 'DATA_EXPORT', 'DATA_IMPORT', 'CONFIG_CHANGE'
    ]
  },
  resourceType: {
    type: String,
    required: true,
    enum: ['user', 'product', 'order', 'category', 'coupon', 'system', 'config', 'audit']
  },
  resourceId: {
    type: mongoose.Schema.ObjectId,
    required: true
  },
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  changes: {
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String,
    required: true
  },
  userAgent: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'low'
  },
  status: {
    type: String,
    enum: ['success', 'failure', 'warning'],
    default: 'success'
  },
  sessionId: {
    type: String,
    default: null
  },
  requestId: {
    type: String,
    default: null
  },
  traceId: {
    type: String,
    default: null
  }
});

// Indexes for efficient queries
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });

// TTL index for automatic cleanup (1 year)
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

// Pre-save middleware
auditLogSchema.pre('save', function(next) {
  // Set severity based on action
  const severityMap = {
    'CREATE': 'low',
    'UPDATE': 'low',
    'DELETE': 'medium',
    'READ': 'low',
    'LOGIN': 'medium',
    'LOGOUT': 'low',
    'REGISTER': 'medium',
    'PASSWORD_CHANGE': 'medium',
    'PASSWORD_RESET': 'high',
    'EMAIL_VERIFY': 'low',
    'ORDER_CREATE': 'medium',
    'ORDER_UPDATE': 'medium',
    'ORDER_CANCEL': 'medium',
    'ORDER_SHIP': 'medium',
    'PRODUCT_CREATE': 'medium',
    'PRODUCT_UPDATE': 'medium',
    'PRODUCT_DELETE': 'high',
    'USER_UPDATE': 'medium',
    'USER_DELETE': 'high',
    'USER_SUSPEND': 'high',
    'USER_ACTIVATE': 'medium',
    'CATEGORY_CREATE': 'medium',
    'CATEGORY_UPDATE': 'medium',
    'CATEGORY_DELETE': 'high',
    'COUPON_CREATE': 'medium',
    'COUPON_UPDATE': 'medium',
    'COUPON_DELETE': 'high',
    'SYSTEM_BACKUP': 'high',
    'SYSTEM_RESTORE': 'critical',
    'SYSTEM_MAINTENANCE': 'high',
    'SECURITY_ALERT': 'critical',
    'DATA_EXPORT': 'medium',
    'DATA_IMPORT': 'high',
    'CONFIG_CHANGE': 'high'
  };
  
  this.severity = severityMap[this.action] || 'low';
  
  next();
});

// Static methods
auditLogSchema.statics.log = function(logData) {
  return this.create(logData);
};

auditLogSchema.statics.logAction = function(userId, action, resourceType, resourceId, details = {}, changes = {}, req = {}) {
  return this.create({
    userId,
    action,
    resourceType,
    resourceId,
    details,
    changes,
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    sessionId: req.sessionId || null,
    requestId: req.requestId || null,
    traceId: req.traceId || null
  });
};

auditLogSchema.statics.logSecurityEvent = function(userId, action, resourceType, resourceId, details = {}, req = {}) {
  return this.create({
    userId,
    action,
    resourceType,
    resourceId,
    details,
    severity: 'critical',
    ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    sessionId: req.sessionId || null,
    requestId: req.requestId || null,
    traceId: req.traceId || null
  });
};

auditLogSchema.statics.getAuditTrail = function(resourceType, resourceId, options = {}) {
  const {
    page = 1,
    limit = 50,
    action,
    userId,
    severity,
    startDate,
    endDate,
    sortBy = 'timestamp',
    sortOrder = -1
  } = options;

  const filter = { resourceType, resourceId };
  
  if (action) filter.action = action;
  if (userId) filter.userId = userId;
  if (severity) filter.severity = severity;
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const sort = {};
  sort[sortBy] = parseInt(sortOrder);

  return this.find(filter)
    .populate('userId', 'name email')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit));
};

auditLogSchema.statics.getSecurityEvents = function(options = {}) {
  const {
    page = 1,
    limit = 50,
    severity = 'critical',
    startDate,
    endDate
  } = options;

  const filter = { severity };
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  return this.find(filter)
    .populate('userId', 'name email')
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit));
};

auditLogSchema.statics.getUserActivity = function(userId, options = {}) {
  const {
    page = 1,
    limit = 50,
    action,
    startDate,
    endDate
  } = options;

  const filter = { userId };
  
  if (action) filter.action = action;
  
  if (startDate || endDate) {
    filter.timestamp = {};
    if (startDate) filter.timestamp.$gte = new Date(startDate);
    if (endDate) filter.timestamp.$lte = new Date(endDate);
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  return this.find(filter)
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(parseInt(limit));
};

auditLogSchema.statics.getAuditStats = function(timeRange = '24h') {
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
    { $match: { timestamp: { $gte: startDate } } },
    { $group: {
      _id: '$action',
      count: { $sum: 1 },
      severity: { $first: '$severity' }
    }},
    { $sort: { count: -1 } }
  ]);
};

auditLogSchema.statics.cleanupOldLogs = function(daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  return this.deleteMany({
    timestamp: { $lt: cutoffDate }
  });
};

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
