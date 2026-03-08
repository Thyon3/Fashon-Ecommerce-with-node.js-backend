const mongoose = require("mongoose");

const sessionSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  sessionToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  refreshToken: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  deviceInfo: {
    userAgent: String,
    platform: String,
    browser: String,
    os: String,
    ip: String,
    location: {
      country: String,
      city: String,
      latitude: Number,
      longitude: Number
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
sessionSchema.index({ userId: 1, isActive: 1 });
sessionSchema.index({ sessionToken: 1, isActive: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Pre-save middleware to update timestamps
sessionSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
sessionSchema.methods.isExpired = function() {
  return new Date() > this.expiresAt;
};

sessionSchema.methods.isValid = function() {
  return this.isActive && !this.isExpired();
};

sessionSchema.methods.updateLastActivity = function() {
  this.lastActivity = new Date();
  return this.save();
};

sessionSchema.methods.deactivate = function() {
  this.isActive = false;
  return this.save();
};

// Static methods
sessionSchema.statics.findByToken = function(token) {
  return this.findOne({ sessionToken: token, isActive: true })
    .populate('userId', 'name email isAdmin');
};

sessionSchema.statics.findByRefreshToken = function(refreshToken) {
  return this.findOne({ refreshToken: refreshToken, isActive: true })
    .populate('userId', 'name email isAdmin');
};

sessionSchema.statics.findActiveSessionsByUser = function(userId) {
  return this.find({ userId: userId, isActive: true })
    .sort({ lastActivity: -1 });
};

sessionSchema.statics.deactivateAllUserSessions = function(userId) {
  return this.updateMany(
    { userId: userId, isActive: true },
    { isActive: false, updatedAt: new Date() }
  );
};

sessionSchema.statics.deactivateExpiredSessions = function() {
  return this.updateMany(
    { expiresAt: { $lt: new Date() }, isActive: true },
    { isActive: false, updatedAt: new Date() }
  );
};

sessionSchema.statics.getUserSessionCount = function(userId) {
  return this.countDocuments({ userId: userId, isActive: true });
};

sessionSchema.statics.cleanupExpiredSessions = function() {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

const Session = mongoose.model("Session", sessionSchema);

module.exports = Session;
