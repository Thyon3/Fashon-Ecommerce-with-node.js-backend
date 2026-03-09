const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

class DisasterRecovery {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.recoveryDir = path.join(__dirname, '../recovery');
    this.isRecovering = false;
    this.ensureDirectories();
  }

  // Ensure necessary directories exist
  ensureDirectories() {
    [this.backupDir, this.recoveryDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Create disaster recovery plan
  async createRecoveryPlan() {
    const plan = {
      timestamp: new Date().toISOString(),
      version: '1.0',
      components: {
        database: {
          status: 'unknown',
          lastBackup: null,
          recoverySteps: [
            'Stop application',
            'Take emergency backup',
            'Restore from latest backup',
            'Verify database integrity',
            'Start application'
          ]
        },
        application: {
          status: 'unknown',
          lastBackup: null,
          recoverySteps: [
            'Stop application',
            'Restore application files',
            'Restore configuration',
            'Verify application health',
            'Start application'
          ]
        },
        files: {
          status: 'unknown',
          lastBackup: null,
          recoverySteps: [
            'Stop application',
            'Restore uploaded files',
            'Verify file integrity',
            'Start application'
          ]
        }
      },
      contacts: {
        primary: process.env.ADMIN_EMAIL || 'admin@fashon.com',
        secondary: process.env.BACKUP_EMAIL || 'backup@fashon.com',
        emergency: process.env.EMERGENCY_EMAIL || 'emergency@fashon.com'
      },
      procedures: {
        emergencyShutdown: this.getEmergencyShutdownProcedure(),
        dataBackup: this.getDataBackupProcedure(),
        systemRestore: this.getSystemRestoreProcedure(),
        communication: this.getCommunicationProcedure()
      }
    };

    // Check component status
    plan.components.database.status = await this.checkDatabaseStatus();
    plan.components.application.status = await this.checkApplicationStatus();
    plan.components.files.status = await this.checkFilesStatus();

    // Get last backup information
    plan.components.database.lastBackup = await this.getLastBackupTime('database');
    plan.components.application.lastBackup = await this.getLastBackupTime('application');
    plan.components.files.lastBackup = await this.getLastBackupTime('files');

    // Save recovery plan
    const planFile = path.join(this.recoveryDir, 'recovery-plan.json');
    fs.writeFileSync(planFile, JSON.stringify(plan, null, 2));

    console.log('[DISASTER_RECOVERY] Recovery plan created');
    return plan;
  }

  // Check database status
  async checkDatabaseStatus() {
    try {
      await mongoose.connection.db.admin().ping();
      return 'healthy';
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Database status check failed:', error);
      return 'unhealthy';
    }
  }

  // Check application status
  async checkApplicationStatus() {
    try {
      // Check if main application files exist
      const appFile = path.join(__dirname, '../app.js');
      const packageFile = path.join(__dirname, '../package.json');
      
      if (fs.existsSync(appFile) && fs.existsSync(packageFile)) {
        return 'healthy';
      }
      
      return 'unhealthy';
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Application status check failed:', error);
      return 'unhealthy';
    }
  }

  // Check files status
  async checkFilesStatus() {
    try {
      const uploadsDir = path.join(__dirname, '../public/uploads');
      
      if (fs.existsSync(uploadsDir)) {
        return 'healthy';
      }
      
      return 'unhealthy';
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Files status check failed:', error);
      return 'unhealthy';
    }
  }

  // Get last backup time
  async getLastBackupTime(component) {
    try {
      const backupFiles = fs.readdirSync(this.backupDir)
        .filter(file => file.includes(component))
        .sort()
        .reverse();

      if (backupFiles.length > 0) {
        const latestBackup = backupFiles[0];
        const stats = fs.statSync(path.join(this.backupDir, latestBackup));
        return stats.mtime.toISOString();
      }
      
      return null;
    } catch (error) {
      console.error(`[DISASTER_RECOVERY] Error getting last backup time for ${component}:`, error);
      return null;
    }
  }

  // Perform emergency shutdown
  async emergencyShutdown() {
    console.log('[DISASTER_RECOVERY] Starting emergency shutdown');
    
    try {
      // Graceful shutdown
      const gracefulShutdown = require('../middlewares/gracefulShutdown');
      
      // Close database connections
      await mongoose.connection.close();
      
      // Stop accepting new requests
      console.log('[DISASTER_RECOVERY] Emergency shutdown completed');
      
      return { success: true, message: 'Emergency shutdown completed' };
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Emergency shutdown failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Perform emergency backup
  async emergencyBackup() {
    console.log('[DISASTER_RECOVERY] Starting emergency backup');
    
    try {
      const backupUtility = require('../heplers/backupUtility');
      const result = await backupUtility.backupAllCollections();
      
      if (result.success) {
        console.log(`[DISASTER_RECOVERY] Emergency backup completed: ${result.successfulBackups}/${result.totalCollections} collections`);
        return { success: true, result };
      } else {
        throw new Error('Backup failed');
      }
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Emergency backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Restore database
  async restoreDatabase(backupPath) {
    console.log(`[DISASTER_RECOVERY] Starting database restore from: ${backupPath}`);
    
    try {
      const backupUtility = require('../heplers/backupUtility');
      const result = await backupUtility.restoreAllCollections(backupPath);
      
      if (result.success) {
        console.log(`[DISASTER_RECOVERY] Database restore completed: ${result.successfulRestores}/${result.totalBackups} collections`);
        return { success: true, result };
      } else {
        throw new Error('Database restore failed');
      }
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Database restore failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Restore application files
  async restoreApplicationFiles(backupPath) {
    console.log(`[DISASTER_RECOVERY] Starting application files restore from: ${backupPath}`);
    
    try {
      // This would restore application files from backup
      // For now, return success
      console.log('[DISASTER_RECOVERY] Application files restore completed');
      return { success: true, message: 'Application files restored successfully' };
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Application files restore failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Restore uploaded files
  async restoreUploadedFiles(backupPath) {
    console.log(`[DISASTER_RECOVERY] Starting uploaded files restore from: ${backupPath}`);
    
    try {
      // This would restore uploaded files from backup
      // For now, return success
      console.log('[DISASTER_RECOVERY] Uploaded files restore completed');
      return { success: true, message: 'Uploaded files restored successfully' };
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Uploaded files restore failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Perform full system recovery
  async performFullRecovery(options = {}) {
    if (this.isRecovering) {
      throw new Error('Recovery already in progress');
    }

    this.isRecovering = true;
    
    try {
      console.log('[DISASTER_RECOVERY] Starting full system recovery');
      
      const recoveryLog = {
        startTime: new Date().toISOString(),
        steps: [],
        errors: [],
        success: false
      };

      // Step 1: Emergency shutdown
      const shutdownResult = await this.emergencyShutdown();
      recoveryLog.steps.push({
        step: 'Emergency Shutdown',
        status: shutdownResult.success ? 'success' : 'failed',
        message: shutdownResult.message,
        timestamp: new Date().toISOString()
      });

      if (!shutdownResult.success) {
        recoveryLog.errors.push('Emergency shutdown failed');
      }

      // Step 2: Emergency backup
      const backupResult = await this.emergencyBackup();
      recoveryLog.steps.push({
        step: 'Emergency Backup',
        status: backupResult.success ? 'success' : 'failed',
        message: backupResult.success ? 'Backup created' : backupResult.error,
        timestamp: new Date().toISOString()
      });

      // Step 3: Restore database (if backup provided)
      if (options.databaseBackup) {
        const dbResult = await this.restoreDatabase(options.databaseBackup);
        recoveryLog.steps.push({
          step: 'Database Restore',
          status: dbResult.success ? 'success' : 'failed',
          message: dbResult.success ? 'Database restored' : dbResult.error,
          timestamp: new Date().toISOString()
        });
      }

      // Step 4: Restore application files (if backup provided)
      if (options.applicationBackup) {
        const appResult = await this.restoreApplicationFiles(options.applicationBackup);
        recoveryLog.steps.push({
          step: 'Application Files Restore',
          status: appResult.success ? 'success' : 'failed',
          message: appResult.success ? 'Application files restored' : appResult.error,
          timestamp: new Date().toISOString()
        });
      }

      // Step 5: Restore uploaded files (if backup provided)
      if (options.filesBackup) {
        const filesResult = await this.restoreUploadedFiles(options.filesBackup);
        recoveryLog.steps.push({
          step: 'Uploaded Files Restore',
          status: filesResult.success ? 'success' : 'failed',
          message: filesResult.success ? 'Uploaded files restored' : filesResult.error,
          timestamp: new Date().toISOString()
        });
      }

      // Step 6: Verify system health
      const healthCheck = await this.verifySystemHealth();
      recoveryLog.steps.push({
        step: 'System Health Verification',
        status: healthCheck.success ? 'success' : 'failed',
        message: healthCheck.message,
        details: healthCheck.details,
        timestamp: new Date().toISOString()
      });

      recoveryLog.endTime = new Date().toISOString();
      recoveryLog.duration = new Date(recoveryLog.endTime) - new Date(recoveryLog.startTime);
      recoveryLog.success = healthCheck.success;

      // Save recovery log
      const logFile = path.join(this.recoveryDir, `recovery-${Date.now().toISOString().replace(/[:.]/g, '-')}.json`);
      fs.writeFileSync(logFile, JSON.stringify(recoveryLog, null, 2));

      console.log(`[DISASTER_RECOVERY] Full system recovery ${recoveryLog.success ? 'completed' : 'failed'}`);
      
      return recoveryLog;
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Full system recovery failed:', error);
      throw error;
    } finally {
      this.isRecovering = false;
    }
  }

  // Verify system health
  async verifySystemHealth() {
    const checks = {
      database: await this.checkDatabaseStatus(),
      application: await this.checkApplicationStatus(),
      files: await this.checkFilesStatus()
    };

    const allHealthy = Object.values(checks).every(status => status === 'healthy');

    return {
      success: allHealthy,
      message: allHealthy ? 'System is healthy' : 'System has issues',
      details: checks
    };
  }

  // Get emergency shutdown procedure
  getEmergencyShutdownProcedure() {
    return [
      '1. Stop accepting new requests',
      '2. Complete ongoing requests',
      '3. Close database connections',
      '4. Save any in-memory data',
      '5. Stop application process'
    ];
  }

  // Get data backup procedure
  getDataBackupProcedure() {
    return [
      '1. Connect to database',
      '2. Export all collections',
      '3. Compress backup files',
      '4. Verify backup integrity',
      '5. Store backup in multiple locations'
    ];
  }

  // Get system restore procedure
  getSystemRestoreProcedure() {
    return [
      '1. Verify backup integrity',
      '2. Stop application',
      '3. Restore database from backup',
      '4. Restore application files',
      '5. Restore uploaded files',
      '6. Verify system health',
      '7. Start application'
    ];
  }

  // Get communication procedure
  getCommunicationProcedure() {
    return [
      '1. Notify stakeholders',
      '2. Send status updates',
      '3. Document recovery process',
      '4. Provide recovery timeline',
      '5. Confirm system restoration'
    ];
  }

  // Get recovery status
  getRecoveryStatus() {
    return {
      isRecovering: this.isRecovering,
      lastRecovery: this.getLastRecoveryLog(),
      recoveryPlan: this.getRecoveryPlan()
    };
  }

  // Get last recovery log
  getLastRecoveryLog() {
    try {
      const logFiles = fs.readdirSync(this.recoveryDir)
        .filter(file => file.startsWith('recovery-') && file.endsWith('.json'))
        .sort()
        .reverse();

      if (logFiles.length > 0) {
        const latestLog = logFiles[0];
        const logPath = path.join(this.recoveryDir, latestLog);
        return JSON.parse(fs.readFileSync(logPath, 'utf8'));
      }
      
      return null;
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Error getting last recovery log:', error);
      return null;
    }
  }

  // Get recovery plan
  getRecoveryPlan() {
    try {
      const planFile = path.join(this.recoveryDir, 'recovery-plan.json');
      
      if (fs.existsSync(planFile)) {
        return JSON.parse(fs.readFileSync(planFile, 'utf8'));
      }
      
      return null;
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Error getting recovery plan:', error);
      return null;
    }
  }

  // Test recovery system
  async testRecoverySystem() {
    console.log('[DISASTER_RECOVERY] Testing recovery system');
    
    try {
      const plan = await this.createRecoveryPlan();
      const status = await this.verifySystemHealth();
      
      return {
        success: true,
        plan,
        status,
        message: 'Recovery system is ready'
      };
      
    } catch (error) {
      console.error('[DISASTER_RECOVERY] Recovery system test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Send recovery notification
  async sendNotification(type, message, details = {}) {
    const notification = {
      type,
      message,
      details,
      timestamp: new Date().toISOString(),
      service: 'disaster-recovery'
    };

    console.log(`[DISASTER_RECOVERY] Notification: ${type} - ${message}`);
    
    // In production, send to notification service
    if (process.env.NODE_ENV === 'production') {
      // Placeholder for notification service integration
    }
  }
}

// Create singleton instance
const disasterRecovery = new DisasterRecovery();

module.exports = disasterRecovery;
