import { randomBytes } from "node:crypto";
import type { TokenGenerator } from "../../application/contracts/auth.contracts.js";

export class CryptoTokenGenerator implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString("base64url");
  }
}
