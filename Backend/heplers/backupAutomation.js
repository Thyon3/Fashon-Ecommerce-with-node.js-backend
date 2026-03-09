const backupUtility = require('./backupUtility');
const cron = require('node-cron');

class BackupAutomation {
  constructor() {
    this.backupSchedule = '0 2 * * *'; // Daily at 2 AM
    this.cleanupSchedule = '0 3 * * 0'; // Weekly on Sunday at 3 AM
    this.isRunning = false;
  }

  // Start automated backup system
  start() {
    console.log('[BACKUP] Starting automated backup system');
    
    // Schedule daily backups
    cron.schedule(this.backupSchedule, async () => {
      if (this.isRunning) {
        console.log('[BACKUP] Backup already running, skipping');
        return;
      }
      
      await this.performScheduledBackup();
    });
    
    // Schedule weekly cleanup
    cron.schedule(this.cleanupSchedule, async () => {
      await this.performScheduledCleanup();
    });
    
    console.log('[BACKUP] Backup automation started');
    console.log(`[BACKUP] Daily backup schedule: ${this.backupSchedule}`);
    console.log(`[BACKUP] Weekly cleanup schedule: ${this.cleanupSchedule}`);
  }

  // Perform scheduled backup
  async performScheduledBackup() {
    this.isRunning = true;
    
    try {
      console.log('[BACKUP] Starting scheduled backup');
      
      const result = await backupUtility.backupAllCollections();
      
      if (result.success) {
        console.log(`[BACKUP] Scheduled backup completed: ${result.successfulBackups}/${result.totalCollections} collections backed up`);
        
        // Send notification (placeholder)
        await this.sendBackupNotification('success', result);
        
        // Log backup metrics
        await this.logBackupMetrics('scheduled', result);
        
      } else {
        console.error('[BACKUP] Scheduled backup failed');
        await this.sendBackupNotification('failure', result);
      }
      
    } catch (error) {
      console.error('[BACKUP] Scheduled backup error:', error);
      await this.sendBackupNotification('error', { error: error.message });
      
    } finally {
      this.isRunning = false;
    }
  }

  // Perform scheduled cleanup
  async performScheduledCleanup() {
    try {
      console.log('[BACKUP] Starting scheduled cleanup');
      
      const result = await backupUtility.cleanupOldBackups(30); // Keep 30 days
      
      console.log(`[BACKUP] Scheduled cleanup completed: ${result.deletedCount} old backups deleted`);
      
      // Send cleanup notification
      await this.sendCleanupNotification('success', result);
      
    } catch (error) {
      console.error('[BACKUP] Scheduled cleanup error:', error);
      await this.sendCleanupNotification('error', { error: error.message });
    }
  }

  // Manual backup
  async performManualBackup(options = {}) {
    if (this.isRunning) {
      throw new Error('Backup already in progress');
    }
    
    this.isRunning = true;
    
    try {
      console.log('[BACKUP] Starting manual backup');
      
      const result = await backupUtility.backupAllCollections();
      
      if (result.success) {
        console.log(`[BACKUP] Manual backup completed: ${result.successfulBackups}/${result.totalCollections} collections backed up`);
        
        await this.logBackupMetrics('manual', result);
        
        return result;
        
      } else {
        throw new Error('Manual backup failed');
      }
      
    } catch (error) {
      console.error('[BACKUP] Manual backup error:', error);
      throw error;
      
    } finally {
      this.isRunning = false;
    }
  }

  // Get backup status
  getBackupStatus() {
    return {
      isRunning: this.isRunning,
      schedule: this.backupSchedule,
      cleanupSchedule: this.cleanupSchedule,
      lastBackup: this.getLastBackupTime(),
      nextBackup: this.getNextBackupTime()
    };
  }

  // Get last backup time
  getLastBackupTime() {
    // This would typically be stored in a database or file
    // For now, return a placeholder
    return new Date().toISOString();
  }

  // Get next backup time
  getNextBackupTime() {
    const now = new Date();
    const nextBackup = new Date(now);
    nextBackup.setHours(2, 0, 0, 0); // Set to 2 AM
    
    if (nextBackup <= now) {
      nextBackup.setDate(nextBackup.getDate() + 1);
    }
    
    return nextBackup.toISOString();
  }

  // Send backup notification
  async sendBackupNotification(type, result) {
    const notification = {
      type,
      timestamp: new Date().toISOString(),
      result: {
        success: result.success,
        totalCollections: result.totalCollections,
        successfulBackups: result.successfulBackups,
        failedBackups: result.failedBackups,
        backupPath: result.backupPath
      }
    };
    
    console.log(`[BACKUP] Notification: ${type} - ${JSON.stringify(notification)}`);
    
    // In production, send to notification service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for notification service integration
    }
  }

  // Send cleanup notification
  async sendCleanupNotification(type, result) {
    const notification = {
      type,
      timestamp: new Date().toISOString(),
      result: {
        deletedCount: result.deletedCount,
        totalBackups: result.totalBackups,
        remainingBackups: result.remainingBackups
      }
    };
    
    console.log(`[BACKUP] Cleanup notification: ${type} - ${JSON.stringify(notification)}`);
    
    // In production, send to notification service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for notification service integration
    }
  }

  // Log backup metrics
  async logBackupMetrics(backupType, result) {
    const metrics = {
      backupType,
      timestamp: new Date().toISOString(),
      duration: result.duration || 0,
      totalCollections: result.totalCollections,
      successfulBackups: result.successfulBackups,
      failedBackups: result.failedBackups,
      backupSize: result.backupSize || 0,
      success: result.success
    };
    
    console.log(`[BACKUP] Metrics: ${JSON.stringify(metrics)}`);
    
    // In production, send to metrics service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for metrics service integration
    }
  }

  // Get backup statistics
  async getBackupStatistics() {
    try {
      const stats = backupUtility.getBackupStats();
      const status = this.getBackupStatus();
      
      return {
        ...stats,
        automation: status
      };
      
    } catch (error) {
      console.error('Error getting backup statistics:', error);
      return null;
    }
  }

  // Update backup schedule
  updateSchedule(newSchedule) {
    // Validate cron format
    if (!cron.validate(newSchedule)) {
      throw new Error('Invalid cron schedule format');
    }
    
    this.backupSchedule = newSchedule;
    console.log(`[BACKUP] Backup schedule updated to: ${newSchedule}`);
    
    // In production, restart the cron job
  }

  // Update cleanup schedule
  updateCleanupSchedule(newSchedule) {
    // Validate cron format
    if (!cron.validate(newSchedule)) {
      throw new Error('Invalid cron schedule format');
    }
    
    this.cleanupSchedule = newSchedule;
    console.log(`[BACKUP] Cleanup schedule updated to: ${newSchedule}`);
    
    // In production, restart the cron job
  }

  // Stop backup automation
  stop() {
    console.log('[BACKUP] Stopping backup automation');
    
    // In production, stop all cron jobs
    cron.getTasks().forEach(task => task.stop());
    
    console.log('[BACKUP] Backup automation stopped');
  }

  // Test backup system
  async testBackup() {
    try {
      console.log('[BACKUP] Testing backup system');
      
      const result = await this.performManualBackup();
      
      if (result.success) {
        console.log('[BACKUP] Backup test successful');
        return { success: true, message: 'Backup system working correctly' };
      } else {
        console.log('[BACKUP] Backup test failed');
        return { success: false, message: 'Backup test failed' };
      }
      
    } catch (error) {
      console.error('[BACKUP] Backup test error:', error);
      return { success: false, message: error.message };
    }
  }
}

// Create singleton instance
const backupAutomation = new BackupAutomation();

module.exports = backupAutomation;
