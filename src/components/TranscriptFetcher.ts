import { YoutubeTranscript } from 'youtube-transcript';
import { Transcript } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config';

export class TranscriptFetchError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TranscriptFetchError';
  }
}

export class TranscriptFetcher {
  /**
   * Fetches transcript for a YouTube video with retry logic
   * @param videoId - YouTube video ID (11 characters)
   * @returns Transcript object with video details and text
   * @throws TranscriptFetchError if transcript cannot be fetched
   */
  async fetchTranscript(videoId: string): Promise<Transcript> {
    logger.info('Fetching transcript', { videoId });

    let lastError: Error | null = null;
    const { maxRetries, retryDelays } = config.transcript;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const transcriptData = await YoutubeTranscript.fetchTranscript(videoId);
        
        if (!transcriptData || transcriptData.length === 0) {
          throw new TranscriptFetchError(
            'Transcript not available for this video.',
            'NO_TRANSCRIPT'
          );
        }

        // Combine all transcript segments into full text
        const fullText = transcriptData.map(item => item.text).join(' ');
        
        // Calculate duration from transcript (last segment's offset)
        const duration = transcriptData.length > 0 
          ? Math.floor(transcriptData[transcriptData.length - 1].offset / 1000)
          : 0;

        // Detect language (youtube-transcript provides this)
        const language = 'en'; // Default, can be enhanced later

        const transcript: Transcript = {
          video_id: videoId,
          title: `Video ${videoId}`, // Will be enhanced with actual title later
          text: fullText,
          language,
          duration,
          fetched_at: new Date()
        };

        logger.info('Transcript fetched successfully', {
          videoId,
          textLength: fullText.length,
          duration
        });

        return transcript;

      } catch (error: any) {
        lastError = error;

        // Check for specific error types
        if (error.message?.includes('Transcript is disabled')) {
          throw new TranscriptFetchError(
            'Transcript not available for this video.',
            'TRANSCRIPT_DISABLED'
          );
        }

        if (error.message?.includes('Video unavailable')) {
          throw new TranscriptFetchError(
            'This video is not accessible. Please check the video privacy settings.',
            'VIDEO_UNAVAILABLE'
          );
        }

        // If it's the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          break;
        }

        // Wait before retrying (exponential backoff)
        const delay = retryDelays[attempt] || retryDelays[retryDelays.length - 1];
        logger.warning(`Transcript fetch failed, retrying in ${delay}ms`, {
          videoId,
          attempt: attempt + 1,
          error: error.message
        });

        await this.sleep(delay);
      }
    }

    // All retries failed
    logger.error('Failed to fetch transcript after all retries', lastError || undefined, { videoId });
    throw new TranscriptFetchError(
      'An error occurred. Please try again later.',
      'FETCH_FAILED'
    );
  }

  /**
   * Validates if a video exists and has a transcript available
   * @param videoId - YouTube video ID
   * @returns true if video is accessible, false otherwise
   */
  async validateVideo(videoId: string): Promise<boolean> {
    try {
      await this.fetchTranscript(videoId);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if transcript exceeds the long transcript threshold
   * @param transcript - Transcript object
   * @returns true if transcript is considered long
   */
  isLongTranscript(transcript: Transcript): boolean {
    return transcript.text.length > config.transcript.longTranscriptThreshold;
  }

  /**
   * Splits long transcript into manageable chunks
   * @param transcript - Transcript object
   * @param chunkSize - Size of each chunk in characters
   * @returns Array of text chunks
   */
  chunkTranscript(transcript: Transcript, chunkSize: number = 50000): string[] {
    const text = transcript.text;
    
    // If text is shorter than chunk size, return as single chunk
    if (text.length <= chunkSize) {
      return [text];
    }

    const chunks: string[] = [];
    
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize));
    }

    logger.info('Transcript chunked', {
      videoId: transcript.video_id,
      totalLength: text.length,
      numChunks: chunks.length
    });

    return chunks;
  }

  /**
   * Helper method to sleep for a specified duration
   * @param ms - Milliseconds to sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
