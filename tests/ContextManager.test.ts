import { ContextManager } from '../src/components/ContextManager';
import { Transcript } from '../src/models';

describe('ContextManager - Unit Tests', () => {
  let contextManager: ContextManager;
  let mockTranscript: Transcript;

  beforeEach(() => {
    contextManager = new ContextManager();
    mockTranscript = {
      video_id: 'test123',
      title: 'Test Video',
      text: 'This is a test transcript',
      language: 'en',
      duration: 300,
      fetched_at: new Date()
    };
  });

  afterEach(() => {
    contextManager.stopCleanupTask();
  });

  describe('createSession', () => {
    it('should create a new session for a user', async () => {
      const session = await contextManager.createSession('user1', 'video1', mockTranscript);

      expect(session).toBeDefined();
      expect(session.user_id).toBe('user1');
      expect(session.video_id).toBe('video1');
      expect(session.transcript).toBe(mockTranscript);
      expect(session.history).toEqual([]);
      expect(session.language).toBe('en');
    });

    it('should replace existing session when creating new one for same user', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      
      const newTranscript = { ...mockTranscript, video_id: 'video2' };
      const newSession = await contextManager.createSession('user1', 'video2', newTranscript);

      expect(newSession.video_id).toBe('video2');
      
      const retrievedSession = await contextManager.getSession('user1');
      expect(retrievedSession?.video_id).toBe('video2');
    });
  });

  describe('getSession', () => {
    it('should retrieve an existing session', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      
      const session = await contextManager.getSession('user1');
      
      expect(session).toBeDefined();
      expect(session?.user_id).toBe('user1');
    });

    it('should return null for non-existent session', async () => {
      const session = await contextManager.getSession('nonexistent');
      
      expect(session).toBeNull();
    });
  });

  describe('updateHistory', () => {
    it('should add Q&A pair to session history', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      
      await contextManager.updateHistory('user1', 'What is this about?', 'This is a test video');
      
      const session = await contextManager.getSession('user1');
      expect(session?.history).toHaveLength(1);
      expect(session?.history[0].question).toBe('What is this about?');
      expect(session?.history[0].answer).toBe('This is a test video');
    });

    it('should limit history to max 5 Q&A pairs', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      
      // Add 7 Q&A pairs
      for (let i = 1; i <= 7; i++) {
        await contextManager.updateHistory('user1', `Question ${i}`, `Answer ${i}`);
      }
      
      const session = await contextManager.getSession('user1');
      expect(session?.history).toHaveLength(5);
      expect(session?.history[0].question).toBe('Question 3'); // First 2 should be removed
      expect(session?.history[4].question).toBe('Question 7');
    });
  });

  describe('clearSession', () => {
    it('should remove a user session', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      
      await contextManager.clearSession('user1');
      
      const session = await contextManager.getSession('user1');
      expect(session).toBeNull();
    });
  });

  describe('getCachedTranscript', () => {
    it('should return cached transcript if available', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      
      const cached = contextManager.getCachedTranscript('video1');
      
      expect(cached).toBeDefined();
      expect(cached?.video_id).toBe('test123');
    });

    it('should return null for non-cached transcript', () => {
      const cached = contextManager.getCachedTranscript('nonexistent');
      
      expect(cached).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await contextManager.createSession('user1', 'video1', mockTranscript);
      await contextManager.createSession('user2', 'video2', { ...mockTranscript, video_id: 'video2' });
      
      const stats = contextManager.getStats();
      
      expect(stats.activeSessions).toBe(2);
      expect(stats.cachedTranscripts).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('ContextManager - Property-Based Tests', () => {
  let contextManager: ContextManager;

  beforeEach(() => {
    contextManager = new ContextManager();
  });

  afterEach(() => {
    contextManager.stopCleanupTask();
  });

  /**
   * Property 15: Session creation
   * For any user sending a YouTube link, a new session should be created
   * Feature: telegram-youtube-summarizer, Property 15: Session creation
   * Validates: Requirements 7.1
   */
  it('Property 15: should create session for any user and video combination', async () => {
    const testCases = [
      { userId: 'user1', videoId: 'video1' },
      { userId: 'user2', videoId: 'video2' },
      { userId: 'user3', videoId: 'video3' },
      { userId: 'user_with_special_chars_123', videoId: 'dQw4w9WgXcQ' }
    ];

    for (const { userId, videoId } of testCases) {
      const transcript: Transcript = {
        video_id: videoId,
        title: `Video ${videoId}`,
        text: 'Test transcript',
        language: 'en',
        duration: 300,
        fetched_at: new Date()
      };

      const session = await contextManager.createSession(userId, videoId, transcript);

      expect(session).toBeDefined();
      expect(session.user_id).toBe(userId);
      expect(session.video_id).toBe(videoId);
      expect(session.transcript.video_id).toBe(videoId);
    }
  });

  /**
   * Property 16: Session replacement
   * For any user with an existing session who sends a new YouTube link,
   * the old session should be replaced
   * Feature: telegram-youtube-summarizer, Property 16: Session replacement
   * Validates: Requirements 7.3
   */
  it('Property 16: should replace old session with new one for same user', async () => {
    const userId = 'user1';
    const videos = ['video1', 'video2', 'video3'];

    for (const videoId of videos) {
      const transcript: Transcript = {
        video_id: videoId,
        title: `Video ${videoId}`,
        text: 'Test transcript',
        language: 'en',
        duration: 300,
        fetched_at: new Date()
      };

      await contextManager.createSession(userId, videoId, transcript);
      
      const session = await contextManager.getSession(userId);
      expect(session?.video_id).toBe(videoId);
    }

    // Final session should be for video3
    const finalSession = await contextManager.getSession(userId);
    expect(finalSession?.video_id).toBe('video3');
  });

  /**
   * Property 3: Session independence
   * For any set of users, each user's session should remain isolated
   * Feature: telegram-youtube-summarizer, Property 3: Session independence
   * Validates: Requirements 1.4, 7.4
   */
  it('Property 3: should maintain independent sessions for multiple users', async () => {
    const users = ['user1', 'user2', 'user3', 'user4', 'user5'];
    
    // Create sessions for all users
    for (let i = 0; i < users.length; i++) {
      const transcript: Transcript = {
        video_id: `video${i}`,
        title: `Video ${i}`,
        text: `Transcript for user ${users[i]}`,
        language: 'en',
        duration: 300,
        fetched_at: new Date()
      };

      await contextManager.createSession(users[i], `video${i}`, transcript);
    }

    // Verify each user has their own session
    for (let i = 0; i < users.length; i++) {
      const session = await contextManager.getSession(users[i]);
      
      expect(session).toBeDefined();
      expect(session?.user_id).toBe(users[i]);
      expect(session?.video_id).toBe(`video${i}`);
      expect(session?.transcript.text).toBe(`Transcript for user ${users[i]}`);
    }

    // Update history for one user
    await contextManager.updateHistory('user2', 'Test question', 'Test answer');
    
    // Verify other users' sessions are unaffected
    const user1Session = await contextManager.getSession('user1');
    const user3Session = await contextManager.getSession('user3');
    
    expect(user1Session?.history).toHaveLength(0);
    expect(user3Session?.history).toHaveLength(0);
    
    const user2Session = await contextManager.getSession('user2');
    expect(user2Session?.history).toHaveLength(1);
  });

  /**
   * Property 21: Transcript caching
   * For any video requested by multiple users, transcript should be cached
   * Feature: telegram-youtube-summarizer, Property 21: Transcript caching
   * Validates: Requirements 9.5
   */
  it('Property 21: should cache transcripts for reuse across users', async () => {
    const videoId = 'shared_video';
    const transcript: Transcript = {
      video_id: videoId,
      title: 'Shared Video',
      text: 'Shared transcript content',
      language: 'en',
      duration: 300,
      fetched_at: new Date()
    };

    // Multiple users request the same video
    await contextManager.createSession('user1', videoId, transcript);
    await contextManager.createSession('user2', videoId, transcript);
    await contextManager.createSession('user3', videoId, transcript);

    // Transcript should be cached
    const cached = contextManager.getCachedTranscript(videoId);
    expect(cached).toBeDefined();
    expect(cached?.video_id).toBe(videoId);
    expect(cached?.text).toBe('Shared transcript content');
  });
});
