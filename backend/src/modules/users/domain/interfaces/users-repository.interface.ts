import type { User } from "../entities/users.entity.js";

export interface PaginationInput {
  page: number;
  pageSize: number;
  offset: number;
}

export interface PaginationMetadata {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: PaginationMetadata;
}

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
  ): Promise<PaginatedResult<User>>;
}
