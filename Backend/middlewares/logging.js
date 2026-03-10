const winston = require('winston');

class Logging {
  static logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    transports: [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' })
    ]
  });

  static configure() {
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.simple()
      }));
    }
  }

  static info(message, meta = {}) {
    this.logger.info(message, meta);
  }

  static error(message, error = {}) {
    this.logger.error(message, { error: error.stack || error });
  }

  static warn(message, meta = {}) {
    this.logger.warn(message, meta);
  }

  static debug(message, meta = {}) {
    this.logger.debug(message, meta);
  }

  static middleware() {
    return (req, res, next) => {
      this.info(`${req.method} ${req.originalUrl}`, {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    };
  }
}

module.exports = Logging;
