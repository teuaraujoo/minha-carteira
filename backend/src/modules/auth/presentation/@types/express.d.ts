import type { AuthenticatedContext } from "../../application/contracts/auth.contracts.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AuthenticatedContext;
    }
  }
}

export {};
