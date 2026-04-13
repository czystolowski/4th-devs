/**
 * Session management - stores conversation history per sessionID
 */

// In-memory storage: sessionID -> messages array
const sessions = new Map();

/**
 * Get conversation history for a session
 */
export function getSession(sessionID) {
  if (!sessions.has(sessionID)) {
    sessions.set(sessionID, []);
  }
  return sessions.get(sessionID);
}

/**
 * Add a message to session history
 */
export function addMessage(sessionID, role, content) {
  const history = getSession(sessionID);
  history.push({ role, content });
  
  // Limit history to last 20 messages to avoid token limits
  if (history.length > 20) {
    history.splice(0, history.length - 20);
  }
}

/**
 * Clear a session (optional, for testing)
 */
export function clearSession(sessionID) {
  sessions.delete(sessionID);
}

/**
 * Get all active sessions (for debugging)
 */
export function getActiveSessions() {
  return Array.from(sessions.keys());
}

/**
 * Get session count
 */
export function getSessionCount() {
  return sessions.size;
}


