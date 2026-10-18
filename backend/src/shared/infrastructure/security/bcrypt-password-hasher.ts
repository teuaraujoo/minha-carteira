import bcrypt from "bcrypt";
import type { PasswordHasher } from "../../application/security/password-hasher.js";

export class BcryptPasswordHasher implements PasswordHasher {
  constructor(private readonly saltRounds: number) {
    if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 31) {
      throw new RangeError("O custo do bcrypt deve ser um inteiro entre 4 e 31.");
    }
  }

  hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  compare(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}
