// Utility functions for parsing and handling @mentions in posts

/**
 * Extract all @mentions from a text string
 * @param {string} text - The text to parse
 * @returns {Array<string>} Array of unique usernames (without @ symbol)
 */
export const extractMentions = (text) => {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match @username pattern (alphanumeric, underscore, dot, hyphen)
  // Username must start with alphanumeric character
  const mentionRegex = /@([a-zA-Z0-9][a-zA-Z0-9_.-]*)/g;
  const matches = text.match(mentionRegex);
  
  if (!matches) {
    return [];
  }

  // Extract usernames (remove @ symbol) and remove duplicates
  const usernames = matches.map(match => match.substring(1).toLowerCase());
  return [...new Set(usernames)]; // Return unique usernames
};

/**
 * Parse text with mentions and return segments for rendering
 * @param {string} text - The text to parse
 * @returns {Array<{type: 'text'|'mention', content: string, username?: string}>}
 */
export const parseMentions = (text) => {
  if (!text || typeof text !== 'string') {
    return [{ type: 'text', content: text || '' }];
  }

  const segments = [];
  const mentionRegex = /@([a-zA-Z0-9][a-zA-Z0-9_.]*)/g;
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index),
      });
    }

    // Add the mention
    const username = match[1];
    segments.push({
      type: 'mention',
      content: match[0], // Full match including @
      username: username.toLowerCase(),
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last mention
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex),
    });
  }

  // If no mentions found, return the whole text as a single segment
  if (segments.length === 0) {
    segments.push({ type: 'text', content: text });
  }

  return segments;
};

