const EventEmitter = require('events');
const https = require('https');
const fs = require('fs').promises;
const path = require('path');

class PushNotification extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      fcm: {
        serverKey: options.fcm?.serverKey || process.env.FCM_SERVER_KEY,
        senderId: options.fcm?.senderId || process.env.FCM_SENDER_ID
      },
      apns: {
        keyId: options.apns?.keyId || process.env.APNS_KEY_ID,
        teamId: options.apns?.teamId || process.env.APNS_TEAM_ID,
        bundleId: options.apns?.bundleId || process.env.APNS_BUNDLE_ID,
        privateKey: options.apns?.privateKey || process.env.APNS_PRIVATE_KEY
      },
      enableQueue: options.enableQueue !== false,
      enableRetry: options.enableRetry !== false,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 5000,
      enableLogging: options.enableLogging !== false,
      enableTopics: options.enableTopics || false,
      defaultTTL: options.defaultTTL || 3600, // 1 hour
      ...options
    };
    
    this.devices = new Map();
    this.topics = new Map();
    this.queue = [];
    this.processing = false;
    this.stats = {
      sent: 0,
      failed: 0,
      queued: 0,
      retried: 0,
      devices: 0
    };
    
    this.init();
  }

  async init() {
    try {
      await this.loadDevices();
      
      if (this.options.enableQueue) {
        this.startQueueProcessor();
      }
      
      console.log('[PUSH_NOTIFICATION] Push notification service initialized');
    } catch (error) {
      console.error('[PUSH_NOTIFICATION] Failed to initialize:', error);
    }
  }

  async loadDevices() {
    try {
      const devicesFile = path.join(process.cwd(), 'data', 'devices.json');
      const content = await fs.readFile(devicesFile, 'utf8');
      const data = JSON.parse(content);
      
      this.devices = new Map(data.devices || []);
      this.topics = new Map(data.topics || {});
      this.stats.devices = this.devices.size;
      
      console.log(`[PUSH_NOTIFICATION] Loaded ${this.devices.size} devices`);
    } catch (error) {
      console.log('[PUSH_NOTIFICATION] No existing devices found, starting fresh');
    }
  }

  async saveDevices() {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      await fs.mkdir(dataDir, { recursive: true });
      
      const devicesFile = path.join(dataDir, 'devices.json');
      const data = {
        devices: Array.from(this.devices.entries()),
        topics: Object.fromEntries(this.topics),
        stats: this.stats,
        metadata: {
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        }
      };
      
      await fs.writeFile(devicesFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('[PUSH_NOTIFICATION] Failed to save devices:', error);
    }
  }

  registerDevice(deviceInfo) {
    const device = {
      id: deviceInfo.token || deviceInfo.deviceId,
      token: deviceInfo.token,
      platform: deviceInfo.platform, // 'ios', 'android', 'web'
      userId: deviceInfo.userId,
      appId: deviceInfo.appId,
      version: deviceInfo.version,
      model: deviceInfo.model,
      osVersion: deviceInfo.osVersion,
      isActive: true,
      registeredAt: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      metadata: deviceInfo.metadata || {}
    };

    this.devices.set(device.id, device);
    this.stats.devices = this.devices.size;
    
    this.saveDevices();
    this.emit('device:registered', device);
    
    console.log(`[PUSH_NOTIFICATION] Device registered: ${device.id} (${device.platform})`);
    
    return device.id;
  }

  unregisterDevice(deviceId) {
    const device = this.devices.get(deviceId);
    if (device) {
      device.isActive = false;
      device.unregisteredAt = new Date().toISOString();
      
      // Remove from all topics
      for (const [topicName, subscribers] of this.topics.entries()) {
        subscribers.delete(deviceId);
      }
      
      this.saveDevices();
      this.emit('device:unregistered', device);
      
      console.log(`[PUSH_NOTIFICATION] Device unregistered: ${deviceId}`);
      
      return true;
    }
    
    return false;
  }

  async subscribeToTopic(deviceId, topicName) {
    if (!this.devices.has(deviceId)) {
      throw new Error('Device not found');
    }
    
    if (!this.topics.has(topicName)) {
      this.topics.set(topicName, new Set());
    }
    
    this.topics.get(topicName).add(deviceId);
    
    this.saveDevices();
    this.emit('topic:subscribed', deviceId, topicName);
    
    console.log(`[PUSH_NOTIFICATION] Device ${deviceId} subscribed to topic: ${topicName}`);
    
    return true;
  }

  async unsubscribeFromTopic(deviceId, topicName) {
    if (this.topics.has(topicName)) {
      this.topics.get(topicName).delete(deviceId);
      
      // Remove topic if empty
      if (this.topics.get(topicName).size === 0) {
        this.topics.delete(topicName);
      }
      
      this.saveDevices();
      this.emit('topic:unsubscribed', deviceId, topicName);
      
      console.log(`[PUSH_NOTIFICATION] Device ${deviceId} unsubscribed from topic: ${topicName}`);
      
      return true;
    }
    
    return false;
  }

  async sendNotification(options) {
    const notification = {
      id: this.generateId(),
      title: options.title,
      body: options.body,
      data: options.data || {},
      badge: options.badge,
      sound: options.sound || 'default',
      image: options.image,
      actions: options.actions || [],
      category: options.category,
      ttl: options.ttl || this.options.defaultTTL,
      priority: options.priority || 'normal',
      collapseKey: options.collapseKey,
      target: options.target, // device token, user ID, or topic
      targetType: options.targetType || 'device', // 'device', 'user', 'topic'
      platforms: options.platforms || ['ios', 'android'],
      attempts: 0,
      createdAt: new Date().toISOString(),
      scheduledAt: options.scheduledAt,
      metadata: options.metadata || {}
    };

    // Add to queue or send immediately
    if (this.options.enableQueue) {
      this.queue.push(notification);
      this.stats.queued++;
      
      this.emit('notification:queued', notification);
      console.log(`[PUSH_NOTIFICATION] Notification queued: ${notification.id}`);
      
      return notification.id;
    } else {
      return await this.processNotification(notification);
    }
  }

  async processNotification(notification) {
    try {
      const targets = await this.resolveTargets(notification);
      const results = [];
      
      for (const target of targets) {
        try {
          let result;
          
          switch (target.platform) {
            case 'ios':
              result = await this.sendToAPNS(notification, target);
              break;
            case 'android':
              result = await this.sendToFCM(notification, target);
              break;
            case 'web':
              result = await this.sendToWeb(notification, target);
              break;
            default:
              console.warn(`[PUSH_NOTIFICATION] Unsupported platform: ${target.platform}`);
              continue;
          }
          
          results.push(result);
          
        } catch (error) {
          console.error(`[PUSH_NOTIFICATION] Failed to send to ${target.platform}:`, error);
          
          // Handle device token invalidation
          if (error.message.includes('Invalid token') || error.message.includes('Unregistered')) {
            this.unregisterDevice(target.deviceId);
          }
        }
      }
      
      notification.sentAt = new Date().toISOString();
      notification.status = 'sent';
      notification.results = results;
      
      this.stats.sent++;
      
      this.emit('notification:sent', notification, results);
      console.log(`[PUSH_NOTIFICATION] Notification sent: ${notification.id} to ${results.length} devices`);
      
      return results;
      
    } catch (error) {
      notification.error = error.message;
      notification.failedAt = new Date().toISOString();
      notification.status = 'failed';
      
      this.stats.failed++;
      
      this.emit('notification:failed', notification, error);
      console.error(`[PUSH_NOTIFICATION] Notification failed: ${notification.id} - ${error.message}`);
      
      // Retry logic
      if (this.options.enableRetry && notification.attempts < this.options.maxRetries) {
        return await this.retryNotification(notification);
      }
      
      throw error;
    }
  }

  async resolveTargets(notification) {
    const targets = [];
    
    switch (notification.targetType) {
      case 'device':
        const device = this.devices.get(notification.target);
        if (device && device.isActive) {
          targets.push({
            deviceId: device.id,
            token: device.token,
            platform: device.platform
          });
        }
        break;
        
      case 'user':
        for (const device of this.devices.values()) {
          if (device.userId === notification.target && device.isActive) {
            targets.push({
              deviceId: device.id,
              token: device.token,
              platform: device.platform
            });
          }
        }
        break;
        
      case 'topic':
        const subscribers = this.topics.get(notification.target);
        if (subscribers) {
          for (const deviceId of subscribers) {
            const device = this.devices.get(deviceId);
            if (device && device.isActive) {
              targets.push({
                deviceId: device.id,
                token: device.token,
                platform: device.platform
              });
            }
          }
        }
        break;
    }
    
    // Filter by platform if specified
    if (notification.platforms && notification.platforms.length > 0) {
      return targets.filter(target => notification.platforms.includes(target.platform));
    }
    
    return targets;
  }

  async sendToFCM(notification, target) {
    const payload = {
      to: target.token,
      notification: {
        title: notification.title,
        body: notification.body,
        image: notification.image,
        sound: notification.sound,
        badge: notification.badge
      },
      data: notification.data,
      priority: notification.priority === 'high' ? 'high' : 'normal',
      time_to_live: notification.ttl,
      collapse_key: notification.collapseKey,
      mutable_content: true
    };

    if (notification.actions.length > 0) {
      payload.notification.click_action = notification.actions[0].action;
    }

    const data = JSON.stringify(payload);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'fcm.googleapis.com',
        port: 443,
        path: '/fcm/send',
        method: 'POST',
        headers: {
          'Authorization': `key=${this.options.fcm.serverKey}`,
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            
            if (res.statusCode >= 200 && res.statusCode < 300) {
              if (response.failure === 0) {
                resolve({
                  success: true,
                  messageId: response.results[0].message_id,
                  platform: 'android'
                });
              } else {
                reject(new Error(response.results[0].error || 'FCM error'));
              }
            } else {
              reject(new Error(response.error || 'FCM API error'));
            }
          } catch (error) {
            reject(new Error('Invalid response from FCM'));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async sendToAPNS(notification, target) {
    const payload = {
      aps: {
        alert: {
          title: notification.title,
          body: notification.body
        },
        badge: notification.badge,
        sound: notification.sound,
        category: notification.category,
        'content-available': 1,
        'mutable-content': 1
      },
      ...notification.data
    };

    if (notification.image) {
      payload.aps['mutable-content'] = 1;
      payload.image = notification.image;
    }

    const data = JSON.stringify(payload);
    
    // Generate JWT token for APNS
    const token = this.generateAPNSToken();
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.push.apple.com',
        port: 443,
        path: `/3/device/${target.token}`,
        method: 'POST',
        headers: {
          'Authorization': `bearer ${token}`,
          'apns-topic': this.options.apns.bundleId,
          'apns-expiration': Math.floor(Date.now() / 1000) + notification.ttl,
          'apns-priority': notification.priority === 'high' ? '10' : '5',
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = https.request(options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({
              success: true,
              messageId: responseData.trim(),
              platform: 'ios'
            });
          } else {
            try {
              const response = JSON.parse(responseData);
              reject(new Error(response.reason || 'APNS error'));
            } catch (error) {
              reject(new Error(`APNS error: ${res.statusCode}`));
            }
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  async sendToWeb(notification, target) {
    // Web push notification using Web Push Protocol
    // This is a simplified implementation
    return {
      success: true,
      messageId: this.generateId(),
      platform: 'web'
    };
  }

  generateAPNSToken() {
    // Simplified JWT generation for APNS
    // In production, use proper JWT library
    const header = {
      alg: 'ES256',
      kid: this.options.apns.keyId
    };
    
    const payload = {
      iss: this.options.apns.teamId,
      iat: Math.floor(Date.now() / 1000)
    };
    
    // This is a placeholder - implement proper JWT signing
    return 'apns.jwt.token.placeholder';
  }

  async retryNotification(notification) {
    notification.attempts++;
    this.stats.retried++;
    
    const delay = this.options.retryDelay * Math.pow(2, notification.attempts - 1);
    
    this.emit('notification:retry', notification, delay);
    console.log(`[PUSH_NOTIFICATION] Retrying notification ${notification.id} in ${delay}ms (attempt ${notification.attempts})`);
    
    return new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          const result = await this.processNotification(notification);
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
          const notification = this.queue.shift();
          
          try {
            await this.processNotification(notification);
          } catch (error) {
            console.error(`[PUSH_NOTIFICATION] Queue processing error:`, error);
          }
        }
        
        this.processing = false;
      }
    }, 1000);
  }

  async sendWelcomeNotification(userId, userData = {}) {
    return await this.sendNotification({
      title: 'Welcome to Fashon!',
      body: 'Thanks for joining us. Start shopping for amazing products!',
      data: {
        type: 'welcome',
        userId: userId
      },
      targetType: 'user',
      target: userId
    });
  }

  async sendOrderNotification(userId, orderData) {
    return await this.sendNotification({
      title: 'Order Confirmed!',
      body: `Your order #${orderData.orderId} has been confirmed.`,
      data: {
        type: 'order_confirmed',
        orderId: orderData.orderId,
        total: orderData.total
      },
      badge: 1,
      targetType: 'user',
      target: userId
    });
  }

  async sendShippingNotification(userId, shippingData) {
    return await this.sendNotification({
      title: 'Your Order Has Shipped!',
      body: `Track your package: ${shippingData.trackingNumber}`,
      data: {
        type: 'order_shipped',
        orderId: shippingData.orderId,
        trackingNumber: shippingData.trackingNumber
      },
      actions: [
        { action: 'track', title: 'Track Package' }
      ],
      targetType: 'user',
      target: userId
    });
  }

  async sendPromotionalNotification(topic, promotionData) {
    return await this.sendNotification({
      title: promotionData.title || 'Special Offer!',
      body: promotionData.description || 'Check out our latest deals!',
      data: {
        type: 'promotion',
        promotionId: promotionData.id,
        discount: promotionData.discount
      },
      image: promotionData.image,
      targetType: 'topic',
      target: topic
    });
  }

  async sendAbandonedCartNotification(userId, cartData) {
    return await this.sendNotification({
      title: 'You left something in your cart!',
      body: `Complete your purchase before items sell out!`,
      data: {
        type: 'abandoned_cart',
        itemCount: cartData.itemCount,
        total: cartData.total
      },
      badge: cartData.itemCount,
      targetType: 'user',
      target: userId
    });
  }

  async sendLowStockNotification(topic, productData) {
    return await this.sendNotification({
      title: 'Low Stock Alert',
      body: `${productData.name} is running low on stock!`,
      data: {
        type: 'low_stock',
        productId: productData.id,
        stock: productData.stock
      },
      priority: 'high',
      targetType: 'topic',
      target: topic
    });
  }

  getDeviceStats() {
    const stats = {
      total: this.devices.size,
      active: 0,
      inactive: 0,
      byPlatform: {
        ios: 0,
        android: 0,
        web: 0
      },
      byUser: new Map()
    };
    
    for (const device of this.devices.values()) {
      if (device.isActive) {
        stats.active++;
      } else {
        stats.inactive++;
      }
      
      stats.byPlatform[device.platform] = (stats.byPlatform[device.platform] || 0) + 1;
      
      if (device.userId) {
        stats.byUser.set(device.userId, (stats.byUser.get(device.userId) || 0) + 1);
      }
    }
    
    return stats;
  }

  getTopicStats() {
    const stats = {};
    
    for (const [topicName, subscribers] of this.topics.entries()) {
      stats[topicName] = subscribers.size;
    }
    
    return stats;
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
    console.log('[PUSH_NOTIFICATION] Notification queue cleared');
  }

  generateId() {
    return `push_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  middleware() {
    return (req, res, next) => {
      req.pushNotification = this;
      next();
    };
  }

  // Static method to create push notification service
  static create(options = {}) {
    return new PushNotification(options);
  }
}

module.exports = PushNotification;
