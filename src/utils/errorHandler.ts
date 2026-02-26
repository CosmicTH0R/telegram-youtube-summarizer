import { logger } from './logger';

export interface ErrorContext {
  userId?: string;
  videoId?: string;
  operation?: string;
  [key: string]: any;
}

export class BotError extends Error {
  constructor(
    message: string,
    public code: string,
    public userMessage: string,
    public context?: ErrorContext
  ) {
    super(message);
    this.name = 'BotError';
  }
}

/**
 * Handles errors and returns user-friendly messages
 * @param error - The error to handle
 * @param context - Additional context for logging
 * @returns User-friendly error message
 */
export function handleError(error: any, context?: ErrorContext): string {
  // Log error with context
  logger.error('Error occurred', error, context);

  // Handle known error types
  if (error.code === 'RATE_LIMIT') {
    return 'Service temporarily busy. Please try again in a moment.';
  }

  if (error.code === 'PRIVATE_VIDEO') {
    return 'This video is private and cannot be accessed.';
  }

  if (error.code === 'AGE_RESTRICTED') {
    return 'This video is age-restricted and cannot be accessed.';
  }

  if (error.code === 'VIDEO_NOT_FOUND') {
    return 'Video not found. Please check the URL.';
  }

  if (error.code === 'TRANSCRIPT_DISABLED' || error.code === 'NO_TRANSCRIPT') {
    return 'Transcript not available for this video.';
  }

  if (error.code === 'VIDEO_UNAVAILABLE') {
    return 'This video is not accessible. Please check the video privacy settings.';
  }

  if (error.code === 'CONTEXT_TOO_LONG') {
    return 'This video is too long to summarize. Please try a shorter video.';
  }

  // Generic error message
  return 'An error occurred. Please try again later.';
}

/**
 * Wraps an async operation with error handling
 * @param operation - The async operation to execute
 * @param context - Context for error logging
 * @returns Result or throws BotError
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  context?: ErrorContext
): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    logger.error('Operation failed', error, context);
    
    // Re-throw if already a BotError
    if (error instanceof BotError) {
      throw error;
    }

    // Wrap in BotError
    throw new BotError(
      error.message || 'Unknown error',
      error.code || 'UNKNOWN_ERROR',
      handleError(error, context),
      context
    );
  }
}
