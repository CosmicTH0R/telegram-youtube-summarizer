import { ContextManager } from './ContextManager';
import { Summarizer } from './Summarizer';
import { logger } from '../utils/logger';
import { getAIProvider, AIProvider } from '../utils/aiProvider';

export class CommandHandler {
  private aiProvider: AIProvider;

  constructor(
    private contextManager: ContextManager,
    private summarizer: Summarizer
  ) {
    this.aiProvider = getAIProvider();
  }

  /**
   * Handle /summary command
   * Returns structured summary for active session
   */
  async handleSummaryCommand(userId: string): Promise<string> {
    logger.info('Handling /summary command', { userId });

    const session = await this.contextManager.getSession(userId);
    if (!session) {
      return 'No active session. Please send a YouTube link first.';
    }

    try {
      const summary = await this.summarizer.generateSummary(
        session.transcript,
        session.language
      );
      return this.summarizer.formatSummary(summary);
    } catch (error: any) {
      logger.error('Failed to generate summary', error, { userId });
      throw error;
    }
  }

  /**
   * Handle /actionpoints command
   * Extracts actionable items from transcript
   */
  async handleActionPointsCommand(userId: string): Promise<string> {
    logger.info('Handling /actionpoints command', { userId });

    const session = await this.contextManager.getSession(userId);
    if (!session) {
      return 'No active session. Please send a YouTube link first.';
    }

    try {
      const actionPoints = await this.extractActionPoints(
        session.transcript.text,
        session.language
      );
      return this.formatActionPoints(actionPoints);
    } catch (error: any) {
      logger.error('Failed to extract action points', error, { userId });
      throw error;
    }
  }

  /**
   * Handle /clear command
   * Clears user's current session
   */
  async handleClearCommand(userId: string): Promise<string> {
    logger.info('Handling /clear command', { userId });

    const session = await this.contextManager.getSession(userId);
    if (!session) {
      return 'No active session to clear.';
    }

    await this.contextManager.clearSession(userId);
    return 'Session cleared successfully. Send a new YouTube link to start over.';
  }

  /**
   * Handle /help command
   * Returns usage instructions
   */
  handleHelpCommand(): string {
    logger.info('Handling /help command');

    return `🤖 YouTube Summarizer & Q&A Bot

📝 How to use:
1. Send a YouTube link to get started
2. Ask questions about the video
3. Request summaries in different languages

🎯 Available Commands:
/summary - Get structured summary of current video
/actionpoints - Extract actionable items from video
/clear - Clear current session and start over
/help - Show this help message

🌍 Language Support:
Request summaries in: English, Hindi, Tamil, Telugu, Kannada, Marathi
Example: "Summarize in Hindi" or "हिंदी में बताओ"

💡 Tips:
• You can ask follow-up questions
• The bot remembers your conversation context
• Sessions expire after 24 hours of inactivity`;
  }

  /**
   * Extract actionable items from transcript using AI
   */
  private async extractActionPoints(
    transcript: string,
    language: string
  ): Promise<string[]> {
    const systemPrompt = 'You are a helpful assistant that extracts actionable items from video transcripts. Always respond with valid JSON.';
    const userPrompt = `Extract actionable items from this video transcript. Return a JSON array of strings, each representing a concrete action or recommendation.

Rules:
- Each action should be specific and implementable
- Maximum 10 action points
- Each point should be 1-2 sentences
- Focus on practical takeaways
- Return empty array if no actionable items found

Transcript:
${transcript.substring(0, 8000)}

Return only valid JSON array of strings.`;

    const response = await this.aiProvider.generateCompletion(systemPrompt, userPrompt, 0.3);
    
    try {
      const actionPoints = JSON.parse(response.content);
      return Array.isArray(actionPoints) ? actionPoints : [];
    } catch {
      logger.info('Failed to parse action points JSON', { content: response.content });
      return [];
    }
  }

  /**
   * Format action points for display
   */
  private formatActionPoints(actionPoints: string[]): string {
    if (actionPoints.length === 0) {
      return '📋 No specific action points found in this video.';
    }

    const formatted = actionPoints
      .map((point, index) => `${index + 1}. ${point}`)
      .join('\n\n');

    return `📋 Action Points:\n\n${formatted}`;
  }
}
