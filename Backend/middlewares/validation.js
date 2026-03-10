const { body, param, query, validationResult } = require('express-validator');

class Validation {
  static user() {
    return [
      body('name').notEmpty().withMessage('Name is required'),
      body('email').isEmail().withMessage('Valid email required'),
      body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ];
  }

  static login() {
    return [
      body('email').isEmail().withMessage('Valid email required'),
      body('password').notEmpty().withMessage('Password is required')
    ];
  }

  static product() {
    return [
      body('name').notEmpty().withMessage('Product name is required'),
      body('price').isNumeric().withMessage('Price must be a number'),
      body('category').notEmpty().withMessage('Category is required')
    ];
  }

  static id() {
    return [
      param('id').isMongoId().withMessage('Valid ID required')
    ];
  }

  static handle(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }
    next();
  }
}

module.exports = Validation;
