const UserModel = require("../models/user");
const emailSender = require("./email_sender");

class NotificationService {
  constructor() {
    this.notifications = [];
  }

  // Create notification
  async createNotification(userId, type, title, message, data = {}) {
    try {
      const notification = {
        id: this.generateId(),
        userId,
        type,
        title,
        message,
        data,
        createdAt: new Date(),
        read: false
      };

      // Store notification (in real app, this would be in database)
      this.notifications.push(notification);

      // Send email notification if user has email notifications enabled
      await this.sendEmailNotification(userId, type, title, message, data);

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Send email notification
  async sendEmailNotification(userId, type, title, message, data) {
    try {
      const user = await UserModel.findById(userId);
      if (!user || !user.email) {
        return;
      }

      let emailSubject = title;
      let emailHtml = this.generateEmailTemplate(type, title, message, data, user);

      await emailSender.sendEmail({
        to: user.email,
        subject: emailSubject,
        html: emailHtml
      });

    } catch (error) {
      console.error('Error sending email notification:', error);
    }
  }

  // Generate email template based on notification type
  generateEmailTemplate(type, title, message, data, user) {
    const templates = {
      'order_placed': this.getOrderPlacedTemplate(title, message, data, user),
      'order_shipped': this.getOrderShippedTemplate(title, message, data, user),
      'order_delivered': this.getOrderDeliveredTemplate(title, message, data, user),
      'payment_received': this.getPaymentReceivedTemplate(title, message, data, user),
      'low_stock': this.getLowStockTemplate(title, message, data, user),
      'welcome': this.getWelcomeTemplate(title, message, data, user)
    };

    return templates[type] || this.getDefaultTemplate(title, message, data, user);
  }

  // Order placed email template
  getOrderPlacedTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #333; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🛒 Order Confirmation</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
            <p>Order ID: ${data.orderId || 'N/A'}</p>
            <p>Total Amount: $${data.totalAmount || '0.00'}</p>
            <a href="#" class="button">View Order Details</a>
            <p>Thank you for shopping with us!</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Order shipped email template
  getOrderShippedTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #333; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .tracking { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🚀 Your Order Has Shipped!</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
            <div class="tracking">
              <p><strong>Tracking Number:</strong> ${data.trackingNumber || 'N/A'}</p>
              <p><strong>Estimated Delivery:</strong> ${data.estimatedDelivery || 'N/A'}</p>
            </div>
            <a href="#" class="button">Track Your Order</a>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Order delivered email template
  getOrderDeliveredTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #28a745; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>✅ Order Delivered!</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
            <p>Your order has been successfully delivered. We hope you enjoy your purchase!</p>
            <a href="#" class="button">Leave a Review</a>
            <a href="#" class="button" style="background-color: #007bff; margin-left: 10px;">Shop Again</a>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Payment received email template
  getPaymentReceivedTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #28a745; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .payment-info { background-color: #e7f3ff; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>💳 Payment Received</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
            <div class="payment-info">
              <p><strong>Payment Method:</strong> ${data.paymentMethod || 'N/A'}</p>
              <p><strong>Amount:</strong> $${data.amount || '0.00'}</p>
              <p><strong>Transaction ID:</strong> ${data.transactionId || 'N/A'}</p>
            </div>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Low stock email template (for admin)
  getLowStockTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #dc3545; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .product-info { background-color: #fff3cd; padding: 15px; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>⚠️ Low Stock Alert</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
            <div class="product-info">
              <p><strong>Product:</strong> ${data.productName || 'N/A'}</p>
              <p><strong>Current Stock:</strong> ${data.currentStock || '0'}</p>
              <p><strong>SKU:</strong> ${data.sku || 'N/A'}</p>
            </div>
            <a href="#" class="button" style="background-color: #dc3545;">Manage Inventory</a>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Welcome email template
  getWelcomeTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #007bff; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .button { display: inline-block; padding: 12px 24px; background-color: #007bff; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>🎉 Welcome to Fashon!</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
            <p>We're excited to have you join our community! Here are some things you can do:</p>
            <ul>
              <li>Browse our latest collections</li>
              <li>Create your wishlist</li>
              <li>Enjoy exclusive member benefits</li>
            </ul>
            <a href="#" class="button">Start Shopping</a>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Default email template
  getDefaultTemplate(title, message, data, user) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 8px; }
          .header { text-align: center; color: #333; margin-bottom: 20px; }
          .content { color: #666; line-height: 1.6; }
          .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${title}</h2>
          </div>
          <div class="content">
            <p>Hi ${user.name},</p>
            <p>${message}</p>
          </div>
          <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Get user notifications
  getUserNotifications(userId) {
    return this.notifications.filter(n => n.userId === userId);
  }

  // Mark notification as read
  markAsRead(notificationId) {
    const notification = this.notifications.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      return true;
    }
    return false;
  }
}

module.exports = new NotificationService();
