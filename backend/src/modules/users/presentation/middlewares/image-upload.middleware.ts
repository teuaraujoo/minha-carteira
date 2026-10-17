import type { RequestHandler } from "express";
import multer from "multer";
import { ALLOWED_IMAGE_TYPES, MAX_PROFILE_IMAGE_SIZE } from "../../../storage/application/constants/image.constants.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_PROFILE_IMAGE_SIZE, files: 1 },
    fileFilter: (_request, file, callback) => {
        if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
            callback(new AppError({ status: 400, code: ErrorCode.VALIDATION_ERROR, message: "Tipo de imagem não permitido." }));
            return;
        }
        callback(null, true);
    },
}).single("profileImage");

const MULTIPART_INPUT_ERRORS = new Set([
    "Multipart: Boundary not found",
    "Unexpected end of form",
    "Unexpected end of file",
    "Malformed part header",
    "Malformed content type",
]);

export const profileImageUpload: RequestHandler = (request, response, next) => {
    upload(request, response, (error: unknown) => {
        if (error instanceof multer.MulterError) {
            const oversized = error.code === "LIMIT_FILE_SIZE";
            next(new AppError({
                status: oversized ? 413 : 400,
                code: ErrorCode.VALIDATION_ERROR,
                message: oversized ? "Imagem excede o limite de 10 MiB." : "Arquivo de imagem inválido.",
                cause: error,
            }));
            return;
        }
        if (error instanceof Error && Object.getPrototypeOf(error) === Error.prototype && MULTIPART_INPUT_ERRORS.has(error.message)) {
            next(new AppError({
                status: 400,
                code: ErrorCode.VALIDATION_ERROR,
                message: "Formulário de imagem inválido.",
                cause: error,
            }));
            return;
        }
        next(error);
    });
};
