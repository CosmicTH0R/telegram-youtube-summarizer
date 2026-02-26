import TelegramBot from 'node-telegram-bot-api';
import { config, validateConfig } from './config';
import { logger } from './utils/logger';

// Validate configuration
try {
  validateConfig();
} catch (error) {
  logger.critical('Configuration validation failed', error as Error);
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(config.telegram.botToken, { polling: true });

logger.info('🤖 Telegram YouTube Summarizer Bot is starting...');

// Handle /start command
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  logger.info('User started bot', { userId: msg.from?.id, chatId });
  const welcomeMessage = `
🎥 *Welcome to YouTube Summarizer Bot!*

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

Just send me a YouTube link to get started! 🚀
  `;
  
  bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'Markdown' });
});

// Handle /help command
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  logger.info('User requested help', { userId: msg.from?.id, chatId });
  const helpMessage = `
📚 *Help - YouTube Summarizer Bot*

*Basic Usage:*
1. Send any YouTube link (youtube.com or youtu.be)
2. Wait for the structured summary
3. Ask questions about the video content

*Commands:*
/start - Welcome message
/help - This help message
/summary - Get summary of current video
/actionpoints - Extract action items
/clear - Clear your session

*Language Support:*
Request summaries in your language:
• "Summarize in Hindi"
• "Explain in Tamil"
• "हिंदी में बताओ"

*Examples:*
• Send: https://youtube.com/watch?v=xxxxx
• Ask: "What did he say about pricing?"
• Request: "Summarize in Hindi"

*Tips:*
✓ Works with any public YouTube video
✓ Handles long videos (may take a few minutes)
✓ Maintains context for follow-up questions
✓ Session expires after 24 hours of inactivity

Need help? Just send me a YouTube link! 🎬
  `;
  
  bot.sendMessage(chatId, helpMessage, { parse_mode: 'Markdown' });
});

// Handle all other messages
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || '';
  
  // Skip if it's a command (already handled)
  if (text.startsWith('/')) {
    return;
  }
  
  // Placeholder response for now
  bot.sendMessage(
    chatId,
    '🚧 Bot is under development. Core features coming soon!\n\nFor now, try /start or /help commands.'
  );
});

// Error handling
bot.on('polling_error', (error) => {
  logger.error('Polling error occurred', error as Error);
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down bot...');
  bot.stopPolling();
  process.exit(0);
});

logger.info('✅ Bot is running and ready to receive messages!');
