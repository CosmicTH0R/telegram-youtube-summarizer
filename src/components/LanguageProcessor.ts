import { Summary } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config';
import { getAIProvider, AIProvider } from '../utils/aiProvider';

export class LanguageProcessor {
  private aiProvider: AIProvider;

  // Language detection patterns
  private languagePatterns: Record<string, RegExp[]> = {
    hi: [
      /\bin\s+hindi\b/i,
      /\bhindi\s+mein\b/i,
      /हिंदी\s+में/,
      /हिन्दी/,
    ],
    ta: [
      /\bin\s+tamil\b/i,
      /\btamil\s+la\b/i,
      /தமிழில்/,
      /தமிழ்/,
    ],
    te: [
      /\bin\s+telugu\b/i,
      /\btelugu\s+lo\b/i,
      /తెలుగులో/,
      /తెలుగు/,
    ],
    kn: [
      /\bin\s+kannada\b/i,
      /\bkannada\s+alli\b/i,
      /ಕನ್ನಡದಲ್ಲಿ/,
      /ಕನ್ನಡ/,
    ],
    mr: [
      /\bin\s+marathi\b/i,
      /\bmarathi\s+madhe\b/i,
      /मराठीत/,
      /मराठी/,
    ],
  };

  private languageNames: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    kn: 'Kannada',
    mr: 'Marathi',
  };

  constructor() {
    this.aiProvider = getAIProvider();
  }

  detectLanguageRequest(message: string): string | null {
    logger.info('Detecting language request', { message: message.substring(0, 50) });

    for (const [langCode, patterns] of Object.entries(this.languagePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(message)) {
          logger.info('Language detected', { language: langCode });
          return langCode;
        }
      }
    }

    return null;
  }

  async translateSummary(summary: Summary, targetLanguage: string): Promise<Summary> {
    if (targetLanguage === 'en') {
      return summary; // Already in English
    }

    logger.info('Translating summary', { targetLanguage });

    try {
      // Translate key points
      const keyPointsText = summary.key_points.join('\n');
      const translatedKeyPoints = await this.translate(keyPointsText, targetLanguage);
      const keyPointsArray = translatedKeyPoints.split('\n').filter((p) => p.trim());

      // Translate timestamps descriptions
      const timestampsText = summary.timestamps.map((ts) => ts.description).join('\n');
      const translatedTimestamps = await this.translate(timestampsText, targetLanguage);
      const timestampsArray = translatedTimestamps.split('\n').filter((d) => d.trim());

      // Translate core takeaway
      const translatedTakeaway = await this.translate(summary.core_takeaway, targetLanguage);

      // Translate title
      const translatedTitle = await this.translate(summary.title, targetLanguage);

      const translatedSummary: Summary = {
        title: translatedTitle,
        key_points: keyPointsArray.slice(0, 5), // Ensure we have exactly 5
        timestamps: summary.timestamps.map((ts, index) => ({
          time: ts.time, // Keep time as is
          description: timestampsArray[index] || ts.description,
        })),
        core_takeaway: translatedTakeaway,
      };

      logger.info('Summary translated successfully', { targetLanguage });
      return translatedSummary;
    } catch (error) {
      logger.error('Failed to translate summary', error as Error, { targetLanguage });
      throw error;
    }
  }

  async translateAnswer(answer: string, targetLanguage: string): Promise<string> {
    if (targetLanguage === 'en') {
      return answer; // Already in English
    }

    logger.info('Translating answer', { targetLanguage });

    try {
      const translated = await this.translate(answer, targetLanguage);
      logger.info('Answer translated successfully', { targetLanguage });
      return translated;
    } catch (error) {
      logger.error('Failed to translate answer', error as Error, { targetLanguage });
      throw error;
    }
  }

  private async translate(text: string, targetLanguage: string): Promise<string> {
    const languageName = this.languageNames[targetLanguage] || targetLanguage;

    const systemPrompt = 'You are a professional translator. Translate accurately while preserving formatting. Respond with JSON format: {"translation": "translated text"}';
    const userPrompt = `Translate the following text to ${languageName}. Maintain the structure and formatting:

${text}

Provide only the translation in JSON format.`;

    const response = await this.aiProvider.generateCompletion(systemPrompt, userPrompt, 0.3);
    
    // Parse response
    let translated: string;
    try {
      const parsed = JSON.parse(response.content);
      translated = parsed.translation || response.content;
    } catch {
      // If not JSON, use the content directly
      translated = response.content;
    }
    
    return translated.trim() || text;
  }

  getSupportedLanguages(): string[] {
    return Object.keys(this.languageNames);
  }

  getLanguageName(code: string): string {
    return this.languageNames[code] || 'Unknown';
  }
}
