import { TranscriptFetcher, TranscriptFetchError } from '../src/components/TranscriptFetcher';
import { Transcript } from '../src/models';

describe('TranscriptFetcher - Unit Tests', () => {
  let fetcher: TranscriptFetcher;

  beforeEach(() => {
    fetcher = new TranscriptFetcher();
  });

  describe('isLongTranscript', () => {
    it('should return true for transcripts exceeding threshold', () => {
      const longTranscript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'a'.repeat(150000), // 150k characters
        language: 'en',
        duration: 3600,
        fetched_at: new Date()
      };

      expect(fetcher.isLongTranscript(longTranscript)).toBe(true);
    });

    it('should return false for transcripts below threshold', () => {
      const shortTranscript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Short transcript text',
        language: 'en',
        duration: 60,
        fetched_at: new Date()
      };

      expect(fetcher.isLongTranscript(shortTranscript)).toBe(false);
    });
  });

  describe('chunkTranscript', () => {
    it('should return single chunk for short transcripts', () => {
      const shortTranscript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'Short transcript text',
        language: 'en',
        duration: 60,
        fetched_at: new Date()
      };

      const chunks = fetcher.chunkTranscript(shortTranscript);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Short transcript text');
    });

    it('should split long transcripts into multiple chunks', () => {
      const longText = 'a'.repeat(150000);
      const longTranscript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: longText,
        language: 'en',
        duration: 3600,
        fetched_at: new Date()
      };

      const chunks = fetcher.chunkTranscript(longTranscript, 50000);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.length).toBe(3); // 150000 / 50000 = 3
      
      // Verify all chunks combined equal original text
      const combined = chunks.join('');
      expect(combined).toBe(longText);
    });

    it('should respect custom chunk size', () => {
      const text = 'a'.repeat(10000);
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text,
        language: 'en',
        duration: 600,
        fetched_at: new Date()
      };

      const chunks = fetcher.chunkTranscript(transcript, 2500);
      expect(chunks.length).toBe(4); // 10000 / 2500 = 4
    });
  });

  describe('fetchTranscript', () => {
    it('should throw TranscriptFetchError for invalid video ID', async () => {
      await expect(fetcher.fetchTranscript('invalid123')).rejects.toThrow(TranscriptFetchError);
    }, 15000); // Increased timeout for API call

    it('should throw error with appropriate code for unavailable transcript', async () => {
      try {
        await fetcher.fetchTranscript('invalid123');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(TranscriptFetchError);
        expect((error as TranscriptFetchError).code).toBeDefined();
      }
    }, 15000);
  });

  describe('validateVideo', () => {
    it('should return false for invalid video ID', async () => {
      const isValid = await fetcher.validateVideo('invalid123');
      expect(isValid).toBe(false);
    }, 15000);
  });
});

describe('TranscriptFetcher - Property-Based Tests', () => {
  let fetcher: TranscriptFetcher;

  beforeEach(() => {
    fetcher = new TranscriptFetcher();
  });

  /**
   * Property 6: Long transcript chunking
   * For any transcript exceeding 100,000 characters, the transcript fetcher should process it in chunks
   * Feature: telegram-youtube-summarizer, Property 6: Long transcript chunking
   * Validates: Requirements 3.3
   */
  it('Property 6: should chunk any transcript exceeding threshold', () => {
    // Test with various long transcript sizes
    const testCases = [
      100001, // Just over threshold
      150000, // 1.5x threshold
      200000, // 2x threshold
      500000  // 5x threshold
    ];

    testCases.forEach(length => {
      const longTranscript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'a'.repeat(length),
        language: 'en',
        duration: 3600,
        fetched_at: new Date()
      };

      // Should be identified as long
      expect(fetcher.isLongTranscript(longTranscript)).toBe(true);

      // Should be chunked
      const chunks = fetcher.chunkTranscript(longTranscript, 50000);
      expect(chunks.length).toBeGreaterThan(1);

      // All chunks combined should equal original
      const combined = chunks.join('');
      expect(combined).toBe(longTranscript.text);
      expect(combined.length).toBe(length);
    });
  });

  /**
   * Property: Chunk size consistency
   * All chunks except the last should be exactly the specified chunk size
   */
  it('should create chunks of consistent size except the last chunk', () => {
    const testSizes = [100000, 150000, 200000];
    const chunkSize = 50000;

    testSizes.forEach(size => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'a'.repeat(size),
        language: 'en',
        duration: 3600,
        fetched_at: new Date()
      };

      const chunks = fetcher.chunkTranscript(transcript, chunkSize);

      // All chunks except last should be exactly chunkSize
      for (let i = 0; i < chunks.length - 1; i++) {
        expect(chunks[i].length).toBe(chunkSize);
      }

      // Last chunk should be <= chunkSize
      expect(chunks[chunks.length - 1].length).toBeLessThanOrEqual(chunkSize);
    });
  });

  /**
   * Property: Short transcripts should not be chunked
   * Any transcript below or equal to the chunk size should return a single chunk
   */
  it('should not chunk transcripts below or equal to chunk size', () => {
    const testSizes = [1000, 10000, 25000, 50000]; // All <= default chunk size

    testSizes.forEach(size => {
      const transcript: Transcript = {
        video_id: 'test123',
        title: 'Test Video',
        text: 'a'.repeat(size),
        language: 'en',
        duration: 600,
        fetched_at: new Date()
      };

      const chunks = fetcher.chunkTranscript(transcript);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe(transcript.text);
    });
  });
});
