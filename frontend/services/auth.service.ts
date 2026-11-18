"use client";

import {
  apiRequest,
  clearCsrfTokenCache,
  ensureCsrfToken,
} from "@/services/api-client";

export interface RequestMfaPayload {
  email: string;
}

export interface RequestMfaResponse {
  sent: true;
  challengeId: string;
  nextAttemptAt: string;
}

export interface ValidateMfaPayload {
  challengeId: string;
  code: string;
}

export interface ValidateMfaResponse {
  accessToken: string;
  isRegistered: boolean;
}

export interface RegisterPayload {
  name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface AuthenticatedUserSummary {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  capabilities: string[];
}

export const authService = {
  async initCsrf(): Promise<string> {
    return ensureCsrfToken();
  },

  async requestMfa(payload: RequestMfaPayload): Promise<RequestMfaResponse> {
    const { data } = await apiRequest<RequestMfaResponse>(
      "/api/v1/auth/request-mfa",
      {
        method: "POST",
        body: payload,
        skipAuthRefresh: true,
      },
    );
    return data;
  },

  async validateMfa(payload: ValidateMfaPayload): Promise<ValidateMfaResponse> {
    const { data } = await apiRequest<ValidateMfaResponse>(
      "/api/v1/auth/validate-mfa",
      {
        method: "POST",
        body: payload,
        skipAuthRefresh: true,
      },
    );
    return data;
  },

  async register(payload: RegisterPayload): Promise<AuthenticatedUserSummary> {
    const { data } = await apiRequest<AuthenticatedUserSummary>(
      "/api/v1/auth/register",
      {
        method: "POST",
        body: payload,
        skipAuthRefresh: true,
      },
    );
    return data;
  },

  async login(
    payload: LoginPayload,
  ): Promise<{ user: AuthenticatedUserSummary }> {
    const { data } = await apiRequest<{ user: AuthenticatedUserSummary }>(
      "/api/v1/auth/login",
      {
        method: "POST",
        body: payload,
        skipAuthRefresh: true,
      },
    );
    return data;
  },

  async logout(): Promise<void> {
    try {
      await apiRequest<void>("/api/v1/auth/logout", {
        method: "POST",
        skipAuthRefresh: true,
      });
    } finally {
      clearCsrfTokenCache();
    }
  },
};
