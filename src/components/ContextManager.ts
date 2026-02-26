import { Session, Transcript, Chunk, QAPair } from '../models';
import { logger } from '../utils/logger';
import { config } from '../config';
import { Mutex } from 'async-mutex';

export class ContextManager {
  private sessions: Map<string, Session>;
  private transcriptCache: Map<string, Transcript>;
  private userLocks: Map<string, Mutex>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.sessions = new Map();
    this.transcriptCache = new Map();
    this.userLocks = new Map();
    this.cleanupInterval = null;
    
    // Start cleanup task
    this.startCleanupTask();
  }

  /**
   * Creates a new session for a user and video
   * @param userId - Telegram user ID
   * @param videoId - YouTube video ID
   * @param transcript - Video transcript
   * @returns Created session
   */
  async createSession(userId: string, videoId: string, transcript: Transcript): Promise<Session> {
    const lock = this.getUserLock(userId);
    
    return await lock.runExclusive(async () => {
      const now = new Date();
      
      const session: Session = {
        user_id: userId,
        video_id: videoId,
        transcript,
        chunks: [],
        history: [],
        language: 'en',
        created_at: now,
        last_accessed: now
      };

      this.sessions.set(userId, session);
      
      // Cache the transcript
      this.cacheTranscript(videoId, transcript);

      logger.info('Session created', { userId, videoId });
      
      return session;
    });
  }

  /**
   * Retrieves a user's session
   * @param userId - Telegram user ID
   * @returns Session or null if not found
   */
  async getSession(userId: string): Promise<Session | null> {
    const lock = this.getUserLock(userId);
    
    return await lock.runExclusive(async () => {
      const session = this.sessions.get(userId);
      
      if (!session) {
        return null;
      }

      // Update last accessed time
      session.last_accessed = new Date();
      
      return session;
    });
  }

  /**
   * Updates conversation history for a user's session
   * @param userId - Telegram user ID
   * @param question - User's question
   * @param answer - Bot's answer
   */
  async updateHistory(userId: string, question: string, answer: string): Promise<void> {
    const lock = this.getUserLock(userId);
    
    await lock.runExclusive(async () => {
      const session = this.sessions.get(userId);
      
      if (!session) {
        logger.warning('Attempted to update history for non-existent session', { userId });
        return;
      }

      const qaPair: QAPair = {
        question,
        answer,
        timestamp: new Date()
      };

      session.history.push(qaPair);
      
      // Keep only last 5 Q&A pairs as per config
      if (session.history.length > config.qa.maxHistoryPairs) {
        session.history = session.history.slice(-config.qa.maxHistoryPairs);
      }

      session.last_accessed = new Date();

      logger.info('History updated', { userId, historyLength: session.history.length });
    });
  }

  /**
   * Clears a user's session
   * @param userId - Telegram user ID
   */
  async clearSession(userId: string): Promise<void> {
    const lock = this.getUserLock(userId);
    
    await lock.runExclusive(async () => {
      const deleted = this.sessions.delete(userId);
      
      if (deleted) {
        logger.info('Session cleared', { userId });
      }
    });
  }

  /**
   * Caches a transcript for reuse
   * @param videoId - YouTube video ID
   * @param transcript - Video transcript
   */
  private cacheTranscript(videoId: string, transcript: Transcript): void {
    // Check cache size and implement LRU eviction
    if (this.transcriptCache.size >= config.cache.maxVideos) {
      // Remove oldest entry (first entry in Map)
      const firstKey = this.transcriptCache.keys().next().value;
      if (firstKey) {
        this.transcriptCache.delete(firstKey);
        logger.info('Transcript evicted from cache (LRU)', { videoId: firstKey });
      }
    }

    this.transcriptCache.set(videoId, transcript);
    logger.info('Transcript cached', { videoId, cacheSize: this.transcriptCache.size });
  }

  /**
   * Retrieves a cached transcript
   * @param videoId - YouTube video ID
   * @returns Cached transcript or null
   */
  getCachedTranscript(videoId: string): Transcript | null {
    const transcript = this.transcriptCache.get(videoId);
    
    if (transcript) {
      // Check if transcript is still valid (within TTL)
      const age = Date.now() - transcript.fetched_at.getTime();
      const ttl = config.cache.ttlDays * 24 * 60 * 60 * 1000; // Convert days to ms
      
      if (age > ttl) {
        // Transcript expired, remove from cache
        this.transcriptCache.delete(videoId);
        logger.info('Cached transcript expired', { videoId });
        return null;
      }

      logger.info('Transcript retrieved from cache', { videoId });
      return transcript;
    }

    return null;
  }

  /**
   * Gets or creates a mutex lock for a user
   * @param userId - Telegram user ID
   * @returns Mutex lock for the user
   */
  private getUserLock(userId: string): Mutex {
    let lock = this.userLocks.get(userId);
    
    if (!lock) {
      lock = new Mutex();
      this.userLocks.set(userId, lock);
    }

    return lock;
  }

  /**
   * Starts the background cleanup task
   */
  private startCleanupTask(): void {
    const intervalMs = config.session.cleanupIntervalHours * 60 * 60 * 1000;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, intervalMs);

    logger.info('Cleanup task started', { 
      intervalHours: config.session.cleanupIntervalHours 
    });
  }

  /**
   * Cleans up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const ttl = config.session.ttlHours * 60 * 60 * 1000; // Convert hours to ms
    let cleanedCount = 0;

    for (const [userId, session] of this.sessions.entries()) {
      const age = now - session.last_accessed.getTime();
      
      if (age > ttl) {
        this.sessions.delete(userId);
        this.userLocks.delete(userId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired sessions cleaned up', { 
        cleanedCount, 
        remainingSessions: this.sessions.size 
      });
    }
  }

  /**
   * Stops the cleanup task (for graceful shutdown)
   */
  stopCleanupTask(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Cleanup task stopped');
    }
  }

  /**
   * Gets statistics about the context manager
   */
  getStats(): { activeSessions: number; cachedTranscripts: number } {
    return {
      activeSessions: this.sessions.size,
      cachedTranscripts: this.transcriptCache.size
    };
  }
}
