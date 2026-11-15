import type { Request, Response } from "express";
import { AppError, ErrorCode } from "../../../../shared/presentation/http/app-error.js";
import { parsePagination } from "../../../../shared/presentation/http/pagination.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../../../shared/presentation/http/success-response.js";
import type { AccountsService } from "../../application/services/accounts.service.js";
import {
  accountIdParamSchema,
  createAccountSchema,
  listAccountsQuerySchema,
  updateAccountSchema,
} from "../schemas/accounts.schemas.js";

type AuthenticatedRequest = Request & {
  auth?: { userId: string; sessionId: string };
};

export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  async create(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError("Dados para criação da conta inválidos.", parsed.error);
    }

    const account = await this.accountsService.createAccount({
      userId,
      name: parsed.data.name,
      type: parsed.data.type,
      initialBalance: parsed.data.initialBalance,
      ...(parsed.data.brand !== undefined ? { brand: parsed.data.brand } : {}),
      ...(parsed.data.institution !== undefined ? { institution: parsed.data.institution } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    });

    sendCreated(response, account);
  }

  async list(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const { page, pageSize, ...filterQuery } = request.query;
    const pagination = parsePagination({ page, pageSize });
    const parsedFilter = listAccountsQuerySchema.safeParse(filterQuery);
    if (!parsedFilter.success) {
      throw validationError("Parâmetros de listagem de contas inválidos.", parsedFilter.error);
    }

    const result = await this.accountsService.listAccounts({
      userId,
      page: pagination.page,
      pageSize: pagination.pageSize,
      offset: pagination.offset,
      ...(parsedFilter.data.status !== undefined ? { status: parsedFilter.data.status } : {}),
      ...(parsedFilter.data.type !== undefined ? { type: parsedFilter.data.type } : {}),
      ...(parsedFilter.data.search !== undefined ? { search: parsedFilter.data.search } : {}),
    });

    sendSuccess(response, result.items, result.meta);
  }

  async getById(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const accountId = parseAccountIdParam(request);
    const account = await this.accountsService.getAccountById({ userId, accountId });
    sendSuccess(response, account);
  }

  async update(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const accountId = parseAccountIdParam(request);
    const parsed = updateAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      throw validationError("Dados para atualização da conta inválidos.", parsed.error);
    }

    const account = await this.accountsService.updateAccount({
      userId,
      accountId,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.type !== undefined ? { type: parsed.data.type } : {}),
      ...(parsed.data.brand !== undefined ? { brand: parsed.data.brand } : {}),
      ...(parsed.data.institution !== undefined ? { institution: parsed.data.institution } : {}),
      ...(parsed.data.color !== undefined ? { color: parsed.data.color } : {}),
    });

    sendSuccess(response, account);
  }

  async deactivate(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const accountId = parseAccountIdParam(request);
    const account = await this.accountsService.deactivateAccount({ userId, accountId });
    sendSuccess(response, account);
  }

  async reactivate(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const accountId = parseAccountIdParam(request);
    const account = await this.accountsService.reactivateAccount({ userId, accountId });
    sendSuccess(response, account);
  }

  async delete(request: Request, response: Response): Promise<void> {
    const userId = requireUserId(request);
    const accountId = parseAccountIdParam(request);
    await this.accountsService.deleteAccount({ userId, accountId });
    sendNoContent(response);
  }
}

function requireUserId(request: Request): string {
  const userId = (request as AuthenticatedRequest).auth?.userId;
  if (!userId) {
    throw new AppError({
      status: 401,
      code: ErrorCode.UNAUTHORIZED,
      message: "Autenticação obrigatória.",
    });
  }
  return userId;
}

function parseAccountIdParam(request: Request): string {
  const parsed = accountIdParamSchema.safeParse(request.params);
  if (!parsed.success) {
    throw validationError("ID da conta inválido.", parsed.error);
  }
  return parsed.data.accountId;
}

function validationError(message: string, cause: unknown): AppError {
  return new AppError({
    status: 400,
    code: ErrorCode.VALIDATION_ERROR,
    message,
    cause,
  });
}
