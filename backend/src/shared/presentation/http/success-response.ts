import type { Response } from "express";

export interface SuccessResponse<T, M = never> {
  data: T;
  meta?: M;
}

const createdEnvelopes = new WeakSet<object>();

export function createSuccessResponse<T, M = never>(data: T, meta?: M): SuccessResponse<T, M> {
  if (data === undefined) {
    throw new TypeError("Success response data must not be undefined.");
  }
  if (typeof data === "object" && data !== null && createdEnvelopes.has(data)) {
    throw new TypeError("A success response must not wrap an existing envelope.");
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
