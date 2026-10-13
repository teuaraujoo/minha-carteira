import { AppError, ErrorCode } from "../../presentation/http/app-error.js";

const REDACTED = "[REMOVIDO]";
const UNAVAILABLE_STACK = "[Pilha indisponível]";
const ACCESSOR = "[Acessor]";
const CIRCULAR = "[Circular]";
const SENSITIVE_KEY = /^(?:password|passwd|passwordHash|hash|secret|token|accessToken|refreshToken|authorization|cookie|set-cookie|credential|apiKey|api_key|api-key|headers?|body|email|recipient|phone|document|address|connectionString|sql|params?|html)$/i;
const HTTP_OR_DATABASE_URL = /\b(?:https?|postgres(?:ql)?|redis|mongodb(?:\+srv)?):\/\/[^\s"'<>]+/gi;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const LONG_HEX = /\b[0-9a-f]{32,}\b/gi;
const SQL = /\b(?:SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE)\b[^;|\r\n]*;?/gi;
const PRIVATE_AUTH_ROUTE = /\/auth\/(?:reset-password|recover-password|verify-email|validate-email|access)(?:\/[^\s"'?#]*)?(?:\?[^\s"']*)?/gi;
const COOKIE_ASSIGNMENT = /\b(set-cookie|cookie)\b["']?\s*[:=]\s*[^\r\n]*/gi;
const TEXT_ASSIGNMENT = /\b(password|passwd|passwordHash|secret|token|accessToken|refreshToken|authorization|credential|apiKey|api_key|api-key|connectionString)\b["']?\s*[:=]\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^,\r\n}]+)/gi;

type SanitizedContainer = unknown[] | Record<string, unknown>;

interface PendingObject {
  source: object;
  target: SanitizedContainer;
}

export function sanitizeLogText(value: string): string {
  return value
    .replace(COOKIE_ASSIGNMENT, (_match, key: string) => `${key}=${REDACTED}`)
    .replace(HTTP_OR_DATABASE_URL, "[URL REMOVIDA]")
    .replace(EMAIL, "[EMAIL REMOVIDO]")
    .replace(JWT, "[JWT REMOVIDO]")
    .replace(LONG_HEX, "[HEX REMOVIDO]")
    .replace(PRIVATE_AUTH_ROUTE, "[ROTA PRIVADA REMOVIDA]")
    .replace(SQL, "[SQL REMOVIDO]")
    .replace(/\bBearer\s+[^\s"',;]+/gi, `Bearer ${REDACTED}`)
    .replace(TEXT_ASSIGNMENT, (_match, key: string) => `${key}=${REDACTED}`);
}

function readDataProperty(value: object, key: string): unknown {
  try {
    let current: object | null = value;
    while (current !== null) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor) return "value" in descriptor ? descriptor.value : ACCESSOR;
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return ACCESSOR;
  }
  return undefined;
}

function sanitizePrimitive(value: unknown): unknown {
  if (typeof value === "string") return sanitizeLogText(value);
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol" || typeof value === "function") return `[${typeof value}]`;
  return value;
}

function createContainer(value: object): SanitizedContainer {
  return Array.isArray(value) ? [] : Object.create(null) as Record<string, unknown>;
}

function errorEntries(error: Error): Array<[string, unknown]> {
  const entries: Array<[string, unknown]> = [
    ["name", readDataProperty(error, "name")],
    ["message", readDataProperty(error, "message")],
    ["stack", readDataProperty(error, "stack") ?? UNAVAILABLE_STACK],
  ];
  const cause = readDataProperty(error, "cause");
  if (cause !== undefined) entries.push(["cause", cause]);
  return entries;
}

function ownEntries(value: object): Array<[string, unknown]> | typeof ACCESSOR {
  try {
    if (value instanceof Error) return errorEntries(value);
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Array.isArray(value)) {
      const length = typeof descriptors.length?.value === "number" ? descriptors.length.value : 0;
      return Array.from({ length }, (_unused, index) => {
        const descriptor = descriptors[String(index)];
        if (!descriptor) return [String(index), null];
        return [String(index), "value" in descriptor ? descriptor.value : ACCESSOR];
      });
    }
    return Object.entries(descriptors)
      .filter(([, descriptor]) => descriptor.enumerable)
      .map(([key, descriptor]) => [key, "value" in descriptor ? descriptor.value : ACCESSOR]);
  } catch {
    return ACCESSOR;
  }
}

export function sanitizeLogValue(value: unknown): unknown {
  const primitive = sanitizePrimitive(value);
  if (typeof primitive !== "object" || primitive === null) return primitive;

  const root = createContainer(primitive);
  const seen = new WeakSet<object>([primitive]);
  const pending: PendingObject[] = [{ source: primitive, target: root }];

  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    const entries = ownEntries(current.source);
    if (entries === ACCESSOR) return current.source === primitive ? ACCESSOR : root;

    for (const [rawKey, rawValue] of entries) {
      const key = sanitizeLogText(rawKey);
      const targetKey: string | number = Array.isArray(current.target) ? Number(rawKey) : key;
      if (SENSITIVE_KEY.test(rawKey)) {
        current.target[targetKey as never] = REDACTED as never;
        continue;
      }
      const sanitized = sanitizePrimitive(rawValue);
      if (typeof sanitized !== "object" || sanitized === null) {
        current.target[targetKey as never] = sanitized as never;
        continue;
      }
      if (seen.has(sanitized)) {
        current.target[targetKey as never] = CIRCULAR as never;
        continue;
      }
      seen.add(sanitized);
      const child = createContainer(sanitized);
      current.target[targetKey as never] = child as never;
      pending.push({ source: sanitized, target: child });
    }
  }

  return root;
}

export interface LogErrorDiagnostic {
  name: string;
  code: string;
  status: number;
  message: string;
  stack: string;
  details?: unknown;
  cause?: unknown;
}

function sanitizeCause(cause: unknown): unknown {
  if (!(cause instanceof Error) || readDataProperty(cause, "type") !== "entity.parse.failed") {
    return sanitizeLogValue(cause);
  }
  const rawStack = readDataProperty(cause, "stack");
  const stack = typeof rawStack === "string" ? rawStack.split(/\r?\n/).slice(1).join("\n") : "";
  return {
    name: "SyntaxError",
    message: "JSON inválido.",
    stack: stack ? sanitizeLogText(`SyntaxError: JSON inválido.\n${stack}`) : UNAVAILABLE_STACK,
  };
}

export function createLogErrorDiagnostic(error: unknown): LogErrorDiagnostic {
  if (error instanceof AppError) {
    const code = readDataProperty(error, "code");
    const status = readDataProperty(error, "status");
    const message = readDataProperty(error, "message");
    const stack = readDataProperty(error, "stack");
    const details = readDataProperty(error, "details");
    const cause = readDataProperty(error, "cause");
    const diagnostic: LogErrorDiagnostic = {
      name: "AppError",
      code: typeof code === "string" ? sanitizeLogText(code) : ErrorCode.INTERNAL_ERROR,
      status: typeof status === "number" && Number.isInteger(status) ? status : 500,
      message: typeof message === "string" ? sanitizeLogText(message) : ACCESSOR,
      stack: typeof stack === "string" && stack !== ACCESSOR ? sanitizeLogText(stack) : UNAVAILABLE_STACK,
      details: sanitizeLogValue(details),
    };
    if (cause !== undefined) diagnostic.cause = sanitizeCause(cause);
    return diagnostic;
  }

  if (error instanceof Error) {
    const name = readDataProperty(error, "name");
    const message = readDataProperty(error, "message");
    const stack = readDataProperty(error, "stack");
    const cause = readDataProperty(error, "cause");
    const diagnostic: LogErrorDiagnostic = {
      name: typeof name === "string" ? sanitizeLogText(name) : "Error",
      code: ErrorCode.INTERNAL_ERROR,
      status: 500,
      message: typeof message === "string" ? sanitizeLogText(message) : ACCESSOR,
      stack: typeof stack === "string" && stack !== ACCESSOR ? sanitizeLogText(stack) : UNAVAILABLE_STACK,
    };
    if (cause !== undefined) diagnostic.cause = sanitizeCause(cause);
    return diagnostic;
  }

  return {
    name: "NonErrorThrown",
    code: ErrorCode.INTERNAL_ERROR,
    status: 500,
    message: "Falha lançada sem objeto Error",
    stack: UNAVAILABLE_STACK,
    details: sanitizeLogValue(error),
  };
}

const CONTEXT_FIELDS = {
  operation: "string",
  count: "number",
  userId: "string",
  accountId: "string",
  categoryId: "string",
  transactionId: "string",
  recurringTransactionId: "string",
} as const;

export function sanitizeLogContext(value: unknown): Record<string, string | number> | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const output: Record<string, string | number> = Object.create(null);
  for (const [key, expectedType] of Object.entries(CONTEXT_FIELDS)) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = Object.getOwnPropertyDescriptor(value, key);
    } catch {
      continue;
    }
    if (!descriptor || !("value" in descriptor)) continue;
    if (expectedType === "string" && typeof descriptor.value === "string") output[key] = sanitizeLogText(descriptor.value);
    if (expectedType === "number" && typeof descriptor.value === "number" && Number.isFinite(descriptor.value)) output[key] = descriptor.value;
  }
  return Object.keys(output).length > 0 ? output : undefined;
}
