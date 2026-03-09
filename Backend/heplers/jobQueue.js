class JobQueue {
  constructor() {
    this.jobs = new Map();
    this.processing = new Set();
    this.maxConcurrent = 5;
    this.isProcessing = false;
  }
  
  // Add job to queue
  addJob(type, data, options = {}) {
    const job = {
      id: this.generateJobId(),
      type,
      data,
      options: {
        priority: options.priority || 0,
        delay: options.delay || 0,
        retries: options.retries || 3,
        timeout: options.timeout || 30000
      },
      status: 'pending',
      attempts: 0,
      createdAt: new Date(),
      scheduledAt: new Date(Date.now() + options.delay * 1000)
    };
    
    this.jobs.set(job.id, job);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    console.log(`[JOB:${job.id}] Added ${type} job to queue`);
    
    return job.id;
  }
  
  // Process jobs from queue
  async processQueue() {
    if (this.isProcessing || this.processing.size >= this.maxConcurrent) {
      return;
    }
    
    this.isProcessing = true;
    
    while (this.processing.size < this.maxConcurrent) {
      const job = this.getNextJob();
      
      if (!job) {
        this.isProcessing = false;
        break;
      }
      
      this.processing.add(job.id);
      
      // Process job asynchronously
      this.processJob(job).finally(() => {
        this.processing.delete(job.id);
        
        // Continue processing if there are more jobs
        if (this.jobs.size > this.processing.size) {
          setImmediate(() => this.processQueue());
        }
      });
    }
  }
  
  // Get next job to process
  getNextJob() {
    const now = new Date();
    let nextJob = null;
    let highestPriority = -Infinity;
    
    for (const job of this.jobs.values()) {
      if (job.status === 'pending' && 
          job.scheduledAt <= now &&
          job.options.priority > highestPriority) {
        nextJob = job;
        highestPriority = job.options.priority;
      }
    }
    
    return nextJob;
  }
  
  // Process individual job
  async processJob(job) {
    job.status = 'processing';
    job.startedAt = new Date();
    
    console.log(`[JOB:${job.id}] Processing ${job.type} job`);
    
    try {
      // Set timeout for job
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), job.options.timeout);
      });
      
      // Process job
      const jobPromise = this.executeJob(job);
      
      await Promise.race([jobPromise, timeoutPromise]);
      
      // Job completed successfully
      job.status = 'completed';
      job.completedAt = new Date();
      
      console.log(`[JOB:${job.id}] Completed ${job.type} job in ${job.completedAt - job.startedAt}ms`);
      
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date();
      
      console.error(`[JOB:${job.id}] Failed ${job.type} job: ${error.message}`);
      
      // Retry job if attempts remaining
      if (job.attempts < job.options.retries) {
        job.attempts++;
        job.status = 'pending';
        job.scheduledAt = new Date(Date.now() + (job.attempts * 5000)); // Exponential backoff
        
        console.log(`[JOB:${job.id}] Retrying ${job.type} job (attempt ${job.attempts})`);
      }
    }
    
    // Clean up completed jobs after some time
    setTimeout(() => {
      if (job.status === 'completed') {
        this.jobs.delete(job.id);
      }
    }, 60000); // Keep completed jobs for 1 minute
  }
  
  // Execute job based on type
  async executeJob(job) {
    switch (job.type) {
      case 'send_email':
        await this.sendEmail(job.data);
        break;
      case 'process_order':
        await this.processOrder(job.data);
        break;
      case 'update_inventory':
        await this.updateInventory(job.data);
        break;
      case 'send_notification':
        await this.sendNotification(job.data);
        break;
      case 'cleanup_data':
        await this.cleanupData(job.data);
        break;
      case 'backup_data':
        await this.backupData(job.data);
        break;
      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }
  
  // Job handlers
  async sendEmail(data) {
    const emailSender = require('./email_sender');
    await emailSender.sendEmail(data);
  }
  
  async processOrder(data) {
    const OrderModel = require('../models/order');
    const order = await OrderModel.findById(data.orderId);
    
    if (order) {
      order.status = 'processed';
      await order.save();
    }
  }
  
  async updateInventory(data) {
    const ProductModel = require('../models/product');
    await ProductModel.findByIdAndUpdate(
      data.productId,
      { $inc: { numberInStock: data.quantity } }
    );
  }
  
  async sendNotification(data) {
    const notificationService = require('./notificationService');
    await notificationService.createNotification(
      data.userId,
      data.type,
      data.title,
      data.message,
      data.metadata
    );
  }
  
  async cleanupData(data) {
    const backupUtility = require('./backupUtility');
    await backupUtility.cleanupOldBackups(data.daysToKeep || 30);
  }
  
  async backupData(data) {
    const backupUtility = require('./backupUtility');
    await backupUtility.backupAllCollections();
  }
  
  // Get job status
  getJobStatus(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) {
      return null;
    }
    
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      attempts: job.attempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      failedAt: job.failedAt,
      error: job.error
    };
  }
  
  // Get queue statistics
  getQueueStats() {
    const stats = {
      total: this.jobs.size,
      pending: 0,
      processing: this.processing.size,
      completed: 0,
      failed: 0
    };
    
    for (const job of this.jobs.values()) {
      stats[job.status]++;
    }
    
    return stats;
  }
  
  // Generate unique job ID
  generateJobId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
  
  // Cancel job
  cancelJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'pending') {
      job.status = 'cancelled';
      job.cancelledAt = new Date();
      this.jobs.delete(jobId);
      return true;
    }
    return false;
  }
  
  // Clear completed jobs
  clearCompletedJobs() {
    const completedJobs = [];
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (job.status === 'completed') {
        completedJobs.push(jobId);
      }
    }
    
    completedJobs.forEach(jobId => {
      this.jobs.delete(jobId);
    });
    
    return completedJobs.length;
  }
}

// Create singleton instance
const jobQueue = new JobQueue();

module.exports = jobQueue;
