import { createHash, timingSafeEqual } from "node:crypto";
import type { TokenHasher } from "../../application/contracts/auth.contracts.js";

export class Sha256TokenHasher implements TokenHasher {
  async hash(token: string): Promise<string> {
    if (typeof token !== "string" || !token) throw new TypeError("O token é obrigatório para calcular o hash.");
    return createHash("sha256").update(token, "utf8").digest("hex");
  }

  async matches(token: string, expectedHash: string): Promise<boolean> {
    if (typeof expectedHash !== "string" || !/^[a-f\d]{64}$/i.test(expectedHash)) return false;
    const actual = Buffer.from(await this.hash(token), "hex");
    const expected = Buffer.from(expectedHash, "hex");
    return timingSafeEqual(actual, expected);
  }
}
