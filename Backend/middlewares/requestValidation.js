const { body, param, query, validationResult } = require('express-validator');

class RequestValidation {
  static validate(validationRules) {
    return async (req, res, next) => {
      // Run all validation rules
      await Promise.all(validationRules.map(rule => rule.run(req)));
      
      // Check for validation errors
      const errors = validationResult(req);
      
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation Error',
          message: 'Request validation failed',
          details: errors.array().map(error => ({
            field: error.param,
            message: error.msg,
            value: error.value,
            location: error.location
          }))
        });
      }
      
      next();
    };
  }
  
  // Common validation rules
  static commonRules = {
    email: body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    password: body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    name: body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
    productId: param('id').isMongoId().withMessage('Valid product ID is required'),
    orderId: param('id').isMongoId().withMessage('Valid order ID is required'),
    userId: param('id').isMongoId().withMessage('Valid user ID is required'),
    page: query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    limit: query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be 1-100'),
    price: body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
    quantity: body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
    phone: body('phone').optional().isMobilePhone().withMessage('Valid phone number is required'),
    address: body('address').trim().isLength({ min: 5 }).withMessage('Address must be at least 5 characters')
  };
  
  // Validation rule sets for different endpoints
  static validationSets = {
    register: [
      this.commonRules.email,
      this.commonRules.password,
      this.commonRules.name,
      body('phone').optional().isMobilePhone().withMessage('Valid phone number is required')
    ],
    
    login: [
      this.commonRules.email,
      this.commonRules.password
    ],
    
    createProduct: [
      this.commonRules.name,
      this.commonRules.price,
      this.commonRules.quantity,
      body('description').optional().trim().isLength({ max: 1000 }).withMessage('Description must be less than 1000 characters'),
      body('category').isMongoId().withMessage('Valid category ID is required')
    ],
    
    updateProduct: [
      this.commonRules.productId,
      body('name').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2-50 characters'),
      body('price').optional().isFloat({ min: 0 }).withMessage('Price must be a positive number'),
      body('quantity').optional().isInt({ min: 0 }).withMessage('Quantity must be a positive integer')
    ],
    
    createOrder: [
      body('orderItem').isArray({ min: 1 }).withMessage('At least one order item is required'),
      body('orderItem.*.product').isMongoId().withMessage('Valid product ID is required'),
      body('orderItem.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be a positive integer'),
      this.commonRules.address
    ],
    
    getProducts: [
      this.commonRules.page,
      this.commonRules.limit,
      query('category').optional().isMongoId().withMessage('Valid category ID is required'),
      query('minPrice').optional().isFloat({ min: 0 }).withMessage('Min price must be a positive number'),
      query('maxPrice').optional().isFloat({ min: 0 }).withMessage('Max price must be a positive number')
    ]
  };
}

module.exports = RequestValidation;
