export class InvalidCredentialsError extends Error {
  constructor() {
    super("Identificador ou senha inválidos.");
    this.name = "InvalidCredentialsError";
  }
}
