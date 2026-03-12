const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

class Queue extends EventEmitter {
  constructor(name, options = {}) {
    super();
    this.name = name;
    this.options = {
      concurrency: options.concurrency || 5,
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000,
      deadLetterQueue: options.deadLetterQueue || `${name}-dlq`,
      persistenceEnabled: options.persistenceEnabled || true,
      ...options
    };
    
    this.jobs = [];
    this.running = new Set();
    this.completed = [];
    this.failed = [];
    this.processing = false;
    this.jobId = 0;
    
    this.init();
  }

  async init() {
    if (this.options.persistenceEnabled) {
      await this.loadPersistedJobs();
    }
    
    // Start processing
    this.process();
    
    console.log(`[QUEUE] Queue '${this.name}' initialized`);
  }

  async loadPersistedJobs() {
    try {
      const queueFile = path.join(process.cwd(), 'queues', `${this.name}.json`);
      const content = await fs.readFile(queueFile, 'utf8');
      const data = JSON.parse(content);
      
      this.jobs = data.jobs || [];
      this.completed = data.completed || [];
      this.failed = data.failed || [];
      this.jobId = data.jobId || 0;
      
      console.log(`[QUEUE] Loaded ${this.jobs.length} persisted jobs`);
    } catch (error) {
      // Queue file doesn't exist yet
      console.log(`[QUEUE] No persisted jobs found for '${this.name}'`);
    }
  }

  async persistJobs() {
    if (!this.options.persistenceEnabled) return;
    
    try {
      const queueDir = path.join(process.cwd(), 'queues');
      await fs.mkdir(queueDir, { recursive: true });
      
      const queueFile = path.join(queueDir, `${this.name}.json`);
      const data = {
        jobs: this.jobs,
        completed: this.completed,
        failed: this.failed,
        jobId: this.jobId
      };
      
      await fs.writeFile(queueFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error(`[QUEUE] Failed to persist jobs for '${this.name}':`, error);
    }
  }

  add(jobData, options = {}) {
    const job = {
      id: ++this.jobId,
      data: jobData,
      options: {
        priority: options.priority || 0,
        delay: options.delay || 0,
        attempts: 0,
        maxAttempts: options.maxAttempts || this.options.maxRetries,
        createdAt: new Date().toISOString(),
        ...options
      }
    };

    if (options.delay > 0) {
      job.options.delayedUntil = new Date(Date.now() + options.delay).toISOString();
    }

    this.jobs.push(job);
    this.jobs.sort((a, b) => b.options.priority - a.options.priority);
    
    this.emit('job:added', job);
    this.persistJobs();
    
    console.log(`[QUEUE] Job ${job.id} added to '${this.name}'`);
    
    return job.id;
  }

  async process() {
    if (this.processing) return;
    this.processing = true;

    while (this.jobs.length > 0 && this.running.size < this.options.concurrency) {
      const job = this.getNextJob();
      if (!job) break;

      this.running.add(job);
      this.emit('job:started', job);

      this.processJob(job);
    }

    this.processing = false;

    if (this.jobs.length > 0 || this.running.size > 0) {
      setTimeout(() => this.process(), 100);
    }
  }

  getNextJob() {
    const now = new Date();
    
    for (let i = 0; i < this.jobs.length; i++) {
      const job = this.jobs[i];
      
      // Check if job is delayed
      if (job.options.delayedUntil) {
        const delayedUntil = new Date(job.options.delayedUntil);
        if (delayedUntil > now) continue;
      }
      
      // Remove job from queue and return it
      this.jobs.splice(i, 1);
      return job;
    }
    
    return null;
  }

  async processJob(job) {
    const startTime = Date.now();
    
    try {
      console.log(`[QUEUE] Processing job ${job.id} in '${this.name}'`);
      
      // Execute the job
      const result = await this.executeJob(job);
      
      // Mark as completed
      job.options.completedAt = new Date().toISOString();
      job.options.duration = Date.now() - startTime;
      job.options.result = result;
      
      this.completed.push(job);
      this.running.delete(job);
      
      this.emit('job:completed', job);
      this.persistJobs();
      
      console.log(`[QUEUE] Job ${job.id} completed in ${job.options.duration}ms`);
      
    } catch (error) {
      console.error(`[QUEUE] Job ${job.id} failed:`, error);
      
      job.options.attempts++;
      job.options.lastError = error.message;
      job.options.failedAt = new Date().toISOString();
      
      if (job.options.attempts >= job.options.maxAttempts) {
        // Max retries reached, move to failed queue
        job.options.duration = Date.now() - startTime;
        this.failed.push(job);
        this.running.delete(job);
        
        this.emit('job:failed', job);
        this.persistJobs();
        
        console.log(`[QUEUE] Job ${job.id} failed after ${job.options.attempts} attempts`);
      } else {
        // Retry the job
        const retryDelay = this.options.retryDelay * Math.pow(2, job.options.attempts - 1);
        job.options.delayedUntil = new Date(Date.now() + retryDelay).toISOString();
        
        this.jobs.push(job);
        this.running.delete(job);
        
        this.emit('job:retry', job);
        
        console.log(`[QUEUE] Job ${job.id} scheduled for retry ${job.options.attempts}/${job.options.maxAttempts}`);
      }
    }
    
    // Continue processing
    this.process();
  }

  async executeJob(job) {
    // This method should be overridden by specific queue implementations
    throw new Error('executeJob method must be implemented by subclass');
  }

  getStats() {
    return {
      name: this.name,
      waiting: this.jobs.length,
      active: this.running.size,
      completed: this.completed.length,
      failed: this.failed.length,
      total: this.jobs.length + this.running.size + this.completed.length + this.failed.length,
      processing: this.processing
    };
  }

  getJob(jobId) {
    const job = this.jobs.find(j => j.id === jobId);
    if (job) return job;
    
    const runningJob = Array.from(this.running).find(j => j.id === jobId);
    if (runningJob) return runningJob;
    
    const completedJob = this.completed.find(j => j.id === jobId);
    if (completedJob) return completedJob;
    
    const failedJob = this.failed.find(j => j.id === jobId);
    if (failedJob) return failedJob;
    
    return null;
  }

  async removeJob(jobId) {
    // Remove from waiting jobs
    const index = this.jobs.findIndex(j => j.id === jobId);
    if (index !== -1) {
      this.jobs.splice(index, 1);
      this.persistJobs();
      return true;
    }
    
    // Cannot remove running jobs
    const runningJob = Array.from(this.running).find(j => j.id === jobId);
    if (runningJob) return false;
    
    // Remove from completed
    const completedIndex = this.completed.findIndex(j => j.id === jobId);
    if (completedIndex !== -1) {
      this.completed.splice(completedIndex, 1);
      this.persistJobs();
      return true;
    }
    
    // Remove from failed
    const failedIndex = this.failed.findIndex(j => j.id === jobId);
    if (failedIndex !== -1) {
      this.failed.splice(failedIndex, 1);
      this.persistJobs();
      return true;
    }
    
    return false;
  }

  async retryJob(jobId) {
    const job = this.getJob(jobId);
    if (!job) return false;
    
    // Reset job for retry
    job.options.attempts = 0;
    job.options.lastError = null;
    job.options.delayedUntil = null;
    
    // Remove from current location and add back to queue
    await this.removeJob(jobId);
    this.jobs.push(job);
    
    this.emit('job:retry', job);
    this.persistJobs();
    
    return true;
  }

  async clear() {
    this.jobs = [];
    this.completed = [];
    this.failed = [];
    this.jobId = 0;
    
    await this.persistJobs();
    
    this.emit('queue:cleared');
    
    console.log(`[QUEUE] Queue '${this.name}' cleared`);
  }

  async pause() {
    this.paused = true;
    this.emit('queue:paused');
    console.log(`[QUEUE] Queue '${this.name}' paused`);
  }

  async resume() {
    this.paused = false;
    this.emit('queue:resumed');
    this.process();
    console.log(`[QUEUE] Queue '${this.name}' resumed`);
  }

  async shutdown() {
    this.paused = true;
    
    // Wait for running jobs to complete
    while (this.running.size > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    await this.persistJobs();
    this.emit('queue:shutdown');
    
    console.log(`[QUEUE] Queue '${this.name}' shutdown complete`);
  }
}

class EmailQueue extends Queue {
  constructor() {
    super('emails', { concurrency: 3, maxRetries: 5 });
  }

  async executeJob(job) {
    const { to, subject, template, data } = job.data;
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`[EMAIL] Sent email to ${to}: ${subject}`);
    
    return {
      sent: true,
      to,
      subject,
      timestamp: new Date().toISOString()
    };
  }
}

class NotificationQueue extends Queue {
  constructor() {
    super('notifications', { concurrency: 10, maxRetries: 3 });
  }

  async executeJob(job) {
    const { userId, type, title, message, data } = job.data;
    
    // Simulate notification sending
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`[NOTIFICATION] Sent ${type} notification to user ${userId}: ${title}`);
    
    return {
      sent: true,
      userId,
      type,
      timestamp: new Date().toISOString()
    };
  }
}

class ReportQueue extends Queue {
  constructor() {
    super('reports', { concurrency: 2, maxRetries: 2 });
  }

  async executeJob(job) {
    const { type, parameters, userId } = job.data;
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`[REPORT] Generated ${type} report for user ${userId}`);
    
    return {
      generated: true,
      type,
      userId,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  Queue,
  EmailQueue,
  NotificationQueue,
  ReportQueue
};
