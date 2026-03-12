const EventEmitter = require('events');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

class SMSService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      provider: options.provider || 'twilio', // twilio, nexmo, plivo, custom
      apiKey: options.apiKey || process.env.SMS_API_KEY,
      apiSecret: options.apiSecret || process.env.SMS_API_SECRET,
      from: options.from || process.env.SMS_FROM_NUMBER,
      enableQueue: options.enableQueue !== false,
      enableRetry: options.enableRetry !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      enableLogging: options.enableLogging !== false,
      rateLimit: options.rateLimit || 10, // messages per second
      customEndpoint: options.customEndpoint,
      ...options
    };
    
    this.queue = [];
    this.processing = false;
    this.lastSent = 0;
    this.stats = {
      sent: 0,
      failed: 0,
      queued: 0,
      retried: 0,
      rateLimited: 0
    };
    
    this.init();
  }

  init() {
    if (this.options.enableQueue) {
      this.startQueueProcessor();
    }
    
    console.log(`[SMS_SERVICE] SMS service initialized with provider: ${this.options.provider}`);
  }

  async sendSMS(options) {
    const sms = {
      id: this.generateId(),
      to: options.to,
      from: options.from || this.options.from,
      message: options.message,
      template: options.template,
      data: options.data || {},
      priority: options.priority || 'normal',
      attempts: 0,
      createdAt: new Date().toISOString(),
      scheduledAt: options.scheduledAt,
      metadata: options.metadata || {}
    };

    // Process template if provided
    if (sms.template && sms.data) {
      sms.message = this.processTemplate(sms.template, sms.data);
    }

    // Validate phone number
    if (!this.isValidPhoneNumber(sms.to)) {
      throw new Error('Invalid phone number format');
    }

    // Check message length
    if (sms.message.length > 1600) {
      throw new Error('Message too long (max 1600 characters)');
    }

    // Add to queue or send immediately
    if (this.options.enableQueue) {
      this.queue.push(sms);
      this.stats.queued++;
      
      this.emit('sms:queued', sms);
      console.log(`[SMS_SERVICE] SMS queued: ${sms.id} to ${sms.to}`);
      
      return sms.id;
    } else {
      return await this.processSMS(sms);
    }
  }

  async processSMS(sms) {
    try {
      // Rate limiting
      await this.checkRateLimit();
      
      let result;
      
      switch (this.options.provider.toLowerCase()) {
        case 'twilio':
          result = await this.sendViaTwilio(sms);
          break;
        case 'nexmo':
          result = await this.sendViaNexmo(sms);
          break;
        case 'plivo':
          result = await this.sendViaPlivo(sms);
          break;
        case 'custom':
          result = await this.sendViaCustom(sms);
          break;
        default:
          throw new Error(`Unsupported SMS provider: ${this.options.provider}`);
      }
      
      sms.sentAt = new Date().toISOString();
      sms.messageId = result.messageId;
      sms.status = 'sent';
      sms.providerResponse = result;
      
      this.stats.sent++;
      this.lastSent = Date.now();
      
      this.emit('sms:sent', sms, result);
      console.log(`[SMS_SERVICE] SMS sent: ${sms.id} to ${sms.to}`);
      
      return result;
      
    } catch (error) {
      sms.error = error.message;
      sms.failedAt = new Date().toISOString();
      sms.status = 'failed';
      
      this.stats.failed++;
      
      this.emit('sms:failed', sms, error);
      console.error(`[SMS_SERVICE] SMS failed: ${sms.id} - ${error.message}`);
      
      // Retry logic
      if (this.options.enableRetry && sms.attempts < this.options.maxRetries) {
        return await this.retrySMS(sms);
      }
      
      throw error;
    }
  }

  async sendViaTwilio(sms) {
    const auth = Buffer.from(`${this.options.apiKey}:${this.options.apiSecret}`).toString('base64');
    
    const data = new URLSearchParams({
      To: sms.to,
      From: sms.from,
      Body: sms.message
    });

    const options = {
      hostname: 'api.twilio.com',
      port: 443,
      path: `/2010-04-01/Accounts/${this.options.apiKey}/Messages.json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                messageId: response.sid,
                status: response.status,
                provider: 'twilio'
              });
            } else {
              reject(new Error(response.message || 'Twilio API error'));
            }
          } catch (error) {
            reject(new Error('Invalid response from Twilio'));
          }
        });
      });

      req.on('error', reject);
      req.write(data.toString());
      req.end();
    });
  }

  async sendViaNexmo(sms) {
    const data = JSON.stringify({
      from: sms.from,
      to: sms.to,
      text: sms.message
    });

    const options = {
      hostname: 'rest.nexmo.com',
      port: 443,
      path: `/sms/json`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.options.apiKey}`,
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                messageId: response.messages[0]['message-id'],
                status: response.messages[0].status,
                provider: 'nexmo'
              });
            } else {
              reject(new Error(response.message || 'Nexmo API error'));
            }
          } catch (error) {
            reject(new Error('Invalid response from Nexmo'));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async sendViaPlivo(sms) {
    const auth = Buffer.from(`${this.options.apiKey}:${this.options.apiSecret}`).toString('base64');
    
    const data = new URLSearchParams({
      src: sms.from,
      dst: sms.to,
      text: sms.message
    });

    const options = {
      hostname: 'api.plivo.com',
      port: 443,
      path: `/v1/Account/${this.options.apiKey}/Message/`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`,
        'Content-Length': data.length
      }
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                messageId: response.message_uuids[0],
                status: 'sent',
                provider: 'plivo'
              });
            } else {
              reject(new Error(response.error || 'Plivo API error'));
            }
          } catch (error) {
            reject(new Error('Invalid response from Plivo'));
          }
        });
      });

      req.on('error', reject);
      req.write(data.toString());
      req.end();
    });
  }

  async sendViaCustom(sms) {
    if (!this.options.customEndpoint) {
      throw new Error('Custom endpoint not configured');
    }

    const data = JSON.stringify({
      to: sms.to,
      from: sms.from,
      message: sms.message,
      apiKey: this.options.apiKey
    });

    const url = new URL(this.options.customEndpoint);
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const lib = url.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = lib.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve({
                messageId: response.id || response.messageId,
                status: response.status || 'sent',
                provider: 'custom'
              });
            } else {
              reject(new Error(response.error || 'Custom SMS API error'));
            }
          } catch (error) {
            reject(new Error('Invalid response from custom SMS provider'));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async checkRateLimit() {
    const now = Date.now();
    const timeSinceLastSent = now - this.lastSent;
    const minInterval = 1000 / this.options.rateLimit;
    
    if (timeSinceLastSent < minInterval) {
      const delay = minInterval - timeSinceLastSent;
      this.stats.rateLimited++;
      
      this.emit('sms:rate_limited', delay);
      
      return new Promise(resolve => {
        setTimeout(resolve, delay);
      });
    }
  }

  async retrySMS(sms) {
    sms.attempts++;
    this.stats.retried++;
    
    const delay = this.options.retryDelay * Math.pow(2, sms.attempts - 1);
    
    this.emit('sms:retry', sms, delay);
    console.log(`[SMS_SERVICE] Retrying SMS ${sms.id} in ${delay}ms (attempt ${sms.attempts})`);
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await this.processSMS(sms);
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
          const sms = this.queue.shift();
          
          try {
            await this.processSMS(sms);
          } catch (error) {
            console.error(`[SMS_SERVICE] Queue processing error:`, error);
          }
        }
        
        this.processing = false;
      }
    }, 1000);
  }

  processTemplate(template, data) {
    // Simple template processing
    let message = template;
    
    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{{${key}}}`;
      message = message.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return message;
  }

  isValidPhoneNumber(phone) {
    // Basic phone number validation
    // In production, use a proper phone number validation library
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  async sendVerificationCode(phoneNumber, code) {
    return await this.sendSMS({
      to: phoneNumber,
      template: 'Your verification code is: {{code}}. This code will expire in 10 minutes.',
      data: { code },
      priority: 'high'
    });
  }

  async sendOrderConfirmation(phoneNumber, orderData) {
    return await this.sendSMS({
      to: phoneNumber,
      template: 'Your order #{{orderId}} has been confirmed! Total: ${{total}}. Track at {{trackingUrl}}',
      data: {
        orderId: orderData.orderId,
        total: orderData.total,
        trackingUrl: orderData.trackingUrl
      }
    });
  }

  async sendShippingNotification(phoneNumber, shippingData) {
    return await this.sendSMS({
      to: phoneNumber,
      template: 'Your order #{{orderId}} has shipped! Tracking: {{trackingNumber}}. Expected delivery: {{deliveryDate}}',
      data: {
        orderId: shippingData.orderId,
        trackingNumber: shippingData.trackingNumber,
        deliveryDate: shippingData.deliveryDate
      }
    });
  }

  async sendAppointmentReminder(phoneNumber, appointmentData) {
    return await this.sendSMS({
      to: phoneNumber,
      template: 'Reminder: You have an appointment on {{date}} at {{time}}. Location: {{location}}',
      data: {
        date: appointmentData.date,
        time: appointmentData.time,
        location: appointmentData.location
      }
    });
  }

  async sendPromotionalMessage(phoneNumber, promotionData) {
    return await this.sendSMS({
      to: phoneNumber,
      template: 'Special offer! {{offer}}. Use code {{code}}. Valid until {{expiry}}. Reply STOP to unsubscribe',
      data: {
        offer: promotionData.offer,
        code: promotionData.code,
        expiry: promotionData.expiry
      }
    });
  }

  async sendAlert(phoneNumber, alertData) {
    return await this.sendSMS({
      to: phoneNumber,
      template: 'ALERT: {{message}}. Action required: {{action}}',
      data: {
        message: alertData.message,
        action: alertData.action
      },
      priority: 'high'
    });
  }

  async scheduleSMS(options, delay) {
    const scheduledAt = new Date(Date.now() + delay).toISOString();
    
    return await this.sendSMS({
      ...options,
      scheduledAt
    });
  }

  getQueueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      stats: this.stats,
      provider: this.options.provider
    };
  }

  clearQueue() {
    this.queue = [];
    console.log('[SMS_SERVICE] SMS queue cleared');
  }

  generateId() {
    return `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  middleware() {
    return (req, res, next) => {
      req.smsService = this;
      next();
    };
  }

  // Static method to create SMS service
  static create(options = {}) {
    return new SMSService(options);
  }
}

module.exports = SMSService;
