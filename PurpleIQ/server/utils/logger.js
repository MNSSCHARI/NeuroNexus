/**
 * Structured Logging Utility
 * Uses Winston for comprehensive logging with file rotation
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
fs.ensureDirSync(logsDir);

// Custom format for structured logging
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Console format (more readable)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, service, function: func, requestId, ...metadata }) => {
    let log = `${timestamp} [${level}]`;
    if (service) log += ` [${service}]`;
    if (func) log += ` ${func}()`;
    if (requestId) log += ` [${requestId.substring(0, 8)}]`;
    log += `: ${message}`;
    
    // Add metadata if present
    if (Object.keys(metadata).length > 0) {
      const metaStr = JSON.stringify(metadata, null, 2);
      if (metaStr.length < 200) {
        log += ` ${metaStr}`;
      }
    }
    
    return log;
  })
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'purpleiq' },
  transports: [
    // Error log file (errors only)
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    // Combined log file (all levels)
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    // Daily rotated log file
    new (require('winston-daily-rotate-file'))({
      filename: path.join(logsDir, 'application-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d', // Keep 14 days
      zippedArchive: true
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log')
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log')
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

/**
 * Create a service-specific logger
 * @param {string} serviceName - Name of the service
 * @returns {Object} Logger instance with service context
 */
function createServiceLogger(serviceName) {
  return {
    error: (message, metadata = {}) => {
      logger.error(message, { service: serviceName, ...metadata });
    },
    warn: (message, metadata = {}) => {
      logger.warn(message, { service: serviceName, ...metadata });
    },
    info: (message, metadata = {}) => {
      logger.info(message, { service: serviceName, ...metadata });
    },
    debug: (message, metadata = {}) => {
      logger.debug(message, { service: serviceName, ...metadata });
    },
    // Performance logging
    performance: (operation, duration, metadata = {}) => {
      logger.info(`Performance: ${operation}`, {
        service: serviceName,
        duration: `${duration}ms`,
        ...metadata
      });
    },
    // API call logging
    apiCall: (method, path, statusCode, duration, metadata = {}) => {
      logger.info(`API: ${method} ${path}`, {
        service: serviceName,
        method,
        path,
        statusCode,
        duration: `${duration}ms`,
        ...metadata
      });
    },
    // AI model call logging
    aiCall: (provider, model, promptLength, responseLength, duration, tokenUsage, metadata = {}) => {
      logger.info(`AI Call: ${provider} ${model}`, {
        service: serviceName,
        provider,
        model,
        promptLength,
        responseLength,
        duration: `${duration}ms`,
        tokens: tokenUsage,
        ...metadata
      });
    },
    // Vector search logging
    vectorSearch: (query, resultsCount, topScore, duration, metadata = {}) => {
      logger.info(`Vector Search: ${resultsCount} results`, {
        service: serviceName,
        query: query.substring(0, 100),
        resultsCount,
        topScore: topScore?.toFixed(4),
        duration: `${duration}ms`,
        ...metadata
      });
    }
  };
}

/**
 * Create request-scoped logger with request ID
 * @param {string} requestId - Unique request ID
 * @param {string} serviceName - Service name
 * @returns {Object} Logger instance with request context
 */
function createRequestLogger(requestId, serviceName) {
  const baseLogger = createServiceLogger(serviceName);
  
  return {
    error: (message, metadata = {}) => {
      baseLogger.error(message, { requestId, ...metadata });
    },
    warn: (message, metadata = {}) => {
      baseLogger.warn(message, { requestId, ...metadata });
    },
    info: (message, metadata = {}) => {
      baseLogger.info(message, { requestId, ...metadata });
    },
    debug: (message, metadata = {}) => {
      baseLogger.debug(message, { requestId, ...metadata });
    },
    performance: (operation, duration, metadata = {}) => {
      baseLogger.performance(operation, duration, { requestId, ...metadata });
    },
    apiCall: (method, path, statusCode, duration, metadata = {}) => {
      baseLogger.apiCall(method, path, statusCode, duration, { requestId, ...metadata });
    },
    aiCall: (provider, model, promptLength, responseLength, duration, tokenUsage, metadata = {}) => {
      baseLogger.aiCall(provider, model, promptLength, responseLength, duration, tokenUsage, { requestId, ...metadata });
    },
    vectorSearch: (query, resultsCount, topScore, duration, metadata = {}) => {
      baseLogger.vectorSearch(query, resultsCount, topScore, duration, { requestId, ...metadata });
    }
  };
}

/**
 * Sanitize sensitive data from metadata
 * @param {Object} metadata - Metadata object
 * @returns {Object} Sanitized metadata
 */
function sanitizeMetadata(metadata) {
  const sensitiveKeys = ['apiKey', 'password', 'token', 'secret', 'authorization'];
  const sanitized = { ...metadata };
  
  sensitiveKeys.forEach(key => {
    if (sanitized[key]) {
      sanitized[key] = '[REDACTED]';
    }
  });
  
  // Sanitize nested objects
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitizeMetadata(sanitized[key]);
    }
  });
  
  return sanitized;
}

module.exports = {
  logger,
  createServiceLogger,
  createRequestLogger,
  sanitizeMetadata
};

