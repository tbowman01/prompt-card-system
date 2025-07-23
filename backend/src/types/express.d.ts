import { Session } from 'express-session';

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      role: string;
      permissions: string[];
    }

    interface Request {
      session?: Session & {
        sessionID?: string;
        [key: string]: any;
      };
      sessionID?: string;
      user?: User;
      userId?: string;
      files?: any;
    }
  }
}

export {};