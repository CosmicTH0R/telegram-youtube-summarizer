// Configuration management
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
  session: {
    ttlHours: 24,
    cleanupIntervalHours: 1,
  },
  cache: {
    maxVideos: 1000,
    ttlDays: 7,
  },
  transcript: {
    maxRetries: 3,
    retryDelays: [1000, 2000, 4000], // milliseconds
    longTranscriptThreshold: 100000, // characters
  },
  summary: {
    longTranscriptTokens: 8000,
    keyPointsCount: 5,
    minTimestamps: 3,
  },
  qa: {
    chunkSize: 500, // words
    chunkOverlap: 50, // words
    maxRelevantChunks: 3,
    maxHistoryPairs: 5,
  },
};

// Validate required configuration
export function validateConfig(): void {
  const errors: string[] = [];

  if (!config.telegram.botToken) {
    errors.push('TELEGRAM_BOT_TOKEN is required');
  }

  // At least one AI provider must be configured
  if (!config.gemini.apiKey && !config.openai.apiKey) {
    errors.push('Either GEMINI_API_KEY or OPENAI_API_KEY is required');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`);
  }
}
