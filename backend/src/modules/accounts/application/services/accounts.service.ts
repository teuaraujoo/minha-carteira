import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { createPaginationMeta } from "../../../../shared/presentation/http/pagination.js";
import { Account, normalizeAccountName } from "../../domain/entities/account.entity.js";
import { AccountStatus } from "../../domain/enums/account.enums.js";
import type { IAccountRepository } from "../../domain/interfaces/account-repository.interface.js";
import type {
  AccountDetailResponseDto,
  AccountResponseDto,
  ChangeAccountStatusInputDto,
  CreateAccountInputDto,
  DeleteAccountInputDto,
  GetAccountByIdInputDto,
  ListAccountsInputDto,
  PaginatedAccountsResponseDto,
  UpdateAccountInputDto,
} from "../dto/account.dto.js";
import { toAccountDetailResponseDto, toAccountResponseDto } from "../mappers/account.mapper.js";

export class AccountsService {
  constructor(
    private readonly accountRepository: IAccountRepository,
    private readonly logger: AppLogger,
  ) {}

  async createAccount(input: CreateAccountInputDto): Promise<AccountResponseDto> {
    const normalizedName = runDomainValidation(() => normalizeAccountName(input.name));
    const existing = await this.accountRepository.findActiveByNormalizedName(input.userId, normalizedName);
    if (existing) {
      throw duplicateActiveAccountError();
    }

    const account = runDomainValidation(() =>
      Account.create({
        userId: input.userId,
        name: input.name,
        type: input.type,
        brand: input.brand,
        institution: input.institution,
        color: input.color,
        initialBalance: input.initialBalance,
      }),
    );

    const created = await this.accountRepository.create(account);

    this.logger.info({
      event: "accounts.created",
      module: "accounts",
      message: "Conta financeira cadastrada com sucesso",
      context: { operation: "createAccount", userId: input.userId, accountId: created.id },
    });

    return toAccountResponseDto(created, 0);
  }

  async listAccounts(input: ListAccountsInputDto): Promise<PaginatedAccountsResponseDto> {
    const trimmedSearch = input.search?.trim();
    const result = await this.accountRepository.findManyByUserId({
      userId: input.userId,
      page: input.page,
      pageSize: input.pageSize,
      offset: input.offset,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
    });

    const items = await Promise.all(
      result.items.map(async (account) => {
        const transactionsCount = await this.accountRepository.countLinkedTransactions(account.id, input.userId);
        return toAccountResponseDto(account, transactionsCount);
      }),
    );

    const paginationMeta = createPaginationMeta(
      { page: input.page, pageSize: input.pageSize, offset: input.offset },
      result.total,
    );

    return {
      items,
      meta: {
        ...paginationMeta,
        ...result.summary,
      },
    };
  }

  async getAccountById(input: GetAccountByIdInputDto): Promise<AccountDetailResponseDto> {
    const account = await this.requireOwnedAccount(input.accountId, input.userId);
    const now = new Date();
    const year = input.year ?? now.getUTCFullYear();
    const month = input.month ?? now.getUTCMonth() + 1;

    const [transactionsCount, metricsData] = await Promise.all([
      this.accountRepository.countLinkedTransactions(account.id, input.userId),
      this.accountRepository.getDetailMetrics({
        userId: input.userId,
        accountId: account.id,
        year,
        month,
      }),
    ]);

    const projectedBalance = Number(
      (
        account.currentBalance
        + metricsData.pending.incomeAmount
        - metricsData.pending.expenseAmount
      ).toFixed(2),
    );

    return toAccountDetailResponseDto(account, transactionsCount, {
      ...metricsData,
      projectedBalance,
    });
  }

  async updateAccount(input: UpdateAccountInputDto): Promise<AccountResponseDto> {
    const account = await this.requireOwnedAccount(input.accountId, input.userId);

    if (input.name !== undefined && account.status === AccountStatus.ACTIVE) {
      const normalizedName = runDomainValidation(() => normalizeAccountName(input.name!));
      const duplicate = await this.accountRepository.findActiveByNormalizedName(
        input.userId,
        normalizedName,
        account.id,
      );
      if (duplicate) {
        throw duplicateActiveAccountError();
      }
    }

    runDomainValidation(() => {
      account.updateDetails(
        {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.type !== undefined ? { type: input.type } : {}),
          ...(input.brand !== undefined ? { brand: input.brand } : {}),
          ...(input.institution !== undefined ? { institution: input.institution } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
        },
        new Date(),
      );
    });

    const updated = await this.accountRepository.update(account);
    const transactionsCount = await this.accountRepository.countLinkedTransactions(updated.id, input.userId);

    this.logger.info({
      event: "accounts.updated",
      module: "accounts",
      message: "Conta financeira atualizada com sucesso",
      context: { operation: "updateAccount", userId: input.userId, accountId: updated.id },
    });

    return toAccountResponseDto(updated, transactionsCount);
  }

  async deactivateAccount(input: ChangeAccountStatusInputDto): Promise<AccountResponseDto> {
    const account = await this.requireOwnedAccount(input.accountId, input.userId);
    if (account.status === AccountStatus.INACTIVE) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: "Esta conta já está inativa.",
      });
    }

    account.deactivate(new Date());
    const updated = await this.accountRepository.update(account);
    const transactionsCount = await this.accountRepository.countLinkedTransactions(updated.id, input.userId);

    this.logger.info({
      event: "accounts.deactivated",
      module: "accounts",
      message: "Conta financeira desativada com sucesso",
      context: { operation: "deactivateAccount", userId: input.userId, accountId: updated.id },
    });

    return toAccountResponseDto(updated, transactionsCount);
  }

  async reactivateAccount(input: ChangeAccountStatusInputDto): Promise<AccountResponseDto> {
    const account = await this.requireOwnedAccount(input.accountId, input.userId);
    if (account.status === AccountStatus.ACTIVE) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: "Esta conta já está ativa.",
      });
    }

    const duplicate = await this.accountRepository.findActiveByNormalizedName(
      input.userId,
      account.normalizedName,
      account.id,
    );
    if (duplicate) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: "Já existe outra conta ativa com esse nome. Renomeie antes de reativar.",
      });
    }

    account.reactivate(new Date());
    const updated = await this.accountRepository.update(account);
    const transactionsCount = await this.accountRepository.countLinkedTransactions(updated.id, input.userId);

    this.logger.info({
      event: "accounts.reactivated",
      module: "accounts",
      message: "Conta financeira reativada com sucesso",
      context: { operation: "reactivateAccount", userId: input.userId, accountId: updated.id },
    });

    return toAccountResponseDto(updated, transactionsCount);
  }

  async deleteAccount(input: DeleteAccountInputDto): Promise<void> {
    const account = await this.requireOwnedAccount(input.accountId, input.userId);
    const linkedTransactions = await this.accountRepository.countLinkedTransactions(account.id, input.userId);
    if (linkedTransactions > 0) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: "Contas com movimentações vinculadas não podem ser excluídas. Desative a conta para preservar o histórico.",
      });
    }

    const deleted = await this.accountRepository.deleteByIdAndUserId(account.id, input.userId);
    if (!deleted) {
      throw accountNotFoundError();
    }

    this.logger.info({
      event: "accounts.deleted",
      module: "accounts",
      message: "Conta financeira excluída com sucesso",
      context: { operation: "deleteAccount", userId: input.userId, accountId: account.id },
    });
  }

  private async requireOwnedAccount(accountId: string, userId: string): Promise<Account> {
    const account = await this.accountRepository.findByIdAndUserId(accountId, userId);
    if (!account) {
      throw accountNotFoundError();
    }
    return account;
  }
}

function runDomainValidation<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) {
      throw new AppError({
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: error.message,
        cause: error,
      });
    }
    throw error;
  }
}

function accountNotFoundError(): AppError {
  return new AppError({
    status: 404,
    code: ErrorCode.NOT_FOUND,
    message: "Conta não encontrada.",
  });
}

function duplicateActiveAccountError(): AppError {
  return new AppError({
    status: 409,
    code: ErrorCode.CONFLICT,
    message: "Já existe uma conta ativa cadastrada com esse nome.",
  });
}
