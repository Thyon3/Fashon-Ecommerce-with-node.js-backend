const multer = require('multer');
const path = require('path');

class Upload {
  static storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  static fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  };

  static middleware(options = {}) {
    const defaults = {
      storage: this.storage,
      limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
      },
      fileFilter: this.fileFilter
    };

    return multer({ ...defaults, ...options });
  }

  static single(fieldName) {
    return this.middleware().single(fieldName);
  }

  static multiple(fieldName, maxCount = 5) {
    return this.middleware().array(fieldName, maxCount);
  }

  static fields(fields) {
    return this.middleware().fields(fields);
  }
}

module.exports = Upload;
