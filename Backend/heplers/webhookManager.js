const crypto = require('crypto');
const axios = require('axios');

class WebhookManager {
  constructor() {
    this.webhooks = new Map();
    this.eventQueue = [];
    this.isProcessing = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000;
    this.timeout = 10000;
    this.secretKey = process.env.WEBHOOK_SECRET || 'default-webhook-secret';
  }

  // Register webhook
  registerWebhook(id, config) {
    const webhook = {
      id,
      url: config.url,
      events: config.events || [],
      headers: config.headers || {},
      secret: config.secret || this.secretKey,
      active: config.active !== false,
      retryAttempts: config.retryAttempts || this.retryAttempts,
      retryDelay: config.retryDelay || this.retryDelay,
      timeout: config.timeout || this.timeout,
      createdAt: new Date(),
      lastTriggered: null,
      successCount: 0,
      failureCount: 0
    };

    // Validate webhook configuration
    this.validateWebhook(webhook);

    this.webhooks.set(id, webhook);
    console.log(`[WEBHOOK] Registered webhook: ${id} for events: ${webhook.events.join(', ')}`);

    return webhook;
  }

  // Validate webhook configuration
  validateWebhook(webhook) {
    if (!webhook.url) {
      throw new Error('Webhook URL is required');
    }

    try {
      new URL(webhook.url);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    if (!Array.isArray(webhook.events) || webhook.events.length === 0) {
      throw new Error('At least one event must be specified');
    }
  }

  // Unregister webhook
  unregisterWebhook(id) {
    const webhook = this.webhooks.get(id);
    
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    this.webhooks.delete(id);
    console.log(`[WEBHOOK] Unregistered webhook: ${id}`);

    return webhook;
  }

  // Trigger webhook event
  async triggerEvent(eventName, payload, options = {}) {
    const event = {
      name: eventName,
      payload,
      timestamp: new Date(),
      id: this.generateEventId(),
      options: {
        immediate: options.immediate || false,
        priority: options.priority || 0
      }
    };

    // Add to queue
    if (event.options.immediate) {
      await this.processEvent(event);
    } else {
      this.eventQueue.push(event);
      this.sortEventQueue();
      
      if (!this.isProcessing) {
        this.startProcessing();
      }
    }

    return event.id;
  }

  // Generate event ID
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Sort event queue by priority
  sortEventQueue() {
    this.eventQueue.sort((a, b) => b.options.priority - a.options.priority);
  }

  // Start processing events
  startProcessing() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processQueue();
  }

  // Process event queue
  async processQueue() {
    while (this.eventQueue.length > 0 && this.isProcessing) {
      const event = this.eventQueue.shift();
      
      try {
        await this.processEvent(event);
      } catch (error) {
        console.error(`[WEBHOOK] Error processing event ${event.id}:`, error);
      }
    }

    this.isProcessing = false;
  }

  // Process individual event
  async processEvent(event) {
    const relevantWebhooks = this.getRelevantWebhooks(event.name);
    
    if (relevantWebhooks.length === 0) {
      console.log(`[WEBHOOK] No webhooks for event: ${event.name}`);
      return;
    }

    const promises = relevantWebhooks.map(webhook => 
      this.sendWebhook(webhook, event)
    );

    await Promise.allSettled(promises);
  }

  // Get webhooks relevant to event
  getRelevantWebhooks(eventName) {
    const relevant = [];
    
    for (const webhook of this.webhooks.values()) {
      if (webhook.active && webhook.events.includes(eventName)) {
        relevant.push(webhook);
      }
    }
    
    return relevant;
  }

  // Send webhook
  async sendWebhook(webhook, event) {
    const startTime = Date.now();
    
    try {
      const payload = {
        id: event.id,
        event: event.name,
        timestamp: event.timestamp,
        data: event.payload
      };

      const headers = {
        'Content-Type': 'application/json',
        'User-Agent': 'Fashon-Webhook/1.0',
        'X-Webhook-ID': webhook.id,
        'X-Event-ID': event.id,
        'X-Event-Name': event.name,
        'X-Timestamp': event.timestamp.toISOString(),
        ...webhook.headers
      };

      // Add signature if secret is provided
      if (webhook.secret) {
        headers['X-Signature'] = this.generateSignature(payload, webhook.secret);
      }

      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: webhook.timeout,
        maxRedirects: 5
      });

      const duration = Date.now() - startTime;
      
      // Update webhook stats
      webhook.lastTriggered = new Date();
      webhook.successCount++;
      
      console.log(`[WEBHOOK] Successfully sent webhook ${webhook.id} for event ${event.name} (${duration}ms)`);
      
      return {
        success: true,
        webhookId: webhook.id,
        eventId: event.id,
        statusCode: response.status,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Update webhook stats
      webhook.lastTriggered = new Date();
      webhook.failureCount++;
      
      console.error(`[WEBHOOK] Failed to send webhook ${webhook.id} for event ${event.name}:`, error.message);
      
      // Retry if configured
      if (webhook.retryAttempts > 0) {
        await this.retryWebhook(webhook, event, webhook.retryAttempts);
      }
      
      return {
        success: false,
        webhookId: webhook.id,
        eventId: event.id,
        error: error.message,
        duration
      };
    }
  }

  // Generate signature for webhook
  generateSignature(payload, secret) {
    const payloadString = JSON.stringify(payload);
    return 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');
  }

  // Verify webhook signature
  verifySignature(payload, signature, secret) {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  // Retry webhook
  async retryWebhook(webhook, event, attemptsLeft) {
    if (attemptsLeft <= 0) {
      console.error(`[WEBHOOK] Max retries reached for webhook ${webhook.id}`);
      return;
    }

    console.log(`[WEBHOOK] Retrying webhook ${webhook.id} in ${webhook.retryDelay}ms (${attemptsLeft} attempts left)`);
    
    setTimeout(async () => {
      try {
        await this.sendWebhook(webhook, event);
      } catch (error) {
        await this.retryWebhook(webhook, event, attemptsLeft - 1);
      }
    }, webhook.retryDelay);
  }

  // Get webhook status
  getWebhookStatus(id) {
    const webhook = this.webhooks.get(id);
    
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    return {
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      createdAt: webhook.createdAt,
      lastTriggered: webhook.lastTriggered,
      successCount: webhook.successCount,
      failureCount: webhook.failureCount,
      successRate: webhook.successCount + webhook.failureCount > 0 ? 
        (webhook.successCount / (webhook.successCount + webhook.failureCount)) * 100 : 0
    };
  }

  // Get all webhooks status
  getAllWebhooksStatus() {
    const status = {};
    
    for (const [id, webhook] of this.webhooks.entries()) {
      status[id] = this.getWebhookStatus(id);
    }
    
    return status;
  }

  // Update webhook
  updateWebhook(id, updates) {
    const webhook = this.webhooks.get(id);
    
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    // Validate updates
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        throw new Error('Invalid webhook URL');
      }
    }

    Object.assign(webhook, updates);
    console.log(`[WEBHOOK] Updated webhook: ${id}`);
    
    return webhook;
  }

  // Toggle webhook active status
  toggleWebhook(id) {
    const webhook = this.webhooks.get(id);
    
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    webhook.active = !webhook.active;
    console.log(`[WEBHOOK] ${webhook.active ? 'Activated' : 'Deactivated'} webhook: ${id}`);
    
    return webhook.active;
  }

  // Test webhook
  async testWebhook(id, testPayload = {}) {
    const webhook = this.webhooks.get(id);
    
    if (!webhook) {
      throw new Error(`Webhook ${id} not found`);
    }

    const testEvent = {
      name: 'test',
      payload: {
        message: 'This is a test webhook',
        timestamp: new Date(),
        ...testPayload
      },
      timestamp: new Date(),
      id: this.generateEventId()
    };

    return await this.sendWebhook(webhook, testEvent);
  }

  // Get event queue status
  getQueueStatus() {
    return {
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
      totalWebhooks: this.webhooks.size,
      activeWebhooks: Array.from(this.webhooks.values()).filter(w => w.active).length
    };
  }

  // Clear event queue
  clearQueue() {
    const cleared = this.eventQueue.length;
    this.eventQueue = [];
    console.log(`[WEBHOOK] Cleared ${cleared} events from queue`);
    
    return cleared;
  }

  // Get webhook statistics
  getStats() {
    const stats = {
      totalWebhooks: this.webhooks.size,
      activeWebhooks: 0,
      totalEvents: 0,
      successfulCalls: 0,
      failedCalls: 0,
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing
    };

    for (const webhook of this.webhooks.values()) {
      if (webhook.active) {
        stats.activeWebhooks++;
      }
      
      stats.successfulCalls += webhook.successCount;
      stats.failedCalls += webhook.failureCount;
    }

    return stats;
  }

  // Export webhooks
  exportWebhooks() {
    const webhooks = {};
    
    for (const [id, webhook] of this.webhooks.entries()) {
      webhooks[id] = {
        id: webhook.id,
        url: webhook.url,
        events: webhook.events,
        headers: webhook.headers,
        active: webhook.active,
        retryAttempts: webhook.retryAttempts,
        retryDelay: webhook.retryDelay,
        timeout: webhook.timeout,
        createdAt: webhook.createdAt
      };
    }
    
    return webhooks;
  }

  // Import webhooks
  importWebhooks(webhooks) {
    const imported = [];
    
    for (const [id, config] of Object.entries(webhooks)) {
      try {
        const webhook = this.registerWebhook(id, config);
        imported.push(webhook);
      } catch (error) {
        console.error(`[WEBHOOK] Failed to import webhook ${id}:`, error.message);
      }
    }
    
    console.log(`[WEBHOOK] Imported ${imported.length} webhooks`);
    
    return imported;
  }

  // Middleware for webhook verification
  verificationMiddleware(secret = this.secretKey) {
    return (req, res, next) => {
      const signature = req.headers['x-signature'];
      
      if (!signature) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SIGNATURE',
            message: 'X-Signature header is required'
          }
        });
      }

      const body = JSON.stringify(req.body);
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      )) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_SIGNATURE',
            message: 'Invalid webhook signature'
          }
        });
      }

      req.webhookVerified = true;
      next();
    };
  }

  // Cleanup old webhooks
  cleanupWebhooks(daysOld = 30) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [id, webhook] of this.webhooks.entries()) {
      if (webhook.lastTriggered && webhook.lastTriggered < cutoffDate && !webhook.active) {
        this.webhooks.delete(id);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[WEBHOOK] Cleaned up ${cleaned} old webhooks`);
    }
    
    return cleaned;
  }
}

// Create singleton instance
const webhookManager = new WebhookManager();

module.exports = webhookManager;
