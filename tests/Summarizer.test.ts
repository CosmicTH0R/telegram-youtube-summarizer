import { Summarizer } from '../src/components/Summarizer';
import { Transcript, Summary } from '../src/models';
import * as fc from 'fast-check';

// Mock OpenAI
const mockCreate = jest.fn();
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

describe('Summarizer', () => {
  let summarizer: Summarizer;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockCreate.mockReset();
    
    // Create summarizer instance
    summarizer = new Summarizer();
  });

  describe('Unit Tests', () => {
    test('should generate summary with correct structure', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'This is a test transcript about machine learning and AI.',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      const mockResponse = {
        key_points: [
          'Point 1',
          'Point 2',
          'Point 3',
          'Point 4',
          'Point 5',
        ],
        timestamps: [
          { time: '0:30', description: 'Introduction' },
          { time: '2:15', description: 'Main topic' },
          { time: '5:00', description: 'Conclusion' },
        ],
        core_takeaway: 'This is the main takeaway.',
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(mockResponse),
            },
          },
        ],
      });

      const summary = await summarizer.generateSummary(transcript);

      expect(summary.title).toBe('Test Video');
      expect(summary.key_points).toHaveLength(5);
      expect(summary.timestamps.length).toBeGreaterThanOrEqual(3);
      expect(summary.core_takeaway).toBeTruthy();
    });

    test('should format summary with emojis correctly', () => {
      const summary: Summary = {
        title: 'Test Video',
        key_points: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5'],
        timestamps: [
          { time: '0:30', description: 'Intro' },
          { time: '2:15', description: 'Main' },
          { time: '5:00', description: 'End' },
        ],
        core_takeaway: 'Main takeaway',
      };

      const formatted = summarizer.formatSummary(summary);

      expect(formatted).toContain('🎥 Test Video');
      expect(formatted).toContain('📌 Key Points:');
      expect(formatted).toContain('⏱ Important Timestamps:');
      expect(formatted).toContain('🧠 Core Takeaway:');
      expect(formatted).toContain('1. Point 1');
      expect(formatted).toContain('• 0:30 - Intro');
    });

    test('should handle different languages', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Test transcript',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      const mockResponse = {
        key_points: ['बिंदु 1', 'बिंदु 2', 'बिंदु 3', 'बिंदु 4', 'बिंदु 5'],
        timestamps: [
          { time: '0:30', description: 'परिचय' },
          { time: '2:15', description: 'मुख्य विषय' },
          { time: '5:00', description: 'निष्कर्ष' },
        ],
        core_takeaway: 'मुख्य निष्कर्ष',
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify(mockResponse) } }],
      });

      const summary = await summarizer.generateSummary(transcript, 'hi');

      expect(summary.key_points).toHaveLength(5);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('Hindi'),
            }),
          ]),
        })
      );
    });

    test('should handle empty response from OpenAI', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Test transcript',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      });

      await expect(summarizer.generateSummary(transcript)).rejects.toThrow('Empty response from OpenAI');
    });

    test('should handle invalid JSON response', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Test transcript',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'invalid json' } }],
      });

      await expect(summarizer.generateSummary(transcript)).rejects.toThrow();
    });

    test('should handle API errors', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Test transcript',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(summarizer.generateSummary(transcript)).rejects.toThrow('API Error');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property 8: Summary structure completeness
     * Validates: Requirements 4.1, 4.2, 4.3, 4.4
     */
    test('Property 8: Summary structure completeness', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            video_id: fc.string({ minLength: 1, maxLength: 20 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            text: fc.string({ minLength: 10, maxLength: 500 }),
            language: fc.constantFrom('en', 'hi', 'ta', 'te', 'kn', 'mr'),
            duration: fc.integer({ min: 60, max: 10800 }),
            fetched_at: fc.date(),
          }),
          async (transcript: Transcript) => {
            const mockResponse = {
              key_points: Array(5).fill('Test point'),
              timestamps: [
                { time: '0:30', description: 'Test' },
                { time: '2:15', description: 'Test' },
                { time: '5:00', description: 'Test' },
              ],
              core_takeaway: 'Test takeaway',
            };

            // Reset mock for each iteration
            mockCreate.mockReset();
            mockCreate.mockResolvedValue({
              choices: [{ message: { content: JSON.stringify(mockResponse) } }],
            });

            const summary = await summarizer.generateSummary(transcript);

            // Property: Summary must have all required fields
            expect(summary).toHaveProperty('title');
            expect(summary).toHaveProperty('key_points');
            expect(summary).toHaveProperty('timestamps');
            expect(summary).toHaveProperty('core_takeaway');

            // Property: key_points must be an array of 5 strings
            expect(Array.isArray(summary.key_points)).toBe(true);
            expect(summary.key_points).toHaveLength(5);

            // Property: timestamps must be an array with at least 3 items
            expect(Array.isArray(summary.timestamps)).toBe(true);
            expect(summary.timestamps.length).toBeGreaterThanOrEqual(3);

            // Property: Each timestamp must have time and description
            summary.timestamps.forEach((ts) => {
              expect(ts).toHaveProperty('time');
              expect(ts).toHaveProperty('description');
              expect(typeof ts.time).toBe('string');
              expect(typeof ts.description).toBe('string');
            });

            // Property: core_takeaway must be a non-empty string
            expect(typeof summary.core_takeaway).toBe('string');
            expect(summary.core_takeaway.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property 9: Summary message formatting
     * Validates: Requirements 4.5
     */
    test('Property 9: Summary message formatting', () => {
      fc.assert(
        fc.property(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            key_points: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 5, maxLength: 5 }),
            timestamps: fc.array(
              fc.record({
                time: fc.string({ minLength: 1, maxLength: 10 }),
                description: fc.string({ minLength: 1, maxLength: 100 }),
              }),
              { minLength: 3, maxLength: 10 }
            ),
            core_takeaway: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          (summary: Summary) => {
            const formatted = summarizer.formatSummary(summary);

            // Property: Formatted message must contain all emojis
            expect(formatted).toContain('🎥');
            expect(formatted).toContain('📌');
            expect(formatted).toContain('⏱');
            expect(formatted).toContain('🧠');

            // Property: Formatted message must contain title
            expect(formatted).toContain(summary.title);

            // Property: Formatted message must contain all key points
            summary.key_points.forEach((point) => {
              expect(formatted).toContain(point);
            });

            // Property: Formatted message must contain all timestamps
            summary.timestamps.forEach((ts) => {
              expect(formatted).toContain(ts.time);
              expect(formatted).toContain(ts.description);
            });

            // Property: Formatted message must contain core takeaway
            expect(formatted).toContain(summary.core_takeaway);

            // Property: Formatted message must have proper structure
            expect(formatted.indexOf('🎥')).toBeLessThan(formatted.indexOf('📌'));
            expect(formatted.indexOf('📌')).toBeLessThan(formatted.indexOf('⏱'));
            expect(formatted.indexOf('⏱')).toBeLessThan(formatted.indexOf('🧠'));
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});

  describe('Error Handling Property Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property 18: Long video warning
     * Validates: Requirements 8.2
     */
    test('Property 18: Long video warning', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 10801, max: 50000 }), // Videos longer than 3 hours
          (duration: number) => {
            const transcript: Transcript = {
              video_id: 'test123',
              title: 'Long Video',
              text: 'Test transcript',
              language: 'en',
              duration,
              fetched_at: new Date(),
            };

            // Property: Videos longer than 3 hours should be identified as long
            expect(summarizer.isLongVideo(transcript)).toBe(true);

            // Property: Videos 3 hours or less should not be identified as long
            const shortTranscript = { ...transcript, duration: 10800 };
            expect(summarizer.isLongVideo(shortTranscript)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Short videos should not trigger long video warning
     */
    test('should not identify short videos as long', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 60, max: 10800 }), // Videos up to 3 hours
          (duration: number) => {
            const transcript: Transcript = {
              video_id: 'test123',
              title: 'Short Video',
              text: 'Test transcript',
              language: 'en',
              duration,
              fetched_at: new Date(),
            };

            // Property: Videos 3 hours or less should not be long
            expect(summarizer.isLongVideo(transcript)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
