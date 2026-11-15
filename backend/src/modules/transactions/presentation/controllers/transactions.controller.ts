import type { Request, Response } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { parsePagination } from "../../../../shared/presentation/http/pagination.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { TransactionsService } from "../../application/services/transactions.service.js";
import {
  createTransactionSchema,
  listTransactionsQuerySchema,
  transactionIdParamSchema,
} from "../schemas/transactions.schemas.js";

export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  create = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const parsedBody = createTransactionSchema.safeParse(request.body);
    if (!parsedBody.success) {
      throw validationError("Dados de criação da transação inválidos.", parsedBody.error);
    }

    const created = await this.transactionsService.createTransaction({
      userId,
      accountId: parsedBody.data.accountId,
      description: parsedBody.data.description,
      amount: parsedBody.data.amount,
      type: parsedBody.data.type,
      transactionDate: parsedBody.data.transactionDate,
      ...(parsedBody.data.categoryId !== undefined ? { categoryId: parsedBody.data.categoryId } : {}),
      ...(parsedBody.data.status !== undefined ? { status: parsedBody.data.status } : {}),
      ...(parsedBody.data.notes !== undefined ? { notes: parsedBody.data.notes } : {}),
    });

    sendCreated(response, created);
  };

  list = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const pagination = parsePagination({
      page: request.query.page,
      pageSize: request.query.pageSize,
    });

    const parsedQuery = listTransactionsQuerySchema.safeParse(request.query);
    if (!parsedQuery.success) {
      throw validationError("Parâmetros de filtro ou ordenação das transações inválidos.", parsedQuery.error);
    }

    const result = await this.transactionsService.listTransactions({
      userId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      offset: pagination.offset,
      ...(parsedQuery.data.status !== undefined ? { status: parsedQuery.data.status } : {}),
      ...(parsedQuery.data.type !== undefined ? { type: parsedQuery.data.type } : {}),
      ...(parsedQuery.data.accountId !== undefined ? { accountId: parsedQuery.data.accountId } : {}),
      ...(parsedQuery.data.categoryId !== undefined ? { categoryId: parsedQuery.data.categoryId } : {}),
      ...(parsedQuery.data.dateFrom !== undefined ? { dateFrom: parsedQuery.data.dateFrom } : {}),
      ...(parsedQuery.data.dateTo !== undefined ? { dateTo: parsedQuery.data.dateTo } : {}),
      ...(parsedQuery.data.search !== undefined && parsedQuery.data.search.length > 0
        ? { search: parsedQuery.data.search }
        : {}),
      ...(parsedQuery.data.sortBy !== undefined ? { sortBy: parsedQuery.data.sortBy } : {}),
      ...(parsedQuery.data.sortOrder !== undefined ? { sortOrder: parsedQuery.data.sortOrder } : {}),
    });

    sendSuccess(response, result.items, result.meta);
  };

  getById = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const transactionId = parseTransactionIdParam(request);
    const transaction = await this.transactionsService.getTransactionById({ userId, transactionId });
    sendSuccess(response, transaction);
  };

  confirm = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const transactionId = parseTransactionIdParam(request);
    const confirmed = await this.transactionsService.confirmTransaction({ userId, transactionId });
    sendSuccess(response, confirmed);
  };

  delete = async (request: Request, response: Response): Promise<void> => {
    const userId = requireUserId(request);
    const transactionId = parseTransactionIdParam(request);
    await this.transactionsService.deleteTransaction({ userId, transactionId });
    sendNoContent(response);
  };
}

function requireUserId(request: Request): string {
  const userId = request.auth?.userId;
  if (!userId) {
    throw new AppError({
      status: 401,
      code: ErrorCode.UNAUTHORIZED,
      message: "Autenticação inválida ou expirada.",
    });
  }
  return userId;
}

function parseTransactionIdParam(request: Request): string {
  const parsed = transactionIdParamSchema.safeParse(request.params);
  if (!parsed.success) {
    throw validationError("ID da transação inválido.", parsed.error);
  }
  return parsed.data.transactionId;
}

function validationError(message: string, cause: unknown): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message,
    cause,
  });
}
