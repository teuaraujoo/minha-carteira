import type { ChallengeMetadata, RequestMetadata } from "../interfaces/auth.interfaces.js";

export function required(value: string, field: string): string {
    if (typeof value !== "string" || !value.trim()) throw new TypeError(`${field} é obrigatório.`);
    return value.trim();
}

export function nullableString(value: string | null, field: string): string | null {
    if (value === null) return null;
    if (typeof value !== "string") throw new TypeError(`${field} deve ser texto ou nulo.`);
    return value;
}

export function validDate(value: Date, field: string): Date {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new TypeError(`${field} deve ser uma data válida.`);
    return new Date(value.getTime());
}

export function nullableDate(value: Date | null, field: string): Date | null {
    return value === null ? null : validDate(value, field);
}

export function enumValue<T extends Record<string, string>>(value: string, values: T, field: string): T[keyof T] {
    if (!Object.values(values).includes(value)) throw new TypeError(`O ${field} é inválido.`);
    return value as T[keyof T];
}

export function cloneRequestMetadata(value: RequestMetadata): RequestMetadata {
    if (!value || typeof value !== "object") throw new TypeError("A metadata da solicitação é obrigatória.");
    const location = value.location === null ? null : {
        latitude: finiteNumber(value.location?.latitude, "latitude"),
        longitude: finiteNumber(value.location?.longitude, "longitude"),
    };
    return {
        location,
        userAgent: nullableString(value.userAgent, "userAgent"),
        ipAddress: nullableString(value.ipAddress, "ipAddress"),
        deviceId: nullableString(value.deviceId, "deviceId"),
    };
}

export function cloneChallengeMetadata(value: ChallengeMetadata): ChallengeMetadata {
    if (!value || typeof value !== "object") throw new TypeError("A metadata do desafio é obrigatória.");
    return {
        issued: cloneRequestMetadata(value.issued),
        consumed: value.consumed === null ? null : cloneRequestMetadata(value.consumed),
    };
}

export function finiteNumber(value: number, field: string): number {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new TypeError(`${field} deve ser um número válido.`);
    return value;
}
