import type { Account } from "../../domain/entities/account.entity.js";
import type { AccountResponseDto } from "../dto/account.dto.js";

export function toAccountResponseDto(account: Account, transactionsCount: number): AccountResponseDto {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    brand: account.brand,
    institution: account.institution,
    color: account.color,
    initialBalance: account.initialBalance,
    currentBalance: account.currentBalance,
    status: account.status,
    inactivatedAt: account.inactivatedAt ? account.inactivatedAt.toISOString() : null,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
    transactionsCount,
  };
}
