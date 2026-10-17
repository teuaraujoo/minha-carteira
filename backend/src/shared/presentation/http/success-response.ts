import type { Response } from "express";

export interface SuccessResponse<T, M = never> {
  data: T;
  meta?: M;
}

const createdEnvelopes = new WeakSet<object>();

export function createSuccessResponse<T, M = never>(data: T, meta?: M): SuccessResponse<T, M> {
  if (data === undefined) {
    throw new TypeError("Os dados da resposta de sucesso não podem ser undefined.");
  }
  if (typeof data === "object" && data !== null && createdEnvelopes.has(data)) {
    throw new TypeError("A resposta de sucesso não pode encapsular uma resposta já criada.");
  }
  const body: SuccessResponse<T, M> = meta === undefined ? { data } : { data, meta };
  createdEnvelopes.add(body);
  return body;
}

export function sendSuccess<T, M = never>(response: Response, data: T, meta?: M): Response {
  return response.status(200).json(createSuccessResponse(data, meta));
}

export function sendCreated<T, M = never>(response: Response, data: T, meta?: M): Response {
  return response.status(201).json(createSuccessResponse(data, meta));
}

export function sendNoContent(response: Response): Response {
  return response.status(204).end();
}
