class EmailTemplateBuilder {
  constructor() {
    this.templates = new Map();
    this.loadDefaultTemplates();
  }

  // Load default email templates
  loadDefaultTemplates() {
    const defaultTemplates = {
      welcome: {
        subject: 'Welcome to Fashon!',
        html: this.createWelcomeTemplate(),
        text: 'Welcome to Fashon! Your account has been created successfully.'
      },
      orderConfirmation: {
        subject: 'Order Confirmation - Fashon',
        html: this.createOrderConfirmationTemplate(),
        text: 'Thank you for your order! Your order has been confirmed.'
      },
      orderShipped: {
        subject: 'Your Order Has Shipped - Fashon',
        html: this.createOrderShippedTemplate(),
        text: 'Your order has been shipped and is on its way to you!'
      },
      orderDelivered: {
        subject: 'Order Delivered - Fashon',
        html: this.createOrderDeliveredTemplate(),
        text: 'Your order has been delivered successfully!'
      },
      passwordReset: {
        subject: 'Password Reset - Fashon',
        html: this.createPasswordResetTemplate(),
        text: 'Your password has been reset. Please use the link to create a new password.'
      },
      emailVerification: {
        subject: 'Verify Your Email - Fashon',
        html: this.createEmailVerificationTemplate(),
        text: 'Please verify your email address to complete your registration.'
      },
      lowStockAlert: {
        subject: 'Low Stock Alert - Fashon',
        html: this.createLowStockAlertTemplate(),
        text: 'A product is running low on stock and needs attention.'
      },
      promotional: {
        subject: 'Special Offer - Fashon',
        html: this.createPromotionalTemplate(),
        text: 'Check out our latest special offers and promotions!'
      }
    };

    defaultTemplates.forEach((template, key) => {
      this.templates.set(key, template);
    });
  }

  // Create welcome email template
  createWelcomeTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Fashon</title>
    <style>
        body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; background-color: white; }
        .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #eee; }
        .logo { font-size: 32px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
        .content { padding: 30px 0; }
        .welcome-message { font-size: 18px; margin-bottom: 20px; color: #333; }
        .features { margin: 30px 0; }
        .feature { margin-bottom: 15px; padding: 15px; background-color: #f8f9fa; border-radius: 5px; }
        .feature-title { font-weight: bold; color: #007bff; margin-bottom: 5px; }
        .cta-button { display: inline-block; padding: 15px 30px; background-color: #007bff; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🛍 FASHON</div>
        </div>
        
        <div class="content">
            <h1 class="welcome-message">Welcome to the Fashon Family!</h1>
            <p>We're thrilled to have you join our community of fashion enthusiasts. Your account has been created successfully and you're ready to start shopping for the latest trends and styles.</p>
            
            <div class="features">
                <div class="feature">
                    <div class="feature-title">🛒 Shop with Confidence</div>
                    <p>Browse thousands of products from top brands with secure payment options and fast delivery.</p>
                </div>
                
                <div class="feature">
                    <div class="feature-title">📱 Mobile Friendly</div>
                    <p>Access your account anytime, anywhere with our mobile-optimized platform and app.</p>
                </div>
                
                <div class="feature">
                    <div class="feature-title">💎 Exclusive Offers</div>
                    <p>Enjoy member-only discounts, early access to sales, and personalized recommendations.</p>
                </div>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
                <a href="{{shopUrl}}" class="cta-button">Start Shopping Now</a>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
            <p>This email was sent to {{email}}. If you didn't create an account, please ignore this email.</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Create order confirmation template
  createOrderConfirmationTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Order Confirmation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { padding: 30px; text-align: center; background-color: #007bff; color: white; }
        .content { padding: 30px; }
        .order-info { background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .order-number { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .order-details { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
        .detail-label { font-weight: bold; color: #666; }
        .product-item { border: 1px solid #eee; padding: 15px; margin-bottom: 10px; border-radius: 5px; }
        .product-image { width: 80px; height: 80px; object-fit: cover; border-radius: 5px; }
        .product-details { flex: 1; margin-left: 15px; }
        .total-section { background-color: #e9ecef; padding: 20px; border-radius: 5px; margin-top: 20px; }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📦 Order Confirmed!</h1>
            <p>Thank you for your purchase!</p>
        </div>
        
        <div class="content">
            <div class="order-info">
                <div class="order-number">Order #{{orderNumber}}</div>
                <div class="order-details">
                    <div>
                        <div class="detail-label">Order Date:</div>
                        <div>{{orderDate}}</div>
                    </div>
                    <div>
                        <div class="detail-label">Payment Method:</div>
                        <div>{{paymentMethod}}</div>
                    </div>
                    <div>
                        <div class="detail-label">Shipping Address:</div>
                        <div>{{shippingAddress}}</div>
                    </div>
                </div>
            </div>
            
            <h3>Order Items</h3>
            {{#each orderItems}}
            <div class="product-item">
                <img src="{{image}}" alt="{{name}}" class="product-image">
                <div class="product-details">
                    <h4>{{name}}</h4>
                    <p>Quantity: {{quantity}} | Price: ${{price}}</p>
                    <p>Size: {{size}} | Color: {{color}}</p>
                </div>
            </div>
            {{/each}}
            
            <div class="total-section">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>${{subtotal}}</span>
                </div>
                <div class="total-row">
                    <span>Shipping:</span>
                    <span>${{shippingCost}}</span>
                </div>
                <div class="total-row">
                    <span>Tax:</span>
                    <span>${{tax}}</span>
                </div>
                <div class="total-row" style="font-size: 18px; font-weight: bold; border-top: 2px solid #007bff; padding-top: 10px;">
                    <span>Total:</span>
                    <span>${{total}}</span>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
            <p>Questions? Contact us at support@fashon.com</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Create password reset template
  createPasswordResetTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Password Reset</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 500px; margin: 50px auto; background-color: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .lock-icon { font-size: 48px; color: #dc3545; margin-bottom: 20px; }
        .title { color: #333; font-size: 24px; margin-bottom: 10px; }
        .message { color: #666; line-height: 1.6; margin-bottom: 30px; }
        .reset-button { display: block; width: 100%; padding: 15px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; text-align: center; }
        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        .security-info { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="lock-icon">🔒</div>
            <h1 class="title">Password Reset Request</h1>
        </div>
        
        <div class="message">
            <p>We received a request to reset the password for your Fashon account. If you made this request, please click the button below to set a new password.</p>
            <p>This link will expire in 1 hour for security reasons.</p>
        </div>
        
        <a href="{{resetUrl}}" class="reset-button">Reset My Password</a>
        
        <div class="security-info">
            <p><strong>Security Notice:</strong></p>
            <ul>
                <li>Never share this link with anyone</li>
                <li>We'll never ask for your password via email</li>
                <li>If you didn't request this reset, please ignore this email</li>
            </ul>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
            <p>Need help? Contact support@fashon.com</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Create promotional template
  createPromotionalTemplate() {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Special Offer - Fashon</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; text-align: center; }
        .offer-title { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
        .offer-subtitle { font-size: 16px; opacity: 0.9; }
        .content { padding: 30px; }
        .deal-box { background-color: #fff3cd; border: 2px dashed #dc3545; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
        .discount-text { font-size: 36px; font-weight: bold; color: #dc3545; margin-bottom: 10px; }
        .deal-description { font-size: 18px; margin-bottom: 20px; }
        .products { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .product { text-align: center; padding: 15px; border: 1px solid #eee; border-radius: 5px; }
        .product-image { width: 100%; height: 120px; object-fit: cover; border-radius: 5px; margin-bottom: 10px; }
        .product-name { font-weight: bold; margin-bottom: 5px; }
        .product-price { color: #dc3545; font-size: 18px; font-weight: bold; }
        .cta-button { display: inline-block; padding: 15px 30px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
        .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 12px; }
        .expiry-notice { background-color: #fff3cd; color: #856404; padding: 10px; border-radius: 5px; text-align: center; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="offer-title">🔥 LIMITED TIME OFFER!</h1>
            <p class="offer-subtitle">Don't miss out on these amazing deals</p>
        </div>
        
        <div class="content">
            <div class="deal-box">
                <div class="discount-text">{{discount}}% OFF</div>
                <div class="deal-description">{{dealDescription}}</div>
                <p>Use code: <strong>{{promoCode}}</strong></p>
            </div>
            
            <h3>Featured Products</h3>
            <div class="products">
                {{#each featuredProducts}}
                <div class="product">
                    <img src="{{image}}" alt="{{name}}" class="product-image">
                    <div class="product-name">{{name}}</div>
                    <div class="product-price">${{originalPrice}} <span style="text-decoration: line-through; color: #999;">${{originalPrice}}</span></div>
                    <div class="product-price">${{salePrice}}</div>
                </div>
                {{/each}}
            </div>
            
            <div style="text-align: center;">
                <a href="{{shopUrl}}" class="cta-button">Shop Now & Save Big!</a>
            </div>
            
            <div class="expiry-notice">
                ⏰ This offer expires on {{expiryDate}}
            </div>
        </div>
        
        <div class="footer">
            <p>&copy; 2026 Fashon. All rights reserved.</p>
            <p>Questions? Contact us at support@fashon.com</p>
        </div>
    </div>
</body>
</html>
    `;
  }

  // Render template with data
  render(templateName, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template '${templateName}' not found`);
    }

    let html = template.html;
    
    // Simple template variable replacement
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (typeof value === 'string') {
        html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
      } else if (Array.isArray(value)) {
        // Handle arrays (like order items)
        const arrayRegex = new RegExp(`{{#each ${key}}}([\\s\\S]*?){{/each}}`, 'g');
        html = html.replace(arrayRegex, (match, content, endTag) => {
          if (value.length === 0) return '';
          return value.map(item => this.renderItemTemplate(content, item, endTag)).join('');
        });
      }
    });

    return html;
  }

  // Render individual item template
  renderItemTemplate(template, item, endTag) {
    let rendered = template;
    Object.keys(item).forEach(key => {
      const value = item[key];
      rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return rendered;
  }

  // Add custom template
  addTemplate(name, template) {
    this.templates.set(name, template);
  }

  // Get template
  getTemplate(name) {
    return this.templates.get(name);
  }

  // Send email using template
  async sendEmail(templateName, data, recipients, options = {}) {
    try {
      const html = this.render(templateName, data);
      const template = this.templates.get(templateName);
      
      const emailData = {
        to: Array.isArray(recipients) ? recipients : [recipients],
        subject: this.renderString(template.subject, data),
        html: html,
        text: template.text ? this.renderString(template.text, data) : null,
        ...options
      };

      // This would integrate with your email service
      console.log(`Email sent using template: ${templateName}`);
      console.log('Recipients:', recipients);
      
      return emailData;
      
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }

  // Simple string rendering
  renderString(template, data) {
    let rendered = template;
    Object.keys(data).forEach(key => {
      const value = data[key];
      if (typeof value === 'string') {
        rendered = rendered.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    });
    return rendered;
  }

  // Preview template
  previewTemplate(templateName, data = {}) {
    try {
      return this.render(templateName, data);
    } catch (error) {
      return `<div style="color: red; padding: 20px; border: 1px solid red;">Error: ${error.message}</div>`;
    }
  }

  // List all templates
  listTemplates() {
    return Array.from(this.templates.keys());
  }
}

// Create singleton instance
const emailTemplateBuilder = new EmailTemplateBuilder();

module.exports = emailTemplateBuilder;
