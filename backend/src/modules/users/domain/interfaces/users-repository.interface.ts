import type { User } from "../entities/users.entity.js";
import type { PaginationInput, PaginationMeta } from "../../../../shared/application/contracts/pagination.contract.js";

export interface IUsersRepository {
  findById(id: string): Promise<User | null>;
  findActiveById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findByUsername(username: string): Promise<User | null>;
  findByIdentifier(identifier: string): Promise<User | null>;
  save(user: User): Promise<void>;
  deleteById(id: string): Promise<void>;
  findInactiveBefore(
    date: Date,
    pagination: PaginationInput,
  ): Promise<{ items: User[]; pagination: PaginationMeta }>;
}
