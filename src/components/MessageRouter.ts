import { SessionState } from '../models';
import { extractVideoId, isYouTubeUrl } from '../utils/urlParser';
import { logger } from '../utils/logger';

export interface RouteResult {
  type: 'youtube_url' | 'question' | 'command' | 'usage_instructions' | 'no_session_error';
  videoId?: string;
  question?: string;
  command?: string;
  message?: string;
}

export class MessageRouter {
  routeMessage(userId: string, message: string, sessionState: SessionState): RouteResult {
    logger.info('Routing message', { userId, messageLength: message.length, sessionState });

    // Check if message is a command
    if (message.startsWith('/')) {
      const command = message.split(' ')[0].substring(1).toLowerCase();
      logger.info('Command detected', { userId, command });
      return {
        type: 'command',
        command,
        message,
      };
    }

    // Check if message contains YouTube URL
    if (isYouTubeUrl(message)) {
      const videoId = extractVideoId(message);
      if (videoId) {
        logger.info('YouTube URL detected', { userId, videoId });
        return {
          type: 'youtube_url',
          videoId,
        };
      }
    }

    // Check if user has an active session
    if (sessionState === SessionState.ACTIVE) {
      // Treat as a question about the current video
      logger.info('Question detected', { userId });
      return {
        type: 'question',
        question: message,
      };
    }

    // No active session and not a YouTube URL
    if (sessionState === SessionState.NO_SESSION) {
      logger.info('No session, returning usage instructions', { userId });
      return {
        type: 'usage_instructions',
        message: this.getUsageInstructions(),
      };
    }

    // Session expired
    logger.info('Session expired', { userId });
    return {
      type: 'no_session_error',
      message: 'Your session has expired. Please send a YouTube link to start a new session.',
    };
  }

  isYouTubeUrl(message: string): boolean {
    return isYouTubeUrl(message);
  }

  getSessionState(hasSession: boolean, isExpired: boolean): SessionState {
    if (!hasSession) {
      return SessionState.NO_SESSION;
    }
    if (isExpired) {
      return SessionState.EXPIRED;
    }
    return SessionState.ACTIVE;
  }

  private getUsageInstructions(): string {
    return `Welcome to YouTube Summarizer Bot! 🎥

Here's how to use me:

1️⃣ Send a YouTube link to get a summary
2️⃣ Ask questions about the video
3️⃣ Request summaries in different languages (Hindi, Tamil, Telugu, Kannada, Marathi)

Commands:
/help - Show this help message
/summary - Get summary of current video
/clear - Clear current session

Example:
Send: https://youtube.com/watch?v=dQw4w9WgXcQ
Then ask: "What is the main topic?"
Or: "Summarize in Hindi"`;
  }

  getHelpMessage(): string {
    return this.getUsageInstructions();
  }
}
