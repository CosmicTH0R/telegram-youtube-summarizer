import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';
import { logger } from './logger';

export interface AIResponse {
  content: string;
}

export interface AIProvider {
  generateCompletion(systemPrompt: string, userPrompt: string, temperature?: number): Promise<AIResponse>;
}

class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async generateCompletion(systemPrompt: string, userPrompt: string, temperature: number = 0.3): Promise<AIResponse> {
    const response = await this.client.chat.completions.create({
      model: config.openai.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error('Empty response from OpenAI');
    }

    return { content };
  }
}

class GeminiProvider implements AIProvider {
  private client: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async generateCompletion(systemPrompt: string, userPrompt: string, temperature: number = 0.3): Promise<AIResponse> {
    const model = this.client.getGenerativeModel({ 
      model: config.gemini.model,
      generationConfig: {
        temperature,
        responseMimeType: 'application/json',
      },
    });

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error('Empty response from Gemini');
    }

    return { content };
  }
}

/**
 * Get AI provider with fallback support
 * Tries OpenAI first, falls back to Gemini if OpenAI is not available
 */
export function getAIProvider(): AIProvider {
  // Try OpenAI first
  if (config.openai.apiKey) {
    logger.info('Using OpenAI as AI provider');
    return new OpenAIProvider(config.openai.apiKey);
  }

  // Fallback to Gemini
  if (config.gemini.apiKey) {
    logger.info('Using Gemini as AI provider (OpenAI not available)');
    return new GeminiProvider(config.gemini.apiKey);
  }

  throw new Error('No AI provider configured. Please set OPENAI_API_KEY or GEMINI_API_KEY');
}
