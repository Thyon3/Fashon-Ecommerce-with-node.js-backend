const EventEmitter = require('events');

class QueueManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.queues = new Map();
    this.workers = new Map();
    this.maxConcurrency = options.maxConcurrency || 10;
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.defaultPriority = 0;
    this.isProcessing = false;
  }

  // Create a new queue
  createQueue(name, options = {}) {
    if (this.queues.has(name)) {
      throw new Error(`Queue ${name} already exists`);
    }

    const queue = {
      name,
      tasks: [],
      processing: new Set(),
      completed: [],
      failed: [],
      options: {
        concurrency: options.concurrency || this.maxConcurrency,
        priority: options.priority || this.defaultPriority,
        timeout: options.timeout || 30000,
        retries: options.retries || this.retryAttempts,
        retryDelay: options.retryDelay || this.retryDelay
      },
      stats: {
        total: 0,
        completed: 0,
        failed: 0,
        processing: 0,
        queued: 0
      }
    };

    this.queues.set(name, queue);
    console.log(`[QUEUE] Created queue: ${name}`);
    
    return queue;
  }

  // Add task to queue
  async addTask(queueName, task, options = {}) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const taskData = {
      id: this.generateTaskId(),
      data: task,
      options: {
        priority: options.priority || queue.options.priority,
        delay: options.delay || 0,
        timeout: options.timeout || queue.options.timeout,
        retries: options.retries || queue.options.retries,
        retryDelay: options.retryDelay || queue.options.retryDelay
      },
      status: 'queued',
      createdAt: new Date(),
      attempts: 0,
      startedAt: null,
      completedAt: null
    };

    // Add delay if specified
    if (taskData.options.delay > 0) {
      taskData.executeAt = new Date(Date.now() + taskData.options.delay);
    }

    // Insert task based on priority
    this.insertTaskByPriority(queue, taskData);
    
    queue.stats.total++;
    queue.stats.queued++;
    
    this.emit('taskAdded', queueName, taskData);
    
    // Start processing if not already running
    this.startProcessing(queueName);
    
    return taskData.id;
  }

  // Insert task by priority
  insertTaskByPriority(queue, task) {
    let insertIndex = queue.tasks.length;
    
    for (let i = 0; i < queue.tasks.length; i++) {
      if (task.options.priority > queue.tasks[i].options.priority) {
        insertIndex = i;
        break;
      }
    }
    
    queue.tasks.splice(insertIndex, 0, task);
  }

  // Generate task ID
  generateTaskId() {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Start processing queue
  startProcessing(queueName) {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processQueue(queueName);
  }

  // Process queue
  async processQueue(queueName) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      return;
    }

    // Process tasks while there are available slots
    while (queue.processing.size < queue.options.concurrency && queue.tasks.length > 0) {
      const task = this.getNextTask(queue);
      
      if (!task) {
        break;
      }

      // Check if task is delayed
      if (task.executeAt && task.executeAt > new Date()) {
        break;
      }

      // Start processing task
      this.processTask(queueName, task);
    }

    // Check if queue is empty
    if (queue.tasks.length === 0 && queue.processing.size === 0) {
      this.isProcessing = false;
      this.emit('queueEmpty', queueName);
    } else if (queue.tasks.length > 0) {
      // Schedule next processing
      setTimeout(() => this.processQueue(queueName), 100);
    }
  }

  // Get next task
  getNextTask(queue) {
    // Find first task that's ready to execute
    for (let i = 0; i < queue.tasks.length; i++) {
      const task = queue.tasks[i];
      
      if (!task.executeAt || task.executeAt <= new Date()) {
        queue.tasks.splice(i, 1);
        return task;
      }
    }
    
    return null;
  }

  // Process individual task
  async processTask(queueName, task) {
    const queue = this.queues.get(queueName);
    
    task.status = 'processing';
    task.startedAt = new Date();
    task.attempts++;
    
    queue.processing.add(task.id);
    queue.stats.processing++;
    queue.stats.queued--;
    
    this.emit('taskStarted', queueName, task);

    try {
      // Execute task with timeout
      const result = await this.executeTask(task);
      
      // Task completed successfully
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;
      
      queue.processing.delete(task.id);
      queue.completed.push(task);
      queue.stats.completed++;
      queue.stats.processing--;
      
      this.emit('taskCompleted', queueName, task);
      
    } catch (error) {
      // Task failed
      task.error = error.message;
      
      // Check if we should retry
      if (task.attempts < task.options.retries) {
        // Retry task
        task.status = 'retrying';
        queue.processing.delete(task.id);
        queue.stats.processing--;
        
        this.emit('taskRetry', queueName, task);
        
        // Add delay before retry
        setTimeout(() => {
          task.executeAt = new Date(Date.now() + task.options.retryDelay);
          this.insertTaskByPriority(queue, task);
          queue.stats.queued++;
          this.processQueue(queueName);
        }, task.options.retryDelay);
        
      } else {
        // Task failed permanently
        task.status = 'failed';
        task.completedAt = new Date();
        
        queue.processing.delete(task.id);
        queue.failed.push(task);
        queue.stats.failed++;
        queue.stats.processing--;
        
        this.emit('taskFailed', queueName, task);
      }
    }
    
    // Continue processing
    this.processQueue(queueName);
  }

  // Execute task with timeout
  async executeTask(task) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Task timeout after ${task.options.timeout}ms`));
      }, task.options.timeout);

      try {
        if (typeof task.data === 'function') {
          const result = task.data();
          
          if (result instanceof Promise) {
            result
              .then(res => {
                clearTimeout(timeout);
                resolve(res);
              })
              .catch(err => {
                clearTimeout(timeout);
                reject(err);
              });
          } else {
            clearTimeout(timeout);
            resolve(result);
          }
        } else {
          clearTimeout(timeout);
          resolve(task.data);
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // Get queue status
  getQueueStatus(queueName) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return {
      name: queue.name,
      stats: { ...queue.stats },
      options: { ...queue.options },
      isProcessing: queue.processing.size > 0,
      processingCount: queue.processing.size,
      queuedCount: queue.tasks.length
    };
  }

  // Get all queues status
  getAllQueuesStatus() {
    const status = {};
    
    for (const [name, queue] of this.queues.entries()) {
      status[name] = this.getQueueStatus(name);
    }
    
    return status;
  }

  // Get task status
  getTaskStatus(queueName, taskId) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Check in all task collections
    const task = this.findTask(queue, taskId);
    
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    return {
      id: task.id,
      status: task.status,
      attempts: task.attempts,
      createdAt: task.createdAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      error: task.error,
      result: task.result
    };
  }

  // Find task in queue
  findTask(queue, taskId) {
    // Check queued tasks
    let task = queue.tasks.find(t => t.id === taskId);
    
    // Check processing tasks
    if (!task) {
      task = Array.from(queue.processing).find(id => id === taskId);
      if (task) {
        // Need to find the actual task object
        task = this.findTaskInProcessing(queue, taskId);
      }
    }
    
    // Check completed tasks
    if (!task) {
      task = queue.completed.find(t => t.id === taskId);
    }
    
    // Check failed tasks
    if (!task) {
      task = queue.failed.find(t => t.id === taskId);
    }
    
    return task;
  }

  // Find task in processing set
  findTaskInProcessing(queue, taskId) {
    // This is a simplified approach - in production, you'd want to track task objects
    return queue.failed.find(t => t.id === taskId) || 
           queue.completed.find(t => t.id === taskId);
  }

  // Cancel task
  cancelTask(queueName, taskId) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Remove from queued tasks
    const index = queue.tasks.findIndex(t => t.id === taskId);
    
    if (index !== -1) {
      const task = queue.tasks.splice(index, 1)[0];
      task.status = 'cancelled';
      task.completedAt = new Date();
      
      queue.stats.queued--;
      
      this.emit('taskCancelled', queueName, task);
      
      return true;
    }
    
    // Cannot cancel tasks that are already processing
    if (queue.processing.has(taskId)) {
      throw new Error('Cannot cancel task that is currently processing');
    }
    
    return false;
  }

  // Clear queue
  clearQueue(queueName, options = {}) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    const { clearQueued = true, clearCompleted = false, clearFailed = false } = options;
    
    let cleared = 0;
    
    if (clearQueued) {
      cleared += queue.tasks.length;
      queue.tasks = [];
      queue.stats.queued = 0;
    }
    
    if (clearCompleted) {
      cleared += queue.completed.length;
      queue.completed = [];
    }
    
    if (clearFailed) {
      cleared += queue.failed.length;
      queue.failed = [];
    }
    
    console.log(`[QUEUE] Cleared ${cleared} tasks from queue ${queueName}`);
    
    return cleared;
  }

  // Pause queue
  pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.paused = true;
    console.log(`[QUEUE] Paused queue: ${queueName}`);
  }

  // Resume queue
  resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    queue.paused = false;
    console.log(`[QUEUE] Resumed queue: ${queueName}`);
    
    // Start processing
    this.startProcessing(queueName);
  }

  // Delete queue
  deleteQueue(queueName) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    // Wait for processing tasks to complete
    if (queue.processing.size > 0) {
      throw new Error('Cannot delete queue with processing tasks');
    }

    this.queues.delete(queueName);
    console.log(`[QUEUE] Deleted queue: ${queueName}`);
  }

  // Get system statistics
  getSystemStats() {
    const stats = {
      totalQueues: this.queues.size,
      totalTasks: 0,
      totalCompleted: 0,
      totalFailed: 0,
      totalProcessing: 0,
      totalQueued: 0,
      isProcessing: this.isProcessing
    };

    for (const queue of this.queues.values()) {
      stats.totalTasks += queue.stats.total;
      stats.totalCompleted += queue.stats.completed;
      stats.totalFailed += queue.stats.failed;
      stats.totalProcessing += queue.stats.processing;
      stats.totalQueued += queue.stats.queued;
    }

    return stats;
  }

  // Export queue data
  exportQueue(queueName) {
    const queue = this.queues.get(queueName);
    
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }

    return {
      name: queue.name,
      tasks: queue.tasks,
      completed: queue.completed,
      failed: queue.failed,
      stats: queue.stats,
      options: queue.options
    };
  }

  // Import queue data
  importQueue(data) {
    const queue = this.createQueue(data.name, data.options);
    
    queue.tasks = data.tasks || [];
    queue.completed = data.completed || [];
    queue.failed = data.failed || [];
    queue.stats = data.stats || {
      total: 0,
      completed: 0,
      failed: 0,
      processing: 0,
      queued: 0
    };
    
    console.log(`[QUEUE] Imported queue: ${data.name}`);
    
    return queue;
  }
}

// Create singleton instance
const queueManager = new QueueManager();

module.exports = queueManager;
