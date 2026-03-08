const mongoose = require("mongoose");

const couponSchema = mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    minlength: 3,
    maxlength: 20
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  type: {
    type: String,
    required: true,
    enum: ['percentage', 'fixed', 'free_shipping'],
    default: 'percentage'
  },
  value: {
    type: Number,
    required: true,
    min: 0
  },
  minimumAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  maximumDiscount: {
    type: Number,
    default: null
  },
  usageLimit: {
    type: Number,
    default: null,
    min: 1
  },
  usageCount: {
    type: Number,
    default: 0,
    min: 0
  },
  userLimit: {
    type: Number,
    default: 1,
    min: 1
  },
  applicableProducts: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Product'
  }],
  applicableCategories: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Category'
  }],
  excludedProducts: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Product'
  }],
  excludedCategories: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Category'
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  startsAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
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
couponSchema.index({ code: 1 });
couponSchema.index({ isActive: 1, startsAt: 1, expiresAt: 1 });

// Pre-save middleware to validate dates
couponSchema.pre('save', function(next) {
  if (this.expiresAt <= this.startsAt) {
    return next(new Error('Expiry date must be after start date'));
  }
  next();
});

// Instance methods
couponSchema.methods.isValid = function() {
  const now = new Date();
  return this.isActive && 
         now >= this.startsAt && 
         now <= this.expiresAt &&
         (this.usageLimit === null || this.usageCount < this.usageLimit);
};

couponSchema.methods.canBeUsedByUser = function(userId, userUsageCount = 0) {
  return this.isValid() && userUsageCount < this.userLimit;
};

couponSchema.methods.incrementUsage = function() {
  this.usageCount += 1;
  this.updatedAt = new Date();
  return this.save();
};

couponSchema.methods.calculateDiscount = function(cartTotal, applicableItems = []) {
  if (!this.isValid()) {
    return 0;
  }

  let discountAmount = 0;

  switch (this.type) {
    case 'percentage':
      discountAmount = cartTotal * (this.value / 100);
      if (this.maximumDiscount && discountAmount > this.maximumDiscount) {
        discountAmount = this.maximumDiscount;
      }
      break;
    case 'fixed':
      discountAmount = Math.min(this.value, cartTotal);
      break;
    case 'free_shipping':
      // This would be handled in the shipping calculation
      discountAmount = 0;
      break;
  }

  return Math.max(0, discountAmount);
};

// Static methods
couponSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase() });
};

couponSchema.statics.findActive = function() {
  const now = new Date();
  return this.find({
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gt: now }
  });
};

couponSchema.statics.findValidForUser = function(userId, userUsageData = {}) {
  const now = new Date();
  return this.find({
    isActive: true,
    startsAt: { $lte: now },
    expiresAt: { $gt: now },
    $or: [
      { usageLimit: null },
      { $expr: { $lt: ['$usageCount', '$usageLimit'] } }
    ]
  });
};

const Coupon = mongoose.model("Coupon", couponSchema);

module.exports = Coupon;
