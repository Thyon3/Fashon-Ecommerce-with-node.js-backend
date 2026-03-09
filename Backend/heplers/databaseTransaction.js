const mongoose = require('mongoose');

class DatabaseTransaction {
  // Execute operations within a transaction
  static async execute(operations) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const results = [];
      
      for (const operation of operations) {
        const result = await operation(session);
        results.push(result);
      }
      
      await session.commitTransaction();
      
      console.log(`[TRANSACTION] Committed ${operations.length} operations`);
      
      return results;
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`[TRANSACTION] Aborted: ${error.message}`);
      
      throw error;
      
    } finally {
      await session.endSession();
    }
  }

  // Create order with transaction
  static async createOrderWithTransaction(orderData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      // Create order
      const OrderModel = require('../models/order');
      const ProductModel = require('../models/product');
      const UserModel = require('../models/user');
      
      // Validate order data
      for (const item of orderData.orderItem) {
        const product = await ProductModel.findById(item.product).session(session);
        
        if (!product) {
          throw new Error(`Product ${item.product} not found`);
        }
        
        if (product.numberInStock < item.quantity) {
          throw new Error(`Insufficient stock for product ${product.name}`);
        }
      }
      
      // Create order
      const order = await OrderModel.create([orderData], { session });
      
      // Update product stock
      for (const item of orderData.orderItem) {
        await ProductModel.findByIdAndUpdate(
          item.product,
          { $inc: { numberInStock: -item.quantity } },
          { session }
        );
      }
      
      // Clear user cart
      if (orderData.userId) {
        await UserModel.findByIdAndUpdate(
          orderData.userId,
          { $set: { cart: [] } },
          { session }
        );
      }
      
      await session.commitTransaction();
      
      console.log(`[TRANSACTION] Order created: ${order[0]._id}`);
      
      return order[0];
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`[TRANSACTION] Order creation failed: ${error.message}`);
      
      throw error;
      
    } finally {
      await session.endSession();
    }
  }

  // Update product with transaction
  static async updateProductWithTransaction(productId, updateData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const ProductModel = require('../models/product');
      
      // Get current product
      const currentProduct = await ProductModel.findById(productId).session(session);
      
      if (!currentProduct) {
        throw new Error('Product not found');
      }
      
      // Update product
      const updatedProduct = await ProductModel.findByIdAndUpdate(
        productId,
        { ...updateData, updatedDate: new Date() },
        { new: true, session }
      );
      
      // Log the change
      const AuditLog = require('../models/auditLog');
      await AuditLog.create([{
        action: 'UPDATE',
        resourceType: 'product',
        resourceId: productId,
        userId: updateData.userId || 'system',
        details: { updateData },
        changes: {
          before: currentProduct.toObject(),
          after: updatedProduct.toObject()
        },
        ipAddress: updateData.ipAddress || '127.0.0.1',
        userAgent: updateData.userAgent || 'system'
      }], { session });
      
      await session.commitTransaction();
      
      console.log(`[TRANSACTION] Product updated: ${productId}`);
      
      return updatedProduct;
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`[TRANSACTION] Product update failed: ${error.message}`);
      
      throw error;
      
    } finally {
      await session.endSession();
    }
  }

  // Process payment with transaction
  static async processPaymentWithTransaction(paymentData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const OrderModel = require('../models/order');
      const CouponModel = require('../models/coupon');
      
      // Get order
      const order = await OrderModel.findById(paymentData.orderId).session(session);
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.status !== 'pending') {
        throw new Error('Order cannot be processed');
      }
      
      // Process payment (placeholder)
      const paymentResult = await this.processPayment(paymentData);
      
      if (!paymentResult.success) {
        throw new Error('Payment failed');
      }
      
      // Update order status
      const updatedOrder = await OrderModel.findByIdAndUpdate(
        paymentData.orderId,
        {
          status: 'processed',
          paymentId: paymentResult.paymentId,
          paymentMethod: paymentData.paymentMethod
        },
        { new: true, session }
      );
      
      // Update coupon usage if applicable
      if (paymentData.couponCode) {
        await CouponModel.findOneAndUpdate(
          { code: paymentData.couponCode },
          { $inc: { usedCount: 1 } },
          { session }
        );
      }
      
      await session.commitTransaction();
      
      console.log(`[TRANSACTION] Payment processed: ${paymentData.orderId}`);
      
      return {
        success: true,
        order: updatedOrder,
        paymentId: paymentResult.paymentId
      };
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`[TRANSACTION] Payment processing failed: ${error.message}`);
      
      throw error;
      
    } finally {
      await session.endSession();
    }
  }

  // Process refund with transaction
  static async processRefundWithTransaction(refundData) {
    const session = await mongoose.startSession();
    
    try {
      session.startTransaction();
      
      const OrderModel = require('../models/order');
      const ProductModel = require('../models/product');
      
      // Get order
      const order = await OrderModel.findById(refundData.orderId).session(session);
      
      if (!order) {
        throw new Error('Order not found');
      }
      
      if (order.status !== 'delivered') {
        throw new Error('Order cannot be refunded');
      }
      
      // Process refund (placeholder)
      const refundResult = await this.processRefund(refundData);
      
      if (!refundResult.success) {
        throw new Error('Refund failed');
      }
      
      // Update order status
      const updatedOrder = await OrderModel.findByIdAndUpdate(
        refundData.orderId,
        {
          status: 'refunded',
          refundId: refundResult.refundId,
          refundAmount: refundData.amount
        },
        { new: true, session }
      );
      
      // Restore product stock
      for (const item of order.orderItem) {
        await ProductModel.findByIdAndUpdate(
          item.product,
          { $inc: { numberInStock: item.quantity } },
          { session }
        );
      }
      
      await session.commitTransaction();
      
      console.log(`[TRANSACTION] Refund processed: ${refundData.orderId}`);
      
      return {
        success: true,
        order: updatedOrder,
        refundId: refundResult.refundId
      };
      
    } catch (error) {
      await session.abortTransaction();
      
      console.error(`[TRANSACTION] Refund processing failed: ${error.message}`);
      
      throw error;
      
    } finally {
      await session.endSession();
    }
  }

  // Placeholder payment processing
  static async processPayment(paymentData) {
    // In production, integrate with payment gateway
    return {
      success: true,
      paymentId: 'pay_' + Date.now(),
      amount: paymentData.amount
    };
  }

  // Placeholder refund processing
  static async processRefund(refundData) {
    // In production, integrate with payment gateway
    return {
      success: true,
      refundId: 'ref_' + Date.now(),
      amount: refundData.amount
    };
  }

  // Get transaction statistics
  static async getTransactionStats() {
    try {
      const db = mongoose.connection.db;
      const stats = await db.stats();
      
      return {
        transactions: stats.transactions,
        collections: stats.collections,
        objects: stats.objects,
        dataSize: stats.dataSize,
        storageSize: stats.storageSize,
        indexes: stats.indexes,
        indexSize: stats.indexSize
      };
    } catch (error) {
      console.error('Error getting transaction stats:', error);
      return null;
    }
  }
}

module.exports = DatabaseTransaction;
