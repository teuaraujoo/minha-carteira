import { randomUUID } from "node:crypto";
import { StorageContextType } from "../../domain/enums/storage.enums.js";

export function buildStorageKey(contextType: StorageContextType, contextId: string): string {
  return `${contextType.toLowerCase()}/${contextId}/${randomUUID()}`;
}
