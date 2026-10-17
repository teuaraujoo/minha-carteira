export class StorageProviderError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, { cause });
    this.name = "StorageProviderError";
  }
}
