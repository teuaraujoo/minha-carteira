import type { AuthUser } from "../../../users/index.js";

export interface LoginInput {
  identifier: string;
  password: string;
}

export interface LoginOutput {
  user: AuthUser;
}

export interface LoginSessionResult {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export function mapLoginOutput(user: AuthUser): LoginOutput {
  return {
    user: {
      ...user,
      capabilities: [...user.capabilities],
    },
  };
}
