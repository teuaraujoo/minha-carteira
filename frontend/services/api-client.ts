"use client";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3333"
).replace(/\/+$/, "");

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const AUTH_PUBLIC_PATHS = new Set([
  "/api/v1/auth/csrf",
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/request-mfa",
  "/api/v1/auth/validate-mfa",
  "/api/v1/auth/register",
]);

let cachedCsrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;
let refreshPromise: Promise<boolean> | null = null;

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface ApiSuccessEnvelope<TData, TMeta = undefined> {
  data: TData;
  meta: TMeta;
}

export type QueryParamValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, QueryParamValue>;
  body?: unknown;
  skipAuthRefresh?: boolean;
}

function buildRequestUrl(
  path: string,
  query?: Record<string, QueryParamValue>,
): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (!query) return `${API_BASE_URL}${normalizedPath}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }

  const serialized = params.toString();
  return serialized
    ? `${API_BASE_URL}${normalizedPath}?${serialized}`
    : `${API_BASE_URL}${normalizedPath}`;
}

/** Obtém e mantém em cache em memória o token CSRF emitido pelo backend. */
export async function ensureCsrfToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedCsrfToken) {
    return cachedCsrfToken;
  }

  if (!forceRefresh && csrfPromise) {
    return csrfPromise;
  }

  csrfPromise = (async () => {
    const response = await fetch(buildRequestUrl("/api/v1/auth/csrf"), {
      method: "GET",
      credentials: "include",
    });

    if (!response.ok) {
      throw await parseApiError(response);
    }

    const payload = (await response.json()) as { data?: { token?: string } };
    const token = payload.data?.token;
    if (!token) {
      throw new ApiClientError(
        500,
        "CSRF_TOKEN_MISSING",
        "Não foi possível inicializar a proteção CSRF da sessão.",
      );
    }
    cachedCsrfToken = token;
    return token;
  })().finally(() => {
    csrfPromise = null;
  });

  return csrfPromise;
}

/** Limpa o token CSRF em memória (usado ao encerrar sessão). */
export function clearCsrfTokenCache(): void {
  cachedCsrfToken = null;
}

async function refreshSession(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const csrfToken = await ensureCsrfToken();
      const response = await fetch(buildRequestUrl("/api/v1/auth/refresh"), {
        method: "POST",
        credentials: "include",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function parseApiError(response: Response): Promise<ApiClientError> {
  try {
    const json = (await response.json()) as {
      error?: { code?: string; message?: string; details?: unknown };
      message?: string;
    };
    const code = json.error?.code ?? "HTTP_ERROR";
    const message =
      json.error?.message ??
      json.message ??
      "Não foi possível concluir a requisição.";
    return new ApiClientError(response.status, code, message, json.error?.details);
  } catch {
    return new ApiClientError(
      response.status,
      "HTTP_ERROR",
      "Não foi possível concluir a requisição.",
    );
  }
}

function redirectToLoginIfProtectedRoute(): void {
  if (typeof window === "undefined") return;
  const currentPath = window.location.pathname;
  if (
    currentPath === "/login" ||
    currentPath.startsWith("/login/") ||
    currentPath === "/register"
  ) {
    return;
  }
  window.location.replace("/login");
}

/**
 * Executa chamadas HTTP autenticadas por cookies HttpOnly, anexando CSRF em mutações
 * e tentando renovação automática da sessão uma única vez em respostas 401.
 */
export async function apiRequest<TData, TMeta = undefined>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<ApiSuccessEnvelope<TData, TMeta>> {
  const method = options.method ?? "GET";
  const url = buildRequestUrl(path, options.query);
  const isMutating = MUTATING_METHODS.has(method);

  const execute = async (forceCsrfRefresh = false): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }
    if (isMutating) {
      headers["x-csrf-token"] = await ensureCsrfToken(forceCsrfRefresh);
    }

    return fetch(url, {
      method,
      credentials: "include",
      headers,
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  };

  let response = await execute(false);

  // Se o cookie CSRF expirou ou ainda não foi sincronizado, renova uma vez e repete a chamada.
  if (isMutating && response.status === 403) {
    const clonedError = await parseApiError(response.clone());
    if (clonedError.code === "CSRF_INVALID" || clonedError.message.toLowerCase().includes("csrf")) {
      response = await execute(true);
    }
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  if (
    response.status === 401 &&
    !options.skipAuthRefresh &&
    !AUTH_PUBLIC_PATHS.has(normalizedPath)
  ) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await execute(false);
    } else {
      clearCsrfTokenCache();
      redirectToLoginIfProtectedRoute();
    }
  }

  if (!response.ok) {
    throw await parseApiError(response);
  }

  if (response.status === 204) {
    return { data: undefined as TData, meta: undefined as TMeta };
  }

  const payload = (await response.json()) as { data: TData; meta?: TMeta };
  return {
    data: payload.data,
    meta: payload.meta as TMeta,
  };
}
