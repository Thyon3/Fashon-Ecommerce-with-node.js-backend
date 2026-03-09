const mongoose = require('mongoose');

class DatabaseIndexes {
  static async createIndexes() {
    try {
      console.log('Creating database indexes...');
      
      // User model indexes
      await this.createUserIndexes();
      
      // Product model indexes
      await this.createProductIndexes();
      
      // Order model indexes
      await this.createOrderIndexes();
      
      // Category model indexes
      await this.createCategoryIndexes();
      
      // Review model indexes
      await this.createReviewIndexes();
      
      // ActivityLog model indexes
      await this.createActivityLogIndexes();
      
      // Session model indexes
      await this.createSessionIndexes();
      
      console.log('Database indexes created successfully');
      
    } catch (error) {
      console.error('Error creating database indexes:', error);
      throw error;
    }
  }
  
  static async createUserIndexes() {
    const UserModel = require('../models/user');
    
    // Email uniqueness index
    await UserModel.collection.createIndex({ email: 1 }, { unique: true });
    
    // Phone index
    await UserModel.collection.createIndex({ phone: 1 });
    
    // Name search index
    await UserModel.collection.createIndex({ name: 'text' });
    
    // Created at index for sorting
    await UserModel.collection.createIndex({ createdAt: -1 });
    
    // Admin status index
    await UserModel.collection.createIndex({ isAdmin: 1 });
    
    // Active status index
    await UserModel.collection.createIndex({ isActive: 1 });
    
    // Last login index
    await UserModel.collection.createIndex({ lastLogin: -1 });
    
    console.log('User indexes created');
  }
  
  static async createProductIndexes() {
    const ProductModel = require('../models/product');
    
    // Name search index
    await ProductModel.collection.createIndex({ name: 'text' });
    
    // Category index
    await ProductModel.collection.createIndex({ category: 1 });
    
    // Price range index
    await ProductModel.collection.createIndex({ price: 1 });
    
    // Stock index
    await ProductModel.collection.createIndex({ numberInStock: 1 });
    
    // Rating index
    await ProductModel.collection.createIndex({ rating: -1 });
    
    // Availability index
    await ProductModel.collection.createIndex({ isAvailable: 1 });
    
    // Featured index
    await ProductModel.collection.createIndex({ isFeatured: 1 });
    
    // Created at index
    await ProductModel.collection.createIndex({ createdAt: -1 });
    
    // Updated at index
    await ProductModel.collection.createIndex({ updatedDate: -1 });
    
    // Compound index for product search
    await ProductModel.collection.createIndex({
      category: 1,
      isAvailable: 1,
      price: 1
    });
    
    // Compound index for product listings
    await ProductModel.collection.createIndex({
      isAvailable: 1,
      isFeatured: 1,
      rating: -1
    });
    
    console.log('Product indexes created');
  }
  
  static async createOrderIndexes() {
    const OrderModel = require('../models/order');
    
    // User index
    await OrderModel.collection.createIndex({ user: 1 });
    
    // Order date index
    await OrderModel.collection.createIndex({ dateOrdered: -1 });
    
    // Status index
    await OrderModel.collection.createIndex({ status: 1 });
    
    // Total price index
    await OrderModel.collection.createIndex({ totalPrice: 1 });
    
    // Payment method index
    await OrderModel.collection.createIndex({ paymentMethod: 1 });
    
    // Tracking number index
    await OrderModel.collection.createIndex({ trackingNumber: 1 });
    
    // Compound index for user orders
    await OrderModel.collection.createIndex({
      user: 1,
      dateOrdered: -1
    });
    
    // Compound index for order status
    await OrderModel.collection.createIndex({
      status: 1,
      dateOrdered: -1
    });
    
    console.log('Order indexes created');
  }
  
  static async createCategoryIndexes() {
    const CategoryModel = require('../models/category');
    
    // Name unique index
    await CategoryModel.collection.createIndex({ name: 1 }, { unique: true });
    
    // Name search index
    await CategoryModel.collection.createIndex({ name: 'text' });
    
    // Sort order index
    await CategoryModel.collection.createIndex({ sortOrder: 1 });
    
    // Active status index
    await CategoryModel.collection.createIndex({ isActive: 1 });
    
    // Created at index
    await CategoryModel.collection.createIndex({ createdAt: -1 });
    
    console.log('Category indexes created');
  }
  
  static async createReviewIndexes() {
    const ReviewModel = require('../models/review');
    
    // Product index
    await ReviewModel.collection.createIndex({ product: 1 });
    
    // User index
    await ReviewModel.collection.createIndex({ user: 1 });
    
    // Rating index
    await ReviewModel.collection.createIndex({ rating: -1 });
    
    // Created at index
    await ReviewModel.collection.createIndex({ createdAt: -1 });
    
    // Compound index for product reviews
    await ReviewModel.collection.createIndex({
      product: 1,
      createdAt: -1
    });
    
    // Compound index for user reviews
    await ReviewModel.collection.createIndex({
      user: 1,
      createdAt: -1
    });
    
    console.log('Review indexes created');
  }
  
  static async createActivityLogIndexes() {
    const ActivityLog = require('../models/activityLog');
    
    // User index
    await ActivityLog.collection.createIndex({ userId: 1 });
    
    // Action index
    await ActivityLog.collection.createIndex({ action: 1 });
    
    // Timestamp index
    await ActivityLog.collection.createIndex({ timestamp: -1 });
    
    // Level index
    await ActivityLog.collection.createIndex({ level: 1 });
    
    // IP address index
    await ActivityLog.collection.createIndex({ ipAddress: 1 });
    
    // Compound index for user activity
    await ActivityLog.collection.createIndex({
      userId: 1,
      timestamp: -1
    });
    
    // Compound index for action tracking
    await ActivityLog.collection.createIndex({
      action: 1,
      timestamp: -1
    });
    
    // TTL index for automatic cleanup (90 days)
    await ActivityLog.collection.createIndex(
      { timestamp: 1 }, 
      { expireAfterSeconds: 90 * 24 * 60 * 60 }
    );
    
    console.log('ActivityLog indexes created');
  }
  
  static async createSessionIndexes() {
    const Session = require('../models/session');
    
    // User index
    await Session.collection.createIndex({ userId: 1 });
    
    // Session token unique index
    await Session.collection.createIndex({ sessionToken: 1 }, { unique: true });
    
    // Refresh token unique index
    await Session.collection.createIndex({ refreshToken: 1 }, { unique: true });
    
    // Active status index
    await Session.collection.createIndex({ isActive: 1 });
    
    // Expires at index
    await Session.collection.createIndex({ expiresAt: 1 });
    
    // Compound index for user sessions
    await Session.collection.createIndex({
      userId: 1,
      isActive: 1
    });
    
    // TTL index for automatic cleanup
    await Session.collection.createIndex(
      { expiresAt: 1 }, 
      { expireAfterSeconds: 0 }
    );
    
    console.log('Session indexes created');
  }
  
  static async getIndexStats() {
    try {
      const db = mongoose.connection.db;
      const collections = await db.listCollections().toArray();
      
      const stats = {};
      
      for (const collection of collections) {
        const indexes = await db.collection(collection.name).listIndexes().toArray();
        stats[collection.name] = {
          indexCount: indexes.length,
          indexes: indexes.map(index => ({
            name: index.name,
            keys: index.key,
            unique: index.unique || false,
            sparse: index.sparse || false,
            expireAfterSeconds: index.expireAfterSeconds
          }))
        };
      }
      
      return stats;
      
    } catch (error) {
      console.error('Error getting index stats:', error);
      return {};
    }
  }
}

module.exports = DatabaseIndexes;
