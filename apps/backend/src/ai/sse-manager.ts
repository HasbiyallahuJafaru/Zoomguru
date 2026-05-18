import { ServerResponse } from 'http';

/**
 * Manages active SSE connections.
 * Prevents memory leaks by cleaning up on client disconnect.
 * Ensures one active stream per user at a time.
 */
export class SSEManager {
  private connections = new Map<string, ServerResponse>();

  /**
   * Register a new SSE connection for a user.
   * Closes any existing connection for the same user first.
   */
  add(userId: string, res: ServerResponse): void {
    // Close existing connection if user reconnects
    const existing = this.connections.get(userId);
    if (existing && !existing.writableEnded) {
      existing.end();
    }
    this.connections.set(userId, res);

    // Auto-cleanup when client disconnects
    res.on('close', () => {
      if (this.connections.get(userId) === res) {
        this.connections.delete(userId);
      }
    });
  }

  /**
   * Remove a connection manually after stream ends.
   */
  remove(userId: string): void {
    this.connections.delete(userId);
  }

  /**
   * Total active SSE connections.
   */
  get size(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const sseManager = new SSEManager();
