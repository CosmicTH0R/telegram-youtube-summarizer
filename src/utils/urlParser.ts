// YouTube URL parser utility

/**
 * Extracts video ID from YouTube URLs
 * Supports formats:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://m.youtube.com/watch?v=VIDEO_ID
 * 
 * @param url - YouTube URL string
 * @returns Video ID (11 characters) or null if invalid
 */
export function extractVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Regex pattern to match YouTube URLs and extract video ID
  // Matches: youtube.com/watch?v=VIDEO_ID or youtu.be/VIDEO_ID
  // Uses word boundary or specific delimiters to ensure exactly 11 characters
  const patterns = [
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})(?:[&\s]|$)/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/,
    /(?:youtube\.com\/v\/)([a-zA-Z0-9_-]{11})(?:[?&\s]|$)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Validates if a string is a valid YouTube URL
 * @param url - URL string to validate
 * @returns true if valid YouTube URL, false otherwise
 */
export function isYouTubeUrl(url: string): boolean {
  const videoId = extractVideoId(url);
  return videoId !== null && videoId.length === 11;
}

/**
 * Validates if a string is a valid YouTube video ID
 * @param videoId - Video ID to validate
 * @returns true if valid video ID format (11 alphanumeric characters)
 */
export function isValidVideoId(videoId: string): boolean {
  if (!videoId || typeof videoId !== 'string') {
    return false;
  }
  
  const videoIdPattern = /^[a-zA-Z0-9_-]{11}$/;
  return videoIdPattern.test(videoId);
}
