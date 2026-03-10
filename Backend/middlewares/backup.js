const fs = require('fs');
const path = require('path');

class Backup {
  static backupDir = path.join(__dirname, '../../backups');
  static schedules = new Map();

  static init() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  static async createDatabaseBackup() {
    const mongoose = require('mongoose');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    try {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const backup = {};

      for (const collection of collections) {
        const docs = await mongoose.connection.db.collection(collection.name).find({}).toArray();
        backup[collection.name] = docs;
      }

      fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
      
      console.log(`[BACKUP] Database backup created: ${filename}`);
      
      return {
        filename,
        filepath,
        size: fs.statSync(filepath).size,
        timestamp: new Date()
      };
    } catch (error) {
      console.error('[BACKUP] Error creating backup:', error);
      throw error;
    }
  }

  static async restoreDatabaseBackup(filename) {
    const filepath = path.join(this.backupDir, filename);
    
    if (!fs.existsSync(filepath)) {
      throw new Error(`Backup file not found: ${filename}`);
    }

    try {
      const backup = JSON.parse(fs.readFileSync(filepath, 'utf8'));
      const mongoose = require('mongoose');

      for (const [collectionName, documents] of Object.entries(backup)) {
        await mongoose.connection.db.collection(collectionName).deleteMany({});
        if (documents.length > 0) {
          await mongoose.connection.db.collection(collectionName).insertMany(documents);
        }
      }

      console.log(`[BACKUP] Database restored from: ${filename}`);
      
      return { success: true, filename };
    } catch (error) {
      console.error('[BACKUP] Error restoring backup:', error);
      throw error;
    }
  }

  static listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filepath = path.join(this.backupDir, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
        })
        .sort((a, b) => b.created - a.created);
    } catch (error) {
      console.error('[BACKUP] Error listing backups:', error);
      return [];
    }
  }

  static deleteBackup(filename) {
    const filepath = path.join(this.backupDir, filename);
    
    try {
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`[BACKUP] Deleted backup: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[BACKUP] Error deleting backup:', error);
      throw error;
    }
  }

  static scheduleBackup(name, intervalMs) {
    if (this.schedules.has(name)) {
      clearInterval(this.schedules.get(name));
    }

    const interval = setInterval(async () => {
      try {
        await this.createDatabaseBackup();
      } catch (error) {
        console.error(`[BACKUP] Scheduled backup failed:`, error);
      }
    }, intervalMs);

    this.schedules.set(name, interval);
    console.log(`[BACKUP] Scheduled backup: ${name} every ${intervalMs}ms`);
  }

  static unscheduleBackup(name) {
    if (this.schedules.has(name)) {
      clearInterval(this.schedules.get(name));
      this.schedules.delete(name);
      console.log(`[BACKUP] Unscheduled backup: ${name}`);
    }
  }

  static cleanupOldBackups(daysOld = 30) {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const backups = this.listBackups();
    let deleted = 0;

    backups.forEach(backup => {
      if (backup.created < cutoffDate) {
        this.deleteBackup(backup.filename);
        deleted++;
      }
    });

    console.log(`[BACKUP] Cleaned up ${deleted} old backups`);
    return deleted;
  }

  static getBackupStats() {
    const backups = this.listBackups();
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);

    return {
      totalBackups: backups.length,
      totalSize,
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].created : null,
      newestBackup: backups.length > 0 ? backups[0].created : null,
      scheduledBackups: this.schedules.size
    };
  }
}

// Initialize backup directory
Backup.init();

module.exports = Backup;
