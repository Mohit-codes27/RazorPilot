export interface AuthenticatedUser {
  id: string;
  email: string;
  status: string;
}

export interface AuthenticatedMerchant {
  id: string;
  email: string;
  name: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      user?: AuthenticatedUser;
      merchant?: AuthenticatedMerchant;
      /** Raw request bytes, captured for webhook signature verification. */
      rawBody?: Buffer;
    }
  }
}

export {};
