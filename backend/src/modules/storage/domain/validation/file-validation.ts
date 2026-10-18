import { createHash } from "node:crypto";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
export const MAX_STORED_FILE_SIZE = 10 * 1024 * 1024;
export const PROFILE_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function invalidFile(message: string): AppError {
  return new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message });
}

function detectMimeType(content: Buffer): string | null {
  if (content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (content.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "image/jpeg";
  if (content.subarray(0, 4).toString("ascii") === "RIFF" && content.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function hasValidContainer(content: Buffer, mimeType: string): boolean {
  if (mimeType === "image/png") {
    let offset = 8;
    while (offset + 12 <= content.length) {
      const chunkLength = content.readUInt32BE(offset);
      const chunkEnd = offset + 12 + chunkLength;
      if (chunkEnd > content.length) return false;
      if (content.subarray(offset + 4, offset + 8).toString("ascii") === "IEND") {
        return chunkLength === 0 && chunkEnd === content.length;
      }
      offset = chunkEnd;
    }
    return false;
  }
  if (mimeType === "image/jpeg") return content.length >= 4 && content.subarray(-2).equals(Buffer.from([255, 217]));
  if (mimeType === "image/webp") {
    if (content.length < 16) return false;
    const declaredSize = content.readUInt32LE(4) + 8;
    return declaredSize <= content.length;
  }
  return false;
}

export function validateStoredFile(content: Buffer, declaredMimeType: string): { sizeInBytes: number; checksum: string } {
  if (!Buffer.isBuffer(content) || content.length === 0) throw invalidFile("O arquivo é obrigatório.");
  if (content.length > MAX_STORED_FILE_SIZE) throw invalidFile("O arquivo excede o limite de 10 MiB.");
  if (!PROFILE_IMAGE_MIME_TYPES.has(declaredMimeType)) throw invalidFile("Tipo de arquivo não permitido.");

  const detectedMimeType = detectMimeType(content);
  if (detectedMimeType !== declaredMimeType) throw invalidFile("O conteúdo do arquivo não corresponde ao MIME declarado.");
  if (!hasValidContainer(content, declaredMimeType)) throw invalidFile("O conteúdo do arquivo está corrompido.");

  return { sizeInBytes: content.length, checksum: createHash("sha256").update(content).digest("hex") };
}
