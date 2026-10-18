import type { RegisterUserOutput } from "../dto/register-user.dto.js";
import type { User } from "../../domain/entities/users.entity.js";

export function mapRegisterUserOutput(user: User): RegisterUserOutput {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    capabilities: user.capabilities,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    inactivatedAt: user.inactivatedAt,
  };
}
