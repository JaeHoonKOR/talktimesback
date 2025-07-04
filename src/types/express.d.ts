import 'express';

declare global {
  namespace Express {
    interface Request {
      user?: User | {
        id: number;
        email?: string;
        name?: string;
      };
      userLanguage?: string;
    }
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    userLanguage?: string;
  }
} 