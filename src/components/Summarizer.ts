import OpenAI from 'openai';
import { Transcript, Summary } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config';

export class Summarizer {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async generateSummary(transcript: Transcript, language: string = 'en'): Promise<Summary> {
    logger.info('Generating summary', { videoId: transcript.video_id, language });

    try {
      const prompt = this.buildPrompt(transcript, language);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that creates structured summaries of video transcripts. Always respond with valid JSON.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const parsed = JSON.parse(content);
      
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
    } catch (error) {
      logger.error('Failed to generate summary', error as Error, { videoId: transcript.video_id });
      throw error;
    }
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
