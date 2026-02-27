import TelegramBot from 'node-telegram-bot-api';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';
import { TranscriptFetcher } from './components/TranscriptFetcher';
import { ContextManager } from './components/ContextManager';
import { Summarizer } from './components/Summarizer';
import { QAEngine } from './components/QAEngine';
import { LanguageProcessor } from './components/LanguageProcessor';
import { MessageRouter } from './components/MessageRouter';
import { CommandHandler } from './components/CommandHandler';
import { SessionState } from './models';
import { handleError } from './utils/errorHandler';

// Validate configuration
try {
  validateConfig();
} catch (error) {
  logger.critical('Configuration validation failed', error as Error);
  process.exit(1);
}

// Initialize all components
logger.info('🤖 Telegram YouTube Summarizer Bot is starting...');
logger.info('Initializing components...');

const transcriptFetcher = new TranscriptFetcher();
const contextManager = new ContextManager();
const summarizer = new Summarizer();
const qaEngine = new QAEngine();
const languageProcessor = new LanguageProcessor();
const messageRouter = new MessageRouter();
const commandHandler = new CommandHandler(contextManager, summarizer);

logger.info('✅ All components initialized successfully');

// Create bot instance
const bot = new TelegramBot(config.telegram.botToken, { polling: true });

/**
 * Main message handler - routes all incoming messages
 */
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id.toString() || chatId.toString();
  const text = msg.text || '';

  logger.info('Received message', { userId, chatId, messageLength: text.length });

  try {
    // Get current session state
    const session = await contextManager.getSession(userId);
    const isExpired = session ? Date.now() - session.last_accessed.getTime() > 24 * 60 * 60 * 1000 : false;
    const sessionState = messageRouter.getSessionState(!!session, isExpired);

    // Route the message
    const route = messageRouter.routeMessage(userId, text, sessionState);

    switch (route.type) {
      case 'command':
        await handleCommand(userId, chatId, route.command!, route.message!);
        break;

      case 'youtube_url':
        await handleYouTubeUrl(userId, chatId, route.videoId!);
        break;

      case 'question':
        await handleQuestion(userId, chatId, route.question!);
        break;

      case 'usage_instructions':
        await bot.sendMessage(chatId, route.message!);
        break;

      case 'no_session_error':
        await bot.sendMessage(chatId, route.message!);
        break;

      default:
        await bot.sendMessage(chatId, 'Sorry, I did not understand that. Try /help for usage instructions.');
    }
  } catch (error: any) {
    logger.error('Error handling message', error, { userId, chatId });
    const errorMessage = handleError(error);
    await bot.sendMessage(chatId, errorMessage);
  }
});

/**
 * Handle bot commands
 */
async function handleCommand(userId: string, chatId: number, command: string, fullMessage: string): Promise<void> {
  logger.info('Handling command', { userId, command });

  try {
    let response: string;

    switch (command) {
      case 'start':
        response = getWelcomeMessage();
        break;

      case 'help':
        response = commandHandler.handleHelpCommand();
        break;

      case 'summary':
        response = await commandHandler.handleSummaryCommand(userId);
        break;

      case 'actionpoints':
        response = await commandHandler.handleActionPointsCommand(userId);
        break;

      case 'clear':
        response = await commandHandler.handleClearCommand(userId);
        break;

      default:
        response = `Unknown command: /${command}\n\nTry /help for available commands.`;
    }

    await bot.sendMessage(chatId, response);
  } catch (error: any) {
    logger.error('Error handling command', error, { userId, command });
    const errorMessage = handleError(error);
    await bot.sendMessage(chatId, errorMessage);
  }
}

/**
 * Handle YouTube URL - fetch transcript and generate summary
 */
async function handleYouTubeUrl(userId: string, chatId: number, videoId: string): Promise<void> {
  logger.info('Handling YouTube URL', { userId, videoId });

  try {
    // Send processing message
    await bot.sendMessage(chatId, '⏳ Processing video... This may take a moment.');

    // Fetch transcript
    const transcript = await transcriptFetcher.fetchTranscript(videoId);
    logger.info('Transcript fetched successfully', { userId, videoId, length: transcript.text.length });

    // Detect language preference from previous messages or default to English
    const session = await contextManager.getSession(userId);
    const language = session?.language || 'en';

    // Create or update session
    await contextManager.createSession(userId, videoId, transcript);
    logger.info('Session created', { userId, videoId, language });

    // Generate summary
    const summary = await summarizer.generateSummary(transcript, language);
    const formattedSummary = summarizer.formatSummary(summary);
    logger.info('Summary generated', { userId, videoId });

    // Send summary to user
    await bot.sendMessage(chatId, formattedSummary);
    await bot.sendMessage(
      chatId,
      '💬 You can now ask questions about this video, or send /summary to see the summary again.'
    );
  } catch (error: any) {
    logger.error('Error handling YouTube URL', error, { userId, videoId });
    const errorMessage = handleError(error);
    await bot.sendMessage(chatId, errorMessage);
  }
}

/**
 * Handle user question about current video
 */
async function handleQuestion(userId: string, chatId: number, question: string): Promise<void> {
  logger.info('Handling question', { userId, questionLength: question.length });

  try {
    // Get session
    const session = await contextManager.getSession(userId);
    if (!session) {
      await bot.sendMessage(chatId, 'No active session. Please send a YouTube link first.');
      return;
    }

    // Detect language in question
    const detectedLanguage = languageProcessor.detectLanguageRequest(question);
    if (detectedLanguage) {
      logger.info('Language detected in question', { userId, language: detectedLanguage });
      session.language = detectedLanguage;
    }

    // Send typing indicator
    await bot.sendChatAction(chatId, 'typing');

    // Answer question
    const answer = await qaEngine.answerQuestion(
      question,
      session.transcript,
      session.history
    );
    logger.info('Answer generated', { userId, answerLength: answer.length });

    // Translate answer if needed
    let finalAnswer = answer;
    if (session.language !== 'en') {
      finalAnswer = await languageProcessor.translateAnswer(answer, session.language);
      logger.info('Answer translated', { userId, language: session.language });
    }

    // Update conversation history
    await contextManager.updateHistory(userId, question, finalAnswer);

    // Send answer to user
    await bot.sendMessage(chatId, finalAnswer);
  } catch (error: any) {
    logger.error('Error handling question', error, { userId });
    const errorMessage = handleError(error);
    await bot.sendMessage(chatId, errorMessage);
  }
}

/**
 * Get welcome message for /start command
 */
function getWelcomeMessage(): string {
  return `🎥 *Welcome to YouTube Summarizer Bot!*

I can help you understand YouTube videos quickly by providing:
• Structured summaries with key points
• Important timestamps
• Q&A about video content
• Multi-language support

*How to use:*
1️⃣ Send me a YouTube link
2️⃣ Get an instant summary
3️⃣ Ask questions about the video

*Available commands:*
/start - Show this welcome message
/help - Display detailed help
/summary - Get summary of current video
/actionpoints - Extract actionable items
/clear - Clear current session

*Supported languages:*
English, Hindi, Tamil, Telugu, Kannada, Marathi

Just send me a YouTube link to get started! 🚀`;
}

// Error handling
bot.on('polling_error', (error) => {
  logger.error('Polling error occurred', error as Error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down bot...');
  contextManager.stopCleanupTask();
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down bot...');
  contextManager.stopCleanupTask();
  bot.stopPolling();
  process.exit(0);
});

logger.info('✅ Bot is running and ready to receive messages!');
