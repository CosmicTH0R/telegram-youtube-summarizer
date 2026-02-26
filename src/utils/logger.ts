// Simple logger utility

export enum LogLevel {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

class Logger {
  private logLevel: LogLevel;

  constructor() {
    const level = process.env.LOG_LEVEL?.toUpperCase() || 'INFO';
    this.logLevel = LogLevel[level as keyof typeof LogLevel] || LogLevel.INFO;
  }

  private formatMessage(level: LogLevel, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  info(message: string, context?: any): void {
    console.log(this.formatMessage(LogLevel.INFO, message, context));
  }

  warning(message: string, context?: any): void {
    console.warn(this.formatMessage(LogLevel.WARNING, message, context));
  }

  error(message: string, error?: Error, context?: any): void {
    const errorContext = error ? { ...context, error: error.message, stack: error.stack } : context;
    console.error(this.formatMessage(LogLevel.ERROR, message, errorContext));
  }

  critical(message: string, error?: Error, context?: any): void {
    const errorContext = error ? { ...context, error: error.message, stack: error.stack } : context;
    console.error(this.formatMessage(LogLevel.CRITICAL, message, errorContext));
  }
}

export const logger = new Logger();
