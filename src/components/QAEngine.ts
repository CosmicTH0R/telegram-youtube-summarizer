import OpenAI from 'openai';
import { Transcript, QA } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config';

interface Chunk {
  text: string;
  startIndex: number;
  endIndex: number;
}

export class QAEngine {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: config.openai.apiKey,
    });
  }

  async answerQuestion(
    question: string,
    transcript: Transcript,
    history: QA[] = []
  ): Promise<string> {
    logger.info('Answering question', { videoId: transcript.video_id, question });

    try {
      // Chunk the transcript
      const chunks = this.chunkTranscript(transcript.text);
      
      // Find relevant chunks
      const relevantChunks = this.findRelevantChunks(question, chunks);
      
      if (relevantChunks.length === 0) {
        logger.info('No relevant chunks found', { videoId: transcript.video_id });
        return 'This topic is not covered in the video.';
      }

      // Build context from relevant chunks
      const context = relevantChunks.map((chunk) => chunk.text).join('\n\n');
      
      // Build prompt
      const prompt = this.buildPrompt(question, context, history);
      
      // Get answer from OpenAI
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant that answers questions based on video transcripts. Only use information from the provided context.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      });

      const answer = response.choices[0].message.content || 'This topic is not covered in the video.';
      
      logger.info('Question answered', { videoId: transcript.video_id });
      return answer;
    } catch (error) {
      logger.error('Failed to answer question', error as Error, { videoId: transcript.video_id });
      throw error;
    }
  }

  chunkTranscript(text: string): Chunk[] {
    const words = text.split(/\s+/);
    const chunkSize = config.qa.chunkSize;
    const overlap = config.qa.chunkOverlap;
    const chunks: Chunk[] = [];

    let startIndex = 0;
    while (startIndex < words.length) {
      const endIndex = Math.min(startIndex + chunkSize, words.length);
      const chunkWords = words.slice(startIndex, endIndex);
      const chunkText = chunkWords.join(' ');

      chunks.push({
        text: chunkText,
        startIndex,
        endIndex,
      });

      // Move forward by (chunkSize - overlap) to create overlap
      startIndex += chunkSize - overlap;
      
      // Break if we've reached the end
      if (endIndex === words.length) {
        break;
      }
    }

    logger.info('Transcript chunked for Q&A', {
      totalWords: words.length,
      numChunks: chunks.length,
      chunkSize,
      overlap,
    });

    return chunks;
  }

  findRelevantChunks(question: string, chunks: Chunk[]): Chunk[] {
    // Simple keyword-based relevance scoring using TF-IDF-like approach
    const questionWords = this.extractKeywords(question.toLowerCase());
    
    if (questionWords.length === 0) {
      // If no keywords, return first few chunks
      return chunks.slice(0, config.qa.maxRelevantChunks);
    }

    // Score each chunk
    const scoredChunks = chunks.map((chunk) => {
      const chunkText = chunk.text.toLowerCase();
      let score = 0;

      questionWords.forEach((word) => {
        // Count occurrences of each keyword
        const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'g');
        const matches = chunkText.match(regex);
        if (matches) {
          score += matches.length;
        }
      });

      return { chunk, score };
    });

    // Sort by score descending
    scoredChunks.sort((a, b) => b.score - a.score);

    // Return top N chunks with score > 0
    const relevantChunks = scoredChunks
      .filter((sc) => sc.score > 0)
      .slice(0, config.qa.maxRelevantChunks)
      .map((sc) => sc.chunk);

    logger.info('Relevant chunks found', {
      totalChunks: chunks.length,
      relevantChunks: relevantChunks.length,
    });

    return relevantChunks;
  }

  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful keywords
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'in', 'on', 'at', 'to', 'for', 'of',
      'with', 'by', 'from', 'about', 'what', 'when', 'where', 'who', 'how',
      'why', 'which', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    return [...new Set(words)]; // Remove duplicates
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private buildPrompt(question: string, context: string, history: QA[]): string {
    let prompt = 'Context from video transcript:\n';
    prompt += context + '\n\n';

    if (history.length > 0) {
      prompt += 'Previous conversation:\n';
      // Keep only last N Q&A pairs
      const recentHistory = history.slice(-config.qa.maxHistoryPairs);
      recentHistory.forEach((qa) => {
        prompt += `Q: ${qa.question}\nA: ${qa.answer}\n\n`;
      });
    }

    prompt += `User question: ${question}\n\n`;
    prompt += 'Answer the question based ONLY on the provided context. ';
    prompt += 'If the information is not in the context, respond with "This topic is not covered in the video."';

    return prompt;
  }
}
