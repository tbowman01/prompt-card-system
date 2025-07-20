// Placeholder PresenceService to fix import error
export interface UserPresence {
  userId: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: Date;
  socketId?: string;
}

export class PresenceService {
  private presenceMap: Map<string, UserPresence> = new Map();
  
  constructor() {}
  
  async updatePresence(userId: string, status: string): Promise<void> {
    const presence: UserPresence = {
      userId,
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