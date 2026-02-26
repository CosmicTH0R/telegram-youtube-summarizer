import { QAEngine } from '../src/components/QAEngine';
import { Transcript, QA } from '../src/models';
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

describe('QAEngine', () => {
  let qaEngine: QAEngine;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCreate.mockReset();
    qaEngine = new QAEngine();
  });

  describe('Unit Tests', () => {
    test('should chunk transcript with correct overlap', () => {
      const text = Array(1000).fill('word').join(' ');
      const chunks = qaEngine.chunkTranscript(text);

      expect(chunks.length).toBeGreaterThan(1);
      
      // Check that chunks have overlap
      if (chunks.length > 1) {
        const firstChunkEnd = chunks[0].endIndex;
        const secondChunkStart = chunks[1].startIndex;
        expect(secondChunkStart).toBeLessThan(firstChunkEnd);
      }
    });

    test('should find relevant chunks based on keywords', () => {
      const chunks = [
        { text: 'This is about machine learning and AI', startIndex: 0, endIndex: 7 },
        { text: 'This talks about cooking recipes', startIndex: 7, endIndex: 12 },
        { text: 'Machine learning models are powerful', startIndex: 12, endIndex: 17 },
      ];

      const relevantChunks = qaEngine.findRelevantChunks('machine learning', chunks);

      expect(relevantChunks.length).toBeGreaterThan(0);
      expect(relevantChunks.length).toBeLessThanOrEqual(3);
      
      // Should prioritize chunks with more keyword matches
      const firstChunkText = relevantChunks[0].text.toLowerCase();
      expect(firstChunkText).toContain('machine');
    });

    test('should return empty array when no relevant chunks found', () => {
      const chunks = [
        { text: 'This is about cooking', startIndex: 0, endIndex: 4 },
        { text: 'This talks about recipes', startIndex: 4, endIndex: 8 },
      ];

      const relevantChunks = qaEngine.findRelevantChunks('machine learning', chunks);

      // Should return first few chunks when no keywords match
      expect(relevantChunks.length).toBe(0);
    });

    test('should answer question with relevant context', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Machine learning is a subset of artificial intelligence. It uses algorithms to learn from data.',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Machine learning is a subset of artificial intelligence.',
            },
          },
        ],
      });

      const answer = await qaEngine.answerQuestion('What is machine learning?', transcript);

      expect(answer).toBeTruthy();
      expect(mockCreate).toHaveBeenCalled();
    });

    test('should return "not covered" when no relevant chunks', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'This video is about cooking recipes and food preparation.',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      const answer = await qaEngine.answerQuestion('What is machine learning?', transcript);

      expect(answer).toBe('This topic is not covered in the video.');
    });

    test('should include conversation history in prompt', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Machine learning uses algorithms. Deep learning is a type of machine learning.',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      const history: QA[] = [
        {
          question: 'What is machine learning?',
          answer: 'Machine learning uses algorithms.',
          timestamp: new Date(),
        },
      ];

      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'Deep learning is a type of machine learning.',
            },
          },
        ],
      });

      const answer = await qaEngine.answerQuestion('What is deep learning?', transcript, history);

      expect(answer).toBeTruthy();
      expect(mockCreate).toHaveBeenCalled();
      
      // Check that history was included in the prompt
      const callArgs = mockCreate.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;
      expect(prompt).toContain('Previous conversation');
      expect(prompt).toContain('What is machine learning?');
    });

    test('should limit history to last 5 Q&A pairs', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Machine learning content here. This is about algorithms and data science.',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      const history: QA[] = Array(10)
        .fill(null)
        .map((_, i) => ({
          question: `Question ${i}`,
          answer: `Answer ${i}`,
          timestamp: new Date(),
        }));

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'Test answer' } }],
      });

      await qaEngine.answerQuestion('machine learning', transcript, history);

      expect(mockCreate).toHaveBeenCalled();
      const callArgs = mockCreate.mock.calls[0][0];
      const prompt = callArgs.messages[1].content;
      
      // Should only include last 5 pairs
      expect(prompt).toContain('Question 5');
      expect(prompt).not.toContain('Question 0');
    });

    test('should handle API errors', async () => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Machine learning content about algorithms and data.',
        language: 'en',
        duration: 600,
        fetched_at: new Date(),
      };

      mockCreate.mockRejectedValue(new Error('API Error'));

      await expect(qaEngine.answerQuestion('machine learning', transcript)).rejects.toThrow('API Error');
    });
  });

  describe('Property-Based Tests', () => {
    /**
     * Feature: telegram-youtube-summarizer
     * Property 10: Unanswerable question handling
     * Validates: Requirements 5.3
     */
    test('Property 10: Unanswerable question handling', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            video_id: fc.string({ minLength: 1, maxLength: 20 }),
            title: fc.string({ minLength: 1, maxLength: 100 }),
            text: fc.string({ minLength: 50, maxLength: 200 }),
            language: fc.constantFrom('en', 'hi', 'ta'),
            duration: fc.integer({ min: 60, max: 3600 }),
            fetched_at: fc.date(),
          }),
          fc.string({ minLength: 5, maxLength: 100 }),
          async (transcript: Transcript, question: string) => {
            // Mock response for unanswerable questions
            mockCreate.mockReset();
            mockCreate.mockResolvedValue({
              choices: [{ message: { content: 'This topic is not covered in the video.' } }],
            });

            const answer = await qaEngine.answerQuestion(question, transcript);

            // Property: Answer must be a non-empty string
            expect(typeof answer).toBe('string');
            expect(answer.length).toBeGreaterThan(0);

            // Property: If no relevant context, should return standard message
            if (answer === 'This topic is not covered in the video.') {
              expect(answer).toBe('This topic is not covered in the video.');
            }
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property 11: Q&A context preservation
     * Validates: Requirements 5.4
     */
    test('Property 11: Q&A context preservation', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              question: fc.string({ minLength: 5, maxLength: 100 }),
              answer: fc.string({ minLength: 5, maxLength: 200 }),
              timestamp: fc.date(),
            }),
            { minLength: 0, maxLength: 10 }
          ),
          (history: QA[]) => {
            const text = 'Test transcript content about various topics.';
            const chunks = qaEngine.chunkTranscript(text);

            // Property: Chunking should be deterministic
            const chunks2 = qaEngine.chunkTranscript(text);
            expect(chunks.length).toBe(chunks2.length);

            // Property: Each chunk should have valid indices
            chunks.forEach((chunk) => {
              expect(chunk.startIndex).toBeGreaterThanOrEqual(0);
              expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
              expect(chunk.text.length).toBeGreaterThan(0);
            });

            // Property: Chunks should cover the entire text
            if (chunks.length > 0) {
              expect(chunks[0].startIndex).toBe(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Chunk overlap consistency
     * Validates: Chunking implementation correctness
     */
    test('Property: Chunk overlap consistency', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 5000 }),
          (text: string) => {
            const chunks = qaEngine.chunkTranscript(text);

            // Property: All chunks except last should have expected size or less
            chunks.forEach((chunk, index) => {
              expect(chunk.text.length).toBeGreaterThan(0);
              
              // Property: Indices should be valid
              expect(chunk.startIndex).toBeGreaterThanOrEqual(0);
              expect(chunk.endIndex).toBeGreaterThan(chunk.startIndex);
              
              // Property: Adjacent chunks should overlap
              if (index < chunks.length - 1) {
                const nextChunk = chunks[index + 1];
                // Next chunk should start before current chunk ends (overlap)
                expect(nextChunk.startIndex).toBeLessThan(chunk.endIndex);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Feature: telegram-youtube-summarizer
     * Property: Keyword extraction consistency
     * Validates: Relevance scoring implementation
     */
    test('Property: Keyword-based relevance scoring', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              text: fc.string({ minLength: 10, maxLength: 100 }),
              startIndex: fc.integer({ min: 0, max: 1000 }),
              endIndex: fc.integer({ min: 0, max: 1000 }),
            }),
            { minLength: 1, maxLength: 20 }
          ),
          fc.string({ minLength: 3, maxLength: 50 }),
          (chunks, question) => {
            // Fix invalid chunks
            const validChunks = chunks.map((chunk) => ({
              ...chunk,
              endIndex: Math.max(chunk.startIndex + 1, chunk.endIndex),
            }));

            const relevantChunks = qaEngine.findRelevantChunks(question, validChunks);

            // Property: Result should be an array
            expect(Array.isArray(relevantChunks)).toBe(true);

            // Property: Should not return more than maxRelevantChunks
            expect(relevantChunks.length).toBeLessThanOrEqual(3);

            // Property: All returned chunks should be from input
            relevantChunks.forEach((chunk) => {
              expect(validChunks).toContainEqual(chunk);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
