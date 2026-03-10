class Response {
  static success(res, data, message = 'Success') {
    res.status(200).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static created(res, data, message = 'Created successfully') {
    res.status(201).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    });
  }

  static error(res, message = 'Internal Server Error', statusCode = 500) {
    res.status(statusCode).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  static validation(res, errors) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors,
      timestamp: new Date().toISOString()
    });
  }

  static notFound(res, message = 'Resource not found') {
    res.status(404).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  static unauthorized(res, message = 'Unauthorized') {
    res.status(401).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  static forbidden(res, message = 'Forbidden') {
    res.status(403).json({
      success: false,
      error: message,
      timestamp: new Date().toISOString()
    });
  }

  static paginated(res, data, pagination, message = 'Success') {
    res.status(200).json({
      success: true,
      message,
      data,
      pagination,
      timestamp: new Date().toISOString()
    });
  }

  static middleware() {
    return (req, res, next) => {
      res.success = (data, message) => this.success(res, data, message);
      res.created = (data, message) => this.created(res, data, message);
      res.error = (message, statusCode) => this.error(res, message, statusCode);
      res.validation = (errors) => this.validation(res, errors);
      res.notFound = (message) => this.notFound(res, message);
      res.unauthorized = (message) => this.unauthorized(res, message);
      res.forbidden = (message) => this.forbidden(res, message);
      res.paginated = (data, pagination, message) => this.paginated(res, data, pagination, message);
      
      next();
    };
  }
}

module.exports = Response;
