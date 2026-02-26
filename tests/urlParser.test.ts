import { extractVideoId, isYouTubeUrl, isValidVideoId } from '../src/utils/urlParser';
import * as fc from 'fast-check';

describe('URL Parser - Unit Tests', () => {
  describe('extractVideoId', () => {
    it('should extract video ID from youtube.com/watch?v= format', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtu.be/ format', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from youtube.com without www', () => {
      const url = 'https://youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from mobile youtube URL', () => {
      const url = 'https://m.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should extract video ID from embed URL', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should handle URL with additional query parameters', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s';
      expect(extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('should return null for invalid YouTube URL', () => {
      const url = 'https://www.google.com';
      expect(extractVideoId(url)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(extractVideoId('')).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(extractVideoId(null as any)).toBeNull();
      expect(extractVideoId(undefined as any)).toBeNull();
    });

    it('should return null for malformed YouTube URL', () => {
      const url = 'https://www.youtube.com/watch?v=invalid';
      expect(extractVideoId(url)).toBeNull();
    });
  });

  describe('isYouTubeUrl', () => {
    it('should return true for valid YouTube URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isYouTubeUrl('https://www.google.com')).toBe(false);
      expect(isYouTubeUrl('not a url')).toBe(false);
      expect(isYouTubeUrl('')).toBe(false);
    });
  });

  describe('isValidVideoId', () => {
    it('should return true for valid 11-character video IDs', () => {
      expect(isValidVideoId('dQw4w9WgXcQ')).toBe(true);
      expect(isValidVideoId('abc123XYZ-_')).toBe(true);
    });

    it('should return false for invalid video IDs', () => {
      expect(isValidVideoId('short')).toBe(false);
      expect(isValidVideoId('toolongvideoid123')).toBe(false);
      expect(isValidVideoId('invalid@char')).toBe(false);
      expect(isValidVideoId('')).toBe(false);
    });
  });
});

describe('URL Parser - Property-Based Tests', () => {
  /**
   * Property 1: YouTube URL video ID extraction
   * For any valid YouTube URL, extracting the video ID should return an 11-character alphanumeric string
   * Feature: telegram-youtube-summarizer, Property 1: YouTube URL video ID extraction
   * Validates: Requirements 2.1
   */
  it('Property 1: should extract 11-character video ID from any valid YouTube URL', () => {
    // Generator for valid 11-character video IDs
    const videoIdArbitrary = fc.stringOf(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')
      ),
      { minLength: 11, maxLength: 11 }
    );

    // Generator for YouTube URL formats
    const youtubeUrlArbitrary = fc.tuple(
      videoIdArbitrary,
      fc.constantFrom(
        'https://www.youtube.com/watch?v=',
        'https://youtube.com/watch?v=',
        'https://youtu.be/',
        'https://m.youtube.com/watch?v=',
        'https://www.youtube.com/embed/'
      )
    ).map(([videoId, prefix]) => ({ url: prefix + videoId, expectedId: videoId }));

    fc.assert(
      fc.property(youtubeUrlArbitrary, ({ url, expectedId }) => {
        const extractedId = extractVideoId(url);
        expect(extractedId).toBe(expectedId);
        expect(extractedId).toHaveLength(11);
        expect(/^[a-zA-Z0-9_-]{11}$/.test(extractedId!)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Invalid URL rejection
   * For any invalid YouTube URL or non-URL string, the bot should identify it as invalid
   * Feature: telegram-youtube-summarizer, Property 2: Invalid URL rejection
   * Validates: Requirements 2.2
   */
  it('Property 2: should return null for invalid URLs or non-YouTube URLs', () => {
    // Generator for invalid URLs
    const invalidUrlArbitrary = fc.oneof(
      fc.webUrl({ validSchemes: ['http', 'https'] }).filter(url => !url.includes('youtube') && !url.includes('youtu.be')),
      fc.string().filter(s => !s.includes('youtube') && !s.includes('youtu.be')),
      fc.constant(''),
      fc.constant('https://www.google.com'),
      fc.constant('not a url at all'),
      fc.constant('https://www.youtube.com/watch?v=short'), // Too short video ID
      fc.constant('https://www.youtube.com/watch?v=toolongvideoid123') // Too long video ID
    );

    fc.assert(
      fc.property(invalidUrlArbitrary, (invalidUrl) => {
        const result = extractVideoId(invalidUrl);
        expect(result).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Video ID validation consistency
   * If extractVideoId returns a video ID, isValidVideoId should return true for that ID
   */
  it('should have consistent validation between extractVideoId and isValidVideoId', () => {
    const videoIdArbitrary = fc.stringOf(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-'.split('')
      ),
      { minLength: 11, maxLength: 11 }
    );

    fc.assert(
      fc.property(videoIdArbitrary, (videoId) => {
        const url = `https://www.youtube.com/watch?v=${videoId}`;
        const extractedId = extractVideoId(url);
        
        if (extractedId !== null) {
          expect(isValidVideoId(extractedId)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });
});
