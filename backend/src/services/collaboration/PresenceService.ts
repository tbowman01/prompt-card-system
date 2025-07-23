import { UserPresence } from '../../types/collaboration';

// Placeholder PresenceService to fix import error

export class PresenceService {
  private presenceMap: Map<string, UserPresence> = new Map();
  
  constructor() {}
  
  async updatePresence(userId: string, documentId: string, status: string): Promise<void> {
    const presence: UserPresence = {
      userId,
      documentId,
      status: status as 'online' | 'offline' | 'away',
      lastSeen: new Date()
    };
    this.presenceMap.set(userId, presence);
  }
  
  async getActiveUsers(): Promise<string[]> {
    return Array.from(this.presenceMap.keys());
  }
  
  async getPresence(userId: string): Promise<UserPresence | null> {
    return this.presenceMap.get(userId) || null;
  }
}

export default PresenceService;