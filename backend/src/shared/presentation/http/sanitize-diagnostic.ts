const REDACTED = "[REMOVIDO]";
const MAX_DEPTH = 6;
const SENSITIVE_KEY = /^(?:password|passwd|secret|token|accessToken|refreshToken|authorization|cookie|set-cookie|credential|apiKey|api_key|api-key)$/i;
const COOKIE_ASSIGNMENT = /\b(set-cookie|cookie)\b["']?\s*[:=]\s*[^\r\n]*/gi;
const TEXT_ASSIGNMENT = /\b(password|passwd|secret|token|accessToken|refreshToken|authorization|cookie|set-cookie|credential|apiKey|api_key|api-key)\b["']?\s*[:=]\s*(?:"(?:\\.|[^"\\\r\n])*"|'(?:\\.|[^'\\\r\n])*'|[^,\r\n}]+)/gi;

export function sanitizeText(value: string): string {
  return value
    .replace(COOKIE_ASSIGNMENT, (_match, key: string) => `${key}=${REDACTED}`)
    .replace(/\b((?:https?|postgres(?:ql)?):\/\/)[^\s/]+@/gi, `$1${REDACTED}@`)
    .replace(/\bBearer\s+[^\s"',;]+/gi, `Bearer ${REDACTED}`)
    .replace(TEXT_ASSIGNMENT, (_match, key: string) => `${key}=${REDACTED}`);
}

// Read descriptors rather than values so application getters never execute.
export function readOwnData(value: object, key: string): unknown {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch {
    return undefined;
  }
}

export function readDataProperty(value: object, key: string): unknown {
  try {
    let current: object | null = value;
    for (let depth = 0; current !== null && depth < MAX_DEPTH; depth++) {
      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (descriptor) return "value" in descriptor ? descriptor.value : undefined;
      current = Object.getPrototypeOf(current);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function sanitizeDiagnostic(value: unknown): unknown {
  const seen = new WeakSet<object>();

  function visit(current: unknown, depth: number): unknown {
    if (typeof current === "string") return sanitizeText(current);
    if (current === null || current === undefined) return null;
    if (typeof current === "boolean") return current;
    if (typeof current === "number") return Number.isFinite(current) ? current : null;
    if (typeof current === "bigint") return current.toString();
    if (typeof current !== "object") return `[${typeof current}]`;
    if (seen.has(current)) return "[Circular]";
    if (depth >= MAX_DEPTH) return "[Limite de profundidade]";
    seen.add(current);

    try {
      const descriptors = Object.getOwnPropertyDescriptors(current);
      if (Array.isArray(current)) {
        const length = descriptors.length?.value as number;
        return Array.from({ length }, (_unused, index) => {
          const descriptor = descriptors[String(index)];
          return !descriptor ? null : "value" in descriptor ? visit(descriptor.value, depth + 1) : "[Acessor]";
        });
      }
      const output: Record<string, unknown> = Object.create(null);
      for (const [key, descriptor] of Object.entries(descriptors)) {
        if (!descriptor.enumerable && !(current instanceof Error && ["name", "message", "stack", "cause"].includes(key))) continue;
        output[sanitizeText(key)] = SENSITIVE_KEY.test(key)
          ? REDACTED
          : "value" in descriptor ? visit(descriptor.value, depth + 1) : "[Acessor]";
      }
      return output;
    } catch {
      return "[Acessor]";
    }
  }

  return visit(value, 0);
}
