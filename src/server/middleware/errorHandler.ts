import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'An unexpected error occurred on the server';

  // Log the complete error trace
  logger.error(`Error processing request: ${req.method} ${req.url}`, err);

  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(isProd ? {} : { stack: err.stack }),
  });
};
