import { CommandHandler } from '../src/components/CommandHandler';
import { ContextManager } from '../src/components/ContextManager';
import { Summarizer } from '../src/components/Summarizer';
import * as fc from 'fast-check';

// Mock OpenAI
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    key_points: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5'],
                    timestamps: ['0:00 - Intro', '5:30 - Main topic', '10:00 - Conclusion'],
                    core_takeaway: 'This is the main takeaway',
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

describe('CommandHandler', () => {
  let commandHandler: CommandHandler;
  let contextManager: ContextManager;
  let summarizer: Summarizer;

  const createMockTranscript = (text: string = 'Test transcript content'): any => ({
    video_id: 'test123',
    title: 'Test Video',
    text,
    language: 'en',
    duration: 600,
    fetched_at: new Date(),
  });

  beforeEach(() => {
    contextManager = new ContextManager();
    summarizer = new Summarizer();
    commandHandler = new CommandHandler(contextManager, summarizer);
  });

  describe('Unit Tests', () => {
    describe('/summary command', () => {
      test('should return error when no active session', async () => {
        const result = await commandHandler.handleSummaryCommand('user123');
        expect(result).toContain('No active session');
      });

      test('should return formatted summary for active session', async () => {
        // Create session
        await contextManager.createSession('user123', 'video123', createMockTranscript());

        const result = await commandHandler.handleSummaryCommand('user123');
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    describe('/actionpoints command', () => {
      test('should return error when no active session', async () => {
        const result = await commandHandler.handleActionPointsCommand('user123');
        expect(result).toContain('No active session');
      });

      test('should return action points for active session', async () => {
        // Mock action points response
        const mockOpenAI = (summarizer as any).openai;
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  'Action 1: Do this',
                  'Action 2: Do that',
                  'Action 3: Try this',
                ]),
              },
            },
          ],
        });

        await contextManager.createSession('user123', 'video123', createMockTranscript());

        const result = await commandHandler.handleActionPointsCommand('user123');
        
        expect(result).toContain('Action Points');
        expect(result).toContain('1.');
      });

      test('should handle empty action points', async () => {
        // Mock empty action points
        const mockOpenAI = (summarizer as any).openai;
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [
            {
              message: {
                content: JSON.stringify([]),
              },
            },
          ],
        });

        await contextManager.createSession('user123', 'video123', createMockTranscript());

        const result = await commandHandler.handleActionPointsCommand('user123');
        
        expect(result).toContain('No specific action points');
      });
    });

    describe('/clear command', () => {
      test('should return error when no active session', async () => {
        const result = await commandHandler.handleClearCommand('user123');
        expect(result).toContain('No active session');
      });

      test('should clear session and confirm', async () => {
        await contextManager.createSession('user123', 'video123', createMockTranscript());

        const result = await commandHandler.handleClearCommand('user123');
        
        expect(result).toContain('cleared successfully');
        const session = await contextManager.getSession('user123');
        expect(session).toBeNull();
      });

      test('should actually remove session', async () => {
        await contextManager.createSession('user123', 'video123', createMockTranscript());
        
        await commandHandler.handleClearCommand('user123');
        
        const session = await contextManager.getSession('user123');
        expect(session).toBeNull();
      });
    });

    describe('/help command', () => {
      test('should return help message', () => {
        const result = commandHandler.handleHelpCommand();
        
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });

      test('should contain all commands', () => {
        const result = commandHandler.handleHelpCommand();
        
        expect(result).toContain('/summary');
        expect(result).toContain('/actionpoints');
        expect(result).toContain('/clear');
        expect(result).toContain('/help');
      });

      test('should contain usage instructions', () => {
        const result = commandHandler.handleHelpCommand();
        
        expect(result).toContain('How to use');
        expect(result).toContain('YouTube link');
      });

      test('should mention language support', () => {
        const result = commandHandler.handleHelpCommand();
        
        expect(result).toContain('Language');
        expect(result).toContain('Hindi');
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property 22: Summary command response
     * Validates: Requirements 10.1
     */
    test('Property 22: Summary command response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            videoId: fc.string({ minLength: 11, maxLength: 11 }),
            transcript: fc.string({ minLength: 100, maxLength: 1000 }),
          }),
          async ({ userId, videoId, transcript }) => {
            // Create fresh context manager for each test
            const cm = new ContextManager();
            const sum = new Summarizer();
            const ch = new CommandHandler(cm, sum);

            // Property: Without session, returns error
            const noSessionResult = await ch.handleSummaryCommand(userId);
            expect(noSessionResult).toContain('No active session');

            // Create session
            const mockTranscript: any = {
              video_id: videoId,
              title: 'Test Video',
              text: transcript,
              language: 'en',
              duration: 600,
              fetched_at: new Date(),
            };
            await cm.createSession(userId, videoId, mockTranscript);

            // Property: With session, returns non-empty string
            const result = await ch.handleSummaryCommand(userId);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // Property: Result should not contain error messages
            expect(result).not.toContain('No active session');
            
            // Cleanup
            cm.stopCleanupTask();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property 23: Action points command response
     * Validates: Requirements 10.3
     */
    test('Property 23: Action points command response', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            videoId: fc.string({ minLength: 11, maxLength: 11 }),
            transcript: fc.string({ minLength: 100, maxLength: 1000 }),
          }),
          async ({ userId, videoId, transcript }) => {
            const cm = new ContextManager();
            const sum = new Summarizer();
            const ch = new CommandHandler(cm, sum);

            // Property: Without session, returns error
            const noSessionResult = await ch.handleActionPointsCommand(userId);
            expect(noSessionResult).toContain('No active session');

            // Create session
            const mockTranscript: any = {
              video_id: videoId,
              title: 'Test Video',
              text: transcript,
              language: 'en',
              duration: 600,
              fetched_at: new Date(),
            };
            await cm.createSession(userId, videoId, mockTranscript);

            // Property: With session, returns non-empty string
            const result = await ch.handleActionPointsCommand(userId);
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // Property: Result should contain action points indicator
            expect(
              result.includes('Action Points') || result.includes('No specific action points')
            ).toBe(true);
            
            // Cleanup
            cm.stopCleanupTask();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property 24: Clear command session removal
     * Validates: Requirements 10.4
     */
    test('Property 24: Clear command session removal', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            userId: fc.string({ minLength: 1, maxLength: 20 }),
            videoId: fc.string({ minLength: 11, maxLength: 11 }),
            transcript: fc.string({ minLength: 10, maxLength: 1000 }),
          }),
          async ({ userId, videoId, transcript }) => {
            const cm = new ContextManager();
            const sum = new Summarizer();
            const ch = new CommandHandler(cm, sum);

            // Property: Without session, returns appropriate message
            const noSessionResult = await ch.handleClearCommand(userId);
            expect(noSessionResult).toContain('No active session');

            // Create session
            const mockTranscript: any = {
              video_id: videoId,
              title: 'Test Video',
              text: transcript,
              language: 'en',
              duration: 600,
              fetched_at: new Date(),
            };
            await cm.createSession(userId, videoId, mockTranscript);
            const sessionBefore = await cm.getSession(userId);
            expect(sessionBefore).not.toBeNull();

            // Property: Clear command removes session
            const result = await ch.handleClearCommand(userId);
            expect(result).toContain('cleared');
            const sessionAfter = await cm.getSession(userId);
            expect(sessionAfter).toBeNull();

            // Property: Calling clear again returns no session message
            const secondClear = await ch.handleClearCommand(userId);
            expect(secondClear).toContain('No active session');
            
            // Cleanup
            cm.stopCleanupTask();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Help command is deterministic
     */
    test('should return same help message every time', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 10 }), (iterations) => {
          const cm = new ContextManager();
          const sum = new Summarizer();
          const ch = new CommandHandler(cm, sum);

          const firstResult = ch.handleHelpCommand();

          // Property: Multiple calls return identical result
          for (let i = 0; i < iterations; i++) {
            const result = ch.handleHelpCommand();
            expect(result).toBe(firstResult);
          }
          
          // Cleanup
          cm.stopCleanupTask();
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Commands don't interfere with each other
     */
    test('should handle multiple commands independently', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              userId: fc.string({ minLength: 1, maxLength: 20 }),
              videoId: fc.string({ minLength: 11, maxLength: 11 }),
              transcript: fc.string({ minLength: 100, maxLength: 500 }),
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (sessions) => {
            const cm = new ContextManager();
            const sum = new Summarizer();
            const ch = new CommandHandler(cm, sum);

            // Create all sessions
            for (const session of sessions) {
              const mockTranscript: any = {
                video_id: session.videoId,
                title: 'Test Video',
                text: session.transcript,
                language: 'en',
                duration: 600,
                fetched_at: new Date(),
              };
              await cm.createSession(session.userId, session.videoId, mockTranscript);
            }

            // Property: Each user's commands work independently
            for (const session of sessions) {
              const summaryResult = await ch.handleSummaryCommand(session.userId);
              expect(summaryResult.length).toBeGreaterThan(0);

              const clearResult = await ch.handleClearCommand(session.userId);
              expect(clearResult).toContain('cleared');

              // Verify session is actually cleared
              const clearedSession = await cm.getSession(session.userId);
              expect(clearedSession).toBeNull();
            }
            
            // Cleanup
            cm.stopCleanupTask();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
