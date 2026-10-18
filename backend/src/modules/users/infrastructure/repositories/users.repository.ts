import { User } from "../../domain/entities/users.entity.js";
import { UserCapabilities, UserRoles, UserStatus } from "../../domain/enums/users.enums.js";
import { UserIdentityConflictError } from "../../domain/errors/user-identity-conflict.error.js";
import type {
  IUsersRepository,
  PaginatedResult,
  PaginationInput,
} from "../../domain/interfaces/users-repository.interface.js";
import type { Prisma, PrismaClient } from "../../../../../generated/prisma/client.js";

interface UserRecord {
  id: string;
  username: string;
  name: string;
  email: string;
  phone: string;
  role: UserRoles;
  passwordHash: string;
  capabilities: UserCapabilities[];
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
  inactivatedAt: Date | null;
}

export type PrismaUsersClient = Pick<PrismaClient, "user">;

export class PrismaUsersRepository implements IUsersRepository {
  constructor(private readonly prisma: PrismaUsersClient) {}

  async findById(id: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findUnique({ where: { id } }) as UserRecord | null);
  }

  async findActiveById(id: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findFirst({ where: { id, status: UserStatus.ACTIVE } }) as UserRecord | null);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } }) as UserRecord | null);
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.toDomain(await this.prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } }) as UserRecord | null);
  }

  async findByIdentifier(identifier: string): Promise<User | null> {
    const normalized = identifier.trim().toLowerCase();
    return this.toDomain(await this.prisma.user.findFirst({
      where: { OR: [{ email: normalized }, { username: normalized }] },
    }) as UserRecord | null);
  }

  async save(user: User): Promise<void> {
    try {
      await this.prisma.user.upsert({
        where: { id: user.id },
        create: this.toRecord(user) as unknown as Prisma.UserUncheckedCreateInput,
        update: {
          username: user.username,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          passwordHash: user.passwordHash,
          capabilities: user.capabilities,
          status: user.status,
          updatedAt: user.updatedAt,
          inactivatedAt: user.inactivatedAt,
        } as Prisma.UserUncheckedUpdateInput,
      });
    } catch (error) {
      const conflictField = this.identityConflictField(error);
      if (conflictField) throw new UserIdentityConflictError(conflictField);
      throw error;
    }
  }

  async deleteById(id: string): Promise<void> {
    await this.prisma.user.delete({ where: { id } });
  }

  async findInactiveBefore(date: Date, pagination: PaginationInput): Promise<PaginatedResult<User>> {
    const where = { status: UserStatus.INACTIVE, inactivatedAt: { lt: date } };
    const [records, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip: pagination.offset, take: pagination.pageSize, orderBy: { inactivatedAt: "asc" } }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: records.map(record => this.toDomain(record as UserRecord)).filter((user): user is User => user !== null),
      pagination: {
        page: pagination.page,
        pageSize: pagination.pageSize,
        total,
        totalPages: Math.ceil(total / pagination.pageSize),
      },
    };
  }

  private toDomain(record: UserRecord | null): User | null {
    if (!record) return null;
    return new User({ ...record });
  }

  private toRecord(user: User): UserRecord {
    return {
      id: user.id,
      username: user.username.trim().toLowerCase(),
      name: user.name.trim(),
      email: user.email.trim().toLowerCase(),
      phone: user.phone,
      role: user.role,
      passwordHash: user.passwordHash,
      capabilities: user.capabilities,
      status: user.status,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      inactivatedAt: user.inactivatedAt,
    };
  }

  private identityConflictField(error: unknown): "email" | "username" | null {
    if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return null;
    const target = "meta" in error && error.meta && typeof error.meta === "object" && "target" in error.meta
      ? error.meta.target
      : undefined;
    const targetText = Array.isArray(target) ? target.join(" ") : String(target ?? "");
    if (targetText.includes("email")) return "email";
    if (targetText.includes("username")) return "username";
    return null;
  }
}
