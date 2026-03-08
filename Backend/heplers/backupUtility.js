const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

class BackupUtility {
  constructor() {
    this.backupDir = path.join(__dirname, '../backups');
    this.ensureBackupDir();
  }

  // Ensure backup directory exists
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // Create backup directory with timestamp
  createBackupDir() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupDir, `backup-${timestamp}`);
    
    if (!fs.existsSync(backupPath)) {
      fs.mkdirSync(backupPath, { recursive: true });
    }
    
    return backupPath;
  }

  // Backup all collections
  async backupAllCollections() {
    try {
      const backupPath = this.createBackupDir();
      const timestamp = new Date().toISOString();
      
      console.log(`Starting backup at ${timestamp}`);
      
      // Get all collection names
      const collections = await mongoose.connection.db.listCollections().toArray();
      
      const backupResults = [];
      
      for (const collection of collections) {
        const collectionName = collection.name;
        
        try {
          const result = await this.backupCollection(collectionName, backupPath);
          backupResults.push(result);
          
          console.log(`Backed up collection: ${collectionName} (${result.documentCount} documents)`);
        } catch (error) {
          console.error(`Error backing up collection ${collectionName}:`, error);
          backupResults.push({
            collection: collectionName,
            success: false,
            error: error.message
          });
        }
      }
      
      // Create backup metadata
      const metadata = {
        timestamp,
        backupPath,
        collections: backupResults,
        success: backupResults.every(r => r.success),
        totalCollections: collections.length,
        successfulBackups: backupResults.filter(r => r.success).length,
        failedBackups: backupResults.filter(r => !r.success).length
      };
      
      // Save metadata
      const metadataPath = path.join(backupPath, 'metadata.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`Backup completed: ${metadata.successfulBackups}/${metadata.totalCollections} collections backed up`);
      
      return metadata;
      
    } catch (error) {
      console.error('Backup failed:', error);
      throw error;
    }
  }

  // Backup specific collection
  async backupCollection(collectionName, backupPath) {
    try {
      const collection = mongoose.connection.db.collection(collectionName);
      
      // Get all documents
      const documents = await collection.find({}).toArray();
      
      // Save to file
      const filePath = path.join(backupPath, `${collectionName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
      
      return {
        collection: collectionName,
        success: true,
        documentCount: documents.length,
        filePath,
        fileSize: fs.statSync(filePath).size
      };
      
    } catch (error) {
      throw new Error(`Failed to backup collection ${collectionName}: ${error.message}`);
    }
  }

  // Restore collection from backup
  async restoreCollection(collectionName, backupPath) {
    try {
      const filePath = path.join(backupPath, `${collectionName}.json`);
      
      if (!fs.existsSync(filePath)) {
        throw new Error(`Backup file not found: ${filePath}`);
      }
      
      // Read backup data
      const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      const collection = mongoose.connection.db.collection(collectionName);
      
      // Clear existing data
      await collection.deleteMany({});
      
      // Insert backup data
      if (backupData.length > 0) {
        await collection.insertMany(backupData);
      }
      
      console.log(`Restored collection: ${collectionName} (${backupData.length} documents)`);
      
      return {
        collection: collectionName,
        success: true,
        documentCount: backupData.length
      };
      
    } catch (error) {
      console.error(`Error restoring collection ${collectionName}:`, error);
      throw error;
    }
  }

  // Restore all collections from backup
  async restoreAllCollections(backupPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup directory not found: ${backupPath}`);
      }
      
      // Read metadata
      const metadataPath = path.join(backupPath, 'metadata.json');
      if (!fs.existsSync(metadataPath)) {
        throw new Error(`Backup metadata not found: ${metadataPath}`);
      }
      
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      
      console.log(`Starting restore from backup: ${metadata.timestamp}`);
      
      const restoreResults = [];
      
      for (const backupResult of metadata.collections) {
        if (backupResult.success) {
          try {
            const result = await this.restoreCollection(backupResult.collection, backupPath);
            restoreResults.push(result);
          } catch (error) {
            restoreResults.push({
              collection: backupResult.collection,
              success: false,
              error: error.message
            });
          }
        }
      }
      
      const success = restoreResults.every(r => r.success);
      const successfulRestores = restoreResults.filter(r => r.success).length;
      
      console.log(`Restore completed: ${successfulRestores}/${restoreResults.length} collections restored`);
      
      return {
        success,
        restoreResults,
        successfulRestores,
        failedRestores: restoreResults.length - successfulRestores
      };
      
    } catch (error) {
      console.error('Restore failed:', error);
      throw error;
    }
  }

  // List available backups
  listBackups() {
    try {
      const backups = [];
      
      if (!fs.existsSync(this.backupDir)) {
        return backups;
      }
      
      const backupDirs = fs.readdirSync(this.backupDir)
        .filter(dir => dir.startsWith('backup-'))
        .sort()
        .reverse();
      
      for (const backupDir of backupDirs) {
        const backupPath = path.join(this.backupDir, backupDir);
        const metadataPath = path.join(backupPath, 'metadata.json');
        
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            const stats = fs.statSync(backupPath);
            
            backups.push({
              name: backupDir,
              timestamp: metadata.timestamp,
              path: backupPath,
              success: metadata.success,
              totalCollections: metadata.totalCollections,
              successfulBackups: metadata.successfulBackups,
              failedBackups: metadata.failedBackups,
              size: this.getDirectorySize(backupPath),
              createdAt: stats.birthtime,
              modifiedAt: stats.mtime
            });
          } catch (error) {
            console.error(`Error reading metadata for ${backupDir}:`, error);
          }
        }
      }
      
      return backups;
      
    } catch (error) {
      console.error('Error listing backups:', error);
      return [];
    }
  }

  // Get directory size
  getDirectorySize(dirPath) {
    try {
      let totalSize = 0;
      
      const files = fs.readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        
        if (stats.isDirectory()) {
          totalSize += this.getDirectorySize(filePath);
        } else {
          totalSize += stats.size;
        }
      }
      
      return totalSize;
      
    } catch (error) {
      return 0;
    }
  }

  // Delete old backups (keep last N backups)
  async cleanupOldBackups(keepCount = 10) {
    try {
      const backups = this.listBackups();
      
      if (backups.length <= keepCount) {
        console.log(`No cleanup needed. Keeping ${backups.length} backups (limit: ${keepCount})`);
        return;
      }
      
      const backupsToDelete = backups.slice(keepCount);
      let deletedCount = 0;
      
      for (const backup of backupsToDelete) {
        try {
          this.deleteDirectory(backup.path);
          deletedCount++;
          console.log(`Deleted old backup: ${backup.name}`);
        } catch (error) {
          console.error(`Error deleting backup ${backup.name}:`, error);
        }
      }
      
      console.log(`Cleanup completed. Deleted ${deletedCount}/${backupsToDelete.length} old backups`);
      
      return {
        deletedCount,
        totalBackups: backups.length,
        remainingBackups: backups.length - deletedCount
      };
      
    } catch (error) {
      console.error('Error during cleanup:', error);
      throw error;
    }
  }

  // Delete directory recursively
  deleteDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  }

  // Schedule automatic backup
  scheduleAutoBackup(intervalHours = 24) {
    const intervalMs = intervalHours * 60 * 60 * 1000;
    
    console.log(`Scheduling automatic backup every ${intervalHours} hours`);
    
    setInterval(async () => {
      try {
        console.log('Starting automatic backup...');
        const result = await this.backupAllCollections();
        
        if (result.success) {
          console.log('Automatic backup completed successfully');
          
          // Clean up old backups
          await this.cleanupOldBackups(10);
        } else {
          console.error('Automatic backup failed');
        }
      } catch (error) {
        console.error('Automatic backup error:', error);
      }
    }, intervalMs);
  }

  // Export backup to external location
  async exportBackup(backupPath, exportPath) {
    try {
      if (!fs.existsSync(backupPath)) {
        throw new Error(`Backup not found: ${backupPath}`);
      }
      
      // Create export directory if it doesn't exist
      const exportDir = path.dirname(exportPath);
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      // Copy backup directory
      this.copyDirectory(backupPath, exportPath);
      
      console.log(`Backup exported to: ${exportPath}`);
      
      return {
        success: true,
        sourcePath: backupPath,
        exportPath,
        size: this.getDirectorySize(backupPath)
      };
      
    } catch (error) {
      console.error('Export backup error:', error);
      throw error;
    }
  }

  // Copy directory recursively
  copyDirectory(src, dest) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    
    const files = fs.readdirSync(src);
    
    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      
      const stats = fs.statSync(srcPath);
      
      if (stats.isDirectory()) {
        this.copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // Get backup statistics
  getBackupStats() {
    try {
      const backups = this.listBackups();
      const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
      
      const stats = {
        totalBackups: backups.length,
        successfulBackups: backups.filter(b => b.success).length,
        failedBackups: backups.filter(b => !b.success).length,
        totalSize,
        averageSize: backups.length > 0 ? totalSize / backups.length : 0,
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
        newestBackup: backups.length > 0 ? backups[0].timestamp : null,
        backupDirectory: this.backupDir
      };
      
      return stats;
      
    } catch (error) {
      console.error('Error getting backup stats:', error);
      return {
        totalBackups: 0,
        successfulBackups: 0,
        failedBackups: 0,
        totalSize: 0,
        averageSize: 0,
        oldestBackup: null,
        newestBackup: null,
        backupDirectory: this.backupDir
      };
    }
  }
}

// Create singleton instance
const backupUtility = new BackupUtility();

module.exports = backupUtility;
