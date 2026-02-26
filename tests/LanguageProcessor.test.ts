import { LanguageProcessor } from '../src/components/LanguageProcessor';
import { Summary } from '../src/models';
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

describe('LanguageProcessor', () => {
  let languageProcessor: LanguageProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReset();
    languageProcessor = new LanguageProcessor();
  });

  describe('Unit Tests', () => {
    describe('Language Detection', () => {
      test('should detect Hindi from "in Hindi"', () => {
        const result = languageProcessor.detectLanguageRequest('Please summarize in Hindi');
        expect(result).toBe('hi');
      });

      test('should detect Hindi from "Hindi mein"', () => {
        const result = languageProcessor.detectLanguageRequest('Summarize Hindi mein');
        expect(result).toBe('hi');
      });

      test('should detect Hindi from Devanagari script', () => {
        const result = languageProcessor.detectLanguageRequest('हिंदी में बताओ');
        expect(result).toBe('hi');
      });

      test('should detect Tamil from "in Tamil"', () => {
        const result = languageProcessor.detectLanguageRequest('Explain in Tamil');
        expect(result).toBe('ta');
      });

      test('should detect Tamil from Tamil script', () => {
        const result = languageProcessor.detectLanguageRequest('தமிழில் சொல்லுங்கள்');
        expect(result).toBe('ta');
      });

      test('should detect Telugu', () => {
        const result = languageProcessor.detectLanguageRequest('in Telugu please');
        expect(result).toBe('te');
      });

      test('should detect Kannada', () => {
        const result = languageProcessor.detectLanguageRequest('in Kannada');
        expect(result).toBe('kn');
      });

      test('should detect Marathi', () => {
        const result = languageProcessor.detectLanguageRequest('in Marathi');
        expect(result).toBe('mr');
      });

      test('should return null for English or no language request', () => {
        const result = languageProcessor.detectLanguageRequest('What is this video about?');
        expect(result).toBeNull();
      });

      test('should be case insensitive', () => {
        const result = languageProcessor.detectLanguageRequest('IN HINDI');
        expect(result).toBe('hi');
      });
    });

    describe('Summary Translation', () => {
      test('should return original summary for English', async () => {
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

        const result = await languageProcessor.translateSummary(summary, 'en');
        expect(result).toEqual(summary);
      });

      test('should translate summary to target language', async () => {
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

        // Mock translation responses
        mockCreate
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'बिंदु 1\nबिंदु 2\nबिंदु 3\nबिंदु 4\nबिंदु 5' } }],
          })
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'परिचय\nमुख्य\nअंत' } }],
          })
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'मुख्य निष्कर्ष' } }],
          })
          .mockResolvedValueOnce({
            choices: [{ message: { content: 'परीक्षण वीडियो' } }],
          });

        const result = await languageProcessor.translateSummary(summary, 'hi');

        expect(result.title).toBe('परीक्षण वीडियो');
        expect(result.key_points).toHaveLength(5);
        expect(result.timestamps).toHaveLength(3);
        expect(result.timestamps[0].time).toBe('0:30'); // Time should not change
        expect(result.core_takeaway).toBe('मुख्य निष्कर्ष');
      });

      test('should handle translation errors', async () => {
        const summary: Summary = {
          title: 'Test Video',
          key_points: ['Point 1', 'Point 2', 'Point 3', 'Point 4', 'Point 5'],
          timestamps: [{ time: '0:30', description: 'Intro' }],
          core_takeaway: 'Main takeaway',
        };

        mockCreate.mockRejectedValue(new Error('Translation API Error'));

        await expect(languageProcessor.translateSummary(summary, 'hi')).rejects.toThrow(
          'Translation API Error'
        );
      });
    });

    describe('Answer Translation', () => {
      test('should return original answer for English', async () => {
        const answer = 'This is the answer';
        const result = await languageProcessor.translateAnswer(answer, 'en');
        expect(result).toBe(answer);
      });

      test('should translate answer to target language', async () => {
        const answer = 'This is the answer';

        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'यह उत्तर है' } }],
        });

        const result = await languageProcessor.translateAnswer(answer, 'hi');
        expect(result).toBe('यह उत्तर है');
        expect(mockCreate).toHaveBeenCalled();
      });

      test('should handle translation errors', async () => {
        const answer = 'This is the answer';

        mockCreate.mockRejectedValue(new Error('Translation API Error'));

        await expect(languageProcessor.translateAnswer(answer, 'hi')).rejects.toThrow(
          'Translation API Error'
        );
      });
    });

    describe('Utility Methods', () => {
      test('should return supported languages', () => {
        const languages = languageProcessor.getSupportedLanguages();
        expect(languages).toContain('en');
        expect(languages).toContain('hi');
        expect(languages).toContain('ta');
        expect(languages).toContain('te');
        expect(languages).toContain('kn');
        expect(languages).toContain('mr');
      });

      test('should return language name for code', () => {
        expect(languageProcessor.getLanguageName('en')).toBe('English');
        expect(languageProcessor.getLanguageName('hi')).toBe('Hindi');
        expect(languageProcessor.getLanguageName('ta')).toBe('Tamil');
        expect(languageProcessor.getLanguageName('unknown')).toBe('Unknown');
      });
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property 12: Language detection
     * Validates: Requirements 6.1
     */
    test('Property 12: Language detection', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'in Hindi',
            'Hindi mein',
            'in Tamil',
            'Tamil la',
            'in Telugu',
            'in Kannada',
            'in Marathi',
            'हिंदी में',
            'தமிழில்'
          ),
          (languageRequest: string) => {
            const detected = languageProcessor.detectLanguageRequest(languageRequest);

            // Property: Language request should be detected
            expect(detected).not.toBeNull();
            expect(typeof detected).toBe('string');

            // Property: Detected language should be supported
            const supportedLanguages = languageProcessor.getSupportedLanguages();
            expect(supportedLanguages).toContain(detected);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property 13: Language consistency
     * Validates: Requirements 6.2, 6.5
     */
    test('Property 13: Language consistency', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 100 }),
          fc.constantFrom('hi', 'ta', 'te', 'kn', 'mr'),
          async (text: string, targetLanguage: string) => {
            mockCreate.mockReset();
            mockCreate.mockResolvedValue({
              choices: [{ message: { content: 'Translated text' } }],
            });

            const result = await languageProcessor.translateAnswer(text, targetLanguage);

            // Property: Translation should return a non-empty string
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);

            // Property: OpenAI should be called with correct language
            expect(mockCreate).toHaveBeenCalled();
            const callArgs = mockCreate.mock.calls[0][0];
            const prompt = callArgs.messages[1].content;
            const languageName = languageProcessor.getLanguageName(targetLanguage);
            expect(prompt).toContain(languageName);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property 14: Default language
     * Validates: Requirements 6.4
     */
    test('Property 14: Default language', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 5, maxLength: 100 }),
          async (text: string) => {
            // Property: English language should not trigger translation
            const result = await languageProcessor.translateAnswer(text, 'en');

            // Property: Should return original text for English
            expect(result).toBe(text);

            // Property: OpenAI should not be called for English
            expect(mockCreate).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Language detection is deterministic
     */
    test('Property: Language detection is deterministic', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 200 }), (message: string) => {
          const result1 = languageProcessor.detectLanguageRequest(message);
          const result2 = languageProcessor.detectLanguageRequest(message);

          // Property: Same input should always produce same output
          expect(result1).toEqual(result2);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Summary structure preservation after translation
     */
    test('Property: Summary structure preservation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            title: fc.string({ minLength: 1, maxLength: 100 }),
            key_points: fc.array(fc.string({ minLength: 1, maxLength: 100 }), {
              minLength: 5,
              maxLength: 5,
            }),
            timestamps: fc.array(
              fc.record({
                time: fc.string({ minLength: 3, maxLength: 10 }),
                description: fc.string({ minLength: 1, maxLength: 100 }),
              }),
              { minLength: 3, maxLength: 10 }
            ),
            core_takeaway: fc.string({ minLength: 1, maxLength: 200 }),
          }),
          fc.constantFrom('hi', 'ta'),
          async (summary: Summary, targetLanguage: string) => {
            mockCreate.mockReset();
            mockCreate
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'T1\nT2\nT3\nT4\nT5' } }],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'D1\nD2\nD3' } }],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Translated takeaway' } }],
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Translated title' } }],
              });

            const result = await languageProcessor.translateSummary(summary, targetLanguage);

            // Property: Structure should be preserved
            expect(result.key_points).toHaveLength(5);
            expect(result.timestamps).toHaveLength(summary.timestamps.length);
            expect(typeof result.core_takeaway).toBe('string');
            expect(typeof result.title).toBe('string');

            // Property: Timestamps times should not change
            result.timestamps.forEach((ts, index) => {
              expect(ts.time).toBe(summary.timestamps[index].time);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
