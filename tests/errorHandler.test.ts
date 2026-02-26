import { handleError, withErrorHandling, BotError } from '../src/utils/errorHandler';
import * as fc from 'fast-check';

describe('Error Handler', () => {
  describe('Unit Tests', () => {
    test('should return appropriate message for rate limit errors', () => {
      const error = { code: 'RATE_LIMIT', message: 'Rate limit exceeded' };
      const message = handleError(error);
      expect(message).toContain('temporarily busy');
    });

    test('should return appropriate message for private video errors', () => {
      const error = { code: 'PRIVATE_VIDEO', message: 'Private video' };
      const message = handleError(error);
      expect(message).toContain('private');
    });

    test('should return appropriate message for age-restricted errors', () => {
      const error = { code: 'AGE_RESTRICTED', message: 'Age restricted' };
      const message = handleError(error);
      expect(message).toContain('age-restricted');
    });

    test('should return appropriate message for video not found errors', () => {
      const error = { code: 'VIDEO_NOT_FOUND', message: 'Not found' };
      const message = handleError(error);
      expect(message).toContain('not found');
    });

    test('should return generic message for unknown errors', () => {
      const error = { code: 'UNKNOWN', message: 'Something went wrong' };
      const message = handleError(error);
      expect(message).toBe('An error occurred. Please try again later.');
    });

    test('should wrap operations with error handling', async () => {
      const operation = async () => {
        throw new Error('Test error');
      };

      await expect(withErrorHandling(operation, { userId: 'test123' })).rejects.toThrow(BotError);
    });

    test('should preserve BotError when re-throwing', async () => {
      const botError = new BotError('Test', 'TEST_CODE', 'Test message');
      const operation = async () => {
        throw botError;
      };

      try {
        await withErrorHandling(operation);
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(botError);
      }
    });

    test('should return successful result when no error', async () => {
      const operation = async () => 'success';
      const result = await withErrorHandling(operation);
      expect(result).toBe('success');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property 20: General error handling
     * Validates: Requirements 8.5
     */
    test('Property 20: General error handling', () => {
      fc.assert(
        fc.property(
          fc.record({
            code: fc.constantFrom(
              'RATE_LIMIT',
              'PRIVATE_VIDEO',
              'AGE_RESTRICTED',
              'VIDEO_NOT_FOUND',
              'TRANSCRIPT_DISABLED',
              'VIDEO_UNAVAILABLE',
              'UNKNOWN_ERROR'
            ),
            message: fc.string({ minLength: 1, maxLength: 100 }),
          }),
          (error) => {
            const userMessage = handleError(error);

            // Property: All errors should return a user-friendly message
            expect(userMessage).toBeDefined();
            expect(typeof userMessage).toBe('string');
            expect(userMessage.length).toBeGreaterThan(0);

            // Property: Messages should not contain technical jargon
            expect(userMessage).not.toContain('undefined');
            expect(userMessage).not.toContain('null');
            expect(userMessage).not.toContain('Error:');
            expect(userMessage).not.toContain('Exception');

            // Property: Messages should be reasonably short
            expect(userMessage.length).toBeLessThan(200);

            // Property: Messages should start with capital letter
            expect(userMessage[0]).toBe(userMessage[0].toUpperCase());

            // Property: Messages should end with period
            expect(userMessage[userMessage.length - 1]).toBe('.');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Error context should be preserved
     */
    test('should preserve error context in BotError', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            videoId: fc.string({ minLength: 11, maxLength: 11 }),
            operation: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          async (context) => {
            const operation = async () => {
              throw new Error('Test error');
            };

            try {
              await withErrorHandling(operation, context);
              fail('Should have thrown');
            } catch (error) {
              if (error instanceof BotError) {
                // Property: Context should be preserved
                expect(error.context).toBeDefined();
                expect(error.context?.userId).toBe(context.userId);
                expect(error.context?.videoId).toBe(context.videoId);
                expect(error.context?.operation).toBe(context.operation);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Successful operations should not throw
     */
    test('should not throw for successful operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.object()
          ),
          async (value) => {
            const operation = async () => value;
            const result = await withErrorHandling(operation);
            
            // Property: Result should match input
            expect(result).toEqual(value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
