class ResponseStandardizer {
  // Standard success response
  static success(data = null, message = 'Success', meta = {}) {
    return {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    };
  }

  // Standard error response
  static error(message = 'Internal Server Error', code = 'INTERNAL_ERROR', details = null, statusCode = 500) {
    return {
      success: false,
      error: {
        code,
        message,
        details,
        statusCode
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Paginated response
  static paginated(data, pagination, message = 'Success') {
    return {
      success: true,
      data,
      message,
      pagination: {
        page: pagination.page || 1,
        limit: pagination.limit || 10,
        total: pagination.total || 0,
        totalPages: Math.ceil(pagination.total / (pagination.limit || 10)),
        hasNextPage: pagination.hasNextPage || false,
        hasPreviousPage: pagination.hasPreviousPage || false,
        ...pagination
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Validation error response
  static validationError(errors, message = 'Validation Error') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        details: errors,
        statusCode: 400
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Not found response
  static notFound(resource = 'Resource', message = null) {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: message || `${resource} not found`,
        statusCode: 404
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Unauthorized response
  static unauthorized(message = 'Unauthorized') {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message,
        statusCode: 401
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Forbidden response
  static forbidden(message = 'Forbidden') {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message,
        statusCode: 403
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Conflict response
  static conflict(message = 'Conflict') {
    return {
      success: false,
      error: {
        code: 'CONFLICT',
        message,
        statusCode: 409
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Rate limit response
  static rateLimit(message = 'Rate limit exceeded', retryAfter = 60) {
    return {
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message,
        statusCode: 429,
        retryAfter
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Service unavailable response
  static serviceUnavailable(message = 'Service temporarily unavailable') {
    return {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message,
        statusCode: 503
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    };
  }

  // Created response
  static created(data, message = 'Resource created successfully') {
    return {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        action: 'created'
      }
    };
  }

  // Updated response
  static updated(data, message = 'Resource updated successfully') {
    return {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        action: 'updated'
      }
    };
  }

  // Deleted response
  static deleted(data = null, message = 'Resource deleted successfully') {
    return {
      success: true,
      data,
      message,
      meta: {
        timestamp: new Date().toISOString(),
        action: 'deleted'
      }
    };
  }

  // Middleware to standardize responses
  static middleware() {
    return (req, res, next) => {
      // Override res.json
      const originalJson = res.json;
      
      res.json = function(data) {
        // If data is already standardized, send as-is
        if (data && typeof data === 'object' && (data.success !== undefined || data.error)) {
          return originalJson.call(this, data);
        }
        
        // Auto-standardize based on status code
        if (res.statusCode >= 200 && res.statusCode < 300) {
          return originalJson.call(this, ResponseStandardizer.success(data));
        } else if (res.statusCode === 400) {
          return originalJson.call(this, ResponseStandardizer.error('Bad Request', 'BAD_REQUEST', data));
        } else if (res.statusCode === 401) {
          return originalJson.call(this, ResponseStandardizer.unauthorized());
        } else if (res.statusCode === 403) {
          return originalJson.call(this, ResponseStandardizer.forbidden());
        } else if (res.statusCode === 404) {
          return originalJson.call(this, ResponseStandardizer.notFound());
        } else if (res.statusCode === 409) {
          return originalJson.call(this, ResponseStandardizer.conflict());
        } else if (res.statusCode === 429) {
          return originalJson.call(this, ResponseStandardizer.rateLimit());
        } else if (res.statusCode === 500) {
          return originalJson.call(this, ResponseStandardizer.error('Internal Server Error', 'INTERNAL_ERROR', data));
        } else {
          return originalJson.call(this, ResponseStandardizer.error('Unknown Error', 'UNKNOWN_ERROR', data, res.statusCode));
        }
      };
      
      // Add helper methods to response
      res.success = (data, message, meta) => {
        return originalJson.call(this, ResponseStandardizer.success(data, message, meta));
      };
      
      res.error = (message, code, details, statusCode) => {
        this.status(statusCode || 500);
        return originalJson.call(this, ResponseStandardizer.error(message, code, details));
      };
      
      res.paginated = (data, pagination, message) => {
        return originalJson.call(this, ResponseStandardizer.paginated(data, pagination, message));
      };
      
      res.created = (data, message) => {
        this.status(201);
        return originalJson.call(this, ResponseStandardizer.created(data, message));
      };
      
      res.updated = (data, message) => {
        return originalJson.call(this, ResponseStandardizer.updated(data, message));
      };
      
      res.deleted = (data, message) => {
        return originalJson.call(this, ResponseStandardizer.deleted(data, message));
      };
      
      res.notFound = (resource, message) => {
        this.status(404);
        return originalJson.call(this, ResponseStandardizer.notFound(resource, message));
      };
      
      res.unauthorized = (message) => {
        this.status(401);
        return originalJson.call(this, ResponseStandardizer.unauthorized(message));
      };
      
      res.forbidden = (message) => {
        this.status(403);
        return originalJson.call(this, ResponseStandardizer.forbidden(message));
      };
      
      res.conflict = (message) => {
        this.status(409);
        return originalJson.call(this, ResponseStandardizer.conflict(message));
      };
      
      res.validationError = (errors, message) => {
        this.status(400);
        return originalJson.call(this, ResponseStandardizer.validationError(errors, message));
      };
      
      next();
    };
  }

  // Format error details
  static formatErrorDetails(error) {
    if (error.name === 'ValidationError') {
      return error.errors.map(err => ({
        field: err.path,
        message: err.message,
        value: err.value
      }));
    }
    
    if (error.name === 'CastError') {
      return [{
        field: error.path,
        message: 'Invalid format',
        value: error.value
      }];
    }
    
    return [error.message];
  }
}

module.exports = ResponseStandardizer;
