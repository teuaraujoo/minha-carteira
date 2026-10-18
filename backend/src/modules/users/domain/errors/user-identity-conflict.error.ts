export type UserIdentityField = "email" | "username";

export class UserIdentityConflictError extends Error {
  constructor(readonly field: UserIdentityField) {
    super(field === "email" ? "E-mail já está em uso." : "Nome de usuário já está em uso.");
    this.name = "UserIdentityConflictError";
  }
}
