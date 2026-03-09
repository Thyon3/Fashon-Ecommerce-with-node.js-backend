const mongoose = require("mongoose");

const permissionSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: [
      // User Management
      'user.create', 'user.read', 'user.update', 'user.delete', 'user.list',
      // Product Management
      'product.create', 'product.read', 'product.update', 'product.delete', 'product.list',
      'product.publish', 'product.unpublish', 'product.feature', 'product.unfeature',
      // Order Management
      'order.create', 'order.read', 'order.update', 'order.delete', 'order.list',
      'order.process', 'order.ship', 'order.cancel', 'order.refund',
      // Category Management
      'category.create', 'category.read', 'category.update', 'category.delete', 'category.list',
      // Review Management
      'review.create', 'review.read', 'review.update', 'review.delete', 'review.moderate',
      // Analytics
      'analytics.read', 'analytics.export',
      // Settings
      'settings.read', 'settings.update',
      // Content Management
      'content.create', 'content.read', 'content.update', 'content.delete', 'content.publish',
      // System
      'system.backup', 'system.restore', 'system.maintenance'
    ]
  },
  description: {
    type: String,
    required: true,
    maxlength: 200
  },
  resource: {
    type: String,
    required: true,
    enum: ['user', 'product', 'order', 'category', 'review', 'analytics', 'settings', 'content', 'system']
  },
  action: {
    type: String,
    required: true,
    enum: ['create', 'read', 'update', 'delete', 'list', 'publish', 'unpublish', 'feature', 'unfeature', 
            'process', 'ship', 'cancel', 'refund', 'moderate', 'export', 'backup', 'restore', 'maintenance']
  },
  isActive: {
    type: Boolean,
    default: true
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

const roleSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: true,
    maxlength: 500
  },
  permissions: [{
    type: mongoose.Schema.ObjectId,
    ref: 'Permission',
    required: true
  }],
  isSystem: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 100
  },
  parentRole: {
    type: mongoose.Schema.ObjectId,
    ref: 'Role',
    default: null
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

// Indexes for efficient queries
roleSchema.index({ name: 1 });
roleSchema.index({ level: 1 });
roleSchema.index({ isActive: 1 });

// Pre-save middleware
roleSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Instance methods
roleSchema.methods.hasPermission = function(permissionName, resourceName = null) {
  return this.permissions.some(permission => {
    const matchesName = permission.name === permissionName;
    const matchesResource = !resourceName || permission.resource === resourceName;
    return matchesName && matchesResource && permission.isActive;
  });
};

roleSchema.methods.addPermission = function(permissionId) {
  if (!this.permissions.includes(permissionId)) {
    this.permissions.push(permissionId);
  }
};

roleSchema.methods.removePermission = function(permissionId) {
  const index = this.permissions.indexOf(permissionId);
  if (index > -1) {
    this.permissions.splice(index, 1);
  }
};

roleSchema.methods.getPermissionNames = function() {
  return this.permissions.map(permissionId => {
    // This would typically populate the permission
    return permissionId; // In a real implementation, you'd populate this
  });
};

// Static methods
roleSchema.statics.createDefaultRoles = async function() {
  const Permission = mongoose.model('Permission');
  
  const permissions = await Permission.find({});
  const permissionMap = {};
  permissions.forEach(p => {
    permissionMap[p.name] = p._id;
  });

  const defaultRoles = [
    {
      name: 'super_admin',
      displayName: 'Super Admin',
      description: 'Full system access with all permissions',
      level: 100,
      isSystem: true,
      permissions: Object.values(permissionMap)
    },
    {
      name: 'admin',
      displayName: 'Administrator',
      description: 'Administrative access with most permissions',
      level: 80,
      permissions: [
        permissionMap['user.create'], permissionMap['user.read'], permissionMap['user.update'], permissionMap['user.delete'], permissionMap['user.list'],
        permissionMap['product.create'], permissionMap['product.read'], permissionMap['product.update'], permissionMap['product.delete'], permissionMap['product.list'],
        permissionMap['product.publish'], permissionMap['product.unpublish'], permissionMap['product.feature'], permissionMap['product.unfeature'],
        permissionMap['order.create'], permissionMap['order.read'], permissionMap['order.update'], permissionMap['order.delete'], permissionMap['order.list'],
        permissionMap['order.process'], permissionMap['order.ship'], permissionMap['order.cancel'],
        permissionMap['category.create'], permissionMap['category.read'], permissionMap['category.update'], permissionMap['category.delete'], permissionMap['category.list'],
        permissionMap['review.create'], permissionMap['review.read'], permissionMap['review.update'], permissionMap['review.delete'], permissionMap['review.moderate'],
        permissionMap['analytics.read'], permissionMap['analytics.export'],
        permissionMap['settings.read'], permissionMap['settings.update']
      ]
    },
    {
      name: 'manager',
      displayName: 'Manager',
      description: 'Manager with access to specific resources',
      level: 60,
      permissions: [
        permissionMap['user.read'], permissionMap['user.update'], permissionMap['user.list'],
        permissionMap['product.read'], permissionMap['product.update'], permissionMap['product.list'],
        permissionMap['order.create'], permissionMap['order.read'], permissionMap['order.update'], permissionMap['order.list'],
        permissionMap['order.process'], permissionMap['order.ship'],
        permissionMap['category.read'], permissionMap['category.update'], permissionMap['category.list'],
        permissionMap['review.read'], permissionMap['review.update'],
        permissionMap['analytics.read']
      ]
    },
    {
      name: 'customer_service',
      displayName: 'Customer Service',
      description: 'Customer service representative access',
      level: 40,
      permissions: [
        permissionMap['user.read'], permissionMap['user.update'],
        permissionMap['product.read'], permissionMap['product.update'], permissionMap['product.list'],
        permissionMap['order.create'], permissionMap['order.read'], permissionMap['order.update'], permissionMap['order.list'],
        permissionMap['order.process'], permissionMap['order.ship'], permissionMap['order.cancel'], permissionMap['order.refund'],
        permissionMap['category.read'], permissionMap['category.list'],
        permissionMap['review.read'], permissionMap['review.update'], permissionMap['review.moderate']
      ]
    },
    {
      name: 'moderator',
      displayName: 'Moderator',
      description: 'Content moderator with limited access',
      level: 30,
      permissions: [
        permissionMap['product.read'], permissionMap['product.list'],
        permissionMap['category.read'], permissionMap['category.list'],
        permissionMap['review.read'], permissionMap['review.update'], permissionMap['review.delete'], permissionMap['review.moderate']
      ]
    },
    {
      name: 'sales',
      displayName: 'Sales Representative',
      description: 'Sales representative with order management access',
      level: 20,
      permissions: [
        permissionMap['product.read'], permissionMap['product.list'],
        permissionMap['order.create'], permissionMap['order.read'], permissionMap['order.update'], permissionMap['order.list'],
        permissionMap['order.process'], permissionMap['order.ship']
      ]
    },
    {
      name: 'customer',
      displayName: 'Customer',
      description: 'Regular customer with basic access',
      level: 10,
      permissions: [
        permissionMap['product.read'], permissionMap['product.list'],
        permissionMap['order.read'], permissionMap['order.list'],
        permissionMap['category.read'], permissionMap['category.list']
      ]
    }
  ];

  // Create roles if they don't exist
  for (const roleData of defaultRoles) {
    try {
      const existingRole = await this.findOne({ name: roleData.name });
      if (!existingRole) {
        await this.create(roleData);
        console.log(`Created default role: ${roleData.name}`);
      }
    } catch (error) {
      console.error(`Error creating role ${roleData.name}:`, error);
    }
  }

  return defaultRoles;
};

roleSchema.statics.getRoleHierarchy = function() {
  return [
    { level: 100, name: 'super_admin', displayName: 'Super Admin' },
    { level: 80, name: 'admin', displayName: 'Administrator' },
    { level: 60, name: 'manager', displayName: 'Manager' },
    { level: 40, name: 'customer_service', displayName: 'Customer Service' },
    { level: 30, name: 'moderator', displayName: 'Moderator' },
    { level: 20, name: 'sales', displayName: 'Sales Representative' },
    { level: 10, name: 'customer', displayName: 'Customer' }
  ];
};

const Permission = mongoose.model("Permission", permissionSchema);
const Role = mongoose.model("Role", roleSchema);

module.exports = { Permission, Role };
