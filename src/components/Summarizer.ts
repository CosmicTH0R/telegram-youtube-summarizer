import { Transcript, Summary } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getAIProvider, AIProvider } from '../utils/aiProvider';

export class SummaryGenerationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'SummaryGenerationError';
  }
}

export class Summarizer {
  private aiProvider: AIProvider;
  private readonly LONG_VIDEO_THRESHOLD = 10800; // 3 hours in seconds

  constructor() {
    this.aiProvider = getAIProvider();
  }

  async generateSummary(transcript: Transcript, language: string = 'en'): Promise<Summary> {
    logger.info('Generating summary', { videoId: transcript.video_id, language });

    // Check for long videos and log warning
    if (transcript.duration > this.LONG_VIDEO_THRESHOLD) {
      const hours = Math.floor(transcript.duration / 3600);
      const minutes = Math.floor((transcript.duration % 3600) / 60);
      logger.warning('Processing long video', {
        videoId: transcript.video_id,
        duration: transcript.duration,
        formattedDuration: `${hours}h ${minutes}m`,
      });
    }

    try {
      const systemPrompt = 'You are a helpful assistant that creates structured summaries of video transcripts. Always respond with valid JSON.';
      const userPrompt = this.buildPrompt(transcript, language);
      
      const response = await this.aiProvider.generateCompletion(systemPrompt, userPrompt, 0.3);
      const parsed = JSON.parse(response.content);
      
      const summary: Summary = {
        title: transcript.title,
        key_points: parsed.key_points || [],
        timestamps: parsed.timestamps || [],
        core_takeaway: parsed.core_takeaway || '',
      };

      // Validate structure
      if (summary.key_points.length !== 5) {
        logger.warning('Summary has incorrect number of key points', {
          videoId: transcript.video_id,
          count: summary.key_points.length,
        });
      }

      if (summary.timestamps.length < 3) {
        logger.warning('Summary has fewer than 3 timestamps', {
          videoId: transcript.video_id,
          count: summary.timestamps.length,
        });
      }

      logger.info('Summary generated successfully', { videoId: transcript.video_id });
      return summary;
    } catch (error: any) {
      logger.error('Failed to generate summary', error as Error, { videoId: transcript.video_id });
      
      // Handle specific OpenAI errors
      if (error.code === 'rate_limit_exceeded') {
        throw new SummaryGenerationError(
          'Service temporarily busy. Please try again in a moment.',
          'RATE_LIMIT'
        );
      }

      if (error.code === 'context_length_exceeded') {
        throw new SummaryGenerationError(
          'This video is too long to summarize. Please try a shorter video.',
          'CONTEXT_TOO_LONG'
        );
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        throw new SummaryGenerationError(
          'Failed to generate summary. Please try again.',
          'PARSE_ERROR'
        );
      }

      // Generic error
      throw new SummaryGenerationError(
        'An error occurred while generating the summary. Please try again later.',
        'GENERATION_FAILED'
      );
    }
  }

  /**
   * Checks if a video is considered long (>3 hours)
   * @param transcript - Transcript object
   * @returns true if video exceeds 3 hours
   */
  isLongVideo(transcript: Transcript): boolean {
    return transcript.duration > this.LONG_VIDEO_THRESHOLD;
  }

  private buildPrompt(transcript: Transcript, language: string): string {
    const languageInstruction = language === 'en' 
      ? '' 
      : `\n\nProvide the summary in ${this.getLanguageName(language)}.`;

    return `Given the following video transcript, generate a structured summary:

Title: ${transcript.title}
Transcript: ${transcript.text}

Provide:
1. Exactly 5 key points (each max 100 characters)
2. At least 3 important timestamps with descriptions
3. One core takeaway (single sentence)

Format as JSON: {"key_points": [], "timestamps": [{"time": "", "description": ""}], "core_takeaway": ""}${languageInstruction}`;
  }

  private getLanguageName(code: string): string {
    const languages: Record<string, string> = {
      en: 'English',
      hi: 'Hindi',
      ta: 'Tamil',
      te: 'Telugu',
      kn: 'Kannada',
      mr: 'Marathi',
    };
    return languages[code] || 'English';
  }

  formatSummary(summary: Summary): string {
    let formatted = `🎥 ${summary.title}\n\n`;
    
    formatted += '📌 Key Points:\n';
    summary.key_points.forEach((point, index) => {
      formatted += `${index + 1}. ${point}\n`;
    });
    
    formatted += '\n⏱ Important Timestamps:\n';
    summary.timestamps.forEach((ts) => {
      formatted += `• ${ts.time} - ${ts.description}\n`;
    });
    
    formatted += `\n🧠 Core Takeaway:\n${summary.core_takeaway}`;
    
    return formatted;
  }
}
