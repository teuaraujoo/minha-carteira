import type { AppLogger } from "../../../../shared/application/logging/app-logger.js";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { createPaginationMeta } from "../../../../shared/presentation/http/pagination.js";
import { AccountStatus } from "../../../accounts/domain/enums/account.enums.js";
import type { AccountsService } from "../../../accounts/application/services/accounts.service.js";
import { CategoryStatus } from "../../../categories/domain/enums/category.enums.js";
import type { CategoriesService } from "../../../categories/application/services/categories.service.js";
import { Transaction, validateTransactionDate } from "../../domain/entities/transaction.entity.js";
import { SortOrder, TransactionSortBy } from "../../domain/enums/transaction.enums.js";
import type { ITransactionRepository } from "../../domain/interfaces/transaction-repository.interface.js";
import type { TransactionPaginationQuery } from "../../domain/interfaces/transaction.interfaces.js";
import type {
  ConfirmTransactionInputDto,
  CreateTransactionDto,
  DeleteTransactionInputDto,
  GetTransactionByIdInputDto,
  ListTransactionsQueryDto,
  PaginatedTransactionsResponseDto,
  TransactionResponseDto,
} from "../dto/transaction.dto.js";
import { TransactionMapper } from "../mappers/transaction.mapper.js";

export class TransactionsService {
  constructor(
    private readonly transactionRepository: ITransactionRepository,
    private readonly accountsService: AccountsService,
    private readonly categoriesService: CategoriesService,
    private readonly logger: AppLogger,
  ) {}

  /** Cria uma receita ou despesa validando conta ativa do usuário e categoria opcional via CategoriesService. */
  async createTransaction(input: CreateTransactionDto): Promise<TransactionResponseDto> {
    const transaction = createDomainTransaction(input);

    const account = await this.accountsService.getAccountById({
      userId: input.userId,
      accountId: transaction.accountId,
    });
    if (account.status !== AccountStatus.ACTIVE) {
      throw new AppError({
        status: 409,
        code: ErrorCode.CONFLICT,
        message: "A conta selecionada está inativa e não aceita novos lançamentos.",
      });
    }

    if (transaction.categoryId !== null) {
      const category = await this.categoriesService.getCategoryById({
        userId: input.userId,
        categoryId: transaction.categoryId,
      });
      if (category.status !== CategoryStatus.ACTIVE) {
        throw new AppError({
          status: 409,
          code: ErrorCode.CONFLICT,
          message: "A categoria selecionada está inativa e não pode ser vinculada a novos lançamentos.",
        });
      }
    }

    const created = await this.transactionRepository.create(transaction);
    this.logger.info({
      event: "transactions.created",
      module: "transactions",
      message: "Transação financeira registrada.",
      context: {
        userId: input.userId,
        transactionId: created.id,
        accountId: created.accountId,
        ...(created.categoryId ? { categoryId: created.categoryId } : {}),
        operation: "createTransaction",
      },
    });

    return TransactionMapper.toDto(created);
  }

  /** Lista transações não excluídas com filtros na URL, ordenação, paginação global e resumo consolidado. */
  async listTransactions(input: ListTransactionsQueryDto): Promise<PaginatedTransactionsResponseDto> {
    let normalizedDateFrom: string | undefined;
    let normalizedDateTo: string | undefined;

    try {
      if (input.dateFrom !== undefined) normalizedDateFrom = validateTransactionDate(input.dateFrom);
      if (input.dateTo !== undefined) normalizedDateTo = validateTransactionDate(input.dateTo);
    } catch (error) {
      throw mapTransactionDomainError(error);
    }

    if (normalizedDateFrom && normalizedDateTo && normalizedDateFrom > normalizedDateTo) {
      throw new AppError({
        status: 400,
        code: ErrorCode.VALIDATION_ERROR,
        message: "A data inicial não pode ser posterior à data final.",
      });
    }

    const trimmedSearch = input.search?.trim();
    const query: TransactionPaginationQuery = {
      userId: input.userId,
      page: input.page,
      pageSize: input.pageSize,
      offset: input.offset,
      sortBy: input.sortBy ?? TransactionSortBy.TRANSACTION_DATE,
      sortOrder: input.sortOrder ?? SortOrder.DESC,
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(normalizedDateFrom !== undefined ? { dateFrom: normalizedDateFrom } : {}),
      ...(normalizedDateTo !== undefined ? { dateTo: normalizedDateTo } : {}),
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
    };

    const result = await this.transactionRepository.findManyByUserId(query);
    const pagination = createPaginationMeta(
      { page: input.page, pageSize: input.pageSize, offset: input.offset },
      result.total,
    );

    return {
      items: result.items.map(TransactionMapper.toDto),
      meta: {
        ...pagination,
        ...result.summary,
      },
    };
  }

  /** Detalha uma transação pertencente ao usuário autenticado. */
  async getTransactionById(input: GetTransactionByIdInputDto): Promise<TransactionResponseDto> {
    const transaction = await this.findOwnedOrThrow(input.transactionId, input.userId);
    return TransactionMapper.toDto(transaction);
  }

  /** Confirma uma receita ou despesa pendente, validando sempre o status atual. */
  async confirmTransaction(input: ConfirmTransactionInputDto): Promise<TransactionResponseDto> {
    const transaction = await this.findOwnedOrThrow(input.transactionId, input.userId);

    try {
      transaction.confirm();
    } catch (error) {
      throw mapConfirmationConflictError(error);
    }

    const confirmed = await this.transactionRepository.confirm(transaction);
    this.logger.info({
      event: "transactions.confirmed",
      module: "transactions",
      message: "Transação pendente confirmada.",
      context: {
        userId: input.userId,
        transactionId: confirmed.id,
        accountId: confirmed.accountId,
        ...(confirmed.categoryId ? { categoryId: confirmed.categoryId } : {}),
        operation: "confirmTransaction",
      },
    });

    return TransactionMapper.toDto(confirmed);
  }

  /** Realiza exclusão lógica da transação e estorna o impacto no saldo se ela estava confirmada. */
  async deleteTransaction(input: DeleteTransactionInputDto): Promise<void> {
    const transaction = await this.findOwnedOrThrow(input.transactionId, input.userId);

    try {
      transaction.softDelete();
    } catch (error) {
      throw mapConfirmationConflictError(error);
    }

    const deleted = await this.transactionRepository.softDelete(transaction);
    if (!deleted) {
      throw transactionNotFoundError();
    }

    this.logger.info({
      event: "transactions.deleted",
      module: "transactions",
      message: "Transação excluída logicamente.",
      context: {
        userId: input.userId,
        transactionId: transaction.id,
        accountId: transaction.accountId,
        ...(transaction.categoryId ? { categoryId: transaction.categoryId } : {}),
        operation: "deleteTransaction",
      },
    });
  }

  private async findOwnedOrThrow(transactionId: string, userId: string): Promise<Transaction> {
    const transaction = await this.transactionRepository.findByIdAndUserId(transactionId, userId);
    if (!transaction) {
      throw transactionNotFoundError();
    }
    return transaction;
  }
}

function createDomainTransaction(input: CreateTransactionDto): Transaction {
  try {
    return Transaction.create({
      userId: input.userId,
      accountId: input.accountId,
      description: input.description,
      amount: input.amount,
      type: input.type,
      transactionDate: input.transactionDate,
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    });
  } catch (error) {
    throw mapTransactionDomainError(error);
  }
}

function mapTransactionDomainError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError || error instanceof RangeError) {
    return new AppError({
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
      message: error.message,
      cause: error,
    });
  }
  throw error;
}

function mapConfirmationConflictError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof TypeError || error instanceof RangeError) {
    return new AppError({
      status: 409,
      code: ErrorCode.CONFLICT,
      message: error.message,
      cause: error,
    });
  }
  throw error;
}

function transactionNotFoundError(): AppError {
  return new AppError({
    status: 404,
    code: ErrorCode.NOT_FOUND,
    message: "Transação não encontrada.",
  });
}
