import type { Role } from '@recruitflow/shared';

export interface AuthContext {
  userId: string;
  sessionId: string;
  companyId: string | null;
  role: Role;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
      requestId: string;
    }
  }
}

export {};
