// Data models for the Telegram YouTube Summarizer Bot

export interface Transcript {
  video_id: string;
  title: string;
  text: string;
  language: string;
  duration: number; // seconds
  fetched_at: Date;
}

export interface Timestamp {
  time: string; // format: "MM:SS" or "HH:MM:SS"
  description: string; // max 150 characters
}

export interface Summary {
  title: string;
  key_points: string[]; // length = 5
  timestamps: Timestamp[]; // length >= 3
  core_takeaway: string;
}

export interface Chunk {
  text: string;
  start_time: string;
  end_time: string;
  index: number;
}

export interface QAPair {
  question: string;
  answer: string;
  timestamp: Date;
}

export interface Session {
  user_id: string;
  video_id: string;
  transcript: Transcript;
  chunks: Chunk[];
  history: QAPair[];
  language: string;
  created_at: Date;
  last_accessed: Date;
}

export enum SessionState {
  NO_SESSION = 'NO_SESSION',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED'
}

export interface BotResponse {
  message: string;
  success: boolean;
  error?: string;
}
