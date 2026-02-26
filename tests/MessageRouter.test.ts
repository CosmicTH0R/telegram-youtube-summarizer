import { MessageRouter } from '../src/components/MessageRouter';
import { SessionState } from '../src/models';
import * as fc from 'fast-check';

describe('MessageRouter', () => {
  let messageRouter: MessageRouter;

  beforeEach(() => {
    messageRouter = new MessageRouter();
  });

  describe('Unit Tests', () => {
    describe('YouTube URL Routing', () => {
      test('should route YouTube URL with watch?v= format', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          SessionState.NO_SESSION
        );

        expect(result.type).toBe('youtube_url');
        expect(result.videoId).toBe('dQw4w9WgXcQ');
      });

      test('should route YouTube URL with youtu.be format', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'https://youtu.be/dQw4w9WgXcQ',
          SessionState.NO_SESSION
        );

        expect(result.type).toBe('youtube_url');
        expect(result.videoId).toBe('dQw4w9WgXcQ');
      });

      test('should route YouTube URL even with active session', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'https://youtube.com/watch?v=abc123def45',
          SessionState.ACTIVE
        );

        expect(result.type).toBe('youtube_url');
        expect(result.videoId).toBe('abc123def45');
      });
    });

    describe('Question Routing', () => {
      test('should route text as question when session is active', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'What is this video about?',
          SessionState.ACTIVE
        );

        expect(result.type).toBe('question');
        expect(result.question).toBe('What is this video about?');
      });

      test('should route language request as question when session is active', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'Explain in Hindi',
          SessionState.ACTIVE
        );

        expect(result.type).toBe('question');
        expect(result.question).toBe('Explain in Hindi');
      });
    });

    describe('Command Routing', () => {
      test('should route /help command', () => {
        const result = messageRouter.routeMessage('user1', '/help', SessionState.NO_SESSION);

        expect(result.type).toBe('command');
        expect(result.command).toBe('help');
      });

      test('should route /summary command', () => {
        const result = messageRouter.routeMessage('user1', '/summary', SessionState.ACTIVE);

        expect(result.type).toBe('command');
        expect(result.command).toBe('summary');
      });

      test('should route /clear command', () => {
        const result = messageRouter.routeMessage('user1', '/clear', SessionState.ACTIVE);

        expect(result.type).toBe('command');
        expect(result.command).toBe('clear');
      });

      test('should handle command with arguments', () => {
        const result = messageRouter.routeMessage(
          'user1',
          '/summary detailed',
          SessionState.ACTIVE
        );

        expect(result.type).toBe('command');
        expect(result.command).toBe('summary');
        expect(result.message).toBe('/summary detailed');
      });

      test('should handle uppercase commands', () => {
        const result = messageRouter.routeMessage('user1', '/HELP', SessionState.NO_SESSION);

        expect(result.type).toBe('command');
        expect(result.command).toBe('help');
      });
    });

    describe('Usage Instructions Routing', () => {
      test('should return usage instructions when no session and no URL', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'Hello, how do I use this?',
          SessionState.NO_SESSION
        );

        expect(result.type).toBe('usage_instructions');
        expect(result.message).toContain('Welcome');
        expect(result.message).toContain('YouTube');
      });

      test('should return usage instructions for random text without session', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'What is machine learning?',
          SessionState.NO_SESSION
        );

        expect(result.type).toBe('usage_instructions');
        expect(result.message).toBeTruthy();
      });
    });

    describe('Session State Handling', () => {
      test('should return error for expired session', () => {
        const result = messageRouter.routeMessage(
          'user1',
          'What is this about?',
          SessionState.EXPIRED
        );

        expect(result.type).toBe('no_session_error');
        expect(result.message).toContain('expired');
      });

      test('should get NO_SESSION state when no session exists', () => {
        const state = messageRouter.getSessionState(false, false);
        expect(state).toBe(SessionState.NO_SESSION);
      });

      test('should get EXPIRED state when session is expired', () => {
        const state = messageRouter.getSessionState(true, true);
        expect(state).toBe(SessionState.EXPIRED);
      });

      test('should get ACTIVE state when session exists and not expired', () => {
        const state = messageRouter.getSessionState(true, false);
        expect(state).toBe(SessionState.ACTIVE);
      });
    });

    describe('Utility Methods', () => {
      test('should correctly identify YouTube URLs', () => {
        expect(messageRouter.isYouTubeUrl('https://youtube.com/watch?v=abc123def45')).toBe(true);
        expect(messageRouter.isYouTubeUrl('https://youtu.be/abc123def45')).toBe(true);
        expect(messageRouter.isYouTubeUrl('Not a URL')).toBe(false);
      });

      test('should return help message', () => {
        const help = messageRouter.getHelpMessage();
        expect(help).toContain('Welcome');
        expect(help).toContain('Commands');
        expect(help).toContain('/help');
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property: Non-URL message without session returns usage instructions
     * Validates: Requirements 2.3
     */
    test('Property: Non-URL message without session returns usage instructions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }).filter((s) => !s.includes('youtube')),
          fc.string({ minLength: 1, maxLength: 20 }),
          (message: string, userId: string) => {
            // Skip if message is a command
            if (message.startsWith('/')) {
              return true;
            }

            const result = messageRouter.routeMessage(userId, message, SessionState.NO_SESSION);

            // Property: Should return usage instructions
            expect(result.type).toBe('usage_instructions');
            expect(result.message).toBeTruthy();
            expect(typeof result.message).toBe('string');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: YouTube URLs are always routed correctly regardless of session state
     */
    test('Property: YouTube URLs routed correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'https://youtube.com/watch?v=dQw4w9WgXcQ',
            'https://www.youtube.com/watch?v=abc123def45',
            'https://youtu.be/xyz789abc12',
            'http://youtube.com/watch?v=test1234567'
          ),
          fc.constantFrom(SessionState.NO_SESSION, SessionState.ACTIVE, SessionState.EXPIRED),
          fc.string({ minLength: 1, maxLength: 20 }),
          (url: string, sessionState: SessionState, userId: string) => {
            const result = messageRouter.routeMessage(userId, url, sessionState);

            // Property: YouTube URLs should always be routed as youtube_url
            expect(result.type).toBe('youtube_url');
            expect(result.videoId).toBeTruthy();
            expect(typeof result.videoId).toBe('string');
            expect(result.videoId?.length).toBe(11);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Commands are always routed correctly regardless of session state
     */
    test('Property: Commands routed correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('/help', '/summary', '/clear', '/start', '/actionpoints'),
          fc.constantFrom(SessionState.NO_SESSION, SessionState.ACTIVE, SessionState.EXPIRED),
          fc.string({ minLength: 1, maxLength: 20 }),
          (command: string, sessionState: SessionState, userId: string) => {
            const result = messageRouter.routeMessage(userId, command, sessionState);

            // Property: Commands should always be routed as command
            expect(result.type).toBe('command');
            expect(result.command).toBeTruthy();
            expect(typeof result.command).toBe('string');
            expect(result.command).toBe(command.substring(1).toLowerCase());
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Active session routes text as questions
     */
    test('Property: Active session routes text as questions', () => {
      fc.assert(
        fc.property(
          fc
            .string({ minLength: 1, maxLength: 200 })
            .filter((s) => !s.startsWith('/') && !s.includes('youtube')),
          fc.string({ minLength: 1, maxLength: 20 }),
          (message: string, userId: string) => {
            const result = messageRouter.routeMessage(userId, message, SessionState.ACTIVE);

            // Property: Text with active session should be routed as question
            expect(result.type).toBe('question');
            expect(result.question).toBe(message);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Session state determination is consistent
     */
    test('Property: Session state determination is consistent', () => {
      fc.assert(
        fc.property(fc.boolean(), fc.boolean(), (hasSession: boolean, isExpired: boolean) => {
          const state1 = messageRouter.getSessionState(hasSession, isExpired);
          const state2 = messageRouter.getSessionState(hasSession, isExpired);

          // Property: Same inputs should produce same state
          expect(state1).toBe(state2);

          // Property: State should be one of the valid states
          expect([SessionState.NO_SESSION, SessionState.ACTIVE, SessionState.EXPIRED]).toContain(
            state1
          );

          // Property: Logic should be correct
          if (!hasSession) {
            expect(state1).toBe(SessionState.NO_SESSION);
          } else if (isExpired) {
            expect(state1).toBe(SessionState.EXPIRED);
          } else {
            expect(state1).toBe(SessionState.ACTIVE);
          }
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Routing is deterministic
     */
    test('Property: Routing is deterministic', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom(SessionState.NO_SESSION, SessionState.ACTIVE, SessionState.EXPIRED),
          (message: string, userId: string, sessionState: SessionState) => {
            const result1 = messageRouter.routeMessage(userId, message, sessionState);
            const result2 = messageRouter.routeMessage(userId, message, sessionState);

            // Property: Same inputs should produce same routing result
            expect(result1.type).toBe(result2.type);
            expect(result1.videoId).toBe(result2.videoId);
            expect(result1.question).toBe(result2.question);
            expect(result1.command).toBe(result2.command);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
