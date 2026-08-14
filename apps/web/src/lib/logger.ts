/**
 * Structured logging configuration with Pino
 * 
 * Implements requirement 5.1: Structured logging with consistent log levels
 * - Supports debug, info, warn, error levels
 * - Includes request ID in all logs
 * - Pretty printing in development, JSON in production
 */

import pino from 'pino';

// Log levels: trace, debug, info, warn, error, fatal
const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

/**
 * Base logger configuration
 */
const logger = pino({
  level: LOG_LEVEL,
  
  // Base fields for all logs
  base: {
    env: process.env.NODE_ENV || 'development',
    revision: process.env.VERCEL_GIT_COMMIT_SHA || 'local',
  },
  
  // Timestamp format
  timestamp: pino.stdTimeFunctions.isoTime,
  
  // Redact sensitive fields from logs
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
      'password',
      'token',
      'apiKey',
      'secret',
    ],
    censor: '[REDACTED]',
  },
  
  // Serializers for common objects
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res,
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, any>) {
  return logger.child(context);
}

/**
 * Log with request context
 */
export function logWithRequest(requestId: string, context?: Record<string, any>) {
  return logger.child({
    requestId,
    ...context,
  });
}

/**
 * Structured logging interface
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: any;
}

/**
 * Logger utility class with convenience methods
 */
export class Logger {
  private logger: pino.Logger;
  
  constructor(context?: Record<string, any>) {
    this.logger = context ? logger.child(context) : logger;
  }
  
  /**
   * Debug level - verbose information for debugging
   */
  debug(message: string, context?: any) {
    if (context !== undefined) {
      this.logger.debug(typeof context === 'object' && context !== null ? context : { detail: context }, message);
    } else {
      this.logger.debug(message);
    }
  }
  
  /**
   * Info level - general informational messages
   */
  info(message: string, context?: any) {
    if (context !== undefined) {
      this.logger.info(typeof context === 'object' && context !== null ? context : { detail: context }, message);
    } else {
      this.logger.info(message);
    }
  }
  
  /**
   * Warn level - warning messages for potentially harmful situations
   */
  warn(message: string, context?: any) {
    if (context !== undefined) {
      this.logger.warn(typeof context === 'object' && context !== null ? context : { detail: context }, message);
    } else {
      this.logger.warn(message);
    }
  }
  
  /**
   * Error level - error events that might still allow the application to continue
   */
  error(message: string, context?: any) {
    if (context instanceof Error) {
      this.logger.error({ err: context }, message);
    } else if (typeof context === 'object' && context !== null) {
      this.logger.error(context, message);
    } else if (context !== undefined) {
      this.logger.error({ error: context }, message);
    } else {
      this.logger.error(message);
    }
  }
  
  /**
   * Fatal level - severe error events that will presumably lead the application to abort
   */
  fatal(message: string, context?: any) {
    if (context instanceof Error) {
      this.logger.fatal({ err: context }, message);
    } else if (typeof context === 'object' && context !== null) {
      this.logger.fatal(context, message);
    } else if (context !== undefined) {
      this.logger.fatal({ error: context }, message);
    } else {
      this.logger.fatal(message);
    }
  }
  
  /**
   * Create a child logger with additional context
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger();
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }
}

/**
 * Default logger instance
 */
export const defaultLogger = new Logger();

/**
 * Export defaultLogger as named logger for convenience
 */
export { defaultLogger as logger };

export default defaultLogger;
