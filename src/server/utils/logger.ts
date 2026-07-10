export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

class Logger {
  private formatMessage(level: LogLevel, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const metaString = meta ? ` | Meta: ${JSON.stringify(meta)}` : '';
    
    // In production, log as raw string or JSON format
    if (process.env.NODE_ENV === 'production') {
      return JSON.stringify({
        timestamp,
        level,
        message,
        ...(meta && { meta })
      });
    }

    // Color codes for terminal development logging
    const colors = {
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      debug: '\x1b[34m', // Blue
      reset: '\x1b[0m'
    };

    const color = colors[level] || colors.reset;
    return `${color}[${timestamp}] [${level.toUpperCase()}]${colors.reset} ${message}${metaString}`;
  }

  public info(message: string, meta?: any) {
    console.log(this.formatMessage('info', message, meta));
  }

  public warn(message: string, meta?: any) {
    console.warn(this.formatMessage('warn', message, meta));
  }

  public error(message: string, error?: any, meta?: any) {
    const combinedMeta = {
      ...(error instanceof Error ? { error: error.message, stack: error.stack } : { error }),
      ...meta
    };
    console.error(this.formatMessage('error', message, combinedMeta));
  }

  public debug(message: string, meta?: any) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(this.formatMessage('debug', message, meta));
    }
  }
}

export const logger = new Logger();
