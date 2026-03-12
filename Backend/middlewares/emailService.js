const nodemailer = require('nodemailer');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const handlebars = require('handlebars');

class EmailService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      host: options.host || process.env.SMTP_HOST,
      port: options.port || process.env.SMTP_PORT || 587,
      secure: options.secure || false,
      auth: {
        user: options.user || process.env.SMTP_USER,
        pass: options.pass || process.env.SMTP_PASS
      },
      from: options.from || process.env.EMAIL_FROM || 'noreply@fashon.com',
      templatesDir: options.templatesDir || path.join(process.cwd(), 'templates', 'emails'),
      enableQueue: options.enableQueue !== false,
      enableRetry: options.enableRetry !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      enableLogging: options.enableLogging !== false,
      enablePreview: options.enablePreview || false,
      ...options
    };
    
    this.transporter = null;
    this.templates = new Map();
    this.queue = [];
    this.processing = false;
    this.stats = {
      sent: 0,
      failed: 0,
      queued: 0,
      retried: 0
    };
    
    this.init();
  }

  async init() {
    try {
      await this.createTransporter();
      await this.loadTemplates();
      
      if (this.options.enableQueue) {
        this.startQueueProcessor();
      }
      
      console.log('[EMAIL_SERVICE] Email service initialized');
    } catch (error) {
      console.error('[EMAIL_SERVICE] Failed to initialize:', error);
    }
  }

  async createTransporter() {
    this.transporter = nodemailer.createTransporter({
      host: this.options.host,
      port: this.options.port,
      secure: this.options.secure,
      auth: this.options.auth,
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      rateDelta: 1000,
      rateLimit: 10
    });
    
    // Verify connection
    await this.transporter.verify();
    console.log('[EMAIL_SERVICE] SMTP connection verified');
  }

  async loadTemplates() {
    try {
      const templateFiles = await fs.readdir(this.options.templatesDir);
      
      for (const file of templateFiles) {
        if (file.endsWith('.hbs') || file.endsWith('.html')) {
          const templateName = path.basename(file, path.extname(file));
          const templateContent = await fs.readFile(
            path.join(this.options.templatesDir, file),
            'utf8'
          );
          
          const compiledTemplate = handlebars.compile(templateContent);
          this.templates.set(templateName, compiledTemplate);
        }
      }
      
      console.log(`[EMAIL_SERVICE] Loaded ${this.templates.size} email templates`);
    } catch (error) {
      console.log('[EMAIL_SERVICE] No templates found, using plain text emails');
    }
  }

  async sendEmail(options) {
    const email = {
      id: this.generateId(),
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      template: options.template,
      data: options.data || {},
      attachments: options.attachments || [],
      priority: options.priority || 'normal',
      attempts: 0,
      createdAt: new Date().toISOString(),
      scheduledAt: options.scheduledAt,
      metadata: options.metadata || {}
    };

    // Generate HTML content if template is provided
    if (email.template && this.templates.has(email.template)) {
      const template = this.templates.get(email.template);
      email.html = template(email.data);
    } else if (options.html) {
      email.html = options.html;
    } else {
      email.text = options.text || this.generateTextContent(email.data);
    }

    // Add to queue or send immediately
    if (this.options.enableQueue) {
      this.queue.push(email);
      this.stats.queued++;
      
      this.emit('email:queued', email);
      console.log(`[EMAIL_SERVICE] Email queued: ${email.id}`);
      
      return email.id;
    } else {
      return await this.processEmail(email);
    }
  }

  async processEmail(email) {
    try {
      const mailOptions = {
        from: this.options.from,
        to: email.to,
        cc: email.cc,
        bcc: email.bcc,
        subject: email.subject,
        text: email.text,
        html: email.html,
        attachments: email.attachments,
        priority: email.priority,
        headers: {
          'X-Email-ID': email.id,
          'X-Email-Priority': email.priority
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      email.sentAt = new Date().toISOString();
      email.messageId = result.messageId;
      email.status = 'sent';
      
      this.stats.sent++;
      
      this.emit('email:sent', email, result);
      console.log(`[EMAIL_SERVICE] Email sent: ${email.id} to ${email.to}`);
      
      return result;
      
    } catch (error) {
      email.error = error.message;
      email.failedAt = new Date().toISOString();
      email.status = 'failed';
      
      this.stats.failed++;
      
      this.emit('email:failed', email, error);
      console.error(`[EMAIL_SERVICE] Email failed: ${email.id} - ${error.message}`);
      
      // Retry logic
      if (this.options.enableRetry && email.attempts < this.options.maxRetries) {
        return await this.retryEmail(email);
      }
      
      throw error;
    }
  }

  async retryEmail(email) {
    email.attempts++;
    this.stats.retried++;
    
    const delay = this.options.retryDelay * Math.pow(2, email.attempts - 1);
    
    this.emit('email:retry', email, delay);
    console.log(`[EMAIL_SERVICE] Retrying email ${email.id} in ${delay}ms (attempt ${email.attempts})`);
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await this.processEmail(email);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, delay);
    });
  }

  startQueueProcessor() {
    setInterval(async () => {
      if (!this.processing && this.queue.length > 0) {
        this.processing = true;
        
        while (this.queue.length > 0) {
          const email = this.queue.shift();
          
          try {
            await this.processEmail(email);
          } catch (error) {
            console.error(`[EMAIL_SERVICE] Queue processing error:`, error);
          }
        }
        
        this.processing = false;
      }
    }, 1000);
  }

  generateTextContent(data) {
    if (typeof data === 'string') {
      return data;
    }
    
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');
  }

  async sendWelcomeEmail(userEmail, userData = {}) {
    return await this.sendEmail({
      to: userEmail,
      subject: 'Welcome to Fashon!',
      template: 'welcome',
      data: {
        name: userData.name || 'Customer',
        email: userEmail,
        ...userData
      }
    });
  }

  async sendOrderConfirmation(userEmail, orderData) {
    return await this.sendEmail({
      to: userEmail,
      subject: `Order Confirmation #${orderData.orderId}`,
      template: 'order-confirmation',
      data: {
        customerName: orderData.customerName,
        orderId: orderData.orderId,
        items: orderData.items,
        total: orderData.total,
        shippingAddress: orderData.shippingAddress,
        estimatedDelivery: orderData.estimatedDelivery
      }
    });
  }

  async sendPasswordReset(userEmail, resetToken) {
    return await this.sendEmail({
      to: userEmail,
      subject: 'Password Reset Request',
      template: 'password-reset',
      data: {
        resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
        expiryHours: 1
      },
      priority: 'high'
    });
  }

  async sendShippingNotification(userEmail, shippingData) {
    return await this.sendEmail({
      to: userEmail,
      subject: `Your Order #${shippingData.orderId} Has Shipped!`,
      template: 'shipping-notification',
      data: {
        orderNumber: shippingData.orderId,
        trackingNumber: shippingData.trackingNumber,
        carrier: shippingData.carrier,
        estimatedDelivery: shippingData.estimatedDelivery,
        trackingLink: shippingData.trackingLink
      }
    });
  }

  async sendPromotionalEmail(userEmail, promotionData) {
    return await this.sendEmail({
      to: userEmail,
      subject: promotionData.subject || 'Special Offer Just for You!',
      template: 'promotion',
      data: {
        customerName: promotionData.customerName,
        promotionTitle: promotionData.title,
        promotionDescription: promotionData.description,
        discountCode: promotionData.discountCode,
        expiryDate: promotionData.expiryDate,
        shopLink: `${process.env.FRONTEND_URL}/shop`
      }
    });
  }

  async sendReviewRequest(userEmail, reviewData) {
    return await this.sendEmail({
      to: userEmail,
      subject: 'How was your experience?',
      template: 'review-request',
      data: {
        customerName: reviewData.customerName,
        productName: reviewData.productName,
        productImage: reviewData.productImage,
        reviewLink: `${process.env.FRONTEND_URL}/review/${reviewData.productId}`,
        orderId: reviewData.orderId
      }
    });
  }

  async sendAbandonedCartReminder(userEmail, cartData) {
    return await this.sendEmail({
      to: userEmail,
      subject: 'You left something in your cart!',
      template: 'abandoned-cart',
      data: {
        customerName: cartData.customerName,
        items: cartData.items,
        total: cartData.total,
        cartLink: `${process.env.FRONTEND_URL}/cart`,
        discountCode: cartData.discountCode
      }
    });
  }

  async sendLowStockAlert(adminEmail, productData) {
    return await this.sendEmail({
      to: adminEmail,
      subject: `Low Stock Alert: ${productData.name}`,
      template: 'low-stock-alert',
      data: {
        productName: productData.name,
        currentStock: productData.stock,
        minStock: productData.minStock,
        productLink: `${process.env.ADMIN_URL}/products/${productData.id}`,
        restockLink: `${process.env.ADMIN_URL}/products/${productData.id}/restock`
      },
      priority: 'high'
    });
  }

  async sendWeeklyReport(adminEmail, reportData) {
    return await this.sendEmail({
      to: adminEmail,
      subject: 'Weekly Performance Report',
      template: 'weekly-report',
      data: {
        week: reportData.week,
        totalOrders: reportData.totalOrders,
        totalRevenue: reportData.totalRevenue,
        newCustomers: reportData.newCustomers,
        topProducts: reportData.topProducts,
        reportLink: `${process.env.ADMIN_URL}/reports/weekly`
      }
    });
  }

  async scheduleEmail(options, delay) {
    const scheduledAt = new Date(Date.now() + delay).toISOString();
    
    return await this.sendEmail({
      ...options,
      scheduledAt
    });
  }

  async previewEmail(template, data) {
    if (!this.templates.has(template)) {
      throw new Error(`Template ${template} not found`);
    }
    
    const compiledTemplate = this.templates.get(template);
    const html = compiledTemplate(data);
    
    return {
      html,
      text: this.generateTextContent(data),
      template,
      data
    };
  }

  async addTemplate(name, content) {
    const compiledTemplate = handlebars.compile(content);
    this.templates.set(name, compiledTemplate);
    
    // Save to file
    const templatePath = path.join(this.options.templatesDir, `${name}.hbs`);
    await fs.writeFile(templatePath, content);
    
    console.log(`[EMAIL_SERVICE] Added template: ${name}`);
  }

  async removeTemplate(name) {
    this.templates.delete(name);
    
    // Remove file
    const templatePath = path.join(this.options.templatesDir, `${name}.hbs`);
    try {
      await fs.unlink(templatePath);
    } catch (error) {
      // File might not exist
    }
    
    console.log(`[EMAIL_SERVICE] Removed template: ${name}`);
  }

  getTemplate(name) {
    return this.templates.get(name) || null;
  }

  getAllTemplates() {
    return Array.from(this.templates.keys());
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      stats: this.stats
    };
  }

  clearQueue() {
    this.queue = [];
    console.log('[EMAIL_SERVICE] Email queue cleared');
  }

  async verifyConnection() {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('[EMAIL_SERVICE] Connection verification failed:', error);
      return false;
    }
  }

  generateId() {
    return `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  middleware() {
    return (req, res, next) => {
      req.emailService = this;
      next();
    };
  }

  // Static method to create email service
  static async create(options = {}) {
    const emailService = new EmailService(options);
    await emailService.init();
    return emailService;
  }
}

module.exports = EmailService;
