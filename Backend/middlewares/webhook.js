const crypto = require('crypto');
const https = require('https');
const http = require('http');
const EventEmitter = require('events');

class Webhook extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      timeout: options.timeout || 10000,
      retries: options.retries || 3,
      retryDelay: options.retryDelay || 1000,
      secret: options.secret || process.env.WEBHOOK_SECRET,
      userAgent: options.userAgent || 'Fashon-Webhook/1.0',
      ...options
    };
    
    this.webhooks = new Map();
    this.deliveryQueue = [];
    this.processing = false;
    
    this.init();
  }

  async init() {
    console.log('[WEBHOOK] Webhook service initialized');
    this.startProcessing();
  }

  register(url, events, options = {}) {
    const webhook = {
      id: this.generateId(),
      url,
      events: Array.isArray(events) ? events : [events],
      active: options.active !== false,
      secret: options.secret || this.options.secret,
      headers: options.headers || {},
      retries: options.retries || this.options.retries,
      timeout: options.timeout || this.options.timeout,
      createdAt: new Date().toISOString(),
      lastDelivery: null,
      deliveryCount: 0,
      failureCount: 0
    };

    this.webhooks.set(webhook.id, webhook);
    
    console.log(`[WEBHOOK] Registered webhook ${webhook.id} for events: ${webhook.events.join(', ')}`);
    
    return webhook.id;
  }

  unregister(webhookId) {
    const webhook = this.webhooks.get(webhookId);
    if (webhook) {
      this.webhooks.delete(webhookId);
      console.log(`[WEBHOOK] Unregistered webhook ${webhookId}`);
      return true;
    }
    return false;
  }

  async trigger(event, data, options = {}) {
    const payload = {
      event,
      data,
      timestamp: new Date().toISOString(),
      id: this.generateId(),
      ...options
    };

    const relevantWebhooks = Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(event));

    for (const webhook of relevantWebhooks) {
      this.deliveryQueue.push({
        webhook,
        payload,
        attempts: 0,
        createdAt: new Date().toISOString()
      });
    }

    this.emit('event:triggered', event, payload, relevantWebhooks.length);
    
    console.log(`[WEBHOOK] Triggered event '${event}' to ${relevantWebhooks.length} webhooks`);
    
    return relevantWebhooks.length;
  }

  startProcessing() {
    if (this.processing) return;
    this.processing = true;

    this.processQueue();
  }

  async processQueue() {
    if (this.deliveryQueue.length === 0) {
      this.processing = false;
      return;
    }

    const delivery = this.deliveryQueue.shift();
    await this.deliverWebhook(delivery);

    // Continue processing
    setImmediate(() => this.processQueue());
  }

  async deliverWebhook(delivery) {
    const { webhook, payload } = delivery;
    
    try {
      await this.sendWebhook(webhook, payload);
      
      // Update webhook stats
      webhook.lastDelivery = new Date().toISOString();
      webhook.deliveryCount++;
      
      this.emit('delivery:success', webhook, payload);
      console.log(`[WEBHOOK] Delivered webhook ${webhook.id} for event ${payload.event}`);
      
    } catch (error) {
      delivery.attempts++;
      webhook.failureCount++;
      
      this.emit('delivery:failed', webhook, payload, error);
      console.error(`[WEBHOOK] Failed to deliver webhook ${webhook.id}:`, error.message);
      
      // Retry logic
      if (delivery.attempts < webhook.retries) {
        const delay = this.options.retryDelay * Math.pow(2, delivery.attempts - 1);
        
        setTimeout(() => {
          this.deliveryQueue.push(delivery);
        }, delay);
        
        console.log(`[WEBHOOK] Scheduling retry ${delivery.attempts}/${webhook.retries} for webhook ${webhook.id}`);
      } else {
        this.emit('delivery:failed:permanent', webhook, payload, error);
        console.error(`[WEBHOOK] Permanent failure for webhook ${webhook.id} after ${delivery.attempts} attempts`);
      }
    }
  }

  async sendWebhook(webhook, payload) {
    return new Promise((resolve, reject) => {
      const url = new URL(webhook.url);
      const isHttps = url.protocol === 'https:';
      const lib = isHttps ? https : http;
      
      // Prepare payload
      const payloadString = JSON.stringify(payload);
      
      // Generate signature if secret is provided
      const signature = webhook.secret 
        ? this.generateSignature(payloadString, webhook.secret)
        : null;
      
      // Prepare headers
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString),
        'User-Agent': this.options.userAgent,
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp,
        ...webhook.headers
      };
      
      if (signature) {
        headers['X-Webhook-Signature'] = signature;
      }
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
        timeout: webhook.timeout
      };

      const req = lib.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: data
            });
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });

      // Send the request
      req.write(payloadString);
      req.end();
    });
  }

  generateSignature(payload, secret) {
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');
  }

  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  generateId() {
    return crypto.randomBytes(16).toString('hex');
  }

  getWebhook(webhookId) {
    return this.webhooks.get(webhookId);
  }

  getAllWebhooks() {
    return Array.from(this.webhooks.values());
  }

  getWebhooksByEvent(event) {
    return Array.from(this.webhooks.values())
      .filter(webhook => webhook.active && webhook.events.includes(event));
  }

  updateWebhook(webhookId, updates) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return false;
    
    Object.assign(webhook, updates);
    console.log(`[WEBHOOK] Updated webhook ${webhookId}`);
    return true;
  }

  activateWebhook(webhookId) {
    return this.updateWebhook(webhookId, { active: true });
  }

  deactivateWebhook(webhookId) {
    return this.updateWebhook(webhookId, { active: false });
  }

  testWebhook(webhookId, testPayload = null) {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) return Promise.reject(new Error('Webhook not found'));
    
    const payload = testPayload || {
      event: 'webhook.test',
      data: {
        message: 'This is a test webhook delivery',
        timestamp: new Date().toISOString()
      }
    };
    
    return this.sendWebhook(webhook, payload);
  }

  getStats() {
    const webhooks = Array.from(this.webhooks.values());
    
    return {
      total: webhooks.length,
      active: webhooks.filter(w => w.active).length,
      inactive: webhooks.filter(w => !w.active).length,
      queueSize: this.deliveryQueue.length,
      processing: this.processing,
      totalDeliveries: webhooks.reduce((sum, w) => sum + w.deliveryCount, 0),
      totalFailures: webhooks.reduce((sum, w) => sum + w.failureCount, 0)
    };
  }

  getDeliveryHistory(webhookId, limit = 50) {
    // In a real implementation, this would retrieve from a database
    // For now, return mock data
    return [];
  }

  async clearQueue() {
    this.deliveryQueue = [];
    console.log('[WEBHOOK] Delivery queue cleared');
  }

  async shutdown() {
    this.processing = false;
    await this.clearQueue();
    console.log('[WEBHOOK] Webhook service shutdown');
  }

  // Static method to create webhook middleware
  static middleware() {
    const webhookService = new Webhook();
    
    return (req, res, next) => {
      req.webhook = webhookService;
      next();
    };
  }
}

// Predefined event types
Webhook.Events = {
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_DELETED: 'product.deleted',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  REVIEW_CREATED: 'review.created',
  REVIEW_UPDATED: 'review.updated',
  CART_ABANDONED: 'cart.abandoned',
  LOW_STOCK: 'product.low_stock',
  OUT_OF_STOCK: 'product.out_of_stock'
};

module.exports = Webhook;
