const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const sharp = require('sharp');
const EventEmitter = require('events');

class FileUpload extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      uploadDir: options.uploadDir || path.join(process.cwd(), 'uploads'),
      maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB
      maxFiles: options.maxFiles || 5,
      allowedMimeTypes: options.allowedMimeTypes || [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      enableImageProcessing: options.enableImageProcessing !== false,
      enableVirusScanning: options.enableVirusScanning || false,
      enableFileValidation: options.enableFileValidation !== false,
      enableCompression: options.enableCompression || false,
      imageSizes: options.imageSizes || {
        thumbnail: { width: 150, height: 150 },
        medium: { width: 500, height: 500 },
        large: { width: 1000, height: 1000 }
      },
      enableLogging: options.enableLogging !== false,
      enableMetadata: options.enableMetadata !== false,
      ...options
    };
    
    this.uploadStats = {
      totalUploads: 0,
      totalSize: 0,
      failedUploads: 0,
      filesByType: {},
      uploadsByUser: new Map()
    };
    
    this.init();
  }

  async init() {
    try {
      await this.ensureUploadDirectories();
      this.setupMulter();
      
      console.log('[FILE_UPLOAD] File upload service initialized');
    } catch (error) {
      console.error('[FILE_UPLOAD] Failed to initialize:', error);
    }
  }

  async ensureUploadDirectories() {
    const dirs = [
      this.options.uploadDir,
      path.join(this.options.uploadDir, 'images'),
      path.join(this.options.uploadDir, 'documents'),
      path.join(this.options.uploadDir, 'temp'),
      path.join(this.options.uploadDir, 'thumbnails'),
      path.join(this.options.uploadDir, 'processed')
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  setupMulter() {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = this.getUploadPath(file);
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueName = this.generateUniqueFileName(file.originalname);
        cb(null, uniqueName);
      }
    });

    const fileFilter = (req, file, cb) => {
      if (this.options.allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
      }
    };

    this.upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: this.options.maxFileSize,
        files: this.options.maxFiles
      }
    });
  }

  getUploadPath(file) {
    if (file.mimetype.startsWith('image/')) {
      return path.join(this.options.uploadDir, 'images');
    } else {
      return path.join(this.options.uploadDir, 'documents');
    }
  }

  generateUniqueFileName(originalName) {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    
    return `${name}_${timestamp}_${random}${ext}`;
  }

  async processUploadedFile(file, options = {}) {
    try {
      const fileInfo = {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        size: file.size,
        mimetype: file.mimetype,
        uploadedAt: new Date().toISOString(),
        metadata: {}
      };

      // Add file metadata
      if (this.options.enableMetadata) {
        fileInfo.metadata = await this.extractFileMetadata(file);
      }

      // Validate file
      if (this.options.enableFileValidation) {
        await this.validateFile(file);
      }

      // Scan for viruses
      if (this.options.enableVirusScanning) {
        await this.scanForViruses(file);
      }

      // Process images
      if (file.mimetype.startsWith('image/') && this.options.enableImageProcessing) {
        await this.processImage(file, fileInfo);
      }

      // Compress if enabled
      if (this.options.enableCompression) {
        await this.compressFile(file, fileInfo);
      }

      // Update stats
      this.updateStats(fileInfo);

      this.emit('file:processed', fileInfo);
      
      return fileInfo;
      
    } catch (error) {
      this.uploadStats.failedUploads++;
      this.emit('file:processing_failed', file, error);
      
      // Clean up file on error
      await this.cleanupFile(file);
      
      throw error;
    }
  }

  async extractFileMetadata(file) {
    const metadata = {
      size: file.size,
      extension: path.extname(file.originalname),
      encoding: file.encoding
    };

    if (file.mimetype.startsWith('image/')) {
      try {
        const imageInfo = await sharp(file.path).metadata();
        metadata.image = {
          width: imageInfo.width,
          height: imageInfo.height,
          format: imageInfo.format,
          density: imageInfo.density,
          hasAlpha: imageInfo.hasAlpha,
          orientation: imageInfo.orientation
        };
      } catch (error) {
        console.warn('[FILE_UPLOAD] Failed to extract image metadata:', error);
      }
    }

    // Calculate file hash
    try {
      const fileBuffer = await fs.readFile(file.path);
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
      metadata.hash = hash;
    } catch (error) {
      console.warn('[FILE_UPLOAD] Failed to calculate file hash:', error);
    }

    return metadata;
  }

  async validateFile(file) {
    // Check file signature (magic bytes)
    const buffer = await fs.readFile(file.path);
    const signature = buffer.slice(0, 4).toString('hex');
    
    const expectedSignatures = {
      'image/jpeg': 'ffd8ffe0',
      'image/png': '89504e47',
      'image/gif': '47494638',
      'application/pdf': '25504446'
    };
    
    if (expectedSignatures[file.mimetype]) {
      if (!signature.startsWith(expectedSignatures[file.mimetype])) {
        throw new Error('File signature does not match MIME type');
      }
    }
  }

  async scanForViruses(file) {
    // Placeholder for virus scanning
    // In production, integrate with actual antivirus software
    console.log(`[FILE_UPLOAD] Scanning file for viruses: ${file.filename}`);
    
    // Simulate scan delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Always pass for now
    return true;
  }

  async processImage(file, fileInfo) {
    try {
      const image = sharp(file.path);
      const metadata = await image.metadata();
      
      // Create different sizes
      const sizes = {};
      
      for (const [sizeName, sizeConfig] of Object.entries(this.options.imageSizes)) {
        const outputPath = path.join(
          this.options.uploadDir,
          'processed',
          `${path.basename(file.filename, path.extname(file.filename))}_${sizeName}${path.extname(file.filename)}`
        );
        
        await image
          .clone()
          .resize(sizeConfig.width, sizeConfig.height, {
            fit: 'cover',
            position: 'center'
          })
          .toFile(outputPath);
        
        sizes[sizeName] = {
          path: outputPath,
          width: sizeConfig.width,
          height: sizeConfig.height,
          size: (await fs.stat(outputPath)).size
        };
      }
      
      fileInfo.processedImages = sizes;
      
      // Optimize original
      const optimizedPath = path.join(
        this.options.uploadDir,
        'processed',
        `optimized_${file.filename}`
      );
      
      await image
        .clone()
        .jpeg({ quality: 80, progressive: true })
        .toFile(optimizedPath);
      
      fileInfo.optimizedPath = optimizedPath;
      
    } catch (error) {
      console.error('[FILE_UPLOAD] Image processing failed:', error);
      throw new Error('Image processing failed');
    }
  }

  async compressFile(file, fileInfo) {
    if (file.mimetype.startsWith('image/')) {
      // Image compression is handled in processImage
      return;
    }
    
    // For other file types, implement compression as needed
    console.log(`[FILE_UPLOAD] Compressing file: ${file.filename}`);
  }

  updateStats(fileInfo) {
    this.uploadStats.totalUploads++;
    this.uploadStats.totalSize += fileInfo.size;
    
    const ext = path.extname(fileInfo.originalName);
    this.uploadStats.filesByType[ext] = (this.uploadStats.filesByType[ext] || 0) + 1;
    
    if (fileInfo.metadata.userId) {
      const userUploads = this.uploadStats.uploadsByUser.get(fileInfo.metadata.userId) || 0;
      this.uploadStats.uploadsByUser.set(fileInfo.metadata.userId, userUploads + 1);
    }
  }

  async cleanupFile(file) {
    try {
      await fs.unlink(file.path);
      
      // Clean up processed files
      const processedDir = path.join(this.options.uploadDir, 'processed');
      const files = await fs.readdir(processedDir);
      
      for (const processedFile of files) {
        if (processedFile.includes(path.basename(file.filename, path.extname(file.filename)))) {
          await fs.unlink(path.join(processedDir, processedFile));
        }
      }
      
    } catch (error) {
      console.error('[FILE_UPLOAD] Failed to cleanup file:', error);
    }
  }

  async deleteFile(filename) {
    try {
      const filePath = path.join(this.options.uploadDir, filename);
      await fs.unlink(filePath);
      
      // Clean up processed files
      await this.cleanupFile({ filename, path: filePath });
      
      this.emit('file:deleted', filename);
      
      return true;
    } catch (error) {
      console.error('[FILE_UPLOAD] Failed to delete file:', error);
      return false;
    }
  }

  async getFileStats(filename) {
    try {
      const filePath = path.join(this.options.uploadDir, filename);
      const stats = await fs.stat(filePath);
      
      return {
        filename,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        isFile: stats.isFile(),
        extension: path.extname(filename)
      };
    } catch (error) {
      return null;
    }
  }

  async listFiles(directory = '', options = {}) {
    try {
      const dir = directory ? path.join(this.options.uploadDir, directory) : this.options.uploadDir;
      const files = await fs.readdir(dir);
      const fileList = [];
      
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          const fileInfo = {
            filename: file,
            path: filePath,
            size: stats.size,
            createdAt: stats.birthtime.toISOString(),
            modifiedAt: stats.mtime.toISOString(),
            extension: path.extname(file)
          };
          
          // Add metadata if available
          if (options.includeMetadata) {
            fileInfo.metadata = await this.extractFileMetadata({
              filename: file,
              path: filePath,
              mimetype: this.getMimeType(file)
            });
          }
          
          fileList.push(fileInfo);
        }
      }
      
      // Sort by creation date (newest first)
      fileList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      return fileList;
    } catch (error) {
      console.error('[FILE_UPLOAD] Failed to list files:', error);
      return [];
    }
  }

  getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    
    return mimeTypes[ext] || 'application/octet-stream';
  }

  async getUploadStats() {
    return {
      ...this.uploadStats,
      averageFileSize: this.uploadStats.totalUploads > 0 
        ? this.uploadStats.totalSize / this.uploadStats.totalUploads 
        : 0,
      totalUsers: this.uploadStats.uploadsByUser.size
    };
  }

  async cleanupOldFiles(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const directories = ['images', 'documents', 'processed'];
      let cleaned = 0;
      
      for (const dir of directories) {
        const dirPath = path.join(this.options.uploadDir, dir);
        const files = await fs.readdir(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleaned++;
          }
        }
      }
      
      console.log(`[FILE_UPLOAD] Cleaned up ${cleaned} old files`);
      
      return cleaned;
    } catch (error) {
      console.error('[FILE_UPLOAD] Failed to cleanup old files:', error);
      return 0;
    }
  }

  middleware(options = {}) {
    return this.upload.array(options.maxFiles || this.options.maxFiles);
  }

  // Static method to create file upload service
  static async create(options = {}) {
    const fileUpload = new FileUpload(options);
    await fileUpload.init();
    return fileUpload;
  }
}

module.exports = FileUpload;
