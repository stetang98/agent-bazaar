import type { SettleResult } from "./x402/settle";

// Augment Express's Request so the paywall can attach the settlement result type-safely
// (no `as` casts in the middleware/handler).
declare global {
  namespace Express {
    interface Request {
      x402?: SettleResult;
    }
  }
}

export {};
