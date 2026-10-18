import type { CookieOptions, Response } from "express";
import { ACCESS_TOKEN_TTL_MS, REFRESH_TOKEN_TTL_MS } from "../../domain/constants/auth.constants.js";

export const AUTH_COOKIE_NAMES = {
  access: "__Secure-mc_access",
  refresh: "__Secure-mc_refresh",
  csrf: "__Secure-mc_csrf",
} as const;

export const AUTH_COOKIE_PATHS = {
  access: "/api/v1",
  refresh: "/api/v1/auth",
  csrf: "/api/v1",
} as const;

const sharedCookieOptions: Pick<CookieOptions, "httpOnly" | "secure" | "sameSite"> = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
};

export const ACCESS_COOKIE_OPTIONS: CookieOptions = {
  ...sharedCookieOptions,
  path: AUTH_COOKIE_PATHS.access,
  maxAge: ACCESS_TOKEN_TTL_MS,
};

export const REFRESH_COOKIE_OPTIONS: CookieOptions = {
  ...sharedCookieOptions,
  path: AUTH_COOKIE_PATHS.refresh,
  maxAge: REFRESH_TOKEN_TTL_MS,
};

export const CSRF_COOKIE_OPTIONS: CookieOptions = {
  ...sharedCookieOptions,
  path: AUTH_COOKIE_PATHS.csrf,
};

export function setAuthenticationCookies(response: Response, accessToken: string, refreshToken?: string): void {
  response.cookie(AUTH_COOKIE_NAMES.access, accessToken, ACCESS_COOKIE_OPTIONS);
  if (refreshToken !== undefined) response.cookie(AUTH_COOKIE_NAMES.refresh, refreshToken, REFRESH_COOKIE_OPTIONS);
}

export function clearAuthenticationCookies(response: Response): void {
  response.clearCookie(AUTH_COOKIE_NAMES.access, ACCESS_COOKIE_OPTIONS);
  response.clearCookie(AUTH_COOKIE_NAMES.refresh, REFRESH_COOKIE_OPTIONS);
  response.clearCookie(AUTH_COOKIE_NAMES.csrf, CSRF_COOKIE_OPTIONS);
}
