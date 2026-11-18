"use client";

import { apiRequest } from "@/services/api-client";

export interface UserProfileDto {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  capabilities: string[];
  profileImage: {
    url: string;
    expiresAt: string;
  } | null;
}

export const usersService = {
  async getMe(): Promise<UserProfileDto> {
    const { data } = await apiRequest<UserProfileDto>("/api/v1/users/me");
    return data;
  },
};
