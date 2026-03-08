const UserModel = require("../models/order");

/**
 * Builds an email template for order completion notification
 * @param {Object} order - The order object with populated items
 * @param {Object} user - The user object
 * @returns {Object} - Email object with subject and html content
 */
function buildOrderCompletionEmail(order, user) {
  const orderDate = new Date(order.dateOrdered).toLocaleDateString();
  const estimatedDelivery = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
  
  let itemsHtml = '';
  let subtotal = 0;
  
  // Build order items table
  order.orderItem.forEach((item, index) => {
    const itemTotal = item.price * item.quantity;
    subtotal += itemTotal;
    
    itemsHtml += `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="padding: 12px; text-align: center;">${index + 1}</td>
        <td style="padding: 12px;">
          <div style="font-weight: 600; color: #333;">${item.product.name}</div>
          ${item.product.description ? `<div style="font-size: 12px; color: #666; margin-top: 4px;">${item.product.description.substring(0, 100)}...</div>` : ''}
        </td>
        <td style="padding: 12px; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; text-align: right;">$${item.price.toFixed(2)}</td>
        <td style="padding: 12px; text-align: right; font-weight: 600;">$${itemTotal.toFixed(2)}</td>
      </tr>
    `;
  });
  
  const tax = subtotal * 0.1; // 10% tax
  const shipping = order.shippingCost || 0;
  const total = subtotal + tax + shipping;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Confirmation - Fashon</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .content { padding: 30px; }
        .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 30px; }
        .order-info h3 { margin: 0 0 15px 0; color: #333; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
        .info-item { margin-bottom: 10px; }
        .info-label { font-weight: 600; color: #666; font-size: 12px; text-transform: uppercase; }
        .info-value { color: #333; margin-top: 2px; }
        .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; }
        .status-pending { background-color: #fff3cd; color: #856404; }
        .table-container { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background-color: #f8f9fa; padding: 12px; text-align: left; font-weight: 600; color: #666; border-bottom: 2px solid #dee2e6; }
        .summary { background-color: #f8f9fa; padding: 20px; border-radius: 6px; }
        .summary-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .summary-row.total { font-weight: 600; font-size: 18px; color: #333; border-top: 2px solid #dee2e6; padding-top: 12px; margin-top: 12px; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
        .footer a { color: #667eea; text-decoration: none; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmed! 🎉</h1>
          <p>Thank you for your purchase from Fashon</p>
        </div>
        
        <div class="content">
          <div class="order-info">
            <h3>Order Information</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Order Number</div>
                <div class="info-value">#${order._id.toString().slice(-8).toUpperCase()}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Order Date</div>
                <div class="info-value">${orderDate}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="info-value">
                  <span class="status-badge status-${order.status}">${order.status.replace('-', ' ')}</span>
                </div>
              </div>
              <div class="info-item">
                <div class="info-label">Estimated Delivery</div>
                <div class="info-value">${estimatedDelivery}</div>
              </div>
            </div>
          </div>
          
          <div class="order-info">
            <h3>Shipping Address</h3>
            <div class="info-value">
              ${user.name}<br>
              ${order.shippingAddress}<br>
              ${order.city}, ${order.postalCode}<br>
              ${order.country}<br>
              ${order.phone}
            </div>
          </div>
          
          <h3 style="margin-bottom: 15px;">Order Items</h3>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th style="text-align: center;">#</th>
                  <th>Product</th>
                  <th style="text-align: center;">Qty</th>
                  <th style="text-align: right;">Price</th>
                  <th style="text-align: right;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>
          
          <div class="summary">
            <div class="summary-row">
              <span>Subtotal:</span>
              <span>$${subtotal.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span>Tax (10%):</span>
              <span>$${tax.toFixed(2)}</span>
            </div>
            <div class="summary-row">
              <span>Shipping:</span>
              <span>$${shipping.toFixed(2)}</span>
            </div>
            <div class="summary-row total">
              <span>Total:</span>
              <span>$${total.toFixed(2)}</span>
            </div>
          </div>
          
          ${order.notes ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #e7f3ff; border-radius: 6px; border-left: 4px solid #0066cc;">
              <strong>Order Notes:</strong><br>
              ${order.notes}
            </div>
          ` : ''}
        </div>
        
        <div class="footer">
          <p>Questions about your order? Contact us at <a href="mailto:support@fashon.com">support@fashon.com</a></p>
          <p style="margin-top: 10px; font-size: 12px;">© 2026 Fashon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return {
    to: user.email,
    subject: `Order Confirmation - Fashon #${order._id.toString().slice(-8).toUpperCase()}`,
    html: html
  };
}

/**
 * Builds an email template for order status update
 * @param {Object} order - The order object
 * @param {Object} user - The user object
 * @returns {Object} - Email object with subject and html content
 */
function buildOrderStatusUpdateEmail(order, user) {
  const orderNumber = order._id.toString().slice(-8).toUpperCase();
  const statusColor = {
    'pending': '#ffc107',
    'processed': '#17a2b8',
    'shipped': '#28a745',
    'delivered': '#28a745',
    'cancelled': '#dc3545'
  }[order.status] || '#6c757d';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Order Status Update - Fashon</title>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; font-weight: 300; }
        .content { padding: 30px; }
        .status-update { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin-bottom: 20px; text-align: center; }
        .status-badge { display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 16px; font-weight: 600; text-transform: uppercase; color: white; background-color: ${statusColor}; }
        .footer { background-color: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Status Update</h1>
          <p>Your order status has been updated</p>
        </div>
        
        <div class="content">
          <div class="status-update">
            <h3>Order #${orderNumber}</h3>
            <div class="status-badge">${order.status.replace('-', ' ')}</div>
            ${order.statusHistory && order.statusHistory.length > 0 ? 
              `<p style="margin-top: 15px; color: #666;">${order.statusHistory[order.statusHistory.length - 1].note || 'No additional notes'}</p>` 
              : ''}
          </div>
          
          <p>You can track your order status by logging into your account or contacting our customer support.</p>
          
          <p>Thank you for shopping with Fashon!</p>
        </div>
        
        <div class="footer">
          <p>Questions about your order? Contact us at <a href="mailto:support@fashon.com">support@fashon.com</a></p>
          <p style="margin-top: 10px; font-size: 12px;">© 2026 Fashon. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
  
  return {
    to: user.email,
    subject: `Order Status Update - Fashon #${orderNumber}`,
    html: html
  };
}

module.exports = {
  buildOrderCompletionEmail,
  buildOrderStatusUpdateEmail
};
